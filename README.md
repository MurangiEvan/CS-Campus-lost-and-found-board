# CS-Campus-lost-and-found-board
The problem: Students regularly lose phones, cards, keys, and bags on campus, with no central place to  report or search for them — items get handed to random offices and never reunited with their owners.

## Deployment notes

When deploying the server and client to different hosts (for example, Vercel and Render), set these environment variables for the server to allow cross-origin requests and cookies:

- `CORS_ORIGINS`: comma-separated list of allowed origins or suffixes. Examples: `https://my-site.vercel.app,https://app.onrender.com,.vercel.app` (prefix a domain with `.` to allow any subdomain suffix).
- `COOKIE_SAMESITE`: set to `none` when using cross-site cookies (ensure HTTPS). Default is `lax`.
- `COOKIE_SECURE`: set to `true` in production when cookies must be sent over HTTPS. Default is derived from `NODE_ENV`.

API additions:
- `GET /api/v1/items/:id/resolutions` — returns resolution history events for an item. Requires auth.

On the client, set `NEXT_PUBLIC_API_BASE_URL` to your API base (e.g. `https://api.my-domain.com/api/v1`). If omitted, the client uses the current origin plus `/api/v1`.

After changing env vars, redeploy both client and server. If login errors persist, check browser devtools network tab for CORS or cookie errors and share the failing request details.
