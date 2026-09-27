import { z } from 'zod';

const publicKey = z.string().min(1).refine((key) => {
  if (key.startsWith('sb_publishable_')) return true;
  // Legacy public keys are JWTs. Reject privileged keys before client construction.
  try {
    const payload = key.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(normalized)).role === 'anon';
  } catch { return false; }
}, 'A public Supabase client key is required');

export const configurationSchema = z.object({
  url: z.string().url().refine((url) => new URL(url).protocol === 'https:', 'HTTPS is required'),
  anonKey: publicKey,
  barangayId: z.string().uuid(),
  environment: z.enum(['development', 'staging', 'production']),
});

export function readConfiguration() {
  return configurationSchema.safeParse({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    barangayId: process.env.EXPO_PUBLIC_BARANGAY_ID,
    environment: process.env.EXPO_PUBLIC_ENVIRONMENT,
  });
}
export type Configuration = z.infer<typeof configurationSchema>;
