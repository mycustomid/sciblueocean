const { chromium } = require('D:/code/.system_tools/browser_runner/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const origin = 'https://sciblueocean.vercel.app';
const out = path.join(__dirname, 'production-ui-2026-10-26');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const findings = {};
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(origin + '/experience/', { waitUntil: 'networkidle' });
  await mobile.locator('[data-mobile-toggle]').click();
  findings.mobileMenu = await mobile.evaluate(() => ({ expanded: document.querySelector('[data-mobile-toggle]').getAttribute('aria-expanded'), hidden: document.querySelector('[data-mobile-menu]').hidden, links: [...document.querySelectorAll('[data-mobile-menu] a')].map(a => a.innerText.trim()) }));
  await mobile.screenshot({ path: path.join(out, 'interaction-mobile-menu.png') });
  await mobile.locator('[data-mobile-toggle]').click();
  await mobile.locator('[data-language-picker] summary').click();
  await mobile.locator('[data-set-language="en"]').click();
  findings.language = await mobile.evaluate(() => ({ lang: document.documentElement.lang, current: document.querySelector('[data-language-current]')?.textContent, h1: document.querySelector('h1')?.innerText, nav: [...document.querySelectorAll('.mobile-nav a')].map(a => a.innerText.trim()), editorial: document.querySelector('.home-intro')?.innerText?.slice(0, 250) }));
  await mobile.goto(origin + '/experience/payment/', { waitUntil: 'networkidle' });
  findings.languagePayment = await mobile.evaluate(() => ({ lang: document.documentElement.lang, h1: document.querySelector('h1')?.innerText, current: document.querySelector('[data-language-current]')?.textContent }));
  await mobile.locator('form button[type="submit"]').first().click();
  findings.paymentEmpty = await mobile.evaluate(() => ({ valid: document.querySelector('form').checkValidity(), active: document.activeElement?.getAttribute('name'), response: document.querySelector('[role="status"]')?.innerText }));
  await mobile.goto(origin + '/experience/search/', { waitUntil: 'networkidle' });
  findings.searchOverflow = await mobile.evaluate(() => [...document.querySelectorAll('body *')].map(e => ({ el: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().replace(/\s+/g, '.') : ''), right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width })).filter(x => x.right > innerWidth + 2).sort((a,b) => b.right - a.right).slice(0, 12));
  await mobile.locator('[data-search-form] input[name="checkin"]').fill('2026-11-05');
  await mobile.locator('[data-search-form] input[name="checkout"]').fill('2026-11-04');
  await mobile.locator('[data-search-form] button[type="submit"]').click();
  findings.searchInvalidDates = await mobile.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(-750), alerts: [...document.querySelectorAll('[role="alert"], [role="status"]')].map(e => e.innerText) }));
  await mobile.screenshot({ path: path.join(out, 'interaction-search-invalid.png'), fullPage: true });
  await mobile.locator('[data-search-form] input[name="checkin"]').fill('2026-11-05');
  await mobile.locator('[data-search-form] input[name="checkout"]').fill('2026-11-07');
  await mobile.locator('[data-search-form] button[type="submit"]').click();
  await mobile.waitForTimeout(1200);
  findings.searchValid = await mobile.evaluate(() => ({ results: [...document.querySelectorAll('.search-result')].map(e => e.innerText.slice(0, 180)), notes: [...document.querySelectorAll('.quiet-note')].map(e => e.innerText) }));

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(origin + '/experience/stays/', { waitUntil: 'networkidle' });
  findings.collectionHero = await desktop.evaluate(() => {
    const pick = selector => { const e = document.querySelector(selector); if (!e) return null; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { selector, rect: { x:r.x,y:r.y,w:r.width,h:r.height }, display:s.display, opacity:s.opacity, visibility:s.visibility, src:e.getAttribute('src'), naturalWidth:e.naturalWidth }; };
    return ['.collection-hero', '.collection-hero-image', '.collection-hero-image img', '.page-hero > div:first-child'].map(pick);
  });
  for (const [filter, value] of [['open', 'Réservable maintenant'], ['interest', 'À venir'], ['all', 'Tout voir']]) {
    await desktop.locator(`[data-property-filter="${filter}"]`).click();
    findings[`filter_${filter}`] = await desktop.evaluate(() => ({ cards: [...document.querySelectorAll('[data-property-status]')].map(e => ({ status: e.getAttribute('data-property-status'), hiddenAttribute: e.querySelector('.residence-card')?.hidden, visible: !!e.querySelector('.residence-card')?.getClientRects().length })), active: document.querySelector('.filter-pill.active')?.innerText, pressed: [...document.querySelectorAll('[data-property-filter]')].map(e => e.getAttribute('aria-pressed')) }));
  }
  await desktop.goto(origin + '/experience/monthly/', { waitUntil: 'networkidle' });
  findings.monthlyHero = await desktop.evaluate(() => { const e = document.querySelector('.page-hero'); const h = document.querySelector('h1'); return { hero: e?.getBoundingClientRect().toJSON(), heading: h?.getBoundingClientRect().toJSON(), h1font: h ? getComputedStyle(h).fontSize : null }; });
  await desktop.goto(origin + '/studio/', { waitUntil: 'networkidle' });
  await desktop.locator('[data-studio-login] button[type="submit"]').click();
  findings.studioEmpty = await desktop.evaluate(() => ({ valid: document.querySelector('form').checkValidity(), active: document.activeElement?.getAttribute('name'), response: document.querySelector('[data-form-response]')?.innerText }));

  fs.writeFileSync(path.join(out, 'flows.json'), JSON.stringify(findings, null, 2));
  console.log(JSON.stringify(findings, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
