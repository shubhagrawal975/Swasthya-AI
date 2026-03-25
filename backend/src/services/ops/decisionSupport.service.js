/**
 * SwasthyaAI — Case Decision Support Agent
 *
 * Evaluates clinical case consistency:
 * - Diagnosis/procedure consistency
 * - Age mismatch detection
 * - Duplicate request detection
 * - Missing documentation
 * - Eligibility completeness
 * - Policy rule checks
 *
 * Outputs: approve | deny | pend | request_more_info | escalate
 */

const { query } = require('../../config/database');
const logger = require('../../utils/logger');

// Diagnosis/procedure consistency rules (embedded)
const CONSISTENCY_RULES = [
  { diagnosis_pattern: 'fracture', required_procedures: ['xray', 'imaging', 'radiograph'], message: 'Fracture diagnosis typically requires imaging evidence' },
  { diagnosis_pattern: 'infection', required_procedures: ['culture', 'sensitivity', 'antibiotic'], message: 'Infection diagnosis should be supported by culture/sensitivity or antibiotic therapy' },
  { diagnosis_pattern: 'diabetes', required_procedures: ['glucose', 'hba1c', 'blood sugar'], message: 'Diabetes requires blood glucose or HbA1c documentation' },
  { diagnosis_pattern: 'hypertension', required_procedures: ['blood pressure', 'bp monitoring'], message: 'Hypertension requires BP monitoring documentation' },
  { diagnosis_pattern: 'anemia', required_procedures: ['cbc', 'hemoglobin', 'blood count'], message: 'Anemia requires CBC or hemoglobin results' },
  { diagnosis_pattern: 'tuberculosis', required_procedures: ['sputum', 'xray', 'mantoux', 'test'], message: 'TB diagnosis requires microbiological or radiological confirmation' },
  { diagnosis_pattern: 'malaria', required_procedures: ['rdt', 'smear', 'blood film', 'rapid test'], message: 'Malaria requires RDT or blood smear confirmation' },
];

// Age-specific diagnosis validity rules
const AGE_RULES = [
  { diagnosis_pattern: 'menopause', min_age: 35, max_age: 65, gender: 'female', message: 'Menopause diagnosis unusual outside 35-65 age range for female patients' },
  { diagnosis_pattern: 'prostate', gender: 'male', min_age: 40, message: 'Prostate conditions typically present in males 40+' },
  { diagnosis_pattern: 'childhood', max_age: 14, message: 'Childhood condition diagnosed in adult patient' },
  { diagnosis_pattern: 'pediatric', max_age: 18, message: 'Pediatric diagnosis code requires patient under 18' },
  { diagnosis_pattern: 'geriatric', min_age: 60, message: 'Geriatric condition diagnosed in non-elderly patient' },
  { diagnosis_pattern: 'alzheimer', min_age: 50, message: 'Early-onset Alzheimer unusual — confirm diagnosis age appropriateness' },
  { diagnosis_pattern: 'type 2 diabetes', min_age: 10, message: 'Type 2 diabetes in young children requires specialist confirmation' },
  { diagnosis_pattern: 'osteoporosis', min_age: 40, message: 'Osteoporosis in younger patients requires underlying cause investigation' },
];

