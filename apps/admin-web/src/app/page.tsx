import { redirect } from 'next/navigation';

// Root just forwards into the admin flow — (admin)/layout.tsx's own guard sends
// unauthenticated visitors on to /login, and authenticated admins land on /dashboard.
export default function RootPage() {
  redirect('/dashboard');
}
