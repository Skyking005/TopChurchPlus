# TopChurchPlus API Registry

Status: Generated from repository inspection
Last updated: 2026-06-14
Scope: Documentation only. Verify route files before API changes.

## API Middleware Boundary

`api/src/index.js` configures API key middleware with:

* Public paths:
  * `GET /health`
  * `POST /linebot/webhook`
* Public prefixes:
  * `/liff`

Other routes should be treated as protected API endpoints unless a route-level rule proves otherwise.

## Core

| Method | Path | Source |
| --- | --- | --- |
| GET | `/health` | `api/src/modules/core/routes.js` |
| GET | `/entity-links` | `api/src/modules/core/routes.js` |

## Auth

| Method | Path | Source |
| --- | --- | --- |
| POST | `/login` | `api/src/modules/auth/routes.js` |
| POST | `/login/verify` | `api/src/modules/auth/routes.js` |
| POST | `/counter/pin-login` | `api/src/modules/auth/routes.js` |

## System

| Method | Path |
| --- | --- |
| GET | `/initial-data` |
| GET | `/system/users` |
| POST | `/system/users` |
| PUT | `/system/users/:staffId/pastoral-churches` |
| PUT | `/system/users/:staffId/roles` |
| POST | `/usage` |
| GET | `/system/feature-permissions` |
| PUT | `/system/feature-permissions` |
| GET | `/system/logs` |
| GET | `/system/id-rules` |
| PUT | `/system/id-rules/:entityKey` |
| GET | `/system/config` |
| PUT | `/system/config/:configKey` |
| GET | `/system/config-keys` |
| POST | `/system/config-keys` |
| PUT | `/system/config-keys/:namespace/:configKey` |
| GET | `/params/:type` |
| POST | `/params/:type` |
| PUT | `/params/:type` |
| DELETE | `/params/:type/:value` |

Source: `api/src/modules/system/routes.js`.

## Project / Meetings

| Method | Path |
| --- | --- |
| GET | `/projects` |
| GET | `/projects/:projectId/detail` |
| POST | `/projects/detail` |
| POST | `/projects` |
| GET | `/projects/:projectId/meetings` |
| GET | `/meetings` |
| GET | `/projects/:projectId/meetings/:meetingId/record-pdfs/:fileId` |
| POST | `/projects/:projectId/permissions` |
| DELETE | `/projects/:projectId/permissions/:staffId` |
| POST | `/meetings` |
| PUT | `/projects/:projectId/meetings/:meetingId` |
| PATCH | `/projects/:projectId/meetings/:meetingId/status` |

Source: `api/src/modules/project/routes.js`.

## Finance

| Method | Path |
| --- | --- |
| GET | `/purchases` |
| POST | `/purchases/detail` |
| GET | `/purchases/:purchaseId/quote-pdfs/:fileId` |
| POST | `/purchases` |
| PATCH | `/purchases/:purchaseId/close` |
| POST | `/purchases/:purchaseId/advances` |
| POST | `/purchases/:purchaseId/expense-proofs` |
| POST | `/purchases/:purchaseId/payment-requests` |
| GET | `/payment-requests` |
| GET | `/payment-requests/:paymentId` |
| POST | `/payment-requests` |
| PUT | `/payment-requests/:paymentId` |
| POST | `/payment-requests/:paymentId/expense-proofs` |
| PUT | `/expense-proofs/:proofId` |

Source: `api/src/modules/finance/routes.js`.

## Documents

| Method | Path |
| --- | --- |
| GET | `/documents/test-docx` |
| GET | `/documents/projects/:projectId.docx` |
| GET | `/documents/finance/purchases/:purchaseId/:docType.docx` |
| GET | `/documents/finance/purchases/:purchaseId/:docType/:docId.docx` |
| GET | `/documents/finance/payment-requests/:paymentId.docx` |
| GET | `/documents/finance/payment-requests/:paymentId/expense-proofs/:proofId.docx` |

Source: `api/src/modules/documents/routes.js`.

## Forms / Short Links

