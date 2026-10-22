# P20-T01 — environment profiles and inspection of the generated candidate (2026-10-21)

Requirements: P20-T01, G01/G02/G14 (distribution), G21 (generated permissions/entitlements), C.4 (environments), plan §5 (inspect the generated configuration). Owner and reviewer: KingJaqar (OD-01). **Source revision:** uncommitted on base `187a2ab3` (identity in `../phase-19/candidate.json`). **Native build:** none (OD-06). **Environment:** local workspace, Windows, Node v24.13.1, Expo SDK 57.0.10, React Native 0.86.2; no hosted write, no deployment, no commit.

OD-06 changes the task: the signed-candidate inspection is **Skipped (OD-06)**. What the plan allows instead is inspecting the generated configuration and the exported bundle. `inspect-candidate.mjs` does that and is rerunnable; its output is `inspection-results.json`.

## 1. Environment profiles (finalized)

`apps/resident-ios-mobile/eas.json` already defines the five profiles; Phase 20 verified them rather than changing them. They are exercised by `inspect-candidate.mjs` (exit 1 on a mismatch):

| Profile | Distribution | `EXPO_PUBLIC_ENVIRONMENT` | Dev client | Intended use |
|---|---|---|---|---|
| `simulator` | internal | development | yes (simulator) | Xcode simulator |
| `development` | internal | development | yes | registered device, dev client |
| `device` | internal | development | no | registered device, release JS |
| `staging` | internal | staging | no | TestFlight/internal staging against a staging backend |
| `production` | store | production | no (`autoIncrement` build number, remote version source) | App Store |

No profile carries a secret-named variable (checked by name). Public values (`EXPO_PUBLIC_SUPABASE_URL`, the public client key, `EXPO_PUBLIC_BARANGAY_ID`) are to be supplied by the EAS environment named in each profile's `environment` field (`development`, `preview`, `production`) and are public by design, not secret storage. None of those EAS environments has been created or inspected here. **Hardening (code):** `scripts/check-release.cjs` now also requires `EXPO_PUBLIC_ENVIRONMENT` and rejects a placeholder or malformed `IOS_BUNDLE_IDENTIFIER`/`IOS_URL_SCHEME`, a non-`production` environment and a non-HTTPS Supabase URL (three new tests in `tests/config.test.ts`). It still exits 1 today because the owner-supplied values and seven gates are missing/closed; that is the intended result.

## 2. What the generated configuration contains (`expo config --type introspect`, 2026-10-21)

All 26 automated checks pass; six items are **open** because they need owner-supplied Apple facts or a macOS/signed step.

| Area | Observed | Verdict |
|---|---|---|
| Permissions | Exactly `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryAddUsageDescription`, each with a purpose string that names the actual use. No Always location, microphone, contacts, calendars, Bluetooth, motion, Face ID, health or tracking keys. | Pass |
| Background modes | None (`UIBackgroundModes` absent): no silent push, no background location. | Pass |
| ATS | `NSAllowsArbitraryLoads` false; local networking allowed (development servers). | Pass (see P20-F08) |
| Entitlements | Exactly `aps-environment` and `com.apple.developer.applesignin`; nothing else requested. | Pass |
| Deployment / device | iOS 16.4, iPhone only (`supportsTablet` false). | Pass |
| OTA | No `expo-updates`, no `updates` block: OTA is off for the first release (plan §5). | Pass |
| Dev client | `NSBonjourServices` and `NSLocalNetworkUsageDescription` are in the generated plist because `expo-dev-client` is a dependency, but its native module is `debugOnly: true`. | Pass, recorded as P20-F08 |
| EAS profiles | Five profiles, correct environment labels, store distribution only for production. | Pass |

### Open findings (carried, none can be fixed by engineering alone)

| ID | Finding | Why it is open |
|---|---|---|
| P20-F01 | Bundle identifier is `com.placeholder.appid` (`IOS_BUNDLE_IDENTIFIER` unset). | Needs the approved App ID (PR-02). Not invented. |
| P20-F02 | URL scheme is `com.placeholder.appid` (`IOS_URL_SCHEME` unset). | PR-03 skipped by OD-07; Google browser sign-in has no approved callback. |
| P20-F03 | `aps-environment` is `development` in the generated entitlements. | Expo's documentation states the entitlement is always `development` in the project and Xcode changes it to production in a release archive; not observable without a signed archive (OD-06). |
| P20-F04 | `ITSAppUsesNonExemptEncryption` is not declared. | It is the owner's legal export-compliance declaration. Analysis supports "exempt" (see T02 §6) but engineering does not make the declaration. |
| P20-F05 | No App Store icon is configured, and the preserved logo has an alpha channel. | Apple needs an opaque 1024×1024 icon; the artwork needs owner approval (T02 §8). |
| P20-F06 | No app-level `privacyManifests`. | See T02 §3: collected-data identifiers could not be verified; the Xcode privacy report is a macOS step. |

P20-F08 (informational): the generated plist carries `UIRequiredDeviceCapabilities: [armv7]` and `UISupportedInterfaceOrientations` Portrait + PortraitUpsideDown, which are Expo's defaults for `orientation: portrait`; iPhones without a home button ignore upside-down. Not changed.

## 3. Trusted endpoints and secrets

- **Source:** every `http(s)` host literal in `apps/resident-ios-mobile/src` is on an allowlist (`tile.openstreetmap.org` for the profile location map, `maps.apple.com` for the directions hand-off, `www.w3.org` SVG namespace, and three comment-only hosts inside the generated Leaflet asset). No cleartext (`http://`) literal other than the SVG namespace. The Supabase URL comes from the environment and must be HTTPS (`config.ts`, tested).
- **Exported bundle (iOS Hermes bytecode, 2 files, 5.2 MB):** no private-key block, no `sb_secret_` key, no Stripe/PayMongo-style secret key, no Expo token, no AWS key, and no JWT whose role is not `anon`. The bare string `sb_secret_` is present (the configuration guard rejects such keys); Hermes stores adjacent strings back to back, which produced a false positive in the first scan, so a key now needs a digit and 28 further key characters. HTTPS hosts found in the bundle: 19 (`inspection-results.json`); the third-party map and geocoding hosts (`tile.openstreetmap.org`, `nominatim.openstreetmap.org`) are in the bundle because shared code is imported, but they are reachable only when `mapProviders` is open (it is closed; `location-screen.tsx` and `concern-screen.tsx` read the gate before any geocode call, and `maps-screen.tsx` passes it as `tiles`).
- The public bundle contains the Supabase **anon** public key and the tenant/environment values, which are public by design (Phase 19 scan; unchanged).

## 4. Status

**P20-T01: Partially complete.** Done: profiles verified, configuration and bundle inspected, release diagnostic hardened and tested. Skipped (OD-06): signed-candidate inspection (provisioning, binary entitlements, binary Info.plist). Open: P20-F01…F06 need owner-supplied facts. Rerun: `node plans/evidence/resident-ios-parity/phase-20/inspect-candidate.mjs` (after `npm run export:ios`).
