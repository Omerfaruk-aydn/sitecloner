#!/usr/bin/env node
'use strict';
/**
 * init.js — Site Clone AI sistemini yeni bir projeye kur
 *
 * Kullanım:
 *   node "C:\site clone ai\init.js" <proje-adı>
 *   node "C:\site clone ai\init.js" "C:\projeler\yeni-site"
 *
 * Ne yapar:
 *   1. Hedef klasörü oluşturur
 *   2. Next.js 15 + TypeScript projesi başlatır
 *   3. Tüm scriptleri, hook'ları, config dosyalarını kopyalar
 *   4. Bağımlılıkları yükler
 *   5. Hazır! /clone-website <url> ile kullanmaya başla
 */

const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');

// Bu dosyanın bulunduğu klasör = kaynak (şablon)
const SRC = __dirname;

// Hedef klasör — argüman yoksa hata
const targetArg = process.argv[2];
if (!targetArg) {
  console.error('\n❌  Proje adı gerekli.');
  console.error('   Kullanım: node "' + SRC + '\\init.js" <proje-adı>');
  console.error('   Örnek   : node "' + SRC + '\\init.js" "my-clone-project"\n');
  process.exit(1);
}

// Hedef yolunu çöz — mutlak yol veya göreceli
const TARGET = path.isAbsolute(targetArg)
  ? targetArg
  : path.resolve(process.cwd(), targetArg);

const projectName = path.basename(TARGET);

// ─── Yardımcı ────────────────────────────────────────────────────────────────

function run(cmd, cwd = TARGET) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

function copyFile(relSrc, relDst = relSrc) {
  const src = path.join(SRC, relSrc);
  const dst = path.join(TARGET, relDst);
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(relSrc, relDst = relSrc) {
  const src = path.join(SRC, relSrc);
  const dst = path.join(TARGET, relDst);
  if (!fs.existsSync(src)) return;
  copyDirRecursive(src, dst);
}

function copyDirRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  fs.readdirSync(src).forEach(entry => {
    const s = path.join(src, entry);
    const d = path.join(dst, entry);
    if (fs.statSync(s).isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  });
}

function writeFile(relPath, content) {
  const dst = path.join(TARGET, relPath);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, content, 'utf8');
}

// ─── Kontroller ──────────────────────────────────────────────────────────────

console.log(`\n🚀  Site Clone AI — Yeni proje kurulumu`);
console.log(`   Kaynak  : ${SRC}`);
console.log(`   Hedef   : ${TARGET}`);
console.log(`   Proje   : ${projectName}\n`);

if (fs.existsSync(TARGET) && fs.readdirSync(TARGET).length > 0) {
  console.error(`❌  Hedef klasör zaten dolu: ${TARGET}`);
  console.error(`   Boş bir klasör belirt veya yeni bir isim kullan.\n`);
  process.exit(1);
}

// ─── ADIM 1: Klasör oluştur ───────────────────────────────────────────────────

fs.mkdirSync(TARGET, { recursive: true });
console.log('📁  Klasör oluşturuldu');

// ─── ADIM 2: package.json ────────────────────────────────────────────────────

console.log('📦  package.json yazılıyor...');

const pkg = {
  name   : projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
  version: '1.0.0',
  private: true,
  scripts: {
    dev              : 'next dev',
    build            : 'next build',
    start            : 'next start',
    lint             : 'next lint',
    recon            : 'node scripts/recon.js',
    annotate         : 'node scripts/annotate-screenshots.js',
    animations       : 'node scripts/extract-animations.js',
    'interaction-map': 'node scripts/interaction-map.js',
    record           : 'node scripts/record-site.js',
    'record:full'    : 'node scripts/record-site.js --full --hover --slow',
    'record:clone'   : 'node scripts/record-clone.js http://localhost:3000',
    'video-frames'   : 'node scripts/video-to-frames.js',
    'download-assets': 'node scripts/download-assets.js',
    qa               : 'node scripts/qa-check.js http://localhost:3000',
    'section-diff'   : 'node scripts/section-diff.js',
    diff             : 'node scripts/visual-diff.js',
    'clone:reset'    : 'rimraf src/components/sections docs/specs docs/research docs/recordings docs/interactions docs/qa public/images public/fonts public/videos && mkdir -p src/components/sections docs/specs docs/research docs/recordings docs/interactions docs/qa public/images public/fonts public/videos',
  },
  dependencies: {
    '@lottiefiles/react-lottie-player': '^3.5.0',
    '@radix-ui/react-slot'            : '^1.0.0',
    'class-variance-authority'        : '^0.7.0',
    clsx                              : '^2.0.0',
    'embla-carousel-autoplay'         : '^8.0.0',
    'embla-carousel-react'            : '^8.0.0',
    'framer-motion'                   : '^11.0.0',
    lenis                             : '^1.3.23',
    'lucide-react'                    : '^0.400.0',
    next                              : '^15.0.0',
    react                             : '^19.0.0',
    'react-dom'                       : '^19.0.0',
    'react-intersection-observer'     : '^9.0.0',
    'tailwind-merge'                  : '^2.0.0',
  },
  devDependencies: {
    '@tailwindcss/postcss'  : '^4.0.0',
    '@types/node'           : '^20.0.0',
    '@types/react'          : '^19.0.0',
    '@types/react-dom'      : '^19.0.0',
    autoprefixer            : '^10.4.0',
    eslint                  : '^9.0.0',
    'eslint-config-next'    : '^15.0.0',
    pixelmatch               : '^6.0.0',
    playwright              : '^1.45.0',
    pngjs                   : '^7.0.0',
    puppeteer               : '^22.0.0',
    rimraf                  : '^6.0.0',
    tailwindcss             : '^4.0.0',
    typescript              : '^5.5.0',
  },
};

