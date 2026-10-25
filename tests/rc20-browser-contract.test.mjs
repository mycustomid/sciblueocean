import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

class Element {
  constructor(id=''){this.id=id;this.listeners={};this.textContent='';this.disabled=false;this.children=[];this.dataset={};this.value='';this.elements={password:{value:'initial-pass'}};this.className='';this.href='';}
  addEventListener(type,handler){this.listeners[type]=handler}
  async fire(type='click'){assert.ok(this.listeners[type],`Missing ${type} listener for ${this.id}`);return this.listeners[type]({preventDefault(){},currentTarget:this,target:this})}
  replaceChildren(...children){this.children=children}
  append(...children){this.children.push(...children)}
  scrollIntoView(){}
  click(){this.clicked=true}
}
function bootstrap(script,loginFields){
  const ids={};const calls=[];const all=[];
  const element=id=>ids[id]??(ids[id]=new Element(id));
  const doc={getElementById:element,createElement(tag){const e=new Element(tag);all.push(e);return e}};
  const form=element('login');form.formEntries=loginFields;
  const FakeFormData=class {constructor(f){this.data=f.formEntries}entries(){return Object.entries(this.data)}};
  const context={document:doc,FormData:FakeFormData,URL,Blob,console,Date,Error,String,Array,Object,JSON,encodeURIComponent,window:{events:{},addEventListener(evt,fn){this.events[evt]=fn}},fetch:async (url,options={})=>{
    const p=new URL(url).pathname;calls.push({path:p,method:options.method??'GET'});
    const data={
      '/api/v1/login':{access_token:'THE_PRIVATE_BEARER_TOKEN',entity_id:loginFields.entity_id,role:'finance'},
      '/api/v1/me':{entity_id:loginFields.entity_id,role:'finance'},
      '/health':{status:'ok',production_ready:false},
      '/api/v1/modules':{entity_id:loginFields.entity_id,modules:[{module_key:'finance',rollout_status:'pilot'},{module_key:'trade',rollout_status:'pilot'}]},
      '/api/v1/security/permissions':{entity_id:loginFields.entity_id,read_modules:['finance','trade']},
      '/api/v1/finance/invoices':{items:[]},
      '/api/v1/logout':{status:'logged_out'}
    }[p];
    return {ok:!!data,status:data?200:404,json:async()=>data||{error:'NOT_FOUND'}};
  }};
  const file=path.join(root,'public',script);
  vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:script,timeout:1000});
  return {element,calls,context,all};
}
const credentials={origin:'https://staging.example.test/',base:'https://staging.example.test/',email:'tester@example.test',password:'not-saved',entity_id:'12345678-1234-1234-1234-123456789abc'};

test('RC19 loads real response-backed module cards after server login',async()=>{
 const {element,calls,context}=bootstrap('rc19/studio.js',credentials);
 assert.equal(element('refresh').disabled,true);
 await element('login').fire('submit');
 assert.equal(element('refresh').disabled,false);
 assert.equal(element('count-label').textContent,'2');
 assert.equal(element('domain-grid').children.length,2);
 assert.match(element('response').textContent,/Rust API/);
 assert.equal(element('login').elements.password.value,'');
 assert.equal(calls.filter(x=>x.path==='/api/v1/login').length,1);
 assert.doesNotMatch(JSON.stringify(context.window),/THE_PRIVATE_BEARER_TOKEN/);
 await element('logout').fire();
 assert.equal(element('refresh').disabled,true);
});

test('RC19 rejects non-TLS off-host connection without fetch',async()=>{
 const creds={...credentials,base:'http://danger.example.test/'};
 const {element,calls}=bootstrap('rc19/studio.js',creds);
 await element('login').fire('submit');
 assert.equal(calls.length,0);
 assert.match(element('login-error').textContent,/HTTPS/);
});

test('RC20 probe verifies four live shapes but never approves production',async()=>{
 const {element,calls}=bootstrap('rc20/release.js',credentials);
 assert.equal(element('run').disabled,true);
 await element('login').fire('submit');
 assert.equal(element('run').disabled,false,element('error').textContent);
 await element('run').fire();
 const report=JSON.parse(element('output').textContent);
 assert.equal(report.results.length,4);
 assert.equal(report.results.every(x=>x.status==='PASS'),true);
 assert.equal(report.release_approved,false);
 assert.match(fs.readFileSync(path.join(root,'public/rc20/index.html'),'utf8'),/id="release-state">NOT APPROVED/);
 assert.doesNotMatch(element('output').textContent,/THE_PRIVATE_BEARER_TOKEN/);
 assert.equal(calls.filter(x=>x.path==='/api/v1/me').length,2);
});

test('RC20 off-host HTTP is blocked and no bearer persists in browser storage',async()=>{
 const creds={...credentials,origin:'http://example.test/'};
 const {element,context,calls}=bootstrap('rc20/release.js',creds);
 await element('login').fire('submit');
 assert.equal(element('run').disabled,true);
 assert.equal(calls.length,0);
 assert.match(element('error').textContent,/HTTPS/);
 assert.equal('localStorage' in context,false);
});

test('RC19 and RC20 UI assets mirrored into holding repository',()=>{
 for(const n of [19,20])for(const f of (n===19?['index.html','studio.css','studio.js']:['index.html','release.css','release.js'])){
  const a=fs.readFileSync(path.join(root,'public',`rc${n}`,f));
  const other=path.join(root,'..','bluelinecapitale','public','erp',`rc${n}`,f);
  if(!fs.existsSync(other)){
    // Single-repo CI cannot prove the holding site's parity; full release gate
    // requires the dual-repo packaging test executed with both trees present.
    continue;
  }
  const b=fs.readFileSync(other);
  assert.deepEqual(a,b,`Mismatch ${n}/${f}`);
 }
});
