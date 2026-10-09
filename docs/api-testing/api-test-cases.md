# CampusLink API Test Cases

All cases are documentation templates derived from the implementation. **None of these cases is marked as executed.** Execution status is `Not Run` by default. Use only an authorized isolated test environment; cases that create/update records must not be run against production.

| Test Case ID | API ID | Type / Priority | Scenario | Preconditions and steps | Expected result |
|---|---|---|---|---|---|
| TC-API-GET-001 | API-GET-001 | Positive / P2 | Root welcome | Start API; `GET /`. | `200`; JSON contains `message` and `endpoints`. |
| TC-API-GET-002 | API-GET-002 | Positive / P1 | Liveness | `GET /health`. | `200`; `status` is `OK`; timestamp is present. |
| TC-API-GET-003 | API-GET-003 | Positive / P1 | Database readiness | Test DB is reachable; `GET /ready`. | `200`; status `READY`, database `connected`, timestamp present. This does not prove schema completeness. |
| TC-API-GET-004 | API-GET-003 | Dependency / P2 | Database unavailable | In isolated test setup only, point API to an unavailable test DB; request `/ready`. | `503`; response reports `NOT_READY` and `Database unavailable`; no secret connection details. Restore test configuration. |
| TC-API-GET-005 | API-GET-004 | Negative / P1 | Session without cookie/token | No auth cookie or Bearer header; `GET /api/v1/auth/session`. | `401`; access token missing error. |
| TC-API-GET-006 | API-GET-004 | Positive / P1 | Session with valid login cookie | Login as synthetic test account; request session with Postman cookie jar. | `200`; safe identity fields; no password hash or JWT in JSON. |
| TC-API-GET-007 | API-GET-005 | Positive / P2 | Read own preferences | Authenticated test user; `GET /api/v1/auth/preferences`. | `200`; `emailUpdates` and `matchAlerts` are booleans. |
| TC-API-GET-008 | API-GET-006 | Positive / P1 | Filter active found items | `GET /api/v1/items?category=found&item_category=keys&status=active&date_from=2026-01-01&location=Library`. | `200` array; every row conforms to requested filters; public output omits custody and resolution-private fields. |
| TC-API-GET-009 | API-GET-006 | Negative / P2 | Invalid status filter | Request `/api/v1/items?status=unknown`. | `400`; error response has `error` and `status`; no DB mutation. |
| TC-API-GET-010 | API-GET-007 | Positive / P1 | Read existing public item | Use an existing synthetic item ID; request item without auth. | `200`; item identity/body fields returned; storage location/custodian/resolution-private data omitted. |
| TC-API-GET-011 | API-GET-007 | Negative / P2 | Item not found | Use a valid-format UUID not present in test DB. | `404`; `Item not found`. |
| TC-API-GET-012 | API-GET-008 | Positive / P2 | Owner reads resolution history | Resolve a test user's own item, then query history with that user's cookie. | `200` array containing resolution event fields. |
| TC-API-GET-013 | API-GET-008 | Security / P1 | Student reads another user's resolution history | Use separate student A/B accounts; request B's item history as A. | `403`; no resolution data disclosed. |
| TC-API-GET-014 | API-GET-009 | Positive / P2 | Staff reads custody history | Staff account; use an existing custody item ID. | `200` event array with event type, actor, details, and timestamp where available. |
| TC-API-GET-015 | API-GET-009 | Security / P1 | Student reads custody history | Request custody events with a valid student session. | `403`; staff-only error. |
| TC-API-GET-016 | API-GET-010 | Positive / P2 | Staff search for staff users | Staff cookie; `GET /api/v1/admin/users?q=synthetic`. | `200` array; results contain staff accounts only and at most 20 rows. |
| TC-API-GET-017 | API-GET-010 | Boundary / P3 | Short user-search term | Staff cookie; request `q=x`. | `200` empty array because term length is below two. |
| TC-API-GET-018 | API-GET-011 | Positive / P2 | Read audit rows with limit | Staff cookie; request `?limit=10`. | `200` array newest first, no more than 10 rows. |
| TC-API-POST-001 | API-POST-001 | Positive / P1 | Register synthetic student | Test DB; unique synthetic identifier/email; valid matching campus email, password >=8 characters and matching confirmation. | `201`; safe user identity; no password hash. Save generated account for subsequent tests. |
| TC-API-POST-002 | API-POST-001 | Negative / P1 | Registration email does not match identifier | Submit otherwise valid registration with unrelated email/identifier. | `400`; validation error; no account created. |
| TC-API-POST-003 | API-POST-001 | Negative / P1 | Duplicate campus identity | Repeat registration with existing test email or number. | `409`; generic duplicate response; no second account. |
| TC-API-POST-004 | API-POST-002 | Positive / P1 | Login and receive session cookie | Use valid test account identifier/password. | `200`; user identity and `Set-Cookie` for HttpOnly session; JSON contains no JWT. |
| TC-API-POST-005 | API-POST-002 | Negative / P1 | Invalid login credentials | Use synthetic nonexistent identifier and dummy password. | `401`; generic invalid email/password response; does not disclose account existence. |
| TC-API-POST-006 | API-POST-003 | Positive / P2 | Logout clears session | Send logout with a session cookie. | `200`; message present and cookie-clearing `Set-Cookie` header emitted. |
| TC-API-POST-007 | API-POST-004 | Negative / P2 | Forgot-password email omitted | Send `{}`. | `400`; `Email is required`. |
| TC-API-POST-008 | API-POST-004 | Security / P1 | Forgot-password enumeration resistance | In test mail environment, submit an existing and nonexistent synthetic email. | Both return the same `200` message. Delivery behavior is separately environment-dependent. |
| TC-API-POST-009 | API-POST-005 | Negative / P2 | Reset with invalid token | Send syntactically non-empty invalid token and dummy new password. | `400`; invalid/expired token response; password unchanged. |
| TC-API-POST-010 | API-POST-005 | Positive / P2 | Reset using valid token | Obtain real token through isolated test mail capture; submit token and new password. | `200`; success message; old password no longer authenticates and new password does. |
| TC-API-POST-011 | API-POST-006 | Positive / P1 | Create normal report | Authenticated student; isolated DB; valid synthetic title/description/category/location/date; no photo. | `201`; persisted item; `user_id` equals authenticated user; status active. |
| TC-API-POST-012 | API-POST-006 | Negative / P1 | Missing required report field | Authenticated student; omit `title`. | `400`; missing required fields; no item created. |
| TC-API-POST-013 | API-POST-006 | Security / P1 | Unauthenticated report creation | Send valid-looking report body with no cookie/Bearer. | `401`; no item created. |
| TC-API-POST-014 | API-POST-006 | Security / P1 | Client attempts owner mass assignment | Include another user's `user_id`/`owner` in body while authenticated as test user. | `201` if remaining body valid; persisted owner remains authenticated user. This verifies ignored client ownership fields. |
| TC-API-POST-015 | API-POST-007 | Positive / P1 | Staff custody intake | Staff cookie; isolated DB; valid found item fields and storage location. | `201`; custody state in custody; item, intake event, and audit event commit. |
| TC-API-POST-016 | API-POST-007 | Negative / P1 | Intake storage location missing | Staff cookie; otherwise valid body; omit storage location. | `400`; storage location required; no item/event committed. |
| TC-API-POST-017 | API-POST-007 | Security / P1 | Student attempts staff intake | Student cookie; valid-looking intake body. | `403`; no item/event committed. |
| TC-API-POST-018 | API-POST-008 | Positive / P1 | Presign supported image | Authenticated owner, configured test object storage; JPEG/PNG/WebP and positive size within limit. | `201`; upload ID, expiry, signed URL, and fields returned; never returns credentials. |
| TC-API-POST-019 | API-POST-008 | Negative / P2 | Presign unsupported content type | Authenticated test user; `content_type=image/svg+xml`. | `400`; supported image type validation error. |
| TC-API-POST-020 | API-POST-008 | Dependency / P1 | Presign when storage is unconfigured | Authenticated local test environment with storage vars intentionally absent. | `503`; safe message indicates uploads unavailable; no provider credentials/details. |

## Execution Notes

- All test cases are `Not Run`; expected results are not execution results.
- Registration, report creation, intake, password reset, and upload tests mutate state. Use a disposable isolated database and test bucket.
- Do not test database-down, expired-token, rate-limit, or storage-failure cases against production.
- Malformed JSON may be rejected by Express before a route handler; exact parser error text is not part of a stable contract.
- PATCH and DELETE route tests are outside this GET/POST test package and are enumerated as exclusions in `api-coverage-report.md`.
