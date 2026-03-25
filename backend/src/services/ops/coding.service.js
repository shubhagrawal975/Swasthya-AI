/**
 * SwasthyaAI — Medical Coding Support Agent
 *
 * Uses Claude AI to:
 * 1. Extract clinical entities from unstructured notes
 * 2. Suggest ICD-10 and CPT-style codes with confidence scores
 * 3. Flag missing documentation and compliance issues
 * 4. Generate structured audit reasoning
 *
 * IMPORTANT: This is a clinical DECISION SUPPORT tool.
 * All suggestions require human review before use.
 * This does NOT connect to any official ICD/CPT licensing body.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── ICD-10 common codes reference (embedded, no external API needed) ────────
const ICD10_COMMON = {
  // Infectious diseases
  'dengue fever': { code: 'A90', desc: 'Dengue fever [classical dengue]', category: 'Infectious' },
  'malaria': { code: 'B54', desc: 'Unspecified malaria', category: 'Infectious' },
  'tuberculosis': { code: 'A15.9', desc: 'Respiratory tuberculosis, unspecified', category: 'Infectious' },
  'typhoid': { code: 'A01.0', desc: 'Typhoid fever', category: 'Infectious' },
  // Respiratory
  'pneumonia': { code: 'J18.9', desc: 'Unspecified pneumonia', category: 'Respiratory' },
  'asthma': { code: 'J45.909', desc: 'Unspecified asthma, uncomplicated', category: 'Respiratory' },
  'copd': { code: 'J44.1', desc: 'COPD with acute exacerbation', category: 'Respiratory' },
  'upper respiratory': { code: 'J06.9', desc: 'Acute upper respiratory infection, unspecified', category: 'Respiratory' },
  // Cardiovascular
  'hypertension': { code: 'I10', desc: 'Essential (primary) hypertension', category: 'Cardiovascular' },
  'heart failure': { code: 'I50.9', desc: 'Heart failure, unspecified', category: 'Cardiovascular' },
  'chest pain': { code: 'R07.9', desc: 'Chest pain, unspecified', category: 'Symptoms' },
  // Metabolic
  'type 2 diabetes': { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complications', category: 'Endocrine' },
  'type 1 diabetes': { code: 'E10.9', desc: 'Type 1 diabetes mellitus without complications', category: 'Endocrine' },
  'hypothyroidism': { code: 'E03.9', desc: 'Hypothyroidism, unspecified', category: 'Endocrine' },
  'anemia': { code: 'D64.9', desc: 'Anemia, unspecified', category: 'Blood' },
  // GI
  'gastroenteritis': { code: 'K52.9', desc: 'Noninfective gastroenteritis, unspecified', category: 'Digestive' },
  'peptic ulcer': { code: 'K27.9', desc: 'Peptic ulcer, site unspecified', category: 'Digestive' },
  'diarrhea': { code: 'R19.7', desc: 'Diarrhea, unspecified', category: 'Symptoms' },
  // Symptoms
  'fever': { code: 'R50.9', desc: 'Fever, unspecified', category: 'Symptoms' },
  'headache': { code: 'R51', desc: 'Headache', category: 'Symptoms' },
  'fatigue': { code: 'R53.83', desc: 'Other fatigue', category: 'Symptoms' },
  'cough': { code: 'R05', desc: 'Cough', category: 'Symptoms' },
  'nausea': { code: 'R11.0', desc: 'Nausea', category: 'Symptoms' },
  'vomiting': { code: 'R11.10', desc: 'Vomiting, unspecified', category: 'Symptoms' },
  // Musculoskeletal
  'fracture': { code: 'M84.40XA', desc: 'Pathological fracture, unspecified site', category: 'Musculoskeletal' },
  'arthritis': { code: 'M06.9', desc: 'Rheumatoid arthritis, unspecified', category: 'Musculoskeletal' },
  'back pain': { code: 'M54.5', desc: 'Low back pain', category: 'Musculoskeletal' },
  // Mental health
  'depression': { code: 'F32.9', desc: 'Major depressive disorder, single episode, unspecified', category: 'Mental Health' },
  'anxiety': { code: 'F41.9', desc: 'Anxiety disorder, unspecified', category: 'Mental Health' },
};

// CPT-style procedure codes (simplified)
const CPT_COMMON = {
  'consultation': { code: '99213', desc: 'Office/outpatient visit, established patient, moderate complexity', type: 'E&M' },
  'new patient': { code: '99203', desc: 'Office/outpatient visit, new patient, moderate complexity', type: 'E&M' },
  'telehealth': { code: '99214', desc: 'Telehealth E/M service, moderate-high complexity', type: 'E&M' },
  'blood test': { code: '80053', desc: 'Comprehensive metabolic panel', type: 'Lab' },
  'cbc': { code: '85025', desc: 'Blood count, complete (CBC), automated', type: 'Lab' },
  'urinalysis': { code: '81003', desc: 'Urinalysis, automated', type: 'Lab' },
  'xray chest': { code: '71046', desc: 'Radiologic examination, chest; 2 views', type: 'Radiology' },
  'ecg': { code: '93000', desc: 'Electrocardiogram, routine ECG with interpretation', type: 'Cardiology' },
  'blood pressure': { code: '99473', desc: 'Self-measured blood pressure monitoring', type: 'Monitoring' },
  'glucose test': { code: '82947', desc: 'Glucose; quantitative, blood (except reagent strip)', type: 'Lab' },
  'hba1c': { code: '83036', desc: 'Hemoglobin; glycosylated (A1C)', type: 'Lab' },
  'injection': { code: '96372', desc: 'Therapeutic injection, subcutaneous or intramuscular', type: 'Procedure' },
  'wound care': { code: '97597', desc: 'Debridement, open wound; first 20 sq cm', type: 'Procedure' },
  'suture': { code: '12011', desc: 'Simple repair of superficial wounds', type: 'Procedure' },
};

/**
 * Main coding agent — processes clinical notes and returns structured output
 */
