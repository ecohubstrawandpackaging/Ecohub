(function(){
  'use strict';
  let E=null,scheduled=false;
  const n=v=>Number(v)||0;
  const iso=v=>String(v||'').slice(0,10);

  function payments(q){return (Array.isArray(q&&q.payments)?q.payments:[]).filter(p=>n(p&&p.amount)>0)}
  function paymentInfo(q){
    try{return E.quotationPaymentInfo(q)}catch(_){return {grand:0,amountPaid:0,remainingBalance:0,status:'Unpaid'}}
  }
  function status(q){return String(q&&q.orderStatus||'').trim().toLowerCase()}
  function fulfilled(q){return ['completed','delivered'].includes(status(q))}
  function fullyPaid(q){
    const p=paymentInfo(q);
    return n(p.grand)>0&&payments(q).length>0&&n(p.remainingBalance)<=0.004;
  }
  function recognized(q){return fulfilled(q)&&fullyPaid(q)}
  function finalPaymentDate(q){
    const dates=payments(q).map(p=>iso(p.date||p.createdAt)).filter(Boolean).sort();
    return dates.length?dates[dates.length-1]:'';
  }
  function fulfillmentDate(q){
    if(status(q)==='completed')return iso(q&&(q.completedDate||q.completedAt||q.deliveredDate));
    return iso(q&&q.deliveredDate);
  }
  function recognitionDate(q){
    const dates=[fulfillmentDate(q),finalPaymentDate(q)].filter(Boolean).sort();
    return dates.length?dates[dates.length-1]:iso(q&&(q.date||q.createdAt));
  }
  function summary(){
    const qs=(E&&E.state&&Array.isArray(E.state.quotations))?E.state.quotations:[];
    const fulfilledRows=qs.filter(fulfilled),recognizedRows=qs.filter(recognized);
    return {
      fulfilled:fulfilledRows.length,
      recognized:recognizedRows.length,
      waitingPayment:fulfilledRows.filter(q=>!fullyPaid(q)).length,
      reflected:recognizedRows.length,
      recognizedQuotations:recognizedRows
    };
  }
  function enhance(){
    scheduled=false;
    if(!E)return;
    const root=document.getElementById('main-content');
    if(!root||!root.querySelector('.titleblock')||!/^Sales Records/.test(root.querySelector('.titleblock h2')?.textContent||''))return;
    const s=summary();
    let banner=root.querySelector('[data-sales-reconciliation]');
    if(!banner){banner=document.createElement('div');banner.dataset.salesReconciliation='1';banner.className='card';const grid=root.querySelector('.kpi-grid');if(grid)grid.insertAdjacentElement('beforebegin',banner)}
    if(banner)banner.innerHTML='<div style="padding:12px 15px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>Sales Recognition Check</b><div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px">A sale and its profit are recognized only after the order is Delivered/Completed and fully paid. The reporting date is the later of fulfillment or final payment.</div></div><div style="display:flex;gap:7px;flex-wrap:wrap"><span class="pill green">'+s.reflected+' recognized</span><span class="pill '+(s.waitingPayment?'orange':'green')+'">'+s.waitingPayment+' fulfilled · awaiting payment</span></div></div>';
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}
  function boot(){
    E=window.__ecohub;if(!E){setTimeout(boot,120);return}
    if(window.__ecohubSalesReconciliationV2)return;
    window.__ecohubSalesReconciliationV2=true;
    E.isRevenueRecognized=recognized;
    E.revenueRecognitionDate=recognitionDate;
    E.salesReconciliationSummary=summary;
    const base=E.renderSales;
    if(base)E.renderSales=function(container){const out=base(container);schedule();return out};
    const root=document.getElementById('main-content')||document.body;
    new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
    schedule();
  }
  boot();
})();
