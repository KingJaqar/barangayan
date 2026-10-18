# Barangayan Resident Android — Redesign Breakdown (NEW screens)

Hand-off spec for porting the redesigned screens from the **Barangay Resident Android Mobile Improvement** prototype ("new") into the existing **Barangayan Resident Android** React Native Expo app ("old").

The prototype is built with React, Tailwind and framer-motion. Every value below has been converted to its React Native / Expo equivalent. px values map 1:1 to RN density-independent points (dp).

---

## 0. How to use this document

1. Start with **§1 Foundations**: tokens, fonts and motion. Then build **§2 Shared components**. Every screen is assembled from these.
2. Set up **§3 Navigation and the bottom-tab rule** before building any screens.
3. Port the screens in the order of **§4 onwards**. Each screen has these sections:
   - **Layout:** top to bottom.
   - **Components:** with their specs.
   - **States**
   - **Motion**
   - **Navigation:** in and out.
   - **Changes vs old**
4. All sample content in the prototype (pins, dates, people) is placeholder. Wire each screen to the live Supabase data the old app already uses.

---

## 1. Foundations

### 1.1 Recommended Expo libraries

| Need | Library |
|---|---|
| Styling (Tailwind classes 1:1) | `nativewind` v4 (optional). Otherwise `StyleSheet` with the tokens below. |
| Navigation | `@react-navigation/native`, `@react-navigation/bottom-tabs` (custom `tabBar`), `@react-navigation/native-stack` |
| Top tabs (underline) | Custom component (see §2.6). `react-native-pager-view` is optional if you want tab swiping. |
| Animation | `react-native-reanimated` v3 |
| Bottom sheets | `@gorhom/bottom-sheet` (or a Reanimated `Modal` sheet) |
| Icons | `lucide-react-native` (same icon names as the prototype, e.g. `HouseIcon` → `House`) |
| Fonts | `expo-font`, `@expo-google-fonts/figtree`, `@expo-google-fonts/gideon-roman`, `@expo-google-fonts/inter`, `@expo-google-fonts/roboto` |
| Maps | `react-native-maps` with an OSM `UrlTile`, or `@maplibre/maplibre-react-native` |
| QR display | `react-native-qrcode-svg` |
| QR scan / camera | `expo-camera` (`CameraView` with `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`) |
| Photos / files | `expo-image-picker`, `expo-document-picker` |
| Location | `expo-location` (GPS and reverse geocode; can replace Nominatim) |
| Share / save | `expo-sharing`, `expo-file-system`, `expo-media-library` |
| Links (tel / mailto / maps) | `expo-linking` (`Linking.openURL`) |
| Haptics (optional, on long-press) | `expo-haptics` |
| Gradients (only the custom color picker) | `expo-linear-gradient` |
| Reduced motion | `AccessibilityInfo.isReduceMotionEnabled()` / Reanimated `useReducedMotion()` |

### 1.2 Color tokens

The brand colors are **dynamic**: the accent can be changed in Settings. Keep them in a React context (`ThemeContext`), not as constants.

| Token | Hex | Use |
|---|---|---|
| `brand` | `#0F6B58` (default accent) | Header bar, primary buttons, active states, links |
| `brandDark` | `#0B5444` | Pressed state of primary buttons |
| `brandSoft` | `#E6F1EE` | Tinted backgrounds, badges, highlight bands |
| `brandMuted` | `#D3E4E0` | Active bottom-nav pill, applicant-number border |
| `ink` | `#222222` | Primary text |
| `muted` | `#6A6A6A` | Secondary text |
| `line` | `#EBEBEB` | Borders, dividers, empty progress tracks, disabled button fill |
| `surface` | `#F4F4F4` | Grey fills: chips, inputs, nav bar, info boxes |
| `white` | `#FFFFFF` | Cards, screen background |
| `danger` | `#D93A3A` | Destructive actions, boundary outline, errors |
| `dangerSoft` | `#FDEDED` | Danger backgrounds |
| `dangerInk` | `#8F1D1D` | Bell badge, cancelled pill text, confirm-destructive fill |
| `amber` | `#B86E00` | Warning text |
| `amberSoft` | `#FDF1DC` | Warning backgrounds |
| `orange` | `#E8930C` | Hotline call button, occupancy ≥70% |
| `blue` | `#2F66CC` | User location dot, info tones |
| `rose` | `#C2416B` | Health tones |
| `violet` | `#6A4FD0` | Spare tone |
| Switch off track | `#D6D6D6` | |
| Checkbox border (off) | `#BDBDBD` | |
| Dashed "add" border | `#CFCFCF` / `#D6D6D6` | |
| Scrim | `rgba(0,0,0,0.40)` | Behind sheets and dialogs |

**Accent palette generation.** When the accent hex `c` changes, recompute:
- `brand = c`
- `brandDark = mix(c, black, 0.22)`, i.e. 22% toward black
- `brandSoft = mix(c, white, 0.90)`
- `brandMuted = mix(c, white, 0.80)`

```ts
const mix = (a: RGB, b: RGB, t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
```

**Preset accents:**
- Row 1: `#0F6B58`, `#2563EB`, `#DC2626`, `#7C3AED`, `#EA580C`
- Row 2: `#0D9488`, `#DB2777`, `#1565C0`, `#B91C1C`, `#1B6B30`

Up to 10 custom colors. A custom color is **rejected** if its contrast ratio against white is below 3 (WCAG relative luminance), so white button text stays readable.

**Category and status colors** (fixed, they do not follow the accent):

| Group | Values |
|---|---|
| Incident categories | Damaged Street Light `#E8930C`, Road Damage `#B4532A`, Drainage Issue `#3B7BE8`, Illegal Dumping `#6B7A2A`, Flooding `#6366F1` |
| Evacuation pins | brand green |
| Report status | Submitted bg `#E8EFFC` / text `#2F66CC` · In Progress `#FDF1DC` / `#9A5B00` · Resolved `#E6F1EE` / `#0F6B58` |
| Health registration status | Pending `#C27803`, Confirmed `#0F6B58`, Attended `#5B5BD6`, Cancelled `#D93A3A` |
| Announcement kinds | General `#2F66CC`, Emergency `#B42318`, Health `#0F6B58`, Events `#B4532A` |
| Reports tab badges | active `#C2410C`, new updates `#0F6B58` |
| Tinted pill backgrounds | category color at 10% alpha (`${hex}1A`) |

### 1.3 Typography

| Role | Font | Notes |
|---|---|---|
| **Header bar title (ALWAYS)** | **Gideon Roman Regular** | Every green AppBar title, on every screen |
| Everything else | **Figtree** (400/500/600/700/800) | Default "System Default" choice |
| User-selectable body fonts | System Default (Figtree), Inter, Arial, Roboto, Georgia | Settings › Font Style switches the body font app-wide (store it in context, apply it via a `Text` wrapper) |

In RN, every weight is a separate family name (e.g. `Figtree_700Bold`). Build an `AppText` component that takes `weight` and resolves the right family for the font currently selected.

**Type scale** (size / weight → use):

| Size | Weight | Use |
|---|---|---|
| 28 | 800, tight tracking | Home greeting |
| 26 | 800 | Panel headings (Emergency Info, QR Check-In Guide, Household…) |
| 24 | 800 | Applicant number, What's New, confirmation title |
| 23 | 800 | Help article question, Terms title |
| 22 | 400 Gideon | AppBar title (19 when the title is >14 chars) |
| 21 | 400 Gideon | AppBar title in back mode |
| 21 | 800 | Section titles (Medical drives, report tab titles, tracking titles) |
| 19 | 800 | Sheet and dialog titles, profile card name |
| 17 | 700–800 | Calendar month, sub-section headings |
| 15 | 700 | Tabs, buttons, card titles, toggle labels |
| 14.5 | 600–700 | Values in detail lists, timeline labels |
| 14 | 600 | Body |
| 13.5 | 500–600 | Subtitles, chips, counts |
| 12.5 | 500–700 | Meta lines, captions, errors |
| 12 / 11.5 | 700 | Pills, badges, weekday labels |
| 10.5 / 9.5 | 700 | "EMERGENCY" tag, nav badges |

### 1.4 Spacing, radii, elevation

- **Screen padding:** 20 horizontal (`px-5`), 20 top. Gaps between sections are 20–28. Floating overlays are inset 16.
- **Radii:**

  | Radius | Use |
  |---|---|
  | 12 | Buttons, inputs, icon tiles |
  | 16 | Cards and panels (the most common) |
  | 24 | Sheets, dialogs, nav item pill |
  | 30 | Bottom nav bar |
  | 999 | Pills and chips |