async function processCodingCase({ clinicalNotes, diagnosisText, procedureNotes, patientAge, patientGender, encounterType }) {
  const startTime = Date.now();
  const steps = [];
  const validationsRun = [];
  const flags = [];

  try {
    steps.push({ step: 'INPUT_RECEIVED', timestamp: new Date().toISOString(), details: { noteLength: clinicalNotes?.length, hasdiagnosis: !!diagnosisText } });

    // ── Step 1: Entity extraction via Claude ───────────────────────────────
    steps.push({ step: 'ENTITY_EXTRACTION_START', timestamp: new Date().toISOString() });

    const extractionPrompt = `You are a medical coding support assistant for rural healthcare in India. Extract structured clinical entities from the following clinical notes.

CLINICAL NOTES: ${clinicalNotes}
${diagnosisText ? `DIAGNOSIS: ${diagnosisText}` : ''}
${procedureNotes ? `PROCEDURES: ${procedureNotes}` : ''}
Patient: ${patientAge || 'unknown'} yr old ${patientGender || 'unknown'}
Encounter: ${encounterType || 'outpatient'}

Return ONLY valid JSON with this exact structure:
{
  "diagnoses": [{"text": "...", "confidence": 0.0-1.0, "laterality": null, "severity": "mild|moderate|severe|null"}],
  "procedures": [{"text": "...", "confidence": 0.0-1.0, "laterality": null}],
  "symptoms": [{"text": "...", "confidence": 0.0-1.0}],
  "medications": [{"text": "...", "dosage": "...", "confidence": 0.0-1.0}],
  "missing_elements": ["list of clinical elements typically required but not found"],
  "documentation_quality": "poor|fair|good|excellent",
  "overall_confidence": 0.0-1.0
}

Be conservative with confidence. If clinical notes are sparse, reflect that.`;

    let entities = {};
    let overallConfidence = 0;
    let missingElements = [];

    try {
      const aiRes = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: extractionPrompt }],
      });
      const text = aiRes.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        entities = JSON.parse(jsonMatch[0]);
        overallConfidence = entities.overall_confidence || 0;
        missingElements = entities.missing_elements || [];
      }
    } catch (aiErr) {
      logger.warn('AI entity extraction failed, using rule-based fallback:', aiErr.message);
      entities = ruleBasedExtraction(clinicalNotes, diagnosisText, procedureNotes);
      overallConfidence = 0.5;
      flags.push({ type: 'AI_UNAVAILABLE', message: 'Using rule-based extraction — AI API unavailable', severity: 'warning' });
    }

    steps.push({ step: 'ENTITY_EXTRACTION_COMPLETE', timestamp: new Date().toISOString(), entities_found: Object.values(entities).flat().length });
    validationsRun.push({ check: 'DOCUMENTATION_QUALITY', result: entities.documentation_quality || 'unknown', passed: ['good','excellent'].includes(entities.documentation_quality) });

    // ── Step 2: ICD-10 code matching ──────────────────────────────────────
    steps.push({ step: 'ICD10_MATCHING_START', timestamp: new Date().toISOString() });

    const suggestedCodes = [];

    // Match diagnoses to ICD-10
    const diagList = [...(entities.diagnoses || []), ...(entities.symptoms || [])];
    for (const diag of diagList) {
      const match = matchCode(diag.text, ICD10_COMMON);
      if (match) {
        const codeFlags = [];
        // Age checks
        if (patientAge) {
          if (match.code.startsWith('Z00') && patientAge > 65) codeFlags.push('GERIATRIC_SCREENING_RECOMMENDED');
          if (match.code === 'E10.9' && patientAge > 40) codeFlags.push('CONSIDER_TYPE2_VERIFICATION');
        }
        // Gender checks
        if (patientGender) {
          if (match.code.startsWith('O') && patientGender === 'male') codeFlags.push('GENDER_MISMATCH_OBSTETRIC_CODE');
          if (match.code.startsWith('N94') && patientGender === 'male') codeFlags.push('GENDER_MISMATCH');
        }
        suggestedCodes.push({
          type: 'ICD10',
          code: match.code,
          description: match.desc,
          category: match.category,
          source_text: diag.text,
          confidence: Math.min(diag.confidence * (match.exactMatch ? 1.0 : 0.8), 0.95),
          flags: codeFlags,
          requires_specificity: match.code.includes('9') || match.code.endsWith('.9'),
          supporting_text: diag.text,
        });
      } else if (diag.confidence > 0.7) {
        // High-confidence entity with no match → flag
        flags.push({ type: 'UNMATCHED_DIAGNOSIS', message: `Could not map "${diag.text}" to ICD-10 code — manual coding required`, severity: 'info' });
      }
    }

    // Match procedures to CPT-style
    for (const proc of (entities.procedures || [])) {
      const match = matchCode(proc.text, CPT_COMMON);
      if (match) {
        suggestedCodes.push({
          type: 'CPT',
          code: match.code,
          description: match.desc,
          category: match.type,
          source_text: proc.text,
          confidence: Math.min(proc.confidence * 0.85, 0.9),
          flags: [],
          supporting_text: proc.text,
        });
      }
    }

    // Auto E&M code based on encounter type
    if (encounterType === 'telehealth') {
      suggestedCodes.push({
        type: 'CPT', code: '99214', description: 'Telehealth E/M service, established patient',
        category: 'E&M', source_text: 'telehealth encounter', confidence: 0.9, flags: [], supporting_text: 'encounter type = telehealth',
      });
    } else if (encounterType === 'outpatient') {
      suggestedCodes.push({
        type: 'CPT', code: '99213', description: 'Office/outpatient visit, established patient',
        category: 'E&M', source_text: 'outpatient encounter', confidence: 0.88, flags: [], supporting_text: 'encounter type = outpatient',
      });
    }

    steps.push({ step: 'CODE_MATCHING_COMPLETE', timestamp: new Date().toISOString(), codes_suggested: suggestedCodes.length });
    validationsRun.push({ check: 'MIN_CODES_FOUND', result: suggestedCodes.length > 0 ? 'PASS' : 'FAIL', passed: suggestedCodes.length > 0 });

    // ── Step 3: Compliance checks ─────────────────────────────────────────
    steps.push({ step: 'COMPLIANCE_CHECKS_START', timestamp: new Date().toISOString() });

    const complianceFlags = [...flags];

    // Confidence threshold check
    const avgConfidence = suggestedCodes.length > 0
      ? suggestedCodes.reduce((s, c) => s + c.confidence, 0) / suggestedCodes.length
      : 0;

    if (avgConfidence < 0.6) {
      complianceFlags.push({ type: 'LOW_CONFIDENCE', message: `Average code confidence ${(avgConfidence * 100).toFixed(0)}% — human review mandatory`, severity: 'high' });
    }

    // Check for diagnosis+procedure consistency
    const hasDx = suggestedCodes.some(c => c.type === 'ICD10');
    const hasPx = suggestedCodes.some(c => c.type === 'CPT' && c.category !== 'E&M');
    if (hasPx && !hasDx) {
      complianceFlags.push({ type: 'PROCEDURE_WITHOUT_DIAGNOSIS', message: 'Procedure codes present without supporting diagnosis codes', severity: 'high' });
    }

    // Documentation quality flags
    if (missingElements.length > 0) {
      complianceFlags.push({ type: 'MISSING_DOCUMENTATION', message: `Missing: ${missingElements.join(', ')}`, severity: 'medium', items: missingElements });
    }

    if (entities.documentation_quality === 'poor') {
      complianceFlags.push({ type: 'POOR_DOCUMENTATION', message: 'Clinical notes are insufficient for reliable coding — request additional documentation', severity: 'high' });
    }

    // Age-specific flags
    if (!patientAge) complianceFlags.push({ type: 'MISSING_AGE', message: 'Patient age not provided — required for age-specific code selection', severity: 'medium' });
    if (!patientGender) complianceFlags.push({ type: 'MISSING_GENDER', message: 'Patient gender not provided — required for gender-specific code validation', severity: 'medium' });

    validationsRun.push({ check: 'CONFIDENCE_THRESHOLD', result: avgConfidence >= 0.6 ? 'PASS' : 'FAIL', passed: avgConfidence >= 0.6, value: avgConfidence });
    validationsRun.push({ check: 'DOCUMENTATION_COMPLETENESS', result: missingElements.length === 0 ? 'PASS' : 'PARTIAL', passed: missingElements.length === 0 });

    steps.push({ step: 'COMPLIANCE_CHECKS_COMPLETE', timestamp: new Date().toISOString(), flags_raised: complianceFlags.length });

    // ── Step 4: Determine if human review required ───────────────────────
    const humanReviewRequired = avgConfidence < 0.7 || complianceFlags.some(f => f.severity === 'high') || suggestedCodes.length === 0;

    steps.push({ step: 'HUMAN_REVIEW_DETERMINATION', timestamp: new Date().toISOString(), required: humanReviewRequired });

    const processingTime = Date.now() - startTime;

    // ── Build audit reasoning ─────────────────────────────────────────────
    const auditReasoning = {
      agent: 'MedicalCodingAgent_v1',
      processing_time_ms: processingTime,
      steps_executed: steps,
      validations_run: validationsRun,
      entity_extraction_method: process.env.ANTHROPIC_API_KEY ? 'claude-ai' : 'rule-based-fallback',
      code_matching_method: 'embedded-reference-db',
      human_review_required: humanReviewRequired,
      human_review_reasons: humanReviewRequired ? complianceFlags.filter(f => f.severity === 'high').map(f => f.message) : [],
      policy_note: 'All code suggestions are for clinical decision support only. Final coding requires licensed coder review.',
      disclaimer: 'This tool does not provide official ICD-10 or CPT coding. It provides AI-assisted suggestions that must be reviewed by a qualified medical coder.',
    };

    return {
      success: true,
      extracted_entities: entities,
      suggested_codes: suggestedCodes,
      missing_docs: missingElements,
      compliance_flags: complianceFlags,
      audit_reasoning: auditReasoning,
      overall_confidence: parseFloat((avgConfidence * 100).toFixed(1)),
      status: humanReviewRequired ? 'human_review' : 'ai_processed',
      human_review_required: humanReviewRequired,
    };

  } catch (err) {
    logger.error('Coding agent error:', err);
    return {
      success: false,
      error: err.message,
      status: 'error',
      audit_reasoning: { steps_executed: steps, error: err.message },
    };
  }
}

