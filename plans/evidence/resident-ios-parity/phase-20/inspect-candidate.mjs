// P20-T01 (OD-06): inspect the generated configuration and the exported bundle of the source candidate, since no signed binary exists.
// Run from the repository root after `npm run export:ios --workspace=@barangayan/resident-ios` (the export is optional; the bundle scan is skipped when `dist` is absent):
//   node plans/evidence/resident-ios-parity/phase-20/inspect-candidate.mjs
// Exit 1 when a security-relevant check fails (secret in the bundle, unexpected permission/entitlement/background mode, unlisted endpoint, ATS arbitrary loads, EAS profile mismatch).
// Placeholders that need owner-supplied Apple identifiers are reported as `open` and do not change the exit code. No secret value is ever written to the results file.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const ios = path.join(root, 'apps/resident-ios-mobile');
const results = { date: new Date().toISOString().slice(0, 10), checks: [], open: [] };
let failed = false;
const check = (id, pass, detail) => {
  results.checks.push({ id, pass, detail });
  if (!pass) failed = true;
};
const open = (id, detail) => results.open.push({ id, detail });

// ---- 1. Generated configuration -------------------------------------------------------------------------------------------------
const introspect = spawnSync('npx', ['expo', 'config', '--type', 'introspect', '--json'], { cwd: ios, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });
const jsonStart = introspect.stdout.indexOf('\n{');
const config = JSON.parse(introspect.stdout.slice(jsonStart >= 0 ? jsonStart + 1 : introspect.stdout.indexOf('{')));
const plist = config.ios.infoPlist;
const entitlements = config.ios.entitlements ?? {};

const permissionKeys = Object.keys(plist).filter((key) => /UsageDescription$/.test(key)).sort();
const expectedPermissions = ['NSCameraUsageDescription', 'NSLocationWhenInUseUsageDescription', 'NSPhotoLibraryAddUsageDescription'];
const devLauncherOnly = ['NSLocalNetworkUsageDescription'];
const shippedPermissions = permissionKeys.filter((key) => !devLauncherOnly.includes(key));
check('permissions.exact', JSON.stringify(shippedPermissions) === JSON.stringify(expectedPermissions), shippedPermissions);
check('permissions.no-always-location-microphone-tracking', !permissionKeys.some((key) => /Always|Microphone|Tracking|Contacts|Calendars|Bluetooth|Motion|FaceID|Health/.test(key)), permissionKeys);
check('permissions.purpose-strings-nonempty', permissionKeys.every((key) => String(plist[key]).trim().length > 20), permissionKeys.length);
check('background-modes.none', plist.UIBackgroundModes === undefined, plist.UIBackgroundModes ?? 'absent');
check('ats.no-arbitrary-loads', plist.NSAppTransportSecurity?.NSAllowsArbitraryLoads === false && plist.NSAppTransportSecurity?.NSAllowsArbitraryLoadsInWebContent !== true, plist.NSAppTransportSecurity);
check('entitlements.exact', JSON.stringify(Object.keys(entitlements).sort()) === JSON.stringify(['aps-environment', 'com.apple.developer.applesignin']), Object.keys(entitlements));
check('ios.deployment-target', config.ios.deploymentTarget === '16.4', config.ios.deploymentTarget);
check('ios.iphone-only', config.ios.supportsTablet === false, config.ios.supportsTablet);
check('updates.ota-disabled', config.updates === undefined && !(config.plugins ?? []).some((p) => String(Array.isArray(p) ? p[0] : p).includes('expo-updates')), 'no expo-updates plugin or updates block (first release keeps OTA off)');
check('dev-launcher.debug-only', JSON.parse(fs.readFileSync(path.join(root, 'node_modules/expo-dev-launcher/expo-module.config.json'), 'utf8')).apple.debugOnly === true, 'the Info.plist keys NSBonjourServices/NSLocalNetworkUsageDescription come from the dev client config plugin; the native module is Debug-only');

