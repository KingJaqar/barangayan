# R16 kit — real push on a physical Android phone

Closes plan R16 (and the native warm/cold tap part of R08). Everything runs against a **disposable** database and the
tester accounts it seeds. Nothing here touches the hosted project, a real resident or a production token.

## What you need to supply
| Item | Why |
|---|---|
| A physical Android phone (Android 8+; test ideally on 13+ to see the permission prompt), USB debugging on, same Wi-Fi as this PC | Real FCM delivery, real notification channel, real tap/closed-app behaviour. |
| FCM credentials uploaded to the Expo project (`eas credentials` → Android → Google Service Account Key for FCM V1) and a `google-services.json` for package `com.barangayan.resident` placed in `apps/resident-android-mobile` (path referenced by `android.googleServicesFile` in app config) | Without them `getExpoPushTokenAsync` fails and the device never gets a token. This is the only part I cannot do. |
| An Expo account that owns the project id already in `app.json` (`extra.eas.projectId`) | Expo's push service accepts tokens only for the project. Optional `EXPO_ACCESS_TOKEN` if "enhanced push security" is on. |
| Windows Firewall rule allowing inbound TCP 58520 on your private network | The phone reaches the PC's backend through one LAN port. |

## One-time setup (≈10 min plus the app build)
1. `bash up.sh` — clones the notif template, seeds data (83 announcements, 40 account events, incident, 3 System notices), starts GoTrue/PostgREST/Realtime as `r16_*` containers and prints the LAN URL and tester password file.
2. `node <work>/proxy-r16.cjs` — the LAN proxy on `0.0.0.0:58520` (`/auth/v1`, `/rest/v1`, `/realtime/v1`).
3. Build the app against it (release, cleartext allowed for the LAN host). From `apps/resident-android-mobile`:
   - set `EXPO_PUBLIC_SUPABASE_URL=http://<LAN-IP>:58520` and `EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from npx supabase status -o env>`;
   - `npx expo prebuild --platform android --no-install` (it rewrites two `package.json` scripts — restore them), add `android:usesCleartextTraffic="true"` to `<application>` in the generated manifest, then `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a` with JAVA_HOME = Android Studio's JBR;
   - or build the same with EAS (`eas build -p android --profile preview`) after setting the two env vars in the profile and enabling cleartext through `expo-build-properties`.
4. `adb install -r app-release.apk` on the phone. Delete `android/` afterwards.
5. Sign in on the phone as `rwfb-populated@test.local` (password in `<work>/tester-password.txt`). Accept the notification permission prompt when you turn alerts on in Settings.
6. Read the phone's token: `docker exec supabase_db_barangayan psql -U postgres -d notif_r16_20261028 -Atc "select user_id, expo_push_token, device_type from public.push_tokens"` and export it as `R16_TOKEN`. If no row appears, FCM credentials are missing — stop and fix that first.

## Per-case procedure
For each case: `bash trigger.sh notice|account|incident` → `node send.mjs` (needs `NOTIF_REST_URL=http://localhost:58522`, `NOTIF_JWT_SECRET` = `PGRST_JWT_SECRET` of `r16_rest` — read from `docker inspect`, never paste it anywhere —, `NOTIF_TEST_DB=notif_r16_20261028`, `R16_TOKEN`). `send.mjs` refuses to send unless the database holds exactly the tester's token.

| # | Case | Steps | Pass when |
|---|---|---|---|
| 1 | Foreground receipt | App open on Home → trigger `notice` → send | Banner shows in the app; row appears in Announcements → System; bell badge +1. |
| 2 | Background receipt + tap | Press Home → trigger `account` → send → pull the shade, tap | One notification on channel **Barangay alerts**; tap opens Announcements on that row's detail; row becomes read (`read_at` set); Back returns sensibly. |
| 3 | Closed-app receipt + tap (cold) | Swipe the app away → trigger `incident` → send → tap | App cold-starts straight into `/reports/<id>` (v1 incident destination) with no blank/Home flash stuck; row read. Repeat once with `notice` to see the detail sheet. |
| 4 | Channel | Phone Settings → Apps → Barangayan → Notifications | Channel `Barangay alerts` exists, importance High, sound on. |
| 5 | Permission denied | Turn the OS notification permission off → trigger+send | Expo reports `DeviceNotRegistered`/no display; history row still appears when the app opens; app shows no repeated permission prompts. |
| 6 | App opt-out | In-app Settings → alerts off → trigger+send | `send.mjs` outbox shows the row skipped (opt-out); nothing displayed; history still present. |
| 7 | Account isolation | Sign out, sign in as `rwfb-other@test.local`, trigger+send for tester A | The phone shows nothing for A; token was released on sign-out (`push_tokens` empty or re-bound to B only); B's hub shows none of A's Account rows. |
| 8 | No duplicates | After case 2 | Exactly one notification per event on the phone and one inbox row per event (`select count(*)` by event). |

Record per case: phone model/Android version, build identity (APK sha256), screenshots, `send.mjs` JSON summary, and the DB assertions above. Anything that fails stays a named blocker; do not mark R16 passed on simulated runs.

## Cleanup
`docker rm -f r16_auth r16_rest r16_rt`, stop `proxy-r16.cjs`, remove the firewall rule, delete the APK and `android/`, and either keep or drop `notif_r16_20261028`. Revoke the test token with `delete from public.push_tokens`.
