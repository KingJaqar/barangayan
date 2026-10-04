'use client';
import { useState } from 'react';
import { VerificationNotice } from './resident-service-form';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
export function ServicesVerification(){const [client]=useState(createSupabaseBrowserClient);return <VerificationNotice client={client}/>;}
