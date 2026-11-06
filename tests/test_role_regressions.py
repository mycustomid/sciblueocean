"""Regressions for staff snapshot accuracy and authorized workflow transitions."""
import os, sys, tempfile, unittest
from pathlib import Path
from datetime import date
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'operations-server'))
import app as ops

class RoleRegressions(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(dir=ROOT/'QA')
  self.addCleanup(self.tmp.cleanup)
  self.path=Path(self.tmp.name)/'ops.sqlite3'
  self.app=ops.create_app(self.path); self.app.testing=True
  self.password='fixture-only-password-123456'
  for role in ('owner','manager','housekeeping','reception'):
   ops.provision_user(self.path,'qa_'+role,self.password,role)
 def client_for(self,role):
  client=self.app.test_client()
  r=client.post('/api/staff/login',json={'username':'qa_'+role,'password':self.password},headers={'Origin':'http://localhost'})
  self.assertEqual(r.status_code,200,r.get_json())
  return client,client.get('/api/staff/me').get_json()['csrf']
 def test_all_history_counts_owner_aggregate_and_privacy(self):
  today=ops.core.iso_today()
  with ops.db(self.path) as cx:
   for i in range(202):
    cx.execute("INSERT INTO bookings(reference,guest,email,checkin,checkout,guests,nights,estimate_xaf,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",(f'QA-{i}','Private guest','guest@example.invalid',today,'2099-01-01',1,1,40000,'confirmed' if i==0 else 'cancelled',today,today))
   cx.execute("INSERT INTO inventory_blocks(from_date,to_date,reason,created_at) VALUES(?,?,?,?)",('2098-01-01','2098-01-03','fixture',today))
  owner,_=self.client_for('owner');me=owner.get('/api/staff/me').get_json();self.assertEqual(me['property'],'ALL')
  snap=owner.get('/api/staff/snapshot').get_json();self.assertEqual(snap['metrics']['arrivals'],1);self.assertEqual(snap['metrics']['total_requests'],202);self.assertEqual(len(snap['bookings']),202);self.assertEqual(snap['report_daily'][-1]['count'],202)
  manager,_=self.client_for('manager');snap=manager.get('/api/staff/snapshot').get_json();self.assertEqual(len(snap['bookings']),202);self.assertEqual(snap['calendar_blocks'][0]['from_date'],'2098-01-01')
 def test_reception_cancellation_releases_request(self):
  from datetime import timedelta
  c,csrf=self.client_for('reception');h={'Origin':'http://localhost','X-CSRF-Token':csrf}
  a=(date.today()+timedelta(days=10)).isoformat(); b=(date.today()+timedelta(days=12)).isoformat()
  r=c.post('/api/staff/booking/create',json={'guest':'QA Guest','email':'qa@example.invalid','phone':'+237600000000','checkin':a,'checkout':b,'guests':1},headers=h)
  self.assertEqual(r.status_code,200,r.get_json()); record=r.get_json(); bid=record.get('id') or record.get('record',{}).get('id')
  r=c.post('/api/staff/booking/transition',json={'id':bid,'action':'cancel'},headers=h);self.assertEqual(r.status_code,200,r.get_json())
  snapshot=c.get('/api/staff/snapshot').get_json();self.assertEqual(next(x for x in snapshot['bookings'] if x['id']==bid)['status'],'cancelled')
 def test_early_checkin_requires_explicit_boolean_and_audit(self):
  from datetime import timedelta
  c,csrf=self.client_for('reception');h={'Origin':'http://localhost','X-CSRF-Token':csrf}
  today=date.fromisoformat(ops.core.iso_today()); future=(today+timedelta(days=10)).isoformat()
  with ops.db(self.path) as cx:
   ids=[]
   for idx,arrival in enumerate((today.isoformat(),future)):
    cur=cx.execute("INSERT INTO bookings(reference,guest,email,checkin,checkout,guests,nights,estimate_xaf,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",(f'E-{idx}','QA','qa@example.invalid',arrival,'2099-01-01',1,1,40000,'confirmed',today.isoformat(),today.isoformat()))
    ids.append(cur.lastrowid)
  r=c.post('/api/staff/booking/transition',json={'id':ids[0],'action':'checkin'},headers=h);self.assertEqual(r.status_code,200,r.get_json())
  for flag in (None,False,'true',1):
   payload={'id':ids[1],'action':'checkin'}
   if flag is not None:payload['early_checkin_confirmed']=flag
   r=c.post('/api/staff/booking/transition',json=payload,headers=h);self.assertEqual(r.status_code,409,r.get_json())
  with ops.db(self.path) as cx:self.assertEqual(cx.execute('SELECT status FROM bookings WHERE id=?',(ids[1],)).fetchone()['status'],'confirmed')
  r=c.post('/api/staff/booking/transition',json={'id':ids[1],'action':'checkin','early_checkin_confirmed':True},headers=h);self.assertEqual(r.status_code,200,r.get_json())
  with ops.db(self.path) as cx:self.assertEqual(cx.execute("SELECT COUNT(*) FROM audit WHERE action='booking:early_checkin_confirmed' AND reference='E-1'").fetchone()[0],1)
 def test_douala_date_at_utc_boundary(self):
  from unittest.mock import patch
  from datetime import datetime,timezone
  class FrozenDatetime(datetime):
   @classmethod
   def now(cls,tz=None):return datetime(2030,1,1,23,30,tzinfo=timezone.utc).astimezone(tz)
  with patch.object(ops.core,'datetime',FrozenDatetime):self.assertEqual(ops.core.iso_today(),'2030-01-02')
 def test_task_transitions_must_move_forward(self):
  c,csrf=self.client_for('housekeeping');h={'Origin':'http://localhost','X-CSRF-Token':csrf}
  r=c.post('/api/staff/task/create',json={'room':'QA 01','title':'Fixture'},headers=h);self.assertEqual(r.status_code,200,r.get_json()); item=r.get_json();bid=item.get('id') or item.get('record',{}).get('id');self.assertIsNotNone(bid,item)
  for status,expected in [('done',409),('in_progress',200),('done',200),('open',409)]:
   r=c.post('/api/staff/task/update',json={'id':bid,'status':status},headers=h);self.assertEqual(r.status_code,expected,r.get_json())
if __name__=='__main__':unittest.main()