const schemes = (plist.CFBundleURLTypes ?? []).flatMap((entry) => entry.CFBundleURLSchemes);
if (/placeholder/.test(config.ios.bundleIdentifier ?? 'placeholder')) open('P20-F01', `bundle identifier is "${config.ios.bundleIdentifier}" (IOS_BUNDLE_IDENTIFIER unset; PR-02 needs an Apple team and App ID)`);
if (schemes.some((scheme) => /placeholder/.test(scheme))) open('P20-F02', `URL scheme "${schemes.find((scheme) => /placeholder/.test(scheme))}" is a placeholder (IOS_URL_SCHEME unset; PR-03 skipped by OD-07)`);
if (entitlements['aps-environment'] === 'development') open('P20-F03', 'aps-environment is "development" in the generated entitlements; Expo documents that Xcode switches it to production in a release archive (not observable without a signed archive)');
if (config.ios.config?.usesNonExemptEncryption === undefined && plist.ITSAppUsesNonExemptEncryption === undefined) open('P20-F04', 'ITSAppUsesNonExemptEncryption is not declared; the export-compliance answer is the owner\'s legal declaration and is left to App Store Connect');
if (!config.ios.icon && !config.icon) open('P20-F05', 'no app icon is configured; the preserved logo has an alpha channel (RGBA) and Apple requires an opaque 1024x1024 icon, which the owner must supply or approve');
if (!config.ios.privacyManifests) open('P20-F06', 'no app-level privacyManifests entry; NSPrivacyCollectedDataTypes values could not be verified against Apple\'s list, so the App Store Connect labels are the disclosure of record and the Xcode privacy report is a macOS/Xcode step');

// ---- 2. EAS profiles ------------------------------------------------------------------------------------------------------------
const eas = JSON.parse(fs.readFileSync(path.join(ios, 'eas.json'), 'utf8'));
const expectedEnvironment = { simulator: 'development', development: 'development', device: 'development', staging: 'staging', production: 'production' };
check('eas.profiles-exact', JSON.stringify(Object.keys(eas.build).sort()) === JSON.stringify(Object.keys(expectedEnvironment).sort()), Object.keys(eas.build));
for (const [name, profile] of Object.entries(eas.build)) {
  check(`eas.${name}.environment-label`, profile.env?.EXPO_PUBLIC_ENVIRONMENT === expectedEnvironment[name], profile.env?.EXPO_PUBLIC_ENVIRONMENT);
  check(`eas.${name}.no-secret-names`, !Object.keys(profile.env ?? {}).some((key) => /SECRET|SERVICE_ROLE|PRIVATE|TOKEN|PASSWORD|API_KEY/i.test(key)), Object.keys(profile.env ?? {}));
}
check('eas.production.store-distribution', eas.build.production.distribution === 'store' && eas.build.production.developmentClient !== true, eas.build.production.distribution);
check('eas.staging.internal-not-dev-client', eas.build.staging.distribution === 'internal' && eas.build.staging.developmentClient !== true, eas.build.staging.distribution);

// ---- 3. Endpoints named in the application source ---------------------------------------------------------------------------------
const allowedHosts = new Set([
  'tile.openstreetmap.org', // profile location map tiles (WebView, behind the closed mapProviders gate)
  'maps.apple.com', // hand-off to Apple Maps for directions
  'www.w3.org', // SVG namespace
  'leafletjs.com', 'bugs.chromium.org', 'bugzilla.mozilla.org', // comments inside the bundled Leaflet asset
]);
const sourceHosts = new Map();
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      for (const match of fs.readFileSync(full, 'utf8').matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
        if (!sourceHosts.has(match[1])) sourceHosts.set(match[1], new Set());
        sourceHosts.get(match[1]).add(path.relative(ios, full).split(path.sep).join('/'));
      }
    }
  }
};
walk(path.join(ios, 'src'));
const unlisted = [...sourceHosts.keys()].filter((host) => !allowedHosts.has(host));
check('endpoints.source-hosts-allowlisted', unlisted.length === 0, unlisted.length ? unlisted : [...sourceHosts.keys()].sort());
const insecure = [];
const walkInsecure = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkInsecure(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/leaflet-assets/.test(entry.name) && /['"`]http:\/\/(?!www\.w3\.org)/.test(fs.readFileSync(full, 'utf8'))) insecure.push(path.relative(ios, full));
  }
};
walkInsecure(path.join(ios, 'src'));
check('endpoints.no-cleartext-literals', insecure.length === 0, insecure);

