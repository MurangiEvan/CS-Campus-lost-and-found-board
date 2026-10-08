# Fix Production Item Creation Schema Error

## Goal

Resolve the generic 500 returned when a student submits a found-item report, without weakening API error handling or changing the report flow unnecessarily.

## Verified evidence

- The current Vercel preview origin passes the live `OPTIONS /api/v1/items/intake` CORS check with status 204.
- The live Render `/ready` endpoint reports `database: connected`; this confirms connectivity but not schema compatibility.
- The screenshot displays the regular `Report found item` modal, not the staff-only `Log found item` intake modal. The client therefore posts to `POST /api/v1/items`.
- The item model's regular insert references `custody_status`, `storage_location`, and `custodian_user_id` even when creating a non-custody report.
- The existing `server/migrations/20261007_add_image_uploads_and_custody.sql` adds those columns. If the hosted database predates that migration, every ordinary item insert fails and is mapped to the generic 500 response.
- Production error middleware intentionally omits internal database details from the HTTP response.

## Hypothesis and discriminating check

The hosted PostgreSQL schema is missing one or more columns required by the current item insert. Check this directly in the hosted database before changing application code:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'items'
  AND column_name IN ('item_category', 'image_url', 'custody_status', 'storage_location', 'custodian_user_id')
ORDER BY column_name;
```

## Planned resolution

1. Compare the query result against the required columns listed above.
2. If custody columns are missing, apply the existing `server/migrations/20261007_add_image_uploads_and_custody.sql` to the hosted database using its approved SQL console. Do not expose database credentials or run destructive schema commands.
3. If every required column exists, inspect the corresponding Render production error at the failed `POST /api/v1/items` timestamp and identify that concrete database error before editing application code.
4. Retest a found-item report without an image and confirm the API returns 201 and the new row is persisted.

## Acceptance criteria

- The database schema supports the columns used by `Item.create`.
- A normal student found-item report persists successfully.
- No wildcard CORS, weaker authentication, or exposure of internal database errors is introduced.
- If the schema is already current, the actual Render error is identified before making a speculative code change.
