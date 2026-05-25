#!/usr/bin/env node
'use strict';
/**
 * setup-check.js — Tüm bağımlılıkları kontrol eder
 * Kullanım: node scripts/setup-check.js
 *
 * Kontrol edilenler:
 * - Node.js sürümü
 * - npm paketleri (puppeteer, playwright, sharp, pngjs, pixelmatch)
 * - Sistem araçları (yt-dlp, ffmpeg)
 * - Gerekli klasörler
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let allOk = true;

function check(label, fn) {
  try {
    const result = fn();
    console.log(`  ✅ ${label}${result ? ': ' + result : ''}`);
    return true;
  } catch (err) {
    console.log(`  ❌ ${label}: ${err.message}`);
    allOk = false;
    return false;
  }
}

function checkCommand(cmd, versionFlag = '--version') {
  const result = spawnSync(cmd, [versionFlag], { encoding: 'utf8' });
  if (result.status !== 0 || result.error) throw new Error(`'${cmd}' bulunamadı`);
  return (result.stdout || result.stderr || '').split('\n')[0].trim().slice(0, 60);
}

function checkNpmPackage(pkg) {
  const pkgPath = path.resolve('node_modules', pkg, 'package.json');
  if (!fs.existsSync(pkgPath)) throw new Error(`npm paketi yok: ${pkg}`);
  const version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  return `v${version}`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

console.log('\n🔍 Setup Check — Bağımlılık Kontrolü');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ── Node.js ──
console.log('Node.js:');
check('node', () => {
  const v = process.version;
  const major = parseInt(v.slice(1).split('.')[0]);
  if (major < 18) throw new Error(`Node ${v} — minimum 18 gerekli`);
  return v;
});

// ── npm paketleri ──
console.log('\nnpm paketleri:');
const npmPackages = [
  'puppeteer',
  'framer-motion',
  'next',
];
const optionalNpmPackages = [
  'sharp',
  'pngjs',
  'pixelmatch',
  'embla-carousel',
  'lenis',
];

for (const pkg of npmPackages) {
  check(pkg, () => checkNpmPackage(pkg));
}
for (const pkg of optionalNpmPackages) {
  try {
    const version = checkNpmPackage(pkg);
    console.log(`  ✅ ${pkg} (opsiyonel): ${version}`);
  } catch (_) {
    console.log(`  ⚠  ${pkg} (opsiyonel): yok — bazı özellikler devre dışı`);
  }
}

// Playwright — may be in @playwright/test or playwright
try {
  const v = checkNpmPackage('@playwright/test');
  console.log(`  ✅ @playwright/test: ${v}`);
} catch (_) {
  try {
    const v = checkNpmPackage('playwright');
    console.log(`  ✅ playwright: ${v}`);
  } catch (_2) {
    console.log('  ⚠  playwright (opsiyonel): yok — record-site.js, record-clone.js devre dışı');
  }
}

// ── Sistem araçları ──
console.log('\nSistem araçları:');
check('yt-dlp', () => checkCommand('yt-dlp'));
check('ffmpeg', () => checkCommand('ffmpeg', '-version'));
check('git', () => checkCommand('git'));

// ── Proje yapısı ──
console.log('\nProje yapısı:');
const requiredDirs = [
  'src/app',
  'src/components',
  'src/hooks',
  'public',
  'docs/research',
  'docs/design-references',
  'docs/qa',
  'scripts',
];
for (const dir of requiredDirs) {
  const full = path.resolve(dir);
  try {
    ensureDir(full);
    console.log(`  ✅ ${dir}`);
  } catch (err) {
    console.log(`  ❌ ${dir}: ${err.message}`);
    allOk = false;
  }
}

// ── next.config check ──
console.log('\nKonfigurasyon:');
check('next.config.ts', () => {
  const p = path.resolve('next.config.ts');
  if (!fs.existsSync(p)) throw new Error('Dosya yok');
  return 'bulundu';
});
check('tailwind.config (globals.css)', () => {
  const p1 = path.resolve('tailwind.config.ts');
  const p2 = path.resolve('tailwind.config.js');
  const p3 = path.resolve('src/app/globals.css');
  if (!fs.existsSync(p1) && !fs.existsSync(p2) && !fs.existsSync(p3)) throw new Error('Tailwind config yok');
  return 'bulundu';
});
check('useScrollReveal hook', () => {
  const p = path.resolve('src/hooks/useScrollReveal.ts');
  if (!fs.existsSync(p)) throw new Error('Dosya yok — Lenis+Framer uyumluluğu için gerekli');
  return 'bulundu';
});

// ── Özet ──
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (allOk) {
  console.log('✅ Tüm zorunlu bağımlılıklar hazır');
} else {
  console.log('❌ Bazı bağımlılıklar eksik — yukarıdaki hataları gider');
  console.log('\nKurulum komutları:');
  console.log('  pip install yt-dlp          # Vimeo/YouTube video indirme');
  console.log('  winget install ffmpeg        # Video birleştirme (Windows)');
  console.log('  npm install sharp pngjs pixelmatch  # Görsel kalite araçları');
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
process.exit(allOk ? 0 : 1);
