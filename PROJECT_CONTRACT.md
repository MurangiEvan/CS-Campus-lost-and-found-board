# CampusLink Project Contract

**Project:** CS Campus Lost and Found Board  
**Product name:** CampusLink  
**Document status:** Baseline contract and delivery roadmap  
**Last reviewed:** 17 September 2026  
**Primary owner:** Murangi Mashau

## 1. Problem Statement

Students regularly lose phones, cards, keys, bags, and other belongings on campus. There is no single trusted place to report a lost item, register a found item, search existing reports, or coordinate collection. Items are handed to unrelated offices and are often not reunited with their owners.

CampusLink is a campus-focused lost-and-found service that connects students, campus security, and item reports in one system.

## 2. Product Goal

CampusLink must provide a secure, searchable, and accountable workflow for:

1. Students to create accounts and sign in with campus credentials.
2. Students to report lost and found items with useful identifying details.
3. Students to browse, search, and filter reports.
4. Campus security to manage items in custody and mark items as released or resolved.
5. Students to view their active listings, contact preferences, and resolution history.
6. The system to preserve ownership, status, and audit-relevant timestamps in PostgreSQL.

## 3. Users And Permissions

| User | Can do | Cannot do |
|---|---|---|
| Student | Register, sign in, browse reports, search/filter reports, create reports, view own activity, view account information | Access staff operations or modify another student's report |
| Campus security staff | Sign in, view the operational queue, review active items, resolve/release items, manage custody workflow | Use student-only activity as another user |
| Unauthenticated visitor | See the sign-in/create-account screen | Access reports or protected operations |

Authorization must be enforced by the server, not only by hiding client controls.

## 4. Current Repository Baseline

### Delivered or partially delivered

- Next.js client in `client/` with responsive CampusLink UI.
- Express API in `server/` with Helmet, CORS, JSON parsing, and centralized error handling.
- PostgreSQL schema for `users` and `items`.
- Student/staff registration and login endpoints.
- Registration requires an email matching the entered campus identifier and the `@tut4life.ac.za` domain.
- Bcrypt password hashing and JWT authentication.
- Item API endpoints for listing, reading, creating, updating, deleting, and resolving reports.
- Client login and create-account forms.
- Client student views: home, browse, reports, notifications, and account profile.
- Client campus security dashboard.
- Correct initials derived from the user's full name.

### Current implementation limitations

- Notifications and contact preferences remain browser-backed prototypes rather than database-backed records.
- Email OTP delivery requires a configured mail provider and is not enabled by default.
- Image uploads are persisted as bounded data URLs in the item record; production cloud storage is not configured.
- The security matching workflow remains a controlled queue rather than an automated match engine.
- Vercel, Render, and Neon launch verification requires external provider credentials and a reachable production database.

## 5. Scope And Non-Goals

### In scope

- Campus-only student and security accounts.
- Lost and found item reports.
- Search and category/status/date filtering.
- Item ownership and permission checks.
- Resolution and collection workflow.
- Student activity/account management.
- Basic notification and contact-preference capability.
- Responsive web client and REST API.

### Out of scope for this contract

- Public social-media sharing.
- Delivery or shipping of items.
- Payments, rewards, or fines.
- Facial recognition or automatic identity verification.
- Native mobile applications.
- External campus identity-provider integration unless added as a future change request.

## 6. Delivery Phases And Sprints

### Phase 1: Discovery And Product Foundation

**Outcome:** A shared, testable definition of the problem, users, workflows, and technical boundaries.

#### Sprint 1.1: Problem, Personas, And Workflow Definition

**Deliverables**

- Confirm student, security, and unauthenticated user journeys.
- Define report lifecycle: `active` -> `resolved`.
- Define account, ownership, privacy, and campus-security rules.
- Agree on required fields and validation rules.

**Acceptance criteria**

- A student can describe the complete lost-item flow from report to resolution.
- A security user can describe custody/release responsibilities.
- Every protected action has an identified authorization rule.
- Required fields and allowed values are documented.

#### Sprint 1.2: UX And Technical Baseline

**Deliverables**

- Responsive page structure and visual language.
- Client/server directory structure.
- API route naming and database ownership boundaries.
- Local development instructions and environment variable list.

**Acceptance criteria**

- Client and server can be installed and started independently.
- The client production build completes successfully.
- The API exposes a health check.
- No secret or database credential is committed to source control.

