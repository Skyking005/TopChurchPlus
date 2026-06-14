# Regression Smoke Test Checklist

Status: Active checklist
Purpose: Fast checks before demo, release, or after risky changes.

## General

- [ ] `git status --short` reviewed.
- [ ] `git diff --check` passes.
- [ ] `tools\check-scripts.cmd` passes.
- [ ] `tools\check-api.cmd -SkipHealth` passes when API code changed.
- [ ] API health checked against the intended target.
- [ ] Apps Script login works.
- [ ] Classified navigation renders.
- [ ] Role-based feature visibility works.
- [ ] Pin / favorite / recent order still works.
- [ ] Mobile navigation is usable.
- [ ] No secrets or `.env` values are committed.

## Official External Checks

Use official HTTPS endpoints only for external checks:

- [ ] `https://api.topchurchplus.com/health`
- [ ] `https://api.topchurchplus.com/linebot/webhook`

Do not use `59.120.6.172:3000`; external direct port 3000 is intentionally closed.

## Core Modules

### Email Service

- [ ] Dashboard loads even if trigger permission is unavailable.
- [ ] Mail Queue list loads.
- [ ] Status and priority filters work.
- [ ] Retry FAILED mail action is visible.
- [ ] Cancel PENDING mail action is visible.
- [ ] Resend SENT mail action is visible.
- [ ] Quota status is visible or a local error state is shown.

### QT

- [ ] QT dashboard loads.
- [ ] QT settings load.
- [ ] QT order list loads.
- [ ] QT inventory screen loads.
- [ ] Reconciliation screen loads read-only data.
- [ ] No legacy 2026-08 or earlier data is auto-backfilled.
- [ ] Payment / reservation / fulfillment paths are not unintentionally changed.

### Project

- [ ] Project search works.
- [ ] Project list renders on desktop.
- [ ] Mobile project list remains usable.
- [ ] Project detail opens.
- [ ] Project permissions remain visible to authorized roles.
- [ ] Meeting section still renders.

### Forms

- [ ] Form list loads.
- [ ] Form editor opens.
- [ ] Form responses list loads.
- [ ] Form statistics section renders.
- [ ] Public/internal form settings are not changed unintentionally.

### Finance

- [ ] Purchase list loads.
- [ ] Purchase detail opens.
- [ ] Advance modal opens.
- [ ] Expense proof modal opens.
- [ ] Payment modal opens.
- [ ] No payment/approval logic changed unless explicitly in scope.

### Pastoral

- [ ] Pastoral member list loads.
- [ ] Pastoral detail opens.
- [ ] Pastoral edit view is not broken.
- [ ] Pastoral scope remains enforced.

### Attendance

- [ ] Attendance filters load.
- [ ] Attendance records render.
- [ ] Summary cards render.

### Asset

- [ ] Asset search/list loads.
- [ ] Asset detail opens.
- [ ] Mobile list remains usable.

### Reservation / Venue

- [ ] Venue page opens.
- [ ] Calendar modal opens.
- [ ] Reservation modal opens.
- [ ] Resource and reservation lists load.

### System Management

- [ ] System Management opens.
- [ ] Parameters tab loads.
- [ ] ID Rules tab loads.
- [ ] Users tab loads.
- [ ] Role permissions tab loads.
- [ ] Config Key Management tab loads when present.
- [ ] System logs tab loads.

## High-Risk Boundaries

- [ ] LINE Bot webhook still reaches API logs when tested through official HTTPS.
- [ ] LIFF session still works.
- [ ] Pastoral Member mapping still respects Identity Boundary v2.
- [ ] Account role access still controls admin feature visibility.
- [ ] Mail Queue still routes normal mail through queue.
- [ ] Login verification email still uses the approved immediate-send exception.
- [ ] QT payment, fulfillment, and inventory invariants still hold.

## Verification Commands

```powershell
git status --short
git diff --check
tools\check-scripts.cmd
tools\check-api.cmd -SkipHealth
tests\api\run-smoke.cmd
```

When DB is involved:

```text
Use PostgreSQL MCP with topchurchplus_ai_reader in restricted mode.
Run metadata, count, and LIMIT 5 sample queries only.
```

## Smoke Test Result Record

| Area | PASS / FAIL / BLOCKED | Notes |
| --- | --- | --- |
| General |  |  |
| Email Service |  |  |
| QT |  |  |
| Project |  |  |
| Forms |  |  |
| Finance |  |  |
| Pastoral |  |  |
| Attendance |  |  |
| Asset |  |  |
| Venue |  |  |
| System Management |  |  |
| High-risk boundaries |  |  |
