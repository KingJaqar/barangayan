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

/**
 * A catalogue entry (B06). The contract-version-2 fields are kept loose here on purpose:
 * one misconfigured charter must not fail the whole page, so `features/services/catalog.ts`
 * validates them per entry and reports an unrequestable service instead.
 */
export const documentRow = z.object({
  id,
  name: text,
  description: text.nullable(),
  fee_centavos: count,
  processing_target_hours: z.number().min(0),
  requirements: z.array(text),
  contract_version: z.number().int().min(1),
  service_kind: text.nullable(),
  charter: z.unknown(),
  purposes: z.unknown(),
  requirement_rules: z.unknown(),
  pricing_mode: text,
  processing_target_minutes: z.number().int().min(0).nullable(),
});
export const DOCUMENT_COLUMNS = 'id,name,description,fee_centavos,processing_target_hours,requirements,contract_version,service_kind,charter,purposes,requirement_rules,pricing_mode,processing_target_minutes';

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

/** A recorded payment attempt of a request; the ledger amount wins over any catalogue price. */
const paymentRow = z.object({ document_fee_centavos: count.nullable(), amount_centavos: count, status: text, method: text });
const PAYMENT_EMBED = 'payments(document_fee_centavos,amount_centavos,status,method)';
const feeDocument = z.object({ name: text, fee_centavos: count, processing_target_hours: z.number().min(0), service_kind: text.nullable() }).nullable();

/**
 * Everything the tracking screen renders (B07). Columns are the request's own submission
 * and timing snapshots, so history is never rebuilt from the current catalogue.
 */
export const requestDetailRow = requestListRow.extend({
  document_types: feeDocument,
  payment_method: text.nullable(),
  requester_notes: text.nullable(),
  updated_at: timestamp,
  contract_version: z.number().int(),
  timing_model: text,
  target_minutes_snapshot: z.number().int().nullable(),
  sla_state: text,
  purpose_label: text.nullable(),
  purpose_explanation: text.nullable(),
  supporting_details: z.unknown(),
  status_history: z.unknown(),
  fee_assessment_state: text,
  assessed_amount_centavos: count.nullable(),
  legacy_fee_centavos: count.nullable(),
  fee_basis: text.nullable(),
  billable_pages: z.number().int().nullable(),
  requirements_review_state: text,
  requirements_review_note: text.nullable(),
  personal_appearance_required: z.boolean(),
  approved_id_submission_id: id.nullable(),
  payments: z.array(paymentRow),
});
export const REQUEST_DETAIL_COLUMNS = `id,reference_number,status,payment_status,created_at,document_types(name,fee_centavos,processing_target_hours,service_kind),payment_method,requester_notes,updated_at,contract_version,timing_model,target_minutes_snapshot,sla_state,purpose_label,purpose_explanation,supporting_details,status_history,fee_assessment_state,assessed_amount_centavos,legacy_fee_centavos,fee_basis,billable_pages,requirements_review_state,requirements_review_note,personal_appearance_required,approved_id_submission_id,${PAYMENT_EMBED}`;

/** One row of the activity view: the latest state of a request, ordered by its last update. */
export const activityRow = requestListRow.extend({
  document_types: z.object({ name: text, fee_centavos: count }).nullable(),
  updated_at: timestamp,
  contract_version: z.number().int(),
  fee_assessment_state: text,
  assessed_amount_centavos: count.nullable(),
  legacy_fee_centavos: count.nullable(),
  payments: z.array(paymentRow),
});
export const ACTIVITY_COLUMNS = `id,reference_number,status,payment_status,created_at,updated_at,contract_version,fee_assessment_state,assessed_amount_centavos,legacy_fee_centavos,document_types(name,fee_centavos),${PAYMENT_EMBED}`;

/** The submitted supporting files of a request (names and types only; the objects stay private). */
export const requestAttachmentRow = z.object({ id, requirement_code: text, mime_type: text, size_bytes: count, created_at: timestamp });
export const REQUEST_ATTACHMENT_COLUMNS = 'id,requirement_code,mime_type,size_bytes,created_at';

