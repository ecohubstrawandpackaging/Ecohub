(function(){
'use strict';
let tries=0;
function boot(){
  const E=window.__ecohub;
  if(!E){if(++tries<100)setTimeout(boot,120);return}
  if(window.__financeAug16FixV2)return;
  window.__financeAug16FixV2=1;
  const S=E.state,N=v=>Number(v)||0;
  const RD=()=>String(S.settings?.financeResetDate||'2026-08-16'),RT=()=>String(S.settings?.financeResetTime||'10:15'),BT=()=>RD()+'T'+RT();
  const R=e=>!!(e&&(e.financeOpeningBalance||e.balanceReset||e.adjustmentMode==='set'));
  const RV=e=>e?.setBalance!=null?N(e.setBalance):N(e?.cashIn)-N(e?.cashOut);
  const ST=e=>`${e?.date||''}T${e?.time||'00:00'}|${e?.createdAt||''}|${e?.id||''}`;
  const AB=e=>`${e?.date||''}T${e?.time||'00:00'}`>=BT();
  const names=()=>[...new Set([...(S.settings?.cashAccounts||[]),...(S.cashLedger||[]).filter(AB).map(e=>e.account).filter(Boolean)])];

  function normalized(end='9999-12-31'){
    const bal=new Map();
    return(S.cashLedger||[]).filter(e=>e&&AB(e)&&String(e.date||'')<=end).slice().sort((a,b)=>ST(a).localeCompare(ST(b))).map(e=>{
      const a=e.account||'Unassigned',before=N(bal.get(a)),c={...e};
      if(R(e)){
        const target=RV(e),delta=target-before;bal.set(a,target);
        c.cashIn=delta>0?delta:0;c.cashOut=delta<0?-delta:0;c.setBalance=target;c.financeOpeningBalance=true;c.balanceReset=true;c.adjustmentMode='set';c._financeResetTarget=target;c._financeResetDelta=delta;
      }else bal.set(a,before+N(e.cashIn)-N(e.cashOut));
      return c;
    });
  }
  function balAt(a,end='9999-12-31'){let b=0;for(const e of normalized(end)){if((e.account||'Unassigned')!==a)continue;if(R(e))b=RV(e);else b+=N(e.cashIn)-N(e.cashOut)}return b}
  const all=(end='9999-12-31')=>names().map(name=>({name,balance:balAt(name,end)}));
  E.accountBalance=a=>balAt(a);E.allAccountBalances=()=>all();E.totalCashAvailable=()=>all().reduce((s,a)=>s+a.balance,0);
  const flow=f=>normalized().filter(e=>!R(e)&&f(e)).reduce((o,e)=>(o.cashIn+=N(e.cashIn),o.cashOut+=N(e.cashOut),o),{cashIn:0,cashOut:0});
  const week=d=>{const x=new Date(d+'T00:00:00'),q=x.getDay();x.setDate(x.getDate()-(q===0?6:q-1));return x.toISOString().slice(0,10)};

  E.computeFinanceSummary=function(ym){
    ym=ym||S.selectedMonth;const t=E.todayISO(),w=week(t),mm=e=>E.inMonth(e.date,ym),f=fn=>flow(fn),b=all(),tc=b.reduce((s,a)=>s+a.balance,0),rec=(S.quotations||[]).filter(E.isConfirmed).reduce((s,q)=>s+E.quotationPaymentInfo(q).remainingBalance,0),pay=E.computeOutstandingSupplierPayables(),iv=E.currentInventoryValue?E.currentInventoryValue():0;
    return{totalCash:tc,cashOnHand:balAt('Cash on Hand'),totalBank:b.filter(a=>!['Cash on Hand','GCash','Maya','Petty Cash'].includes(a.name)).reduce((s,a)=>s+a.balance,0),gcashBalance:balAt('GCash'),mayaBalance:balAt('Maya'),inventoryValue:iv,collectionsToday:f(e=>e.transactionType==='Client Payment'&&e.date===t).cashIn,collectionsWeek:f(e=>e.transactionType==='Client Payment'&&e.date>=w&&e.date<=t).cashIn,collectionsMonth:f(e=>e.transactionType==='Client Payment'&&mm(e)).cashIn,collectionsYear:f(e=>e.transactionType==='Client Payment'&&String(e.date||'').slice(0,4)===String(ym.year)).cashIn,expensesToday:f(e=>['Expense','Other Expense'].includes(e.transactionType)&&e.date===t).cashOut,expensesMonth:f(e=>['Expense','Other Expense'].includes(e.transactionType)&&mm(e)).cashOut,supplierPaymentsMonth:f(e=>e.transactionType==='Supplier Payment'&&mm(e)).cashOut,outstandingReceivables:rec,outstandingPayables:pay,netCashPosition:tc+rec-pay,netOperatingPosition:tc+iv+rec-pay,accountBalances:b};
  };
  const totalAt=d=>all(d).reduce((s,a)=>s+a.balance,0),dayBefore=x=>{const d=new Date(x+'T00:00:00');d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)};
  E.cashFlowReport=function(start,end){if(start<RD())start=RD();if(end<RD())return{totalCashIn:0,totalCashOut:0,netCashFlow:0,beginningBalance:0,endingBalance:0};const items=normalized(end).filter(e=>e.date>=start&&e.date<=end&&!R(e)),cashIn=items.reduce((s,e)=>s+N(e.cashIn),0),cashOut=items.reduce((s,e)=>s+N(e.cashOut),0),beginning=start===RD()?normalized(start).filter(R).reduce((s,e)=>s+RV(e),0):totalAt(dayBefore(start)),ending=totalAt(end);return{totalCashIn:cashIn,totalCashOut:cashOut,netCashFlow:ending-beginning,beginningBalance:beginning,endingBalance:ending}};

  const baseRender=E.renderFinance,baseCreate=E.createLedgerEntry;
  E.renderFinance=function(container){
    const old=S.cashLedger;S.cashLedger=normalized();try{baseRender(container)}finally{S.cashLedger=old}
    const p=container.querySelector('.topbar+ p');if(p)p.innerHTML='Current finance starts from the <b>August 16, 2026 balance reconciliation</b>. Earlier transactions remain in history but do not affect current cash. Rows marked <b>SET</b> replace the account balance instead of adding to it.';
    const h=[...container.querySelectorAll('.card h3')].find(x=>x.textContent.trim().startsWith('Cash Ledger'));if(h)h.textContent='Cash Ledger — Current finance from Aug 16 reset onward';
    container.querySelectorAll('tr').forEach(tr=>{const ref=[...tr.cells||[]].find(td=>td.textContent.trim()==='CURRENT-BALANCE-RESET');if(ref&&!tr.querySelector('.finance-set-badge')){const badge=document.createElement('span');badge.className='finance-set-badge';badge.textContent=' SET BALANCE';badge.style.cssText='display:inline-block;margin-left:5px;padding:2px 6px;border-radius:999px;background:#e4efe0;color:#315b32;font-size:9px;font-weight:800;letter-spacing:.03em';ref.appendChild(badge)}});
    const top=container.querySelector('.topbar .actions');if(top&&!container.querySelector('#fin-set-balance-v2')){const b=document.createElement('button');b.id='fin-set-balance-v2';b.className='btn';b.textContent='◎ Set Exact Balance';b.onclick=()=>showSet(container);top.prepend(b)}
  };
  function showSet(container){const slot=container.querySelector('#fin-panel-slot');if(!slot)return;slot.innerHTML=`<div class="card" style="border-color:var(--sage)"><h3>Set Exact Account Balance</h3><p style="font-size:12px;color:var(--ink-soft)">For reconciliation only. The amount becomes the exact account balance; it is not added as income.</p><div class="grid"><div class="field"><label>Date</label><input id="sb-date-v2" type="date" value="${E.todayISO()}"></div><div class="field"><label>Account</label><select id="sb-account-v2">${names().map(a=>`<option>${E.escapeHtml(a)}</option>`).join('')}</select></div><div class="field"><label>Exact Balance</label><input id="sb-amount-v2" type="number" step="0.01" min="0" value="0"></div><div class="field"><label>Remarks</label><input id="sb-remarks-v2" placeholder="Balance reconciliation"></div></div><div class="actions"><button class="btn" id="sb-cancel-v2">Cancel</button><button class="btn primary" id="sb-save-v2">Set Balance</button></div></div>`;container.querySelector('#sb-cancel-v2').onclick=()=>E.renderFinance(container);container.querySelector('#sb-save-v2').onclick=async()=>{const amount=parseFloat(container.querySelector('#sb-amount-v2').value),account=container.querySelector('#sb-account-v2').value,date=container.querySelector('#sb-date-v2').value;if(!Number.isFinite(amount)||amount<0){E.toast('Enter a valid balance');return}await baseCreate({date,account,transactionType:'Cash Adjustment',source:'Balance Reconciliation',cashIn:amount,cashOut:0,remarks:container.querySelector('#sb-remarks-v2').value||`Exact balance set to ${E.peso(amount)}`,financeOpeningBalance:true,balanceReset:true,setBalance:amount,adjustmentMode:'set',referenceNumber:'CURRENT-BALANCE-RESET'});E.toast('Exact account balance saved');E.renderFinance(container)}}
  E.createLedgerEntry=async function(fields){const r=await baseCreate(fields);const c=document.querySelector('#fin-ledger-body')?.closest('.view-content,.content,#view-container,main')||document.querySelector('#main-content');if(c)setTimeout(()=>{try{E.renderFinance(c)}catch(_){}},20);return r};
  console.log('Finance Aug 16 reset-aware fix v2 installed',BT());
}
boot();
})();