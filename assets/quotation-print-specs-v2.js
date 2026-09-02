(function(){
'use strict';
let E=null,scheduled=false;
const LOCAL='EcoHub Quotation Only',draft=new Map();
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=(q,i)=>String(q||'')+'::'+String(i||''),qno=()=>String(document.querySelector('#f-number')?.value||'').trim();
const savedQ=n=>(E?.state?.quotations||[]).find(q=>q&&q.number===n)||null;
const savedI=(q,i)=>savedQ(q)?.items?.find(x=>x&&x.id===i)||null;
function productFor(tr){const code=String(tr?.querySelector('.c-product')?.value||'');return (E?.state?.products||[]).find(p=>p&&p.code===code)||null}
function value(q,i){const k=key(q,i);if(draft.has(k))return draft.get(k);const it=savedI(q,i)||{};return{logoColor:it.logoColor||'',printSides:it.printSides||'One Side',artworkStatus:it.artworkStatus||'For Mockup',mockupLink:it.mockupLink||'',printNotes:it.printNotes||''}}
function inject(){
  if(!E)return;const body=document.querySelector('#q-items-body'),q=qno();if(!body||!q)return;
  body.querySelectorAll('tr[data-id]').forEach(tr=>{
    const id=tr.dataset.id,product=productFor(tr);if(!id||String(product?.category||'').toLowerCase()!=='printed cups')return;
    const alloc=body.querySelector('tr[data-alloc-for="'+CSS.escape(id)+'"]'),td=alloc?.querySelector('td');if(!td||td.querySelector('.ecohub-print-specs'))return;
    const v=value(q,id),box=document.createElement('div');box.className='ecohub-print-specs';box.style.cssText='margin-top:9px;padding:10px;border-top:1px dashed var(--line);background:#faf8f3;border-radius:8px;display:grid;grid-template-columns:repeat(4,minmax(135px,1fr));gap:8px';
    box.innerHTML='<div style="grid-column:1/-1;padding:9px 10px;border-radius:8px;background:#e9f1ec;color:#173b2b;font-size:11px;line-height:1.45"><b>EcoHub quotation only.</b> This client quote will not be sent to either supplier portal. Supplier quotations and production jobs are entered by the supplier in their own portal.</div>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Logo / Ink Color<input data-logo-color value="'+esc(v.logoColor)+'" placeholder="White, Black, 2 colors…" style="width:100%;margin-top:4px"></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Print Sides<select data-print-sides style="width:100%;margin-top:4px"><option '+(v.printSides==='One Side'?'selected':'')+'>One Side</option><option '+(v.printSides==='Front & Back'?'selected':'')+'>Front &amp; Back</option><option '+(v.printSides==='Wrap Around'?'selected':'')+'>Wrap Around</option></select></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Artwork Status<select data-artwork-status style="width:100%;margin-top:4px"><option '+(v.artworkStatus==='For Mockup'?'selected':'')+'>For Mockup</option><option '+(v.artworkStatus==='Mockup Ready'?'selected':'')+'>Mockup Ready</option><option '+(v.artworkStatus==='Client Approved'?'selected':'')+'>Client Approved</option><option '+(v.artworkStatus==='Ready for Printing'?'selected':'')+'>Ready for Printing</option></select></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Mockup Link<input data-mockup-link value="'+esc(v.mockupLink)+'" placeholder="Drive / Canva link" style="width:100%;margin-top:4px"></label>'+
      '<label style="grid-column:1/-1;font-size:10.5px;font-weight:800;color:var(--ink-soft)">Printing Notes<input data-print-notes value="'+esc(v.printNotes)+'" placeholder="Exact placement, ink instruction, back-to-back details…" style="width:100%;margin-top:4px"></label>';
    td.appendChild(box);
    const save=()=>draft.set(key(q,id),{logoColor:box.querySelector('[data-logo-color]').value.trim(),printSides:box.querySelector('[data-print-sides]').value,artworkStatus:box.querySelector('[data-artwork-status]').value,mockupLink:box.querySelector('[data-mockup-link]').value.trim(),printNotes:box.querySelector('[data-print-notes]').value.trim()});
    box.querySelectorAll('input,select').forEach(x=>x.addEventListener(x.tagName==='SELECT'?'change':'input',save));
  });
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;try{inject()}catch(err){console.error('Printing specification UI failed',err)}})}
function apply(q){
  for(const it of(q?.items||[])){
    const p=(E?.state?.products||[]).find(x=>x&&x.code===it.code),printed=String(p?.category||it.category||'').toLowerCase()==='printed cups'||it.supplierRoute==='PRINTING'||it.directSupplierNoInventory;
    if(!printed)continue;
    const d=draft.get(key(q.number,it.id))||{};
    it.supplierRoute='';it.directSupplierNoInventory=false;it.printingRequired=false;it.printingHandling=LOCAL;
    if(Object.prototype.hasOwnProperty.call(d,'logoColor'))it.logoColor=d.logoColor;
    if(Object.prototype.hasOwnProperty.call(d,'printSides'))it.printSides=d.printSides;
    if(Object.prototype.hasOwnProperty.call(d,'artworkStatus'))it.artworkStatus=d.artworkStatus;
    if(Object.prototype.hasOwnProperty.call(d,'mockupLink'))it.mockupLink=d.mockupLink;
    if(Object.prototype.hasOwnProperty.call(d,'printNotes'))it.printNotes=d.printNotes;
  }
}
function boot(){
  E=window.__ecohub;if(!E){setTimeout(boot,150);return}
  if(!window.__ecohubPrintingSpecsLocalOnlyV1&&E.syncPayablesForQuotation){window.__ecohubPrintingSpecsLocalOnlyV1=true;const base=E.syncPayablesForQuotation;E.syncPayablesForQuotation=async function(q){apply(q);return base(q)}}
  const root=document.getElementById('main-content')||document.body;
  new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(x=>x.nodeType===1&&(x.matches?.('#q-items-body,tr[data-id],tr[data-alloc-for]')||x.querySelector?.('#q-items-body,tr[data-id],tr[data-alloc-for]')))))schedule()}).observe(root,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.classList?.contains('c-product')||e.target?.classList?.contains('c-category'))schedule()});schedule();
}
boot();
})();
