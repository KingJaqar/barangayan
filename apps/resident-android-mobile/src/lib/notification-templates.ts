import type { Tables } from '@barangayan/shared';

const BODY_TRUNCATE_LENGTH = 100;

function truncate(text: string, length = BODY_TRUNCATE_LENGTH): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1)}…`;
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
