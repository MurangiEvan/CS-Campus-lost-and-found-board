# Switch photo uploads to presigned PUT (Cloudflare R2 compatibility)

## Goal

Make the existing photo pipeline work on Cloudflare R2 (and keep working on AWS S3 and
other S3-compatible providers) by uploading with a presigned PUT URL in place of a
presigned POST form.

## Verified finding

Cloudflare R2 docs (developers.cloudflare.com/r2/api/s3/presigned-urls/):
"`POST` (multipart form uploads via HTML forms) is not currently supported." R2 presigned
URLs support only GET, HEAD, PUT, DELETE. `server/services/object-storage.js` currently uses
`createPresignedPost`, so the browser → storage step fails on R2. R2 enforces a signed
`Content-Type` (mismatch → 403). Its docs don't say whether a signed `Content-Length` is
enforced. Region for R2 is `auto`.

## Scope

1. Server `createUpload`: replace `createPresignedPost` with `getSignedUrl` on a
   `PutObjectCommand` (`@aws-sdk/s3-request-presigner`), 300-second expiry, signing
   `Content-Type` and `Content-Length` (via `signableHeaders`). Remove the
   `@aws-sdk/s3-presigned-post` dependency.
2. `POST /api/v1/uploads/presign` response becomes
   `{ upload_id, expires_at, method: "PUT", url, headers: { "Content-Type": ... } }`
   (drop `fields`). Update the AGENTS.md API table row.
3. Size safety does not depend on the provider: `finalizeUploadedObject` already rejects any
   object whose stored size/type differs from the approved upload (HeadObject) and checks
   magic bytes. Rejected staging objects remain `pending` and are removed by the existing
   15-minute cleanup scheduler. Keep all of that unchanged.
4. Client `sendToStorage`: XHR `PUT` of the raw JPEG blob with exactly the returned headers,
   keeping progress, timeout, and error messages.
5. Docs: DEPLOYMENT_GUIDE gets an R2 section (r2.dev or custom-domain public URL,
   `S3_REGION=auto`, `S3_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`, CORS
   allowing `PUT` with `Content-Type` header from the frontend origins).
6. Tests: presign returns a PUT URL whose signed headers include content-type and
   content-length and contains no credentials in the response body; existing tests stay green.

## Out of scope
Changing provider accounts or credentials, server-side image proxying, multipart uploads.

## Acceptance criteria
- With R2 configured, a photo uploads, finalizes into `items/…`, and shows on the item.
- Wrong type/size uploads are still rejected at finalize and cleaned up.
- `server: npm test`, `client: npm run build` pass.
