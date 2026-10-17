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
  // Migration 0122 (resident iOS Phase 3): provider-aware status and Apple provisioning.
  get_resident_account_setup_status_v2: {
    Args: Record<PropertyKey, never>;
    Returns: Json;
  };
  ensure_apple_resident_profile: {
    Args: Record<PropertyKey, never>;
    Returns: string;
  };
  // Migration 0123 (resident iOS Phase 3): whole-list household save with a stale-list check.
  save_resident_household_if_unchanged: {
    Args: { p_members: Json; p_expected: Json };
    Returns: Json;
  };
  // Migration 0121 (resident iOS Phase 3): online, resident-only evacuation check-in that returns the authoritative receipt.
  check_in_to_evacuation_center: {
    Args: { p_center_id: string };
    Returns: {
      check_in_id: string;
      evacuation_center_id: string;
      evacuation_center_name: string;
      barangay_id: string;
      checked_in_at: string;
      already_checked_in: boolean;
    }[];
  };
};