/** B07 `service_request_sla_tracking`: server evaluation time plus the request's timing snapshot and pauses. */
export const slaTrackingRow = z.object({
  request: z.object({
    timing_model: text,
    target_minutes_snapshot: z.number().nullable(),
    sla_state: text,
    created_at: timestamp,
    accepted_at: timestamp.nullable(),
    ready_at: timestamp.nullable(),
    released_at: timestamp.nullable(),
    cancelled_at: timestamp.nullable(),
  }),
  pauses: z.array(z.object({ started_at: timestamp, resumed_at: timestamp.nullable(), reason: text })),
  evaluated_at: timestamp,
});
export const requestStatusRow = z.object({ status: text });

/**
 * One payment attempt of an own request (B09/B10) without its QR image: status, method, the
 * ledger amounts and the provider references. Residents can read these rows and never write them.
 */
export const paymentAttemptRow = z.object({
  id,
  method: text,
  status: text,
  amount_centavos: count,
  document_fee_centavos: count.nullable(),
  expires_at: timestamp.nullable(),
  paid_at: timestamp.nullable(),
  created_at: timestamp,
});
export const PAYMENT_ATTEMPT_COLUMNS = 'id,method,status,amount_centavos,document_fee_centavos,expires_at,paid_at,created_at';
/** A pending QR PH attempt including its QR image, read only to reconcile a lost creation reply. */
export const qrAttemptRow = paymentAttemptRow.extend({ qr_image_url: text.nullable(), paymongo_payment_intent_id: text.nullable() });
export const QR_ATTEMPT_COLUMNS = `${PAYMENT_ATTEMPT_COLUMNS},qr_image_url,paymongo_payment_intent_id`;
export const paymentStatusRow = z.object({ status: text });
/** The fields a lost payment write is reconciled against. */
export const requestPaymentStateRow = z.object({
  payment_method: text.nullable(),
  billable_pages: z.number().int().nullable(),
  fee_assessment_state: text,
  payments: z.array(z.object({ method: text, status: text })),
});
export const REQUEST_PAYMENT_STATE_COLUMNS = 'payment_method,billable_pages,fee_assessment_state,payments(method,status)';
/** The committed paid payment with the request it settles; the receipt never reads route parameters. */
export const paidReceiptRow = paymentAttemptRow.extend({
  paymongo_payment_id: text.nullable(),
  paymongo_source_id: text.nullable(),
  paymongo_payment_intent_id: text.nullable(),
  service_requests: z.object({ reference_number: text, document_types: z.object({ name: text }).nullable() }),
});
export const PAID_RECEIPT_COLUMNS = `${PAYMENT_ATTEMPT_COLUMNS},paymongo_payment_id,paymongo_source_id,paymongo_payment_intent_id,service_requests!inner(reference_number,document_types(name))`;

/** The signed-in resident's own read markers, embedded per announcement (RLS limits them to the owner). */
const ownAnnouncementReads = z.array(z.object({ resident_id: id }));
export const announcementListRow = z.object({ id, title: text, category: text, published_at: timestamp, body: text, announcement_reads: ownAnnouncementReads.optional() });
export const ANNOUNCEMENT_LIST_COLUMNS = 'id,title,category,published_at,body';
export const announcementDetailRow = announcementListRow.extend({ detailed_description: text.nullable(), image_url: text.nullable() });
export const ANNOUNCEMENT_DETAIL_COLUMNS = `${ANNOUNCEMENT_LIST_COLUMNS},detailed_description,image_url`;
/** Only the id and the owner's read markers: enough to snapshot which announcements are unread. */
export const announcementUnreadRow = z.object({ id, announcement_reads: ownAnnouncementReads });
/** Embedded read markers, selected only for a signed-in resident. */
export const ANNOUNCEMENT_READS_COLUMN = 'announcement_reads(resident_id)';

/** One of the resident's own incident reports as a list card (B11); photo URLs are validated before they are shown. */
export const incidentListRow = z.object({
  id, title: text, description: text.nullable(), status: text, created_at: timestamp, resolved_read_at: timestamp.nullable(),
  photo_urls: z.array(text), incident_categories: z.object({ name: text }).nullable(),
});
export const INCIDENT_LIST_COLUMNS = 'id,title,description,status,created_at,resolved_read_at,photo_urls,incident_categories(name)';
export const incidentIdRow = z.object({ id });

