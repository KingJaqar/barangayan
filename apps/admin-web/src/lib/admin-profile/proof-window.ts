export type AccountProof = { accessToken?: string; retire: (sessionRevoked?: boolean) => void };

// The popup owns an independent, memory-only Auth client. Only a short-lived
// admin proof token crosses this same-origin channel; resident tokens never do.
export function openAccountProof(purpose: 'resident' | 'admin', challenge?: string, reserved?: Window): Promise<AccountProof> {
  return new Promise((resolve, reject) => {
    const request = crypto.randomUUID();
    const url = new URL('/profile-proof', window.location.origin);
    url.searchParams.set('purpose', purpose); url.searchParams.set('request', request);
    if (challenge) url.searchParams.set('challenge', challenge);
    const popup = reserved ?? window.open(url, `profile-proof-${request}`, 'popup,width=520,height=720');
    if (!popup) { reject(new Error('Allow the sign-in popup, then try again.')); return; }
    if (reserved) reserved.location.assign(url);
    let settled = false;
    const retire = (sessionRevoked = false) => popup.postMessage({ type: 'retire-profile-proof', request, sessionRevoked }, window.location.origin);
    const timeout = window.setTimeout(() => { cleanup(); retire(); if (!settled) reject(new Error('Sign-in proof expired. Start again.')); }, 5 * 60 * 1000);
    const closed = window.setInterval(() => { if (popup.closed) { cleanup(); if (!settled) reject(new Error('Sign-in was cancelled. No new account was linked.')); } }, 500);
    function cleanup() { window.clearTimeout(timeout); window.clearInterval(closed); window.removeEventListener('message', receive); }
    function receive(event: MessageEvent<unknown>) {
      if (event.origin !== window.location.origin || event.source !== popup || !event.data || typeof event.data !== 'object') return;
      const payload = event.data as Record<string, unknown>;
      if (payload.request !== request) return;
      if (payload.type === 'profile-proof-error') { cleanup(); retire(); reject(new Error('Ownership proof could not be established. Review the account and try again.')); }
      if (payload.type === 'profile-proof-ready' && (purpose === 'resident' || typeof payload.accessToken === 'string')) {
        settled = true; cleanup(); resolve({ ...(typeof payload.accessToken === 'string' ? { accessToken: payload.accessToken } : {}), retire });
      }
    }
    window.addEventListener('message', receive);
  });
}
