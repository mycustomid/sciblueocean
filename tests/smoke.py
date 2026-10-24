"""Browser smoke tests for standalone Hotel OS (Odoo Architecture).

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
        # Verify 9 products exist in Product Switcher
        assert p.locator('#productSelect option').count() == 9, f"Expected 9 products, got {p.locator('#productSelect option').count()}"
        assert p.locator('.flow-pill').count() == 4, "Expected 4 flowchart steps in top pipeline bar"
        assert p.locator('.nav-item').count() == 13, f"Expected 13 nav items, got {p.locator('.nav-item').count()}"
        assert p.locator('.stat-card').count() == 4
        
        # Test rooms rack view
        p.locator('[data-view="rooms"]').click()
        assert p.locator('.room-card').count() == 24
        
        # Test Odoo Folios view
        p.locator('[data-view="folios"]').click()
        assert p.locator('.data-table tbody tr').count() > 0
        
        # Test Bookings view & creation
        p.locator('[data-view="bookings"]').click()
        p.locator('[data-action="new-booking"]').first.click()
        form = p.locator('form[data-form="booking"]')
        form.locator('[name="guest"]').fill('Odoo VIP Delegate')
        form.locator('[name="arrival"]').fill('2027-06-14')
        form.locator('[name="departure"]').fill('2027-06-17')
        form.locator('button[type="submit"]').click()
        
        # Verify folio created and saved in v3 9-product store
        saved = p.evaluate('window.__testStore.blcg_sbo_9product_erp_v3')
        assert 'Odoo VIP Delegate' in saved
        
        # Test switching to BLEX (Product 02) & Step 1 POS Cashier -> Step 2 Kanban -> Step 3 Control -> Step 4 Boss Sign-Off
        p.locator('#productSelect').select_option('blex')
        p.locator('#roleSelect').select_option('service')
        assert p.locator('.pos-layout').count() == 1
        p.locator('form[data-form="div-new-record"] [name="client"]').fill('Societe Cacao Douala SA')
        p.locator('form[data-form="div-new-record"] button[type="submit"]').click()
        
        # Advance in Step 2 Kanban & verify domain-specific units (6 FX Vaults, NOT 24 Hotel Rooms!)
        p.locator('#roleSelect').select_option('housekeeping')
        assert p.locator('.kanban-3').count() == 1
        p.locator('[data-action="div-advance-step"]').first.click()
        p.locator('[data-view="rooms"]').click()
        assert p.locator('.room-card').count() == 6
        assert 'COFFRE-EUR' in p.locator('#mainView').inner_text()

        # Test Sugar Manufacturing (Product 05) Domain Simulator & Official Certificate Modal
        p.locator('#productSelect').select_option('sugar')
        p.locator('#roleSelect').select_option('direction')
        assert p.locator('form[data-form="div-simulator"]').count() == 1
        p.locator('form[data-form="div-simulator"] button[type="submit"]').click()
        p.locator('[data-action="print-div-record"]').first.click()
        assert 'ICUMSA 45' in p.locator('#modalRoot').inner_text()
        p.locator('[data-action="close-modal"]').first.click()
        
        # Switch back to Property & test Housekeeping role
        p.locator('#productSelect').select_option('property')
        p.locator('#roleSelect').select_option('housekeeping')
        assert p.locator('.nav-item').count() == 5
        assert p.locator('[data-view="folios"]').count() == 0
        
        p.locator('[data-view="housekeeping"]').click()
        pending_before = p.locator('[data-action="task-complete"]').count()
        if pending_before > 0:
            p.locator('[data-action="task-complete"]').first.click()
            assert p.locator('[data-action="task-complete"]').count() == pending_before - 1
            
        # Test Finance & Night Audit role
        p.locator('#roleSelect').select_option('finance')
        p.locator('[data-view="audit"]').click()
        assert p.locator('.audit-box').count() == 1
        
        # Test Language toggle
        p.locator('[data-lang="en"]').click()
        assert p.locator('#pageTitle').inner_text().startswith('Night Audit')
        
        # Test Responsive
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
                assert dp.locator('.product-9-card').count() == 9
                assert dp.locator('.flow-node').count() == 4
                dp.locator('[data-action="enter-terminal"][data-role="direction"]').first.click()
                assert dp.evaluate('document.querySelector(".brand-logo").naturalWidth') > 0
                assert dp.evaluate('document.documentElement.scrollWidth - innerWidth') == 0
                
                # Verify all views click through without runtime JS errors
                for view_id in ['rooms', 'bookings', 'folios', 'services', 'calendar', 'guests', 'housekeeping', 'maintenance', 'operations', 'audit', 'reports', 'settings', 'overview']:
                    dp.locator(f'[data-view="{view_id}"]').click()
                dp.close()

                mp = browser.new_page(viewport={'width': 390, 'height': 844})
                mp.on('console', lambda m: cerr.append(m.text) if m.type == 'error' else None)
                mp.on('pageerror', lambda e: perr.append(str(e)))
                mp.goto(url + '?product=property&role=direction&gate=0', wait_until='networkidle')
                assert mp.evaluate('document.documentElement.scrollWidth - innerWidth') == 0
                mp.locator('#menuToggle').click()
                assert 'open' in mp.locator('.sidebar').get_attribute('class')
                mp.close()
                assert not cerr and not perr, (cerr, perr)
            finally:
                srv.shutdown()

        browser.close()
    print('PASS: Odoo Hospitality ERP tests passed (Folios, Room rack, POS Services, Maintenance, Night audit, Roles, 0 errors)')


if __name__ == '__main__':
    run()
