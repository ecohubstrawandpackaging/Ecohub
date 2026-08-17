(function(){
  'use strict';
  const E=window.__ecohub;
  if(!E || window.__ecohubQuotationPrintRouteV1) return;
  window.__ecohubQuotationPrintRouteV1=true;
  const STORE='ecohub:quotation-print:v1';
  E.printQuotation=function(q){
    try{
      sessionStorage.setItem(STORE,JSON.stringify(q||{}));
      const url=new URL('quotation-print.html',window.location.href);
      url.searchParams.set('v','1');
      window.location.assign(url.href);
    }catch(err){
      console.error('EcoHub quotation print route failed',err);
      try{
        E.buildPrintView && E.buildPrintView(q);
        window.print();
      }catch(fallbackErr){
        console.error('EcoHub quotation print fallback failed',fallbackErr);
        E.toast && E.toast('Print could not open. Please reload EcoHub and try again.');
      }
    }
  };
})();
