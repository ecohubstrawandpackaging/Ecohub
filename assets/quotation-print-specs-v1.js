(function(){
'use strict';
let E=null,scheduled=false;
const draft=new Map();
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=(q,i)=>String(q||'')+'::'+String(i||'');
const qno=()=>String(document.querySelector('#f-number')?.value||'').trim();
const savedQ=n=>E?.state?.quotations?.find(q=>q&&q.number===n)||null;
const savedI=(q,i)=>savedQ(q)?.items?.find(x=>x&&x.id===i)||null;
function productFor(tr){const code=String(tr?.querySelector('.c-product')?.value||'');return (E?.state?.products||[]).find(p=>p&&p.code===code)||null;}
function isPrinted(tr,it){const p=productFor(tr);return String(p?.category||it?.category||'').toLowerCase()==='printed cups'||it?.supplierRoute==='PRINTING'||it?.printingRequired===true;}
function value(q,i,tr){
  const k=key(q,i);if(draft.has(k))return draft.get(k);
  const it=savedI(q,i)||{};
  const required=it.printingRequired!=null?!!it.printingRequired:isPrinted(tr,it);
  return {required,logoColor:it.logoColor||'',printSides:it.printSides||'One Side',artworkStatus:it.artworkStatus||'For Mockup',mockupLink:it.mockupLink||'',printNotes:it.printNotes||''};
}
function inject(){
  if(!E)return;const body=document.querySelector('#q-items-body'),q=qno();if(!body||!q)return;
  body.querySelectorAll('tr[data-id]').forEach(tr=>{
    const id=tr.dataset.id;if(!id)return;const alloc=body.querySelector('tr[data-alloc-for="'+CSS.escape(id)+'"]');if(!alloc)return;
    const td=alloc.querySelector('td');if(!td||td.querySelector('.ecohub-print-specs'))return;
    const v=value(q,id,tr),box=document.createElement('div');box.className='ecohub-print-specs';
    box.style.cssText='margin-top:9px;padding:10px;border-top:1px dashed var(--line);background:#faf8f3;border-radius:8px;display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:8px';
    box.innerHTML='<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Send to Printing Portal<select data-print-required style="width:100%;margin-top:4px"><option value="yes" '+(v.required?'selected':'')+'>Yes — Printing Required</option><option value="no" '+(!v.required?'selected':'')+'>No — Packaging Only</option></select></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Logo / Ink Color<input data-logo-color value="'+esc(v.logoColor)+'" placeholder="White, Black, 2 colors…" style="width:100%;margin-top:4px"></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Print Sides<select data-print-sides style="width:100%;margin-top:4px"><option '+(v.printSides==='One Side'?'selected':'')+'>One Side</option><option '+(v.printSides==='Front & Back'?'selected':'')+'>Front &amp; Back</option><option '+(v.printSides==='Wrap Around'?'selected':'')+'>Wrap Around</option></select></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Artwork Status<select data-artwork-status style="width:100%;margin-top:4px"><option '+(v.artworkStatus==='For Mockup'?'selected':'')+'>For Mockup</option><option '+(v.artworkStatus==='Mockup Ready'?'selected':'')+'>Mockup Ready</option><option '+(v.artworkStatus==='Client Approved'?'selected':'')+'>Client Approved</option><option '+(v.artworkStatus==='Ready for Printing'?'selected':'')+'>Ready for Printing</option></select></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Mockup Link<input data-mockup-link value="'+esc(v.mockupLink)+'" placeholder="Drive / Canva link" style="width:100%;margin-top:4px"></label>'+
      '<label style="grid-column:1/-1;font-size:10.5px;font-weight:800;color:var(--ink-soft)">Printing Notes<input data-print-notes value="'+esc(v.printNotes)+'" placeholder="Exact placement, ink instruction, back-to-back details…" style="width:100%;margin-top:4px"></label>';
    td.appendChild(box);
    const save=()=>draft.set(key(q,id),{required:box.querySelector('[data-print-required]').value==='yes',logoColor:box.querySelector('[data-logo-color]').value.trim(),printSides:box.querySelector('[data-print-sides]').value,artworkStatus:box.querySelector('[data-artwork-status]').value,mockupLink:box.querySelector('[data-mockup-link]').value.trim(),printNotes:box.querySelector('[data-print-notes]').value.trim()});
    box.querySelectorAll('input,select').forEach(x=>x.addEventListener(x.tagName==='SELECT'?'change':'input',save));
  });
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;try{inject()}catch(err){console.error('Printing specification UI failed',err)}})}
function apply(q){for(const it of(q?.items||[])){const d=draft.get(key(q.number,it.id));if(!d)continue;it.printingRequired=!!d.required;it.supplierRoute=d.required?'PRINTING':'';it.logoColor=d.logoColor;it.printSides=d.printSides;it.artworkStatus=d.artworkStatus;it.mockupLink=d.mockupLink;it.printNotes=d.printNotes;}}
function boot(){
  E=window.__ecohub;if(!E){setTimeout(boot,150);return}
  if(!window.__ecohubPrintingSpecsV1&&E.syncPayablesForQuotation){window.__ecohubPrintingSpecsV1=true;const base=E.syncPayablesForQuotation;E.syncPayablesForQuotation=async function(q){apply(q);return base(q)}}
  const root=document.getElementById('main-content')||document.body;
  new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(x=>x.nodeType===1&&(x.matches?.('#q-items-body,tr[data-id],tr[data-alloc-for]')||x.querySelector?.('#q-items-body,tr[data-id],tr[data-alloc-for]')))))schedule()}).observe(root,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.classList?.contains('c-product')||e.target?.classList?.contains('c-category'))schedule()});schedule();
}
boot();
})();
