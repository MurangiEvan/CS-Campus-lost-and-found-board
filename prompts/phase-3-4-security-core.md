# CampusLink implementation prompt: finish Phase 3 and advance Phase 4

## Goal

Complete the remaining core student workflow from Phase 3 and implement the initial Phase 4 campus-security operations flow using the existing Express API and Next.js client.

## Scope

### Priority 1: finish Phase 3 student reporting and account management

1. Replace client-side demo data flow with real API reads/writes for item records.
2. Persist the JWT and send it on every item API request.
3. Fetch items from GET /api/v1/items, create via POST /api/v1/items, update/delete via PATCH/DELETE, and resolve via PATCH /api/v1/items/:id/resolve.
4. Remove or isolate the hardcoded `initialItems` usage as the client uses real server data.
5. Ensure user-specific report lists and account pages reflect API-backed data.
6. Add proper loading, empty, success, and error states for item operations so failed API calls do not leave misleading optimistic UI state.
7. Ensure the report owner is always derived from the authenticated JWT payload on the server, never from client-submitted owner data.
8. Keep authorization server-side; do not rely on hiding controls in the client.

### Priority 2: implement the basic Phase 4 security queue and custody workflow

1. Restrict security operations to staff-only accounts on the client and server.
2. Add a real staff-facing dashboard based on live item data.
3. Allow staff to log a found item or process an active item from the queue.
4. Add a release / resolve flow that updates item status and records the responsible identity in the server-side operation.
5. Ensure queue state refreshes after each operation without stale client state.
6. Keep the workflow simple and accountable; avoid overbuilding matching or notification tables not yet modeled.

## Constraints

- Follow the product contract in AGENTS.md and PROJECT_CONTRACT.md.
- Use the existing Express JWT auth middleware and the existing PostgreSQL schema where possible.
- Do not add unrelated refactors or broad feature work.
- Do not expose password hashes or JWT secrets to the browser.
- Do not allow a user to edit, delete, or resolve another user’s item.
- Keep the implementation small, explicit, and aligned with the current project structure.

## Files likely to be edited

- client/app/page.tsx
- server/controllers/item.controller.js
- server/models/item.model.js
- server/middleware/auth.middleware.js
- server/routes/item.routes.js
- server/server.js
- server/config/auth.js
- README.md if there are setup or verification notes to update

## Acceptance criteria

### Phase 3

- A logged-in student can create a report from the UI and see it on refresh using API-backed data.
- The client fetches items from the API and includes the JWT on authenticated requests.
- The student account page reflects the current user’s active/resolved reports.
- Editing, deleting, or resolving another user’s item is rejected by the server.
- Loading, empty, and error states are visible during fetch/create/update/delete actions.

### Phase 4

- Only staff accounts can view security operations.
- Staff can log a found item and resolve an item from a queue.
- The security queue reflects current server data after refresh.
- No unauthorized user can release or resolve items beyond their permissions.

## Working approach

1. Verify current behavior and identify the breakpoints in the real client/server flow.
2. Fix the client to use the API instead of `initialItems` and local-only mutations.
3. Fix the server-side permission checks for item actions and status transitions.
4. Add the staff dashboard workflow and queue behaviors.
5. Run the relevant local checks and report exact test steps.

## Deliverables

- Code changes implementing the API-backed Phase 3 flow and the basic Phase 4 security flow.
- A short verification run showing the app still builds or the relevant server/client checks pass.
- Clear test steps for the user to reproduce the student and security workflows.

## Important note

Do not over-engineer future features such as matching tables, notification persistence, or contact preference storage before the core item and security flows are working against the API.
