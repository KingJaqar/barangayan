const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.cwd());
const required = ['IOS_BUNDLE_IDENTIFIER', 'IOS_URL_SCHEME', 'EAS_PROJECT_ID', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_BARANGAY_ID'];
const missing = required.filter((name) => !process.env[name]?.trim());
const gates = fs.readFileSync(path.join(root, 'src/lib/release-gates.ts'), 'utf8');
const closed = [...gates.matchAll(/^\s{2}(\w+): false,/gm)].map((match) => match[1]);
if (missing.length || closed.length) {
  if (missing.length) console.error(`Missing release configuration: ${missing.join(', ')}`);
  if (closed.length) console.error(`Release gates remain closed: ${closed.join(', ')}`);
  process.exit(1);
}
console.log('Release configuration and source-controlled gates are open. Continue with signed-device and TestFlight qualification.');
