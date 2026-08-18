import type { Tables } from '@barangayan/shared';

const BODY_TRUNCATE_LENGTH = 100;

function truncate(text: string, length = BODY_TRUNCATE_LENGTH): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1)}…`;
}

export function announcementTemplate(row: Tables<'announcements'>) {
  return {
    title: row.title,
    body: truncate(row.body ?? ''),
  };
}

export function driveRegistrationTemplate(
  row: Tables<'drive_registrations'>,
  driveTitle: string,
) {
  return {
    title: 'Registration Update',
    body: truncate(`Your application for "${driveTitle}" is now ${row.status}.`),
  };
}

export function medicalDriveTemplate(row: Tables<'medical_drives'>) {
  return {
    title: 'New Medical Drive',
    body: truncate(`"${row.title}" is now active on ${row.drive_date}.`),
  };
}

export function incidentTemplate(row: Tables<'incidents'>) {
  return {
    title: 'Incident Update',
    body: truncate(`Your reported incident "${row.title}" is now ${row.status}.`),
  };
}

export function serviceRequestTemplate(
  row: Tables<'service_requests'>,
  previous: Tables<'service_requests'> | null,
) {
  const paidJustNow = previous?.payment_status !== 'paid' && row.payment_status === 'paid';
  const body = paidJustNow
    ? `Your document request ${row.reference_number} payment was received.`
    : `Your document request ${row.reference_number} is ${row.status}.`;
  return {
    title: 'Request Update',
    body: truncate(body),
  };
}
