# TopChurchPlus Design System V2

Status: Design System Foundation
Last updated: 2026-06-14
Scope: Design system specification only. This document does not modify production CSS or UI code.

## Purpose

Design System V2 defines the shared visual language for TopChurchPlus admin and member-facing products. It builds on `docs/architecture/UI_DESIGN_SYSTEM_V1.md` and the existing `.tc-*` classes in `Style.html`.

The goal is consistency, maintainability, and lower future implementation cost, not visual decoration.

## Design Principles

1. Bootstrap is the layout and behavior foundation.
2. TopChurchPlus tokens and `.tc-*` components are the visual source of truth.
3. Admin screens prioritize speed, density, and auditability.
4. Member-facing screens prioritize mobile clarity and minimal steps.
5. State colors are semantic, not module branding.
6. Category colors may help orientation but must not replace status colors.
7. Components must include loading, empty, error, and permission states.

## Color System

### System Colors

| Token | Suggested Value | Usage |
| --- | --- | --- |
| `--tcp-primary` | `#2563eb` | Primary actions, active navigation, links. |
| `--tcp-secondary` | `#475467` | Secondary actions, neutral controls. |
| `--tcp-success` | `#16834a` | Completed, approved, active, healthy. |
| `--tcp-warning` | `#b7791f` | Pending, attention, review needed. |
| `--tcp-danger` | `#c2413f` | Error, rejected, destructive, blocked. |
| `--tcp-info` | `#0f6f9f` | Informational, in progress, system note. |
| `--tcp-neutral-0` | `#ffffff` | Surface. |
| `--tcp-neutral-50` | `#f8fafc` | Soft surface. |
| `--tcp-neutral-100` | `#eef2f7` | Page background accents. |
| `--tcp-neutral-300` | `#d9e2ec` | Borders. |
| `--tcp-neutral-600` | `#667085` | Muted text. |
| `--tcp-neutral-900` | `#172033` | Primary text. |

Compatibility note:

V2 token names can map to existing V1 variables such as `--tc-color-primary`, `--tc-color-surface`, and `--tc-color-border` during implementation.

### Module Category Colors

Category colors are for navigation grouping, category chips, and subtle section labels. They must not be used as status colors.

| Category | Token | Suggested Value | Use |
| --- | --- | --- | --- |
| 行政類 | `--tcp-category-admin` | `#2563eb` | Project, forms, finance-adjacent operations. |
| 牧養類 | `--tcp-category-pastoral` | `#16834a` | Pastoral, attendance, education. |
| 資訊類 | `--tcp-category-info` | `#0f6f9f` | Email, integrations, Line technical setup. |
| 媒體類 | `--tcp-category-media` | `#7c3aed` | Sunday message, media, worship. |
| 總務類 | `--tcp-category-general-affairs` | `#b7791f` | Asset, supplies, venue, Zoom. |
| 系統管理類 | `--tcp-category-system` | `#475467` | Users, roles, settings, config keys. |

Use category colors softly:

- Left border.
- Small category chip.
- Section header accent.
- Icon background tint.

Avoid:

- Full-page color themes per module.
- Status meaning based on category color.
- High-saturation backgrounds.

## Typography

| Style | Desktop | Mobile | Usage |
| --- | --- | --- | --- |
| Page Title | 24-28px / 700 | 22-24px / 700 | Module title or major page title. |
| Section Title | 18-20px / 700 | 17-18px / 700 | Card/section heading. |
| Card Title | 16px / 700 | 16px / 700 | KPI card and content card title. |
| Table Header | 13-14px / 700 | 13px / 700 | Table column headers. |
| Table Text | 14px / 400-500 | 14px / 400-500 | Dense data rows. |
| Form Label | 14px / 700 | 14px / 700 | Field labels. |
| Form Text | 14-15px / 400 | 16px / 400 | Inputs; mobile should avoid zoom issues. |
| Helper Text | 12-13px / 400 | 13px / 400 | Descriptions, hints. |

Rules:

- Do not scale font size with viewport width.
- Keep letter spacing at 0.
- Avoid oversized headings inside dashboards, tables, cards, and modals.

## Spacing System

| Token | Value | Usage |
| --- | --- | --- |
| `--tcp-space-1` | 4px | Tiny inline gap. |
| `--tcp-space-2` | 8px | Small control gap. |
| `--tcp-space-3` | 12px | Compact content gap. |
| `--tcp-space-4` | 16px | Card padding, normal gap. |
| `--tcp-space-5` | 20px | Section padding. |
| `--tcp-space-6` | 24px | Page section gap. |
| `--tcp-space-8` | 32px | Large section separation. |

Recommended usage:

- Page Padding: desktop 24px, tablet 20px, mobile 12-16px.
- Section Gap: desktop 16-24px, mobile 12-16px.
- Card Gap: 12-16px.
- Form Gap: 12-16px between fields; 20-24px between groups.
- Mobile Gap: avoid dense two-column controls; stack with 12px gap.

## Shape And Elevation

| Token | Value | Usage |
| --- | --- | --- |
| `--tcp-radius-sm` | 6px | Small controls and badges. |
| `--tcp-radius-md` | 8px | Cards, modals, page sections. |
| `--tcp-radius-lg` | 12px | Large panels only. |
| `--tcp-shadow-sm` | subtle | Cards and page sections. |
| `--tcp-shadow-md` | moderate | Hover or elevated modal-like areas. |

Rules:

- Default card radius should stay 8px or less unless a specific component requires more.
- Avoid decorative nested cards.
- Prefer borders over heavy shadows for admin density.

## Component Families

Design System V2 components are defined in detail in `UI_COMPONENT_STANDARD.md`.

Required common components:

- Navigation category group.
- Page shell.
- Toolbar.
- KPI card.
- Content card.
- Filter area.
- Data table.
- Status badge.
- Form controls.
- Modal.
- Empty state.
- Loading state.
- Error state.
- Permission state.
- Confirmation dialog.

## Admin Surface Rules

- Desktop first for dense operational modules.
- Keep main actions easy to reach.
- Use tables for comparison and bulk scanning.
- Use cards for summaries, dashboards, and mobile alternatives.
- Keep audit-sensitive actions explicit and confirmable.

## Member Surface Rules

- Mobile first.
- Avoid dense tables.
- Avoid internal admin language.
- Keep binding/member identity state visible.
- Keep forms short.
- Use Pastoral Member as formal member identity when mapped.

## Implementation Strategy

Do not replace V1 immediately.

Recommended path:

1. Keep existing V1 classes.
2. Add V2 naming and mapping in docs.
3. Pilot V2 patterns in QT and Email Service.
4. Extract stable CSS into future `css/design-system.css` and `css/topchurchplus-theme.css` only when Apps Script packaging allows.
5. Apply module by module.

## Anti-Patterns

- Raw inline colors for statuses.
- Module-specific badge systems.
- Tables directly under page roots.
- Hidden actions without permission explanation.
- Reusing admin screens as LIFF/member-facing screens.
- New top-level modules without category and user journey.
- Full visual rewrite without workflow benefit.
