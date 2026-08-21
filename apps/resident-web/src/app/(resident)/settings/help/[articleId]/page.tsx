import { FAQ_CATEGORY_META, type FaqCategory } from '@barangayan/shared';
import { HelpCircle } from 'lucide-react';
import Link from 'next/link';

import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata = { title: 'Help Article' };

/** Guest-accessible (getOptionalUser(), not requireUser()) — mirrors help/page.tsx.
 * Guests have no barangay_id to scope by, so the query goes unscoped by id alone
 * (faq_articles' anon read policy has no barangay filter either), same convention as
 * use-faq-articles.ts. */
export default async function HelpArticlePage({ params }: { params: Promise<{ articleId: string }> }) {
  const { articleId } = await params;
  const { profile } = await getOptionalUser();

  const supabase = await createSupabaseServerClient();
  let query = supabase.from('faq_articles').select('*').eq('id', articleId).eq('is_active', true).is('deleted_at', null);
  if (profile) query = query.eq('barangay_id', profile.barangay_id);
  const { data: article } = await query.maybeSingle();

  const category = article ? (article.category as FaqCategory) : null;
  const meta = category ? FAQ_CATEGORY_META[category] : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <Link
        href="/settings/help"
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-[var(--accent)] dark:text-zinc-400">
        ‹ Back to Help Center
      </Link>

      {!article ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <HelpCircle size={26} className="text-zinc-400" />
          </span>
          <p className="text-sm font-semibold">Article not found</p>
        </div>
      ) : (
        <article className="rounded-xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900 sm:p-6">
          {meta ? (
            <span
              className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}>
              <HelpCircle size={13} />
              {meta.label}
            </span>
          ) : null}
          <h1 className="text-xl font-bold tracking-tight">{article.question}</h1>
          <hr className="my-4 border-black/[0.06] dark:border-white/[0.06]" />
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            {article.answer}
          </p>
        </article>
      )}
    </div>
  );
}
