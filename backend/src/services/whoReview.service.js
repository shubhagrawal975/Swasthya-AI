const { query } = require('../config/database');
const { sendEmail } = require('./email.service');

// WHO Drug Safety Database (simplified - in production use a real drug DB)
const WHO_DRUG_LIMITS = {
  'paracetamol': { max_daily_mg: 4000, warning_dose: 1000 },
  'ibuprofen': { max_daily_mg: 2400, warning_dose: 800 },
  'aspirin': { max_daily_mg: 4000, contraindicated_under_16: true },
  'amoxicillin': { max_daily_mg: 3000 },
  'metformin': { max_daily_mg: 3000 },
  'amlodipine': { max_daily_mg: 10 },
  'shatavari': { max_daily_mg: 500, note: 'Ayurvedic — check dosage per classical texts' },
  'ashwagandha': { max_daily_mg: 600 },
};

const DANGEROUS_COMBINATIONS = [
  ['warfarin', 'aspirin'],
  ['metformin', 'contrast_dye'],
];

/**
 * Automated WHO protocol check for a prescription
 * Updates who_reviews table and prescription status
 */
async function runWHOAutoCheck(prescriptionId, medicines, patient) {
  const issues = [];
  const flaggedMedicines = [];
  let autoCheckPassed = true;

  // Check each medicine
  for (const med of medicines) {
    const medName = med.name?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
    const drugInfo = WHO_DRUG_LIMITS[medName];

    if (drugInfo) {
      // Check dosage (simplified check)
      const doseNum = parseFloat(med.dose);
      if (drugInfo.max_daily_mg && doseNum > drugInfo.max_daily_mg) {
        issues.push(`${med.name}: dose ${med.dose} exceeds WHO max (${drugInfo.max_daily_mg}mg/day)`);
        flaggedMedicines.push(med.name);
        autoCheckPassed = false;
      }

      // Check age contraindications
      if (drugInfo.contraindicated_under_16 && patient?.age < 16) {
        issues.push(`${med.name}: contraindicated for patients under 16`);
        flaggedMedicines.push(med.name);
        autoCheckPassed = false;
      }
    }
  }

  // Check dangerous combinations
  const medNames = medicines.map(m => m.name?.toLowerCase());
  for (const [drug1, drug2] of DANGEROUS_COMBINATIONS) {
    if (medNames.some(n => n?.includes(drug1)) && medNames.some(n => n?.includes(drug2))) {
      issues.push(`Dangerous combination detected: ${drug1} + ${drug2}`);
      autoCheckPassed = false;
    }
  }

  // Update WHO review record
  const newStatus = autoCheckPassed ? 'board_review' : 'flagged';
  const autoNotes = issues.length > 0 ? JSON.stringify(issues) : 'All automated checks passed';

  await query(
    `UPDATE who_reviews SET auto_check_passed=$1, auto_check_notes=$2, flagged_medicines=$3
     WHERE prescription_id=$4`,
    [autoCheckPassed, autoNotes, flaggedMedicines, prescriptionId]
  );

  await query(
    `UPDATE prescriptions SET status=$1 WHERE id=$2`,
    [newStatus, prescriptionId]
  );

  // Notify board for manual review
  if (autoCheckPassed) {
    await sendEmail(
      process.env.WHO_BOARD_EMAIL || 'board@swasthya.ai',
      'SwasthyaAI: Prescription Ready for Board Review',
      `<h3>Prescription passed automated WHO check</h3>
       <p>Prescription ID: <strong>${prescriptionId}</strong></p>
       <p>Awaiting board review before publishing to patient.</p>
       <a href="${process.env.FRONTEND_URL}/admin/who-review">Review Now</a>`
    );
  } else {
    await sendEmail(
      process.env.WHO_BOARD_EMAIL || 'board@swasthya.ai',
      '⚠️ SwasthyaAI: Prescription Auto-Flagged',
      `<h3>Prescription flagged by automated check</h3>
       <p>Prescription ID: <strong>${prescriptionId}</strong></p>
       <p>Issues found:</p><ul>${issues.map(i => `<li>${i}</li>`).join('')}</ul>
       <p>Doctor must revise before publication.</p>`
    );
  }

  return { autoCheckPassed, issues, newStatus };
}

module.exports = { runWHOAutoCheck };
