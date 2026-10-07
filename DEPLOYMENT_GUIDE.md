# CampusLink Deployment Guide

## 1. Required environment variables

### Server (.env)

```env
PORT=3001
NODE_ENV=production
JWT_SECRET=replace-with-secure-random-string
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
CORS_ORIGINS=https://your-client-domain.com
COOKIE_SAMESITE=none
COOKIE_SECURE=true
S3_ENDPOINT=
S3_REGION=us-east-1
S3_BUCKET=campuslink-images
S3_ACCESS_KEY_ID=replace-with-server-only-storage-access-key
S3_SECRET_ACCESS_KEY=replace-with-server-only-storage-secret
S3_PUBLIC_BASE_URL=https://images.your-domain.com/
IMAGE_UPLOAD_MAX_BYTES=5242880
```

In production, `CORS_ORIGINS` is required and must contain exact trusted browser origins, comma-separated, with no wildcard or domain suffix. State-changing API requests also require an exact matching `Origin` header; do not disable this check for cookie-authenticated requests. Keep storage credentials only in the server environment. `S3_ENDPOINT` is optional for AWS S3 and should be set for compatible services such as MinIO or another S3 API provider. `S3_PUBLIC_BASE_URL` must point at the public-read bucket or CDN URL prefix and must use HTTPS.

Login stores the session only in the `campuslink_session` HttpOnly cookie; it does not return a JWT in JSON or store a token in browser storage. The client sends API requests with credentials enabled, so configure `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` for cross-site HTTPS deployments.

Keep `staging/*` private and grant the server credential only the required object operations (`PutObject`, `GetObject`/`HeadObject`, `CopyObject`, and `DeleteObject`) under the `staging/*` and `items/*` prefixes. Allow public/CDN reads only under `items/*`; do not enable bucket listing. Configure bucket CORS for the exact client origin and `POST` requests. The API signs a five-minute staging upload policy with a maximum object size, then verifies size, media type, and image signature before copying the content to a fresh permanent `items/*` key that is never signed for client writes.

### Client (.env.local or deployment env)

```env
# Leave this unset in production so the client uses /api/v1 through the Vercel rewrite.
# For local development use http://localhost:3001/api/v1, or leave unset to use that default.
NEXT_PUBLIC_API_BASE_URL=
API_SERVER_URL=https://your-api-domain.com
NEXT_PUBLIC_APP_URL=https://your-client-domain.com
```

For Vercel, set `API_SERVER_URL` to the deployed Render API origin, for example `https://campuslink-api.onrender.com`, then redeploy. Do not set the public client URL to `localhost` in a production deployment.

## 2. Database setup

- Create PostgreSQL database.
- For a new database, run schema initialization from `server/schema.sql`.
- For an existing database, apply `server/migrations/20261007_add_image_uploads_and_custody.sql` using the migration process for that environment, for example `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/migrations/20261007_add_image_uploads_and_custody.sql` from the repository root.
- Validate tables: `users`, `items`, `item_image_uploads`, `custody_events`, `resolution_events`, and `audit_events`.
- Confirm backup/restore flow before production release.

### Full-text search index

The schema now includes a generated `search_vector` column and a GIN index. After applying `server/schema.sql`, ensure the index exists:

```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'items';
```

PostgreSQL maintains the generated `search_vector` column. Browse queries use its GIN index; the new migration removes the older duplicate expression index.

The building filter uses `ILIKE '%term%'`; the migration enables PostgreSQL's `pg_trgm` extension and replaces its ineffective B-tree location index with a trigram GIN index. Confirm the database role can enable this extension. On staging, verify the planner with `EXPLAIN (ANALYZE, BUFFERS)` using representative location filters and data volume before production rollout.

## 3. Start the API

The local API defaults to port `3001`; the Next.js client defaults to port `3000`.

```bash
cd server
npm install
node index.js
```

## 4. Start the client

```bash
cd client
npm install
npm run build
npm run start
```

## 5. Health checks

- API: `GET /health`
- Database readiness: `GET /ready`
- Client: home page loads without API 500s
- Database: app can read and write item records

## 6. Search and resolution verification

After applying `server/schema.sql`, verify the API with an authenticated client:

```text
GET /api/v1/items?status=active&search=phone&item_category=phones&location=Library&date_from=2026-01-01&date_to=2026-12-31
PATCH /api/v1/items/:id/resolve
{ "notes": "Returned via Security Desk", "verification": { "student_id_verified": true, "proof_of_ownership_confirmed": true, "item_condition_noted": true } }
GET /api/v1/items?status=resolved
GET /api/v1/items/:id/custody-events
POST /api/v1/uploads/presign
POST /api/v1/items/intake
PATCH /api/v1/items/:id/reassign
```

`/items/intake`, `/items/:id/reassign`, and `/items/:id/custody-events` are staff-only. A signed-in student may resolve only their own non-custody report. A staff release requires all three verification values and records the actor, notes, and checks in custody, resolution, and audit history.

### Image upload cleanup

Schedule `npm run cleanup:uploads` from the server service every 10 minutes (for example, as a Render Cron Job). It removes objects for expired upload sessions that were never attached to a report. Keep the schedule enabled to limit abandoned uploads; client cancellation is best-effort if the browser closes or loses connectivity.

### Manual end-to-end checks

1. Configure a non-production bucket and its exact client-origin CORS rule, apply the migration, and start the server with the documented environment values.
2. As a student, submit a report with and without a photo. Confirm the photo is stored as an object, the item API returns an ordinary public URL, and the JSON request contains no data URL/base64 content.
3. Try an unsupported file and a file larger than `IMAGE_UPLOAD_MAX_BYTES`; verify upload is rejected and no item is created. Confirm an invalid image payload cannot be attached.
4. As a student, report a found item and confirm it does not appear in the Security custody/release queue.
5. As Security, log a found item with a storage location; confirm the custody queue displays it and its intake appears in custody history.
6. Reassign custody to another staff account and verify the handover is recorded. Attempt to select a student account and confirm the API rejects it.
7. Release the item with all three checks, then confirm it leaves the active custody queue and the resolution, custody, and audit histories contain the release.
8. Confirm a student cannot read another account's resolution history or staff custody events, and cannot release or reassign custody.
9. Create an unattached upload session, let it expire, run `npm run cleanup:uploads`, and confirm its pending object is removed.

Do not run the cleanup job or migration against production until the target environment and credentials have been explicitly selected.

### Smoke test

After deployment, run the server smoke script to verify basic health endpoints are reachable:

```bash
# from the server folder
node smoke.js
```

Or, if installed via package manager, run:

```bash
npm run smoke
```
```

The default browse feed requests `status=active`; resolved reports are available through the archived history view.

## 7. Rollback

- Restore previous deployment build
- Reapply earlier database snapshot if required
- Revert environment variables to previous known-good values

## 9. Quick local automation

You can use the provided `Makefile` to install dependencies, run tests, and execute the smoke checks locally:

```bash
make install
make test
make smoke
```

## 8. Known limitations

- Notifications and contact-preferences are UI-backed and not yet fully persisted
- Security match workflow is still a prototype
- A production object-storage bucket, public/CDN URL, exact client CORS origin, and credentials must be configured by the deployment owner before live image uploads work
- Vercel and Render deployment cannot be verified until hosting credentials and a reachable PostgreSQL URL are supplied
