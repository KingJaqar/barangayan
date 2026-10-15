import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RequestPaymentJourney } from '../../../apps/resident-web/src/components/services/request-payment-journey';

const fixture = window as any;
fixture.calls = [];
fixture.sourceStatus = 'pending';
fixture.request = {
  id:'00000000-0000-4000-8000-000000000125',barangay_id:'00000000-0000-4000-8000-000000000001',reference_number:'REQ-2026-00125',
  contract_version:2,status:'submitted',payment_status:'pending',fee_assessment_state:'assessed',assessed_amount_centavos:10000,
  document_types:{name:'Certificate of Indigency',fee_centavos:10000,service_kind:'indigency'},payments:[],
};
fixture.paid = { id:'00000000-0000-4000-8000-000000000126',service_request_id:fixture.request.id,method:'qrph',status:'paid',amount_centavos:10000,document_fee_centavos:10000,paid_at:'2026-10-15T02:00:00Z',created_at:'2026-10-15T02:00:00Z',paymongo_payment_id:'pay_test_125' };
fixture.pay = () => {fixture.request.payment_status='paid'; fixture.sourceStatus='paid';window.dispatchEvent(new Event('fixture-update'));};
function App(){
  const [key,setKey]=useState(0);
  fixture.reset = (kind:string) => {
    fixture.calls=[];fixture.sourceStatus='pending';fixture.request.payment_status='pending';fixture.request.payments=[];
    fixture.request.document_types.service_kind=kind;
    fixture.request.fee_assessment_state=kind==='business'?'pickup_due':kind==='certified_true_copy'?'page_count_required':'assessed';
    fixture.request.assessed_amount_centavos=kind==='indigency'?10000:null;
    setKey(value=>value+1);
  };
  return <main style={{maxWidth:550,margin:'30px auto',fontFamily:'Arial',lineHeight:1.5}}><RequestPaymentJourney key={key} requestId={fixture.request.id}/></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
