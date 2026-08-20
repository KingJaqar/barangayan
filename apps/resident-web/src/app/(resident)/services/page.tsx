import { redirect } from 'next/navigation';

// Bare /services has no content of its own — Documents is the default segment, same as
// mobile's ServicesScreen (initialSegment defaults to 'documents').
export default function ServicesPage() {
  redirect('/services/documents');
}
