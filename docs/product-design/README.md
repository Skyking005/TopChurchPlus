# TopChurchPlus Product Design Documentation

Status: Active
Last updated: 2026-06-14

This folder is the product design governance entry point for TopChurchPlus.

Read these documents before major UI, navigation, module, member-facing, or workflow changes.

## Start Here

| File | Purpose |
| --- | --- |
| `PRODUCT_DESIGN_OVERVIEW.md` | Product positioning, user surfaces, identity boundary, and design workflow. |
| `PRODUCT_DESIGN_REVIEW.md` | Current product architecture, UX, UI consistency, domain boundary, and scalability review. |
| `NAVIGATION_ARCHITECTURE_V2.md` | Formal Navigation Architecture V2 for categories, main nav, sub-nav, and responsive navigation. |
| `DESIGN_SYSTEM_V2.md` | Shared Design System V2 tokens, color system, typography, spacing, and design rules. |
| `UI_COMPONENT_STANDARD.md` | Component standards for page shell, buttons, badges, tables, forms, modals, states, and permissions. |
| `UI_ROLLOUT_STRATEGY.md` | Design System rollout sequence and QT / Email Service pilot strategy. |
| `IDENTITY_BOUNDARY_UI_REVIEW.md` | UI and navigation review for Account, Pastoral, Line User, and future identity provider boundaries. |
| `INFORMATION_ARCHITECTURE.md` | Product IA, navigation hierarchy, subsystem planning, and future expansion. |
| `NAVIGATION_AND_MODULE_CLASSIFICATION.md` | Module category table and navigation recommendations. |
| `USER_ROLES_AND_JOURNEYS.md` | Role-based tasks, pain points, and related modules. |
| `UI_DESIGN_PRINCIPLES.md` | Admin and member-facing design principles and UI states. |
| `UI_IMPROVEMENT_PLAN.md` | Incremental UI improvement roadmap. |
| `FEATURE_PRIORITIZATION_GUIDE.md` | Must/Should/Could/Won't Do prioritization rules. |
| `PRODUCT_DESIGN_HANDOFF_TEMPLATE.md` | Feature design handoff template before implementation. |

## Governance Rule

Before building or redesigning a feature, clarify:

1. User problem.
2. Target users.
3. Module category.
4. Desired user flow.
5. Data boundary.
6. Permission boundary.
7. Identity Boundary impact.
8. UI states.
9. API/schema impact.
10. Acceptance criteria.

Use `PRODUCT_DESIGN_HANDOFF_TEMPLATE.md` for new feature tasks.

## V2 Implementation Gate

Before implementing navigation or UI foundation changes, read these in order:

1. `NAVIGATION_ARCHITECTURE_V2.md`
2. `DESIGN_SYSTEM_V2.md`
3. `UI_COMPONENT_STANDARD.md`
4. `UI_ROLLOUT_STRATEGY.md`
5. `IDENTITY_BOUNDARY_UI_REVIEW.md`
