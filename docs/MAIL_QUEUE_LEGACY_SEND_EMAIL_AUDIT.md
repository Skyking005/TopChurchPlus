# Mail Queue Legacy SendEmail Audit

Last updated: 2026-06-13

## Summary

`rg` scan target:

- `MailApp.sendEmail`
- `GmailApp.sendEmail`
- `enqueueMail`
- `enqueueMails`

## Already Using MailQueueService / Queue

- `程式碼.gs` `sendLoginVerificationEmail()`
  - Module: Auth
  - Status: already enqueues `auth.login_verification`

- `程式碼.gs` `sendPublicFormEditLinkEmail_()`
  - Module: Forms
  - Status: already enqueues `forms.public_form_edit_link`

- `程式碼.gs` QT notification flow
  - Module: QT
  - Status: already enqueues notification mails via `enqueueMails()`
  - Note: QT result recording remains separate in QT notification API.

- `程式碼.gs` meeting invite flow
  - Module: Project / Meeting
  - Status: already enqueues meeting invites via `enqueueMails()`

## Safe To Replace Later

No additional direct `MailApp.sendEmail` / `GmailApp.sendEmail` module call sites were found outside the queue processor in the current scan.

## Requires Manual Confirmation

- QT notification result semantics
  - Current flow queues mail and records notification result summary immediately.
  - Before changing result semantics to depend on actual queue send completion, confirm desired reporting behavior with operations.

## Direct Send Exceptions

- `程式碼.gs` `processMailQueue()`
  - This is the intended single MailApp delivery point.
  - It checks `MailApp.getRemainingDailyQuota()` during execution and marks queue items as sent or failed.