- **Shadows** (RN `shadowColor/Offset/Opacity/Radius` plus Android `elevation`):

  | Name | CSS | RN equivalent | Use |
  |---|---|---|---|
  | `card` | `0 2px 10px rgba(0,0,0,.05)` | `elevation: 2`, `shadowOpacity: .05`, `shadowRadius: 10`, `offset {0,2}` | Cards |
  | `search` | `0 3px 12px rgba(0,0,0,.08)` | `elevation: 4` | Floating controls, nav bar, FAB |
  | `sheet` | `0 -8px 30px rgba(0,0,0,.12)` | `elevation: 16` | Sheets and dialogs |

- **Grouping rule:** related rows sit in ONE rounded panel (16 radius, 1px `line` border, white, `card` shadow), separated by 1px `line` dividers. Do not use separate floating cards.
- **Touch targets:** at least 44×44 for all icon buttons.

### 1.5 Motion system

| Constant | Value |
|---|---|
| **Easing (everywhere)** | `Easing.bezier(0.23, 1, 0.32, 1)` (strong ease-out) |
| Press feedback / colors | 150 ms; scale to 0.98 (cards and buttons), 0.95–0.97 (tiles, small buttons) |
| Fades, tab underline, chips, dialogs | 200 ms |
| Bottom-nav active pill | 220 ms |
| Bottom-nav hide/show, overlay shift | 240 ms |
| Bottom sheet slide-in | 280 ms |
| Accordion | 220 ms height + opacity; chevron rotates 180° in 200 ms |
| Entrances | from `opacity 0`, `scale 0.96` (dialogs) or `translateY 8–12` (floating cards). Never from scale 0 |

**Shared-element pills** (framer `layoutId`): the bottom-nav pill, tab underline, segmented switches (List/Map, Light/Dark, Mission/Vision, dose history) and theme pill. In RN, measure each item's `onLayout` x/width and animate one absolutely positioned indicator with `withTiming(x, {duration: 200–220, easing})`.

**Reduced motion:** when it is on, drop translate and scale animations and keep only opacity fades (or no animation at all).

Never animate actions triggered from the keyboard. Never put a loader in front of content that is already there.

---

## 2. Shared components

### 2.1 StatusBar
Use `expo-status-bar` `style="light"` with `backgroundColor = brand`. The prototype's 44-tall fake status bar is only a simulation; do not port it.

### 2.2 AppBar (green header)
- **Size:** height 56, background `brand`.
- **Default mode (tab screens):**
  - Logo circle (36) and title (Gideon Roman 22, white; 19 if longer than 14 chars) on the left.
  - Three 44×44 round icon buttons on the right: **Search**, **Bell** and **Menu** (opens Settings), all white.
  - Bell badge: an 18 circle in `dangerInk` showing the real unread count. Hidden when the count is 0.
- **Back mode (pushed screens):**
  - A 3-column row: 44 | flex | 44.
  - `ChevronLeft` back button on the left, title centered (Gideon Roman 21, white, wraps to 2 lines if needed, e.g. "Emergency & DRRM Info"), empty right column.
  - No icons in back mode.

### 2.3 Bottom tab bar (custom `tabBar`)
- **Container:**
  - Floats 16 from the screen edges and sits above the safe area.
  - Radius 30, background `surface`, 1px `line` border, `search` shadow, padding 6.
  - 6 equal columns.
- **Items** (lucide icons):

  | Tab | Icon | Filled when active |
  |---|---|---|
  | Home | `House` | yes |
  | Services | `Clipboard` | yes |
  | DRRM | `PhoneCall` | no |
  | Maps | `MapPin` | no |
  | Health | `Heart` | yes |
  | Reports | `TriangleAlert` | no |

- **Inactive:** `muted`, stroke 1.8.
- **Active:**
  - `brand` color, bold label, stroke 2.2.
  - A `brandMuted` pill (radius 24) slides behind the active item, 220 ms with the standard easing.
- **Badges:**
  - A 16-tall circle, 9.5 bold white text, 2px `surface` ring.
  - Offset top −8, left 14.
  - Reports shows two badges: active count (`#C2410C`) and unread updates (`#0F6B58`).
- **Hide animation:** `translateY` 0 → 110, 240 ms.

### 2.4 Screen scaffold (PhoneShell → `Screen`)
The scaffold is the `SafeArea`, then the AppBar (or a custom header), then the scroll content, then an optional sticky footer, then the bottom nav.
- **Bottom padding of the content:**

  | Layout | Padding |
  |---|---|
  | Nav visible | 112 |
  | Nav + footer | 196 |
  | No nav | 40 |
  | No nav + footer | 120 |

- **`fullBleed` variant** (maps): no scroll; the content fills the screen.

### 2.5 Button

| Variant | Style |
|---|---|
| `primary` | bg `brand` (pressed `brandDark`), white text |
| `secondary` | white bg, 1px `line` border, `ink` text |
| `danger` | 2px border `danger` at 40%, `danger` text, pressed bg `dangerSoft` |

- **Base:** radius 12, padding 20×14, text 15 bold.
- **Pressed:** scale 0.98 over 150 ms.
- **Disabled:** bg `line`, text `muted`, not pressable.
- **Loading:** a spinning `LoaderCircle` icon plus a verb-ing label ("Saving…", "Sending…"). Disable the button while loading.

### 2.6 UnderlineTabs (top tabs)
- **Bar:** white, sticky directly under the header, horizontal padding 20.
- **Sizing:** `equal` (each tab gets 1fr) or `content` (each tab is as wide as its label, padding 8).
- **Labels:** 15 bold, single line. Active `ink`, inactive `muted`.
- **Indicator:** a 3-tall `brand` underline slides between tabs over 200 ms.
- **Used by:**

  | Screen | Tabs |
  |---|---|
  | Services | Documents / Requests / Logs |
  | Services › Requests › Active (sub-tabs, `content` sizing, no sticky wrapper) | All / Pending Payment / Paid / Processing |
  | Maps | Incidents / Evacuation |
  | Health | Active Medical Drives / My Registrations |
  | DRRM | Hub / Centers / Scan / Family / Alerts |
  | Reports | Incidents / Active / Resolved |
  | Terms & Privacy | Terms of Service / Privacy Policy |

### 2.7 FilterChips + HorizontalScroller
- **Chip:**
  - Pill, padding 16×6, 13.5 semibold.
  - Selected: bg `brand`, white text. Unselected: bg `surface`, `ink` text.
  - Optional 8px color dot before the label.
  - 150 ms color transition.
- **Scroller:** a horizontal `ScrollView` (`showsHorizontalScrollIndicator={false}`).
- **Chevrons:**
  - 32 white circle, 1px `line` border, `search` shadow.
  - Shown at the left or right edge only when there is more content in that direction (track it with `onScroll` and `onContentSizeChange`). They fade over 200 ms.
  - Tapping one scrolls by one item and snaps to its start (`scrollTo({x})`).
- **Same pattern elsewhere:** Home card rows, map category chips, Help Center categories, accent and font pickers, and the Report form categories.

### 2.8 BottomSheet
- **Scrim:** `rgba(0,0,0,.4)`, fades over 200 ms.
- **Sheet:**
  - Slides from `translateY: 100%` over 280 ms.
  - Top corners radius 24, white, `sheet` shadow, max height 90%.
  - Drag handle: 4×40 `line` pill.
- **Header:** 19 extrabold title and a 36 round close button (bg `surface`).
- **Footer:** pinned buttons stay visible while the content scrolls.
- **Reduced motion:** opacity only.

### 2.9 OptionSheet (single-select list in a sheet)
- **Rows:** divided by `line`. Each row has a 15 label (bold when selected), a 12.5 `muted` description, and a 24 radio circle.
- **Radio:** 2px border; when selected, `brand` border with a 12 `brand` dot.
- **Used for:** purpose of request, registrant picker, sex, employment.

### 2.10 ConfirmDialog
- **Scrim:** fades over 200 ms.
- **Dialog:** centered, radius 24, enters at scale 0.96 → 1 with opacity, 200 ms.
- **Text:** 19 extrabold title, 14.5 `muted` message.
- **Buttons:** 2 columns, Cancel (secondary) and Confirm (`dangerInk` fill for destructive actions).

### 2.11 Switch (SwitchTrack / ToggleRow)
- **Track:** 28×48, `brand` when on, `#D6D6D6` when off.
- **Thumb:** 24 white circle with `card` shadow, moves 20 over 150 ms.
- **ToggleRow:** a full-width pressable row with a 15 semibold label (plus a red `*` if required) and the switch on the right. Recommended: build it on RN `Pressable` with a Reanimated thumb, not the native `Switch`, so it matches exactly.

