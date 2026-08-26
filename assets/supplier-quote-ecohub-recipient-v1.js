(function(){
'use strict';
const RECIPIENT='EcoHub Straw and Packaging';
function injectRecipient(){
  const modal=document.getElementById('quoteModal');
  if(!modal)return;
  const dialog=modal.querySelector('.dialog');
  if(dialog&&!document.getElementById('ecohub-fixed-recipient')){
    const box=document.createElement('div');
    box.id='ecohub-fixed-recipient';
    box.className='notice';
    box.style.cssText='margin:10px 0 4px;border-left:4px solid #173b2b;background:#f6f8f5';
    box.innerHTML='<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6d786f;font-weight:800">Quotation For</div><div style="font-size:17px;font-weight:900;color:#173b2b;margin-top:3px">EcoHub Straw and Packaging</div><div style="font-size:10.5px;color:#6d786f;margin-top:3px">This supplier quotation can only be issued to EcoHub. Recipient cannot be changed.</div>';
    const form=dialog.querySelector('.formgrid');
    if(form)dialog.insertBefore(box,form);
  }
  const submit=document.getElementById('quoteSubmit');
  if(submit)submit.textContent='Issue Quotation to EcoHub';
  const title=dialog&&dialog.querySelector('h3');
  if(title&&title.textContent.trim()==='New Supplier Quotation')title.textContent='New Quotation for EcoHub';
}
function relabelStatuses(){
  const body=document.getElementById('quotesBody');
  if(!body)return;
  for(const el of body.querySelectorAll('.pill')){
    if(el.textContent.trim()==='Submitted')el.textContent='Issued · Awaiting EcoHub Review';
  }
}
function markPrint(){
  const sheet=document.getElementById('printSheet');
  if(!sheet||!sheet.innerHTML||sheet.querySelector('[data-ecohub-recipient]'))return;
  const block=document.createElement('div');
  block.dataset.ecohubRecipient='1';
  block.style.cssText='margin:12px 0 18px;padding:10px 12px;border:1px solid #bbb';
  block.innerHTML='<div style="font-size:10px;font-weight:bold;text-transform:uppercase">Quotation For</div><div style="font-size:16px;font-weight:bold;margin-top:4px">EcoHub Straw and Packaging</div>';
  const h2=sheet.querySelector('h2');
  if(h2)h2.insertAdjacentElement('afterend',block); else sheet.prepend(block);
}
function boot(){
  injectRecipient();relabelStatuses();markPrint();
  new MutationObserver(()=>{injectRecipient();relabelStatuses();markPrint();}).observe(document.body,{childList:true,subtree:true,characterData:true});
  const print=document.getElementById('quotePrint');
  if(print)print.addEventListener('click',()=>setTimeout(markPrint,0),true);
  document.documentElement.dataset.supplierQuoteRecipient='EcoHub-only';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();