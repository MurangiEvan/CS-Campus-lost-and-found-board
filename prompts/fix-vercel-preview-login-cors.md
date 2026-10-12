# Fix Login CORS for CampusLink Vercel Deployments

## Goal

Allow credentialed API requests from this CampusLink Vercel project's stable domain and deployment preview URLs without opening the API to arbitrary Vercel origins or changing authentication behavior.

## Verified evidence

- The first screenshot's frontend origin was `https://clienntt-g9grgedw5-murangievans-projects.vercel.app`.
- The current stable frontend origin is `https://clienntt.vercel.app`.
- The live API health endpoint responds successfully.
- Live `OPTIONS` preflight to `/api/v1/auth/login` returns `500` for both CampusLink origins above, but `204` for `https://cs-campus-lost-and-found-board.vercel.app`.
- `server/config/deployment.js` currently allows exact origins only. `CORS_ORIGINS`, when set, replaces the default origin list.
- `server/server.js` applies both the CORS allowlist and `createTrustedOriginGuard`; both currently require exact origin matches.
- `client/app/page.tsx` sends credentialed login requests and converts fetch/CORS failures into the displayed temporary-unavailable message.

## Implementation plan

1. Add one shared origin-matching rule used consistently by CORS and the trusted-origin guard.
2. Preserve all existing exact origins and `CORS_ORIGINS` override behavior.
3. Additionally allow the exact stable HTTPS origin `https://clienntt.vercel.app` and HTTPS preview hosts only when they match this Vercel project/team pattern: `clienntt-<deployment-id>-murangievans-projects.vercel.app`. Do not allow arbitrary `*.vercel.app` origins or wildcard origins.
4. Extend the existing server configuration/origin tests to verify the stable and preview hosts are allowed and unrelated Vercel hosts, other domains, and untrusted origins are rejected.
5. Run the focused server test suite and verify the live preflight after deployment if deployment access is available. Do not change frontend code, cookies, credentials, or authentication routes.

## Acceptance criteria

- The stable domain and current preview URLs pass both CORS and the state-changing-request origin guard.
- Other Vercel projects remain blocked.
- Existing production origin defaults and explicit `CORS_ORIGINS` configuration remain supported.
- Focused tests pass; any external redeploy needed for live confirmation is reported clearly.