| Method | Path | Source |
| --- | --- | --- |
| GET | `/forms` | forms |
| GET | `/forms/:formId` | forms |
| GET | `/public/forms/:formId` | forms |
| GET | `/forms/:formId/responses` | forms |
| GET | `/forms/:formId/statistics` | forms |
| GET | `/forms/responses/:responseId/attachments/:attachmentId` | forms |
| POST | `/forms/:formId/responses` | forms |
| POST | `/public/forms/:formId/responses` | forms |
| GET | `/public/forms/:formId/responses/:responseId` | forms |
| PUT | `/public/forms/:formId/responses/:responseId` | forms |
| POST | `/forms` | forms |
| PUT | `/forms/:formId` | forms |
| DELETE | `/forms/:formId` | forms |
| GET | `/short-links` | shortlinks |
| POST | `/short-links` | shortlinks |
| PUT | `/short-links/:linkId` | shortlinks |
| POST | `/short-links/ensure` | shortlinks |
| GET | `/short-links/:shortCode/resolve` | shortlinks |

Sources: `api/src/modules/forms/routes.js`, `api/src/modules/shortlinks/routes.js`.

## QT

| Method | Path |
| --- | --- |
| GET | `/qt/options` |
| GET | `/qt/dashboard` |
| GET | `/qt/settings` |
| PUT | `/qt/settings` |
| GET | `/qt/inventory` |
| POST | `/qt/inventory/monthly` |
| GET | `/qt/inventory/reservations` |
| GET | `/qt/inventory/reconciliation` |
| POST | `/qt/inventory/reservations` |
| POST | `/qt/inventory/reservations/:reservationId/release` |
| GET | `/qt/orders` |
| GET | `/qt/orders/:orderId` |
| POST | `/qt/orders/:orderId/payment/approve` |
| POST | `/qt/order-items/:orderItemId/fulfill` |
| GET | `/qt/reports/:type` |
| GET | `/qt/notifications/:type/preview` |
| POST | `/qt/notifications/:type/results` |
| GET | `/qt/inventory/movements` |
| POST | `/qt/inventory/movements` |
| POST | `/qt/inventory/transfers` |
| GET | `/qt/stock-check` |

Source: `api/src/modules/qt/routes.js`.

## LINE Bot / LIFF

| Method | Path | Source |
| --- | --- | --- |
| POST | `/linebot/webhook` | webhook |
| GET | `/linebot/dashboard` | linebot |
| GET | `/linebot/users` | linebot |
| GET | `/linebot/channels` | linebot |
| POST | `/linebot/channels` | linebot |
| PUT | `/linebot/channels/:channelId` | linebot |
| GET | `/linebot/channels/:channelId/line-api-readiness` | linebot |
| GET | `/linebot/links` | linebot |
| POST | `/linebot/links` | linebot |
| PUT | `/linebot/links/:linkId` | linebot |
| DELETE | `/linebot/links/:linkId` | linebot |
| GET | `/linebot/modules` | linebot |
| GET | `/linebot/rich-menus` | linebot |
| POST | `/linebot/rich-menus` | linebot |
| PUT | `/linebot/rich-menus/:richMenuId` | linebot |
| PUT | `/linebot/modules/:moduleKey` | linebot |
| GET | `/linebot/events` | linebot |
| GET | `/linebot/config` | linebot |
| PUT | `/linebot/config/:configKey` | linebot |
| GET | `/linebot/notification-templates` | linebot |
| PUT | `/linebot/notification-templates/:templateCode/:channel` | linebot |
| GET | `/linebot/menu-items` | linebot |
| PUT | `/linebot/menu-items/:menuCode` | linebot |
| GET | `/linebot/audit-logs` | linebot |
| GET | `/linebot/binding-requests` | linebot |
| POST | `/linebot/binding-requests/:requestId/approve` | linebot |
| POST | `/linebot/binding-requests/:requestId/reject` | linebot |
| POST | `/linebot/users/:lineUserId/rich-menu/sync` | linebot |
| POST | `/linebot/rich-menus/sync-all` | linebot |
| GET | `/liff` | liff |
| GET | `/liff/config` | liff |
| POST | `/liff/session` | liff |
| GET | `/liff/me` | liff |
| POST | `/liff/bind-member` | liff |
| GET | `/liff/portal-links` | liff |
| GET | `/liff/member-center` | liff |
| GET | `/liff/leader-center` | liff |

Sources: `api/src/modules/linebot/routes.js`, `api/src/modules/linebot/webhook.js`, `api/src/modules/liff/routes.js`.

