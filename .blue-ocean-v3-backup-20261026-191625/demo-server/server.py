#!/usr/bin/env python3
"""LOOPBACK-ONLY Blue Ocean demo REST service.
Not for production: fixed demo credentials, synthetic data, no external payment gateway.
CPython 3.10+, sqlite3, stdlib only. Single-property availability & immutable audit trail.
"""
import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import sys
import threading
from datetime import date, datetime, timedelta, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

HERE = Path(__file__).resolve().parent
STATIC = (HERE.parent / 'public') if (HERE.parent / 'public' / 'experience').exists() else (HERE.parent / 'patch' / 'public')
DB_DEFAULT = HERE / 'demo.sqlite3'
DEMO_PASSWORD = os.environ.get('BLUE_OCEAN_DEMO_PASSWORD', 'demo-only-change-me')
ROLES = {
 'reception': ('reception', 'MIAGUE'), 'manager': ('manager', 'MIAGUE'),
 'housekeeping': ('housekeeping','MIAGUE'), 'finance': ('finance','MIAGUE'),
 'maintenance': ('maintenance','MIAGUE'), 'owner': ('owner','ALL')
}
VIEWS = {
 'reception': {'dashboard','bookings','calendar','arrivals','guests','housekeeping','maintenance'},
 'manager': {'dashboard','bookings','calendar','arrivals','guests','housekeeping','folios','payments','maintenance','reports','portfolio'},
 'housekeeping': {'dashboard','housekeeping'},
 'finance': {'dashboard','folios','payments','reports','bookings'},
 'maintenance': {'dashboard','maintenance'},
 'owner': {'dashboard','portfolio','reports','companies','people','settings'}
}
ACTION_ROLES = {
 'booking:create': {'reception','manager'},
 'booking:confirm': {'reception','manager'}, 'booking:cancel': {'reception','manager'},
 'booking:checkin': {'reception','manager'}, 'booking:checkout': {'reception','manager'},
 'task:create': {'housekeeping','manager'}, 'task:update': {'housekeeping','manager'},
 'maintenance:create': {'maintenance','manager','reception'}, 'maintenance:update': {'maintenance','manager'},
 'folio:charge': {'finance','manager'},
 'payment:test-settle': {'finance','manager'}
}
SESSIONS = {} # memory-only, expiry on each read; invalidated on restart
SESS_LOCK = threading.RLock()


def iso_today(): return date.today().isoformat()
def utcnow(): return datetime.now(timezone.utc).isoformat(timespec='seconds')
def json_body(handler):
 length = int(handler.headers.get('content-length', '0'))
 if length > 12000: raise ValueError('Payload too large')
 return json.loads(handler.rfile.read(length) or b'{}')
def clean(value, maxlen=120): return str(value or '').strip()[:maxlen]
def nights(a,b):
 try: aa=date.fromisoformat(a);bb=date.fromisoformat(b)
 except (ValueError,TypeError): raise ValueError('Dates must be YYYY-MM-DD')
 if aa < date.today(): raise ValueError('Arrival date must be today or later')
 n=(bb-aa).days
 if not 1<=n<=180: raise ValueError('Length of stay must be 1–180 nights')
 return n

class ClosingConnection(sqlite3.Connection):
 def __exit__(self,*args):
  try: return super().__exit__(*args)
  finally: self.close()

