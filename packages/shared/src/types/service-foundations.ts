import type { Json } from './database';

export type CatalogFoundationFields = {
  contract_version: number;
  service_kind: string | null;
  charter: Json | null;
  purposes: NonNullable<Json>;
  requirement_rules: NonNullable<Json>;
  pricing_mode: string;
  processing_target_minutes: number | null;
}
export type ProfileFoundationFields = {
  province: string | null;
  profile_completed_at: string | null;
  current_id_submission_id: string | null;
  approved_id_submission_id: string | null;
  id_repair_required: boolean;
}
export type RequestFoundationFields = {
  legacy_fee_centavos: number | null;
  contract_version: number;
  idempotency_key: string | null;
  submission_payload: Json | null;
  purpose_code: string | null;
  purpose_label: string | null;
  purpose_explanation: string | null;
  supporting_details: Json | null;
  approved_id_submission_id: string | null;
  requirements_review_state: string;
  eligibility_state: string;
  requirements_reviewed_by: string | null;
  requirements_reviewed_at: string | null;
  requirements_review_note: string | null;
  personal_appearance_recorded_by: string | null;
  personal_appearance_required: boolean;
  personal_appearance_at: string | null;
  pricing_mode_snapshot: string | null;
  fee_assessment_state: string;
  assessed_amount_centavos: number | null;
  fee_basis: string | null;
  fee_assessed_by: string | null;
  fee_assessed_at: string | null;
  billable_pages: number | null;
  timing_model: string;
  target_minutes_snapshot: number | null;
  sla_state: string;
  accepted_at: string | null;
  ready_at: string | null;
  released_at: string | null;
  cancelled_at: string | null;
}
export type IdSubmissionRow = {
  evidence_origin: string;
  id: string; resident_id: string; barangay_id: string; version: number; id_type: string;
  front_path: string; back_path: string; submitted_at: string; decision: string;
  reviewed_by: string | null; reviewed_at: string | null; rejection_reason: string | null;
}
export type RequestAttachmentRow = {
  id: string; request_id: string; resident_id: string; barangay_id: string; requirement_code: string;
  object_path: string; mime_type: string; size_bytes: number; created_at: string;
}
export type ServiceRequestPauseRow = {
  id: string; request_id: string; reason: string; started_by: string; started_at: string;
  resumed_by: string | null; resumed_at: string | null;
}
/** Foundation tables are written exclusively through controlled operations. */
type ReadOnlyTable<Row, Relationships extends { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] }[] = []> = { Row: Row; Insert: never; Update: never; Relationships: Relationships };
export type FoundationTables = {
  service_request_sla_alerts: ReadOnlyTable<{
    id: string; request_id: string; threshold: 'near_target' | 'overdue';
    evaluated_at: string; agency_seconds: number;
  }, [
    { foreignKeyName: 'service_request_sla_alerts_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'service_requests'; referencedColumns: ['id'] },
  ]>;
  barangay_localities: ReadOnlyTable<{ barangay_id: string; display_name: string; city: string; province: string; resident_registration_enabled: boolean }, [
    { foreignKeyName: 'barangay_localities_barangay_id_fkey'; columns: ['barangay_id']; isOneToOne: true; referencedRelation: 'barangays'; referencedColumns: ['id'] },
  ]>;
  id_submissions: ReadOnlyTable<IdSubmissionRow, [
    { foreignKeyName: 'id_submissions_barangay_id_fkey'; columns: ['barangay_id']; isOneToOne: false; referencedRelation: 'barangays'; referencedColumns: ['id'] },
    { foreignKeyName: 'id_submissions_resident_id_fkey'; columns: ['resident_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
    { foreignKeyName: 'id_submissions_reviewed_by_fkey'; columns: ['reviewed_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
  ]>;
  request_attachments: ReadOnlyTable<RequestAttachmentRow, [
    { foreignKeyName: 'request_attachments_barangay_id_fkey'; columns: ['barangay_id']; isOneToOne: false; referencedRelation: 'barangays'; referencedColumns: ['id'] },
    { foreignKeyName: 'request_attachments_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'service_requests'; referencedColumns: ['id'] },
    { foreignKeyName: 'request_attachments_resident_id_fkey'; columns: ['resident_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
  ]>;
  service_request_pauses: ReadOnlyTable<ServiceRequestPauseRow, [
    { foreignKeyName: 'service_request_pauses_request_id_fkey'; columns: ['request_id']; isOneToOne: false; referencedRelation: 'service_requests'; referencedColumns: ['id'] },
    { foreignKeyName: 'service_request_pauses_resumed_by_fkey'; columns: ['resumed_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
    { foreignKeyName: 'service_request_pauses_started_by_fkey'; columns: ['started_by']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
  ]>;
};
type FoundationOperation = { Args: { p_input: Json }; Returns: string };
export type FoundationFunctions = {
  incomplete_profile_browsing_barangay: { Args: Record<string, never>; Returns: string | null };
  service_request_sla_tracking: { Args: { p_request_id: string }; Returns: Json };
  service_request_sla_metrics: { Args: { p_request_id: string; p_at?: string }; Returns: Json };
  service_sla_report_rows: { Args: Record<string, never>; Returns: Json };
  start_pickup_payment: { Args: { p_request_id: string }; Returns: string };
  collect_pickup_payment: { Args: { p_request_id: string }; Returns: string };
  complete_resident_profile: FoundationOperation;
  publish_id_submission: FoundationOperation;
  review_id_submission: FoundationOperation;
  submit_service_request: FoundationOperation;
  assess_service_request_fee: FoundationOperation;
  review_service_request: FoundationOperation;
  transition_service_request_sla: FoundationOperation;
};
