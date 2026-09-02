(function(){
'use strict';
const URL='https://fyvogvjvivxpqztbaoct.supabase.co',KEY='sb_publishable_gnvNDN1co5qB7tBBevXziQ_pbAoBc87';
const sb=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=id=>document.getElementById(id),n=v=>Number(v)||0;
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>'₱'+n(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
let quotes=[],expenses=[],payouts=[],settings={},selectedMonth='',current=null,currentRecipient=null;
const RECIPIENTS=[
  {key:'xander',name:'Xander',formula:'25% of positive adjusted profit on Xander transactions'},
  {key:'marketing',name:'Marketing',formula:'10% of profit remaining after Xander'},
  {key:'payables',name:'Payables Fund',formula:'10% of profit remaining after Xander'},
  {key:'rence',name:'Rence',formula:'40% of profit remaining after Xander'},
  {key:'lance',name:'Lance',formula:'40% of profit remaining after Xander'}
];
function show(id){['auth','denied','app'].forEach(x=>$(x).classList.add('hidden'));$(id).classList.remove('hidden')}
function client(q){return String(q.company||q.customer||q.clientName||'Unassigned Client').trim()||'Unassigned Client'}
function salesperson(q){return String(q.salesperson||q.salesPerson||q.salesPersonName||q.agent||'—').trim()||'—'}
function completed(q){return String(q.orderStatus||'').toLowerCase()==='completed'}
function completedDate(q){return String(q.completedDate||q.completedAt||q.date||'').slice(0,10)}
function monthOf(q){return completedDate(q).slice(0,7)}
function totals(q){let subtotal=0,discount=0,cogs=0;for(const it of(q.items||[])){const qty=n(it.qty);subtotal+=qty*n(it.price);discount+=n(it.discount);cogs+=qty*n(it.cost)}const net=Math.max(0,subtotal-discount);return{net,cogs,profit:net-cogs}}
function expenseDate(x){return String(x.date||x.createdAt||'').slice(0,10)}
function expenseMonth(x){return expenseDate(x).slice(0,7)}
function today(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function nowTime(){const d=new Date();return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function uid(prefix){if(globalThis.crypto?.randomUUID)return prefix+globalThis.crypto.randomUUID().replaceAll('-','');return prefix+Date.now().toString(36)+Math.random().toString(36).slice(2)}
function monthName(m){return m==='ALL'?'All Time':new Date(m+'-01T00:00:00').toLocaleDateString('en-PH',{month:'long',year:'numeric'})}
function periodData(){
  const needle=$('search').value.trim().toLowerCase();
  const qrows=quotes.filter(completed).filter(q=>selectedMonth==='ALL'||monthOf(q)===selectedMonth);
  const erows=expenses.filter(x=>n(x.amount)>0).filter(x=>selectedMonth==='ALL'||expenseMonth(x)===selectedMonth).sort((a,b)=>expenseDate(b).localeCompare(expenseDate(a)));
  const base=qrows.map(q=>({q,t:totals(q),isXander:salesperson(q).toLowerCase()==='xander'}));
  const gross=base.reduce((s,x)=>s+x.t.profit,0),positive=base.reduce((s,x)=>s+Math.max(0,x.t.profit),0),expenseTotal=erows.reduce((s,x)=>s+n(x.amount),0);
  const models=base.map(x=>{const allocatedExpense=positive>0?expenseTotal*Math.max(0,x.t.profit)/positive:0,adjusted=x.t.profit-allocatedExpense,commission=x.isXander?Math.max(0,adjusted)*.25:0;return{...x,allocatedExpense,adjusted,commission,afterXander:adjusted-commission}});
  const afterExpenses=gross-expenseTotal,xander=models.reduce((s,x)=>s+x.commission,0),distributable=Math.max(0,afterExpenses-xander);
  const targets={xander,marketing:distributable*.10,payables:distributable*.10,rence:distributable*.40,lance:distributable*.40};
  const shown=models.filter(x=>!needle||client(x.q).toLowerCase().includes(needle)||String(x.q.number||'').toLowerCase().includes(needle)||salesperson(x.q).toLowerCase().includes(needle)).sort((a,b)=>completedDate(b.q).localeCompare(completedDate(a.q)));
  return{models:shown,periodTransactionCount:models.length,expenses:erows,gross,expenseTotal,afterExpenses,xander,distributable,targets};
}
function payoutPeriodRows(){return payouts.filter(x=>selectedMonth==='ALL'||x.period===selectedMonth)}
function paidFor(key){return payoutPeriodRows().filter(x=>x.beneficiaryKey===key).reduce((s,x)=>s+n(x.amount),0)}
function setMoney(id,v){$(id).textContent=money(v)}
function render(){
  current=periodData();
  setMoney('kGross',current.gross);setMoney('kExpenses',current.expenseTotal);setMoney('kAfterExpenses',current.afterExpenses);setMoney('kXander',current.xander);setMoney('kDistributable',current.distributable);setMoney('kRence',current.targets.rence);setMoney('kLance',current.targets.lance);setMoney('kMarketing',current.targets.marketing);setMoney('kPayables',current.targets.payables);
  $('periodLabel').textContent=monthName(selectedMonth);$('count').textContent=current.models.length+' transaction'+(current.models.length===1?'':'s');$('expenseCount').textContent=current.expenses.length+' expense'+(current.expenses.length===1?'':'s');
  $('payoutRows').innerHTML=RECIPIENTS.map(r=>{const target=current.targets[r.key]||0,paid=paidFor(r.key),remaining=Math.max(0,target-paid),done=remaining<.005&&target>0,disabled=selectedMonth==='ALL'||remaining<.005;return `<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.formula)}</td><td class="num"><b>${money(target)}</b></td><td class="num">${money(paid)}</td><td class="num"><b>${money(remaining)}</b></td><td><span class="pill ${done?'good':target>0?'warn':'neutral'}">${done?'Fully Distributed':target>0?'Pending':'No Allocation'}</span></td><td><button class="btn ${disabled?'':'dark'}" data-pay="${r.key}" ${disabled?'disabled':''}>Distribute</button></td></tr>`}).join('');
  $('expenseRows').innerHTML=current.expenses.length?current.expenses.map(x=>`<tr><td>${esc(expenseDate(x)||'—')}</td><td><b>${esc(x.category||'Expense')}</b></td><td>${esc(x.description||x.payee||'—')}</td><td>${esc(x.account||'—')}</td><td>${esc(x.method||'—')}</td><td class="num"><b>${money(x.amount)}</b></td></tr>`).join(''):'<tr><td colspan="6"><div class="empty">No recorded expenses for this period.</div></td></tr>';
  $('rows').innerHTML=current.models.length?current.models.map(x=>`<tr><td>${esc(completedDate(x.q)||'—')}</td><td><b>${esc(x.q.number||'—')}</b></td><td><b>${esc(client(x.q))}</b></td><td>${esc(salesperson(x.q))}${x.isXander?' <span class="pill warn">25%</span>':''}</td><td class="num">${money(x.t.net)}</td><td class="num">${money(x.t.cogs)}</td><td class="num ${x.t.profit<0?'loss':''}">${money(x.t.profit)}</td><td class="num">${money(x.allocatedExpense)}</td><td class="num ${x.adjusted<0?'loss':''}"><b>${money(x.adjusted)}</b></td><td class="num">${money(x.commission)}</td><td class="num ${x.afterXander<0?'loss':''}">${money(x.afterXander)}</td></tr>`).join(''):'<tr><td colspan="11"><div class="empty">No completed transactions for this period.</div></td></tr>';
  const hist=payoutPeriodRows().slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  $('historyRows').innerHTML=hist.length?hist.map(x=>`<tr><td>${esc(x.date||'—')}</td><td>${esc(monthName(x.period||'ALL'))}</td><td><b>${esc(x.beneficiaryName||x.beneficiaryKey||'—')}</b></td><td>${esc(x.account||'—')}</td><td>${esc(x.referenceNumber||'—')}</td><td class="num"><b>${money(x.amount)}</b></td><td>${esc(x.remarks||'—')}</td></tr>`).join(''):'<tr><td colspan="7"><div class="empty">No confirmed payouts for this period.</div></td></tr>';
}
function months(){const prior=selectedMonth,all=[...new Set([...quotes.filter(completed).map(monthOf),...expenses.map(expenseMonth)].filter(Boolean))].sort().reverse();$('month').innerHTML=all.map(m=>`<option value="${esc(m)}">${esc(monthName(m))}</option>`).join('')+'<option value="ALL">All Time · analysis only</option>';selectedMonth=prior&&(prior==='ALL'||all.includes(prior))?prior:(all[0]||'ALL');$('month').value=selectedMonth}
function openPayout(key){const r=RECIPIENTS.find(x=>x.key===key);if(!r||selectedMonth==='ALL')return;const target=current.targets[key]||0,paid=paidFor(key),remaining=Math.max(0,target-paid);if(remaining<.005)return;currentRecipient={...r,target,paid,remaining};$('payoutTitle').textContent='Distribute to '+r.name;$('payoutSummary').textContent=`${monthName(selectedMonth)} · Target ${money(target)} · Already distributed ${money(paid)} · Remaining ${money(remaining)}`;$('payDate').value=today();$('payAmount').value=remaining.toFixed(2);$('payAccount').innerHTML=(settings.cashAccounts||['Cash on Hand']).map(x=>`<option>${esc(x)}</option>`).join('');$('payReference').value='';$('payRemarks').value=`${monthName(selectedMonth)} profit distribution — ${r.name}`;$('payoutModal').classList.remove('hidden')}
function closePayout(){currentRecipient=null;$('payoutModal').classList.add('hidden')}
async function confirmPayout(){
  if(!currentRecipient||selectedMonth==='ALL')return;const amount=n($('payAmount').value),account=$('payAccount').value,date=$('payDate').value;
  if(!date)return alert('Choose the distribution date.');if(!account)return alert('Choose the source Finance account.');if(amount<=0)return alert('Enter a valid amount.');if(amount>currentRecipient.remaining+.005)return alert('Amount cannot exceed the remaining allocation.');
  const b=$('payoutConfirm');b.disabled=true;b.textContent='Recording…';const createdAt=new Date().toISOString(),id=uid('pp'),ledgerId=uid('clpd'),reference=$('payReference').value.trim(),remarks=$('payRemarks').value.trim();
  const payout={id,period:selectedMonth,beneficiaryKey:currentRecipient.key,beneficiaryName:currentRecipient.name,amount,date,account,referenceNumber:reference,remarks,ledgerEntryId:ledgerId,createdAt,calculationSnapshot:{grossProfit:current.gross,expenses:current.expenseTotal,profitAfterExpenses:current.afterExpenses,xanderCommission:current.xander,profitAfterXander:current.distributable,targetAllocation:currentRecipient.target}};
  const ledger={id:ledgerId,date,time:nowTime(),transactionType:'Profit Distribution',source:'Profit Distribution — '+currentRecipient.name,referenceNumber:reference,clientOrSupplier:currentRecipient.name,account,cashIn:0,cashOut:amount,remarks:remarks||`${monthName(selectedMonth)} profit distribution`,createdAt,recordedBy:'',history:[],profitPayoutId:id,profitPeriod:selectedMonth};
  const {error}=await sb.from('ecohub_kv').upsert([{key:'profit_payout:'+id,value:payout},{key:'cashledger:'+ledgerId,value:ledger}],{onConflict:'key'});b.disabled=false;b.textContent='Confirm Distribution';if(error)return alert('Distribution was not recorded: '+error.message);closePayout();await load();alert('Distribution recorded and deducted from '+account+'.');
}
async function verifyInternal(session){if(!session?.user?.id)return false;const {data,error}=await sb.from('ecohub_internal_users').select('user_id').eq('user_id',session.user.id).maybeSingle();if(error)throw error;return !!data}
async function load(){try{$('status').textContent='Refreshing completed transactions, expenses, payouts and Finance accounts…';const [q,e,p,s]=await Promise.all([sb.from('ecohub_kv').select('key,value').like('key','quotation:%'),sb.from('ecohub_kv').select('key,value').like('key','expense:%'),sb.from('ecohub_kv').select('key,value').like('key','profit_payout:%'),sb.from('ecohub_kv').select('key,value').eq('key','settings:main').maybeSingle()]);for(const x of[q,e,p,s])if(x.error)throw x.error;quotes=(q.data||[]).map(x=>x.value).filter(Boolean);expenses=(e.data||[]).map(x=>x.value).filter(Boolean);payouts=(p.data||[]).map(x=>x.value).filter(Boolean);settings=s.data?.value||{};months();render();$('status').textContent='Updated '+new Date().toLocaleString('en-PH')+' · '+quotes.filter(completed).length+' completed transactions · '+expenses.filter(x=>n(x.amount)>0).length+' recorded expenses'}catch(e){console.error(e);$('status').textContent='Could not load distribution data: '+(e.message||e)}}
function exportCsv(){const d=current||periodData(),data=[['TYPE','DATE','REFERENCE','CLIENT / DESCRIPTION','SALESPERSON / CATEGORY','NET SALES','COGS','GROSS PROFIT','ALLOCATED EXPENSE','ADJUSTED PROFIT','XANDER 25%','AFTER XANDER'],...d.models.map(x=>['TRANSACTION',completedDate(x.q),x.q.number||'',client(x.q),salesperson(x.q),x.t.net,x.t.cogs,x.t.profit,x.allocatedExpense,x.adjusted,x.commission,x.afterXander]),...d.expenses.map(x=>['EXPENSE',expenseDate(x),'',x.description||x.payee||'',x.category||'',0,0,0,x.amount,0,0,0])],csv=data.map(row=>row.map(v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(',')).join('\n'),blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=globalThis.URL.createObjectURL(blob);a.download='EcoHub-Profit-Distribution-'+selectedMonth+'.csv';a.click();setTimeout(()=>globalThis.URL.revokeObjectURL(a.href),500)}
async function bootstrap(){try{const {data:{session}}=await sb.auth.getSession();if(!session){show('auth');return}if(!await verifyInternal(session)){show('denied');return}show('app');await load()}catch(e){console.error(e);show('auth');$('authMsg').textContent=e.message||String(e)}}
$('login').onclick=async()=>{const b=$('login');b.disabled=true;$('authMsg').textContent='Signing in…';const {error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('pass').value});b.disabled=false;$('authMsg').textContent=error?error.message:'';if(!error)await bootstrap()};
$('logout').onclick=$('switchAccount').onclick=async()=>{await sb.auth.signOut();location.reload()};$('back').onclick=()=>location.href='./';$('refresh').onclick=load;$('month').onchange=e=>{selectedMonth=e.target.value;render()};$('search').oninput=render;$('csv').onclick=exportCsv;$('payoutRows').onclick=e=>{const b=e.target.closest('[data-pay]');if(b)openPayout(b.dataset.pay)};$('payoutCancel').onclick=closePayout;$('payoutConfirm').onclick=confirmPayout;$('payoutModal').onclick=e=>{if(e.target===$('payoutModal'))closePayout()};bootstrap();
})();