### Phase 2: Authentication And Data Foundation

**Outcome:** Users and item records can be stored securely and accessed through authenticated API operations.

#### Sprint 2.1: Database Schema And Migrations

**Deliverables**

- `users` table with student/staff account type and unique campus identifiers.
- `items` table with owner, category, location, date, status, image URL, and timestamps.
- Foreign keys, validation constraints, and useful indexes.
- Repeatable schema initialization/migration process.

**Acceptance criteria**

- A fresh PostgreSQL database can be initialized from the schema.
- Existing email-only user databases can receive the account-type and identifier additions safely.
- Duplicate email, student number, or staff number is rejected.
- Items cannot exist without a valid owning user.

#### Sprint 2.2: Registration, Login, And Authorization

**Deliverables**

- Student and staff registration.
- Login by account type and campus identifier.
- Bcrypt password hashing.
- JWT issuance and server-side token verification.
- Authenticated item routes.

**Acceptance criteria**

- Valid registration creates one user record with a hashed password.
- Invalid account type, missing identifier, missing email, or weak required input returns a clear `400` response.
- Registration accepts only `<student-or-staff-number>@tut4life.ac.za`, matched to the submitted identifier case-insensitively.
- Valid login returns a token and user identity.
- Invalid credentials return `401` without revealing whether the account exists.
- Missing or invalid item tokens return `401`/`403`.
- A user cannot update, delete, or resolve another user's item.

### Phase 3: Student Reporting And Account Management

**Outcome:** Students can use the core product end to end and manage their own activity.

#### Sprint 3.1: Lost And Found Reporting

**Deliverables**

- Student report form for lost and found items.
- Required title, description, category, location, and event date.
- Optional image upload or a clearly supported image URL workflow.
- API-backed create, update, delete, and resolve actions.

**Acceptance criteria**

- Submitting a valid report persists it in PostgreSQL and it appears after refresh.
- The report owner is taken from the authenticated token, never from a client-supplied owner field.
- Invalid categories and missing required fields are rejected.
- A user can edit/delete only their own report.
- A resolution changes status and updates `updated_at`.
- The UI displays loading, success, and error states for API operations.

#### Sprint 3.2: Browse, Search, And Filtering

**Deliverables**

- Board populated from `GET /api/v1/items`.
- Search by title and description.
- Lost/found and active/resolved filters.
- Date range filters where exposed by the UI.
- Item detail view with privacy-safe contact/collection guidance.

**Acceptance criteria**

- A newly created report is discoverable without a full page rebuild.
- Search and filters produce results from server data.
- Empty, loading, and failed requests have usable UI states.
- Private credentials, password hashes, and unnecessary personal data are never shown in item results.

#### Sprint 3.3: Student Account Management Page

**Deliverables**

- Profile page showing the student's name, campus email, account number, and correct initials.
- Active student listings.
- Contact preferences.
- Resolution history.
- Sign-out behavior and protected account access.

**Acceptance criteria**

- The account page identifies the signed-in student correctly, including multi-word names.
- Active listings and resolved history are fetched from that student's records.
- Contact preferences can be viewed and updated, with persistence confirmed after refresh.
- A student cannot see another student's private account data.
- Account data has a responsive layout on desktop and mobile.

### Phase 4: Campus Security Operations

**Outcome:** Campus security can operate a controlled custody and collection queue.

#### Sprint 4.1: Security Queue And Custody Workflow

**Deliverables**

- Security-only dashboard.
- Active item queue and operational counts.
- Log-found-item workflow.
- Collection/release checklist.
- Resolve/release operation with server-side role checks.

**Acceptance criteria**

- Only staff accounts can access security operations.
- Staff can log a found item with a responsible owner/audit identity.
- Staff can mark an item released/resolved where policy allows.
- The queue reflects database state after refresh.
- Every release has a timestamp and responsible user recorded.

#### Sprint 4.2: Matching, Notifications, And Privacy

**Deliverables**

- Match or candidate-linking workflow between lost and found reports.
- Notification records and read/unread state.
- Contact preference enforcement.
- Safe collection instructions without exposing sensitive contact information.

**Acceptance criteria**

- A relevant match can generate a notification for the affected student.
- Students only receive notifications for reports they own or matches involving them.
- Notification state persists across sessions.
- Contact details are shown only according to the configured preference and security policy.

