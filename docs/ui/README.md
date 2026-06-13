# UI Documentation

Status: Active
Last updated: 2026-06-13

## Canonical UI Standard

- `docs/architecture/UI_DESIGN_SYSTEM_V1.md`

All UI work for Apps Script modules should follow this design system before adding new components or visual patterns.

## Related Reports

- `UI_REFRESH_PHASE1_REPORT.md`: completed Phase 1 UI refresh report.

## UI Governance

- Bootstrap is the layout foundation; TopChurchPlus theme and design tokens define the final visual style.
- Use Tabler Icons as the official icon library.
- Do not create module-specific visual standards without updating the design system first.
- New pages should use the page layout model: page header, toolbar/filter area, KPI area when needed, content area, and action area.
- Include loading, empty, error, validation, and mobile states.

## Needs Review

- Some existing Apps Script pages predate the design system and may still use older Bootstrap-only patterns.
- Future cleanup should move UI reports into `docs/ui/` or an archive after approval.
