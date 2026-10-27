# Resident Android keyboard avoidance audit

**Audit date:** 24 October 2026 (Asia/Manila)  
**Scope:** Resident Android only, under [apps/resident-android-mobile](</C:/Users/User/barangayan/apps/resident-android-mobile/package.json:1>).  
**Repository HEAD inspected:** d9253f0d42934133143d3b67955a4f987504914d. Findings describe the checked-out source at audit time, not a verified installed APK.  
**Method:** Second-pass static source audit, TypeScript syntax-tree inventory, manual wrapper/route tracing, and read-only Expo configuration resolution. No app code or settings changed; no Android device behavior tested.

## 1. Result

Keyboard avoidance is **partially explicit at the React Native screen level**, with an additional native Android resize default. The incident **Description** input already sits inside an Android-active KeyboardAvoidingView.

| Classification | Meaning | Editable field definitions |
|---|---|---:|
| A — Explicit Android avoidance | A containing KeyboardAvoidingView selects padding or height on Android. | 10 |
| B — Android behavior omitted | A containing KeyboardAvoidingView exists, but behavior is undefined on Android (padding is selected only for iOS). | 32 |
| C — No containing avoidance wrapper found | Neither the form nor its inspected route/layout parents provides a KeyboardAvoidingView. | 17 |
| **Total** | Distinct editable field definitions after expanding dynamic field lists and shared input helpers. | **59** |

**B and C are not confirmed keyboard-obstruction bugs.** The resolved native configuration uses adjustResize, and React Native ScrollView has its own focus/scroll handling. Conversely, A confirms an implementation exists, not that every field stays visible on every Android phone. Device testing is required to label any field as working or broken.

Counts include conditional and legacy branches. They count a shared input definition once even if several routes or documents use it. They do not count every rendered route occurrence or every digit cell in an OTP control. Identical labels in different form definitions are separate entries.

## 2. Corrections and additions to the first list

1. **Correction:** Account setup / Complete Profile **Email Address is read-only**, with editable={false}. Remove it from the editable-input inventory. The Email field in Settings → Profile remains editable. Evidence: [setup email](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:373>) and [Profile email](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1089>).
2. **Expanded coverage:** Create/Set Password is used in both account setup and the Settings first-password flow. The latter is a separate branch; it does not inherit the Change Password form's wrapper. Evidence: [setup consumer](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/account-setup.tsx:63>) and [Settings consumer](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx:361>).
3. **Expanded coverage:** The payment page-count input also exists through the pickup route's shared payment component. Evidence: [payment route](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/payment/[requestId].tsx:3>) and [pickup route](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/payment/pickup/[requestId].tsx:3>).
4. **Expanded coverage:** Evacuation-center search is shared by the public emergency page and signed-in Emergency Info. It is distinct from the Maps incident search. Evidence: [public consumer](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/emergency-centers.tsx:48>) and [signed-in consumer](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/emergency-info/index.tsx:89>).
5. **Clarification:** No additional distinct editable input definitions were found beyond the first list after correcting the read-only setup email. The second pass adds field-level counts, conditional branches, shared consumers, exclusions, and wrapper evidence.

## 3. Native Android configuration

| Check | Observed result | Evidence |
|---|---|---|
| App Android identity | com.barangayan.resident | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/app.json:17>) |
| Explicit softwareKeyboardLayoutMode | Unset | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/app.json:17>) |
| Resolved native keyboard mode | **adjustResize** | Installed Expo config plugin returns adjustResize when the property is unset: [source](</C:/Users/User/barangayan/node_modules/@expo/config-plugins/build/android/WindowSoftInputMode.js:38>) |
| adjustPan | Not selected by current resolved configuration | Same resolver; pan maps to adjustPan only when selected. |
| Dynamic app config | Normal build returns config unchanged; opt-in development branch changes package identity and adds expo-dev-client, without a keyboard-mode override. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/app.config.js:3>) |
| Native manifest in app source | No checked-in android/app/src/main/AndroidManifest.xml was present in this app directory. | Native-mode conclusion comes from config resolution, not inspection of an installed or generated manifest. |

