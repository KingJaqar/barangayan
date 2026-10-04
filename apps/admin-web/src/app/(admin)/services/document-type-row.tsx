'use client';

import type { Tables } from '@barangayan/shared';
import { ServiceCatalogEditor } from './service-catalog-editor';

export function DocumentTypeRow({ documentType }: { documentType: Tables<'document_types'> }) {
  return <ServiceCatalogEditor documentType={documentType} />;
}
