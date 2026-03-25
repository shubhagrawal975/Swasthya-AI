-- SwasthyaAI Complete Database Schema
-- Run: psql -U postgres -c "CREATE DATABASE swasthya_ai;" then psql -U postgres -d swasthya_ai -f schema.sql

-- ─── Extensions ────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUM Types ────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'admin', 'who_reviewer');
CREATE TYPE verification_status AS ENUM ('pending', 'under_review', 'verified', 'rejected', 'suspended');
CREATE TYPE prescription_status AS ENUM ('draft', 'submitted', 'who_check', 'board_review', 'approved', 'flagged', 'published', 'rejected');
CREATE TYPE who_review_action AS ENUM ('approve', 'flag', 'reject', 'request_revision');
CREATE TYPE camp_status AS ENUM ('draft', 'published', 'ongoing', 'completed', 'cancelled');
CREATE TYPE ad_type AS ENUM ('pandemic_alert', 'camp_promo', 'seasonal_warning', 'preventive_tips', 'vaccination_drive');
CREATE TYPE message_type AS ENUM ('text', 'prescription', 'image', 'file', 'system');
CREATE TYPE association_type AS ENUM ('epidemic_response', 'seasonal_surveillance', 'joint_camp', 'research', 'permanent_network');
CREATE TYPE chat_status AS ENUM ('open', 'replied', 'closed', 'escalated');

-- ─── LANGUAGES ─────────────────────────────────────────────
CREATE TABLE languages (
  code        VARCHAR(5) PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  native_name VARCHAR(50) NOT NULL,
  flag        VARCHAR(10),
  rtl         BOOLEAN DEFAULT FALSE,
  active      BOOLEAN DEFAULT TRUE
);

INSERT INTO languages VALUES
  ('en', 'English',  'English',    '🇬🇧', FALSE, TRUE),
  ('hi', 'Hindi',    'हिंदी',       '🇮🇳', FALSE, TRUE),
  ('mr', 'Marathi',  'मराठी',       '🇮🇳', FALSE, TRUE),
  ('bn', 'Bengali',  'বাংলা',       '🇧🇩', FALSE, TRUE),
  ('te', 'Telugu',   'తెలుగు',      '🇮🇳', FALSE, TRUE),
  ('ta', 'Tamil',    'தமிழ்',       '🇮🇳', FALSE, TRUE),
  ('gu', 'Gujarati', 'ગુજરાતી',    '🇮🇳', FALSE, TRUE),
  ('fr', 'French',   'Français',   '🇫🇷', FALSE, TRUE),
  ('ar', 'Arabic',   'العربية',    '🇸🇦', TRUE,  TRUE),
  ('sw', 'Swahili',  'Kiswahili',  '🇰🇪', FALSE, TRUE);

-- ─── USERS (Patients) ──────────────────────────────────────
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  mobile            VARCHAR(20) UNIQUE NOT NULL,
  email             VARCHAR(255) UNIQUE,
  password_hash     TEXT NOT NULL,
  date_of_birth     DATE,
  gender            VARCHAR(20),
  village           VARCHAR(200),
  district          VARCHAR(200),
  state             VARCHAR(100),
  pincode           VARCHAR(10),
  preferred_lang    VARCHAR(5) REFERENCES languages(code) DEFAULT 'en',
  profile_photo     TEXT,
  health_score      INTEGER DEFAULT 50 CHECK (health_score BETWEEN 0 AND 100),
  streak_days       INTEGER DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  is_verified       BOOLEAN DEFAULT FALSE,
  mobile_verified   BOOLEAN DEFAULT FALSE,
  otp_hash          TEXT,
  otp_expires_at    TIMESTAMPTZ,
  refresh_token     TEXT,
  last_login        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_mobile ON users(mobile);
CREATE INDEX idx_users_email ON users(email);

-- ─── DOCTORS ───────────────────────────────────────────────
CREATE TABLE doctors (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name           VARCHAR(100) NOT NULL,
  last_name            VARCHAR(100) NOT NULL,
  mobile               VARCHAR(20) UNIQUE NOT NULL,
  email                VARCHAR(255) UNIQUE NOT NULL,
  password_hash        TEXT NOT NULL,
  specialization       VARCHAR(200) NOT NULL,
  mci_number           VARCHAR(100) UNIQUE NOT NULL,
  hospital_affiliation VARCHAR(300),
  years_experience     INTEGER,
  degree_certificate   TEXT,              -- file path
  mci_certificate      TEXT,              -- file path
  profile_photo        TEXT,
  bio                  TEXT,
  languages_spoken     VARCHAR(5)[] DEFAULT ARRAY['en'],
  district             VARCHAR(200),
  state                VARCHAR(100),
  verification_status  verification_status DEFAULT 'pending',
  verified_at          TIMESTAMPTZ,
  verified_by          UUID,              -- admin UUID
  rejection_reason     TEXT,
  is_active            BOOLEAN DEFAULT TRUE,
  mobile_verified      BOOLEAN DEFAULT FALSE,
  otp_hash             TEXT,
  otp_expires_at       TIMESTAMPTZ,
  refresh_token        TEXT,
  last_login           TIMESTAMPTZ,
  total_consultations  INTEGER DEFAULT 0,
  rating               DECIMAL(3,2) DEFAULT 0.0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doctors_mci ON doctors(mci_number);
CREATE INDEX idx_doctors_verification ON doctors(verification_status);

-- ─── ADMINS ────────────────────────────────────────────────
CREATE TABLE admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(200) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(50) DEFAULT 'admin',
  is_active     BOOLEAN DEFAULT TRUE,
  refresh_token TEXT,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRESCRIPTIONS ─────────────────────────────────────────
CREATE TABLE prescriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint       TEXT,
  diagnosis       TEXT,
  medicines       JSONB NOT NULL DEFAULT '[]',
  -- medicines format: [{ name, dose, frequency, duration_days, instructions }]
  notes           TEXT,
  follow_up_date  DATE,
  status          prescription_status DEFAULT 'submitted',
  who_review_id   UUID,
  published_at    TIMESTAMPTZ,
  is_visible_to_patient BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_doctor ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);

