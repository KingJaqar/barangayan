# Fresh Brave motion evidence — 18 October 2026

Reference: [Magic Patterns](https://www.magicpatterns.com/c/jhv4ekfl4cidsa3phgrb3f), editor **v32**, artifact `df178e1c-7b6e-4d98-8334-06f3a00f28c3`, rechecked through Brave. See the [motion specification](../../../Resident_Android_MagicPatterns_Motion_and_Fidelity_Specification.md) and [implementation plan](../../../Resident_Android_MagicPatterns_Redesign_Implementation_Plan.md).

## Capture method and limits

These are **22 sampled browser capture sequences / 624 raw JPEG frames**, not a continuous screen recording or a performance trace. The supported Brave connection exposed screenshots, not a continuous-video recorder. A full-page capture attempt timed out before any action; successful captures used viewport screenshots. Raw requests ran serially while the documented UI click ran concurrently. Each sequence preserves request/response timestamps and action-call start; capture timestamps are not compositor timestamps or guaranteed input-dispatch timestamps.

The GIFs replay only captured frames at intervals derived from request/response midpoints, quantized to GIF's 10ms timing. No interpolated or synthesized intermediate frames were added. The phone-centered 460px crop is a derived viewing aid; original full viewport JPEGs are retained. Final-frame dwell is 100ms and replay loops. GIF quantization, screenshot overhead and viewer playback introduce uncertainty. Do not use apparent GIF stutter/speed to diagnose the prototype or certify smoothness.

Reported CSS viewport was 1666×865, DPR 1.5, normal motion (`prefers-reduced-motion: reduce` false). Returned JPEG dimensions varied (initial 1665×865; most 1651×858), so image pixels are not a 1:1 CSS/native dp ruler. Locator scroll-into-view and pending previous paint can shift the outer simulated phone or appear in pre-roll. Those are capture artifacts to exclude from design requirements. No viewport/system preference was changed. Theme Dark was selected in the disposable prototype, then restored to Light; no real app setting changed.

For each folder: `capture.json` contains raw timestamp metadata, `frame-NNN.jpg` the untouched capture, `contact-sheet.jpg` selected sample frames, `replay.gif` the sampled replay, and `final-state.txt` the state check. The first two final-state files came from a stale accessibility cache; do not rely on them. Their screenshots and subsequent DOM observations verified the destinations. Later final-state files use live DOM snapshots. No claim of full state/animation coverage is made.

## Sequence index

Approximate sample Hz is reciprocal median screenshot-midpoint interval; **it is not the browser's frame rate**. One transition may have only a few intermediate samples. All statuses refer to prototype sample state, not native or backend behavior.

| Sequence / replay | Motion IDs | Raw frames / sample Hz | Observed result |
|---|---|---|---|
| [01-home-to-services: Home → Services](01-home-to-services/replay.gif) · [samples](01-home-to-services/contact-sheet.jpg) | M01 / M16 | 28 / ~15.9 Hz | Services scene and active navigation treatment reached. |
| [02-documents-to-requests: Documents → Requests](02-documents-to-requests/replay.gif) · [samples](02-documents-to-requests/contact-sheet.jpg) | M03 | 30 / ~15.6 Hz | Requests selected and request list visible. |
| [03-active-to-paid: Active → Paid](03-active-to-paid/replay.gif) · [samples](03-active-to-paid/contact-sheet.jpg) | M03 | 31 / ~16.0 Hz | Paid selected; no-paid-requests state reached. |
| [04-home-summary-open: Home summary opens](04-home-summary-open/replay.gif) · [samples](04-home-summary-open/contact-sheet.jpg) | M04 | 28 / ~15.3 Hz | Panel rises with concurrent scrim; final summary reached. |
| [05-home-summary-close: Home summary closes](05-home-summary-close/replay.gif) · [samples](05-home-summary-close/contact-sheet.jpg) | M04 | 30 / ~15.5 Hz | Reverse panel/scrim movement; Home reached. |
| [06-home-shelf-scroll: Home request shelf](06-home-shelf-scroll/replay.gif) · [samples](06-home-shelf-scroll/contact-sheet.jpg) | M11 | 30 / ~15.5 Hz | Horizontal card position changes; scroll controls retained. |
| [07-typhoon-expand: Typhoon expands](07-typhoon-expand/replay.gif) · [samples](07-typhoon-expand/contact-sheet.jpg) | M06 | 30 / ~16.1 Hz | Measured samples show panel content/height increasing and chevron changing. |
| [08-typhoon-collapse: Typhoon collapses](08-typhoon-collapse/replay.gif) · [samples](08-typhoon-collapse/contact-sheet.jpg) | M06 | 29 / ~15.4 Hz | Panel returns to closed state. |
| [09-centers-map-entry: Centers List → Map](09-centers-map-entry/replay.gif) · [samples](09-centers-map-entry/contact-sheet.jpg) | M02 / M03 | 25 / ~14.2 Hz | Map and hidden-tab presentation reached. |
| [10-centers-nav-reveal: Reveal bottom tabs](10-centers-nav-reveal/replay.gif) · [samples](10-centers-nav-reveal/contact-sheet.jpg) | M02 | 27 / ~14.2 Hz | Bar and overlay move; visible primary bar reached. |
| [11-center-select: Direct center pin](11-center-select/replay.gif) · [samples](11-center-select/contact-sheet.jpg) | M02 / M07 | 26 / ~14.0 Hz | Final snapshot had controls and hidden nav, without selected card; not a successful card-entry example. |
| [12-center-row-to-map: Center row → Map](12-center-row-to-map/replay.gif) · [samples](12-center-row-to-map/contact-sheet.jpg) | M07 / M08 | 24 / ~12.6 Hz | Selected center card reached; sampled map zoom/tile change also visible. |
| [13-center-card-close: Center card closes](13-center-card-close/replay.gif) · [samples](13-center-card-close/contact-sheet.jpg) | M07 | 27 / ~14.1 Hz | Selected card exits and map controls return. |
| [14-alert-date-expand: Alerts date expands](14-alert-date-expand/replay.gif) · [samples](14-alert-date-expand/contact-sheet.jpg) | M06 | 29 / ~14.9 Hz | Wheel container expands with date choices. |
| [15-about-entry: Settings → About](15-about-entry/replay.gif) · [samples](15-about-entry/contact-sheet.jpg) | M16 | 28 / ~14.6 Hz | About entry reached; not evidence of a generic native-stack slide. |
| [16-mission-to-vision: Mission → Vision](16-mission-to-vision/replay.gif) · [samples](16-mission-to-vision/contact-sheet.jpg) | M14 | 28 / ~14.5 Hz | Sampled text fade-out/entry and pill movement; Vision reached. |
| [17-history-expand: History expands](17-history-expand/replay.gif) · [samples](17-history-expand/contact-sheet.jpg) | M14 | 28 / ~14.3 Hz | Expanded text/Show less reached; does not establish animated height. |
| [18-theme-dark-select: Theme selects Dark](18-theme-dark-select/replay.gif) · [samples](18-theme-dark-select/contact-sheet.jpg) | M03 | 27 / ~14.5 Hz | Dark selected while sampled surfaces remain light; Light restored afterward. |
| [19-search-open: Search opens](19-search-open/replay.gif) · [samples](19-search-open/contact-sheet.jpg) | M16 | 33 / ~17.7 Hz | Search header/suggestions reached. |
| [20-search-back: Search Back](20-search-back/replay.gif) · [samples](20-search-back/contact-sheet.jpg) | M16 | 29 / ~15.3 Hz | Settings returned; no inferred stack duration. |
| [21-registration-sheet-open: Registration opens](21-registration-sheet-open/replay.gif) · [samples](21-registration-sheet-open/contact-sheet.jpg) | M04 | 30 / ~16.1 Hz | Slide/scrim samples and pinned Close visible. |
| [22-registration-sheet-close: Registration closes](22-registration-sheet-close/replay.gif) · [samples](22-registration-sheet-close/contact-sheet.jpg) | M04 | 27 / ~14.3 Hz | Sheet exits; registration list reached. |

## What this changes in the plan

Intermediate samples strengthen the sheet/scrim, accordion, bar/overlay and About sequencing requirements. Source-declared durations/easing remain the numeric targets; these captures do not independently measure them. A direct pin did not retain a card, while the same center's list row did; preserve the intended design and current app functionality rather than copying this prototype result as a requirement. Dark selection did not supply a rendered dark design; native dark support must still use existing settings.

M05 dialog motion, M09 location-picker motion, M10 scanner/photo-viewer motion, M12 press/switch feedback, M13 success entrance and M15 waiting decoration were not separately captured here. M08 has incidental camera samples in sequence 12, not a standalone control/timing qualification. Reduced motion, rapid-interruption trials, camera/location permissions, upload/expiry/provider variants, full high-rate recording and all MuMu/profiler/integration acceptance remain pending.

## Verification

All 22 GIFs were decoded after creation; raw frame count is 624. The contact sheets were used to inspect sampled intermediate/final states, not as proof of continuous playback. `session.json` records capture provenance; `summary.json` records sampling intervals/dimensions; `checksums.sha256` protects the retained evidence. No editor changes, real uploads, credentials, messages, payments, account writes or application implementation were performed.
