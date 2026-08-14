import { createSupabaseServerClient } from '@/lib/supabase/server';

import { FaqForm } from './faq-form';
import { FaqList } from './faq-list';

export default async function FaqPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  // Fetch all articles — including archived (deleted_at IS NOT NULL) so the
  // client-side segment/filter/search can operate over the full set.
  const { data: articles } = await supabase
    .from('faq_articles')
    .select('*')
    .order('sort_order', { ascending: true });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">FAQ Content</h1>
          <p className="text-sm text-zinc-500">
            Manage Help Center articles visible to residents in your barangay.
          </p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
          New Article
        </h2>
        <FaqForm barangayId={profile?.barangay_id ?? ''} />
      </div>

      <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
        Articles
      </h2>
      <FaqList articles={articles ?? []} />
    </div>
  );
}
