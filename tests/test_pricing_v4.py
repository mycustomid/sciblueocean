"""Executable, database-backed V4 integration tests. No third-party credentials required."""
import http.cookiejar
import json
import pathlib
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from http.server import ThreadingHTTPServer

ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'demo-server'))
import server as S

class PricingV4(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory()
  cls.db=S.init_db(pathlib.Path(cls.temp.name)/'pricing.sqlite3')
  cls.http=ThreadingHTTPServer(('127.0.0.1',0),S.Handler);cls.http.db_path=cls.db
  cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True);cls.thread.start()
  cls.a=(date.today()+timedelta(days=90)).isoformat()
  cls.b=(date.today()+timedelta(days=93)).isoformat()
  cls.c=(date.today()+timedelta(days=105)).isoformat()
  cls.d=(date.today()+timedelta(days=108)).isoformat()
 @classmethod
 def tearDownClass(cls):
  cls.http.shutdown();cls.http.server_close();cls.thread.join(3);cls.temp.cleanup()
 def setUp(self):
  self.csrf=None
  self.browser=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(self,path,payload=None):
  req=urllib.request.Request('http://127.0.0.1:'+str(self.http.server_port)+path,method='POST' if payload is not None else 'GET',data=json.dumps(payload).encode() if payload is not None else None)
  if payload is not None:req.add_header('Content-Type','application/json')
  if self.csrf:req.add_header('X-Demo-CSRF',self.csrf)
  try:
   with self.browser.open(req,timeout=5) as r:return r.status,json.loads(r.read())
  except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
 def login(self,role='manager'):
  code,d=self.call('/api/demo/login',{'user':role,'password':S.DEMO_PASSWORD});self.assertEqual(code,200);self.csrf=d['csrf']
 def quote(self,a=None,b=None,**params):
  p={'checkin':a or self.a,'checkout':b or self.b,'guests':2,'property':'miague'}
  p.update(params)
  return self.call('/api/demo/public/quote?'+urllib.parse.urlencode(p))
 def booking(self,**params):
  b={'checkin':self.a,'checkout':self.b,'guests':2,'property':'miague','guest':'Test User','email':'test@example.test','estimate_xaf':1}
  b.update(params)
  return self.call('/api/demo/public/request',b)
 def test_01_authoritative_quote_default_3_nights(self):
  status,q=self.quote();self.assertEqual(status,200)
  self.assertEqual(q['nights'],3);self.assertEqual(q['subtotal_xaf'],120000)
  self.assertEqual(q['currency'],'XAF');self.assertTrue(q['available'])
  self.assertFalse(q['final_total_confirmed']);self.assertEqual(q['tax_status'],'NOT_CONFIGURED')
 def test_02_invalid_date_rejected(self):
  self.assertEqual(self.quote(self.b,self.a)[0],400)
  self.assertEqual(self.quote('2020-01-01','2020-01-04')[0],400)
 def test_03_nonbookable_property_rejected(self):
  self.assertEqual(self.quote(property='ebene')[0],400)
 def test_04_rate_write_requires_auth(self):
  self.assertEqual(self.call('/api/demo/pricing/rate',{'day':self.a,'rate_xaf':65000,'reason':'test event'})[0],401)
 def test_05_rate_write_requires_manager_role(self):
  self.login('reception')
  self.assertEqual(self.call('/api/demo/pricing/rate',{'day':self.a,'rate_xaf':65000,'reason':'test event'})[0],403)
 def test_06_authorized_rate_override_changes_server_quote(self):
  self.login('manager')
  self.assertEqual(self.call('/api/demo/pricing/rate',{'day':self.a,'rate_xaf':65000,'reason':'Local event'})[0],200)
  code,price=self.quote();self.assertEqual(code,200)
  self.assertEqual(price['subtotal_xaf'],145000)
  self.assertEqual(price['nightly_rates'][0]['rate_xaf'],65000)
 def test_07_browser_amount_tampering_ignored(self):
  code,b=self.booking();self.assertEqual(code,201)
  self.assertEqual(b['estimate_xaf'],145000)
  with S.connection(self.db) as cx:
   actual=S.one(cx,'SELECT estimate_xaf FROM bookings WHERE reference=?',(b['reference'],))
  self.assertEqual(actual['estimate_xaf'],145000)
 def test_08_inventory_block_prevents_quote_and_booking(self):
  self.login('manager')
  self.assertEqual(self.call('/api/demo/inventory/block',{'checkin':self.c,'checkout':self.d,'reason':'Room maintenance'})[0],200)
  self.assertFalse(self.quote(self.c,self.d)[1]['available'])
  code,data=self.booking(checkin=self.c,checkout=self.d)
  self.assertEqual(code,400);self.assertIn('Dates unavailable',data['error'])
 def test_09_disallowed_guests(self):
  self.assertEqual(self.quote(guests=100)[0],400)
 def test_10_no_payment_provider_enabled(self):
  self.assertEqual(self.call('/api/demo/flutterwave/webhook',{'data':{'id':101}})[0],503)
 def test_11_analytics_consent_endpoint_whitelist(self):
  ok={'event':'quote_shown','locale':'en','path':'/experience/en/search/'}
  self.assertEqual(self.call('/api/demo/public/event',ok)[0],202)
  self.assertEqual(self.call('/api/demo/public/event',{**ok,'event':'email_address'})[0],400)
  with S.connection(self.db) as cx:
   self.assertEqual(cx.execute('SELECT COUNT(*) FROM conversion_events WHERE event=?',('quote_shown',)).fetchone()[0],1)
 def test_12_quote_does_not_return_guest_pii(self):
  _,quote=self.quote();self.assertNotIn('email',quote);self.assertNotIn('guest',quote)
 def test_13_booking_rate_snapshot_persists_on_rate_change(self):
  code,b=self.booking(email='snapshot@example.test');self.assertEqual(code,201)
  self.login('manager');self.assertEqual(self.call('/api/demo/pricing/rate',{'day':self.a,'rate_xaf':72000,'reason':'Revised manual rate'})[0],200)
  with S.connection(self.db) as cx:
   record=S.one(cx,'SELECT estimate_xaf FROM bookings WHERE reference=?',(b['reference'],))
  self.assertEqual(record['estimate_xaf'],145000)
  self.assertEqual(self.quote()[1]['subtotal_xaf'],152000)

if __name__=='__main__':unittest.main()
