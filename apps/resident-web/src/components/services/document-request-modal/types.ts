import type { Tables } from '@barangayan/shared';

export type DocumentType = Tables<'document_types'>;

export interface SuccessPayload {
  amountCentavos: number;
  documentFeeCentavos: number;
  method: string;
  sourceId: string | null;
}
