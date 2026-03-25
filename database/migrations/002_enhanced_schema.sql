-- SwasthyaAI Schema v2 — Enhanced Migration
-- Run after 001_schema.sql

-- ─── Extend existing tables ─────────────────────────────────────────────────

-- Add new columns to doctors
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS registration_authority    VARCHAR(100) DEFAULT 'MCI',
  ADD COLUMN IF NOT EXISTS years_experience          INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clinic_name               VARCHAR(200),
  ADD COLUMN IF NOT EXISTS clinic_address            TEXT,
  ADD COLUMN IF NOT EXISTS additional_docs           JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS consultation_duration_min INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS is_available              BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rejection_reason          TEXT,
  ADD COLUMN IF NOT EXISTS verified_by               UUID,
  ADD COLUMN IF NOT EXISTS verified_at               TIMESTAMPTZ;

-- Add can_resend_at and verified_at to otp_logs
ALTER TABLE otp_logs
  ADD COLUMN IF NOT EXISTS can_resend_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purpose        VARCHAR(50) DEFAULT 'registration';

CREATE INDEX IF NOT EXISTS idx_otp_mobile_purpose ON otp_logs(mobile, purpose, verified);

-- ─── DOCTOR VERIFICATIONS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_verifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  status          VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- pending | under_review | verified | rejected | request_more_info | suspended
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  reviewer_id     UUID,
  reviewer_notes  TEXT,
  reason_code     VARCHAR(100),
  -- Audit trail: each review action stored as a record
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doctor_verifications_doctor ON doctor_verifications(doctor_id);

-- ─── APPOINTMENTS ───────────────────────────────────────────────────────────
CREATE TYPE appointment_status AS ENUM (
  'scheduled','waiting','in_progress','completed','cancelled','rejected','no_show','rescheduled'
);
CREATE TYPE appointment_type AS ENUM ('video','audio','chat','in_person');

CREATE TABLE IF NOT EXISTS appointments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id           UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  scheduled_at        TIMESTAMPTZ NOT NULL,
  duration_minutes    INTEGER DEFAULT 30,
  reason              TEXT,
  type                appointment_type DEFAULT 'video',
  language            VARCHAR(5) DEFAULT 'en',
  status              appointment_status DEFAULT 'scheduled',

  -- Video room
  video_room_name     VARCHAR(200),
  video_patient_url   TEXT,
  video_doctor_url    TEXT,
  video_provider      VARCHAR(50) DEFAULT 'jitsi',
  video_expires_at    TIMESTAMPTZ,

  -- Outcome
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  doctor_notes        TEXT,
  diagnosis           TEXT,
  prescription_id     UUID,
  follow_up_date      DATE,
  follow_up_notes     TEXT,

  -- Reschedule / Cancel
  reschedule_reason   TEXT,
  rescheduled_by      VARCHAR(20),
  cancellation_reason TEXT,
  cancelled_by        VARCHAR(20),

  queue_position      INTEGER,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient    ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor     ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date       ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status     ON appointments(status);
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── CONSULTATION LOGS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultation_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id   UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  doctor_id        UUID NOT NULL REFERENCES doctors(id),
  patient_id       UUID NOT NULL REFERENCES users(id),
  notes            TEXT,
  diagnosis        TEXT,
  duration_minutes INTEGER,
  follow_up_date   DATE,
  follow_up_notes  TEXT,
  vitals           JSONB,          -- { bp, temp, weight, height, spo2 }
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consultation_logs_patient ON consultation_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultation_logs_doctor  ON consultation_logs(doctor_id);

-- ─── CONSULTATION MESSAGES (real-time in-session chat) ──────────────────────
CREATE TABLE IF NOT EXISTS consultation_messages (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id   UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL,
  sender_role      VARCHAR(20) NOT NULL,
  message          TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consult_messages_appt ON consultation_messages(appointment_id);

-- ─── FOLLOW-UP RECORDS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follow_up_records (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_appointment  UUID REFERENCES appointments(id),
  patient_id            UUID NOT NULL REFERENCES users(id),
  doctor_id             UUID NOT NULL REFERENCES doctors(id),
  due_date              DATE NOT NULL,
  notes                 TEXT,
  status                VARCHAR(20) DEFAULT 'pending',  -- pending | booked | completed | missed
  follow_up_appointment UUID REFERENCES appointments(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_followup_patient ON follow_up_records(patient_id);

-- ─── Extend who_reviews with reason_code ────────────────────────────────────
ALTER TABLE who_reviews
  ADD COLUMN IF NOT EXISTS reason_code    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ;

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Update prescription status enum to include new statuses
-- (PostgreSQL does not support removing enum values, only adding)
ALTER TYPE prescription_status ADD VALUE IF NOT EXISTS 'verified';
ALTER TYPE prescription_status ADD VALUE IF NOT EXISTS 'under_review';

-- Add visible_to_patient, is_emergency columns
ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS is_emergency         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_badge        BOOLEAN DEFAULT FALSE;

-- ─── NOTIFICATIONS (extended) ───────────────────────────────────────────────
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS doctor_id     UUID REFERENCES doctors(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority      VARCHAR(20) DEFAULT 'normal',  -- low | normal | high | urgent
  ADD COLUMN IF NOT EXISTS action_url    TEXT;

-- ─── DOCTOR AVAILABILITY SLOTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_availability (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id      UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week    SMALLINT NOT NULL,  -- 0=Sun ... 6=Sat
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  slot_duration  INTEGER DEFAULT 30,  -- minutes
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doctor_id, day_of_week, start_time)
);

-- ─── RATINGS & REVIEWS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultation_ratings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id),
  doctor_id       UUID NOT NULL REFERENCES doctors(id),
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text     TEXT,
  is_anonymous    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(appointment_id, patient_id)
);

-- Trigger to update doctor average rating
CREATE OR REPLACE FUNCTION update_doctor_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE doctors SET rating = (
    SELECT ROUND(AVG(rating)::numeric, 2)
    FROM consultation_ratings
    WHERE doctor_id = NEW.doctor_id
  ) WHERE id = NEW.doctor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_doctor_rating
AFTER INSERT OR UPDATE ON consultation_ratings
FOR EACH ROW EXECUTE FUNCTION update_doctor_rating();

-- ─── SEED default admin ─────────────────────────────────────────────────────
INSERT INTO admins (id, name, email, password_hash, role)
VALUES (
  uuid_generate_v4(),
  'SwasthyaAI Admin',
  'admin@swasthya.ai',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RiDzLFMJi', -- Password123!
  'admin'
) ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE doctor_verifications IS 'Tracks each review action in the doctor credential workflow';
COMMENT ON TABLE appointments IS 'Teleconsultation appointments with video room URLs';
COMMENT ON TABLE consultation_logs IS 'Post-consultation structured record by doctor';
COMMENT ON TABLE consultation_messages IS 'Real-time in-session chat messages';
COMMENT ON TABLE follow_up_records IS 'Scheduled follow-up tracking';
COMMENT ON TABLE doctor_availability IS 'Doctor recurring availability schedule';
COMMENT ON TABLE consultation_ratings IS 'Patient ratings for completed consultations';
