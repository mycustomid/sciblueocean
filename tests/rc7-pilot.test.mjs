import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const pilot = new URL('../public/rc7/pilot.js', import.meta.url);

function harness(){
  const els=new Map();
  function el(id){
    if (!els.has(id)) els.set(id,{
      id, listeners:{}, dataset:{},classList:{toggle(){}},textContent:'',innerHTML:'',
      addEventListener(type,handler){this.listeners[type]=handler;},
      scrollIntoView(){},
    });
    return els.get(id);
  }
  for(const id of ['apiState','result','entityState','domains','moduleSelect','recordsBody','journalsBody','connectForm','probeBtn','sessionState','logoutBtn','recordForm','journalForm','refreshRecords','refreshJournals','clearConsole','overviewCards','refreshOverview','showAudit']) el(id);
  el('connectForm').elements={apiBase:{value:'http://127.0.0.1:8085'},password:{value:'strong-password-for-test'}};
  el('connectForm').__form={apiBase:'http://127.0.0.1:8085',email:'qa@example.test',password:'strong-password-for-test',entityId:'00000000-0000-0000-0000-000000000001'};
  el('recordForm').__form={module_key:'sugar',counterparty:'QA Plant',description:'QC intake demo',amount_xaf:'2000'};
  const traffic=[];
  let retryFails=true;
  async function fetch(url,options={}){
    traffic.push({url,options});
    const path=new URL(url).pathname;
    if (path==='/health')return {ok:true,json:async()=>({status:'ok',production_ready:false})};
    if (path==='/api/v1/login')return {ok:true,json:async()=>({access_token:'a'.repeat(96),entity_id:'00000000-0000-0000-0000-000000000001',role:'operator'})};
    if (path==='/api/v1/modules')return {ok:true,json:async()=>({modules:[{module_key:'sugar',name:'Sugar',domain_category:'business',rollout_status:'prototype'}]})};
    if (path==='/api/v1/records' && options.method==='POST'){
      if(retryFails){retryFails=false;throw new Error('connection dropped after server commit')}
      return {ok:true,json:async()=>({id:'rec-1',idempotent:true})};
    }
    if (path==='/api/v1/records')return {ok:true,json:async()=>({items:[]})};
    if (path==='/api/v1/journals')return {ok:true,json:async()=>({items:[]})};
    if (path==='/api/v1/entity')return {ok:true,json:async()=>({legal_name:'QA Pilot',id:'entity',role:'operator'})};
    if (path==='/api/v1/overview')return {ok:true,json:async()=>({domain_status_counts:[],journals:{posted:0,draft:0}})};
    if (path==='/api/v1/logout')return {ok:true,json:async()=>({status:'logged_out'})};
    throw new Error(`Unexpected test HTTP path ${path}`);
  }
  class FakeFormData{
    constructor(form){this.vals=form.__form}
    *[Symbol.iterator](){yield* Object.entries(this.vals)}
  }
  const ctx={document:{getElementById:el},URL,Intl,Date,crypto:webcrypto,AbortSignal,fetch,FormData:FakeFormData,console};
  vm.runInNewContext(fs.readFileSync(pilot,'utf8'),ctx,{filename:'pilot.js'});
  return {el,traffic};
}

test('RC7 pilot does not fabricate network success on initial load',()=>{
  const h=harness();
  assert.equal(h.traffic.length,0);
  assert.ok(h.el('probeBtn').listeners.click);
  assert.ok(h.el('showAudit').listeners.click);
});

test('RC7 pilot uses real entity-bound login, safe metrics, stable retry key',async()=>{
  const h=harness();
  await h.el('probeBtn').listeners.click();
  assert.match(h.el('apiState').textContent,/RUST API REACHABLE/);
  await h.el('connectForm').listeners.submit({preventDefault(){},currentTarget:h.el('connectForm')});
  assert.match(h.el('overviewCards').innerHTML,/Posted GL journals/);
  assert.equal(h.el('connectForm').elements.password.value,'');
  const r=h.el('recordForm');
  await r.listeners.submit({preventDefault(){},currentTarget:r});
  const key=r.dataset.pendingKey;
  assert.ok(key && key.length>12);
  assert.match(h.el('result').textContent,/retry preserves idempotency key/);
  await r.listeners.submit({preventDefault(){},currentTarget:r});
  assert.equal(r.dataset.pendingKey,undefined);
  const posts=h.traffic.filter(t=>new URL(t.url).pathname==='/api/v1/records'&&t.options.method==='POST');
  assert.equal(posts.length,2);
  assert.equal(posts[0].options.headers['Idempotency-Key'],posts[1].options.headers['Idempotency-Key']);
  assert.match(h.el('result').textContent,/Record persisted by PostgreSQL/);
});
