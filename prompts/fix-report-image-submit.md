# Fix report image submission

## Problem

Adding a normal photo to a lost/found report can prevent submission. The client reads the selected file as a data URL and rejects it when the encoded value exceeds 90,000 characters (roughly 65 KB of image data). The Express JSON parser accepts request bodies up to 100 KB, so requests must stay within that existing payload budget.

Newly submitted reports also do not appear on an already-open security dashboard. The dashboard loads its item list when the session starts and does not refresh it afterward. The staff item endpoint includes report owners, so the dashboard should be able to show these reports once it fetches again.

## Goal

Allow typical selected phone photos to be submitted with a report while preserving the current JSON item API and its 100 KB request limit.

## Implementation requirements

- Inspect `client/app/page.tsx` and its existing image selection, report submission, loading, and error flows before editing.
- Compress and, if needed, resize supported selected images in the browser before converting them to a data URL. Ensure the resulting payload stays below the existing client image limit with room for report fields and JSON encoding.
- Keep the current accepted input formats and optional-photo behavior. If an image cannot be decoded or compressed, retain the report and show a clear actionable error rather than submitting an oversized payload.
- Display report submission/image errors where they remain visible while the report modal is open.
- Keep the security dashboard's item list current after reports are submitted by other users. Use a small, existing-pattern-friendly refresh approach (for example, refresh when the dashboard tab gains focus, with a visible manual refresh action if needed); do not add WebSockets or real-time infrastructure.
- Ensure new lost and found reports are represented consistently in the security dashboard and its item queue, without weakening existing role-based access.
- Do not add server upload infrastructure or change API/database contracts for this focused fix.
- Add or update focused tests only where the existing client test setup supports them; otherwise run the available client lint/type checks and server tests.

## Validation

- Submit a report with no photo and confirm existing behavior remains unchanged.
- Submit a report with a typical photo larger than 65 KB and confirm it reaches the existing item endpoint and creates the report.
- Create a report as a student while the security dashboard is already open, then verify it appears after the dashboard's refresh behavior.
- Confirm a corrupt/unsupported image shows an actionable error and does not leave a false success state.
- Confirm the encoded request remains within the Express 100 KB JSON body limit.