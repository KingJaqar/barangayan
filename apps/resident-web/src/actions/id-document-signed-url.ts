'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Server Action — signs a URL for one of the caller's own id-documents bucket objects.
 *
 * SECURITY (§7 — P0 code-review item):
 *   1. We verify the caller's session via getUser() before signing anything.
 *   2. The storage path MUST start with the caller's auth.uid() — we enforce this
 *      explicitly (checking `path.startsWith(user.id + '/')`) so a client cannot request
 *      a signed URL for another resident's ID document by passing a different path.
 *   3. The bucket is private — the signed URL is the ONLY way a resident can read back
 *      their own document. A bug here (missing the ownership check) would be a real
 *      authorization vulnerability, not just a UI mistake.
 *
 * Returns: { url: string } on success, { error: string } on failure.
 */
export async function getIdDocumentSignedUrl(
  path: string,
): Promise<{ url: string; error?: never } | { url?: never; error: string }> {
  if (!path || typeof path !== 'string') {
    return { error: 'Invalid path.' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Not authenticated.' };
  }

  // ⚠️ Ownership check — path must be scoped to this user's uid. The id-documents
  // bucket's storage path convention (confirmed at Phase 3/7 implementation time per §18
  // item 6) is `{uid}/{filename}`. A client passing an arbitrary path would bypass this
  // check and potentially read another resident's document — never skip this.
  if (!path.startsWith(user.id + '/')) {
    return { error: 'Access denied.' };
  }

  const { data, error } = await supabase.storage.from('id-documents').createSignedUrl(path, 60 * 60); // 1 hour

  if (error || !data?.signedUrl) {
    return { error: error?.message ?? 'Could not generate a signed URL.' };
  }

  return { url: data.signedUrl };
}
