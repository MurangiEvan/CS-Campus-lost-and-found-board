# Fix Security Intake Audit Table

## Goal

Fix the generic error when campus security logs a found item by aligning existing database schemas with the tables required by the custody intake transaction.

## Verified facts

- The deployed API `/ready` responds with database connected, and its CORS preflight for `https://clienntt.vercel.app` succeeds with 204.
- The security intake controller validates the submitted fields and calls `Item.create` with `custodyIntake: true`.
- `Item.create` inserts the item, writes to `custody_events`, and then writes to `audit_events` inside one transaction. A failure in either event insert rolls back the new item.
- A read-only query against the database configured in local `server/.env` found `items` and `custody_events` present but `audit_events` missing.
- `server/schema.sql` defines `audit_events` with `id`, `user_id`, `action`, `target_type`, `target_id`, `details`, and `created_at`.
- The repository documents that migrations are applied explicitly to the selected database; there is no automatic migration runner.

## Planned implementation

1. Add an idempotent migration `server/migrations/20261009_add_audit_events.sql` that creates `audit_events` matching `server/schema.sql` and adds an index on `created_at` only if that matches existing audit-query patterns.
2. Keep `server/schema.sql` aligned with the migration definition; do not weaken or remove the audit write from the intake transaction.
3. Add a test or migration verification that checks the required audit table contract without connecting to production.
4. Run the server test suite and validate the SQL syntax against the confirmed development database.
5. Apply the migration only to the explicitly selected development database, then retry a staff intake and verify the item, custody event, and audit event all commit. The same migration must be separately applied to the Render database if that is the deployment target.

## Acceptance criteria

- The migration safely creates the missing audit table on an existing database without deleting data.
- The table shape matches `server/schema.sql` and supports the existing intake insert.
- A staff intake commits its item, custody event, and audit event atomically.
- No credentials, database connection values, or internal database errors are exposed.
