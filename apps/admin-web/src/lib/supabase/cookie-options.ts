/** Keep browser, server and proxy storage (including PKCE and tab events) in sync. */
export function getAuthCookieOptions() {
  const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
  return { name: `sb-${project}-admin-web-auth-token` };
}
