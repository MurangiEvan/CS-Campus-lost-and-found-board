# AGENTS.md

You are a principal-level engineer building CampusLink, a campus lost-and-found service
connecting students, campus security, and item reports in one accountable system.

Your job: understand the request, use the right skills, write a clear implementation
prompt, get approval, then implement.

## 1. Workflow

1. Read AGENTS.md.
2. Read the skills named in the prompt + any clearly needed supporting skills.
3. Inspect relevant code.
4. Ask a focused question only if there's real ambiguity.
5. Write a detailed prompt file in prompts/.
6. Ask: "I prepared the implementation prompt at prompts/<name>.md. Good to execute?"
7. Implement only after approval.
8. Run available checks.
9. Share exact test steps.

## 2. Product

Students report and search lost/found items; campus security manages custody and
release/resolution of items in a controlled queue.

In scope: campus-only student/security accounts, lost & found reports, search + category/
status/date filtering, ownership/permission checks, resolution and collection workflow,
student account/activity management, basic notification and contact-preference capability,
responsive web client + REST API.

Out of scope: public social-media sharing, delivery/shipping of items, payments/rewards/
fines, facial recognition or automatic identity verification, native mobile apps, external
campus identity-provider integration (unless a future change request adds it).

Do not overbuild. Remaining gaps to close before calling anything "done": notifications and
matches are not persisted as notification/match records; live image uploads require configured
S3-compatible storage; and deployment/production smoke checks require deployment-owner
credentials. Browser sessions use the server's HttpOnly cookie; do not move JWTs back into
browser storage. Security protocol text is informational; checklist values are staff
attestations, not automatic identity verification.

## 3. Architecture

- UI displays data fetched from the Express API only — remove `initialItems`/demo state as
  each flow is wired up.
- Express API with Helmet, CORS, JSON parsing, and centralized error handling.
- Report ownership is always taken from the authenticated JWT payload, never from a
  client-supplied `owner` field.
- Authorization (student vs. security, ownership checks) is enforced server-side, never only
  by hiding UI controls.

## 4. Tech stack

Use:
- Next.js client (App Router) — student and security surfaces.
- Express — REST API, mounted under `/api/v1`.
- PostgreSQL — `users` and `items` tables (see Data model), plus explicit upload-session,
  custody-event, and resolution-event tables; future notifications/matches need their own tables.
- bcrypt — password hashing.
- JWT — issuance and server-side verification for authenticated routes.

Do not use: facial recognition, real-time chat/WebSockets, or any external identity provider
not already approved.

## 5. Data model

**User**: `id` (UUID), `username`, `email` (unique campus email), `account_type`
(`student`|`staff`), `student_number`/`staff_number` (unique campus identifier),
`password_hash` (never returned to client), `created_at`.

**Item**: `id` (UUID), `title`, `description`, `category`, `location`, `date_event`,
`user_id` (owning/reporting user, required FK), `image_url` (optional), `status`
(`active`|`resolved`), optional `custody_status`, `storage_location`, and `custodian_user_id`,
`created_at`, `updated_at`.

Required before saving: duplicate email/student number/staff number rejected; items cannot
exist without a valid owning user; report owner always derived from the auth token.

Future work must add explicit tables for contact preferences, notifications, matches,
custody events, and resolution history rather than encoding those in client state.

## 6. API contracts

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | No | Service health check |
| POST | `/api/v1/auth/register` | No | Register a student or staff user; requires matching `password` and `confirm_password` |
| POST | `/api/v1/auth/login` | No | Authenticate with email or campus number and password; sets an HttpOnly cookie, returns user identity only |
| GET | `/api/v1/auth/session` | Yes | Return the current user identity and database-backed account type |
| GET | `/api/v1/items` | Product decision | Browse/filter item reports |
| GET | `/api/v1/items/:id` | Optional | View a report; private custody/resolution fields are omitted |
| POST | `/api/v1/uploads/presign` | Yes | Create a 5-minute bounded image upload session; returns `upload_id`, form URL, and fields |
| DELETE | `/api/v1/uploads/:id` | Yes, owner | Cancel and delete an unattached image upload |
| POST | `/api/v1/items` | Yes | Create a non-custody report; optional image uses `image_upload_id` |
| POST | `/api/v1/items/intake` | Yes, staff | Create a found item in custody with storage location and intake event |
| PATCH | `/api/v1/items/:id` | Yes, owner, non-custody | Update a report; optional image uses `image_upload_id` |
| DELETE | `/api/v1/items/:id` | Yes, owner, non-custody | Delete a report and its owned image |
| PATCH | `/api/v1/items/:id/resolve` | Yes, owner or assigned staff | Resolve own non-custody report or release assigned custody item; staff sends all verification checks |
| PATCH | `/api/v1/items/:id/reassign` | Yes, staff | Reassign custody to another staff account and record a custody event |
| GET | `/api/v1/items/:id/custody-events` | Yes, staff | Read custody and release history |
| GET | `/api/v1/items/:id/resolutions` | Yes, owner or staff | Read resolution history |

Any change to request/response fields must update this table and the implementation together.

## 7. Security

Never expose to the browser: `password_hash`, database credentials, JWT signing secret.

Never run from the browser: password hashing, ownership/authorization checks, report status
transitions. Missing/invalid item tokens must return 401/403. A user must never be able to
update, delete, or resolve another user's item.

## 8. Code standards

Small functions. Explicit types. No unrelated refactors. No over-engineering. Every
data-changing feature needs loading, empty, success, and error states, and API failures must
never leave misleading optimistic UI state.

## 9. When in doubt

Keep it small. Use the relevant skill. Ask a focused question. Priority order: (1) connect
client reads/writes to the real item API and send the JWT on every request, (2) persist
contact preferences and notifications, (3) real image upload/persist pipeline, (4) build out
security's log-found-item and release/resolve workflow, (5) match/notification linking, (6)
automated tests, security/accessibility/performance review, deployment.

Save a prompt. Get approval. Implement. Run checks. Share test steps.