The read-only configuration check returned:

    {"androidPackage":"com.barangayan.resident","softwareKeyboardLayoutMode":"(unset)","resolvedWindowSoftInputMode":"adjustResize","plugins":["expo-router","expo-splash-screen"]}

This mode is activity-wide, not a separate setting attached to each input. React Native Modals have their own native presentation; an activity configuration alone is insufficient evidence that a modal's focused field stays visible.

Reference: [Expo Android keyboard layout configuration](https://docs.expo.dev/versions/latest/config/app/#softwarekeyboardlayoutmode).

## 4. A — Fields with explicit Android KeyboardAvoidingView behavior

| ID | Screen / form | Editable input | Conditions / notes | Evidence |
|---|---|---|---|---|
| A01 | New incident report | Title | Report form; padding behavior on Android. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/new.tsx:459>) |
| A02 | New incident report | Description | Report form; padding behavior on Android. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/new.tsx:460>) |
| A03 | New incident report | Specific area details | Report form; padding behavior on Android. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/new.tsx:488>) |
| A04 | Pin Your Location | Address | Editable correction of detected address; its own modal wrapper uses padding. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/reports/location-picker-modal.tsx:116>) |
| A05 | Location Verification | Detected Address | Multiline; height behavior on Android. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/location-verification.tsx:267>) |
| A06 | Health registration | Age | Shown when profileAge is null, including household-member registration. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/register.tsx:556>) |
| A07 | Health registration | Previous dose date | Vaccination drive and dose is not 1st Dose. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/register.tsx:635>) |
| A08 | Profile → Add/Edit Family Member | Full name | SettingsSheet uses Android height behavior; add/edit share one input. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:476>) |
| A09 | Emergency Info → Family → Add/Edit Member | Full Name | ScanFamilySheet uses Android height behavior; separate editor from Profile. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/family-member-modal.tsx:60>) |
| A10 | Settings → Custom Accent Color | Hex color | SettingsSheet uses Android height behavior. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/custom-accent-color-modal.tsx:55>) |

### Wrapper evidence

| Fields | Containing wrapper | Android behavior | Evidence |
|---|---|---|---|
| A01–A03 | New incident form | padding | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/new.tsx:410>) |
| A04 | PickerContent inside LocationPickerModal | padding | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/reports/location-picker-modal.tsx:101>) |
| A05 | Location Verification form | height | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/location-verification.tsx:224>) |
| A06–A07 | Health registration form | height | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/register.tsx:498>) |
| A08, A10 | SettingsSheet | height | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/settings-sheet.tsx:23>) |
| A09 | ScanFamilySheet | height | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/drrm/scan-family-sheet.tsx:22>) |

The Profile family-member input and Emergency Info family-member input are separate implementations. Both are covered through their own shared sheet wrappers. The report location picker also has its own wrapper inside its Modal, rather than relying on the report screen behind it.

## 5. B — Fields with an iOS-only behavior selection

Every entry below has a wrapper whose behavior is Platform.OS === 'ios' ? 'padding' : undefined. The installed React Native implementation's default behavior branch renders a View without applying its height, position, or padding avoidance style: [source](</C:/Users/User/barangayan/node_modules/react-native/Libraries/Components/Keyboard/KeyboardAvoidingView.js:286>). Native Android resizing may still provide effective handling.

