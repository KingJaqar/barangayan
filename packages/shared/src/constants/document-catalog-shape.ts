/**
 * Seed/demo defaults for `supabase/seed.sql` only — a realistic starting catalog for the
 * pilot barangay's admin to review and edit, not a hardcoded runtime list. Each
 * barangay's actual catalog always comes from its own `document_types` rows
 * (AGENTS.md §0 — protects the configurable/multi-tenant design).
 */
export const SEED_DOCUMENT_TYPES = [
  {
    name: 'Barangay Clearance',
    description: 'General-purpose clearance for employment, business, or travel requirements.',
    feeCentavos: 5000,
    processingTargetHours: 24,
    requirements: ['Valid ID', 'Proof of residency'],
  },
  {
    name: 'Certificate of Indigency',
    description: 'Certifies low-income status for fee waivers or assistance applications.',
    feeCentavos: 0,
    processingTargetHours: 24,
    requirements: ['Valid ID'],
  },
  {
    name: 'Certificate of Residency',
    description: 'Certifies that the applicant resides within the barangay.',
    feeCentavos: 3000,
    processingTargetHours: 24,
    requirements: ['Valid ID', 'Proof of residency'],
  },
] as const;
