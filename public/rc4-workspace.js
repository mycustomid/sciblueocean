/* RC4 independent progressive enhancement. No access-control or backend claims. */
(()=>{'use strict';
const helpTrigger=document.createElement('button');helpTrigger.type='button';helpTrigger.className='rc-help-toggle';helpTrigger.id='rcHelpToggle';helpTrigger.textContent='?';helpTrigger.setAttribute('aria-label','Aide / Help');helpTrigger.setAttribute('aria-controls','rcHelpPanel');helpTrigger.setAttribute('aria-expanded','false');helpTrigger.setAttribute('title','Aide / Help');
const help=document.createElement('section');help.id='rcHelpPanel';help.className='rc-help-panel';help.hidden=true;help.setAttribute('role','dialog');help.setAttribute('aria-modal','false');help.setAttribute('aria-label','Help and demonstration information');
help.innerHTML='<button type="button" class="rc-help-close" aria-label="Close help panel">×</button><h2>Workstation guide / Guide des postes</h2><p><strong>Demo only.</strong> Selecting a role is not secure authentication. Data is stored only in this browser. Do not enter real customer, banking, payroll or identity information.</p><p>Explore the nine products in the portal, then choose a workstation to view its business workflow. Transactions are examples and do not sync with an enterprise database.</p><p>Shortcut: <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>K</kbd> — search products.</p><p><a href="https://bluelinecapitale.vercel.app/en/" target="_blank" rel="noopener noreferrer">Blue Line corporate website ↗</a></p>';
function hide(){help.hidden=true;helpTrigger.setAttribute('aria-expanded','false');helpTrigger.focus({preventScroll:true})}
helpTrigger.addEventListener('click',()=>{const open=help.hidden;help.hidden=!open;helpTrigger.setAttribute('aria-expanded',String(open));if(open)help.querySelector('.rc-help-close').focus()});
help.querySelector('.rc-help-close').addEventListener('click',hide);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!help.hidden)hide()});
document.addEventListener('pointerdown',e=>{if(!help.hidden&&!help.contains(e.target)&&e.target!==helpTrigger){help.hidden=true;helpTrigger.setAttribute('aria-expanded','false')}});
const mount=()=>{const actions=document.querySelector('.topbar-actions');if(actions&&!actions.contains(helpTrigger)){actions.insertBefore(helpTrigger,actions.firstChild);document.body.append(help);}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