/** B11 the barangay's configured concern categories and waste zones, for the report form. */
export const incidentCategoryRow = z.object({ id, name: text, color: text, icon: text.nullable(), is_trash_related: z.boolean() });
export const INCIDENT_CATEGORY_COLUMNS = 'id,name,color,icon,is_trash_related';
export const wasteZoneRow = z.object({ id, name: text });
export const WASTE_ZONE_COLUMNS = 'id,name';
/**
 * One concern in full (B11). `reporter_id` is read only to decide whether the viewer filed it;
 * the data layer drops it, so a reporter's identity never reaches a screen or a cache.
 */
export const incidentDetailRow = z.object({
  id, title: text, description: text.nullable(), status: text, created_at: timestamp, updated_at: timestamp,
  address: text.nullable(), specific_area_details: text.nullable(), location: z.unknown(), photo_urls: z.array(text),
  confirmation_count: count, reporter_id: id.nullable(),
  incident_categories: z.object({ name: text, color: text, icon: text.nullable() }).nullable(),
});
export const INCIDENT_DETAIL_COLUMNS = 'id,title,description,status,created_at,updated_at,address,specific_area_details,location,photo_urls,confirmation_count,reporter_id,incident_categories(name,color,icon)';
export const confirmationRow = z.object({ incident_id: id });

/** One of the resident's own concerns as a Maps marker; `location` is read through `readPoint`. */
export const incidentMapRow = z.object({
  id, title: text, status: text, created_at: timestamp, location: z.unknown(), category_id: id.nullable(),
  incident_categories: z.object({ name: text, color: text }).nullable(),
});
export const INCIDENT_MAP_COLUMNS = 'id,title,status,created_at,location,category_id,incident_categories(name,color)';

export const driveRow = z.object({
  id,
  title: text,
  type: text.min(1),
  drive_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_start: z.string().regex(/^\d{2}:\d{2}/),
  time_end: z.string().regex(/^\d{2}:\d{2}/),
  location: text,
  eligible_criteria: text,
  stock_label: text,
  stock_unit: text,
  stock_total: z.number().int(),
  stock_remaining: z.number().int(),
});
export const DRIVE_COLUMNS = 'id,title,type,drive_date,time_start,time_end,location,eligible_criteria,stock_label,stock_unit,stock_total,stock_remaining';

/** The registration lifecycle, in the order a registration moves through it (`drive_registration_status`). */
export const REGISTRATION_STATUSES = ['pending', 'confirmed', 'attended', 'cancelled'] as const;
const registrationStatus = z.enum(REGISTRATION_STATUSES);
/**
 * A resident's own registration with its drive. The submitted health answers and the administrator-only
 * priority score are deliberately not selected: the history shows what the barangay did with the
 * registration, not the medical details the resident typed. `drive` is null when the drive is no longer listed.
 */
export const registrationRow = z.object({
  id,
  drive_id: id,
  applicant_number: text,
  status: registrationStatus,
  created_at: timestamp,
  updated_at: timestamp,
  drive: driveRow.extend({ barangay_id: id }).nullable(),
});
export const REGISTRATION_COLUMNS = `id,drive_id,applicant_number,status,created_at,updated_at,drive:medical_drives(${DRIVE_COLUMNS},barangay_id)`;
/** Enough of each own registration to count by status and to mark a drive as already registered. */
export const registrationSummaryRow = z.object({ id, drive_id: id, status: registrationStatus });
export const REGISTRATION_SUMMARY_COLUMNS = 'id,drive_id,status';
/** What a lost registration reply is reconciled against. */
export const driveRegistrationRow = z.object({ id, applicant_number: text, status: registrationStatus, created_at: timestamp });
export const DRIVE_REGISTRATION_RECONCILE_COLUMNS = 'id,applicant_number,status,created_at';

