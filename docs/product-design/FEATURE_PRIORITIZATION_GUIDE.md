# TopChurchPlus Feature Prioritization Guide

Status: Product Design Governance V1
Last updated: 2026-06-14
Scope: Product design prioritization rules for future feature planning.

## Purpose

This guide helps product owners, developers, and AI agents decide what to build first and what to delay.

The goal is not to build the most features. The goal is to build the right features in an order that reduces administrative cost, protects data boundaries, and keeps TopChurchPlus maintainable.

## Priority Model

Use four levels:

1. Must Have
2. Should Have
3. Could Have
4. Won't Do Now

## Decision Criteria

Score a feature by asking:

- Does it reduce administrative cost?
- Does it reduce Codex token consumption by making future work clearer?
- Does it reduce duplicate operations?
- Does it improve data consistency?
- Does it support pastoral decision-making?
- Does it respect Identity Boundary v2?
- Does it avoid over-customization?
- Does it reuse existing modules, APIs, and design patterns?
- Does it have clear acceptance criteria?
- Does it have manageable operational risk?

## Must Have

Features belong here when they are required for safe operation, data consistency, identity boundary protection, or core workflows.

Examples:

- Identity Boundary-safe member mapping.
- Centralized configuration and secret masking.
- Mail Queue quota and retry management.
- Payment and inventory auditability.
- Categorized navigation once module count becomes high.
- Permission feedback for restricted actions.
- UI states for loading, empty, error, and readonly.

Build rules:

- Define data boundary first.
- Define permission boundary first.
- Verify actual schema/API.
- Keep changes scoped.
- Update docs.

## Should Have

Features belong here when they improve efficiency or reduce future support cost but are not required for immediate safe operation.

Examples:

- Role-specific dashboards.
- Cross-module contextual links.
- Standardized table/card mobile behavior.
- Status badge standardization across modules.
- Report export polish.
- Module-level onboarding hints.

Build rules:

- Implement after the core workflow is stable.
- Prefer module-by-module rollout.
- Avoid coupling unrelated modules.

## Could Have

Features belong here when they are useful but not necessary for near-term operations.

Examples:

- Advanced visual polish.
- Animation and micro-interactions.
- Global command palette.
- Highly customized dashboard widgets.
- Optional theme variants.

Build rules:

- Do not start before core UX and data governance are stable.
- Do not introduce new dependencies unless there is a clear reason.

## Won't Do Now

Features belong here when they are risky, premature, or likely to increase maintenance cost.

Examples:

- Full React/Vue/Tailwind rewrite only for visual reasons.
- Large UI redesign without module-by-module validation.
- New top-level modules without ownership and data boundary.
- Member-facing flows that depend on backend account role.
- Automatic legacy backfill when data quality is uncertain.
- Direct MailApp bulk sending outside Mail Queue.

## Product Design Quick Wins: 1-2 Weeks

1. Create categorized feature menu.
2. Separate active modules and coming-soon modules.
3. Create status badge mapping.
4. Identify two Design System pilot modules.
5. Add permission/readonly state copy rules.

## Mid-Term Improvements: 1-3 Months

1. Roll out `.tc-page` shell to high-traffic modules.
2. Standardize tables, forms, modals, and empty/error states.
3. Add role-based landing views for admin, pastoral, finance, and system management.
4. Create Pastoral Member-centered cross-links.
5. Split Line App management into member-facing operation and technical setup sections.

## Long-Term Vision: 6-12 Months

1. Build clear admin and member-facing product surfaces.
2. Formalize App/LIFF information architecture.
3. Create a Pastoral Member profile hub.
4. Establish BPM as a platform workflow layer.
5. Evaluate service boundaries for Mail Queue, Line/LIFF, and QT only after workflows stabilize.

## Technical Debt Impact

### Development Cost

Flat navigation and inconsistent UI patterns require Codex and developers to inspect more files per task. This increases implementation time and token use.

### Maintenance Cost

Duplicate badge systems, module-specific layouts, and inconsistent empty/error states make fixes harder to apply globally.

### Codex Token Cost

When product logic is not summarized by product-design docs, Codex must repeatedly scan:

- Feature config.
- UI partials.
- API routes.
- Database schema.
- Identity documents.
- Plan documents.

Maintaining this guide and related product-design files reduces repeated context loading.

### Data Consistency Cost

Features that cross Pastoral, Line, Finance, QT, Forms, and Attendance can create data inconsistency if product boundaries are not confirmed first.

## Prioritization Checklist

Before a feature enters implementation:

- User problem is defined.
- Target users are defined.
- Module category is defined.
- Data boundary is defined.
- Permission boundary is defined.
- Identity Boundary impact is checked.
- UI states are listed.
- API impact is listed.
- Schema impact is listed.
- Out-of-scope items are listed.
- Acceptance criteria are testable.
