(()=>{'use strict';const $=s=>document.querySelector(s);let token='';
async function api(path,data){let res=await fetch('/api/staff'+path,{credentials:'same-origin',cache:'no-store',method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(data?{'X-CSRF-Token':token}:{})},body:data?JSON.stringify(data):undefined});const parsed=await res.json();if(!res.ok)throw Error(parsed.error||'API unavailable');return parsed;}
async function start(){const el=$('#session-state');try{const identity=await api('/me');if(identity.role!=='manager')throw Error('Manager only. This role cannot change pricing.');token=identity.csrf;el.textContent='Manager authenticated · Résidence Miague';await loadRoomCatalog();const stats=await api('/analytics/summary');$('#funnel').replaceChildren(...stats.counts.map(x=>{const p=document.createElement('p');p.textContent=x.event+': '+x.count;return p;}));}catch(e){el.classList.add('danger');el.textContent=e.message+' Please sign in to Studio as Manager.';document.querySelectorAll('form button').forEach(b=>b.disabled=true);}}
for(const [id,path,fn] of [['rate-form','/pricing/rate',f=>({day:f.day.value,rate_xaf:Number(f.rate_xaf.value),reason:f.reason.value})],['block-form','/inventory/block',f=>({checkin:f.checkin.value,checkout:f.checkout.value,reason:f.reason.value})]]){
 const form=document.getElementById(id);form.addEventListener('submit',async e=>{e.preventDefault();const msg=form.querySelector('[role=status]');const b=form.querySelector('button');b.disabled=true;try{const fields=Object.fromEntries(new FormData(form).entries());const payload=id==='rate-form'?{day:fields.day,rate_xaf:Number(fields.rate_xaf),reason:fields.reason}:{checkin:fields.checkin,checkout:fields.checkout,reason:fields.reason};await api(path,payload);msg.textContent='Saved in operational inventory. Open the guest quote to verify.';msg.style.color='#26724b';}catch(err){msg.textContent=err.message;msg.style.color='#b33329';}finally{b.disabled=false;}});
}
async function loadRoomCatalog(){
 const anchor=document.querySelector('#rate-form')?.closest('section')||document.querySelector('#rate-form')?.parentElement;
 if(!anchor)return;
 const panel=document.createElement('section');
 panel.className='room-catalog';
 panel.innerHTML=`<h2>Noms des chambres</h2><p>Chaque nom reste associé au numéro de chambre existant.</p><form id="room-catalog-form"><label>Chambre <select name="room_number" required></select></label><label>Nom de la chambre <input name="display_name" maxlength="80" required></label><button type="submit">Enregistrer la chambre</button><p role="status" aria-live="polite"></p></form>`;
 anchor.insertAdjacentElement('beforebegin',panel);
 const form=panel.querySelector('form'), select=form.elements.room_number, name=form.elements.display_name, message=form.querySelector('[role=status]');
 let rooms=(await api('/rooms/catalog')).rooms;
 for(const room of rooms){const option=document.createElement('option');option.value=room.room_number;option.textContent=room.room_number;select.append(option)}
 function display(){const room=rooms.find(x=>x.room_number===select.value);if(!room)return;name.value=room.display_name;message.textContent=''}
 select.addEventListener('change',display);display();
 form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{
  const {room}=await api('/rooms/catalog',{room_number:select.value,display_name:name.value});
  rooms=rooms.map(r=>r.room_number===room.room_number?room:r);message.textContent='Nom de chambre enregistré.';
 }catch(error){message.textContent=error.message}finally{button.disabled=false}});
}
start();})();