### Phase 5: Integration, Quality, And Release

**Outcome:** The product is reliable, secure, documented, and deployable.

#### Sprint 5.1: Client/API Integration And Data Migration

**Deliverables**

- Replace client demo state with API reads and writes.
- Add authenticated request handling and token expiry behavior.
- Remove or clearly isolate seeded demo data.
- Add environment-based API URL configuration.

**Acceptance criteria**

- A user can register, sign in, create a report, browse it, resolve it, and see it in account history using persisted data only.
- Refreshing the browser does not erase reports.
- API failures do not leave misleading optimistic UI state.
- Development and production API URLs are configurable without source edits.

#### Sprint 5.2: Testing, Security, Accessibility, And Performance

**Deliverables**

- API unit/integration tests.
- Client component/workflow tests.
- End-to-end authentication and reporting test.
- Input validation, rate limiting, secure JWT secret configuration, and production CORS policy.
- Keyboard navigation, labels, focus states, contrast, and mobile checks.

**Acceptance criteria**

- Critical auth and ownership paths have automated tests.
- The test suite runs from documented commands.
- No default JWT secret is used in production.
- Production CORS is restricted to approved client origins.
- Core workflows are usable by keyboard and on a mobile viewport.

#### Sprint 5.3: Deployment And Handover

**Deliverables**

- Deployment configuration for client, API, and PostgreSQL.
- Database backup/restore procedure.
- Environment variable reference.
- Operator and student-facing documentation.
- Release checklist and known limitations.

**Acceptance criteria**

- A clean environment can be deployed from the documentation.
- Health checks confirm client/API/database readiness.
- Rollback and database backup steps are documented.
- The released version is tagged with a known schema and API version.

## 7. Core API Contract

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | No | Service health check |
| `POST` | `/api/v1/auth/register` | No | Register a student or staff user |
| `POST` | `/api/v1/auth/login` | No | Authenticate by account type and identifier |
| `GET` | `/api/v1/items` | Product decision | Browse/filter item reports (`category`, `item_category`, `search`, `status`, `date_from`, `date_to`, `location`) |
| `GET` | `/api/v1/items/:id` | Product decision | View one report |
| `POST` | `/api/v1/items` | Yes | Create a report |
| `PATCH` | `/api/v1/items/:id` | Yes, owner | Update a report |
| `DELETE` | `/api/v1/items/:id` | Yes, owner | Delete a report |
| `PATCH` | `/api/v1/items/:id/resolve` | Yes, policy-controlled | Resolve/release a report with optional `notes` |

Any change to request or response fields must update this contract and the implementation together.

## 8. Data Contract

### User

- `id`: UUID primary key.
- `username`: display name.
- `email`: unique campus email.
- `account_type`: `student` or `staff`.
- `student_number` or `staff_number`: unique campus identifier.
- `password_hash`: stored hash only; never returned to the client.
- `created_at`: creation timestamp.

### Item

- `id`: UUID primary key.
- `title`, `description`, `category`, `location`, `date_event`.
- `user_id`: owning/reporting user.
- `image_url`: optional media reference.
- `status`: `active` or `resolved`.
- `created_at`, `updated_at`: lifecycle timestamps.

Future work must add explicit tables for contact preferences, notifications, matches, custody events, and resolution history rather than encoding those concepts only in client state.

## 9. Definition Of Done

A sprint is complete only when:

- Acceptance criteria are demonstrated against the running application.
- Data-changing behavior is persisted and survives refresh where applicable.
- Server authorization and validation are implemented.
- Responsive and accessible states are checked.
- Relevant tests or a documented verification command pass.
- README/environment/API documentation is updated.
- Known limitations are recorded rather than implied to be complete.

A phase is complete only when all of its sprint outcomes are complete and the next phase can use the delivered interfaces without relying on mock-only behavior.

## 10. Change Control

Any new feature, changed permission, schema change, API field change, or change to the report lifecycle must be recorded in this file before implementation or reviewed as an explicit contract change. Changes should identify:

- The affected phase and sprint.
- The user or business problem addressed.
- Database/API/UI impact.
- Updated acceptance criteria.
- Migration, compatibility, and test requirements.

This contract is the shared source of truth for what CampusLink promises to deliver and how completion will be verified.
