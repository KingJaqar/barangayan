# Resident ID photo extraction

The Android Valid ID flow uploads a private front photo, calls this authenticated
function, lets the resident correct the extracted fields, then publishes the
photo and confirmed details together through `publish_id_submission`.
Confirmed details are submission evidence; they do not overwrite Profile fields.

Apply migration `0118_resident_front_id_submission.sql` before deploying this
function. Enable Google Cloud Vision in the intended Google project and set its
API key as the Supabase Edge Function secret `GOOGLE_CLOUD_VISION_API_KEY`.
Restrict that key to the Cloud Vision API. Never put it in an Expo environment
variable. Deploy `extract-resident-id` using the repository's JWT verification
configuration.

The function sends only the selected front image to Google's document OCR API.
It verifies a live resident session, downloads through the resident's storage
permissions, accepts only that resident's versioned front path and a maximum
5 MB image, and limits extraction to five requests per resident per minute.
Raw recognized text is not returned, stored, or logged. Parsing is conservative:
unrecognized or absent values stay blank for resident review. Optional ID number,
birth date, and address may be blank because they are not printed on every front.
If OCR is unavailable, the resident can retry or enter the details manually.

Before release, verify on a physical Android device: gallery selection, cancelled
selection, denied camera permission, camera capture, extraction of a real sample
ID, corrections surviving Previous step, front-only publication, pending/failed/
verified Settings indicators, and staff approval followed by a service request.

Provider reference: https://docs.cloud.google.com/vision/docs/ocr
