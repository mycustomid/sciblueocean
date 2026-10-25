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
from http.server import ThreadingHTTPServer
from datetime import date,timedelta

ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'demo-server'))
import server as S

class DemoAPI(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory()
  cls.db=S.init_db(pathlib.Path(cls.tmp.name)/'isolated.sqlite3')
  cls.http=ThreadingHTTPServer(('127.0.0.1',0),S.Handler)
  cls.http.db_path=cls.db
  cls.port=cls.http.server_port
  cls.thread=threading.Thread(target=cls.http.serve_forever,daemon=True)
  cls.thread.start()
  cls.a=(date.today()+timedelta(days=12)).isoformat()
  cls.b=(date.today()+timedelta(days=16)).isoformat()
  cls.c=(date.today()+timedelta(days=13)).isoformat()
  cls.d=(date.today()+timedelta(days=17)).isoformat()
 @classmethod
 def tearDownClass(cls):
  cls.http.shutdown();cls.http.server_close();cls.thread.join(timeout=3);cls.tmp.cleanup()
 def setUp(self):
  self.cookies=http.cookiejar.CookieJar()
  self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
  self.csrf=None
 def fetch(self,path,payload=None,method=None,csrf=True):
  method=method or ('POST' if payload is not None else 'GET')
  req=urllib.request.Request(f'http://127.0.0.1:{self.port}'+path,method=method,data=json.dumps(payload).encode() if payload is not None else None)
  req.add_header('Accept','application/json')
  if payload is not None:req.add_header('Content-Type','application/json')
  if self.csrf and csrf and method=='POST':req.add_header('X-Demo-CSRF',self.csrf)
  try:
   with self.opener.open(req,timeout=5) as response:return response.status,json.loads(response.read())
  except urllib.error.HTTPError as err:return err.code,json.loads(err.read())
 def login(self,user='reception'):
  status,data=self.fetch('/api/demo/login',{'user':user,'password':S.DEMO_PASSWORD})
  self.assertEqual(status,200);self.csrf=data['csrf']
 def booking(self,checkin=None,checkout=None,email='test@demo.example'):
  return {'property':'miague','guest':'Guest Example','email':email,'checkin':checkin or self.a,'checkout':checkout or self.b,'guests':2}
 def test_01_public_health(self):
  code,data=self.fetch('/api/demo/health');self.assertEqual(code,200);self.assertEqual(data['payment'],'DISABLED')
 def test_02_invalid_login_and_bad_password(self):
  code,data=self.fetch('/api/demo/login',{'user':'reception','password':'incorrect'})
  self.assertEqual(code,401)
 def test_03_no_cookie_snapshot_denied(self):
  code,data=self.fetch('/api/demo/snapshot');self.assertEqual(code,401)
 def test_04_role_scoping_finance(self):
  self.login('housekeeping');code,data=self.fetch('/api/demo/me');self.assertEqual(code,200)
  self.assertNotIn('folios',data['views']);code,data=self.fetch('/api/demo/snapshot');self.assertEqual(data['bookings'],[]);self.assertEqual(data['charges'],[])
 def test_05_role_mutation_denied(self):
  self.login('housekeeping');code,data=self.fetch('/api/demo/booking/create',self.booking());self.assertEqual(code,403)
 def test_06_csrf_enforced(self):
  self.login('reception');code,data=self.fetch('/api/demo/booking/create',self.booking(),csrf=False);self.assertEqual(code,403)
 def test_07_public_booking_success_and_lookup(self):
  code,data=self.fetch('/api/demo/public/request',self.booking());self.assertEqual(code,201)
  ref=data['reference'];query=urllib.parse.urlencode({'reference':ref,'email':'test@demo.example'})
  code,found=self.fetch('/api/demo/public/lookup?'+query);self.assertEqual(code,200);self.assertEqual(found['booking']['status'],'pending')
  code,missing=self.fetch('/api/demo/public/lookup?'+urllib.parse.urlencode({'reference':ref,'email':'wrong@demo.example'}));self.assertEqual(code,404)
 def test_08_invalid_dates_and_unavailable_property(self):
  code,_=self.fetch('/api/demo/public/request',self.booking(checkin=self.b,checkout=self.a));self.assertEqual(code,400)
  value=self.booking();value['property']='amara';code,_=self.fetch('/api/demo/public/request',value);self.assertEqual(code,400)
 def test_09_full_lifecycle_and_overlap(self):
  code,first=self.fetch('/api/demo/public/request',self.booking(email='flow1@demo.example'));self.assertEqual(code,201)
  code,second=self.fetch('/api/demo/public/request',self.booking(checkin=self.c,checkout=self.d,email='flow2@demo.example'));self.assertEqual(code,201)
  self.login('manager');code,data=self.fetch('/api/demo/snapshot');self.assertEqual(code,200)
  a=next(x for x in data['bookings'] if x['reference']==first['reference']);b=next(x for x in data['bookings'] if x['reference']==second['reference'])
  code,_=self.fetch('/api/demo/booking/transition',{'id':a['id'],'action':'confirm'});self.assertEqual(code,200)
  code,_=self.fetch('/api/demo/booking/transition',{'id':b['id'],'action':'confirm'});self.assertEqual(code,409)
  code,_=self.fetch('/api/demo/booking/transition',{'id':a['id'],'action':'checkin'});self.assertEqual(code,200)
  code,_=self.fetch('/api/demo/folio/charge',{'booking_id':a['id'],'label':'Test laundry','amount_xaf':6500});self.assertEqual(code,200)
  code,_=self.fetch('/api/demo/booking/transition',{'id':a['id'],'action':'checkout'});self.assertEqual(code,200)
  code,data=self.fetch('/api/demo/snapshot');self.assertGreaterEqual(data['metrics']['billed'],6500)
  self.assertEqual(data['metrics']['settled'],0);self.assertEqual(data['metrics']['revenue'],0)
 def test_10_housekeeping_allowed_but_no_charge(self):
  self.login('housekeeping');code,task=self.fetch('/api/demo/task/create',{'room':'Studio 01','title':'Linen change'});self.assertEqual(code,200)
  code,_=self.fetch('/api/demo/task/update',{'id':task['record']['id'],'status':'done'});self.assertEqual(code,200)
  code,_=self.fetch('/api/demo/folio/charge',{'booking_id':1,'label':'improper','amount_xaf':100});self.assertEqual(code,403)
 def test_11_owner_read_only(self):
  self.login('owner');code,_=self.fetch('/api/demo/booking/transition',{'id':1,'action':'confirm'});self.assertEqual(code,403)
  code,overview=self.fetch('/api/demo/snapshot');self.assertEqual(code,200);self.assertEqual(overview['bookings'],[])
 def test_12_logout_revokes_session(self):
  self.login();code,_=self.fetch('/api/demo/logout',{});self.assertEqual(code,200)
  code,_=self.fetch('/api/demo/me');self.assertEqual(code,401)
 def test_13_custom_payment_route_missing(self):
  code,_=self.fetch('/api/demo/payment/create',{'amount':40000});self.assertEqual(code,404)
 def test_14_unconnected_engine_reported(self):
  self.login('manager');code,data=self.fetch('/api/demo/snapshot');self.assertEqual(data['upstream_pms'],'NOT_CONNECTED')
 def test_15_browser_assets_and_routes_exist(self):
  for path in ['/experience/','/experience/stays/','/studio/','/studio/bookings/','/studio/companies/','/experience/assets/site.css','/studio/assets/studio.js']:
   with urllib.request.urlopen(f'http://127.0.0.1:{self.port}'+path,timeout=5) as r:self.assertEqual(r.status,200,path)

if __name__=='__main__':unittest.main(verbosity=2)
