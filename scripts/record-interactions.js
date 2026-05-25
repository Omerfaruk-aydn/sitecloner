#!/usr/bin/env node
'use strict';
/**
 * record-interactions.js — Playwright ile hover/focus/active state kayıt
 * Kullanım: node scripts/record-interactions.js <url>
 * Çıktı: docs/interactions/interactions-map.json + state screenshots
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [,, targetUrl] = process.argv;
if (!targetUrl) {
  console.error('❌ URL gerekli: node scripts/record-interactions.js <url>');
  process.exit(1);
}

const INTERACTIONS_DIR = path.resolve('docs/interactions');
fs.mkdirSync(INTERACTIONS_DIR, { recursive: true });

const SELECTORS = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  '[class*="btn"]',
  '[class*="button"]',
  '[class*="card"]',
  '[class*="nav"] a',
  '[class*="menu"] a',
  '[class*="tab"]',
  '[class*="accordion"]',
  '[role="button"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[class*="link"]',
  '[class*="toggle"]',
];

const COMPUTED_PROPS = [
  'color', 'backgroundColor', 'borderColor', 'borderRadius',
  'boxShadow', 'transform', 'opacity', 'transition', 'outline', 'textDecoration',
];

async function getComputedStyles(page, selector) {
  return page.evaluate((sel, props) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const styles = getComputedStyle(el);
    const result = {};
    for (const p of props) result[p] = styles[p];
    return result;
  }, selector, COMPUTED_PROPS);
}

async function screenshotElement(page, element, suffix, index, selector) {
  try {
    const box = await element.boundingBox();
    if (!box) return null;
    const clip = {
      x: Math.max(0, box.x - 12),
      y: Math.max(0, box.y - 12),
      width: box.width + 24,
      height: box.height + 24,
    };
    const fileName = `el-${index}-${suffix}.png`;
    const filePath = path.join(INTERACTIONS_DIR, fileName);
    await page.screenshot({ path: filePath, clip });
    return fileName;
  } catch (_) {
    return null;
  }
}

async function main() {
  console.log(`\n🖱️  Interaction kayıt başlıyor: ${targetUrl}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();

  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 });
  await require('./_dismiss-cookies')(page);

  const elements = [];
  let globalIndex = 0;
  const seenElements = new WeakSet();

  for (const selector of SELECTORS) {
    let handles;
    try {
      handles = await page.$$(selector);
    } catch (_) {
      continue;
    }

    const limited = handles.slice(0, 8);

    for (const handle of limited) {
      try {
        if (seenElements.has(handle)) continue;

        const isVisible = await handle.isVisible();
        if (!isVisible) continue;

        seenElements.add(handle);

        await handle.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);

        const box = await handle.boundingBox();
        if (!box) continue;

        const uniqueSelector = await page.evaluate(el => {
          const tag = el.tagName.toLowerCase();
          const cls = [...el.classList].slice(0, 2).join('.');
          return cls ? `${tag}.${cls}` : tag;
        }, handle);

        const transitionDuration = await page.evaluate(el => {
          return getComputedStyle(el).transitionDuration;
        }, handle);

        // DEFAULT state
        await page.mouse.move(-100, -100);
        await page.waitForTimeout(200);
        const defaultScreenshot = await screenshotElement(page, handle, 'default', globalIndex, selector);
        const defaultStyles = await page.evaluate((el, props) => {
          const s = getComputedStyle(el);
          const r = {};
          for (const p of props) r[p] = s[p];
          return r;
        }, handle, COMPUTED_PROPS);

        // HOVER state
        await handle.hover();
        await page.waitForTimeout(500);
        const hoverScreenshot = await screenshotElement(page, handle, 'hover', globalIndex, selector);
        const hoverStyles = await page.evaluate((el, props) => {
          const s = getComputedStyle(el);
          const r = {};
          for (const p of props) r[p] = s[p];
          return r;
        }, handle, COMPUTED_PROPS);

        // FOCUS state
        await handle.focus();
        await page.waitForTimeout(300);
        const focusScreenshot = await screenshotElement(page, handle, 'focus', globalIndex, selector);

        // ACTIVE state
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(150);
        const activeScreenshot = await screenshotElement(page, handle, 'active', globalIndex, selector);
        await page.mouse.up();

        await page.mouse.move(-100, -100);
        await page.waitForTimeout(200);

        elements.push({
          index: globalIndex,
          selector: uniqueSelector,
          originalSelector: selector,
          transitionDuration,
          states: {
            default: { screenshot: defaultScreenshot, styles: defaultStyles },
            hover: { screenshot: hoverScreenshot, styles: hoverStyles },
            focus: { screenshot: focusScreenshot, styles: null },
            active: { screenshot: activeScreenshot, styles: null },
          },
        });

        globalIndex++;
        process.stdout.write(`\r  Element: ${globalIndex} kaydedildi`);

      } catch (_) {
        // Element'i atla, devam et
      }
    }
  }

  await browser.close();

  const map = {
    url: targetUrl,
    timestamp: new Date().toISOString(),
    totalElements: elements.length,
    elements,
  };

  fs.writeFileSync(
    path.join(INTERACTIONS_DIR, 'interactions-map.json'),
    JSON.stringify(map, null, 2),
    'utf8'
  );

  console.log(`\n\n✅ Interaction kayıt tamamlandı`);
  console.log(`   ${elements.length} element kaydedildi`);
  console.log(`   docs/interactions/interactions-map.json\n`);
}

main().catch(err => { console.error('❌ Interaction kayıt hatası:', err.message); process.exit(1); });
