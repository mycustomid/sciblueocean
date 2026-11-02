"""Regression tests for truthful pro forma discount bases."""
import importlib.util
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from datetime import date, timedelta

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'operations-server'))
import invoices
import discounts
spec = importlib.util.spec_from_file_location('subtotal_test_app', ROOT / 'operations-server' / 'app.py')
app_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_module)

class ProformaSubtotal(unittest.TestCase):
 def setUp(self):
  self.tmp = tempfile.TemporaryDirectory(dir=ROOT / 'QA')
  self.addCleanup(self.tmp.cleanup)
  self.path = Path(self.tmp.name) / 'proforma.sqlite3'
  self.app = app_module.create_app(self.path)
 def db(self):
  cx=sqlite3.connect(self.path); cx.row_factory=sqlite3.Row; self.addCleanup(cx.close); return cx
 def create_booking(self,cx,reference,subtotal):
  cur=cx.execute('''INSERT INTO bookings(reference,guest,email,checkin,checkout,guests,nights,estimate_xaf,status,room_number,created_at,updated_at,subtotal_xaf) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''',
   (reference,'Test Guest','test@example.invalid','2030-01-01','2030-01-03',2,2,90000,'confirmed','MIAGUE-01','now','now',subtotal))
  return cur.lastrowid
 def test_discount_only_applies_to_accommodation_subtotal(self):
  with self.db() as cx:
   bid=self.create_booking(cx,'BO-NEW',80000)
   cx.execute('INSERT INTO charges(booking_id,label,amount_xaf,created_at) VALUES(?,?,?,?)',(bid,'Extra',2000,'now'))
   discounts.apply(cx,bid,20,'manager','now')
   result=invoices.create(cx,bid,None,'manager','now')
   self.assertEqual(result['subtotal_xaf'],80000)
   self.assertEqual(result['discount_xaf'],16000)
   self.assertEqual(result['total_xaf'],76000)
 def test_historical_without_subtotal_rejects_discount_but_allows_full_amount(self):
  with self.db() as cx:
   bid=self.create_booking(cx,'BO-OLD',None)
   with self.assertRaisesRegex(RuntimeError,'(?i)sous-total'):
    discounts.apply(cx,bid,5,'manager','now')
   result=invoices.create(cx,bid,None,'manager','now')
   self.assertIsNone(result['subtotal_xaf'])
   self.assertEqual(result['total_xaf'],90000)
 def test_invalid_stored_subtotal_does_not_produce_document(self):
  with self.db() as cx:
   bid=self.create_booking(cx,'BO-BAD',95000)
   with self.assertRaises(RuntimeError): discounts.apply(cx,bid,20,'manager','now')
 def test_legacy_proforma_snapshot_remains_readable(self):
  with self.db() as cx:
   bid=self.create_booking(cx,'BO-OLD-PF',None)
   old='{"reference":"PF-1111111111111111","discount_xaf":1000}'
   cx.execute('INSERT INTO proformas(reference,booking_id,created_at,created_by,snapshot) VALUES(?,?,?,?,?)',('PF-1111111111111111',bid,'now','manager',old))
   self.assertEqual(invoices.get(cx,'PF-1111111111111111')['discount_xaf'],1000)
 def test_new_booking_persists_subtotal_before_rate_changes(self):
  a=(date.today()+timedelta(days=10)).isoformat()
  b=(date.today()+timedelta(days=12)).isoformat()
  with self.db() as cx:
   cx.execute("UPDATE pricing_settings SET value=10000 WHERE key='mandatory_fee_xaf'")
   result=app_module.core.create_booking(cx,{'guest':'Test Guest','email':'test@example.invalid','checkin':a,'checkout':b,'guests':1})
   self.assertEqual(result['estimate_xaf'],90000)
   self.assertEqual(result['subtotal_xaf'],80000)
   cx.execute("UPDATE pricing_settings SET value=20000 WHERE key='mandatory_fee_xaf'")
   discounts.apply(cx,result['id'],20,'manager','now')
   doc=invoices.create(cx,result['id'],None,'manager','now')
   self.assertEqual(doc['discount_xaf'],16000)
   self.assertEqual(doc['total_xaf'],74000)
 def test_existing_database_migrates_without_inventing_subtotal(self):
  with self.db() as cx:
   self.create_booking(cx,'BO-MIGRATE',None)
   cx.execute('ALTER TABLE bookings DROP COLUMN subtotal_xaf')
  cx.close()
  app_module.initialize(self.path)
  with self.db() as cx:
   row=cx.execute("SELECT subtotal_xaf FROM bookings WHERE reference='BO-MIGRATE'").fetchone()
   self.assertIsNotNone(row)
   self.assertIsNone(row['subtotal_xaf'])

if __name__=='__main__': unittest.main()
