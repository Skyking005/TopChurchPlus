BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE zoom_reservations
  DROP CONSTRAINT IF EXISTS zoom_reservations_no_overlap;

ALTER TABLE zoom_reservations
  ADD CONSTRAINT zoom_reservations_no_overlap
  EXCLUDE USING gist (
    zoom_account_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status = 'reserved');

ALTER TABLE venue_reservations
  DROP CONSTRAINT IF EXISTS venue_reservations_no_overlap;

ALTER TABLE venue_reservations
  ADD CONSTRAINT venue_reservations_no_overlap
  EXCLUDE USING gist (
    hall WITH =,
    main_location WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'rejected'));

COMMIT;
