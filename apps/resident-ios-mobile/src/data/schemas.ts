import { z } from 'zod';

/**
 * Resident-safe response contracts (plan B.1, OD-02 boundary rule). Each read selects an
 * explicit column list and parses it here, so a missing/renamed column, a wrong type or
 * an unexpected null is a `schema` failure instead of a silently broken screen. Unknown
 * extra fields are stripped. Columns are only the ones a screen actually renders.
 */
const id = z.string().uuid();
const text = z.string();
const timestamp = z.string().min(1);
const count = z.number().int().min(0);

export const barangayRow = z.object({ id, name: text });
export const BARANGAY_COLUMNS = 'id,name';

export const documentRow = z.object({
  id,
  name: text,
  description: text.nullable(),
  fee_centavos: count,
  processing_target_hours: z.number().min(0),
  requirements: z.array(text),
});
export const DOCUMENT_COLUMNS = 'id,name,description,fee_centavos,processing_target_hours,requirements';

const documentName = z.object({ name: text }).nullable();
export const requestListRow = z.object({
  id,
  reference_number: text,
  status: text,
  payment_status: text,
  created_at: timestamp,
  document_types: documentName,
});
export const REQUEST_LIST_COLUMNS = 'id,reference_number,status,payment_status,created_at,document_types(name)';

export const requestDetailRow = requestListRow.extend({
  payment_method: text.nullable(),
  requester_notes: text.nullable(),
  updated_at: timestamp,
});
export const REQUEST_DETAIL_COLUMNS = `${REQUEST_LIST_COLUMNS},payment_method,requester_notes,updated_at`;
export const requestStatusRow = z.object({ status: text });
export const createdRequestRow = z.object({ id });

export const announcementListRow = z.object({ id, title: text, category: text, published_at: timestamp });
export const ANNOUNCEMENT_LIST_COLUMNS = 'id,title,category,published_at';
export const announcementDetailRow = announcementListRow.extend({ body: text, detailed_description: text.nullable() });
export const ANNOUNCEMENT_DETAIL_COLUMNS = `${ANNOUNCEMENT_LIST_COLUMNS},body,detailed_description`;

export const driveRow = z.object({
  id,
  title: text,
  type: text.min(1),
  drive_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_start: z.string().regex(/^\d{2}:\d{2}/),
  time_end: z.string().regex(/^\d{2}:\d{2}/),
  location: text,
  eligible_criteria: text,
  stock_remaining: z.number().int(),
  stock_unit: text,
});
export const DRIVE_COLUMNS = 'id,title,type,drive_date,time_start,time_end,location,eligible_criteria,stock_remaining,stock_unit';
export const driveRegistrationRow = z.object({ id, applicant_number: text, status: text });

export const centerRow = z.object({
  id,
  name: text,
  address: text.nullable(),
  contact_number: text.nullable(),
  current_occupancy: count,
  capacity: count.nullable(),
});
export const CENTER_COLUMNS = 'id,name,address,contact_number,current_occupancy,capacity';

export const emergencyInformationRow = z.object({ id, category: text, title: text, body: text });
export const EMERGENCY_INFORMATION_COLUMNS = 'id,category,title,body';

export const siteContentRow = z.object({ id, section: text, title: text, body: text });
export const SITE_CONTENT_COLUMNS = 'id,section,title,body';

export const faqRow = z.object({ id, category: text, question: text, answer: text });
export const FAQ_COLUMNS = 'id,category,question,answer';


/** The resident's own barangay with its boundary and configured locality (profile and location screens). */
const localityRow = z.object({ display_name: text, city: text.nullable(), province: text.nullable() });
export const barangayProfileRow = z.object({
  name: text,
  boundary: z.unknown(),
  barangay_localities: z.union([localityRow, z.array(localityRow), z.null()]),
});
export const BARANGAY_PROFILE_COLUMNS = 'name,boundary,barangay_localities(display_name,city,province)';

/** The resident's newest ID version (own rows only, by row-level security and the explicit owner filter). */
export const idSubmissionRow = z.object({
  id,
  version: z.number().int().min(1),
  id_type: text,
  front_path: text,
  back_path: text.nullable(),
  decision: text,
  submitted_at: timestamp,
  reviewed_at: timestamp.nullable(),
  rejection_reason: text.nullable(),
});
export const ID_SUBMISSION_COLUMNS = 'id,version,id_type,front_path,back_path,decision,submitted_at,reviewed_at,rejection_reason';
