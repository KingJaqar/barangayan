export type ServiceRequestField =
  | 'purposeCode' | 'purposeExplanation' | 'businessName' | 'establishmentAddress'
  | 'recordReference' | 'copies' | 'totalPages' | 'personalAppearanceAcknowledged'
  | 'dti' | 'hoa' | 'lessor';

const fieldMessages: Record<ServiceRequestField, string> = {
  purposeCode: 'Choose a purpose for your request.',
  purposeExplanation: 'Explain the purpose of your request (up to 1,000 characters).',
  businessName: 'Enter the business name (up to 200 characters).',
  establishmentAddress: 'Enter the establishment address (up to 1,000 characters).',
  recordReference: 'Enter the record or document you need copied.',
  copies: 'Enter a whole number of copies between 1 and 1,000.',
  totalPages: 'Enter the total pages across all copies, between 1 and 1,000,000.',
  personalAppearanceAcknowledged: 'Confirm that you understand personal appearance at the Barangay Hall is required.',
  dti: 'Upload the required DTI registration.',
  hoa: 'Upload the required HOA certification.',
  lessor: 'Upload the lessor endorsement required for renters.',
};

/** Converts validation paths into field guidance without exposing validator messages. */
export function serviceRequestFieldErrors(failure: unknown): Partial<Record<ServiceRequestField, string>> {
  const errors: Partial<Record<ServiceRequestField, string>> = {};
  const issues = (failure as { issues?: { path?: (string | number)[] }[] } | null)?.issues;
  for (const issue of issues ?? []) {
    const field = issue.path?.[issue.path.length - 1];
    if (typeof field === 'string' && Object.prototype.hasOwnProperty.call(fieldMessages, field))
      errors[field as ServiceRequestField] = fieldMessages[field as ServiceRequestField];
  }
  return errors;
}
