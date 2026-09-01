(function(){
  'use strict';

  const UI={tab:'PRINTING',selected:new Set(),open:new Set(),classic:false,refreshToken:0};

  function waitForApp(){
    const E=window.__ecohub;
    if(!E || !E.renderPayables || !E.storageListKeys || !E.storageGet){
      setTimeout(waitForApp,120);
      return;
    }
    if(window.__ecohubSupplierPayablesSplitV1) return;
    window.__ecohubSupplierPayablesSplitV1=true;
    const classicRender=E.renderPayables;
    E.renderPayables=container=>renderPage(E,container,classicRender);
  }

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }
  function money(value){
    return '₱'+(Number(value)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  function number(value){
    return (Number(value)||0).toLocaleString('en-PH',{maximumFractionDigits:4});
  }
  function today(){ return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'}); }
  function formatDate(value){
    if(!value) return '—';
    const d=new Date(value+'T00:00:00');
    return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'});
  }
  function category(pay){
    const explicit=String(pay&&pay.supplierCategory||pay&&pay.payableType||'').toUpperCase();
    if(explicit.includes('PRINT')) return 'PRINTING';
    if(explicit.includes('PACK')) return 'PACKAGING';
    const hint=[pay&&pay.supplierName,pay&&pay.sourceType,pay&&pay.sourceDocument,pay&&pay.referenceNumber].join(' ').toLowerCase();
    return /print|caps payable|cup print/.test(hint)?'PRINTING':'PACKAGING';
  }
  function usable(pay){
    return pay && !pay.cancelled && !pay.archived && !pay.historicalSettled;
  }
  function balance(pay){
    return Math.max(0,Number(pay.remainingBalance!=null?pay.remainingBalance:(Number(pay.totalSupplierCost)||0)-(Number(pay.amountPaid)||0))||0);
  }
  function status(pay){
    if((Number(pay.totalSupplierCost)||0)<=0) return 'No Charge';
    if(balance(pay)<=0.004) return 'Fully Paid';
    const due=pay.paymentDueDate||'';
    if(due && due<today()) return 'Overdue';
    if(due===today()) return 'Due Today';
    if((Number(pay.amountPaid)||0)>0) return 'Partially Paid';
    if(due){
      const days=Math.round((new Date(due+'T00:00:00')-new Date(today()+'T00:00:00'))/86400000);
      if(days>0 && days<=7) return 'Due Soon';
    }
    return pay.dateOrderedFromSupplier?'Unpaid':'For Purchase';
  }
  function badge(value){
    const s=String(value||'');
    const tone=s==='Overdue'?'danger':s==='Due Today'||s==='Due Soon'?'warn':s==='Fully Paid'?'paid':s==='No Charge'?'muted':'open';
    return '<span class="spp-badge '+tone+'">'+esc(s)+'</span>';
  }
  function groupKey(pay){
    return [category(pay),pay.supplierName||'Supplier',pay.referenceNumber||pay.purchaseOrderNumber||pay.sourceId||pay.dateOrderedFromSupplier||pay.id].join('|');
  }
  function grouped(rows){
    const map=new Map();
    rows.forEach(pay=>{
      const key=groupKey(pay);
      if(!map.has(key)) map.set(key,{key,category:category(pay),supplier:pay.supplierName||'Supplier',reference:pay.referenceNumber||pay.purchaseOrderNumber||pay.sourceId||'No reference',date:pay.quotationDate||pay.dateOrderedFromSupplier||'',due:pay.paymentDueDate||'',sourceDocument:pay.sourceDocument||'',rows:[]});
      map.get(key).rows.push(pay);
    });
    return Array.from(map.values()).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(a.reference).localeCompare(String(b.reference)));
  }

  async function refresh(E){
    const keys=await E.storageListKeys('payable:');
    const fresh=[];
    for(let i=0;i<keys.length;i+=20){
      const values=await Promise.all(keys.slice(i,i+20).map(key=>E.storageGet(key)));
      values.forEach(value=>{if(value)fresh.push(value);});
    }
    E.state.payables=fresh;
  }

  async function renderPage(E,container,classicRender){
    if(UI.classic){
      classicRender(container);
      injectClassicReturn(E,container,classicRender);
      return;
    }
    const token=++UI.refreshToken;
    container.innerHTML='<div class="card"><div class="empty-state">Refreshing supplier payable records…</div></div>';
    try{ await refresh(E); }
    catch(err){ console.error('Supplier Payables split refresh failed',err); }
    if(token!==UI.refreshToken) return;
    draw(E,container,classicRender);
  }

  function injectClassicReturn(E,container,classicRender){
    let attempts=0;
    const place=()=>{
      attempts++;
      if(!container.isConnected) return;
      if(container.querySelector('#spp-return')) return;
      const first=container.firstElementChild;
      if(first && !/Refreshing Supplier Payables/.test(container.textContent||'')){
        const bar=document.createElement('div');
        bar.id='spp-return';
        bar.className='card';
        bar.style.cssText='border-color:var(--sage);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px';
        bar.innerHTML='<div><b>Full Supplier Payables Editor</b><div style="font-size:12px;color:var(--ink-soft)">Existing add, edit, supplier profile, and detailed maintenance tools.</div></div><button class="btn primary">← Return to Split Payables</button>';
        container.insertBefore(bar,first);
        bar.querySelector('button').onclick=()=>{UI.classic=false;renderPage(E,container,classicRender);};
        return;
      }
      if(attempts<20) setTimeout(place,150);
    };
    setTimeout(place,80);
  }

  function ensureStyles(){
    if(document.getElementById('spp-split-style')) return;
    const style=document.createElement('style');
    style.id='spp-split-style';
    style.textContent=`
      .spp-tabs{display:flex;gap:8px;flex-wrap:wrap}.spp-tab{border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:10px;padding:10px 13px;font-weight:800;cursor:pointer}.spp-tab.active{background:var(--forest,#173b2b);color:#fff;border-color:var(--forest,#173b2b)}
      .spp-help{font-size:12px;color:var(--ink-soft);line-height:1.45}.spp-batch{border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden;margin-bottom:12px}.spp-batch-header{padding:13px 14px;display:grid;grid-template-columns:auto minmax(180px,1fr) repeat(4,minmax(100px,auto));gap:12px;align-items:center;background:var(--sage-light,#eef2e9);touch-action:pan-y}.spp-batch-header.longpress{box-shadow:inset 0 0 0 2px var(--sage,#67836e)}
      .spp-batch-title{font-weight:900;color:var(--ink)}.spp-meta{font-size:11.5px;color:var(--ink-soft);margin-top:3px}.spp-metric{text-align:right}.spp-metric small{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em}.spp-metric b{font-family:var(--mono,monospace);font-size:12.5px}.spp-badge{display:inline-block;border-radius:999px;padding:4px 8px;font-size:10.5px;font-weight:800;white-space:nowrap}.spp-badge.danger{background:#fbe3df;color:#9f2d22}.spp-badge.warn{background:#fff0cc;color:#8a5a00}.spp-badge.paid{background:#dff2e5;color:#186434}.spp-badge.muted{background:#ececec;color:#666}.spp-badge.open{background:#e4eee7;color:#28533a}
      .spp-check{width:18px;height:18px;accent-color:var(--forest,#173b2b)}.spp-details{display:none;border-top:1px solid var(--line)}.spp-details.open{display:block}.spp-source-note{padding:9px 13px;background:#faf8f1;font-size:11.5px;color:var(--ink-soft)}.spp-payment{border:2px solid var(--sage,#67836e)!important;position:sticky;bottom:10px;z-index:20;box-shadow:0 10px 30px #19382726}.spp-payment-grid{display:grid;grid-template-columns:repeat(6,minmax(130px,1fr));gap:10px}.spp-field label{display:block;font-size:10.5px;font-weight:800;color:var(--ink-soft);margin-bottom:4px}.spp-field input,.spp-field select{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink)}
      @media(max-width:1050px){.spp-batch-header{grid-template-columns:auto 1fr auto auto}.spp-batch-header .spp-hide-tablet{display:none}.spp-payment-grid{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:650px){.spp-batch-header{grid-template-columns:auto 1fr auto;gap:8px}.spp-batch-header .spp-hide-mobile{display:none}.spp-payment{position:static}.spp-payment-grid{grid-template-columns:1fr 1fr}.spp-field.full-mobile{grid-column:1/-1}.spp-tab{flex:1 1 100%;text-align:left}.spp-actions-mobile{width:100%;justify-content:stretch}.spp-actions-mobile .btn{flex:1}.spp-batch{border-radius:9px}}
    `;
    document.head.appendChild(style);
  }

  function draw(E,container,classicRender){
    ensureStyles();
    const all=(E.state.payables||[]).filter(usable);
    const rows=all.filter(p=>UI.tab==='ALL'||category(p)===UI.tab);
    const groups=grouped(rows);
    const activeIds=new Set(all.map(p=>p.id));
    Array.from(UI.selected).forEach(id=>{if(!activeIds.has(id))UI.selected.delete(id);});
    const outstanding=rows.reduce((sum,p)=>sum+balance(p),0);
    const paid=rows.reduce((sum,p)=>sum+(Number(p.amountPaid)||0),0);
    const overdue=rows.filter(p=>status(p)==='Overdue').reduce((sum,p)=>sum+balance(p),0);
    const dueSoon=rows.filter(p=>status(p)==='Due Soon'||status(p)==='Due Today').reduce((sum,p)=>sum+balance(p),0);

    container.innerHTML=`
      <div class="topbar"><div class="titleblock"><p class="eyebrow">Supplier Payables</p><h2>Packaging & Printing Payables</h2><p class="spp-help">Separate supplier views, quotation/date batches, and line-level or whole-batch payments. Finance changes only after Save Payment.</p></div><div class="actions spp-actions-mobile"><button class="btn" id="spp-refresh">Refresh</button><button class="btn" id="spp-classic">Full Editor</button></div></div>
      <div class="card"><div class="spp-tabs"><button class="spp-tab ${UI.tab==='PACKAGING'?'active':''}" data-spp-tab="PACKAGING">📦 Packaging / EcoCycle</button><button class="spp-tab ${UI.tab==='PRINTING'?'active':''}" data-spp-tab="PRINTING">🖨️ Printed Cups / Printing Supplier</button><button class="spp-tab ${UI.tab==='ALL'?'active':''}" data-spp-tab="ALL">All Supplier Payables</button></div><p class="spp-help" style="margin:10px 0 0">Tap a checkbox for individual lines. Tap <b>Select Batch</b> or long-press a quotation header to select the whole quotation.</p></div>
      <div class="kpi-grid"><div class="kpi"><div class="lbl">Outstanding</div><div class="val">${money(outstanding)}</div></div><div class="kpi"><div class="lbl">Already Paid</div><div class="val">${money(paid)}</div></div><div class="kpi"><div class="lbl">Overdue</div><div class="val">${money(overdue)}</div></div><div class="kpi"><div class="lbl">Due Today / Soon</div><div class="val">${money(dueSoon)}</div></div><div class="kpi"><div class="lbl">Quotation / PO Batches</div><div class="val">${groups.length}</div></div></div>
      <div id="spp-payment-slot"></div>
      <div id="spp-groups">${groups.length?groups.map(groupHtml).join(''):'<div class="card"><div class="empty-state">No supplier payables in this view.</div></div>'}</div>`;

    container.querySelectorAll('[data-spp-tab]').forEach(button=>button.onclick=()=>{UI.tab=button.dataset.sppTab;UI.selected.clear();draw(E,container,classicRender);});
    container.querySelector('#spp-refresh').onclick=()=>renderPage(E,container,classicRender);
    container.querySelector('#spp-classic').onclick=()=>{UI.classic=true;renderPage(E,container,classicRender);};
    wireGroups(E,container,classicRender,groups);
    renderPayment(E,container,classicRender);
  }

  function groupHtml(group){
    const billable=group.rows.filter(p=>balance(p)>0.004);
    const total=group.rows.reduce((s,p)=>s+(Number(p.totalSupplierCost)||0),0);
    const paid=group.rows.reduce((s,p)=>s+(Number(p.amountPaid)||0),0);
    const remaining=group.rows.reduce((s,p)=>s+balance(p),0);
    const groupStatus=group.rows.some(p=>status(p)==='Overdue')?'Overdue':group.rows.some(p=>status(p)==='Due Today')?'Due Today':remaining<=.004?'Fully Paid':group.rows.some(p=>status(p)==='Due Soon')?'Due Soon':paid>0?'Partially Paid':'Unpaid';
    const allSelected=billable.length>0&&billable.every(p=>UI.selected.has(p.id));
    const open=UI.open.has(group.key);
    return `<section class="spp-batch" data-group-key="${esc(group.key)}"><div class="spp-batch-header" data-longpress-group="${esc(group.key)}">
      <input class="spp-check spp-group-check" type="checkbox" aria-label="Select batch" ${allSelected?'checked':''} ${billable.length?'':'disabled'}>
      <div><div class="spp-batch-title">${esc(group.reference)}</div><div class="spp-meta">${esc(group.supplier)} · Quotation ${formatDate(group.date)} · ${group.rows.length} line${group.rows.length===1?'':'s'}</div></div>
      <div class="spp-metric spp-hide-mobile"><small>Total</small><b>${money(total)}</b></div><div class="spp-metric spp-hide-tablet"><small>Paid</small><b>${money(paid)}</b></div><div class="spp-metric"><small>Balance</small><b>${money(remaining)}</b></div><div style="display:flex;gap:7px;align-items:center;justify-content:flex-end">${badge(groupStatus)}<button class="btn small spp-select-batch">${allSelected?'Unselect':'Select Batch'}</button><button class="btn small spp-toggle">${open?'Close':'Open'}</button></div>
      </div><div class="spp-details ${open?'open':''}">${group.sourceDocument?'<div class="spp-source-note">Source: '+esc(group.sourceDocument)+(group.due?' · Due '+formatDate(group.due):'')+'</div>':''}<div class="table-wrap"><table class="data" style="min-width:1050px"><thead><tr><th></th><th>#</th><th>Product / Printing Line</th><th>Source Note</th><th class="num">Qty</th><th class="num">Unit Cost</th><th class="num">Line Total</th><th class="num">Paid</th><th class="num">Balance</th><th>Due</th><th>Status</th></tr></thead><tbody>${group.rows.map((p,i)=>lineHtml(p,i)).join('')}</tbody></table></div></div></section>`;
  }

  function lineHtml(pay,index){
    const canSelect=balance(pay)>0.004;
    return `<tr><td><input class="spp-check spp-line-check" data-id="${esc(pay.id)}" type="checkbox" ${UI.selected.has(pay.id)?'checked':''} ${canSelect?'':'disabled'}></td><td>${Number(pay.batchLineNumber)||index+1}</td><td><b>${esc(pay.productName||'—')}</b><div class="spp-meta">${esc(pay.client||pay.sourceType||'')}</div></td><td>${esc(pay.sourceNotes||pay.remarks||'—')}</td><td class="num">${number(pay.qtyToPurchase||pay.qtyOrdered)}</td><td class="num">${money(pay.supplierUnitCost)}</td><td class="num">${money(pay.totalSupplierCost)}</td><td class="num">${money(pay.amountPaid)}</td><td class="num"><b>${money(balance(pay))}</b></td><td>${formatDate(pay.paymentDueDate)}</td><td>${badge(status(pay))}</td></tr>`;
  }

  function wireGroups(E,container,classicRender,groups){
    const byKey=new Map(groups.map(g=>[g.key,g]));
    container.querySelectorAll('.spp-batch').forEach(section=>{
      const key=section.dataset.groupKey;
      const group=byKey.get(key);
      const toggleGroup=()=>{
        const ids=group.rows.filter(p=>balance(p)>0.004).map(p=>p.id);
        const all=ids.length&&ids.every(id=>UI.selected.has(id));
        ids.forEach(id=>all?UI.selected.delete(id):UI.selected.add(id));
        draw(E,container,classicRender);
      };
      section.querySelector('.spp-toggle').onclick=()=>{UI.open.has(key)?UI.open.delete(key):UI.open.add(key);draw(E,container,classicRender);};
      section.querySelector('.spp-select-batch').onclick=toggleGroup;
      const groupCheck=section.querySelector('.spp-group-check');
      groupCheck.onchange=toggleGroup;
      section.querySelectorAll('.spp-line-check').forEach(check=>check.onchange=()=>{check.checked?UI.selected.add(check.dataset.id):UI.selected.delete(check.dataset.id);renderPayment(E,container,classicRender);syncGroupChecks(container,groups);});
      const header=section.querySelector('[data-longpress-group]');
      let timer=null,longPressed=false;
      const cancel=()=>{if(timer){clearTimeout(timer);timer=null;}header.classList.remove('longpress');};
      header.addEventListener('pointerdown',event=>{if(event.target.closest('button,input'))return;longPressed=false;header.classList.add('longpress');timer=setTimeout(()=>{timer=null;longPressed=true;header.classList.remove('longpress');toggleGroup();if(navigator.vibrate)navigator.vibrate(30);},600);});
      ['pointerup','pointercancel','pointerleave'].forEach(name=>header.addEventListener(name,cancel));
      header.addEventListener('click',event=>{if(longPressed){event.preventDefault();event.stopPropagation();longPressed=false;}});
    });
  }

  function syncGroupChecks(container,groups){
    groups.forEach(group=>{
      const section=Array.from(container.querySelectorAll('.spp-batch')).find(node=>node.dataset.groupKey===group.key);
      if(!section)return;
      const ids=group.rows.filter(p=>balance(p)>0.004).map(p=>p.id);
      const count=ids.filter(id=>UI.selected.has(id)).length;
      const check=section.querySelector('.spp-group-check');
      check.checked=ids.length>0&&count===ids.length;
      check.indeterminate=count>0&&count<ids.length;
      section.querySelector('.spp-select-batch').textContent=check.checked?'Unselect':'Select Batch';
    });
  }

  function renderPayment(E,container,classicRender){
    const slot=container.querySelector('#spp-payment-slot');
    if(!slot)return;
    const selected=Array.from(UI.selected).map(id=>(E.state.payables||[]).find(p=>p.id===id)).filter(p=>p&&balance(p)>0.004);
    if(!selected.length){slot.innerHTML='';return;}
    const suppliers=Array.from(new Set(selected.map(p=>p.supplierName||'Supplier')));
    const total=selected.reduce((sum,p)=>sum+balance(p),0);
    const settings=E.state.settings||{};
    const methods=settings.paymentMethods&&settings.paymentMethods.length?settings.paymentMethods:['Bank Transfer','Cash'];
    const accounts=settings.cashAccounts&&settings.cashAccounts.length?settings.cashAccounts:['Cash on Hand'];
    slot.innerHTML=`<div class="card spp-payment"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap"><div><h3 style="margin:0 0 3px">Pay Selected Supplier Lines</h3><div class="spp-help">${selected.length} line${selected.length===1?'':'s'} selected · ${suppliers.map(esc).join(', ')} · selected balance <b>${money(total)}</b></div></div><button class="btn small" id="spp-clear-selection">Clear Selection</button></div><div class="spp-payment-grid" style="margin-top:12px"><div class="spp-field"><label>Payment Date</label><input id="spp-pay-date" type="date" value="${today()}"></div><div class="spp-field"><label>Amount</label><input id="spp-pay-amount" type="number" min="0.01" step="0.01" value="${total.toFixed(2)}"></div><div class="spp-field"><label>Method</label><select id="spp-pay-method">${methods.map(v=>'<option>'+esc(v)+'</option>').join('')}</select></div><div class="spp-field"><label>Paid From</label><select id="spp-pay-account">${accounts.map(v=>'<option>'+esc(v)+'</option>').join('')}</select></div><div class="spp-field"><label>Reference</label><input id="spp-pay-ref" placeholder="Bank / receipt reference"></div><div class="spp-field full-mobile"><label>Remarks</label><input id="spp-pay-remarks" placeholder="Optional payment note"></div></div><div class="actions" style="margin-top:12px"><button class="btn primary" id="spp-save-payment">Save Payment & Post to Finance</button></div></div>`;
    slot.querySelector('#spp-clear-selection').onclick=()=>{UI.selected.clear();draw(E,container,classicRender);};
    slot.querySelector('#spp-save-payment').onclick=()=>savePayment(E,container,classicRender,selected,total);
  }

  async function savePayment(E,container,classicRender,selected,total){
    const suppliers=Array.from(new Set(selected.map(p=>p.supplierName||'Supplier')));
    if(suppliers.length!==1){E.toast('Select payable lines from one supplier only');return;}
    const amount=Number(container.querySelector('#spp-pay-amount').value)||0;
    if(amount<=0){E.toast('Enter an amount greater than zero');return;}
    if(amount>total+0.004){E.toast('Payment cannot exceed the selected balance');return;}
    const button=container.querySelector('#spp-save-payment');
    button.disabled=true;button.textContent='Saving payment…';
    try{
      let remaining=amount;
      const applied=[];
      const ordered=selected.slice().sort((a,b)=>String(a.paymentDueDate||'9999').localeCompare(String(b.paymentDueDate||'9999'))||String(a.batchLineNumber||0).localeCompare(String(b.batchLineNumber||0)));
      for(const pay of ordered){
        if(remaining<=0.004)break;
        const appliedAmount=Math.min(remaining,balance(pay));
        if(appliedAmount<=0)continue;
        pay.amountPaid=(Number(pay.amountPaid)||0)+appliedAmount;
        if(E.recomputePayableTotals)E.recomputePayableTotals(pay);
        else{pay.remainingBalance=Math.max(0,(Number(pay.totalSupplierCost)||0)-pay.amountPaid);pay.paymentStatus=pay.remainingBalance<=.004?'Fully Paid':'Partially Paid';}
        if(E.pushPayableAudit)E.pushPayableAudit(pay,`Bulk supplier payment applied — ${money(appliedAmount)}`);
        await E.storageSet('payable:'+pay.id,pay);
        applied.push({payableId:pay.id,quotationNumber:pay.referenceNumber||pay.quotationNumber||'',product:pay.productName||'',amount:appliedAmount});
        remaining-=appliedAmount;
      }
      const paymentDate=container.querySelector('#spp-pay-date').value||today();
      const reference=container.querySelector('#spp-pay-ref').value.trim();
      const remarks=container.querySelector('#spp-pay-remarks').value.trim();
      const payment={id:E.uid('sp'),supplier:suppliers[0],supplierCategory:category(selected[0]),paymentDate,batch:'Bulk Selected Lines',amountPaid:amount-remaining,method:container.querySelector('#spp-pay-method').value,account:container.querySelector('#spp-pay-account').value,referenceNumber:reference,relatedPayables:applied,remarks,createdAt:new Date().toISOString()};
      E.state.supplierPayments.unshift(payment);
      await E.storageSet('supplierPayment:'+payment.id,payment);
      const ledger=await E.createLedgerEntry({date:paymentDate,transactionType:'Supplier Payment',source:'Supplier Payables — Bulk Selection',referenceNumber:reference,clientOrSupplier:suppliers[0],account:payment.account,cashIn:0,cashOut:payment.amountPaid,remarks:remarks||`Payment to ${suppliers[0]} for ${applied.length} selected payable line${applied.length===1?'':'s'}`});
      payment.ledgerEntryId=ledger.id;
      await E.storageSet('supplierPayment:'+payment.id,payment);
      UI.selected.clear();
      E.toast(`Payment saved — ${money(payment.amountPaid)} posted to Finance once`);
      await renderPage(E,container,classicRender);
    }catch(err){
      console.error('Bulk supplier payment failed',err);
      E.toast('Payment could not be saved. No duplicate Finance entry was created.');
      button.disabled=false;button.textContent='Save Payment & Post to Finance';
    }
  }

  waitForApp();
})();
