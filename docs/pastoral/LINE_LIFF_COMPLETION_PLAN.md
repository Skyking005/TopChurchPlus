# Line User And LIFF Completion Plan

Status: Planning Only
Last updated: 2026-06-14

## Standard Flow

```text
Line User
  -> LIFF Session
  -> Binding
  -> Pastoral Member
  -> Member Center
```

LINE User is an entry identity. Pastoral Member is the formal member subject.

## Current State

### Line User

Implemented foundations:

- LINE webhook receives events.
- `line_users` is updated by webhook and LIFF session creation.
- Admin UI lists LINE users and binding status.
- Rich Menu configuration and sync APIs exist.
- Binding request review APIs exist:
  - list
  - approve
  - reject

### LIFF Session

Implemented foundations:

- `/liff/config`
- `/liff/session`
- `/liff/me`
- token hashing in `line_liff_sessions`
- LIFF request/session security helpers
- HTTPS/origin/session binding configuration

### Member Center

Implemented foundations:

- `/liff/member-center` requires bound Pastoral Member.
- `/liff/portal-links` returns public/member links based on binding status.
- `/liff/leader-center` checks leader scope from Pastoral Member title/group relations.
- Leader center reads `attendance_summary` and `course_summary`.

## What Is Complete

- LINE identity is not treated as the formal member.
- Binding can auto-match by name/mobile or create a pending review request.
- Binding writes to `pastoral_members`, `line_users`, `member_accounts`, and `identity_providers`.
- Member Center requires a valid LIFF session and a resolved Pastoral Member.

## What Is Not Complete

| Area | Gap | Risk |
| --- | --- | --- |
| Binding lifecycle | No fully documented unbind/rebind process. | High |
| Mapping consistency | Multiple mapping tables can drift. | High |
| Duplicate resolution | Pending review exists, but operational workflow needs completion. | High |
| Future providers | `identity_providers` exists but Google/Apple/App flows are not implemented. | Medium |
| Member Center content | Basic center exists; pastoral, attendance, education depth is limited. | Medium |
| Summary freshness | Leader center depends on summary tables with unclear refresh process. | Medium |

## Completion Requirements

### P1 Before 8月

1. Binding review workflow:
   - identify duplicate candidates
   - approve/reject with audit trail
   - expose conflict reasons clearly
2. Mapping consistency report:
   - `line_users.member_id`
   - `pastoral_members.line_user_id`
   - `member_accounts.login_identifier`
   - `identity_providers`
3. Member Center minimum:
   - member identity card
   - attendance summary
   - education summary
   - available links/menu items
4. LIFF smoke tests:
   - unbound user
   - successful bind
   - pending review
   - bound member center
   - leader center access denied/granted.

### P2 Later

1. Unbind/rebind UI.
2. Device/session management.
3. Member profile correction request.
4. OAuth provider-agnostic member login.
5. Mobile app identity provider integration.

## Identity Boundary Rules

- LINE User may create a session.
- LINE User may request binding.
- LINE User may not be treated as member before binding.
- Pastoral Member owns formal member data.
- Account owns admin/operator actions only.
- Member-facing APIs should return both `lineUser` and `member` explicitly.

## Future App Readiness

Current status: medium readiness.

Ready:

- `identity_providers` table shape supports additional providers.
- `member_accounts` separates member-facing account bridge from admin `accounts`.
- LIFF session pattern can inform future app sessions.

Needs work:

- Provider abstraction endpoints.
- Consent and revocation.
- App session/device model.
- Versioned member-facing API contract.

## Verification Checklist

- [ ] Unbound LINE user sees public/member-binding flow only.
- [ ] Bound LINE user resolves to exactly one Pastoral Member.
- [ ] Admin binding approval writes all mapping surfaces consistently.
- [ ] LIFF Member Center rejects unbound sessions.
- [ ] Leader Center only opens for member with pastoral leader scope.
- [ ] No member data is fetched directly by Line User without resolving Pastoral Member.
