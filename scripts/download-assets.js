#!/usr/bin/env node
'use strict';
/**
 * download-assets.js — Font, görsel, video indirici (Vimeo/HLS desteği dahil)
 * Kullanım: node scripts/download-assets.js
 * Okur: docs/research/recon-report.json
 * Çıktı: public/fonts/, public/images/, public/videos/
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { execSync, spawnSync } = require('child_process');

const REPORT_PATH = path.resolve('docs/research/recon-report.json');
if (!fs.existsSync(REPORT_PATH)) {
  console.error('❌ recon-report.json bulunamadı. Önce: node scripts/recon.js <url>');
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
const { assets } = report;

const DIRS = {
  fonts: path.resolve('public/fonts'),
  images: path.resolve('public/images'),
  videos: path.resolve('public/videos'),
};
Object.values(DIRS).forEach(d => fs.mkdirSync(d, { recursive: true }));

// ─── Dependency check ──────────────────────────────────────────
let hasYtDlp = false;
let hasFfmpeg = false;
try { execSync('yt-dlp --version', { stdio: 'pipe' }); hasYtDlp = true; } catch (_) {}
try { execSync('ffmpeg -version', { stdio: 'pipe' }); hasFfmpeg = true; } catch (_) {}

if (!hasYtDlp) {
  console.warn('⚠  yt-dlp bulunamadı. Vimeo/YouTube videoları indirilemez.');
  console.warn('   Kurmak için: pip install yt-dlp');
}
if (!hasFfmpeg) {
  console.warn('⚠  ffmpeg bulunamadı. Video+ses birleştirme yapılamaz (sadece video indirilir).');
}

// ─── URL helpers ───────────────────────────────────────────────
function slugifyFilename(urlStr) {
  try {
    const u = new URL(urlStr);
    const basename = path.basename(u.pathname) || 'asset';
    return basename.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
  } catch (_) {
    return `asset-${Date.now()}`;
  }
}

function isStreamingUrl(urlStr) {
  return /\.m3u8(\?|$)|\.ts(\?|$)|vimeo\.com|player\.vimeo\.com|youtube\.com|youtu\.be|wistia\.com|jwplayer\.com/.test(urlStr);
}

function extractVimeoId(urlOrEmbed) {
  const m = urlOrEmbed.match(/(?:vimeo\.com\/|video\/)(\d{7,12})/);
  return m ? m[1] : null;
}

// ─── yt-dlp video downloader ───────────────────────────────────
function downloadWithYtDlp(videoUrl, destDir, referer) {
  const outputTemplate = path.join(destDir, '%(title)s.%(ext)s');
  const args = [
    '--no-playlist',
    '--format', hasFfmpeg ? 'bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best' : 'bestvideo[ext=mp4]/best[ext=mp4]/best',
    '--output', outputTemplate,
    '--no-warnings',
  ];
  if (referer) {
    args.push('--referer', referer, '--add-header', `Origin:${new URL(referer).origin}`);
  }
  args.push(videoUrl);

  console.log(`\n  🎬 yt-dlp ile indiriliyor: ${videoUrl}`);
  const result = spawnSync('yt-dlp', args, { encoding: 'utf8', timeout: 300000 });
  if (result.status === 0) {
    console.log('  ✅ Video indirildi');
    return true;
  } else {
    console.error(`  ❌ yt-dlp hatası: ${result.stderr?.slice(0, 300)}`);
    return false;
  }
}

// ─── HTTP downloader ───────────────────────────────────────────
const DOWNLOAD_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': report.url || '',
};

const MIN_FILE_SIZE = {
  image: 2048,    // < 2KB → probably a 1x1 tracker pixel or error
  video: 102400,  // < 100KB → certainly incomplete/stub
  font: 1024,     // < 1KB → error
};

function downloadFile(urlStr, destDir, type = 'image', redirectDepth = 0) {
  return new Promise((resolve) => {
    if (redirectDepth > 5) { resolve({ status: 'error', reason: 'too many redirects' }); return; }

    const filename = slugifyFilename(urlStr);
    const destPath = path.join(destDir, filename);

    if (fs.existsSync(destPath)) {
      const size = fs.statSync(destPath).size;
      const minSize = MIN_FILE_SIZE[type] || 0;
      if (size >= minSize) { resolve({ status: 'skipped', filename }); return; }
      // File exists but too small — redownload
      fs.unlinkSync(destPath);
    }

    const protocol = urlStr.startsWith('https') ? https : http;
    const req = protocol.get(urlStr, { timeout: 20000, headers: DOWNLOAD_HEADERS }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        downloadFile(res.headers.location, destDir, type, redirectDepth + 1).then(resolve);
        return;
      }
      if (res.statusCode !== 200) {
        resolve({ status: 'error', filename, code: res.statusCode });
        return;
      }

      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        const size = fs.existsSync(destPath) ? fs.statSync(destPath).size : 0;
        const minSize = MIN_FILE_SIZE[type] || 0;
        if (size < minSize) {
          fs.unlinkSync(destPath);
          resolve({ status: 'error', filename, reason: `too small (${size}B)` });
        } else {
          resolve({ status: 'downloaded', filename, size });
        }
      });
      file.on('error', () => { try { fs.unlinkSync(destPath); } catch (_) {} resolve({ status: 'error', filename }); });
    });
    req.on('error', () => resolve({ status: 'error', filename }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'error', filename, reason: 'timeout' }); });
  });
}

// ─── SVG component generator ────────────────────────────────────
async function fetchSvgContent(urlStr) {
  return new Promise((resolve) => {
    const protocol = urlStr.startsWith('https') ? https : http;
    let body = '';
    const req = protocol.get(urlStr, { timeout: 10000, headers: DOWNLOAD_HEADERS }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function svgToComponent(svgContent, name) {
  const cleaned = svgContent
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .replace(/\n\s*/g, ' ')
    .trim();
  return `\nexport function ${name}({ className }: { className?: string }) {\n  return (\n    <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ${JSON.stringify(cleaned)} }} />\n  );\n}\n`;
}

