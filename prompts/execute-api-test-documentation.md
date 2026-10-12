# Execute CampusLink API Test Documentation Generation

## Goal

Generate the requested API test documentation and Postman/OpenAPI artifacts for the CampusLink Express API, based strictly on current source and tests. Do not modify application code, database data, dependencies, or project configuration.

## Repository-specific facts verified

- API base path is `/api/v1`; process endpoints `/`, `/health`, and `/ready` are mounted at the API root.
- Auth routes are in `server/routes/auth.routes.js`; item routes in `server/routes/item.routes.js`; staff administration routes in `server/routes/admin.routes.js`; upload routes in `server/routes/upload.routes.js`.
- Current route definitions include 11 GET and 8 POST routes when root/service endpoints are counted. Recount against `server/server.js` and route files before writing artifacts.
- Additional PATCH/DELETE endpoints exist. The requested coverage focuses on GET and POST; report these excluded methods in the coverage report so the inventory boundary is explicit.
- API security includes HttpOnly cookie authentication, optional auth for item GETs, staff authorization, ownership rules, exact trusted-origin enforcement, auth rate limits, and centralized safe server errors.
- Tests use Node's built-in test runner under `server/tests/`.
- `docs/api-testing/` and an OpenAPI specification do not currently exist. Preserve other documentation and create the requested files under `docs/api-testing/`.
- Do not read or include values from `.env` files. Production calls and destructive tests are prohibited.

## Deliverables

Create:

1. `docs/api-testing/api-inventory.md`
2. `docs/api-testing/api-test-cases.md`
3. `docs/api-testing/api-test-cases.csv`
4. `docs/api-testing/postman-collection.json` (Collection v2.1)
5. `docs/api-testing/postman-environment.json`
6. `docs/api-testing/api-test-execution-guide.md`
7. `docs/api-testing/api-coverage-report.md`
8. `docs/api-testing/openapi.yaml` only for contracts reliably derivable from source; mark unknowns rather than inventing them.

## Required work

1. Trace every GET and POST route through controllers, middleware, models, schema, and tests. Include path/query/body parameters, status codes, auth/role/ownership rules, and external dependencies only where confirmed.
2. Include positive, negative, validation, authorization, safe-error, and boundary tests where supported. Do not invent pagination, sorting, idempotency, duplicate rules, or statuses. Label unverified behavior.
3. Assign unique API IDs and test-case IDs; link all cases to endpoint IDs and source files.
4. Generate realistic synthetic examples only. Leave actual result and defect fields blank; default execution status to `Not Run`.
5. Generate a valid Postman v2.1 collection and safe environment placeholders. Never hardcode credentials or tokens. Use explicit variables for API base URL and role-specific cookies/tokens as appropriate to the current HttpOnly-cookie contract.
6. Include Postman assertions derived per endpoint; do not run the collection automatically.
7. Validate JSON/YAML/CSV structure locally without network requests or modifying application data. Do not claim the generated requests were executed.
8. Preserve existing `SYSTEM_DOCUMENTATION.md` and all unrelated worktree changes.

## Acceptance criteria

- Every source-defined GET/POST route is inventoried, including public health/root endpoints.
- Every inventoried route has linked test cases appropriate to its actual contract.
- CSV headers exactly match the supplied master specification.
- Collection parses as Postman Collection v2.1; environment JSON parses; OpenAPI is source-grounded.
- Coverage report identifies excluded PATCH/DELETE routes, unknown details, and deployment-only prerequisites.

## Approval gate

Generate the deliverables only after the user approves this prompt.