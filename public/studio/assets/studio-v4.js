/* V4: Manager-only entry point for demo pricing; server enforces permissions. */
(async()=>{'use strict';try{const res=await fetch('/api/demo/me',{credentials:'same-origin',cache:'no-store'});if(!res.ok)return;const identity=await res.json();if(identity.role==='manager'){document.querySelectorAll('[data-manager-only]').forEach(el=>el.hidden=false);}}catch{}})();
