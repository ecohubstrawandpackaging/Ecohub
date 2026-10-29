(function(){
'use strict';
const BUILD='20261029-expense-profit-scope-v1',GENERAL='company_general',RELATED='transaction_related';
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let scheduled=false;
function boot(){
 const E=window.__ecohub;if(!E||!E.state||typeof E.storageSet!=='function'){setTimeout(boot,150);return}
 const qDate=q=>String(q.completedDate||q.deliveredDate||q.date||q.createdAt||''),qClient=q=>String(q.company||q.customer||q.clientName||'Unassigned Client').trim()||'Unassigned Client',qSales=q=>String(q.salesperson||q.salesPerson||q.salesPersonName||q.agent||'—').trim()||'—',qKey=q=>String(q.id||q.number||'');
 function options(selected){return(E.state.quotations||[]).slice().sort((a,b)=>qDate(b).localeCompare(qDate(a))).map(q=>{const k=qKey(q);if(!k)return'';return'<option value="'+esc(k)+'" '+(k===selected?'selected':'')+'>'+esc((q.number||'No quotation #')+' — '+qClient(q)+' — '+qSales(q))+'</option>'}).join('')}
 function enhance(){
  const body=document.getElementById('e-body');if(!body)return;const table=body.closest('table');if(!table)return;
  const head=table.querySelector('thead tr');if(head&&!head.querySelector('[data-exp-scope-head]')){const at=[...head.children].find(th=>th.textContent.trim()==='Amount');if(at){for(const label of['Profit Treatment','Related Transaction']){const th=document.createElement('th');th.dataset.expScopeHead='1';th.textContent=label;head.insertBefore(th,at)}}}
  const card=table.closest('.card'),prior=card&&card.previousElementSibling;if(card&&!(prior&&prior.id==='expense-profit-treatment-note')){const note=document.createElement('div');note.id='expense-profit-treatment-note';note.className='card';note.style.cssText='border-left:4px solid #1f6f4a;background:#f4fbf6;padding:12px 14px;margin-bottom:12px';note.innerHTML="<b>Profit treatment:</b> General Company expenses reduce company profit but do not reduce Xander's 25%. Choose Related to Transaction only when the expense belongs directly to one quotation.";card.parentNode.insertBefore(note,card)}
  body.querySelectorAll('tr[data-id]').forEach(tr=>{if(tr.querySelector('[data-exp-allocation]'))return;const exp=(E.state.expenses||[]).find(x=>String(x.id)===String(tr.dataset.id)),at=tr.querySelector('.x-amount')?.closest('td');if(!exp||!at)return;
   const a=document.createElement('td'),b=document.createElement('td');a.dataset.expAllocation='scope';b.dataset.expAllocation='related';const scope=exp.allocationScope===RELATED?RELATED:GENERAL,selected=String(exp.relatedQuotationId||exp.relatedQuotationNumber||'');
   a.innerHTML='<select class="x-profit-treatment" style="min-width:185px"><option value="'+GENERAL+'" '+(scope===GENERAL?'selected':'')+'>General Company</option><option value="'+RELATED+'" '+(scope===RELATED?'selected':'')+'>Related to Transaction</option></select>';
   b.innerHTML='<select class="x-related-quotation" style="min-width:250px" '+(scope===RELATED?'':'disabled')+'><option value="">Select quotation…</option>'+options(selected)+'</select>';tr.insertBefore(a,at);tr.insertBefore(b,at);
   const ss=a.querySelector('select'),qs=b.querySelector('select');if(scope===RELATED&&!selected)qs.style.borderColor='#b7791f';
   ss.addEventListener('change',async()=>{exp.allocationScope=ss.value;if(exp.allocationScope!==RELATED){exp.relatedQuotationId='';exp.relatedQuotationNumber=''}await E.storageSet('expense:'+exp.id,exp);qs.disabled=exp.allocationScope!==RELATED;if(qs.disabled){qs.value='';qs.style.borderColor=''}else qs.style.borderColor=qs.value?'':'#b7791f'});
   qs.addEventListener('change',async()=>{const q=(E.state.quotations||[]).find(x=>qKey(x)===qs.value);exp.allocationScope=RELATED;exp.relatedQuotationId=q?String(q.id||''):'';exp.relatedQuotationNumber=q?String(q.number||''):'';ss.value=RELATED;qs.disabled=false;qs.style.borderColor=q?'':'#b7791f';await E.storageSet('expense:'+exp.id,exp)});
  });
  body.querySelectorAll('tr:not([data-id]) td[colspan]').forEach(td=>{if(Number(td.colSpan)===8)td.colSpan=10});
 }
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance()})}
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();document.documentElement.dataset.expenseProfitScopeBuild=BUILD;
}
boot();
})();