| ID | Screen / form | Editable input | Conditions / notes | Evidence |
|---|---|---|---|---|
| B01 | Login | Email | Standard editable form field. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/login.tsx:92>) |
| B02 | Login | Password | Standard editable form field. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/login.tsx:103>) |
| B03 | Registration | Email address | Email step. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/register.tsx:107>) |
| B04 | Registration | Confirmation code | Email confirmation step; one six-digit numeric input. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/register.tsx:107>) |
| B05 | Forgot Password | Email address | Disabled while a session exists or a request is loading; editable in the applicable recovery state. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/forgot-password.tsx:47>) |
| B06 | Password recovery → Verify code | 6-digit reset code | RecoveryCodeInput renders one TextInput with six visual digit cells; counted once. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/otp.tsx:82>) |
| B07 | Password recovery → Reset Password | New Password | Standard editable form field. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/reset-password.tsx:71>) |
| B08 | Password recovery → Reset Password | Confirm New Password | Standard editable form field. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/reset-password.tsx:92>) |
| B09 | Account setup / Complete Profile | First Name | Same field definitions reused by account-setup and complete-profile; disabled in non-editable setup states. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:274>) |
| B10 | Account setup / Complete Profile | Last Name | Same field definitions reused by account-setup and complete-profile; disabled in non-editable setup states. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:284>) |
| B11 | Account setup / Complete Profile | Middle Name (optional) | Same field definitions reused by account-setup and complete-profile; disabled in non-editable setup states. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:296>) |
| B12 | Account setup / Complete Profile | Suffix (optional) | Same field definitions reused by account-setup and complete-profile; disabled in non-editable setup states. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:305>) |
| B13 | Account setup / Complete Profile | Mobile Number | Same field definitions reused by account-setup and complete-profile; disabled in non-editable setup states. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:362>) |
| B14 | Account setup / Complete Profile | House No. | Same field definitions reused by account-setup and complete-profile; disabled in non-editable setup states. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:385>) |
| B15 | Account setup / Complete Profile | Street | Same field definitions reused by account-setup and complete-profile; disabled in non-editable setup states. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:395>) |
| B16 | Account setup / Complete Profile | Occupation (optional) | Only shown for an employment status that permits occupation. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:436>) |
| B17 | Settings → Change/Manage Password | Current Password | Existing-password form. First-password setup is a separate branch listed under C. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx:238>) |
| B18 | Settings → Change/Manage Password | New Password | Existing-password form. First-password setup is a separate branch listed under C. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx:260>) |
| B19 | Settings → Change/Manage Password | Confirm New Password | Existing-password form. First-password setup is a separate branch listed under C. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx:271>) |
| B20 | Settings → Email Verification | Six-digit code | Standard editable form field. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/email-verification.tsx:135>) |
| B21 | Settings → Valid ID | Specify ID type | Step 1, only when ID type is Other. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx:259>) |
| B22 | Settings → Valid ID | Full name | Step 3; expanded from FIELDS.fullName. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx:285>) |
| B23 | Settings → Valid ID | ID number (if shown) | Step 3; expanded from FIELDS.idNumber. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx:285>) |
| B24 | Settings → Valid ID | Address (if shown) | Step 3; expanded from FIELDS.address; multiline. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx:285>) |
| B25 | Services → Charter request form | Explain your purpose | Only when the selected purpose requires an explanation. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:419>) |
| B26 | Services → Charter request form | Business name | Business service only. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:427>) |
| B27 | Services → Charter request form | Establishment address | Business service only. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:428>) |
| B28 | Services → Charter request form | Record/document reference | Certified true copy only. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:459>) |
| B29 | Services → Charter request form | Number of copies | Certified true copy only; numeric. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:460>) |
| B30 | Services → Charter request form | Total pages across all copies | Certified true copy only; numeric. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:461>) |
| B31 | Services → Charter request form | Additional notes (optional) | Shared notes field; multiline. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:479>) |
| B32 | Settings → Delete Account dialog | Password | Resident presentation is used by Settings; Android behavior is undefined in this modal. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/delete-account-modal.tsx:79>) |

### Wrapper evidence

| Screens | Containing wrapper | Evidence |
|---|---|---|
| Login | Login screen | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/login.tsx:70>) |
| Registration email/code | Registration screen | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(auth)/register.tsx:99>) |
| Forgot Password, recovery code, Reset Password | PasswordRecoveryScreen → StepFlowScreen | [shared recovery wrapper](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/password-recovery-screen.tsx:11>) and [behavior](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/password-recovery-screen.tsx:48>) |
| Account setup / Complete Profile details | ResidentDetailsForm | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:266>) |
| Change/Manage Password | Existing-password form branch | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/change-password.tsx:213>) |
| Email Verification | Verification form | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/email-verification.tsx:82>) |
| Valid ID | StepFlowScreen | [consumer](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx:244>) and [behavior](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/password-recovery-screen.tsx:48>) |
| Charter service request | CharterRequestForm | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:327>) |
| Delete Account password dialog | Resident branch inside Modal | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/delete-account-modal.tsx:124>) |

