"""Single-property local operations service. Never bind this service publicly."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import hashlib
import hmac
import importlib.util
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import sys
import threading
import time

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from flask import Flask, jsonify, request, redirect, send_from_directory
from prepare_ui import render_html

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'demo-server'))
spec = importlib.util.spec_from_file_location('booking_business_core', ROOT / 'demo-server/server.py')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
DEFAULT_DB = Path(os.environ.get('OPERATIONS_DB_PATH', Path(__file__).resolve().parent / 'private/operations.sqlite3'))
PASSWORDS = PasswordHasher()
VERIFY_SLOTS = threading.BoundedSemaphore(2)
COOKIE = 'bo_staff_session'
IDLE = 20 * 60
ABSOLUTE = 8 * 60 * 60
SUPPORTED_VIEWS = {'dashboard', 'bookings', 'calendar', 'arrivals', 'guests', 'housekeeping', 'folios', 'payments', 'maintenance', 'reports'}


def views_for(role):
    if role == 'owner':
        return ['dashboard', 'reports']
    return sorted(core.VIEWS[role] & SUPPORTED_VIEWS)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


@contextmanager
def db(path):
    cx = sqlite3.connect(path, timeout=10)
    cx.row_factory = sqlite3.Row
    cx.execute('PRAGMA foreign_keys=ON')
    try:
        yield cx
        cx.commit()
    except BaseException:
        cx.rollback()
        raise
    finally:
        cx.close()


def initialize(path, key_path=None):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fresh = not path.exists()
    if fresh:
        core.init_db(path)
    with db(path) as cx:
        if fresh:
            cx.execute('DELETE FROM tasks')
        if 'room_number' not in [row['name'] for row in cx.execute('PRAGMA table_info(bookings)')]:
            cx.execute("ALTER TABLE bookings ADD COLUMN room_number TEXT NOT NULL DEFAULT ''")
        cx.executescript('''
        CREATE TABLE IF NOT EXISTS staff_users (
          id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL, role TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1, epoch INTEGER NOT NULL DEFAULT 0,
          totp_secret TEXT, pending_secret TEXT, last_totp_step INTEGER NOT NULL DEFAULT -1);
        CREATE TABLE IF NOT EXISTS staff_sessions (
          token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES staff_users(id),
          epoch INTEGER NOT NULL, csrf TEXT NOT NULL, authenticated INTEGER NOT NULL DEFAULT 0,
          created REAL NOT NULL, touched REAL NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS access_limits (
          bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, reset REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS staff_security_audit (
          id INTEGER PRIMARY KEY, username TEXT NOT NULL, action TEXT NOT NULL,
          created_at TEXT NOT NULL);
        ''')
    with db(path) as cx:
        cx.execute('BEGIN IMMEDIATE')
        cx.execute('CREATE TABLE IF NOT EXISTS operations_meta (name TEXT PRIMARY KEY, value TEXT NOT NULL)')
        cx.execute('CREATE TABLE IF NOT EXISTS login_failures (bucket TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_start REAL NOT NULL, blocked_until REAL NOT NULL DEFAULT 0)')
        cx.execute('CREATE TABLE IF NOT EXISTS login_ip_bans (ip_hash TEXT PRIMARY KEY, created_at REAL NOT NULL)')
        cx.execute('CREATE TABLE IF NOT EXISTS login_ip_failures (ip_hash TEXT PRIMARY KEY, failures INTEGER NOT NULL)')
        cx.execute('CREATE TABLE IF NOT EXISTS booking_submissions (key_hash TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, booking_id INTEGER NOT NULL REFERENCES bookings(id))')
        if not cx.execute("SELECT 1 FROM operations_meta WHERE name='auth_policy_password_only_v1'").fetchone():
            cx.execute('UPDATE staff_users SET epoch=epoch+1,totp_secret=NULL,pending_secret=NULL,last_totp_step=-1')
            cx.execute('DELETE FROM staff_sessions')
            cx.execute('DELETE FROM access_limits')
            cx.execute("INSERT INTO operations_meta VALUES('auth_policy_password_only_v1','enabled')")
    return path, None


def provision(path, username, password, role):
    if not (re.fullmatch(r'[a-z0-9][a-z0-9_.-]{2,63}', username) or re.fullmatch(r'[a-z0-9.!#$%&*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}', username)) or len(username) > 254:
        raise ValueError('Use a 3–64 character username or a valid email identifier')
    if len(password) < 16 or len(password) > 256:
        raise ValueError('Password must contain 16–256 characters')
    if role not in core.ROLES:
        raise ValueError('Unknown role')
    path, _ = initialize(path)
    encoded = PASSWORDS.hash(password)
    with db(path) as cx:
        cx.execute('INSERT INTO staff_users(username,password_hash,role) VALUES(?,?,?)', (username, encoded, role))


provision_user = provision


def unblock_ip(path, address, username=None):
    """Local administrator recovery only; never exposed as an HTTP endpoint."""
    address = str(ipaddress.ip_address(address))
    path, _ = initialize(path)
    with db(path) as cx:
        cx.execute('BEGIN IMMEDIATE')
        bucket = digest('login-ip:' + address)
        cx.execute('DELETE FROM login_ip_bans WHERE ip_hash=?', (bucket,))
        cx.execute('DELETE FROM login_ip_failures WHERE ip_hash=?', (bucket,))
        cx.execute('DELETE FROM login_failures WHERE bucket=?', (bucket,))
        if username:
            cx.execute('DELETE FROM login_failures WHERE bucket=?', (digest('login-account:' + username.strip().lower()),))
        cx.execute('INSERT INTO staff_security_audit(username,action,created_at) VALUES(?,?,?)',
                   ('local-admin', 'login_ip_unblocked:' + bucket, core.utcnow()))


def create_app(database=DEFAULT_DB, key_path=None):
    path, _ = initialize(database, key_path)
    app = Flask(__name__, static_folder=None)
    app.config.update(MAX_CONTENT_LENGTH=12000, DATABASE=str(path))
    dummy_hash = PASSWORDS.hash(secrets.token_urlsafe(32))

    def audit(cx, username, action):
        cx.execute('INSERT INTO staff_security_audit(username,action,created_at) VALUES(?,?,?)', (username, action, core.utcnow()))

    def limit(buckets):
        now = time.time()
        with db(path) as cx:
            cx.execute('BEGIN IMMEDIATE')
            cx.execute('DELETE FROM access_limits WHERE reset<?', (now,))
            for name, maximum, seconds in buckets:
                key = digest(name)
                row = cx.execute('SELECT count FROM access_limits WHERE bucket=?', (key,)).fetchone()
                if row and row['count'] >= maximum:
                    return False
            for name, maximum, seconds in buckets:
                cx.execute('INSERT INTO access_limits(bucket,count,reset) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1', (digest(name), now + seconds))
        return True

    def session(full=True, touch=True):
        raw = request.cookies.get(COOKIE, '')
        if not re.fullmatch('[a-f0-9]{64}', raw):
            return None
        now = time.time()
        with db(path) as cx:
            row = cx.execute('''SELECT s.*,u.username,u.role,u.active,u.epoch user_epoch,u.totp_secret,u.pending_secret,u.last_totp_step
                FROM staff_sessions s JOIN staff_users u ON u.id=s.user_id WHERE token_hash=?''', (digest(raw),)).fetchone()
            if not row:
                return None
            s = dict(row)
            if not s['active'] or s['epoch'] != s['user_epoch'] or s['expires'] <= now or s['touched'] + IDLE <= now:
                cx.execute('DELETE FROM staff_sessions WHERE token_hash=?', (digest(raw),))
                return None
            if full and not s['authenticated']:
                return None
            if touch:
                cx.execute('UPDATE staff_sessions SET touched=? WHERE token_hash=?', (now, digest(raw)))
            return s

    def guard(action=None):
        s = session()
        if not s:
            return None, (jsonify(error='Authentication required'), 401)
        if action and s['role'] not in core.ACTION_ROLES.get(action, set()):
            return None, (jsonify(error='Access denied'), 403)
        if request.method != 'GET' and not csrf_ok(s):
            return None, (jsonify(error='CSRF token required'), 403)
        return s, None

    def csrf_ok(s):
        actual = request.headers.get('X-CSRF-Token', '')
        return hmac.compare_digest(actual, s['csrf'])

    def set_cookie(response, raw, age=ABSOLUTE):
        response.set_cookie(COOKIE, raw, max_age=age, httponly=True, secure=bool(app.config.get('SECURE_COOKIE', False)), samesite='Strict', path='/')
        return response

    def new_session(cx, user, full=True):
        raw, csrf = secrets.token_hex(32), secrets.token_hex(24)
        now = time.time()
        cx.execute('INSERT INTO staff_sessions VALUES(?,?,?,?,?,?,?,?)', (digest(raw), user['id'], user['epoch'], csrf, int(full), now, now, now + ABSOLUTE))
        return raw, csrf

    def body():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            raise ValueError('Expected a JSON object')
        return payload

    @app.before_request
    def transport():
        # Bind loopback AND validate Host to prevent DNS rebinding of local staff data.
        if not re.fullmatch(r'(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?', request.host):
            return jsonify(error='Unrecognized host'), 400
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            origin = request.headers.get('Origin')
            if origin and origin != request.host_url.rstrip('/'):
                return jsonify(error='Origin denied'), 403
            if request.headers.get('Sec-Fetch-Site') == 'cross-site':
                return jsonify(error='Cross-site request denied'), 403

    @app.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store, private'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data: https://sciblueocean.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        return response

    @app.errorhandler(ValueError)
    def invalid(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(413)
    def oversized(error):
        return jsonify(error='Request too large'), 413

    def login_blocked(seconds=900):
        response = jsonify(error='Too many failed attempts. Try again later.')
        response.status_code = 429
        response.headers['Retry-After'] = str(max(1, int(seconds)))
        return response

    def ip_banned():
        return jsonify(error='This IP is permanently blocked. Contact your administrator.',
                       code='IP_PERMANENTLY_BLOCKED'), 403

    @app.post('/api/staff/login')
    def login():
        payload = body()
        username = str(payload.get('username', '')).strip().lower()[:254]
        password = str(payload.get('password', ''))
        # Never use X-Forwarded-For: the loopback peer is the only trusted source.
        ip = request.remote_addr or 'unknown'
        if not VERIFY_SLOTS.acquire(blocking=False):
            return login_blocked(1)
        try:
            with db(path) as cx:
                # Serialize admission, password verification and failure accounting
                # across threads/processes so guesses cannot outrun the threshold.
                cx.execute('BEGIN IMMEDIATE')
                now = time.time()
                cx.execute('DELETE FROM login_failures WHERE window_start<? AND blocked_until<=?', (now - 900, now))
                buckets = [digest('login-account:' + username), digest('login-ip:' + ip)]
                if cx.execute('SELECT 1 FROM login_ip_bans WHERE ip_hash=?', (buckets[1],)).fetchone():
                    return ip_banned()
                for bucket in buckets:
                    row = cx.execute('SELECT * FROM login_failures WHERE bucket=?', (bucket,)).fetchone()
                    if row and row['blocked_until'] > now:
                        return login_blocked(row['blocked_until'] - now + 1)
                user = cx.execute('SELECT * FROM staff_users WHERE username=? AND active=1', (username,)).fetchone()
                try:
                    valid = len(password) <= 256 and PASSWORDS.verify(user['password_hash'] if user else dummy_hash, password)
                except (VerificationError, InvalidHashError):
                    valid = False
                if not valid or not user:
                    blocked = False
                    # IP failures accumulate until an administrator clears them:
                    # slow guesses and server restarts cannot reset this budget.
                    cx.execute('INSERT INTO login_ip_failures VALUES(?,1) ON CONFLICT(ip_hash) DO UPDATE SET failures=failures+1', (buckets[1],))
                    ip_failures = cx.execute('SELECT failures FROM login_ip_failures WHERE ip_hash=?', (buckets[1],)).fetchone()['failures']
                    for bucket in buckets:
                        row = cx.execute('SELECT * FROM login_failures WHERE bucket=?', (bucket,)).fetchone()
                        count = row['failures'] + 1 if row and row['window_start'] > now - 900 else 1
                        started = row['window_start'] if row and row['window_start'] > now - 900 else now
                        until = now + 900 if count >= 10 else 0
                        blocked = blocked or bool(until)
                        cx.execute('INSERT INTO login_failures VALUES(?,?,?,?) ON CONFLICT(bucket) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start,blocked_until=excluded.blocked_until', (bucket, count, started, until))
                    if ip_failures >= 10:
                        cx.execute('INSERT OR IGNORE INTO login_ip_bans(ip_hash,created_at) VALUES(?,?)', (buckets[1], now))
                    audit(cx, username, 'login_failed')
                    if cx.execute('SELECT 1 FROM login_ip_bans WHERE ip_hash=?', (buckets[1],)).fetchone():
                        audit(cx, username, 'login_ip_permanently_banned')
                        return ip_banned()
                    return login_blocked() if blocked else (jsonify(error='Invalid credentials'), 401)
                # Query current active state under the same write lock which also
                # protects session issuance from concurrent account disable/reset.
                user = cx.execute('SELECT * FROM staff_users WHERE id=? AND active=1', (user['id'],)).fetchone()
                if not user:
                    return jsonify(error='Invalid credentials'), 401
                old = request.cookies.get(COOKIE, '')
                cx.execute('DELETE FROM staff_sessions WHERE token_hash=? OR expires<?', (digest(old), now))
                raw, csrf = new_session(cx, user, full=True)
                audit(cx, username, 'login_password_verified')
        finally:
            VERIFY_SLOTS.release()
        response = jsonify(ok=True, authenticated=True, csrf=csrf, username=username, role=user['role'], property='MIAGUE', views=views_for(user['role']))
        return set_cookie(response, raw)

    @app.get('/api/staff/session')
    def session_status():
        s = session()
        if not s:
            return jsonify(error='Authentication required'), 401
        return jsonify(username=s['username'], authenticated=True, role=s['role'], property='MIAGUE', csrf=s['csrf'])

    @app.route('/api/staff/mfa/<path:unused>', methods=['GET', 'POST'])
    def retired_mfa(unused):
        return jsonify(error='Endpoint retired. Sign in with your personal username and password.'), 410

    @app.get('/api/staff/me')
    def me():
        s, error = guard()
        if error:
            return error
        return jsonify(username=s['username'], role=s['role'], property='MIAGUE', views=views_for(s['role']), csrf=s['csrf'], mode='OPERATIONS_LOCAL')

    @app.post('/api/staff/logout')
    def logout():
        s = session(full=False)
        if not s:
            return jsonify(error='Authentication required'), 401
        if not csrf_ok(s):
            return jsonify(error='CSRF token required'), 403
        with db(path) as cx:
            cx.execute('DELETE FROM staff_sessions WHERE token_hash=?', (s['token_hash'],))
            audit(cx, s['username'], 'logout')
        response = jsonify(ok=True)
        response.delete_cookie(COOKIE, path='/')
        return response

    @app.get('/api/staff/snapshot')
    def snapshot():
        s, error = guard()
        if error:
            return error
        with db(path) as cx:
            out = core.snapshot(cx, s['role'])
        if s['role'] not in ('manager', 'finance', 'owner'):
            for key in ('billed', 'settled', 'revenue', 'folios_open'):
                out['metrics'].pop(key, None)
        out.pop('demo', None)
        out.update(mode='OPERATIONS_LOCAL', simulated_settlement_enabled=False, payment='DISABLED', upstream_pms='LOCAL_DATABASE')
        return jsonify(out)

    @app.get('/api/staff/analytics/summary')
    def analytics():
        s, error = guard()
        if error:
            return error
        if s['role'] not in ('manager', 'owner'):
            return jsonify(error='Access denied'), 403
        with db(path) as cx:
            counts = core.rows(cx, 'SELECT status event,COUNT(*) count FROM bookings GROUP BY status')
            daily = core.rows(cx, 'SELECT substr(created_at,1,10) day,status event,COUNT(*) count FROM bookings GROUP BY day,status ORDER BY day DESC LIMIT 120')
        return jsonify(counts=counts, daily=daily, identity_tracking=False, mode='OPERATIONS_LOCAL')

    @app.post('/api/staff/<path:route>')
    def staff_write(route):
        payload = body()
        actions = {'booking/create':'booking:create', 'booking/transition':'booking:' + str(payload.get('action', '')), 'task/create':'task:create', 'task/update':'task:update', 'maintenance/create':'maintenance:create', 'maintenance/update':'maintenance:update', 'folio/charge':'folio:charge', 'pricing/rate':'pricing:write', 'inventory/block':'inventory:block'}
        action = actions.get(route)
        if not action:
            return jsonify(error='Endpoint unavailable'), 404
        s, error = guard(action)
        if error:
            return error
        try:
            with db(path) as cx:
                cx.execute('BEGIN IMMEDIATE')
                if route == 'booking/create':
                    record = core.create_booking(cx, payload, s['username'])
                elif route == 'booking/transition':
                    booking_id = int(payload['id'])
                    if payload.get('action') == 'confirm':
                        room_number = str(payload.get('room_number', ''))
                        if not re.fullmatch(r'MIAGUE-(?:0[1-9]|1[0-9]|2[0-5])', room_number):
                            raise ValueError('Choose an available Miague room before confirming')
                        booking = core.one(cx, "SELECT * FROM bookings WHERE id=? AND property='MIAGUE'", (booking_id,))
                        if not booking:
                            raise LookupError('Reservation not found')
                        if core.room_conflict(cx, room_number, booking['checkin'], booking['checkout'], booking_id):
                            raise ValueError('That room is already assigned for overlapping dates')
                        cx.execute("UPDATE bookings SET room_number=? WHERE id=?", (room_number, booking_id))
                    record = core.transition(cx, booking_id, payload['action'], s['username'])
                elif route in ('task/create', 'maintenance/create'):
                    title, room = core.clean(payload.get('title'), 120), core.clean(payload.get('room'), 32)
                    if not title or not room:
                        raise ValueError('Room and title required')
                    if route == 'task/create':
                        cur = cx.execute("INSERT INTO tasks(property,room,title,created_at) VALUES('MIAGUE',?,?,?)", (room, title, core.utcnow()))
                        query = 'SELECT * FROM tasks WHERE id=?'
                    else:
                        priority = payload.get('priority', 'normal')
                        if priority not in ('low', 'normal', 'urgent'):
                            raise ValueError('Invalid priority')
                        cur = cx.execute("INSERT INTO maintenance(property,room,title,priority,created_at) VALUES('MIAGUE',?,?,?,?)", (room, title, priority, core.utcnow()))
                        query = 'SELECT * FROM maintenance WHERE id=?'
                    record = core.one(cx, query, (cur.lastrowid,))
                elif route in ('task/update', 'maintenance/update'):
                    table = 'tasks' if route == 'task/update' else 'maintenance'
                    valid = ('open', 'in_progress', 'done') if table == 'tasks' else ('open', 'in_progress', 'resolved')
                    state = payload.get('status')
                    if state not in valid:
                        raise ValueError('Invalid status')
                    query = "UPDATE tasks SET status=? WHERE id=? AND property='MIAGUE'" if table == 'tasks' else "UPDATE maintenance SET status=? WHERE id=? AND property='MIAGUE'"
                    cur = cx.execute(query, (state, int(payload['id'])))
                    if not cur.rowcount:
                        raise LookupError('Record not found')
                    query = 'SELECT * FROM tasks WHERE id=?' if table == 'tasks' else 'SELECT * FROM maintenance WHERE id=?'
                    record = core.one(cx, query, (int(payload['id']),))
                elif route == 'folio/charge':
                    amount, bid, label = int(payload['amount_xaf']), int(payload['booking_id']), core.clean(payload.get('label'), 110)
                    if not 0 < amount <= 5000000 or not label:
                        raise ValueError('Valid amount and label required')
                    if not core.one(cx, "SELECT id FROM bookings WHERE id=? AND property='MIAGUE' AND status IN ('confirmed','checked_in','checked_out')", (bid,)):
                        raise LookupError('Eligible booking not found')
                    cur = cx.execute('INSERT INTO charges(booking_id,label,amount_xaf,created_at) VALUES(?,?,?,?)', (bid, label, amount, core.utcnow()))
                    record = core.one(cx, 'SELECT * FROM charges WHERE id=?', (cur.lastrowid,))
                elif route == 'pricing/rate':
                    day, rate, reason = payload['day'], int(payload['rate_xaf']), core.clean(payload.get('reason'), 120)
                    core.date.fromisoformat(day)
                    if not 1000 <= rate <= 10000000 or len(reason) < 4:
                        raise ValueError('Valid rate and reason required')
                    cx.execute('INSERT INTO rate_overrides VALUES(?,?,?,?) ON CONFLICT(day) DO UPDATE SET rate_xaf=excluded.rate_xaf,reason=excluded.reason,updated_at=excluded.updated_at', (day, rate, reason, core.utcnow()))
                    record = {'id':day, 'rate_xaf':rate}
                else:
                    a, b, reason = payload['checkin'], payload['checkout'], core.clean(payload.get('reason'), 120)
                    core.nights(a, b)
                    if len(reason) < 4 or core.pricing_occupied(cx, a, b):
                        raise ValueError('Valid reason and unoccupied dates required')
                    cur = cx.execute('INSERT INTO inventory_blocks(from_date,to_date,reason,created_at) VALUES(?,?,?,?)', (a, b, reason, core.utcnow()))
                    record = {'id':cur.lastrowid}
                if route not in ('booking/create', 'booking/transition'):
                    cx.execute('INSERT INTO audit(actor,action,entity,reference,created_at) VALUES(?,?,?,?,?)', (s['username'], action, route, str(record['id']), core.utcnow()))
            return jsonify(ok=True, record=record, mode='OPERATIONS_LOCAL')
        except LookupError as exc:
            return jsonify(error=str(exc)), 404
        except (KeyError, TypeError, ValueError) as exc:
            return jsonify(error=str(exc)), 409

    @app.get('/api/booking/health')
    def health():
        return jsonify(ok=True, mode='OPERATIONS_LOCAL', payment='DISABLED', property='MIAGUE')

    def lookup_receipt(params):
        if not limit([('lookup:' + str(request.remote_addr), 10, 300)]):
            return jsonify(error='Too many requests'), 429
        ref, email = core.clean(params.get('reference'), 24), core.clean(params.get('email'), 160).lower()
        with db(path) as cx:
            record = core.one(cx, 'SELECT reference,status,checkin,checkout,guests,estimate_xaf FROM bookings WHERE reference=? AND email=?', (ref, email))
        if not record:
            return jsonify(error='No matching request'), 404
        record['payment'] = {'state':'not_initiated'}
        return jsonify(booking=record)

    @app.post('/api/booking/public/lookup')
    def public_lookup():
        return lookup_receipt(body())

    @app.get('/api/booking/public/<name>')
    def public_read(name):
        if not limit([('public-read:' + str(request.remote_addr), 120, 60)]):
            return jsonify(error='Too many requests'), 429
        if name in ('quote', 'availability'):
            with db(path) as cx:
                quote = core.price_quote(cx, request.args.get('checkin'), request.args.get('checkout'), request.args.get('guests', 1), request.args.get('property', 'miague'))
            quote.update(quote_status='INDICATIVE_AWAITING_STAFF', inventory_source='OPERATIONS_LOCAL_SQLITE')
            if name == 'availability':
                return jsonify(property='miague', available=quote['available'], available_rooms=quote['available_rooms'], room_count=quote['room_count'], nights=quote['nights'], total_indicative_xaf=quote['total_estimate_xaf'], currency='XAF', not_a_guaranteed_booking=True, breakdown=quote)
            return jsonify(quote)
        if name == 'lookup':
            return lookup_receipt(request.args)
        return jsonify(error='Endpoint unavailable'), 404

    @app.post('/api/booking/public/<name>')
    def public_write(name):
        if not limit([('public-write:' + str(request.remote_addr), 12, 300)]):
            return jsonify(error='Too many requests'), 429
        if name not in ('request', 'interest', 'contact'):
            return jsonify(error='Payment and external delivery are not configured'), 503
        payload = body()
        if core.clean(payload.get('website')):
            return jsonify(status='received'), 202
        with db(path) as cx:
            cx.execute('BEGIN IMMEDIATE')
            if name == 'request':
                if not re.fullmatch(r'\+?[0-9][0-9 ()-]{6,30}', core.clean(payload.get('phone'), 32)):
                    raise ValueError('A valid phone number is required')
                key = request.headers.get('Idempotency-Key') or payload.get('request_id')
                fingerprint = None
                if key:
                    if not isinstance(key, str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{16,128}', key):
                        raise ValueError('A valid request identifier is required')
                    fingerprint = digest(json.dumps({k:v for k,v in payload.items() if k != 'request_id'}, sort_keys=True, separators=(',', ':'), ensure_ascii=False))
                    previous = cx.execute('SELECT * FROM booking_submissions WHERE key_hash=?', (digest(key),)).fetchone()
                    if previous:
                        if not hmac.compare_digest(previous['payload_hash'], fingerprint):
                            return jsonify(error='Request identifier already used for different booking details'), 409
                        record = core.one(cx, 'SELECT reference,status,estimate_xaf,checkin,checkout,nights FROM bookings WHERE id=?', (previous['booking_id'],))
                        return jsonify(**record, mode='OPERATIONS_LOCAL', repeated=True), 200
                record = core.create_booking(cx, payload, 'guest')
                if key:
                    cx.execute('INSERT INTO booking_submissions VALUES(?,?,?)', (digest(key), fingerprint, record['id']))
                return jsonify(reference=record['reference'], status='pending', estimate_xaf=record['estimate_xaf'], checkin=record['checkin'], checkout=record['checkout'], nights=record['nights'], mode='OPERATIONS_LOCAL'), 201
            guest, email = core.clean(payload.get('guest'), 100), core.clean(payload.get('email'), 160).lower()
            if len(guest) < 2 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
                raise ValueError('Valid guest name and email required')
            ref = ('INT-' if name == 'interest' else 'MSG-') + secrets.token_hex(8).upper()
            if name == 'interest':
                prop = payload.get('property')
                if prop not in ('ebene', 'amara'):
                    raise ValueError('Only future residences accept interest')
                movein = core.clean(payload.get('movein'), 10)
                if movein:
                    core.date.fromisoformat(movein)
                cx.execute('INSERT INTO interests(reference,property,guest,email,movein,message,created_at) VALUES(?,?,?,?,?,?,?)', (ref, prop, guest, email, movein, core.clean(payload.get('message'), 1500), core.utcnow()))
            else:
                message = core.clean(payload.get('message'), 1500)
                if len(message) < 6:
                    raise ValueError('Message too short')
                cx.execute('INSERT INTO enquiries(reference,guest,email,reason,message,created_at) VALUES(?,?,?,?,?,?)', (ref, guest, email, core.clean(payload.get('reason'), 80), message, core.utcnow()))
        return jsonify(reference=ref, status='received', mode='OPERATIONS_LOCAL'), 201

    @app.get('/')
    def home():
        return redirect('/experience/')

    @app.route('/<path:asset>', methods=['GET', 'HEAD'])
    def static_files(asset):
        # Canonicalize before authorization: /studio/assets/../bookings/ is
        # a bookings page, never an asset merely because its raw prefix says so.
        candidate = (ROOT / 'public' / asset).resolve()
        try:
            asset = candidate.relative_to((ROOT / 'public').resolve()).as_posix()
        except ValueError:
            return jsonify(error='Not found'), 404
        policy_asset = asset.lower()
        if policy_asset.rstrip('/') in ('studio/mfa', 'studio/mfa/index.html'):
            return jsonify(error='Authenticator flow retired. Use /studio/.'), 410
        if policy_asset.startswith('api/'):
            return jsonify(error='Unknown API endpoint'), 404
        if policy_asset.startswith('studio/') and policy_asset not in ('studio/', 'studio/index.html', 'studio/mfa', 'studio/mfa/', 'studio/mfa/index.html') and not policy_asset.startswith('studio/assets/'):
            s = session()
            if not s:
                return redirect('/studio/')
            page = policy_asset.split('/')[1]
            if page != 'pricing' and page not in views_for(s['role']):
                return jsonify(error='Access denied'), 403
            if page == 'pricing' and s['role'] != 'manager':
                return jsonify(error='Access denied'), 403
        if policy_asset.rstrip('/') in ('studio', 'studio/mfa') or policy_asset in ('studio/index.html', 'studio/mfa/index.html'):
            return app.response_class(render_html('', policy_asset), mimetype='text/html')
        if candidate.is_dir():
            asset = asset.rstrip('/') + '/index.html'
            candidate = candidate / 'index.html'
        if candidate.is_file() and candidate.suffix == '.html':
            return app.response_class(render_html(candidate.read_text(encoding='utf-8'), asset), mimetype='text/html')
        return send_from_directory(ROOT / 'public', asset)

    return app


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, default=DEFAULT_DB)
    sub = parser.add_subparsers(dest='command', required=True)
    server = sub.add_parser('serve')
    server.add_argument('--port', type=int, default=8766)
    server.add_argument('--host', default='127.0.0.1')
    create = sub.add_parser('create-user')
    create.add_argument('--username', required=True)
    create.add_argument('--role', choices=sorted(core.ROLES), default='manager')
    disable = sub.add_parser('disable-user')
    disable.add_argument('--username', required=True)
    revoke = sub.add_parser('revoke-sessions')
    revoke.add_argument('--username', required=True)
    reset = sub.add_parser('reset-password')
    reset.add_argument('--username', required=True)
    unblock = sub.add_parser('unblock-ip')
    unblock.add_argument('--ip', required=True)
    unblock.add_argument('--username', help='Also clear the targeted account cooldown, if needed')
    args = parser.parse_args()
    if args.command == 'create-user':
        import getpass
        password = getpass.getpass('New staff password: ') if sys.stdin.isatty() else sys.stdin.readline().rstrip('\r\n')
        provision(args.db, args.username.strip().lower(), password, args.role)
        print('Staff account created. Sign in with username and password. Password not logged.')
    elif args.command == 'unblock-ip':
        unblock_ip(args.db, args.ip, args.username)
        print('IP ban removed by local administrator. No password changed.')
    elif args.command in ('disable-user', 'revoke-sessions', 'reset-password'):
        path, _ = initialize(args.db)
        encoded = None
        if args.command == 'reset-password':
            import getpass
            password = getpass.getpass('New staff password: ') if sys.stdin.isatty() else sys.stdin.readline().rstrip('\r\n')
            if not 16 <= len(password) <= 256:
                raise SystemExit('Password must contain 16–256 characters')
            encoded = PASSWORDS.hash(password)
        with db(path) as cx:
            if args.command == 'disable-user':
                cur = cx.execute('UPDATE staff_users SET active=0,epoch=epoch+1 WHERE username=?', (args.username,))
            elif args.command == 'reset-password':
                cur = cx.execute('UPDATE staff_users SET password_hash=?,epoch=epoch+1 WHERE username=?', (encoded, args.username))
            else:
                cur = cx.execute('UPDATE staff_users SET epoch=epoch+1 WHERE username=?', (args.username,))
            if not cur.rowcount:
                raise SystemExit('Staff account not found')
        print('Staff access updated; existing sessions revoked.')
    else:
        allow_docker = os.environ.get('ALLOW_DOCKER_INGRESS') == '1'
        if not allow_docker and args.host not in ('127.0.0.1', '::1', 'localhost'):
            raise SystemExit('Public binding refused. HTTPS deployment and ingress review required.')
        from waitress import serve
        app = create_app(args.db)
        print(f'SCI Blue Ocean local operations: http://{args.host}:{args.port}/studio/', flush=True)
        serve(app, host=args.host, port=args.port, threads=6, connection_limit=40, channel_timeout=30)


if __name__ == '__main__':
    main()