def init_db(path):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
 with sqlite3.connect(path, factory=ClosingConnection) as cx:
  cx.execute('PRAGMA journal_mode=WAL')
  cx.executescript('''
   CREATE TABLE IF NOT EXISTS bookings (
     id INTEGER PRIMARY KEY AUTOINCREMENT, reference TEXT UNIQUE NOT NULL,
     property TEXT NOT NULL DEFAULT 'MIAGUE', guest TEXT NOT NULL,
     email TEXT NOT NULL, phone TEXT DEFAULT '', checkin TEXT NOT NULL,
     checkout TEXT NOT NULL, guests INTEGER NOT NULL, nights INTEGER NOT NULL,
     estimate_xaf INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
     created_at TEXT NOT NULL, updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT,
     property TEXT NOT NULL DEFAULT 'MIAGUE', room TEXT NOT NULL, title TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'open', assignee TEXT DEFAULT '',created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS maintenance (id INTEGER PRIMARY KEY AUTOINCREMENT,
     property TEXT NOT NULL DEFAULT 'MIAGUE', room TEXT NOT NULL, title TEXT NOT NULL,
     priority TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS charges (id INTEGER PRIMARY KEY AUTOINCREMENT,
     booking_id INTEGER NOT NULL REFERENCES bookings(id), label TEXT NOT NULL,
     amount_xaf INTEGER NOT NULL CHECK(amount_xaf>0), created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS payment_intents (id INTEGER PRIMARY KEY AUTOINCREMENT,
     booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
     provider TEXT NOT NULL DEFAULT 'DEMO_ONLY', external_reference TEXT NOT NULL UNIQUE,
     amount_xaf INTEGER NOT NULL CHECK(amount_xaf>0), currency TEXT NOT NULL DEFAULT 'XAF',
     state TEXT NOT NULL DEFAULT 'awaiting_payment',
     provider_transaction_id TEXT DEFAULT '', updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT,
     actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL,
     reference TEXT NOT NULL, created_at TEXT NOT NULL);
  ''')
  cx.execute("INSERT OR IGNORE INTO tasks(id,property,room,title,status,assignee,created_at) VALUES (1,'MIAGUE','Studio 01','Contrôle avant arrivée','open','',?)",(utcnow(),))
 return path

def connection(path):
 cx=sqlite3.connect(path, timeout=6, factory=ClosingConnection)
 cx.row_factory=sqlite3.Row
 cx.execute('PRAGMA foreign_keys=ON')
 return cx

def rows(cx,q,p=()):return [dict(r) for r in cx.execute(q,p).fetchall()]
def one(cx,q,p=()):
 r=cx.execute(q,p).fetchone();return dict(r) if r else None

def conflict(cx,checkin,checkout,exclude=None):
 q="SELECT id FROM bookings WHERE property='MIAGUE' AND status IN ('confirmed','checked_in') AND checkin<? AND checkout>?"
 params=[checkout,checkin]
 if exclude is not None:q+=' AND id<>?';params.append(exclude)
 return cx.execute(q,params).fetchone() is not None

def create_booking(cx, payload, actor='guest'):
 if payload.get('property','miague').lower() not in ('miague','miague-studio'):
  raise ValueError('Only Résidence Miague studio is currently open for requests')
 a=clean(payload.get('checkin'),10);b=clean(payload.get('checkout'),10);n=nights(a,b)
 guest=clean(payload.get('guest'),100);email=clean(payload.get('email'),160).lower()
 if not 2<=len(guest)<=100 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):raise ValueError('Valid guest name and email are required')
 guests=int(payload.get('guests',1))
 if not 1<=guests<=6:raise ValueError('Guests must be between 1 and 6')
 phone=clean(payload.get('phone'),32);ref='BO-'+secrets.token_hex(4).upper();now=utcnow()
 cx.execute('''INSERT INTO bookings(reference,guest,email,phone,checkin,checkout,guests,nights,estimate_xaf,created_at,updated_at)
 VALUES(?,?,?,?,?,?,?,?,?,?,?)''',(ref,guest,email,phone,a,b,guests,n,n*40000,now,now))
 cx.execute('INSERT INTO audit(actor,action,entity,reference,created_at) VALUES (?,?,?,?,?)',(actor,'booking:create','booking',ref,now))
 return one(cx,'SELECT * FROM bookings WHERE reference=?',(ref,))

def transition(cx,id,action,actor):
 item=one(cx,'SELECT * FROM bookings WHERE id=? AND property=?',(id,'MIAGUE'))
 if not item:raise LookupError('Reservation not found')
 table={'confirm':('pending','confirmed'),'cancel':('pending','cancelled'),'checkin':('confirmed','checked_in'),'checkout':('checked_in','checked_out')}
 if action not in table:raise ValueError('Unknown transition')
 before,after=table[action]
 if item['status']!=before:raise ValueError(f'Cannot {action} from {item["status"]}')
 if action=='confirm' and conflict(cx,item['checkin'],item['checkout'],id):raise ValueError('Confirmed stay overlaps an existing booking')
 cx.execute('UPDATE bookings SET status=?,updated_at=? WHERE id=?',(after,utcnow(),id))
 cx.execute('INSERT INTO audit(actor,action,entity,reference,created_at) VALUES (?,?,?,?,?)',(actor,'booking:'+action,'booking',item['reference'],utcnow()))
 return one(cx,'SELECT * FROM bookings WHERE id=?',(id,))