-- ─── WHO REVIEW QUEUE ──────────────────────────────────────
CREATE TABLE who_reviews (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prescription_id   UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  reviewer_id       UUID,                -- admin/who_reviewer UUID
  auto_check_passed BOOLEAN,
  auto_check_notes  TEXT,               -- JSON flagged issues
  action            who_review_action,
  reviewer_notes    TEXT,
  flagged_medicines TEXT[],
  reviewed_at       TIMESTAMPTZ,
  assigned_at       TIMESTAMPTZ DEFAULT NOW(),
  escalated         BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_who_reviews_prescription ON who_reviews(prescription_id);

-- ─── CHAT MESSAGES ─────────────────────────────────────────
CREATE TABLE chat_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES doctors(id) ON DELETE SET NULL,
  is_ai_chat  BOOLEAN DEFAULT FALSE,
  status      chat_status DEFAULT 'open',
  language    VARCHAR(5) DEFAULT 'en',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  sender_role user_role NOT NULL,
  type        message_type DEFAULT 'text',
  content     TEXT NOT NULL,
  metadata    JSONB,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_session ON chat_messages(session_id);
CREATE INDEX idx_chat_created ON chat_messages(created_at DESC);

-- ─── HEALTH PLANS ──────────────────────────────────────────
CREATE TABLE health_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id     UUID REFERENCES doctors(id),
  title         VARCHAR(200) NOT NULL,
  description   TEXT,
  category      VARCHAR(100),           -- morning_wellness, nutrition, exercise, checkup
  tasks         JSONB NOT NULL DEFAULT '[]',
  -- tasks: [{ id, title, icon, completed, order }]
  progress      INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  who_reviewed  BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  start_date    DATE DEFAULT CURRENT_DATE,
  end_date      DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── HEALTH CAMPS ──────────────────────────────────────────
CREATE TABLE camps (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id      UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  title          VARCHAR(300) NOT NULL,
  description    TEXT,
  services       TEXT[],
  location       VARCHAR(500) NOT NULL,
  village        VARCHAR(200),
  district       VARCHAR(200),
  state          VARCHAR(100),
  pincode        VARCHAR(10),
  latitude       DECIMAL(9,6),
  longitude      DECIMAL(9,6),
  camp_date      DATE NOT NULL,
  start_time     TIME,
  end_time       TIME,
  banner_image   TEXT,
  status         camp_status DEFAULT 'draft',
  max_patients   INTEGER,
  registrations  INTEGER DEFAULT 0,
  is_free        BOOLEAN DEFAULT TRUE,
  ai_ad_id       UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_camps_date ON camps(camp_date);
CREATE INDEX idx_camps_district ON camps(district);

-- ─── CAMP REGISTRATIONS ────────────────────────────────────
CREATE TABLE camp_registrations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  camp_id     UUID NOT NULL REFERENCES camps(id) ON DELETE CASCADE,
  patient_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  attended    BOOLEAN DEFAULT FALSE,
  UNIQUE(camp_id, patient_id)
);

-- ─── DOCTOR ASSOCIATIONS ───────────────────────────────────
CREATE TABLE associations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(300) NOT NULL,
  description     TEXT,
  type            association_type NOT NULL,
  created_by      UUID NOT NULL REFERENCES doctors(id),
  geographic_scope VARCHAR(300),
  is_active       BOOLEAN DEFAULT TRUE,
  is_emergency    BOOLEAN DEFAULT FALSE,
  pandemic_name   VARCHAR(200),
  ai_alert_id     UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE association_members (
  association_id  UUID NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  role            VARCHAR(50) DEFAULT 'member',
  PRIMARY KEY (association_id, doctor_id)
);

-- ─── AI ADVERTISEMENTS ─────────────────────────────────────
CREATE TABLE ai_advertisements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by      UUID NOT NULL REFERENCES doctors(id),
  type            ad_type NOT NULL,
  topic           VARCHAR(300) NOT NULL,
  target_region   VARCHAR(300),
  severity        VARCHAR(20) DEFAULT 'informational',
  languages       VARCHAR(5)[] DEFAULT ARRAY['en', 'hi'],
  content         JSONB NOT NULL,
  -- content: { title, body, dos, donts, footer, bilingual }
  is_live         BOOLEAN DEFAULT FALSE,
  pushed_at       TIMESTAMPTZ,
  reach_count     INTEGER DEFAULT 0,
  camp_id         UUID REFERENCES camps(id),
  association_id  UUID REFERENCES associations(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USER NOTIFICATIONS ────────────────────────────────────
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  doctor_id   UUID REFERENCES doctors(id) ON DELETE CASCADE,
  title       VARCHAR(300) NOT NULL,
  body        TEXT,
  type        VARCHAR(50),
  data        JSONB,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── OTP LOGS ──────────────────────────────────────────────
CREATE TABLE otp_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mobile      VARCHAR(20) NOT NULL,
  otp_hash    TEXT NOT NULL,
  purpose     VARCHAR(50),   -- registration, login, reset
  attempts    INTEGER DEFAULT 0,
  verified    BOOLEAN DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUDIT LOGS ────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID,
  actor_role  VARCHAR(50),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id   UUID,
  details     JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Updated_at trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_plans_updated_at BEFORE UPDATE ON health_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_camps_updated_at BEFORE UPDATE ON camps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