// ── Rule-based extraction fallback ─────────────────────────────────────────
function ruleBasedExtraction(clinicalNotes, diagnosisText, procedureNotes) {
  const text = `${clinicalNotes} ${diagnosisText || ''} ${procedureNotes || ''}`.toLowerCase();
  const diagnoses = [];
  const procedures = [];
  const symptoms = [];

  // Simple keyword matching
  Object.keys(ICD10_COMMON).forEach(key => {
    if (text.includes(key)) {
      const confidence = text.includes(key) ? 0.65 : 0.5;
      if (['fever','headache','cough','nausea','vomiting','fatigue','diarrhea','chest pain','back pain'].includes(key)) {
        symptoms.push({ text: key, confidence });
      } else {
        diagnoses.push({ text: key, confidence });
      }
    }
  });

  Object.keys(CPT_COMMON).forEach(key => {
    if (text.includes(key)) procedures.push({ text: key, confidence: 0.6 });
  });

  const missing = [];
  if (!text.includes('duration') && !text.includes('days') && !text.includes('weeks')) missing.push('symptom duration');
  if (!text.includes('vital') && !text.includes('bp') && !text.includes('temperature')) missing.push('vital signs');
  if (!text.includes('exam') && !text.includes('examination')) missing.push('physical examination findings');

  return { diagnoses, procedures, symptoms, medications: [], missing_elements: missing, documentation_quality: diagnoses.length > 0 ? 'fair' : 'poor', overall_confidence: 0.5 };
}

// ── Code matching utility ──────────────────────────────────────────────────
function matchCode(text, codeDB) {
  if (!text) return null;
  const lower = text.toLowerCase();
  // Exact match
  if (codeDB[lower]) return { ...codeDB[lower], exactMatch: true };
  // Partial match
  for (const [key, val] of Object.entries(codeDB)) {
    if (lower.includes(key) || key.includes(lower)) return { ...val, exactMatch: false };
  }
  return null;
}

module.exports = { processCodingCase };
