import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/workspace');
const configSrc=readFileSync(path.join(base,'config.js'),'utf8');
const appSrc=readFileSync(path.join(base,'app.js'),'utf8');
const html=readFileSync(path.join(base,'index.html'),'utf8');
const css=readFileSync(path.join(base,'style.css'),'utf8');
function boot(){
 const callbacks={};
 const element={_html:'',addEventListener(event,fn){callbacks[event]=fn},set innerHTML(v){this._html=v},get innerHTML(){return this._html}};
 const doc={title:'',getElementById(id){return id==='app'?element:null},addEventListener(){},body:{append(){}}};
 const win={addEventListener(){}};
 const context=vm.createContext({window:win,document:doc,setTimeout(){},URL,console,Blob});
 vm.runInContext(configSrc,context,{filename:'config.js'});
 vm.runInContext(appSrc,context,{filename:'app.js'});
 const click=async(action,value)=>{const target={dataset:{action,value},closest(){return this},classList:{contains(){return false}}};await callbacks.click({target})};
 const change=(id,value)=>callbacks.change({target:{id,value}});
 return {callbacks,element,doc,win,click,change};
}
test('assets and entrypoint include real HTML and standalone icon sprite',()=>{
 assert.match(html,/config\.js/);assert.match(html,/app\.js/);assert.match(html,/style\.css/);
 assert.ok(existsSync(path.join(base,'assets','icons.svg')));
 for(const a of ['brand-mark.svg','ocean-topography.svg','hero-current.svg'])assert.ok(existsSync(path.join(base,'assets',a)));
 assert.ok(css.includes('@media(max-width:550px)'));
});
test('all role personas have unique IDs and explicit role-focused menus',()=>{
 const {win}=boot();const {PERSONAS,MENUS,DOMAINS}=win.BlueLineConfig;
 assert.equal(PERSONAS.length,30);assert.equal(new Set(PERSONAS.map(p=>p.id)).size,PERSONAS.length);
 for(const p of PERSONAS){assert.ok(DOMAINS[p.domain],p.id);assert.ok(MENUS[p.menu],p.id);assert.ok(MENUS[p.menu].length>=3,p.id);assert.equal(MENUS[p.menu][0][0],'overview')}
 for(const key of Object.keys(DOMAINS))assert.ok(PERSONAS.some(p=>p.domain===key),`missing ${key} domain role`);
});
test('login gate is first, and each of 30 personas renders its own dashboard and navigation',async()=>{
 const ctx=boot();assert.match(ctx.element.innerHTML,/Sign in to your/);assert.doesNotMatch(ctx.element.innerHTML,/Executive Command Center/);
 const {PERSONAS,MENUS}=ctx.win.BlueLineConfig;
 for(const p of PERSONAS){ctx.change('role-persona',p.id);await ctx.click('enter-demo');
   assert.ok(ctx.element.innerHTML.includes('PRESENTATION DEMO'),p.id);
   assert.ok(ctx.element.innerHTML.includes(p.title.replace('&','&amp;')),p.id);
   for(const screen of MENUS[p.menu]){if(screen[0]==='overview')continue;await ctx.click('navigate',screen[0]);assert.ok(ctx.element.innerHTML.includes('list-toolbar')||screen[0]==='settings'||screen[0]==='domains',p.id+' '+screen[0]);}
   await ctx.click('leave');assert.match(ctx.element.innerHTML,/Guided demo/);
 }
});
test('demo-only sample dataset never impersonates authenticated live records',async()=>{
 const ctx=boot();await ctx.click('enter-demo');assert.match(ctx.element.innerHTML,/Synthetic presentation dataset|DEMO DATA/);assert.match(ctx.element.innerHTML,/Classic RC20/);
 await ctx.click('navigate','approvals');assert.match(ctx.element.innerHTML,/Demo|synthetic|Synthetic/i);
});
test('login client contains HTTPS-only origin enforcement and never embeds credentials',()=>{
 assert.match(appSrc,/HTTPS API required/);assert.match(appSrc,/credentials:'omit'/);assert.match(appSrc,/cache:'no-store'/);assert.match(appSrc,/\/api\/v1\/login/);assert.match(appSrc,/\/api\/v1\/me/);
 assert.doesNotMatch(appSrc,/BlueLine2026!SecureOwnerKey|163\.61\.44\.41|owner@bluelinecapitale\.com/);
});
