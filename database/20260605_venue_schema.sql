BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS venue_resource_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hall text NOT NULL,
  main_location text NOT NULL,
  calendar_id text,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hall, main_location)
);

CREATE INDEX IF NOT EXISTS idx_venue_resource_calendars_hall
  ON venue_resource_calendars (hall, main_location);

CREATE TABLE IF NOT EXISTS venue_reservations (
  reservation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hall text NOT NULL,
  main_location text NOT NULL,
  title text NOT NULL,
  requester_name text,
  requester_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  contact_phone text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  calendar_id text,
  calendar_event_id text,
  source_system text,
  source_type text,
  source_id text,
  note text,
  created_by_staff_id text REFERENCES accounts(staff_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_venue_reservations_resource_time
  ON venue_reservations (hall, main_location, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_venue_reservations_status_time
  ON venue_reservations (status, start_at, end_at);

COMMIT;
