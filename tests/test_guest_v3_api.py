import json,sys,tempfile,threading,unittest,urllib.request,urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'demo-server'))
import server as S
class GuestV3API(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.tmp=tempfile.TemporaryDirectory()
  cls.server=ThreadingHTTPServer(('127.0.0.1',0),S.Handler)
  cls.server.db_path=S.init_db(Path(cls.tmp.name)/'demo.db')
  cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):
  cls.server.shutdown();cls.server.server_close();cls.thread.join(timeout=2);cls.tmp.cleanup()
 def post(self,path,data):
  req=urllib.request.Request(f'http://127.0.0.1:{self.server.server_port}'+path,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'},method='POST')
  try:
   with urllib.request.urlopen(req,timeout=3) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
 def test_interested_prospect_persist(self):
  status,result=self.post('/api/demo/public/interest',{'property':'ebene','guest':'Sample Buyer','email':'buyer@example.test','movein':'2027-11-01','message':'Planning a monthly stay'})
  self.assertEqual(status,201);self.assertTrue(result['reference'].startswith('INT-'))
  with S.connection(self.server.db_path) as db:
   rows=db.execute('SELECT property FROM interests WHERE reference=?',(result['reference'],)).fetchall()
   self.assertEqual(rows[0]['property'],'ebene')
 def test_interest_cannot_reserve_ready_studio(self):
  self.assertEqual(self.post('/api/demo/public/interest',{'property':'miague','guest':'Test Guest','email':'guest@example.test'})[0],400)
 def test_contact_persist(self):
  status,record=self.post('/api/demo/public/contact',{'guest':'Test Guest','email':'guest@example.test','reason':'Question','message':'Please advise on the available studio'})
  self.assertEqual(status,201)
  with S.connection(self.server.db_path) as db:self.assertEqual(db.execute('SELECT count(*) FROM enquiries WHERE reference=?',(record['reference'],)).fetchone()[0],1)
 def test_invalid_message_rejected(self):
  self.assertEqual(self.post('/api/demo/public/contact',{'guest':'Test Guest','email':'guest@example.test','message':'a'})[0],400)
 def test_provider_test_disabled_without_keys(self):
  self.assertEqual(self.post('/api/demo/flutterwave/webhook',{'data':{'id':123}})[0],503)
 def test_fr_en_live_static_http(self):
  for uri in ('/experience/','/experience/en/','/experience/stays/','/experience/en/stays/','/experience/payment/','/experience/en/payment/','/experience/assets/site-v3.js'):
   with urllib.request.urlopen(f'http://127.0.0.1:{self.server.server_port}'+uri,timeout=3) as resp:self.assertEqual(resp.status,200)
if __name__=='__main__':unittest.main()
