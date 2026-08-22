(function(){'use strict';
const URL='https://fyvogvjvivxpqztbaoct.supabase.co';
const KEY='sb_publishable_gnvNDN1co5qB7tBBevXziQ_pbAoBc87';
const sb=window.supabase.createClient(URL,KEY);
const TODAY=new Date(); TODAY.setHours(0,0,0,0);
const SAFETY_DAYS=15, CRITICAL_DAYS=10, PLAN_SOON_DAYS=22;
const PACK_CATS=new Set(['Bagasse Container','Cutlery','Food Boxes','Kraft Containers','Microwavable','Paper Bags','Straw']);
let DATA={cupstocks:[],products:[],inventories:[],quotations:[]}, MODEL={cups:[],pack:[],clients:[],priority:[]};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const n=v=>Number(v)||0, norm=s=>String(s||'').trim().toLowerCase(), esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Math.round(n(v)).toLocaleString('en-PH');
const dt=s=>{if(!s)return null;const d=new Date(String(s).slice(0,10)+'T00:00:00');return isNaN(d)?null:d};
const iso=d=>d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:'—';
const days=(a,b)=>{const A=dt(a)||a,B=dt(b)||b;if(!(A instanceof Date)||!(B instanceof Date))return 0;return Math.round((B-A)/86400000)};
const addDays=(d,x)=>{const z=new Date(d);z.setDate(z.getDate()+Math.max(0,Math.floor(n(x))));return z};
const avg=a=>a.length?a.reduce((s,x)=>s+n(x),0)/a.length:0;
const roundUp=(q,step)=>{step=Math.max(1,n(step)||1);return Math.ceil(Math.max(0,n(q))/step)*step};
function status(stock,weekly,reorderLevel){
  stock=n(stock); weekly=n(weekly); reorderLevel=n(reorderLevel);
  if(stock<=0)return {key:'out',label:'Out of Stock',score:0,reason:'No available stock'};
  if(weekly<=0){if(reorderLevel>0&&stock<=reorderLevel)return {key:'reorder',label:'Reorder Now',score:2,reason:'At/below inventory reorder level'};return {key:'learning',label:'Learning',score:5,reason:'Need more repeat-order history'};}
  const cover=stock/(weekly/7);
  if(cover<=CRITICAL_DAYS)return {key:'critical',label:'Critical',score:1,reason:`Only ${cover.toFixed(1)} days of stock cover`};
  if(cover<=SAFETY_DAYS)return {key:'reorder',label:'Reorder Now',score:2,reason:`Inside ${SAFETY_DAYS}-day supplier safety window`};
  if(cover<=PLAN_SOON_DAYS)return {key:'soon',label:'Plan Soon',score:3,reason:'Approaching reorder window'};
  return {key:'healthy',label:'Healthy',score:4,reason:`About ${cover.toFixed(0)} days of stock cover`};
}
function pill(s){return `<span class="pill ${s.key}">${esc(s.label)}</span>`}
function groupCycles(movs){
  const outs=(movs||[]).filter(m=>String(m.type||'').toLowerCase()==='stock out'&&n(m.qty)>0&&dt(m.date)).map(m=>({date:String(m.date).slice(0,10),qty:n(m.qty)})).sort((a,b)=>a.date.localeCompare(b.date));
  const groups=[];
  for(const x of outs){const last=groups[groups.length-1];if(last&&days(last.lastDate,x.date)<=3){last.qty+=x.qty;last.lastDate=x.date}else groups.push({date:x.date,lastDate:x.date,qty:x.qty});}
  return groups;
}
function cycleStats(cycles){
  cycles=(cycles||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const gaps=[];for(let i=1;i<cycles.length;i++){const g=days(cycles[i-1].date,cycles[i].date);if(g>0)gaps.push(g)}
  const avgGap=avg(gaps), avgQty=avg(cycles.map(x=>x.qty));
  const autoWeekly=cycles.length>=2&&avgGap>0?(avgQty*7/avgGap):0;
  const opm=avgGap>0?30.44/avgGap:0;
  const last=cycles.length?cycles[cycles.length-1].date:'';
  return {count:cycles.length,avgGap,avgQty,autoWeekly,ordersPerMonth:opm,last,next:last&&avgGap?iso(addDays(dt(last),avgGap)):''};
}
function cupModel(rows){
  const map=new Map();
  for(const r of rows){const v=r.value||{};const key=[norm(v.client),norm(v.cupDescription),norm(v.cupSize),norm(v.cupType)].join('|');if(!map.has(key))map.set(key,{kind:'Printed Cups',client:v.client||'Unassigned',product:v.cupDescription||'Printed Cup',size:v.cupSize||'',type:v.cupType||'',stock:0,manualWeekly:0,reorderLevel:0,movs:[],unitCost:0});const g=map.get(key);g.stock+=Math.max(0,n(v.quantityAdded)-n(v.quantityReleased));g.manualWeekly=Math.max(g.manualWeekly,n(v.expectedWeeklyConsumption));g.reorderLevel+=n(v.reorderLevel);g.movs.push(...(Array.isArray(v.movements)?v.movements:[]));g.unitCost=Math.max(g.unitCost,n(v.unitCost));}
  return [...map.values()].map(g=>{const cs=cycleStats(groupCycles(g.movs));const weekly=g.manualWeekly>0?g.manualWeekly:cs.autoWeekly;const cover=weekly>0?g.stock/(weekly/7):null;const st=status(g.stock,weekly,g.reorderLevel);const orderBy=cover==null?'—':iso(addDays(TODAY,Math.max(0,cover-SAFETY_DAYS)));const suggested=roundUp(cs.avgQty>0?cs.avgQty:(weekly>0?weekly*4.345:g.reorderLevel||500),500);return {...g,...cs,weekly,cover,st,orderBy,suggested,source:g.manualWeekly>0?'Manual plan':(cs.count>=2?'Auto history':'Learning')};});
}
function completedQuotations(qs){return qs.map(x=>x.value||{}).filter(q=>q&&q.orderStatus==='Completed');}
function quotationDate(q){return q.completedDate||q.date||''}
function packageModel(products,invs,qs){
  const pMap=new Map(products.map(r=>[String((r.value||{}).code||r.key.split(':')[1]),r.value||{}]));
  const iMap=new Map(invs.map(r=>[String((r.value||{}).code||r.key.split(':')[1]),r.value||{}]));
  const hist=new Map();
  for(const q of completedQuotations(qs)){const date=quotationDate(q);const client=String(q.company||q.customer||'Unassigned').trim()||'Unassigned';for(const it of (Array.isArray(q.items)?q.items:[])){const code=String(it.code||'');const p=pMap.get(code);if(!p||!PACK_CATS.has(String(p.category||''))||n(it.qty)<=0)continue;if(!hist.has(code))hist.set(code,[]);hist.get(code).push({date,qty:n(it.qty),client,quotation:q.number||''});}}
  const out=[];
  for(const [code,p] of pMap){if(!PACK_CATS.has(String(p.category||'')))continue;const inv=iMap.get(code)||{};const stock=Math.max(0,n(inv.beginningStock)+n(inv.stockIn)+n(inv.returns)-n(inv.stockOut)-n(inv.damaged)-n(inv.reserved));const rows=(hist.get(code)||[]).filter(x=>dt(x.date)).sort((a,b)=>a.date.localeCompare(b.date));const byDate=new Map();for(const r of rows){if(!byDate.has(r.date))byDate.set(r.date,0);byDate.set(r.date,byDate.get(r.date)+r.qty)}const cycles=[...byDate].map(([date,qty])=>({date,qty}));const cs=cycleStats(cycles);let weekly=0;if(cycles.length>=2){const first=dt(cycles[0].date),last=dt(cycles[cycles.length-1].date);const span=Math.max(7,days(first,last)+7);weekly=cycles.reduce((s,x)=>s+x.qty,0)/(span/7)}const cover=weekly>0?stock/(weekly/7):null;const st=status(stock,weekly,n(inv.reorderLevel));const orderBy=cover==null?'—':iso(addDays(TODAY,Math.max(0,cover-SAFETY_DAYS)));const step=n(p.piecesPerBox)||1;const suggested=roundUp(cs.avgQty>0?cs.avgQty:(n(inv.reorderLevel)||step),step);const byClient={};for(const r of rows)byClient[r.client]=(byClient[r.client]||0)+r.qty;const topClients=Object.entries(byClient).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([c,q])=>`${c} (${fmt(q)})`).join(', ');out.push({kind:'Packaging',code,product:p.name||code,category:p.category||'',stock,reorderLevel:n(inv.reorderLevel),weekly,cover,st,orderBy,suggested,piecesPerBox:step,topClients,rows,...cs});}
  return out;
}
function clientConsumption(cups,pack){
  const out=[];
  for(const c of cups){const monthly=c.weekly>0?c.weekly*4.345:0;out.push({client:c.client,type:'Printed Cups',product:`${c.product}${c.size?' · '+c.size:''}`,cycles:c.count,avgQty:c.avgQty,avgGap:c.avgGap,ordersPerMonth:c.ordersPerMonth,monthly,last:c.last,next:c.next,confidence:c.manualWeekly>0?'Manual + history':(c.count>=3?'High':c.count>=2?'Medium':'Learning')});}
  for(const p of pack){const byClient=new Map();for(const r of p.rows||[]){if(!byClient.has(r.client))byClient.set(r.client,[]);byClient.get(r.client).push({date:r.date,qty:r.qty});}for(const [client,rows] of byClient){const byD=new Map();for(const r of rows)byD.set(r.date,(byD.get(r.date)||0)+r.qty);const cs=cycleStats([...byD].map(([date,qty])=>({date,qty})));let weekly=0;if(cs.count>=2&&cs.avgGap>0)weekly=cs.avgQty*7/cs.avgGap;out.push({client,type:'Packaging',product:p.product,cycles:cs.count,avgQty:cs.avgQty,avgGap:cs.avgGap,ordersPerMonth:cs.ordersPerMonth,monthly:weekly*4.345,last:cs.last,next:cs.next,confidence:cs.count>=3?'High':cs.count>=2?'Medium':'Learning'});}}
  return out.sort((a,b)=>(b.ordersPerMonth||0)-(a.ordersPerMonth||0)||a.client.localeCompare(b.client));
}
function build(){MODEL.cups=cupModel(DATA.cupstocks);MODEL.pack=packageModel(DATA.products,DATA.inventories,DATA.quotations);MODEL.clients=clientConsumption(MODEL.cups,MODEL.pack);MODEL.priority=[...MODEL.cups.map(x=>({...x,title:`${x.client} · ${x.product}`,usage:x.weekly})),...MODEL.pack.map(x=>({...x,title:x.product,usage:x.weekly}))].sort((a,b)=>a.st.score-b.st.score||(a.cover??9999)-(b.cover??9999));render();}
function needle(){return norm($('#search')&&$('#search').value)}
function match(...xs){const q=needle();return !q||xs.some(x=>norm(x).includes(q))}
function renderOverview(){const rows=MODEL.priority.filter(x=>match(x.title,x.kind,x.category,x.code)).filter(x=>x.st.key!=='healthy'||needle());const counts=MODEL.priority.reduce((a,x)=>{a[x.st.key]=(a[x.st.key]||0)+1;return a},{});$('#kRestock').textContent=(counts.out||0)+(counts.critical||0)+(counts.reorder||0);$('#kOut').textContent=counts.out||0;$('#kSoon').textContent=counts.soon||0;$('#kHealthy').textContent=counts.healthy||0;$('#kLearning').textContent=counts.learning||0;$('#priorityBody').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.kind)}</td><td><b>${esc(x.title)}</b>${x.kind==='Packaging'&&x.topClients?`<div class="mini">Top clients: ${esc(x.topClients)}</div>`:''}</td><td>${fmt(x.stock)} pcs</td><td>${x.usage>0?fmt(x.usage)+' / wk':'Learning'}</td><td>${x.cover==null?'—':x.cover.toFixed(1)+' d'}</td><td>${esc(x.orderBy)}</td><td>${fmt(x.suggested)} pcs</td><td>${pill(x.st)}</td><td>${esc(x.st.reason)}</td></tr>`).join(''):'<tr><td colspan="9"><div class="empty">No matching restock alerts.</div></td></tr>';}
function renderCups(){const rows=MODEL.cups.filter(x=>match(x.client,x.product,x.size,x.type)).sort((a,b)=>a.st.score-b.st.score||(a.cover??9999)-(b.cover??9999));$('#cupsCount').textContent=`${rows.length} client stock records`;$('#cupsBody').innerHTML=rows.length?rows.map(x=>`<tr><td><b>${esc(x.client)}</b></td><td>${esc(x.product)}${x.size?`<div class="mini">${esc(x.size)} ${esc(x.type)}</div>`:''}</td><td class="num ${x.stock<=0?'red':''}">${fmt(x.stock)}</td><td class="num">${x.manualWeekly>0?fmt(x.manualWeekly):'—'}</td><td class="num">${x.autoWeekly>0?fmt(x.autoWeekly):'—'}<div class="mini">${esc(x.source)}</div></td><td class="num">${x.avgQty>0?fmt(x.avgQty):'—'}</td><td class="num">${x.avgGap>0?x.avgGap.toFixed(1)+' d':'—'}</td><td class="num">${x.ordersPerMonth>0?x.ordersPerMonth.toFixed(1)+'×':'—'}</td><td class="num">${x.cover==null?'—':x.cover.toFixed(1)+' d'}</td><td>${esc(x.orderBy)}</td><td class="num"><b>${fmt(x.suggested)}</b></td><td>${pill(x.st)}<div class="mini">${esc(x.st.reason)}</div></td></tr>`).join(''):'<tr><td colspan="12"><div class="empty">No printed cup records match.</div></td></tr>';}
function renderPack(){const rows=MODEL.pack.filter(x=>match(x.product,x.category,x.code,x.topClients)).sort((a,b)=>a.st.score-b.st.score||(a.cover??9999)-(b.cover??9999));$('#packCount').textContent=`${rows.length} packaging products`;$('#packBody').innerHTML=rows.length?rows.map(x=>`<tr><td>${esc(x.code)}</td><td><b>${esc(x.product)}</b></td><td>${esc(x.category)}</td><td class="num ${x.stock<=x.reorderLevel?'amber':''}">${fmt(x.stock)}</td><td class="num">${fmt(x.reorderLevel)}</td><td class="num">${x.weekly>0?fmt(x.weekly):'Learning'}</td><td class="num">${x.cover==null?'—':x.cover.toFixed(1)+' d'}</td><td>${esc(x.topClients||'—')}</td><td>${esc(x.orderBy)}</td><td class="num"><b>${fmt(x.suggested)}</b>${x.piecesPerBox>1?`<div class="mini">Box size ${fmt(x.piecesPerBox)}</div>`:''}</td><td>${pill(x.st)}<div class="mini">${esc(x.st.reason)}</div></td></tr>`).join(''):'<tr><td colspan="11"><div class="empty">No packaging records match.</div></td></tr>';}
function renderClients(){const rows=MODEL.clients.filter(x=>match(x.client,x.type,x.product));$('#clientBody').innerHTML=rows.length?rows.map(x=>`<tr><td><b>${esc(x.client)}</b></td><td>${esc(x.type)}</td><td>${esc(x.product)}</td><td class="num">${x.cycles}</td><td class="num">${x.avgQty>0?fmt(x.avgQty):'—'}</td><td class="num">${x.avgGap>0?x.avgGap.toFixed(1)+' d':'—'}</td><td class="num">${x.ordersPerMonth>0?x.ordersPerMonth.toFixed(1)+'×':'—'}</td><td class="num">${x.monthly>0?fmt(x.monthly):'—'}</td><td>${esc(x.last||'—')}</td><td>${esc(x.next||'—')}</td><td>${x.confidence==='High'?'<span class="pill healthy">High</span>':x.confidence==='Medium'?'<span class="pill soon">Medium</span>':x.confidence.startsWith('Manual')?'<span class="pill healthy">Manual + history</span>':'<span class="pill learning">Learning</span>'}</td></tr>`).join(''):'<tr><td colspan="11"><div class="empty">No client consumption rows match.</div></td></tr>';}
function render(){renderOverview();renderCups();renderPack();renderClients();}
async function load(){try{$('#status').textContent='Refreshing inventory and quotation history…';const prefixes=['cupstock:%','product:%','inventory:%','quotation:%'];const res=await Promise.all(prefixes.map(p=>sb.from('ecohub_kv').select('key,value').like('key',p)));for(const r of res)if(r.error)throw r.error;DATA={cupstocks:res[0].data||[],products:res[1].data||[],inventories:res[2].data||[],quotations:res[3].data||[]};build();$('#status').textContent=`Updated ${new Date().toLocaleString('en-PH')} · ${DATA.cupstocks.length} cup-stock records · ${DATA.products.length} products · ${DATA.quotations.length} quotations`;}catch(e){console.error(e);$('#status').innerHTML=`<span class="red">Could not load restock data: ${esc(e.message||e)}</span>`;}}
function showApp(session){$('#auth').classList.toggle('hidden',!!session);$('#app').classList.toggle('hidden',!session);if(session)load();}
$('#login').addEventListener('click',async()=>{$('#authErr').textContent='';const {error}=await sb.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#pass').value});if(error)$('#authErr').textContent=error.message;});
$('#logout').addEventListener('click',async()=>{await sb.auth.signOut();showApp(null)});
$('#refresh').addEventListener('click',load);$('#search').addEventListener('input',render);
$$('.nav button').forEach(b=>b.addEventListener('click',()=>{$$('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(x=>x.classList.remove('active'));$('#'+b.dataset.view).classList.add('active');}));
sb.auth.onAuthStateChange((_e,s)=>showApp(s));sb.auth.getSession().then(({data})=>showApp(data.session));
})();