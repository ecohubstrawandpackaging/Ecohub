(function(){
  'use strict';
  let E=null;
  let scheduled=false;
  const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
  const PO_STATUSES=new Set(['waiting for down payment','for production','ongoing production','on production','for quality check','quality check','ready for release','ready','delivered','completed']);
  const iso=v=>String(v||'').slice(0,10);
  const n=v=>Number(v)||0;

  function hasPO(q){
    if(!q)return false;
    const quotationStatus=norm(q.quotationStatus),orderStatus=norm(q.orderStatus);
    if(['cancelled','declined'].includes(quotationStatus)||orderStatus==='cancelled')return false;
    if(q.poNumber||q.purchaseOrderNumber||q.poDate||q.purchaseOrderDate||q.poIssuedAt||q.purchaseOrderIssuedAt)return true;
    if(quotationStatus==='approved'||PO_STATUSES.has(orderStatus))return true;
    return n(q.paid)>0||(q.payments||[]).some(p=>n(p.amount)>0);
  }

  function poDate(q){
    const explicit=iso(q.poDate||q.purchaseOrderDate||q.poIssuedAt||q.purchaseOrderIssuedAt||q.approvedDate||q.orderConfirmedDate);
    if(explicit)return explicit;
    const paymentDates=(q.payments||[]).map(p=>iso(p.date||p.createdAt)).filter(Boolean).sort();
    return paymentDates[0]||iso(q.date||q.createdAt);
  }

  function poReference(q){return String(q.poNumber||q.purchaseOrderNumber||q.number||'').trim()}

  function infoForClient(c){
    if(!E||!c)return {date:'',number:'',quote:null};
    const related=(E.state.quotations||[]).filter(q=>{
      if(!q)return false;
      if(q.clientId&&c.id&&q.clientId===c.id)return true;
      try{return E.clientMatchesQuotation?E.clientMatchesQuotation(c,q):false;}catch(_){return false;}
    }).filter(hasPO).filter(q=>poDate(q)).sort((a,b)=>poDate(a).localeCompare(poDate(b))||poReference(a).localeCompare(poReference(b)));
    const q=related[0]||null;
    return {date:q?poDate(q):'',number:q?poReference(q):'',quote:q,source:q&&(q.poNumber||q.purchaseOrderNumber)?'Purchase Order':'Approved Order'};
  }

  function dateObj(s){const d=new Date(iso(s)+'T00:00:00');return Number.isNaN(d.getTime())?null:d}
  function dateISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function addDays(d,days){const x=new Date(d);x.setDate(x.getDate()+days);return x}
  function weekStart(s){const d=dateObj(s);if(!d)return '';const day=d.getDay()||7;return dateISO(addDays(d,1-day))}
  function acquiredClients(){return (E.state.clients||[]).map(c=>({client:c,acquisition:infoForClient(c)})).filter(x=>x.acquisition.date)}
  function clientName(c){return String(c.companyName||c.contactPerson||'Unnamed Client').trim()||'Unnamed Client'}

  function weeklyRows(){
    const today=dateObj(E.todayISO?E.todayISO():new Date().toISOString().slice(0,10))||new Date(),current=weekStart(dateISO(today)),rows=[];
    for(let i=0;i<8;i++){
      const start=dateISO(addDays(dateObj(current),-7*i)),end=dateISO(addDays(dateObj(start),6));
      const clients=acquiredClients().filter(x=>weekStart(x.acquisition.date)===start).sort((a,b)=>a.acquisition.date.localeCompare(b.acquisition.date));
      rows.push({start,end,clients});
    }
    return rows;
  }

  function enhanceWeekly(container){
    if(container.querySelector('[data-weekly-acquisition]'))return;
    const grid=container.querySelector('.kpi-grid');if(!grid)return;
    const rows=weeklyRows(),section=document.createElement('div');section.className='card';section.dataset.weeklyAcquisition='1';
    section.innerHTML='<div style="padding:16px 18px 10px"><div style="font-weight:800;font-size:16px">Weekly Customer Acquisition</div><div style="font-size:11px;color:var(--ink-soft);margin-top:3px">A client is counted once, on the week of the first approved PO/order—even if the transaction is still ongoing.</div></div><div class="table-wrap"><table class="data"><thead><tr><th>Week</th><th>Date Range</th><th class="num">New Clients</th><th>Clients / First PO</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td><b>'+(i===0?'This Week':'Week '+(i+1))+'</b></td><td>'+escapeText(r.start)+' to '+escapeText(r.end)+'</td><td class="num"><b>'+r.clients.length.toLocaleString()+'</b></td><td>'+(r.clients.length?r.clients.map(x=>'<div><b>'+escapeText(clientName(x.client))+'</b> · '+escapeText(x.acquisition.number||'PO')+' · '+escapeText(x.acquisition.date)+'</div>').join(''):'<span style="color:var(--ink-soft)">No new clients</span>')+'</td></tr>').join('')+'</tbody></table></div>';
    grid.insertAdjacentElement('afterend',section);
  }

  function findClientFromForm(container){
    const company=norm(container.querySelector('#cl-company')?.value);
    const person=norm(container.querySelector('#cl-person')?.value);
    const matches=(E.state.clients||[]).filter(c=>{
      const cc=norm(c.companyName),cp=norm(c.contactPerson);
      return (company&&cc===company)||(person&&cp===person);
    });
    return matches.length===1?matches[0]:null;
  }

  function enhanceList(container){
    const tables=[...container.querySelectorAll('table.data')];
    const table=tables.find(t=>{
      const hs=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim());
      return hs.includes('Client')&&hs.includes('Contact')&&hs.includes('Orders')&&hs.includes('Completed Sales');
    });
    if(!table||table.dataset.acquisitionEnhanced==='1')return false;
    table.dataset.acquisitionEnhanced='1';
    const headers=[...table.querySelectorAll('thead th')];
    const contactIndex=headers.findIndex(h=>h.textContent.trim()==='Contact');
    if(contactIndex<0)return false;
    const th=document.createElement('th');
    th.textContent='Acquired';
    th.title='Based on the client\'s first approved PO/order date';
    headers[contactIndex].insertAdjacentElement('afterend',th);

    for(const tr of table.querySelectorAll('tbody tr')){
      const btn=tr.querySelector('[data-edit-client]');
      if(!btn){
        const empty=tr.querySelector('td[colspan]');
        if(empty)empty.colSpan=Number(empty.colSpan||8)+1;
        continue;
      }
      const c=(E.state.clients||[]).find(x=>x.id===btn.dataset.editClient);
      const a=infoForClient(c);
      const cells=[...tr.children];
      const td=document.createElement('td');
      td.innerHTML=a.date
        ? '<b>'+escapeText(a.date)+'</b>'+(a.number?'<div style="font-size:10.5px;color:var(--ink-soft);">'+escapeText(a.number)+'</div>':'')
        : '<span style="color:var(--ink-soft);">—</span>';
      cells[contactIndex].insertAdjacentElement('afterend',td);
    }

    const grid=container.querySelector('.kpi-grid');
    if(grid&&!grid.querySelector('[data-client-acquisition-kpi]')){
      const today=E.todayISO?E.todayISO():new Date().toISOString().slice(0,10),month=today.slice(0,7),thisWeek=weekStart(today),previousWeek=dateISO(addDays(dateObj(thisWeek),-7)),all=acquiredClients();
      const cards=[
        ['New Clients · This Week',all.filter(x=>weekStart(x.acquisition.date)===thisWeek).length],
        ['New Clients · Previous Week',all.filter(x=>weekStart(x.acquisition.date)===previousWeek).length],
        ['Acquired This Month',all.filter(x=>x.acquisition.date.slice(0,7)===month).length]
      ];
      cards.forEach(([label,count],i)=>{const card=document.createElement('div');card.className='kpi';card.dataset.clientAcquisitionKpi=String(i+1);card.innerHTML='<div class="lbl">'+escapeText(label)+'</div><div class="val">'+count.toLocaleString()+'</div>';grid.appendChild(card)});
    }
    enhanceWeekly(container);
    return true;
  }

  function enhanceDetail(container){
    if(!container.querySelector('#cl-company')||container.querySelector('[data-client-acquisition-detail]'))return false;
    const c=findClientFromForm(container);
    if(!c)return false;
    const a=infoForClient(c);
    const grid=container.querySelector('.kpi-grid');
    if(!grid)return false;
    const dateCard=document.createElement('div');
    dateCard.className='kpi';
    dateCard.dataset.clientAcquisitionDetail='1';
    dateCard.innerHTML='<div class="lbl">Acquisition Date</div><div class="val" style="font-family:inherit;font-size:17px;">'+escapeText(a.date||'—')+'</div>';
    const quoteCard=document.createElement('div');
    quoteCard.className='kpi';
    quoteCard.dataset.clientAcquisitionDetail='1';
    quoteCard.innerHTML='<div class="lbl">First PO / Approved Order</div><div class="val" style="font-family:inherit;font-size:17px;">'+escapeText(a.number||'—')+'</div>';
    grid.append(dateCard,quoteCard);
    return true;
  }

  function escapeText(v){
    return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function enhance(){
    scheduled=false;
    if(!E)return;
    const container=document.getElementById('main-content');
    if(!container)return;
    const title=container.querySelector('.titleblock h2')?.textContent?.trim()||'';
    const eyebrow=container.querySelector('.titleblock .eyebrow')?.textContent?.trim()||'';
    const isClientPage=title==='Client Database'||eyebrow==='Client Database'||container.querySelector('#cl-company');
    if(!isClientPage)return;
    enhanceList(container);
    enhanceDetail(container);
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(enhance);
  }

  function boot(){
    E=window.__ecohub;
    if(!E){setTimeout(boot,150);return;}
    if(window.__ecohubClientAcquisitionV1)return;
    window.__ecohubClientAcquisitionV1=true;
    E.clientAcquisitionInfo=infoForClient;

    if(E.renderClients){
      const base=E.renderClients;
      E.renderClients=function(container){
        const out=base(container);
        schedule();
        return out;
      };
    }

    const root=document.getElementById('main-content')||document.body;
    const mo=new MutationObserver(schedule);
    mo.observe(root,{childList:true,subtree:true});
    schedule();
  }
  boot();
})();

;(function(){
  if(document.querySelector('script[data-finance-reset-v2]'))return;
  const s=document.createElement('script');
  s.src='assets/finance-reset-aug16-v2.js?v=20260828-1701';
  s.dataset.financeResetV2='1';
  s.async=false;
  s.onerror=()=>console.error('Finance Reset V2 failed to load');
  document.head.appendChild(s);
})();
