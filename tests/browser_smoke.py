#!/usr/bin/env python3
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8765'
OUT=Path(__file__).resolve().parents[1]/'previews';OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for name, width, height, url in [('home-desktop',1440,900,'/experience/'),('home-mobile',390,844,'/experience/'),('collection',1440,900,'/experience/stays/'),('property',1440,900,'/experience/stays/miague/'),('studio-login',1440,900,'/studio/')]:
  page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
  js=[];page.on('pageerror',lambda e:js.append(str(e)))
  page.goto(BASE+url,wait_until='domcontentloaded',timeout=20000)
  page.screenshot(path=str(OUT/f'{name}.png'),full_page=True)
  overflow=page.evaluate('document.documentElement.scrollWidth>window.innerWidth+4')
  print(name,'title',page.title(),'overflow',overflow,'JS exceptions',js[:2])
  page.close()
 browser.close()
