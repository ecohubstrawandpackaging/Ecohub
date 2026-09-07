(function(){
  'use strict';
  let E=null,scheduled=false;
  const n=v=>Number(v)||0;
  const iso=v=>String(v||'').slice(0,10);

  function payments(q){return (Array.isArray(q&&q.payments)?q.payments:[]).filter(p=>n(p&&p.amount)>0)}
  function paymentInfo(q){
    try{return E.quotationPaymentInfo(q)}catch(_){return {grand:0,amountPaid:0,remainingBalance:0,status:'Unpaid'}}
  }
  function explicitlyCompleted(q){return String(q&&q.orderStatus||'').trim().toLowerCase()==='completed'}
  function autoReconciled(q){
    if(String(q&&q.orderStatus||'').trim().toLowerCase()!=='delivered')return false;
    const p=paymentInfo(q);
    return n(p.grand)>0&&payments(q).length>0&&n(p.remainingBalance)<=0.004;
  }
  function recognized(q){return explicitlyCompleted(q)||autoReconciled(q)}
  function recognitionDate(q){
    const completed=iso(q&& (q.completedDate||q.completedAt));
    if(completed)return completed;
    if(autoReconciled(q)){
      const dates=payments(q).map(p=>iso(p.date||p.createdAt)).filter(Boolean).sort();
      if(dates.length)return dates[dates.length-1];
    }
    return iso(q&&(q.deliveredDate||q.date||q.createdAt));
  }
  function summary(){
    const qs=(E&&E.state&&Array.isArray(E.state.quotations))?E.state.quotations:[];
    const completed=qs.filter(explicitlyCompleted),automatic=qs.filter(autoReconciled);
    return {completed:completed.length,automatic:automatic.length,recognized:qs.filter(recognized).length,missing:completed.filter(q=>!recognized(q)).length,automaticQuotations:automatic};
  }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function enhance(){
    scheduled=false;
    if(!E)return;
    const root=document.getElementById('main-content');
    if(!root||!root.querySelector('.titleblock')||!/^Sales Records/.test(root.querySelector('.titleblock h2')?.textContent||''))return;
    const s=summary();
    let banner=root.querySelector('[data-sales-reconciliation]');
    if(!banner){banner=document.createElement('div');banner.dataset.salesReconciliation='1';banner.className='card';const grid=root.querySelector('.kpi-grid');if(grid)grid.insertAdjacentElement('beforebegin',banner)}
    if(banner)banner.innerHTML='<div style="padding:12px 15px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap"><div><b>Sales Reconciliation Check</b><div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px">Every Completed quotation is checked whenever Sales Records opens. Delivered and fully paid orders are safely recognized without changing inventory or Finance.</div></div><div style="display:flex;gap:7px;flex-wrap:wrap"><span class="pill green">'+s.recognized+' reflected</span><span class="pill '+(s.missing?'red':'green')+'">'+s.missing+' missing</span>'+(s.automatic?'<span class="pill orange">'+s.automatic+' delivered + fully paid</span>':'')+'</div></div>';
    for(const q of s.automaticQuotations){
      const qno=String(q.number||'');
      for(const row of root.querySelectorAll('tbody tr')){
        const cells=row.querySelectorAll('td');
        if(cells.length&&[...cells].some(td=>td.textContent.trim()===qno)&&!row.querySelector('[data-auto-reconciled]')){
          const tag=document.createElement('div');tag.dataset.autoReconciled='1';tag.style.cssText='font-size:10px;color:#9a5b13;margin-top:2px;font-weight:700';tag.textContent='Auto-reconciled · Delivered & fully paid';cells[0].appendChild(tag);
        }
      }
    }
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}
  function boot(){
    E=window.__ecohub;if(!E){setTimeout(boot,120);return}
    if(window.__ecohubSalesReconciliationV1)return;
    window.__ecohubSalesReconciliationV1=true;
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
