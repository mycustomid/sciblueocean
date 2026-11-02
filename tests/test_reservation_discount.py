"""Reservation discount API; uses disposable local SQLite data."""
import importlib.util
from pathlib import Path
import secrets
import sqlite3
import sys
import tempfile
import unittest
from datetime import date, timedelta

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'operations-server'))
spec=importlib.util.spec_from_file_location('discount_test_app',ROOT/'operations-server'/'app.py')
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)

class ReservationDiscount(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory(dir=ROOT/'QA');self.addCleanup(self.tmp.cleanup)
  self.path=Path(self.tmp.name)/'test.sqlite';self.app=ops.create_app(self.path);self.client=self.app.test_client()
  self.pw=secrets.token_urlsafe(24)
  for role in ('reception','manager','finance','owner'):ops.provision_user(self.path,'qa_'+role,self.pw,role)
  self.origin={'Origin':'http://localhost'}
  a=(date.today()+timedelta(days=15)).isoformat();b=(date.today()+timedelta(days=17)).isoformat()
  with ops.db(self.path) as cx:
   cx.execute("UPDATE pricing_settings SET value=10000 WHERE key='mandatory_fee_xaf'")
   cx.execute("UPDATE pricing_settings SET value=5000 WHERE key='verified_tax_xaf'")
   cx.execute("UPDATE pricing_settings SET value=1 WHERE key='tax_config_verified'")
   self.booking=ops.core.create_booking(cx,{'guest':'Guest','email':'discount@example.invalid','checkin':a,'checkout':b,'guests':1})
  self.bid=self.booking['id']
 def login(self,role='reception'):
  r=self.client.post('/api/staff/login',json={'username':'qa_'+role,'password':self.pw},headers=self.origin);self.assertEqual(r.status_code,200)
  return self.client.get('/api/staff/me').get_json()['csrf']
 def apply(self,pct,csrf=None,bid=None):
  h={**self.origin};
  if csrf:h['X-CSRF-Token']=csrf
  return self.client.post('/api/staff/booking/discount',json={'booking_id':bid or self.bid,'discount_percent':pct},headers=h)
 def row(self):
  with ops.db(self.path) as cx:return dict(cx.execute('SELECT * FROM bookings WHERE id=?',(self.bid,)).fetchone())
 def test_discount_replaces_prior_rate_not_compound_and_updates_receipt_and_proforma(self):
  csrf=self.login();r=self.apply(20,csrf);self.assertEqual(r.status_code,200,r.get_json())
  row=self.row();self.assertEqual((row['subtotal_xaf'],row['original_estimate_xaf'],row['discount_xaf'],row['estimate_xaf']),(80000,95000,16000,79000))
  self.assertEqual(self.apply(10,csrf).status_code,200)
  row=self.row();self.assertEqual((row['discount_xaf'],row['estimate_xaf']),(8000,87000))
  self.assertEqual(self.apply(10,csrf).status_code,200)
  self.assertEqual(self.row()['estimate_xaf'],87000)
  snapshot=self.client.get('/api/staff/snapshot').get_json()
  listed=next(b for b in snapshot['bookings'] if b['id']==self.bid)
  self.assertEqual((listed['estimate_xaf'],listed['discount_percent'],listed['discount_xaf']),(87000,10,8000))
  r=self.client.post('/api/booking/public/lookup',json={'reference':row['reference'],'email':row['email']},headers=self.origin)
  self.assertEqual(r.status_code,200,r.get_json());self.assertEqual(r.get_json()['booking']['estimate_xaf'],87000)
  self.assertNotIn('identity_number',r.get_json()['booking'])
  r=self.client.post('/api/staff/proformas',json={'booking_id':self.bid},headers={**self.origin,'X-CSRF-Token':csrf})
  self.assertEqual(r.status_code,201,r.get_json());doc=r.get_json()['record'];self.assertEqual(doc['total_xaf'],87000);self.assertEqual(doc['discount_xaf'],8000)
  with ops.db(self.path) as cx:self.assertGreaterEqual(cx.execute('SELECT count(*) FROM booking_discount_audit WHERE booking_id=?',(self.bid,)).fetchone()[0],2)
 def test_intents_or_legacy_block_and_authorization_csrf_fail_closed(self):
  csrf=self.login();self.assertEqual(self.apply(21,csrf).status_code,400);self.assertEqual(self.apply(4,csrf).status_code,400)
  self.assertEqual(self.apply(5).status_code,403)
  with ops.db(self.path) as cx:cx.execute('INSERT INTO payment_intents(booking_id,external_reference,amount_xaf,updated_at) VALUES(?,?,?,?)',(self.bid,'pay-test',95000,'now'))
  self.assertEqual(self.apply(10,csrf).status_code,409);self.assertEqual(self.row()['estimate_xaf'],95000)
  with ops.db(self.path) as cx:cx.execute("UPDATE payment_intents SET state='paid' WHERE booking_id=?",(self.bid,))
  self.assertEqual(self.apply(10,csrf).status_code,409)
  with ops.db(self.path) as cx:
   cx.execute('DELETE FROM payment_intents WHERE booking_id=?',(self.bid,))
   cx.execute('UPDATE bookings SET subtotal_xaf=NULL WHERE id=?',(self.bid,))
  self.assertEqual(self.apply(10,csrf).status_code,409);self.assertEqual(self.row()['estimate_xaf'],95000)
  self.client.post('/api/staff/logout',json={},headers={**self.origin,'X-CSRF-Token':csrf})
  csrf=self.login('finance');self.assertEqual(self.apply(10,csrf).status_code,403)
  snap=self.client.get('/api/staff/snapshot').get_json()
  self.assertNotIn('identity_number',snap['bookings'][0])
 def test_discount_can_be_removed_and_charges_are_not_discounted(self):
  csrf=self.login();self.assertEqual(self.apply(20,csrf).status_code,200)
  with ops.db(self.path) as cx:cx.execute('INSERT INTO charges(booking_id,label,amount_xaf,created_at) VALUES(?,?,?,?)',(self.bid,'Extra',3000,'now'))
  r=self.client.post('/api/staff/proformas',json={'booking_id':self.bid},headers={**self.origin,'X-CSRF-Token':csrf})
  self.assertEqual(r.get_json()['record']['total_xaf'],82000)
  self.assertEqual(self.apply(0,csrf).status_code,200);self.assertEqual(self.row()['estimate_xaf'],95000)
 def test_completed_or_cancelled_reservations_are_immutable(self):
  csrf=self.login()
  for state in ('checked_out','cancelled'):
   with ops.db(self.path) as cx:cx.execute('UPDATE bookings SET status=? WHERE id=?',(state,self.bid))
   self.assertEqual(self.apply(10,csrf).status_code,409)
   self.assertEqual(self.row()['estimate_xaf'],95000)
 def test_proforma_refuses_different_discount_and_preserves_old_snapshot(self):
  csrf=self.login()
  first=self.client.post('/api/staff/proformas',json={'booking_id':self.bid},headers={**self.origin,'X-CSRF-Token':csrf}).get_json()['record']
  self.assertEqual(self.apply(20,csrf).status_code,200)
  old=self.client.get('/api/staff/proformas/'+first['reference']).get_json()['record']
  self.assertEqual(old['total_xaf'],95000)
  r=self.client.post('/api/staff/proformas',json={'booking_id':self.bid,'discount_percent':10},headers={**self.origin,'X-CSRF-Token':csrf})
  self.assertEqual(r.status_code,400)

if __name__=='__main__': unittest.main()
