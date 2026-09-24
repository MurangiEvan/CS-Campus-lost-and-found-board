# CampusLink Deployment Guide

## 1. Required environment variables

### Server (.env)

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=replace-with-secure-random-string
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
CORS_ORIGINS=http://localhost:3001,https://your-client-domain.com,.vercel.app,.onrender.com
COOKIE_SAMESITE=none
COOKIE_SECURE=true
```

### Client (.env.local or deployment env)

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com/api/v1
NEXT_PUBLIC_APP_URL=https://your-client-domain.com
```

## 2. Database setup

- Create PostgreSQL database.
- Run schema initialization from `server/schema.sql`.
- Validate tables: `users`, `items`.
- Confirm backup/restore flow before production release.

### Full-text search index

The schema now includes a generated `search_vector` column and a GIN index. After applying `server/schema.sql`, ensure the index exists:

```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'items';
```

If you add records via an older migration path, run an update to populate `search_vector` for existing rows:

```sql
UPDATE items SET search_vector = to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')) WHERE search_vector IS NULL;
```

## 3. Start the API

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
{ "notes": "Returned via Security Desk" }
GET /api/v1/items?status=resolved

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
- Image uploads are not yet stored end-to-end
- Vercel and Render deployment cannot be verified until hosting credentials and a reachable PostgreSQL URL are supplied