def snapshot(cx,role):
 bookings=rows(cx,"SELECT id,reference,property,guest,email,checkin,checkout,guests,nights,estimate_xaf,status,created_at FROM bookings WHERE property='MIAGUE' ORDER BY id DESC LIMIT 200")
 tasks=rows(cx,"SELECT * FROM tasks WHERE property='MIAGUE' ORDER BY id DESC LIMIT 200")
 m=rows(cx,"SELECT * FROM maintenance WHERE property='MIAGUE' ORDER BY id DESC LIMIT 200")
 charges=rows(cx,"SELECT c.*,b.reference,b.status booking_status FROM charges c JOIN bookings b ON b.id=c.booking_id WHERE b.property='MIAGUE' ORDER BY c.id DESC")
 payments=rows(cx,"SELECT p.external_reference,p.amount_xaf,p.currency,p.state,p.provider_transaction_id,b.reference booking_reference FROM payment_intents p JOIN bookings b ON b.id=p.booking_id WHERE b.property='MIAGUE' ORDER BY p.id DESC") if role in ('manager','finance') else []
 today=iso_today()
 metrics={
 'arrivals':sum(x['status']=='confirmed' and x['checkin']==today for x in bookings),
 'departures':sum(x['status']=='checked_in' and x['checkout']==today for x in bookings),
 'pending':sum(x['status']=='pending' for x in bookings),
 'units':1,'tasks_open':sum(x['status']=='open' for x in tasks),
 'tasks_progress':sum(x['status']=='in_progress' for x in tasks),
 'tasks_done':sum(x['status']=='done' for x in tasks),
 'folios_open':sum(x['status'] in ('checked_in','confirmed') for x in bookings),
 'billed':sum(x['amount_xaf'] for x in charges),
 'settled':sum(x['amount_xaf'] for x in rows(cx, "SELECT amount_xaf FROM payment_intents WHERE state='paid'")),
 'revenue':0,
 'total_requests':len(bookings),'confirmed':sum(x['status'] in ('confirmed','checked_in','checked_out') for x in bookings),
 'cancelled':sum(x['status']=='cancelled' for x in bookings)
 }
 # Data-minimization for roles without finance and guest details.
 if role=='housekeeping':bookings=[];charges=[];m=[]
 if role=='maintenance':bookings=[];charges=[];tasks=[]
 if role=='owner':bookings=[];charges=[];tasks=[];m=[]
 if role=='finance':
  tasks=[];m=[]
  bookings=[{k:v for k,v in b.items() if k!='phone'} for b in bookings]
 if role=='reception':charges=[]
 return dict(bookings=bookings,tasks=tasks,maintenance=m,charges=charges,payments=payments,metrics=metrics,
  simulated_settlement_enabled=os.environ.get('BLUE_OCEAN_ENABLE_SIMULATED_SETTLEMENT')=='YES',
  demo=True,payment='DISABLED',upstream_pms='NOT_CONNECTED',currency='XAF')

