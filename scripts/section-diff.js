#!/usr/bin/env node
'use strict';
/**
 * section-diff.js
 *
 * Orijinal site ile klonu section bazında karşılaştırır.
 * Her section için: orijinal | klon | diff (kırmızı alanlar = fark)
 * şeklinde 3'lü yan yana PNG üretir. AI bu görüntüye bakarak
 * tam olarak neyi düzeltmesi gerektiğini görür.
 *
 * Kullanım : node scripts/section-diff.js <original-url> <clone-url>
 * Örnek    : node scripts/section-diff.js https://nusr-et.com.tr http://localhost:3000
 *
 * Çıktı    : docs/qa/diff/
 *              ├── 01-hero-diff.png         ← orijinal | klon | fark
 *              ├── diff-report.json         ← sayısal fark yüzdeleri
 *              ├── typography-diff.json     ← font/renk farkları
 *              └── color-diff.json          ← renk paleti farkları
 */

const { chromium } = require('playwright');
const { PNG }      = require('pngjs');
const pixelmatch   = require('pixelmatch');
const fs   = require('fs');
const path = require('path');

const ORIGINAL_URL = process.argv[2];
const CLONE_URL    = process.argv[3] || 'http://localhost:3000';
const OUT_DIR      = path.resolve('docs', 'qa', 'diff');

if (!ORIGINAL_URL) {
  console.error('❌  Kullanım: node scripts/section-diff.js <original-url> [clone-url]');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORT = { width: 1440, height: 900 };

// ─── Yardımcı ────────────────────────────────────────────────────────────────

function hexColor(rgb) {
  const m = rgb?.match?.(/\d+/g);
  if (!m || m.length < 3) return rgb || '';
  return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('').toUpperCase();
}

function resizePng(src, targetW, targetH) {
  const out = new PNG({ width: targetW, height: targetH });
  for (let i = 0; i < out.width * out.height * 4; i += 4) {
    out.data[i] = 230; out.data[i+1] = 230; out.data[i+2] = 230; out.data[i+3] = 255;
  }
  const scaleX = src.width / targetW;
  const scaleY = src.height / targetH;
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const srcX   = Math.min(Math.floor(x * scaleX), src.width - 1);
      const srcY   = Math.min(Math.floor(y * scaleY), src.height - 1);
      const srcIdx = (srcY * src.width + srcX) * 4;
      const dstIdx = (y * targetW + x) * 4;
      out.data[dstIdx]     = src.data[srcIdx];
      out.data[dstIdx + 1] = src.data[srcIdx + 1];
      out.data[dstIdx + 2] = src.data[srcIdx + 2];
      out.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }
  return out;
}

// 3 PNG'yi (original | clone | diff) yan yana birleştirir
function stitchTriple(origPng, clonePng, diffPng, outPath, label) {
  const W       = origPng.width;
  const H       = origPng.height;
  const LABEL_H = 24;
  const SEP     = 4;
  const totalW  = W * 3 + SEP * 2;
  const totalH  = H + LABEL_H;
  const out     = new PNG({ width: totalW, height: totalH, colorType: 2 });

  // Arka plan (koyu gri)
  for (let i = 0; i < out.width * out.height * 4; i += 4) {
    out.data[i] = 30; out.data[i+1] = 30; out.data[i+2] = 30; out.data[i+3] = 255;
  }

  [[origPng, 0], [clonePng, W + SEP], [diffPng, (W + SEP) * 2]].forEach(([img, ox]) => {
    const src = img.width !== W || img.height !== H ? resizePng(img, W, H) : img;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const si = (y * src.width + x) * 4;
        const di = ((y + LABEL_H) * out.width + ox + x) * 4;
        out.data[di]     = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = src.data[si + 3];
      }
    }
  });

  fs.writeFileSync(outPath, PNG.sync.write(out));
}

// ─── Section screenshot çek ───────────────────────────────────────────────────

