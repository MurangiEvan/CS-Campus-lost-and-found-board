# Fix Found-Item Report Submission with Photos

## Goal

Make photo upload failures understandable and recoverable, and ensure attached photos can be persisted when the API's object storage is configured.

## Verified facts

- `client/app/page.tsx` compresses the selected image and calls `POST /api/v1/uploads/presign` before submitting the item.
- `server/services/object-storage.js` requires `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_BASE_URL` to create a presigned upload.
- All four settings are empty in the local `server/.env`. Their values in the deployed Render environment cannot be inspected from this workspace.
- If presigning fails, the report submit is aborted before `POST /items`; production error middleware returns a generic service-unavailable message.
- Photos are optional, but the current selected-photo preview does not provide a clear remove action.

## Planned implementation

1. Map the known missing-object-storage condition to a safe 503 API response with a clear actionable message. Do not expose credentials, provider responses, or internal errors.
2. Add a remove-photo control to the selected-photo preview so the user can remove an optional photo and submit the report without it. Keep the report form values intact.
3. Preserve the existing upload pipeline and do not mark an item as having an image unless the presigned upload and API item submission both succeed.
4. Test API error mapping and client behavior for: successful upload then report, missing storage configuration, failed direct upload, remove photo then submit without image, and normal report without a photo.
5. Run the server test suite and client production build.

## Deployment prerequisite

Real attached-photo uploads cannot succeed until the Render API has valid `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_BASE_URL` values for an S3-compatible provider. Do not place these secrets in client variables or commit them. Verify the Render settings and redeploy after configuring them.

## Acceptance criteria

- With configured object storage, a found-item report with a photo uploads and persists successfully.
- When storage is unavailable, the user sees a clear safe error and can remove the optional photo and submit the report without it.
- Failed uploads never leave misleading report state or orphan pending uploads when cancellation succeeds.
- No storage secrets are exposed to the browser, logs, or repository.
