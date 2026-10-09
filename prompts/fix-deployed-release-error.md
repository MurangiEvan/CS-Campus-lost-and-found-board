# Fix Deployed Security Release Failure

## Goal

Resolve the generic service-unavailable error when staff release a custody item in the deployed CampusLink app, without weakening release verification or exposing database internals.

## Verified findings

- The release endpoint is `PATCH /api/v1/items/:id/resolve`, protected by authentication; staff release is allowed only for an active item assigned to that staff user and currently in custody.
- The controller requires all three verification booleans to be `true`: `student_id_verified`, `proof_of_ownership_confirmed`, and `item_condition_noted`. Otherwise it returns `400` before database writes.
- Current workspace security-dashboard code passes `requireChecks` to `ResolutionModal`, whose source renders all three checkboxes and submits those booleans.
- The supplied deployed screenshot shows no verification checkboxes, so the deployed Vercel frontend appears not to match current workspace source. Confirm deployment commit/alias and redeploy the correct branch/build before testing release.
- The release model performs one transaction: update the item, insert `resolution_events`, then for staff insert `custody_events` and `audit_events`. Any missing table/column or DB error rolls back the release and becomes a generic `500`.
- `server/schema.sql` defines all three history tables. `20261007_add_image_uploads_and_custody.sql` creates custody history but not resolution history; `20261009_add_audit_events.sql` creates the audit table.
- Prior read-only checks and migration application were against the confirmed development database. Render/production database state was not queried or modified. `/ready` only checks database connectivity.

## Planned investigation and fix

1. Confirm Vercel serves a deployment built from the current commit containing the staff verification checklist. Do not remove or bypass checks.
2. In the explicitly selected production database console, run a read-only check for `items.custody_status`, `items.custodian_user_id`, and the `resolution_events`, `custody_events`, and `audit_events` tables.
3. If any required table is absent, add/use an idempotent additive migration matching `server/schema.sql` and apply it only after confirming the intended target and backup. Ensure `resolution_events` is covered in addition to custody and audit tables.
4. Verify every required table exists and the deployed API release code is on the intended version.
5. Test with a dedicated staging/test item and staff account: verify the three checks are visible and required; submit them all as true; confirm the item resolution, custody release event, and audit event commit together. Never test against a real person's item or bypass authorization.
6. If schema is complete and current UI is deployed but release still returns 500, inspect the corresponding Render server error log for the sanitized request timestamp and identify the exact failed statement before changing application code.

## Acceptance criteria

- Deployed release modal displays and requires all three verification checks.
- Production schema supports every statement in the release transaction.
- A staging release commits item, resolution, custody, and audit records atomically.
- Missing/invalid checks still return 400; unauthorized ownership/role attempts remain rejected.
- No production release mutation is performed without a dedicated authorized test item.
- No internal database details or secrets are exposed to the browser.
