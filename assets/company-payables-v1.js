(function(){
'use strict';
const BUILD='20261031-company-payables-v2';
let wrapped=false,activeContainer=null,observer=null,loading=false;

function money(v){return '₱'+(Number(v)||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function addMonth(period,offset){const [y,m]=String(period).split('-').map(Number),d=new Date(Date.UTC(y,m-1+offset,1));return d.toISOString().slice(0,7)}
function monthName(period){const [y,m]=String(period).split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('en-PH',{month:'long',year:'numeric'})}

async function inject(E,container){
 if(!container||!container.isConnected||container.querySelector('#company-vehicle-payable-card')||loading)return;
 loading=true;
 try{
  const liability=await E.storageGet('liability:company_vehicle_payable')||{id:'company_vehicle_payable',openingAmount:75000,monthlyRepayment:3000,repaymentStartPeriod:'2026-11',status:'Active'};
  const keys=await E.storageListKeys('profit_payout:');
  const values=await Promise.all(keys.map(k=>E.storageGet(k)));
  const payments=values.filter(x=>x&&x.beneficiaryKey==='vehicle_payable'&&Number(x.amount)>0);
  const opening=Number(liability.openingAmount)||75000,monthly=Number(liability.monthlyRepayment)||3000,start=String(liability.repaymentStartPeriod||'2026-11');
  const totalPaid=payments.reduce((s,x)=>s+(Number(x.amount)||0),0),remaining=Math.max(0,opening-totalPaid),monthsTotal=Math.ceil(opening/monthly);
  const byPeriod=new Map();payments.forEach(x=>byPeriod.set(String(x.period||''),(byPeriod.get(String(x.period||''))||0)+(Number(x.amount)||0)));
  let running=opening;
  const rows=[];
  for(let i=0;i<monthsTotal;i++){
   const period=addMonth(start,i),scheduled=Math.min(monthly,running),paid=byPeriod.get(period)||0;
   running=Math.max(0,running-paid);
   rows.push({period,scheduled,paid,status:paid>=scheduled-.005?'Paid':paid>0?'Partial':'Pending'});
  }
  const next=rows.find(x=>x.status!=='Paid');
  const card=document.createElement('div');card.id='company-vehicle-payable-card';card.className='card';
  card.style.cssText='border:2px solid var(--forest,#173b2b);background:linear-gradient(135deg,#fff 0%,var(--sage-light,#eef2e9) 100%);margin-bottom:14px';
  card.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap">'+
   '<div><p class="eyebrow" style="margin:0 0 5px">Company Payable</p><h3 style="margin:0">🚚 Company Vehicle Payable</h3><div style="font-size:12px;color:var(--ink-soft);margin-top:5px">₱75,000 vehicle purchase · fixed ₱3,000 monthly beginning November 2026</div></div>'+
   '<button class="btn primary" id="vehicle-open-distribution">Record Monthly Payment</button></div>'+
   '<div class="kpi-grid" style="margin-top:14px">'+
   '<div class="kpi"><div class="lbl">Original Payable</div><div class="val">'+money(opening)+'</div></div>'+
   '<div class="kpi"><div class="lbl">Monthly Due</div><div class="val">'+money(monthly)+'</div></div>'+
   '<div class="kpi"><div class="lbl">Total Repaid</div><div class="val">'+money(totalPaid)+'</div></div>'+
   '<div class="kpi"><div class="lbl">Outstanding Balance</div><div class="val">'+money(remaining)+'</div></div>'+
   '</div>'+
   '<div style="margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff"><b>'+(remaining<=.005?'Fully paid':('Next unpaid schedule: '+esc(next?monthName(next.period):'—')+' · '+money(next?Math.max(0,next.scheduled-next.paid):0)))+'</b><div style="font-size:12px;color:var(--ink-soft);margin-top:3px">'+payments.length+' payment record(s) · '+monthsTotal+' scheduled monthly payments total</div></div>'+
   '<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:800">View complete 25-month schedule</summary><div class="table-wrap" style="margin-top:8px"><table class="data"><thead><tr><th>Month</th><th class="num">Scheduled</th><th class="num">Paid</th><th>Status</th></tr></thead><tbody>'+
   rows.map(x=>'<tr><td><b>'+esc(monthName(x.period))+'</b></td><td class="num">'+money(x.scheduled)+'</td><td class="num">'+money(x.paid)+'</td><td><span style="font-weight:800;color:'+(x.status==='Paid'?'#176b49':x.status==='Partial'?'#9a681f':'#6f7c73')+'">'+x.status+'</span></td></tr>').join('')+
   '</tbody></table></div></details>';
  const top=container.querySelector('.topbar'),anchor=top?top.nextElementSibling:container.firstElementChild;
  if(anchor)container.insertBefore(card,anchor);else container.prepend(card);
  card.querySelector('#vehicle-open-distribution').onclick=()=>{window.location.href='profit-distribution.html'};
  document.documentElement.dataset.companyPayablesBuild=BUILD;
 }catch(err){console.error('Company vehicle payable card failed',err)}
 finally{loading=false}
}

function watch(E,container){
 activeContainer=container;
 if(observer)observer.disconnect();
 observer=new MutationObserver(()=>{if(activeContainer&&!activeContainer.querySelector('#company-vehicle-payable-card'))inject(E,activeContainer)});
 observer.observe(container,{childList:true,subtree:false});
 inject(E,container);
}

function boot(){
 const E=window.__ecohub;
 if(!E||!E.renderPayables||!E.storageGet||!E.storageListKeys||!window.__ecohubSupplierPayablesSplitV1){setTimeout(boot,150);return}
 if(wrapped)return;wrapped=true;
 const base=E.renderPayables;
 E.renderPayables=async container=>{const result=await base(container);watch(E,container);return result};
}
boot();
})();