'use client';
import { RequestPaymentJourney } from '@/components/services/request-payment-journey';
export function PickupConfirmation({requestId}:{requestId:string;barangayId:string;referenceNumber:string;documentName:string;feeCentavos:number}){return <RequestPaymentJourney key={requestId} requestId={requestId} initialStep="pickup"/>;}
