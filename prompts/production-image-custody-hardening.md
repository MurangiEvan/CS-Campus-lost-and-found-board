# Implementation Prompt: Image Storage, Custody Workflow, and Production Hardening

## Goal

Close three remaining production-readiness gaps in the Campus Lost & Found Board:

1. Replace browser-to-API image data URLs with a real S3-compatible object-storage upload pipeline.
2. Make Campus Security intake, custody, reassignment, and release a complete, auditable workflow enforced by the API and database.
3. Finish targeted security, database-performance, and release-readiness work without duplicating existing protections or indexes.

Implement this in the existing Next.js App Router client and Express/PostgreSQL server. Preserve existing APIs and UI conventions unless a contract change is needed; update documentation and tests for any contract or schema change. Do not use a cloud provider's credentials in source control or introduce a new product scope.

## Current-state evidence

- The client compresses an image in `client/app/page.tsx`, converts it to a data URL, and sends it as `image_url` in the JSON item-creation request.
- The Express item controller writes `image_url` directly to the `items` row. There is no object-storage SDK, upload endpoint, or signed-upload flow in the server dependencies.
- `items` already has a nullable `image_url` field.
- Staff-only user search, audit listing, item reassignment, staff intake UI, and a release UI already exist. Staff release requires three verification booleans, but the API stores a fixed verification sentence in `resolution_notes`; it does not persist structured verification evidence.
- `resolution_events` records the resolver and notes. There is no distinct custody/intake/reassignment event history.
- `server/schema.sql` already defines category, status, user, date, location, and full-text indexes. Inspect actual query patterns and existing migration state before adding or changing indexes.
- Server tests use Node's built-in test runner. Keep added tests focused and follow those existing patterns.

## Requirements

### A. Real image upload

- Use an S3-compatible object store configured entirely through server environment variables. Support a custom endpoint so compatible services can be configured; do not commit credentials. Required configuration should fail clearly at request time or during startup according to the repository's existing configuration conventions.
- Add a server-controlled presigned upload flow. The authenticated server validates allowed image MIME types, file size, and generated object keys, and returns a short-lived upload URL plus the final public/read URL. Never accept a client-chosen storage key or credentials.
- Update the client to upload the compressed image bytes directly to object storage, then submit the returned image URL with the item request. Do not put image data URLs or base64 payloads in item API JSON.
- Preserve preview, loading, success, and actionable failure states. A failed object upload must not create an item with a broken image URL; a failed item creation after upload should attempt best-effort cleanup or clearly document the orphan-object limitation.
- Delete associated objects when an item with an image is deleted or its image is replaced, without allowing one user to delete another user's item/object. Avoid breaking legacy external `image_url` values; only delete objects known to belong to this application's configured bucket/prefix.
- Document required environment variables, bucket/public-read or CDN configuration, CORS requirements for browser PUT uploads, and local testing steps. Do not add secrets or claim a live bucket is configured when credentials are unavailable.

### B. Campus Security custody and release

- Keep student and staff permissions enforced server-side. Only staff may record a security-desk intake, reassign custody ownership, and release an item from custody. Students may only resolve their own non-custody reports under the existing policy.
- Define custody eligibility explicitly (a found item checked in by staff); do not infer that every student-reported found item is physically held by Security.
- Add a migration for append-only, structured custody events covering intake, reassignment, and release. Record the item, actor, event type, timestamp, and relevant structured details (such as storage location/reference and release verification). Keep resolution history compatible or migrate it deliberately; do not silently discard existing data.
- Make intake and its initial custody event atomic. Make reassignment and its custody event atomic. Make release status transition, structured verification record, resolution event, and audit event atomic where practical; failures must not leave partial state.
- Validate allowed transitions and required data in the API/model layer. Reassignment must validate the destination user and prevent invalid account types or nonexistent users. Release requires all existing verification checks and records the actor and each check as structured values, not just a client-generated sentence.
- Ensure public/student APIs do not expose staff-only owner contact details, internal storage references, or private audit/custody details. Add narrowly scoped authenticated staff endpoints for custody history where needed.
- Update the staff UI to show the custody queue, current storage reference, custody history, reassignment result, release verification, and loading/empty/error/success states. Make failures visible and do not optimistically report an action as successful.
- Preserve the existing audit log and staff workflow where possible. Keep user-facing text clear that checkbox records document staff attestations; they are not automatic identity verification.

### C. Production hardening, indexes, and validation

- Review request validation, authorization, error handling, CORS, rate limits, security headers, secret handling, upload constraints, and safe output for the touched flows. Fix only concrete gaps relevant to these features; do not undertake unrelated refactors.
- Confirm credentials and secrets are loaded only from environment configuration and are not returned in API responses or logged. Do not display or copy any existing local secrets into documentation or test output.
- Review item browse and staff queue SQL using the actual filters and sort order. Add or alter indexes only when justified by those queries and safe migration practices; remove redundant indexes only with evidence and a migration plan. Keep the existing search-vector strategy unless validation demonstrates a problem.
- Add/update focused server tests for upload authorization/validation, object-key ownership/cleanup, custody authorization and transitions, atomic failure behavior, and private-field exposure. Stub external storage at the service boundary in unit tests; do not require cloud credentials.
- Run server tests, client lint/type checking, and a production client build. Run database-backed smoke checks only when a configured test database is available. Report any environment-dependent checks that could not be run.
- Update the deployment guide/README with storage and custody setup, migration commands, environment requirements, operational checks, and exact manual end-to-end test steps. Do not claim production deployment or a successful live upload without verifying it against configured services.

## Acceptance criteria

- New image submissions upload binary image content to configured object storage; item API JSON contains only the resulting URL and normal item fields.
- Invalid, oversized, or unauthenticated uploads are rejected, and storage errors do not create misleading item records.
- Staff intake, reassignment, and release are persisted as structured custody history with server-enforced permissions and valid transitions.
- Student users cannot invoke staff custody operations or retrieve staff-only custody/audit details; users cannot mutate another user's ordinary report.
- Custody/status/history updates remain consistent on failure, and object cleanup cannot escape the application's storage prefix.
- Existing schema indexes are not duplicated; any new index has a documented query rationale and migration.
- Focused tests and available client/server build checks pass, and documentation explains configuration and manual verification.

## Constraints and assumptions

- Use an S3-compatible storage API; configure vendor-specific endpoint, bucket, region, and credentials via environment variables. Do not assume cloud credentials or a production bucket are present in the workspace.
- Prefer small services/controllers and explicit validation. Do not add a new UI framework or replace the existing application structure.
- Do not commit secrets, run destructive database operations, or claim features are production-ready solely because code builds.
- Before making implementation changes, inspect the current worktree and keep unrelated user changes intact.