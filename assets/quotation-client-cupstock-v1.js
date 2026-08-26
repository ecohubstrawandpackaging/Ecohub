(function(){
  'use strict';
  let E=null;
  const draft=new Map();
  const SOURCE_STANDARD='Standard';
  const SOURCE_CUP='Client Cup Stock';

  const n=v=>Number(v)||0;
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
  const remaining=r=>Math.max(0,n(r&&r.quantityAdded)-n(r&&r.quantityReleased));
  const money=v=>'₱'+n(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const key=(qno,itemId)=>String(qno||'')+'::'+String(itemId||'');
  const today=()=>E&&E.todayISO?E.todayISO():new Date().toISOString().slice(0,10);

  function currentQNo(){
    const el=document.querySelector('#f-number');
    return el?String(el.value||'').trim():'';
  }
  function savedQuote(qno){return E&&E.state&&Array.isArray(E.state.quotations)?E.state.quotations.find(q=>q&&q.number===qno):null;}
  function savedItem(qno,itemId){const q=savedQuote(qno);return q&&Array.isArray(q.items)?q.items.find(it=>it&&it.id===itemId):null;}
  function clientNames(){
    const vals=[];
    const company=document.querySelector('#f-company'); if(company&&company.value) vals.push(company.value);
    const customer=document.querySelector('#f-customer'); if(customer&&customer.value) vals.push(customer.value);
    const q=savedQuote(currentQNo()); if(q){if(q.company)vals.push(q.company);if(q.customer)vals.push(q.customer);}
    return [...new Set(vals.map(norm).filter(Boolean))];
  }
  function rowProductCode(tr){const s=tr&&tr.querySelector('.c-product');return s?String(s.value||''):'';}
  function getChoice(qno,itemId){
    const k=key(qno,itemId);
    if(draft.has(k)) return draft.get(k);
    const it=savedItem(qno,itemId);
    return {source:(it&&it.stockSource===SOURCE_CUP)?SOURCE_CUP:SOURCE_STANDARD,cupStockId:(it&&it.cupStockId)||''};
  }
  function setChoice(qno,itemId,choice){draft.set(key(qno,itemId),choice);}
  function cupOptions(tr,qno,itemId){
    const names=clientNames();
    const productCode=rowProductCode(tr);
    const rows=(E.state.cupStock||[]).slice().sort((a,b)=>{
      const am=names.includes(norm(a.client))?1:0,bm=names.includes(norm(b.client))?1:0;
      if(am!==bm)return bm-am;
      const ap=productCode&&a.productCode===productCode?1:0,bp=productCode&&b.productCode===productCode?1:0;
      if(ap!==bp)return bp-ap;
      return remaining(b)-remaining(a);
    });
    const choice=getChoice(qno,itemId);
    let html='<option value="">— Select client cup stock —</option>';
    let matchGroup=false,otherGroup=false;
    for(const r of rows){
      const isMatch=names.length?names.includes(norm(r.client)):false;
      if(isMatch&&!matchGroup){html+='<optgroup label="Matching quotation client">';matchGroup=true;}
      if(!isMatch&&matchGroup&&!otherGroup){html+='</optgroup><optgroup label="Other client cup stocks">';otherGroup=true;}
      if(!names.length&&!otherGroup){html+='<optgroup label="All client cup stocks">';otherGroup=true;}
      const label=(r.client||'No client')+' — '+(r.cupDescription||r.productCode||'Cup Stock')+' — '+remaining(r).toLocaleString()+' pcs @ '+money(r.unitCost);
      html+='<option value="'+esc(r.id)+'" '+(r.id===choice.cupStockId?'selected':'')+'>'+esc(label)+'</option>';
    }
    if(matchGroup||otherGroup) html+='</optgroup>';
    return html;
  }
  function selectedRecord(id){return (E.state.cupStock||[]).find(r=>r&&r.id===id);}

  function renderPanel(tr,alloc,qno,itemId){
    const td=alloc.querySelector('td'); if(!td)return;
    let panel=td.querySelector('.ecohub-cup-source-panel');
    if(!panel){
      panel=document.createElement('div');
      panel.className='ecohub-cup-source-panel';
      panel.style.cssText='margin-top:9px;padding-top:9px;border-top:1px dashed var(--line);display:flex;gap:9px;align-items:center;flex-wrap:wrap;';
      td.appendChild(panel);
    }
    const choice=getChoice(qno,itemId);
    panel.innerHTML='<label style="font-size:11.5px;font-weight:700;color:var(--ink-soft)">Stock Source '
      +'<select class="ecohub-stock-source" style="margin-left:5px;padding:5px 7px;border:1px solid var(--line);border-radius:6px">'
      +'<option value="Standard" '+(choice.source!==SOURCE_CUP?'selected':'')+'>General Inventory / Supplier</option>'
      +'<option value="Client Cup Stock" '+(choice.source===SOURCE_CUP?'selected':'')+'>Client Cup Stock</option></select></label>'
      +'<span class="ecohub-cup-picker-wrap" style="display:'+(choice.source===SOURCE_CUP?'inline-flex':'none')+';gap:7px;align-items:center;flex-wrap:wrap">'
      +'<select class="ecohub-cupstock-picker" style="min-width:320px;max-width:100%;padding:5px 7px;border:1px solid var(--line);border-radius:6px">'+cupOptions(tr,qno,itemId)+'</select>'
      +'<span class="ecohub-cupstock-info" style="font-size:11px;color:var(--ink-soft)"></span></span>';

    const source=panel.querySelector('.ecohub-stock-source');
    const picker=panel.querySelector('.ecohub-cupstock-picker');
    const wrap=panel.querySelector('.ecohub-cup-picker-wrap');
    const info=panel.querySelector('.ecohub-cupstock-info');
    const fulfillment=tr.querySelector('.c-fulfillment');
    const qtyEl=tr.querySelector('.c-qty');
    function updateInfo(){
      const ch=getChoice(qno,itemId);
      if(fulfillment){fulfillment.disabled=ch.source===SOURCE_CUP;fulfillment.style.opacity=ch.source===SOURCE_CUP?'.45':'1';}
      if(ch.source!==SOURCE_CUP){if(info)info.textContent='';return;}
      const r=selectedRecord(ch.cupStockId);
      if(!r){if(info){info.textContent='Select the exact client cup stock record.';info.style.color='var(--orange,#9a681e)';}return;}
      const qty=n(qtyEl&&qtyEl.value),avail=remaining(r),same=clientNames().includes(norm(r.client));
      info.textContent=(same?'':'⚠ Other client · ')+'Available '+avail.toLocaleString()+' pcs · Cost '+money(r.unitCost)+(qty>avail?' · NOT ENOUGH STOCK':'');
      info.style.color=qty>avail?'var(--red,#9f312a)':same?'var(--ink-soft)':'var(--orange,#9a681e)';
    }
    source.onchange=()=>{
      const next={source:source.value===SOURCE_CUP?SOURCE_CUP:SOURCE_STANDARD,cupStockId:getChoice(qno,itemId).cupStockId||''};
      if(next.source===SOURCE_CUP&&!next.cupStockId){
        const names=clientNames(),code=rowProductCode(tr);
        const matches=(E.state.cupStock||[]).filter(r=>names.includes(norm(r.client)) && (!code||!r.productCode||r.productCode===code) && remaining(r)>0);
        if(matches.length===1) next.cupStockId=matches[0].id;
      }
      setChoice(qno,itemId,next); wrap.style.display=next.source===SOURCE_CUP?'inline-flex':'none';
      if(next.source===SOURCE_CUP){picker.innerHTML=cupOptions(tr,qno,itemId);picker.value=next.cupStockId||'';}
      updateInfo();
    };
    picker.onchange=()=>{setChoice(qno,itemId,{source:SOURCE_CUP,cupStockId:picker.value});updateInfo();};
    if(qtyEl) qtyEl.addEventListener('input',updateInfo);
    updateInfo();
  }

  function injectQuotationControls(){
    if(!E||!document.querySelector('#q-items-body')||!document.querySelector('#f-number'))return;
    const qno=currentQNo(); if(!qno)return;
    const body=document.querySelector('#q-items-body');
    body.querySelectorAll('tr[data-id]').forEach(tr=>{
      const itemId=tr.dataset.id; if(!itemId)return;
      const alloc=body.querySelector('tr[data-alloc-for="'+CSS.escape(itemId)+'"]');
      if(alloc)renderPanel(tr,alloc,qno,itemId);
    });
  }

  async function persistCupRecord(r){await E.storageSet('cupstock:'+r.id,r);}
  function addMovement(r,type,qty,note,q,balance){
    if(!Array.isArray(r.movements))r.movements=[];
    r.movements.unshift({id:E.uid?E.uid('mv'):'mv'+Date.now()+Math.random().toString(36).slice(2),date:today(),type,qty,note:note||'',quotationNumber:(q&&q.number)||'',releasedBy:'EcoHub Quotation',balanceAfter:balance});
  }
  async function reverseCupDeduction(q,it,reason){
    const qty=n(it&&it._cupStockDeductedQty),id=it&&it._cupStockDeductedId;
    if(qty<=0||!id)return;
    const r=selectedRecord(id);
    if(!r)throw new Error('Cannot reverse client cup stock: stock record '+id+' was not found.');
    r.quantityReleased=Math.max(0,n(r.quantityReleased)-qty);r.lastUpdated=today();
    const bal=remaining(r);addMovement(r,'Returned Items',qty,reason||('Auto reversal for '+q.number),q,bal);await persistCupRecord(r);
    it._cupStockDeductedQty=0;it._cupStockDeductedId='';
  }
  async function deductCupStock(q,it,r){
    const qty=n(it.qty),avail=remaining(r);
    if(qty<=0)return;
    if(qty>avail+0.0001)throw new Error((r.client||'Client')+' '+(r.cupDescription||'cup stock')+' has only '+avail.toLocaleString()+' pcs available; '+qty.toLocaleString()+' pcs is required for '+q.number+'.');
    r.quantityReleased=n(r.quantityReleased)+qty;r.lastUpdated=today();
    const bal=remaining(r);addMovement(r,'Stock Out',qty,'Auto release from completed quotation '+q.number,q,bal);await persistCupRecord(r);
    it._cupStockDeductedQty=qty;it._cupStockDeductedId=r.id;it._cupStockUnitCost=n(r.unitCost);it.cost=n(r.unitCost);
  }
  function syncChoicesIntoQuote(q){
    for(const it of (q.items||[])){
      const d=draft.get(key(q.number,it.id));
      if(d){it.stockSource=d.source;it.cupStockId=d.cupStockId||'';}
      if(it.stockSource===SOURCE_CUP){
        if(!it.cupStockId)throw new Error('Select a Client Cup Stock record for '+(it.description||it.name||'this quotation item')+'.');
        const r=selectedRecord(it.cupStockId);if(!r)throw new Error('Selected Client Cup Stock record was not found.');
        if(!(n(it._cupStockDeductedQty)>0&&it._cupStockDeductedId===r.id&&n(it._cupStockUnitCost)>0))it._cupStockUnitCost=n(r.unitCost);
        it.cost=n(it._cupStockUnitCost)||n(r.unitCost);
      }else{
        it.stockSource=SOURCE_STANDARD;it.cupStockId='';
        const p=(E.state.products||[]).find(x=>x.code===it.code);
        if(p&&!it.isService&&E.productCostPerPiece)it.cost=E.productCostPerPiece(p);
      }
    }
  }
  function setCupDisplayFields(it,r){
    it._resolvedSource=SOURCE_CUP;it._qtyFromInventory=0;it._qtyToPurchase=0;it._boxesToPurchase=0;it._supplierPurchaseQty=0;it._excessQty=0;
    it._inventoryStatus='Client Cup Stock — '+(r.client||'Client')+' — '+remaining(r).toLocaleString()+' pcs remaining';
  }

  function installLogic(){
    if(window.__ecohubQuotationCupStockV1||!E.syncPayablesForQuotation)return;
    window.__ecohubQuotationCupStockV1=true;
    const baseSync=E.syncPayablesForQuotation;
    E.syncPayablesForQuotation=async function(q){
      syncChoicesIntoQuote(q);
      const cupItems=(q.items||[]).filter(it=>it.stockSource===SOURCE_CUP);
      for(const it of (q.items||[])){
        const prevQty=n(it._cupStockDeductedQty),prevId=it._cupStockDeductedId||'';
        if(prevQty<=0)continue;
        const keep=q.orderStatus==='Completed'&&it.stockSource===SOURCE_CUP&&it.cupStockId===prevId&&Math.abs(n(it.qty)-prevQty)<0.0001;
        if(!keep)await reverseCupDeduction(q,it,'Auto reversal — quotation status/source/quantity changed');
      }
      const restore=cupItems.map(it=>({it,isService:!!it.isService}));
      cupItems.forEach(it=>{it.isService=true;});
      let result;
      try{result=await baseSync(q);}finally{restore.forEach(x=>{x.it.isService=x.isService;});}
      for(const it of cupItems){
        const r=selectedRecord(it.cupStockId);if(!r)throw new Error('Selected Client Cup Stock record was not found.');
        if(q.orderStatus==='Completed'&&n(it._cupStockDeductedQty)<=0)await deductCupStock(q,it,r);
        setCupDisplayFields(it,r);
      }
      return result;
    };

    if(E.releaseItemFulfillment){
      const baseRelease=E.releaseItemFulfillment;
      E.releaseItemFulfillment=async function(q,it){
        if(n(it&&it._cupStockDeductedQty)>0)await reverseCupDeduction(q,it,'Auto reversal — quotation line removed');
        draft.delete(key(q&&q.number,it&&it.id));
        return baseRelease(q,it);
      };
    }
    if(E.removePayablesForQuotation){
      const baseRemove=E.removePayablesForQuotation;
      E.removePayablesForQuotation=async function(number,q){
        if(q&&Array.isArray(q.items))for(const it of q.items){if(n(it&&it._cupStockDeductedQty)>0)await reverseCupDeduction(q,it,'Auto reversal — quotation deleted');}
        return baseRemove(number,q);
      };
    }
  }

  function boot(){
    E=window.__ecohub;
    if(!E){setTimeout(boot,150);return;}
    installLogic();
    injectQuotationControls();
    const mo=new MutationObserver(()=>{if(document.querySelector('#q-items-body'))injectQuotationControls();});
    mo.observe(document.documentElement,{childList:true,subtree:true});
    document.addEventListener('input',e=>{if(e.target&&['f-company','f-customer'].includes(e.target.id))setTimeout(injectQuotationControls,0);});
    document.addEventListener('change',e=>{if(e.target&&e.target.id==='f-client-id')setTimeout(injectQuotationControls,0);});
  }
  boot();
})();

(function(){
  if(document.querySelector('script[data-ecohub-finance-aug16]')) return;
  const s=document.createElement('script');
  s.dataset.ecohubFinanceAug16='1';
  s.src='assets/finance-reset-aug16-v1.js?v=20260826-1005';
  s.onerror=()=>console.error('Finance Aug 16 fix failed to load');
  document.head.appendChild(s);
})();
