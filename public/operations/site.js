/* Blue Ocean Guest V3: explicit locale-specific templates; no text replacements. */
(()=>{'use strict';
const lang=document.documentElement.lang==='en'?'en':'fr';
document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const dest=new URL(link.href,location.href);if(dest.origin===location.origin&&dest.pathname==='/studio/'){try{localStorage.setItem('bo_studio_locale',lang)}catch{}}});
const L={fr:{date:'Veuillez sélectionner des dates valides (1 à 180 nuits).',error:'La connexion au service de réservation est indisponible. Aucune demande n’a été envoyée.',sent:'Demande enregistrée. Référence',copy:'Copier la référence',copied:'Référence copiée',pending:'En attente de confirmation',confirmed:'Confirmée',status:'Statut',price:'Montant indicatif',payment:'Paiement',unavailable:'Aucune chambre Miague n’est libre pour ces dates.',onlyInterest:'Projet en construction : inscription d’intérêt seulement.',interestSent:'Votre intérêt a été enregistré dans notre registre.',contactSent:'Message enregistré dans notre registre.',request:'Poursuivre la demande',view:'Voir la résidence',money:'FCFA',availability:'Disponibilité à confirmer par l’équipe.',unconnected:'Demande en attente de confirmation par notre équipe.',after:'L’encaissement en ligne est non connecté. Contactez la résidence pour organiser le règlement.',checkout:'Accéder au paiement sécurisé',noCharge:'Encaissement en ligne non connecté. Aucun compte n’est débité.',noFake:'Encaissement en ligne non connecté. Contactez la résidence pour organiser le règlement.',noMatch:'Aucune demande trouvée avec cette référence et cet e-mail.',nights:'nuits',from:'Dès'},
 en:{date:'Choose valid dates (1–180 nights).',error:'The reservation service is unavailable. No booking request was sent.',sent:'Request saved. Reference',copy:'Copy reference',copied:'Reference copied',pending:'Awaiting confirmation',confirmed:'Confirmed',status:'Status',price:'Indicative amount',payment:'Payment',unavailable:'No Miague rooms are available for these dates.',onlyInterest:'Under construction: expression of interest only.',interestSent:'Your interest was saved in our register.',contactSent:'Your message was saved in our register.',request:'Continue with request',view:'Explore property',money:'FCFA',availability:'Final availability is confirmed by the team.',unconnected:'Your request needs confirmation from our team.',after:'Online payments are not connected. Contact the property to arrange payment.',checkout:'Open secure checkout',noCharge:'Online payments are not connected. No account is charged.',noFake:'Online payments are not connected. Contact the property to arrange payment.',noMatch:'No request matches that reference and email.',nights:'nights',from:'From'}}[lang];
