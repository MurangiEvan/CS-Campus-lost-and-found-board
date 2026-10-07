# Implementation Prompt: Role-Based Registration, Login, and Routing

## Goal

Make registration validate account details and persist the selected account type, remove role choice from login, automatically redirect users using the account type stored in PostgreSQL, and enforce student/security dashboard routes using the server-authenticated session.

Use the existing Next.js App Router, Express API, PostgreSQL, bcrypt, JWT, and HttpOnly cookie. Preserve the existing lost-and-found and custody APIs. Do not replace the application structure or rewrite working code.

## Existing implementation facts

- The users table already contains UUID `id`, `username` (the user's name), unique `email`, `password_hash`, `account_type` (`student` or `staff`), student/staff identifiers, and `created_at`.
- Registration already hashes passwords with bcrypt and enforces the campus email/identifier relationship. The UI currently asks for role during both login and registration, has no confirmation field, and accepts passwords shorter than the server should permit.
- Login currently requires `account_type` and a campus identifier. The server stores the authenticated user's account type in the JWT and sets the HttpOnly `campuslink_session` cookie; it does not return the JWT in JSON.
- The client currently restores user identity through `/api/v1/auth/session` and renders the security surface for `account_type === 'staff'`.
- `client/proxy.ts` currently checks only for a cookie's presence and does not verify the cookie or authorize a role. The existing `GET /api/v1/auth/session` endpoint verifies the cookie against the server secret and returns the database-backed account type.
- Server middleware and item APIs use `student`/`staff`; staff is the privileged Campus Security account.

## Compatibility decision

Keep `account_type` as the single persisted role field. Present `staff` as “Security” in the registration UI and translate the submitted “Security” choice to the existing `staff` value. Do not add a second `role` column or change existing account types to `security`, because custody/release authorization depends on `staff`. Keep `username` as the existing full-name field. No schema migration is required unless inspection during implementation reveals the existing constraints are missing.

## Implementation requirements

### Registration

- Keep the existing registration flow and campus requirements; display name, campus email, campus identifier, password, confirmation, and a Student/Security choice must be collected.
- Show the account-type selector only while registering, not while logging in.
- Validate required fields, valid email syntax, exact campus email/identifier relationship, password length of at least 8, matching confirmation, and the allowed account types in the client for fast feedback and again in the server as the authority.
- Server-side role mapping must accept only the public registration values `student` and `security` (or the documented existing `student`/`staff` contract) and persist `student` or `staff` in `account_type`; never trust account type from login input or session claims supplied by the browser.
- Reject duplicate email and duplicate student/staff numbers. Handle PostgreSQL unique-constraint races with a safe duplicate-account response rather than leaking SQL details.
- Keep bcrypt hashing on the server. Never return `password_hash`.
- On successful registration, switch to or navigate to the login view and show a clear success message. Do not switch views on a failed registration.

### Login and redirects

- Login form contains only one “Email or campus number” field and password. No role/account-type selector and no role in the login request.
- Look up an account by normalized email, student number, or staff number. If an identifier ambiguously matches multiple accounts, fail closed.
- Verify bcrypt hash and always use the generic message “Invalid email or password” for nonexistent users and wrong passwords.
- Read the user's role from the database result, place that server-derived account type in the existing signed HttpOnly session, and return only safe user identity data.
- Redirect `student` to `/app/student-dashboard` and `staff`/Security to `/app/security-dashboard` after login. Preserve password reset and logout behavior.

### Route authorization

- Protect `/app/student-dashboard` and `/app/security-dashboard` in `client/proxy.ts` by forwarding the session cookie to the existing server-authenticated `/api/v1/auth/session` endpoint. Use `API_SERVER_URL` when configured and the existing localhost API default during local development.
- Do not decode an unverified JWT or trust a URL parameter, local storage value, or client-submitted role to make the route decision.
- Missing, invalid, expired, or unverifiable sessions redirect to the login page. An authenticated user on the wrong dashboard redirects to the dashboard matching the server-returned `account_type`.
- Add the new route segments to the existing App Router catch-all allow-list and map each segment to the existing student/security surface. Keep API-side role checks (`authorizeStaff`) intact; page protection must not replace API authorization.
- Keep logout on both surfaces, clearing the HttpOnly cookie and returning to login.

### Tests and documentation

- Add focused server tests for registration validation, password hashing, duplicate identifiers, role mapping, generic login errors, login-by-email and login-by-number, and role sourced from the database rather than request input.
- Add focused route-guard tests where the existing test setup permits; otherwise factor the role-routing decision into a small testable helper and test that helper.
- Update the API contract table and brief developer instructions. Add only short, beginner-friendly comments where they clarify bcrypt hashing, server-derived role, and route authorization.
- Preserve unrelated worktree changes. Do not run database migrations or deployment commands without a configured target environment.

## Acceptance criteria

- Registering as Student stores `account_type='student'`; registering as Security stores `account_type='staff'`.
- Missing values, malformed/non-campus email, short/mismatched passwords, invalid roles, duplicate email, and duplicate identifiers are rejected safely.
- Login has only identifier and password fields and works with email or campus number without a role selector.
- Wrong credentials always produce “Invalid email or password.”
- Login role is derived from the stored database user and leads to the matching dashboard.
- Student sessions cannot load the security dashboard URL, and staff sessions cannot load the student dashboard URL; unauthenticated sessions are returned to login.
- Logout ends the server session; existing server authorization and lost/found workflows continue to work.
- Server tests, client lint, and production client build pass, with any pre-existing warnings reported separately.

## Expected files

- `client/app/page.tsx` — registration/login fields, validation feedback, and role-based login redirects.
- `client/proxy.ts` — authenticated role-aware page guard.
- `client/app/app/[[...section]]/page.tsx` — permit the two role dashboard route segments.
- `server/controllers/auth.controller.js` — authoritative registration/login validation, identifier lookup, and generic credential errors.
- `server/models/user.model.js` — safe lookup by email/student/staff identifier.
- `server/tests/auth-session.test.js` and/or a focused auth registration test — regression coverage.
- `AGENTS.md` — API contract update if auth request behavior changes.

No schema change is planned because the current schema already persists all required identity, hash, and account-type fields.