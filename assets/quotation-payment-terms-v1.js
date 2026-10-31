(function(){
'use strict';
const BUILD='20261031-quotation-payment-terms-v1';
let E=null,installed=false,scheduled=false;
const $=s=>document.querySelector(s),n=v=>Number(v)||0,esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function isoAdd(date,days){if(!date||!(days>0))return'';const d=new Date(date+'T00:00:00Z');if(Number.isNaN(d.getTime()))return'';d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function norm(v){return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,' ')}
function isCabecera(v){return norm(v).includes('cabecera')}
function currentQuote(){const number=$('#f-number')?.value;return E?.state?.quotations?.find(q=>q&&q.number===number)||null}
function selectedClient(){const id=$('#f-client-id')?.value;return (E?.state?.clients||[]).find(c=>c&&c.id===id)||null}
function clientDays(c,q){const saved=n(c&&c.paymentTermDays);if(saved>0)return saved;if(isCabecera(c&&[c.companyName,c.contactPerson].join(' '))||isCabecera(q&&[q.company,q.customer].join(' ')))return 30;return n(q&&q.paymentTermDays)}
function choice(days,q){const t=String(q&&q.paymentTermsType||'');if(['15','20','30','custom'].includes(t))return t;return [15,20,30].includes(days)?String(days):(days>0?'custom':'')}
function updatePreview(){
 const select=$('#f-payment-term-choice'),custom=$('#f-payment-term-custom'),preview=$('#f-payment-term-preview'),due=$('#f-duedate');if(!select||!custom||!preview||!due)return;
 custom.style.display=select.value==='custom'?'block':'none';const days=select.value==='custom'?n(custom.value):n(select.value),date=$('#f-date')?.value||'';
 if(days>0&&date)due.value=isoAdd(date,days);
 preview.textContent=days>0?(date?'Due '+due.value+' · '+days+' days from quotation issue date':'Select a quotation date to calculate the due date'):'Cash / no fixed term';
}
function applyToQuote(q){
 if(!q)return q;const select=$('#f-payment-term-choice'),custom=$('#f-payment-term-custom');
 let days=select?(select.value==='custom'?n(custom&&custom.value):n(select.value)):clientDays(selectedClient(),q),type=select?select.value:choice(days,q);
 if(isCabecera([q.company,q.customer].join(' '))){days=30;type='30'}
 q.paymentTermsType=days>0?type:'';q.paymentTermDays=days>0?days:0;q.paymentTermStartBasis='quotation_issue_date';
 if(days>0){q.paymentDueDate=isoAdd(iso(q.date),days);q.paymentTermsLabel=days+' days from quotation issue date'}else q.paymentTermsLabel='Cash / no fixed term';
 const due=$('#f-duedate');if(due&&q.paymentDueDate)due.value=q.paymentDueDate;
 return q;
}
function iso(v){return String(v||'').slice(0,10)}
function setFromClient(){
 const q=currentQuote()||{},c=selectedClient(),days=clientDays(c,q),select=$('#f-payment-term-choice'),custom=$('#f-payment-term-custom');if(!select||!custom)return;
 const value=choice(days,{paymentTermsType:c&&c.paymentTermsType||q.paymentTermsType});select.value=value||'';custom.value=value==='custom'?days:'';updatePreview();
}
function enhance(){
 const grid=$('#f-number')?.closest('.card')?.querySelector('.grid');if(!grid||$('#payment-terms-field-v1'))return;
 const q=currentQuote()||{},c=selectedClient(),days=clientDays(c,q),value=choice(days,q);
 const field=document.createElement('div');field.className='field';field.id='payment-terms-field-v1';
 field.innerHTML='<label>Payment Terms</label><div style="display:flex;gap:7px;align-items:center"><select id="f-payment-term-choice" style="flex:1"><option value="">Cash / No fixed term</option><option value="15">15 days</option><option value="20">20 days</option><option value="30">30 days</option><option value="custom">Custom</option></select><input id="f-payment-term-custom" type="number" min="1" step="1" placeholder="Days" style="width:92px;display:none"></div><div id="f-payment-term-preview" style="font-size:10.5px;color:var(--ink-soft);margin-top:5px"></div>';
 const anchor=$('#f-terms')?.closest('.field')||$('#f-expected')?.closest('.field');if(anchor)anchor.insertAdjacentElement('afterend',field);else grid.appendChild(field);
 $('#f-payment-term-choice').value=value||'';$('#f-payment-term-custom').value=value==='custom'?days:'';updatePreview();
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance()})}
async function seedCabecera(){
 for(const c of(E.state.clients||[])){if(!isCabecera([c.companyName,c.contactPerson].join(' '))||n(c.paymentTermDays)===30)continue;c.paymentTermDays=30;c.paymentTermsType='30';c.paymentTermStartBasis='quotation_issue_date';c.updatedAt=new Date().toISOString();await E.storageSet('client:'+c.id,c)}
}
function install(){
 if(installed||window.__ecohubQuotationPaymentTermsV1)return;installed=true;window.__ecohubQuotationPaymentTermsV1=true;
 const sync=E.syncPayablesForQuotation;E.syncPayablesForQuotation=async function(q){applyToQuote(q);return sync(q)};
 if(E.buildPrintView){const print=E.buildPrintView;E.buildPrintView=function(q){applyToQuote(q);return print(q)}}
 if(E.upsertClientFromQuotation){const upsert=E.upsertClientFromQuotation;E.upsertClientFromQuotation=async function(q){applyToQuote(q);const c=await upsert(q);if(c){c.paymentTermDays=n(q.paymentTermDays);c.paymentTermsType=q.paymentTermsType||'';c.paymentTermStartBasis='quotation_issue_date';await E.storageSet('client:'+c.id,c)}return c}}
 document.addEventListener('change',e=>{if(e.target?.id==='f-client-id')setTimeout(setFromClient,0);if(['f-payment-term-choice','f-payment-term-custom','f-date'].includes(e.target?.id))updatePreview()},true);
 document.addEventListener('input',e=>{if(e.target?.id==='f-company'&&isCabecera(e.target.value)){const s=$('#f-payment-term-choice');if(s){s.value='30';updatePreview()}}if(['f-payment-term-custom','f-date'].includes(e.target?.id))updatePreview()},true);
 new MutationObserver(schedule).observe($('#main-content')||document.body,{childList:true,subtree:true});seedCabecera().catch(err=>console.error('Cabecera payment term seed failed',err));schedule();document.documentElement.dataset.paymentTermsBuild=BUILD;
}
function boot(){E=window.__ecohub;if(!E||!E.syncPayablesForQuotation||!E.storageSet)return setTimeout(boot,120);install()}
boot();
})();