### 2.12 ActionFooter (sticky bottom bar on forms)
- **Left:** a 12.5 `muted` label (e.g. "Fee") over a 17 extrabold value. If the value is longer than 22 chars, show it at 12.5 and clamp to 3 lines.
- **Right:** the primary action.

### 2.13 Floating action pill (NewRequestButton)
- **Position:** bottom 100 (above the nav), right 16.
- **Style:** `brand` pill with a `Plus` icon and a label ("New request" / "Report incident"), `search` shadow.
- **Motion:** enters with opacity 0 → 1, scale 0.96 → 1 and translateY 8 → 0 over 200 ms. Shown only on the relevant tab.

### 2.14 Other shared pieces

| Component | Spec |
|---|---|
| **PanelHeading** | 26 extrabold title and a 13.5 `muted` subtitle |
| **SectionHeader** | 21 extrabold title, optional 13 subtitle, optional "See all" link on the right (14 semibold, underlined) |
| **Status pill** | Pill, padding 8×2, 11.5 bold, optional leading icon, tinted bg with colored text |
| **Progress bar** | 6 tall (4 on Home cards), radius 999, track `line`, fill `brand` (or a tone) |
| **Vertical status timeline** | 32 circles. Reached: filled `brand` with a white icon. Not reached: outlined `line`. 2px connector, `brand` if the next step is reached, otherwise `line`. Label 14.5: current = bold `brand`, reached = semibold `ink`, pending = medium `muted`. Date, or "Pending", below the label. |
| **Accordion** (DetailAccordion / guidelines) | Pressable header with a rotating chevron. Body animates height 0 → auto plus opacity over 220 ms (Reanimated with a measured height, or `LayoutAnimation`). |
| **Avatar** | Circle with initials, `brandSoft` bg and `brand` text. Sizes: sm 36, md 44, lg 80 (26 text). |
| **Empty state** | Centered 14 `muted` text, often in a `surface` box (radius 16, padding 16×24) |

---

## 3. Navigation map and the bottom-tab visibility rule

### 3.1 Rule
**The bottom tab bar is visible ONLY on these screens:**

| Screen | Tabs within it |
|---|---|
| Home | — |
| Services | Documents, Requests, Logs |
| Emergency & DRRM Info | Hub, Centers, Scan, Family, Alerts |
| Maps | — |
| Health | Active Drives, My Registrations |
| Reports | Incidents, Active, Resolved |
| Announcements | — |
| Settings (home) | — |

**Every other screen hides it.** That means every screen with a back arrow, plus Search.

**Implementation:**
- Make each top-level entry a tab.
- Push every detail screen onto a root native stack that sits *above* the tab navigator. Pushed screens then cover the tab bar automatically, with no per-screen flags.
- Announcements and Settings show the tab bar with **no tab highlighted**: render them inside the tab shell, with `activeTab = none`.
- **Exception:** DRRM › Centers › Map starts with the nav **tucked away** (see §8.3).

### 3.2 Full screen inventory (39 screens)

| # | Screen | Reached from | Nav bar |
|---|---|---|---|
| 1 | Home | Tab | ✅ |
| 2 | Services › Documents | Tab | ✅ |
| 3 | Services › Requests (All / Active[+sub-tabs] / Pickup / History) | Tab | ✅ |
| 4 | Services › Logs | Tab | ✅ |
| 5 | Request Tracking | Request row · Home sheet "View full request" · Search | ❌ |
| 6 | Requirements & Guidelines | Document row · Search | ❌ |
| 7 | Request Document | "Request" on #6 | ❌ |
| 8 | Payment Method | "Submit request" on #7 | ❌ |
| 9 | Payment — Pay at Pickup | #8 | ❌ |
| 10 | Payment — QR PH | #8 | ❌ |
| 11 | DRRM › Hub | Tab | ✅ |
| 12 | DRRM › Centers › List | Tab | ✅ |
| 13 | DRRM › Centers › Map | List/Map switch · center row tap | ⤵ auto-hidden, chevron |
| 14 | DRRM › Scan (+ QR scanner, Show QR sheet) | Tab | ✅ (the scanner is full-screen) |
| 15 | DRRM › Family (+ member sheet, my-code sheet) | Tab | ✅ |
| 16 | DRRM › Alerts (+ date wheel) | Tab | ✅ |
| 17 | Maps › Incidents | Tab | ✅ |
| 18 | Maps › Evacuation | Tab | ✅ |
| 19 | Health › Active Drives | Tab | ✅ |
| 20 | Health › My Registrations (+ detail sheet) | Tab | ✅ |
| 21 | Applicant Registration | "Register" on a drive card | ❌ |
| 22 | Registration Confirmed | Submit on #21 | ❌ |
| 23 | Reports › Incidents | Tab | ✅ |
| 24 | Reports › Active | Tab | ✅ |
| 25 | Reports › Resolved | Tab | ✅ |
| 26 | Report an Incident (+ Pin Your Location, submitted dialog) | FAB "Report incident" | ❌ |
| 27 | Incident Report tracking | Report row · Search | ❌ |
| 28 | Announcements (+ detail sheet) | Bell icon | ✅ (no tab active) |
| 29 | Search | Search icon | ❌ |
| 30 | Settings | Menu icon | ✅ (no tab active) |
| 31 | Profile | Settings | ❌ |
| 32 | Valid ID | Settings | ❌ |
| 33 | Manage Password | Settings | ❌ |
| 34 | Email Verification | Settings | ❌ |
| 35 | Location Verification | Settings | ❌ (full-bleed) |
| 36 | Help Center | Settings | ❌ |
| 37 | Help Article | Help Center | ❌ |
| 38 | Terms & Privacy Policy | Settings | ❌ |
| 39 | About Us | Settings | ❌ |

**Back behavior:**
- **Request Tracking:** returns to where it was opened from (Home or the Requests list, with the tab and filter preserved).
- **Document flow:** goes back one step at a time (QR/Pickup → Method → Form → Guide → Documents).
- **"View My Requests":** resets the flow to Services › Requests › All.

---

## 4. Home

**Layout:**
1. **Greeting header** (padding 20):
   - A 36 `brand` avatar with white 13 bold initials.
   - `MapPin` (16, `brand`) and the barangay name (14 semibold).
   - **"Good morning / afternoon / evening, {firstName}"** (28 extrabold). The greeting depends on the hour: before 12, before 18, otherwise evening.
2. **Quick access:** a 5-column grid.
   - Each item is a 56 tile (radius 16) with a 24 white icon (stroke 2.2) and a 12 semibold label below.
   - Tiles: Documents (`brand`), Report (amber), Emergency (`danger`), Maps (blue), Health (rose).
   - Press: scale 0.95.
3. **Your requests:** a SectionHeader, then a horizontal card row.
   - **Card:** width 244, padding 12, radius 12, white, border, `card` shadow.
   - **Card content:**
     - A 32 `brandSoft` icon tile.
     - Title (14 bold, 2 lines, min height 36).
     - "#ref · category" (11.5 `muted`).
     - A **4-segment progress bar** (4 tall): Submitted / Processing / Ready for pickup / Released.
     - Status label (11.5 bold, `brand` when ready) and the estimate on the right.
   - Press: scale 0.98.
4. **Around the barangay / Latest announcements:** a card row, width 232.
   - Category dot and label (Emergency = danger, Health = rose, Community = brand), plus the date.
   - Title (14 semibold, 2 lines).

**Horizontal rows (both):**
- **Swipe:** horizontal scrolling with `snapToInterval = cardWidth + gap` and `decelerationRate="fast"`.
- **Chevrons:** a round chevron (§2.7) at each edge where more cards exist. Tapping one moves exactly one card.
- **Gestures:** vertical swipes on the cards must still scroll the page.

**Request quick sheet** (tapping a request card opens a BottomSheet):
- **Header:** category (12.5), title (19 extrabold), ref (13 `muted`), and a close button.
- **Vertical 4-step stepper:**
  - Done: filled `brand` with a check.
  - Current: `brand` ring with a dot.
  - Pending: grey ring.
  - Each step shows its date, "Pending", or the estimate.
- **CTA:** a full-width primary **"View full request"** button opens Request Tracking (with Services highlighted). Back returns to Home.

**Changes vs old:**
- The scroll affordance is the chevrons.
- Card rows can be scrolled by hand.
- The bell count is real.

---

## 5. Services

