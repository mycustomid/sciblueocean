"""Security and durable booking tests for the operational local service.

Uses only disposable databases and generated credentials. Never loads an actual
staff password or modifies the running service database.
"""
import importlib.util
import pathlib
import secrets
import sqlite3
import sys
import tempfile
import unittest
import time
from types import SimpleNamespace
from datetime import date, timedelta
from contextlib import closing
from unittest.mock import patch

import threading
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'operations-server'))
spec = importlib.util.spec_from_file_location('operations_app_under_test', ROOT / 'operations-server' / 'app.py')
OPS = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = OPS
spec.loader.exec_module(OPS)


class OperationsAuth(unittest.TestCase):
    def setUp(self):
        temp_root = ROOT / 'QA' / 'operations-test-tmp'
        temp_root.mkdir(parents=True, exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=temp_root)
        self.addCleanup(self.tmp.cleanup)
        self.db = pathlib.Path(self.tmp.name) / 'operations.sqlite3'
        self.key = pathlib.Path(self.tmp.name) / 'mfa.key'
        self.password = secrets.token_urlsafe(24)
        self.app = OPS.create_app(self.db, self.key)
        self.app.testing = True
        self.client = self.app.test_client()
        self.origin = {'Origin': 'http://localhost'}
        self.username = 'operator-test'
        self.provision(self.username, 'manager')

    def provision(self, username, role):
        OPS.provision_user(self.db, username, self.password, role)

    def post(self, path, body=None, csrf=None, client=None, origin=None):
        headers = dict(self.origin if origin is None else origin)
        if csrf:
            headers['X-CSRF-Token'] = csrf
        return (client or self.client).post(path, json=body or {}, headers=headers)

    def login(self, username=None, client=None):
        r = self.post('/api/staff/login', {'username': username or self.username, 'password': self.password}, client=client)
        self.assertEqual(r.status_code, 200, r.get_json())
        return r.get_json()

    def authenticate(self, username=None, client=None):
        client = client or self.client
        login = self.login(username, client)
        self.assertTrue(login['authenticated'])
        me = client.get('/api/staff/me')
        self.assertEqual(me.status_code, 200, me.get_json())
        return me.get_json()['csrf']

    def test_empty_database_and_guest_to_staff_confirmation_persists(self):
        with closing(sqlite3.connect(self.db)) as cx:
            self.assertEqual(cx.execute('SELECT count(*) FROM bookings').fetchone()[0], 0)
            self.assertEqual(cx.execute('SELECT count(*) FROM tasks').fetchone()[0], 0)
        a, b = date.today()+timedelta(days=30), date.today()+timedelta(days=32)
        guest = self.post('/api/booking/public/request', {'property':'miague','guest':'Security QA Guest','email':'qa@example.test','checkin':a.isoformat(),'checkout':b.isoformat(),'guests':2})
        self.assertEqual(guest.status_code, 201, guest.get_json())
        ref = guest.get_json()['reference']
        csrf = self.authenticate()
        snap = self.client.get('/api/staff/snapshot')
        self.assertEqual(snap.status_code, 200)
        booking = next(x for x in snap.get_json()['bookings'] if x['reference']==ref)
        self.assertEqual(booking['status'], 'pending')
        self.assertEqual(self.post('/api/staff/booking/transition', {'id':booking['id'],'action':'confirm'}).status_code, 403)
        confirmed = self.post('/api/staff/booking/transition', {'id':booking['id'],'action':'confirm'}, csrf=csrf)
        self.assertEqual(confirmed.status_code, 200, confirmed.get_json())
        with closing(sqlite3.connect(self.db)) as cx:
            self.assertEqual(cx.execute('SELECT status FROM bookings WHERE reference=?',(ref,)).fetchone()[0], 'confirmed')
            actor = cx.execute("SELECT actor FROM audit WHERE reference=? AND action='booking:confirm' ORDER BY id DESC LIMIT 1",(ref,)).fetchone()[0]
            self.assertEqual(actor, self.username)
        # A newly-created application reads the same durable records, not a fixture.
        reopened = OPS.create_app(self.db, self.key)
        with closing(sqlite3.connect(self.db)) as cx:
            self.assertEqual(cx.execute('SELECT count(*) FROM bookings WHERE reference=?',(ref,)).fetchone()[0], 1)

    def test_housekeeping_cannot_confirm_or_read_guest_identity(self):
        self.provision('cleaner-test', 'housekeeping')
        client = self.app.test_client()
        csrf = self.authenticate('cleaner-test', client)
        denied = self.post('/api/staff/booking/transition', {'id':1,'action':'confirm'}, csrf=csrf, client=client)
        self.assertEqual(denied.status_code, 403)
        snapshot = client.get('/api/staff/snapshot')
        self.assertEqual(snapshot.status_code, 200)
        self.assertEqual(snapshot.get_json()['bookings'], [])

    def test_unknown_user_and_bad_password_same_error(self):
        wrong = self.post('/api/staff/login', {'username':self.username,'password':'not-correct'})
        unknown = self.post('/api/staff/login', {'username':'missing-user','password':'not-correct'})
        self.assertEqual(wrong.status_code, unknown.status_code)
        self.assertEqual(wrong.get_json(), unknown.get_json())

    def test_sessions_survive_restart_but_disabled_account_loses_access(self):
        csrf = self.authenticate()
        cookie = self.client.get_cookie('bo_staff_session')
        self.assertIsNotNone(cookie)
        restarted = OPS.create_app(self.db, self.key)
        restarted.testing = True
        another = restarted.test_client()
        another.set_cookie('bo_staff_session', cookie.value)
        self.assertEqual(another.get('/api/staff/me').status_code, 200)
        with closing(sqlite3.connect(self.db)) as cx:
            cx.execute('UPDATE staff_users SET active=0 WHERE username=?', (self.username,))
            cx.commit()
        self.assertEqual(another.get('/api/staff/me').status_code, 401)
        self.assertEqual(self.client.get('/api/staff/snapshot').status_code, 401)

    def test_cookie_is_httponly_and_session_token_is_hashed(self):
        result = self.post('/api/staff/login', {'username':self.username,'password':self.password})
        self.assertEqual(result.status_code, 200)
        header = result.headers.get('Set-Cookie', '')
        self.assertIn('HttpOnly', header)
        self.assertIn('SameSite=Strict', header)
        self.assertIn('Path=/', header)
        raw = self.client.get_cookie('bo_staff_session').value
        with closing(sqlite3.connect(self.db)) as cx:
            row = cx.execute('SELECT token_hash FROM staff_sessions').fetchone()
            self.assertIsNotNone(row)
            self.assertNotEqual(row[0], raw)
            self.assertEqual(row[0], OPS.digest(raw))

    def test_idle_and_absolute_expiry_enforced_server_side(self):
        self.authenticate()
        with closing(sqlite3.connect(self.db)) as cx:
            cx.execute('UPDATE staff_sessions SET touched=touched-1300')
            cx.commit()
        self.assertEqual(self.client.get('/api/staff/snapshot').status_code, 401)
        login = self.login()
        with closing(sqlite3.connect(self.db)) as cx:
            cx.execute('UPDATE staff_sessions SET expires=0')
            cx.commit()
        self.assertEqual(self.client.get('/api/staff/session').status_code, 401)

    def test_dot_segment_urls_cannot_bypass_staff_page_guard(self):
        paths = (
            '/studio/assets/../bookings/',
            '/studio/assets/%2e%2e/bookings/',
            '/studio/assets/%2E%2E%2Fbookings/',
            '/studio/assets/../../studio/bookings/',
            '/studio/assets/../folios/index.html',
        )
        for path in paths:
            with self.subTest(path=path):
                response = self.client.get(path, follow_redirects=False)
                self.assertIn(response.status_code, (302, 303, 400, 403, 404))
                if response.status_code in (302, 303):
                    self.assertEqual(response.headers['Location'], '/studio/')
                self.assertNotIn(b'data-table="bookings"', response.data)

    def test_task_roles_cannot_read_financial_metrics_or_guest_data(self):
        a, b = date.today()+timedelta(days=44), date.today()+timedelta(days=46)
        guest_email = 'private-guest@example.test'
        guest_name = 'Private Guest Identity'
        guest = self.post('/api/booking/public/request', {'property':'miague','guest':guest_name,'email':guest_email,'checkin':a.isoformat(),'checkout':b.isoformat(),'guests':2})
        self.assertEqual(guest.status_code, 201)
        manager_csrf = self.authenticate()
        booking = self.client.get('/api/staff/snapshot').get_json()['bookings'][0]
        self.assertEqual(self.post('/api/staff/booking/transition', {'id':booking['id'],'action':'confirm'}, csrf=manager_csrf).status_code, 200)
        charge = self.post('/api/staff/folio/charge', {'booking_id':booking['id'],'label':'Authorized charge','amount_xaf':95000}, csrf=manager_csrf)
        self.assertEqual(charge.status_code, 200, charge.get_json())
        self.assertGreater(self.client.get('/api/staff/snapshot').get_json()['metrics']['billed'], 0)
        for role in ('housekeeping', 'maintenance'):
            self.provision('task-' + role, role)
            client = self.app.test_client()
            self.authenticate('task-' + role, client)
            response = client.get('/api/staff/snapshot')
            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertEqual(data['bookings'], [])
            self.assertEqual(data['charges'], [])
            self.assertEqual(data['payments'], [])
            for key in ('billed', 'settled', 'revenue', 'folios_open'):
                self.assertNotIn(key, data['metrics'])
            self.assertNotIn(guest_email, response.get_data(as_text=True))
            self.assertNotIn(guest_name, response.get_data(as_text=True))

    def test_direct_personal_password_login_and_demo_login_disabled(self):
        self.assertEqual(self.client.get('/api/staff/me').status_code, 401)
        login = self.login()
        self.assertTrue(login['authenticated'])
        self.assertNotIn('mfa_required', login)
        me = self.client.get('/api/staff/me').get_json()
        self.assertEqual(me['username'], self.username)
        self.assertEqual(me['role'], 'manager')
        self.assertEqual(self.client.get('/api/staff/snapshot').status_code, 200)
        self.assertNotEqual(self.post('/api/demo/login', {'user':'manager','password':'demo-only-change-me'}).status_code, 200)
        self.assertNotEqual(self.client.get('/api/demo/snapshot').status_code, 200)
        for endpoint in ('setup', 'verify'):
            self.assertEqual(self.post('/api/staff/mfa/' + endpoint, csrf=login['csrf']).status_code, 410)
        self.assertEqual(self.client.get('/studio/mfa/').status_code, 410)

    def test_ip_ban_is_permanent_across_time_and_restart_until_local_unblock(self):
        for number in range(1, 11):
            response = self.post('/api/staff/login', {'username':self.username,'password':'incorrect-password'})
            self.assertEqual(response.status_code, 401 if number < 10 else 403)
        self.assertEqual(response.get_json()['code'], 'IP_PERMANENTLY_BLOCKED')
        self.assertNotIn('Retry-After', response.headers)
        self.assertEqual(self.post('/api/staff/login', {'username':self.username,'password':self.password}).status_code, 403)
        with closing(sqlite3.connect(self.db)) as cx:
            self.assertEqual(cx.execute('SELECT count(*) FROM login_ip_bans').fetchone()[0], 1)
        future = time.time() + 366*86400
        with patch.object(OPS.time, 'time', return_value=future):
            restarted = OPS.create_app(self.db, self.key)
            restarted.testing = True
            client = restarted.test_client()
            response = self.post('/api/staff/login', {'username':self.username,'password':self.password}, client=client)
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.get_json()['code'], 'IP_PERMANENTLY_BLOCKED')
            self.assertNotIn('Retry-After', response.headers)
            # Account cooldown has elapsed, but this different actual peer is
            # not covered by the original socket IP's permanent ban.
            response = client.post('/api/staff/login', json={'username':self.username,'password':self.password}, headers=self.origin, environ_overrides={'REMOTE_ADDR':'192.0.2.90'})
            self.assertEqual(response.status_code, 200)
        self.assertEqual(self.post('/api/staff/unblock-ip', {'ip':'127.0.0.1'}).status_code, 404)
        OPS.unblock_ip(self.db, '127.0.0.1', self.username)
        self.assertTrue(self.login()['authenticated'])
        with closing(sqlite3.connect(self.db)) as cx:
            self.assertEqual(cx.execute('SELECT count(*) FROM login_ip_bans').fetchone()[0], 0)

    def test_distributed_account_cooldown_still_expires_without_ip_unban(self):
        for number in range(1, 11):
            response = self.client.post('/api/staff/login', json={'username':self.username,'password':'incorrect-password'}, headers=self.origin, environ_overrides={'REMOTE_ADDR':'192.0.2.' + str(number)})
            self.assertEqual(response.status_code, 401 if number < 10 else 429)
        self.assertIn('Retry-After', response.headers)
        response = self.client.post('/api/staff/login', json={'username':self.username,'password':self.password}, headers=self.origin, environ_overrides={'REMOTE_ADDR':'192.0.2.80'})
        self.assertEqual(response.status_code, 429)
        with closing(sqlite3.connect(self.db)) as cx:
            self.assertEqual(cx.execute('SELECT count(*) FROM login_ip_bans').fetchone()[0], 0)
            cx.execute('UPDATE login_failures SET window_start=window_start-901,blocked_until=blocked_until-901')
            cx.commit()
        self.assertTrue(self.login()['authenticated'])

    def test_ip_ban_counts_failures_across_accounts_and_ignores_forwarded_for(self):
        for number in range(10):
            response = self.client.post('/api/staff/login', json={'username':'unknown-' + str(number),'password':'incorrect-password'}, headers={**self.origin, 'X-Forwarded-For':'198.51.100.' + str(number+1)})
            self.assertEqual(response.status_code, 401 if number < 9 else 403)
        response = self.post('/api/staff/login', {'username':self.username,'password':self.password})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()['code'], 'IP_PERMANENTLY_BLOCKED')
        # Another actual peer is independent of the blocked IP when the account
        # itself has not failed; forwarded headers above do not supply the peer.
        response = self.client.post('/api/staff/login', json={'username':self.username,'password':self.password}, headers=self.origin, environ_overrides={'REMOTE_ADDR':'192.0.2.88'})
        self.assertEqual(response.status_code, 200)

    def test_successful_logins_do_not_consume_failure_budget(self):
        for _ in range(12):
            self.login()
        with closing(sqlite3.connect(self.db)) as cx:
            self.assertEqual(cx.execute('SELECT count(*) FROM login_failures').fetchone()[0], 0)
        for number in range(10):
            response = self.post('/api/staff/login', {'username':self.username,'password':'incorrect-password'})
            self.assertEqual(response.status_code, 401 if number < 9 else 403)

    def test_concurrent_failure_counting_cannot_exceed_ten_guesses(self):
        # Remove only the separate CPU concurrency guard for this unit test so
        # all requests reach the shared SQL admission/counting transaction.
        def attempt(number):
            client = self.app.test_client()
            return client.post('/api/staff/login', json={'username':'missing-' + str(number),'password':'wrong-password'}, headers=self.origin).status_code
        with patch.object(OPS, 'VERIFY_SLOTS', threading.BoundedSemaphore(16)), patch.object(OPS, 'PASSWORDS', SimpleNamespace(verify=lambda *args: False)):
            with ThreadPoolExecutor(max_workers=16) as pool:
                results = list(pool.map(attempt, range(16)))
        self.assertEqual(results.count(401), 9)
        self.assertEqual(results.count(403), 7)
        with closing(sqlite3.connect(self.db)) as cx:
            ip = cx.execute('SELECT failures FROM login_failures WHERE bucket=?', (OPS.digest('login-ip:127.0.0.1'),)).fetchone()
            self.assertEqual(ip[0], 10)

    def test_cookie_session_logout_and_csrf_origin_host_controls(self):
        csrf = self.authenticate()
        self.assertEqual(self.post('/api/staff/logout').status_code, 403)
        self.assertEqual(self.post('/api/staff/logout', csrf=csrf, origin={'Origin':'https://evil.example'}).status_code, 403)
        self.assertEqual(self.client.get('/api/staff/me', headers={'Host':'evil.example'}).status_code, 400)
        raw_cookie = self.client.get_cookie('bo_staff_session').value
        self.assertEqual(self.post('/api/staff/logout', csrf=csrf).status_code, 200)
        self.assertEqual(self.client.get('/api/staff/me').status_code, 401)
        old_client = self.app.test_client()
        old_client.set_cookie('bo_staff_session', raw_cookie)
        self.assertEqual(old_client.get('/api/staff/me').status_code, 401)

    def test_each_role_is_server_assigned_and_multi_role_account_rejected(self):
        for role in ('manager','reception','finance','housekeeping','maintenance','owner'):
            name = 'role-' + role
            self.provision(name, role)
            client = self.app.test_client()
            response = self.post('/api/staff/login', {'username':name,'password':self.password,'role':'manager','property':'ALL'}, client=client)
            self.assertEqual(response.status_code, 200)
            me = client.get('/api/staff/me').get_json()
            self.assertEqual(me['role'], role)
            self.assertEqual(me['property'], 'MIAGUE')
        with self.assertRaises(ValueError):
            self.provision('multi-role-test', 'manager,finance')

    def test_guest_request_retry_is_idempotent_and_payload_reuse_conflicts(self):
        a, b = date.today()+timedelta(days=55), date.today()+timedelta(days=57)
        payload = {'property':'miague','guest':'Retry Guest','email':'retry@example.test','checkin':a.isoformat(),'checkout':b.isoformat(),'guests':2,'request_id':secrets.token_urlsafe(24).replace('-', '_')}
        first = self.post('/api/booking/public/request', payload)
        self.assertEqual(first.status_code, 201, first.get_json())
        repeated = self.post('/api/booking/public/request', payload)
        self.assertEqual(repeated.status_code, 200, repeated.get_json())
        self.assertEqual(first.get_json()['reference'], repeated.get_json()['reference'])
        changed = self.post('/api/booking/public/request', {**payload,'guests':3})
        self.assertEqual(changed.status_code, 409)
        with closing(sqlite3.connect(self.db)) as cx:
            self.assertEqual(cx.execute('SELECT count(*) FROM bookings').fetchone()[0], 1)
            self.assertEqual(cx.execute("SELECT count(*) FROM audit WHERE action='booking:create'").fetchone()[0], 1)

    def test_slow_ip_failures_accumulate_across_windows_and_restart(self):
        base = time.time()
        for number in range(9):
            # Each wrong password is separated by more than the account window.
            # The IP budget must not replenish with this passage of time.
            with patch.object(OPS.time, 'time', return_value=base + number*901):
                response = self.post('/api/staff/login', {'username':self.username,'password':'incorrect-password'})
                self.assertEqual(response.status_code, 401)
        with closing(sqlite3.connect(self.db)) as cx:
            row = cx.execute('SELECT failures FROM login_ip_failures WHERE ip_hash=?', (OPS.digest('login-ip:127.0.0.1'),)).fetchone()
            self.assertEqual(row[0], 9)
        with patch.object(OPS.time, 'time', return_value=base + 10*901):
            restarted = OPS.create_app(self.db, self.key)
            restarted.testing = True
            client = restarted.test_client()
            response = self.post('/api/staff/login', {'username':self.username,'password':'incorrect-password'}, client=client)
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.get_json()['code'], 'IP_PERMANENTLY_BLOCKED')
        with closing(sqlite3.connect(self.db)) as cx:
            row = cx.execute('SELECT failures FROM login_ip_failures WHERE ip_hash=?', (OPS.digest('login-ip:127.0.0.1'),)).fetchone()
            self.assertEqual(row[0], 10)
        OPS.unblock_ip(self.db, '127.0.0.1', self.username)
        with closing(sqlite3.connect(self.db)) as cx:
            self.assertEqual(cx.execute('SELECT count(*) FROM login_ip_failures').fetchone()[0], 0)
            self.assertEqual(cx.execute('SELECT count(*) FROM login_ip_bans').fetchone()[0], 0)
        self.assertTrue(self.login()['authenticated'])

    def test_source_and_database_not_web_accessible(self):
        for path in ['/operations-server/app.py','/operations-server/private/operations.sqlite3','/../operations-server/app.py','/api/staff/unknown']:
            self.assertIn(self.client.get(path).status_code, (400,403,404))


if __name__ == '__main__':
    unittest.main(verbosity=2)
