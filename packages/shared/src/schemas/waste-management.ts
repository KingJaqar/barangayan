import { z } from 'zod';
import { WASTE_TYPES } from '../constants/waste-types';

export const wasteZoneSchema = z.object({
  name: z.string().min(1, 'Zone name is required').max(200),
  description: z.string().max(500).optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

export type WasteZoneInput = z.infer<typeof wasteZoneSchema>;

export const wasteScheduleSchema = z.object({
  zoneId: z.string().uuid('Please select a zone'),
  wasteType: z.enum(WASTE_TYPES, { errorMap: () => ({ message: 'Please select a waste type' }) }),
  dayOfWeek: z.number().int().min(0).max(6, 'Day must be 0 (Sunday) through 6 (Saturday)'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  notes: z.string().max(500).optional().or(z.literal('')),
  isActive: z.boolean().optional().default(true),
});

export type WasteScheduleInput = z.infer<typeof wasteScheduleSchema>;