## 6. C — Fields without a containing KeyboardAvoidingView found

These are distinct from B: there is no avoidance wrapper to configure in the inspected form/parent chain. Most form entries use a ScrollView; top/header search controls are positioned by their surrounding header/map layout.

| ID | Screen / form | Editable input | Conditions / notes | Evidence |
|---|---|---|---|---|
| C01 | Account setup / Settings → Create/Set Password | Password | Shared component used by account-setup and FirstPasswordFromSettings; ScrollView without KeyboardAvoidingView. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-password-step.tsx:84>) |
| C02 | Account setup / Settings → Create/Set Password | Confirm Password | Shared component used by account-setup and FirstPasswordFromSettings; ScrollView without KeyboardAvoidingView. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-password-step.tsx:86>) |
| C03 | Settings → Profile | First Name | Main Profile ScrollView has no KeyboardAvoidingView; its family-member sheet is separately covered under A. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1018>) |
| C04 | Settings → Profile | Middle Name | Main Profile ScrollView has no KeyboardAvoidingView; its family-member sheet is separately covered under A. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1027>) |
| C05 | Settings → Profile | Last Name | Main Profile ScrollView has no KeyboardAvoidingView; its family-member sheet is separately covered under A. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1035>) |
| C06 | Settings → Profile | Suffix | Main Profile ScrollView has no KeyboardAvoidingView; its family-member sheet is separately covered under A. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1044>) |
| C07 | Settings → Profile | Occupation | Conditional on employment status. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1084>) |
| C08 | Settings → Profile | Email | Editable here, unlike the read-only account-setup email. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1089>) |
| C09 | Settings → Profile | Mobile Number | Main Profile ScrollView has no KeyboardAvoidingView; its family-member sheet is separately covered under A. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1099>) |
| C10 | Settings → Profile | House No. | Main Profile ScrollView has no KeyboardAvoidingView; its family-member sheet is separately covered under A. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1112>) |
| C11 | Settings → Profile | Street | Main Profile ScrollView has no KeyboardAvoidingView; its family-member sheet is separately covered under A. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1121>) |
| C12 | Settings → Profile | City | Editable fallback only when barangay_localities is absent; otherwise a LockedField. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1134>) |
| C13 | Services → Legacy document request | Purpose of Request | Fallback when catalogContract(doc) is absent; multiline. Charter documents take the other branch. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/request/[documentId].tsx:211>) |
| C14 | Services → Payment / Pickup | Total pages across all copies | Shown when fee_assessment_state is page_count_required and request is not completed/cancelled. Shared by payment and pickup routes; counted once. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/resident-payment-screen.tsx:171>) |
| C15 | Resident header search | Search services, announcements and your records | Shared header used across resident app tabs/search flow; editable when searching. Counted once across consumers. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-header.tsx:138>) |
| C16 | Maps → Incidents | Search incidents | Editable only on incidents tab; evacuation tab reuses a disabled version, not another editable field. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/index.tsx:246>) |
| C17 | Evacuation centers search | Search evacuation centers | Expanded centerSearch control shared by public emergency-centers and signed-in Emergency Info → Evacuation Centers; count once. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/evacuation-centers-panel.tsx:422>) |

### Parent and route checks

