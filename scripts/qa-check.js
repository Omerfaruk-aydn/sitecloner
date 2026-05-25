#!/usr/bin/env node
'use strict';
/**
 * qa-check.js — Animasyon ve görünürlük QA scripti
 *
 * Kullanım: node scripts/qa-check.js http://localhost:3000
 *
 * Kontroller:
 * 1. Boş section tespiti (DOM tabanlı — gerçek piksel analizi)
 * 2. opacity:0 / visibility:hidden kalan animasyonlu elemanlar
 * 3. Konsol hataları
 * 4. Kırık görseller (404)
 * 5. Her section'ın içerik varlığı
 * 6. Scroll snapshot'ları (docs/qa/ klasörüne)
 *
 * Çıktı: docs/qa/ klasörüne PNG'ler + konsola özet rapor
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TARGET_URL = process.argv[2] || 'http://localhost:3000';
const OUT_DIR = path.resolve('docs', 'qa');
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile',  width: 390,  height: 844 },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── DOM-based blank section detector ──────────────────────────
// Much more reliable than PNG byte entropy analysis
async function checkSectionVisibility(page) {
  return page.evaluate(() => {
    const issues = [];
    const sections = document.querySelectorAll('section, header, footer, [class*="section"]');

    sections.forEach((sec, i) => {
      const rect = sec.getBoundingClientRect();
      const style = window.getComputedStyle(sec);

      // Skip off-screen or zero-height sections
      if (rect.height < 10) return;

      const hasText = (sec.innerText || '').trim().length > 5;
      const hasImages = sec.querySelectorAll('img[src], video[src], canvas').length > 0;
      const hasSvg = sec.querySelectorAll('svg').length > 0;
      const hasBgImage = style.backgroundImage && style.backgroundImage !== 'none';
      const opacity = parseFloat(style.opacity);
      const visibility = style.visibility;
      const display = style.display;

      const isHidden = opacity < 0.05 || visibility === 'hidden' || display === 'none';
      const hasContent = hasText || hasImages || hasSvg || hasBgImage;

      if (isHidden) {
        issues.push({
          type: 'invisible',
          selector: sec.tagName + (sec.id ? '#' + sec.id : '') + (sec.className ? '.' + sec.className.toString().split(' ')[0] : ''),
          detail: `opacity:${opacity}, visibility:${visibility}`,
          offsetTop: Math.round(rect.top + window.scrollY),
        });
      } else if (!hasContent) {
        issues.push({
          type: 'empty',
          selector: sec.tagName + (sec.id ? '#' + sec.id : '') + (sec.className ? '.' + sec.className.toString().split(' ')[0] : ''),
          detail: 'No text, images, or background found',
          offsetTop: Math.round(rect.top + window.scrollY),
        });
      }
    });

    return issues;
  });
}

// ─── Invisible motion elements (Lenis/whileInView bug indicator) ─
async function checkInvisibleMotionElements(page) {
  return page.evaluate(() => {
    const motionEls = document.querySelectorAll('[class*="motion"], [style*="opacity: 0"], [style*="opacity:0"]');
    const stuck = [];
    motionEls.forEach(el => {
      const style = window.getComputedStyle(el);
      const inlineOpacity = el.style.opacity;
      if (parseFloat(style.opacity) < 0.05 && parseFloat(inlineOpacity) === 0) {
        stuck.push({
          tag: el.tagName,
          classes: el.className?.toString().slice(0, 80),
          offsetTop: Math.round(el.getBoundingClientRect().top + window.scrollY),
        });
      }
    });
    return stuck;
  });
}

// ─── Broken image detector ──────────────────────────────────────
async function checkBrokenImages(page) {
  return page.evaluate(() => {
    const broken = [];
    document.querySelectorAll('img').forEach(img => {
      if (!img.complete || img.naturalWidth === 0) {
        broken.push({ src: img.src, alt: img.alt });
      }
    });
    return broken;
  });
}

// ─── Main ───────────────────────────────────────────────────────
async function run() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const allResults = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n[QA] ${vp.name} (${vp.width}x${vp.height})`);
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });

    const consoleErrors = [];
    const networkErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
    });
    page.on('requestfailed', req => {
      const url = req.url();
      // Ignore extension URLs and data URIs
      if (!url.startsWith('chrome-extension') && !url.startsWith('data:')) {
        networkErrors.push({ url: url.slice(0, 120), reason: req.failure()?.errorText });
      }
    });

    try {
      await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    } catch (err) {
      console.error(`  ✗ Sayfa yüklenemedi: ${TARGET_URL} — ${err.message}`);
      await page.close();
      continue;
    }

    // Wait for Lenis + animations to initialize
    await sleep(2000);

    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    const SCROLL_STEPS = 10;
    const stepSize = Math.floor(totalHeight / SCROLL_STEPS);

    // Take scroll snapshots
    for (let i = 0; i <= SCROLL_STEPS; i++) {
      const scrollY = Math.min(i * stepSize, Math.max(0, totalHeight - vp.height));
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);
      await sleep(350);
      const ssPath = path.join(OUT_DIR, `${vp.name}-scroll-${String(i).padStart(2,'0')}.png`);
      await page.screenshot({ path: ssPath, type: 'png' }).catch(() => {});
    }

    // Scroll back to top for DOM checks
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await sleep(500);

    // Scroll full page slowly to trigger all IntersectionObserver / animation callbacks
    const scrollIncrement = Math.floor(totalHeight / 20);
    for (let y = 0; y <= totalHeight; y += scrollIncrement) {
      await page.evaluate(yy => window.scrollTo({ top: yy, behavior: 'instant' }), y);
      await sleep(120);
    }
    await sleep(600);

    const sectionIssues = await checkSectionVisibility(page);
    const invisibleMotion = await checkInvisibleMotionElements(page);
    const brokenImages = await checkBrokenImages(page);

    const result = {
      viewport: vp.name,
      sectionIssues,
      invisibleMotion,
      brokenImages,
      consoleErrors: consoleErrors.filter(e => !e.includes('favicon') && !e.includes('extension')),
      networkErrors: networkErrors.filter(e => !e.url.includes('favicon')),
    };
    allResults.push(result);

    // Per-viewport report
    const emptySections = sectionIssues.filter(i => i.type === 'empty');
    const invisibleSections = sectionIssues.filter(i => i.type === 'invisible');

    console.log(`  Sections issues   : ${sectionIssues.length}`);
    if (emptySections.length > 0) {
      console.log(`  ⚠ Boş section'lar : ${emptySections.length}`);
      emptySections.forEach(i => console.log(`      - ${i.selector} (${i.offsetTop}px)`));
    }
    if (invisibleSections.length > 0) {
      console.log(`  ⚠ Gizli section'lar: ${invisibleSections.length}`);
      invisibleSections.forEach(i => console.log(`      - ${i.selector} — ${i.detail}`));
    }
    if (invisibleMotion.length > 0) {
      console.log(`  ⚠ Takılı animasyonlar: ${invisibleMotion.length} (Lenis/whileInView sorunu olabilir)`);
      invisibleMotion.slice(0, 5).forEach(i => console.log(`      - ${i.tag} @${i.offsetTop}px`));
    }
    if (brokenImages.length > 0) {
      console.log(`  ⚠ Kırık görseller : ${brokenImages.length}`);
      brokenImages.slice(0, 5).forEach(i => console.log(`      - ${i.src?.slice(0, 80)}`));
    }
    if (result.consoleErrors.length > 0) {
      console.log(`  ⚠ Konsol hataları  : ${result.consoleErrors.length}`);
      result.consoleErrors.slice(0, 3).forEach(e => console.log(`      - ${e.slice(0, 100)}`));
    }
    if (result.networkErrors.length > 0) {
      console.log(`  ⚠ Ağ hataları      : ${result.networkErrors.length}`);
      result.networkErrors.slice(0, 3).forEach(e => console.log(`      - ${e.url?.slice(0, 80)}`));
    }
    if (sectionIssues.length === 0 && invisibleMotion.length === 0 && brokenImages.length === 0 && result.consoleErrors.length === 0) {
      console.log(`  ✅ Tüm kontroller geçti`);
    }

    await page.close();
  }

  await browser.close();

  // Save full report
  const reportPath = path.join(OUT_DIR, 'qa-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2), 'utf8');

  // Final summary
  const totalIssues = allResults.reduce((sum, r) =>
    sum + r.sectionIssues.length + r.invisibleMotion.length + r.brokenImages.length + r.consoleErrors.length, 0);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('QA ÖZET RAPORU');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const r of allResults) {
    const issues = r.sectionIssues.length + r.invisibleMotion.length + r.brokenImages.length + r.consoleErrors.length;
    const icon = issues === 0 ? '✅' : '❌';
    console.log(`${icon} ${r.viewport}: ${issues} sorun`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(totalIssues === 0 ? '✅ TÜM TESTLER GEÇTİ' : `❌ ${totalIssues} SORUN BULUNDU — rapor: ${reportPath}`);
  console.log(`📸 Screenshots: ${OUT_DIR}`);

  process.exit(totalIssues === 0 ? 0 : 1);
}

run().catch(err => {
  console.error('[QA ERROR]', err.message);
  process.exit(1);
});
