import { z } from 'zod';

export const EVACUATION_CENTER_FACILITIES = ['medical_desk', 'pet_friendly', 'generator'] as const;

export type EvacuationCenterFacility = (typeof EVACUATION_CENTER_FACILITIES)[number];

export const evacuationCenterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  address: z.string().max(500).optional().or(z.literal('')),
  lat: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  capacity: z.number().int().min(0).optional().nullable(),
  current_occupancy: z.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
  contact_number: z.string().max(50).optional().or(z.literal('')),
  facilities: z.array(z.enum(EVACUATION_CENTER_FACILITIES)).optional().default([]),
  verified: z.boolean().optional().default(false),
});

export type EvacuationCenterFormValues = z.infer<typeof evacuationCenterSchema>;
