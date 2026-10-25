#!/usr/bin/env python3
"""Real Chromium screenshot + layout smoke. Exit nonzero if unavailable, never fake PASS."""
from pathlib import Path
import http.server, json, os, socketserver, subprocess, tempfile, threading
root=Path(__file__).resolve().parents[1]
try:
 from playwright.sync_api import sync_playwright
except ImportError as exc:
 raise SystemExit(f"NOT_RUN: playwright missing: {exc}")
class ReuseServer(socketserver.TCPServer):allow_reuse_address=True
handler=lambda *args,**kwargs:http.server.SimpleHTTPRequestHandler(*args,directory=str(root/'public'),**kwargs)
with ReuseServer(('127.0.0.1',0),handler) as server:
 t=threading.Thread(target=server.serve_forever,daemon=True);t.start();origin=f'http://127.0.0.1:{server.server_address[1]}'
 evidence=Path(os.environ.get('RC20_SCREENSHOT_DIR',tempfile.mkdtemp(prefix='rc20-browser-')))
 evidence.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.getenv('RC20_CHROMIUM_PATH') or None,args=['--no-sandbox','--disable-dev-shm-usage'])
  records=[]
  for route in ['rc19','rc20']:
   for name,w,h in [('desktop',1440,900),('mobile',390,844)]:
    page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(f'{origin}/{route}/',wait_until='domcontentloaded',timeout=15000)
    page.locator('h1').wait_for(timeout=7000)
    assert page.locator('h1').is_visible(),f'{route} has no H1'
    assert not errors,f'{route} JS errors: {errors}'
    width=page.evaluate('document.documentElement.scrollWidth')
    assert width<=w+3,f'{route} horizontal overflow {width}px > viewport {w}px'
    if route=='rc20':
     assert page.locator('#release-state').inner_text().strip()=='NOT APPROVED'
     assert page.locator('#run').is_disabled()
    else:assert page.locator('#refresh').is_disabled()
    output=evidence/f'{route}-{name}.png'
    page.screenshot(path=str(output),full_page=True)
    records.append({'route':route,'viewport':name,'horizontal_overflow':False,'screenshot':str(output)})
    page.close()
  browser.close()
 print(json.dumps({'status':'PASS','screenshots':records},indent=2))
