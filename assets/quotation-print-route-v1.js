(function(){
  'use strict';
  const E=window.__ecohub;
  if(!E || window.__ecohubQuotationPrintRouteV2) return;
  window.__ecohubQuotationPrintRouteV2=true;
  const STORE='ecohub:quotation-print:v1';

  function val(id){
    const el=document.getElementById(id);
    return el ? el.value : '';
  }
  function clone(obj){
    try{return structuredClone(obj);}catch(_e){try{return JSON.parse(JSON.stringify(obj));}catch(_e2){return {};}}
  }
  function collectQuotation(){
    const number=val('f-number');
    let base=null;
    try{
      const qs=E.state && Array.isArray(E.state.quotations) ? E.state.quotations : [];
      base=qs.find(q=>String(q.number||'')===String(number||'')) || null;
    }catch(_e){}
    const q=clone(base||{});
    q.number=number||q.number||'';
    q.date=val('f-date')||q.date||'';
    q.valid=val('f-valid')||q.valid||'';
    q.customer=val('f-customer')||q.customer||'';
    q.company=val('f-company')||q.company||'';
    q.contact=val('f-contact')||q.contact||'';
    q.address=val('f-address')||q.address||'';
    q.salesperson=val('f-salesperson')||q.salesperson||'';
    q.quotationStatus=val('f-qstatus')||q.quotationStatus||'';
    q.orderStatus=val('f-ostatus')||q.orderStatus||'';
    q.terms=val('f-terms')||q.terms||'';
    q.expectedCompletionDate=val('f-expected')||q.expectedCompletionDate||'';
    q.paymentDueDate=val('f-duedate')||q.paymentDueDate||'';
    q.notes=val('f-notes')||q.notes||'';
    const vatEnabled=document.getElementById('f-vat-enabled');
    const vatRate=document.getElementById('f-vat-rate');
    q.vatEnabled=vatEnabled ? !!vatEnabled.checked : !!q.vatEnabled;
    q.vatRate=vatRate ? (parseFloat(vatRate.value)||0) : (Number(q.vatRate)||12);

    const rows=[...document.querySelectorAll('#q-items-body tr[data-id]')];
    if(rows.length){
      const existingById=new Map((Array.isArray(q.items)?q.items:[]).map(it=>[String(it.id||''),it]));
      q.items=rows.map((tr,i)=>{
        const old=clone(existingById.get(String(tr.dataset.id||''))||{});
        const get=(sel)=>tr.querySelector(sel);
        const qty=get('.c-qty'), unit=get('.c-unit'), price=get('.c-price'), discount=get('.c-discount'), desc=get('.c-desc');
        old.id=tr.dataset.id||old.id||('print-'+i);
        old.description=desc?desc.value:(old.description||old.name||'');
        old.name=old.name||old.description;
        old.qty=qty?(parseFloat(qty.value)||0):(Number(old.qty)||0);
        old.unit=unit?unit.value:(old.unit||'');
        old.price=price?(parseFloat(price.value)||0):(Number(old.price)||0);
        old.discount=discount?(parseFloat(discount.value)||0):(Number(old.discount)||0);
        return old;
      });
    } else if(!Array.isArray(q.items)) q.items=[];
    return q;
  }

  function openPrintPreview(q){
    sessionStorage.setItem(STORE,JSON.stringify(q||{}));
    const url=new URL('quotation-print.html',window.location.href);
    url.searchParams.set('v','2');
    window.location.href=url.href;
  }

  E.printQuotation=function(q){
    try{openPrintPreview(q||collectQuotation());}
    catch(err){console.error('EcoHub quotation print route failed',err); if(E.toast) E.toast('Could not open quotation print preview.');}
  };

  document.addEventListener('click',function(ev){
    const target=ev.target && ev.target.nodeType===1 ? ev.target : ev.target && ev.target.parentElement;
    const btn=target && target.closest ? target.closest('#q-print-btn') : null;
    if(!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    try{openPrintPreview(collectQuotation());}
    catch(err){
      console.error('EcoHub quotation print button failed',err);
      if(E.toast) E.toast('Could not open quotation print preview. Please reload and try again.');
    }
  },true);
})();
