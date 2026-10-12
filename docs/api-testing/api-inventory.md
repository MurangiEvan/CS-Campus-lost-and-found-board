# CampusLink API Inventory

**Scope:** Source-defined `GET` and `POST` API operations only. API base is `/api/v1`; service endpoints `/`, `/health`, `/ready` are mounted at the server root. `PATCH` and `DELETE` endpoints are listed under exclusions in the coverage report. These are source-derived contracts; no production endpoint was called.

## Service Endpoints

| API ID | Method and path | Handler/source | Authentication | Parameters/body | Verified behavior and responses |
|---|---|---|---|---|---|
| API-GET-001 | `GET /` | Inline in `server/server.js` | None | None | `200` JSON with welcome message and endpoint hints. |
| API-GET-002 | `GET /health` | Inline in `server/server.js` | None | None | `200` JSON `{status:"OK", timestamp}`; process liveness only. |
| API-GET-003 | `GET /ready` | Inline in `server/server.js` | None | None | `200` `{status:"READY",database:"connected",timestamp}` after `SELECT 1`; on DB failure `503` `{status:"NOT_READY",database:"unavailable",error:"Database unavailable"}`. Does not validate full schema. |

## Authentication

| API ID | Method and path | Handler/source | Authentication | Request contract | Verified behavior and responses |
|---|---|---|---|---|---|
| API-GET-004 | `GET /api/v1/auth/session` | `authController.getSession`; `server/routes/auth.routes.js` | Required; cookie or Bearer accepted by middleware | No body | `200` safe identity fields `id, username, email, account_type, identifier`; `401` missing token or deleted account; invalid/expired JWT is `403`; errors may be generic `500`. |
| API-GET-005 | `GET /api/v1/auth/preferences` | `authController.getPreferences` | Required | No body | `200` `{emailUpdates:boolean,matchAlerts:boolean}`; fallback values are `true` if user lookup returns no preference values; auth errors apply. |
| API-POST-001 | `POST /api/v1/auth/register` | `authController.register` | None; auth rate-limited | JSON: `username`, `email`, `password`, `confirm_password`, `account_type` (`student` or `staff`), and corresponding `student_number` or `staff_number` | `201` message plus safe user identity; `400` missing/invalid values, email mismatch, weak password (<8), password confirmation mismatch; `409` duplicate email/campus number; rate-limit `429`; unhandled server error `500`. |
| API-POST-002 | `POST /api/v1/auth/login` | `authController.login` | None; auth rate-limited | JSON: `identifier`, `password` | `200` message and identity, sets HttpOnly `campuslink_session` cookie; `401` generic invalid credentials/missing values; `429`; `500`. JWT is not returned in JSON. |
| API-POST-003 | `POST /api/v1/auth/logout` | `authController.logout` | Route does not require authentication | No required body | `200` `{message:"Logged out"}` and clears session cookie. |
| API-POST-004 | `POST /api/v1/auth/forgot-password` | `authController.forgotPassword` | None; auth rate-limited | JSON: `email` | Missing email `400`; otherwise non-enumerating `200` message. Existing account causes token creation and SMTP delivery; delivery failure may return generic `500`; `429` rate limit. |
| API-POST-005 | `POST /api/v1/auth/reset-password` | `authController.resetPassword` | None; auth rate-limited | JSON: `token`, `newPassword` | Missing values `400`; invalid/expired token `400`; success `200` message; `429`; server errors `500`. Controller does not repeat registration's minimum-length validation. |

## Items

