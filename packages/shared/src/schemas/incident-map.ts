import { z } from 'zod';
import type { LatLng, MapMarker } from '../types/map-bridge';

export const incidentMapFiltersSchema = z.object({
  tab: z.enum(['incidents', 'evacuation']).default('incidents'),
  categoryIds: z.array(z.string().uuid()).optional(),
  searchQuery: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved']).optional(),
});

export type IncidentMapFilters = z.infer<typeof incidentMapFiltersSchema>;

export interface MapIncidentMarker {
  id: string;
  position: LatLng;
  kind: string;
  label: string;
  status: string;
  categoryColor?: string;
  categoryName?: string;
  address?: string | null;
}

export interface MapEvacuationMarker {
  id: string;
  position: LatLng;
  kind: 'evacuation';
  label: string;
  capacity?: number | null;
  currentOccupancy?: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

export interface EvacuationCenterRow {
  id: string;
  name: string;
  address: string | null;
  position: { lat: number; lng: number } | null;
  capacity: number | null;
  current_occupancy: number;
  facilities: string[];
  is_active: boolean;
}
