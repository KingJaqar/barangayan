import { z } from 'zod';

export const HOUSEHOLD_MEMBER_RELATIONS = [
  'spouse',
  'child',
  'parent',
  'sibling',
  'grandparent',
  'grandchild',
  'other',
] as const;

export type HouseholdMemberRelation = (typeof HOUSEHOLD_MEMBER_RELATIONS)[number];

export const HOUSEHOLD_MEMBER_ROLES = [
  'head',
  'spouse',
  'child',
  'parent',
  'sibling',
  'grandparent',
  'grandchild',
  'other',
] as const;

export type HouseholdMemberRole = (typeof HOUSEHOLD_MEMBER_ROLES)[number];

export const householdMemberSchema = z.object({
  profile_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(200),
  relation: z.enum(HOUSEHOLD_MEMBER_RELATIONS),
  role: z.string().min(1, 'Role is required').max(50),
});

export type HouseholdMemberFormValues = z.infer<typeof householdMemberSchema>;

export const householdSearchSchema = z.object({
  q: z.string().optional(),
});

export type HouseholdSearchParams = z.infer<typeof householdSearchSchema>;
