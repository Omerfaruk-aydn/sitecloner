#!/usr/bin/env node
'use strict';
/**
 * visual-diff.js — Orijinal site ile klon arasında pixel karşılaştırma
 * Kullanım: node scripts/visual-diff.js <original-url>
 * Çıktı: docs/research/diff.png, docs/research/diff-result.json
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

let pixelmatch, PNG;
try {
  const pm = require('pixelmatch');
  pixelmatch = pm.default || pm;
  PNG = require('pngjs').PNG;
} catch (_) {
  console.error('❌ pixelmatch ve pngjs gerekli: npm install pixelmatch pngjs');
  process.exit(1);
}

const [,, originalUrl, customCloneUrl] = process.argv;
const cloneUrl = customCloneUrl || 'http://localhost:3000';

const RESEARCH_DIR = path.resolve('docs/research');
fs.mkdirSync(RESEARCH_DIR, { recursive: true });

async function screenshot(browser, url, filePath, fullPage = false) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await require('./_dismiss-cookies')(page);
    await page.waitForTimeout(8000); // Wait for Aman intro loader
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    await page.waitForTimeout(1000); // Wait for scroll to settle
    await page.screenshot({ path: filePath, fullPage });
  } finally {
    await page.close();
  }
}

function loadPng(filePath) {
  return new Promise((resolve, reject) => {
    const png = new PNG();
    fs.createReadStream(filePath)
      .pipe(png)
      .on('parsed', function () { resolve(this); })
      .on('error', reject);
  });
}

function detectProblematicRegions(diffImg, width, height, threshold = 50) {
  const regions = [];
  const gridSize = 100;
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let diffPixels = 0;
      const x0 = col * gridSize;
      const y0 = row * gridSize;
      const x1 = Math.min(x0 + gridSize, width);
      const y1 = Math.min(y0 + gridSize, height);

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * width + x) * 4;
          if (diffImg.data[idx] > 128) diffPixels++;
        }
      }

      const cellTotal = (x1 - x0) * (y1 - y0);
      if (diffPixels / cellTotal > 0.1) {
        regions.push({
          x: x0, y: y0,
          width: x1 - x0, height: y1 - y0,
          diffRatio: (diffPixels / cellTotal * 100).toFixed(1) + '%',
          estimatedSection: y0 < 100 ? 'header/navbar' : y0 < 600 ? 'hero/üst' : y0 < 1200 ? 'orta' : 'alt/footer',
        });
      }
    }
  }

  return regions.slice(0, 10);
}

async function main() {
  if (!originalUrl) {
    console.error('❌ URL gerekli: node scripts/visual-diff.js <original-url>');
    process.exit(1);
  }

  console.log('\n🔍 Visual diff başlıyor...\n');

  const browser = await chromium.launch({ headless: true });
  const origPath = path.join(RESEARCH_DIR, 'diff-original.png');
  const clonePath = path.join(RESEARCH_DIR, 'diff-clone.png');

  console.log('  📸 Orijinal site screenshot alınıyor...');
  try {
    await screenshot(browser, originalUrl, origPath);
  } catch (err) {
    console.warn(`  ⚠️  Orijinal site screenshot alınamadı: ${err.message}`);
  }

  console.log('  📸 Klon site screenshot alınıyor...');
  try {
    await screenshot(browser, cloneUrl, clonePath);
  } catch (err) {
    console.error(`  ❌ Klon site screenshot alınamadı. localhost:3000 çalışıyor mu? ${err.message}`);
    await browser.close();
    process.exit(1);
  }

  await browser.close();

  if (!fs.existsSync(origPath)) {
    console.warn('  ⚠️  Orijinal screenshot yok. Sadece klon kontrol edildi.');
    const result = {
      error: 'Orijinal screenshot alınamadı',
      diffPercent: null,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(RESEARCH_DIR, 'diff-result.json'), JSON.stringify(result, null, 2));
    return;
  }

  const [origPng, clonePng] = await Promise.all([loadPng(origPath), loadPng(clonePath)]);

  const width = Math.min(origPng.width, clonePng.width);
  const height = Math.min(origPng.height, clonePng.height);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    origPng.data, clonePng.data, diff.data,
    width, height,
    { threshold: 0.1 }
  );

  const diffPath = path.join(RESEARCH_DIR, 'diff.png');
  diff.pack().pipe(fs.createWriteStream(diffPath));

  const totalPixels = width * height;
  const diffPercent = (diffPixels / totalPixels * 100).toFixed(2);
  const regions = detectProblematicRegions(diff, width, height);

  const result = {
    timestamp: new Date().toISOString(),
    diffPercent: parseFloat(diffPercent),
    diffPixels,
    totalPixels,
    resolution: { width, height },
    problematicRegions: regions,
  };

  fs.writeFileSync(
    path.join(RESEARCH_DIR, 'diff-result.json'),
    JSON.stringify(result, null, 2),
    'utf8'
  );

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (result.diffPercent < 2) {
    console.log('✅ PASSED — Pixel farkı: %' + diffPercent + ' (hedef: <%2)');
  } else if (result.diffPercent < 5) {
    console.log('⚠️  WARNING — Pixel farkı: %' + diffPercent);
    console.log('   Farklı bölgeler:');
    regions.forEach(r => {
      console.log(`   - ${r.estimatedSection} (${r.diffRatio} farklı, y:${r.y}px)`);
    });
  } else {
    console.log('❌ FAILED — Pixel farkı: %' + diffPercent + ' (kritik)');
    console.log('   En çok farklı bölgeler:');
    regions.slice(0, 5).forEach(r => {
      console.log(`   - ${r.estimatedSection} (${r.diffRatio} farklı, y:${r.y}px)`);
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Diff görüntüsü: docs/research/diff.png`);
  console.log(`  Detaylı rapor : docs/research/diff-result.json\n`);
}

main().catch(err => { console.error('❌ Visual diff hatası:', err.message); process.exit(1); });
