# Fix Report Submission and Verify Dashboard Navigation

## Goal

Restore item report submission in local development and verify that Home, Browse, My reports, and Notifications navigation works across desktop and mobile layouts.

## Verified findings

- `client/.env.local` now points `NEXT_PUBLIC_API_BASE_URL` to `http://localhost:3001/api/v1`.
- Local Express health and the `http://localhost:3000` login preflight return 200 and 204 respectively.
- A read-only query against the database configured by `server/.env` found `items.custody_status`, `items.storage_location`, and `items.custodian_user_id` missing. The current `Item.create` insert references all three columns, which explains the generic report-submission 500.
- `server/migrations/20261007_add_image_uploads_and_custody.sql` adds those columns and the custody tables. The repository has no automatic migration runner; deployment guidance says to apply the migration to the explicitly selected database.
- The main navigation buttons call `navigateToView`, which routes to `/app`, `/app/browse`, `/app/reports`, and `/app/notifications`. The current CSS switches the nav to a fixed bottom bar at widths up to 760px.

## Planned execution

1. Confirm the target represented by `server/.env` is the intended local/development database, not production. Do not display or share its connection string.
2. Apply the existing idempotent `server/migrations/20261007_add_image_uploads_and_custody.sql` migration to that confirmed target only. Do not run schema changes against an unconfirmed or production database.
3. Rerun the read-only column check, then use an authenticated local session to submit a found-item report without an image and verify it persists and appears under My reports and Browse.
4. Verify Home, Browse, My reports, and Notifications navigation at desktop and narrow mobile widths. Make a UI code change only if a concrete route, interaction, overflow, or touch-target failure is found; keep current design conventions.
5. Run focused server tests and the client production build if any source code changes are needed.

## Acceptance criteria

- The local database contains every column used by `Item.create`.
- A normal report submission succeeds and is visible in the corresponding views.
- The four navigation destinations are reachable by clicking/tapping at desktop and mobile widths without clipping or horizontal overflow.
- No migration is run against an unconfirmed database, and no unrelated UI refactor is introduced.
