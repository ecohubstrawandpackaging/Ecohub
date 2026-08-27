(function(){
'use strict';
if(window.supabase&&window.supabase.__ecohubLite)return;
const listeners=new Set();
function errObj(message,status){const e=new Error(message||'Request failed');e.status=status||0;return e}
function decodeExp(token){try{const p=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const j=JSON.parse(atob(p));return Number(j.exp||0)*1000}catch(_){return 0}}
window.supabase={__ecohubLite:true,createClient(baseUrl,anonKey,options={}){
  const storageKey=options?.auth?.storageKey||'ecohub-supplier-auth-v1';
  function read(){try{return JSON.parse(localStorage.getItem(storageKey)||'null')}catch(_){return null}}
  function write(s){try{if(s)localStorage.setItem(storageKey,JSON.stringify(s));else localStorage.removeItem(storageKey)}catch(_){}}
  function notify(ev,s){listeners.forEach(fn=>{try{fn(ev,s)}catch(_){}})}
  async function request(url,opts={}){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),12000);try{return await fetch(url,{...opts,signal:ctl.signal})}finally{clearTimeout(t)}}
  async function refresh(){const s=read();if(!s?.refresh_token)return null;try{const r=await request(baseUrl+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});const j=await r.json().catch(()=>({}));if(!r.ok)throw errObj(j.msg||j.message||j.error_description||'Session refresh failed',r.status);const ns={...j,user:j.user||s.user};write(ns);notify('TOKEN_REFRESHED',ns);return ns}catch(e){write(null);notify('SIGNED_OUT',null);return null}}
  async function session(){let s=read();if(!s?.access_token)return null;const exp=decodeExp(s.access_token);if(exp&&exp<Date.now()+60000)s=await refresh();return s?.access_token?s:null}
  async function rpc(name,args={}){let s=await session();if(!s)return{data:null,error:errObj('Supplier session expired. Please sign in again.',401)};async function run(token){const r=await request(baseUrl+'/rest/v1/rpc/'+encodeURIComponent(name),{method:'POST',headers:{apikey:anonKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args||{})});const text=await r.text();let j=null;try{j=text?JSON.parse(text):null}catch(_){j=text}if(!r.ok)return{ok:false,status:r.status,error:errObj((j&&j.message)||String(j||'RPC failed'),r.status)};return{ok:true,data:j}}
    let out=await run(s.access_token);if(!out.ok&&out.status===401){s=await refresh();if(s)out=await run(s.access_token)}return out.ok?{data:out.data,error:null}:{data:null,error:out.error};
  }
  return{
    auth:{
      async getSession(){const s=await session();return{data:{session:s},error:null}},
      async signInWithPassword({email,password}){try{const r=await request(baseUrl+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});const j=await r.json().catch(()=>({}));if(!r.ok)throw errObj(j.msg||j.message||j.error_description||'Invalid login',r.status);write(j);notify('SIGNED_IN',j);return{data:{session:j,user:j.user},error:null}}catch(e){return{data:{session:null,user:null},error:e}}},
      async signUp(){return{data:null,error:errObj('Supplier accounts are created by EcoHub Admin.')}},
      async signOut(){const s=read();write(null);if(s?.access_token){try{await request(baseUrl+'/auth/v1/logout',{method:'POST',headers:{apikey:anonKey,Authorization:'Bearer '+s.access_token}})}catch(_){}}notify('SIGNED_OUT',null);return{error:null}},
      onAuthStateChange(cb){listeners.add(cb);return{data:{subscription:{unsubscribe(){listeners.delete(cb)}}}}}
    },
    rpc
  };
}};
})();