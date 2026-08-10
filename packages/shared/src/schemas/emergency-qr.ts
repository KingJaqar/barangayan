import { z } from 'zod';

export const qrStepItemSchema = z.object({
  step: z.number().int().min(1),
  title: z.string().min(1, 'Step title is required'),
  desc: z.string().min(1, 'Step description is required'),
});

export const emergencyQrContentSchema = z.object({
  id: z.string().uuid().optional(),
  barangay_id: z.string().uuid(),
  section: z.enum(['why_scan', 'how_it_works']),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  body: z.string().default(''),
  content: z.array(qrStepItemSchema).default([]),
  icon: z.string().default('qr-code-outline'),
  icon_color: z.string().default('#2563EB'),
  icon_bg: z.string().default('#DBEAFE'),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const evacuationCenterQrPayloadSchema = z.object({
  type: z.literal('EVACUATION_CENTER_CHECKIN'),
  version: z.literal('1.0'),
  center_id: z.string().uuid(),
  center_name: z.string(),
  barangay_id: z.string().uuid(),
  generated_at: z.string().datetime().optional(),
});

export type QrStepItem = z.infer<typeof qrStepItemSchema>;
export type EmergencyQrContent = z.infer<typeof emergencyQrContentSchema>;
export type EvacuationCenterQrPayload = z.infer<typeof evacuationCenterQrPayloadSchema>;