class Handler(SimpleHTTPRequestHandler):
 server_version='BlueOceanDemo/0.3'
 def __init__(self,*a,**kw):super().__init__(*a,directory=str(STATIC),**kw)
 def log_message(self,fmt,*args):
  if os.environ.get('BLUE_OCEAN_HTTP_LOG')=='1':super().log_message(fmt,*args)
 def end_headers(self):
  self.send_header('X-Content-Type-Options','nosniff')
  self.send_header('Referrer-Policy','strict-origin-when-cross-origin')
  self.send_header('X-Frame-Options','DENY')
  self.send_header('Content-Security-Policy',"default-src 'self' https://sciblueocean.com; img-src 'self' https://sciblueocean.com data:; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'")
  super().end_headers()
 def send_json(self,status,data,headers=None):
  body=json.dumps(data,ensure_ascii=False,default=str).encode()
  self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)))
  for k,v in (headers or {}).items():self.send_header(k,v)
  self.end_headers();self.wfile.write(body)
 def user(self):
  cookie=self.headers.get('Cookie','')
  match=re.search(r'(?:^|;\s*)bo_demo_session=([a-f0-9]{64})(?:;|$)',cookie)
  if not match:return None
  token=match.group(1)
  with SESS_LOCK:
   session=SESSIONS.get(token)
   if not session:return None
   if session['expires']<datetime.now(timezone.utc):
    SESSIONS.pop(token,None);return None
   return dict(session)
 def guard(self,action=None):
  s=self.user()
  if not s:self.send_json(401,{'error':'Demo session expired or missing'});return None
  if action and s['role'] not in ACTION_ROLES.get(action,set()):
   self.send_json(403,{'error':'Forbidden for this role'});return None
  if self.command=='POST' and self.headers.get('X-Demo-CSRF','')!=s['csrf']:
   self.send_json(403,{'error':'CSRF token required'});return None
  return s
 def route(self):return urlsplit(self.path).path
 def do_GET(self):
  p=self.route()
  if p=='/':self.send_response(302);self.send_header('Location','/experience/');self.end_headers();return
  if p=='/api/demo/health':return self.send_json(200,{'ok':True,'mode':'DEMO_LOCAL_ONLY','payment':'DISABLED'})
  if p=='/api/demo/public/availability':
   q=parse_qs(urlsplit(self.path).query);a=q.get('checkin',[''])[0];b=q.get('checkout',[''])[0]
   try:n=nights(a,b)
   except ValueError as e:return self.send_json(400,{'error':str(e)})
   with connection(self.server.db_path) as cx:busy=conflict(cx,a,b)
   return self.send_json(200,{'property':'miague','available':not busy,'nights':n,'total_indicative_xaf':n*40000,'currency':'XAF','not_a_guaranteed_booking':True})
  if p=='/api/demo/public/lookup':
   q=parse_qs(urlsplit(self.path).query);ref=clean(q.get('reference',[''])[0],24);email=clean(q.get('email',[''])[0],160).lower()
   with connection(self.server.db_path) as cx:
    item=one(cx,'SELECT id,reference,checkin,checkout,guests,estimate_xaf,status FROM bookings WHERE reference=? AND email=?',(ref,email))
    if item:
     intent=one(cx, 'SELECT state,amount_xaf,currency,external_reference FROM payment_intents WHERE booking_id=?',(item['id'],))
     del item['id'];item['payment']=intent or {'state':'not_initiated'}
   return self.send_json(200,{'booking':item}) if item else self.send_json(404,{'error':'No matching demo request'})
  if p=='/api/demo/me':
   s=self.guard()
   if s:return self.send_json(200,{'role':s['role'],'property':s['property'],'views':sorted(VIEWS[s['role']]),'csrf':s['csrf'],'demo':True})
   return
  if p=='/api/demo/snapshot':
   s=self.guard()
   if not s:return
   with connection(self.server.db_path) as cx:out=snapshot(cx,s['role'])
   return self.send_json(200,out)
  if p.startswith('/api/'):return self.send_json(404,{'error':'Unknown API endpoint'})
  return super().do_GET()
 def do_POST(self):
  p=self.route()
  if not p.startswith('/api/demo/'):return self.send_json(404,{'error':'Unknown API endpoint'})
  if p=='/api/demo/logout':
   s=self.user();cookie=self.headers.get('Cookie','');m=re.search(r'bo_demo_session=([a-f0-9]{64})',cookie)
   if m:
    with SESS_LOCK:SESSIONS.pop(m.group(1),None)
   return self.send_json(200,{'ok':True},{'Set-Cookie':'bo_demo_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/'})
  try:body=json_body(self)
  except (ValueError,json.JSONDecodeError) as e:return self.send_json(400,{'error':str(e)})
  if p=='/api/demo/login':
   name=clean(body.get('user'),30)
   if name not in ROLES or not hmac.compare_digest(str(body.get('password','')),DEMO_PASSWORD):return self.send_json(401,{'error':'Invalid demo credentials'})
   token=secrets.token_hex(32);csrf=secrets.token_hex(16)
   with SESS_LOCK:SESSIONS[token]={'role':ROLES[name][0],'property':ROLES[name][1],'csrf':csrf,'expires':datetime.now(timezone.utc)+timedelta(hours=2)}
   return self.send_json(200,{'ok':True,'role':name,'csrf':csrf}, {'Set-Cookie':f'bo_demo_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200'})
  if p=='/api/demo/public/payment-intent':
   # Reference + email act as a demo lookup capability; HTTPS authenticated guest required in production.
   ref=clean(body.get('reference'),24);email=clean(body.get('email'),160).lower()
   if not ref or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):return self.send_json(400,{'error':'Reference and email required'})
   with connection(self.server.db_path) as cx:
    cx.execute('BEGIN IMMEDIATE')
    booking=one(cx,"SELECT * FROM bookings WHERE reference=? AND email=? AND property='MIAGUE'",(ref,email))
    if not booking:return self.send_json(404,{'error':'Booking not found'})
    if booking['status'] not in ('confirmed','checked_in'):
     return self.send_json(409,{'error':'Staff must confirm booking before payment'})
    intent=one(cx,'SELECT * FROM payment_intents WHERE booking_id=?',(booking['id'],))
    if not intent:
     pid='BO-PAY-'+secrets.token_hex(6).upper()
     cx.execute('INSERT INTO payment_intents(booking_id,external_reference,amount_xaf,updated_at) VALUES (?,?,?,?)',(booking['id'],pid,booking['estimate_xaf'],utcnow()))
     cx.execute('INSERT INTO audit(actor,action,entity,reference,created_at) VALUES (?,?,?,?,?)',('guest','payment:intent','booking',ref,utcnow()))
     intent=one(cx,'SELECT * FROM payment_intents WHERE booking_id=?',(booking['id'],))
   return self.send_json(200,{'mode':'DEMO_ONLY','intent':{'reference':intent['external_reference'],'state':intent['state'],'currency':'XAF','amount_xaf':intent['amount_xaf']},'checkout_url':None,'message':'Awaiting payment. Provider checkout is not connected. Demo finance operator may test settlement.'})
  if p=='/api/demo/public/request':
   try:
    with connection(self.server.db_path) as cx:
     cx.execute('BEGIN IMMEDIATE')
     item=create_booking(cx,body)
    return self.send_json(201,{'reference':item['reference'],'status':'pending','estimate_xaf':item['estimate_xaf'],'mode':'DEMO_ONLY'})
   except (ValueError,TypeError) as e:return self.send_json(400,{'error':str(e)})
  if p=='/api/demo/booking/create':action='booking:create'
  elif p=='/api/demo/booking/transition':action='booking:'+clean(body.get('action'),12).replace('checkin','checkin').replace('checkout','checkout')
  elif p=='/api/demo/task/create':action='task:create'
  elif p=='/api/demo/task/update':action='task:update'
  elif p=='/api/demo/maintenance/create':action='maintenance:create'
  elif p=='/api/demo/maintenance/update':action='maintenance:update'
  elif p=='/api/demo/folio/charge':action='folio:charge'
  elif p=='/api/demo/payment/test-settle':action='payment:test-settle'
  else:return self.send_json(404,{'error':'Unknown API endpoint'})
  s=self.guard(action)
  if not s:return
  try:
   with connection(self.server.db_path) as cx:
    cx.execute('BEGIN IMMEDIATE')
    if p=='/api/demo/booking/create':out=create_booking(cx,body,s['role'])
    elif p=='/api/demo/booking/transition':
     bid=int(body.get('id'));act=clean(body.get('action'),12)
     out=transition(cx,bid,act,s['role'])
    elif p=='/api/demo/task/create':
     title=clean(body.get('title'),120);room=clean(body.get('room'),32)
     if not title or not room:raise ValueError('Title and room required')
     cur=cx.execute("INSERT INTO tasks(property,room,title,status,created_at) VALUES('MIAGUE',?,?,'open',?)",(room,title,utcnow()))
     out=one(cx,'SELECT * FROM tasks WHERE id=?',(cur.lastrowid,))
    elif p=='/api/demo/task/update':
     tid=int(body.get('id'));state=clean(body.get('status'),24)
     if state not in ('open','in_progress','done'):raise ValueError('Invalid task state')
     cur=cx.execute("UPDATE tasks SET status=? WHERE id=? AND property='MIAGUE'",(state,tid))
     if not cur.rowcount:raise LookupError('Task not found')
     out=one(cx,'SELECT * FROM tasks WHERE id=?',(tid,))
    elif p=='/api/demo/maintenance/create':
     title=clean(body.get('title'),120);room=clean(body.get('room'),32);priority=clean(body.get('priority'),16)
     if not title or not room or priority not in ('low','normal','urgent'):raise ValueError('Invalid maintenance request')
     cur=cx.execute("INSERT INTO maintenance(property,room,title,priority,created_at) VALUES('MIAGUE',?,?,?,?)",(room,title,priority,utcnow()))
     out=one(cx,'SELECT * FROM maintenance WHERE id=?',(cur.lastrowid,))
    elif p=='/api/demo/maintenance/update':
     mid=int(body.get('id'));state=clean(body.get('status'),20)
     if state not in ('open','in_progress','resolved'):raise ValueError('Invalid maintenance state')
     cur=cx.execute("UPDATE maintenance SET status=? WHERE id=? AND property='MIAGUE'",(state,mid))
     if not cur.rowcount:raise LookupError('Maintenance not found')
     out=one(cx,'SELECT * FROM maintenance WHERE id=?',(mid,))
    elif p=='/api/demo/payment/test-settle':
     if os.environ.get('BLUE_OCEAN_ENABLE_SIMULATED_SETTLEMENT') != 'YES':raise ValueError('Test settlement disabled. Set BLUE_OCEAN_ENABLE_SIMULATED_SETTLEMENT=YES for isolated local demo.')
     ref=clean(body.get('reference'),40);transaction_id=clean(body.get('provider_transaction_id'),80)
     if not ref or not transaction_id:raise ValueError('Intent reference and simulated provider transaction id required')
     intent=one(cx,'SELECT * FROM payment_intents WHERE external_reference=?',(ref,))
     if not intent:raise LookupError('Payment intent not found')
     if intent['state']=='paid':
      if intent['provider_transaction_id']!=transaction_id:raise ValueError('Transaction mismatch on already settled payment')
      out=intent
     else:
      if intent['state']!='awaiting_payment':raise ValueError('Intent not eligible')
      cx.execute("UPDATE payment_intents SET state='paid',provider_transaction_id=?,updated_at=? WHERE id=?",(transaction_id,utcnow(),intent['id']))
      out=one(cx,'SELECT * FROM payment_intents WHERE id=?',(intent['id'],))
    else:
     bid=int(body.get('booking_id'));label=clean(body.get('label'),110);amount=int(body.get('amount_xaf'))
     if amount<=0 or amount>5000000 or not label:raise ValueError('Valid positive amount and label required')
     booking=one(cx,"SELECT id FROM bookings WHERE id=? AND property='MIAGUE' AND status IN ('confirmed','checked_in','checked_out')",(bid,))
     if not booking:raise LookupError('Not an eligible booking')
     cur=cx.execute('INSERT INTO charges(booking_id,label,amount_xaf,created_at) VALUES(?,?,?,?)',(bid,label,amount,utcnow()))
     out=one(cx,'SELECT * FROM charges WHERE id=?',(cur.lastrowid,))
    cx.execute('INSERT INTO audit(actor,action,entity,reference,created_at) VALUES(?,?,?,?,?)',(s['role'],action,p,str(out.get('reference',out['id'])),utcnow()))
   return self.send_json(200,{'ok':True,'record':out,'mode':'DEMO_ONLY'})
  except LookupError as e:return self.send_json(404,{'error':str(e)})
  except (ValueError,TypeError,KeyError) as e:return self.send_json(409,{'error':str(e)})


def serve(host='127.0.0.1',port=8765,db=DB_DEFAULT):
 if host not in ('127.0.0.1','localhost','::1'):
  raise SystemExit('SAFETY: demo server refuses non-loopback bind')
 db_path=init_db(db)
 srv=ThreadingHTTPServer((host,port),Handler)
 srv.db_path=db_path
 print(f'Blue Ocean demo local only: http://{host}:{srv.server_port}/experience/ (SQLite {db_path})',flush=True)
 try:srv.serve_forever()
 finally:srv.server_close()

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8765);p.add_argument('--host',default='127.0.0.1');p.add_argument('--db',type=Path,default=DB_DEFAULT)
 args=p.parse_args();serve(args.host,args.port,args.db)
