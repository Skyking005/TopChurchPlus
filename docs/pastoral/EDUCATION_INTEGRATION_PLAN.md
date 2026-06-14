# Education Integration Plan

Status: Planning Only
Last updated: 2026-06-14

## Current State

Education has the following inspected API surface:

- `/education/course-categories`
- `/education/courses`
- `/education/class-forecast`
- `/education/courses/:courseId`
- `POST /education/courses`
- `PUT /education/courses/:courseId`

Data tables:

- `education_course_categories`
- `education_courses`
- `education_enrollments`
- `course_summary`
- `pastoral_members`

The inspected code correctly joins enrollments through:

```text
education_enrollments.member_id -> pastoral_members.id
```

## Current Integration Level

| Capability | Current state | Completion |
| --- | --- | --- |
| Course categories | Present | Medium |
| Course CRUD | Present for course create/update | Medium |
| Enrollment data | Present in schema and detail queries | Medium |
| Enrollment management workflow | Dedicated create/update API not visible in inspected routes | Gap |
| Completion tracking | `is_completed` exists and is read | Medium |
| Graduation / path workflow | Not formalized | Gap |
| LIFF leader course summary | `course_summary` exists and is read | Gap: refresh unclear |

## Boundary Check

Education should attach to:

```text
Pastoral Member
```

Not:

```text
Line User
Account
```

Observed:

- `education_enrollments.member_id` joins `pastoral_members.id`.
- Account is used for operator permissions through feature access, not student identity.
- LIFF leader center reads course summaries by pastoral scope.

Assessment:

- Core data direction is safe.
- Completion workflow is not complete enough for full pastoral platform operations.

## Missing Features

1. Enrollment management:
   - add member to course
   - remove/cancel enrollment
   - mark complete
   - notes / completion date
2. Education path:
   - required sequence
   - eligible next course
   - graduation criteria
3. Member education timeline:
   - completed courses
   - pending courses
   - recommended next step
4. Summary refresh:
   - define how `course_summary` is generated.
5. Pastoral detail action:
   - education status is visible, but actionable workflow should be defined.

## Phase Recommendation

### Quick Wins

- Confirm existing enrollment data quality.
- Show read-only member education journey in Pastoral detail.
- Define `course_summary` source and refresh strategy.

### Mid-term

- Add enrollment management workflow.
- Add completion/graduation controls.
- Add education path rule definition.

### Long-term

- Integrate education recommendations into LIFF Member Center.
- Add leader/zone pastoral dashboards for training progress.

## Verification Checklist

- [ ] Enrollment references Pastoral Member only.
- [ ] Account is operator only.
- [ ] Line User never owns education facts.
- [ ] Course summary is derived from enrollment/course data.
- [ ] Member detail can explain education status without guessing.
