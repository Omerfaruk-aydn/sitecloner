#!/usr/bin/env node
'use strict';
/**
 * annotate-screenshots.js
 *
 * Her section'ı ayrı ayrı ekran görüntüsü alır, üzerine renk/font/spacing
 * bilgilerini yazar. AI bu görüntüleri okuyarak kod yazarken tahmin yapmak
 * zorunda kalmaz.
 *
 * Kullanım : node scripts/annotate-screenshots.js <url>
 * Çıktı    : docs/research/annotated/
 *              ├── 01-section-hero.png          ← sade screenshot
 *              ├── 01-section-hero-annotated.png ← üzerinde bilgi var
 *              └── 01-section-hero-styles.json   ← tüm computed değerler
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const URL     = process.argv[2];
const OUT_DIR = path.resolve('docs', 'research', 'annotated');

if (!URL) { console.error('❌  URL gerekli: node scripts/annotate-screenshots.js <url>'); process.exit(1); }

fs.mkdirSync(OUT_DIR, { recursive: true });

// Sayfaya inject edilecek overlay kodu — elemanlara computed style etiketi yapıştırır
const OVERLAY_SCRIPT = /* js */ `
(function () {
  const TAGS = ['h1','h2','h3','h4','h5','h6','p','span','a','button','img','video','svg'];
  const seen  = new WeakSet();

  function hexColor(rgb) {
    const m = rgb.match(/\\d+/g);
    if (!m || m.length < 3) return rgb;
    return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('').toUpperCase();
  }

  function makeLabel(el) {
    const cs   = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    if (seen.has(el)) return;
    seen.add(el);

    const info = [
      cs.fontSize !== '0px'      ? 'fs:' + cs.fontSize : null,
      cs.fontWeight !== 'normal' ? 'fw:' + cs.fontWeight : null,
      cs.letterSpacing !== 'normal' && cs.letterSpacing !== '0px' ? 'ls:' + cs.letterSpacing : null,
      cs.lineHeight !== 'normal' ? 'lh:' + cs.lineHeight : null,
      cs.color && cs.color !== 'rgba(0, 0, 0, 0)' ? hexColor(cs.color) : null,
      cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? 'bg:' + hexColor(cs.backgroundColor) : null,
    ].filter(Boolean).join('  ');

    if (!info) return;

    const badge = document.createElement('div');
    badge.className = '__qa-badge';
    badge.textContent = el.tagName.toLowerCase() + '  ' + info;
    badge.style.cssText = [
      'position:absolute',
      'z-index:2147483647',
      'background:rgba(15,15,15,0.88)',
      'color:#fff',
      'font:600 10px/1.4 monospace',
      'padding:2px 5px',
      'border-radius:3px',
      'pointer-events:none',
      'white-space:nowrap',
      'left:' + (rect.left + window.scrollX) + 'px',
      'top:' + (rect.top + window.scrollY - 18) + 'px',
    ].join(';');

    document.body.appendChild(badge);
  }

  TAGS.forEach(tag =>
    document.querySelectorAll(tag).forEach(el => makeLabel(el))
  );
})();
`;

