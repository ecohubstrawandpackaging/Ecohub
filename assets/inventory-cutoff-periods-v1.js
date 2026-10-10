(function(){
'use strict';
let tries=0,loading=false,loaded=false;

function boot(){
  const E=window.__ecohub;
  if(!E||!E.state||!E.renderInventory||!E.availableStock||!E.storageSet||!E.storageGet||!E.storageListKeys){
    if(++tries<180)setTimeout(boot,120);
    return;
  }
  if(window.__ecohubInventoryCutoffPeriodsV1)return;
  window.__ecohubInventoryCutoffPeriodsV1=true;

  const S=E.state;
  const periods=new Map();
  let selectedId='',checkOpen=false,draftCounts={};
  const today=()=>E.todayISO?E.todayISO():new Date().toISOString().slice(0,10);
  const esc=v=>E.escapeHtml?E.escapeHtml(v):String(v==null?'':v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const peso=v=>E.peso?E.peso(Number(v)||0):'₱'+(Number(v)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const uid=p=>E.uid?E.uid(p):p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  const clone=v=>JSON.parse(JSON.stringify(v));

  function periodId(date=today()){
    const month=String(date).slice(0,7),day=Number(String(date).slice(8,10))||1;
    return month+(day<=15?'-H1':'-H2');
  }
  function parseId(id){
    const match=String(id||'').match(/^(\d{4})-(\d{2})-H([12])$/);
    if(!match)return null;
    const year=Number(match[1]),month=Number(match[2]),half=Number(match[3]);
    const last=new Date(year,month,0).getDate();
    return{year,month,half,start:`${match[1]}-${match[2]}-${half===1?'01':'16'}`,end:`${match[1]}-${match[2]}-${half===1?'15':String(last).padStart(2,'0')}`};
  }
  function nextId(id){
    const p=parseId(id);if(!p)return periodId();
    if(p.half===1)return `${p.year}-${String(p.month).padStart(2,'0')}-H2`;
    const d=new Date(p.year,p.month,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-H1`;
  }
  function label(id){
    const p=parseId(id);if(!p)return id;
    const month=new Date(p.year,p.month-1,1).toLocaleDateString('en-PH',{month:'long',year:'numeric'});
    return `${month} · ${p.half===1?'1–15':`16–${p.end.slice(8,10)}`}`;
  }
  function availableFor(code){return Number(E.availableStock(S.inventory?.[code]||{}))||0;}
  function valueFor(code,qty){const p=(S.products||[]).find(x=>x?.code===code);return (Number(qty)||0)*(p?Number(E.productCostPerPiece(p))||0:0);}
  function openingFromCurrent(){
    const out={};
    (S.products||[]).forEach(p=>{out[p.code]=Number(S.inventory?.[p.code]?.beginningStock)||0;});
    return out;
  }
  function makePeriod(id,beginning,sourcePeriod=''){
    const p=parseId(id);
    return{id,month:id.slice(0,7),half:p?.half||1,startDate:p?.start||today(),endDate:p?.end||today(),status:'Open',sourcePeriod,beginningByProduct:{...(beginning||{})},physicalCountByProduct:{},systemEndingByProduct:{},endingByProduct:{},createdAt:new Date().toISOString(),checkedAt:'',closedAt:''};
  }
  function activeId(){return String(S.settings?.inventoryActivePeriod||'').trim()||periodId();}

  async function ensureLoaded(){
    if(loaded||loading)return;
    loading=true;
    try{
      const keys=await E.storageListKeys('inventoryperiod:');
      const values=await Promise.all(keys.map(k=>E.storageGet(k)));
      values.filter(Boolean).forEach(p=>periods.set(p.id,p));
      let id=activeId(),period=periods.get(id);
      if(period?.status==='Closed'){id=nextId(id);period=periods.get(id);}
      if(!period){
        const previous=[...periods.values()].filter(p=>p.status==='Closed'&&p.id<id).sort((a,b)=>b.id.localeCompare(a.id))[0];
        period=makePeriod(id,previous?.endingByProduct||openingFromCurrent(),previous?.id||'');
        periods.set(id,period);await E.storageSet('inventoryperiod:'+id,period);
      }
      S.settings.inventoryActivePeriod=id;
      await E.storageSet('settings:main',S.settings);
      selectedId=selectedId||id;loaded=true;
    }catch(error){console.error('Could not load inventory cut-off periods',error);}
    finally{loading=false;}
  }

  function totals(period){
    const ending=period.status==='Closed'?period.endingByProduct:Object.fromEntries((S.products||[]).map(p=>[p.code,availableFor(p.code)]));
    const count=period.physicalCountByProduct||{};
    const beginQty=Object.values(period.beginningByProduct||{}).reduce((s,n)=>s+(Number(n)||0),0);
    const endingQty=Object.values(ending||{}).reduce((s,n)=>s+(Number(n)||0),0);
    const countQty=Object.keys(count).length?Object.values(count).reduce((s,n)=>s+(Number(n)||0),0):null;
    const endingValue=Object.entries(ending||{}).reduce((s,[code,n])=>s+valueFor(code,n),0);
    return{beginQty,endingQty,countQty,endingValue};
  }

  function renderPanel(container){
    let host=container.querySelector('[data-inventory-cutoff-v1]');
    if(!host){
      host=document.createElement('section');host.className='card';host.dataset.inventoryCutoffV1='1';
      const firstCard=container.querySelector('.card');
      firstCard?.insertAdjacentElement('beforebegin',host);
    }
    if(!loaded){host.innerHTML='<h3>Semi-Monthly Inventory Check</h3><div class="empty-state">Loading inventory periods…</div>';return;}
    const active=activeId(),period=periods.get(selectedId)||periods.get(active),sum=totals(period),isActive=period.id===active&&period.status==='Open';
    const options=[...new Set([...periods.keys(),active])].sort((a,b)=>b.localeCompare(a));
    host.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap"><div><h3 style="margin:0">Semi-Monthly Inventory Check</h3><p style="margin:5px 0 0;color:var(--ink-soft);font-size:12px">Two cut-offs per month: days 1–15 and days 16–month end. A finalized ending count becomes the next period's beginning inventory.</p></div><div class="actions"><button class="btn primary" type="button" data-open-inventory-check ${isActive?'':'disabled'}>${Object.keys(period.physicalCountByProduct||{}).length?'Update Physical Count':'Run Physical Count'}</button></div></div>
      <div style="display:grid;grid-template-columns:minmax(220px,1.4fr) repeat(4,minmax(130px,1fr));gap:10px;margin-top:14px;align-items:end">
        <div class="field"><label>Inventory Period</label><select data-inventory-period>${options.map(id=>`<option value="${esc(id)}" ${id===period.id?'selected':''}>${esc(label(id))}${id===active?' · ACTIVE':''}</option>`).join('')}</select></div>
        <div class="kpi"><div class="lbl">Status</div><div class="val" style="font-family:inherit;font-size:17px">${esc(period.status)}</div></div>
        <div class="kpi"><div class="lbl">Beginning Qty</div><div class="val">${sum.beginQty.toLocaleString()}</div></div>
        <div class="kpi"><div class="lbl">${period.status==='Closed'?'Ending':'System Available'}</div><div class="val">${sum.endingQty.toLocaleString()}</div></div>
        <div class="kpi"><div class="lbl">Inventory Value</div><div class="val">${peso(sum.endingValue)}</div></div>
      </div>
      <div style="margin-top:10px;font-size:11.5px;color:var(--ink-soft)"><b>Cut-off dates:</b> ${esc(period.startDate)} to ${esc(period.endDate)}${period.checkedAt?' · Last count: '+esc(String(period.checkedAt).slice(0,10)):''}${period.closedAt?' · Finalized: '+esc(String(period.closedAt).slice(0,10)):''}</div>
      <div data-inventory-check-workspace></div>`;
    host.querySelector('[data-inventory-period]').addEventListener('change',event=>{selectedId=event.target.value;checkOpen=false;renderPanel(container);});
    host.querySelector('[data-open-inventory-check]')?.addEventListener('click',()=>{checkOpen=!checkOpen;if(checkOpen)prepareDraft(period);renderChecklist(container,period);});
    if(checkOpen&&isActive){prepareDraft(period);renderChecklist(container,period);}
  }

  function prepareDraft(period){
    const saved=period.physicalCountByProduct||{};
    draftCounts={};
    (S.products||[]).forEach(p=>{draftCounts[p.code]=Object.prototype.hasOwnProperty.call(saved,p.code)?Number(saved[p.code])||0:availableFor(p.code);});
  }

  function renderChecklist(container,period){
    const workspace=container.querySelector('[data-inventory-check-workspace]');if(!workspace)return;
    if(!checkOpen){workspace.innerHTML='';return;}
    const products=(S.products||[]).slice().sort((a,b)=>String(a.category||'Uncategorized').localeCompare(String(b.category||'Uncategorized'),undefined,{sensitivity:'base'})||String(a.name||a.code).localeCompare(String(b.name||b.code),undefined,{sensitivity:'base',numeric:true}));
    let lastCategory='';
    const rows=products.map(p=>{
      const category=String(p.category||'').trim()||'New / Uncategorized Products',system=availableFor(p.code),physical=Number(draftCounts[p.code])||0,variance=physical-system;
      const heading=category!==lastCategory?`<tr style="background:var(--sage-light,#eef2e9)"><td colspan="5"><b>${esc(category)}</b></td></tr>`:'';lastCategory=category;
      return heading+`<tr data-count-code="${esc(p.code)}"><td><b>${esc(p.code)}</b></td><td>${esc(p.name||p.code)}</td><td class="num">${system.toLocaleString()}</td><td class="num"><input data-physical-count type="number" min="0" step="1" value="${physical}" style="width:95px;text-align:right"></td><td class="num" data-count-variance style="font-weight:800;color:${variance?'#b42318':'inherit'}">${variance>0?'+':''}${variance.toLocaleString()}</td></tr>`;
    }).join('');
    workspace.innerHTML=`<div style="border-top:1px solid var(--line);margin-top:14px;padding-top:14px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><b>Physical Count — ${esc(label(period.id))}</b><div style="font-size:11.5px;color:var(--ink-soft);margin-top:3px">Enter the actual quantity counted. Variance compares physical count against the current system quantity.</div></div><div class="actions"><button class="btn" type="button" data-save-inventory-count>Save Count</button><button class="btn primary" type="button" data-close-inventory-period>Finalize &amp; Roll to Next Cut-off</button></div></div><div class="table-wrap" style="margin-top:12px;max-height:480px"><table class="data"><thead><tr><th>Code</th><th>Product</th><th class="num">System Qty</th><th class="num">Physical Qty</th><th class="num">Variance</th></tr></thead><tbody>${rows||'<tr><td colspan="5"><div class="empty-state">No products found.</div></td></tr>'}</tbody></table></div></div>`;
    workspace.querySelectorAll('[data-count-code]').forEach(row=>{
      const code=row.dataset.countCode,input=row.querySelector('[data-physical-count]'),variance=row.querySelector('[data-count-variance]');
      input.addEventListener('input',()=>{const physical=Math.max(0,Number(input.value)||0),diff=physical-availableFor(code);draftCounts[code]=physical;variance.textContent=(diff>0?'+':'')+diff.toLocaleString();variance.style.color=diff?'#b42318':'inherit';});
    });
    workspace.querySelector('[data-save-inventory-count]').addEventListener('click',()=>saveCount(container,period,false));
    workspace.querySelector('[data-close-inventory-period]').addEventListener('click',()=>saveCount(container,period,true));
  }

  async function saveCount(container,period,close){
    for(const p of(S.products||[]))if(!Number.isFinite(Number(draftCounts[p.code]))||Number(draftCounts[p.code])<0){E.toast?.('Please enter a valid physical count for every product');return;}
    period.physicalCountByProduct={...draftCounts};
    period.systemEndingByProduct=Object.fromEntries((S.products||[]).map(p=>[p.code,availableFor(p.code)]));
    period.checkedAt=new Date().toISOString();period.checkDate=today();
    if(!close){await E.storageSet('inventoryperiod:'+period.id,period);periods.set(period.id,period);E.toast?.('Physical inventory count saved');renderPanel(container);return;}
    if(!confirm(`Finalize ${label(period.id)}? Its physical ending count will become the beginning inventory of ${label(nextId(period.id))}. Stock In, Stock Out, Returns, Reserved and Damaged will reset for the new cut-off.`))return;

    const button=container.querySelector('[data-close-inventory-period]');if(button)button.disabled=true;
    try{
      const archive={id:uid('invarchive'),type:'Inventory Cut-off Backup',periodId:period.id,archivedAt:new Date().toISOString(),inventory:clone(S.inventory||{}),period:clone(period)};
      await E.storageSet('auditArchive:inventory-cutoff-'+period.id+'-'+Date.now(),archive);
      period.endingByProduct={...draftCounts};period.status='Closed';period.closedAt=new Date().toISOString();
      await E.storageSet('inventoryperiod:'+period.id,period);periods.set(period.id,period);

      const nid=nextId(period.id),next=periods.get(nid)||makePeriod(nid,period.endingByProduct,period.id);
      next.beginningByProduct={...period.endingByProduct};next.sourcePeriod=period.id;next.status='Open';
      await E.storageSet('inventoryperiod:'+nid,next);periods.set(nid,next);

      for(const p of(S.products||[])){
        const code=p.code,inv=S.inventory[code]||(S.inventory[code]={code,beginningStock:0,stockIn:0,returns:0,stockOut:0,reserved:0,damaged:0,reorderLevel:100,movements:[]});
        const previous=availableFor(code),ending=Math.max(0,Number(period.endingByProduct[code])||0),difference=ending-previous;
        inv.beginningStock=ending;inv.stockIn=0;inv.returns=0;inv.stockOut=0;inv.reserved=0;inv.damaged=0;
        if(E.recordInventoryMovement)E.recordInventoryMovement(inv,{productCode:code,productName:p.name||code,previousQuantity:previous,quantityChanged:difference,newQuantity:ending,type:'Inventory Cut-off Rollover',remarks:`${label(period.id)} finalized; beginning for ${label(nid)}`});
        await E.storageSet('inventory:'+code,inv);
      }
      S.settings.inventoryActivePeriod=nid;await E.storageSet('settings:main',S.settings);
      selectedId=nid;checkOpen=false;E.toast?.(`Inventory rolled forward to ${label(nid)}`);E.renderInventory(container);
    }catch(error){console.error('Inventory cut-off finalization failed',error);E.toast?.('Could not finalize the inventory cut-off. The backup was preserved.');if(button)button.disabled=false;}
  }

  const baseRender=E.renderInventory;
  E.renderInventory=function(container){
    const result=baseRender(container);
    renderPanel(container);
    ensureLoaded().then(()=>renderPanel(container));
    return result;
  };
  ensureLoaded();
  console.log('Semi-monthly inventory cut-off periods v1 installed');
}

boot();
})();
