// Check hosted redirect configuration by starting and cancelling OAuth flows.
// No Google consent, account creation, session exchange, or credentials are used.
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');

const site = 'https://barangayan-resident-web.vercel.app';
const auth = 'https://pwjbucnyqexiepoinoke.supabase.co/auth/v1';

async function redirect(url) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  assert.ok([302, 303, 307].includes(response.status), `Expected redirect, received ${response.status}`);
  const location = response.headers.get('location');
  assert.ok(location, 'Missing redirect destination');
  return new URL(location, url);
}

async function cancelledOAuth(requested) {
  const authorize = new URL(`${auth}/authorize`);
  authorize.searchParams.set('provider', 'google');
  authorize.searchParams.set('redirect_to', requested);
  authorize.searchParams.set('code_challenge_method', 's256');
  authorize.searchParams.set('code_challenge', createHash('sha256').update(randomBytes(32).toString('base64url')).digest('base64url'));
  const google = await redirect(authorize);
  assert.equal(google.hostname, 'accounts.google.com');
  assert.equal(google.searchParams.get('redirect_uri'), `${auth}/callback`);
  const state = google.searchParams.get('state');
  assert.ok(state, 'Google flow is missing state');
  const cancel = new URL(`${auth}/callback`);
  cancel.searchParams.set('state', state);
  cancel.searchParams.set('error', 'access_denied');
  cancel.searchParams.set('error_description', 'Redirect configuration check');
  const returned = await redirect(cancel);
  assert.ok(returned.searchParams.has('error') || returned.hash.includes('error='), 'Expected cancelled OAuth response');
  return returned;
}

async function main() {
  const cases = [
    ['Google sign-up', `${site}/auth/callback?next=%2Fhome`],
    ['Google sign-in with destination', `${site}/auth/callback?next=%2Fservices%2Frequests%3Fstatus%3Dpending`],
    ['Production callback without query', `${site}/auth/callback`],
    ['Local development', 'http://localhost:3000/auth/callback?next=%2Fhome'],
    ['Unlisted domain falls back to production', 'https://redirect-check.invalid/auth/callback'],
  ];
  let failed = 0;
  for (const [label, requested] of cases) {
    try {
      const actual = await cancelledOAuth(requested);
      const expected = new URL(requested.includes('redirect-check.invalid') ? site : requested);
      assert.equal(actual.protocol, expected.protocol);
      assert.equal(actual.host, expected.host);
      assert.equal(actual.pathname.replace(/\/$/, ''), expected.pathname.replace(/\/$/, ''));
      assert.equal(actual.searchParams.get('next'), expected.searchParams.get('next'));
      console.log(`PASS ${label}`);
    } catch (error) {
      failed++;
      console.error(`FAIL ${label}: ${error.message}`);
    }
  }
  try {
    const failure = await redirect(`${site}/auth/callback`);
    assert.equal(failure.href, `${site}/auth/error`);
    console.log('PASS Vercel callback error stays on production');
  } catch (error) {
    failed++;
    console.error(`FAIL Vercel callback: ${error.message}`);
  }
  console.log('This check verifies redirect selection, not Google consent or authenticated sessions.');
  process.exitCode = failed ? 1 : 0;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
