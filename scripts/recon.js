#!/usr/bin/env node
'use strict';
/**
 * recon.js — Kapsamlı Website Analiz Scripti (Pixel-Perfect Edition)
 * Kullanım: node scripts/recon.js <url>
 * Çıktı:
 *   docs/research/recon-report.json      — tüm CSS token + section data
 *   docs/research/sections/              — her section için ayrı JSON + screenshot
 *   docs/design-references/             — viewport screenshot'ları
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const [,, targetUrl] = process.argv;
if (!targetUrl) {
  console.error('❌ URL gerekli: node scripts/recon.js <url>');
  process.exit(1);
}

const RESEARCH_DIR    = path.resolve('docs/research');
const SECTIONS_DIR    = path.resolve('docs/research/sections');
const SCREENSHOTS_DIR = path.resolve('docs/design-references');
[RESEARCH_DIR, SECTIONS_DIR, SCREENSHOTS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

const sleep = ms => new Promise(r => setTimeout(r, ms));

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet',  width: 768,  height: 1024 },
  { name: 'mobile',  width: 390,  height: 844  },
];

const CSS_PROPS = [
  'display','position','top','right','bottom','left','zIndex',
  'width','height','minWidth','maxWidth','minHeight','maxHeight',
  'margin','marginTop','marginRight','marginBottom','marginLeft',
  'padding','paddingTop','paddingRight','paddingBottom','paddingLeft',
  'flexDirection','justifyContent','alignItems','alignSelf','flexWrap','gap','flexGrow','flexShrink',
  'gridTemplateColumns','gridTemplateRows','gridColumn','gridRow',
  'color','backgroundColor','background','backgroundImage','backgroundSize','backgroundPosition',
  'fontSize','fontFamily','fontWeight','fontStyle','lineHeight','letterSpacing','textAlign',
  'textTransform','textDecoration','whiteSpace','overflow','textOverflow',
  'borderRadius','border','borderTop','borderRight','borderBottom','borderLeft','outline',
  'boxShadow','opacity','transform','transition','animation',
  'objectFit','objectPosition','cursor','pointerEvents',
  'clipPath','filter','backdropFilter','mixBlendMode',
];

async function extractTokens(page) {
  return page.evaluate(() => {
    const result = {
      cssVariables: {}, colors: [], fonts: [], transitions: [],
      animations: [], keyframes: [], shadows: [], radii: [], gradients: [],
    };
    const seen = { colors: new Set(), transitions: new Set(), shadows: new Set(), radii: new Set() };

    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.style) {
            for (const prop of rule.style) {
              if (prop.startsWith('--'))
                result.cssVariables[prop] = rule.style.getPropertyValue(prop).trim();
            }
          }
          if (rule instanceof CSSKeyframesRule)
            result.keyframes.push({ name: rule.name, css: rule.cssText.slice(0, 1000) });
        }
      } catch (_) {}
    }

    for (const el of [...document.querySelectorAll('*')].slice(0, 800)) {
      const s = getComputedStyle(el);
      for (const p of ['color','backgroundColor','borderColor']) {
        const v = s[p];
        if (v && v !== 'rgba(0, 0, 0, 0)' && !seen.colors.has(v)) {
          seen.colors.add(v); result.colors.push(v);
        }
      }
      if (s.backgroundImage?.includes('gradient')) result.gradients.push(s.backgroundImage);
      if (s.fontFamily && s.fontFamily !== 'serif') {
        result.fonts.push({ family: s.fontFamily, size: s.fontSize, weight: s.fontWeight,
          lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, tag: el.tagName });
      }
      if (s.transition && s.transition !== 'all 0s ease 0s') {
        if (!seen.transitions.has(s.transition)) {
          seen.transitions.add(s.transition); result.transitions.push(s.transition);
        }
      }
      if (s.animationName && s.animationName !== 'none') {
        result.animations.push({ el: el.tagName, name: s.animationName,
          duration: s.animationDuration, easing: s.animationTimingFunction });
      }
      if (s.boxShadow && s.boxShadow !== 'none' && !seen.shadows.has(s.boxShadow)) {
        seen.shadows.add(s.boxShadow); result.shadows.push(s.boxShadow);
      }
      if (s.borderRadius && s.borderRadius !== '0px' && !seen.radii.has(s.borderRadius)) {
        seen.radii.add(s.borderRadius); result.radii.push(s.borderRadius);
      }
    }

    const fontMap = new Map();
    for (const f of result.fonts) fontMap.set(f.family + f.size + f.weight, f);
    result.fonts = [...fontMap.values()].slice(0, 40);
    return result;
  });
}

async function extractSectionCSS(page, selector) {
  return page.evaluate((sel, props) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    function getStyles(element) {
      const computed = getComputedStyle(element);
      const styles = {};
      for (const p of props) {
        const v = computed[p];
        if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)') {
          styles[p] = v;
        }
      }
      return styles;
    }

    function walkDOM(element, depth) {
      if (depth > 5) return null;
      const children = [...element.children];
      const tag = element.tagName.toLowerCase();
      return {
        tag,
        id: element.id || null,
        classes: element.className?.toString().trim() || null,
        text: element.childNodes.length === 1 && element.childNodes[0].nodeType === 3
          ? element.textContent.trim().slice(0, 300) : null,
        src: tag === 'img' ? element.src : null,
        alt: tag === 'img' ? element.alt : null,
        href: tag === 'a' ? element.href : null,
        naturalWidth:  tag === 'img' ? element.naturalWidth  : null,
        naturalHeight: tag === 'img' ? element.naturalHeight : null,
        styles: getStyles(element),
        childCount: children.length,
        children: children.slice(0, 20).map(c => walkDOM(c, depth + 1)).filter(Boolean),
      };
    }

    return {
      selector: sel,
      rect: { top: Math.round(rect.top + window.scrollY), left: Math.round(rect.left),
               width: Math.round(rect.width), height: Math.round(rect.height) },
      styles: getStyles(el),
      backgroundImage: cs.backgroundImage !== 'none' ? cs.backgroundImage : null,
      allImages: [...el.querySelectorAll('img')].map(img => ({
        src: img.src, alt: img.alt, width: img.naturalWidth, height: img.naturalHeight,
        computedWidth: getComputedStyle(img).width, computedHeight: getComputedStyle(img).height,
      })),
      allLinks: [...el.querySelectorAll('a')].slice(0, 20).map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 80) })),
      allText: el.innerText?.trim().slice(0, 2000) || '',
      dom: walkDOM(el, 0),
    };
  }, selector, CSS_PROPS);
}

async function extractStructure(page) {
  return page.evaluate(() => {
    const sectionSelectors = [
      'header', 'nav', '[class*="hero"]', '[class*="banner"]',
      'section', '[class*="section"]', '[class*="feature"]',
      '[class*="pricing"]', '[class*="testimonial"]', '[class*="team"]',
      '[class*="gallery"]', '[class*="portfolio"]', '[class*="blog"]',
      '[class*="faq"]', '[class*="contact"]', '[class*="cta"]',
      '[class*="footer"]', 'footer',
    ];
    const sections = [];
    const seen = new Set();

    for (const sel of sectionSelectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el)) continue;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        sections.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: [...el.classList].join(' ') || null,
          selector: el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + [...el.classList][0] : ''),
          children: el.children.length,
          height: Math.round(rect.height),
          offsetTop: Math.round(rect.top + window.scrollY),
          hasVideo: !!el.querySelector('video'),
          hasCanvas: !!el.querySelector('canvas'),
          hasSVG: !!el.querySelector('svg'),
          hasIframe: !!el.querySelector('iframe'),
          hasForm: !!el.querySelector('form'),
          hasSlider: !!el.querySelector('[class*="swiper"],[class*="slick"],[class*="carousel"],[class*="embla"]'),
          imageCount: el.querySelectorAll('img').length,
          text: el.innerText?.trim().slice(0, 150) || null,
          bgColor: getComputedStyle(el).backgroundColor,
          bgImage: getComputedStyle(el).backgroundImage !== 'none' ? getComputedStyle(el).backgroundImage.slice(0, 200) : null,
        });
      }
    }

    const fontLinks = [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map(l => l.href)
      .filter(h => h.includes('font') || h.includes('Font') || h.includes('typekit') || h.includes('fonts.google'));

    return {
      title: document.title,
      lang: document.documentElement.lang,
      metaDescription: document.querySelector('meta[name="description"]')?.content || null,
      ogImage: document.querySelector('meta[property="og:image"]')?.content || null,
      totalHeight: document.body.scrollHeight,
      sections,
      fontLinks,
      thirdPartyLibs: {
        GSAP: !!window.gsap, Lottie: !!(window.lottie || window.Lottie),
        Swiper: !!window.Swiper, AOS: !!window.AOS, ThreeJS: !!window.THREE,
        LocomotiveScroll: !!window.LocomotiveScroll, SplitType: !!window.SplitType,
        ScrollReveal: !!window.ScrollReveal, AnimeJS: !!window.anime,
      },
      bodyStyles: {
        background: getComputedStyle(document.body).backgroundColor,
        color: getComputedStyle(document.body).color,
        fontFamily: getComputedStyle(document.body).fontFamily,
        overflowX: getComputedStyle(document.body).overflowX,
      },
      favicons: [...document.querySelectorAll('link[rel*="icon"]')].map(l => ({ href: l.href, rel: l.rel, sizes: l.sizes?.toString() })),
      allImages: [...document.querySelectorAll('img')].map(img => ({
        src: img.src, alt: img.alt, width: img.naturalWidth, height: img.naturalHeight,
        parent: img.parentElement?.className?.slice(0, 60),
      })),
      allBackgroundImages: [...document.querySelectorAll('*')].filter(el => {
        const bg = getComputedStyle(el).backgroundImage;
        return bg && bg !== 'none' && bg.includes('url(');
      }).map(el => ({
        selector: el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + el.className.toString().split(' ')[0] : ''),
        url: getComputedStyle(el).backgroundImage,
      })).slice(0, 30),
    };
  });
}

async function main() {
  console.log(`\n🔍 Recon başlıyor: ${targetUrl}\n`);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const assets = { css: [], js: [], fonts: [], images: [], videos: [], embeds: [] };
  page.on('response', async res => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('font') || /\.(woff2?|ttf|otf|eot)(\?|$)/.test(url)) assets.fonts.push(url);
    else if (ct.includes('image') || /\.(jpg|jpeg|png|webp|avif|gif|svg)(\?|$)/.test(url)) assets.images.push(url);
    else if (ct.includes('video') || /\.(mp4|webm|ogg)(\?|$)/.test(url)) assets.videos.push(url);
    else if (ct.includes('application/x-mpegURL') || ct.includes('application/vnd.apple.mpegurl') || url.includes('.m3u8')) {
      // HLS stream detected — log for yt-dlp download
      assets.videos.push(url);
    }
    else if (ct.includes('text/css') || url.endsWith('.css')) assets.css.push(url);
    else if (ct.includes('javascript') || url.endsWith('.js')) assets.js.push(url);
  });

  await page.setViewport({ width: 1440, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
  await require('./_dismiss-cookies')(page);
  await sleep(2000);

  // Extract iframe embeds (Vimeo, YouTube, Wistia, etc.)
  const iframeEmbeds = await page.evaluate(() => {
    const results = [];
    for (const iframe of document.querySelectorAll('iframe')) {
      const src = iframe.src || iframe.getAttribute('src') || '';
      if (!src) continue;
      let type = 'unknown';
      if (/vimeo/.test(src)) type = 'vimeo';
      else if (/youtube|youtu\.be/.test(src)) type = 'youtube';
      else if (/wistia/.test(src)) type = 'wistia';
      results.push({ src, type, width: iframe.width, height: iframe.height });
    }
    return results;
  });

  for (const embed of iframeEmbeds) {
    console.log(`  📺 Embed bulundu (${embed.type}): ${embed.src}`);
    // Extract Vimeo video ID and store as a downloadable target
    const vimeoMatch = embed.src.match(/(?:vimeo\.com\/|video\/)(\d{7,12})/);
    if (vimeoMatch) {
      const playerUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      if (!assets.embeds.includes(playerUrl)) assets.embeds.push(playerUrl);
    }
    // YouTube
    const ytMatch = embed.src.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) {
      const ytUrl = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
      if (!assets.embeds.includes(ytUrl)) assets.embeds.push(ytUrl);
    }
  }
  if (iframeEmbeds.length > 0) {
    console.log(`✅ ${iframeEmbeds.length} iframe embed tespit edildi`)
  }

  const html = await page.content();
  fs.writeFileSync(path.join(RESEARCH_DIR, 'page.html'), html, 'utf8');
  console.log('✅ HTML kaydedildi');

  const tokens = await extractTokens(page);
  console.log(`✅ Token'lar çıkarıldı (${tokens.colors.length} renk, ${tokens.fonts.length} font)`);

  const structure = await extractStructure(page);
  console.log(`✅ Yapı analiz edildi (${structure.sections.length} section)`);

  // Her section için ayrı CSS extraction + screenshot
  console.log('\n📐 Section-level CSS extraction başlıyor...');
  const sectionDetails = [];
  for (let i = 0; i < structure.sections.length; i++) {
    const sec = structure.sections[i];
    const slug = (sec.id || sec.tag + '-' + i).replace(/[^a-z0-9]/gi, '-').toLowerCase();

    // Sayfa başından section'a scroll et
    await page.evaluate((top) => window.scrollTo({ top: Math.max(0, top - 100), behavior: 'instant' }), sec.offsetTop);
    await sleep(400);

    // Section screenshot
    const ssPath = path.join(SECTIONS_DIR, `${String(i).padStart(2,'0')}-${slug}.png`);
    try {
      await page.screenshot({ path: ssPath, clip: {
        x: 0, y: sec.offsetTop, width: 1440,
        height: Math.min(sec.height, 3000),
      }});
    } catch (_) {}

    // Exact CSS extraction
    let cssData = null;
    try {
      cssData = await extractSectionCSS(page, sec.selector);
    } catch (_) {}

    const detail = { ...sec, slug, screenshotPath: ssPath, css: cssData };
    sectionDetails.push(detail);
    fs.writeFileSync(path.join(SECTIONS_DIR, `${String(i).padStart(2,'0')}-${slug}.json`),
      JSON.stringify(detail, null, 2), 'utf8');
    console.log(`  ✅ [${i+1}/${structure.sections.length}] ${sec.tag} — ${slug}`);
  }

  // Scroll ile gizli animasyonları yakala
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'instant' }));
  await sleep(500);
  const scrollTokens = await extractTokens(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));

  // Viewport screenshot'ları
  console.log('\n📸 Viewport screenshot\'ları alınıyor...');
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(2000);
    const ssPath = path.join(SCREENSHOTS_DIR, `${vp.name}-${vp.width}.png`);
    await page.screenshot({ path: ssPath, fullPage: true });
    console.log(`  ✅ ${vp.name} (${vp.width}px)`);
  }

  await browser.close();

  const report = {
    url: targetUrl,
    timestamp: new Date().toISOString(),
    structure: { ...structure, sections: sectionDetails },
    tokens: { ...tokens, scrollAnimations: scrollTokens.animations },
    assets: {
      ...assets,
      embeds: [...new Set(assets.embeds)],
    },
  };

  fs.writeFileSync(path.join(RESEARCH_DIR, 'recon-report.json'), JSON.stringify(report, null, 2), 'utf8');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 RECON TAMAMLANDI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Bölümler    : ${structure.sections.length}`);
  console.log(`  Renkler     : ${tokens.colors.length}`);
  console.log(`  Fontlar     : ${tokens.fonts.length}`);
  console.log(`  Animasyonlar: ${tokens.animations.length}`);
  console.log(`  CSS Vars    : ${Object.keys(tokens.cssVariables).length}`);
  console.log(`  Görsel URL  : ${assets.images.length}`);
  console.log(`  Font URL    : ${assets.fonts.length}`);
  console.log(`  Kütüphaneler: ${Object.entries(report.structure.thirdPartyLibs).filter(([,v]) => v).map(([k]) => k).join(', ') || 'tespit edilmedi'}`);
  console.log(`  Section JSON: docs/research/sections/`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(err => { console.error('❌ Recon hatası:', err.message); process.exit(1); });
