import { ArrowLeft, Bell, FileText, Megaphone } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { RegisterForm } from './register-form';

const BRAND_HIGHLIGHTS = [
  { title: 'Request documents', icon: FileText },
  { title: 'Report incidents', icon: Megaphone },
  { title: 'Stay informed', icon: Bell },
] as const;

/**
 * Same brand-panel + form split as /login (see login/page.tsx) — kept as two separate
 * files rather than a shared layout because the two panels' content (tagline vs.
 * "Already have an account?", the panel width, the sticky behavior below) differs
 * enough that a shared abstraction would just be a thin wrapper passing both back
 * through as children.
 *
 * The brand panel is `lg:sticky` (register's form column runs much taller than the
 * viewport, unlike login's) so it stays put while the long field list scrolls past it,
 * rather than being stretched into a very tall, mostly-empty column.
 */
export default function RegisterPage() {
  return (
    <div className="flex min-h-full flex-1">
      {/* Brand panel — hidden below lg, where there's no room for a second column. */}
      <div className="relative hidden w-[38%] flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:sticky lg:top-0 lg:flex lg:h-screen xl:w-1/3">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, white 1.5px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <Link
          href="/home"
          className="relative inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary-foreground/80 transition-colors hover:text-primary-foreground">
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <div className="relative">
          <Image
            src="/assets/logo/barangayan-logo-1024.png"
            alt="Barangayan logo"
            width={128}
            height={128}
            priority
            className="mb-5 h-28 w-28 object-contain"
          />
          <h1 className="text-3xl font-bold tracking-tight">Barangayan</h1>
          <p className="mt-2 max-w-xs text-sm text-primary-foreground/75">
            Create your account to request documents, report incidents, and stay connected with your community.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {BRAND_HIGHLIGHTS.map(({ title, icon: Icon }) => (
              <li key={title} className="flex items-center gap-3 text-sm text-primary-foreground/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15">
                  <Icon size={15} />
                </span>
                {title}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">&copy; {new Date().getFullYear()} Barangayan</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col px-6 py-8 sm:px-10 sm:py-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/home"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:hidden">
              <ArrowLeft size={16} />
              Back to Home
            </Link>
            <Image
              src="/assets/logo/barangayan-logo-1024.png"
              alt="Barangayan logo"
              width={96}
              height={96}
              priority
              className="h-20 w-20 object-contain lg:hidden"
            />
            <Link href="/login" className="ml-auto text-sm text-muted-foreground">
              Already have an account? <span className="font-medium text-primary hover:underline">Log in</span>
            </Link>
          </div>

          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
