(function(){
'use strict';
let tries=0;

function boot(){
  const E=window.__ecohub;
  if(!E||!E.state||!E.renderInventory||!E.availableStock||!E.productCostPerPiece){
    if(++tries<180)setTimeout(boot,120);
    return;
  }
  if(window.__ecohubInventoryCategoryFoldersV1)return;
  window.__ecohubInventoryCategoryFoldersV1=true;

  const S=E.state;
  const openGroups=new Set(['__uncategorized__']);
  const norm=v=>String(v==null?'':v).trim().toLocaleLowerCase();
  const esc=v=>E.escapeHtml?E.escapeHtml(v):String(v==null?'':v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const peso=v=>E.peso?E.peso(Number(v)||0):'₱'+(Number(v)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
  const folderKey=p=>String(p?.category||'').trim()||'__uncategorized__';
  const folderLabel=key=>key==='__uncategorized__'?'New / Uncategorized Products':key;

  function productForRow(row){
    return (S.products||[]).find(p=>String(p?.code)===String(row?.dataset?.code));
  }

  function totals(items){
    return items.reduce((sum,{p})=>{
      const inv=S.inventory?.[p.code]||{};
      const available=Number(E.availableStock(inv))||0;
      sum.available+=available;
      sum.value+=available*(Number(E.productCostPerPiece(p))||0);
      return sum;
    },{available:0,value:0});
  }

  function groupRows(container){
    const body=container.querySelector('#i-body');
    if(!body)return;
    const rows=[...body.querySelectorAll('tr[data-code]')];
    if(!rows.length)return;

    body.querySelectorAll('[data-inventory-folder]').forEach(row=>row.remove());
    const groups=new Map();
    rows.forEach(row=>{
      const p=productForRow(row);
      if(!p)return;
      const key=folderKey(p);
      if(!groups.has(key))groups.set(key,{key,label:folderLabel(key),items:[]});
      groups.get(key).items.push({row,p});
    });

    const ordered=[...groups.values()].sort((a,b)=>{
      if(a.key==='__uncategorized__')return -1;
      if(b.key==='__uncategorized__')return 1;
      return a.label.localeCompare(b.label,undefined,{sensitivity:'base',numeric:true});
    });
    const frag=document.createDocumentFragment();
    ordered.forEach(group=>{
      group.items.sort((a,b)=>String(a.p?.name||a.p?.code||'').localeCompare(String(b.p?.name||b.p?.code||''),undefined,{sensitivity:'base',numeric:true}));
      const isOpen=openGroups.has(group.key),sum=totals(group.items);
      const header=document.createElement('tr');
      header.dataset.inventoryFolder=group.key;
      header.style.cssText='background:var(--sage-light,#eef2e9);cursor:pointer';
      header.innerHTML='<td colspan="13" style="padding:11px 13px"><button type="button" class="btn small" data-inventory-folder-toggle style="margin-right:9px">'+(isOpen?'▾':'▸')+'</button><b>'+esc(group.label)+'</b><span style="margin-left:8px;color:var(--ink-soft);font-size:11.5px">'+group.items.length+' product'+(group.items.length===1?'':'s')+' · '+sum.available.toLocaleString()+' available · '+peso(sum.value)+'</span></td>';
      const toggle=()=>{
        openGroups.has(group.key)?openGroups.delete(group.key):openGroups.add(group.key);
        groupRows(container);
      };
      header.addEventListener('click',toggle);
      header.querySelector('[data-inventory-folder-toggle]').addEventListener('click',event=>{event.stopPropagation();toggle();});
      frag.appendChild(header);
      group.items.forEach(({row})=>{row.style.display=isOpen?'table-row':'none';frag.appendChild(row);});
    });
    body.appendChild(frag);
  }

  function setAll(container,open){
    openGroups.clear();
    if(open)(S.products||[]).forEach(p=>openGroups.add(folderKey(p)));
    else openGroups.add('__uncategorized__');
    groupRows(container);
  }

  function enhance(container){
    if(!container)return;
    const topbar=container.querySelector('.topbar');
    if(topbar&&!topbar.querySelector('[data-inventory-category-actions]')){
      let actions=topbar.querySelector('.actions');
      if(!actions){actions=document.createElement('div');actions.className='actions';topbar.appendChild(actions);}
      const controls=document.createElement('div');
      controls.dataset.inventoryCategoryActions='1';
      controls.style.cssText='display:flex;gap:7px;flex-wrap:wrap';
      controls.innerHTML='<button type="button" class="btn" data-inventory-expand>Expand All Categories</button><button type="button" class="btn" data-inventory-collapse>Collapse All Categories</button>';
      actions.appendChild(controls);
      controls.querySelector('[data-inventory-expand]').addEventListener('click',()=>setAll(container,true));
      controls.querySelector('[data-inventory-collapse]').addEventListener('click',()=>setAll(container,false));
    }

    const inventoryCard=container.querySelector('#i-body')?.closest('.card');
    if(inventoryCard&&!inventoryCard.querySelector('[data-inventory-category-note]')){
      const note=document.createElement('p');
      note.dataset.inventoryCategoryNote='1';
      note.style.cssText='color:var(--ink-soft);font-size:12px;margin:0 2px 12px';
      note.textContent='Products are grouped using the same categories saved in Product Costing. Click a category to open or close it.';
      inventoryCard.insertBefore(note,inventoryCard.querySelector('.table-wrap'));
    }

    const body=container.querySelector('#i-body');
    if(body&&!body.dataset.inventoryCategoryBound){
      body.dataset.inventoryCategoryBound='1';
      let scheduled=false;
      body.addEventListener('input',()=>{
        if(scheduled)return;
        scheduled=true;
        requestAnimationFrame(()=>{scheduled=false;groupRows(container);});
      });
    }
    groupRows(container);
  }

  const baseRender=E.renderInventory;
  E.renderInventory=function(container){
    const result=baseRender(container);
    enhance(container);
    return result;
  };
  console.log('Inventory category folders v1 installed');
}

boot();
})();
