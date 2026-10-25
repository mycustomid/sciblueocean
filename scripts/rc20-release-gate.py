#!/usr/bin/env python3
"""RC20 evidence-first preflight; explicit BLOCKED rather than optimistic PASS.

Usage:
  python3 scripts/rc20-release-gate.py --mode static
  ERP_DISPOSABLE_TEST_DB=I_CONFIRM TEST_DATABASE_URL=postgres://... \
      python3 scripts/rc20-release-gate.py --mode release

No schema migrations are performed by this script. The separate Rust test harness
migrates TEST_DATABASE_URL; NEVER point it at a real or shared database.
"""
from pathlib import Path
from html.parser import HTMLParser
import argparse, hashlib, json, os, re, shutil, subprocess, sys, time

ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT.parent
BACKEND=ROOT/'backend-rust'
class HTMLIds(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.viewport=False;self.title=False
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if 'id' in d:self.ids.append(d['id'])
        if tag=='meta' and d.get('name')=='viewport':self.viewport=True
        if tag=='title':self.title=True

def command(argv,cwd=None,timeout=180):
    try:
        r=subprocess.run(argv,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=timeout)
        return dict(status='PASS' if r.returncode==0 else 'FAIL',exit_code=r.returncode,output_tail=r.stdout[-3500:])
    except (FileNotFoundError,subprocess.TimeoutExpired) as exc:
        return dict(status='NOT_RUN',reason=str(exc))

def source_checks():
    checks=[]
    def add(name,ok,detail=''):
        checks.append(dict(name=name,status='PASS' if ok else 'FAIL',detail=detail))
    src=(BACKEND/'src/main.rs').read_text()
    auth=(BACKEND/'src/security.rs').read_text()
    add('Explicit route-layer auth', 'from_fn_with_state' in src and 'security::access_gate' in src)
    add('Unknown routes deny by default', 'false // a new route MUST be added' in auth)
    add('Migration chain fail-closed', 'expected_versions' in src and 'applied_versions!=expected_versions' in src)
    add('No automatic production schema modification', 'ERP_ENV' in src and 'ERP_AUTO_MIGRATE' in src)
    add('Public login and health routes excluded from auth gate', 'path != "/health" && path != "/api/v1/login"' in auth)
    add('Sensitive finance and HR roles guarded', '/api/v1/finance' in auth and '/api/v1/hr' in auth)
    migration_files=sorted((BACKEND/'migrations').glob('*.sql'))
    add('12 sequential SQL migration files', [p.name[:4] for p in migration_files] == [f'{i:04d}' for i in range(1,13)])
    for n,files in ((19,['index.html','studio.css','studio.js']),(20,['index.html','release.css','release.js'])):
        da=ROOT/f'public/rc{n}';db=STAGE/f'bluelinecapitale/public/erp/rc{n}'
        for f in files:
            if db.exists():
                add(f'RC{n} mirror {f}',(da/f).is_file() and (db/f).is_file() and (da/f).read_bytes()==(db/f).read_bytes())
            else:
                # A single-repo CI checkout cannot prove the other GitHub repository.
                # Report it as NOT_RUN and require separately signed dual-repo acceptance.
                checks.append(dict(name=f'RC{n} mirror {f}',status='NOT_RUN',detail='Other repository not checked out; packaging parity NOT independently verified'))
        parser=HTMLIds();parser.feed((da/'index.html').read_text())
        add(f'RC{n} unique HTML IDs',len(parser.ids)==len(set(parser.ids)))
        add(f'RC{n} mobile viewport, title',parser.viewport and parser.title)
        js=(da/files[-1]).read_text()
        add(f'RC{n} rejects insecure remote HTTP',"HTTPS is required except" in js)
        add(f'RC{n} no localStorage credentials','localStorage' not in js and 'sessionStorage' not in js)
        add(f'RC{n} authenticated response only',"await get(" in js if n==20 else "await request(" in js)
        add(f'RC{n} no external CDNs in assets','https://fonts.googleapis.com' not in (da/files[1]).read_text())
    add('Release status cannot be auto-approved', 'release_approved:false' in (ROOT/'public/rc20/release.js').read_text())
    add('Cargo manifest is RC20', '0.20.0-rc20' in (BACKEND/'Cargo.toml').read_text())
    # Enumerate main.rs route declarations and ensure known private path prefixes are in the access matrix.
    routes=re.findall(r'\.route\("([^\"]+)"',src)
    prefixes=['/api/v1/me','/api/v1/entity','/api/v1/modules','/api/v1/logout','/api/v1/records','/api/v1/journals',
              '/api/v1/overview','/api/v1/audit-events','/api/v1/trade','/api/v1/purchasing','/api/v1/sales',
              '/api/v1/inventory','/api/v1/finance','/api/v1/hospitality','/api/v1/property','/api/v1/blex',
              '/api/v1/hr','/api/v1/bridge','/api/v1/construction','/api/v1/manufacturing',
              '/api/v1/import','/api/v1/security']
    uncovered=[r for r in routes if r not in ['/health','/api/v1/login'] and not any(r==p or r.startswith(p+'/') for p in prefixes)]
    add('Every registered API route has a guard family',not uncovered,str(uncovered))
    add('No duplicate API route patterns',len(routes)==len(set(routes)),str(len(routes)))
    return checks

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['static','release'],default='static');parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    static=source_checks()
    tests=command(['node','--test',*[str(x) for x in sorted((ROOT/'tests').glob('*.test.mjs'))]],cwd=ROOT,timeout=120)
    js_files=sorted((ROOT/'public').rglob('*.js'))
    js_checks=[command(['node','--check',str(p)],cwd=ROOT,timeout=15) for p in js_files]
    if tests['status']!='PASS':static.append(dict(name='Node test suite',status='FAIL',detail=tests.get('output_tail','')))
    if any(x['status']!='PASS' for x in js_checks):static.append(dict(name='JS syntax checks',status='FAIL',detail='At least one failed'))
    blocked=[];release={}
    # A static source check is NOT Rust integration, PostgreSQL, or browser UAT.
    if args.mode=='release':
        if any(x['status']=='NOT_RUN' for x in static):blocked.append('Dual-repo file parity not verified on the release runner')
        for tool in ('cargo','rustc'):
            if not shutil.which(tool):blocked.append(f'{tool} missing')
        if not (BACKEND/'Cargo.lock').exists():blocked.append('Cargo.lock missing: reproducible dependency graph unverified')
        db_url=os.getenv('TEST_DATABASE_URL','')
        if not (db_url.startswith('postgres://') or db_url.startswith('postgresql://')):
            blocked.append('TEST_DATABASE_URL not set to isolated PostgreSQL')
        if os.getenv('ERP_DISPOSABLE_TEST_DB')!='I_CONFIRM':
            blocked.append('Disposable database confirmation required; refusing to run integration tests')
        if not blocked:
            for name,cmd,tm in (
                ('cargo_fmt',['cargo','fmt','--all','--','--check'],180),
                ('cargo_check',['cargo','check','--locked','--all-targets'],900),
                ('cargo_tests',['cargo','test','--locked','--all-targets','--','--nocapture'],900)):
                release[name]=command(cmd,cwd=BACKEND,timeout=tm)
                if release[name]['status']!='PASS':blocked.append(f'{name}: {release[name]["status"]}');break
        # Visual smoke test required independently, not mocked JS tests.
        if shutil.which('python3') and not blocked:
            release['browser']=command(['python3',str(ROOT/'scripts/rc20-browser-smoke.py')],cwd=ROOT,timeout=90)
            if release['browser']['status']!='PASS':blocked.append('Playwright browser UAT failed/not available')
        else:blocked.append('Live Playwright visual UAT not executed')
        blocked.extend(['Signed client UAT and local regulatory review not provided','Backup/restore and deployment rollback not verified'])
    static_ok=all(c['status'] in ('PASS','NOT_RUN') for c in static) and tests['status']=='PASS' and all(x['status']=='PASS' for x in js_checks)
    verdict='STATIC_PASS_RUNTIME_UNVERIFIED' if args.mode=='static' and static_ok else ('STATIC_FAIL' if not static_ok else 'BLOCKED_NOT_APPROVED')
    report={'checkpoint':'RC20','mode':args.mode,'verdict':verdict,'production_ready':False,
            'source_static_checks':static,'node_tests':{'status':tests['status'],'summary':tests.get('output_tail','')[-1000:]},
            'js_syntax':{'status':'PASS' if all(x['status']=='PASS' for x in js_checks) else 'FAIL','count':len(js_files)},
            'rust_build':release.get('cargo_check',{'status':'NOT_RUN'}),'postgresql_integration':release.get('cargo_tests',{'status':'NOT_RUN'}),
            'browser_uat':release.get('browser',{'status':'NOT_RUN'}),'runtime_blockers':blocked}
    output=args.report or STAGE/'QA-REPORT-RC20.json';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'checkpoint':'RC20','verdict':verdict,'static_checks':len(static),'static_pass':sum(c['status']=='PASS' for c in static),'node_status':tests['status'],'js_files':len(js_files),'release_blockers':blocked,'report':str(output)},indent=2))
    return 0 if args.mode=='static' and static_ok else 3

if __name__=='__main__':sys.exit(main())
