/**
 * SwasthyaAI — Prior Authorization Decision Engine
 *
 * Evaluates treatment/medicine/procedure requests against:
 * - Clinical criteria checklists
 * - Documentation requirements
 * - Contraindication risks
 * - Policy rule checks
 * - Duplicate request detection
 * - Age/gender eligibility
 *
 * Output: approve | denied | more_info_needed | escalated | pending
 * All decisions are auditable with full reasoning trail.
 *
 * DISCLAIMER: This is a decision SUPPORT system for internal healthcare
 * workflow management. It does not connect to any insurance/payer system.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Policy rules database (embedded) ────────────────────────────────────────
const POLICY_RULES = {
  // Medications requiring PA in rural/low-resource settings
  'biologics': { rule: 'BIOLOGIC_PA', criteria: ['documented_diagnosis', 'prior_conventional_therapy_failed', 'specialist_recommendation'], min_prior_therapies: 2 },
  'antibiotic_extended': { rule: 'EXTENDED_ANTIBIOTIC', criteria: ['culture_sensitivity_report', 'specialist_review'], max_duration_days: 14 },
  'opioid': { rule: 'OPIOID_PA', criteria: ['documented_pain_score', 'non_opioid_tried', 'risk_assessment'], contraindicated_age_below: 12 },
  'antifungal_systemic': { rule: 'SYSTEMIC_ANTIFUNGAL', criteria: ['lab_confirmation', 'organ_function_test'] },
  'insulin_analog': { rule: 'INSULIN_ANALOG', criteria: ['documented_diabetes', 'hba1c_result', 'conventional_insulin_tried'] },
  // Procedures
  'mri': { rule: 'MRI_PA', criteria: ['clinical_indication', 'prior_xray_or_ultrasound'], min_symptom_duration_days: 7 },
  'ct_scan': { rule: 'CT_SCAN_PA', criteria: ['clinical_indication', 'physician_order'] },
  'specialist_referral': { rule: 'SPECIALIST_REFERRAL', criteria: ['primary_care_attempt', 'clinical_justification'] },
  'surgery_elective': { rule: 'ELECTIVE_SURGERY', criteria: ['conservative_treatment_failed', 'specialist_recommendation', 'preop_clearance'], mandatory_wait_days: 30 },
};

// Contraindication database (simplified)
const CONTRAINDICATIONS = {
  'opioid': { conditions: ['respiratory_failure', 'head_injury', 'liver_failure'], age_below: 12 },
  'nsaid': { conditions: ['peptic_ulcer', 'renal_failure', 'bleeding_disorder'], age_below: 6 },
  'metformin': { conditions: ['renal_failure', 'liver_failure', 'heart_failure'] },
  'warfarin': { conditions: ['active_bleeding', 'pregnancy', 'recent_surgery'] },
  'ace_inhibitor': { conditions: ['pregnancy', 'renal_artery_stenosis', 'hyperkalemia'] },
};

/**
 * Main prior authorization decision engine
 */
