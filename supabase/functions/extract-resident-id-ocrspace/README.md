# Optional resident-web ID suggestions

This isolated function accepts authenticated `{ frontPath, idType }` requests. The
path must identify a caller-owned versioned front JPEG/PNG derivative of at most
900,000 bytes. It validates a live, non-anonymous resident or admin profile, uses caller-authorized
Storage, and consumes the existing server-only five-per-minute resident limiter.
Gateway JWT verification stays enabled in `supabase/config.toml`.

The function reads `OCR_SPACE_API_KEY` only on the server and posts a multipart
file to the fixed free endpoint `https://api.ocr.space/parse/image`, using Engine 2,
automatic language detection, no overlays and no searchable PDF. Recognition has
a 25-second deadline; the entire handler has an 85-second deadline. Provider text
is neither logged nor stored. Only conservative editable suggestions and safe
warnings are returned. Over-limit fields and uncertain birthdays remain blank.

The browser requires an explicit disclosed Read details from photo action, keeps
original publication evidence separate, and always supports manual submission.
The existing Google extraction endpoint and its clients retain their behavior.
The shared parser's new suggestion entry point is backward compatible.

Free-tier limits checked against the [provider API documentation](https://ocr.space/ocrapi)
on 2026-10-15: 1 MB input, 25,000 requests/month and 500/day/IP. Server egress can
share an IP; the resident limiter does not track the shared daily quota. There are
no automatic provider retries, paid fallback or paid upgrades.

Run fixture tests from the repository root:

```text
npx vitest run --root supabase/functions/extract-resident-id-ocrspace --config vitest.config.ts
```

These tests verify the real adapter wiring with synthetic transports. They do not
verify a deployed function, a real API key, provider acceptance, or ID accuracy.
Deployment and live resident/staff tests require separate owner authorization.

Residents have no draft-object delete permission in the current schema. This flow
does not attempt forbidden deletion or remove published evidence. Unreferenced
staging/derivative objects use the repository's existing service-only discovery
contract (migration 0124); no cleanup worker or schedule is introduced here.
