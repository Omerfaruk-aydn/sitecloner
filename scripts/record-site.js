#!/usr/bin/env node
'use strict';
/**
 * record-site.js — Playwright ile site video kaydı
 * Kullanım: node scripts/record-site.js <url> [--full] [--hover] [--slow] [--mobile]
 * Çıktı: docs/recordings/ altında .webm veya .mp4 dosyaları
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const targetUrl = args.find(a => !a.startsWith('--'));
const flagFull = args.includes('--full');
const flagHover = args.includes('--hover');
const flagSlow = args.includes('--slow');
const flagMobile = args.includes('--mobile');

if (!targetUrl) {
  console.error('❌ URL gerekli: node scripts/record-site.js <url>');
  process.exit(1);
}

const RECORDINGS_DIR = path.resolve('docs/recordings');
fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

const VIEWPORTS = flagMobile
  ? [{ name: 'mobile', width: 390, height: 844, isMobile: true }]
  : [
      { name: 'desktop', width: 1440, height: 900, isMobile: false },
      ...(flagFull ? [
        { name: 'tablet', width: 768, height: 1024, isMobile: true },
        { name: 'mobile', width: 390, height: 844, isMobile: true },
      ] : []),
    ];

const SCROLL_STEPS = flagSlow ? 40 : 35;
const SCROLL_DELAY = flagSlow ? 500 : 850;

async function recordViewport(browser, vp) {
  const timestamp = Date.now();
  const videoDir = path.join(RECORDINGS_DIR, `${vp.name}-${timestamp}`);
  fs.mkdirSync(videoDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    reducedMotion: 'no-preference',
    recordVideo: { dir: videoDir, size: { width: vp.width, height: vp.height } },
  });

  const page = await context.newPage();
  const dismissCookies = require('./_dismiss-cookies');

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 });
    await dismissCookies(page);
    await page.waitForTimeout(1500);

    // Smooth scroll
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const stepSize = Math.floor(scrollHeight / SCROLL_STEPS);
    for (let i = 0; i <= SCROLL_STEPS; i++) {
      await page.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), i * stepSize);
      await page.waitForTimeout(SCROLL_DELAY);
    }

    // Geri yukari scroll
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    // Hamburger/mobil menu tespiti
    if (vp.isMobile) {
      try {
        const menuBtn = await page.$('[class*="hamburger"], [class*="menu-toggle"], [class*="nav-toggle"], button[aria-label*="menu"], button[aria-label*="Menu"]');
        if (menuBtn) {
          await menuBtn.click();
          await page.waitForTimeout(800);
          await menuBtn.click();
          await page.waitForTimeout(500);
        }
      } catch (_) {}
    }

    // Slider next button
    try {
      const sliderNext = await page.$('[class*="swiper-next"], [class*="slick-next"], [class*="carousel-next"], [class*="next-btn"], button[aria-label*="next"], button[aria-label*="Next"]');
      if (sliderNext) {
        for (let i = 0; i < 3; i++) {
          await sliderNext.click();
          await page.waitForTimeout(600);
        }
      }
    } catch (_) {}

    // Tab/accordion
    try {
      const tabs = await page.$$('[role="tab"], [class*="tab-btn"], [class*="accordion-header"]');
      for (let i = 0; i < Math.min(tabs.length, 3); i++) {
        const tab = tabs[i];
        if (tab) {
          await tab.click();
          await page.waitForTimeout(400);
        }
      }
    } catch (_) {}

    // Hover sweep
    if (flagHover) {
      try {
        const interactives = await page.$$('a, button, [role="button"], [class*="card"]');
        for (let i = 0; i < Math.min(interactives.length, 15); i++) {
          try {
            const el = interactives[i];
            if (!el) continue;
            const box = await el.boundingBox();
            if (box) {
              await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
              await page.waitForTimeout(300);
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    await page.waitForTimeout(2000);

  } catch (err) {
    console.warn(`⚠️  ${vp.name} kayıt sırasında hata:`, err.message);
  }

  const video = await page.video();
  await context.close();

  if (!video) {
    console.warn(`⚠️  ${vp.name} için video oluşturulamadı`);
    return;
  }

  const savedPath = await video.path();
  const finalName = `${vp.name}-${timestamp}.webm`;
  const finalPath = path.join(RECORDINGS_DIR, finalName);
  fs.renameSync(savedPath, finalPath);
  fs.rmSync(videoDir, { recursive: true, force: true });

  // ffmpeg varsa mp4'e çevir — Python subprocess ile (özel karakterli path sorunsuz)
  let mp4Path = null;
  try {
    const mp4Name = `${vp.name}-${timestamp}.mp4`;
    mp4Path = path.join(RECORDINGS_DIR, mp4Name);
    const { spawnSync } = require('child_process');
    const pyResult = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' });
    const ffmpegExe = pyResult.status === 0 ? pyResult.stdout.trim() : 'ffmpeg';
    const r = spawnSync(ffmpegExe, ['-i', finalPath, '-c:v', 'libx264', '-crf', '23', '-preset', 'fast', mp4Path, '-y'], { shell: false });
    if (r.status === 0) {
      fs.unlinkSync(finalPath);
      console.log(`🎬 Video kaydedildi: docs/recordings/${mp4Name}`);
    } else { throw new Error('ffmpeg failed'); }
  } catch (_) {
    console.log(`🎬 Video kaydedildi: docs/recordings/${finalName} (ffmpeg yok, .webm formatında)`);
  }
}

async function main() {
  console.log(`\n🎬 Video kayıt başlıyor: ${targetUrl}\n`);
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`  ⏺  ${vp.name} (${vp.width}x${vp.height}) kaydediliyor...`);
    await recordViewport(browser, vp);
  }

  await browser.close();
  console.log('\n✅ Tüm viewport kayıtları tamamlandı\n');
}

main().catch(err => { console.error('❌ Kayıt hatası:', err.message); process.exit(1); });
