require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.DATABASE_URL || process.env.DB_URL;
const pool = connectionString ? new Pool({ connectionString }) : new Pool({
  host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'swasthya_ai', user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD,
});

async function seed() {
  const client = await pool.connect();
  console.log('🌱 SwasthyaAI Seed Starting...\n');
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash('Password123!', 12);

    // ── Admin ──────────────────────────────────────────────────────────────
    const adminId = uuidv4();
    await client.query(
      `INSERT INTO admins (id,name,email,password_hash,role) VALUES ($1,'SwasthyaAI Admin','admin@swasthya.ai',$2,'admin') ON CONFLICT DO NOTHING`,
      [adminId, hash]
    );
    console.log('✅ Admin seeded: admin@swasthya.ai');

    // ── Verified Doctor ────────────────────────────────────────────────────
    let doctorId = uuidv4();
    await client.query(
      `INSERT INTO doctors (id,first_name,last_name,mobile,email,password_hash,specialization,mci_number,registration_authority,years_experience,hospital_affiliation,district,state,verification_status,mobile_verified,is_available,languages_spoken,degree_certificate,mci_certificate,additional_docs)
       VALUES ($1,'Priya','Sharma','+919876500001','dr.priya@swasthya.ai',$2,'General Physician','MCI-2019-DL-48291','NMC',8,'PHC Sendhwa','Barwani','Madhya Pradesh','verified',TRUE,TRUE,ARRAY['en','hi'],'degree_demo.pdf','mci_demo.pdf','[]')
       ON CONFLICT (mci_number) DO UPDATE SET first_name=EXCLUDED.first_name
       RETURNING id`, 
      [doctorId, hash]
    );
    const doctorRow = await client.query(`SELECT id FROM doctors WHERE mci_number='MCI-2019-DL-48291' LIMIT 1`);
    if (doctorRow.rows.length > 0) doctorId = doctorRow.rows[0].id;
    console.log('✅ Verified Doctor seeded: MCI-2019-DL-48291 / Password123!');

    // ── Sample Patient ─────────────────────────────────────────────────────
    let userId = uuidv4();
    await client.query(
      `INSERT INTO users (id,first_name,last_name,mobile,email,password_hash,village,district,state,preferred_lang,mobile_verified,health_score)
       VALUES ($1,'Ramesh','Kumar','+919876500002','ramesh@example.com',$2,'Sendhwa','Barwani','Madhya Pradesh','hi',TRUE,82)
       ON CONFLICT (mobile) DO UPDATE SET first_name=EXCLUDED.first_name
       RETURNING id`,
      [userId, hash]
    );
    const userRow = await client.query(`SELECT id FROM users WHERE mobile='+919876500002' LIMIT 1`);
    if (userRow.rows.length > 0) userId = userRow.rows[0].id;
    console.log('✅ Patient seeded: +919876500002 / Password123!');

    // ── Doctor Verification Record ─────────────────────────────────────────
    await client.query(
      `INSERT INTO doctor_verifications (id,doctor_id,status,submitted_at,reviewed_at,reviewer_notes)
       VALUES ($1,$2,'verified',NOW()-INTERVAL '3 days',NOW()-INTERVAL '1 day','All credentials verified. MCI registration confirmed. Approved.')
       ON CONFLICT DO NOTHING`,
      [uuidv4(), doctorId]
    );

    // ── Health Plan ────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO health_plans (id,patient_id,title,category,tasks,progress,who_reviewed)
       VALUES ($1,$2,'Morning Wellness Routine','morning_wellness',$3,65,TRUE) ON CONFLICT DO NOTHING`,
      [uuidv4(), userId, JSON.stringify([
        { id:'t1',title:'Wake up 6:00 AM',icon:'☀️',completed:true,order:1 },
        { id:'t2',title:'2 glasses warm water',icon:'💧',completed:true,order:2 },
        { id:'t3',title:'Triphala with honey',icon:'🌿',completed:true,order:3 },
        { id:'t4',title:'15 min Pranayama',icon:'🧘',completed:false,order:4 },
        { id:'t5',title:'Herbal tea (Tulsi+Ginger)',icon:'🍵',completed:false,order:5 },
      ])]
    );

    // ── Sample Camp ────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO camps (id,doctor_id,title,description,services,location,village,district,state,camp_date,start_time,end_time,status,registrations)
       VALUES ($1,$2,'Free Health Camp — PHC Sendhwa','Annual free health camp',ARRAY['BP Check','Blood Sugar','Eye Exam','Free Medicines'],'PHC Sendhwa','Sendhwa','Barwani','MP','2026-03-25','09:00','16:00','published',142)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), doctorId]
    );

    // ── Sample Appointment ─────────────────────────────────────────────────
    const apptId = uuidv4();
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(10,0,0,0);
    await client.query(
      `INSERT INTO appointments (id,patient_id,doctor_id,scheduled_at,duration_minutes,reason,type,status,video_provider,video_patient_url,video_doctor_url,video_room_name)
       VALUES ($1,$2,$3,$4,30,'Fever and headache for 3 days','video','scheduled','jitsi',
               'https://meet.jit.si/swasthya-demo-room-001',
               'https://meet.jit.si/swasthya-demo-room-001',
               'swasthya-demo-room-001')
       ON CONFLICT DO NOTHING`,
      [apptId, userId, doctorId, tomorrow.toISOString()]
    );
    console.log('✅ Sample appointment seeded for tomorrow 10:00 AM');

    // ── Sample Prescription (WHO approved) ────────────────────────────────
    const rxId = uuidv4();
    await client.query(
      `INSERT INTO prescriptions (id,patient_id,doctor_id,complaint,diagnosis,medicines,notes,status,is_visible_to_patient,published_at)
       VALUES ($1,$2,$3,'Fever and headache','Viral fever',$4,'Rest 3 days. Drink ORS. If fever >3 days, visit hospital.','published',TRUE,NOW()-INTERVAL '2 hours')
       ON CONFLICT DO NOTHING`,
      [rxId, userId, doctorId, JSON.stringify([
        {name:'Paracetamol 500mg',dose:'1 tab',frequency:'TDS (3x daily)',duration_days:3},
        {name:'ORS sachets',dose:'1 sachet in 1L water',frequency:'BD (twice daily)',duration_days:3},
      ])]
    );

    // WHO review for the prescription
    await client.query(
      `INSERT INTO who_reviews (id,prescription_id,reviewer_id,action,auto_check_passed,auto_check_notes,reviewer_notes,reviewed_at)
       VALUES ($1,$2,$3,'approve',TRUE,'Dosages within WHO-safe limits. No dangerous drug combinations detected.','Prescription meets clinical standards.',NOW()-INTERVAL '2 hours')
       ON CONFLICT DO NOTHING`,
      [uuidv4(), rxId, adminId]
    );
    console.log('✅ Sample WHO-approved prescription seeded');

    // ── Sample AI Advertisement ────────────────────────────────────────────
    await client.query(
      `INSERT INTO ai_advertisements (id,created_by,type,topic,target_region,severity,languages,content,is_live,pushed_at)
       VALUES ($1,$2,'pandemic_alert','Dengue Fever','Barwani District, MP','high',ARRAY['hi','en'],$3,TRUE,NOW())
       ON CONFLICT DO NOTHING`,
      [uuidv4(), doctorId, JSON.stringify({
        title_en:'Dengue Season Alert — Barwani District',
        title_hi:'डेंगू मौसम चेतावनी — बड़वानी जिला',
        body_en:'Cases reported. Take precautions immediately.',
        body_hi:'मामले दर्ज हुए हैं। तुरंत सावधानियां बरतें।',
        dos:['✅ मच्छरदानी / Mosquito nets','✅ पानी न जमने दें / No standing water'],
        donts:['❌ बुखार ignore न करें / Never ignore fever'],
      })]
    );

    // ── Demo Ops Cases ─────────────────────────────────────────────────────
    // Coding case
    const codingId = uuidv4();
    await client.query(
      `INSERT INTO coding_cases (id,case_ref,created_by,created_by_role,patient_id,clinical_notes,diagnosis_text,procedure_notes,patient_age,patient_gender,encounter_type,suggested_codes,compliance_flags,overall_confidence,status)
       VALUES ($1,'CC-2026-01001',$2,'doctor',$3,'Patient 45M presents with 3-day fever (38.8°C), severe headache, body ache, no rash. Lives in dengue-endemic area. CBC ordered: PLT 95k, WBC 3.2k.','Dengue fever, suspected','CBC, IV fluids',45,'male','outpatient',$4,$5,78.5,'human_review')
       ON CONFLICT DO NOTHING`,
      [codingId, doctorId, userId,
       JSON.stringify([
         {type:'ICD10',code:'A90',description:'Dengue fever [classical dengue]',confidence:0.88,source_text:'dengue fever'},
         {type:'ICD10',code:'R50.9',description:'Fever, unspecified',confidence:0.82,source_text:'fever 38.8°C'},
         {type:'CPT',code:'85025',description:'Blood count, complete (CBC), automated',confidence:0.90,source_text:'CBC ordered'},
         {type:'CPT',code:'99213',description:'Office/outpatient visit, established patient',confidence:0.85,source_text:'outpatient'},
       ]),
       JSON.stringify([{type:'LOW_CONFIDENCE',message:'Average confidence 78.5% — human review recommended',severity:'medium'}])]
    );

    // PA case
    const paId = uuidv4();
    await client.query(
      `INSERT INTO prior_auth_cases (id,case_ref,created_by,created_by_role,patient_id,doctor_id,requested_treatment,requested_medicine,diagnosis,patient_history,prior_therapies_tried,urgency_level,criteria_checklist,decision,decision_confidence,decision_reasoning,status,escalated)
       VALUES ($1,'PA-2026-01001',$2,'doctor',$3,$4,'Insulin analogue therapy','Insulin glargine 100U/mL','Type 2 diabetes mellitus, uncontrolled (HbA1c 10.2%)','Diabetes diagnosed 5 years ago, hypertension, BMI 29','Metformin 1g BD x 3yrs, Glipizide 5mg x 2yrs failed to achieve glycaemic target','routine',$5,'more_info_needed',72.0,'Prior therapies documented but specialist recommendation not submitted','submitted',FALSE)
       ON CONFLICT DO NOTHING`,
      [paId, doctorId, userId, doctorId,
       JSON.stringify([
         {criterion:'documented_diagnosis',label:'Documented Diagnosis',required:true,met:true,evidence:'HbA1c 10.2% documented'},
         {criterion:'conventional_insulin_tried',label:'Conventional Insulin Tried',required:true,met:false,evidence:'Not mentioned in submission'},
         {criterion:'specialist_recommendation',label:'Specialist Recommendation',required:true,met:false,evidence:'Document not submitted'},
       ])]
    );
    console.log('✅ Demo Ops cases seeded (CC-2026-01001, PA-2026-01001)');

    // Audit log entries
    await client.query(
      `INSERT INTO compliance_audit_log (case_id,case_type,case_ref,actor_id,actor_role,action,inputs_summary,final_outcome,confidence_score,human_review_required)
       VALUES ($1,'coding','CC-2026-01001',$2,'doctor','CODING_CASE_CREATED',$3,'human_review',78.5,TRUE)`,
      [codingId, doctorId, JSON.stringify({notes_length:200,patient_age:45})]
    );
    await client.query(
      `INSERT INTO compliance_audit_log (case_id,case_type,case_ref,actor_id,actor_role,action,inputs_summary,final_outcome,confidence_score,human_review_required)
       VALUES ($1,'prior_auth','PA-2026-01001',$2,'doctor','PA_CASE_CREATED',$3,'more_info_needed',72.0,TRUE)`,
      [paId, doctorId, JSON.stringify({diagnosis:'Type 2 diabetes',urgency:'routine'})]
    );

    await client.query('COMMIT');
    console.log('\n✅ Database seeded successfully!\n');
    console.log('═══════════════════════════════════════');
    console.log('🔑 Demo Login Credentials:');
    console.log('   Patient → Mobile: +919876500002  | Password: Password123!');
    console.log('   Doctor  → MCI:    MCI-2019-DL-48291 | Password: Password123!');
    console.log('   Admin   → Email:  admin@swasthya.ai  | Password: Password123!');
    console.log('═══════════════════════════════════════\n');
    console.log('📋 Demo Ops Cases:');
    console.log('   Coding Case:     CC-2026-01001 (dengue fever, human review)');
    console.log('   Prior Auth Case: PA-2026-01001 (insulin analogue, more info needed)');
    console.log('═══════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
