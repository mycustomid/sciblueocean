"""Inventory availability and block safety; uses only temporary databases."""
import importlib.util
import pathlib
import secrets
import sys
import tempfile
import unittest
from datetime import date, timedelta

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'operations-server'))
sys.path.insert(0, str(ROOT / 'demo-server'))
import server as core
spec = importlib.util.spec_from_file_location('inventory_test_app', ROOT / 'operations-server' / 'app.py')
app_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app_module)

class InventoryAvailability(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=ROOT / 'QA')
        self.addCleanup(self.tmp.cleanup)
        self.path = pathlib.Path(self.tmp.name) / 'inventory.sqlite3'
        self.app = app_module.create_app(self.path)
        self.start = date.today() + timedelta(days=45)
    def day(self, n):
        return (self.start + timedelta(days=n)).isoformat()
    def booking(self, cx, reference, start, end, room='', status='confirmed'):
        cx.execute('''INSERT INTO bookings(reference,guest,email,checkin,checkout,guests,nights,estimate_xaf,status,room_number,created_at,updated_at)
                      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''', (reference,'Test','test@example.invalid',self.day(start),self.day(end),1,end-start,40000,status,room,'now','now'))
    def test_sequential_stays_in_one_room_do_not_exhaust_inventory(self):
        with core.connection(self.path) as cx:
            for n in range(25): self.booking(cx, f'T{n}', n, n+1, 'MIAGUE-01')
            self.assertEqual(core.pricing_available_rooms(cx,self.day(0),self.day(25)),24)
    def test_distinct_rooms_ever_occupied_reduce_whole_stay_availability(self):
        with core.connection(self.path) as cx:
            self.booking(cx,'A',0,1,'MIAGUE-01')
            self.booking(cx,'B',1,2,'MIAGUE-02')
            self.assertEqual(core.pricing_available_rooms(cx,self.day(0),self.day(2)),23)
            self.assertEqual(core.pricing_available_rooms(cx,self.day(2),self.day(3)),25)
    def test_unassigned_pending_overlap_is_conservative_not_sum_of_sequential_stays(self):
        with core.connection(self.path) as cx:
            self.booking(cx,'A',0,2,'MIAGUE-01')
            self.booking(cx,'B',0,1,'','pending')
            self.booking(cx,'C',1,2,'','pending')
            self.assertEqual(core.pricing_available_rooms(cx,self.day(0),self.day(2)),23)
            self.booking(cx,'D',0,2,'','pending')
            self.assertEqual(core.pricing_available_rooms(cx,self.day(0),self.day(2)),22)
            candidate = cx.execute("SELECT id FROM bookings WHERE reference='D'").fetchone()[0]
            self.assertEqual(core.pricing_available_rooms(cx,self.day(0),self.day(2),candidate),23)
    def test_block_denied_when_any_confirmed_or_pending_booking_overlaps(self):
        password=secrets.token_urlsafe(24)
        app_module.provision_user(self.path,'inventory_manager',password,'manager')
        client=self.app.test_client()
        login=client.post('/api/staff/login',json={'username':'inventory_manager','password':password},headers={'Origin':'http://localhost'})
        self.assertEqual(login.status_code,200)
        csrf=client.get('/api/staff/me').get_json()['csrf']
        headers={'Origin':'http://localhost','X-CSRF-Token':csrf}
        with core.connection(self.path) as cx: self.booking(cx,'A',0,2,'MIAGUE-01')
        response=client.post('/api/staff/inventory/block',json={'checkin':self.day(1),'checkout':self.day(3),'reason':'maintenance'},headers=headers)
        self.assertEqual(response.status_code,409)
        response=client.post('/api/staff/inventory/block',json={'checkin':self.day(2),'checkout':self.day(3),'reason':'maintenance'},headers=headers)
        self.assertEqual(response.status_code,200,response.get_json())
        with core.connection(self.path) as cx: self.booking(cx,'P',3,4,'','pending')
        response=client.post('/api/staff/inventory/block',json={'checkin':self.day(3),'checkout':self.day(4),'reason':'maintenance'},headers=headers)
        self.assertEqual(response.status_code,409)

if __name__ == '__main__': unittest.main()
