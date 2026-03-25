-- SwasthyaAI Schema v3 — Healthcare Operations Suite
-- Run AFTER 001 and 002 migrations

-- ─── CODING CASES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coding_cases (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_ref          VARCHAR(30) UNIQUE NOT NULL,  -- e.g. CC-2026-00142
  created_by        UUID NOT NULL,                 -- doctor_id or admin_id
  created_by_role   VARCHAR(20) NOT NULL,
  patient_id        UUID REFERENCES users(id),

  -- Inputs
  clinical_notes    TEXT NOT NULL,
  diagnosis_text    TEXT,
  procedure_notes   TEXT,
  patient_age       INTEGER,
  patient_gender    VARCHAR(10),
  encounter_type    VARCHAR(50),                   -- outpatient, inpatient, emergency

  -- AI outputs
  extracted_entities JSONB DEFAULT '[]',
  -- [{ type: 'diagnosis'|'procedure'|'symptom', text, confidence }]

  suggested_codes   JSONB DEFAULT '[]',
  -- [{ type: 'ICD10'|'CPT', code, description, confidence, supporting_text, flags[] }]

  missing_docs      JSONB DEFAULT '[]',
  compliance_flags  JSONB DEFAULT '[]',
  audit_reasoning   JSONB DEFAULT '{}',
  overall_confidence DECIMAL(5,2) DEFAULT 0,

  -- Status
  status            VARCHAR(30) DEFAULT 'draft',
  -- draft | ai_processed | human_review | approved | rejected | overridden

  -- Human review
  reviewer_id       UUID,
  reviewer_role     VARCHAR(20),
  reviewer_action   VARCHAR(30),
  reviewer_notes    TEXT,
  reviewer_overrides JSONB DEFAULT '[]',
  reviewed_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coding_cases_created_by ON coding_cases(created_by);
CREATE INDEX IF NOT EXISTS idx_coding_cases_status ON coding_cases(status);
CREATE INDEX IF NOT EXISTS idx_coding_cases_ref ON coding_cases(case_ref);

-- ─── PRIOR AUTHORIZATION CASES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prior_auth_cases (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_ref              VARCHAR(30) UNIQUE NOT NULL,  -- PA-2026-00088
  created_by            UUID NOT NULL,
  created_by_role       VARCHAR(20) NOT NULL,
  patient_id            UUID REFERENCES users(id),
  doctor_id             UUID REFERENCES doctors(id),

  -- Request details
  requested_treatment   TEXT NOT NULL,
  requested_medicine    TEXT,
  requested_procedure   TEXT,
  diagnosis             TEXT NOT NULL,
  patient_history       TEXT,
  prior_therapies_tried TEXT,
  urgency_level         VARCHAR(20) DEFAULT 'routine',  -- routine | urgent | emergent

  -- Supporting documents
  submitted_documents   JSONB DEFAULT '[]',
  -- [{ name, type, file_path, uploaded_at }]

  -- Decision engine output
  criteria_checklist    JSONB DEFAULT '[]',
  -- [{ criterion, required, met, evidence, flag }]

  unmet_requirements    JSONB DEFAULT '[]',
  missing_evidence      JSONB DEFAULT '[]',
  policy_refs           JSONB DEFAULT '[]',
  compliance_flags      JSONB DEFAULT '[]',
  contraindication_risk VARCHAR(20) DEFAULT 'none',  -- none | low | medium | high

  decision              VARCHAR(30),
  -- approved | denied | more_info_needed | escalated | pending
  decision_confidence   DECIMAL(5,2) DEFAULT 0,
  decision_reasoning    TEXT,
  audit_trail           JSONB DEFAULT '[]',

  -- Status / lifecycle
  status                VARCHAR(30) DEFAULT 'submitted',
  -- submitted | under_review | decision_made | appealed | closed

  -- Escalation
  escalated             BOOLEAN DEFAULT FALSE,
  escalation_reason     TEXT,
  escalated_to          UUID,

  -- Human review
  reviewer_id           UUID,
  reviewer_action       VARCHAR(30),
  reviewer_notes        TEXT,
  reviewer_justification TEXT,
  reviewed_at           TIMESTAMPTZ,

  -- Revision
  revision_requested    BOOLEAN DEFAULT FALSE,
  revision_notes        TEXT,
  revision_due_at       TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pa_cases_patient ON prior_auth_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_pa_cases_doctor  ON prior_auth_cases(doctor_id);
CREATE INDEX IF NOT EXISTS idx_pa_cases_status  ON prior_auth_cases(status);

-- ─── COMPLIANCE AUDIT LOG (ops-specific, detailed) ─────────────────────────
CREATE TABLE IF NOT EXISTS compliance_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id         UUID NOT NULL,
  case_type       VARCHAR(30) NOT NULL,   -- coding | prior_auth | prescription | teleconsult
  case_ref        VARCHAR(30),
  actor_id        UUID,
  actor_role      VARCHAR(30),
  action          VARCHAR(80) NOT NULL,
  inputs_summary  JSONB DEFAULT '{}',
  steps_executed  JSONB DEFAULT '[]',
  validations_run JSONB DEFAULT '[]',
  rules_matched   JSONB DEFAULT '[]',
  exceptions_found JSONB DEFAULT '[]',
  final_outcome   VARCHAR(50),
  confidence_score DECIMAL(5,2),
  human_review_required BOOLEAN DEFAULT FALSE,
  reviewer_action VARCHAR(30),
  reviewer_justification TEXT,
  ip_address      VARCHAR(45),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cal_case_id   ON compliance_audit_log(case_id);
CREATE INDEX IF NOT EXISTS idx_cal_case_type ON compliance_audit_log(case_type);
CREATE INDEX IF NOT EXISTS idx_cal_created   ON compliance_audit_log(created_at DESC);

-- ─── CASE DECISION SUPPORT ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_cases (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_ref            VARCHAR(30) UNIQUE NOT NULL,  -- DC-2026-00055
  created_by          UUID NOT NULL,
  created_by_role     VARCHAR(20) NOT NULL,
  patient_id          UUID REFERENCES users(id),

  -- Inputs
  diagnosis_codes     JSONB DEFAULT '[]',       -- [{ code, description }]
  procedure_codes     JSONB DEFAULT '[]',
  patient_age         INTEGER,
  patient_gender      VARCHAR(10),
  clinical_summary    TEXT,
  history             TEXT,

  -- Checks run
  consistency_check   JSONB DEFAULT '{}',       -- { passed, issues[] }
  duplicate_check     JSONB DEFAULT '{}',
  age_mismatch_check  JSONB DEFAULT '{}',
  contraindication_check JSONB DEFAULT '{}',
  eligibility_check   JSONB DEFAULT '{}',
  documentation_check JSONB DEFAULT '{}',
  policy_checks       JSONB DEFAULT '[]',

  -- Outcome
  decision            VARCHAR(30),
  -- approve | deny | pend | request_more_info | escalate
  decision_confidence DECIMAL(5,2) DEFAULT 0,
  flags               JSONB DEFAULT '[]',
  audit_trail         JSONB DEFAULT '[]',

  status              VARCHAR(30) DEFAULT 'pending',
  reviewer_id         UUID,
  reviewer_action     VARCHAR(30),
  reviewer_notes      TEXT,
  reviewer_justification TEXT,
  reviewed_at         TIMESTAMPTZ,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dc_patient ON decision_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_dc_status  ON decision_cases(status);

-- ─── Auto-increment case ref functions ─────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS coding_case_seq   START 1000;
CREATE SEQUENCE IF NOT EXISTS pa_case_seq        START 1000;
CREATE SEQUENCE IF NOT EXISTS decision_case_seq  START 1000;

CREATE OR REPLACE FUNCTION generate_case_ref(prefix TEXT, seq_name TEXT)
RETURNS TEXT AS $$
DECLARE
  next_val BIGINT;
BEGIN
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  RETURN prefix || '-' || to_char(NOW(), 'YYYY') || '-' || lpad(next_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-generate case refs
CREATE OR REPLACE FUNCTION set_coding_case_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_ref IS NULL OR NEW.case_ref = '' THEN
    NEW.case_ref := generate_case_ref('CC', 'coding_case_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_coding_case_ref
BEFORE INSERT ON coding_cases
FOR EACH ROW EXECUTE FUNCTION set_coding_case_ref();

CREATE OR REPLACE FUNCTION set_pa_case_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_ref IS NULL OR NEW.case_ref = '' THEN
    NEW.case_ref := generate_case_ref('PA', 'pa_case_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_pa_case_ref
BEFORE INSERT ON prior_auth_cases
FOR EACH ROW EXECUTE FUNCTION set_pa_case_ref();

CREATE OR REPLACE FUNCTION set_decision_case_ref()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.case_ref IS NULL OR NEW.case_ref = '' THEN
    NEW.case_ref := generate_case_ref('DC', 'decision_case_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_decision_case_ref
BEFORE INSERT ON decision_cases
FOR EACH ROW EXECUTE FUNCTION set_decision_case_ref();

-- Updated_at triggers
CREATE TRIGGER update_coding_cases_updated_at
BEFORE UPDATE ON coding_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pa_cases_updated_at
BEFORE UPDATE ON prior_auth_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_decision_cases_updated_at
BEFORE UPDATE ON decision_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
