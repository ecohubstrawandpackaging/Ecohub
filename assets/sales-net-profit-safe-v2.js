(function(){
  'use strict';
  const E=window.__ecohub;
  if(!E || window.__ecohubSalesProfitSafeV2) return;
  const original=E.renderSales;
  if(typeof original!=='function') return;
  window.__ecohubSalesProfitSafeV2=true;

  function clientName(q){
    try{
      const c=E.findClientForQuotation ? E.findClientForQuotation(q) : null;
      if(c && E.clientDisplayName) return E.clientDisplayName(c) || 'Unassigned Client';
    }catch(_e){}
    return String((q&&q.company)||(q&&q.customer)||'Unassigned Client').trim() || 'Unassigned Client';
  }

  function esc(s){ return E.escapeHtml ? E.escapeHtml(s) : String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function money(n){ return E.peso ? E.peso(n) : '₱'+(Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }

  function getRows(){
    const qs=(E.state&&Array.isArray(E.state.quotations))?E.state.quotations:[];
    return qs.filter(q=>{
      try{return E.isRevenueRecognized ? E.isRevenueRecognized(q) : q&&q.orderStatus==='Completed';}
      catch(_e){return q&&q.orderStatus==='Completed';}
    }).map(q=>{
      const t=E.quotationTotals(q);
      const p=E.quotationPaymentInfo(q);
      const net=Number(t.net)||0;
      const cost=Number(t.cogs)||0;
      const profit=Number(t.grossProfit)||0;
      return {
        q,
        date:q.completedDate||q.date||'',
        client:clientName(q),
        net,
        cost,
        profit,
        margin:net>0?(profit/net)*100:0,
        paid:Number(p.amountPaid)||0,
        balance:Number(p.remainingBalance)||0
      };
    }).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  }

  function enhance(container){
    try{
      if(!container || !container.querySelector) return;
      const grid=container.querySelector('.kpi-grid');
      if(!grid) return;

      const all=getRows();
      const search=container.querySelector('#sales-search');
      const needle=String(search&&search.value||'').trim().toLowerCase();
      const rows=needle ? all.filter(x=>String(x.client).toLowerCase().includes(needle)||String(x.q.number||'').toLowerCase().includes(needle)) : all;
      const totalProfit=all.reduce((s,x)=>s+x.profit,0);
      const totalNet=rows.reduce((s,x)=>s+x.net,0);
      const totalCost=rows.reduce((s,x)=>s+x.cost,0);
      const shownProfit=rows.reduce((s,x)=>s+x.profit,0);
      const totalPaid=rows.reduce((s,x)=>s+x.paid,0);
      const totalBalance=rows.reduce((s,x)=>s+x.balance,0);

      const kpis=grid.querySelectorAll('.kpi');
      if(kpis.length>=4){
        const lbl=kpis[3].querySelector('.lbl');
        const val=kpis[3].querySelector('.val');
        if(lbl && lbl.textContent!=='Total Net Profit') lbl.textContent='Total Net Profit';
        if(val && val.textContent!==money(totalProfit)) val.textContent=money(totalProfit);
      }
      container.querySelectorAll('th').forEach(th=>{ if(th.textContent.trim()==='Gross Profit') th.textContent='Net Profit'; });

      const signature=needle+'|'+rows.map(x=>[x.q.number,x.date,x.net,x.cost,x.profit,x.paid,x.balance].join(':')).join(';');
      let card=container.querySelector('#sales-net-profit-card-safe');
      if(card && card.dataset.signature===signature) return;
      if(card) card.remove();

      card=document.createElement('div');
      card.id='sales-net-profit-card-safe';
      card.className='card';
      card.dataset.signature=signature;
      card.style.marginBottom='14px';
      card.innerHTML=`
        <div style="padding:14px 16px 8px;display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;">
          <div><b>Net Profit by Completed Quotation</b><div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px;">Net Profit = Net Sales after item discounts − Direct Product Cost.</div></div>
          <div class="pill green">${rows.length.toLocaleString()} shown</div>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Completed</th><th>Quotation No.</th><th>Client</th><th class="num">Net Sales</th><th class="num">Direct Cost</th><th class="num">Net Profit</th><th class="num">Margin</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead>
            <tbody>${rows.length?rows.map(x=>`<tr><td>${esc(x.date||'—')}</td><td><b>${esc(x.q.number||'—')}</b></td><td>${esc(x.client||'—')}</td><td class="num">${money(x.net)}</td><td class="num">${money(x.cost)}</td><td class="num" style="font-weight:900;color:${x.profit<0?'var(--red)':'var(--green)'};">${money(x.profit)}</td><td class="num">${x.margin.toFixed(1)}%</td><td class="num">${money(x.paid)}</td><td class="num">${money(x.balance)}</td></tr>`).join(''):`<tr><td colspan="9"><div class="empty-state">${all.length?'No completed quotation matches your search.':'No completed sales yet.'}</div></td></tr>`}</tbody>
            ${rows.length?`<tfoot><tr style="font-weight:900;background:var(--cream);"><td colspan="3">TOTAL${needle?' (FILTERED)':''}</td><td class="num">${money(totalNet)}</td><td class="num">${money(totalCost)}</td><td class="num">${money(shownProfit)}</td><td class="num">${totalNet>0?(shownProfit/totalNet*100).toFixed(1)+'%':'0.0%'}</td><td class="num">${money(totalPaid)}</td><td class="num">${money(totalBalance)}</td></tr></tfoot>`:''}
          </table>
        </div>`;
      grid.insertAdjacentElement('afterend',card);
    }catch(err){
      console.error('EcoHub Sales Net Profit enhancement failed:',err);
    }
  }

  E.renderSales=function(container){
    const result=original(container);
    setTimeout(()=>enhance(container),0);
    if(container && !container.__salesProfitObserver){
      let timer=0;
      const observer=new MutationObserver(()=>{
        clearTimeout(timer);
        timer=setTimeout(()=>enhance(container),20);
      });
      observer.observe(container,{childList:true,subtree:true});
      container.__salesProfitObserver=observer;
    }
    return result;
  };
})();
