# Attendance Integration Plan

Status: Planning Only
Last updated: 2026-06-14

## Current State

Attendance currently has read/report-focused APIs:

- `/attendance/options`
- `/attendance/small-groups`
- `/attendance/small-groups/:groupId/members`
- `/attendance/meetings`
- `/attendance/members/:memberId/recent`

The inspected API code uses `pastoral_members.id` as the member subject:

- group members join `pastoral_member_group_assignments.member_id -> pastoral_members.id`
- meeting stats join `attendance_record_dedup.member_id -> pastoral_members.id`
- member recent attendance accepts `:memberId` and queries by member ID

## Current Integration Level

| Capability | Current state | Completion |
| --- | --- | --- |
| Pastoral Member linkage | Present through `member_id` joins | Strong |
| Small group attendance stats | Present | Medium |
| Meeting attendance stats | Present | Medium |
| Recent member attendance | Present and reused by Pastoral detail | Medium |
| Attendance write / rollcall | Not visible in inspected routes | Unknown / gap |
| Summary refresh | `attendance_summary` exists for LIFF leader center but refresh is unclear | Gap |
| Line / LIFF check-in ownership | Not unified in this audit | Gap |

## Boundary Check

### Direct Account Dependency

Observed:

- `accounts` is joined for follow-up staff display in some attendance queries.
- `account_pastoral_church_permissions` is used for church scope.

Assessment:

- This is acceptable as operator/scope metadata.
- It is not acceptable for Account to become the attendance subject.

### Direct Line User Dependency

Observed:

- Attendance routes inspected do not appear to use Line User as attendance subject.
- LIFF leader center reads `attendance_summary`, not raw line events.

Assessment:

- Current direction is aligned: Attendance should remain Pastoral Member based.

## Target Model

```text
Attendance Event
  -> Attendance Record
  -> Pastoral Member
  -> Pastoral Group / Church
```

Line or QRCode entry can be an input channel, but must resolve to Pastoral Member before creating member attendance facts.

## Missing Features

1. Standard attendance write API or documented source module.
2. Rollcall / check-in ownership map:
   - manual admin input
   - QRCode
   - LINE / LIFF
   - legacy import
3. Summary refresh strategy for `attendance_summary`.
4. Reconciliation report:
   - raw records vs summary
   - unknown member records
   - duplicate records
5. Pastoral member detail drilldown to raw attendance records.

## Phase Recommendation

### Quick Wins

- Document and verify all attendance source systems.
- Add read-only reconciliation design for `attendance_records` and `attendance_summary`.
- Add UI labels that attendance is member-based, not LINE-based.

### Mid-term

- Add controlled attendance recording endpoint if missing.
- Add summary rebuild job or documented process.
- Add member attendance timeline in Pastoral detail.

### Long-term

- Integrate LIFF self-check-in with Pastoral Member resolution.
- Add pastoral care triggers from attendance absence patterns.

## Verification Checklist

- [ ] Every attendance fact has a Pastoral Member identity.
- [ ] Account appears only as operator/follow-up/scope, not attendee.
- [ ] Line User appears only as input identity and is resolved before attendance facts.
- [ ] Pastoral scope is enforced on attendance admin reports.
- [ ] Summary data can be traced back to raw attendance records.
