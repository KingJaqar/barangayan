import styles from '@/components/admin/content-workspace.module.css';
import { ContentCreatePanel } from '@/components/admin/content-create-panel';
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
    <div className={styles.page}>
      <ContentCreatePanel
        title="FAQ Content"
        description="Manage Help Center articles visible to residents in your barangay."
        forms={[
          { label: "Create new article", title: "New FAQ article",
            description: "Write a helpful question and answer, then set its category and visibility.",
            content: <FaqForm barangayId={profile?.barangay_id ?? ''} /> },
        ]}
      />

      <FaqList articles={articles ?? []} />
    </div>
  );
}
