(function(){
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],N=v=>Number(v)||0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>'₱'+N(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:4});
const BASELINE=.80;
let installed=false,editing=null;
function ctx(){return window.SupplierPortalContext}
function isPrinting(){return ctx()?.profile?.code==='PRINTING'}
function settings(){return (ctx()?.data?.inventory||[]).filter(x=>x.active!==false)}
function costMeta(row={}){
  const kinds=['PET Cup Printing','Paper Cup Printing','Takeout Box Printing','Other Printing'],raw=String(row.notes||'');
  const kind=kinds.find(x=>raw===x||raw.startsWith(x+' · '))||(String(row.product_name||'').toLowerCase().includes('takeout')?'Takeout Box Printing':'Other Printing');
  return{kind,notes:raw===kind?'':raw.startsWith(kind+' · ')?raw.slice(kind.length+3):raw};
}
function install(){
  if(installed)return;installed=true;
  const style=document.createElement('style');
  style.textContent='.printing-cost-only{display:none}.printing-cost-enabled .printing-cost-only{display:flex}.printing-cost-enabled section.printing-cost-only{display:none}.printing-cost-enabled section.printing-cost-only.active{display:block}.printing-cost-price{font-size:14px;font-weight:900}.printing-cost-note{max-width:720px}@media(max-width:760px){#printingCostModal .formgrid{grid-template-columns:1fr}}';
  document.head.appendChild(style);
  const activityButton=$('.nav button[data-view="activity"]');
  activityButton?.insertAdjacentHTML('beforebegin','<div class="nav-label printing-cost-only">Pricing</div><button class="printing-cost-only" data-printing-cost-view="printing-cost"><span>Printing Cost</span><span id="printingCostCount" class="nav-count">0</span></button>');
  $('#activity')?.insertAdjacentHTML('beforebegin',`<section id="printing-cost" class="view printing-cost-only"><div class="grid"><div class="kpi"><b>Printing Products</b><strong id="pcProducts">0</strong></div><div class="kpi"><b>Default Baseline</b><strong>₱0.80</strong></div><div class="kpi"><b>Lowest Cost</b><strong id="pcLowest">₱0.80</strong></div><div class="kpi"><b>Highest Cost</b><strong id="pcHighest">₱0.80</strong></div></div><div class="section"><div class="head"><div><h2>Printing Cost</h2><div class="mini printing-cost-note">Save the printing price EcoHub pays per product. New supplier quotations automatically use this saved price; products without a saved price start at ₱0.80 per piece.</div></div><button id="addPrintingCost" class="btn dark">+ Add Product / Cost</button></div><div class="wrap"><table><thead><tr><th>Product</th><th>Category</th><th>Code</th><th class="num">Printing Cost</th><th>Unit</th><th>Notes</th><th>Updated</th><th></th></tr></thead><tbody id="printingCostBody"></tbody></table></div></div></section>`);
  $('#printSheet')?.insertAdjacentHTML('beforebegin',`<div id="printingCostModal" class="modal hidden"><div class="dialog"><h3 id="printingCostTitle">Add Printing Cost</h3><div class="sub">Default price is ₱0.80 per piece. You can change it for each product.</div><div class="formgrid" style="margin-top:12px"><label>Product Name<input id="pcName" placeholder="e.g. PET 16oz 98mm or Printed Takeout Box"></label><label>Category<select id="pcCategory"><option>PET Cup Printing</option><option>Paper Cup Printing</option><option>Takeout Box Printing</option><option>Other Printing</option></select></label><label>Product Code (optional)<input id="pcCode" placeholder="Auto-generated if blank"></label><label>Printing Cost to EcoHub<input id="pcPrice" type="number" min="0" step="0.0001" value="0.80"></label><label>Price Unit<select id="pcUnit"><option>Piece</option><option>Box</option><option>Pack</option></select></label><label>Pieces per Box / Pack<input id="pcPpb" type="number" min="0" step="0.01" placeholder="Optional"></label><label class="wide">Notes<textarea id="pcNotes" rows="3" placeholder="Color, print type, size, or other pricing notes"></textarea></label></div><div class="actions"><button id="printingCostClose" class="btn">Cancel</button><button id="printingCostSave" class="btn dark">Save Printing Cost</button></div></div></div>`);
  $('[data-printing-cost-view]')?.addEventListener('click',e=>{const b=e.currentTarget;$$('.nav button').forEach(x=>x.classList.toggle('active',x===b));$$('.view').forEach(v=>v.classList.toggle('active',v.id==='printing-cost'));render()});
  $('#addPrintingCost').onclick=()=>openCost();
  $('#printingCostClose').onclick=()=>$('#printingCostModal').classList.add('hidden');
  $('#printingCostSave').onclick=saveCost;
  const lines=$('#quoteLines');
  if(lines)new MutationObserver(seedQuotePrices).observe(lines,{childList:true,subtree:true});
  document.addEventListener('change',e=>{if(isPrinting()&&(e.target?.classList?.contains('prod')||e.target?.classList?.contains('cat')))setTimeout(seedQuotePrices,0)},true);
}
function configure(){
  if(!ctx()?.profile)return;
  document.body.classList.toggle('printing-cost-enabled',isPrinting());
  $$('.printing-cost-only').forEach(x=>x.classList.toggle('hidden',!isPrinting()));
  if(!isPrinting())return;
  if($('#addCatalog'))$('#addCatalog').textContent='+ Printing Cost Product';
  if($('#addCustom'))$('#addCustom').textContent='+ Custom Print Product';
  render();seedQuotePrices();
}
function render(){
  if(!isPrinting())return;
  const rows=settings(),prices=rows.map(x=>N(x.special_price)).filter(x=>x>0);
  $('#printingCostCount').textContent=rows.length;$('#pcProducts').textContent=rows.length;
  $('#pcLowest').textContent=money(prices.length?Math.min(...prices):BASELINE);$('#pcHighest').textContent=money(prices.length?Math.max(...prices):BASELINE);
  $('#printingCostBody').innerHTML=rows.length?rows.map(x=>{const m=costMeta(x);return `<tr><td><b>${esc(x.product_name)}</b></td><td>${esc(m.kind)}</td><td>${esc(x.product_code||'—')}</td><td class="num printing-cost-price">${money(x.special_price)}</td><td>${esc(x.price_unit||'Piece')}</td><td class="mini">${esc(m.notes||'—')}</td><td>${esc(String(x.updated_at||'').replace('T',' ').slice(0,16)||'—')}</td><td><button class="btn tiny" data-print-cost-edit="${x.id}">Edit</button></td></tr>`}).join(''):'<tr><td colspan="8"><div class="empty">No printing costs saved yet. New quotation lines will use the ₱0.80 baseline.</div></td></tr>';
  $$('[data-print-cost-edit]').forEach(b=>b.onclick=()=>openCost(rows.find(x=>x.id===b.dataset.printCostEdit)));
  addDirectQuoteEditButtons();
}
function openCost(row=null){
  const meta=costMeta(row||{});
  editing=row||null;$('#printingCostTitle').textContent=row?'Edit Printing Cost':'Add Printing Cost';
  $('#pcName').value=row?.product_name||'';$('#pcCategory').value=meta.kind;
  $('#pcCode').value=row?.product_code||'';$('#pcCode').readOnly=!!row;$('#pcPrice').value=N(row?.special_price)||BASELINE;$('#pcUnit').value=row?.price_unit||'Piece';$('#pcPpb').value=N(row?.pieces_per_box)||'';$('#pcNotes').value=meta.notes;
  $('#printingCostModal').classList.remove('hidden');setTimeout(()=>$('#pcName').focus(),0);
}
async function saveCost(){
  const name=$('#pcName').value.trim(),price=N($('#pcPrice').value),b=$('#printingCostSave');
  if(!name)return alert('Enter the product name.');if(price<=0)return alert('Enter a printing cost greater than zero.');
  b.disabled=true;
  try{
    const r=await ctx().rpc('supplier_upsert_product_setting',{p_setting_id:editing?.id||null,p_product_code:$('#pcCode').value.trim(),p_product_name:name,p_category:'Printing Cost',p_unit:$('#pcUnit').value,p_pieces_per_box:N($('#pcPpb').value),p_cost_price:0,p_special_price:price,p_price_unit:$('#pcUnit').value,p_stock_on_hand:0,p_stock_unit:$('#pcUnit').value,p_low_stock_threshold:0,p_notes:($('#pcCategory').value+(($('#pcNotes').value||'').trim()?' · '+$('#pcNotes').value.trim():''))});
    if(r.error)throw r.error;$('#printingCostModal').classList.add('hidden');editing=null;await ctx().reload();
  }catch(e){alert(e.message||e)}finally{b.disabled=false}
}
function seedQuotePrices(){
  if(!isPrinting())return;
  $$('#quoteLines .quote-line').forEach(row=>{const input=row.querySelector('.price');if(!input||row.dataset.printingBaselineSeeded)return;row.dataset.printingBaselineSeeded='1';if(N(input.value)<=0){input.value=BASELINE;input.dispatchEvent(new Event('input',{bubbles:true}))}});
}
function addDirectQuoteEditButtons(){
  for(const q of(ctx()?.quotes||[])){
    if(!['Draft','Submitted'].includes(q.status))continue;
    const open=$(`[data-q="${CSS.escape(q.id)}"]`),cell=open?.parentElement;if(!cell||cell.querySelector(`[data-print-quote-edit="${CSS.escape(q.id)}"]`))continue;
    const edit=document.createElement('button');edit.className='btn tiny';edit.dataset.printQuoteEdit=q.id;edit.textContent='Edit';edit.style.marginLeft='5px';
    edit.onclick=e=>{e.stopPropagation();open.click();setTimeout(()=>$('#detailEdit')?.click(),0)};cell.appendChild(edit);
  }
}
window.addEventListener('supplier-portal-data',()=>{configure();render()});
const wait=setInterval(()=>{if(ctx()){clearInterval(wait);install();configure()}},25);
})();
