#!/usr/bin/env node
'use strict';
/**
 * interaction-map.js
 *
 * Sayfadaki tüm interaktif elemanları (buton, link, dropdown tetikleyici)
 * tespit eder. Her eleman için 3 state ekran görüntüsü alır:
 *   default → hover → active/focus
 * Ve bunları yan yana birleştirerek AI'ın okuyabileceği grid oluşturur.
 *
 * Kullanım : node scripts/interaction-map.js <url>
 * Çıktı    : docs/research/interactions/
 *              ├── interaction-map.json          ← tüm etkileşim haritası
 *              ├── overlays.json                 ← hangi buton ne açıyor
 *              └── states/
 *                   └── btn-XX-default.png / hover.png / active.png
 */

const { chromium } = require('playwright');
const { PNG }      = require('pngjs');
const fs   = require('fs');
const path = require('path');

const URL     = process.argv[2];
const OUT_DIR = path.resolve('docs', 'research', 'interactions');

if (!URL) { console.error('❌  URL gerekli: node scripts/interaction-map.js <url>'); process.exit(1); }

fs.mkdirSync(path.join(OUT_DIR, 'states'), { recursive: true });

// 3 PNG'yi yan yana birleştirir (default | hover | active)
function stitchHorizontal(pngPaths, outPath) {
  const images = pngPaths.map(p => {
    if (!fs.existsSync(p)) return null;
    return PNG.sync.read(fs.readFileSync(p));
  }).filter(Boolean);

  if (images.length === 0) return;

  const LABEL_H = 20;
  const PAD     = 2;
  const maxH    = Math.max(...images.map(i => i.height));
  const totalW  = images.reduce((s, i) => s + i.width + PAD, 0) - PAD;
  const out     = new PNG({ width: totalW, height: maxH + LABEL_H, colorType: 2 });

  // Beyaz arka plan
  for (let i = 0; i < out.width * out.height * 4; i += 4) {
    out.data[i] = 240; out.data[i+1] = 240; out.data[i+2] = 240; out.data[i+3] = 255;
  }

  let offsetX = 0;
  images.forEach(img => {
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const srcIdx  = (y * img.width + x) * 4;
        const dstIdx  = ((y + LABEL_H) * out.width + offsetX + x) * 4;
        out.data[dstIdx]     = img.data[srcIdx];
        out.data[dstIdx + 1] = img.data[srcIdx + 1];
        out.data[dstIdx + 2] = img.data[srcIdx + 2];
        out.data[dstIdx + 3] = img.data[srcIdx + 3];
      }
    }
    offsetX += img.width + PAD;
  });

  fs.writeFileSync(outPath, PNG.sync.write(out));
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log(`\n🖱  Etkileşim haritası başlıyor → ${URL}\n`);

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
  await require('./_dismiss-cookies')(page);
  await page.waitForTimeout(1000);

  // ── Tüm interaktif elemanları bul ──
  const elements = await page.evaluate(() => {
    const selectors = [
      'button', 'a[href]', '[role="button"]',
      '[class*="btn"]', '[class*="card"]',
      '[class*="menu"]', '[class*="nav"]',
      '[class*="toggle"]', '[class*="trigger"]',
      'input', 'select', '[tabindex]',
    ];
    const found = [];
    const seen  = new WeakSet();

    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return;
        const cs = window.getComputedStyle(el);
        found.push({
          tag     : el.tagName.toLowerCase(),
          class   : el.className?.toString().slice(0, 100),
          text    : el.innerText?.slice(0, 50) || el.getAttribute('aria-label') || '',
          href    : el.getAttribute('href') || '',
          type    : el.getAttribute('type') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          rect    : {
            x: Math.round(rect.x),
            y: Math.round(rect.y + window.scrollY),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          },
          cursor  : cs.cursor,
          hasTransition: cs.transitionDuration !== '0s',
        });
      });
    });

    return found.filter(el => el.cursor !== 'auto' || el.tag === 'button' || el.tag === 'a');
  });

  console.log(`  Tespit edilen interaktif eleman: ${elements.length}`);

  const interactionMap = [];
  const SHOT_PADDING   = 12; // px — screenshot etrafında boşluk

  for (let i = 0; i < Math.min(elements.length, 40); i++) {
    const el   = elements[i];
    const slug = `el-${String(i + 1).padStart(2, '0')}`;

    try {
      // Scroll: elemanı viewport'un üstüne getir (y=200 civarı)
      const scrollTo = Math.max(0, el.rect.y - 200);
      await page.evaluate(y => window.scrollTo({ top: y }), scrollTo);
      await page.waitForTimeout(300);

      // Viewport-relative koordinatlar: document_y - scroll_y
      const vpY = el.rect.y - scrollTo;
      const vpX = Math.max(0, el.rect.x - SHOT_PADDING);
      const vpW = Math.min(el.rect.w + SHOT_PADDING * 2, 1440 - vpX);
      const vpH = Math.min(el.rect.h + SHOT_PADDING * 2, 900 - Math.max(0, vpY - SHOT_PADDING));

      if (vpW < 4 || vpH < 4 || vpY < 0 || vpY > 860) {
        console.log(`  ⚠  ${slug} atlandı: viewport dışında`);
        continue;
      }

      const clip = {
        x     : vpX,
        y     : Math.max(0, vpY - SHOT_PADDING),
        width : vpW,
        height: vpH,
      };

      // Viewport'ta mouse konumu (scroll-relative değil, direkt viewport px)
      const mouseX = el.rect.x + el.rect.w / 2;
      const mouseY = vpY + el.rect.h / 2;

      // 1. Default state
      const defaultPath = path.join(OUT_DIR, 'states', `${slug}-default.png`);
      await page.screenshot({ path: defaultPath, clip });

      // 2. Hover state
      const hoverPath = path.join(OUT_DIR, 'states', `${slug}-hover.png`);
      await page.mouse.move(mouseX, mouseY);
      await page.waitForTimeout(350);
      await page.screenshot({ path: hoverPath, clip });

      // 3. Active/focus state
      const activePath = path.join(OUT_DIR, 'states', `${slug}-active.png`);
      let overlayOpened = false;

      let beforeClick = 0;
      try { beforeClick = await page.evaluate(() => document.body.innerHTML.length); } catch {}
      await page.mouse.down();
      await page.waitForTimeout(120);
      await page.screenshot({ path: activePath, clip });
      await page.mouse.up();
      await page.waitForTimeout(400);

      let afterClick = 0;
      try { afterClick = await page.evaluate(() => document.body.innerHTML.length); } catch {}
      if (Math.abs(afterClick - beforeClick) > 100) {
        overlayOpened = true;
        const overlayPath = path.join(OUT_DIR, 'states', `${slug}-overlay.png`);
        await page.screenshot({ path: overlayPath });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        // Sayfa navigate ettiyse ana sayfaya geri dön
        try { await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 }); } catch {}
      }

      // Hover'dan çık
      await page.mouse.move(0, 0);
      await page.waitForTimeout(150);

      // Grid oluştur (default | hover | active)
      const gridPath = path.join(OUT_DIR, 'states', `${slug}-grid.png`);
      stitchHorizontal([defaultPath, hoverPath, activePath], gridPath);

      const record = {
        index       : i + 1,
        slug,
        tag         : el.tag,
        text        : el.text,
        class       : el.class,
        href        : el.href,
        ariaLabel   : el.ariaLabel,
        rect        : el.rect,
        hasTransition: el.hasTransition,
        opensOverlay: overlayOpened,
        screenshots : {
          default : `states/${slug}-default.png`,
          hover   : `states/${slug}-hover.png`,
          active  : `states/${slug}-active.png`,
          grid    : `states/${slug}-grid.png`,
          overlay : overlayOpened ? `states/${slug}-overlay.png` : null,
        },
      };

      interactionMap.push(record);
      console.log(`  [${String(i+1).padStart(2,'0')}] ${el.tag.padEnd(7)} "${el.text.slice(0,30).padEnd(30)}" ${overlayOpened ? '→ OVERLAY AÇTI' : ''}`);

    } catch (err) {
      console.warn(`  ⚠  ${slug} atlandı: ${err.message.slice(0, 60)}`);
    }
  }

  // ── Overlay trigger haritası ──
  const overlays = interactionMap.filter(el => el.opensOverlay).map(el => ({
    trigger  : { tag: el.tag, text: el.text, class: el.class },
    screenshot: el.screenshots.overlay,
    gridShot  : el.screenshots.grid,
  }));

  // ── Event listener haritası (window.__listeners inject) ──
  const eventListeners = await page.evaluate(() => {
    const results = [];
    // Tüm elemanların listener'larını kontrol et (overridden addEventListener ile)
    const els = document.querySelectorAll('button, a, [role="button"], [class*="toggle"], [class*="menu"]');
    els.forEach(el => {
      // Sadece hangi event'lerin binding'i var onu tahmin et
      const evs = [];
      if (el.onclick) evs.push('click');
      if (el.onmouseenter) evs.push('mouseenter');
      if (el.onfocus) evs.push('focus');
      const rect = el.getBoundingClientRect();
      if (evs.length > 0 || el.tagName === 'BUTTON' || el.tagName === 'A') {
        results.push({
          tag   : el.tagName.toLowerCase(),
          text  : el.innerText?.slice(0, 40),
          class : el.className?.toString().slice(0, 80),
          events: evs,
          rect  : { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        });
      }
    });
    return results;
  });

  fs.writeFileSync(path.join(OUT_DIR, 'interaction-map.json'), JSON.stringify(interactionMap, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'overlays.json'), JSON.stringify(overlays, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'event-listeners.json'), JSON.stringify(eventListeners, null, 2));

  await browser.close();

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅  Etkileşim haritası tamamlandı`);
  console.log(`   Toplam eleman   : ${interactionMap.length}`);
  console.log(`   Overlay açanlar : ${overlays.length}`);
  console.log(`\n   AI şu dosyaları okuyarak hover/active efektleri yazmalı:`);
  console.log(`   → docs/research/interactions/interaction-map.json`);
  console.log(`   → docs/research/interactions/states/el-XX-grid.png  ← default|hover|active`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
