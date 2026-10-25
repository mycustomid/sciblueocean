(()=>{'use strict';
let apiBase='',accessToken='',role='',entity='';const by=id=>document.getElementById(id);
const evidence=(op,result)=>{by('evidence').textContent=JSON.stringify({operation:op,at:new Date().toISOString(),result},null,2)};
async function request(path,method='GET',body=null){if(!apiBase)throw Error('Set API endpoint first');const headers={'Accept':'application/json'};
if(body!==null)headers['Content-Type']='application/json';if(accessToken)headers.Authorization='Bearer '+accessToken;
const r=await fetch(apiBase+path,{method,headers,body:body===null?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store'});
const data=await r.json().catch(()=>({message:'Response was not JSON'}));if(!r.ok)throw Error(`HTTP ${r.status}: ${data.message||data.error||'Request rejected'}`);return data;}
const read=f=>Object.fromEntries(new FormData(f).entries());const converted=(v)=>{
for(const k of ['monthly_base_xaf','minutes_worked'])if(k in v)v[k]=Number(v[k]);return v};
async function reloadLists(){if(!accessToken)return;for(const e of document.querySelectorAll('[data-list]')){try{e.textContent=JSON.stringify(await request(e.dataset.list),null,2)}catch(error){e.textContent='Unavailable: '+error.message}}}
by('login').addEventListener('submit',async ev=>{ev.preventDefault();let input=read(ev.currentTarget);accessToken='';role='';entity='';try{
const url=new URL(input.base);if(!['https:','http:'].includes(url.protocol))throw Error('Only HTTP(S) supported');apiBase=url.origin;
const data=await request('/api/v1/login','POST',{email:input.email,password:input.password,entity_id:input.entity_id});accessToken=data.access_token;role=data.role;entity=data.entity_id;
ev.currentTarget.elements.password.value='';by('identity').textContent=role+' · '+entity.slice(0,8)+'…';evidence('LOGIN',{role,entity_id:entity,token:'[REDACTED]'});await reloadLists();
}catch(err){by('identity').textContent='No session';evidence('LOGIN FAILED',{error:err.message})}});
by('probe').addEventListener('click',async()=>{try{const u=new URL(by('login').elements.base.value);if(!['https:','http:'].includes(u.protocol))throw Error('Invalid API URL');apiBase=u.origin;evidence('HEALTH',await request('/health'))}catch(err){evidence('HEALTH FAILED',{error:err.message})}});
by('logout').addEventListener('click',async()=>{try{if(accessToken)await request('/api/v1/logout','POST')}catch{}accessToken='';role='';entity='';by('identity').textContent='No session';for(const x of document.querySelectorAll('[data-list]'))x.textContent='Authenticate first';evidence('LOGOUT',{status:'Local session cleared; server revocation attempted'})});
document.addEventListener('submit',async ev=>{const f=ev.target;if(!f.matches('form[data-route]'))return;ev.preventDefault();const button=f.querySelector('button[type=submit]');if(button)button.disabled=true;
try{if(!accessToken)throw Error('Authentication required');const data=converted(read(f));let path=f.dataset.route.replace('{id}',encodeURIComponent(data.id||''));delete data.id;const result=await request(path,f.dataset.method||'POST',Object.keys(data).length?data:null);await reloadLists();evidence('SERVER CONFIRMED '+path,result);
}catch(err){evidence('REJECTED / NOT CONFIRMED',{error:err.message})}finally{if(button)button.disabled=false}});
document.querySelectorAll('[data-refresh]').forEach(b=>b.addEventListener('click',async()=>{try{if(!accessToken)throw Error('Authentication required');const el=document.querySelector(`[data-list="${b.dataset.refresh}"]`);el.textContent=JSON.stringify(await request(b.dataset.refresh),null,2);evidence('REFRESH '+b.dataset.refresh,{status:'server-response'})}catch(err){evidence('REFRESH FAILED',{error:err.message})}}));
by('clear').addEventListener('click',()=>by('evidence').textContent='Cleared.');
})();