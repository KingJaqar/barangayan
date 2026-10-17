import { incidentReportSchema, isPointInPolygon, type LatLng } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import type { ConcernInsert, IncidentCategory, WasteZone } from '../../data/resident-api';

/** Limits of the shared `incidentReportSchema` and the `incident-photos` bucket (migrations 0025, 0083, 0121). */
export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 1000;
export const ADDRESS_MAX = 300;
export const AREA_MAX = 300;
export const PHOTO_MAX = 5;

/** The typed answers of a concern. Ids are empty until chosen; the position is held separately. */
export type ConcernFields = { categoryId: string; zoneId: string; title: string; description: string; address: string; specificArea: string };
export const emptyConcern = (): ConcernFields => ({ categoryId: '', zoneId: '', title: '', description: '', address: '', specificArea: '' });

export type ConcernField = 'category' | 'title' | 'description' | 'address' | 'specificArea' | 'location' | 'zone' | 'photos';
export type ConcernErrors = Partial<Record<ConcernField, string>>;

type Boundary = Polygon | MultiPolygon | null;

/** Whether the chosen category asks for a collection zone (trash-related) and zones are configured. */
export function zoneApplies(fields: Pick<ConcernFields, 'categoryId'>, categories: readonly IncidentCategory[], zones: readonly WasteZone[]): boolean {
  return zones.length > 0 && categories.find((category) => category.id === fields.categoryId)?.is_trash_related === true;
}

/** Changing the category clears a zone that no longer applies; picking the same zone again clears it (A33-006). */
export function chooseCategory(fields: ConcernFields, categoryId: string, categories: readonly IncidentCategory[], zones: readonly WasteZone[]): ConcernFields {
  const next = { ...fields, categoryId };
  return zoneApplies(next, categories, zones) ? next : { ...next, zoneId: '' };
}
export const toggleZone = (fields: ConcernFields, zoneId: string): ConcernFields => ({ ...fields, zoneId: fields.zoneId === zoneId ? '' : zoneId });

/**
 * Validates a concern before anything is uploaded (A33-030). Title, description, address and
 * area limits come from the shared schema so the client and the server rules cannot drift; the
 * location must be a chosen point inside the barangay boundary.
 */
export function validateConcern(input: {
  fields: ConcernFields; position: LatLng | null; boundary: Boundary; photoCount: number;
  categories: readonly IncidentCategory[]; zones: readonly WasteZone[];
}): ConcernErrors {
  const { fields, position, boundary, photoCount, categories, zones } = input;
  const errors: ConcernErrors = {};
  if (!categories.some((category) => category.id === fields.categoryId)) errors.category = 'Choose a category for your report.';
  if (fields.zoneId && (!zoneApplies(fields, categories, zones) || !zones.some((zone) => zone.id === fields.zoneId))) errors.zone = 'Choose a collection zone from the list, or clear it.';
  const parsed = incidentReportSchema.safeParse({
    title: fields.title.trim(),
    categoryId: fields.categoryId || '00000000-0000-4000-8000-000000000000',
    description: fields.description.trim() || undefined,
    photoUrls: [],
    location: position ?? { lat: 0, lng: 0 },
    address: fields.address.trim() || undefined,
    specificAreaDetails: fields.specificArea.trim() || undefined,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === 'title') errors.title ??= fields.title.trim() ? issue.message : 'Enter a title for your report.';
      else if (key === 'description') errors.description ??= issue.message;
      else if (key === 'address') errors.address ??= issue.message;
      else if (key === 'specificAreaDetails') errors.specificArea ??= issue.message;
    }
  }
  if (!position) errors.location = 'Pin the location of the concern on the map or use your device location.';
  else if (!boundary) errors.location = 'Your barangay boundary is not available right now, so the location cannot be checked.';
  else if (!isPointInPolygon(position, boundary)) errors.location = 'That spot is outside your barangay boundary. Move the pin inside the outlined area.';
  if (photoCount > PHOTO_MAX) errors.photos = `A report can have at most ${PHOTO_MAX} photos.`;
  return errors;
}

/** The server row for a validated concern; `photoUrls` are the public URLs of photos already uploaded. */
export function buildConcern(id: string, fields: ConcernFields, position: LatLng, photoUrls: readonly string[]): ConcernInsert {
  return {
    id, categoryId: fields.categoryId, zoneId: fields.zoneId || null, title: fields.title.trim(),
    description: fields.description.trim() || null, photoUrls: [...photoUrls], location: { lat: position.lat, lng: position.lng },
    address: fields.address.trim() || null, specificAreaDetails: fields.specificArea.trim() || null,
  };
}

/** Shown before submission: scope of the form and who can see a report (handoff D15). */
export const EMERGENCY_NOTICE = 'This form is not for emergencies and is not monitored around the clock. If someone is in danger, contact emergency services or your barangay hotline directly.';
export const VISIBILITY_NOTICE = 'Barangay staff review reports. A report, its photos and its pinned location may be visible to others in your barangay. Do not include private or sensitive details.';
