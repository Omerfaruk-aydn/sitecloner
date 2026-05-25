#!/usr/bin/env node
'use strict';
/**
 * install-system-deps.js — Sistem bağımlılıklarını otomatik kurar
 * Kullanım: node scripts/install-system-deps.js
 *
 * Kurulanlar:
 * - yt-dlp (pip ile)
 * - ffmpeg (pip imageio[ffmpeg] ile)
 * - Playwright browser (npx playwright install chromium)
 */

const { spawnSync } = require('child_process');

function run(label, cmd, args) {
  process.stdout.write(`⏳ ${label}... `);
  const result = spawnSync(cmd, args, { encoding: 'utf8', shell: true, timeout: 120000 });
  if (result.status === 0) {
    console.log('✅');
    return true;
  } else {
    console.log('❌');
    if (result.stderr) console.error('   ', result.stderr.slice(0, 200));
    return false;
  }
}

function isInstalled(cmd) {
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8', shell: true });
  return r.status === 0 && !r.error;
}

console.log('\n🚀 Sistem bağımlılıkları kuruluyor...\n');

// yt-dlp
if (isInstalled('yt-dlp')) {
  console.log('✅ yt-dlp zaten kurulu');
} else {
  run('yt-dlp kuruluyor (pip)', 'pip', ['install', 'yt-dlp']);
}

// ffmpeg
if (isInstalled('ffmpeg')) {
  console.log('✅ ffmpeg zaten kurulu');
} else {
  run('ffmpeg kuruluyor (pip imageio)', 'pip', ['install', 'imageio[ffmpeg]']);
}

// Playwright chromium browser
run('Playwright Chromium browser kuruluyor', 'npx', ['playwright', 'install', 'chromium']);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Kurulum tamamlandı!');
console.log('');
console.log('Şimdi çalıştırabilirsin:');
console.log('  node scripts/setup-check.js   ← her şey tamam mı?');
console.log('  npm run recon <url>            ← site analizi');
console.log('  npm run qa                     ← kalite kontrolü');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
