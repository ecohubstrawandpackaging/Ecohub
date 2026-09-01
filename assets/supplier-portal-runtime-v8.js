(async function(){
'use strict';
const bootMsg=document.getElementById('bootMsg');
function fail(e){console.error('Supplier Portal V8 runtime error',e);if(bootMsg)bootMsg.textContent='Portal runtime error: '+(e&&e.message?e.message:String(e));}
try{
  if(bootMsg)bootMsg.textContent='Starting supplier portal…';
  const r=await fetch('assets/supplier-portal-v5.js?source=20260901-production-tracker-v1',{cache:'no-store'});
  if(!r.ok)throw new Error('Could not load supplier application script ('+r.status+').');
  let code=await r.text();
  const broken='map.style.opacity=map.disabled?.55:1';
  const fixed='map.style.opacity=map.disabled ? .55 : 1';
  if(code.includes(broken)) code=code.replaceAll(broken,fixed);
  if(code.includes(broken))throw new Error('Known JavaScript syntax bug was not fully repaired.');
  new Function(code+'\n//# sourceURL=supplier-portal-v8-runtime.js')();
}catch(e){fail(e);}
})();
