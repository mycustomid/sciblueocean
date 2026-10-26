const { chromium } = require('D:/code/.system_tools/browser_runner/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const origin = 'https://sciblueocean.vercel.app';
const out = path.join(__dirname, 'production-ui-2026-10-26');
fs.mkdirSync(out, { recursive: true });

function slug(route) {
  return route === '/' ? 'home' : route.replace(/^\/|\/$/g, '').replace(/\W+/g, '-');
}

async function inspect(page, route, viewport) {
  const errors = [];
  const failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', req => failed.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`));
  let response;
  try {
    response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(1500);
    await page.locator('body').evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
    await page.locator('body').evaluate(() => window.scrollTo(0, 0));
  } catch (e) { errors.push(e.message); }
  let dom = {};
  try {
    dom = await page.evaluate(() => ({
      title: document.title,
      h1: [...document.querySelectorAll('h1')].map(e => e.innerText.trim()),
      headings: [...document.querySelectorAll('h2')].map(e => e.innerText.trim()),
      links: [...document.querySelectorAll('a[href]')].map(e => ({ text: e.innerText.trim().replace(/\s+/g, ' ').slice(0, 90), href: e.getAttribute('href') })),
      buttons: [...document.querySelectorAll('button')].map(e => ({ text: e.innerText.trim().replace(/\s+/g, ' ').slice(0, 80), label: e.getAttribute('aria-label') })),
      images: [...document.images].map(e => ({ src: e.getAttribute('src'), alt: e.alt, loaded: e.complete && e.naturalWidth > 0, width: e.naturalWidth })),
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      bodyText: document.body.innerText.slice(0, 12000)
    }));
    const fileStem = `${slug(route)}-${viewport}`;
    if (!/^[a-z0-9-]+$/i.test(fileStem)) throw new Error('Unsafe screenshot filename');
    const screenshotPath = path.resolve(out, `${fileStem}.png`); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    if (path.dirname(screenshotPath) !== out) throw new Error('Screenshot path escaped audit directory');
    await page.screenshot({ path: screenshotPath, fullPage: true });
  } catch (e) { errors.push(e.message); }
  return { route, viewport, status: response?.status(), finalUrl: page.url(), ...dom, errors, failed };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const routes = ['/', '/experience/', '/studio/', '/experience/payment/'];
  const seen = new Set();
  const results = [];
  while (routes.length && seen.size < 28) {
    const route = routes.shift();
    if (seen.has(route)) continue;
    seen.add(route);
    for (const [viewport, size] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
      const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
      const result = await inspect(page, route, viewport);
      results.push(result);
      if (viewport === 'desktop') {
        for (const a of result.links || []) {
          if (a.href?.startsWith('/experience/') && !a.href.includes('#') && !a.href.includes('?') && !routes.includes(a.href) && !seen.has(a.href)) routes.push(a.href);
        }
      }
      console.log(`${viewport.padEnd(7)} ${String(result.status).padEnd(3)} ${route} | ${result.h1?.join(' / ')?.slice(0, 60) || ''} | broken images: ${(result.images || []).filter(i => !i.loaded).length} | overflow: ${result.overflowX || 0} | errors: ${result.errors.length}`);
      await page.close();
    }
  }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