// ─── next.config.ts updater ─────────────────────────────────────
function updateNextConfig(hostname) {
  const configPath = path.resolve('next.config.ts');
  if (!fs.existsSync(configPath)) return;
  let content = fs.readFileSync(configPath, 'utf8');
  if (content.includes(hostname)) return;
  const pattern = `{ protocol: 'https', hostname: '${hostname}' }`;
  content = content.replace(
    '// download-assets.js tarafından otomatik güncellenir',
    `// download-assets.js tarafından otomatik güncellenir\n      ${pattern},`
  );
  fs.writeFileSync(configPath, content, 'utf8');
}

// ─── Parallel batch runner ──────────────────────────────────────
async function runBatch(tasks, concurrency = 4) {
  const results = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(t => t()));
    results.push(...batchResults);
  }
  return results;
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('\n📦 Asset indirme başlıyor...\n');

  let downloaded = 0, skipped = 0, errors = 0;
  const errorLog = [];

  // ── Collect all image URLs ──
  const imgTagUrls = (report.structure?.allImages || [])
    .map(img => img.src)
    .filter(src => src && src.startsWith('http') && !/\.svg(\?|$)/.test(src));

  const bgImageUrls = (report.structure?.allBackgroundImages || [])
    .map(b => { const m = b.url?.match(/url\(["']?([^"')]+)["']?\)/); return m?.[1]; })
    .filter(u => u && u.startsWith('http'));

  const allImageUrls = [...new Set([
    ...assets.images.filter(u => !/\.svg(\?|$)/.test(u) && u.startsWith('http')),
    ...imgTagUrls,
    ...bgImageUrls,
  ])];

  // ── Download images in parallel batches ──
  console.log(`🖼  Görseller: ${allImageUrls.length} URL`);
  const imageTasks = allImageUrls.map((url, i) => async () => {
    process.stdout.write(`\r  ⬇ [${i+1}/${allImageUrls.length}] ${slugifyFilename(url).slice(0,40).padEnd(40)}`);
    const result = await downloadFile(url, DIRS.images, 'image');
    if (result.status === 'downloaded') downloaded++;
    else if (result.status === 'skipped') skipped++;
    else { errors++; errorLog.push({ url, ...result }); }
    try { const u = new URL(url); updateNextConfig(u.hostname); } catch (_) {}
    return result;
  });
  await runBatch(imageTasks, 4);
  console.log('');

  // ── Download fonts ──
  const allFontUrls = [...new Set(assets.fonts.filter(u => u.startsWith('http')))];
  if (allFontUrls.length > 0) {
    console.log(`\n📝 Fontlar: ${allFontUrls.length} URL`);
    for (const url of allFontUrls) {
      const result = await downloadFile(url, DIRS.fonts, 'font');
      if (result.status === 'downloaded') downloaded++;
      else if (result.status === 'skipped') skipped++;
      else { errors++; errorLog.push({ url, ...result }); }
    }
  }

  // ── Download / stream videos ──
  const embeds = report.assets?.embeds || [];
  const allVideoSources = [
    ...assets.videos.filter(u => u.startsWith('http')),
    ...embeds,
  ];
  const uniqueVideos = [...new Set(allVideoSources)];

  if (uniqueVideos.length > 0) {
    console.log(`\n🎬 Videolar: ${uniqueVideos.length} URL`);
    for (const url of uniqueVideos) {
      if (isStreamingUrl(url)) {
        if (!hasYtDlp) {
          console.warn(`  ⚠ yt-dlp yok — atlandı: ${url}`);
          console.warn(`    Manuel: yt-dlp --referer "${report.url}" -o "public/videos/%(title)s.%(ext)s" "${url}"`);
          errors++;
          continue;
        }
        const vimeoId = extractVimeoId(url);
        const downloadUrl = vimeoId ? `https://player.vimeo.com/video/${vimeoId}` : url;
        const ok = downloadWithYtDlp(downloadUrl, DIRS.videos, report.url);
        if (ok) downloaded++; else errors++;
      } else {
        const result = await downloadFile(url, DIRS.videos, 'video');
        if (result.status === 'downloaded') downloaded++;
        else if (result.status === 'skipped') {
          skipped++;
        } else {
          // Fallback to yt-dlp for failed video downloads
          if (hasYtDlp) {
            console.log(`  ↩ HTTP başarısız, yt-dlp deneniyor: ${url}`);
            const ok = downloadWithYtDlp(url, DIRS.videos, report.url);
            if (ok) downloaded++; else { errors++; errorLog.push({ url, ...result }); }
          } else {
            errors++;
            errorLog.push({ url, ...result });
          }
        }
      }
    }
  }

  // ── SVG → icons.tsx ──
  const svgUrls = assets.images.filter(u => /\.svg(\?|$)/.test(u) && u.startsWith('http'));
  if (svgUrls.length > 0) {
    console.log(`\n🔷 SVG ikonlar icons.tsx'e ekleniyor (${svgUrls.length})...`);
    const iconsPath = path.resolve('src/components/icons.tsx');
    let iconsContent = fs.existsSync(iconsPath) ? fs.readFileSync(iconsPath, 'utf8') : '';
    let added = 0;
    for (let i = 0; i < svgUrls.length; i++) {
      const url = svgUrls[i];
      const name = `IconSvg${i + 1}`;
      if (iconsContent.includes(name)) continue;
      const svgContent = await fetchSvgContent(url);
      if (svgContent?.includes('<svg')) {
        iconsContent += svgToComponent(svgContent, name);
        added++;
      }
    }
    fs.writeFileSync(iconsPath, iconsContent, 'utf8');
    console.log(`  ✅ ${added} SVG eklendi`);
  }

  // ── Error report ──
  if (errorLog.length > 0) {
    const errPath = path.resolve('docs/research/download-errors.json');
    fs.writeFileSync(errPath, JSON.stringify(errorLog, null, 2), 'utf8');
    console.log(`\n⚠  ${errorLog.length} hata kaydedildi: ${errPath}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 ASSET İNDİRME TAMAMLANDI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  İndirilen  : ${downloaded}`);
  console.log(`  Atlanan    : ${skipped}`);
  console.log(`  Hatalı     : ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => { console.error('❌ Asset indirme hatası:', err.message); process.exit(1); });
