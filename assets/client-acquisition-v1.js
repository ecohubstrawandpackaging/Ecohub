(function(){
  'use strict';
  let E=null;
  let scheduled=false;
  let acquisitionFilter='all';
  const norm=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
  const iso=value=>String(value||'').slice(0,10);
  const amount=value=>Number(value)||0;

  function paidPayments(q){
    return (Array.isArray(q&&q.payments)?q.payments:[]).filter(payment=>amount(payment&&payment.amount)>0);
  }

  function committedOrder(q){
    const quotationStatus=norm(q&&q.quotationStatus);
    const orderStatus=norm(q&&q.orderStatus);
    if(quotationStatus==='approved') return true;
    return [
      'waiting for down payment','for production','preparing for production','ongoing production',
      'on production','for quality check','quality checking','ready for release','ready for pick-up',
      'ready for pickup','delivered','shipped','completed'
    ].includes(orderStatus);
  }

  function poReference(q){
    return String(q&&(q.poNumber||q.purchaseOrderNumber||q.clientPONumber||q.customerPONumber||q.number)||'').trim();
  }

  function acquisitionEvents(q){
    if(!q) return [];
    const events=[];
    for(const payment of paidPayments(q)){
      const date=iso(payment.date||payment.createdAt||q.date||q.createdAt);
      if(date) events.push({date,source:'Payment / Down Payment'});
    }
    const hasExplicitPO=!!String(q.poNumber||q.purchaseOrderNumber||q.clientPONumber||q.customerPONumber||'').trim();
    if(hasExplicitPO||committedOrder(q)){
      const date=iso(q.poDate||q.purchaseOrderDate||q.clientPODate||q.customerPODate||q.approvedDate||q.orderConfirmedDate||q.confirmedDate||q.date||q.createdAt);
      if(date) events.push({date,source:hasExplicitPO?'Purchase Order':'Approved / Confirmed Order'});
    }
    return events.sort((a,b)=>a.date.localeCompare(b.date));
  }

  function firstTransaction(q){return acquisitionEvents(q)[0]||null}
  function quotationReference(q){return String(q&&(poReference(q)||q.number)||'').trim()}

  function infoForClient(client){
    if(!E||!client) return {date:'',number:'',quote:null,source:''};
    const related=(E.state.quotations||[]).filter(q=>{
      if(!q) return false;
      if(q.clientId&&client.id&&q.clientId===client.id) return true;
      try{return E.clientMatchesQuotation?E.clientMatchesQuotation(client,q):false;}catch(_){return false;}
    }).map(q=>({q,event:firstTransaction(q)})).filter(row=>row.event&&row.event.date)
      .sort((a,b)=>a.event.date.localeCompare(b.event.date)||quotationReference(a.q).localeCompare(quotationReference(b.q)));
    const first=related[0]||null;
    return first?{date:first.event.date,number:quotationReference(first.q),quote:first.q,source:first.event.source}:{date:'',number:'',quote:null,source:''};
  }

  function dateObj(value){const date=new Date(iso(value)+'T00:00:00');return Number.isNaN(date.getTime())?null:date}
  function dateISO(date){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')}
  function addDays(date,days){const next=new Date(date);next.setDate(next.getDate()+days);return next}
  function weekStart(value){const date=dateObj(value);if(!date)return '';const day=date.getDay()||7;return dateISO(addDays(date,1-day))}
  function todayISO(){return E.todayISO?E.todayISO():new Date().toISOString().slice(0,10)}
  function clientName(client){return String(client.companyName||client.contactPerson||'Unnamed Client').trim()||'Unnamed Client'}
  function clientKey(client){return norm(client.companyName)||norm(client.contactPerson)||String(client.id||'')}

  function acquiredClients(){
    const candidates=(E.state.quotations||[]).map(quote=>{
      const event=firstTransaction(quote);
      const name=String(quote.company||quote.customer||'').trim();
      if(!event||!event.date||!name) return null;
      let client=(E.state.clients||[]).find(item=>quote.clientId&&item.id===quote.clientId)||null;
      if(!client){try{client=E.findClientForQuotation?E.findClientForQuotation(quote):null}catch(_){client=null}}
      if(!client) client={id:'',companyName:String(quote.company||'').trim(),contactPerson:String(quote.customer||'').trim()};
      return {client,acquisition:{date:event.date,number:quotationReference(quote),quote,source:event.source},key:norm(quote.company)||norm(quote.customer)};
    }).filter(Boolean).sort((a,b)=>a.acquisition.date.localeCompare(b.acquisition.date)||clientName(a.client).localeCompare(clientName(b.client)));
    const unique=new Map();
    for(const row of candidates){const key=row.key||clientKey(row.client);if(!unique.has(key)) unique.set(key,row)}
    return [...unique.values()];
  }

  function weeklyRows(){
    const today=dateObj(todayISO())||new Date();
    const current=weekStart(dateISO(today));
    const acquired=acquiredClients();
    const rows=[];
    for(let index=0;index<8;index++){
      const start=dateISO(addDays(dateObj(current),-7*index));
      const end=dateISO(addDays(dateObj(start),6));
      const clients=acquired.filter(row=>weekStart(row.acquisition.date)===start).sort((a,b)=>a.acquisition.date.localeCompare(b.acquisition.date));
      rows.push({start,end,clients});
    }
    return rows;
  }

  function escapeText(value){return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}

  function enhanceWeekly(container){
    if(container.querySelector('[data-weekly-acquisition]')) return;
    const grid=container.querySelector('.kpi-grid');
    if(!grid) return;
    const rows=weeklyRows();
    const section=document.createElement('div');
    section.className='card';
    section.dataset.weeklyAcquisition='1';
    section.innerHTML='<div style="padding:16px 18px 10px"><div style="font-weight:800;font-size:16px">Weekly Customer Acquisition</div><div style="font-size:12px;color:var(--ink-soft);margin-top:3px">A client is counted once, on the earliest PO, approved/confirmed order, or actual partial/full payment.</div></div><div class="table-wrap"><table class="data"><thead><tr><th>Week</th><th>Date Range</th><th class="num">New Clients</th><th>Clients / First Transaction</th></tr></thead><tbody>'+rows.map((row,index)=>'<tr><td><b>'+(index===0?'This Week':'Week '+(index+1))+'</b></td><td>'+escapeText(row.start)+' to '+escapeText(row.end)+'</td><td class="num"><b>'+row.clients.length.toLocaleString()+'</b></td><td>'+(row.clients.length?row.clients.map(item=>'<div><b>'+escapeText(clientName(item.client))+'</b> · '+escapeText(item.acquisition.number||'Transaction')+' · '+escapeText(item.acquisition.date)+'<div style="font-size:11px;color:var(--ink-soft)">'+escapeText(item.acquisition.source)+'</div></div>').join(''):'<span style="color:var(--ink-soft)">No new clients</span>')+'</td></tr>').join('')+'</tbody></table></div>';
    grid.insertAdjacentElement('afterend',section);
  }

  function matchesFilter(date){
    if(acquisitionFilter==='all') return true;
    if(acquisitionFilter==='acquired') return !!date;
    if(!date) return false;
    const today=todayISO();
    if(acquisitionFilter==='today') return date===today;
    if(acquisitionFilter==='week') return weekStart(date)===weekStart(today);
    if(acquisitionFilter==='month') return date.slice(0,7)===today.slice(0,7);
    return true;
  }

  function applyAcquisitionFilter(container){
    const table=container.querySelector('table[data-acquisition-table]');
    if(!table) return;
    let visible=0;
    table.querySelectorAll('tbody tr[data-client-row]').forEach(row=>{
      const show=matchesFilter(row.dataset.acquisitionDate||'');
      row.style.display=show?'':'none';
      if(show) visible++;
    });
    let empty=table.querySelector('[data-acquisition-empty]');
    if(!visible){
      if(!empty){empty=document.createElement('tr');empty.dataset.acquisitionEmpty='1';empty.innerHTML='<td colspan="9"><div class="empty-state">No clients match this acquisition period.</div></td>';table.tBodies[0].appendChild(empty)}
      empty.style.display='';
    }else if(empty) empty.style.display='none';
    container.querySelectorAll('[data-acquisition-filter]').forEach(button=>{
      const active=button.dataset.acquisitionFilter===acquisitionFilter;
      button.classList.toggle('primary',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
    renderAcquisitionRoster(container);
  }

  function renderAcquisitionRoster(container){
    const body=container.querySelector('[data-acquisition-roster-body]');
    if(!body) return;
    const rows=acquiredClients().filter(row=>matchesFilter(row.acquisition.date)).sort((a,b)=>b.acquisition.date.localeCompare(a.acquisition.date)||clientName(a.client).localeCompare(clientName(b.client)));
    body.innerHTML=rows.length?rows.map(row=>'<tr><td><b>'+escapeText(row.acquisition.date)+'</b></td><td><b>'+escapeText(clientName(row.client))+'</b></td><td>'+escapeText(row.acquisition.source)+'</td><td>'+escapeText(row.acquisition.number||'—')+'</td><td>'+(row.client.id?'<span class="pill green">Client Profile</span>':'<span class="pill orange">Quotation History</span>')+'</td></tr>').join(''):'<tr><td colspan="5"><div class="empty-state">No acquired clients in this period.</div></td></tr>';
  }

  function enhanceRoster(container){
    if(container.querySelector('[data-acquisition-roster]')) return;
    const weekly=container.querySelector('[data-weekly-acquisition]');
    if(!weekly) return;
    const section=document.createElement('div');
    section.className='card';
    section.dataset.acquisitionRoster='1';
    section.innerHTML='<div style="padding:16px 18px 10px"><div style="font-weight:800;font-size:16px">Acquisition Roster</div><div style="font-size:12px;color:var(--ink-soft);margin-top:3px">Complete transaction-based client list, including historical quotation names that do not yet have a reusable client profile.</div></div><div class="table-wrap"><table class="data"><thead><tr><th>Acquired</th><th>Client</th><th>First Transaction</th><th>Reference</th><th>Database Record</th></tr></thead><tbody data-acquisition-roster-body></tbody></table></div>';
    weekly.insertAdjacentElement('afterend',section);
    renderAcquisitionRoster(container);
  }

  function addAcquisitionControls(container,table){
    if(container.querySelector('[data-acquisition-controls]')) return;
    const controls=document.createElement('div');
    controls.dataset.acquisitionControls='1';
    controls.className='actions';
    controls.style.cssText='justify-content:flex-start;flex-wrap:wrap;margin:0 0 14px';
    controls.innerHTML=[['all','All Database'],['today','Acquired Today'],['week','Acquired This Week'],['month','Acquired This Month'],['acquired','Overall Acquired Clients']]
      .map(([value,label])=>'<button type="button" class="btn small" data-acquisition-filter="'+value+'">'+label+'</button>').join('');
    const tableWrap=table.closest('.table-wrap');
    table.closest('.card').insertBefore(controls,tableWrap);
    controls.querySelectorAll('[data-acquisition-filter]').forEach(button=>button.addEventListener('click',()=>{acquisitionFilter=button.dataset.acquisitionFilter;applyAcquisitionFilter(container)}));
  }

  function enhanceList(container){
    const table=[...container.querySelectorAll('table.data')].find(candidate=>{
      const headings=[...candidate.querySelectorAll('thead th')].map(cell=>cell.textContent.trim());
      return headings.includes('Client')&&headings.includes('Contact')&&headings.includes('Orders')&&headings.includes('Completed Sales');
    });
    if(!table||table.dataset.acquisitionEnhanced==='1') return false;
    table.dataset.acquisitionEnhanced='1';
    table.dataset.acquisitionTable='1';
    const headers=[...table.querySelectorAll('thead th')];
    const contactIndex=headers.findIndex(header=>header.textContent.trim()==='Contact');
    if(contactIndex<0) return false;
    const th=document.createElement('th');
    th.textContent='Acquired';
    th.title='Earliest PO, approved/confirmed order, or partial/full payment';
    headers[contactIndex].insertAdjacentElement('afterend',th);

    for(const row of table.querySelectorAll('tbody tr')){
      const button=row.querySelector('[data-edit-client]');
      if(!button){const empty=row.querySelector('td[colspan]');if(empty) empty.colSpan=Number(empty.colSpan||8)+1;continue}
      const client=(E.state.clients||[]).find(item=>item.id===button.dataset.editClient);
      const acquisition=infoForClient(client);
      row.dataset.clientRow='1';
      row.dataset.acquisitionDate=acquisition.date||'';
      const cells=[...row.children];
      const td=document.createElement('td');
      td.innerHTML=acquisition.date
        ? '<b>'+escapeText(acquisition.date)+'</b>'+(acquisition.number?'<div style="font-size:11px;color:var(--ink-soft)">'+escapeText(acquisition.number)+'</div>':'')+(acquisition.source?'<div style="font-size:11px;color:var(--ink-soft)">'+escapeText(acquisition.source)+'</div>':'')
        : '<span style="color:var(--ink-soft)">Not acquired</span>';
      cells[contactIndex].insertAdjacentElement('afterend',td);
    }

    const grid=container.querySelector('.kpi-grid');
    if(grid&&!grid.querySelector('[data-client-acquisition-kpi]')){
      const today=todayISO();
      const acquired=acquiredClients();
      const cards=[
        ['Acquired Today',acquired.filter(row=>row.acquisition.date===today).length],
        ['Acquired This Week',acquired.filter(row=>weekStart(row.acquisition.date)===weekStart(today)).length],
        ['Acquired This Month',acquired.filter(row=>row.acquisition.date.slice(0,7)===today.slice(0,7)).length],
        ['Overall Acquired Clients',acquired.length]
      ];
      cards.forEach(([label,count],index)=>{const card=document.createElement('div');card.className='kpi';card.dataset.clientAcquisitionKpi=String(index+1);card.innerHTML='<div class="lbl">'+escapeText(label)+'</div><div class="val">'+count.toLocaleString()+'</div>';grid.appendChild(card)});
    }
    addAcquisitionControls(container,table);
    enhanceWeekly(container);
    enhanceRoster(container);
    applyAcquisitionFilter(container);
    return true;
  }

  function findClientFromForm(container){
    const company=norm(container.querySelector('#cl-company')?.value);
    const person=norm(container.querySelector('#cl-person')?.value);
    const matches=(E.state.clients||[]).filter(client=>{const clientCompany=norm(client.companyName),clientPerson=norm(client.contactPerson);return (company&&clientCompany===company)||(person&&clientPerson===person)});
    return matches.length===1?matches[0]:null;
  }

  function enhanceDetail(container){
    if(!container.querySelector('#cl-company')||container.querySelector('[data-client-acquisition-detail]')) return false;
    const client=findClientFromForm(container);
    if(!client) return false;
    const acquisition=infoForClient(client);
    const grid=container.querySelector('.kpi-grid');
    if(!grid) return false;
    const dateCard=document.createElement('div');
    dateCard.className='kpi';dateCard.dataset.clientAcquisitionDetail='1';
    dateCard.innerHTML='<div class="lbl">Acquisition Date</div><div class="val" style="font-family:inherit;font-size:17px">'+escapeText(acquisition.date||'—')+'</div>';
    const transactionCard=document.createElement('div');
    transactionCard.className='kpi';transactionCard.dataset.clientAcquisitionDetail='1';
    transactionCard.innerHTML='<div class="lbl">First Client Transaction</div><div class="val" style="font-family:inherit;font-size:17px">'+escapeText(acquisition.number||'—')+'</div><div style="font-size:11px;color:var(--ink-soft)">'+escapeText(acquisition.source||'')+'</div>';
    grid.append(dateCard,transactionCard);
    return true;
  }

  function enhance(){
    scheduled=false;
    if(!E) return;
    const container=document.getElementById('main-content');
    if(!container) return;
    const title=container.querySelector('.titleblock h2')?.textContent?.trim()||'';
    const eyebrow=container.querySelector('.titleblock .eyebrow')?.textContent?.trim()||'';
    if(!(title==='Client Database'||eyebrow==='Client Database'||container.querySelector('#cl-company'))) return;
    enhanceList(container);
    enhanceDetail(container);
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(enhance)}

  function boot(){
    E=window.__ecohub;
    if(!E){setTimeout(boot,150);return;}
    if(window.__ecohubClientAcquisitionV2) return;
    window.__ecohubClientAcquisitionV2=true;
    E.clientAcquisitionInfo=infoForClient;
    E.clientAcquisitionRows=acquiredClients;
    if(E.renderClients){const base=E.renderClients;E.renderClients=function(container){const output=base(container);schedule();return output}}
    const root=document.getElementById('main-content')||document.body;
    const observer=new MutationObserver(schedule);
    observer.observe(root,{childList:true,subtree:true});
    schedule();
  }
  boot();
})();
