# Feature Development Intake Template

Status: Active template
Purpose: Use this before starting any new TopChurchPlus feature or meaningful change.

Do not skip this template for fast demo work. If a field is unknown, write `Unknown` and decide whether the risk is acceptable before coding.

## 1. Request

| Field | Value |
| --- | --- |
| Feature Key |  |
| Request Summary |  |
| Target User Role |  |
| User Problem |  |
| Desired User Flow |  |
| Demo Scenario |  |
| Out of Scope |  |

## 2. Product And UX Context

| Field | Value |
| --- | --- |
| Navigation Category |  |
| Product Design Reference |  |
| UI Surface | Admin / LIFF / LINE / Public Form / Unknown |
| Mobile Requirement |  |
| Loading / Empty / Error States |  |
| Accessibility Notes |  |

## 3. Impact Summary

| Area | Impact |
| --- | --- |
| Affected Modules |  |
| Affected Files |  |
| API Impact | None / Add / Modify / Unknown |
| DB / Schema Impact | None / Migration / MCP verification required / Unknown |
| Permission Impact | None / Feature key / Role access / Pastoral scope / Unknown |
| Identity Boundary Impact | Account / Pastoral Member / Line User / LIFF mapping / None / Unknown |
| UI Impact | None / Shell only / Component / New page / Navigation / Unknown |
| Email / Notification Impact | None / Mail Queue / Immediate verification email / Unknown |
| External Integration Impact | LINE / LIFF / Apps Script / NAS / GoDaddy / Synology / None / Unknown |

## 4. Boundary Checks

- Does this feature involve Account Domain?
- Does this feature involve Pastoral Member?
- Does this feature involve Line User or LIFF session?
- Does this feature rely on `accounts.role` for pastoral data access? If yes, stop and redesign.
- Does this feature expose public or member-facing data?
- Does this feature touch payment, fulfillment, QT inventory, Line webhook, transfer, or forecast?
- Does this feature require PostgreSQL MCP schema verification?

## 5. Acceptance Criteria

1.
2.
3.

## 6. Regression Risk

| Risk | Notes |
| --- | --- |
| Existing workflow risk |  |
| Data consistency risk |  |
| Permission regression risk |  |
| Mobile regression risk |  |
| Rollback risk |  |

## 7. Required Verification Commands

Minimum:

```powershell
git status --short
git diff --check
tools\check-scripts.cmd
```

When API is touched:

```powershell
tools\check-api.cmd -SkipHealth
```

When DB/schema/data assumptions are involved:

```text
Use PostgreSQL MCP in restricted mode with topchurchplus_ai_reader.
Record queried tables, query type, and schema-doc mismatch status.
```

When release or demo confidence is needed:

```powershell
tests\api\run-smoke.cmd
```

## 8. Completion Report Template

- Modified files:
- Verification:
- API impact:
- DB impact:
- Permission impact:
- Identity Boundary impact:
- Business logic impact:
- Risk notes:
- Deployment status:
