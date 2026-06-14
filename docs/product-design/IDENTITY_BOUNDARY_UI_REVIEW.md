# TopChurchPlus Identity Boundary UI Review

Status: Product Design Governance
Last updated: 2026-06-14
Scope: UI and product-flow review based on Identity Boundary v2. This document does not change production code, schema, API, or permissions.

## Purpose

This document translates `docs/IDENTITY_BOUNDARY_V2.md` into UI and navigation guidance.

TopChurchPlus has three active identity contexts and one future layer:

1. Account Domain.
2. Pastoral Domain.
3. Line User Domain.
4. Future Identity Provider Layer.

The UI must keep these contexts clear so future features do not accidentally couple backend accounts, pastoral members, and LINE identities.

## Domain Definitions

### Account Domain

Represents backend/internal users.

Examples:

- `accounts`
- `account_roles`
- `role_feature_permissions`
- Admin sessions
- System usage logs

UI surfaces:

- System Management.
- User Management.
- Role/Feature Permissions.
- Config Key Management.
- Email Service Management.
- Dev Management.

UI rule:

Account role can decide internal feature access. It must not decide pastoral member scope by itself.

### Pastoral Domain

Represents the formal church member identity and pastoral structure.

Examples:

- `pastoral_members`
- `pastoral_groups`
- pastoral care records
- pastoral permissions and group scope

UI surfaces:

- Pastoral.
- Attendance.
- Education.
- Care Tracking.
- Member-related forms.
- Future Baptism.

UI rule:

Pastoral Member is the formal member entity. Member-facing data should map to Pastoral Member explicitly.

### Line User Domain

Represents LINE identity and LIFF entry sessions.

Examples:

- `line_users`
- `line_liff_sessions`
- binding requests
- Rich Menu interactions
- webhook events

UI surfaces:

- Line App member management.
- LIFF.
- Line Bot.
- Member binding.
- Portal links.

UI rule:

LINE User is an entry identity, not the formal member entity.

### Future Identity Provider Layer

Represents future login providers and app identity.

Examples:

- Google Login.
- Apple Login.
- Mobile App identity.
- OAuth providers.

UI rule:

Provider identity should map to Account or Pastoral Member through explicit linking. It must not automatically imply pastoral authority or internal system access.

## UI Flows With Boundary Risk

| UI Flow | Boundary Risk | Risk Level | Recommended UI Guardrail |
| --- | --- | --- | --- |
| Line member binding | LINE User may be mistaken for Pastoral Member. | High | Show binding state and mapped Pastoral Member separately. |
| LIFF forms | Respondent may be treated as member without mapping. | High | Require explicit member mapping or guest state. |
| Pastoral member profile | Admin account role may be confused with pastoral scope. | Medium | Use pastoral scope language, not account role labels. |
| QRCode check-in | QR scan identity may be Line User, event attendee, or Pastoral Member. | Medium | Display identity source and mapping state. |
| Attendance reports | Attendance rows should map to Pastoral Member. | Medium | Avoid showing raw Line identity as member. |
| Education enrollments | Course progress should map to Pastoral Member. | Medium | Use member code/name from Pastoral Domain. |
| QT order/member link | Order buyer, payer, pickup person, and member may differ. | Medium | Label each role clearly; avoid implicit member assignment. |
| Counter operations | PIN/operator/account and customer/member can be confused. | Medium | Separate operator identity from service recipient identity. |
| System permissions | Admin roles may be over-applied to pastoral access. | High | Keep role-feature permission separate from pastoral scope. |
| Future App login | OAuth account may be treated as member identity. | High | Add explicit provider-to-member linking. |

## Modules Aligned With Boundary

| Module | Alignment |
| --- | --- |
| System Management | Account Domain. |
| Email Service | Account/Infrastructure Domain. |
| Dev Management | Internal Account/Developer tooling. |
| Asset / Admin Supply / Venue / Zoom | Operational resource domains with low identity complexity. |
| Mail Queue | Infrastructure; should not infer member identity. |

## Modules Requiring Ongoing Review

| Module | Reason |
| --- | --- |
| Pastoral | Core Pastoral Domain. Any permission change must avoid account-role coupling. |
| Line App / LIFF | Crosses Line User and Pastoral Member. |
| Forms | Can collect admin, public, and member-facing data. |
| Attendance | Must map correctly to Pastoral Member and pastoral scope. |
| Education | Member progress records need Pastoral Member consistency. |
| QT | Crosses member, payment, pickup, Line/LIFF future order flow, and finance. |
| Counter | Operator identity and recipient/member identity must remain separate. |
| QRCode | Check-in identity source must be explicit. |
| BPM | Approval roles and business entity ownership must be explicit. |

## UI Copy Standards

Use these terms consistently:

| Concept | Preferred UI Copy | Avoid |
| --- | --- | --- |
| Backend user | 系統帳號 / 操作者 | 會友, member |
| Formal member | 會友 / Pastoral Member / 會友編號 | LINE 使用者 |
| LINE identity | LINE 使用者 / LINE 身份 | 正式會友 |
| Binding state | 未綁定 / 申請中 / 已綁定 / 已退回 | 帳號已建立 without context |
| Pastoral permission | 牧養範圍 / 可查看牧區 | 系統角色 grants pastoral access |

## Required UI States For Identity-Sensitive Screens

### Unbound LINE User

Show:

- LINE identity exists.
- No Pastoral Member mapping yet.
- Next step to request binding or contact staff.

### Pending Binding

Show:

- Request status.
- Submitted data.
- Who can approve, if appropriate.
- No member-only actions until approval.

### Bound Member

Show:

- Pastoral Member name/code.
- Bound LINE identity.
- Allowed portal links.

### Permission Limited

Show:

- Which scope is missing.
- Whether the limitation is account access, pastoral scope, or configuration.

## Future Identity Provider Preparation

Before adding Google Login, Apple Login, Mobile App login, or OAuth:

1. Define provider identity record.
2. Define mapping target: Account or Pastoral Member.
3. Define whether user can self-link.
4. Define approval/review flow.
5. Define unlink/relink flow.
6. Define audit log requirements.
7. Define UI states for unlinked, linked, conflict, expired, revoked.

## Product Design Checklist

For any member-facing or identity-related UI change:

- Does this flow involve Account Domain?
- Does this flow involve Pastoral Domain?
- Does this flow involve Line User Domain?
- Which identity is shown to the user?
- Which identity is the source of truth?
- Is binding/mapping explicit?
- Is pastoral scope separate from account role?
- Are error messages clear when mapping is missing?
- Are sensitive values hidden?
- Is audit required?

## Recommendations

### Quick Wins

- Add standard identity state labels for Line/LIFF binding.
- Add UI copy guidance to Line App and Pastoral future tasks.
- Separate Line technical setup from member operations in navigation.

### Mid-Term

- Build Pastoral Member as cross-module identity hub.
- Add consistent member mapping widgets for Forms, QRCode, Attendance, Education, and QT.
- Define provider identity model before App login.

### Long-Term

- Establish Identity Provider Layer as a formal product and architecture boundary.
- Design member portal/App around Pastoral Member mapping, not backend account sessions.
