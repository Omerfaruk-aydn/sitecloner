#!/usr/bin/env node
'use strict';
/**
 * video-to-frames.js
 *
 * Kaydedilen video dosyasından AI'ın okuyabileceği frame'ler çıkarır.
 * Claude, Read tool ile PNG dosyalarını görebilir — bu sayede video
 * kaydını "izleyerek" animasyonları, geçişleri ve UI durumlarını
 * doğrulayabilir.
 *
 * Kullanım : node scripts/video-to-frames.js <video-path> [--fps 2] [--contact-sheet]
 * Örnek    : node scripts/video-to-frames.js docs/qa/desktop.mp4 --fps 2
 *
 * Çıktı    : docs/qa/frames/<video-adı>/
 *              ├── frame-001.png ... frame-NNN.png   ← bireysel kareler
 *              └── contact-sheet.png                  ← tüm kareler tek PNG'de (AI için)
 *
 * ffmpeg gereklidir. Yoksa: winget install Gyan.FFmpeg
 */

const { execSync, exec } = require('child_process');
const { chromium }       = require('playwright');
const { PNG }            = require('pngjs');
const fs   = require('fs');
const path = require('path');

const args      = process.argv.slice(2);
const videoPath = args.find(a => !a.startsWith('--'));
const fps       = parseFloat(args.find(a => a.startsWith('--fps'))?.split('=')[1] || args[args.indexOf('--fps') + 1] || '2');
const doContact = args.includes('--contact-sheet') || args.includes('--contact');
const doAI      = args.includes('--ai'); // AI'a doğrudan analiz yaptır

if (!videoPath || !fs.existsSync(videoPath)) {
  console.error('❌  Video dosyası bulunamadı:', videoPath);
  console.error('   Kullanım: node scripts/video-to-frames.js <video-path>');
  process.exit(1);
}

const videoName = path.basename(videoPath, path.extname(videoPath));
const OUT_DIR   = path.resolve('docs', 'qa', 'frames', videoName);

fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── ffmpeg kontrolü ──────────────────────────────────────────────────────────

function hasFFmpeg() {
  try { execSync('ffmpeg -version', { stdio: 'ignore' }); return true; } catch { return false; }
}

// ─── ffmpeg ile frame extraction ─────────────────────────────────────────────