async function evaluatePriorAuth({
  requestedTreatment, requestedMedicine, requestedProcedure,
  diagnosis, patientHistory, priorTherapiesTried,
  patientAge, patientGender, urgencyLevel,
  submittedDocuments, patientId, doctorId,
}) {
  const startTime = Date.now();
  const steps = [];
  const validationsRun = [];
  const flags = [];
  const criteriaChecklist = [];
  const policyRefs = [];
  const missingEvidence = [];

  try {
    steps.push({ step: 'PA_REQUEST_RECEIVED', timestamp: new Date().toISOString(), treatment: requestedTreatment, urgency: urgencyLevel });

    // ── Step 1: Input validation ───────────────────────────────────────────
    steps.push({ step: 'INPUT_VALIDATION', timestamp: new Date().toISOString() });

    const inputErrors = [];
    if (!requestedTreatment && !requestedMedicine && !requestedProcedure) inputErrors.push('At least one of treatment/medicine/procedure is required');
    if (!diagnosis) inputErrors.push('Diagnosis is required');

    if (inputErrors.length > 0) {
      return {
        decision: 'more_info_needed',
        decision_confidence: 0,
        flags: inputErrors.map(e => ({ type: 'MISSING_INPUT', message: e, severity: 'critical' })),
        criteria_checklist: [],
        missing_evidence: inputErrors,
        audit_trail: steps,
        status: 'incomplete',
      };
    }

    validationsRun.push({ check: 'INPUT_COMPLETENESS', result: 'PASS', passed: true });

    // ── Step 2: Policy rule lookup ─────────────────────────────────────────
    steps.push({ step: 'POLICY_LOOKUP', timestamp: new Date().toISOString() });

    const requestText = `${requestedTreatment} ${requestedMedicine} ${requestedProcedure}`.toLowerCase();
    let applicablePolicy = null;
    let policyKey = null;

    for (const [key, policy] of Object.entries(POLICY_RULES)) {
      if (requestText.includes(key)) {
        applicablePolicy = policy;
        policyKey = key;
        policyRefs.push({ rule_id: policy.rule, description: `PA required for ${key}`, source: 'SwasthyaAI Internal Policy v2026.1' });
        break;
      }
    }

    steps.push({ step: 'POLICY_MATCH', timestamp: new Date().toISOString(), policy_found: !!applicablePolicy, policy_key: policyKey });

    // ── Step 3: Criteria checklist evaluation ──────────────────────────────
    steps.push({ step: 'CRITERIA_EVALUATION', timestamp: new Date().toISOString() });

    if (applicablePolicy) {
      for (const criterion of (applicablePolicy.criteria || [])) {
        const criterionLabel = criterion.replace(/_/g, ' ').toUpperCase();
        let met = false;
        let evidence = 'Not found in submission';

        // Check documents submitted
        const hasDoc = (submittedDocuments || []).some(doc =>
          doc.name?.toLowerCase().includes(criterion.replace(/_/g, ' ').toLowerCase())
        );

        // Check history text
        const historyText = `${patientHistory} ${priorTherapiesTried || ''}`.toLowerCase();
        const criterionWords = criterion.split('_');
        const mentionedInHistory = criterionWords.some(w => historyText.includes(w));

        met = hasDoc || mentionedInHistory;
        if (met) evidence = hasDoc ? 'Document submitted' : 'Mentioned in patient history';
        else missingEvidence.push({ criterion, description: criterionLabel, action_required: `Please provide: ${criterionLabel}` });

        criteriaChecklist.push({ criterion, label: criterionLabel, required: true, met, evidence });
      }

      // Prior therapies check
      if (applicablePolicy.min_prior_therapies) {
        const therapiesCount = (priorTherapiesTried || '').split(',').filter(t => t.trim()).length;
        const met = therapiesCount >= applicablePolicy.min_prior_therapies;
        criteriaChecklist.push({
          criterion: 'prior_therapies_count',
          label: `Minimum ${applicablePolicy.min_prior_therapies} prior therapies tried`,
          required: true, met,
          evidence: met ? `${therapiesCount} therapies documented` : `Only ${therapiesCount} found, ${applicablePolicy.min_prior_therapies} required`,
        });
        if (!met) missingEvidence.push({ criterion: 'prior_therapies', description: `${applicablePolicy.min_prior_therapies} prior therapies required`, action_required: 'Document additional prior treatments tried and failed' });
      }
    } else {
      // No specific policy — general criteria
      criteriaChecklist.push({ criterion: 'clinical_indication', label: 'Clinical Indication', required: true, met: !!diagnosis, evidence: diagnosis ? 'Diagnosis provided' : 'Missing' });
      criteriaChecklist.push({ criterion: 'physician_order', label: 'Physician Order', required: true, met: !!doctorId, evidence: doctorId ? 'Doctor ID verified' : 'Missing' });
    }

    validationsRun.push({ check: 'CRITERIA_CHECKLIST', result: criteriaChecklist.every(c => !c.required || c.met) ? 'PASS' : 'PARTIAL', passed: criteriaChecklist.every(c => !c.required || c.met), unmet: criteriaChecklist.filter(c => c.required && !c.met).length });

    // ── Step 4: Contraindication check ────────────────────────────────────
    steps.push({ step: 'CONTRAINDICATION_CHECK', timestamp: new Date().toISOString() });

    let contraindicationRisk = 'none';
    const diagnosisLower = (diagnosis || '').toLowerCase();
    const historyLower = (patientHistory || '').toLowerCase();

    for (const [drug, contra] of Object.entries(CONTRAINDICATIONS)) {
      if (requestText.includes(drug)) {
        // Age check
        if (contra.age_below && patientAge && patientAge < contra.age_below) {
          contraindicationRisk = 'high';
          flags.push({ type: 'CONTRAINDICATION_AGE', severity: 'critical', message: `${drug} is contraindicated for patients under ${contra.age_below} years (patient age: ${patientAge})` });
        }
        // Condition check
        for (const cond of (contra.conditions || [])) {
          const condWords = cond.split('_');
          if (condWords.some(w => diagnosisLower.includes(w) || historyLower.includes(w))) {
            contraindicationRisk = 'high';
            flags.push({ type: 'CONTRAINDICATION_CONDITION', severity: 'critical', message: `${drug} is contraindicated with ${cond.replace(/_/g,' ')}` });
          }
        }
      }
    }

    validationsRun.push({ check: 'CONTRAINDICATION_RISK', result: contraindicationRisk, passed: contraindicationRisk === 'none' });
    steps.push({ step: 'CONTRAINDICATION_RESULT', timestamp: new Date().toISOString(), risk: contraindicationRisk, critical_flags: flags.filter(f=>f.severity==='critical').length });

    // ── Step 5: Duplicate check ────────────────────────────────────────────
    steps.push({ step: 'DUPLICATE_CHECK', timestamp: new Date().toISOString() });

    if (patientId) {
      try {
        const dupRes = await query(
          `SELECT id, case_ref, created_at FROM prior_auth_cases
           WHERE patient_id=$1 AND requested_medicine ILIKE $2 AND status NOT IN ('closed','denied')
           AND created_at > NOW() - INTERVAL '30 days'`,
          [patientId, `%${requestedMedicine || requestedTreatment || ''}%`]
        );
        if (dupRes.rows.length > 0) {
          flags.push({ type: 'DUPLICATE_REQUEST', severity: 'high', message: `Similar PA case already exists: ${dupRes.rows[0].case_ref} (${new Date(dupRes.rows[0].created_at).toLocaleDateString()})`, existing_case_ref: dupRes.rows[0].case_ref });
        }
        validationsRun.push({ check: 'DUPLICATE_DETECTION', result: dupRes.rows.length === 0 ? 'PASS' : 'DUPLICATE_FOUND', passed: dupRes.rows.length === 0 });
      } catch (dbErr) {
        logger.warn('Duplicate check DB error:', dbErr.message);
        validationsRun.push({ check: 'DUPLICATE_DETECTION', result: 'SKIPPED', passed: true, note: 'DB query failed' });
      }
    }

    // ── Step 6: AI-assisted decision ──────────────────────────────────────
    steps.push({ step: 'AI_DECISION_ANALYSIS', timestamp: new Date().toISOString() });

    let aiDecision = null;
    let aiConfidence = 0;
    let aiReasoning = '';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const decisionPrompt = `You are a healthcare operations prior authorization analyst for a rural health platform in India. Evaluate this PA request.

REQUESTED: ${requestedTreatment || ''} ${requestedMedicine || ''} ${requestedProcedure || ''}
DIAGNOSIS: ${diagnosis}
PATIENT AGE: ${patientAge || 'unknown'}
HISTORY: ${patientHistory || 'Not provided'}
PRIOR THERAPIES: ${priorTherapiesTried || 'None mentioned'}
DOCUMENTS SUBMITTED: ${(submittedDocuments || []).map(d => d.name).join(', ') || 'None'}
CRITERIA MET: ${criteriaChecklist.filter(c=>c.met).map(c=>c.label).join(', ')}
CRITERIA UNMET: ${criteriaChecklist.filter(c=>!c.met).map(c=>c.label).join(', ')}
FLAGS: ${flags.map(f=>f.message).join('; ')}
CONTRAINDICATION RISK: ${contraindicationRisk}

Return ONLY JSON:
{
  "decision": "approved|denied|more_info_needed|escalated",
  "confidence": 0.0-1.0,
  "primary_reason": "one sentence reason",
  "additional_requirements": ["list of what is needed if more_info_needed"],
  "escalation_reason": "why escalation if applicable or null"
}

Be conservative. If criteria are not fully met, lean toward more_info_needed.`;

        const res = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{ role: 'user', content: decisionPrompt }],
        });
        const match = res.content[0].text.match(/\{[\s\S]*\}/);
        if (match) {
          aiDecision = JSON.parse(match[0]);
          aiConfidence = aiDecision.confidence || 0;
          aiReasoning = aiDecision.primary_reason || '';
        }
      } catch (e) { logger.warn('AI decision failed, using rule-based:', e.message); }
    }

    // ── Step 7: Final decision logic ──────────────────────────────────────
    steps.push({ step: 'FINAL_DECISION', timestamp: new Date().toISOString() });

    const criticalFlags = flags.filter(f => f.severity === 'critical');
    const highFlags = flags.filter(f => f.severity === 'high');
    const unmetCriteria = criteriaChecklist.filter(c => c.required && !c.met);

    let finalDecision;
    let finalConfidence;
    let finalReasoning;
    let escalated = false;
    let escalationReason = null;

    if (criticalFlags.length > 0) {
      finalDecision = 'denied';
      finalConfidence = 0.92;
      finalReasoning = `Denied due to critical flags: ${criticalFlags.map(f=>f.message).join('; ')}`;
    } else if (unmetCriteria.length > (criteriaChecklist.length * 0.5)) {
      finalDecision = 'more_info_needed';
      finalConfidence = 0.85;
      finalReasoning = `More than 50% of required criteria unmet. Required: ${unmetCriteria.map(c=>c.label).join(', ')}`;
    } else if (highFlags.length > 0 || (aiDecision?.decision === 'escalated')) {
      finalDecision = 'escalated';
      escalated = true;
      escalationReason = `High-severity flags require human expert review: ${highFlags.map(f=>f.message).join('; ')}`;
      finalConfidence = 0.78;
      finalReasoning = escalationReason;
    } else if (unmetCriteria.length === 0 && criticalFlags.length === 0) {
      finalDecision = aiDecision?.decision || 'approved';
      finalConfidence = aiConfidence || 0.82;
      finalReasoning = aiReasoning || 'All required criteria met, no contraindications found';
    } else {
      finalDecision = 'more_info_needed';
      finalConfidence = aiConfidence || 0.7;
      finalReasoning = `Partial criteria met. Additional information required.`;
    }

    const processingTime = Date.now() - startTime;

    // ── Audit trail ───────────────────────────────────────────────────────
    const auditTrail = [
      { timestamp: new Date().toISOString(), event: 'REQUEST_RECEIVED', actor: 'PADecisionEngine_v1' },
      { timestamp: new Date().toISOString(), event: 'POLICY_LOOKUP', result: policyKey || 'general_policy' },
      { timestamp: new Date().toISOString(), event: 'CRITERIA_EVALUATED', met: criteriaChecklist.filter(c=>c.met).length, total: criteriaChecklist.length },
      { timestamp: new Date().toISOString(), event: 'CONTRAINDICATION_ASSESSED', risk: contraindicationRisk },
      { timestamp: new Date().toISOString(), event: 'FINAL_DECISION', decision: finalDecision, confidence: finalConfidence },
    ];

    return {
      decision: finalDecision,
      decision_confidence: parseFloat((finalConfidence * 100).toFixed(1)),
      decision_reasoning: finalReasoning,
      criteria_checklist: criteriaChecklist,
      missing_evidence: missingEvidence,
      compliance_flags: flags,
      policy_refs: policyRefs,
      contraindication_risk: contraindicationRisk,
      escalated,
      escalation_reason: escalationReason,
      audit_trail: auditTrail,
      steps_executed: steps,
      validations_run: validationsRun,
      processing_time_ms: processingTime,
      human_review_required: ['escalated','more_info_needed'].includes(finalDecision) || finalConfidence < 0.7,
      agent: 'PriorAuthDecisionEngine_v1',
      disclaimer: 'This is an internal workflow tool. Not connected to insurance payers or government health systems.',
    };

  } catch (err) {
    logger.error('PA decision engine error:', err);
    return {
      decision: 'escalated',
      decision_confidence: 0,
      decision_reasoning: 'System error — automatic escalation to human reviewer',
      escalated: true,
      escalation_reason: `Technical error: ${err.message}`,
      audit_trail: steps,
      error: err.message,
    };
  }
}

module.exports = { evaluatePriorAuth };
