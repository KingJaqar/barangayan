'use client';

/**
 * Web port of resident-android-mobile's settings/about.tsx: Mission / Vision / History /
 * Contact section cards plus a Development Team list, sourced from `about_us` +
 * `developer_profiles`. react-markdown replaces react-native-markdown-display.
 */

import { BookOpen, Eye, Flag, Info, Mail, MapPin, Phone, Users } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

import { useAboutUs } from '@/hooks/use-about-us';

const markdownComponents = {
  p: (props: React.ComponentProps<'p'>) => <p className="mb-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300" {...props} />,
  strong: (props: React.ComponentProps<'strong'>) => <strong className="font-semibold" {...props} />,
  ul: (props: React.ComponentProps<'ul'>) => <ul className="mb-2 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300" {...props} />,
};

function SectionCard({
  icon,
  title,
  children,
  className = '',
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900 ${className}`}>
      <div className="flex items-center gap-2.5 p-4 pb-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-tint)] text-[var(--accent)]">
          {icon}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="border-t border-black/[0.06] px-4 pb-4 pt-2.5 dark:border-white/[0.06]">{children}</div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <span className="h-8 w-8 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        <span className="h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <span className="block h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <span className="block h-3 w-4/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

export function AboutClient({ barangayId }: { barangayId: string }) {
  const { about, developers, isLoading } = useAboutUs(barangayId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-center py-4">
          <span className="h-20 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }

  if (!about) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <Info size={26} className="text-zinc-400" />
        </span>
        <p className="text-base font-semibold">About Us</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">About Us content is not yet available.</p>
      </div>
    );
  }

  const hasContact = about.contact_email || about.contact_phone || about.address;

  return (
    <div className="space-y-4">
      {(about.logo_url || about.title) ? (
        <div className="flex flex-col items-center gap-2 py-1">
          {about.logo_url ? (
            <div
              className="flex items-center justify-center rounded-full border-[3px] border-[var(--accent)]/30 p-1"
              style={{ width: about.logo_size + 10, height: about.logo_size + 10 }}>
              <Image
                src={about.logo_url}
                alt="Barangay logo"
                width={about.logo_size}
                height={about.logo_size}
                className="rounded-full object-cover"
                style={{ width: about.logo_size, height: about.logo_size }}
                unoptimized
              />
            </div>
          ) : null}
          {about.title ? (
            <p className="text-lg font-bold tracking-wide">{about.title}</p>
          ) : null}
        </div>
      ) : null}

      {about.mission || about.vision ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {about.mission ? (
            <SectionCard icon={<Flag size={16} />} title="Mission">
              <ReactMarkdown components={markdownComponents}>{about.mission}</ReactMarkdown>
            </SectionCard>
          ) : null}

          {about.vision ? (
            <SectionCard icon={<Eye size={16} />} title="Vision">
              <ReactMarkdown components={markdownComponents}>{about.vision}</ReactMarkdown>
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {about.history ? (
        <SectionCard icon={<BookOpen size={16} />} title="History">
          <ReactMarkdown components={markdownComponents}>{about.history}</ReactMarkdown>
        </SectionCard>
      ) : null}

      {hasContact || developers.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {hasContact ? (
            <SectionCard icon={<Phone size={16} />} title="Contact">
              <div className="space-y-2">
                {about.contact_email ? (
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <Mail size={14} className="text-zinc-500" />
                    </span>
                    <span className="truncate">{about.contact_email}</span>
                  </div>
                ) : null}
                {about.contact_phone ? (
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <Phone size={14} className="text-zinc-500" />
                    </span>
                    {about.contact_phone}
                  </div>
                ) : null}
                {about.address ? (
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <MapPin size={14} className="text-zinc-500" />
                    </span>
                    {about.address}
                  </div>
                ) : null}
              </div>
            </SectionCard>
          ) : null}

          {developers.length > 0 ? (
            <SectionCard icon={<Users size={16} />} title="Development Team" className={hasContact ? '' : 'lg:col-span-2'}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {developers.map((dev) => (
              <div key={dev.id} className="flex items-start gap-3 rounded-lg bg-zinc-50 p-2.5 transition-colors hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800">
                {dev.photo_url ? (
                  <Image
                    src={dev.photo_url}
                    alt={dev.name}
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-tint)] text-[var(--accent)]">
                    <Users size={18} />
                  </span>
                )}
                <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                  <p className="text-sm font-semibold">{dev.name}</p>
                  {dev.role ? (
                    <span className="inline-block rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]">
                      {dev.role}
                    </span>
                  ) : null}
                  {dev.bio ? <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{dev.bio}</p> : null}
                </div>
              </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
