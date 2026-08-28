(function(){
  'use strict';
  let E=null;
  let scheduled=false;
  const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');

  function infoForClient(c){
    if(!E||!c)return {date:'',number:'',quote:null};
    const related=(E.state.quotations||[]).filter(q=>{
      if(!q)return false;
      if(q.clientId&&c.id&&q.clientId===c.id)return true;
      try{return E.clientMatchesQuotation?E.clientMatchesQuotation(c,q):false;}catch(_){return false;}
    }).filter(q=>q.date).sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.number||'').localeCompare(String(b.number||'')));
    const q=related[0]||null;
    return {date:q?.date||'',number:q?.number||'',quote:q};
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
    th.title='Based on the client\'s first quotation date';
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
      const month=(E.todayISO?E.todayISO():new Date().toISOString().slice(0,10)).slice(0,7);
      const count=(E.state.clients||[]).filter(c=>infoForClient(c).date.slice(0,7)===month).length;
      const card=document.createElement('div');
      card.className='kpi';
      card.dataset.clientAcquisitionKpi='1';
      card.innerHTML='<div class="lbl">Acquired This Month</div><div class="val">'+count.toLocaleString()+'</div>';
      grid.appendChild(card);
    }
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
    quoteCard.innerHTML='<div class="lbl">First Quotation</div><div class="val" style="font-family:inherit;font-size:17px;">'+escapeText(a.number||'—')+'</div>';
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
