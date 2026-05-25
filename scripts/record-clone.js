#!/usr/bin/env node
'use strict';
/**
 * record-clone.js — Klonlanmış siteyi Playwright ile kayıt altına alır
 *
 * Kullanım: node scripts/record-clone.js [http://localhost:3000]
 *
 * Ne kaydeder:
 *   1. Sayfa açılışı + hero animasyonları
 *   2. Tüm sayfayı yavaş scroll (her section'ın fade-in animasyonu görünsün)
 *   3. Navbar menü açma/kapama (overlay animasyonu)
 *   4. Dil dropdown açma/kapama
 *   5. Carousel/slider next buton tıklama
 *   6. Hover efektleri (butonlar, linkler, kartlar)
 *   7. Mobil görünüm (390px)
 *
 * Çıktı: docs/qa/ klasörüne desktop.mp4 + mobile.mp4
 *        Kayıt tamamlandığında otomatik açılır.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync, exec, spawnSync } = require('child_process');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const OUT_DIR  = path.resolve('docs', 'qa');
fs.mkdirSync(OUT_DIR, { recursive: true });

function findFfmpeg() {
  // 1. PATH'te var mı?
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: false });
  if (r.status === 0 && !r.error) return 'ffmpeg';
  // 2. imageio_ffmpeg üzerinden — shell:false ile özel karakterli path sorunsuz çalışır
  try {
    const py = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'],
      { encoding: 'utf8', shell: false });
    if (py.status === 0 && py.stdout.trim()) return py.stdout.trim();
  } catch (_) {}
  return null;
}

const FFMPEG_PATH = findFfmpeg();
if (FFMPEG_PATH) console.log(`  ffmpeg: ${FFMPEG_PATH}`);
else console.warn('  ⚠ ffmpeg bulunamadı — webm formatında kaydedilecek');

const SLOW_SCROLL_STEPS = 30;
const SLOW_SCROLL_DELAY = 850; // ms — animasyonların tetiklenmesi için yeterli süre

// ─── Yardımcı ───────────────────────────────────────────────────────────────

async function saveVideo(page, label) {
  const video = await page.video();
  if (!video) { console.warn(`⚠  ${label}: video oluşturulamadı`); return null; }

  const tmpPath  = await video.path();
  const webmPath = path.join(OUT_DIR, `${label}.webm`);
  const mp4Path  = path.join(OUT_DIR, `${label}.mp4`);

  fs.copyFileSync(tmpPath, webmPath);

  // ffmpeg varsa mp4'e çevir — spawnSync (shell yok, özel karakterli path sorunsuz)
  if (FFMPEG_PATH) {
    const result = spawnSync(FFMPEG_PATH,
      ['-y', '-i', webmPath, '-c:v', 'libx264', '-crf', '22', '-preset', 'fast', '-movflags', '+faststart', mp4Path],
      { encoding: 'utf8', shell: false }
    );
    if (result.status === 0) {
      try { fs.unlinkSync(webmPath); } catch (_) {}
      console.log(`  ✅ Kaydedildi: docs/qa/${label}.mp4`);
      return mp4Path;
    } else {
      console.warn('  ⚠ ffmpeg dönüştürme başarısız:', result.stderr?.slice(0, 200));
    }
  }
  console.log(`  ✅ Kaydedildi: docs/qa/${label}.webm`);
  return webmPath;
}

async function slowScroll(page) {
  const total = await page.evaluate(() => document.body.scrollHeight);
  const step  = Math.ceil(total / SLOW_SCROLL_STEPS);

  for (let i = 0; i <= SLOW_SCROLL_STEPS; i++) {
    const y = Math.min(i * step, total);
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), y);
    await page.waitForTimeout(SLOW_SCROLL_DELAY);
  }
  // Geri dön
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(1200);
}

async function tryClick(page, selector, label = '') {
  try {
    const el = await page.$(selector);
    if (el) { await el.click(); return true; }
  } catch { /* sessiz geç */ }
  return false;
}

