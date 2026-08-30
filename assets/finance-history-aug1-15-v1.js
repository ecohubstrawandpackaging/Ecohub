(function(){
  'use strict';

  const START_DATE='2026-08-01';
  const END_DATE='2026-08-15';
  let tries=0;
  let accountFilter='';
  let typeFilter='';
  let searchFilter='';

  function boot(){
    const E=window.__ecohub;
    if(!E || !E.renderFinance || !window.__financeAug16FixV3){
      if(++tries<160)setTimeout(boot,100);
      return;
    }
    if(window.__ecohubFinanceHistoryAug115V1)return;
    window.__ecohubFinanceHistoryAug115V1=true;

    const state=E.state;
    const esc=value=>E.escapeHtml?E.escapeHtml(value):String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const money=value=>E.peso?E.peso(Number(value)||0):'₱'+(Number(value)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
    const amount=value=>Number(value)||0;
    const stamp=entry=>`${entry?.date||''}T${entry?.time||'00:00'}|${entry?.createdAt||''}|${entry?.id||''}`;

    function archiveRows(){
      return (state.cashLedger||[]).filter(entry=>{
        const date=String(entry?.date||'');
        return date>=START_DATE && date<=END_DATE;
      }).slice().sort((a,b)=>stamp(b).localeCompare(stamp(a)));
    }

    function options(values,selected){
      return values.map(value=>`<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(value)}</option>`).join('');
    }

    function drawTable(section,allRows){
      const needle=searchFilter.trim().toLowerCase();
      const rows=allRows.filter(entry=>{
        if(accountFilter && entry.account!==accountFilter)return false;
        if(typeFilter && entry.transactionType!==typeFilter)return false;
        if(!needle)return true;
        return [entry.date,entry.time,entry.transactionType,entry.clientOrSupplier,entry.account,entry.referenceNumber,entry.remarks]
          .some(value=>String(value||'').toLowerCase().includes(needle));
      });
      const body=section.querySelector('[data-history-body]');
      const count=section.querySelector('[data-history-count]');
      if(count)count.textContent=`Showing ${rows.length} of ${allRows.length} transactions`;
      if(!body)return;
      body.innerHTML=rows.length?rows.map(entry=>{
        const cashIn=amount(entry.cashIn),cashOut=amount(entry.cashOut);
        return `<tr>
          <td>${esc(entry.date||'—')}</td>
          <td>${esc(entry.time||'—')}</td>
          <td><span class="pill ${cashIn>0?'green':'orange'}">${esc(entry.transactionType||'—')}</span></td>
          <td>${esc(entry.clientOrSupplier||'—')}</td>
          <td>${esc(entry.account||'—')}</td>
          <td class="num">${cashIn>0?money(cashIn):'—'}</td>
          <td class="num">${cashOut>0?money(cashOut):'—'}</td>
          <td>${esc(entry.referenceNumber||'—')}</td>
          <td>${esc(entry.remarks||'')}</td>
        </tr>`;
      }).join(''):`<tr><td colspan="9"><div class="empty-state">No historical transactions match the selected filters.</div></td></tr>`;
    }

    function renderArchive(container){
      if(!container)return;
      const ledgerBody=container.querySelector('#fin-ledger-body');
      const currentLedgerCard=ledgerBody?.closest('.card');
      if(!currentLedgerCard)return;
      container.querySelector('#finance-history-aug1-15')?.remove();

      const allRows=archiveRows();
      const totals=allRows.reduce((summary,entry)=>{
        summary.cashIn+=amount(entry.cashIn);
        summary.cashOut+=amount(entry.cashOut);
        return summary;
      },{cashIn:0,cashOut:0});
      const accounts=[...new Set(allRows.map(entry=>entry.account).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      const types=[...new Set(allRows.map(entry=>entry.transactionType).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

      const section=document.createElement('section');
      section.id='finance-history-aug1-15';
      section.className='card';
      section.style.border='2px solid var(--sage)';
      section.innerHTML=`
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <p class="eyebrow" style="margin:0 0 4px">Read-only archive</p>
            <h3 style="margin:0">Past Transactions — August 1–15, 2026</h3>
            <p style="color:var(--ink-soft);font-size:12px;margin:6px 0 0;max-width:820px">
              For records and reconciliation only. These entries are excluded from current Finance balances, cash-flow reports, charts, and quotation computations.
            </p>
          </div>
          <span class="pill green">HISTORY ONLY · NO FINANCE EFFECT</span>
        </div>
        <div class="kpi-grid" style="grid-template-columns:repeat(4,minmax(150px,1fr));margin-top:14px">
          <div class="kpi"><div class="lbl">Transactions</div><div class="val">${allRows.length.toLocaleString()}</div></div>
          <div class="kpi"><div class="lbl">Total Money In</div><div class="val">${money(totals.cashIn)}</div></div>
          <div class="kpi"><div class="lbl">Total Money Out</div><div class="val">${money(totals.cashOut)}</div></div>
          <div class="kpi"><div class="lbl">Net Historical Flow</div><div class="val">${money(totals.cashIn-totals.cashOut)}</div></div>
        </div>
        <div class="grid" style="grid-template-columns:repeat(3,minmax(180px,1fr));margin-top:14px">
          <div class="field"><label>Account</label><select data-history-account><option value="">All accounts</option>${options(accounts,accountFilter)}</select></div>
          <div class="field"><label>Transaction Type</label><select data-history-type><option value="">All types</option>${options(types,typeFilter)}</select></div>
          <div class="field"><label>Search Records</label><input data-history-search value="${esc(searchFilter)}" placeholder="Client, reference, or remarks…"></div>
        </div>
        <div data-history-count style="font-size:11.5px;color:var(--ink-soft);margin:10px 0 6px"></div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Client/Supplier</th><th>Account</th><th class="num">Money In</th><th class="num">Money Out</th><th>Reference</th><th>Remarks</th></tr></thead>
            <tbody data-history-body></tbody>
          </table>
        </div>`;
      currentLedgerCard.insertAdjacentElement('afterend',section);

      section.querySelector('[data-history-account]')?.addEventListener('change',event=>{accountFilter=event.target.value;drawTable(section,allRows);});
      section.querySelector('[data-history-type]')?.addEventListener('change',event=>{typeFilter=event.target.value;drawTable(section,allRows);});
      section.querySelector('[data-history-search]')?.addEventListener('input',event=>{searchFilter=event.target.value;drawTable(section,allRows);});
      drawTable(section,allRows);
    }

    const previousRenderFinance=E.renderFinance;
    E.renderFinance=function(container){
      const result=previousRenderFinance(container);
      renderArchive(container);
      return result;
    };

    const current=document.getElementById('main-content');
    if(current)renderArchive(current);
    console.log('Read-only Finance history for Aug 1–15 installed');
  }

  boot();
})();