| API ID | Method and path | Handler/source | Authentication | Parameters/body | Verified behavior and responses |
|---|---|---|---|---|---|
| API-GET-006 | `GET /api/v1/items` | `itemController.getAllItems`; `server/routes/item.routes.js` | Optional | Query: `category`, `item_category`, `search`, `status`, `date_from`, `date_to`, `location` | `200` item array, default status is active in model; accepted status values `active`, `resolved`, `all`; invalid category/item-category/status/date or blank location returns `400`; staff responses can include owner/custodian fields; public responses omit custody and resolution-private fields. |
| API-GET-007 | `GET /api/v1/items/{id}` | `itemController.getItemById` | Optional | Path `id` | `200` privacy-shaped item or `404` `{error:"Item not found"}`; malformed DB UUID behavior is not explicitly normalized by controller. |
| API-GET-008 | `GET /api/v1/items/{id}/resolutions` | `itemController.getResolutions` | Required; item owner or staff | Path `id` | `200` resolution array; `404` missing item; `403` non-owner student; `401`/`403` auth middleware. |
| API-GET-009 | `GET /api/v1/items/{id}/custody-events` | `itemController.getCustodyEvents` | Required staff | Path `id` | `200` event array from model; controller does not separately check item existence, so empty array for no events is possible; `401`/`403` auth/role failures. |
| API-POST-006 | `POST /api/v1/items` | `itemController.createItem` | Required | JSON: required `title`, `description`, `category` (`lost`/`found`), `location`, `date_event`; optional `item_category` (`cards`,`keys`,`phones`,`bags`,`other`) and `image_upload_id` | `201` created item; `400` missing fields, invalid taxonomy, client-supplied `image_url`, invalid upload UUID; owner comes from token; `401`/`403`; `500` generic for unexpected failures. |
| API-POST-007 | `POST /api/v1/items/intake` | `itemController.createIntake` | Required staff | JSON: required title, description, location, date_event, storage_location; optional item_category, dropped_off_by, image_upload_id. Category is forced to `found`. | `201` created custody item; `400` validation or missing storage location; `401`/`403`; item, custody, and audit writes are transactional; `500` generic for unexpected errors. |

## Administration

| API ID | Method and path | Handler/source | Authentication | Parameters/body | Verified behavior and responses |
|---|---|---|---|---|---|
| API-GET-010 | `GET /api/v1/admin/users` | `adminController.searchUsers`; `server/routes/admin.routes.js` | Required staff | Query `q` | `200` array; missing or shorter than two characters returns `[]`; otherwise searches staff username/email/staff number and returns up to 20. `401`/`403` auth/role failures. |
| API-GET-011 | `GET /api/v1/admin/audit` | `adminController.listAudit` | Required staff | Query `limit` | `200` audit array newest first; default 50, maximum 200. Invalid numeric formats fall back to 50 through `parseInt(...) || 50`; negative values are not explicitly validated and may cause a database error. `401`/`403`. |

## Uploads

| API ID | Method and path | Handler/source | Authentication | Request contract | Verified behavior and responses |
|---|---|---|---|---|---|
| API-POST-008 | `POST /api/v1/uploads/presign` | `uploadController.createUpload` | Required | JSON: `content_type` (`image/jpeg`, `image/png`, `image/webp`) and positive integer `size` within configured limit | `201` upload ID, expiry, URL, form fields; `400` unsupported type or invalid/oversized size; `503` object storage not configured; `401`/`403`; other storage/database errors generic `500`. |

## Common Request Requirements

- JSON mutations use `Content-Type: application/json`; CORS allows `Content-Type`, `Authorization`, and `X-Requested-With`. [server/server.js]
- Authenticated requests may use the `campuslink_session` cookie or an `Authorization: Bearer <JWT>` header. Login sets a cookie and does not return a JWT body field. [server/middleware/auth.middleware.js] [server/controllers/auth.controller.js]
- Cross-origin browser requests require an allowed origin; state-changing requests are checked by the trusted-origin guard. [server/server.js] [server/middleware/origin.middleware.js]
- Selected auth routes are rate-limited to 30 attempts per 15 minutes; item/upload mutation routes use a separate limiter. [server/server.js]

## Source Index

- Route registration: `server/server.js`, `server/routes/auth.routes.js`, `server/routes/item.routes.js`, `server/routes/admin.routes.js`, `server/routes/upload.routes.js`
- Request behavior: `server/controllers/auth.controller.js`, `server/controllers/item.controller.js`, `server/controllers/admin.controller.js`, `server/controllers/upload.controller.js`
- Persistence: `server/models/user.model.js`, `server/models/item.model.js`, `server/models/image-upload.model.js`
- Security: `server/middleware/auth.middleware.js`, `server/middleware/origin.middleware.js`, `server/middleware/error.middleware.js`, `server/config/deployment.js`
