# TopChurchPlus View Catalog

Generated: 2026-06-14
Source: live PostgreSQL metadata via pg_catalog / information_schema
Database: postgres
Schema scope: non-system PostgreSQL schemas

This is documentation only. No schema changes were performed.

| Schema | View | Module | Definition Preview |
| --- | --- | --- | --- |
| public | `attendance_record_dedup` | attendance |  SELECT DISTINCT ON (event_id, member_id, attendance_type_id) id,<br>    legacy_record_id,<br>    event_id,<br>    member_id,<br>    attendance_type_id,<br>    attendance_mode,<br>    recorded_at,<br>    source_system,<br>    source_id,<br>    created_at,<br>    updated_at<br>   FROM attendance_records<br>  ORDER BY event_id, member_i |
