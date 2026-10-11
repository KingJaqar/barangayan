// Generated from local public schema through migration 0108 using Supabase CLI
// 2.118.0 `gen types typescript --local --schema public`. Narrow extraction keeps
// the repository's existing generated/augmented database contracts intact.
import type { Json } from './database';

export type ResidentAccountSetupFunctions = {
  complete_resident_profile_if_unchanged: {
    Args: { p_input: Json; p_expected: Json };
    Returns: string;
  };
  get_resident_account_setup_status: {
    Args: Record<PropertyKey, never>;
    Returns: Json;
  };
};