// ---- 4. Exported bundle: secrets and hosts ----------------------------------------------------------------------------------------
const dist = path.join(ios, 'dist');
if (!fs.existsSync(dist)) {
  open('P20-F07', 'no `dist` export present; run the iOS export first to include the bundle scan');
} else {
  const files = [];
  const collect = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (/\.(hbc|js|json|map|html)$/.test(entry.name) && fs.statSync(full).size < 64 * 1024 * 1024) files.push(full);
    }
  };
  collect(dist);
  const secretPatterns = {
    'private key block': /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    // The bundle legitimately contains the bare prefix `sb_secret_` (the configuration guard rejects it) and Hermes stores adjacent strings back to back, so a key needs a digit and 28+ key characters.
    'Supabase secret key': /sb_secret_(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{28,}/,
    'Stripe/PayMongo-style secret key': /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}/,
    'Expo access token': /\bexpo_[A-Za-z0-9]{30,}/i,
    'AWS access key': /\bAKIA[0-9A-Z]{16}\b/,
  };
  const found = new Set();
  const privilegedJwts = new Set();
  const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;
  const hosts = new Set();
  for (const file of files) {
    const text = fs.readFileSync(file, 'latin1');
    for (const [label, pattern] of Object.entries(secretPatterns)) if (pattern.test(text)) found.add(`${label} in ${path.relative(ios, file).split(path.sep).join('/')}`);
    for (const match of text.matchAll(jwtPattern)) {
      try {
        const role = JSON.parse(Buffer.from(match[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role;
        if (role && role !== 'anon') privilegedJwts.add(`JWT with role "${role}" in ${path.relative(ios, file).split(path.sep).join('/')}`);
      } catch { /* not a JWT */ }
    }
    for (const match of text.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) hosts.add(match[1].toLowerCase());
  }
  check('bundle.no-secrets', found.size === 0 && privilegedJwts.size === 0, [...found, ...privilegedJwts]);
  results.bundle = { files: files.length, bytes: files.reduce((total, file) => total + fs.statSync(file).size, 0), https_hosts_in_bundle: [...hosts].sort() };
}

results.generated = {
  bundleIdentifier: config.ios.bundleIdentifier,
  urlSchemes: schemes,
  version: config.version,
  buildNumber: plist.CFBundleVersion,
  deploymentTarget: config.ios.deploymentTarget,
  permissionKeys,
  entitlements: Object.fromEntries(Object.entries(entitlements).map(([key, value]) => [key, value])),
  atsLocalNetworking: plist.NSAppTransportSecurity?.NSAllowsLocalNetworking,
  orientations: plist.UISupportedInterfaceOrientations,
  requiredDeviceCapabilities: plist.UIRequiredDeviceCapabilities,
};
results.passed = !failed;
fs.writeFileSync(path.join(here, 'inspection-results.json'), `${JSON.stringify(results, null, 2)}\n`);
for (const entry of results.checks) console.log(`${entry.pass ? 'PASS' : 'FAIL'}  ${entry.id}`);
for (const entry of results.open) console.log(`OPEN  ${entry.id}: ${entry.detail}`);
console.log(failed ? 'RESULT: FAIL' : `RESULT: PASS (${results.checks.length} checks, ${results.open.length} open items)`);
process.exit(failed ? 1 : 0);