async function evaluateDecisionCase({
  diagnosisCodes, procedureCodes, patientAge, patientGender,
  clinicalSummary, history, patientId, createdBy,
}) {
  const startTime = Date.now();
  const steps = [];
  const validationsRun = [];
  const flags = [];
  const policyChecks = [];

  steps.push({ step: 'DECISION_CASE_START', timestamp: new Date().toISOString() });

  // ── 1. Input validation ─────────────────────────────────────────────────
  const inputErrors = [];
  if (!diagnosisCodes || diagnosisCodes.length === 0) inputErrors.push('At least one diagnosis code required');
  if (!clinicalSummary) inputErrors.push('Clinical summary required');

  if (inputErrors.length > 0) {
    return { decision: 'request_more_info', flags: inputErrors.map(e => ({ type: 'MISSING_INPUT', message: e, severity: 'critical' })), audit_trail: steps };
  }

  validationsRun.push({ check: 'INPUT_COMPLETENESS', result: 'PASS', passed: true });

  // ── 2. Diagnosis/Procedure Consistency ─────────────────────────────────
  steps.push({ step: 'CONSISTENCY_CHECK', timestamp: new Date().toISOString() });

  const consistencyResults = { passed: true, issues: [] };
  const diagText = diagnosisCodes.map(d => `${d.code} ${d.description || ''}`).join(' ').toLowerCase();
  const procText = procedureCodes?.map(p => `${p.code} ${p.description || ''}`).join(' ').toLowerCase() || '';
  const fullText = `${diagText} ${clinicalSummary.toLowerCase()} ${history?.toLowerCase() || ''}`;

  for (const rule of CONSISTENCY_RULES) {
    if (diagText.includes(rule.diagnosis_pattern)) {
      const hasSupportingProc = rule.required_procedures.some(proc => procText.includes(proc) || fullText.includes(proc));
      if (!hasSupportingProc) {
        consistencyResults.passed = false;
        consistencyResults.issues.push(rule.message);
        flags.push({ type: 'CONSISTENCY_ISSUE', severity: 'medium', message: rule.message, rule_id: `CONSISTENCY_${rule.diagnosis_pattern.toUpperCase()}` });
      }
    }
  }

  policyChecks.push({ check: 'DIAGNOSIS_PROCEDURE_CONSISTENCY', passed: consistencyResults.passed, issues: consistencyResults.issues });
  validationsRun.push({ check: 'CONSISTENCY', result: consistencyResults.passed ? 'PASS' : 'ISSUES_FOUND', passed: consistencyResults.passed, issue_count: consistencyResults.issues.length });

  // ── 3. Age Mismatch Check ──────────────────────────────────────────────
  steps.push({ step: 'AGE_MISMATCH_CHECK', timestamp: new Date().toISOString() });

  const ageMismatchResults = { passed: true, issues: [] };
  if (patientAge) {
    for (const rule of AGE_RULES) {
      if (diagText.includes(rule.diagnosis_pattern)) {
        let mismatch = false;
        if (rule.min_age && patientAge < rule.min_age) mismatch = true;
        if (rule.max_age && patientAge > rule.max_age) mismatch = true;
        if (rule.gender && patientGender && rule.gender !== patientGender.toLowerCase()) mismatch = true;
        if (mismatch) {
          ageMismatchResults.passed = false;
          ageMismatchResults.issues.push(rule.message);
          flags.push({ type: 'AGE_MISMATCH', severity: 'high', message: `${rule.message} (Patient: ${patientAge}yr, ${patientGender})`, rule_id: `AGE_${rule.diagnosis_pattern.toUpperCase()}` });
        }
      }
    }
  } else {
    flags.push({ type: 'AGE_MISSING', severity: 'medium', message: 'Patient age not provided — age-specific checks skipped' });
  }

  policyChecks.push({ check: 'AGE_ELIGIBILITY', passed: ageMismatchResults.passed, issues: ageMismatchResults.issues });
  validationsRun.push({ check: 'AGE_MISMATCH', result: ageMismatchResults.passed ? 'PASS' : 'MISMATCH_FOUND', passed: ageMismatchResults.passed });

  // ── 4. Duplicate Request Detection ────────────────────────────────────
  steps.push({ step: 'DUPLICATE_CHECK', timestamp: new Date().toISOString() });

  const duplicateResult = { passed: true, existing_case: null };
  if (patientId && diagnosisCodes.length > 0) {
    try {
      const primaryCode = diagnosisCodes[0].code;
      const dupRes = await query(
        `SELECT id, case_ref, created_at, status FROM decision_cases
         WHERE patient_id=$1 AND diagnosis_codes @> $2::jsonb AND status NOT IN ('closed','denied')
         AND created_at > NOW() - INTERVAL '30 days'`,
        [patientId, JSON.stringify([{ code: primaryCode }])]
      );
      if (dupRes.rows.length > 0) {
        duplicateResult.passed = false;
        duplicateResult.existing_case = dupRes.rows[0].case_ref;
        flags.push({ type: 'DUPLICATE_REQUEST', severity: 'high', message: `Duplicate case detected — ${dupRes.rows[0].case_ref} already open for same diagnosis`, existing_case: dupRes.rows[0].case_ref });
      }
    } catch (e) { logger.warn('Duplicate check error:', e.message); }
  }

  policyChecks.push({ check: 'DUPLICATE_DETECTION', passed: duplicateResult.passed, existing_case: duplicateResult.existing_case });
  validationsRun.push({ check: 'DUPLICATE_DETECTION', result: duplicateResult.passed ? 'PASS' : 'DUPLICATE_FOUND', passed: duplicateResult.passed });

  // ── 5. Documentation completeness ─────────────────────────────────────
  steps.push({ step: 'DOCUMENTATION_CHECK', timestamp: new Date().toISOString() });

  const docResult = { passed: true, missing: [] };
  if (!clinicalSummary || clinicalSummary.trim().length < 50) {
    docResult.passed = false;
    docResult.missing.push('Adequate clinical summary (min 50 characters)');
    flags.push({ type: 'INSUFFICIENT_DOCUMENTATION', severity: 'medium', message: 'Clinical summary too brief for reliable case evaluation' });
  }

  policyChecks.push({ check: 'DOCUMENTATION_COMPLETENESS', passed: docResult.passed, missing: docResult.missing });
  validationsRun.push({ check: 'DOCUMENTATION_COMPLETENESS', result: docResult.passed ? 'PASS' : 'INCOMPLETE', passed: docResult.passed });

  // ── 6. Final Decision ─────────────────────────────────────────────────
  steps.push({ step: 'FINAL_DECISION', timestamp: new Date().toISOString() });

  const criticalFlags = flags.filter(f => f.severity === 'critical');
  const highFlags = flags.filter(f => f.severity === 'high');
  const mediumFlags = flags.filter(f => f.severity === 'medium');

  let finalDecision, finalConfidence;

  if (criticalFlags.length > 0 || !duplicateResult.passed) {
    finalDecision = 'deny';
    finalConfidence = 0.88;
  } else if (highFlags.length > 0 || !ageMismatchResults.passed) {
    finalDecision = 'escalate';
    finalConfidence = 0.80;
  } else if (mediumFlags.length > 0 || !consistencyResults.passed) {
    finalDecision = 'request_more_info';
    finalConfidence = 0.75;
  } else if (policyChecks.every(c => c.passed)) {
    finalDecision = 'approve';
    finalConfidence = 0.85;
  } else {
    finalDecision = 'pend';
    finalConfidence = 0.65;
  }

  const auditTrail = [
    { timestamp: new Date().toISOString(), event: 'CASE_SUBMITTED', actor: `${createdBy}` },
    { timestamp: new Date().toISOString(), event: 'CONSISTENCY_CHECK', result: consistencyResults.passed ? 'PASS' : 'ISSUES' },
    { timestamp: new Date().toISOString(), event: 'AGE_CHECK', result: ageMismatchResults.passed ? 'PASS' : 'MISMATCH' },
    { timestamp: new Date().toISOString(), event: 'DUPLICATE_CHECK', result: duplicateResult.passed ? 'CLEAR' : 'DUPLICATE_FOUND' },
    { timestamp: new Date().toISOString(), event: 'DOCUMENTATION_CHECK', result: docResult.passed ? 'PASS' : 'INCOMPLETE' },
    { timestamp: new Date().toISOString(), event: 'DECISION_MADE', decision: finalDecision, confidence: finalConfidence },
  ];

  return {
    decision: finalDecision,
    decision_confidence: parseFloat((finalConfidence * 100).toFixed(1)),
    consistency_check: consistencyResults,
    age_mismatch_check: ageMismatchResults,
    duplicate_check: duplicateResult,
    documentation_check: docResult,
    policy_checks: policyChecks,
    flags,
    audit_trail: auditTrail,
    steps_executed: steps,
    validations_run: validationsRun,
    human_review_required: ['escalate','pend'].includes(finalDecision) || finalConfidence < 0.7,
    processing_time_ms: Date.now() - startTime,
    agent: 'CaseDecisionSupportAgent_v1',
  };
}

module.exports = { evaluateDecisionCase };