- **No app-wide KeyboardAvoidingView was found.** Root, auth, resident app, Settings, Services, Health, Reports, Maps, Home, and Emergency Info route layouts were checked. The shared resident app layout renders ResidentHeader and AppTabs inside a View: [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/_layout.tsx:20>). Providers and navigation stacks do not themselves add a field-avoidance wrapper.
- **Profile's main form is independent of its sheets.** The main ScrollView starts at [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:956>). SettingsSheet covers the family-member editor, not the inline profile fields behind it.
- **Set Password is independent of Change Password.** ResidentPasswordStep contains the security fields and a ScrollView: [fields](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-password-step.tsx:84>) and [scroll container](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-password-step.tsx:92>). It is rendered by account-setup and FirstPasswordFromSettings without another surrounding avoidance wrapper.
- **Service request branches differ.** catalogContract(doc) selects CharterRequestForm; otherwise the legacy Purpose of Request branch is rendered: [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/services/request/[documentId].tsx:199>). The latter cannot inherit a wrapper from the unrendered charter branch.
- **Evacuation search is reused across views/routes.** The expanded centerSearch includes the editable input; its shared panel does not add a KeyboardAvoidingView. Search timers and keyboard dismissal are not field-avoidance logic: [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/evacuation-centers-panel.tsx:417>).

## 7. Exclusions and false positives checked

| Control or implementation | Why it is excluded from editable input counts | Evidence |
|---|---|---|
| Account setup Email Address | Always editable={false} in this form. This corrects the first audit list. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:373>) |
| Account setup City and Province | Both are read-only TextFields. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:411>) |
| Profile Barangay, Province, and configured City | LockedField display values. Only fallback editable City is counted in C. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1132>) |
| Valid ID Date of birth | The dynamic FIELDS list uses a Pressable and BirthdayWheelModal for birthDate, rather than a TextField. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/valid-id.tsx:278>) |
| Sex, date of birth, employment status, relation, role, purpose choices, month/year filters, dose choices and comorbidities | Buttons, chips, pickers or selection controls; no text keyboard input. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx:315>), [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:1052>), [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/family-member-modal.tsx:61>), [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/purpose-sheet.tsx:119>) |
| Health profile name/address and computed age | HealthFact displays; only the conditional editable Age is counted. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/register.tsx:545>) |
| Maps evacuation-tab search lookalike | Same TextInput instance is disabled when activeTab is not incidents. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/index.tsx:246>) |
| Recovery code digit cells | One TextInput drives six visual cells. Counted as one field, not six inputs. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/password-recovery-screen.tsx:122>) |
| TextField, InlineFieldInput, IncidentFormField and charter Field primitives | Implementation layers expanded to their consumer fields; not counted again as extra fields. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/text-field.tsx:62>), [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:301>), [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/new.tsx:166>), [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:76>) |
| HealthSheet | Has Android height behavior, but its inspected current consumers contain selection/display controls rather than additional keyboard inputs. Health registration's Age/date inputs are covered by the page wrapper. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/health/health-presentation.tsx:191>) |
| RegistrationMap detected/pinned address | Display text and map interaction, not editable address entry. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/registration-map.tsx:123>) |
| Map WebView | Inspected embedded HTML/JS and native integration; no additional app-owned editable text controls found. Vendored Leaflet code is not a resident form inventory. | [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/map-view.tsx:874>) |
| Feedback, QR, household QR, success, photo-viewer, permission and Google-deletion dialogs | Inspected for nested/hidden input usage; no additional keyboard text fields found. Password-based deletion is already in B. | Current JSX/import inventory and modal implementations. |
| External authentication/payment/browser UI | Outside the app-owned resident Android input implementation; no claim about external providers' keyboard handling. | Scope boundary. |

Keyboard listeners in [FloatingTabLayoutProvider](</C:/Users/User/barangayan/apps/resident-android-mobile/src/hooks/use-floating-tab-layout.tsx:30>) track keyboard visibility. [floatingTabInset](</C:/Users/User/barangayan/apps/resident-android-mobile/src/lib/floating-tab-inset.ts:7>) changes tab clearance when the keyboard is visible; this does not establish focused-field avoidance. Likewise, keyboardShouldPersistTaps controls tap handling, and charter-request-form's validation-error scroll at [source](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx:257>) is not keyboard-driven auto-scrolling.

## 8. Audit method and completeness checks

