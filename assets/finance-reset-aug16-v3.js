(function(){
'use strict';
let tries=0;
function boot(){
  const E=window.__ecohub;
  if(!E){if(++tries<120)setTimeout(boot,120);return;}
  if(window.__financeAug16FixV3)return;
  window.__financeAug16FixV3=1;
  window.__financeAug16FixV2=1;

  const S=E.state,N=v=>Number(v)||0,esc=v=>E.escapeHtml?E.escapeHtml(v):String(v==null?'':v);
  const RD=()=>String(S.settings?.financeResetDate||'2026-08-16');
  const RT=()=>String(S.settings?.financeResetTime||'10:15');
  const BASE_TS=()=>RD()+'T'+RT();
  const R=e=>!!(e&&(e.financeOpeningBalance||e.balanceReset||e.adjustmentMode==='set'));
  const RV=e=>e?.setBalance!=null?N(e.setBalance):N(e?.cashIn)-N(e?.cashOut);
  const ST=e=>`${e?.date||''}T${e?.time||'00:00'}|${e?.createdAt||''}|${e?.id||''}`;
  const dt=e=>`${e?.date||''}T${e?.time||'00:00'}`;

  if(!Array.isArray(S.settings.cashAccounts))S.settings.cashAccounts=[];
  if(!S.settings.cashAccounts.includes('Partner - Balance'))S.settings.cashAccounts.push('Partner - Balance');

  function accountNames(){
    return [...new Set([...(S.settings.cashAccounts||[]),...(S.cashLedger||[]).map(e=>e&&e.account).filter(Boolean)])];
  }
  function baselineReset(account){
    return (S.cashLedger||[]).filter(e=>e&&e.account===account&&R(e)&&e.date===RD()).slice().sort((a,b)=>ST(a).localeCompare(ST(b))).pop()||null;
  }
  function baselineMap(){
    const m=new Map();
    for(const a of accountNames()){const r=baselineReset(a);m.set(a,r?RV(r):0);}
    return m;
  }
  function baselineTotal(account=''){
    const m=baselineMap();
    return account?N(m.get(account)):[...m.values()].reduce((s,v)=>s+N(v),0);
  }
  function afterBaseline(e){
    if(!e||R(e))return false;
    const r=baselineReset(e.account||'');
    if(r)return ST(e)>ST(r);
    return dt(e)>=BASE_TS();
  }
  function postBaselineEvents(){
    const initialResetIds=new Set(accountNames().map(a=>baselineReset(a)?.id).filter(Boolean));
    return (S.cashLedger||[]).filter(e=>{
      if(!e)return false;
      if(initialResetIds.has(e.id))return false;
      if(R(e))return dt(e)>BASE_TS();
      return afterBaseline(e);
    }).slice().sort((a,b)=>ST(a).localeCompare(ST(b)));
  }
  function currentBalances(end='9999-12-31'){
    const b=baselineMap();
    for(const e of postBaselineEvents()){
      if(String(e.date||'')>end)break;
      const a=e.account||'Unassigned';
      const before=N(b.get(a));
      b.set(a,R(e)?RV(e):before+N(e.cashIn)-N(e.cashOut));
    }
    return accountNames().map(name=>({name,balance:N(b.get(name))}));
  }
  function balAt(account,end='9999-12-31'){
    return N(currentBalances(end).find(x=>x.name===account)?.balance);
  }
  function totalAt(end='9999-12-31'){return currentBalances(end).reduce((s,a)=>s+a.balance,0);}

  E.accountBalance=a=>balAt(a);
  E.allAccountBalances=()=>currentBalances();
  E.totalCashAvailable=()=>totalAt();

  const flow=filterFn=>postBaselineEvents().filter(e=>!R(e)&&filterFn(e)).reduce((o,e)=>(o.cashIn+=N(e.cashIn),o.cashOut+=N(e.cashOut),o),{cashIn:0,cashOut:0});
  const week=d=>{const x=new Date(d+'T00:00:00'),q=x.getDay();x.setDate(x.getDate()-(q===0?6:q-1));return x.toISOString().slice(0,10);};
  const totalClientPaymentsSinceReset=()=> (S.quotations||[]).reduce((sum,q)=>sum+(q?.payments||[]).filter(p=>String(p?.date||'')>=RD()).reduce((s,p)=>s+N(p.amount),0),0);

  E.computeFinanceSummary=function(ym){
    ym=ym||S.selectedMonth;
    const t=E.todayISO(),w=week(t),mm=e=>E.inMonth(e.date,ym),b=currentBalances(),tc=b.reduce((s,a)=>s+a.balance,0);
    const partnerBalance=b.filter(a=>String(a.name).startsWith('Partner -')).reduce((s,a)=>s+a.balance,0);
    const bank=b.filter(a=>!['Cash on Hand','GCash','Maya','Petty Cash'].includes(a.name)&&!String(a.name).startsWith('Partner -'));
    const rec=(S.quotations||[]).filter(E.isConfirmed).reduce((s,q)=>s+E.quotationPaymentInfo(q).remainingBalance,0);
    const pay=E.computeOutstandingSupplierPayables(),iv=E.currentInventoryValue?E.currentInventoryValue():0;
    return{
      totalCash:tc,cashOnHand:balAt('Cash on Hand'),totalBank:bank.reduce((s,a)=>s+a.balance,0),partnerBalance,
      gcashBalance:balAt('GCash'),mayaBalance:balAt('Maya'),inventoryValue:iv,
      collectionsToday:flow(e=>e.transactionType==='Client Payment'&&e.date===t).cashIn,
      collectionsWeek:flow(e=>e.transactionType==='Client Payment'&&e.date>=w&&e.date<=t).cashIn,
      collectionsMonth:flow(e=>e.transactionType==='Client Payment'&&mm(e)).cashIn,
      collectionsYear:flow(e=>e.transactionType==='Client Payment'&&String(e.date||'').slice(0,4)===String(ym.year)).cashIn,
      totalClientPaymentsSinceReset:totalClientPaymentsSinceReset(),
      expensesToday:flow(e=>['Expense','Other Expense'].includes(e.transactionType)&&e.date===t).cashOut,
      expensesMonth:flow(e=>['Expense','Other Expense'].includes(e.transactionType)&&mm(e)).cashOut,
      supplierPaymentsMonth:flow(e=>e.transactionType==='Supplier Payment'&&mm(e)).cashOut,
      outstandingReceivables:rec,outstandingPayables:pay,netCashPosition:tc+rec-pay,netOperatingPosition:tc+iv+rec-pay,
      accountBalances:b
    };
  };

  function dayBefore(x){const d=new Date(x+'T00:00:00');d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);}
  E.cashFlowReport=function(start,end){
    if(start<RD())start=RD();
    if(end<RD())return{totalCashIn:0,totalCashOut:0,netCashFlow:0,beginningBalance:0,endingBalance:0};
    const ev=postBaselineEvents().filter(e=>String(e.date||'')>=start&&String(e.date||'')<=end);
    const normal=ev.filter(e=>!R(e));
    const cashIn=normal.reduce((s,e)=>s+N(e.cashIn),0),cashOut=normal.reduce((s,e)=>s+N(e.cashOut),0);
    const beginning=start===RD()?baselineTotal():totalAt(dayBefore(start));
    const ending=totalAt(end);
    return{totalCashIn:cashIn,totalCashOut:cashOut,netCashFlow:ending-beginning,beginningBalance:beginning,endingBalance:ending};
  };

  const baseCreate=E.createLedgerEntry;
  E.createLedgerEntry=async function(fields){
    if(fields&&fields.transactionType==='Client Payment'&&fields.source==='Quotation'){
      const qno=String(fields.quotationNumber||document.querySelector('#f-number')?.value||String(fields.remarks||'').match(/QTN-\d{4}-\d+/)?.[0]||'');
      const q=(S.quotations||[]).find(x=>x&&x.number===qno);
      const pending=q?.payments?.find(p=>!p.ledgerEntryId&&String(p.date||'')===String(fields.date||'')&&Math.abs(N(p.amount)-N(fields.cashIn))<.0001&&String(p.account||'')===String(fields.account||''));
      if(q&&pending){
        const linkedIds=new Set((q.payments||[]).map(p=>p.ledgerEntryId).filter(Boolean));
        const orphan=(S.cashLedger||[]).find(e=>e&&!linkedIds.has(e.id)&&e.transactionType==='Client Payment'&&e.account===fields.account&&e.date===fields.date&&Math.abs(N(e.cashIn)-N(fields.cashIn))<.0001&&(e.quotationNumber===qno||String(e.remarks||'').includes(qno)));
        if(orphan){
          pending.ledgerEntryId=orphan.id;orphan.quotationNumber=qno;orphan.quotationPaymentId=pending.id;
          await E.storageSet('cashledger:'+orphan.id,orphan);await E.storageSet('quotation:'+qno,q);
          return orphan;
        }
      }
      const entry=await baseCreate(fields);
      if(q&&pending){
        pending.ledgerEntryId=entry.id;entry.quotationNumber=qno;entry.quotationPaymentId=pending.id;
        await E.storageSet('cashledger:'+entry.id,entry);await E.storageSet('quotation:'+qno,q);
      }
      return entry;
    }
    return baseCreate(fields);
  };

  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#pmt-save');if(!btn)return;
    if(btn.dataset.paymentSaving==='1'){e.preventDefault();e.stopImmediatePropagation();return;}
    btn.dataset.paymentSaving='1';btn.setAttribute('aria-busy','true');
    const old=btn.textContent;btn.textContent='Saving…';
    setTimeout(()=>{if(document.body.contains(btn)){btn.dataset.paymentSaving='';btn.removeAttribute('aria-busy');btn.textContent=old;}},6000);
  },true);

  const baseRender=E.renderFinance;
  function baselineBreakdown(account=''){
    const m=baselineMap();
    const arr=account?[{name:account,balance:N(m.get(account))}]:[...m.entries()].map(([name,balance])=>({name,balance:N(balance)})).filter(x=>Math.abs(x.balance)>.0001);
    return arr.map(x=>`${x.name} ${E.peso(x.balance)}`).join(' · ');
  }
  function timeline(){
    const balances=baselineMap(),rows=[];
    for(const e of postBaselineEvents()){
      const a=e.account||'Unassigned',before=N(balances.get(a));
      let cin=N(e.cashIn),cout=N(e.cashOut),after;
      if(R(e)){
        after=RV(e);const delta=after-before;cin=delta>0?delta:0;cout=delta<0?-delta:0;
      }else after=before+cin-cout;
      balances.set(a,after);
      rows.push({e,cashIn:cin,cashOut:cout,accountBalance:after,totalBalance:[...balances.values()].reduce((s,v)=>s+N(v),0)});
    }
    return rows;
  }
  function rebuildLedger(container){
    const body=container.querySelector('#fin-ledger-body');if(!body)return;
    const account=container.querySelector('#lf-account')?.value||'',type=container.querySelector('#lf-type')?.value||'';
    const allRows=timeline();
    const filtered=allRows.filter(r=>(!account||r.e.account===account)&&(!type||r.e.transactionType===type));
    const opening=baselineTotal(account);
    const display=filtered.slice().reverse();
    let html=display.map(({e,cashIn,cashOut,accountBalance,totalBalance})=>{
      const bal=account?accountBalance:totalBalance;
      const isSet=R(e);
      return `<tr><td>${esc(e.date)}</td><td>${esc(e.time||'')}</td><td><span class="pill ${cashIn>0?'green':'orange'}">${esc(isSet?'Balance Reconciliation':e.transactionType)}</span></td><td>${esc(e.clientOrSupplier||'—')}</td><td>${esc(e.account||'—')}</td><td class="num">${cashIn>0?E.peso(cashIn):'—'}</td><td class="num">${cashOut>0?E.peso(cashOut):'—'}</td><td class="num"><b>${E.peso(bal)}</b></td><td>${esc(e.referenceNumber||'—')}</td><td>${esc(isSet?`SET exact balance to ${E.peso(RV(e))}${e.remarks?' · '+e.remarks:''}`:(e.remarks||''))}</td></tr>`;
    }).join('');
    const openingRow=`<tr style="background:var(--sage-light)"><td>${esc(RD())}</td><td>${esc(RT())}</td><td><span class="pill green">BEGINNING BALANCE</span></td><td>—</td><td>${account?esc(account):'All audited accounts'}</td><td class="num">—</td><td class="num">—</td><td class="num"><b>${E.peso(opening)}</b></td><td>CURRENT-BALANCE-RESET</td><td>${esc(baselineBreakdown(account)||'No opening balance recorded')}</td></tr>`;
    body.innerHTML=(html||'')+openingRow;
  }
  function enhanceFinance(container){
    const s=E.computeFinanceSummary(S.selectedMonth);
    const accountSelect=container.querySelector('#lf-account');
    if(accountSelect){for(const a of accountNames()){if(![...accountSelect.options].some(o=>o.value===a)){const o=document.createElement('option');o.value=a;o.textContent=a;accountSelect.appendChild(o);}}}
    const headings=[...container.querySelectorAll('h3')];
    const assetsH=headings.find(h=>h.textContent.trim()==='Assets');
    const assetsGrid=assetsH?.nextElementSibling;
    if(assetsGrid&&!assetsGrid.querySelector('[data-partner-balance]')){
      const card=document.createElement('div');card.className='kpi';card.dataset.partnerBalance='1';card.innerHTML=`<div class="lbl">Partner Balance</div><div class="val">${E.peso(s.partnerBalance)}</div>`;assetsGrid.appendChild(card);
    }
    const incomeH=headings.find(h=>h.textContent.trim()==='Income');
    const incomeGrid=incomeH?.nextElementSibling;
    if(incomeGrid&&!incomeGrid.querySelector('[data-total-client-paid]')){
      const card=document.createElement('div');card.className='kpi';card.dataset.totalClientPaid='1';card.innerHTML=`<div class="lbl">Client Payments Since Aug 16</div><div class="val">${E.peso(s.totalClientPaymentsSinceReset)}</div>`;incomeGrid.appendChild(card);
    }
    const note=container.querySelector('.topbar+ p');if(note)note.innerHTML=`Finance begins from the <b>August 16, 2026 audited beginning balance</b>. Older activity is history only. Current Running Balance starts at <b>${E.peso(baselineTotal())}</b> and moves only with valid transactions after each account's reset.`;
    const cashH=headings.find(h=>h.textContent.trim().startsWith('Cash Ledger'));if(cashH)cashH.textContent='Cash Ledger — Running Balance from Aug 16 Beginning Balance';
    rebuildLedger(container);
    container.querySelector('#lf-account')?.addEventListener('change',()=>setTimeout(()=>rebuildLedger(container),0));
    container.querySelector('#lf-type')?.addEventListener('change',()=>setTimeout(()=>rebuildLedger(container),0));
  }
  E.renderFinance=function(container){
    baseRender(container);
    enhanceFinance(container);
  };

  console.log('Finance Aug 16 reset-aware fix v3 installed',BASE_TS());
}
boot();
})();