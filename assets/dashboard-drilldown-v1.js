(function(){
  'use strict';
  const E=window.__ecohub;
  if(!E || window.__ecohubDashboardDrilldownV1) return;
  const original=E.renderDashboard;
  if(typeof original!=='function') return;
  window.__ecohubDashboardDrilldownV1=true;

  const esc=(s)=>E.escapeHtml?E.escapeHtml(s):String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(n)=>E.peso?E.peso(n):'₱'+(Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const monthKey=(ym)=>`${ym.year}-${String(ym.month).padStart(2,'0')}`;
  const inMonth=(date,ym)=>!!date && String(date).slice(0,7)===monthKey(ym);
  const cancelled=(q)=>{
    const list=Array.isArray(E.CANCELLED_QUOTATION_STATUSES)?E.CANCELLED_QUOTATION_STATUSES:['Cancelled','Declined','Expired'];
    return list.includes(q&&q.quotationStatus);
  };
  const clientName=(q)=>String((q&&q.company)||(q&&q.customer)||'—').trim()||'—';

  function totals(q){
    try{return E.quotationTotals(q)||{net:0,cogs:0,grossProfit:0,grand:0};}
    catch(_e){return {net:0,cogs:0,grossProfit:0,grand:0};}
  }
  function payInfo(q){
    try{return E.quotationPaymentInfo(q)||{grand:0,amountPaid:0,remainingBalance:0,status:'—'};}
    catch(_e){return {grand:0,amountPaid:0,remainingBalance:0,status:'—'};}
  }
  function recognized(q){
    try{return E.isRevenueRecognized?E.isRevenueRecognized(q):q&&q.orderStatus==='Completed';}
    catch(_e){return q&&q.orderStatus==='Completed';}
  }
  function confirmed(q){
    try{return E.isConfirmedQuotation?E.isConfirmedQuotation(q):!cancelled(q);}
    catch(_e){return !cancelled(q);}
  }

  function closeModal(){
    const old=document.getElementById('ecohub-dashboard-drill-modal');
    if(old) old.remove();
  }
  function openQuotation(number){
    closeModal();
    try{
      E.navigate('quotations');
      setTimeout(()=>{
        const c=document.getElementById('main-content');
        if(c && E.openQuotationEditor) E.openQuotationEditor(c,number);
      },0);
    }catch(err){console.error('Open quotation from dashboard drilldown failed',err);}
  }
  function modalShell(title,sub,totalLabel,totalValue,body){
    closeModal();
    const overlay=document.createElement('div');
    overlay.id='ecohub-dashboard-drill-modal';
    overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(20,34,25,.48);display:flex;align-items:flex-start;justify-content:center;padding:5vh 14px 24px;overflow:auto;';
    overlay.innerHTML=`<div style="width:min(1180px,100%);background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.25);overflow:hidden;">
      <div style="padding:16px 18px;border-bottom:1px solid var(--line,#ddd);display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-soft,#68766c);">Dashboard Breakdown</div><h3 style="margin:3px 0 2px;">${esc(title)}</h3><div style="font-size:12px;color:var(--ink-soft,#68766c);">${esc(sub||'')}</div></div>
        <button class="btn" id="ecohub-dashboard-drill-close" style="min-width:44px;">Close</button>
      </div>
      <div style="padding:14px 18px 8px;"><div class="kpi" style="display:inline-block;min-width:220px;"><div class="lbl">${esc(totalLabel)}</div><div class="val">${money(totalValue)}</div></div></div>
      <div style="padding:0 18px 18px;">${body}</div>
    </div>`;
    document.body.appendChild(overlay);
    const closeBtn=overlay.querySelector('#ecohub-dashboard-drill-close');
    if(closeBtn) closeBtn.addEventListener('click',closeModal);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal();});
    overlay.querySelectorAll('[data-drill-open-q]').forEach(btn=>btn.addEventListener('click',()=>openQuotation(btn.dataset.drillOpenQ)));
  }

  function tableWrap(head,rows,colspan,totalRow){
    return `<div class="table-wrap" style="max-height:62vh;overflow:auto;"><table class="data"><thead><tr>${head}</tr></thead><tbody>${rows||`<tr><td colspan="${colspan}"><div class="empty-state">No matching quotations.</div></td></tr>`}</tbody>${totalRow||''}</table></div>`;
  }

  function showCompletedProfit(){
    try{
      const ym=E.state&&E.state.selectedMonth?E.state.selectedMonth:{year:new Date().getFullYear(),month:new Date().getMonth()+1};
      const qs=(E.state&&Array.isArray(E.state.quotations)?E.state.quotations:[])
        .filter(q=>recognized(q) && inMonth(q.completedDate||q.date,ym))
        .map(q=>({q,t:totals(q),p:payInfo(q),date:q.completedDate||q.date}))
        .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
      const total=qs.reduce((s,x)=>s+(Number(x.t.grossProfit)||0),0);
      const rows=qs.map(x=>`<tr>
        <td>${esc(x.date||'—')}</td><td><b>${esc(x.q.number||'—')}</b></td><td>${esc(clientName(x.q))}</td>
        <td class="num">${money(x.t.net)}</td><td class="num">${money(x.t.cogs)}</td><td class="num" style="font-weight:900;color:${(Number(x.t.grossProfit)||0)<0?'var(--red,#B3564A)':'var(--green,#1F6F4A)'};">${money(x.t.grossProfit)}</td>
        <td class="num">${money(x.p.amountPaid)}</td><td class="num">${money(x.p.remainingBalance)}</td>
        <td><button class="btn small" data-drill-open-q="${esc(x.q.number||'')}">Open Quotation</button></td></tr>`).join('');
      const totalRow=qs.length?`<tfoot><tr style="font-weight:900;background:var(--cream,#FAF8F3);"><td colspan="3">TOTAL</td><td class="num">${money(qs.reduce((s,x)=>s+(Number(x.t.net)||0),0))}</td><td class="num">${money(qs.reduce((s,x)=>s+(Number(x.t.cogs)||0),0))}</td><td class="num">${money(total)}</td><td class="num">${money(qs.reduce((s,x)=>s+(Number(x.p.amountPaid)||0),0))}</td><td class="num">${money(qs.reduce((s,x)=>s+(Number(x.p.remainingBalance)||0),0))}</td><td></td></tr></tfoot>`:'';
      modalShell('Net Profit — Completed Quotations',`${new Date(ym.year,ym.month-1,1).toLocaleString('en-US',{month:'long',year:'numeric'})} · one row per completed quotation`,'Total Net Profit',total,tableWrap('<th>Completed</th><th>Quotation</th><th>Client</th><th class="num">Net Sales</th><th class="num">Direct Cost</th><th class="num">Net Profit</th><th class="num">Paid</th><th class="num">Balance</th><th></th>',rows,9,totalRow));
    }catch(err){console.error('Completed profit drilldown failed',err);}
  }

  function showOpenProfit(){
    try{
      const qs=(E.state&&Array.isArray(E.state.quotations)?E.state.quotations:[])
        .filter(q=>confirmed(q) && !recognized(q) && !cancelled(q))
        .map(q=>({q,t:totals(q),p:payInfo(q)}))
        .sort((a,b)=>String(b.q.date||'').localeCompare(String(a.q.date||'')));
      const total=qs.reduce((s,x)=>s+(Number(x.t.grossProfit)||0),0);
      const rows=qs.map(x=>`<tr>
        <td>${esc(x.q.date||'—')}</td><td><b>${esc(x.q.number||'—')}</b></td><td>${esc(clientName(x.q))}</td><td>${esc(x.q.orderStatus||x.q.quotationStatus||'—')}</td>
        <td class="num">${money(x.t.net)}</td><td class="num">${money(x.t.cogs)}</td><td class="num" style="font-weight:900;">${money(x.t.grossProfit)}</td>
        <td class="num">${money(x.p.amountPaid)}</td><td class="num">${money(x.p.remainingBalance)}</td><td><button class="btn small" data-drill-open-q="${esc(x.q.number||'')}">Open Quotation</button></td></tr>`).join('');
      modalShell('Receivable Profit — Open Orders','Confirmed/open orders not yet completed · projected order profit by quotation','Total Receivable Profit',total,tableWrap('<th>Date</th><th>Quotation</th><th>Client</th><th>Status</th><th class="num">Net Sales</th><th class="num">Direct Cost</th><th class="num">Projected Profit</th><th class="num">Paid</th><th class="num">Balance</th><th></th>',rows,10,''));
    }catch(err){console.error('Open profit drilldown failed',err);}
  }

  function showReceivables(){
    try{
      const qs=(E.state&&Array.isArray(E.state.quotations)?E.state.quotations:[])
        .filter(q=>confirmed(q))
        .map(q=>({q,p:payInfo(q)}))
        .filter(x=>(Number(x.p.remainingBalance)||0)>0.004)
        .sort((a,b)=>(Number(b.p.remainingBalance)||0)-(Number(a.p.remainingBalance)||0));
      const total=qs.reduce((s,x)=>s+(Number(x.p.remainingBalance)||0),0);
      const rows=qs.map(x=>`<tr>
        <td>${esc(x.q.date||'—')}</td><td><b>${esc(x.q.number||'—')}</b></td><td>${esc(clientName(x.q))}</td>
        <td class="num">${money(x.p.grand)}</td><td class="num">${money(x.p.amountPaid)}</td><td class="num" style="font-weight:900;">${money(x.p.remainingBalance)}</td>
        <td>${esc(x.p.status||'—')}</td><td>${esc(x.q.paymentDueDate||'—')}</td><td><button class="btn small" data-drill-open-q="${esc(x.q.number||'')}">Open Quotation</button></td></tr>`).join('');
      modalShell('Outstanding Receivables','All confirmed quotations with an unpaid balance, regardless of month','Total Outstanding Receivables',total,tableWrap('<th>Date</th><th>Quotation</th><th>Client</th><th class="num">Total</th><th class="num">Paid</th><th class="num">Balance</th><th>Status</th><th>Due Date</th><th></th>',rows,9,''));
    }catch(err){console.error('Receivables drilldown failed',err);}
  }

  function bindCard(card,handler,newLabel){
    if(!card) return;
    card.style.cursor='pointer';
    card.style.borderColor='var(--sage,#A9BFA3)';
    card.title='Click to view detailed quotation breakdown';
    const lbl=card.querySelector('.lbl');
    if(lbl && newLabel && lbl.textContent!==newLabel) lbl.textContent=newLabel;
    card.onclick=handler;
  }

  function enhance(container){
    try{
      if(!container || !container.querySelector) return;
      const title=container.querySelector('.titleblock h2');
      if(!title || !String(title.textContent||'').startsWith('Dashboard')) return;
      const cards=[...container.querySelectorAll('.kpi-grid .kpi')];
      const byLabel=(needle)=>cards.find(c=>String(c.querySelector('.lbl')?.textContent||'').trim().startsWith(needle));
      bindCard(byLabel('Realized Gross Profit'),showCompletedProfit,'Net Profit — Completed Orders ↗');
      bindCard(byLabel('Net Profit — Completed Orders'),showCompletedProfit,'Net Profit — Completed Orders ↗');
      bindCard(byLabel('Receivable Profit — Open Orders'),showOpenProfit,'Receivable Profit — Open Orders ↗');

      let rec=container.querySelector('#dashboard-outstanding-receivables-card');
      if(!rec){
        const grid=container.querySelector('.kpi-grid');
        if(grid){
          const d=E.computeDashboard(E.state.selectedMonth);
          const value=(d.carryOverReceivables||[]).reduce((s,r)=>s+(Number(r.remainingBalance)||0),0);
          rec=document.createElement('div');
          rec.className='kpi';
          rec.id='dashboard-outstanding-receivables-card';
          rec.innerHTML=`<div class="lbl">Outstanding Receivables ↗</div><div class="val">${money(value)}</div>`;
          grid.appendChild(rec);
        }
      }
      bindCard(rec,showReceivables,'Outstanding Receivables ↗');

      if(!container.__dashboardDrillObserver){
        let timer=0;
        const obs=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>enhance(container),30);});
        obs.observe(container,{childList:true,subtree:true});
        container.__dashboardDrillObserver=obs;
      }
    }catch(err){console.error('EcoHub dashboard drilldown enhancement failed',err);}
  }

  E.renderDashboard=function(container){
    const result=original(container);
    setTimeout(()=>enhance(container),0);
    return result;
  };

  // The dashboard may already be rendered before this add-on loads.
  // Enhance the existing view immediately so KPI cards work on first load.
  setTimeout(()=>{
    try{
      const current=document.getElementById('main-content');
      if(current) enhance(current);
    }catch(err){
      console.error('EcoHub dashboard initial drilldown attach failed',err);
    }
  },0);

  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
})();