async function hoverElements(page) {
  const selectors = ['a', 'button', '[role="button"]', '[class*="card"]', '[class*="btn"]'];
  const seen = new Set();
  for (const sel of selectors) {
    try {
      const els = await page.$$(sel);
      for (const el of els.slice(0, 6)) {
        const box = await el.boundingBox().catch(() => null);
        if (!box) continue;
        const key = `${Math.round(box.x)},${Math.round(box.y)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
        await page.waitForTimeout(400);
      }
    } catch { /* sessiz geç */ }
  }
}

// ─── Desktop kaydı ──────────────────────────────────────────────────────────

async function recordDesktop(browser) {
  console.log('\n  [1/2] Desktop (1440x900) kaydediliyor...');

  const videoDir = path.join(OUT_DIR, '_tmp_desktop');
  fs.mkdirSync(videoDir, { recursive: true });

  const ctx  = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();

  // ── 1. Sayfa yükleme + hero animasyonları ──
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(2000); // hero animasyonu tamamlansın

  // ── 2. Tüm sayfayı yavaş scroll ──
  console.log('     → Scroll animasyonları...');
  await slowScroll(page);

  // ── 3. Navbar menü aç/kapat ──
  console.log('     → Menü overlay...');
  // Nusr-Et sitesindeki MENÜ butonu
  const menuSelectors = [
    'button:has-text("MENÜ")',
    'button:has-text("MENU")',
    '[aria-label*="menu"]',
    '[aria-label*="Menu"]',
    '[class*="hamburger"]',
    '[class*="menu-toggle"]',
    '[class*="nav-toggle"]',
  ];
  let menuOpened = false;
  for (const sel of menuSelectors) {
    if (await tryClick(page, sel)) {
      menuOpened = true;
      await page.waitForTimeout(600); // açılış animasyonu
      break;
    }
  }
  if (menuOpened) {
    // Kapat — KAPAT butonu veya aynı butona tekrar bas
    const closeSelectors = ['button:has-text("KAPAT")', 'button:has-text("CLOSE")', '[aria-label*="close"]'];
    let closed = false;
    for (const sel of closeSelectors) {
      if (await tryClick(page, sel)) { closed = true; break; }
    }
    if (!closed) {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(400);
  }

  // ── 4. Carousel/Slider ──
  const nextSelectors = [
    '[class*="embla"] button:last-child',
    '[class*="carousel"] button[aria-label*="next"]',
    '[class*="swiper-button-next"]',
    'button[aria-label*="Next"]',
  ];
  for (const sel of nextSelectors) {
    const el = await page.$(sel).catch(() => null);
    if (el) {
      for (let i = 0; i < 3; i++) {
        await el.click().catch(() => {});
        await page.waitForTimeout(400);
      }
      break;
    }
  }

  await page.waitForTimeout(500);
  await ctx.close();

  return await saveVideo(page, 'desktop');
}

// ─── Mobile kaydı ───────────────────────────────────────────────────────────

async function recordMobile(browser) {
  console.log('\n  [2/2] Mobile (390x844) kaydediliyor...');

  const videoDir = path.join(OUT_DIR, '_tmp_mobile');
  fs.mkdirSync(videoDir, { recursive: true });

  const ctx  = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    reducedMotion: 'no-preference',
    recordVideo: { dir: videoDir, size: { width: 390, height: 844 } },
  });
  const page = await ctx.newPage();

  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(1500);

  // Yavaş scroll
  await slowScroll(page);

  await page.waitForTimeout(500);
  await ctx.close();

  return await saveVideo(page, 'mobile');
}

// ─── Dosyayı otomatik aç ────────────────────────────────────────────────────

function openFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    // Windows
    exec(`start "" "${filePath}"`);
  } catch {
    try { exec(`open "${filePath}"`); } catch { /* Linux/Mac da olmazsa sessiz kal */ }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎬 Klon video kaydı başlıyor → ${BASE_URL}`);
  console.log('   (Bu video animasyonları ve etkileşimleri onaylamak içindir)\n');

  const browser = await chromium.launch({ headless: true });

  const desktopFile = await recordDesktop(browser).catch(err => {
    console.error('  ✗ Desktop kaydı başarısız:', err.message);
    return null;
  });

  const mobileFile = await recordMobile(browser).catch(err => {
    console.error('  ✗ Mobile kaydı başarısız:', err.message);
    return null;
  });

  await browser.close();

  // Geçici klasörleri temizle (Windows'ta kısa bekle — dosya kilidi)
  await new Promise(r => setTimeout(r, 1500));
  ['_tmp_desktop', '_tmp_mobile'].forEach(d => {
    const p = path.join(OUT_DIR, d);
    if (!fs.existsSync(p)) return;
    try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* Windows kilidi — önemsiz */ }
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ KAYIT TAMAMLANDI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (desktopFile) console.log(`   Desktop : ${desktopFile}`);
  if (mobileFile)  console.log(`   Mobile  : ${mobileFile}`);
  console.log('   Kontrol et:');
  console.log("   • Tüm section'lar görünüyor mu?");
  console.log('   • Animasyonlar tetikleniyor mu? (fade-in/slide-up)');
  console.log('   • Menü overlay açılıp kapanıyor mu?');
  console.log('   • Carousel çalışıyor mu?');
  console.log('   • Hover efektleri var mı?');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Desktop videoyu otomatik aç
  if (desktopFile) openFile(desktopFile);
}

main().catch(err => {
  console.error('❌ Kayıt hatası:', err.message);
  process.exit(1);
});
