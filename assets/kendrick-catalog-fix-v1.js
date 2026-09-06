(function(){
'use strict';
const PRESETS=[
  {code:'OT-004',name:'Straw CGS 6mm',category:'Straw',unit:'Piece'},
  {code:'OT-005',name:'Straw CGS 8mm',category:'Straw',unit:'Piece'},
  {code:'OT-003',name:'Straw CGS 12mm',category:'Straw',unit:'Piece'},
  {code:'OT-007',name:'Straw SC 6mm',category:'Straw',unit:'Piece'},
  {code:'OT-008',name:'Straw SC 8mm',category:'Straw',unit:'Piece'},
  {code:'OT-006',name:'Straw SC 12mm',category:'Straw',unit:'Piece'},
  {code:'NEW-072',name:'2 slot Bagasse Drink Container',category:'Bagasse Container',unit:'Piece'},
  {code:'NEW-087',name:'Bagasse 4 slot carrier',category:'Bagasse Container',unit:'Piece'}
];
function ctx(){return window.SupplierPortalContext}
function isKendrick(){return ctx()?.profile?.code==='KENDRICK'}
function repair(){
  if(!isKendrick())return;
  const catalog=ctx().catalog;
  if(Array.isArray(catalog))PRESETS.forEach(seed=>{if(!catalog.some(x=>x.code===seed.code))catalog.push({...seed,pieces_per_box:0,default_unit_price:0})});
  ['addCatalog','addCustom','newQuote','newQuote2'].forEach(id=>{const b=document.getElementById(id);if(b){b.classList.remove('hidden');b.disabled=false}});
  const addCatalog=document.getElementById('addCatalog'),addCustom=document.getElementById('addCustom');
  if(addCatalog)addCatalog.textContent='+ Preset Product';
  if(addCustom)addCustom.textContent='+ Custom Item';
  document.querySelectorAll('#quoteLines .quote-line[data-mode="custom"] .cat option').forEach(o=>o.textContent='Custom Item');
}
window.addEventListener('supplier-portal-data',()=>setTimeout(repair,0));
new MutationObserver(repair).observe(document.documentElement,{childList:true,subtree:true});
const timer=setInterval(()=>{if(ctx()?.profile){repair();clearInterval(timer)}},80);
setTimeout(()=>clearInterval(timer),12000);
})();
