import { ZodError } from 'zod';
import { classifyFailure, DataError, type FailureKind } from '../data/outcome';

export class PublicError extends Error {}

/** Code-specific copy from the existing contracts; codes win over the generic kind copy. */
const CODE_MESSAGES: Record<string, string> = {
  '23505': 'This may already have been submitted. Refresh your records before trying again.',
  P0002: 'This activity is no longer available.',
  P0003: 'There are no remaining slots for this activity.',
  P0004: 'You are already registered for this activity.',
  P0005: 'Registration for this drive is closed because its date has passed.',
  registration_profile_required: 'Complete your profile in Settings before registering for a drive.',
  P0010: 'This action is not available for your account or barangay.',
  P0011: 'This action is not available for your account or barangay.',
  P0012: 'This action is not available for your account or barangay.',
  invalid_credentials: 'The email or password is incorrect.',
  // Payment methods, pickup payments and page counts (B09).
  payment_method_locked: 'The payment method can no longer be changed because a payment is in progress or complete. Open the request to see its payment.',
  active_online_payment_exists: 'A QR PH payment is already in progress for this request. Continue or cancel it first.',
  request_amount_unavailable: 'The amount for this request is not confirmed yet, so it cannot be paid.',
  request_not_payable: 'This request can no longer be paid.',
  pickup_only_document: 'This document can only be paid in cash at pickup.',
  invalid_total_pages: 'Enter a whole number of pages between 1 and 1,000,000.',
  page_count_locked: 'The page count can no longer be changed for this request.',
  // Concerns: filing, corroboration and withdrawal (B11).
  incident_own_report: 'You filed this report, so you cannot confirm it.',
  incident_not_found: 'This report is no longer available. It may have been withdrawn or removed.',
  incident_not_yours: 'Only the resident who filed a report can withdraw it.',
  incident_not_open: 'This report can no longer be withdrawn because it is already being handled or closed.',
  incident_window_closed: 'This report can no longer be withdrawn because the 24-hour withdrawal period has ended.',
  incident_photo_invalid: 'One of the photos could not be accepted. Remove it and add it again.',
  incident_photo_limit: 'A report can have at most 5 photos.',
  incident_category_invalid: 'The selected category is no longer available. Choose another category.',
  incident_zone_invalid: 'The selected collection zone is no longer available. Choose another zone or clear it.',
  profile_completion_required: 'Complete your profile in Settings before sending a report.',
  incident_state_invalid: 'This report could not be filed. Refresh and try again.',
  // Evacuation-center check-in (B14).
  checkin_not_resident: 'Only a resident account can check in to an evacuation center.',
  checkin_wrong_barangay: 'This QR code belongs to a different barangay, so you cannot check in with it.',
  checkin_center_unavailable: 'This evacuation center is not open for check-in, or it no longer exists. Ask center staff for help.',
  authentication_required: 'Your session has expired. Sign in again.',
  // QR PH payment functions (B10).
  qr_request_closed: 'This request can no longer be paid. It may have been cancelled or completed.',
  qr_pickup_only: 'This document can only be paid in cash at pickup.',
  qr_pages_required: 'Enter the total pages of your request before paying.',
  qr_unavailable: 'QR PH is not available for this request. Pay at pickup instead.',
  qr_method_not_selected: 'Choose QR PH as the payment method for this request first.',
  qr_preparing: 'A QR PH code is being prepared. Wait a moment, then check again.',
  qr_below_minimum: 'QR PH needs an amount of at least ₱1.00. Pay at pickup instead.',
  qr_close_failed: 'An earlier QR payment could not be safely closed. Contact the barangay office before trying again.',
  qr_ineligible: 'This request is no longer eligible for a QR PH payment.',
  qr_provider: 'The payment provider could not create the QR code. Try again in a moment, or pay at pickup.',
  qr_not_activated: 'QR PH is not available right now. Pay at pickup instead.',
  payment_already_completed: 'This payment already went through. Refresh to see it.',
  qr_amount_mismatch: 'The provider amount does not match the recorded payment. Contact the barangay office.',
  qr_not_found: 'This request or payment is not available to this account.',
};

const KIND_MESSAGES: Record<FailureKind, string> = {
  cancelled: 'This action was cancelled.',
  offline: 'You appear to be offline. Check your connection and try again.',
  timeout: 'The server took too long to respond. Check your connection and try again.',
  session: 'Your session has expired. Sign in again.',
  authorization: 'You do not have access to this action. Refresh or contact your barangay.',
  'not-found': 'This record is no longer available.',
  conflict: 'This may already have been submitted. Refresh your records before trying again.',
  'rate-limited': 'Please wait a moment before trying again.',
  validation: 'Some details were not accepted. Check your entries and try again.',
  schema: 'The app received an unexpected response. Update the app or try again later.',
  http: 'The server could not complete this action. Try again later.',
  'unknown-commit': 'We could not confirm whether this was saved. Refresh your records before trying again.',
  // Raw provider errors can contain private data, URLs or internal SQL details.
  unknown: 'Unable to complete this action. Check your connection and retry. If you submitted a form, refresh your records first.',
};

export function residentError(error: unknown): string {
  if (error instanceof ZodError) return error.issues.map((issue) => issue.message).join('\n');
  if (error instanceof PublicError) return error.message;
  const code = error instanceof DataError ? error.code ?? '' : error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (code.includes('rate_limit')) return KIND_MESSAGES['rate-limited'];
  return KIND_MESSAGES[classifyFailure(error)];
}
