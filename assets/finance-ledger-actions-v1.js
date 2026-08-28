(function(){
  'use strict';

  function boot(){
    const E=window.__ecohub;
    if(!E || !E.renderFinance){ setTimeout(boot,150); return; }
    if(window.__ecohubFinanceLedgerActionsV1) return;
    window.__ecohubFinanceLedgerActionsV1=true;

    const state=E.state;
    const observedBodies=new WeakSet();
    let activeModal=null;

    function esc(value){
      return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    function ledgerRows(container){
      const account=(container.querySelector('#lf-account')||{}).value||'';
      const type=(container.querySelector('#lf-type')||{}).value||'';
      return (state.cashLedger||[]).filter(entry=>{
        if(account && entry.account!==account) return false;
        if(type && entry.transactionType!==type) return false;
        return true;
      }).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||''))).reverse();
    }

    function enhance(container){
      if(!container) return;
      const body=container.querySelector('#fin-ledger-body');
      if(!body) return;
      const table=body.closest('table');
      const headRow=table&&table.querySelector('thead tr');
      if(headRow && !headRow.querySelector('[data-fin-actions-head]')){
        const th=document.createElement('th');
        th.textContent='Actions';
        th.dataset.finActionsHead='1';
        headRow.appendChild(th);
      }

      const entries=ledgerRows(container);
      Array.from(body.querySelectorAll('tr')).forEach((row,index)=>{
        const entry=entries[index];
        if(!entry || row.querySelector('[data-fin-actions-cell]')) return;
        const cell=document.createElement('td');
        cell.dataset.finActionsCell='1';
        cell.innerHTML='<div class="actions" style="flex-wrap:nowrap;gap:6px">'+
          '<button type="button" class="btn small" data-fin-edit="'+esc(entry.id)+'">Edit</button>'+
          '<button type="button" class="btn small danger" data-fin-delete="'+esc(entry.id)+'">Delete</button></div>';
        row.appendChild(cell);
        cell.querySelector('[data-fin-edit]').addEventListener('click',()=>openEditor(container,entry.id));
        cell.querySelector('[data-fin-delete]').addEventListener('click',()=>deleteTransaction(container,entry.id));
      });

      if(!observedBodies.has(body)){
        observedBodies.add(body);
        const observer=new MutationObserver(()=>Promise.resolve().then(()=>enhance(container)));
        observer.observe(body,{childList:true,subtree:true});
      }
    }

    function linkedRecord(entry){
      for(const quotation of (state.quotations||[])){
        const payment=(quotation.payments||[]).find(item=>item.ledgerEntryId===entry.id);
        if(payment) return {kind:'quotation',quotation,payment};
      }
      const expense=(state.expenses||[]).find(item=>item.ledgerEntryId===entry.id);
      if(expense) return {kind:'expense',expense};
      const supplierPayment=(state.supplierPayments||[]).find(item=>item.ledgerEntryId===entry.id);
      if(supplierPayment) return {kind:'supplier',supplierPayment};
      if(entry.transactionType==='Cash Transfer' && entry.referenceNumber){
        const entries=(state.cashLedger||[]).filter(item=>item.transactionType==='Cash Transfer' && item.referenceNumber===entry.referenceNumber);
        if(entries.length>1) return {kind:'transfer',entries};
      }
      return {kind:'manual'};
    }

    function accountOptions(selected){
      return [...new Set([...(state.settings.cashAccounts||[]),selected].filter(Boolean))]
        .map(value=>'<option value="'+esc(value)+'" '+(value===selected?'selected':'')+'>'+esc(value)+'</option>').join('');
    }

    function methodOptions(selected){
      return [...new Set([...(state.settings.paymentMethods||[]),selected].filter(Boolean))]
        .map(value=>'<option value="'+esc(value)+'" '+(value===selected?'selected':'')+'>'+esc(value)+'</option>').join('');
    }

    function closeModal(){
      if(activeModal){ activeModal.remove(); activeModal=null; }
    }

    function modalShell(title,note,fields){
      closeModal();
      const overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(20,35,27,.45);display:grid;place-items:center;padding:18px;overflow:auto';
      overlay.innerHTML='<div class="card" style="width:min(720px,100%);max-height:92vh;overflow:auto;border-color:var(--sage);box-shadow:0 20px 60px #0004">'+
        '<h3 style="margin-top:0">'+esc(title)+'</h3><p style="font-size:11.5px;color:var(--ink-soft);margin-top:-6px">'+esc(note)+'</p>'+
        '<div class="grid">'+fields+'</div><div class="actions" style="margin-top:12px"><button class="btn" data-modal-cancel>Cancel</button><button class="btn primary" data-modal-save>Save Changes</button></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('[data-modal-cancel]').addEventListener('click',closeModal);
      overlay.addEventListener('click',event=>{if(event.target===overlay) closeModal();});
      activeModal=overlay;
      return overlay;
    }

    function transferBaseRemarks(entry){
      return String(entry.remarks||'').replace(/ \((?:to|from) [^)]+\)$/i,'');
    }

    function openEditor(container,id){
      const entry=(state.cashLedger||[]).find(item=>item.id===id);
      if(!entry) return;
      const linked=linkedRecord(entry);
      if(linked.kind==='transfer') return openTransferEditor(container,entry,linked);

      const direction=Number(entry.cashIn)>0?'in':'out';
      const amount=direction==='in'?(Number(entry.cashIn)||0):(Number(entry.cashOut)||0);
      const sourceMethod=linked.kind==='quotation'?linked.payment.method:linked.kind==='expense'?linked.expense.method:linked.kind==='supplier'?linked.supplierPayment.method:'';
      const label=linked.kind==='quotation'?'Quotation payment — '+linked.quotation.number:linked.kind==='expense'?'Expense record':linked.kind==='supplier'?'Supplier payment':'Manual cash ledger entry';
      const fixed=linked.kind!=='manual';
      const modal=modalShell('Edit Cash Ledger Entry',label+(fixed?' · The original linked record will also be updated.':''),
        '<div class="field"><label>Date</label><input data-le-date type="date" value="'+esc(entry.date||'')+'"></div>'+
        '<div class="field"><label>Time</label><input data-le-time type="time" value="'+esc(entry.time||'')+'"></div>'+
        '<div class="field"><label>Transaction Type</label><select data-le-type '+(fixed?'disabled':'')+'>'+E.LEDGER_TRANSACTION_TYPES.map(type=>'<option value="'+esc(type)+'" '+(type===entry.transactionType?'selected':'')+'>'+esc(type)+'</option>').join('')+'</select></div>'+
        '<div class="field"><label>Account</label><select data-le-account>'+accountOptions(entry.account)+'</select></div>'+
        '<div class="field"><label>Amount</label><input data-le-amount type="number" step="0.01" min="0" value="'+amount+'"></div>'+
        '<div class="field"><label>Direction</label><select data-le-direction '+(fixed?'disabled':'')+'><option value="in" '+(direction==='in'?'selected':'')+'>Cash In</option><option value="out" '+(direction==='out'?'selected':'')+'>Cash Out</option></select></div>'+
        (sourceMethod?'<div class="field"><label>Payment Method</label><select data-le-method>'+methodOptions(sourceMethod)+'</select></div>':'')+
        '<div class="field"><label>Client / Supplier</label><input data-le-party value="'+esc(entry.clientOrSupplier||'')+'" '+(linked.kind==='quotation'?'disabled':'')+'></div>'+
        '<div class="field"><label>Reference</label><input data-le-reference value="'+esc(entry.referenceNumber||'')+'"></div>'+
        '<div class="field full"><label>Remarks</label><input data-le-remarks value="'+esc(entry.remarks||'')+'"></div>');
      modal.querySelector('[data-modal-save]').addEventListener('click',()=>saveStandardEdit(container,entry,linked,modal));
    }

    function openTransferEditor(container,entry,linked){
      const outgoing=linked.entries.find(item=>Number(item.cashOut)>0);
      const incoming=linked.entries.find(item=>Number(item.cashIn)>0);
      if(!outgoing || !incoming) return openEditorAsManual(container,entry);
      const modal=modalShell('Edit Fund Transfer','Both sides will be updated together so Total Cash Available stays correct.',
        '<div class="field"><label>Date</label><input data-le-date type="date" value="'+esc(outgoing.date||'')+'"></div>'+
        '<div class="field"><label>Amount</label><input data-le-amount type="number" step="0.01" min="0" value="'+(Number(outgoing.cashOut)||0)+'"></div>'+
        '<div class="field"><label>From Account</label><select data-le-from>'+accountOptions(outgoing.account)+'</select></div>'+
        '<div class="field"><label>To Account</label><select data-le-to>'+accountOptions(incoming.account)+'</select></div>'+
        '<div class="field full"><label>Remarks</label><input data-le-remarks value="'+esc(transferBaseRemarks(outgoing))+'"></div>');
      modal.querySelector('[data-modal-save]').addEventListener('click',async()=>{
        const amount=parseFloat(modal.querySelector('[data-le-amount]').value)||0;
        const from=modal.querySelector('[data-le-from]').value;
        const to=modal.querySelector('[data-le-to]').value;
        if(amount<=0){E.toast('Enter an amount greater than zero');return;}
        if(from===to){E.toast('Choose two different accounts');return;}
        const date=modal.querySelector('[data-le-date]').value;
        const remarks=modal.querySelector('[data-le-remarks]').value||'Transfer to '+to;
        await updateEntry(outgoing,{date,account:from,cashIn:0,cashOut:amount,remarks:remarks+' (to '+to+')'});
        await updateEntry(incoming,{date,account:to,cashIn:amount,cashOut:0,remarks:remarks+' (from '+from+')'});
        refresh(container,'Fund transfer updated');
      });
    }

    function openEditorAsManual(container,entry){
      const originalType=entry.transactionType;
      entry.transactionType='Other Income';
      openEditor(container,entry.id);
      entry.transactionType=originalType;
    }

    async function updateEntry(entry,changes){
      if(E.updateLedgerEntry) return E.updateLedgerEntry(entry,changes);
      Object.assign(entry,changes);
      return E.storageSet('cashledger:'+entry.id,entry);
    }

    async function reallocateSupplierPayment(payment,newAmount){
      const oldByPayable={};
      (payment.relatedPayables||[]).forEach(row=>{oldByPayable[row.payableId]=(oldByPayable[row.payableId]||0)+(Number(row.amount)||0);});
      const candidates=Object.keys(oldByPayable).map(id=>(state.payables||[]).find(payable=>payable.id===id)).filter(Boolean);
      if(!candidates.length) return Math.abs(newAmount-(Number(payment.amountPaid)||0))<0.005;
      const bases=new Map(candidates.map(payable=>[payable.id,Math.max(0,(Number(payable.amountPaid)||0)-(oldByPayable[payable.id]||0))]));
      const available=candidates.reduce((sum,payable)=>sum+Math.max(0,(Number(payable.totalSupplierCost)||0)-bases.get(payable.id)),0);
      if(newAmount>available+0.004) return false;
      let remaining=newAmount;
      const applied=[];
      for(const payable of candidates){
        const room=Math.max(0,(Number(payable.totalSupplierCost)||0)-bases.get(payable.id));
        const amount=Math.min(remaining,room);
        payable.amountPaid=bases.get(payable.id)+amount;
        if(E.recomputePayableTotals) E.recomputePayableTotals(payable);
        await E.storageSet('payable:'+payable.id,payable);
        if(amount>0) applied.push({payableId:payable.id,quotationNumber:payable.quotationNumber,product:payable.productName,amount});
        remaining-=amount;
      }
      payment.relatedPayables=applied;
      return remaining<0.005;
    }

    async function saveStandardEdit(container,entry,linked,modal){
      const amount=parseFloat(modal.querySelector('[data-le-amount]').value)||0;
      if(amount<=0){E.toast('Enter an amount greater than zero');return;}
      const direction=modal.querySelector('[data-le-direction]').value;
      const date=modal.querySelector('[data-le-date]').value;
      const time=modal.querySelector('[data-le-time]').value;
      const account=modal.querySelector('[data-le-account]').value;
      const party=modal.querySelector('[data-le-party]').value;
      const reference=modal.querySelector('[data-le-reference]').value;
      const remarks=modal.querySelector('[data-le-remarks]').value;
      const method=modal.querySelector('[data-le-method]');
      const changes={date,time,account,referenceNumber:reference,remarks,clientOrSupplier:party,cashIn:direction==='in'?amount:0,cashOut:direction==='out'?amount:0};

      if(linked.kind==='quotation'){
        const payment=linked.payment,quotation=linked.quotation;
        Object.assign(payment,{date,amount,reference,remarks,account});
        if(method) payment.method=method.value;
        Object.assign(changes,{transactionType:'Client Payment',clientOrSupplier:quotation.company||quotation.customer||'',cashIn:amount,cashOut:0});
        await E.storageSet('quotation:'+quotation.number,quotation);
      }else if(linked.kind==='expense'){
        const expense=linked.expense;
        Object.assign(expense,{date,amount,payee:party,description:remarks,account});
        if(method) expense.method=method.value;
        Object.assign(changes,{transactionType:'Expense',cashIn:0,cashOut:amount});
        await E.storageSet('expense:'+expense.id,expense);
      }else if(linked.kind==='supplier'){
        const payment=linked.supplierPayment;
        if(!(await reallocateSupplierPayment(payment,amount))){E.toast('Amount is higher than the linked supplier payable balance');return;}
        Object.assign(payment,{paymentDate:date,amountPaid:amount,referenceNumber:reference,remarks,supplier:party});
        if(method) payment.method=method.value;
        Object.assign(changes,{transactionType:'Supplier Payment',cashIn:0,cashOut:amount});
        await E.storageSet('supplierPayment:'+payment.id,payment);
      }else{
        changes.transactionType=modal.querySelector('[data-le-type]').value;
      }
      await updateEntry(entry,changes);
      refresh(container,'Cash ledger entry updated');
    }

    async function removeLedgerEntries(entries){
      const ids=new Set(entries.map(entry=>entry.id));
      state.cashLedger=(state.cashLedger||[]).filter(entry=>!ids.has(entry.id));
      for(const entry of entries) await E.storageDelete('cashledger:'+entry.id);
    }

    async function deleteTransaction(container,id){
      const entry=(state.cashLedger||[]).find(item=>item.id===id);
      if(!entry) return;
      const linked=linkedRecord(entry);
      const message=linked.kind==='transfer'?'Delete both sides of this fund transfer?':linked.kind==='quotation'?'Delete this payment from '+linked.quotation.number+'?':linked.kind==='expense'?'Delete this expense from both Expenses and Finance?':linked.kind==='supplier'?'Delete this supplier payment and restore the linked payable balance?':'Delete this cash ledger entry?';
      if(!window.confirm(message+' This cannot be undone.')) return;

      if(linked.kind==='quotation'){
        linked.quotation.payments=(linked.quotation.payments||[]).filter(payment=>payment.id!==linked.payment.id);
        await E.storageSet('quotation:'+linked.quotation.number,linked.quotation);
      }else if(linked.kind==='expense'){
        state.expenses=(state.expenses||[]).filter(expense=>expense.id!==linked.expense.id);
        await E.storageDelete('expense:'+linked.expense.id);
      }else if(linked.kind==='supplier'){
        for(const relation of (linked.supplierPayment.relatedPayables||[])){
          const payable=(state.payables||[]).find(item=>item.id===relation.payableId);
          if(!payable) continue;
          payable.amountPaid=Math.max(0,(Number(payable.amountPaid)||0)-(Number(relation.amount)||0));
          if(E.recomputePayableTotals) E.recomputePayableTotals(payable);
          await E.storageSet('payable:'+payable.id,payable);
        }
        state.supplierPayments=(state.supplierPayments||[]).filter(payment=>payment.id!==linked.supplierPayment.id);
        await E.storageDelete('supplierPayment:'+linked.supplierPayment.id);
      }
      await removeLedgerEntries(linked.kind==='transfer'?linked.entries:[entry]);
      refresh(container,'Transaction deleted');
    }

    function refresh(container,message){
      closeModal();
      if(message) E.toast(message);
      E.renderFinance(container);
    }

    const originalRenderFinance=E.renderFinance;
    E.renderFinance=function(container){
      const result=originalRenderFinance(container);
      enhance(container);
      return result;
    };

    const current=document.getElementById('main-content');
    if(current) enhance(current);
  }

  boot();
})();
