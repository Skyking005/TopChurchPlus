# Impact Assessment Checklist

Status: Active checklist
Purpose: Run this before modifying TopChurchPlus code, API, data, UI, or workflows.

## API Impact

- [ ] Does the change add a new endpoint?
- [ ] Does the change modify an existing endpoint?
- [ ] Does it change request payload shape?
- [ ] Does it change response payload shape?
- [ ] Does it change error behavior or status codes?
- [ ] Does it affect Apps Script bridge helpers or `google.script.run` callers?
- [ ] Does it affect a public endpoint?
- [ ] Does it affect LINE Bot webhook?
- [ ] Does it affect LIFF routes or session handling?
- [ ] Does it affect Email Queue or MailApp delivery?
- [ ] Does it require updating `docs/API_CATALOG.md`?

## DB Impact

- [ ] Does the change require PostgreSQL MCP verification?
- [ ] Does it require a migration?
- [ ] Does it modify schema?
- [ ] Does it add a table?
- [ ] Does it alter a table?
- [ ] Does it add or change a constraint?
- [ ] Does it add or change an index?
- [ ] Does it affect legacy MSSQL import or sync?
- [ ] Does it affect QT 2026-09 cutover boundaries?
- [ ] Does it require backfill or data repair?
- [ ] Does it require rollback SQL?
- [ ] Does it require updating `docs/DATABASE_SCHEMA.md` or database registries?

## UI Impact

- [ ] Does the change add a page?
- [ ] Does it modify navigation?
- [ ] Does it change classified navigation categories?
- [ ] Does it modify a shared component?
- [ ] Does it need `.tc-*` UI Foundation classes?
- [ ] Does it affect mobile layout?
- [ ] Does it add loading state?
- [ ] Does it add empty state?
- [ ] Does it add error state?
- [ ] Does it affect modal behavior?
- [ ] Does it need product-design documentation updates?

## Permission Impact

- [ ] Does the change add a feature key?
- [ ] Does it modify `SYSTEM_FEATURES`?
- [ ] Does it modify `ROLE_FEATURE_ACCESS`?
- [ ] Does it modify `MAIN_VIEW_IDS`?
- [ ] Does it affect admin-only behavior?
- [ ] Does it affect super-admin-only behavior?
- [ ] Does it affect pastoral scope?
- [ ] Does it rely on front-end hiding only? If yes, stop and add backend checks.
- [ ] Does it require updating permission docs?

## Identity Boundary Impact

- [ ] Does it involve Account?
- [ ] Does it involve Pastoral Member?
- [ ] Does it involve Line User?
- [ ] Does it involve LIFF mapping?
- [ ] Does it involve member binding?
- [ ] Does it involve future OAuth / App identity?
- [ ] Does it incorrectly treat LINE User as a formal member?
- [ ] Does it incorrectly use Account Role as pastoral data authority?
- [ ] Does it need `docs/IDENTITY_BOUNDARY_V2.md` or product-design boundary review updates?

## High-Risk Guardrails

Stop and request explicit confirmation before touching:

- QT payment flow
- QT fulfillment / pickup flow
- QT inventory transaction logic
- Line Bot webhook
- LIFF identity mapping
- Pastoral permission scope
- Finance approval / payment logic
- Transfer / cross-church movement
- Forecast logic
- Production config, DNS, GoDaddy, firewall, Synology routing

## Required Output After Assessment

Report:

- API impact: None / Low / Medium / High
- DB impact: None / Low / Medium / High
- UI impact: None / Low / Medium / High
- Permission impact: None / Low / Medium / High
- Identity Boundary impact: None / Low / Medium / High
- MCP used: yes/no
- Risk level: LOW / MEDIUM / HIGH
- Next action:
