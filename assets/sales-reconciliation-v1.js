(function(){
  'use strict';
  let E=null,scheduled=false;
  const n=v=>Number(v)||0;
  const iso=v=>String(v||'').slice(0,10);

  function payments(q){return (Array.isArray(q&&q.payments)?q.payments:[]).filter(p=>n(p&&p.amount)>0)}
  function historicalSettled(q){return !!(q&&q.historicalSettled)&&n(q&&q.historicalSettlementAmount)>0&&!!iso(q&&q.historicalSettlementDate)}
  function historicalPaymentInfo(q,base){if(!historicalSettled(q))return base;const grand=n(base&&base.grand),paid=Math.max(n(base&&base.amountPaid),n(q.historicalSettlementAmount),grand);return {...base,amountPaid:paid,remainingBalance:0,status:'Paid · Historical Settlement'} }
  function paymentInfo(q){
    try{return historicalPaymentInfo(q,E.quotationPaymentInfo(q))}catch(_){return {grand:0,amountPaid:0,remainingBalance:0,status:'Unpaid'}}
  }
  function status(q){return String(q&&q.orderStatus||'').trim().toLowerCase()}
  function fulfilled(q){return ['completed','delivered'].includes(status(q))}
  function fullyPaid(q){
    const p=paymentInfo(q);
    return n(p.grand)>0&&(payments(q).length>0||historicalSettled(q))&&n(p.remainingBalance)<=0.004;
  }
  function recognized(q){return fulfilled(q)&&fullyPaid(q)}
  function paymentDate(p){return iso(p&&(p.financialReportingDate||p.date||p.createdAt))}
  function finalPaymentDate(q){
    const dates=payments(q).map(paymentDate).concat(historicalSettled(q)?[iso(q.historicalSettlementDate)]:[]).filter(Boolean).sort();
    return dates.length?dates[dates.length-1]:'';
  }
  function fulfillmentDate(q){
    if(status(q)==='completed')return iso(q&&(q.completedDate||q.completedAt||q.deliveredDate));
    return iso(q&&q.deliveredDate);
  }
  function recognitionDate(q){
    const locked=iso(q&&q.financialRecognitionDate);
    if(locked)return locked;
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
    if(banner)banner.innerHTML='<div style="padding:12px 15px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>Sales Recognition Check</b><div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px">A sale and its profit are recognized only after the order is Delivered/Completed and fully paid. The reporting date is the later of fulfillment or final payment, unless an audited historical period is locked.</div></div><div style="display:flex;gap:7px;flex-wrap:wrap"><span class="pill green">'+s.reflected+' recognized</span><span class="pill '+(s.waitingPayment?'orange':'green')+'">'+s.waitingPayment+' fulfilled · awaiting payment</span></div></div>';
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}
  function boot(){
    E=window.__ecohub;if(!E){setTimeout(boot,120);return}
    if(window.__ecohubSalesReconciliationV2)return;
    window.__ecohubSalesReconciliationV2=true;
    if(!E.__historicalSettlementPaymentInfo){const basePaymentInfo=E.quotationPaymentInfo;E.quotationPaymentInfo=function(q){return historicalPaymentInfo(q,basePaymentInfo(q))};E.__historicalSettlementPaymentInfo=true}
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
