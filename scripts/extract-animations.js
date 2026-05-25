#!/usr/bin/env node
'use strict';
/**
 * extract-animations.js
 *
 * Chrome DevTools Protocol (CDP) üzerinden sayfadaki tüm CSS animasyonlarını
 * ve Web Animations API değerlerini çeker. AI bu JSON'ı okuyarak Framer
 * Motion'a birebir çevirir — duration/easing/keyframes tahmin etmez.
 *
 * Kullanım : node scripts/extract-animations.js <url>
 * Çıktı    : docs/research/animations/
 *              ├── animations.json     ← tüm animasyonların data'sı
 *              ├── transitions.json    ← CSS transition değerleri
 *              ├── stagger.json        ← sıralı animasyon grupları
 *              └── frames/
 *                   └── anim-XX-start.png / mid.png / end.png
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const URL     = process.argv[2];
const OUT_DIR = path.resolve('docs', 'research', 'animations');

if (!URL) { console.error('❌  URL gerekli: node scripts/extract-animations.js <url>'); process.exit(1); }

fs.mkdirSync(path.join(OUT_DIR, 'frames'), { recursive: true });

// GSAP easing → cubic-bezier eşdeğerleri
const GSAP_EASING_MAP = {
  'power1.out'  : [0.25, 0.46, 0.45, 0.94],
  'power2.out'  : [0.16, 1, 0.3, 1],
  'power3.out'  : [0.33, 1, 0.68, 1],
  'power4.out'  : [0.76, 0, 0.24, 1],
  'power1.inOut': [0.45, 0, 0.55, 1],
  'power2.inOut': [0.65, 0, 0.35, 1],
  'power3.inOut': [0.76, 0, 0.24, 1],
  'expo.out'    : [0.19, 1, 0.22, 1],
  'expo.inOut'  : [0.87, 0, 0.13, 1],
  'sine.out'    : [0.39, 0.575, 0.565, 1],
  'circ.out'    : [0, 0.55, 0.45, 1],
  'back.out'    : [0.34, 1.56, 0.64, 1],
};

function describeEasing(cssEasing) {
  if (!cssEasing) return { css: 'ease', framerMotion: [0.25, 0.1, 0.25, 1] };
  const clean = cssEasing.trim();
  if (clean.startsWith('cubic-bezier')) {
    const nums = clean.match(/[\d.]+/g)?.map(Number) || [];
    return { css: clean, framerMotion: nums.length === 4 ? nums : [0.25, 0.1, 0.25, 1] };
  }
  const presets = {
    'ease'        : [0.25, 0.1, 0.25, 1],
    'ease-in'     : [0.42, 0, 1, 1],
    'ease-out'    : [0, 0, 0.58, 1],
    'ease-in-out' : [0.42, 0, 0.58, 1],
    'linear'      : [0, 0, 1, 1],
  };
  return { css: clean, framerMotion: presets[clean] || [0.25, 0.1, 0.25, 1] };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await ctx.newPage();

  // CDP oturumu aç
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Animation.enable');

  const capturedAnimations = [];
  cdp.on('Animation.animationCreated', ({ animation }) => {
    if (animation && typeof animation === 'object') capturedAnimations.push(animation);
  });

  console.log(`\n🎞  Animasyon çıkarımı başlıyor → ${URL}\n`);

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
  await require('./_dismiss-cookies')(page);
  await page.waitForTimeout(800);

  // Yavaş scroll ile tüm animasyonları tetikle
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    await page.evaluate(y => window.scrollTo({ top: y }), Math.floor((i / steps) * totalHeight));
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page.waitForTimeout(800);

  // ── CSS Transition değerlerini çek ──
  const transitions = await page.evaluate(() => {
    function hexColor(rgb) {
      const m = rgb.match(/\d+/g);
      if (!m || m.length < 3) return rgb;
      return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('').toUpperCase();
    }

    const results  = [];
    const seen     = new WeakSet();
    const allEls   = document.querySelectorAll('*');

    allEls.forEach(el => {
      if (seen.has(el)) return;
      const cs = window.getComputedStyle(el);
      if (cs.transitionDuration === '0s' || cs.transitionDuration === '') return;

      const rect = el.getBoundingClientRect();
      if (rect.width < 2) return;
      seen.add(el);

      results.push({
        tag       : el.tagName.toLowerCase(),
        class     : el.className?.toString().slice(0, 80),
        text      : el.innerText?.slice(0, 40),
        transition: {
          property : cs.transitionProperty,
          duration : cs.transitionDuration,
          timing   : cs.transitionTimingFunction,
          delay    : cs.transitionDelay,
        },
        color     : hexColor(cs.color),
        background: hexColor(cs.backgroundColor),
      });
    });

    return results.slice(0, 200);
  });

  // ── Web Animations API'dan animasyonları çek ──
  const webAnimations = await page.evaluate(() => {
    const results = [];
    const seen    = new WeakSet();

    function processEl(el) {
      if (seen.has(el)) return;
      seen.add(el);
      const anims = el.getAnimations?.() || [];
      anims.forEach(anim => {
        if (!anim.effect) return;
        const timing   = anim.effect.getTiming?.() || {};
        const computed = anim.effect.getComputedTiming?.() || {};
        const keyframes= anim.effect.getKeyframes?.() || [];

        results.push({
          id         : anim.id || '',
          tag        : el.tagName.toLowerCase(),
          class      : el.className?.toString().slice(0, 80),
          playState  : anim.playState,
          duration   : timing.duration,
          delay      : timing.delay,
          easing     : timing.easing,
          iterations : timing.iterations,
          fill       : timing.fill,
          keyframes  : keyframes.map(kf => {
            const { composite, computedOffset, easing, offset, ...props } = kf;
            return { offset: computedOffset ?? offset, easing, properties: props };
          }),
        });
      });
    }

    document.querySelectorAll('*').forEach(el => processEl(el));
    return results;
  });

  // ── CSS @keyframes kurallarını çek ──
  const cssKeyframes = await page.evaluate(() => {
    const results = [];
    try {
      Array.from(document.styleSheets).forEach(sheet => {
        let rules;
        try { rules = Array.from(sheet.cssRules || []); } catch { return; }
        rules.forEach(rule => {
          if (rule instanceof CSSKeyframesRule) {
            results.push({
              name  : rule.name,
              frames: Array.from(rule.cssRules).map(fr => ({
                key  : fr.keyText,
                style: fr.style.cssText,
              })),
            });
          }
        });
      });
    } catch {}
    return results;
  });

  // ── Stagger analizi — aynı parent'tan gelen sıralı animasyonları grupla ──
  const staggerGroups = detectStagger(webAnimations);

  // ── CDP ile yakalanan animasyonları işle ──
  const processedAnimations = capturedAnimations
    .filter(anim => anim && typeof anim === 'object')
    .slice(0, 100)
    .map((anim, i) => {
      try {
        return {
          index   : i,
          name    : anim.name || anim.source?.name || '',
          type    : anim.type,
          duration: anim.source?.duration,
          delay   : anim.source?.delay,
          easing  : describeEasing(anim.source?.timing?.timingFunction),
        };
      } catch { return null; }
    })
    .filter(Boolean);

  // ── Frame extraction — key animasyonların başlangıç/orta/bitiş kareleri ──
  const keyAnimations = webAnimations.slice(0, 8);
  for (let i = 0; i < keyAnimations.length; i++) {
    const anim = keyAnimations[i];
    try {
      const dur = typeof anim.duration === 'number' ? anim.duration : 600;

      // Start frame
      await page.evaluate((cls) => {
        document.querySelectorAll('.' + cls.split(' ')[0])?.forEach(el => {
          el.getAnimations?.().forEach(a => { a.currentTime = 0; a.pause(); });
        });
      }, anim.class || '');
      await page.screenshot({ path: path.join(OUT_DIR, 'frames', `anim-${String(i+1).padStart(2,'0')}-start.png`) });

      // Mid frame
      await page.evaluate((cls, dur) => {
        document.querySelectorAll('.' + cls.split(' ')[0])?.forEach(el => {
          el.getAnimations?.().forEach(a => { a.currentTime = dur / 2; });
        });
      }, anim.class || '', dur);
      await page.screenshot({ path: path.join(OUT_DIR, 'frames', `anim-${String(i+1).padStart(2,'0')}-mid.png`) });

      // End frame
      await page.evaluate((cls, dur) => {
        document.querySelectorAll('.' + cls.split(' ')[0])?.forEach(el => {
          el.getAnimations?.().forEach(a => { a.currentTime = dur; a.play(); });
        });
      }, anim.class || '', dur);
      await page.screenshot({ path: path.join(OUT_DIR, 'frames', `anim-${String(i+1).padStart(2,'0')}-end.png`) });

    } catch { /* bazı animasyonlar erişime kapalı, sessiz geç */ }
  }

  // ── GSAP değerlerini çek (window.gsap varsa) ──
  const gsapData = await page.evaluate(() => {
    if (!window.gsap) return null;
    const tweens = window.gsap.globalTimeline?.getChildren?.(true, true, false) || [];
    return tweens.slice(0, 50).map(t => ({
      targets : t.targets?.().map(el => ({
        tag: el?.tagName?.toLowerCase(),
        class: el?.className?.toString().slice(0, 60),
      })),
      duration: t.duration?.(),
      delay   : t.delay?.(),
      ease    : t.vars?.ease,
      vars    : Object.keys(t.vars || {}).filter(k => !['ease','onComplete','onUpdate'].includes(k)),
    }));
  });

  await browser.close();

  // ── Sonuçları kaydet ──
  const animData = {
    url        : URL,
    extractedAt: new Date().toISOString(),
    summary: {
      cssTransitions  : transitions.length,
      webAnimations   : webAnimations.length,
      cssKeyframes    : cssKeyframes.length,
      cdpAnimations   : processedAnimations.length,
      staggerGroups   : staggerGroups.length,
      hasGSAP         : !!gsapData,
    },
    framerMotionEasingMap: GSAP_EASING_MAP,
    webAnimations,
    cssKeyframes,
    staggerGroups,
    cdpAnimations    : processedAnimations,
    gsap             : gsapData,
  };

  fs.writeFileSync(path.join(OUT_DIR, 'animations.json'), JSON.stringify(animData, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'transitions.json'), JSON.stringify(transitions, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'stagger.json'), JSON.stringify(staggerGroups, null, 2));

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅  Animasyon çıkarımı tamamlandı`);
  console.log(`   CSS Transitions : ${transitions.length}`);
  console.log(`   Web Animations  : ${webAnimations.length}`);
  console.log(`   CSS @keyframes  : ${cssKeyframes.length}`);
  console.log(`   Stagger grupları: ${staggerGroups.length}`);
  console.log(`   GSAP tespit     : ${gsapData ? 'EVET' : 'hayır'}`);
  console.log(`\n   AI şu dosyayı okuyarak Framer Motion kodu yazmalı:`);
  console.log(`   → docs/research/animations/animations.json`);
  console.log(`   → docs/research/animations/transitions.json`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

function detectStagger(animations) {
  const groups = {};
  animations.forEach(anim => {
    if (!anim.class) return;
    const parentKey = anim.class.split(' ')[0];
    if (!groups[parentKey]) groups[parentKey] = [];
    groups[parentKey].push({ delay: anim.delay, duration: anim.duration, easing: anim.easing });
  });

  return Object.entries(groups)
    .filter(([, g]) => g.length >= 2)
    .map(([cls, items]) => {
      const delays  = items.map(i => i.delay).filter(d => typeof d === 'number').sort((a,b) => a-b);
      const avgStep = delays.length >= 2
        ? delays.reduce((sum, d, i) => i > 0 ? sum + (d - delays[i-1]) : sum, 0) / (delays.length - 1)
        : 0;
      return {
        class          : cls,
        count          : items.length,
        staggerDelay   : Math.round(avgStep),
        duration       : items[0]?.duration,
        easing         : items[0]?.easing,
        framerMotion   : `staggerChildren: ${Math.round(avgStep)}ms`,
      };
    })
    .filter(g => g.staggerDelay > 0);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
