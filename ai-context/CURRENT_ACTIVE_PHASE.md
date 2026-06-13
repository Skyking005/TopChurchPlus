# TopChurchPlus Current Active Phase

Generated: 2026-06-14
Source Git HEAD: b6a002d
Mode: AI-readable snapshot generated from repository inspection
Max scope: Active phase and next-step guidance only.

## Purpose

This file tells future AI agents what phase the project appears to be in now, based on current source files, docs, plan files, and recent commits.

## Overall Project Phase

Current macro phase:

```text
Phase 2: Core system build-out, data migration readiness, and module hardening.
```

Current engineering focus:

* Reduce AI context loading cost.
* Stabilize governance docs and architecture indexes.
* Continue QT refactor safely.
* Maintain LINE/LIFF and Mail Queue integration boundaries.
* Avoid accidental schema, payment, fulfillment, webhook, or infrastructure changes without explicit task scope.

## Recent Commits

Recent Git evidence:

* `b6a002d Add architecture registry v1`
* `bd99569 Handle mail trigger permission requirements`
* `5a9e900 Add AI development governance indexes`
* `4c934f3 Add email service management UI`
* `6ea4df7 Allow immediate login verification email`
* `a3592cf Extend mail queue management infrastructure`
* `67fc4a5 Add config key management and QT mail updates`
* `a57c8f9 Add UI refresh phase 1 and QT refactor plan`

## Active Planning Files

QT planning files under `plan/qt/`:

* `QT_DOMAIN_REFACTOR_PLAN_V1.md`
* `QT_MIGRATION_PLAN.md`
* `QT_DBA_MIGRATION_REVIEW.md`
* `QT_LEGACY_DATA_MIGRATION_PLAN.md`
* `PHASE_2B_READY_CHECK.md`
* `PHASE_2C_READY_CHECK.md`
* `PHASE_2C_DESIGN_FREEZE.md`
* `PHASE_3A_RECONCILIATION.md`
* `PHASE_3B_SCOPE_FREEZE.md`

These are planning or readiness documents. Verify actual code before implementing from them.

## QT Active Phase

Observed code state:

* Phase 2A inventory foundation exists.
* Phase 2B reservation foundation exists.
* Phase 3B-1 style payment approval to reservation integration appears present.
* Package A same-church fulfillment appears present in `api/src/modules/qt/inventory-service.js`.

Current safe interpretation:

```text
QT Package A: Payment + Reservation + Same Church Fulfillment is present in code.
Cross-church, Line Bot/LIFF selling, transfer, forecast, and legacy backfill remain out of scope.
```

Important QT restrictions:

* Do not process 2026-08 and earlier legacy inventory through the new model.
* Do not auto-backfill the 60 legacy paid-unfulfilled candidates.
* Do not implement cross-church transfer unless explicitly requested.
* Do not modify Line Bot / LIFF ordering unless explicitly requested.
* Do not change payment or fulfillment boundaries unless explicitly requested.

## Mail Active Phase

Mail Queue infrastructure is active:

* `mail_queue`
* `mail_quota_snapshots`
* `/mail/queue*` routes
* Email Service management UI
* Apps Script trigger status safety

Current rule:

```text
Most module email should enqueue through Mail Queue.
Login verification code email is the approved direct-send exception.
```

Do not call `MailApp.sendEmail()` directly for new normal notifications.

## Config Active Phase

Config Key Management MVP is active:

* DB table: `system_config_keys`
* Service: `api/src/shared/config-service.js`
* API: `/system/config-keys`
* Admin UI: System Management / Config Key Management

Known transition:

* Legacy `system_config` remains for compatibility.
* Apps Script Script Properties still hold runtime API base URL and API key.
* Some module constants may still be code-level defaults.

## LINE / LIFF Active Phase

LINE Bot and LIFF have active API modules:

* `/linebot/webhook`
* `/linebot/*` admin routes
* `/liff/*` public-prefixed routes

Critical boundary:

* LINE user must map to Pastoral Member through identity mapping.
* LINE/LIFF must not become an administrative account role shortcut.

External test focus:

* Use official HTTPS domain.
* Do not test `59.120.6.172:3000`.

## Architecture / AI Governance Active Phase

Completed:

* Documentation index.
* Plan index.
* UI/module/architecture/operations README files.
* Architecture Registry v1.

Current task:

* Build AI context snapshots under `ai-context/`.

Expected future usage:

* AI agents read `ai-context/*` first.
* If needed, they then read `docs/architecture/*REGISTRY.md`.
* Only then inspect source files relevant to the task.

## Next Safe Steps

Recommended next work, depending on user request:

1. Add a generator script for `ai-context/*` if recurring snapshot refresh is needed.
2. Update `docs/INDEX.md` to reference `ai-context/*` if user wants these to become canonical onboarding files.
3. Continue QT next phase only with explicit scope.
4. Continue Mail Queue module onboarding one module at a time.
5. Continue ConfigService convergence one namespace at a time.

## Do Not Do Without Explicit Request

* Deploy.
* Run migrations.
* Modify schema.
* Modify payment/fulfillment/transfer/forecast.
* Modify LINE webhook behavior.
* Modify production config, DNS, GoDaddy, firewall, or Synology settings.
* Rewrite large files.

