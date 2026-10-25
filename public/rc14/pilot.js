(() => {"use strict";
let base="",token="",role="",entity="";
const el=id=>document.getElementById(id);
const show=(label,obj)=>{const o={time:new Date().toISOString(),operation:label,response:obj};el("result").textContent=JSON.stringify(o,null,2)};
async function api(path,method="GET",payload=null){if(!base)throw Error("Configure API base URL and authenticate");
  const h={"Accept":"application/json"};if(payload!==null)h["Content-Type"]="application/json";if(token)h.Authorization=`Bearer ${token}`;
  const r=await fetch(base+path,{method,headers:h,body:payload===null?undefined:JSON.stringify(payload)});
  let data;try{data=await r.json()}catch{throw Error(`HTTP ${r.status}: non-JSON response`)}
  if(!r.ok)throw Error(`HTTP ${r.status}: ${data.message||data.error||JSON.stringify(data)}`);return data;
}
const fields=form=>Object.fromEntries([...new FormData(form).entries()].map(([k,v])=>[k,v]));
async function refresh(path){const element=document.querySelector(`[data-list="${path}"]`);if(!element)return;
  try{element.textContent=JSON.stringify(await api(path),null,2)}catch(e){element.textContent=`Unavailable: ${e.message}`}
}
async function refreshAll(){for(const x of document.querySelectorAll('[data-list]')) await refresh(x.dataset.list)}
el("probe").addEventListener("click",async()=>{try{base=new URL(el("login").elements.base.value).origin;show("HEALTH",await api('/health'))}catch(e){show("HEALTH ERROR",{error:e.message})}});
el("login").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;const d=fields(f);
try{const u=new URL(d.base);if(!['http:','https:'].includes(u.protocol))throw Error('HTTP(S) API only');base=u.origin;
  const result=await api('/api/v1/login','POST',{email:d.email,password:d.password,entity_id:d.entity_id});token=result.access_token;role=result.role;entity=result.entity_id;
  f.elements.password.value='';el('identity').textContent=`${role} · ${String(entity).slice(0,8)}…`;el('state').textContent='Server-authenticated for one entity; tokens are never persisted.';
  show('SESSION STARTED',{role,entity_id:entity,access_token:'[REDACTED]'});await refreshAll();
}catch(e){token='';role='';entity='';el('identity').textContent='Authentication failed';show('LOGIN REJECTED',{error:e.message})}});
el('logout').addEventListener('click',async()=>{try{if(token)await api('/api/v1/logout','POST')}catch{}token='';role='';entity='';el('identity').textContent='No session';el('state').textContent='Token revoked locally; login again to access data.';show('LOGOUT',{status:'session_removed'});
for(const x of document.querySelectorAll('[data-list]'))x.textContent='Not authenticated.'});
document.addEventListener('submit',async e=>{const f=e.target;if(!f.matches('form[data-route]'))return;e.preventDefault();const button=f.querySelector('button[type=submit]');button.disabled=true;
try{if(!token)throw Error('Authentication required');const data=fields(f),route=f.dataset.route.replace('{id}',encodeURIComponent(data.id||''));delete data.id;
for(const [k,v] of Object.entries(data)){if(['total_xaf','amount_xaf','rent_xaf','deposit_xaf','nightly_rate_xaf','foreign_units','rate_xaf_per_1000','budget_xaf','completion_percent','spent_xaf','planned_quantity','produced_quantity','brix_x100'].includes(k))data[k]=Number(v);
 if(k==='pass')data[k]=v==='true'}
const result=await api(route,f.dataset.method||'POST',Object.keys(data).length?data:null);show(`CONFIRMED: ${route}`,result);await refreshAll();
}catch(err){show('OPERATION REJECTED / NOT CONFIRMED',{error:err.message});}finally{button.disabled=false}});
document.querySelectorAll('[data-refresh]').forEach(b=>b.addEventListener('click',async()=>{await refresh(b.dataset.refresh);show('LIST FETCHED',{path:b.dataset.refresh})}));
el('clear').addEventListener('click',()=>el('result').textContent='Cleared.');
})();