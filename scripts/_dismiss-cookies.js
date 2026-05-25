'use strict';
/**
 * _dismiss-cookies.js
 * Cookie/GDPR banner'larını otomatik kapatır.
 * Playwright veya Puppeteer page nesnesi ile çalışır.
 *
 * Kullanım:
 *   const dismissCookies = require('./_dismiss-cookies');
 *   await dismissCookies(page);  // goto'dan hemen sonra çağır
 */

// Kabul butonlarının yaygın selector'ları (öncelik sırasına göre)
const ACCEPT_SELECTORS = [
  // ID / class bazlı yaygın isimler
  '#onetrust-accept-btn-handler',
  '#accept-recommended-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#cookieConsent button[class*="accept"]',
  '#cookie-consent-accept',
  '.cookie-accept',
  '.accept-cookies',
  '.js-accept-cookies',
  '.cc-accept',
  '[data-testid="cookie-accept"]',
  '[data-cy="accept-cookies"]',

  // Aria label bazlı
  'button[aria-label*="Accept"]',
  'button[aria-label*="accept"]',
  'button[aria-label*="Agree"]',
  'button[aria-label*="Allow"]',

  // Text bazlı (geniş kapsam)
  'button:has-text("Accept All")',
  'button:has-text("Accept all")',
  'button:has-text("Accept All Cookies")',
  'button:has-text("Allow All")',
  'button:has-text("Allow all")',
  'button:has-text("Allow all cookies")',
  'button:has-text("Agree")',
  'button:has-text("Agree to all")',
  'button:has-text("I Agree")',
  'button:has-text("OK")',
  'button:has-text("Got it")',
  'button:has-text("Tamam")',
  'button:has-text("Kabul Et")',
  'button:has-text("Tümünü Kabul Et")',
  'button:has-text("Hepsini Kabul Et")',

  // Genel fallback — "accept" veya "allow" içeren button
  'button[class*="accept"]',
  'button[class*="Allow"]',
  'button[id*="accept"]',
];

// Playwright için: has-text desteklenir
async function dismissPlaywright(page) {
  // Önce kısa bir bekleme — banner animasyonu için
  await page.waitForTimeout(1500);

  for (const sel of ACCEPT_SELECTORS) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 800 })) {
        await el.click();
        await page.waitForTimeout(600);
        return true;
      }
    } catch {}
  }

  // Fallback: JS ile text'e göre bul
  try {
    const clicked = await page.evaluate(() => {
      const keywords = ['accept all', 'allow all', 'agree', 'kabul', 'tamam', 'got it'];
      const buttons = [...document.querySelectorAll('button, a[role="button"]')];
      for (const btn of buttons) {
        const text = (btn.innerText || btn.textContent || '').toLowerCase().trim();
        if (keywords.some(k => text.includes(k)) && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      await page.waitForTimeout(600);
      return true;
    }
  } catch {}

  return false;
}

// Puppeteer için: has-text desteklenmez, JS fallback kullan
async function dismissPuppeteer(page) {
  await new Promise(r => setTimeout(r, 1500));

  // Selector bazlı (has-text içermeyenler)
  const plainSelectors = ACCEPT_SELECTORS.filter(s => !s.includes(':has-text'));
  for (const sel of plainSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        const visible = await page.evaluate(e => e.offsetParent !== null, el);
        if (visible) {
          await el.click();
          await new Promise(r => setTimeout(r, 600));
          return true;
        }
      }
    } catch {}
  }

  // JS fallback
  try {
    const clicked = await page.evaluate(() => {
      const keywords = ['accept all', 'allow all', 'agree', 'kabul', 'tamam', 'got it'];
      const buttons = [...document.querySelectorAll('button, a[role="button"]')];
      for (const btn of buttons) {
        const text = (btn.innerText || btn.textContent || '').toLowerCase().trim();
        if (keywords.some(k => text.includes(k)) && btn.offsetParent !== null) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      await new Promise(r => setTimeout(r, 600));
      return true;
    }
  } catch {}

  return false;
}

/**
 * Ana fonksiyon — Playwright veya Puppeteer page nesnesini otomatik algılar.
 * @param {object} page - Playwright veya Puppeteer page nesnesi
 * @returns {Promise<boolean>} - Cookie banner bulunup kapatıldıysa true
 */
async function dismissCookies(page) {
  // Playwright'ta page.locator() var, Puppeteer'da yok
  const isPlaywright = typeof page.locator === 'function';
  const found = isPlaywright
    ? await dismissPlaywright(page)
    : await dismissPuppeteer(page);

  if (found) {
    console.log('  🍪  Cookie banner kapatıldı');
  }
  return found;
}

module.exports = dismissCookies;
