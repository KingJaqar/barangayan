# Mobile QR Check-In — Final Plan

**Finalized:** 2026-08-10  
**Status:** Approved — ready for implementation


\#\#\# Option A — "Scan QR" (camera, with permission gate)

\*\*Permission flow:\*\*  
1\. Resident taps \*\*Scan QR\*\*  
2\. App checks \`expo-camera\` permission status via \`Camera.requestCameraPermissionsAsync()\`  
3\. \*\*If granted:\*\* Open \`QrScannerOverlay\` immediately (no modal)  
4\. \*\*If not yet determined/denied:\*\* Show a permission request modal with:  
   \- Title: \*"Camera Access Needed"\*  
   \- Body: \*"Barangayan needs camera access to scan evacuation center QR codes for check-in."\*  
   \- Two buttons: \*\*"Grant Access"\*\* → requests permission → if granted, opens scanner; \*\*"Cancel"\*\* → closes modal, stays on guide screen  
5\. \*\*If permanently denied:\*\* Show modal with \*\*"Open Settings"\*\* button (deep link to app settings) and \*\*"Cancel"\*\*

\*\*After permission granted:\*\* Same payload parsing, barangay validation, household update as previously specified.

\---

\#\#\# Option B — "Show QR" (client-side generation, collapsible panel)

\*\*Flow:\*\*  
1\. Resident taps \*\*Show QR\*\*  
2\. Collapsible panel slides up from bottom (Reanimated \`translateY\` animation)  
3\. Panel contains:  
   \- Header: \*"Show QR Code"\* \+ close button  
   \- Center picker: dropdown/popover list of active evacuation centers for resident's barangay (sourced from \`useEvacuationCenters\` or direct Supabase fetch)  
   \- QR display: \`\<QRCodeCanvas\>\` from \`qrcode.react\` — renders client-side using the structured payload  
   \- Center info: name \+ address below QR  
   \- Download QR button: converts canvas to PNG via \`canvas.toDataURL('image/png')\`, saves via \`expo-file-system\` \+ \`expo-media-library\` (or \`Share.share\` fallback)  
   \- Helper text: \*"Show this screen to center staff so they can scan it at the desk."\*  
4\. Resident shows screen to staff → staff scans with admin scanner or any QR reader → check-in recorded

\*\*QR payload (client-generated):\*\*  
\`\`\`json  
{  
  "type": "EVACUATION\_CENTER\_CHECKIN",  
  "version": "1.0",  
  "center\_id": "\<selected center id\>",  
  "center\_name": "\<selected center name\>",  
  "barangay\_id": "\<resident's barangay\_id\>",  
  "generated\_at": "\<ISO timestamp\>"  
}  
\`\`\`

\---

\#\#\# Files touched

| File | Action |  
|---|---|  
| \`apps/mobile/src/components/qr-guide-content.tsx\` | \*\*Edit\*\* — replace single "Start Scanning" button with two buttons ("Scan QR" \+ "Show QR"), dynamic content already in place |  
| \`apps/mobile/src/components/qr-scanner-overlay.tsx\` | \*\*Edit\*\* — structured payload parsing, barangay check, household update |  
| \`apps/mobile/src/components/qr-permission-modal.tsx\` | \*\*New\*\* — camera permission request modal for Option A |  
| \`apps/mobile/src/components/qr-show-modal.tsx\` | \*\*New\*\* — collapsible panel with center picker, client-generated QR, download button, helper text |  
| \`apps/mobile/src/hooks/use-qr-checkins.ts\` | \*\*Edit\*\* — add \`household\_members.is\_checked\_in\` update after successful check-in |

\#\#\# No new database changes

No schema changes needed. All logic uses existing tables (\`evacuation\_centers\`, \`evacuation\_center\_checkins\`, \`household\_members\`) and existing shared Zod schemas.

\#\#\# New mobile dependency

\`qrcode.react\` — verify if already installed in \`apps/mobile/package.json\`; if not, install it.

\---

Ready to implement?  
