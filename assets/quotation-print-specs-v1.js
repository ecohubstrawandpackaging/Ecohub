(function(){
'use strict';
let E=null,scheduled=false;
const draft=new Map(),CURRENT='Current Inventory Process',DIRECT='Direct to Printing Supplier';
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
  const handling=it.directSupplierNoInventory||it.printingHandling===DIRECT?DIRECT:CURRENT;
  return {required,handling,logoColor:it.logoColor||'',printSides:it.printSides||'One Side',artworkStatus:it.artworkStatus||'For Mockup',mockupLink:it.mockupLink||'',printNotes:it.printNotes||''};
}
function inject(){
  if(!E)return;const body=document.querySelector('#q-items-body'),q=qno();if(!body||!q)return;
  body.querySelectorAll('tr[data-id]').forEach(tr=>{
    const id=tr.dataset.id;if(!id)return;const alloc=body.querySelector('tr[data-alloc-for="'+CSS.escape(id)+'"]');if(!alloc)return;
    const td=alloc.querySelector('td');if(!td||td.querySelector('.ecohub-print-specs'))return;
    const v=value(q,id,tr),box=document.createElement('div');box.className='ecohub-print-specs';
    box.style.cssText='margin-top:9px;padding:10px;border-top:1px dashed var(--line);background:#faf8f3;border-radius:8px;display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:8px';
    box.innerHTML='<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Printed Cup Handling<select data-print-handling style="width:100%;margin-top:4px"><option value="'+CURRENT+'" '+(v.handling===CURRENT?'selected':'')+'>No Changes — Current Inventory Process</option><option value="'+DIRECT+'" '+(v.handling===DIRECT?'selected':'')+'>Direct to Printing Supplier — No Inventory Movement</option></select></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Logo / Ink Color<input data-logo-color value="'+esc(v.logoColor)+'" placeholder="White, Black, 2 colors…" style="width:100%;margin-top:4px"></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Print Sides<select data-print-sides style="width:100%;margin-top:4px"><option '+(v.printSides==='One Side'?'selected':'')+'>One Side</option><option '+(v.printSides==='Front & Back'?'selected':'')+'>Front &amp; Back</option><option '+(v.printSides==='Wrap Around'?'selected':'')+'>Wrap Around</option></select></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Artwork Status<select data-artwork-status style="width:100%;margin-top:4px"><option '+(v.artworkStatus==='For Mockup'?'selected':'')+'>For Mockup</option><option '+(v.artworkStatus==='Mockup Ready'?'selected':'')+'>Mockup Ready</option><option '+(v.artworkStatus==='Client Approved'?'selected':'')+'>Client Approved</option><option '+(v.artworkStatus==='Ready for Printing'?'selected':'')+'>Ready for Printing</option></select></label>'+
      '<label style="font-size:10.5px;font-weight:800;color:var(--ink-soft)">Mockup Link<input data-mockup-link value="'+esc(v.mockupLink)+'" placeholder="Drive / Canva link" style="width:100%;margin-top:4px"></label>'+
      '<label style="grid-column:1/-1;font-size:10.5px;font-weight:800;color:var(--ink-soft)">Printing Notes<input data-print-notes value="'+esc(v.printNotes)+'" placeholder="Exact placement, ink instruction, back-to-back details…" style="width:100%;margin-top:4px"></label><div data-print-route-note style="grid-column:1/-1;font-size:10.5px;color:var(--ink-soft);line-height:1.45"></div>';
    td.appendChild(box);
    const note=()=>{const direct=box.querySelector('[data-print-handling]').value===DIRECT;box.querySelector('[data-print-route-note]').innerHTML=direct?'<b>Direct route:</b> sent to the Printing Supplier Portal; no deduction from general inventory and no automatic packaging-supplier payable.':'<b>Current route:</b> existing inventory, client cup-stock, and supplier purchasing rules remain unchanged.'};
    const save=()=>{const handling=box.querySelector('[data-print-handling]').value===DIRECT?DIRECT:CURRENT;draft.set(key(q,id),{required:handling===DIRECT?true:v.required,handling,logoColor:box.querySelector('[data-logo-color]').value.trim(),printSides:box.querySelector('[data-print-sides]').value,artworkStatus:box.querySelector('[data-artwork-status]').value,mockupLink:box.querySelector('[data-mockup-link]').value.trim(),printNotes:box.querySelector('[data-print-notes]').value.trim()});note()};
    box.querySelectorAll('input,select').forEach(x=>x.addEventListener(x.tagName==='SELECT'?'change':'input',save));
    note();
  });
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;try{inject()}catch(err){console.error('Printing specification UI failed',err)}})}
function apply(q){for(const it of(q?.items||[])){const d=draft.get(key(q.number,it.id));if(!d)continue;const direct=d.handling===DIRECT;it.printingRequired=direct||!!d.required;it.supplierRoute=it.printingRequired?'PRINTING':'';it.printingHandling=direct?DIRECT:CURRENT;it.directSupplierNoInventory=direct;if(direct){it.stockSource='Standard';it.cupStockId=''}it.logoColor=d.logoColor;it.printSides=d.printSides;it.artworkStatus=d.artworkStatus;it.mockupLink=d.mockupLink;it.printNotes=d.printNotes;}}
function displayDirect(it){it._resolvedSource=DIRECT;it._qtyFromInventory=0;it._qtyToPurchase=0;it._boxesToPurchase=0;it._supplierPurchaseQty=0;it._excessQty=0;it._inventoryStatus='Direct to Printing Supplier — No general inventory movement'}
function boot(){
  E=window.__ecohub;if(!E){setTimeout(boot,150);return}
  if(!window.__ecohubPrintingSpecsV2&&E.syncPayablesForQuotation){window.__ecohubPrintingSpecsV2=true;const base=E.syncPayablesForQuotation;E.syncPayablesForQuotation=async function(q){apply(q);const direct=(q?.items||[]).filter(it=>it.directSupplierNoInventory||it.printingHandling===DIRECT);const restore=direct.map(it=>({it,isService:!!it.isService}));direct.forEach(it=>{it.isService=true;it.stockSource='Standard';it.cupStockId=''});let out;try{out=await base(q)}finally{restore.forEach(x=>x.it.isService=x.isService)}direct.forEach(displayDirect);return out}}
  const root=document.getElementById('main-content')||document.body;
  new MutationObserver(ms=>{if(ms.some(m=>[...m.addedNodes].some(x=>x.nodeType===1&&(x.matches?.('#q-items-body,tr[data-id],tr[data-alloc-for]')||x.querySelector?.('#q-items-body,tr[data-id],tr[data-alloc-for]')))))schedule()}).observe(root,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(e.target?.classList?.contains('c-product')||e.target?.classList?.contains('c-category'))schedule()});schedule();
}
boot();
})();
