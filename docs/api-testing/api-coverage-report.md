# API Test Coverage Report

## Summary

| Measure | Count / status |
|---|---|
| Source-defined GET endpoints in scope | 11 |
| Source-defined POST endpoints in scope | 8 |
| Total GET/POST endpoints inventoried | 19 |
| Human-readable test cases | 38 |
| Automated executions performed for this package | 0 |
| Production requests sent | 0 |
| Existing OpenAPI file found before generation | No |

The inventory counts root service routes (`/`, `/health`, `/ready`) in addition to `/api/v1` routes. Endpoint counts were derived from `server/server.js` and the route modules. PATCH and DELETE routes are deliberately outside the requested method scope.

## Endpoint accounting

| Group | GET | POST | Source files |
|---|---:|---:|---|
| Service | 3 | 0 | `server/server.js` |
| Auth | 2 | 5 | `server/routes/auth.routes.js` |
| Items | 4 | 2 | `server/routes/item.routes.js` |
| Administration | 2 | 0 | `server/routes/admin.routes.js` |
| Uploads | 0 | 1 | `server/routes/upload.routes.js` |
| **Total** | **11** | **8** | |

## Excluded endpoint methods

The following routes exist but are not part of the requested GET/POST coverage:

- `PATCH /api/v1/auth/preferences`
- `PATCH /api/v1/items/:id/reassign`
- `PATCH /api/v1/items/:id`
- `PATCH /api/v1/items/:id/resolve`
- `DELETE /api/v1/items/:id`
- `DELETE /api/v1/uploads/:id`

Their behavior may be referenced as a precondition for some GET scenarios, but this package does not claim complete tests for them. [server/routes/auth.routes.js] [server/routes/item.routes.js] [server/routes/upload.routes.js]

## Test-case distribution

The current human-readable register contains 38 cases, covering service health/readiness, auth/session/preferences, item listing/detail/history, staff admin, registration/login/reset, report creation, custody intake, and image presign. Cases include positive, negative, security, dependency, and boundary categories. The CSV register contains the same cases and is the spreadsheet-friendly execution source.

## Coverage gaps and needs verification

- No request/response DTO or OpenAPI source exists; response schemas are inferred only where handler behavior makes them explicit.
- Database-returned item, resolution, custody-event, and audit row shapes depend on schema/model output; not every nullable field has a formally versioned API contract.
- `GET /api/v1/admin/audit` parses and caps `limit` but does not explicitly validate negative values.
- `GET /api/v1/items/:id/custody-events` returns the model query result without an explicit missing-item check.
- Login cookie behavior depends on deployment cookie configuration; Postman should retain `Set-Cookie` for the same host.
- Password reset success depends on SMTP/test-mail configuration and a valid one-hour token.
- Upload success depends on server-side object-storage configuration, bucket policy, and compatible public URL. No live storage provider was tested.
- `/ready` checks SQL connectivity only, not schema version or all required tables.
- Authorization and rate limiting are covered in part by unit tests; this generated Postman set has not been executed.
- No endpoint in this package tests production data or calls the deployed API.

## Validation performed

- Route modules and their controllers/models/middleware were inspected to enumerate methods and expected behavior.
- Postman collection and environment parsed as JSON; the collection declares the v2.1 schema and contains 19 requests.
- CSV parsed with 23 columns and 38 rows; all test IDs are unique, all result/defect fields are blank, and every case is `Not Run`.
- All Postman `{{variable}}` references are defined in the collection or selected environment (except Postman built-in `{{$timestamp}}`).
- A YAML parser was not available in the local environment, so `openapi.yaml` syntax was reviewed but not parser-validated.
- No Postman requests were sent. All cases must remain `Not Run` until executed by an operator in an authorized test environment.
