/**
 * Image locations are data from a table, so a value is shown only when it is an https address.
 * A report photo must also be an object of this project's public `incident-photos` bucket; a
 * resident-controlled row can therefore not make the app fetch an arbitrary host.
 */
const INCIDENT_PHOTO_PREFIX = '/storage/v1/object/public/incident-photos/';

function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url : null;
  } catch {
    return null;
  }
}

/** A short single-line preview of an announcement body for a list card. */
export function announcementPreview(body: string, max = 140): string {
  const text = body.replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/** The announcement image address, or null when it is missing or not a plain https URL. */
export function announcementImage(value: string | null | undefined): string | null {
  return value ? httpsUrl(value)?.toString() ?? null : null;
}

/** Every report photo that belongs to this project's incident-photos bucket, in stored order. */
export function incidentPhotos(values: readonly string[], projectUrl: string): string[] {
  const project = httpsUrl(projectUrl);
  if (!project) return [];
  const shown: string[] = [];
  for (const value of values) {
    const url = httpsUrl(value);
    if (url && url.origin === project.origin && url.pathname.startsWith(INCIDENT_PHOTO_PREFIX) && url.pathname.length > INCIDENT_PHOTO_PREFIX.length) shown.push(url.toString());
  }
  return shown;
}

/** The first report photo that belongs to this project's incident-photos bucket, or null. */
export function incidentPhoto(values: readonly string[], projectUrl: string): string | null {
  return incidentPhotos(values, projectUrl)[0] ?? null;
}