**Shell:** AppBar "Services" and UnderlineTabs **Documents / Requests / Logs**.

### 5.1 Documents tab
- **Heading:** PanelHeading "Available documents" with a count.
- **List:** one panel with divided rows (`DocumentCard`).
  - **Row content:** a 48 `brandSoft` icon tile, title (15 bold, 2 lines), `Clock` + processing text (12.5 `muted`), `Tag` + fee (12.5 bold `brand`), and a trailing chevron.
  - Tapping a row opens **Requirements & Guidelines**.
- **Documents:**
  - Certificate of Indigency (₱100.00)
  - First Time Job Seeker (₱100.00)
  - Issuance of Barangay Clearance for Business Establishments (Tax Code)
  - Certified True Copy (₱10.00 per page)

### 5.2 Requests tab
- **Removed vs old:** the "My Requests" heading, the "Track your service applications" subtitle and the "Valid ID Verified" badge.
- **Filters:** **All / Active / Pickup / History** (FilterChips). They stick directly under the tabs, on a **transparent** background with no white band.
- **Active sub-tabs:** when the **Active** filter is on, an UnderlineTabs row appears below the chips: **All / Pending Payment / Paid / Processing** (`content` sizing, white background). Each request has a `stage` field: `pending-payment | paid | processing`.
- **Rows** (`MyRequestRow`):
  - Icon tile, title.
  - "Req ID: #REQ-2026-00074 · 15 Oct 2026".
  - Status pill with a clock icon (e.g. "Submitted (Pending Payment)").
  - Note (12.5 bold), e.g. "Awaiting complete requirements".
  - Processing line (12.5 `muted`), e.g. "Agency processing: 0m 0s / 15 minutes".
  - Chevron. Tapping opens **Request Tracking**.
- **Empty states:**
  - "No {stage} requests right now." (a filtered Active sub-tab with nothing in it)
  - "No requests here yet." (everything else)