export const centerRow = z.object({
  id,
  name: text,
  address: text.nullable(),
  contact_number: text.nullable(),
  current_occupancy: count,
  capacity: count.nullable(),
  /** `{ lat, lng }` JSON, read through `readPoint` so one malformed point never fails the whole list. */
  position: z.unknown(),
  /** Operator-entered facility keys; unknown keys are shown by `features/centers/center-model.ts`, never dropped. */
  facilities: z.array(text),
  verified: z.boolean(),
  /** Routing availability (`available` | `unknown` | `unavailable`), kept loose so a new value cannot fail the list. */
  availability: text,
  /** When occupancy and the other operational facts last changed. */
  updated_at: timestamp,
});
export const CENTER_COLUMNS = 'id,name,address,contact_number,current_occupancy,capacity,position,facilities,verified,availability,updated_at';

/**
 * Guidelines and hotlines (B13). `content` is operator-written JSON — strings for a guideline,
 * `{ label, number }` for a hotline — validated entry by entry in `features/emergency/content.ts`,
 * so one malformed entry never hides the rest of the hub.
 */
export const emergencyInformationRow = z.object({
  id, category: text, title: text, body: text,
  icon: text, icon_color: text, icon_bg: text, content: z.unknown(), sort_order: z.number().int(),
});
export const EMERGENCY_INFORMATION_COLUMNS = 'id,category,title,body,icon,icon_color,icon_bg,content,sort_order';

/** Terms of Service and Privacy Policy (`site_content`), with the instant the barangay last published each. */
export const siteContentRow = z.object({ id, section: text, title: text, body: text, updated_at: timestamp });
export const SITE_CONTENT_COLUMNS = 'id,section,title,body,updated_at';

/** About Us (`about_us`) and its developer cards (`developer_profiles`). Addresses are table values: screens validate them before use. */
export const aboutUsRow = z.object({
  id, title: text, mission: text, vision: text, history: text,
  contact_email: text.nullable(), contact_phone: text.nullable(), address: text.nullable(), logo_url: text.nullable(), updated_at: timestamp,
});
export const ABOUT_US_COLUMNS = 'id,title,mission,vision,history,contact_email,contact_phone,address,logo_url,updated_at';
export const developerRow = z.object({ id, name: text, role: text, bio: text, photo_url: text.nullable(), sort_order: z.number().int() });
export const DEVELOPER_COLUMNS = 'id,name,role,bio,photo_url,sort_order';

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

/**
 * QR check-in guidance (B13): the "why scan" card and the "how it works" steps. `content` is operator-written
 * JSON validated step by step in `features/qr/guide.ts`, so one malformed step never hides the rest.
 */
export const emergencyQrContentRow = z.object({
  id, section: text, title: text, body: text, content: z.unknown(), icon: text.nullable(), icon_color: text.nullable(), icon_bg: text.nullable(), sort_order: z.number().int(),
});
export const EMERGENCY_QR_COLUMNS = 'id,section,title,body,content,icon,icon_color,icon_bg,sort_order';

/** A legacy scan log, retained for compatibility; it is not staff-confirmed attendance. */
export const ownCheckInRow = z.object({
  id, evacuation_center_id: id, checked_in_at: timestamp, evacuation_centers: z.object({ name: text }).nullable(),
});
export const OWN_CHECKIN_COLUMNS = 'id,evacuation_center_id,checked_in_at,evacuation_centers(name)';

/**
 * One inbox entry (B18, migration 0135). `kind` and `destination` are kept loose on purpose: a kind or destination this app
 * version does not know must show as a plain, unopenable entry instead of failing the whole page. `features/notifications`
 * validates both per entry.
 */
export const inboxRow = z.object({ id, kind: text, title: text, body: text, destination: z.unknown(), created_at: timestamp, read_at: timestamp.nullable() });
export const INBOX_COLUMNS = 'id,kind,title,body,destination,created_at,read_at';
export const inboxIdRow = z.object({ id });
/** The resident's saved per-kind phone-alert switches; an absent row means every kind is on. */
export const notificationPreferencesRow = z.object({ kinds: z.record(z.boolean()) });
/** What `set_notification_preferences` returns: the global switch and the merged per-kind map. */
export const savedPreferencesRow = z.object({ push_enabled: z.boolean(), kinds: z.record(z.boolean()) });
