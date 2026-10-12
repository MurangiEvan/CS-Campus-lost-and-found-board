# Fix security dashboard item release flow

## Goal

Finish the staff-side release flow so items in custody can be released from the security dashboard with the required verification checks, proper server authorization, and accurate queue/history updates.

## Problem to solve

The current release flow is partially implemented but not consistently working in the security dashboard. The release modal should display the required collection-verification checklist, staff should be able to release only items assigned to them while in custody, and the release action should persist the resolution and custody history without leaving stale UI state or broken permissions.

## Scope

1. Confirm the security dashboard displays only staff-eligible custody items in the release queue.
2. Ensure the release modal requires all three verification checks before `PATCH /api/v1/items/:id/resolve` is allowed.
3. Verify the server accepts only staff for custody release, only active in-custody items assigned to that staff user, and rejects unauthorized attempts with the correct status codes.
4. Confirm release writes a resolution event and custody release event atomically, without leaving the item in a stale state.
5. Refresh the dashboard state after a successful release and prevent misleading optimistic UI states when the API call fails.
6. Keep the implementation narrow and aligned with the existing item model, auth middleware, and client patterns.

## Files likely involved

- client/app/page.tsx
- server/controllers/item.controller.js
- server/models/item.model.js
- server/routes/item.routes.js
- server/middleware/auth.middleware.js
- server/migrations/20261010_ensure_release_history.sql

## Acceptance criteria

- A staff user can open the release flow for items currently in custody and assigned to them.
- The release modal shows and requires the three checks: student ID verified, proof of ownership confirmed, and item condition noted.
- The backend rejects missing verification with `400` and rejects unauthorized release attempts with `403`.
- A successful release updates the item to `resolved` with `custody_status = 'released'`, adds the release event, and preserves the history trail.
- The security dashboard removes or updates the released item immediately after a successful API response and shows a meaningful error if the request fails.
- The change does not relax security rules or expose private item data to the browser.

## Validation

Run the targeted checks for the relevant server tests and the security release flow, then report the exact reproduction steps for the user.
