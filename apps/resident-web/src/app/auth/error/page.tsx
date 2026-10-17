import Link from 'next/link';
import { NotificationSession } from '@/components/shared/notification-session';
export default function AuthErrorPage() {
  return <main className="mx-auto max-w-lg space-y-4 p-8"><NotificationSession userId={null} callbackOnly /><h1 className="text-xl font-semibold">Google sign-in could not be completed</h1><p>The request was cancelled, expired, or could not be verified. Check your connection and start sign-in again. Your existing account has been preserved.</p><Link className="block text-primary underline" href="/login">Return to login</Link><Link className="block text-primary underline" href="/settings/profile">Return to profile</Link></main>;
}
