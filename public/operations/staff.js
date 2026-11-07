/* Blue Ocean Operations Studio — authenticated staff operations */
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],page=document.body.dataset.studioPage,API='/api/staff';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I=window.StudioI18n||{t:key=>key,locale:'fr',numberLocale:'fr-CM',dateLocale:'fr-FR'},t=key=>I.t(key);
const money=v=>new Intl.NumberFormat(I.numberLocale).format(Number(v)||0)+' FCFA';
let session=null, state=null, month=new Date(); month.setDate(1);
const dateValue=value=>{if(!value)return '';const parsed=new Date(value+'T12:00:00');return Number.isNaN(parsed.getTime())?String(value):new Intl.DateTimeFormat(I.dateLocale,{day:'2-digit',month:'short',year:'numeric'}).format(parsed);};
const statusLabel={pending:'En attente',confirmed:'Confirmé',checked_in:'En séjour',checked_out:'Départ effectué',cancelled:'Annulé',open:'À faire',in_progress:'En cours',done:'Terminé',resolved:'Résolu',awaiting_payment:'En attente PSP',paid:'Réglé'};
function showToast(msg){msg=t(msg);const el=$('[data-studio-toast]');if(!el)return;el.textContent=msg;el.hidden=false;setTimeout(()=>el.hidden=true,5200)}
async function api(path,{method='GET',body}={}){
 let res;try{res=await fetch(API+path,{method,credentials:'same-origin',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{}),...(session&&method!=='GET'?{'X-CSRF-Token':session.csrf}:{})},body:body?JSON.stringify(body):undefined})}catch{throw Error(t('Le service des opérations ne répond pas. Réessayez ou contactez votre administrateur.'));}
 let data;try{data=await res.json()}catch{throw Error(t('Réponse inattendue du service des opérations'))}
 if(!res.ok)throw Object.assign(Error(t(data.error||'Erreur API')),{code:res.status});return data;
}
function status(v){return `<span class="status-chip ${esc(v)}">${esc(t(statusLabel[v]||v))}</span>`}
function tr(cells){return '<tr>'+cells.map(x=>`<td>${x}</td>`).join('')+'</tr>'}
function empty(cols=5,msg=t('Aucun enregistrement disponible.')){return `<tr><td colspan="${cols}" class="table-empty">${esc(msg)}</td></tr>`}
function setTable(name,rows,cols){const table=$(`[data-table="${name}"]`);if(!table)return;const tbody=$('tbody',table);tbody.innerHTML=rows.length?rows.join(''):empty(cols)}
function setMetric(key,val){const el=$(`[data-metric="${key}"]`);if(el)el.textContent=['billed','settled','revenue'].includes(key)?money(val):new Intl.NumberFormat(I.numberLocale).format(Number(val)||0)}
function occupiedForDate(bookings,date){return bookings.filter(b=>b.checkin<=date&&b.checkout>date&&['confirmed','checked_in','checked_out'].includes(b.status))}
function renderCalendar(bookings){const grid=$('[data-calendar-grid]'),label=$('[data-calendar-label]');if(!grid)return;const year=month.getFullYear(),mo=month.getMonth();if(label)label.textContent=new Intl.DateTimeFormat(I.dateLocale,{month:'long',year:'numeric'}).format(month);const first=new Date(year,mo,1),start=(first.getDay()+6)%7;const daysInMonth=new Date(year,mo+1,0).getDate();let html='';for(const d of (I.locale==='en'?['M','T','W','T','F','S','S']:['L','M','M','J','V','S','D']))html+=`<div class="calendar-day outside" aria-hidden="true"><b>${d}</b></div>`;for(let i=0;i<start;i++)html+='<div class="calendar-day outside"></div>';for(let day=1;day<=daysInMonth;day++){const date=`${year}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;const occupied=occupiedForDate(bookings,date);const pending=bookings.some(b=>b.checkin<=date&&b.checkout>date&&b.status==='pending');const blocked=(state?.calendar_blocks||[]).some(b=>b.from_date<=date&&b.to_date>date);const label=blocked?(I.locale==='en'?'Blocked':'Bloqué'):t(occupied.length?'Occupé':pending?'Demande':'Disponible');html+=occupied.length?`<button type="button" class="calendar-day booked calendar-day-button" data-calendar-date="${esc(date)}" aria-label="${esc(dateValue(date)+' · '+label)}"><b>${day}</b><small>${esc(label)}</small></button>`:`<div class="calendar-day ${blocked?'blocked':pending?'pending':''}" title="${esc(date)}"><b>${day}</b><small>${esc(label)}</small></div>`}grid.innerHTML=html}
function roomDisplay(code){const name=state?.rooms?.find(room=>room.room_number===code)?.display_name;return name&&name!==code?`${name} · ${code}`:code}
function showOccupiedDate(date){const occupied=occupiedForDate(state?.calendar_bookings||state?.bookings||[],date);const rooms=[...new Set(occupied.map(b=>b.room_number).filter(Boolean))].sort();const unassigned=occupied.filter(b=>!b.room_number).length;const en=I.locale==='en';const roomList=rooms.map(room=>`<li>${esc(roomDisplay(room))}</li>`).join('');const count=en?`${rooms.length} occupied room${rooms.length===1?'':'s'}`:`${rooms.length} chambre${rooms.length===1?'':'s'} occupée${rooms.length===1?'':'s'}`;const missing=unassigned?`<p class="calendar-unassigned">${esc(en?`${unassigned} confirmed reservation(s) without an assigned room; not included in the room count.`:`${unassigned} réservation(s) confirmée(s) sans chambre attribuée ; non comprise(s) dans le nombre de chambres.`)}</p>`:'';modal((en?'Occupied rooms · ':'Chambres occupées · ')+dateValue(date),`<div class="calendar-detail"><p><strong>${esc(count)}</strong></p>${roomList?`<ul>${roomList}</ul>`:''}${missing}</div>`)}
function button(label,action,id,disabled=false){return `<button type="button" class="cell-action" data-write="${esc(action)}" data-id="${id}" ${disabled?'disabled':''}>${esc(t(label))}</button>`}
function bookingActions(b){if(!session)return '';const role=session.role;const receiptBtn=['confirmed','checked_in','checked_out'].includes(b.status)?`<button type="button" class="cell-action receipt-button" data-action="print-booking-receipt" data-id="${b.id}" title="${esc(t('Imprimer le reçu de séjour'))}"><svg aria-hidden="true" class="ui-icon" style="width:12px;height:12px;margin-right:2px;vertical-align:-1px;"><use href="/experience/assets/icons.svg#printer"></use></svg>${esc(t('Reçu'))}</button>`:'';if(!['reception','manager'].includes(role))return `<span class="quiet-pill">${esc(t('Lecture'))}</span> ${receiptBtn}`;if(b.status==='pending'){const rooms=b.available_room_numbers||[];if(!rooms.length)return `<span class="quiet-pill">${esc(t('Aucune chambre libre'))}</span> ${button('Refuser','cancel',b.id)}`;const options=rooms.map(room=>`<option value="${esc(room)}">${esc(roomDisplay(room))}</option>`).join('');return `<div class="room-assignment"><label class="sr-only" for="room-${b.id}">${esc(t('Choisir une chambre libre'))}</label><select id="room-${b.id}" data-room-select="${b.id}"><option value="">${esc(t('Choisir une chambre'))}</option>${options}</select>${button('Confirmer et attribuer','confirm',b.id)}</div>${button('Refuser','cancel',b.id)}<small>${esc(I.locale==='en'?'Check availability before confirming.':'Vérifiez la disponibilité avant confirmation.')}</small>`}if(b.status==='confirmed')return `${b.room_number?`<strong>${esc(roomDisplay(b.room_number))}</strong> `:''}${button('Check-in','checkin',b.id)} ${receiptBtn}`;if(b.status==='checked_in')return `${b.room_number?`<strong>${esc(roomDisplay(b.room_number))}</strong> `:''}${button('Check-out','checkout',b.id)} ${receiptBtn}`;return `<span class="quiet-pill">${esc(t('Terminé'))}</span> ${receiptBtn}`}
function bookingList(data){let list=[...data.bookings];const input=$('[data-filter-search]'),statusFilter=$('[data-filter-status]');if(input?.value){const t=input.value.toLowerCase();list=list.filter(x=>`${x.guest} ${x.reference}`.toLowerCase().includes(t))}if(statusFilter?.value)list=list.filter(x=>x.status===statusFilter.value);return list}
function draw(){if(!state)return;const b=state.bookings||[],tasks=state.tasks||[],m=state.maintenance||[],charges=state.charges||[];
Object.entries(state.metrics||{}).forEach(([k,v])=>setMetric(k,v));
setTable('today',b.filter(x=>x.status!=='cancelled'&&(x.checkin===state.today||x.checkout===state.today||x.status==='checked_in')).slice(0,7).map(x=>tr([esc(x.reference),esc(x.guest),`${esc(dateValue(x.checkin))}<br/>${esc(dateValue(x.checkout))}`,status(x.status),bookingActions(x)])),5);
setTable('bookings',bookingList(state).map(x=>tr([`<strong>${esc(x.reference)}</strong>${x.room_number?`<small>${esc(roomDisplay(x.room_number))}</small>`:''}`,`${esc(x.guest)}${x.phone?`<small>${esc(x.phone)}</small>`:''}${x.identity_type?`<small>${esc(x.identity_type==='PASSPORT'?t('Passeport'):x.identity_type)} · ${esc(x.identity_number)}</small>`:''}`,esc(dateValue(x.checkin)),esc(dateValue(x.checkout)),status(x.status),money(x.estimate_xaf),bookingActions(x)])),7);
setTable('arrivals',b.filter(x=>['confirmed','checked_in','checked_out'].includes(x.status)).map(x=>tr([esc(x.reference),esc(x.guest),`${esc(dateValue(x.checkin))} — ${esc(dateValue(x.checkout))}`,status(x.status),bookingActions(x)])),5);
const guests=Object.values(b.reduce((a,x)=>{const key=x.email;if(!a[key]||a[key].id<x.id)a[key]=x;return a},{}));setTable('guests',guests.map(x=>tr([esc(x.guest),esc(x.email),esc(dateValue(x.checkin)),status(x.status)])),4);
setTable('housekeeping',tasks.map(x=>tr([esc(x.room),esc(x.title),status(x.status),esc(x.assignee||t('Non affecté')),session?.role==='housekeeping'||session?.role==='manager'?x.status==='done'?esc(t('Terminé')):button(x.status==='open'?'Commencer':'Terminer','task-'+(x.status==='open'?'in_progress':'done'),x.id):esc(t('Lecture'))])),5);
setTable('maintenance',m.map(x=>tr([`MT-${String(x.id).padStart(4,'0')}`,esc(x.room)+' · '+esc(x.title),esc(t(({normal:'Normale',low:'Faible',urgent:'Urgente'})[x.priority]||x.priority)),status(x.status),['maintenance','manager'].includes(session?.role)?x.status==='resolved'?esc(t('Résolu')):button(x.status==='open'?'Prendre en charge':'Résoudre','maintenance-'+(x.status==='open'?'in_progress':'resolved'),x.id):esc(t('Lecture'))])),5);
setTable('payments',(state.payments||[]).map(x=>tr([esc(x.external_reference),esc(x.booking_reference),money(x.amount_xaf),status(x.state),`<span class="quiet-pill">${esc(t('Encaissement en ligne non connecté'))}</span>`])),5);
setTable('folios',charges.map(x=>tr([`FL-${String(x.id).padStart(4,'0')}`,esc(x.reference),esc(x.label),money(x.amount_xaf),status(x.booking_status),`<button type="button" class="cell-action receipt-button" data-action="print-booking-receipt" data-ref="${esc(x.reference)}" title="${esc(t('Imprimer la facture'))}"><svg aria-hidden="true" class="ui-icon" style="width:12px;height:12px;margin-right:2px;vertical-align:-1px;"><use href="/experience/assets/icons.svg#printer"></use></svg>${esc(t('Facture'))}</button>`])),6);
renderCalendar(state.calendar_bookings||b);
const activity=$('[data-activity-list]');if(activity){activity.innerHTML=b.length?b.slice(0,6).map(x=>`<div class="activity-row"><strong>${esc(x.reference)} · ${esc(x.guest)}</strong><span>${esc(dateValue(x.checkin))} → ${esc(dateValue(x.checkout))} · ${esc(t(statusLabel[x.status]||x.status))}</span></div>`).join(''):`<p class="empty-block">${esc(t('Aucune demande en base locale. Créez une demande sur le site public ou dans Réservations.'))}</p>`}
const chart=$('[data-report-chart]');if(chart){const groups={};b.forEach(x=>{const key=x.created_at?.slice(0,10);if(key)groups[key]=(groups[key]||0)+1});const values=Array.isArray(state.report_daily)?state.report_daily.map(x=>[x.day,x.count]):Object.entries(groups).sort(([a],[b])=>a.localeCompare(b)).slice(-12);const max=Math.max(...values.map(x=>x[1]),1);chart.innerHTML=values.length?values.map(([k,v])=>`<div class="report-bar" style="height:${Math.max(8,v/max*100)}%"><span>${v}</span><small style="position:absolute;top:calc(100% + 9px);left:0;font-size:9px;color:#738a84">${esc(k.slice(5))}</small></div>`).join(''):`<p class="empty-block">${esc(t('Aucune demande de réservation enregistrée.'))}</p>`}
}
async function refresh(){try{state=await api('/snapshot');draw();$$('[data-api-state]').forEach(x=>x.textContent=t('CONNECTÉ'));const banner=$('[data-connection-banner]');if(banner){banner.className='connection-banner ok';banner.textContent=t('Production en direct · Registre sécurisé · Passerelle de paiement en ligne en mode démo (virement bancaire actif).')}}catch(err){const banner=$('[data-connection-banner]');if(banner){banner.className='connection-banner error';banner.textContent=err.message;}$$('[data-api-state]').forEach(x=>x.textContent=t('HORS LIGNE'));if(err.code===401)location.replace('/studio/')}}
function openReceiptModal(idOrRef){
  const b=(state?.bookings||[]).find(x=>x.id==idOrRef||x.reference===idOrRef);
  if(!b)return showToast(t('Réservation introuvable.'));
  const charges=(state?.charges||[]).filter(c=>c.booking_id==b.id||c.reference===b.reference);
  const start=new Date(b.checkin+'T00:00:00Z'),end=new Date(b.checkout+'T00:00:00Z');
  const n=Math.max(1,Math.round((end-start)/86400000))||1;
  const rate=40000;
  const staySubtotal=n*rate;
  const chargesTotal=charges.reduce((sum,c)=>sum+(Number(c.amount_xaf)||0),0);
  const grandTotal=b.estimate_xaf?Number(b.estimate_xaf)+chargesTotal:staySubtotal+chargesTotal;
  const todayStr=state?.today||new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala'}).format(new Date());

  const chargeRows=charges.length?charges.map(c=>`
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:6px 8px;">${esc(c.label||t('Service complémentaire'))}</td>
      <td style="padding:6px 8px;text-align:center;">1</td>
      <td style="padding:6px 8px;text-align:right;">${money(c.amount_xaf)}</td>
      <td style="padding:6px 8px;text-align:right;"><strong>${money(c.amount_xaf)}</strong></td>
    </tr>`).join(''):'';

  const receiptHtml=`
    <div class="printable-receipt" id="printable-receipt" style="background:#fff;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="/experience/assets/original-sci-logo.png" alt="SCI Blue Ocean" style="height:48px;width:auto;object-fit:contain;" />
          <div>
            <h2 style="margin:0;font-size:15pt;font-family:Georgia,serif;color:#0f172a;letter-spacing:0.02em;">SCI BLUE OCEAN</h2>
            <p style="margin:2px 0;font-size:8.5pt;color:#475569;">Résidence Hôtelière Miague · Bonapriso, Douala, Cameroun</p>
            <small style="color:#64748b;font-size:8pt;">Service Réception & Facturation · Contact/WhatsApp: +62 812-9636-1446</small>
          </div>
        </div>
        <div style="text-align:right;">
          <span style="display:inline-block;padding:3px 8px;background:#0f172a;color:#fff;border-radius:4px;font-size:8pt;font-weight:700;letter-spacing:0.06em;">REÇU OFFICIEL DE SÉJOUR</span>
          <div style="font-size:12pt;font-weight:700;color:#0f172a;margin-top:4px;">N° ${esc(b.reference)}</div>
          <small style="color:#64748b;font-size:8pt;">Date : ${esc(todayStr)}</small>
        </div>
      </div>
      <hr style="border:none;border-top:1.5px solid #0f172a;margin:10px 0;" />
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;font-size:9pt;">
        <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;">
          <span style="font-size:7.5pt;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.05em;">Informations Client</span>
          <p style="margin:4px 0 2px;font-weight:700;color:#0f172a;font-size:10.5pt;">${esc(b.guest)}</p>
          <p style="margin:2px 0;color:#334155;">Tél : <strong>${esc(b.phone||'Non renseigné')}</strong></p>
          <p style="margin:2px 0;color:#334155;">E-mail : ${esc(b.email||'—')}</p>
          ${b.identity_number?`<p style="margin:2px 0;color:#334155;">Pièce : ${esc(b.identity_type||'ID')} ${esc(b.identity_number)}</p>`:''}
        </div>
        <div style="background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0;">
          <span style="font-size:7.5pt;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:0.05em;">Détails du Séjour</span>
          <p style="margin:4px 0 2px;font-weight:700;color:#0f172a;font-size:10.5pt;">${esc(roomDisplay(b.room_number)||'Studio Miague')}</p>
          <p style="margin:2px 0;color:#334155;">Arrivée : <strong>${esc(b.checkin)}</strong> (14:00)</p>
          <p style="margin:2px 0;color:#334155;">Départ : <strong>${esc(b.checkout)}</strong> (12:00)</p>
          <p style="margin:2px 0;color:#334155;">Durée : <strong>${n} nuits</strong> · ${b.guests||1} personne(s)</p>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:9pt;">
        <thead>
          <tr style="background:#f1f5f9;border-bottom:1.5px solid #cbd5e1;">
            <th style="padding:6px 8px;text-align:left;">Désignation</th>
            <th style="padding:6px 8px;text-align:center;">Qté / Nuits</th>
            <th style="padding:6px 8px;text-align:right;">Prix Unit. (XAF)</th>
            <th style="padding:6px 8px;text-align:right;">Total (XAF)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:6px 8px;">Hébergement - Studio Résidence Miague</td>
            <td style="padding:6px 8px;text-align:center;">${n}</td>
            <td style="padding:6px 8px;text-align:right;">${money(rate)}</td>
            <td style="padding:6px 8px;text-align:right;"><strong>${money(staySubtotal)}</strong></td>
          </tr>
          ${chargeRows}
          <tr style="border-top:1.5px solid #0f172a;font-weight:700;background:#f8fafc;">
            <td colspan="3" style="padding:8px;text-align:right;font-size:9.5pt;">TOTAL FACTURÉ :</td>
            <td style="padding:8px;text-align:right;font-size:10.5pt;color:#0f172a;">${money(grandTotal)}</td>
          </tr>
          <tr style="font-weight:700;background:#f8fafc;">
            <td colspan="3" style="padding:4px 8px;text-align:right;color:#059669;">RÈGLEMENT VALIDÉ (Virement Bancaire / Réception) :</td>
            <td style="padding:4px 8px;text-align:right;color:#059669;">${money(grandTotal)}</td>
          </tr>
          <tr style="font-weight:700;background:#f8fafc;border-bottom:1px solid #cbd5e1;">
            <td colspan="3" style="padding:4px 8px;text-align:right;color:#64748b;">SOLDE RESTANT DÛ :</td>
            <td style="padding:4px 8px;text-align:right;color:#64748b;">0 FCFA</td>
          </tr>
        </tbody>
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:14px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:8.5pt;">
        <div>
          <p style="margin:0 0 35px;color:#64748b;">Pour la Direction & Réception :</p>
          <p style="margin:0;font-weight:700;color:#0f172a;">SCI Blue Ocean · Cachet officiel</p>
        </div>
        <div style="text-align:right;">
          <p style="margin:0 0 35px;color:#64748b;">Signature du client :</p>
          <p style="margin:0;font-weight:700;color:#0f172a;">${esc(b.guest)}</p>
        </div>
      </div>
      <div class="receipt-print-actions" style="margin-top:16px;text-align:center;display:flex;justify-content:center;gap:10px;">
        <button type="button" class="studio-primary" data-action="print-receipt-dialog" style="padding:8px 18px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
          <svg aria-hidden="true" class="ui-icon" style="width:14px;height:14px;"><use href="/experience/assets/icons.svg#printer"></use></svg>
          Imprimer le reçu (A4)
        </button>
      </div>
    </div>`;

  const d=$('[data-dialog]');if(!d)return;
  $('[data-dialog-title]').textContent=t('Struk Penginapan / Reçu de séjour')+' · '+b.reference;
  $('[data-dialog-body]').innerHTML=receiptHtml;
  d.showModal();
}
function modal(title,content,onSubmit){const d=$('[data-dialog]');if(!d)return;const heading=$('[data-dialog-title]'),body=$('[data-dialog-body]');heading.textContent=t(title);body.innerHTML=content;const f=$('form',body);if(f)f.addEventListener('submit',async e=>{e.preventDefault();const obj=Object.fromEntries(new FormData(f).entries());const save=$('button[type=submit]',f);if(save)save.disabled=true;try{await onSubmit(obj);d.close();showToast('Enregistré dans la base des opérations.');await refresh()}catch(err){const error=$('.dialog-error',f);if(error)error.textContent=err.message;else showToast(err.message)}finally{if(save)save.disabled=false}});d.showModal()}
const field=(name,label,type='text',value='',required=true)=>`<label>${esc(t(label))}<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''}></label>`;
const formWrap=(html)=>`<form class="stack-form">${html}<p class="dialog-error form-response" role="status"></p><button class="studio-primary" type="submit">${esc(t('Enregistrer la demande ↗'))}</button></form>`;
function newBooking(){modal('Nouvelle demande de séjour',formWrap(field('guest','Nom du voyageur')+field('email','E-mail','email')+field('phone','Téléphone avec indicatif international','tel')+field('checkin','Arrivée','date')+field('checkout','Départ','date')+`<fieldset class="identity-options"><legend>${esc(t('Pièce d’identité'))}</legend><label><input type="radio" name="identity_type" value="CNI" required> CNI</label><label><input type="radio" name="identity_type" value="PASSPORT" required> ${esc(t('Passeport'))}</label></fieldset>`+field('identity_number','Numéro de CNI ou de passeport')+field('guests','Nombre de voyageurs','number','2')),async f=>api('/booking/create',{method:'POST',body:{...f,property:'miague',guests:Number(f.guests)}}))}
function newTask(){modal('Nouvelle tâche de préparation',formWrap(field('room','Chambre ou espace concerné','text','Studio 01')+field('title','Description de la tâche')),async f=>api('/task/create',{method:'POST',body:f}))}
function newMaintenance(){modal('Signaler une intervention',formWrap(field('room','Chambre ou espace concerné','text','Studio 01')+field('title','Intervention')+`<label>${esc(t('Priorité'))}<select name="priority"><option value="normal">${esc(t('Normale'))}</option><option value="low">${esc(t('Faible'))}</option><option value="urgent">${esc(t('Urgente'))}</option></select></label>`),async f=>api('/maintenance/create',{method:'POST',body:f}))}
function addCharge(){const options=(state?.bookings||[]).filter(x=>['confirmed','checked_in','checked_out'].includes(x.status)).map(x=>`<option value="${x.id}">${esc(x.reference)} — ${esc(x.guest)}</option>`).join('');if(!options)return showToast('Confirmez une réservation avant de saisir une charge.');modal('Ajouter une charge au folio',formWrap(`<label>${esc(t('Réservation'))}<select name="booking_id">${options}</select></label>`+field('label','Libellé','text',t('Service complémentaire'))+field('amount_xaf','Montant XAF (sans encaissement)','number','5000')),async f=>api('/folio/charge',{method:'POST',body:{...f,booking_id:Number(f.booking_id),amount_xaf:Number(f.amount_xaf)}}))}
async function writeAction(btn){const action=btn.dataset.write;
 if(action==='settle')return showToast('Encaissement en ligne non connecté.');
 const id=Number(btn.dataset.id);if(!id)return;const types={confirm:'booking/transition',cancel:'booking/transition',checkin:'booking/transition',checkout:'booking/transition'};const isBooking=action in types;const isTask=action.startsWith('task-'),isMaintenance=action.startsWith('maintenance-');if(!isBooking&&!isTask&&!isMaintenance)return;const selectedRoom=action==='confirm'?$(`[data-room-select="${id}"]`)?.value||'':'';if(action==='confirm'&&!selectedRoom)return showToast('Choisir une chambre');const risky=['cancel','checkout'].includes(action);if(risky&&!confirm(t('Confirmer cette opération ?')))return;const currentBooking=(state?.bookings||[]).find(x=>x.id==id);const today=state?.today||new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Douala'}).format(new Date());const early=action==='checkin'&&currentBooking&&today&&currentBooking.checkin>today;if(early&&!confirm(I.locale==='en'?`The arrival date is in the future (${currentBooking.checkin}). Confirm early check-in?`:`La date d’arrivée est future (${currentBooking.checkin}). Confirmer le check-in anticipé ?`))return;btn.disabled=true;try{let endpoint,payload;if(isBooking){endpoint='/booking/transition';payload={id,action,...(action==='confirm'?{room_number:selectedRoom}:{}),...(early?{early_checkin_confirmed:true}:{})}}else if(isTask){endpoint='/task/update';payload={id,status:action.slice(5)}}else{endpoint='/maintenance/update';payload={id,status:action.slice(12)}}await api(endpoint,{method:'POST',body:payload});showToast(action==='checkin'&&early?'Check-in anticipé enregistré.':'Transition enregistrée. Aucun paiement réel exécuté.');await refresh()}catch(err){if(action==='checkin'&&(err.message||'').includes('explicit confirmation')){if(confirm(I.locale==='en'?'This reservation has a future arrival date. Do you want to confirm early check-in?':'Cette réservation est prévue pour une date ultérieure. Confirmer le check-in anticipé ?')){try{await api('/booking/transition',{method:'POST',body:{id,action:'checkin',early_checkin_confirmed:true}});showToast('Check-in anticipé enregistré.');await refresh();return;}catch(retryErr){showToast(retryErr.message);}}}else{showToast(err.message);}}finally{btn.disabled=false}}
function dateStamp(){const date=$('[data-date-now]');if(date)date.textContent=new Intl.DateTimeFormat(I.dateLocale,{timeZone:'Africa/Douala',day:'2-digit',month:'short',year:'numeric'}).format(new Date());const time=$('[data-local-time]');if(time)time.textContent='Douala · '+new Intl.DateTimeFormat(I.dateLocale,{timeZone:'Africa/Douala',hour:'2-digit',minute:'2-digit'}).format(new Date())}
async function login(){const form=$('[data-studio-login]');if(!form)return;form.addEventListener('submit',async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));const out=$('[data-form-response]');const button=$('button[type=submit]',form);button.disabled=true;out.textContent='Vérification de la session locale…';try{const r=await api('/login',{method:'POST',body:data});session={csrf:r.csrf};location.href='/studio/dashboard/'}catch(err){out.textContent=err.message}finally{button.disabled=false}})}
async function studio(){if(page==='login')return login();try{session=await api('/me');if(!session.views.includes(page)){location.replace('/studio/dashboard/');return;}}catch{location.replace('/studio/');return;}
function sessionLabels(){const roleLabel=$('[data-role-label]');if(roleLabel)roleLabel.textContent=t(({reception:'Réception',manager:'Direction',housekeeping:'Housekeeping',finance:'Finance',maintenance:'Maintenance',owner:'Groupe'})[session.role]||'Personnel');$$('[data-current-scope]').forEach(x=>x.textContent=t('Site :')+' '+(session.property==='ALL'?t('Holding (lecture)'):'Résidence Miague'));}
sessionLabels();
$$('[data-need-view]').forEach(x=>{x.hidden=!session.views.includes(x.dataset.needView)});

// Pages whose functions are intentionally unavailable cannot present active controls.
if(!['reception','manager'].includes(session.role))$$('[data-action="new-booking"]').forEach(x=>x.hidden=true);
if(!['housekeeping','manager'].includes(session.role))$$('[data-action="new-task"]').forEach(x=>x.hidden=true);
if(!['maintenance','manager','reception'].includes(session.role))$$('[data-action="new-maintenance"]').forEach(x=>x.hidden=true);
if(session.role==='finance'||session.role==='manager'){$('[data-table="folios"]')?.closest('.studio-panel')?.querySelector('.panel-heading')?.insertAdjacentHTML('beforeend',`<button class="studio-primary" data-action="add-charge">${esc(t('+ Charge'))}</button>`);}
const shell=$('.studio-shell');const sidebar=$('.studio-sidebar');
const isMobile=()=>window.innerWidth<=1024;
const setSidebar=(collapsed)=>{
  if(isMobile()){sidebar?.classList.toggle('mobile-open',!collapsed);}
  else{shell?.classList.toggle('sidebar-collapsed',collapsed);localStorage.setItem('blueocean-sidebar-collapsed',collapsed?'true':'false');}
};
if(!isMobile()&&localStorage.getItem('blueocean-sidebar-collapsed')==='true'){setSidebar(true);}
$('[data-studio-menu]')?.addEventListener('click',()=>{
  const isHidden=isMobile()?!sidebar?.classList.contains('mobile-open'):shell?.classList.contains('sidebar-collapsed');
  setSidebar(!isHidden);
});
$('[data-sidebar-close]')?.addEventListener('click',()=>setSidebar(true));
$('[data-dialog-close]')?.addEventListener('click',()=>$('[data-dialog]')?.close());
$('[data-dialog]')?.addEventListener('click',e=>{if(e.target.hasAttribute('data-dialog'))e.target.close()});
document.addEventListener('click',async e=>{const day=e.target.closest('[data-calendar-date]');if(day){showOccupiedDate(day.dataset.calendarDate);return}const write=e.target.closest('[data-write]');if(write){await writeAction(write);return}const control=e.target.closest('[data-action]');if(!control)return;switch(control.dataset.action){case 'print-report':window.print();return;case 'print-booking-receipt':openReceiptModal(control.dataset.id||control.dataset.ref);return;case 'print-receipt-dialog':document.body.classList.add('printing-receipt');window.print();setTimeout(()=>document.body.classList.remove('printing-receipt'),500);return;case 'refresh':return refresh();case 'new-booking':return newBooking();case 'new-task':return newTask();case 'new-maintenance':return newMaintenance();case 'add-charge':return addCharge();case 'month-prev':month.setMonth(month.getMonth()-1);return renderCalendar(state?.calendar_bookings||state?.bookings||[]);case 'month-next':month.setMonth(month.getMonth()+1);return renderCalendar(state?.calendar_bookings||state?.bookings||[]);case 'logout':try{await api('/logout',{method:'POST',body:{}})}finally{location.href='/studio/'};}});
$('[data-filter-search]')?.addEventListener('input',draw);$('[data-filter-status]')?.addEventListener('change',draw);
document.addEventListener('studio:localechange',event=>{sessionLabels();dateStamp();draw();const banner=$('[data-connection-banner]');if(banner?.classList.contains('ok'))banner.textContent=t('Production en direct · Registre sécurisé · Passerelle de paiement en ligne en mode démo (virement bancaire actif).');$$('[data-api-state]').forEach(x=>x.textContent=t(state?'CONNECTÉ':'HORS LIGNE'));const charge=$('[data-action="add-charge"]');if(charge)charge.textContent=t('+ Charge');if($('[data-dialog]')?.open)window.StudioI18n?.translateDynamic($('[data-dialog]'),event.detail.previous);});
dateStamp();await refresh();}
studio().catch(err=>{console.error(err);showToast(t('Erreur Studio :')+' '+err.message)});
})();
