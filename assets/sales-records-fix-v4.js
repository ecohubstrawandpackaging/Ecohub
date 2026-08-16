(function(){
  'use strict';
  const E=window.__ecohub;
  if(!E || window.__ecohubSalesRecordsFixV4) return;
  window.__ecohubSalesRecordsFixV4=true;

  // Critical core fix: the original Sales Records renderer references `state`
  // as a global identifier even though the app keeps it under __ecohub.state.
  // Expose the same object globally so the original renderer can execute.
  window.state=E.state;

  const esc=(s)=>E.escapeHtml?E.escapeHtml(s):String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=(n)=>E.peso?E.peso(n):'₱'+(Number(n)||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const now=new Date();
  let ym={year:now.getFullYear(),month:now.getMonth()+1};
  let mode='month';

  function monthKey(){return `${ym.year}-${String(ym.month).padStart(2,'0')}`;}
  function inPeriod(date){return mode==='all'||(!!date&&String(date).slice(0,7)===monthKey());}
  function periodLabel(){return mode==='all'?'All Time':new Date(ym.year,ym.month-1,1).toLocaleString('en-US',{month:'long',year:'numeric'});}
  function clientName(q){
    try{
      const c=E.findClientForQuotation?E.findClientForQuotation(q):null;
      if(c&&E.clientDisplayName)return E.clientDisplayName(c)||'Unassigned Client';
    }catch(_e){}
    return String((q&&q.company)||(q&&q.customer)||'Unassigned Client').trim()||'Unassigned Client';
  }
  function payClass(status){
    if(status==='Fully Paid')return 'green';
    if(status==='Overdue')return 'red';
    if(status==='Partially Paid')return 'orange';
    return 'gray';
  }
  function rows(){
    const qs=(E.state&&Array.isArray(E.state.quotations))?E.state.quotations:[];
    return qs.filter(q=>{
      try{return E.isRevenueRecognized?E.isRevenueRecognized(q):q&&q.orderStatus==='Completed';}
      catch(_e){return q&&q.orderStatus==='Completed';}
    }).map(q=>{
      let t={grand:0,net:0,cogs:0,grossProfit:0};
      let p={amountPaid:0,remainingBalance:0,status:'Unpaid'};
      try{t=E.quotationTotals(q)||t;}catch(_e){}
      try{p=E.quotationPaymentInfo(q)||p;}catch(_e){}
      const snap=q&&q.profitSummary&&typeof q.profitSummary==='object'?q.profitSummary:null;
      if((!Number.isFinite(Number(t.net))||Number(t.net)===0)&&snap)t.net=Number(snap.netSales)||0;
      if((!Number.isFinite(Number(t.cogs))||Number(t.cogs)===0)&&snap)t.cogs=Number(snap.cogs)||0;
      if((!Number.isFinite(Number(t.grossProfit))||Number(t.grossProfit)===0)&&snap)t.grossProfit=Number(snap.grossProfit)||0;
      return {q,t,p,date:q.completedDate||q.date||'',client:clientName(q)};
    }).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||String(b.q.number||'').localeCompare(String(a.q.number||'')));
  }
  function collections(){
    let sum=0;
    for(const q of ((E.state&&E.state.quotations)||[])){
      for(const p of (Array.isArray(q.payments)?q.payments:[]))if(inPeriod(p.date))sum+=Number(p.amount)||0;
    }
    return sum;
  }
  function paymentHistory(q){
    const ps=Array.isArray(q.payments)?q.payments:[];
    if(!ps.length)return '<div class="empty-state" style="padding:10px;">No payment recorded yet. This completed order stays under Receivables until a payment is recorded in the quotation.</div>';
    return `<div class="table-wrap"><table class="data" style="font-size:11.5px"><thead><tr><th>Date</th><th class="num">Amount</th><th>Method</th><th>Account</th><th>Reference</th><th>Remarks</th></tr></thead><tbody>${ps.map(p=>`<tr><td>${esc(p.date||'—')}</td><td class="num"><b>${money(p.amount)}</b></td><td>${esc(p.method||'—')}</td><td>${esc(p.account||'—')}</td><td>${esc(p.reference||'—')}</td><td>${esc(p.remarks||'—')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function itemHistory(q){
    const items=Array.isArray(q.items)?q.items:[];
    if(!items.length)return '<div class="empty-state">No items recorded.</div>';
    return `<div class="table-wrap"><table class="data" style="font-size:11.5px"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Net Sale</th><th class="num">Direct Cost</th><th class="num">Net Profit</th></tr></thead><tbody>${items.map(it=>{
      const qty=Number(it.qty)||0,gross=qty*(Number(it.price)||0),disc=Number(it.discount)||0,net=Math.max(0,gross-disc),cost=qty*(Number(it.cost)||0),profit=net-cost;
      return `<tr><td>${esc(it.name||it.description||'—')}</td><td class="num">${qty.toLocaleString()}</td><td class="num">${money(net)}</td><td class="num">${money(cost)}</td><td class="num"><b>${money(profit)}</b></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function findRoot(){
    const s=document.querySelector('#sales-search');
    if(!s)return null;
    let n=s;
    while(n&&n!==document.body){if(n.querySelector&&n.querySelector('.kpi-grid')&&n.querySelector('.card'))return n;n=n.parentElement;}
    return null;
  }
  function renderTracker(){
    try{
      const root=findRoot();
      if(!root)return;
      const all=rows();
      const period=all.filter(x=>inPeriod(x.date));
      const search=root.querySelector('#sales-search');
      const needle=String(search&&search.value||'').trim().toLowerCase();
      const shown=needle?period.filter(x=>x.client.toLowerCase().includes(needle)||String(x.q.number||'').toLowerCase().includes(needle)):period;
      const sum=period.reduce((a,x)=>{
        a.completed+=Number(x.t.grand)||0;a.net+=Number(x.t.net)||0;a.cost+=Number(x.t.cogs)||0;a.profit+=Number(x.t.grossProfit)||0;a.receivable+=Number(x.p.remainingBalance)||0;a.count++;
        if(x.p.status==='Fully Paid')a.full++;else if(x.p.status==='Partially Paid')a.partial++;else if(x.p.status==='Overdue')a.overdue++;else a.unpaid++;
        return a;
      },{completed:0,net:0,cost:0,profit:0,receivable:0,count:0,full:0,partial:0,overdue:0,unpaid:0});
      const margin=sum.net>0?sum.profit/sum.net*100:0;
      const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
      const years=[];for(let y=2024;y<=new Date().getFullYear()+2;y++)years.push(y);
      let box=root.querySelector('#sales-monthly-tracker-v4');
      if(box)box.remove();
      box=document.createElement('div');
      box.id='sales-monthly-tracker-v4';
      box.innerHTML=`
        <div class="card" style="margin:0 0 14px;overflow:hidden;">
          <div style="padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <div><b>Monthly Sales & Collection Tracker</b><div style="font-size:11.5px;color:var(--ink-soft);margin-top:2px;">Completed orders stay in Sales even when unpaid. Payments are tracked separately by payment date.</div></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
              <button class="btn small" data-srv4="prev" ${mode==='all'?'disabled':''}>‹</button>
              <select data-srv4="month" ${mode==='all'?'disabled':''}>${months.map((m,i)=>`<option value="${i+1}" ${ym.month===i+1?'selected':''}>${m}</option>`).join('')}</select>
              <select data-srv4="year" ${mode==='all'?'disabled':''}>${years.map(y=>`<option value="${y}" ${ym.year===y?'selected':''}>${y}</option>`).join('')}</select>
              <button class="btn small" data-srv4="next" ${mode==='all'?'disabled':''}>›</button>
              <button class="btn small ${mode==='all'?'primary':''}" data-srv4="all">${mode==='all'?'✓ All Time':'All Time'}</button>
            </div>
          </div>
          <div class="kpi-grid" style="padding:14px 14px 4px;">
            <div class="kpi"><div class="lbl">Completed Sales</div><div class="val">${money(sum.completed)}</div><div class="sub">${sum.count} completed quotation${sum.count===1?'':'s'} · ${esc(periodLabel())}</div></div>
            <div class="kpi"><div class="lbl">Collections Received</div><div class="val">${money(collections())}</div><div class="sub">Actual payments dated in ${esc(periodLabel())}</div></div>
            <div class="kpi"><div class="lbl">Outstanding Receivables</div><div class="val">${money(sum.receivable)}</div><div class="sub">Completed orders with balance remaining</div></div>
            <div class="kpi"><div class="lbl">Direct Cost</div><div class="val">${money(sum.cost)}</div></div>
            <div class="kpi"><div class="lbl">Net Profit</div><div class="val" style="color:${sum.profit<0?'var(--red)':'var(--green)'}">${money(sum.profit)}</div><div class="sub">${margin.toFixed(1)}% margin · before operating expenses</div></div>
          </div>
          <div style="padding:0 14px 12px;display:flex;gap:7px;flex-wrap:wrap;"><span class="pill green">Fully Paid: ${sum.full}</span><span class="pill orange">Partially Paid: ${sum.partial}</span><span class="pill gray">Unpaid: ${sum.unpaid}</span>${sum.overdue?`<span class="pill red">Overdue: ${sum.overdue}</span>`:''}</div>
          <div class="table-wrap"><table class="data"><thead><tr><th>Completed</th><th>Quotation</th><th>Client</th><th>Payment Status</th><th class="num">Completed Sale</th><th class="num">Paid to Date</th><th class="num">Receivable</th><th class="num">Direct Cost</th><th class="num">Net Profit</th><th></th></tr></thead><tbody>${shown.length?shown.map((x,i)=>`<tr><td>${esc(x.date||'—')}</td><td><b>${esc(x.q.number||'—')}</b></td><td>${esc(x.client)}</td><td><span class="pill ${payClass(x.p.status)}">${esc(x.p.status)}</span></td><td class="num">${money(x.t.grand)}</td><td class="num">${money(x.p.amountPaid)}</td><td class="num" style="font-weight:800;color:${Number(x.p.remainingBalance)>0.004?'var(--red)':'var(--green)'}">${money(x.p.remainingBalance)}</td><td class="num">${money(x.t.cogs)}</td><td class="num"><b>${money(x.t.grossProfit)}</b></td><td><button class="btn small" data-srv4-detail="${i}">Details</button></td></tr><tr data-srv4-row="${i}" style="display:none;background:var(--sage-light)"><td colspan="10"><div style="padding:10px 12px"><div style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--ink-soft);margin:2px 0 6px">Items / Profit Breakdown</div>${itemHistory(x.q)}<div style="font-size:11px;font-weight:800;text-transform:uppercase;color:var(--ink-soft);margin:12px 0 6px">Payment History</div>${paymentHistory(x.q)}<div style="display:flex;justify-content:flex-end;margin-top:9px"><button class="btn small" data-srv4-open="${esc(x.q.number||'')}">Open Quotation</button></div></div></td></tr>`).join(''):`<tr><td colspan="10"><div class="empty-state">${period.length?'No completed quotation matches the search.':'No completed sales for '+esc(periodLabel())+'.'}</div></td></tr>`}</tbody></table></div>
        </div>`;
      const grid=root.querySelector('.kpi-grid');
      if(grid)grid.insertAdjacentElement('afterend',box);else root.prepend(box);
    }catch(err){console.error('Sales Records monthly tracker failed',err);}
  }
  function schedule(){setTimeout(renderTracker,0);setTimeout(renderTracker,100);}

  document.addEventListener('click',e=>{
    const nav=e.target.closest&&e.target.closest('[data-view="sales"]');
    if(nav){schedule();return;}
    const ctl=e.target.closest&&e.target.closest('[data-srv4]');
    if(ctl){
      const a=ctl.dataset.srv4;
      if(a==='prev'){mode='month';ym.month--;if(ym.month<1){ym.month=12;ym.year--;}}
      else if(a==='next'){mode='month';ym.month++;if(ym.month>12){ym.month=1;ym.year++;}}
      else if(a==='all'){mode=mode==='all'?'month':'all';}
      schedule();return;
    }
    const d=e.target.closest&&e.target.closest('[data-srv4-detail]');
    if(d){const row=document.querySelector(`[data-srv4-row="${d.dataset.srv4Detail}"]`);if(row){const open=row.style.display==='none';row.style.display=open?'table-row':'none';d.textContent=open?'Close':'Details';}return;}
    const o=e.target.closest&&e.target.closest('[data-srv4-open]');
    if(o){const qno=o.dataset.srv4Open;if(qno){E.navigate('quotations');E.openQuotationEditor(document.getElementById('main-content'),qno);}return;}
  },true);
  document.addEventListener('change',e=>{
    if(e.target.matches&&e.target.matches('[data-srv4="month"]')){mode='month';ym.month=parseInt(e.target.value,10)||ym.month;schedule();}
    if(e.target.matches&&e.target.matches('[data-srv4="year"]')){mode='month';ym.year=parseInt(e.target.value,10)||ym.year;schedule();}
  },true);
  document.addEventListener('input',e=>{if(e.target&&e.target.id==='sales-search')schedule();},true);
  setTimeout(()=>{window.state=E.state;schedule();},0);
})();
