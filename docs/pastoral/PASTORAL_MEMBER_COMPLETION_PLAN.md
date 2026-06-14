# Pastoral Member Completion Plan

Status: Planning Only
Last updated: 2026-06-14

## Principle

Pastoral Member is the only formal member subject.

Not allowed:

```text
Line User = Member
Account = Member
```

Required:

```text
Pastoral Member <-> Line User
```

through explicit mapping.

## What Already Fits

- `pastoral_members` is the primary table for member profile data.
- Pastoral CRUD routes operate on `/pastoral/members/:memberId`.
- Attendance reports join through `pastoral_members.id`.
- Education enrollments join through `education_enrollments.member_id -> pastoral_members.id`.
- LIFF member center resolves `line_users` to `pastoral_members` before returning member data.
- Binding flows update `pastoral_members`, `line_users`, `member_accounts`, and `identity_providers`.
- Pastoral church scope uses `account_pastoral_church_permissions` rather than plain Account Role only.

## What Does Not Fully Fit Yet

| Area | Gap | Risk |
| --- | --- | --- |
| Mapping consistency | `pastoral_members.line_user_id` and `line_users.member_id` can drift if updated separately. | High |
| Binding lifecycle | Unbind, rebind, duplicate resolution, and conflict history are not fully formalized. | High |
| Member duplicate handling | Duplicate-name API exists, but full merge workflow is not established. | Medium |
| Member lifecycle | `is_active` exists, but formal lifecycle states are not clearly defined. | Medium |
| Future provider identity | `identity_providers` exists, but LINE is the only implemented provider path seen in audit. | Medium |
| Audit timeline | Audit logs exist, but member identity changes need a clear member-facing timeline. | Medium |

## Completion Requirements

### P1 Before 8月

1. Mapping consistency report:
   - `pastoral_members.line_user_id`
   - `line_users.member_id`
   - `member_accounts`
   - `identity_providers`
2. Binding conflict review:
   - duplicate member candidates
   - member already bound to another Line User
   - Line User already bound to another member
3. Pastoral profile identity panel:
   - member code
   - Line binding status
   - member account status
   - identity provider status
4. Regression checks:
   - Account cannot be treated as member
   - Line User cannot access member data without mapping
   - Pastoral scope is enforced.

### P2 After Core Stabilization

1. Member merge workflow.
2. Soft-delete / restore / lifecycle states.
3. Member audit timeline.
4. Future provider linking rules.

## Recommended Data Contract

Every pastoral-facing API response should make identities explicit:

```json
{
  "member": {
    "memberId": 123,
    "memberCode": "TOP000001",
    "name": "..."
  },
  "lineUser": {
    "lineUserId": "U...",
    "bound": true
  },
  "account": {
    "operatorStaffId": "..."
  }
}
```

Do not collapse these into a generic `user`.

## Verification Checklist

- [ ] Pastoral Member can exist without Line User.
- [ ] Line User can exist without Pastoral Member.
- [ ] Account can exist without Pastoral Member.
- [ ] Bound Line User resolves to exactly one Pastoral Member.
- [ ] Pastoral Member is not exposed through LIFF unless bound/session-valid.
- [ ] Pastoral scope remains enforced for admin routes.

## Out Of Scope For This Plan

- New schema migration.
- New API implementation.
- Mobile app login implementation.
- Full member merge implementation.
