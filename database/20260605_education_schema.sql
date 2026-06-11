BEGIN;

CREATE TABLE IF NOT EXISTS education_course_categories (
  category_id integer PRIMARY KEY,
  category_name text NOT NULL,
  is_class boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  group_code integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS education_courses (
  course_id integer PRIMARY KEY,
  course_code text UNIQUE,
  category_id integer REFERENCES education_course_categories(category_id) ON DELETE SET NULL,
  course_name text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_education_courses_category
  ON education_courses (category_id, start_date DESC);

CREATE TABLE IF NOT EXISTS education_enrollments (
  enrollment_id integer PRIMARY KEY,
  member_id integer NOT NULL REFERENCES pastoral_members(id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES education_courses(course_id) ON DELETE CASCADE,
  is_completed boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_education_enrollments_member
  ON education_enrollments (member_id, course_id);

CREATE INDEX IF NOT EXISTS idx_education_enrollments_course
  ON education_enrollments (course_id, is_completed);

COMMIT;