function extractFrames(videoPath, outDir, fps) {
  console.log(`  ffmpeg ile frame çıkarılıyor (${fps} fps)...`);
  const outPattern = path.join(outDir, 'frame-%03d.png');
  execSync(
    `ffmpeg -y -i "${videoPath}" -vf fps=${fps} -q:v 2 "${outPattern}"`,
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  return fs.readdirSync(outDir)
    .filter(f => f.startsWith('frame-') && f.endsWith('.png'))
    .sort()
    .map(f => path.join(outDir, f));
}

// ─── Contact sheet oluştur ────────────────────────────────────────────────────

function makeContactSheet(framePaths, outPath, cols = 5) {
  if (framePaths.length === 0) return;

  console.log(`  Contact sheet oluşturuluyor (${framePaths.length} kare, ${cols} sütun)...`);

  const images = framePaths.map(p => PNG.sync.read(fs.readFileSync(p)));
  if (images.length === 0) return;

  const THUMB_W  = Math.min(images[0].width, 320);
  const THUMB_H  = Math.min(images[0].height, 180);
  const LABEL_H  = 16;
  const PAD      = 2;
  const rows     = Math.ceil(images.length / cols);
  const totalW   = cols * (THUMB_W + PAD) - PAD;
  const totalH   = rows * (THUMB_H + LABEL_H + PAD);

  const sheet = new PNG({ width: totalW, height: totalH, colorType: 2 });

  // Siyah arka plan
  for (let i = 0; i < sheet.data.length; i += 4) {
    sheet.data[i] = 20; sheet.data[i+1] = 20; sheet.data[i+2] = 20; sheet.data[i+3] = 255;
  }

  images.forEach((img, idx) => {
    const col  = idx % cols;
    const row  = Math.floor(idx / cols);
    const ox   = col * (THUMB_W + PAD);
    const oy   = row * (THUMB_H + LABEL_H + PAD) + LABEL_H;

    // Basit nearest-neighbor resize
    for (let y = 0; y < THUMB_H; y++) {
      for (let x = 0; x < THUMB_W; x++) {
        const sx  = Math.min(Math.floor(x * img.width / THUMB_W), img.width - 1);
        const sy  = Math.min(Math.floor(y * img.height / THUMB_H), img.height - 1);
        const si  = (sy * img.width + sx) * 4;
        const di  = ((oy + y) * sheet.width + ox + x) * 4;
        sheet.data[di]     = img.data[si];
        sheet.data[di + 1] = img.data[si + 1];
        sheet.data[di + 2] = img.data[si + 2];
        sheet.data[di + 3] = 255;
      }
    }
  });

  fs.writeFileSync(outPath, PNG.sync.write(sheet));
}

// ─── Playwright ile kare analizi (ffmpeg yok ise alternatif) ─────────────────

async function extractWithPlaywright(videoPath, outDir, targetFps) {
  console.log('  Playwright video analizi...');
  // Playwright'ın yerleşik video oynatma desteği olmadığı için
  // basit bir iframe embed + screenshot yaklaşımı kullanıyoruz
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  const absPath = path.resolve(videoPath);
  const fileUrl = `file:///${absPath.replace(/\\/g, '/')}`;

  await page.goto(fileUrl, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const frames = [];
  const duration = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? v.duration : 0;
  });

  if (!duration) {
    await browser.close();
    return [];
  }

  const interval = 1 / targetFps;
  let   current  = 0;
  let   idx      = 1;

  while (current < duration) {
    await page.evaluate(t => {
      const v = document.querySelector('video');
      if (v) { v.currentTime = t; v.pause(); }
    }, current);
    await page.waitForTimeout(200);

    const framePath = path.join(outDir, `frame-${String(idx).padStart(3, '0')}.png`);
    await page.screenshot({ path: framePath });
    frames.push(framePath);

    current += interval;
    idx++;
  }

  await browser.close();
  return frames;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🎬  Video → Kareler`);
  console.log(`   Video  : ${videoPath}`);
  console.log(`   FPS    : ${fps} kare/saniye`);
  console.log(`   Çıktı  : ${OUT_DIR}\n`);

  let framePaths = [];

  if (hasFFmpeg()) {
    framePaths = extractFrames(videoPath, OUT_DIR, fps);
  } else {
    console.warn('  ⚠  ffmpeg bulunamadı → Playwright ile denenecek');
    console.warn('     ffmpeg kurmak için: winget install Gyan.FFmpeg\n');
    framePaths = await extractWithPlaywright(videoPath, OUT_DIR, fps);
  }

  if (framePaths.length === 0) {
    console.error('❌  Kare çıkarılamadı');
    process.exit(1);
  }

  console.log(`  ✅  ${framePaths.length} kare çıkarıldı`);

  // Contact sheet (her zaman üret — AI için en yararlı çıktı)
  const contactPath = path.join(OUT_DIR, 'contact-sheet.png');
  makeContactSheet(framePaths, contactPath, 5);
  console.log(`  ✅  Contact sheet: ${contactPath}`);

  // Özet
  const totalSec = framePaths.length / fps;
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅  Frame extraction tamamlandı`);
  console.log(`   Toplam kare   : ${framePaths.length}`);
  console.log(`   Video süresi  : ~${totalSec.toFixed(0)} saniye`);
  console.log(`\n   AI analizi için Claude'a şunu söyle:`);
  console.log(`   "Read tool ile docs/qa/frames/${videoName}/contact-sheet.png`);
  console.log(`    dosyasını oku ve animasyonları, UI durumlarını incele"`);
  console.log(`\n   Bireysel kareler: docs/qa/frames/${videoName}/frame-NNN.png`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