async function getSections(page) {
  return page.evaluate(() => {
    const sels = ['section', 'header', 'nav', 'footer'];
    const found = [];
    const seen  = new WeakSet();
    sels.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        const r = el.getBoundingClientRect();
        const scrollY = window.scrollY;
        if (r.height < 60) return;
        found.push({
          tag  : el.tagName.toLowerCase(),
          id   : el.id || '',
          class: el.className?.toString().slice(0, 50),
          top  : Math.round(r.top + scrollY),
          left : 0,
          width: Math.round(r.width),
          height: Math.min(Math.round(r.height), 2000), // max 2000px per section
        });
      });
    });
    return found;
  });
}

async function screenshotSection(page, sec) {
  await page.evaluate(y => window.scrollTo({ top: Math.max(0, y - 50) }), sec.top);
  await page.waitForTimeout(500);
  const buf = await page.screenshot({
    clip: { x: sec.left, y: sec.top, width: sec.width, height: sec.height },
  });
  return PNG.sync.read(buf);
}

async function getTypographyData(page) {
  return page.evaluate(() => {
    function hexColor(rgb) {
      const m = rgb?.match?.(/\d+/g);
      if (!m || m.length < 3) return rgb;
      return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('').toUpperCase();
    }
    const result = {};
    ['h1','h2','h3','h4','p','a','button','span'].forEach(tag => {
      const el = document.querySelector(tag);
      if (!el) return;
      const cs = window.getComputedStyle(el);
      result[tag] = {
        fontSize    : cs.fontSize,
        fontFamily  : cs.fontFamily.split(',')[0].replace(/['"]/g,'').trim(),
        fontWeight  : cs.fontWeight,
        lineHeight  : cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        color       : hexColor(cs.color),
      };
    });
    return result;
  });
}

async function getColorPalette(page) {
  return page.evaluate(() => {
    function hexColor(rgb) {
      const m = rgb?.match?.(/\d+/g);
      if (!m || m.length < 3) return rgb;
      return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('').toUpperCase();
    }
    const colors = new Set();
    document.querySelectorAll('*').forEach(el => {
      const cs = window.getComputedStyle(el);
      if (cs.color && cs.color !== 'rgba(0, 0, 0, 0)') colors.add(hexColor(cs.color));
      if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') colors.add(hexColor(cs.backgroundColor));
    });
    return [...colors].filter(c => c && c !== '#000000' && c !== '#FFFFFF' && c.startsWith('#'));
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🔍  Section diff başlıyor`);
  console.log(`   Orijinal : ${ORIGINAL_URL}`);
  console.log(`   Klon     : ${CLONE_URL}\n`);

  const browser = await chromium.launch({ headless: true });

  // Orijinal sayfayı aç
  const origPage = await browser.newPage();
  await origPage.setViewport(VIEWPORT);
  await origPage.goto(ORIGINAL_URL, { waitUntil: 'networkidle', timeout: 45000 });
  await require('./_dismiss-cookies')(origPage);

  // Klon sayfayı aç
  const clonePage = await browser.newPage();
  await clonePage.setViewport(VIEWPORT);
  await clonePage.goto(CLONE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await clonePage.waitForTimeout(2000);

  // Section listelerini al
  const origSections  = await getSections(origPage);
  const cloneSections = await getSections(clonePage);

  console.log(`  Orijinal sections : ${origSections.length}`);
  console.log(`  Klon sections     : ${cloneSections.length}\n`);

  const diffReport    = [];
  const count         = Math.min(origSections.length, cloneSections.length, 15);

  for (let i = 0; i < count; i++) {
    const oSec = origSections[i];
    const cSec = cloneSections[i];
    const slug = `${String(i+1).padStart(2,'0')}-${oSec.tag}${oSec.id ? '-' + oSec.id : ''}`;

    // Her iki section'ın genişliğini eşitle
    const W = Math.min(oSec.width, cSec.width, VIEWPORT.width);
    const H = Math.min(oSec.height, cSec.height);

    try {
      const origPng  = await screenshotSection(origPage, { ...oSec, width: W, height: H });
      const clonePng = await screenshotSection(clonePage, { ...cSec, width: W, height: H });

      // Boyutları eşitle
      const oResized = origPng.width !== W || origPng.height !== H ? resizePng(origPng, W, H) : origPng;
      const cResized = clonePng.width !== W || clonePng.height !== H ? resizePng(clonePng, W, H) : clonePng;

      // Pixelmatch ile diff hesapla
      const diffPng    = new PNG({ width: W, height: H });
      const diffPixels = pixelmatch(
        oResized.data, cResized.data, diffPng.data,
        W, H,
        { threshold: 0.1, includeAA: false, diffColor: [255, 50, 50] }
      );

      const totalPixels   = W * H;
      const diffPercent   = ((diffPixels / totalPixels) * 100).toFixed(2);
      const status        = parseFloat(diffPercent) < 2 ? '✅' : parseFloat(diffPercent) < 8 ? '⚠ ' : '❌';

      // 3'lü PNG üret
      const outPath = path.join(OUT_DIR, `${slug}-diff.png`);
      stitchTriple(oResized, cResized, diffPng, outPath, slug);

      // Ayrıca sadece diff PNG'yi de kaydet
      fs.writeFileSync(path.join(OUT_DIR, `${slug}-diff-only.png`), PNG.sync.write(diffPng));

      diffReport.push({
        index      : i + 1,
        slug,
        tag        : oSec.tag,
        diffPixels,
        diffPercent: parseFloat(diffPercent),
        status     : status.trim(),
        outputFile : `${slug}-diff.png`,
      });

      console.log(`  ${status} [${String(i+1).padStart(2,'0')}] ${oSec.tag.padEnd(8)} → fark: %${diffPercent}`);

    } catch (err) {
      console.warn(`  ⚠  ${slug} atlandı: ${err.message.slice(0, 60)}`);
    }
  }

  // ── Typography diff ──
  const [origTypo, cloneTypo] = await Promise.all([
    getTypographyData(origPage),
    getTypographyData(clonePage),
  ]);

  const typoDiff = {};
  Object.keys(origTypo).forEach(tag => {
    const diffs = {};
    const orig  = origTypo[tag] || {};
    const clone = cloneTypo[tag] || {};
    Object.keys(orig).forEach(prop => {
      if (orig[prop] !== clone[prop]) {
        diffs[prop] = { original: orig[prop], clone: clone[prop] || 'EKSIK' };
      }
    });
    if (Object.keys(diffs).length > 0) typoDiff[tag] = diffs;
  });

  // ── Color palette diff ──
  const [origColors, cloneColors] = await Promise.all([
    getColorPalette(origPage),
    getColorPalette(clonePage),
  ]);

  const colorDiff = {
    originalOnly: origColors.filter(c => !cloneColors.includes(c)).slice(0, 30),
    cloneOnly   : cloneColors.filter(c => !origColors.includes(c)).slice(0, 30),
    common      : origColors.filter(c => cloneColors.includes(c)).slice(0, 30),
  };

  await browser.close();

  // ── Çıktıları kaydet ──
  fs.writeFileSync(path.join(OUT_DIR, 'diff-report.json'),    JSON.stringify(diffReport, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'typography-diff.json'), JSON.stringify(typoDiff, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'color-diff.json'),      JSON.stringify(colorDiff, null, 2));

  // ── Özet rapor ──
  const avgDiff   = diffReport.reduce((s, r) => s + r.diffPercent, 0) / (diffReport.length || 1);
  const problems  = diffReport.filter(r => r.diffPercent > 2);
  const typoCount = Object.keys(typoDiff).length;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`DIFF RAPORU`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Ortalama fark    : %${avgDiff.toFixed(2)}`);
  console.log(`  Sorunlu sections : ${problems.length}/${diffReport.length}`);
  console.log(`  Typography farkı : ${typoCount} eleman`);
  console.log(`  Renk paleti      : ${colorDiff.originalOnly.length} renk eksik klonda`);
  if (colorDiff.originalOnly.length > 0) {
    console.log(`  Eksik renkler    : ${colorDiff.originalOnly.slice(0,8).join(', ')}`);
  }
  console.log(`\n  AI şu dosyaları okuyarak farkları gidermeli:`);
  problems.forEach(p => console.log(`  → docs/qa/diff/${p.outputFile}  (%${p.diffPercent})`));
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
