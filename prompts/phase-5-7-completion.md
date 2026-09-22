# CampusLink implementation prompt: complete Phases 5, 6, and 7

## Goal

Complete the remaining Phase 5 search/filter engine, Phase 6 claim resolution workflow, and Phase 7 deployment hardening and launch-readiness work in the existing CampusLink repository.

## Scope

### Phase 5: Search, Filter, And Category Engine

1. Extend the item taxonomy beyond `lost` and `found` with supported item categories for cards, keys, phones, and bags while preserving the existing lost/found report type.
2. Add category filter controls to the browse UI and ensure filtering is driven by API query parameters.
3. Add keyword search over title and description using PostgreSQL full-text search with a stored/searchable representation and an appropriate index. Keep a safe fallback for existing records and compatible PostgreSQL initialization.
4. Add date-from/date-to filters and a campus building/location filter to the API and UI.
5. Keep active reports in the main feed by default and provide an explicit resolved/archived view.
6. Add loading, error, no-results, and create-report fallback states.
7. Avoid client-only filtering as the source of truth: the browse workflow must query the API when search or filters change, with sensible request throttling or submit behavior to avoid request storms.

### Phase 6: Claim Resolution Workflow

1. Add a clear Mark as Claimed/Resolved action for the original report owner, with staff policy support already established by the project contract.
2. Add a confirmation modal that accepts optional resolution notes, such as collection through the Security Desk.
3. Persist resolution notes, resolved timestamp, and responsible user identity in an explicit resolution history table or equivalent normalized server-side structure.
4. Ensure the status transition is atomic and authorization is enforced on the server.
5. Add an archived/resolved history view separate from the active search feed.
6. Refresh the affected UI from persisted API data after a successful resolution; failed requests must not leave optimistic resolved state.

### Phase 7: Deploy, Harden, And Campus Launch

1. Add production-ready client and API deployment configuration compatible with Vercel for the Next.js client and Render-style Node deployment for the Express API.
2. Document all required environment variables and keep secrets out of source control and browser responses.
3. Add/confirm Helmet, restricted CORS, JSON limits, health/readiness checks, secure JWT configuration, and basic rate limiting for auth and mutation routes where compatible with the existing server.
4. Add database indexes for category, status, date, location/building, and full-text search. Keep schema initialization repeatable.
5. Add automated API tests for search filters, ownership/authorization, resolution notes, and staff operations. Add the narrowest available client/build validation.
6. Add a smoke-test script or documented procedure covering registration, login, report creation, searching, filtering, and claim/resolution flows.
7. Update deployment and release documentation with backup/restore, migration, rollback, known limitations, and exact verification commands.
8. Do not claim Vercel/Render deployment is complete unless the deployment is actually reachable and verified. If credentials or a reachable database are unavailable, provide deployment-ready files and document the external blocker precisely.

## Constraints

- Follow `AGENTS.md`, `PROJECT_CONTRACT.md`, and `client/AGENTS.md`.
- Preserve existing public API conventions unless a field or endpoint must change; update the contract and documentation together.
- Keep authorization server-side and derive report ownership from the JWT.
- Never expose password hashes, database credentials, or JWT secrets.
- Keep changes focused; do not invent chat, facial recognition, payments, delivery, or external identity-provider features.
- Preserve existing user data where possible through repeatable migrations and backward-compatible defaults.
- Use explicit validation for category, dates, building/location, notes, and status transitions.
- Ensure every data-changing flow has loading, success, empty, and error behavior.

## Expected implementation areas

- `server/schema.sql` and any migration/schema support
- `server/controllers/item.controller.js`
- `server/models/item.model.js`
- `server/routes/item.routes.js`
- `server/server.js` and middleware/configuration
- `client/app/page.tsx` and `client/app/globals.css`
- server tests and smoke-test support
- `PROJECT_CONTRACT.md`, `README.md`, `DEPLOYMENT_GUIDE.md`, and `RELEASE_CHECKLIST.md`
- deployment configuration files where they are supported by the repository

## Acceptance criteria

### Phase 5

- Browse supports API-backed keyword search, item category, lost/found type, status, date range, and building/location filters.
- PostgreSQL uses an appropriate full-text search index for title/description matching.
- The default feed excludes resolved items unless the archived view is selected.
- Empty, loading, error, and create-report fallback states work.
- Search and filter requests use persisted database data and survive refresh.

### Phase 6

- A student can resolve only an item they own; authorized staff can resolve according to policy.
- Confirmation notes are optional and persisted with resolution metadata.
- Resolved items appear in archived/history views and no longer appear in the default active feed.
- Unauthorized resolution attempts return an appropriate 401/403 response.
- The client reflects server state after refresh and after failed operations.

### Phase 7

- Client production build and server tests pass.
- Production configuration rejects insecure/missing JWT secrets and restricts CORS.
- Health/readiness checks distinguish API availability from database readiness.
- Schema/index setup is repeatable and documented.
- Deployment configuration and environment reference are complete.
- A smoke-test procedure is available and clearly identifies any external blocker, especially database reachability or missing hosting credentials.

## Working approach

1. Verify the current item schema, API, client browse flow, resolution flow, and hardening state.
2. Implement the smallest compatible schema/API foundation for Phase 5 and Phase 6.
3. Wire the client to server-side search/filter and persisted resolution history.
4. Add hardening, deployment configuration, tests, and documentation.
5. Run server tests, client build, schema/query checks where a reachable PostgreSQL database exists, and the smoke-test procedure.
6. Report completed work separately from externally blocked deployment steps.
