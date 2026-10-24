# Resident navigation regression gate

Run from the repository root:

```powershell
npm run test:navigation --workspace=@barangayan/mobile
```

The command runs the app unit suite, shared routing/client/SLA tests, and thirteen focused hook, component, map and installed-Router fixtures. Every suite has its own log and artifact directory; `results.json` records outcomes. A failed suite makes the command fail after independent suites finish. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for an installed supported browser; Windows uses existing Brave when available, otherwise Playwright's installed Chromium. `TEST_ARTIFACTS_DIR` selects the output folder; the default is a new temporary directory. No package download or remote test-data creation is performed.

Coverage includes same-owner refresh reuse; obsolete read cancellation; account replacement/sign-out with pending private reads and late subscription callbacks; loaded/empty/error/retry presentation; ten minutes of virtual visible/hidden polling; map equivalent-state suppression and current-scope replay after reload; all thirty directed tab pairs with installed history reducers; nested Services/Health/Reports/Settings Back; rapid/prevented tab presses; theme/font, keyboard, Search draft and lifecycle cleanup. Browser/native/transport boundaries are controlled. The virtual clock is not a native memory or performance benchmark. Authentication admission remains covered by real guarded application code and separate fixtures; reducer tests do not exercise it.

Run Expo lint, TypeScript and an Android production export separately. Keep baseline and candidate output, source hashes, dependency lock, build configuration and installed APK identities. Compare diagnostics against the baseline; never waive a new failure because an unrelated existing failure remains.

Native acceptance remains the gate in plan sections 8–9:

1. Use paired baseline/candidate release APKs from identified working sources on the same physical reference Android device and authorized account datasets. Record OS, refresh rate, thermal/network conditions and data cardinalities. Warm all six tabs; separate the no-Maps, visited-Maps and active-DRRM-route cases.
2. First run ten circuits and a separate rapid-tap check. Final normal-network acceptance requires at least thirty warm samples for each of thirty directed pairs across at least three runs. Capture synchronized native input and first correct/usable presented frames; handler timestamps, React commits and runner waits cannot substitute. Report each pair's median/p95/max and inspect every ≥1,000ms outlier. Acknowledgement p95≤100ms; correct destination median≤150ms/p95≤300ms; cached content p95≤300ms; no app-caused ≥100ms presentation gaps.
3. Verify selected state/header/content; nested Back; retained segment/scroll/map selection; successful authorized mutations and live badges/notifications; account switch/sign-out; slow/offline/error/reconnect; current boundary/location/closures/avoidance/route and controls; permission changes; background/foreground; Search/keyboard, reduced motion, appearance and accessibility focus. Record actual runtime/console diagnostics. Data-changing operations require the owner's authorization and representative accounts; fixtures are supporting evidence only.
4. During a real ten-minute warm loop, record requests, channels, timers, mounts, WebView loads/messages and retained memory after warm-up/collection. Require bounded ownership, zero tab-only redundant full marker/boundary sends, and no continuing retained-memory growth within the measured device budget.
5. Keep adverse-network and rapid-input results separate. Mark missing physical/release/frame/resource evidence pending; a development emulator run or a JavaScript export cannot close those criteria.
