(function(){
'use strict';
let tries=0,reconciling=false;

function boot(){
  const E=window.__ecohub;
  if(!E||!E.state||!E.renderFinance||!E.renderExpenses||!E.createLedgerEntry){
    if(++tries<180)setTimeout(boot,120);
    return;
  }
  if(window.__ecohubFinanceIntegrityV3)return;
  window.__ecohubFinanceIntegrityV3=true;

  const S=E.state;
  const N=v=>Number(v)||0;
  const esc=v=>E.escapeHtml?E.escapeHtml(v):String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=p=>E.uid?E.uid(p):(p+Date.now().toString(36)+Math.random().toString(36).slice(2,8));
  const today=()=>E.todayISO?E.todayISO():new Date().toISOString().slice(0,10);
  const peso=v=>E.peso?E.peso(N(v)):'₱'+N(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const norm=v=>String(v==null?'':v).trim().replace(/\s+/g,' ').toLowerCase();
  const stamp=e=>new Date(e?.createdAt||`${e?.date||'1970-01-01'}T${e?.time||'00:00'}:00Z`).getTime()||0;

  /* One click must create one business event. This guard covers every Finance form. */
  const SAVE_IDS=new Set(['pmt-save','mc-save','tf-save','qp-save','pf-save','le-save','e-add-btn']);
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('button[id]');
    if(!button||!SAVE_IDS.has(button.id))return;
    if(button.dataset.ecohubSubmitLock==='1'){
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    button.dataset.ecohubSubmitLock='1';
    const oldText=button.textContent;
    if(!/saving/i.test(oldText))button.textContent='Saving…';
    setTimeout(()=>{if(document.body.contains(button))button.disabled=true;},0);
    setTimeout(()=>{
      if(!document.body.contains(button))return;
      button.dataset.ecohubSubmitLock='';button.disabled=false;button.textContent=oldText;
    },6000);
  },true);

  /* Protect programmatic callers too. Two identical ledger writes within 10 seconds reuse one row. */
  const baseCreate=E.createLedgerEntry;
  const inFlight=new Map();
  function semanticKey(f){
    return [f?.date,f?.transactionType,f?.source,f?.account,N(f?.cashIn).toFixed(4),N(f?.cashOut).toFixed(4),f?.referenceNumber,f?.clientOrSupplier,f?.remarks].map(norm).join('|');
  }
  E.createLedgerEntry=async function(fields){
    const key=semanticKey(fields);
    if(inFlight.has(key))return inFlight.get(key);
    const recent=(S.cashLedger||[]).find(row=>semanticKey(row)===key&&Date.now()-stamp(row)>=0&&Date.now()-stamp(row)<=10000);
    if(recent)return recent;
    const task=Promise.resolve(baseCreate(fields)).finally(()=>setTimeout(()=>inFlight.delete(key),10000));
    inFlight.set(key,task);
    return task;
  };

  function clientName(q){return String(q?.company||q?.customer||'').trim();}
  function quoteCandidates(q,p,ledgers){
    const qno=String(q?.number||'');
    return ledgers.filter(row=>row&&row.transactionType==='Client Payment'&&N(row.cashIn)>0&&
      String(row.date||'')===String(p?.date||'')&&String(row.account||'')===String(p?.account||'')&&Math.abs(N(row.cashIn)-N(p?.amount))<.004&&
      (String(row.quotationPaymentId||'')===String(p?.id||'')||String(row.quotationNumber||'')===qno||String(row.remarks||'').includes(qno)));
  }

  async function liveReconcileMigratedPayments(){
    if(reconciling||!E.storageListKeys||!E.storageGet||!E.storageSet||!E.storageDelete)return;
    reconciling=true;
    try{
      const [qKeys,lKeys]=await Promise.all([E.storageListKeys('quotation:'),E.storageListKeys('cashledger:')]);
      const [quotes,ledgers]=await Promise.all([
        Promise.all(qKeys.map(k=>E.storageGet(k))),Promise.all(lKeys.map(k=>E.storageGet(k)))
      ]);
      const qs=quotes.filter(Boolean),ls=ledgers.filter(Boolean),deleted=new Set(),changedQ=new Set(),changedL=new Set();
      for(const q of qs){
        for(const p of (q.payments||[])){
          if(N(p?.amount)<=0)continue;
          const candidates=quoteCandidates(q,p,ls).filter(row=>!deleted.has(row.id));
          if(!candidates.length)continue;
          let canonical=candidates.find(row=>row.id===p.ledgerEntryId)||candidates.find(row=>row.quotationPaymentId===p.id)||candidates[0];
          if(p.ledgerEntryId!==canonical.id){p.ledgerEntryId=canonical.id;changedQ.add(q.number);}
          if(canonical.quotationNumber!==q.number||canonical.quotationPaymentId!==p.id){
            canonical.quotationNumber=q.number;canonical.quotationPaymentId=p.id;canonical.clientOrSupplier=clientName(q);changedL.add(canonical.id);
          }
          const migratedExtras=candidates.filter(row=>row.id!==canonical.id&&row.migratedFromQuotation===true);
          for(const extra of migratedExtras){
            const archiveKey='auditArchive:auto-duplicate-'+String(extra.id).replace(/[^a-zA-Z0-9_-]/g,'-');
            await E.storageSet(archiveKey,{reason:'Exact duplicate migrated quotation-payment ledger row',archivedAt:new Date().toISOString(),quotation:q.number,paymentId:p.id,canonicalLedgerId:canonical.id,originalKey:'cashledger:'+extra.id,value:clone(extra)});
            await E.storageDelete('cashledger:'+extra.id);deleted.add(extra.id);
          }
        }
      }
      for(const q of qs)if(changedQ.has(q.number))await E.storageSet('quotation:'+q.number,q);
      for(const row of ls)if(changedL.has(row.id))await E.storageSet('cashledger:'+row.id,row);
      if(deleted.size||changedQ.size||changedL.size){
        S.quotations=qs;
        S.cashLedger=ls.filter(row=>!deleted.has(row.id));
        console.log('Finance v3 reconciled migrated quotation payments',{deleted:deleted.size,relinked:changedQ.size});
      }
    }catch(error){console.error('Finance v3 live reconciliation failed',error);}
    finally{reconciling=false;}
  }

  function duplicateAudit(){
    const ledgers=(S.cashLedger||[]).filter(Boolean),groups=new Map();
    for(const row of ledgers){
      if(!String(row.date||'').startsWith('2026-'))continue;
      const key=semanticKey(row),bucket=groups.get(key)||[];bucket.push(row);groups.set(key,bucket);
    }
    const rapid=[];
    for(const rows of groups.values()){
      rows.sort((a,b)=>stamp(a)-stamp(b));
      for(let i=1;i<rows.length;i++)if(Math.abs(stamp(rows[i])-stamp(rows[i-1]))<=10000)rapid.push(rows[i]);
    }
    const linkedIds=new Set();
    const orphanQuoteRows=[];
    for(const q of (S.quotations||[]))for(const p of (q.payments||[])){
      if(p?.ledgerEntryId)linkedIds.add(String(p.ledgerEntryId));
      for(const row of quoteCandidates(q,p,ledgers))if(row.id!==p.ledgerEntryId&&!linkedIds.has(String(row.id)))orphanQuoteRows.push(row);
    }
    return{rapid:[...new Map(rapid.map(x=>[x.id,x])).values()],orphanQuoteRows:[...new Map(orphanQuoteRows.map(x=>[x.id,x])).values()]};
  }

  function decorateFinance(container){
    const audit=duplicateAudit();
    let card=container.querySelector('[data-finance-integrity-v3]');
    if(!card){
      card=document.createElement('section');card.className='card';card.dataset.financeIntegrityV3='1';
      const existing=container.querySelector('[data-finance-integrity-v2]');
      (existing||container.querySelector('.topbar')||container.firstElementChild)?.insertAdjacentElement('afterend',card);
    }
    const issues=new Set([...audit.rapid,...audit.orphanQuoteRows].map(x=>x.id));
    card.style.borderColor=issues.size?'#b42318':'var(--sage)';
    card.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap"><div><h3 style="margin:0">Duplicate-Write Protection</h3><p style="margin:5px 0 0;color:var(--ink-soft);font-size:12px">Checks rapid double-submits and extra quotation-payment ledger rows. Exact migrated duplicates are archived before removal.</p></div><button class="btn small" type="button" data-finance-v3-recheck>Refresh &amp; Recheck</button></div><div class="actions" style="justify-content:flex-start;margin-top:10px;flex-wrap:wrap"><span class="pill ${audit.rapid.length?'red':'green'}">${audit.rapid.length} rapid duplicate rows</span><span class="pill ${audit.orphanQuoteRows.length?'red':'green'}">${audit.orphanQuoteRows.length} extra quotation rows</span></div>`;
    card.querySelector('[data-finance-v3-recheck]')?.addEventListener('click',async event=>{
      event.currentTarget.disabled=true;await liveReconcileMigratedPayments();E.renderFinance(container);
    });
  }

  /* Month-by-month Expenses, with summaries and category totals. */
  let expenseMonth=today().slice(0,7);
  function monthLabel(key){
    if(key==='all')return'All Months';
    if(!/^\d{4}-\d{2}$/.test(key||''))return'Unknown Month';
    return new Date(key+'-01T00:00:00').toLocaleDateString('en-PH',{month:'long',year:'numeric'});
  }
  function months(){
    return [...new Set([today().slice(0,7),...(S.expenses||[]).map(x=>String(x?.date||'').slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x))])].sort((a,b)=>b.localeCompare(a));
  }
  function visibleExpenses(){return expenseMonth==='all'?(S.expenses||[]):(S.expenses||[]).filter(x=>String(x?.date||'').slice(0,7)===expenseMonth);}
  function syncExpense(exp){
    const row=(S.cashLedger||[]).find(x=>x.id===exp.ledgerEntryId);if(!row)return;
    E.updateLedgerEntry(row,{date:exp.date,account:exp.account,cashIn:0,cashOut:N(exp.amount),clientOrSupplier:exp.payee,remarks:exp.description||'Expense entry'});
  }
  function summary(){
    const rows=visibleExpenses(),total=rows.reduce((s,x)=>s+N(x.amount),0),cats={};
    for(const row of rows){const c=String(row.category||'Uncategorized').trim()||'Uncategorized';cats[c]=cats[c]||{count:0,amount:0};cats[c].count++;cats[c].amount+=N(row.amount);}
    return{rows,total,categories:Object.entries(cats).sort((a,b)=>b[1].amount-a[1].amount)};
  }
  function renderExpenseSummary(container){
    const data=summary(),set=(id,val)=>{const el=container.querySelector(id);if(el)el.textContent=val;};
    set('#e-period-label-v3',monthLabel(expenseMonth));set('#e-total-v3',peso(data.total));set('#e-count-v3',String(data.rows.length));set('#e-top-v3',data.categories[0]?.[0]||'—');set('#e-average-v3',peso(data.rows.length?data.total/data.rows.length:0));
    const body=container.querySelector('#e-category-v3');if(body)body.innerHTML=data.categories.length?data.categories.map(([name,x])=>`<tr><td><b>${esc(name)}</b></td><td class="num">${x.count}</td><td class="num">${peso(x.amount)}</td><td class="num">${data.total?((x.amount/data.total)*100).toFixed(1):'0.0'}%</td></tr>`).join(''):`<tr><td colspan="4"><div class="empty-state">No expenses for ${esc(monthLabel(expenseMonth))}.</div></td></tr>`;
  }
  function renderExpenseRows(container){
    const body=container.querySelector('#e-body-v3'),data=summary();if(!body)return;
    const cats=S.settings?.expenseCategories||[],methods=S.settings?.paymentMethods||[],accounts=S.settings?.cashAccounts||[];
    const rows=data.rows.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    body.innerHTML=(rows.length?rows.map(x=>`<tr data-expense-v3="${esc(x.id)}"><td><input class="x-date" type="date" value="${esc(x.date||'')}"></td><td><select class="x-cat">${cats.map(v=>`<option ${v===x.category?'selected':''}>${esc(v)}</option>`).join('')}</select></td><td><input class="x-desc" value="${esc(x.description||'')}"></td><td><input class="x-payee" value="${esc(x.payee||'')}"></td><td><input class="x-amount" type="number" step="0.01" value="${N(x.amount)}" style="width:100px;text-align:right"></td><td><select class="x-method">${methods.map(v=>`<option ${v===x.method?'selected':''}>${esc(v)}</option>`).join('')}</select></td><td><select class="x-account">${accounts.map(v=>`<option ${v===x.account?'selected':''}>${esc(v)}</option>`).join('')}</select></td><td><button class="row-del" type="button">✕</button></td></tr>`).join(''):`<tr><td colspan="8"><div class="empty-state">No expenses for ${esc(monthLabel(expenseMonth))}.</div></td></tr>`)+`<tr><td colspan="4" style="text-align:right;font-weight:700">${esc(monthLabel(expenseMonth))} Total</td><td class="num" style="font-weight:800">${peso(data.total)}</td><td colspan="3"></td></tr>`;
    body.querySelectorAll('[data-expense-v3]').forEach(tr=>{
      const exp=(S.expenses||[]).find(x=>x.id===tr.dataset.expenseV3);if(!exp)return;
      const fields={'.x-date':'date','.x-cat':'category','.x-desc':'description','.x-payee':'payee','.x-amount':'amount','.x-method':'method','.x-account':'account'};
      for(const [selector,key] of Object.entries(fields)){
        const el=tr.querySelector(selector),evt=(el.tagName==='SELECT'||el.type==='date')?'change':'input';
        el.addEventListener(evt,()=>{exp[key]=key==='amount'?N(el.value):el.value;E.debounceSave?.('expense:'+exp.id,()=>{E.storageSet('expense:'+exp.id,exp);syncExpense(exp);});if(evt==='change'){E.storageSet('expense:'+exp.id,exp);syncExpense(exp);}renderExpenseSummary(container);if(key==='date'&&expenseMonth!=='all'&&!String(exp.date||'').startsWith(expenseMonth))renderExpenseRows(container);});
        if(evt==='input')el.addEventListener('blur',()=>E.flushSave?.('expense:'+exp.id));
      }
      tr.querySelector('.row-del').addEventListener('click',async()=>{
        if(!confirm('Delete this expense and its matching Finance entry?'))return;
        await E.flushSave?.('expense:'+exp.id);await E.storageDelete('expense:'+exp.id);S.expenses=S.expenses.filter(x=>x.id!==exp.id);
        if(exp.ledgerEntryId){await E.storageDelete('cashledger:'+exp.ledgerEntryId);S.cashLedger=S.cashLedger.filter(x=>x.id!==exp.ledgerEntryId);}
        renderExpenseSummary(container);renderExpenseRows(container);
      });
    });
  }
  function renderExpensesV3(container){
    container.innerHTML=`<div class="topbar"><div class="titleblock"><p class="eyebrow">Operations</p><h2>Expenses</h2></div><div class="actions"><button class="btn primary" id="e-add-btn">+ Add Expense</button></div></div><p style="color:var(--ink-soft);font-size:12.5px;margin-top:-10px">Choose a month to review only that month's expenses and category totals. Every expense stays linked to Finance.</p><div class="card"><div style="display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap"><div><h3 style="margin-bottom:4px">Expense Month</h3><div style="font-size:12px;color:var(--ink-soft)">October shows October only; November shows November only.</div></div><div class="field" style="min-width:220px"><label>Select month</label><select id="e-month-v3"><option value="all">All Months</option>${months().map(m=>`<option value="${m}" ${m===expenseMonth?'selected':''}>${esc(monthLabel(m))}</option>`).join('')}</select></div></div></div><div class="kpi-grid"><div class="kpi"><div class="lbl">Total · <span id="e-period-label-v3"></span></div><div class="val" id="e-total-v3"></div></div><div class="kpi"><div class="lbl">Expense Entries</div><div class="val" id="e-count-v3"></div></div><div class="kpi"><div class="lbl">Top Category</div><div class="val" id="e-top-v3" style="font-family:inherit;font-size:16px"></div></div><div class="kpi"><div class="lbl">Average Expense</div><div class="val" id="e-average-v3"></div></div></div><div class="card"><h3>Category Breakdown</h3><div class="table-wrap"><table class="data"><thead><tr><th>Category</th><th class="num">Entries</th><th class="num">Total</th><th class="num">Share</th></tr></thead><tbody id="e-category-v3"></tbody></table></div></div><div class="card"><h3>Expense Records</h3><div class="table-wrap"><table class="data"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Payee</th><th class="num">Amount</th><th>Method</th><th>Paid From</th><th></th></tr></thead><tbody id="e-body-v3"></tbody></table></div></div>`;
    renderExpenseSummary(container);renderExpenseRows(container);
    container.querySelector('#e-month-v3').addEventListener('change',e=>{expenseMonth=e.target.value;renderExpenseSummary(container);renderExpenseRows(container);});
    container.querySelector('#e-add-btn').addEventListener('click',async event=>{
      const account=S.settings?.cashAccounts?.[0]||'Cash on Hand',exp={id:uid('exp'),date:today(),category:S.settings?.expenseCategories?.[0]||'',description:'',payee:'',amount:0,method:S.settings?.paymentMethods?.[0]||'',account};
      S.expenses.unshift(exp);await E.storageSet('expense:'+exp.id,exp);
      const ledger=await E.createLedgerEntry({date:exp.date,transactionType:'Expense',source:'Expenses',clientOrSupplier:'',account,cashIn:0,cashOut:0,remarks:'Expense entry'});
      exp.ledgerEntryId=ledger.id;await E.storageSet('expense:'+exp.id,exp);expenseMonth=exp.date.slice(0,7);E.renderExpenses(container);
    });
  }

  const baseFinance=E.renderFinance;
  E.renderFinance=function(container){const result=baseFinance(container);decorateFinance(container);return result;};
  E.renderExpenses=renderExpensesV3;
  setTimeout(liveReconcileMigratedPayments,1800);
  console.log('Finance integrity, duplicate-write protection, and monthly Expenses v3 installed');
}
boot();
})();
