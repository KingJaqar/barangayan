import { type IdConfirmedDetails } from '@barangayan/shared';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export async function extractIdDetails(frontPath: string, idType: string): Promise<IdConfirmedDetails> {
  const { data, error } = await supabase.functions.invoke('extract-resident-id', { body: { frontPath, idType } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === 'string') throw new Error(body.error);
    }
    throw new Error('Could not read your ID photo. Check your connection and retry, or enter the details manually.');
  }
  const fields = data?.details;
  if (!fields || !['fullName', 'idNumber', 'birthDate', 'address'].every(key => typeof fields[key] === 'string')) throw new Error('Could not read your ID details. Retry or enter them manually.');
  return { fullName: fields.fullName, idNumber: fields.idNumber, birthDate: fields.birthDate, address: fields.address };
}
