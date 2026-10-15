import { cookies } from 'next/headers';
import { AdminLoginForm } from './login-form';

export default async function AdminLoginPage() {
  const notice = (await cookies()).get('barangayan-profile-password-notice')?.value;
  return <AdminLoginForm profilePasswordNotice={notice === 'changed' || notice === 'cleanup_pending' || notice === 'review_required' ? notice : undefined} />;
}
