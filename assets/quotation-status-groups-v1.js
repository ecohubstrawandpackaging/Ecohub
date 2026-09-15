(function(){
  'use strict';
  let E=null;
  let scheduled=false;
  let selectedGroup='active';
  const norm=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
  const GROUPS=[
    ['active','Active Orders'],['pending','Pending / Confirmation'],['production','Production'],
    ['quality','Quality Check'],['ready','Ready for Release'],['delivered-unpaid','Delivered · Unpaid'],
    ['delivered-paid','Delivered · Paid'],['completed','Completed'],['cancelled','Cancelled / Declined'],
    ['all','All Quotations']
  ];

  function remaining(q){
    try{return Number(E.quotationPaymentInfo(q).remainingBalance)||0}catch(_){
      const total=E.quotationTotals?Number(E.quotationTotals(q).grand)||0:0;
      const paid=(q.payments||[]).reduce((sum,payment)=>sum+(Number(payment.amount)||0),0);
      return Math.max(0,total-paid);
    }
  }

  function groupFor(q){
    const quoteStatus=norm(q&&q.quotationStatus);
    const orderStatus=norm(q&&q.orderStatus);
    if(['cancelled','declined','expired'].includes(quoteStatus)||orderStatus==='cancelled') return 'cancelled';
    if(orderStatus==='completed') return 'completed';
    if(['delivered','shipped'].includes(orderStatus)) return remaining(q)>0.004?'delivered-unpaid':'delivered-paid';
    if(['ready for release','ready for pick-up','ready for pickup'].includes(orderStatus)) return 'ready';
    if(['for quality check','quality checking'].includes(orderStatus)) return 'quality';
    if(['for production','preparing for production','ongoing production','on production'].includes(orderStatus)) return 'production';
    return 'pending';
  }

  function isActive(group){return !['completed','cancelled'].includes(group)}
  function escapeText(value){return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
  function matches(group){return selectedGroup==='all'||(selectedGroup==='active'?isActive(group):group===selectedGroup)}

  function paymentAudit(){
    const payments=[];
    for(const quote of (E.state.quotations||[])){
      for(const payment of (quote.payments||[])){
        if((Number(payment.amount)||0)>0) payments.push({quote,payment});
      }
    }
    const ledgers=E.state.cashLedger||[];
    const ledgerById=new Map(ledgers.map(entry=>[entry.id,entry]));
    const paymentIds=new Map();
    for(const row of payments) paymentIds.set(row.payment.id,(paymentIds.get(row.payment.id)||0)+1);
    const ledgerIds=new Map();
    for(const entry of ledgers) ledgerIds.set(entry.id,(ledgerIds.get(entry.id)||0)+1);
    const missing=payments.filter(row=>row.payment.ledgerEntryId&&!ledgerById.has(row.payment.ledgerEntryId));
    const mismatches=payments.filter(row=>{
      const entry=ledgerById.get(row.payment.ledgerEntryId);
      if(!entry) return false;
      return Math.abs((Number(row.payment.amount)||0)-(Number(entry.cashIn)||0))>.004||String(row.payment.date||'')!==String(entry.date||'')||String(row.payment.account||'')!==String(entry.account||'');
    });
    const paymentByLink=new Set(payments.map(row=>String(row.payment.id||'')+'|'+String(row.payment.ledgerEntryId||'')));
    const orphans=ledgers.filter(entry=>entry.quotationPaymentId&&!paymentByLink.has(String(entry.quotationPaymentId)+'|'+String(entry.id)));
    return {
      payments:payments.length,
      duplicatePayments:[...paymentIds.values()].filter(count=>count>1).length,
      duplicateLedgers:[...ledgerIds.values()].filter(count=>count>1).length,
      missing:missing.length,
      mismatches:mismatches.length,
      orphans:orphans.length
    };
  }

  function apply(container,table){
    let visible=0;
    table.querySelectorAll('tbody tr[data-quotation-group]').forEach(row=>{
      const show=matches(row.dataset.quotationGroup);
      row.style.display=show?'':'none';
      if(show) visible++;
    });
    let empty=table.querySelector('[data-status-group-empty]');
    if(!visible){
      if(!empty){empty=document.createElement('tr');empty.dataset.statusGroupEmpty='1';empty.innerHTML='<td colspan="8"><div class="empty-state">No quotations in this status category.</div></td>';table.tBodies[0].appendChild(empty)}
      empty.style.display='';
    }else if(empty) empty.style.display='none';
    container.querySelectorAll('[data-quotation-status-group]').forEach(button=>{
      const active=button.dataset.quotationStatusGroup===selectedGroup;
      button.classList.toggle('primary',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
  }

  function enhance(){
    scheduled=false;
    if(!E) return;
    const container=document.getElementById('main-content');
    if(!container) return;
    const title=container.querySelector('.titleblock h2')?.textContent?.trim()||'';
    if(!title.startsWith('Quotations —')) return;
    const table=[...container.querySelectorAll('table.data')].find(candidate=>{
      const headings=[...candidate.querySelectorAll('thead th')].map(cell=>cell.textContent.trim());
      return headings.includes('Quotation No.')&&headings.includes('Quotation Status')&&headings.includes('Order Status');
    });
    if(!table||table.dataset.statusGroupsEnhanced==='1') return;
    table.dataset.statusGroupsEnhanced='1';

    const rows=[];
    for(const row of table.querySelectorAll('tbody tr')){
      const open=row.querySelector('[data-open]');
      if(!open) continue;
      const quotation=(E.state.quotations||[]).find(item=>item&&item.number===open.dataset.open);
      if(!quotation) continue;
      const group=groupFor(quotation);
      row.dataset.quotationGroup=group;
      rows.push({row,group,date:String(quotation.date||''),number:String(quotation.number||'')});
    }

    const rank=new Map(['pending','production','quality','ready','delivered-unpaid','delivered-paid','completed','cancelled'].map((group,index)=>[group,index]));
    rows.sort((a,b)=>(rank.get(a.group)-rank.get(b.group))||b.date.localeCompare(a.date)||b.number.localeCompare(a.number));
    rows.forEach(item=>table.tBodies[0].appendChild(item.row));

    const counts={all:rows.length,active:rows.filter(item=>isActive(item.group)).length};
    for(const item of rows) counts[item.group]=(counts[item.group]||0)+1;
    const controls=document.createElement('div');
    controls.dataset.quotationStatusGroups='1';
    controls.className='card';
    controls.style.cssText='padding:12px 14px;margin-bottom:12px';
    const audit=paymentAudit();
    const auditIssues=audit.duplicatePayments+audit.duplicateLedgers+audit.missing+audit.mismatches+audit.orphans;
    controls.innerHTML='<div style="font-weight:800;margin-bottom:9px">Quotation Status View</div><div class="actions" style="justify-content:flex-start;flex-wrap:wrap">'+GROUPS.map(([value,label])=>'<button type="button" class="btn small" data-quotation-status-group="'+value+'">'+escapeText(label)+' <b>'+Number(counts[value]||0).toLocaleString()+'</b></button>').join('')+'</div><div style="margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--sage-light);font-size:12px;line-height:1.6"><b>Payment Integrity Check: '+(auditIssues?'Review Needed':'Clear')+'</b> · '+audit.payments.toLocaleString()+' quotation payments · Duplicate IDs '+(audit.duplicatePayments+audit.duplicateLedgers)+' · Missing Finance '+audit.missing+' · Amount/date/account mismatch '+audit.mismatches+' · Orphan Finance '+audit.orphans+'</div>';
    table.closest('.card').insertAdjacentElement('beforebegin',controls);
    controls.querySelectorAll('[data-quotation-status-group]').forEach(button=>button.addEventListener('click',()=>{selectedGroup=button.dataset.quotationStatusGroup;apply(container,table)}));
    apply(container,table);
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}
  function boot(){
    E=window.__ecohub;
    if(!E){setTimeout(boot,150);return;}
    if(window.__ecohubQuotationStatusGroupsV1) return;
    window.__ecohubQuotationStatusGroupsV1=true;
    E.quotationWorkflowGroup=groupFor;
    const root=document.getElementById('main-content')||document.body;
    const observer=new MutationObserver(schedule);
    observer.observe(root,{childList:true,subtree:true});
    schedule();
  }
  boot();
})();
