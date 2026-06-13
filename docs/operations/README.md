# Operations Documentation

Status: Active
Last updated: 2026-06-13

## Canonical Operations Files

| File | Purpose |
| --- | --- |
| `docs/WORKFLOW.md` | Development and deployment workflow. |
| `docs/TEST_MATRIX.md` | Test and regression matrix. |
| `docs/DISASTER_RECOVERY_REBUILD.md` | Recovery and rebuild guide. |
| `docs/RECOVERY_SECRETS_CHECKLIST.md` | Secret recovery checklist. |
| `docs/DATABASE_MIGRATION_WORKFLOW.md` | Database migration workflow. |
| `docs/LEGACY_MSSQL_SYNC_WORKFLOW.md` | Legacy MSSQL sync workflow. |
| `docs/DOCUMENTATION_MAINTENANCE.md` | Documentation maintenance rules. |

## Deployment Commands

- API syntax check: `tools/check-api.cmd -SkipHealth`
- Apps Script check: `tools/check-scripts.cmd`
- API deploy: `deploy-api.cmd`
- Apps Script deploy: `push-to-google.cmd`

Do not deploy unless the task explicitly requests deployment.

## Smoke Test Target

Use the official external domain for external smoke tests:

```powershell
$env:TOPCHURCHPLUS_API_BASE_URL = 'https://api.topchurchplus.com'
$env:TOPCHURCHPLUS_API_KEY = '<local only, never commit>'
.\tests\api\run-smoke.cmd
```

Do not test `59.120.6.172:3000`; external direct port 3000 is intentionally closed. Use `http://192.168.3.2:3000/health` only for internal NAS container verification.

## Reverse Proxy Troubleshooting Scope

If LINE webhook verification does not reach API logs:

- Check Synology Reverse Proxy / Web Station / Portal rule for `api.topchurchplus.com`.
- Confirm external 443 forwards to the Synology service that owns the reverse proxy.
- Confirm the certificate bound to `api.topchurchplus.com` is correct.
- Confirm external 443 is not landing on DSM 5001 or another service.
- Confirm DNS still resolves to the expected public IP.
