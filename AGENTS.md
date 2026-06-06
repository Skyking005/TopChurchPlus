# Project Agent Instructions

## Encoding

- Treat all text files in this project as UTF-8.
- This project contains Traditional Chinese labels, field names, statuses, Google Apps Script strings, HTML snippets, SQL seed values, and JSON data. Preserve existing Chinese text exactly unless the task explicitly asks to rename it.
- Before editing a file, check whether the relevant area already contains mojibake or garbled text, such as repeated replacement marks, unreadable mixed symbols, or broken text where Traditional Chinese should appear.
- If mojibake is found, stop and report it before making functional edits. Do not continue compiling, formatting, or rewriting the affected file as if the garbled text were valid source.
- Do not use PowerShell `Get-Content` / `Set-Content` or broad rewrite commands to rewrite Chinese files. Prefer `apply_patch` for focused edits.
- Do not batch-format the whole project unless explicitly requested.
- When sending API requests that contain Traditional Chinese JSON from PowerShell, do not use raw `Invoke-RestMethod -Body $json`. Use `tools/invoke-json-utf8.cmd` or .NET `HttpClient` with explicit `application/json; charset=utf-8` so demo/test data is not saved as mojibake such as `????`.
- After any manual API write containing Chinese text, read the saved row back and confirm the Chinese text is readable before leaving demo data in the database.

## Editing Scope

- Keep changes narrowly scoped to the current task.
- Do not modify unrelated modules while working on a feature branch.
- Avoid renaming existing Chinese object keys, sheet headers, API payload keys, or status values unless a coordinated migration plan exists.
- For Apps Script files and HTML partials, preserve the existing `google.script.run` flow unless the task is specifically about migration.

## Branch And Task Discipline

- Use `codex/task-dispatch-base` as the stable baseline for task-specific branches unless instructed otherwise.
- Use one task branch per conversation or workstream.
- Suggested branch naming:
  - `codex/finance-system`
  - `codex/forms-module`
  - `codex/line-bot-bridge`
  - `codex/member-files`
  - `codex/database-core`
- This conversation/workstream should only touch files related to its assigned task.

## Database Safety

- Do not make database schema changes from multiple feature branches at the same time.
- Treat `database/schema.sql`, migration scripts, seed/import scripts, and database structure changes as owned by a single database-focused branch, preferably `codex/database-core`.
- If a feature branch needs a schema change, document the required table/column/index first and stop for confirmation before editing database files.
- Do not point multiple experimental branches at the same production database.

## Deployment And Domains

- `topchurchplus.com` currently forwards to the Google Apps Script web app.
- Do not change GoDaddy DNS, domain forwarding, production Apps Script deployment URLs, LINE webhook URLs, or production environment variables without explicit confirmation.
- Prefer low-risk staging or test configuration changes before production changes.

## Verification

- After editing, run the smallest relevant validation available.
- If tests or commands cannot run because tooling is missing, report that clearly.
- When checking files with Chinese content, verify that the edited area still displays readable Traditional Chinese.
