# API Test Execution Guide

## Scope and safety

The companion Postman collection is a source-grounded request template, not an executed test suite. It does not send requests automatically. Use a disposable local/test database and test-only SMTP/object-storage resources. Never select production for record-creating, password-reset, rate-limit, invalid-token, dependency-failure, or destructive tests. This package covers GET and POST only; PATCH/DELETE are excluded.

## Files

- `api-inventory.md`: source-derived endpoint and contract inventory.
- `api-test-cases.md`: human-readable cases; all status values start `Not Run`.
- `api-test-cases.csv`: spreadsheet register with the requested columns.
- `postman-collection.json`: Postman Collection v2.1 requests.
- `postman-environment.json`: safe variable placeholders.
- `openapi.yaml`: provisional source-based OpenAPI description.
- `api-coverage-report.md`: counts, exclusions, unknowns, and validation notes.

## Import and configure

1. In Postman, import `postman-collection.json` and `postman-environment.json`.
2. Select the imported `CampusLink Local Test` environment.
3. Set `serviceBaseUrl` to the approved test API origin, normally `http://localhost:3001` for local development.
4. Confirm `baseUrl` is the corresponding `/api/v1` base.
5. Provide synthetic, isolated test values for unique student/staff numbers and their matching `@tut4life.ac.za` email addresses.
6. Configure test database, SMTP capture, and S3-compatible test storage only when running those cases. Do not place database passwords or cloud secrets in Postman environment exports.

## Authentication in Postman

Run the login request with a dedicated synthetic test account. The API sets an HttpOnly `campuslink_session` cookie and does not return a JWT in the JSON body. Postman should retain the cookie in its cookie jar for subsequent requests to the same domain. The optional `accessToken` environment variable is provided only for a separately provisioned test JWT if the operator chooses to test the API's Bearer-header alternative; login does not populate it.

Staff-only requests require a staff account. Student-only ownership tests need at least two independent synthetic student accounts. Never use real campus credentials.

## Suggested sequence

1. Check service root, `/health`, and `/ready`.
2. Register a unique student/staff test account if needed.
3. Log in and confirm the cookie exists in the Postman cookie jar.
4. Run session/preferences and public item GET requests.
5. Run report creation using a unique synthetic item; record its returned ID only in the local environment.
6. Run owner/non-owner access cases with separate test accounts.
7. Use a staff account for intake, custody-history, admin search, and audit GET cases.
8. Run password reset only with a test SMTP capture/inbox and a token generated in that isolated environment.
9. Run upload requests only with a configured test bucket and its approved CORS policy.
10. Clean up test records using an approved isolated-database reset procedure; this GET/POST package does not include DELETE cleanup calls.

## Expected status and assertions

Each request has endpoint-specific Postman status/content checks. These scripts are examples derived from current code and do not prove the server is reachable or that a request has been run. A test result must only be marked `Passed` after actual execution and inspection of its assertions. The detailed human-readable cases remain the source for preconditions, execution steps, and ownership scenarios.

## Known environment dependencies

- `/ready` needs a reachable PostgreSQL database.
- Register/login/session and item queries need a compatible schema and JWT configuration.
- Password reset requires SMTP settings and test mail capture.
- Upload presign requires S3-compatible storage credentials and policy. Test uploads should use a non-production bucket.
- Browser CORS restrictions are relevant to browser clients; Postman is not a browser and does not enforce browser CORS in the same way.

## Troubleshooting

- `401`: check whether login cookie is present and not expired; login does not return a JWT in JSON.
- `403`: check role/ownership and trusted `Origin` for state-changing requests.
- `429`: auth attempts are rate limited; stop retrying and wait/reset only in an isolated test environment.
- `503` from readiness: database connection is unavailable. A `200` readiness response still does not guarantee all schema migrations are applied.
- `503` from upload presign: object storage configuration is unavailable.
- Generic `500`: inspect server-side logs in the authorized test environment; production error responses intentionally suppress internal details.
