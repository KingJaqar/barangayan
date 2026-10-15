import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CharterRequestForm } from '../../../apps/resident-android-mobile/src/components/services/charter-request-form';

const fixture = window as any;
const id = 'a1260000-0000-4000-8000-000000000001';
fixture.requestId='e1260000-0000-4000-8000-000000000001';
fixture.profile={id,role:'resident',full_name:'Test Resident',mobile_number:'09171234567',id_verification_status:'verified',approved_id_submission_id:id,current_id_submission_id:id,id_repair_required:false};
fixture.approved={id,decision:'verified',id_type:'PhilSys',version:1,front_path:`${id}/front.jpg`,back_path:null};
const doc:any={id,contract_version:2,name:'Certificate of Indigency',service_kind:'indigency',fee_centavos:10000,pricing_mode:'fixed',processing_target_minutes:15,
  charter:{officeDivision:'Office',classification:'Simple',transactionType:'G2C',whoMayAvail:'Residents',checklistOfRequirements:'Valid ID',whereToSecureRequirements:'Office',clientSteps:'Submit',agencyActions:'Process',feesToBePaid:'₱100.00',processingTime:'15 minutes',personResponsible:null},
  purposes:[{code:'medical',label:'Medical assistance',requiresExplanation:false},{code:'others',label:'Others',requiresExplanation:true}],
  requirement_rules:{dtiRequired:false,hoaRequired:false,lessorForRenter:true,personalAppearance:true}};
function App(){
  const [key,setKey]=useState(0);
  fixture.reset=(role='resident')=>{fixture.profile={...fixture.profile,role};fixture.calls=[];fixture.uploads=0;fixture.rpcError=null;fixture.uploadError=null;fixture.pickerError=null;fixture.navigation=null;setKey(value=>value+1);};
  fixture.calls??=[];fixture.uploads??=0;
  return <CharterRequestForm key={key} doc={doc}/>;
}
createRoot(document.getElementById('root')!).render(<App/>);
