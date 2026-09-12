(function(){
'use strict';
const $=s=>document.querySelector(s),N=v=>Number(v)||0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>'₱'+N(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
let rows=[];
function ctx(){return window.SupplierPortalContext}
function install(){
  if($('#quoteArchiveSection')||!$('#quotes'))return;
  $('#quotes').insertAdjacentHTML('beforeend',`<div id="quoteArchiveSection" class="section"><div class="head"><div><h2>Recovered Quotation Archive</h2><div class="mini">Original supplier quotation records recovered from the backend. Read-only to prevent duplicate quotations and duplicate payables.</div></div><span id="quoteArchiveCount" class="mini">Loading…</span></div><div class="wrap"><table><thead><tr><th>Quotation / Batch</th><th>Date</th><th>Items</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th><th></th></tr></thead><tbody id="quoteArchiveBody"></tbody></table></div></div>`);
}
function status(row){return N(row.remaining_balance)<=0?'<span class="pill good">Paid</span>':'<span class="pill warn">Open Balance</span>'}
function render(){
  if(!$('#quoteArchiveBody'))return;
  $('#quoteArchiveCount').textContent=rows.length+' recovered batch'+(rows.length===1?'':'es');
  $('#quoteArchiveBody').innerHTML=rows.length?rows.map((row,i)=>`<tr><td><b>${esc(row.source_ref||'Legacy quotation')}</b></td><td>${esc(row.quotation_date||'—')}</td><td>${N(row.line_count).toLocaleString()}</td><td class="num"><b>${money(row.total_amount)}</b></td><td class="num">${money(row.total_paid)}</td><td class="num"><b>${money(row.remaining_balance)}</b></td><td>${status(row)}</td><td><button class="btn tiny" data-archive-open="${i}">Open</button></td></tr><tr id="archive-lines-${i}" class="hidden"><td colspan="8"><div class="wrap"><table><thead><tr><th>Product / Description</th><th class="num">Qty</th><th>Unit</th><th class="num">Unit Cost</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead><tbody>${(row.lines||[]).map(line=>`<tr><td><b>${esc(line.product_name||'—')}</b><div class="mini">${esc(line.remarks||'')}</div></td><td class="num">${N(line.qty_ordered).toLocaleString()}</td><td>${esc(line.unit||'Piece')}</td><td class="num">${money(line.unit_cost)}</td><td class="num">${money(line.total)}</td><td class="num">${money(line.paid)}</td><td class="num"><b>${money(line.balance)}</b></td></tr>`).join('')}</tbody></table></div></td></tr>`).join(''):'<tr><td colspan="8"><div class="empty">No recovered legacy quotations for this supplier.</div></td></tr>';
  document.querySelectorAll('[data-archive-open]').forEach(b=>b.onclick=()=>{const detail=$('#archive-lines-'+b.dataset.archiveOpen),open=detail.classList.toggle('hidden');b.textContent=open?'Open':'Close'});
}
async function load(){
  if(!ctx()?.profile)return;
  install();
  if(ctx().profile.code!=='PRINTING'){$('#quoteArchiveSection')?.classList.add('hidden');return}
  $('#quoteArchiveSection')?.classList.remove('hidden');
  try{const r=await ctx().rpc('supplier_portal_quote_archive_v1',{});if(r.error)throw r.error;rows=Array.isArray(r.data)?r.data:[];render()}catch(e){console.error('Quotation archive:',e);$('#quoteArchiveCount').textContent='Archive unavailable';}
}
window.addEventListener('supplier-portal-data',load);
const wait=setInterval(()=>{if(ctx()){clearInterval(wait);install();if(ctx().profile)load()}},25);
})();
