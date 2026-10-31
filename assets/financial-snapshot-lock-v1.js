(function(){
'use strict';
const BUILD='20261031-financial-snapshot-lock-v1';
let installed=false;
const n=v=>Number(v)||0,iso=v=>String(v||'').slice(0,10);

function payments(q){return (Array.isArray(q&&q.payments)?q.payments:[]).filter(p=>n(p&&p.amount)>0)}
function historicalSettled(q){return !!(q&&q.historicalSettled)&&n(q&&q.historicalSettlementAmount)>0&&!!iso(q&&q.historicalSettlementDate)}
function status(q){return String(q&&q.orderStatus||'').trim().toLowerCase()}
function fulfilled(q){return status(q)==='completed'||status(q)==='delivered'}
function paymentDate(p){return iso(p&&(p.financialReportingDate||p.date||p.createdAt))}
function finalPaymentDate(q){const dates=payments(q).map(paymentDate).concat(historicalSettled(q)?[iso(q.historicalSettlementDate)]:[]).filter(Boolean).sort();return dates.length?dates[dates.length-1]:''}
function fulfillmentDate(q){return status(q)==='completed'?iso(q&&(q.completedDate||q.completedAt||q.deliveredDate)):iso(q&&q.deliveredDate)}
function liveTotals(q){
 let subtotal=0,discount=0,cogs=0;
 for(const it of(Array.isArray(q&&q.items)?q.items:[])){const qty=n(it&&it.qty);subtotal+=qty*n(it&&it.price);discount+=n(it&&it.discount);cogs+=qty*n(it&&it.cost)}
 const net=Math.max(0,subtotal-discount),vat=q&&q.vatEnabled?net*n(q.vatRate)/100:0,grand=net+vat;
 const paid=Math.max(payments(q).reduce((s,p)=>s+n(p.amount),0),historicalSettled(q)?n(q.historicalSettlementAmount):0);
 return{net,cogs,grossProfit:net-cogs,grand,paid,balance:Math.max(0,grand-paid)};
}
function lock(q){
 if(!q||!fulfilled(q))return q;
 const t=liveTotals(q);if(t.grand<=0||(!payments(q).length&&!historicalSettled(q))||t.balance>.004)return q;
 const now=new Date().toISOString();
 q.financialRecognitionDate=iso(q.financialRecognitionDate)||[fulfillmentDate(q),finalPaymentDate(q)].filter(Boolean).sort().pop()||iso(q.date||q.createdAt);
 q.profitSummary={netSales:t.net,cogs:t.cogs,grossProfit:t.grossProfit,basis:'Quotation item qty × selling price minus discounts and item cost',calculatedAt:now};
 q.financialSnapshotVersion=1;q.financialSnapshotUpdatedAt=now;
 return q;
}
function boot(){
 const E=window.__ecohub;if(!E||!E.syncPayablesForQuotation)return setTimeout(boot,120);
 if(installed||window.__ecohubFinancialSnapshotLockV1)return;installed=true;window.__ecohubFinancialSnapshotLockV1=true;
 const base=E.syncPayablesForQuotation;
 E.syncPayablesForQuotation=async function(q){lock(q);return base(q)};
 E.lockQuotationFinancialSnapshot=lock;
 document.documentElement.dataset.financialSnapshotBuild=BUILD;
}
boot();
})();
