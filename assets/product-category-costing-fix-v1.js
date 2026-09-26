(function(){
'use strict';let tries=0;
function boot(){const E=window.__ecohub;if(!E||!E.renderProducts||!E.syncPayablesForQuotation){if(++tries<160)setTimeout(boot,100);return}if(window.__ecohubProductCategoryCostingFixV2)return;window.__ecohubProductCategoryCostingFixV1=true;window.__ecohubProductCategoryCostingFixV2=true;
const S=E.state,norm=v=>String(v||'').trim().toLocaleLowerCase(),openGroups=new Set(['__needs_costing__','__uncategorized__']);
const CORE_CATEGORIES=['Food Boxes','Paper Bags','Kraft Containers','Bagasse Container','Microwavable','Cutlery','Cups','Printed Cups','Print (Cups)','Lids','Straw','Packaging Tape','Others'];
function categories(current){const out=[],seen=new Set(),add=v=>{v=String(v||'').trim();const k=norm(v);if(!v||seen.has(k))return;seen.add(k);out.push(v)};CORE_CATEGORIES.forEach(add);(S.settings.categories||[]).forEach(add);(S.products||[]).forEach(p=>add(p?.category));(S.quotations||[]).forEach(q=>(q?.items||[]).forEach(item=>add(item?.category)));add(current);return out.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true}))}
async function syncMasterCategories(){const master=categories(),before=(S.settings.categories||[]).map(String),same=before.length===master.length&&before.every((v,i)=>v===master[i]);if(same)return;S.settings.categories=master;try{await E.storageSet('settings:main',S.settings)}catch(err){console.error('Could not synchronize Product Costing categories',err)}}
function enhanceRows(container){
  container.querySelectorAll('#p-body tr[data-code]').forEach(row=>{
    const p=(S.products||[]).find(x=>String(x?.code)===String(row.dataset.code)),select=row.querySelector('.c-cat');
    if(!p||!select)return;
    const current=String(p.category||'').trim(),existing=new Set([...select.options].map(o=>norm(o.value)));
    if(!existing.has('')){const o=document.createElement('option');o.value='';o.textContent='— Choose category —';select.insertBefore(o,select.firstChild);existing.add('')}
    categories(current).forEach(c=>{if(existing.has(norm(c)))return;const o=document.createElement('option');o.value=c;o.textContent=c;select.appendChild(o);existing.add(norm(c))});
    select.value=current;
    if(select.value!==current){const o=document.createElement('option');o.value=current;o.textContent=current||'— Choose category —';select.appendChild(o);select.value=current}
    select.title=current?'Saved category: '+current:'Choose a category; this product stays in New / Uncategorized until selected';
    if(!select.dataset.folderBound){select.dataset.folderBound='1';select.addEventListener('change',()=>setTimeout(()=>groupRows(container),0))}
  });
}
function needsCosting(p){return !String(p?.name||'').trim()||!(Number(p?.piecesPerBox)>0)||!(E.productCostPerPiece(p)>0)}
function folderKey(p){if(needsCosting(p))return '__needs_costing__';return String(p?.category||'').trim()||'__uncategorized__'}
function groupRows(container){
  const body=container.querySelector('#p-body');if(!body)return;
  const rows=[...body.querySelectorAll('tr[data-code]')];if(!rows.length)return;
  const signature=rows.map(row=>{const p=(S.products||[]).find(x=>String(x?.code)===String(row.dataset.code));return row.dataset.code+':'+folderKey(p)}).sort().join('|');
  if(body.dataset.folderSignature===signature&&body.querySelector('[data-product-folder]'))return;
  body.dataset.folderSignature=signature;
  body.querySelectorAll('[data-product-folder]').forEach(row=>row.remove());
  const groups=new Map();
  rows.forEach(row=>{const p=(S.products||[]).find(x=>String(x?.code)===String(row.dataset.code)),key=folderKey(p),label=key==='__needs_costing__'?'Needs Costing / Incomplete Products':key==='__uncategorized__'?'New / Uncategorized Products':String(p.category).trim();if(!groups.has(key))groups.set(key,{key,label,rows:[]});groups.get(key).rows.push({row,p})});
  const priority=key=>key==='__needs_costing__'?0:key==='__uncategorized__'?1:2;const ordered=[...groups.values()].sort((a,b)=>priority(a.key)-priority(b.key)||a.label.localeCompare(b.label,undefined,{sensitivity:'base',numeric:true}));
  const frag=document.createDocumentFragment();
  ordered.forEach(group=>{
    group.rows.sort((a,b)=>String(a.p?.name||a.p?.code||'').localeCompare(String(b.p?.name||b.p?.code||''),undefined,{sensitivity:'base',numeric:true}));
    const isOpen=openGroups.has(group.key);
    const header=document.createElement('tr');header.dataset.productFolder=group.key;header.style.cssText='background:var(--sage-light,#eef2e9);cursor:pointer';
    header.innerHTML='<td colspan="18" style="padding:11px 13px"><button type="button" class="btn small" data-folder-toggle style="margin-right:9px">'+(isOpen?'▾':'▸')+'</button><b>'+E.escapeHtml(group.label)+'</b><span style="margin-left:8px;color:var(--ink-soft);font-size:11.5px">'+group.rows.length+' product'+(group.rows.length===1?'':'s')+(group.key==='__needs_costing__'?' · enter a product name, pieces per box and costing to file these products':group.key==='__uncategorized__'?' · select a category to file these products':' · separate costing per item')+'</span></td>';
    header.querySelector('[data-folder-toggle]').onclick=event=>{event.stopPropagation();toggleFolder(container,group.key)};header.onclick=()=>toggleFolder(container,group.key);frag.appendChild(header);
    group.rows.forEach(({row})=>{row.style.display=isOpen?'table-row':'none';frag.appendChild(row)});
  });
  body.appendChild(frag);
}
function toggleFolder(container,key){openGroups.has(key)?openGroups.delete(key):openGroups.add(key);const body=container.querySelector('#p-body');if(body)delete body.dataset.folderSignature;groupRows(container)}
function setAllFolders(container,open){const body=container.querySelector('#p-body');if(!body)return;const keys=[...new Set((S.products||[]).map(p=>folderKey(p)))];openGroups.clear();if(open)keys.forEach(key=>openGroups.add(key));else{openGroups.add('__needs_costing__');openGroups.add('__uncategorized__')}delete body.dataset.folderSignature;groupRows(container)}
async function newProduct(E,container){let n=(S.products||[]).length+1,code='NEW-'+String(n).padStart(3,'0');while((S.products||[]).some(p=>p.code===code)){n++;code='NEW-'+String(n).padStart(3,'0')}const p={code,name:'New Product',category:'',unit:S.settings.units?.[0]||'Piece',piecesPerBox:1,supplierPrice:0,shipping:0,handling:0,printing:0,packaging:0,other:0,sellingPrice:0,status:'Active',supplier:S.settings.suppliers?.[0]||'',directSupplierOrder:false};S.products.push(p);openGroups.add('__uncategorized__');try{await E.storageSet('product:'+code,p);E.renderProducts(container)}catch(err){S.products=S.products.filter(x=>x!==p);console.error('Could not add product',err);E.toast('Could not add the product. Please try again.')}}
function enhance(container){
  if(!container)return;
  const add=container.querySelector('#p-add-btn');
  if(add&&!add.dataset.uncategorizedAdd){const replacement=add.cloneNode(true);replacement.dataset.uncategorizedAdd='1';add.replaceWith(replacement);replacement.addEventListener('click',()=>newProduct(E,container))}
  const currentAdd=container.querySelector('#p-add-btn');
  if(currentAdd&&!container.querySelector('#p-add-category-btn')){
    const expand=document.createElement('button');expand.type='button';expand.id='p-expand-folders';expand.className='btn';expand.textContent='Expand All';expand.onclick=()=>setAllFolders(container,true);currentAdd.insertAdjacentElement('beforebegin',expand);
    const collapse=document.createElement('button');collapse.type='button';collapse.id='p-collapse-folders';collapse.className='btn';collapse.textContent='Collapse All';collapse.onclick=()=>setAllFolders(container,false);currentAdd.insertAdjacentElement('beforebegin',collapse);
    const b=document.createElement('button');b.type='button';b.id='p-add-category-btn';b.className='btn';b.textContent='+ Add Category';currentAdd.insertAdjacentElement('beforebegin',b);
    b.addEventListener('click',async()=>{const category=String(window.prompt('New product category name:','')||'').trim();if(!category)return;if(categories().some(x=>norm(x)===norm(category))){E.toast('That product category already exists');return}S.settings.categories=S.settings.categories||[];S.settings.categories.push(category);S.settings.categories.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base',numeric:true}));await E.storageSet('settings:main',S.settings);E.toast('Product category added: '+category);E.renderProducts(container)})
  }
  enhanceRows(container);groupRows(container);
  const body=container.querySelector('#p-body');if(body&&!body.dataset.categoryObserver){body.dataset.categoryObserver='1';new MutationObserver(()=>{enhanceRows(container);groupRows(container)}).observe(body,{childList:true});body.addEventListener('change',event=>{if(event.target.closest('tr[data-code]')){delete body.dataset.folderSignature;setTimeout(()=>groupRows(container),0)}})}
}
const baseRender=E.renderProducts;E.renderProducts=function(container){const result=baseRender(container);enhance(container);syncMasterCategories();return result};
const baseSync=E.syncPayablesForQuotation;E.syncPayablesForQuotation=async function(q){const result=await baseSync(q);for(const item of (q?.items||[])){if(!item?.code||!item.category)continue;const p=(S.products||[]).find(x=>x?.code===item.code);if(!p||String(p.category||'').trim())continue;p.category=String(item.category).trim();await E.storageSet('product:'+p.code,p)}return result};
}boot();
})();