// Bir elemanın önemli computed değerlerini döndürür
const STYLE_EXTRACTOR = /* js */ `
(function () {
  const INTERESTING = [
    'h1','h2','h3','h4','p','span','a','button',
    'nav','header','footer','section','[class*="hero"]',
    '[class*="card"]','[class*="btn"]','[class*="title"]',
  ];

  function hexColor(rgb) {
    const m = rgb.match(/\\d+/g);
    if (!m || m.length < 3) return rgb;
    return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('').toUpperCase();
  }

  const results = [];
  const seen    = new WeakSet();

  INTERESTING.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);
      const cs   = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 4) return;

      results.push({
        tag       : el.tagName.toLowerCase(),
        class     : el.className?.toString().slice(0,120),
        text      : el.innerText?.slice(0,80),
        rect      : { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        styles    : {
          fontSize      : cs.fontSize,
          fontFamily    : cs.fontFamily.split(',')[0].replace(/['"]/g,'').trim(),
          fontWeight    : cs.fontWeight,
          lineHeight    : cs.lineHeight,
          letterSpacing : cs.letterSpacing,
          color         : hexColor(cs.color),
          background    : hexColor(cs.backgroundColor),
          padding       : cs.padding,
          margin        : cs.margin,
          borderRadius  : cs.borderRadius,
          opacity       : cs.opacity,
          transform     : cs.transform !== 'none' ? cs.transform : undefined,
          transition    : cs.transition !== 'all 0s ease 0s' ? cs.transition : undefined,
        },
      });
    });
  });

  return results;
})();
`;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log(`\n📸  Annotated screenshot başlıyor → ${URL}\n`);

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
  await require('./_dismiss-cookies')(page);
  await page.waitForTimeout(1000);

  // ── Tüm sayfanın sade tam ekran görüntüsü ──
  const fullPath = path.join(OUT_DIR, '00-full-page.png');
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`  ✅  docs/research/annotated/00-full-page.png`);

  // ── Computed style dump (tüm sayfa) ──
  const allStyles = await page.evaluate(STYLE_EXTRACTOR);
  fs.writeFileSync(
    path.join(OUT_DIR, '00-full-styles.json'),
    JSON.stringify(allStyles, null, 2)
  );
  console.log(`  ✅  docs/research/annotated/00-full-styles.json  (${allStyles.length} element)`);

  // ── Section bazında kırpma + annotasyon ──
  const sections = await page.evaluate(() => {
    const sels = ['section', 'header', 'nav', 'footer', '[class*="section"]', 'main > div'];
    const found = [];
    const seen  = new WeakSet();
    sels.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        const r = el.getBoundingClientRect();
        const scrollY = window.scrollY;
        if (r.height < 50) return;
        found.push({
          tag   : el.tagName.toLowerCase(),
          id    : el.id || '',
          class : el.className?.toString().slice(0, 80),
          top   : Math.round(r.top + scrollY),
          left  : Math.round(r.left),
          width : Math.round(r.width),
          height: Math.round(r.height),
        });
      });
    });
    return found;
  });

  const VIEWPORT_W = 1440;
  const VIEWPORT_H = 900;

  for (let i = 0; i < sections.length; i++) {
    const sec  = sections[i];
    const slug = `${String(i + 1).padStart(2, '0')}-${sec.tag}${sec.id ? '-' + sec.id : ''}`;

    // Geçersiz boyut — atla
    if (sec.width < 4 || sec.height < 4) {
      console.log(`  ⚠️   ${slug} — geçersiz boyut, atlandı`);
      continue;
    }

    // Section'ı viewport'un üstüne hizala — clip artık VIEWPORT koordinatında
    const scrollTo = Math.max(0, sec.top);
    await page.evaluate(y => window.scrollTo({ top: y }), scrollTo);
    await page.waitForTimeout(600);

    // Viewport-relative clip: scroll sonrası section y=0'dan başlar
    const vpX = Math.max(0, sec.left);
    const vpY = 0;
    const vpW = Math.min(sec.width, VIEWPORT_W - vpX);
    const vpH = Math.min(sec.height, VIEWPORT_H);

    if (vpW < 4 || vpH < 4) {
      console.log(`  ⚠️   ${slug} — viewport'ta görünmüyor, atlandı`);
      continue;
    }

    const clip = { x: vpX, y: vpY, width: vpW, height: vpH };

    // Sade screenshot
    try {
      const plainPath = path.join(OUT_DIR, `${slug}.png`);
      await page.screenshot({ path: plainPath, clip });
    } catch (e) {
      console.log(`  ⚠️   ${slug}.png — screenshot hatası: ${e.message}`);
    }

    // Section içindeki elemanların stil dump'u
    let sectionStyles = [];
    try {
      sectionStyles = await page.evaluate(({ top, height }) => {
        function hexColor(rgb) {
          const m = rgb.match(/\d+/g);
          if (!m || m.length < 3) return rgb;
          return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('').toUpperCase();
        }
        const els = document.elementsFromPoint(window.innerWidth / 2, top - window.scrollY + height / 2);
        const results = [];
        const seen = new WeakSet();
        els.forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          const cs = window.getComputedStyle(el);
          results.push({
            tag   : el.tagName.toLowerCase(),
            class : el.className?.toString().slice(0, 80),
            text  : el.innerText?.slice(0, 60),
            styles: {
              fontSize     : cs.fontSize,
              fontFamily   : cs.fontFamily.split(',')[0].replace(/['"]/g,'').trim(),
              fontWeight   : cs.fontWeight,
              color        : hexColor(cs.color),
              background   : hexColor(cs.backgroundColor),
              padding      : cs.padding,
              borderRadius : cs.borderRadius,
              transition   : cs.transition !== 'all 0s ease 0s' ? cs.transition : undefined,
            },
          });
        });
        return results;
      }, { top: sec.top, height: sec.height });
    } catch (e) {
      console.log(`  ⚠️   ${slug}-styles — evaluate hatası: ${e.message}`);
    }

    fs.writeFileSync(
      path.join(OUT_DIR, `${slug}-styles.json`),
      JSON.stringify(sectionStyles, null, 2)
    );

    // Annotated screenshot — overlay inject et
    try {
      await page.evaluate(OVERLAY_SCRIPT);
      const annotPath = path.join(OUT_DIR, `${slug}-annotated.png`);
      await page.screenshot({ path: annotPath, clip });
      // Overlay badge'leri temizle
      await page.evaluate(() => {
        document.querySelectorAll('.__qa-badge').forEach(b => b.remove());
      });
    } catch (e) {
      console.log(`  ⚠️   ${slug}-annotated — screenshot hatası: ${e.message}`);
    }

    console.log(`  ✅  ${slug}.png + ${slug}-annotated.png + ${slug}-styles.json`);
  }

  await browser.close();

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅  ${sections.length} section işlendi → docs/research/annotated/`);
  console.log(`   AI şu dosyaları okuyarak kod yazmalı:`);
  console.log(`   • XX-section-annotated.png  ← görsel referans`);
  console.log(`   • XX-section-styles.json    ← exact CSS değerleri`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
