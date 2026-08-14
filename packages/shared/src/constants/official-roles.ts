export const OFFICIAL_ROLES = [
  'admin',
  'staff',
  'barangay_captain',
  'kagawad',
  'sk_chairman',
  'secretary',
  'treasurer',
  'health_worker',
  'tanod',
  'clerk',
] as const;

export type OfficialRole = (typeof OFFICIAL_ROLES)[number];

export const OFFICIAL_ROLE_LABELS: Record<OfficialRole, string> = {
  admin: 'Administrator',
  staff: 'Staff',
  barangay_captain: 'Barangay Captain',
  kagawad: 'Kagawad',
  sk_chairman: 'SK Chairman',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  health_worker: 'Barangay Health Worker',
  tanod: 'Tanod',
  clerk: 'Clerk',
};
