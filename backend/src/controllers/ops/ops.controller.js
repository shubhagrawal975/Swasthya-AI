const { query, withTransaction } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../../utils/AppError');
const { processCodingCase } = require('../../services/ops/coding.service');
const { evaluatePriorAuth } = require('../../services/ops/priorAuth.service');
const { evaluateDecisionCase } = require('../../services/ops/decisionSupport.service');
const logger = require('../../utils/logger');

// ── Helper: write compliance audit log ────────────────────────────────────
async function writeAuditLog({ caseId, caseType, caseRef, actorId, actorRole, action, inputsSummary, stepsExecuted, validationsRun, rulesMatched, exceptionsFound, finalOutcome, confidenceScore, humanReviewRequired, ipAddress }) {
  try {
    await query(
      `INSERT INTO compliance_audit_log (case_id, case_type, case_ref, actor_id, actor_role, action, inputs_summary, steps_executed, validations_run, rules_matched, exceptions_found, final_outcome, confidence_score, human_review_required, ip_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [caseId, caseType, caseRef, actorId, actorRole, action,
       JSON.stringify(inputsSummary || {}), JSON.stringify(stepsExecuted || []),
       JSON.stringify(validationsRun || []), JSON.stringify(rulesMatched || []),
       JSON.stringify(exceptionsFound || []), finalOutcome, confidenceScore,
       humanReviewRequired || false, ipAddress]
    );
  } catch (e) { logger.error('Audit log write error:', e.message); }
}

// ════════════════════════════════════════════════════════════════════════════
// MEDICAL CODING CASES
// ════════════════════════════════════════════════════════════════════════════

exports.createCodingCase = async (req, res, next) => {
  try {
    const { clinical_notes, diagnosis_text, procedure_notes, patient_id, patient_age, patient_gender, encounter_type } = req.body;

    if (!clinical_notes || clinical_notes.trim().length < 20) {
      return next(new AppError('Clinical notes must be at least 20 characters', 400));
    }

    // Run AI agent
    const agentResult = await processCodingCase({
      clinicalNotes: clinical_notes, diagnosisText: diagnosis_text,
      procedureNotes: procedure_notes, patientAge: patient_age,
      patientGender: patient_gender, encounterType: encounter_type,
    });

    const caseId = uuidv4();
    const caseRef = `CC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    await query(
      `INSERT INTO coding_cases (id, case_ref, created_by, created_by_role, patient_id, clinical_notes, diagnosis_text, procedure_notes, patient_age, patient_gender, encounter_type, extracted_entities, suggested_codes, missing_docs, compliance_flags, audit_reasoning, overall_confidence, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [caseId, caseRef, req.user.id, req.user.role, patient_id || null, clinical_notes, diagnosis_text, procedure_notes, patient_age, patient_gender, encounter_type,
       JSON.stringify(agentResult.extracted_entities || {}),
       JSON.stringify(agentResult.suggested_codes || []),
       JSON.stringify(agentResult.missing_docs || []),
       JSON.stringify(agentResult.compliance_flags || []),
       JSON.stringify(agentResult.audit_reasoning || {}),
       agentResult.overall_confidence || 0,
       agentResult.status || 'ai_processed']
    );

    // Fetch the auto-generated case_ref
    const caseRefRes = await query('SELECT case_ref FROM coding_cases WHERE id=$1', [caseId]);
    const caseRefFromDB = caseRefRes.rows[0]?.case_ref || caseRef;

    await writeAuditLog({
      caseId, caseType: 'coding', caseRef: caseRefFromDB,
      actorId: req.user.id, actorRole: req.user.role,
      action: 'CODING_CASE_CREATED',
      inputsSummary: { clinical_notes_length: clinical_notes.length, patient_age, patient_gender },
      stepsExecuted: agentResult.audit_reasoning?.steps_executed || [],
      validationsRun: agentResult.audit_reasoning?.validations_run || [],
      rulesMatched: [], exceptionsFound: agentResult.compliance_flags || [],
      finalOutcome: agentResult.status, confidenceScore: agentResult.overall_confidence,
      humanReviewRequired: agentResult.human_review_required, ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Coding case created and AI analysis complete',
      data: {
        case_id: caseId,
        case_ref: caseRef,
        ...agentResult,
        disclaimer: 'All code suggestions require review by a licensed medical coder before use.',
      },
    });
  } catch (err) { next(err); }
};

exports.getCodingCases = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'created_by=$1';
    const params = [req.user.id, limit, offset];
    if (status) { where += ` AND status=$${params.length + 1}`; params.push(status); }

    const result = await query(
      `SELECT id, case_ref, status, overall_confidence, encounter_type, patient_age, created_at,
              jsonb_array_length(suggested_codes) AS code_count,
              jsonb_array_length(compliance_flags) AS flag_count
       FROM coding_cases WHERE ${where} ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.getCodingCaseById = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM coding_cases WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return next(new AppError('Case not found', 404));
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.reviewCodingCase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, notes, overrides } = req.body;
    const validActions = ['approved', 'rejected', 'overridden', 'needs_revision'];
    if (!validActions.includes(action)) return next(new AppError('Invalid action', 400));

    await query(
      `UPDATE coding_cases SET status=$1, reviewer_id=$2, reviewer_role=$3, reviewer_action=$4, reviewer_notes=$5, reviewer_overrides=$6, reviewed_at=NOW(), updated_at=NOW() WHERE id=$7`,
      [action, req.user.id, req.user.role, action, notes, JSON.stringify(overrides || []), id]
    );

    const caseRes = await query('SELECT case_ref FROM coding_cases WHERE id=$1', [id]);
    await writeAuditLog({
      caseId: id, caseType: 'coding', caseRef: caseRes.rows[0]?.case_ref,
      actorId: req.user.id, actorRole: req.user.role, action: `CODING_REVIEW_${action.toUpperCase()}`,
      inputsSummary: { overrides_count: overrides?.length || 0 }, stepsExecuted: [],
      validationsRun: [], rulesMatched: [], exceptionsFound: [],
      finalOutcome: action, confidenceScore: null, humanReviewRequired: false, ipAddress: req.ip,
    });

    res.json({ success: true, message: `Coding case ${action}`, data: { case_id: id, new_status: action } });
  } catch (err) { next(err); }
};

// ════════════════════════════════════════════════════════════════════════════
// PRIOR AUTHORIZATION CASES
// ════════════════════════════════════════════════════════════════════════════

exports.createPriorAuthCase = async (req, res, next) => {
  try {
    const {
      requested_treatment, requested_medicine, requested_procedure, diagnosis,
      patient_history, prior_therapies_tried, patient_id, patient_age, patient_gender,
      urgency_level, submitted_documents,
    } = req.body;

    if (!diagnosis) return next(new AppError('Diagnosis is required', 400));

    const agentResult = await evaluatePriorAuth({
      requestedTreatment: requested_treatment, requestedMedicine: requested_medicine,
      requestedProcedure: requested_procedure, diagnosis, patientHistory: patient_history,
      priorTherapiesTried: prior_therapies_tried, patientAge: patient_age,
      patientGender: patient_gender, urgencyLevel: urgency_level,
      submittedDocuments: submitted_documents || [], patientId: patient_id,
      doctorId: req.user.id,
    });

    const caseId = uuidv4();
    const caseRef = `PA-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    await query(
      `INSERT INTO prior_auth_cases (id, case_ref, created_by, created_by_role, patient_id, doctor_id, requested_treatment, requested_medicine, requested_procedure, diagnosis, patient_history, prior_therapies_tried, urgency_level, submitted_documents, criteria_checklist, unmet_requirements, missing_evidence, policy_refs, compliance_flags, contraindication_risk, decision, decision_confidence, decision_reasoning, audit_trail, status, escalated, escalation_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
      [caseId, caseRef, req.user.id, req.user.role, patient_id||null,
       req.user.role==='doctor'?req.user.id:null,
       requested_treatment, requested_medicine, requested_procedure, diagnosis,
       patient_history, prior_therapies_tried, urgency_level||'routine',
       JSON.stringify(submitted_documents||[]),
       JSON.stringify(agentResult.criteria_checklist||[]),
       JSON.stringify(agentResult.missing_evidence||[]),
       JSON.stringify(agentResult.missing_evidence||[]),
       JSON.stringify(agentResult.policy_refs||[]),
       JSON.stringify(agentResult.compliance_flags||[]),
       agentResult.contraindication_risk||'none',
       agentResult.decision, agentResult.decision_confidence,
       agentResult.decision_reasoning,
       JSON.stringify(agentResult.audit_trail||[]),
       'submitted', agentResult.escalated||false, agentResult.escalation_reason]
    );

    const caseRefRes = await query('SELECT case_ref FROM prior_auth_cases WHERE id=$1', [caseId]);
    const caseRefFromDB = caseRefRes.rows[0]?.case_ref || caseRef;

    await writeAuditLog({
      caseId, caseType: 'prior_auth', caseRef: caseRefFromDB, actorId: req.user.id, actorRole: req.user.role,
      action: 'PA_CASE_CREATED', inputsSummary: { diagnosis, urgency: urgency_level, docs: submitted_documents?.length||0 },
      stepsExecuted: agentResult.steps_executed||[], validationsRun: agentResult.validations_run||[],
      rulesMatched: agentResult.policy_refs||[], exceptionsFound: agentResult.compliance_flags||[],
      finalOutcome: agentResult.decision, confidenceScore: agentResult.decision_confidence,
      humanReviewRequired: agentResult.human_review_required, ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Prior authorization case submitted',
      data: { case_id: caseId, case_ref: caseRefFromDB, ...agentResult },
    });
  } catch (err) { next(err); }
};

exports.getPriorAuthCases = async (req, res, next) => {
  try {
    const { status, page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    let where = req.user.role==='admin' ? 'TRUE' : 'created_by=$1';
    const params = req.user.role==='admin' ? [limit, offset] : [req.user.id, limit, offset];
    if (status) { params.push(status); where += ` AND status=$${params.length-1}`; }

    const result = await query(
      `SELECT id, case_ref, status, decision, decision_confidence, urgency_level, diagnosis, requested_treatment, escalated, created_at
       FROM prior_auth_cases WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.getPriorAuthCaseById = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM prior_auth_cases WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return next(new AppError('Case not found', 404));
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.reviewPriorAuthCase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, notes, justification } = req.body;
    const validActions = ['approved','denied','more_info_requested','escalated','closed'];
    if (!validActions.includes(action)) return next(new AppError('Invalid action', 400));
    if (!justification || justification.trim().length < 10) return next(new AppError('Reviewer justification is mandatory (min 10 characters)', 400));

    const newStatus = action === 'more_info_requested' ? 'under_review' : 'decision_made';

    await query(
      `UPDATE prior_auth_cases SET status=$1, decision=$2, reviewer_id=$3, reviewer_action=$4, reviewer_notes=$5, reviewer_justification=$6, reviewed_at=NOW(), updated_at=NOW(), escalated=$7
       WHERE id=$8`,
      [newStatus, action, req.user.id, action, notes, justification, action==='escalated', id]
    );

    const caseRes = await query('SELECT case_ref FROM prior_auth_cases WHERE id=$1', [id]);
    await writeAuditLog({
      caseId: id, caseType: 'prior_auth', caseRef: caseRes.rows[0]?.case_ref,
      actorId: req.user.id, actorRole: req.user.role, action: `PA_REVIEW_${action.toUpperCase()}`,
      inputsSummary: { justification_length: justification.length },
      stepsExecuted: [], validationsRun: [], rulesMatched: [], exceptionsFound: [],
      finalOutcome: action, confidenceScore: null, humanReviewRequired: action==='escalated', ipAddress: req.ip,
    });

    res.json({ success: true, message: `Prior auth case ${action}`, data: { case_id: id, new_decision: action, new_status: newStatus } });
  } catch (err) { next(err); }
};

// ════════════════════════════════════════════════════════════════════════════
// DECISION CASES
// ════════════════════════════════════════════════════════════════════════════

exports.createDecisionCase = async (req, res, next) => {
  try {
    const { diagnosis_codes, procedure_codes, patient_age, patient_gender, clinical_summary, history, patient_id } = req.body;

    const agentResult = await evaluateDecisionCase({
      diagnosisCodes: diagnosis_codes || [], procedureCodes: procedure_codes || [],
      patientAge: patient_age, patientGender: patient_gender,
      clinicalSummary: clinical_summary, history, patientId: patient_id, createdBy: req.user.id,
    });

    const caseId = uuidv4();
    const caseRef = `DC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    await query(
      `INSERT INTO decision_cases (id, case_ref, created_by, created_by_role, patient_id, diagnosis_codes, procedure_codes, patient_age, patient_gender, clinical_summary, history, consistency_check, age_mismatch_check, duplicate_check, documentation_check, policy_checks, decision, decision_confidence, flags, audit_trail, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [caseId, caseRef, req.user.id, req.user.role, patient_id||null,
       JSON.stringify(diagnosis_codes||[]), JSON.stringify(procedure_codes||[]),
       patient_age, patient_gender, clinical_summary, history,
       JSON.stringify(agentResult.consistency_check||{}),
       JSON.stringify(agentResult.age_mismatch_check||{}),
       JSON.stringify(agentResult.duplicate_check||{}),
       JSON.stringify(agentResult.documentation_check||{}),
       JSON.stringify(agentResult.policy_checks||[]),
       agentResult.decision, agentResult.decision_confidence,
       JSON.stringify(agentResult.flags||[]),
       JSON.stringify(agentResult.audit_trail||[]), 'pending']
    );

    const refRes = await query('SELECT case_ref FROM decision_cases WHERE id=$1', [caseId]);
    const caseRefFromDB = refRes.rows[0]?.case_ref || caseRef;

    await writeAuditLog({
      caseId, caseType: 'decision', caseRef: caseRefFromDB, actorId: req.user.id, actorRole: req.user.role,
      action: 'DECISION_CASE_CREATED',
      inputsSummary: { dx_codes: diagnosis_codes?.length||0, proc_codes: procedure_codes?.length||0 },
      stepsExecuted: agentResult.steps_executed||[], validationsRun: agentResult.validations_run||[],
      rulesMatched: agentResult.policy_checks||[], exceptionsFound: agentResult.flags||[],
      finalOutcome: agentResult.decision, confidenceScore: agentResult.decision_confidence,
      humanReviewRequired: agentResult.human_review_required, ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: { case_id: caseId, case_ref: caseRefFromDB, ...agentResult },
    });
  } catch (err) { next(err); }
};

exports.reviewDecisionCase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, notes, justification } = req.body;
    if (!justification || justification.trim().length < 10) return next(new AppError('Reviewer justification is mandatory', 400));

    await query(
      `UPDATE decision_cases SET status=$1, decision=$2, reviewer_id=$3, reviewer_action=$4, reviewer_notes=$5, reviewer_justification=$6, reviewed_at=NOW(), updated_at=NOW() WHERE id=$7`,
      [action==='approved'?'approved':'closed', action, req.user.id, action, notes, justification, id]
    );

    const refRes = await query('SELECT case_ref FROM decision_cases WHERE id=$1', [id]);
    await writeAuditLog({
      caseId: id, caseType: 'decision', caseRef: refRes.rows[0]?.case_ref,
      actorId: req.user.id, actorRole: req.user.role, action: `DC_REVIEW_${action.toUpperCase()}`,
      inputsSummary: { justification_length: justification.length },
      stepsExecuted: [], validationsRun: [], rulesMatched: [], exceptionsFound: [],
      finalOutcome: action, confidenceScore: null,
      humanReviewRequired: ['escalate','pend'].includes(action), ipAddress: req.ip,
    });

    res.json({ success: true, message: `Decision case ${action}`, data: { case_id: id, new_decision: action } });
  } catch (err) { next(err); }
};

// ════════════════════════════════════════════════════════════════════════════
// COMPLIANCE AUDIT CONSOLE
// ════════════════════════════════════════════════════════════════════════════

exports.getAuditLog = async (req, res, next) => {
  try {
    const { case_type, case_ref, page=1, limit=50 } = req.query;
    const offset = (page-1)*limit;
    let where = 'TRUE';
    const params = [limit, offset];
    if (case_type) { params.push(case_type); where += ` AND case_type=$${params.length-1}`; }
    if (case_ref) { params.push(case_ref); where += ` AND case_ref=$${params.length-1}`; }

    const result = await query(
      `SELECT id, case_id, case_type, case_ref, actor_role, action, final_outcome, confidence_score, human_review_required, reviewer_action, created_at
       FROM compliance_audit_log WHERE ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.getAuditEntry = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM compliance_audit_log WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return next(new AppError('Audit entry not found', 404));
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.getFullCaseAudit = async (req, res, next) => {
  try {
    const { case_id } = req.params;
    const result = await query(
      `SELECT * FROM compliance_audit_log WHERE case_id=$1 ORDER BY created_at ASC`,
      [case_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

exports.getOpsDashboard = async (req, res, next) => {
  try {
    const [coding, pa, dc, audit] = await Promise.all([
      query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='human_review' THEN 1 ELSE 0 END) AS pending_review FROM coding_cases`),
      query(`SELECT COUNT(*) AS total, SUM(CASE WHEN decision='more_info_needed' THEN 1 ELSE 0 END) AS info_needed, SUM(CASE WHEN escalated=TRUE THEN 1 ELSE 0 END) AS escalated FROM prior_auth_cases`),
      query(`SELECT COUNT(*) AS total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending FROM decision_cases`),
      query(`SELECT COUNT(*) AS total, SUM(CASE WHEN human_review_required=TRUE AND reviewer_action IS NULL THEN 1 ELSE 0 END) AS awaiting_human FROM compliance_audit_log WHERE created_at > NOW()-INTERVAL '7 days'`),
    ]);

    res.json({
      success: true,
      data: {
        coding_cases: { total: +coding.rows[0].total, pending_review: +coding.rows[0].pending_review },
        prior_auth_cases: { total: +pa.rows[0].total, info_needed: +pa.rows[0].info_needed, escalated: +pa.rows[0].escalated },
        decision_cases: { total: +dc.rows[0].total, pending: +dc.rows[0].pending },
        audit_log_7d: { total: +audit.rows[0].total, awaiting_human: +audit.rows[0].awaiting_human },
      },
    });
  } catch (err) { next(err); }
};