const q=(s,p=document)=>p.querySelector(s),qa=(s,p=document)=>[...p.querySelectorAll(s)];
const cash=x=>`${Number(x||0).toLocaleString(lang==='fr'?'fr-FR':'en-US')} FCFA`;
const get=(form,name)=>form?.elements.namedItem(name)?.value?.trim()||'';
const url=(path)=>'/experience/'+(lang==='en'?'en/':'')+path;
const xss=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const QS=params=>new URLSearchParams(params).toString();
// The API returns server messages in English; show only known, localized messages.
const publicErrors={
 'A valid phone number is required':['Veuillez saisir un numéro de téléphone valide, avec l’indicatif du pays.','Please enter a valid phone number, including the country code.'],
 'Valid guest name and email required':['Veuillez saisir un nom et une adresse e-mail valides.','Please enter a valid name and email address.'],
 'Valid guest name and email are required':['Veuillez saisir un nom et une adresse e-mail valides.','Please enter a valid name and email address.'],
 'Invalid check-in/check-out date format':['Veuillez saisir des dates valides.','Please enter valid dates.'],
 'Dates must be YYYY-MM-DD':['Veuillez saisir des dates valides.','Please enter valid dates.'],
 'Check-in date cannot be in the past':['La date d’arrivée ne peut pas être passée.','The check-in date cannot be in the past.'],
 'Arrival date must be today or later':['La date d’arrivée doit être aujourd’hui ou plus tard.','The check-in date must be today or later.'],
 'Choose a stay of 1 to 180 nights':['Choisissez un séjour de 1 à 180 nuits.','Choose a stay of 1 to 180 nights.'],
 'Length of stay must be 1–180 nights':['Choisissez un séjour de 1 à 180 nuits.','Choose a stay of 1 to 180 nights.'],
 'Guests must be between 1 and 6':['Choisissez entre 1 et 6 voyageurs.','Choose between 1 and 6 guests.'],
 'Guests must be an integer':['Choisissez un nombre entier de voyageurs.','Choose a whole number of guests.'],
 'Dates unavailable in demo inventory':['Aucune chambre n’est disponible pour ces dates.','No rooms are available for these dates.'],
 'Only future residences accept interest':['Sélectionnez une résidence en développement.','Select a residence under development.'],
 'Message too short':['Veuillez saisir un message plus détaillé.','Please enter a longer message.'],
 'No matching request':['Aucune demande ne correspond à cette référence et cet e-mail.','No request matches this reference and email.'],
 'Too many requests':['Trop de demandes. Veuillez réessayer plus tard.','Too many requests. Please try again later.'],
 'Request identifier already used for different booking details':['Les détails ont changé. Vérifiez-les avant de réessayer.','Your details have changed. Check them before retrying.']
};
window.BOPublicError=(message,status)=>{const known=publicErrors[message];if(known)return known[lang==='fr'?0:1];if(status===429)return lang==='fr'?'Trop de demandes. Veuillez réessayer plus tard.':'Too many requests. Please try again later.';if(status>=400&&status<500)return lang==='fr'?'Vérifiez les informations saisies et réessayez.':'Check the information entered and try again.';return lang==='fr'?'Le service est indisponible. Veuillez réessayer.':'The service is unavailable. Please try again.';};
const statusLabels={pending:['En attente','Pending'],confirmed:['Confirmée','Confirmed'],checked_in:['En séjour','Checked in'],checked_out:['Séjour terminé','Checked out'],cancelled:['Annulée','Cancelled'],awaiting_payment:['En attente de paiement','Awaiting payment'],paid:['Payé','Paid']};
const localizedStatus=value=>{const pair=statusLabels[value];return pair?pair[lang==='fr'?0:1]:(lang==='fr'?'Non disponible':'Unavailable')};
function nights(a,b){const start=new Date(a+'T00:00:00Z'),end=new Date(b+'T00:00:00Z');const n=Math.round((end-start)/86400000);if(!Number.isFinite(n)||n<1||n>180||start<new Date(new Date().toISOString().slice(0,10)+'T00:00:00Z'))throw Error(L.date);return n;}
function result(form,html,error=false){const el=q('[data-form-result]',form);if(el){el.classList.toggle('error',error);el.innerHTML=html;}else{const toast=q('[data-toast]');if(toast){toast.textContent=html.replace(/<[^>]+>/g,'');toast.hidden=false;setTimeout(()=>toast.hidden=true,6500)}}}
async function api(path,options={}){const res=await fetch('/api/booking'+path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},cache:'no-store',...options});let data;try{data=await res.json()}catch{throw Error(L.error)}if(!res.ok)throw Error(window.BOPublicError(data.error,res.status));return data;}
const toggle=q('[data-menu-toggle]');const mobile=q('#mobile-nav');toggle?.addEventListener('click',()=>{const show=mobile.hasAttribute('hidden');mobile.toggleAttribute('hidden',!show);toggle.setAttribute('aria-expanded',String(show));});
qa('details.locale').forEach(d=>{document.addEventListener('click',e=>{if(!d.contains(e.target))d.removeAttribute('open')});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&d.open){d.open=false;d.querySelector('summary')?.focus()}})});
const param=new URLSearchParams(location.search); const today=new Date().toISOString().slice(0,10);
qa('input[type=date]').forEach(i=>{
  i.min=today;i.max='2099-12-31';
  if(param.has(i.name)&&/^\d{4}-\d\d-\d\d$/.test(param.get(i.name)))i.value=param.get(i.name);
  if(i.name==='checkin'){
    i.addEventListener('change',()=>{
      const form=i.closest('form');
      const checkout=form?.elements.namedItem('checkout');
      if(checkout&&i.value){
        checkout.min=i.value;
        if(checkout.value&&checkout.value<=i.value){
          checkout.value=new Date(Date.parse(i.value+'T00:00:00Z')+86400000).toISOString().slice(0,10);
          checkout.dispatchEvent(new Event('input',{bubbles:true}));
          checkout.dispatchEvent(new Event('change',{bubbles:true}));
        }
      }
    });
  }
  i.addEventListener('input',()=>{
    if(i.value&&i.value.length>10){
      const parts=i.value.split('-');
      if(parts[0]&&parts[0].length>4){parts[0]=parts[0].slice(0,4);i.value=parts.join('-');}
    }
  });
});
qa('.sf-field').forEach(field=>{
  field.style.cursor='pointer';
  field.addEventListener('click',e=>{
    const input=field.querySelector('input,select');
    if(input&&e.target!==input&&!e.target.closest('label')){
      input.focus();
      if(typeof input.showPicker==='function')try{input.showPicker();}catch{}
    }
  });
});
qa('select[name=property],select[name=guests]').forEach(s=>{if(param.has(s.name)&&[...s.options].some(o=>o.value===param.get(s.name)))s.value=param.get(s.name)});
qa('[data-search-bar]').forEach(f=>{f.addEventListener('submit',e=>{try{nights(get(f,'checkin'),get(f,'checkout'))}catch(err){e.preventDefault();result(f,xss(err.message),true)}})});
qa('[data-filter]').forEach(b=>b.addEventListener('click',()=>{qa('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));qa('[data-filter-grid] .property-card').forEach(card=>{card.hidden=b.dataset.filter!=='all'&&card.dataset.status!==b.dataset.filter;card.style.display=card.hidden?'none':'';})}));
const quotes=q('[data-stay-quote]');function quote(form){if(!quotes)return;try{const n=nights(get(form,'checkin'),get(form,'checkout'));quotes.textContent=`${n} ${L.nights} × ${cash(40000)} = ${cash(n*40000)}`;}catch{quotes.textContent=L.availability;}}
const book=q('[data-guest-booking]');
function saveGuestContext(reference,email){try{sessionStorage.setItem('bo_guest_context',JSON.stringify({reference,email,expires:Date.now()+600000}));}catch{}}
function consumeGuestContext(form){try{const raw=sessionStorage.getItem('bo_guest_context');sessionStorage.removeItem('bo_guest_context');if(!raw)return false;const data=JSON.parse(raw);if(data.expires<Date.now()||typeof data.reference!=='string'||typeof data.email!=='string')return false;form.elements.namedItem('reference').value=data.reference;form.elements.namedItem('email').value=data.email;return true;}catch{return false;}}
if(book){
 const submit=q('button[type=submit]',book);let attempt=null,saved=false,submitting=false,quoteState='empty';
 const syncSubmit=()=>{submit.disabled=saved||submitting||quoteState==='unavailable';};
 const payload=()=>({property:'miague',checkin:get(book,'checkin'),checkout:get(book,'checkout'),guests:+get(book,'guests'),guest:get(book,'guest'),email:get(book,'email'),phone:get(book,'phone')});
 ['checkin','checkout','guests'].forEach(key=>{if(param.has(key))book.elements.namedItem(key).value=param.get(key)});
 book.addEventListener('bo:quote-state',event=>{quoteState=event.detail.state;book.dataset.available=quoteState==='available'?'yes':quoteState==='unavailable'?'no':quoteState;syncSubmit();});
 book.addEventListener('input',event=>{if(event.target.matches('input,select')){if(saved){saved=false;result(book,'');}if(['checkin','checkout','guests'].includes(event.target.name)){quoteState='checking';book.dataset.available='checking';}syncSubmit();}});
 quote(book);syncSubmit();
 book.addEventListener('submit',async event=>{
   event.preventDefault();if(saved||submitting)return;submitting=true;syncSubmit();
   try{
     nights(get(book,'checkin'),get(book,'checkout'));
     if(!book.elements.namedItem('ack').checked)throw Error(lang==='fr'?'Veuillez accepter les conditions de la demande.':'Please accept the booking request terms.');
     const data=payload(),fingerprint=JSON.stringify(data);
     if(!attempt||attempt.fingerprint!==fingerprint)attempt={id:crypto.randomUUID(),fingerprint};
     const live=await api('/public/quote?'+QS({property:'miague',checkin:data.checkin,checkout:data.checkout,guests:data.guests}));
     if(!live.available){quoteState='unavailable';book.dataset.available='no';throw Error(L.unavailable);}
     quoteState='available';book.dataset.available='yes';
     const answer=await api('/public/request',{method:'POST',body:JSON.stringify({...data,request_id:attempt.id})});
     saveGuestContext(answer.reference,data.email);saved=true;
     const waMsg=lang==='fr'?`Bonjour, voici la preuve de virement pour la réservation ${answer.reference}`:`Hello, here is the payment proof for booking ${answer.reference}`;
     const waUrl=`https://wa.me/6281296361446?text=${encodeURIComponent(waMsg)}`;
     result(book,`<div><strong>${L.sent}: <code>${xss(answer.reference)}</code></strong></div>
<p>${L.pending} · ${xss(data.checkin)} → ${xss(data.checkout)} · ${data.guests} ${lang==='fr'?'voyageurs':'guests'}</p>
<p>${L.price}: ${cash(answer.estimate_xaf)}</p>
<p>${L.after}</p>
<div style="margin:16px 0;display:flex;flex-wrap:wrap;gap:10px;">
<a class="button primary" style="background:#25D366;border-color:#25D366;color:#ffffff;display:inline-flex;align-items:center;gap:8px;font-weight:700;" href="${waUrl}" target="_blank" rel="noopener noreferrer">
  <svg class="icon" aria-hidden="true" style="stroke:currentColor;fill:none;width:18px;height:18px;"><use href="/experience/assets/icons.svg#arrow-up-right"></use></svg>
  ${lang==='fr'?'Envoyer preuve WhatsApp (+62 812-9636-1446)':'Send transfer proof via WhatsApp (+62 812-9636-1446)'}
</a>
<button type="button" class="button outline" data-copy="${xss(answer.reference)}">${L.copy}</button>
<button type="button" class="button outline" data-action="print-customer-voucher" style="display:inline-flex;align-items:center;gap:6px;"><svg class="icon" aria-hidden="true" style="stroke:currentColor;fill:none;width:15px;height:15px;"><use href="/experience/assets/icons.svg#printer"></use></svg>${lang==='fr'?'Imprimer le reçu':'Print voucher'}</button>
<a class="button outline" href="${url('manage/?reference='+encodeURIComponent(answer.reference)+'&email='+encodeURIComponent(data.email))}" data-track-booking>${lang==='fr'?'Suivre ma demande':'Track my request'}</a>
</div>`);
     book.dataset.available='submitted';
   }catch(error){result(book,xss(error.message),true);}finally{submitting=false;syncSubmit();}
 });
 book.addEventListener('click',async event=>{const button=event.target.closest('[data-copy]');if(!button)return;try{await navigator.clipboard.writeText(button.dataset.copy);button.textContent=L.copied}catch{button.textContent=button.dataset.copy}});
}
async function lookup(form){const reference=get(form,'reference'),email=get(form,'email');const data=await api('/public/lookup',{method:'POST',body:JSON.stringify({reference,email})});return data.booking;}
const manage=q('[data-booking-lookup]');manage?.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const b=await lookup(manage);
    const waMsg=lang==='fr'?`Bonjour, voici la preuve de virement pour la réservation ${b.reference}`:`Hello, here is the payment proof for booking ${b.reference}`;
    const waUrl=`https://wa.me/6281296361446?text=${encodeURIComponent(waMsg)}`;
    result(manage,`<strong>${xss(b.reference)}</strong>
<p>${xss(b.checkin)} → ${xss(b.checkout)} · ${xss(b.guests??'—')} ${lang==='fr'?'voyageurs':'guests'}</p>
<p>${L.status}: <strong>${xss(localizedStatus(b.status))}</strong></p>
<p>${L.price}: ${cash(b.estimate_xaf)}</p>
<p>${L.payment}: ${b.payment?.state?xss(localizedStatus(b.payment.state)):(lang==='fr'?'Non initié (virement / WhatsApp)':'Not initiated (transfer / WhatsApp)')}</p>
<div style="margin:16px 0;display:flex;flex-wrap:wrap;gap:10px;">
<a class="button primary" style="background:#25D366;border-color:#25D366;color:#ffffff;display:inline-flex;align-items:center;gap:8px;font-weight:700;" href="${waUrl}" target="_blank" rel="noopener noreferrer">
  <svg class="icon" aria-hidden="true" style="stroke:currentColor;fill:none;width:18px;height:18px;"><use href="/experience/assets/icons.svg#arrow-up-right"></use></svg>
  ${lang==='fr'?'Envoyer preuve WhatsApp (+62 812-9636-1446)':'Send transfer proof via WhatsApp (+62 812-9636-1446)'}
</a>
<button type="button" class="button outline" data-action="print-customer-voucher" style="display:inline-flex;align-items:center;gap:6px;"><svg class="icon" aria-hidden="true" style="stroke:currentColor;fill:none;width:15px;height:15px;"><use href="/experience/assets/icons.svg#printer"></use></svg>${lang==='fr'?'Imprimer le bon de séjour':'Print stay voucher'}</button>
<a class="button outline" href="${url('payment/')}">${L.payment}</a>
</div>`);
  }catch(err){result(manage,xss(err.message),true)}
});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-action="print-customer-voucher"]');if(btn)window.print();});
if(manage){
  if(param.has('reference')&&param.has('email')){
    manage.elements.namedItem('reference').value=param.get('reference');
    manage.elements.namedItem('email').value=param.get('email');
    manage.requestSubmit();
  } else if(consumeGuestContext(manage)){
    manage.requestSubmit();
  }
}
const pay=q('[data-payment-lookup]');pay?.addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const b=await lookup(pay);
    const waMsg=lang==='fr'?`Bonjour, voici la preuve de virement pour la réservation ${b.reference}`:`Hello, here is the payment proof for booking ${b.reference}`;
    const waUrl=`https://wa.me/6281296361446?text=${encodeURIComponent(waMsg)}`;
    result(pay,`<strong>${xss(b.reference)}</strong>
<p>${L.status}: ${xss(localizedStatus(b.status))}</p>
<p>${L.price}: ${cash(b.estimate_xaf)}</p>
<p>${L.noFake}</p>
<div style="margin:16px 0;">
<a class="button primary" style="background:#25D366;border-color:#25D366;color:#ffffff;display:inline-flex;align-items:center;gap:8px;font-weight:700;" href="${waUrl}" target="_blank" rel="noopener noreferrer">
  <svg class="icon" aria-hidden="true" style="stroke:currentColor;fill:none;width:18px;height:18px;"><use href="/experience/assets/icons.svg#arrow-up-right"></use></svg>
  ${lang==='fr'?'Envoyer preuve WhatsApp (+62 812-9636-1446)':'Send transfer proof via WhatsApp (+62 812-9636-1446)'}
</a>
</div>`);
  }catch(err){result(pay,xss(err.message),true)}
});
const interest=q('[data-interest-form]');interest?.addEventListener('submit',async e=>{e.preventDefault();const b=q('button[type=submit]',interest);b.disabled=true;try{const data=await api('/public/interest',{method:'POST',body:JSON.stringify({property:get(interest,'property'),guest:get(interest,'guest'),email:get(interest,'email'),movein:get(interest,'movein'),message:get(interest,'message')})});result(interest,`${L.interestSent} <strong>${xss(data.reference)}</strong>`);interest.reset()}catch(err){result(interest,xss(err.message),true)}finally{b.disabled=false}});
const contact=q('[data-contact]');contact?.addEventListener('submit',async e=>{e.preventDefault();const b=q('button[type=submit]',contact);b.disabled=true;try{const data=await api('/public/contact',{method:'POST',body:JSON.stringify({guest:get(contact,'guest'),email:get(contact,'email'),reason:get(contact,'reason'),message:get(contact,'message'),website:get(contact,'website')})});result(contact,`${L.contactSent} <strong>${xss(data.reference)}</strong>`);contact.reset()}catch(err){result(contact,xss(err.message),true)}finally{b.disabled=false}});
const selectedStay={};for(const key of ['checkin','checkout','guests'])if(param.has(key))selectedStay[key]=param.get(key);if(Object.keys(selectedStay).length)qa('a[href]').forEach(a=>{const target=new URL(a.href,location.href);if(target.origin===location.origin&&(/\/stays\/miague\/$/.test(target.pathname)||/\/booking\/$/.test(target.pathname))){for(const [key,value]of Object.entries(selectedStay))target.searchParams.set(key,value);a.href=target.pathname+target.search;}});
const searchResults=q('[data-search-results]');if(searchResults&&param.has('checkin')&&param.has('checkout')){const a=param.get('checkin'),b=param.get('checkout'),selected=param.get('property')||'all';try{const n=nights(a,b);const cards=qa('.property-card',searchResults);cards.forEach(card=>{if(selected!=='all'&&!card.querySelector('h3')?.textContent.toLowerCase().includes(selected==='miague'?'miague':selected)){card.hidden=true;card.style.display='none';}const p=q('.property-copy>p',card);if(p&&card.dataset.status==='active')p.textContent=`${n} ${L.nights} · ${L.availability}`;const btn=q('.round-link',card);if(btn&&card.dataset.status==='active')btn.href=url('booking/?'+QS({checkin:a,checkout:b,guests:param.get('guests')||2}))});const count=q('.results-title>span');if(count)count.textContent=String(cards.filter(card=>!card.hidden).length).padStart(2,'0');api('/public/quote?'+QS({checkin:a,checkout:b,guests:param.get('guests')||1,property:'miague'})).then(data=>{const card=q('.property-card[data-status=active]',searchResults);if(card&&data.available){const p=q('.property-copy>p',card);if(p)p.textContent=`${data.nights} ${L.nights} · ${cash(data.total_estimate_xaf)} · ${L.availability}`;}if(!data.available){const card=q('.property-card[data-status=active]',searchResults);if(card){card.classList.add('unavailable');q('.property-copy>p',card).textContent=L.unavailable;q('.round-link',card).href=url('stays/miague/')}}}).catch(()=>{const p=document.createElement('p');p.className='info-note';p.textContent=L.unconnected;searchResults.prepend(p)});}catch(err){searchResults.innerHTML=`<p class="info-note">${xss(err.message)}</p>`}}
const dialog=q('[data-gallery-dialog]');qa('[data-lightbox]').forEach(b=>b.addEventListener('click',()=>{if(dialog){q('img',dialog).src=b.dataset.lightbox;dialog.showModal()}}));q('[data-close-dialog]')?.addEventListener('click',()=>dialog?.close());dialog?.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
})();