## Mail

| Method | Path |
| --- | --- |
| POST | `/mail/queue` |
| POST | `/mail/queue/bulk` |
| GET | `/mail/queue/pending` |
| GET | `/mail/queue` |
| GET | `/mail/queue/dashboard` |
| GET | `/mail/queue/quota` |
| GET | `/mail/queue/health` |
| GET | `/mail/queue/stats` |
| GET | `/mail/queue/:id` |
| POST | `/mail/queue/:id/retry` |
| POST | `/mail/queue/:id/cancel` |
| POST | `/mail/queue/:id/resend` |
| PATCH | `/mail/queue/:id/sent` |
| PATCH | `/mail/queue/:id/failed` |
| PATCH | `/mail/queue/:id/skipped` |
| POST | `/mail/quota-snapshots` |

Source: `api/src/modules/mail/routes.js`.

## Other Domain APIs

| Module | Endpoints |
| --- | --- |
| Admin Supply | `GET /admin-supplies/options`, `GET /admin-supplies/items`, `GET /admin-supplies/movements`, `POST /admin-supplies/items`, `PUT /admin-supplies/items/:supplyId`, `POST /admin-supplies/movements` |
| Asset | `GET /assets`, `GET /assets/:assetId`, `POST /assets`, `PUT /assets/:assetId`, `GET /locations`, `POST /locations`, `PUT /locations/:locationId`, `DELETE /locations/:locationId` |
| Attendance | `GET /attendance/options`, `GET /attendance/small-groups`, `GET /attendance/small-groups/:groupId/members`, `GET /attendance/meetings`, `GET /attendance/members/:memberId/recent` |
| Counter | `GET /counter/options`, `GET /counter/pin-codes`, `POST /counter/pin-codes`, `PUT /counter/pin-codes/:pinId`, `PATCH /counter/pin-codes/:pinId/deactivate`, `POST /counter/pin-codes/reset-current-week`, `GET /counter/transactions`, `PATCH /counter/transactions/:transactionId/paid` |
| Development Management | `GET /dev-management/issues`, `POST /dev-management/issues`, `PUT /dev-management/issues/:issueId`, `GET /dev-management/documents`, `GET /dev-management/documents/:documentKey`, `GET /dev-management/releases`, `POST /dev-management/releases` |
| Education | `GET /education/course-categories`, `GET /education/courses`, `GET /education/class-forecast`, `GET /education/courses/:courseId`, `POST /education/courses`, `PUT /education/courses/:courseId` |
| Pastoral | `GET /pastoral/options`, `GET /pastoral/members`, `GET /pastoral/members/duplicate-name`, `GET /pastoral/members/:memberId`, `POST /pastoral/members`, `PUT /pastoral/members/:memberId`, `DELETE /pastoral/members/:memberId` |
| QRCode | `GET /qrcode/options`, `GET /qrcode/events`, `GET /qrcode/events/active`, `GET /qrcode/events/:eventId`, `POST /qrcode/events`, `PUT /qrcode/events/:eventId`, `POST /qrcode/events/:eventId/checkins` |
| Sunday Message | `GET /sunday-messages/options`, `GET /sunday-messages`, `GET /sunday-messages/:messageId`, `POST /sunday-messages`, `PUT /sunday-messages/:messageId`, `PUT /sunday-messages/:messageId/shares`, `DELETE /sunday-messages/:messageId` |
| Venue | `GET /venues/resources`, `PUT /venues/resources/calendar`, `PUT /venues/resources/bookable`, `GET /venues/reservations`, `POST /venues/reservations`, `PATCH /venues/reservations/:reservationId/cancel`, `GET /venues/availability` |
| Workflow | `GET /workflow/definitions`, `POST /workflow/definitions`, `GET /workflow/instances`, `GET /workflow/dashboard`, `GET /workflow/instances/:id`, `POST /workflow/instances`, `POST /workflow/instances/:id/history` |
| Worklog | `GET /work-logs`, `POST /work-logs`, `DELETE /work-logs/:workLogId` |
| Zoom | `GET /zoom/accounts`, `GET /zoom/availability`, `POST /zoom/reservations`, `PATCH /zoom/reservations/:reservationId/cancel` |

