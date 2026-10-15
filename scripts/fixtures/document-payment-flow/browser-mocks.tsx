import React, { useEffect, useState } from 'react';
const fixture=window as any;
const Link=React.forwardRef<HTMLAnchorElement,any>((props,ref)=><a {...props} ref={ref}/>);
export function useScopedRead(){
  const [,update]=useState(0);
  const refetch=React.useCallback(()=>update(value=>value+1),[]);
  useEffect(()=>{window.addEventListener('fixture-update',refetch);return ()=>window.removeEventListener('fixture-update',refetch);},[refetch]);
  return {data:fixture.request,error:null,isRefreshing:false,refetch};
}
export function usePaymongoSource(){
  const [,update]=useState(0);
  useEffect(()=>{const changed=()=>update(value=>value+1);window.addEventListener('fixture-update',changed);return()=>window.removeEventListener('fixture-update',changed);},[]);
  return {source:{paymentId:fixture.paid.id,paymentIntentId:'pi_test',qrImageUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZRkAAAAASUVORK5CYII=',expiresAt:Date.now()+1800000,amountCentavos:10000,documentFeeCentavos:10000},status:fixture.sourceStatus,cancelling:false,cancelPayment:async()=>({outcome:'cancelled'}),statusCheckFailed:false};
}
export function createSupabaseBrowserClient(){return {
  rpc:async(name:string,args:any)=>{
    fixture.calls.push({name,args});
    if(name==='set_service_request_pages'){fixture.request.fee_assessment_state='assessed';fixture.request.assessed_amount_centavos=args.p_total_pages*1000;window.dispatchEvent(new Event('fixture-update'));}
    return {data:null,error:null,status:200};
  },
  from:()=>{const query:any={select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,maybeSingle:()=>Promise.resolve({data:fixture.paid,error:null})};return query;},
};}
export default Link;
