import type { IdVerificationStatus } from '@barangayan/shared';
export type Tab = 'all' | 'id_verified' | 'id_unverified' | 'verified' | 'unverified';

export const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'id_verified', label: 'Valid ID Verified' },
  { key: 'id_unverified', label: 'Valid ID Unverified' },
  { key: 'verified', label: 'Email Verified' },
  { key: 'unverified', label: 'Email Unverified' },
];

export type ResidentRow = {
  id: string;
  full_name: string;
  // Structured name/address/employment columns (migration 0081) — full_name/
  // home_address above stay in the row (sort key, avatar initials, search fallback,
  // detail-modal header) but the directory table itself now displays these parts
  // separately instead of the composed strings.
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  suffix: string | null;
  sex: string | null;
  avatar_url: string | null;
  email: string | null;
  mobile_number: string | null;
  home_address: string | null;
  house_no: string | null;
  street: string | null;
  city: string | null;
  employment_status: string | null;
  occupation: string | null;
  birth_date: string | null;
  email_verification_status: string;
  household_members: Array<{ id: string; name: string; relation: string; role: string }>;
  id_photo_urls: string[];
  id_type: string | null;
  id_verification_status: IdVerificationStatus | null;
  current_id_submission_id: string | null;
  id_repair_required: boolean;
  created_at: string;
  updated_at: string;
  /** Point-in-polygon geofencing result at signup (migration 0075). NULL = check
   *  couldn't run (no boundary/permission denied); FALSE = device location was
   *  outside the barangay boundary — soft flag only, never blocked registration. */
  location_verified: boolean | null;
  /** Resident-initiated pin from Settings > Location Verification (mobile,
   *  migrations 0090/0091) — { lat, lng } once set, distinct from the signup-time
   *  location_verified/registration_location flag above. */
  verified_location: { lat: number; lng: number } | null;
  verified_location_address: string | null;
};