writeFile('package.json', JSON.stringify(pkg, null, 2));

// ─── ADIM 3: Config dosyaları ────────────────────────────────────────────────

console.log('⚙️   Config dosyaları kopyalanıyor...');

copyFile('next.config.ts');
copyFile('tsconfig.json');
copyFile('tailwind.config.ts');
copyFile('postcss.config.mjs');
copyFile('eslint.config.mjs');
copyFile('components.json');

// next.config.ts'deki hardcoded hostname'i temizle
const nextConfigPath = path.join(TARGET, 'next.config.ts');
if (fs.existsSync(nextConfigPath)) {
  let content = fs.readFileSync(nextConfigPath, 'utf8');
  // remotePatterns'ı boşalt — download-assets.js otomatik günceller
  content = content.replace(
    /remotePatterns:\s*\[[\s\S]*?\]/,
    'remotePatterns: [\n      // download-assets.js tarafından otomatik doldurulur\n    ]'
  );
  fs.writeFileSync(nextConfigPath, content, 'utf8');
}

// ─── ADIM 4: Scriptleri kopyala ──────────────────────────────────────────────

console.log('📜  Scriptler kopyalanıyor...');
copyDir('scripts');

// ─── ADIM 5: Temel src yapısı ────────────────────────────────────────────────

console.log('🏗️   Kaynak dosyalar kopyalanıyor...');

// Hooks
copyFile('src/hooks/useScrollReveal.ts');

// Lenis provider
const lenisProviderSrc = path.join(SRC, 'src', 'components', 'LenisProvider.tsx');
if (fs.existsSync(lenisProviderSrc)) {
  copyFile('src/components/LenisProvider.tsx');
}

// globals.css (boş şablon)
writeFile('src/app/globals.css', `@import "tailwindcss";

:root {
  /* design-tokens — recon çıktısından doldurulur */
  --color-primary: #000;
  --color-secondary: #fff;
  --color-accent: #000;
  --color-bg: #fff;
  --color-text: #000;
  --font-heading: sans-serif;
  --font-body: sans-serif;
  --ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}

html { scroll-behavior: auto; } /* Lenis smooth scroll yönetir */
`);

// Boş page.tsx
writeFile('src/app/layout.tsx', `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clone',
  description: 'AI generated clone',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
`);

writeFile('src/app/page.tsx', `export default function HomePage() {
  return <main />;
}
`);

// ─── ADIM 6: Tüm AI araçları için config dosyaları ──────────────────────────

console.log('🤖  AI araç config dosyaları kopyalanıyor...');

// Temel agent dosyaları
copyFile('AGENTS.md');
copyFile('GEMINI.md');
writeFile('CLAUDE.md', '@AGENTS.md\n');

// Tool-specific configs
const TMPL = path.join(SRC, 'templates');
const templateFiles = [
  ['.github/copilot-instructions.md', '.github/copilot-instructions.md'],
  ['.cursor/rules/clone-ai.mdc',      '.cursor/rules/clone-ai.mdc'],
  ['.windsurfrules',                   '.windsurfrules'],
  ['.clinerules',                      '.clinerules'],
  ['.roorules',                        '.roorules'],
  ['.continuerules',                   '.continuerules'],
  ['.amazonq/rules/clone-ai.md',      '.amazonq/rules/clone-ai.md'],
  ['augment-guidelines.md',            'augment-guidelines.md'],
  ['.aider.conf.yml',                  '.aider.conf.yml'],
  ['CONVENTIONS.md',                   'CONVENTIONS.md'],
  ['.opencode/rules.md',               '.opencode/rules.md'],
];

templateFiles.forEach(([src, dst]) => {
  const srcPath = path.join(TMPL, src);
  const dstPath = path.join(TARGET, dst);
  if (fs.existsSync(srcPath)) {
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.copyFileSync(srcPath, dstPath);
  }
});

// ─── ADIM 7: Klasör yapısı ───────────────────────────────────────────────────

const dirs = [
  'docs/research',
  'docs/research/annotated',
  'docs/research/animations',
  'docs/research/interactions/states',
  'docs/design-references',
  'docs/recordings',
  'docs/interactions',
  'docs/specs',
  'docs/qa/diff',
  'docs/qa/frames',
  'public/images',
  'public/fonts',
  'public/videos',
  'src/components/sections',
  'src/lib',
  'src/types',
];

dirs.forEach(d => fs.mkdirSync(path.join(TARGET, d), { recursive: true }));
console.log('📁  Klasör yapısı oluşturuldu');

// ─── ADIM 8: .gitignore ──────────────────────────────────────────────────────

writeFile('.gitignore', `.next/
node_modules/
.env*
docs/recordings/
docs/qa/
*.webm
*.mp4
`);

// ─── ADIM 9: Playwright browser yükle ───────────────────────────────────────

console.log('\n🎭  npm install başlıyor...');
run('npm install');

console.log('\n🎭  Playwright browser yükleniyor...');
try {
  run('npx playwright install chromium');
} catch {
  console.warn('  ⚠  Playwright browser yüklenemedi, manuel kur: npx playwright install chromium');
}

// ─── Bitti ───────────────────────────────────────────────────────────────────

console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  KURULUM TAMAMLANDI

   Proje : ${TARGET}

   Kullanmak için:
   1. VS Code veya Claude Code ile klasörü aç
   2. /clone-website <url> yaz
   3. 4 soruyu cevapla → AI otomatik klonlar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
