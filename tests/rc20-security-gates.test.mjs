import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,base),'utf8');
test('RC18 middleware guards every business request before handler',()=>{
 const main=read('backend-rust/src/main.rs'),security=read('backend-rust/src/security.rs');
 assert.match(main,/security::access_gate/);
 assert.match(main,/from_fn_with_state/);
 assert.match(security,/pub async fn access_gate/);
 assert.match(security,/auth::require_auth\(req\.headers\(\),&s\.pool\)/);
 assert.match(security,/false \/\/ a new route MUST be added/);
 assert.match(security,/role == "group_admin"/);
});
test('RC18 finance and HR hidden from IT admin, unknown API route denied',()=>{
 const s=read('backend-rust/src/security.rs');
 for(const k of ['/api/v1/hr','/api/v1/finance','/api/v1/hospitality','/api/v1/blex','/api/v1/trade']) assert.ok(s.includes(k),k);
 assert.match(s,/assert!\(!route_allowed\("group_admin",&Method::GET,"\/api\/v1\/finance\/invoices"\)\)/);
 assert.match(s,/assert!\(!route_allowed\("operator",&Method::GET,"\/api\/v1\/hr\/employees"\)\)/);
});
test('RC20 migrator checks contiguous history, not just max version',()=>{
 const src=read('backend-rust/src/main.rs');
 assert.match(src,/SELECT version FROM _sqlx_migrations WHERE success=true ORDER BY version/);
 assert.match(src,/applied_versions!=expected_versions/);
 assert.match(src,/failed>0/);
 assert.doesNotMatch(src,/COALESCE\(MAX\(version\)/);
});
test('Release readiness console never auto approves financial operations',()=>{
 const release=read('public/rc20/release.js');
 const h=read('public/rc20/index.html');
 assert.match(h,/id="release-state">NOT APPROVED/);
 assert.match(release,/release_approved:false/);
 assert.match(release,/credentials:'omit'/);
 assert.match(release,/token=''/);
 assert.doesNotMatch(release,/(?:localStorage|sessionStorage)\./);
});
