# Fix Local Client API URL

## Goal

Restore local sign-in by pointing the Next.js client at the local Express API's versioned route base.

## Verified facts

- The local client runs at `http://localhost:3000`.
- `server/index.js` starts the Express API on port `3001` by default; `http://localhost:3001/health` responds with status 200.
- `client/app/page.tsx` builds API calls as `${NEXT_PUBLIC_API_BASE_URL}${path}`, where paths include `/auth/login`.
- Express mounts authentication routes under `/api/v1/auth`.
- `client/.env.local` currently sets `NEXT_PUBLIC_API_BASE_URL=https://serverr-ilj4.onrender.com/`, which sends local authentication requests to the wrong path.
- `API_SERVER_URL=http://localhost:3001` is already correct for local Next.js rewrites and protected-route session checks.
- `NEXT_PUBLIC_APP_URL` is not currently used by client or server source code.

## Planned change

Change only `NEXT_PUBLIC_API_BASE_URL` in `client/.env.local` to:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
```

Keep the other values unchanged. Restart the Next.js dev server so it picks up the environment change.

## Verification

- Confirm local API health on port 3001.
- Verify `OPTIONS /api/v1/auth/login` accepts origin `http://localhost:3000`.
- Restart the client dev server and test sign-in locally; do not print or log credentials.
