/* Account credentials and MFA secrets are never persisted in browser storage. */
(()=>{'use strict';
const form=document.querySelector('[data-account-login]');
if(!form)return;
const passwordInput=form.elements.namedItem('password'),toggle=form.querySelector('[data-password-toggle]');
toggle?.addEventListener('click',()=>{const show=passwordInput.type==='password';passwordInput.type=show?'text':'password';toggle.setAttribute('aria-pressed',String(show));toggle.textContent=(window.StudioI18n?.t||((x)=>x))(show?'Masquer le mot de passe':'Afficher le mot de passe');});
window.addEventListener('pagehide',()=>{passwordInput.type='password';});
const message=form.querySelector('[role=status]'),submit=form.querySelector('button[type=submit]');
form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;message.textContent=window.StudioI18n?.locale==='en'?'Checking your account…':'Vérification de votre compte…';
try{const fields=new FormData(form);const response=await fetch('/api/staff/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({username:fields.get('username'),password:fields.get('password')})});const data=await response.json();if(!response.ok)throw Error(data.error||'Connexion impossible.');form.elements.password.value='';location.assign('/studio/dashboard/');}
catch(error){const t=window.StudioI18n?.t||((x)=>x);const fallback=window.StudioI18n?.locale==='en'?'Service unavailable. Try again.':'Service indisponible. Réessayez.';const known=['Invalid credentials','Too many attempts. Try again later.','Authentication required','Access denied','CSRF token required'];message.textContent=known.includes(error.message)?t(error.message):fallback;submit.disabled=false;}});
})();
