# Demo / Release Readiness Checklist

Status: Active checklist
Purpose: Decide whether TopChurchPlus is safe to demo or release.

## Demo Readiness

### Demo Path

- [ ] Login.
- [ ] Classified Navigation.
- [ ] Dashboard / pinned / recent functions.
- [ ] Project Management.
- [ ] Email Service Management.
- [ ] QT Management.
- [ ] Forms.
- [ ] Finance.
- [ ] Pastoral.
- [ ] Attendance.
- [ ] Asset.
- [ ] Venue / Reservation.
- [ ] System Management.

### Demo Roles

- [ ] System administrator.
- [ ] Administrative staff.
- [ ] Pastoral staff.
- [ ] Finance staff.
- [ ] General affairs staff.
- [ ] LINE / LIFF user if member-facing demo is included.

### Demo Accounts

Record demo accounts outside Git. Do not commit credentials.

| Role | Account prepared | Notes |
| --- | --- | --- |
| System administrator |  |  |
| Administrative staff |  |  |
| Pastoral staff |  |  |
| Finance staff |  |  |
| General affairs staff |  |  |
| LINE / LIFF user |  |  |

### Demo Data Preparation

- [ ] Project sample data.
- [ ] Meeting sample data.
- [ ] Form sample data and responses.
- [ ] Email queue sample data.
- [ ] QT sample data for 2026-09 or later only.
- [ ] Pastoral sample data with correct scope.
- [ ] Attendance sample data.
- [ ] Asset sample data.
- [ ] Venue sample reservations.
- [ ] System settings sample data.

### Mobile Check

- [ ] Login usable on phone width.
- [ ] Classified navigation usable on phone width.
- [ ] Project list mobile view usable.
- [ ] Forms usable enough for demo.
- [ ] LIFF screens checked if included.
- [ ] No text overlap on primary demo path.

### Fallback Plan

- [ ] Screenshots prepared for high-risk external integrations.
- [ ] LINE Bot fallback explanation prepared.
- [ ] NAS/API fallback explanation prepared.
- [ ] Offline demo data route prepared.
- [ ] Known issues list ready.

## Release Readiness

- [ ] API health passes.
- [ ] Apps Script deployment status confirmed.
- [ ] NAS deployment status confirmed.
- [ ] DB migration status confirmed.
- [ ] Mail Queue status confirmed.
- [ ] MailApp quota and trigger status confirmed.
- [ ] LINE Bot webhook status confirmed.
- [ ] LIFF status confirmed.
- [ ] Feature permission status confirmed.
- [ ] Production config checked through approved channels.
- [ ] Reverse proxy / SSL / DNS status confirmed when external flows are included.
- [ ] Rollback notes prepared.
- [ ] Backup / restore path confirmed for DB-impacting release.
- [ ] `docs/HANDOFF.md` updated if release changes current state.
- [ ] `docs/API_CATALOG.md` and `docs/DATABASE_SCHEMA.md` updated if affected.

## No-Go Criteria

Do not demo if:

- Login is broken.
- Classified Navigation does not render.
- Demo role cannot access required modules.
- API health is down for the intended target.
- Demo data is missing for the selected path.
- Pastoral data is visible outside intended scope.
- LINE/LIFF member identity is misrepresented.
- A high-risk flow is partially changed and unverified.

Do not release if:

- `git diff --check` fails.
- `tools\check-scripts.cmd` fails.
- API checks fail after API changes.
- Required migration was not reviewed.
- PostgreSQL MCP verification was skipped for DB-impacting work.
- Secrets, `.env`, database URI, tokens, or API keys are staged.
- Rollback plan is missing for DB/API/identity/payment changes.
- LINE webhook, LIFF, QT payment, QT fulfillment, or finance payment was changed without explicit scope and verification.

## Release Decision Record

| Item | Result |
| --- | --- |
| Demo ready | Yes / No |
| Release ready | Yes / No |
| Blockers |  |
| Accepted risks |  |
| Rollback owner |  |
| Final approver |  |
