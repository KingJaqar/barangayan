'use client';

/**
 * Web port of resident-android-mobile's settings/terms-privacy.tsx: same two
 * expandable sections (Terms of Service, Privacy Policy) sourced from `site_content`,
 * same "Content Coming Soon" empty state. react-markdown replaces
 * react-native-markdown-display for rendering `body`.
 */

import { ChevronDown, FileText, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { useSiteContent } from '@/hooks/use-site-content';

const markdownComponents = {
  h1: (props: React.ComponentProps<'h1'>) => <h1 className="mb-2 mt-4 text-lg font-bold" {...props} />,
  h2: (props: React.ComponentProps<'h2'>) => <h2 className="mb-2 mt-3 text-base font-semibold" {...props} />,
  p: (props: React.ComponentProps<'p'>) => <p className="mb-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300" {...props} />,
  ul: (props: React.ComponentProps<'ul'>) => <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300" {...props} />,
  ol: (props: React.ComponentProps<'ol'>) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300" {...props} />,
  strong: (props: React.ComponentProps<'strong'>) => <strong className="font-semibold" {...props} />,
};

function PolicySkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <span className="h-8 w-8 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
        <span className="h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <span className="block h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <span className="block h-3 w-11/12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <span className="block h-3 w-3/5 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}

function PolicySection({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-tint)] text-[var(--accent)]">
            {icon}
          </span>
          <span className="text-sm font-semibold">{title}</span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-zinc-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded ? (
        <div className="max-h-[60vh] overflow-y-auto border-t border-black/[0.06] px-4 pb-4 pt-3 dark:border-white/[0.06]">
          <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
}

export function TermsPrivacyClient({ barangayId }: { barangayId: string | null }) {
  const { items, isLoading } = useSiteContent(barangayId);

  const terms = items.find((i) => i.section === 'terms_of_service');
  const privacy = items.find((i) => i.section === 'privacy_policy');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PolicySkeleton />
        <PolicySkeleton />
      </div>
    );
  }

  if (!terms && !privacy) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <FileText size={26} className="text-zinc-400" />
        </span>
        <p className="text-base font-semibold">Content Coming Soon</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Terms of Service / Privacy Policy content is not yet available.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      {terms ? <PolicySection title={terms.title} body={terms.body} icon={<FileText size={16} />} /> : null}
      {privacy ? <PolicySection title={privacy.title} body={privacy.body} icon={<ShieldCheck size={16} />} /> : null}
    </div>
  );
}