- **FAB:** "New request" (§2.13), only on this tab.
- **New requests:** submitting a document adds it to the top of the list (stage `pending-payment`, numbered from #REQ-2026-00087).

### 5.3 Logs tab
- **Heading:** PanelHeading "Recent activity".
- **Rows** (not pressable): icon tile, title, timestamp (12.5), a status pill, and a fee pill (`brandSoft` bg, `brand` text, `Tag` icon).

---

## 6. Request Tracking (pushed, no nav)

**Header:** AppBar back mode, "Request Tracking" (Gideon Roman).

**Layout:**
1. **Top:** a 48 `brand` icon tile, the document title (19 extrabold, an addition vs old), and "Ref #REQ-2026-00074" (13 `muted`).
2. **Timing panel:**
   - `Clock` with "Awaiting complete requirements" (15 bold).
   - Label/value rows (13.5): **Agency processing**, **Resident wait**, **Total turnaround**.
   - A grey `surface` footer with the explainer note (12 `muted`).
3. **Payment panel** (`Wallet` header "Payment"). **This is the ONLY place for payment actions; the old bottom "Choose or continue payment" button is removed.**
   - **Method row:** `Banknote` (Pay at Pickup), `QrCode` (QR PH), or "No method selected" in `muted`.
   - **Status pill:**

     | Status | Style |
     |---|---|
     | Pending | `surface` / `muted` |
     | Paid / Free / Waived | `brandSoft` / `brand` |
     | Refunded | `surface` |
     | Cancelled | `dangerSoft` / `dangerInk` |

   - **Total Amount Due** in bold.
   - **Action rules:**

     | Case | What the panel shows |
     |---|---|
     | Pay at Pickup + Pending | Info note "Pay when collecting your document." No button. |
     | QR PH + an open session | One button: **"Continue Payment · 9:42"**. It ticks every second; at 0 it becomes **"Pay Now with QR PH"**. |
     | QR PH, no session | **"Pay Now with QR PH"** |
     | No method selected + payment required + eligible | **"Choose payment method"** |
     | Free / Waived | A check row reading "No payment required" or "Fee waived". No amount, no buttons. |
     | Paid / Refunded / Cancelled / Completed | Status and amount only. No payment or method buttons. |
     | Any case while Pending | **"Cancel Request"** (danger variant), below any payment action. |

4. **Status history:** a vertical timeline (§2.14).
   - Steps: Request Submitted (`Check`), Processing (`RefreshCw`), Ready for Pickup (`Store`), Completed (`CircleCheck`).
   - Each reached step shows its date and a note pill (e.g. "SLA accept"). The latest step's title is `brand`.
5. **Details panel:** Purpose, Residency, Personal appearance.

**Fallback:** if a request has no tracking record, show "Tracking details aren't available yet."

---

## 7. Document request flow (all pushed, no nav)

### 7.1 Requirements & Guidelines
**Header:** "Requirements & Guidelines".
1. **Top:** icon, title (21 extrabold), description (14 `muted`), and two `surface` badges (13 bold, `brand` icon): **fee** and **processing**, e.g. "15 minutes of agency processing".
2. **Facts panel:**
   - Office/Division (full width).
   - Classification and Type of Transaction (2 columns).
   - Who May Avail.
   - Labels 12 `muted`, values 14.5 bold.
3. **Requirements:** a `brandSoft` box with `CircleCheck` rows (14.5 semibold).
4. **Charter lists** (bordered card, NumberedList with 27 `surface` circles): **Checklist of Requirements** and **Where to Secure the Requirements**.
   - **Preserve the stored numbering exactly.** Certified True Copy goes "1. … 3.".
5. **Client Steps:** a connected numbered timeline (filled `brand` circles with a connecting line).
6. **Fees to Be Paid**, then **Processing Time**: duration chips (2 mins, 3 mins…), "TOTAL: 15 MINS", and the source note.
7. **Accordions:** Agency Actions, Person Responsible, Additional Notes.
   - Additional Notes text: "Please ensure all requirements are complete before proceeding. Bring the original documents for verification at the Barangay Hall. Processing times are estimates and may vary during peak periods."
8. **Sticky ActionFooter:** "Fee" with the document's fee text. The button depends on the account state:

| Account | Button |
|---|---|
| Verified valid ID | **Request** (enabled) |
| Unverified | **Verify Valid ID** |
| Checking | **Checking Valid ID…** (spinner, disabled) |
| Guest | **Log In to Request** |

Use the exact catalog wording supplied for all four documents. Certificate of Indigency and First Time Job Seeker share the same sections.

### 7.2 Request Document (form)
1. **Top:** title, a fee badge, and the note "* required".
2. **Resident Details card:** name and phone (pre-filled), plus an "Edit in Profile" link.
3. **Approved profile ID card:**
   - A 72×108 ID image, name, ID type and "Version N".
   - A secondary **Refresh verification** button with three states:
     - Idle.
     - Refreshing: spinner for about 1.2 s.
     - Done: a short "Verification refreshed just now" message.
4. **Purpose of request:** a select row that opens an OptionSheet with 5 options. Choosing **Others** reveals a required text input.
5. **Total pages stepper** (Certified True Copy only):
   - Minus/plus buttons, minimum 1, maximum 200. Required.
   - The fee updates live: ₱10.00 × pages.
6. **Residency fields** (the two resident certificates only):
   - **HOA certification** upload: jpg/png/webp/pdf, 5 MB or less. Shows the file name and size, with remove. Errors appear inline (12.5 `danger`).
   - **"I am a renter"** toggle. When on, a **lessor endorsement** upload is required.
7. **Personal appearance** toggle (required).
8. **Additional notes:** a textarea (optional).
9. **Sticky footer "Submit request":** disabled until the form is valid.
   - Valid means: a purpose is chosen (with text if "Others"), appearance is on, the lessor file is attached if renting, and pages are 1 or more.
   - Submitting goes to Payment Method.

**Expo:** `expo-document-picker` (type `['image/*','application/pdf']`); check `size` against 5 MB.

### 7.3 Payment Method
- **PaymentSummary:** title and ref, then a big `brandSoft` amount card (34 extrabold value, or the fee text when the fee is set at pickup).
- **"How would you like to pay?"** Two option rows, each with an icon, label, one-line description and chevron:
  - **Pay at Pickup:** always enabled.
  - **Pay with QR PH:** disabled (muted, no chevron) when the amount is unknown, with the text "Not available for fees assessed at pickup." Business Clearance therefore only offers Pickup.
- **Secondary actions:**
  - **View My Requests**
  - **Refresh payment details** (the same 3-state refresh, showing "Payment details updated just now")

### 7.4 Payment — Pay at Pickup
PaymentSummary, then a confirmation card (`CircleCheck` + "Pay ₱100.00 in cash when you pick up… Your pickup payment has been recorded."), then the secondary actions.

### 7.5 Payment — QR PH
1. **Details card:** title and ref, the Document Fee row, a 32 `brand` amount, and a status chip:
   - **"Expires in HH:MM:SS"** (`brandSoft`).
   - Under 5 minutes it turns amber (`amberSoft`).
   - **"Expired"** (`dangerSoft`).
   - Plus the transaction ref in a monospace font.
2. **QR panel:**
   - A 216 QR (`react-native-qrcode-svg`) with **"Save QR (Ref #…)"**, which saves via `expo-media-library` / `expo-sharing`.
   - **Expired state:** a placeholder icon, "This QR code has expired" and **"Pay Now with QR PH"**. That button creates a new txRef and restarts the 30-minute timer.
3. **"How to pay":** 5 numbered steps.
4. **"Waiting for payment...":** a status card with a pulsing `brand` dot (a Reanimated scale/opacity loop that stops under reduced motion). Hidden once expired.
5. **"Cancel Payment"** (danger variant): returns to Payment Method.

---

## 8. Emergency & DRRM Info

**Shell:** the AppBar title "Emergency & DRRM Info" (wraps to 2 lines) and UnderlineTabs **Hub / Centers / Scan / Family / Alerts**.

### 8.1 Hub
- **Heading:** "Emergency Info" (26 extrabold) and "Be Prepared" (13.5 `muted`).
- **Disaster Preparedness Guidelines:**
  - 17 bold heading with an **Offline** badge (`brandSoft` pill, `Wifi` 14 icon).
  - One panel. Each row: a 40 icon tile, title (15 bold) and a rotating chevron.

    | Tone | Background | Icon |
    |---|---|---|
    | info | `brandSoft` | `Info` |
    | warning | `amberSoft` | `TriangleAlert` |
    | danger / fire | `dangerSoft` | `Flame` |

  - Expanding a row shows its steps as 6px dot bullets, indented 70. **Only one row is open at a time.**
- **Emergency Hotlines** (Offline badge):
  - Police: blue tile, `Shield` icon.
  - Fire Department: danger tile, `Flame` icon.
  - Barangay DRRM Office: `brandSoft` tile.
  - Each row has the name (15 bold), the number (13 `muted`), and a 44 **orange** round call button (`Phone` icon) that calls `Linking.openURL('tel:…')`. Press: scale 0.95.

### 8.2 Centers › List
- **Toolbar:**
  - A segmented **List / Map** switch: `surface` pill track with padding 4. The selected pill is `brand` with white text and slides over 220 ms. *(Changed vs old: green instead of dark red.)*
  - A sort button (`ArrowDownUp`) that toggles **Nearest / Most space**.
- **Count line:** "Showing **7** Locations" (13.5).
- **Routing status card** (new: it can be hidden):
  - **Expanded:**
    - White card (radius 16, padding 16, right padding 44, `card` shadow).
    - Lines: `CircleAlert` (danger, bold) for warnings, `CloudCheck` (`brand`) for OK.
    - Footnote: "Offline map (2026-10-12) · © OpenStreetMap contributors (ODbL 1.0)" (11.5).
    - An **✕** at the top right collapses it.
  - **Collapsed:** a slim `surface` bar (radius 12) with `Route` + "Routing status · Show" + a chevron. Tapping it expands the card. 150 ms fade.
- **Centers panel** (one panel, divided rows). Each row:
  - Name (15 bold) with a `BadgeCheck` (`brand`) if verified.
  - Address (12.5 `muted`, 1 line).
  - `Footprints` + "0.4 km · Est. 5 min".
  - **Occupancy:** a label/value row and a 6-tall bar.
    - Percent = round(occupants / capacity × 100).
    - Color: **red** when full ("FULL (n/cap)"), **orange** at 70% or more, otherwise **brand** ("pct% (n/cap)").
  - Amenity chips (`surface` pills, icon + 11.5 label).
  - Tapping a row switches to Map with that center selected.

### 8.3 Centers › Map (full-bleed, nav auto-hides)
- **Layout:** the tabs and the List/Map toolbar stay on top; the map fills everything below.
- **Search:** a floating bar at top 12, inset 16, height 44, pill, `search` shadow. Placeholder "Search 7 evacuation centers...". Filters the pins by name.
- **Bottom nav behavior:**
  - **Hidden on entering** the map, and hidden again whenever the user touches the map.
  - A **chevron toggle** (a 28×56 white pill, `search` shadow) sits at the bottom center:
    - bottom 10 while the nav is hidden;
    - bottom 94 while it is shown.
  - Tapping it slides the nav in or out (`translateY` 110 ↔ 0, 240 ms).
  - The floating overlay group animates its `bottom` **48 ↔ 104** in sync, 240 ms.
- **Overlay stack** (bottom up):
  - **Control row**, identical to Maps: **Maps | You** in one white pill on the left (divided, `Map` / `Navigation` 18 icons, 14 bold `brand`), and **− | +** in a matching pill on the right.
    - **Maps:** fits the barangay boundary.
    - **You:** flies to the resident and shows a blue dot.
  - **Routing status pill:**
    - **Collapsed:** a white pill with `CircleAlert` (danger), the first warning line truncated (12.5 semibold), "+2" and a chevron.
    - **Expanded:** a white card listing all the lines, plus "Show less".
  - **Selected center card**, which replaces the control row:
    - Radius 16, padding 16.
    - Name (15.5 bold) and address, with a 32 ✕.
    - Occupancy chip (tone colors, radius 6) with counts.
    - Walk time and distance on the right.
    - Bar.
    - Enters with opacity, translateY 12 and scale 0.98 over 220 ms. Selecting a center flies the map to it at zoom 17.
  - **Empty search:** a "No matching centers" pill.
- **Removed vs old:** the right-edge buttons (route-to-nearest, show-all, clear-route).

### 8.4 Scan
- **Heading:** "QR Check-In Guide" (26) and its subtitle.
- **Buttons:** two side by side.
  - **Scan QR:** solid `brand`, `ScanLine` icon.
  - **Show QR:** 2px `brand` outline, `brand` text.
  - Both: radius 12, padding 14, press scale 0.98.
- **"Why Scan?":** a `brandSoft` box with an `Info` icon.
- **How to Scan:** Option 1 / Option 2 as numbered steps (filled `brand` circles).
- **QR Scanner** (full-screen, black):
  - 56 header with ✕ and "Scan QR Code".
  - Live `CameraView`.
  - A 256 frame (radius 24) with four 48 corner brackets (4px, `brand`). Outside the frame is dimmed to 50% black.
  - "Position the barangay QR code within the frame" (15, 90% white).
  - **Permission denied:** a `CameraOff` icon and "Camera unavailable. Allow camera access in your settings to scan." inside the frame. Use `useCameraPermissions()`.
- **Show QR sheet:**
  - Title "Show QR Code".
  - **Center selector row:** `MapPin` + name + chevron. It opens the **Select Evacuation Center** picker: a centered dialog (max width 360), centers sorted A–Z, the selected one on `brandSoft` with a check.
  - The center's address.
  - A 208 QR in a bordered card (value `barangayan:checkin:{centerId}`).
  - A staff note.
  - **Share QR Code** (`expo-sharing`) and **Download QR** (save a PNG).

### 8.5 Family
- **Heading:** "Household: Jr Family" (26) and its subtitle.
- **My QR Code card:** icon tile, title, a **Show My Code** pill (opens a sheet with a 248 QR), a 152 inline QR (`barangayan:household:{id}`) and a caption.
- **Family Members:**
  - Header: "Family Members" with a "1 Total" badge.
  - Rows: a 44 initials avatar, name (15 bold), Relation and Role chips, and a chevron. Tapping a row opens the edit sheet.
  - Empty state: "No family members added yet." (`surface` box).
  - A full-width primary **Add Family Member** button.
- **Member sheet:**
  - Title "Add Family Member" / "Edit Family Member".
  - **Full Name:** height 48, radius 12. `surface` bg; on focus, white bg with a `brand` border.
  - **Relation** chips: Spouse, Child, Parent, Sibling, Grandparent, Other.
  - **Role** chips: Head of Family, Student, Employed, Unemployed, Retired.
  - **Footer:** **Remove** (danger, edit mode only) and **Add Member** / **Update** (disabled while the name is empty).

### 8.6 Alerts
- **Header:** a `dangerSoft` tile with `TriangleAlert`, "Emergency Alerts" (21 extrabold) and a count pill.
- **Period chips:** All / Today / Last Week / Last Month / Last Year (0 / 7 / 30 / 365 days from today).
- **Date filter** (changed vs old: a wheel instead of a date field):
  - **"Filter by specific date"** expands a panel (height animation, 220 ms) with a **Month / Day / Year wheel picker**.
  - Buttons: **Clear** and **Show Sep 26** (the label uses the date currently in the middle row).
  - Once applied, a `brand` chip with the date and an ✕ appears. Choosing a period chip clears it.
- **Wheel mechanics** (RN: a vertical `FlatList` / `ScrollView` per column):
  - **Size:** item height 40, 5 visible rows (column height 200). Top and bottom padding of 80 let the first and last items reach the center.
  - **Snapping:** `snapToInterval={40}`, `decelerationRate="fast"`. On `onMomentumScrollEnd`, index = `round(y/40)`.
  - **Highlight band:** a `brandSoft` band, radius 12, 40 tall, centered behind the middle row.
  - **Row styles:**

    | Row | Style |
    |---|---|
    | Selected | 16 bold `brand` |
    | ±1 | 15 medium `muted`, opacity 0.75 |
    | Further | opacity 0.4 |

  - Tapping a row scrolls to it.
  - The day count adjusts to the month (no Feb 31).
  - Years: 2024–2027.
- **List:** "Showing 2 of 2 alerts", then one panel of rows. Each row:
  - A `dangerSoft` tile with `CircleAlert`.
  - An **EMERGENCY** tag (`danger` bg, white, 10.5 bold, tracked).
  - "Sep 26, 2026 · 3:15 PM" (12 `muted`).
  - Title (15 bold) and message (13 `muted`).
- **Empty state:** "No alerts for this period."

---

## 9. Maps

**Layout (full-bleed):**
1. UnderlineTabs **Incidents / Evacuation**, directly under the header. Switching clears the selection.
2. The map fills the rest of the screen.
3. Floating at the top (inset 16, top 12):
   - **Search bar:**
     - Height 48, pill, white, `search` shadow.
     - `Search` 20 icon and an input (14.5 medium, "Search locations...").
     - A 36 **filter toggle** on the right. When on: `brand` border, `brandSoft` bg.
   - **Category chips** (Incidents only, while the filter is on):
     - Horizontally scrollable with chevrons.
     - Padding 14×6, 13 semibold, each with a color dot.
     - Selected: `ink` bg, white text. Unselected: white.
     - Order: Damaged Street Light, Road Damage, Drainage Issue, Illegal Dumping, Flooding.
     - Tapping a chip again shows all categories.
4. **Bottom overlay** (bottom 100, inset 16): **Maps | You** on the left and **− | +** on the right (same spec as §8.3). *Removed vs old:* the locate button under the zoom buttons.

**Map configuration:**
- **Tiles:** `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, max zoom 19. Keep the **© OpenStreetMap** attribution visible at the bottom right.
- **Barangay boundary:** the supplied Ampid I GeoJSON polygon. Convert `[lng,lat]` to `{latitude, longitude}`. Stroke `#D93A3A`, width 3, fill at 6% opacity.
- **Initial view:** fit the boundary with edge padding top 30 / bottom 70 / left 120 / right 150 (`fitToCoordinates`).
- **Pins:**
  - Custom teardrop SVG (30×39) filled with the category color, a 2px white stroke and a white center dot (r 5.5).
  - Selected: 40×51, brought to the front.
  - Anchor at the bottom tip (`anchor={{x:.5,y:1}}`).
- **User dot:** a `blue` circle (r 8) with a 3px white border, inside a halo (r 18, `blue` at 18%).
- **Movement:** "You" and the selected pin animate to zoom 17; "Maps" animates to the boundary (`animateToRegion` / `animateCamera`, about 500 ms).
- **Tapping a pin:** opens a **place card** that replaces the control row.
  - Radius 16, padding 14.
  - A 48 colored icon tile (`LightbulbOff`, `Construction`, `Droplets`, `Trash2`, `Waves`, `Tent`).
  - Type label (12 bold, colored), title (15 bold), report time (12.5 `muted`), and a 32 ✕.
  - Enters with opacity, y 12 and scale 0.98 over 220 ms.
  - Tapping the map closes it.
- **Empty search:** a "No matching locations" pill.

---

## 10. Health

### 10.1 Active Medical Drives
1. **Calendar card** (padding 16, radius 16):
   - Month and year (17 extrabold) with 32 prev/next buttons.
   - 7 columns; weekday labels 11.5 bold `muted`.
   - **Days:** 40 circles, 14 semibold.

     | Day | Style |
     |---|---|
     | Selected | `brand` fill, white text |
     | Outside the month | `muted` at 50%; tapping one jumps to that month |
     | Has a drive | a 4px dot in the category color (white when selected) |

   - *Removed vs old:* the arrow next to the month.
2. **Filter row:**
   - A 32 round **calendar toggle** (`CalendarDays`; `brandSoft` when the calendar is shown) that shows or hides the calendar.
   - Category chips with dots. Choosing a category also filters the calendar dots.
3. **"Medical drives"** (21 extrabold), with "Saturday · Aug 15" below it.
4. **Drive cards** (in one panel). Each card:
   - Title (15 bold, 2 lines) and a category pill (10% tint).
   - `Calendar` date/time, `MapPin` location, `Users` eligibility (12.5 `muted`).
   - "Remaining Slots" with "{left}/{total} {unit}" and a bar.
   - **Register button:** `brand`, radius 12, padding 16×8, 13.5 bold, press scale 0.97.
     - Once registered: a `brandSoft` **"✓ Registered"** pill.
     - When there are 0 slots: a disabled **"Full"** button.
5. **Empty state:** a `surface` box with text.

*Removed vs old:* the uppercase labels (CALENDAR / FILTER DRIVES / SELECTED DATE).

### 10.2 My Registrations
- **Filters:** All / Pending / Confirmed / Attended / Cancelled, with status-color dots.
- **Heading:** "My applications".
- **Cards:** title and category pill, date/time/location, "Applicant # OPT-20260821-0001" (`brand` bold), and a status pill.
- **Empty state:** "No registrations with this status."
- **Detail sheet** (BottomSheet, with a pinned **Close** button):
  - **Registration info:** the big applicant number (21 extrabold `brand`), Registered on, PWD, Age. Labels sit in a 124-wide column with icons.
  - **Drive details:** Date, Time, Location, Eligible For, plus the slots bar.
  - **Status timeline:** Pending → Confirmed → Attended (or Pending → Cancelled).
    - Done: `brand`. Current: status color, with a **"Current"** tag. Upcoming: bordered grey.
    - Each step shows its description.

### 10.3 Applicant Registration (pushed)
1. **DriveSummary card:** title, pill, meta and slots bar.
2. **Applicant number bar:** `brandSoft` bg, `brandMuted` border, label (13 semibold `brand`) and the number (24 extrabold), e.g. **#VAC-001**.
3. **"Registering for":**
   - A card with an avatar, name (15.5 bold), relation, and **Change**, which opens an OptionSheet of household members.
   - Name / Age / Address rows.
   - "Edit in Profile".
4. **Eligibility Information:**
   - **PWD:** a ToggleRow.
   - **Comorbidities:**
     - Multi-select pills. Selected: `brand` border, `brandSoft` bg and a check.
     - **"None"** clears the others.
     - The pills wrap, so "Immunocompromised" is never cut off.
   - **Dose History** (vaccination drives only): a 3-segment switch **1st Dose / 2nd Dose / Booster**. A white pill slides between segments over 200 ms.
5. **Privacy consent block:**
   - `ShieldCheck` icon and the consent text.
   - A 24 custom checkbox (radius 6; `#BDBDBD` border, which turns into a `brand` fill with a check).
   - Label: "I understand and consent".
   - **BUG FIX:** toggling the checkbox must NOT scroll the screen. In RN, don't auto-focus or `scrollTo` on change.
6. **Sticky "Submit Registration":** disabled until consent is ticked.

### 10.4 Registration Confirmed
- **Check badge:** a 72 `brand` circle that enters at scale 0.96 → 1 with a fade over 240 ms.
- **"Registration Confirmed!"** (24 extrabold `brand`) and its subtext.
- **Applicant number box:** 32 extrabold `brand`.
- **Arrival note:** location, date and time shown in bold within the text.
- **Done:** returns to Health. The drive now shows "Registered", and a new **Pending** registration appears in My Registrations.

---

## 11. Reports

### 11.1 Tabs: Incidents / Active / Resolved
- **Heading:** the tab title (21 extrabold): My Incident Reports / Active Reports / Resolved Reports.
- **Resolved tab:** a **"Mark all as read"** link (`CheckCheck`, `brand`; disabled when nothing is unread).
- **Incidents tab filters:** **All / Submitted / Progress / Resolved** (colored chips), pinned under the tabs.
- **Report rows:**
  - A 64 thumbnail (radius 12). If there's no photo, a tinted placeholder with the category icon.
  - Title: extrabold with a `brand` dot when unread.
  - Description (2 lines), category tag, status pill and short date.
  - On Resolved items, a **Mail / MailOpen** button toggles read/unread.
- **Status pills:**

  | Status | Colors | Icon |
  |---|---|---|
  | Submitted | blue | `Clock` |
  | In Progress | amber | `RefreshCw` |
  | Resolved | green | `CircleCheck` |

  Small size: padding 8×2, 11.5. Large size (detail screen): padding 12×4, 13.
- **FAB:** **"Report incident"** (§2.13).

### 11.2 Report an Incident (pushed)
1. The "* required" note.
2. **Category** (required): horizontally scrollable pills with a 2px border in the category color and a check when selected.
3. **Title** (required, 0/100), **Description** (0/1000, 4 rows).
   - **CountedField:** label with a red asterisk, `surface` input that turns white with a `brand` border on focus, and a counter at the bottom right.
4. **Photos:**
   - Header "Photos" with "n/5".
   - Helper text: "up to 5 photos · JPG, PNG, WebP — max 10 MB each".
   - A 3-column grid of square thumbnails, each with a 60% black ✕.
   - A dashed "Add photo" tile (2px `#D6D6D6`, `Camera` icon) while there is room.
   - Errors in red.
   - **Expo:** `expo-image-picker` with `allowsMultipleSelection` and `selectionLimit = 5 − n`; check `fileSize`.
5. **Location card:** shows the address and lat/lng, with "Tap to pin the exact location on the map". Tapping it opens **Pin Your Location**.
6. **Specific area details** (0/300, 3 rows).
7. **Sticky "Submit Report":** enabled once a category and title are set.

**Pin Your Location** (full-screen modal, slides up over 280 ms):
- Green header "Pin Your Location" with ✕.
- A draggable pin map at zoom 17, with a hint pill "Tap or drag the pin" (`Hand` icon, `ink` at 85%).
- **Bottom panel:**
  - Address input.
  - Coordinates.
  - Reverse-geocode status, 600 ms after the pin stops moving: "Finding address…" with a spinner, or "Couldn't find the address — type it in." in `danger`.
  - **"Use This Location"** (disabled while the address is empty).
- **Expo:** `Location.reverseGeocodeAsync`, or keep Nominatim.

**Submitted dialog:**
- 64 `brand` check, "Report submitted" (20 extrabold), subtext, **Done**.
- Enters at scale 0.96 over 220 ms.
- Done goes to Reports › Active, where the new report appears.

### 11.3 Incident Report tracking (pushed, title "Incident Report")
1. **Photo carousel:**
   - 4:3 images, paged with snap.
   - A "1/3" counter at the top left.
   - An expand button (`Maximize2`, 55% black) at the bottom right.
   - Below: prev/next arrows and dots. The active dot widens to 20 and turns `brand` (200 ms).
   - If there are no photos: a muted box reading "No photos were attached…".
2. **Full-screen viewer:** black, fades over 200 ms. Counter, ✕, `contain` image, and prev/next buttons (15% white circles, disabled at the ends).
3. **Top:** title (21 extrabold), a large status pill, the category tag and the description.
4. **Location panel:**
   - A 224-tall static pin map (radius 12) with the boundary outline.
   - Zoom buttons on the right, plus a re-center button.
   - Address, coordinates and area details.
5. **Meta panel:** Reported on / Last updated / Confirmations, each with an icon circle.
6. **Status history:** Report Submitted → In Progress → Resolved.

---

## 12. Announcements (bell icon, nav visible, no tab active)
- **Header:**
  - "What's New" (24 extrabold).
  - "{n} unread", or "You're all caught up".
  - **Mark all as read** (disabled when there are 0 unread).
- **Filters:** All / General / Emergency / Health / Events (colored).
- **List** (one panel). Each row:
  - A 40 tinted icon tile (`Info` / `TriangleAlert` / `HeartPulse` / `CalendarDays`).
  - The kind label (bold, colored) and a relative date ("Today", "Yesterday", "N days ago").
  - Title: extrabold with a `brand` dot when unread, otherwise semibold.
  - Summary (2 lines) and a full timestamp.
  - A Mail / MailOpen toggle.
- **Tapping a row:** opens a sheet and marks the announcement read.
  - The sheet shows a kind pill and ✕, the title (21 extrabold), `Clock` with the relative and full date, a divider, and the body (15 / line height 23, newlines preserved).
- **Empty state:** "No announcements in this category."
- **Bell badge:** the real unread count.

---

## 13. Search (pushed, no nav)
- **Custom green header** (height 56):
  - A back arrow.
  - A white pill input with a `Search` icon, auto-focused, placeholder "Search Barangayan".
  - A clear ✕ when there is text.
- **Before typing:** the intro text, then **Suggested searches**. Six rows, each with a `Search` icon; tapping one fills the query:
  - Barangay clearance
  - Certificate of residency
  - Announcements
  - Medical drives
  - Document requirements
  - Emergency hotlines
- **Results:**
  - A `Results for "{q}"` line (announce it with `accessibilityLiveRegion="polite"`).
  - **Groups in order:** Documents & services, Announcements, Medical drives, Help, Your records. Up to 6 results each.
  - **Row:** a 36 `brandSoft` tile (`FileText` / `Megaphone` / `Stethoscope` / `LifeBuoy` / `FolderClock`), title (bold, 2 lines), subtitle (`muted`, 2 lines), and a chevron.
  - **Matching:** every word in the query must appear in the title, subtitle or keywords (case-insensitive).
- **No results:** `No results for "{q}". Try another word, like "clearance".`
- **Where a result goes:**

  | Result | Opens |
  |---|---|
  | Document | Requirements & Guidelines |
  | Announcement | Announcements, with that announcement's sheet open |
  | Drive | Health |
  | Help | DRRM |
  | Request | Request Tracking |
  | Report | Report tracking |

---

## 14. Settings

### 14.1 Settings home (nav visible, no tab active)
Sections are 24 apart.
1. **Profile card:** a white card (radius 16, padding 16) with an 80 avatar, name (19 extrabold), email (13.5 `muted`) and **Edit Profile** (13.5 bold `brand`). Tapping it opens Profile.
2. **Account** (group label 14 bold `muted`; rows in one panel). Each row has an icon, label, live status subtitle and chevron:

   | Row | Status subtitle |
   |---|---|
   | Valid ID (`CreditCard`) | Verified: `brand` with a check. Checking/unverified: amber. Guest: "Not submitted". |
   | Manage Password (`Lock`) | — |
   | Email Verification (`Mail`) | "Email verified" with a check, once verified |
   | Location Verification (`MapPin`) | the saved location, or "Pin your home location" |

3. **Preferences:**
   - **Push** and **SMS Notifications** switches.
   - **App Theme** (`Palette`):
     - A **Light / Dark** segmented switch: `surface` track with padding 4 and radius 12; a white pill slides over 220 ms. Active label `brand` bold.
     - An **accent picker** row (scrollable):
       - 44 swatches. Selected: a 2px `ink` ring with offset 2 and a white check.
       - A 1px divider, then the custom swatches.
       - A dashed **+** (2px `#CFCFCF`) that opens the custom color sheet.
       - Caption: "{n}/10 custom colors saved · hold a swatch to remove it".
       - **Long-press** a custom swatch (550 ms, cancelled if the finger moves more than 6px) to remove it. `Pressable onLongPress delayLongPress={550}`; add haptics.
   - **Font Style** (`Type`): pills showing each option in its own font (System Default, Inter, Arial, Roboto, Georgia). Selected: `brand` fill.
4. **Privacy & Data:**
   - **Download My Data:** exports profile, household, location and prefs as JSON (`expo-file-system` + `expo-sharing`).
   - **Delete My Account:** danger row; opens a ConfirmDialog "Delete your account?" with a **Delete** button.
5. **About:** Help Center, Terms & Privacy Policy, App Version (static, "v1.0.0"), About Us.
6. **Session:** **Logout** (danger), with a ConfirmDialog "Log out?" and a **Logout** button.

**Custom Accent Color sheet:**
- Title "Custom Accent Color", with "Drag to pick any color. Up to 10 custom colors can be saved."
- **Saturation/Value square:** up to 260, radius 16.
  - Background: the hue, with a white→transparent gradient (left to right) and a black→transparent gradient (bottom to top) on top (two `LinearGradient`s).
  - Thumb: 24, 3px white border, shadow.
  - Driven by `PanGestureHandler` / `Gesture.Pan()`.
- **Hue bar:** 28 tall pill with a rainbow gradient; 32 thumb with a 3px white border, filled with the current hue.
- **Hex row:** a 44 preview circle and a hex input (monospace 16 bold, upper-case, auto "#").
- **Contrast rule:** if contrast with white is below 3, show an amber warning ("Too light — white text on buttons would be hard to read. Pick a darker shade.") and disable **Save Color**.
- **Footer:** Cancel / **Save Color**.
- Selecting any accent recolors the brand tokens app-wide (§1.2). Category, status and pin colors don't change.

### 14.2 Profile
- **Avatar:** 80, with a 32 `brand` camera button overlapping it (3px white border) that opens the image picker.
- **Header:** name (22 extrabold) and "Fields marked * are required".
- **Panels** (heading 15 bold):

  | Panel | Fields |
  |---|---|
  | Personal Information | First, Middle, Last, Suffix, **Sex** (OptionSheet), **Date of Birth** (date picker, no future dates), **Employment Status** (OptionSheet) |
  | Contact | Email, Mobile (`^09\d{9}$`). Changing the email shows an amber note: "You'll need to verify your new email again after saving." |
  | Address | House No. and Street (editable). Barangay, City, Province are **locked** (`Lock` icon, `muted`). |
  | Household Information | **Add Member**, plus a member list (tap to edit or remove via the Member sheet) |

- **ProfileField:** label 12.5 semibold `muted` (with a red `*` if required); value 16 semibold; a green `CircleCheck` when a required field is valid; error text 12.5 red below.
- **Sticky Save Changes:** disabled unless something changed and the form is valid.
  - Saving: "Saving…" with a spinner.
  - Saved: "✓ Changes saved".
  - Saving a new email marks it unverified.

### 14.3 Valid ID
- **Status banner** (radius 16, padding 16):

  | State | Banner |
  |---|---|
  | Verified | `brand`, `CircleCheck` |
  | Checking | amber, `Clock`, "We're checking your valid ID" |
  | Unverified / guest | amber, `ShieldAlert` |
  | After a submit | amber "ID submitted", with the file name |

- **When verified:** the ID image card (16:10, radius 16) with "Digital PhilSys ID · Version N", plus the replacement note.
- **Submit a replacement ID:** a file picker (image or pdf). Hidden once submitted or while checking.
- **Back to Settings**

### 14.4 Manage Password
- **Info note:** `surface` box with an `Info` icon.
- **Success banner** (`brandSoft`): "Your password has been updated." or "We sent a recovery link to {email}." (with a `Mail` icon).
- **Fields:**
  - Current Password (eye toggle), with a **Forgot Password?** link below it.
  - A divider.
  - New Password (hint "At least 8 characters."; error if under 8 characters or the same as the current one).
  - Confirm New Password (error if it doesn't match).
- **Update Password:** disabled until all three fields are valid; "Updating…" while working.
- **Recover password by email** (secondary): "Sending…" while working.

### 14.5 Email Verification
- **Badge:** an 80 `brandSoft` circle with `Mail`, or `MailCheck` once verified.
- **Heading:** "Verify your email" / "Enter your code" / verified.
- **Email card:** "Sign-in email" with a **Verified** (`brand`) or **Not verified** (grey) pill, and the email (17 bold).
- **Send code:** shows "Sending…", then switches to the code step.
- **Code step:**
  - A 6-digit input: number pad, monospace 24, wide letter spacing, auto-focus.
  - **Verify email:** enabled at 6 digits; "Verifying…" while working.
  - **"Resend in 0:SS"** counts down from 60, then becomes the **Resend code** link.

### 14.6 Location Verification (full-bleed, no nav)
- **Map:** the top 42% is a draggable pin map (zoom 16) with the boundary outline and the "Tap or drag the pin" hint pill.
- **Scroll body:**
  - Instructions.
  - **Previously Saved Location** card (`CircleCheck`, address, coordinates to 5 decimals).
  - **Detected Address** textarea (2 rows, editable), with the live coordinates and the geocode status.
  - **Outside the boundary** (point-in-polygon test): a red alert, "This spot is outside the Ampid I boundary. Move the pin inside the red outline."
  - **Detect Your Location** (secondary): uses `Location.getCurrentPositionAsync({accuracy: High})` with a 10 s timeout. On error, show a red line under the button.
- **Sticky Save My Location:** disabled unless the pin is inside the boundary, the address is filled in and something changed. "Saving…", then "✓ Location saved".

### 14.7 Help Center
- **Category chips** (sticky, scrollable), each with an icon **and its label**:
  - All
  - General
  - Services
  - Emergency
  - Health
  - Billing
  - Account
- **Count line**, then article cards. Each card:
  - A tinted category icon tile.
  - Category label (12.5 bold, colored).
  - Question (15 bold, 2 lines) and an answer preview (13.5 `muted`, 2 lines).
  - A chevron.
- **Empty state:** text for categories with no articles (General has 0 seeded articles).
- **Content:** load only the active articles for the resident's barangay, ordered by `sort_order`.

### 14.8 Help Article
- **Header:** the AppBar title is the category name.
- **Content:** a category pill, the question as a heading (23 extrabold), a divider, then the answer (16, newlines preserved).

### 14.9 Terms & Privacy Policy
- **Tabs:** UnderlineTabs **Terms of Service / Privacy Policy** (changed vs old: tabs instead of two long accordions).
- **Each tab:** the title (23 extrabold), then `CalendarDays` with "Effective Date: August 21, 2026".
- **Sections:** 11 numbered sections, divided by lines. Each has:
  - A `brand` bold numeral and a 16 bold title.
  - Body text (supports *italic*, e.g. *Katarungang Pambarangay*).
  - Optional `brand`-dot bullet lists. The old "*Access…" asterisks become bullets.
  - An optional grey contact box (Data Protection Officer), with its first line in bold.

### 14.10 About Us (compact redesign)
1. **Identity row:** a 64 logo, "Barangayan" (22 extrabold), "Digital services for Barangay Ampid I", and a version pill (`surface`) on the right.
2. **Mission / Vision:**
   - A segmented control on a `brandSoft` panel (radius 16, padding 6). The white pill slides over 220 ms.
   - The text (15 / line height 23) crossfades with a 4px slide over 160 ms. This replaces stacked paragraphs.
3. **History:**
   - A compact timeline with year pills (24 tall, 56 wide):
     - 1991 Established
     - 2019 Records go digital
     - 2024 Barangayan launches
     - Today: Bayanihan online (filled `brand`)
   - Each entry has a title (14.5 bold) and a paragraph **clamped to 2 lines**.
   - **"Read full story" / "Show less"** (chevron rotates over 200 ms) expands every entry.
4. **Contact:** one panel with three rows, each with a `brand` icon, the value and a trailing action pill:
   - Email (`mailto:`)
   - Phone (`tel:`)
   - Address (opens maps)
5. **Development Team:** a 2×2 grid inside one panel. Each cell: a small muted avatar, the name (13.5 bold) and the role (12 semibold `brand`).
6. **Footer:** "© 2026 Barangay Ampid I" (12 `muted`).

**Wording fix:** "Barangay Barangay Ampid I" becomes "Barangay Ampid I".

---

## 15. Porting checklist (per screen)
Check every screen against these before calling it done:
- [ ] The header title uses **Gideon Roman Regular**; all other text uses the selected body font.
- [ ] Every color comes from the theme context. There are no hard-coded greens, so the accent switch works.
- [ ] The bottom tabs follow the §3 rule.
- [ ] Every horizontal row has edge chevrons and also scrolls by hand.
- [ ] Related rows are grouped in one divided panel, not floating cards.
- [ ] Every transition uses `bezier(0.23, 1, 0.32, 1)`, no single transition runs over 300 ms, and reduced motion is respected.
- [ ] No label, button or tab wraps at a 360dp width.
- [ ] Every state is built: empty, loading (verb-ing label), disabled, error, and success.
- [ ] Sticky footers sit above the safe area. When the nav is hidden there is no empty gap under them.
- [ ] Toggling a checkbox or picking a file never scrolls the screen (the consent bug fix).
- [ ] Map screens keep the OSM attribution visible.
