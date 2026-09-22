# CampusLink Deployment Guide

## 1. Required environment variables

### Server (.env)

```env
PORT=3000
NODE_ENV=production
JWT_SECRET=replace-with-secure-random-string
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
CORS_ORIGINS=http://localhost:3001,https://your-client-domain.com
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
```

The default browse feed requests `status=active`; resolved reports are available through the archived history view.

## 7. Rollback

- Restore previous deployment build
- Reapply earlier database snapshot if required
- Revert environment variables to previous known-good values

## 8. Known limitations

- Notifications and contact-preferences are UI-backed and not yet fully persisted
- Security match workflow is still a prototype
- Image uploads are not yet stored end-to-end
- Vercel and Render deployment cannot be verified until hosting credentials and a reachable PostgreSQL URL are supplied
