#!/usr/bin/env python3
"""Static contract and mirror preflight (not a Rust/PG runtime test)."""
from pathlib import Path
from bs4 import BeautifulSoup
import tinycss2, json, re, hashlib
root=Path(__file__).resolve().parents[1]
parent=root.parent
passed=[]
def check(name,ok):
    if not ok:raise AssertionError(name)
    passed.append(name)
backend=root/'backend-rust'
ms=sorted((backend/'migrations').glob('*.sql'))
check('Migrations 0001-0012', [p.name[:4] for p in ms]==[f'{i:04d}' for i in range(1,13)])
main=(backend/'src/main.rs').read_text()
check('Fail closed on version 12', 'applied_versions!=expected_versions' in main and 'failed>0' in main)
check('No admin override in generic allow', 'auth.role=="group_admin"||' not in (backend/'src/auth.rs').read_text())
check('HR and security module wired', all(s in main for s in ['hr::payroll_verify','security::revoke_member','hr::bridge']))
for n in [16,17]:
    d=root/f'public/rc{n}'
    b=parent/'bluelinecapitale/public/erp'/f'rc{n}'
    for name in ('index.html','pilot.css','pilot.js'):
        check(f'RC{n} mirrored {name}',(d/name).read_bytes()==(b/name).read_bytes())
    soup=BeautifulSoup((d/'index.html').read_text(),'html.parser')
    ids=[e['id'] for e in soup.find_all(id=True)]
    check(f'RC{n} unique HTML ids',len(set(ids))==len(ids))
    check(f'RC{n} accessible viewport and page title',bool(soup.find('meta',attrs={'name':'viewport'})) and bool(soup.title))
    check(f'RC{n} no inline secrets',not soup.find('input',{'name':'password','value':True}))
    css=(d/'pilot.css').read_text()
    errors=[x for x in tinycss2.parse_stylesheet(css,skip_comments=True,skip_whitespace=True) if x.type=='error']
    check(f'RC{n} CSS parsed',not errors)
    check(f'RC{n} responsive layout','@media' in css and 'max-width:550px' in css)
    js=(d/'pilot.js').read_text()
    check(f'RC{n} JS ephemeral credentials',not re.search(r'(?<![A-Za-z])(?:localStorage|sessionStorage)\.',js))
    check(f'RC{n} uses server confirmation',all(t in js for t in ('await request(','SERVER CONFIRMED','REJECTED / NOT CONFIRMED')))
print(json.dumps({'status':'PASS','tests':len(passed),'items':passed},indent=2))
