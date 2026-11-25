# Refine the CampusLink photo upload pipeline

## Goal

Make item photos a first-class, polished part of CampusLink: easy to attach from any
phone or laptop, clear progress and failure states, visible when browsing, editable by
the report owner, and cleaned up reliably on the server. Keep the existing secure
presign → direct-to-storage → server verification → transactional attach design.

## Verified repository findings

- Server pipeline is complete and secure: `server/services/object-storage.js`
  (presigned POST, 5-minute expiry, content-length/type conditions, magic-byte
  verification, staging → `items/<owner>/<uuid>` copy), `server/models/image-upload.model.js`
  (owner-bound, single-use, `FOR UPDATE` attach), `server/controllers/upload.controller.js`.
- `PATCH /api/v1/items/:id` already accepts `image_upload_id` (replace photo) but there is
  **no way to remove a photo**, and the client edit form offers neither replace nor remove.
- Permanent objects are copied without `Cache-Control`, so every view re-downloads.
- `ImageUpload.cleanupExpired` exists (`npm run cleanup:uploads`) but nothing schedules it,
  so abandoned staging objects accumulate unless an operator runs it by hand.
- Client (`client/app/page.tsx`): `compressImage` re-encodes to JPEG ≤1600px (good: strips
  EXIF/GPS metadata) but the input only accepts JPEG/PNG/WebP, so iPhone HEIC photos and
  other decodable formats are rejected even though the output is always JPEG.
- Upload uses `fetch`, so there is no progress feedback; the button just says
  "Uploading photo…".
- A non-configuration upload failure aborts the whole report; the user must notice,
  remove the photo, and resubmit.
- `ItemCard` (browse/reports lists) never shows the photo; only the detail modal does,
  and a broken image URL shows a broken-image icon.

## Scope

### Server
1. Set `CacheControl: 'public, max-age=31536000, immutable'` on the permanent copy in
   `finalizeUploadedObject` (keys are random UUIDs, so they never change).
2. Add `remove_image: true` to `PATCH /api/v1/items/:id` (owner, non-custody only, same
   checks as today). It sets `image_url = NULL` inside the existing update transaction and
   deletes the old object after commit (best-effort, same as replace). Reject with 400 if
   both `remove_image` and `image_upload_id` are sent. Lets a student remove a photo that
   accidentally shows private details, such as an ID card number.
3. Schedule expired-upload cleanup inside the API process: when storage is configured,
   run `ImageUpload.cleanupExpired()` every 15 minutes on an `unref()`'d timer. Log counts
   and errors, never crash. The manual `npm run cleanup:uploads` stays.
4. Tests: cache header on finalize, `remove_image` happy path, rejection of combined
   fields, rejection of non-owner / custody items, and the cleanup scheduler skipping when
   storage is unconfigured.

### Client
5. Move the image helpers into `client/lib/photo-upload.ts` (`preparePhoto`, `uploadPhoto`)
   with explicit types; `page.tsx` imports them.
6. Accept any image the browser can decode (`accept="image/*"`, which includes HEIC on
   Safari/iOS). Reject non-image files and raw files over 25 MB before decoding. Decode with
   `imageOrientation: "from-image"`. Output stays JPEG ≤1600px ≤5 MB, so the server
   contract is unchanged and location metadata is still stripped.
7. Real upload progress via `XMLHttpRequest.upload.onprogress`, with stages shown in the
   form: "Preparing photo…" → "Uploading photo 0–100%" (progress bar, `aria-live`) →
   "Saving report…". Cancelling or a failed upload still calls `DELETE /uploads/:id`.
8. Graceful failure: if the photo fails for any reason other than "not configured", keep
   the form filled in and show the error with two actions: **Try again** and
   **Submit without photo**. The existing "not configured → submit without photo and say
   so" behaviour stays.
9. Photo picker: drag-and-drop onto the photo area, plus "Change"/"Remove" on the
   preview. Show the size before and after compression ("3.8 MB → 412 KB").
10. Owner edit modal: show the current photo with **Replace photo** and **Remove photo**,
    using the same prepare/upload pipeline and states. Updates the list and modal only
    after the API confirms (no optimistic UI).
11. `ItemCard` shows a lazy-loaded thumbnail (`loading="lazy"`, `decoding="async"`, fixed
    aspect ratio, so the layout doesn't shift) when `image_url` exists. The card and the
    detail modal fall back to the category icon `onError`.
12. CSS for the dropzone, progress bar, thumbnails, and edit-photo controls in the existing
    stylesheets, in both light and dark themes and responsive on mobile.

### Docs
13. Add `remove_image` to the AGENTS.md API table row for `PATCH /api/v1/items/:id` and to
    `docs/api-testing/openapi.yaml`. Mention the in-process cleanup and the cache header in
    `DEPLOYMENT_GUIDE.md`.

## Out of scope
- Multiple photos per item, server-side resizing/thumbnail generation, image
  moderation/recognition, a new storage provider, changing Render/Vercel/bucket settings.
- Uploading before submit. The 5-minute presign window makes that brittle while the
  user is still filling in the form.
- Preserve unrelated worktree changes. Do not stage or commit unless asked.

## Acceptance criteria
- No-photo reports still submit. With storage configured, a JPEG/PNG/WebP/HEIC (Safari)
  photo uploads with visible progress and appears on the card and in the detail view.
- A failed photo upload never loses the form contents and never claims a photo was saved.
- The owner can replace and remove a photo. Non-owners and custody items get 403/404 from
  the API.
- Removed/replaced objects are deleted and expired staging uploads are cleaned up
  automatically.
- `server: npm test`, `client: npm run lint` and `npm run build` pass.