1. Enumerated **274 app-owned JS/TS/JSX/TSX source files** under src, excluding test files and vendored Leaflet code. No resident-Android-specific AGENTS.md was found; repository AGENTS.md was empty.
2. Parsed source with the installed TypeScript parser. Enumerated JSX tags, attributes, imports, all native TextInput render sites, TextField consumers, InlineFieldInput, IncidentFormField, charter Field and RecoveryCodeInput.
3. Expanded the Valid ID FIELDS mapping and conditional form branches; removed explicitly read-only controls; did not double-count shared primitives or route reuse.
4. Cross-checked broader text searches for onChangeText, editable, input/textarea/contentEditable, aliased inputs, imperative input creation and native prompt APIs. Inspected WebView HTML and selection-only UI to rule out additional app-owned editable fields.
5. Traced each shared form/modal to its consuming route and inspected parent layouts. Audited all **15 KeyboardAvoidingView JSX sites**: **7** select Android behavior and **8** leave it undefined. One Android-active wrapper (HealthSheet) introduces no additional editable field in its current consumers.
6. Searched for alternate handling such as KeyboardAware components, automaticallyAdjustKeyboardInsets, useAnimatedKeyboard, explicit soft-input-mode mutation and custom focus-to-keyboard scrolling. None was found in app-owned source. Existing keyboard listeners, dismissal, validation scrolling and tab-clearance logic were reviewed separately.
7. Resolved Expo config with the locally installed @expo/config and @expo/config-plugins code. No prebuild, dependency installation or native configuration write was performed.

### Native input implementation sites reconciled

All **9 native TextInput JSX sites across 8 files** were traced:

- [app/(app)/maps/index.tsx](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/index.tsx:246>)
- [app/(app)/settings/profile.tsx](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:301>)
- [app/(app)/settings/profile.tsx](</C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx:476>)
- [components/custom-accent-color-modal.tsx](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/custom-accent-color-modal.tsx:55>)
- [components/evacuation-centers-panel.tsx](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/evacuation-centers-panel.tsx:422>)
- [components/password-recovery-screen.tsx](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/password-recovery-screen.tsx:122>)
- [components/resident-header.tsx](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-header.tsx:138>)
- [components/services/resident-payment-screen.tsx](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/resident-payment-screen.tsx:171>)
- [components/text-field.tsx](</C:/Users/User/barangayan/apps/resident-android-mobile/src/components/text-field.tsx:62>)

These sites either directly define a field in A/B/C or implement a shared primitive whose consumers are enumerated above. The 35 TextField JSX sites were also reconciled: two are shared helper implementations, three are permanently read-only setup fields, and the remaining sites were expanded to their actual editable field definitions.

## 9. Verification still needed on Android

No fields are classified as device-verified passing or failing in this report. To establish the user-visible behavior, test the installed resident Android build using the current release's keyboard, navigation mode and display settings.

| Test area | What to verify |
|---|---|
| Every A/B/C field in its applicable branch | Focus the field from its natural scroll position; verify the caret and typed text remain above the keyboard without first manually repositioning the form. |
| Long forms and multiline inputs | Profile Street/City, service Additional notes, incident Description and Specific area details remain visible while typing and moving the caret. |
| Bottom sheets and Modals | Family editors, custom hex color, location picker and Delete Account preserve input visibility and usable scrolling. Activity resize alone is not a modal pass result. |
| Conditional and reused routes | Health household-member Age and prior dose date; Other ID type/manual ID details; first-password setup; certified-copy page count; legacy request; public/signed-in evacuation search; payment/pickup. |
| Numeric versus text keyboards | Repeat with number-pad, phone-pad, email and standard keyboards, including suggestion rows where available. |
| Compact displays and larger fonts | Input/caret remains visible and scrolling remains available with reduced vertical space. |
| Keyboard dismissal and navigation | Closing the keyboard restores layout without a persistent blank gap or double offset; reopening/focusing another field still works. |

Start verification with lower fields in long forms and independent Modals. **Do not mechanically add height/padding to every B/C field:** first observe whether existing adjustResize and scrolling already work, then choose one coherent handling strategy per screen to avoid competing offsets.

## 10. Change scope

This deliverable is an audit report. No resident Android UI, input, keyboard behavior, database, build setting or dependency was modified. The only persistent requested deliverable is this Markdown report; source scan helpers/evidence were kept under the workspace temporary audit folder.
