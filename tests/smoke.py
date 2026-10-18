"""Browser smoke tests for standalone Hotel OS.

Requires: pip install playwright; playwright install chromium
Tests run using injected standalone assets because some CI/browser environments block localhost.
"""
from pathlib import Path
import os
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / 'standalone'
HTML = (ROOT / 'index.html').read_text(encoding='utf-8').replace(
    '<link rel="stylesheet" href="./styles.css" />', ''
).replace('<script src="./app.js" defer></script>', '')
JS = (ROOT / 'app.js').read_text(encoding='utf-8')
CSS = (ROOT / 'styles.css').read_text(encoding='utf-8')


def bootstrap(browser, width=1440, height=900, storage=None):
    page = browser.new_page(viewport={'width': width, 'height': height}, accept_downloads=True)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(HTML)
    page.add_style_tag(content=CSS)
    page.evaluate('''data => {
      const store = data || {};
      window.__testStore = store;
      Object.defineProperty(window, 'localStorage', { configurable: true, value: {
        getItem: key => store[key] || null,
        setItem: (key,value) => {store[key] = String(value);},
        removeItem: key => {delete store[key];}
      }});
    }''', storage)
    page.add_script_tag(content=JS)
    return page, errors


def _find_chromium():
    env_bin = os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
    if env_bin and Path(env_bin).exists():
        return env_bin
    if Path('/usr/bin/chromium').exists():
        return '/usr/bin/chromium'
    ms_pw = Path.home() / 'AppData' / 'Local' / 'ms-playwright'
    if ms_pw.exists():
        found = sorted(ms_pw.glob('chromium-*/chrome-win64/chrome.exe'), reverse=True)
        if found:
            return str(found[0])
    return None


def run():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=_find_chromium(), args=['--no-sandbox'])
        p, errors = bootstrap(browser)
        assert p.locator('.nav-item').count() == 10
        assert p.locator('.stat-card').count() == 4
        p.locator('[data-view="rooms"]').click()
        assert p.locator('.room-card').count() == 24
        p.locator('[data-view="bookings"]').click()
        before = p.locator('.data-table tbody tr').count()
        p.locator('[data-action="new-booking"]').first.click()
        form = p.locator('form[data-form="booking"]')
        form.locator('[name="guest"]').fill('Demo QA Guest')
        form.locator('[name="arrival"]').fill('2027-06-14')
        form.locator('[name="departure"]').fill('2027-06-17')
        form.locator('button[type="submit"]').click()
        assert p.locator('.data-table tbody tr').count() == before + 1
        saved = p.evaluate('window.__testStore.sbo_hotel_os_demo_v1')
        assert 'Demo QA Guest' in saved
        # Conflict in the same room and overlapping dates must not be saved
        p.locator('[data-action="new-booking"]').first.click()
        form = p.locator('form[data-form="booking"]')
        form.locator('[name="guest"]').fill('Overlapping Guest')
        form.locator('[name="arrival"]').fill('2027-06-15')
        form.locator('[name="departure"]').fill('2027-06-16')
        form.locator('button[type="submit"]').click()
        assert p.locator('.modal').count() == 1
        assert p.locator('.data-table tbody tr').count() == before + 1
        p.locator('.modal-close').click()
        p.locator('#roleSelect').select_option('housekeeping')
        assert p.locator('.nav-item').count() == 5
        assert p.locator('[data-view="billing"]').count() == 0
        p.locator('[data-view="housekeeping"]').click()
        pending_before = p.locator('[data-action="task-complete"]').count()
        p.locator('[data-action="task-complete"]').first.click()
        assert p.locator('[data-action="task-complete"]').count() == pending_before - 1
        p.locator('#roleSelect').select_option('finance')
        p.locator('[data-view="billing"]').click()
        p.locator('[data-action="invoice"]').first.click()
        p.locator('#vatToggle').check()
        assert '19,25%' in p.locator('#invoicePreview').inner_text()
        p.evaluate('window.print = () => {window.__printed = !!document.querySelector("#printRoot .print-paper")};')
        p.locator('[data-action="invoice-print"]').click()
        assert p.evaluate('window.__printed') is True
        p.locator('.modal-close').click()
        assert not errors, errors
        # Simulate a new page load using the same saved localStorage state
        storage = p.evaluate('window.__testStore')
        p.close()
        p2, errors2 = bootstrap(browser, storage=storage)
        p2.locator('[data-view="bookings"]').click()
        assert p2.get_by_text('Demo QA Guest').count() > 0
        p2.locator('[data-lang="en"]').click()
        assert p2.locator('#pageTitle').inner_text().startswith('Reservations')
        assert not errors2, errors2
        p2.close()
        mobile, mobile_errors = bootstrap(browser, width=390, height=844)
        mobile.wait_for_timeout(250)
        assert mobile.evaluate('document.documentElement.scrollWidth - innerWidth') == 0
        mobile.locator('#menuToggle').click()
        assert 'open' in mobile.locator('.sidebar').get_attribute('class')
        assert not mobile_errors, mobile_errors
        mobile.close()

        dist_dir = Path(__file__).resolve().parents[1] / 'dist'
        if (dist_dir / 'index.html').exists():
            import functools
            import http.server
            import threading

            class QuietHandler(http.server.SimpleHTTPRequestHandler):
                def log_message(self, format, *args):
                    pass

            handler = functools.partial(QuietHandler, directory=str(dist_dir))
            srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
            port = srv.server_address[1]
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            url = f'http://127.0.0.1:{port}/'
            try:
                cerr, perr = [], []
                dp = browser.new_page(viewport={'width': 1440, 'height': 900})
                dp.on('console', lambda m: cerr.append(m.text) if m.type == 'error' else None)
                dp.on('pageerror', lambda e: perr.append(str(e)))
                dp.goto(url, wait_until='networkidle')
                assert dp.evaluate('document.querySelector(".brand-logo").naturalWidth') > 0
                assert dp.evaluate('document.documentElement.scrollWidth - innerWidth') == 0
                previews_dir = Path(__file__).resolve().parents[1] / 'previews'
                if previews_dir.exists():
                    dp.screenshot(path=str(previews_dir / 'desktop.png'), full_page=True)
                for view_id in ['rooms', 'bookings', 'calendar', 'guests', 'billing', 'housekeeping', 'operations', 'reports', 'settings', 'overview']:
                    dp.locator(f'[data-view="{view_id}"]').click()
                dp.close()

                mp = browser.new_page(viewport={'width': 390, 'height': 844})
                mp.on('console', lambda m: cerr.append(m.text) if m.type == 'error' else None)
                mp.on('pageerror', lambda e: perr.append(str(e)))
                mp.goto(url, wait_until='networkidle')
                assert mp.evaluate('document.documentElement.scrollWidth - innerWidth') == 0
                if previews_dir.exists():
                    mp.screenshot(path=str(previews_dir / 'mobile.png'), full_page=True)
                mp.locator('#menuToggle').click()
                assert 'open' in mp.locator('.sidebar').get_attribute('class')
                mp.close()
                assert not cerr and not perr, (cerr, perr)
            finally:
                srv.shutdown()

        browser.close()
    print('PASS: modules, 24 rooms, new booking, conflict check, roles, housekeeping, invoice, VAT, print, storage, EN, 390px mobile, dist HTTP E2E, no JS/console errors')


if __name__ == '__main__':
    run()
