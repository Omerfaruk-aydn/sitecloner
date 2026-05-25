#!/usr/bin/env node
'use strict';
/**
 * make-comparison.js — Orijinal + klon videoyu yan yana birleştirir
 *
 * Kullanım: node scripts/make-comparison.js
 *
 * Gereksinim:
 *   - docs/recordings/ içinde orijinal site videosu (record-site.js çıktısı)
 *   - docs/qa/desktop.mp4 (record-clone.js çıktısı)
 *   - ffmpeg kurulu olması
 *
 * Çıktı: docs/qa/comparison.mp4
 */

const { execSync, exec, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RECORDINGS_DIR = path.resolve('docs/recordings');
const QA_DIR = path.resolve('docs/qa');
const OUT_PATH = path.join(QA_DIR, 'comparison.mp4');

// ─── ffmpeg yolu bul ─────────────────────────────────────────
function findFfmpeg() {
  // 1. PATH'te var mı?
  const r = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', shell: true });
  if (r.status === 0) return 'ffmpeg';
  // 2. imageio_ffmpeg üzerinden
  try {
    const py = spawnSync('python', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' });
    if (py.status === 0) return py.stdout.trim();
  } catch (_) {}
  return null;
}

const FFMPEG = findFfmpeg();
if (!FFMPEG) {
  console.error('❌ ffmpeg bulunamadı.');
  console.error('   Kurmak için: pip install imageio[ffmpeg]');
  process.exit(1);
}

// ─── Klon videosu ─────────────────────────────────────────────
const clonePath = path.join(QA_DIR, 'desktop.mp4');
const cloneWebm = path.join(QA_DIR, 'desktop.webm');
let cloneVideo = null;

if (fs.existsSync(clonePath)) cloneVideo = clonePath;
else if (fs.existsSync(cloneWebm)) cloneVideo = cloneWebm;

if (!cloneVideo) {
  console.error('❌ Klon videosu bulunamadı: docs/qa/desktop.mp4');
  console.error('   Önce: node scripts/record-clone.js http://localhost:3000');
  process.exit(1);
}

// ─── Orijinal videosu ─────────────────────────────────────────
function findLatestVideo(dir, excludeNames = []) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter(f => /\.(mp4|webm)$/.test(f) && !excludeNames.includes(f))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length > 0 ? path.join(dir, files[0].name) : null;
}

// Recordings klasöründeki en son videoyu al
// record-site.js dosyaları subdirectory'ye koyuyor, bul
let originalVideo = null;
if (fs.existsSync(RECORDINGS_DIR)) {
  // Alt klasörlerde ara (record-site.js videoları subdirectory'ye koyar)
  const subdirs = fs.readdirSync(RECORDINGS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(RECORDINGS_DIR, d.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const subdir of subdirs) {
    const found = findLatestVideo(subdir);
    if (found) { originalVideo = found; break; }
  }

  // Alt klasör yoksa direkt recordings içinde ara
  if (!originalVideo) originalVideo = findLatestVideo(RECORDINGS_DIR);
}

if (!originalVideo) {
  console.error('❌ Orijinal site videosu bulunamadı: docs/recordings/');
  console.error('   Önce: node scripts/record-site.js https://www.aman.com --full');
  process.exit(1);
}

console.log(`\n🎬 Karşılaştırma videosu oluşturuluyor...`);
console.log(`   Orijinal : ${originalVideo}`);
console.log(`   Klon     : ${cloneVideo}`);
console.log(`   Çıktı    : ${OUT_PATH}\n`);

const targetH = 900;
const halfW   = 960;

// Yan yana birleştir — drawtext yok (fontconfig gerektiriyor)
const filterComplex = [
  `[0:v]scale=${halfW}:${targetH}:force_original_aspect_ratio=decrease,pad=${halfW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[left]`,
  `[1:v]scale=${halfW}:${targetH}:force_original_aspect_ratio=decrease,pad=${halfW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[right]`,
  `[left][right]hstack=inputs=2[out]`,
].join(';');

// spawnSync ile çalıştır — shell yok, & içeren path sorunsuz
const result = spawnSync(FFMPEG, [
  '-y',
  '-i', originalVideo,
  '-i', cloneVideo,
  '-filter_complex', filterComplex,
  '-map', '[out]',
  '-c:v', 'libx264',
  '-crf', '20',
  '-preset', 'fast',
  '-movflags', '+faststart',
  '-t', '30',
  OUT_PATH,
], { shell: false, encoding: 'utf8' });

if (result.status === 0) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ KARŞILAŞTIRMA VİDEOSU HAZIR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   ${OUT_PATH}`);
  console.log('\n   GitHub\'a yüklemek için:');
  console.log('   1. Repo\'da herhangi bir Issue aç');
  console.log('   2. comparison.mp4 dosyasını sürükle bırak');
  console.log('   3. Üretilen CDN linkini README.md\'ye yapıştır');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  try { exec(`start "" "${OUT_PATH}"`); } catch (_) {}
} else {
  console.error('\n❌ ffmpeg hatası:', result.stderr?.slice(-300));
  console.error(`   Orijinal: ${originalVideo}`);
  console.error(`   Klon    : ${cloneVideo}`);
  process.exit(1);
}
