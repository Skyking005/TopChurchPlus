# Module Documentation

Status: Active
Last updated: 2026-06-13

## Canonical Module References

| File | Purpose |
| --- | --- |
| `docs/MODULES.md` | Module inventory. |
| `docs/API_CATALOG.md` | API and Apps Script helper catalog. |
| `docs/DATABASE_SCHEMA.md` | Database schema inventory. |
| `docs/CURRENT_ARCHITECTURE.md` | Current architecture and integration rules. |

## Module Design Documents

| File | Module |
| --- | --- |
| `docs/architecture/FORM_SYSTEM_EXTENSION_DESIGN.md` | Forms |
| `docs/attendance_rollcall_design.md` | Attendance |
| `docs/asset_management_design.md` | Asset |
| `docs/venue_reservation_design.md` | Venue |
| `docs/MAIL_QUEUE_LEGACY_SEND_EMAIL_AUDIT.md` | Mail Queue |
| `plan/qt/*` | QT planning and phased refactor |

## Identity Boundary Reminder

- LINE User is not the formal member entity.
- Pastoral Member is the formal member entity.
- Pastoral Domain permissions must not depend on backend Account Role.
- LIFF / LINE entrance must not be treated as an administrative session.

## Implementation Reminder

Before editing a module, verify:

- Existing Apps Script page and script partials.
- API routes under `api/src/modules/<module>/`.
- Database schema and migrations.
- Current roadmap and handoff notes.
- Whether the task explicitly allows schema, payment, fulfillment, Line Bot webhook, transfer, or forecast changes.
