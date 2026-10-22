const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.cwd());
const required = ['IOS_BUNDLE_IDENTIFIER', 'IOS_URL_SCHEME', 'EAS_PROJECT_ID', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_BARANGAY_ID', 'EXPO_PUBLIC_ENVIRONMENT'];
const missing = required.filter((name) => !process.env[name]?.trim());
// A value that is present but cannot identify a production App Store build is as blocking as a missing one.
const invalid = [];
const bundleId = process.env.IOS_BUNDLE_IDENTIFIER?.trim();
if (bundleId && (/placeholder/i.test(bundleId) || !/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(bundleId))) invalid.push('IOS_BUNDLE_IDENTIFIER must be the approved reverse-DNS App ID, not a placeholder');
const scheme = process.env.IOS_URL_SCHEME?.trim();
if (scheme && (/placeholder/i.test(scheme) || !/^[a-z][a-z0-9+.-]*$/.test(scheme))) invalid.push('IOS_URL_SCHEME must be the approved lower-case scheme, not a placeholder');
const environment = process.env.EXPO_PUBLIC_ENVIRONMENT?.trim();
if (environment && environment !== 'production') invalid.push(`EXPO_PUBLIC_ENVIRONMENT must be "production" for an App Store build (found "${environment}")`);
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
if (supabaseUrl && !/^https:\/\//.test(supabaseUrl)) invalid.push('EXPO_PUBLIC_SUPABASE_URL must use HTTPS');
const gates = fs.readFileSync(path.join(root, 'src/lib/release-gates.ts'), 'utf8');
const closed = [...gates.matchAll(/^\s{2}(\w+): false,/gm)].map((match) => match[1]);
if (missing.length || invalid.length || closed.length) {
  if (missing.length) console.error(`Missing release configuration: ${missing.join(', ')}`);
  for (const problem of invalid) console.error(`Invalid release configuration: ${problem}`);
  if (closed.length) console.error(`Release gates remain closed: ${closed.join(', ')}`);
  process.exit(1);
}
console.log('Release configuration and source-controlled gates are open. Continue with signed-device and TestFlight qualification.');
