# TopChurchPlus Product Design Overview

Status: Product Design Governance V1
Last updated: 2026-06-14
Scope: Product architecture, product design principles, and governance entry point.

## Purpose

This document is the product-design entry point for TopChurchPlus. It explains what the product is, who it serves, how the admin and member-facing surfaces are separated, and how future feature work should begin.

This is not a production implementation file. Before changing code, Codex and developers must still verify actual UI files, API routes, database schema, and architecture documents.

## Product Positioning

TopChurchPlus is an integrated church administration and pastoral operations platform.

It currently combines:

- Internal administration workflows.
- Pastoral member management.
- Project, meeting, finance, asset, venue, and supply operations.
- QT management.
- LINE Bot / LIFF member entry.
- Mail Queue and system operation tools.
- Future education, attendance, baptism, app, and BPM expansion paths.

The product should feel like a modern SaaS dashboard for internal users and a lightweight mobile-first service for members.

## Core Product Goals

1. Reduce administrative workload.
2. Reduce duplicate data entry.
3. Improve data consistency across modules.
4. Support pastoral care and decision-making.
5. Keep Line/LIFF/member-facing flows separated from backend account administration.
6. Create repeatable development patterns for humans and AI agents.
7. Reduce Codex token cost by maintaining clear product, architecture, and design documents.

## Primary Users

| User | Primary Need | Main Surface |
| --- | --- | --- |
| 系統管理者 | Configure users, permissions, settings, keys, queues, and integrations. | Admin system |
| 行政同工 | Manage projects, meetings, forms, venues, events, and records. | Admin system |
| 牧養同工 | Manage members, care records, groups, attendance, and education context. | Admin system |
| 小組長 / 區牧 | Track care, attendance, and member growth within authorized pastoral scope. | Admin system, future LIFF |
| 財務同工 | Manage finance, QT payments, reconciliation, and reports. | Admin system |
| 媒體同工 | Manage message/media/worship-related operations. | Admin system |
| 一般會友 | Use LINE/LIFF for forms, binding, registration, and future services. | LINE / LIFF / App |
| LINE / LIFF 使用者 | Enter member-facing flows through LINE identity. | LIFF / public API |

## Admin Surface vs Member Surface

### Admin Surface

The admin surface is the Google Apps Script Web App. It is for internal workers and administrators.

Current characteristics:

- Role-based feature access.
- Feature grid navigation.
- Apps Script partial-based UI.
- NAS Node.js API backend.
- PostgreSQL persistence.
- Admin features such as System Management, Config Key Management, Email Service, and Dev Management.

Design priority:

- Efficiency.
- Dense but readable information.
- Clear states.
- Auditable actions.
- Strong permission feedback.

### Member Surface

The member surface includes LINE Bot, LIFF, public forms, and future App flows.

Current characteristics:

- LINE user identity can enter the system.
- Pastoral Member is the formal member entity.
- LIFF sessions and binding flows connect entry identity to pastoral identity.

Design priority:

- Mobile first.
- Minimal steps.
- Clear identity and binding state.
- No backend admin-role assumptions.
- Safe handling of member data.

## Identity Boundary

TopChurchPlus must preserve Identity Boundary v2:

- Account Domain: backend admin accounts and role-feature access.
- Pastoral Domain: formal church member identity and pastoral data.
- Line User Domain: LINE identity and LIFF session entry.
- Future Identity Provider Layer: Google Login, Apple Login, Mobile App, OAuth.

Product design rule:

Member-facing features must not treat backend account role as pastoral authority. LINE User is not the member. Pastoral Member is the formal member entity.

## System Classification

Use these product categories for navigation and planning:

| Category | Purpose |
| --- | --- |
| 行政類 | Projects, meetings, forms, finance-adjacent operations, counter, events, QRCode, QT. |
| 牧養類 | Pastoral members, groups, attendance, education, member-facing Line/LIFF flows. |
| 資訊類 | Technical communication services, integrations, queues, developer tools, operational monitoring. |
| 媒體類 | Sunday messages, media, worship, creative/service content operations. |
| 總務類 | Assets, supplies, venues, Zoom/accounts, physical and shared resources. |
| 系統管理類 | Platform settings, permissions, config keys, audit, system-level operations. |

## Product Design Workflow

Every new feature should begin with product design before implementation.

Required sequence:

1. Define the user problem.
2. Identify target users.
3. Identify current pain points.
4. Confirm module category and navigation placement.
5. Confirm Account / Pastoral / Line User / Identity Provider boundary.
6. Confirm data and permission boundary.
7. Draft desired user flow.
8. Define UI states: loading, empty, error, permission denied, success.
9. Define API and schema impact.
10. Confirm out-of-scope items.
11. Define acceptance criteria.

Use `PRODUCT_DESIGN_HANDOFF_TEMPLATE.md` before implementation tasks.
## Governance Rules

- Product design docs guide future UI and module decisions.
- UI changes must follow `docs/architecture/UI_DESIGN_SYSTEM_V1.md`.
- Database-related assumptions must follow AGENTS Database First Principle.
- Identity-sensitive work must check `docs/IDENTITY_BOUNDARY_V2.md`.
- Avoid adding top-level modules until module ownership and user journey are clear.
- Prefer incremental UI rollout over full redesign.
- Do not introduce large frontend frameworks only to improve visual polish.

## Relationship To Existing Documents

| Document | Role |
| --- | --- |
| `PRODUCT_DESIGN_REVIEW.md` | Current product and UX audit findings. |
| `UI_IMPROVEMENT_PLAN.md` | Incremental UI rollout plan. |
| `NAVIGATION_AND_MODULE_CLASSIFICATION.md` | Proposed navigation and module classification. |
| `USER_ROLES_AND_JOURNEYS.md` | Role-based user journeys and pain points. |
| `INFORMATION_ARCHITECTURE.md` | Product IA, navigation hierarchy, and subsystem planning. |
| `UI_DESIGN_PRINCIPLES.md` | UI principles for admin and member-facing surfaces. |
| `FEATURE_PRIORITIZATION_GUIDE.md` | Feature priority rules and roadmap framing. |
| `PRODUCT_DESIGN_HANDOFF_TEMPLATE.md` | Template for new feature design handoff. |
