(function(){
'use strict';
let tries=0;
function boot(){
  const E=window.__ecohub;
  if(!E||!E.renderFinance||!window.__financeAug16FixV3){if(++tries<180)setTimeout(boot,120);return;}
  if(window.__ecohubFinanceAccountHistoryV1)return;
  window.__ecohubFinanceAccountHistoryV1=true;

  const S=E.state,N=v=>Number(v)||0,RCBC='RCBC';
  let selectedAccount='',selectedMonth='2026-09',settingsSaved=false;
  const esc=v=>E.escapeHtml?E.escapeHtml(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const resetDate=()=>String(S.settings?.financeResetDate||'2026-08-16');
  const resetTime=()=>String(S.settings?.financeResetTime||'10:15');
  const isReset=e=>!!(e&&(e.financeOpeningBalance||e.balanceReset||e.adjustmentMode==='set'));
  const resetValue=e=>e?.setBalance!=null?N(e.setBalance):N(e?.cashIn)-N(e?.cashOut);
  const stamp=e=>`${e?.date||''}T${e?.time||'00:00'}|${e?.createdAt||''}|${e?.id||''}`;
  const dateTime=e=>`${e?.date||''}T${e?.time||'00:00'}`;

  function ensureRCBC(persist){
    S.settings=S.settings||{};
    const accounts=Array.isArray(S.settings.cashAccounts)?S.settings.cashAccounts:(S.settings.cashAccounts=[]);
    if(!accounts.some(a=>String(a).trim().toLowerCase()==='rcbc'))accounts.push(RCBC);
    if(persist&&!settingsSaved&&E.storageSet){
      settingsSaved=true;
      Promise.resolve(E.storageSet('settings:main',S.settings)).catch(err=>{settingsSaved=false;console.error('Could not save RCBC cash account',err);});
    }
  }
  function accountNames(){
    ensureRCBC(false);
    return [...new Set([...(S.settings.cashAccounts||[]),...(S.cashLedger||[]).map(e=>e?.account).filter(Boolean)])];
  }
  function baselineReset(account){
    return (S.cashLedger||[]).filter(e=>e&&e.account===account&&isReset(e)&&e.date===resetDate()).slice().sort((a,b)=>stamp(a).localeCompare(stamp(b))).pop()||null;
  }
  function baselineMap(){
    const map=new Map();
    accountNames().forEach(account=>{const row=baselineReset(account);map.set(account,row?resetValue(row):0);});
    return map;
  }
  function events(){
    const initialIds=new Set(accountNames().map(a=>baselineReset(a)?.id).filter(Boolean));
    const base=`${resetDate()}T${resetTime()}`;
    return (S.cashLedger||[]).filter(e=>{
      if(!e||initialIds.has(e.id))return false;
      if(isReset(e))return dateTime(e)>base;
      const row=baselineReset(e.account||'');
      return row?stamp(e)>stamp(row):dateTime(e)>=base;
    }).slice().sort((a,b)=>stamp(a).localeCompare(stamp(b)));
  }
  function monthBounds(month){
    const start=/^\d{4}-\d{2}$/.test(month)?month+'-01':new Date().toISOString().slice(0,7)+'-01';
    const date=new Date(start+'T00:00:00');date.setMonth(date.getMonth()+1);date.setDate(0);
    return{start,end:date.toISOString().slice(0,10)};
  }
  function history(month,account){
    const bounds=monthBounds(month),balances=baselineMap(),opening=new Map(balances),rows=[];
    for(const e of events()){
      const name=e.account||'Unassigned',before=N(balances.get(name));
      const after=isReset(e)?resetValue(e):before+N(e.cashIn)-N(e.cashOut);
      if(String(e.date||'')<bounds.start)opening.set(name,after);
      balances.set(name,after);
      if(String(e.date||'')>=bounds.start&&String(e.date||'')<=bounds.end){
        rows.push({e,before,after,total:[...balances.values()].reduce((sum,v)=>sum+N(v),0)});
      }
    }
    const filtered=rows.filter(row=>!account||row.e.account===account);
    const normal=filtered.filter(row=>!isReset(row.e));
    const moneyIn=normal.reduce((sum,row)=>sum+N(row.e.cashIn),0);
    const moneyOut=normal.reduce((sum,row)=>sum+N(row.e.cashOut),0);
    const openingBalance=account?N(opening.get(account)):[...opening.values()].reduce((sum,v)=>sum+N(v),0);
    const endMap=new Map(opening);
    rows.forEach(row=>endMap.set(row.e.account||'Unassigned',row.after));
    const endingBalance=account?N(endMap.get(account)):[...endMap.values()].reduce((sum,v)=>sum+N(v),0);
    return{bounds,rows:filtered.slice().reverse(),moneyIn,moneyOut,openingBalance,endingBalance};
  }
  function monthLabel(month){
    return new Date(month+'-01T00:00:00').toLocaleDateString('en-PH',{month:'long',year:'numeric'});
  }
  function rowHtml(row){
    const e=row.e,set=isReset(e);
    return `<tr><td>${esc(e.date||'—')}</td><td>${esc(e.time||'—')}</td><td>${esc(e.transactionType||'—')}${set?' <span class="pill green">SET</span>':''}</td><td><b>${esc(e.clientOrSupplier||'—')}</b></td><td>${esc(e.account||'Unassigned')}</td><td class="num">${!set&&N(e.cashIn)>0?E.peso(N(e.cashIn)):'—'}</td><td class="num">${!set&&N(e.cashOut)>0?E.peso(N(e.cashOut)):'—'}</td><td class="num"><b>${E.peso(row.after)}</b></td><td>${esc(e.referenceNumber||'—')}</td><td>${esc(set?`Exact balance set to ${E.peso(resetValue(e))}${e.remarks?' · '+e.remarks:''}`:(e.remarks||'—'))}</td></tr>`;
  }
  function draw(card){
    if(!card)return;
    const accounts=accountNames(),data=history(selectedMonth,selectedAccount),label=monthLabel(selectedMonth);
    card.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0">Account Monthly History — ${esc(label)}</h3><p style="margin:5px 0 0;color:var(--ink-soft);font-size:12px">Choose an account to review every cash-in, cash-out, and its running balance. Balance reconciliations are marked SET and are not counted as income or expense.</p></div><div class="field" style="min-width:170px"><label>Month</label><input type="month" data-account-history-month value="${esc(selectedMonth)}"></div></div><div class="actions" data-account-history-tabs style="justify-content:flex-start;flex-wrap:wrap;margin-top:12px"><button type="button" class="btn small ${selectedAccount?'':'primary'}" data-account-history-account="">All Accounts</button>${accounts.map(a=>`<button type="button" class="btn small ${selectedAccount===a?'primary':''}" data-account-history-account="${esc(a)}">${esc(a)}</button>`).join('')}</div><div class="kpi-grid" style="margin-top:12px"><div class="kpi"><div class="lbl">Opening Balance</div><div class="val">${E.peso(data.openingBalance)}</div></div><div class="kpi"><div class="lbl">Money In</div><div class="val">${E.peso(data.moneyIn)}</div></div><div class="kpi"><div class="lbl">Money Out</div><div class="val">${E.peso(data.moneyOut)}</div></div><div class="kpi"><div class="lbl">Ending Balance</div><div class="val">${E.peso(data.endingBalance)}</div><div style="font-size:10px;color:var(--ink-soft)">Net movement ${E.peso(data.moneyIn-data.moneyOut)}</div></div></div><div class="table-wrap" style="margin-top:12px"><table class="data" style="min-width:1180px"><thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Client / Supplier</th><th>Account</th><th class="num">Money In</th><th class="num">Money Out</th><th class="num">Account Running Balance</th><th>Reference</th><th>Remarks</th></tr></thead><tbody>${data.rows.length?data.rows.map(rowHtml).join(''):'<tr><td colspan="10"><div class="empty-state">No transactions for this account and month.</div></td></tr>'}</tbody></table></div>`;
    card.querySelector('[data-account-history-month]')?.addEventListener('change',e=>{selectedMonth=e.target.value||selectedMonth;draw(card);});
    card.querySelectorAll('[data-account-history-account]').forEach(button=>button.addEventListener('click',()=>{selectedAccount=button.dataset.accountHistoryAccount||'';draw(card);}));
  }
  function injectRCBCOptions(root=document){
    const selectors=['#pmt-account','#qp-account','#pf-account','#spp-pay-account','#mc-account','#tf-from','#tf-to','#le-account','[data-le-account]','[data-le-from]','[data-le-to]','.x-account','#sb-account-v2','#sb-account'];
    root.querySelectorAll(selectors.join(',')).forEach(select=>{
      if([...select.options].some(option=>String(option.value).trim().toLowerCase()==='rcbc'))return;
      const option=document.createElement('option');option.value=RCBC;option.textContent=RCBC;select.appendChild(option);
    });
  }
  function enhance(container){
    ensureRCBC(true);injectRCBCOptions(container);
    let card=container.querySelector('[data-finance-account-history]');
    if(!card){
      card=document.createElement('section');card.className='card';card.dataset.financeAccountHistory='1';
      const cashHeading=[...container.querySelectorAll('h3')].find(h=>h.textContent.trim().startsWith('Cash Ledger'));
      const cashCard=cashHeading?.closest('.card');
      if(cashCard)cashCard.insertAdjacentElement('beforebegin',card);else container.appendChild(card);
    }
    draw(card);
  }
  ensureRCBC(false);
  const baseRender=E.renderFinance;
  E.renderFinance=function(container){ensureRCBC(false);const result=baseRender(container);enhance(container);return result;};
  const observer=new MutationObserver(records=>{for(const record of records){for(const node of record.addedNodes){if(node.nodeType!==1)continue;injectRCBCOptions(node.matches?.('select')?node.parentElement||node:node);}}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  injectRCBCOptions();
  console.log('Finance RCBC account and monthly history installed');
}
boot();
})();
