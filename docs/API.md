# SwasthyaAI API v3.0 Documentation

Base URL: `http://localhost:5000/api`

All authenticated endpoints require: `Authorization: Bearer <access_token>`

All responses follow:
```json
{ "success": true|false, "message": "...", "data": {} }
```

---

## Authentication

### POST /auth/register/user
Register patient. Triggers real OTP SMS.
```json
{ "first_name":"Ramesh","last_name":"Kumar","mobile":"+919876500002","password":"Password123!","village":"Sendhwa","district":"Barwani","state":"MP","preferred_lang":"hi" }
```

### POST /auth/register/doctor
Register doctor with credential upload (multipart/form-data).
Fields: first_name, last_name, mobile, email, password, specialization, mci_number, registration_authority, years_experience, hospital_affiliation, district, state + files: degree_certificate, mci_certificate

### POST /auth/login/user
```json
{ "mobile": "+919876500002", "password": "Password123!" }
```
Response includes `accessToken` + `refreshToken`. If OTP needed, returns `requires_otp: true`.

### POST /auth/login/doctor
```json
{ "mci_number": "MCI-2019-DL-48291", "password": "Password123!" }
```

### POST /auth/verify-otp
```json
{ "mobile": "+919876500002", "otp": "123456", "role": "patient" }
```

### POST /auth/refresh-token
```json
{ "refreshToken": "...", "role": "patient" }
```

### POST /auth/logout 🔒

---

## OTP

### POST /otp/send
```json
{ "mobile": "+919876500002", "purpose": "registration|login|forgot_password|doctor_register" }
```

### POST /otp/verify
```json
{ "mobile": "+919876500002", "purpose": "registration", "otp": "123456" }
```

### POST /otp/resend
```json
{ "mobile": "+919876500002", "purpose": "registration" }
```

### POST /otp/reset-password
```json
{ "mobile": "+919876500002", "otp": "123456", "new_password": "NewPass123!" }
```

---

## Appointments (Teleconsultation)

### GET /appointments/slots?doctor_id=UUID&date=YYYY-MM-DD
Returns available time slots.

### POST /appointments 🔒 (patient)
```json
{ "doctor_id":"uuid","scheduled_at":"2026-03-25T10:00:00Z","reason":"Fever","type":"video" }
```
Returns `video_room.patient_url` for Jitsi/Daily/Twilio Video.

### GET /appointments/my 🔒 (patient)
### GET /appointments/history 🔒 (patient)
### GET /appointments/doctor 🔒 (doctor)
### GET /appointments/queue 🔒 (doctor) — today's scheduled/waiting
### GET /appointments/:id 🔒
### PATCH /appointments/:id/reschedule 🔒
### PATCH /appointments/:id/cancel 🔒
### PATCH /appointments/:id/complete 🔒 (doctor)
```json
{ "doctor_notes":"...", "diagnosis":"...", "follow_up_date":"2026-04-01" }
```

### GET /video/token/:appointment_id 🔒
Returns video URL for the authenticated user's role.

---

## Consultations

### GET /consultations/messages/:appointment_id 🔒
### POST /consultations/rate/:appointment_id 🔒 (patient)
```json
{ "rating": 5, "review_text": "Excellent doctor", "is_anonymous": false }
```
### GET /consultations/follow-ups 🔒 (patient)
### GET /consultations/ratings/:doctor_id
### PATCH /consultations/vitals/:appointment_id 🔒 (doctor)

---

## Prescriptions

### POST /prescriptions 🔒 (doctor)
```json
{
  "patient_id":"uuid","complaint":"Fever 3 days","diagnosis":"Viral fever",
  "medicines":[{"name":"Paracetamol 500mg","dose":"1 tab","frequency":"TDS","duration_days":3}],
  "notes":"Rest. Drink ORS."
}
```
Triggers automated WHO check. Prescription hidden from patient until approved.

### GET /prescriptions/doctor 🔒 (doctor)
### GET /prescriptions/patient 🔒 (patient) — only published
### GET /prescriptions/who-queue 🔒 (admin)
### PATCH /prescriptions/who-review/:review_id 🔒 (admin)
```json
{ "action": "approve|flag|reject|request_revision", "notes": "..." }
```

---

## Admin

### GET /admin/dashboard 🔒 (admin)
### GET /admin/doctors/pending?status=pending 🔒 (admin)
### PATCH /admin/doctors/:doctor_id/review 🔒 (admin)
```json
{ "action": "approve|reject|request_more_info|suspend", "notes": "...", "rejection_reason": "..." }
```
### GET /admin/who-queue 🔒 (admin)
### PATCH /admin/who-review/:review_id 🔒 (admin)
### GET /admin/users 🔒 (admin)

---

## Healthcare Operations Suite

### GET /ops/dashboard 🔒
Returns aggregate counts for all ops case types.

### POST /ops/coding 🔒 (doctor|admin)
```json
{
  "clinical_notes": "Patient 45M fever 38.8°C, dengue suspected, CBC ordered...",
  "diagnosis_text": "Dengue fever",
  "procedure_notes": "CBC, IV fluids",
  "patient_age": 45,
  "patient_gender": "male",
  "encounter_type": "outpatient"
}
```
Returns: suggested ICD-10 + CPT codes, confidence scores, compliance flags, audit reasoning.

### GET /ops/coding 🔒
### GET /ops/coding/:id 🔒
### PATCH /ops/coding/:id/review 🔒 (doctor|admin)
```json
{ "action": "approved|rejected|overridden|needs_revision", "notes": "...", "overrides": [] }
```

### POST /ops/prior-auth 🔒 (doctor|admin)
```json
{
  "requested_treatment": "Insulin analogue glargine",
  "requested_medicine": "Insulin glargine 100U/mL",
  "diagnosis": "Type 2 diabetes uncontrolled (HbA1c 10.2%)",
  "patient_history": "Diabetes 5yr, hypertension",
  "prior_therapies_tried": "Metformin 1g BD, Glipizide 5mg",
  "patient_age": 52,
  "urgency_level": "routine",
  "submitted_documents": []
}
```
Returns: decision (approved|denied|more_info_needed|escalated), criteria checklist, missing evidence, audit trail.

### GET /ops/prior-auth 🔒
### GET /ops/prior-auth/:id 🔒
### PATCH /ops/prior-auth/:id/review 🔒 (admin|doctor)
```json
{ "action": "approved|denied|more_info_requested|escalated|closed", "justification": "..." }
```
**Justification is mandatory (min 10 chars) and permanently logged.**

### POST /ops/decision 🔒
```json
{
  "diagnosis_codes": [{"code":"A90","description":"Dengue fever"}],
  "procedure_codes": [{"code":"85025","description":"CBC"}],
  "clinical_summary": "45M dengue suspected...",
  "patient_age": 45,
  "patient_gender": "male"
}
```

### PATCH /ops/decision/:id/review 🔒 (admin|doctor)
```json
{ "action": "approved|denied|escalate|pend", "justification": "..." }
```

### GET /ops/audit?case_type=coding&case_ref=CC-2026-01001 🔒
### GET /ops/audit/:id 🔒
### GET /ops/audit/case/:case_id 🔒

---

## AI

### POST /ai/chat 🔒 (patient)
```json
{ "message": "I have fever", "session_id": null, "language": "hi" }
```

### POST /ai/generate-ad 🔒 (doctor)
```json
{ "type": "Pandemic Alert", "topic": "Dengue Fever", "region": "Barwani, MP", "severity": "high", "languages": ["hi","en"] }
```

### PATCH /ai/ads/:ad_id/publish 🔒 (doctor|admin)

---

## Other

### GET /doctors/list?specialization=General+Physician&district=Barwani
### GET /camps?district=Barwani
### POST /camps 🔒 (doctor) — multipart with optional banner_image
### POST /camps/:camp_id/register 🔒 (patient)
### GET /notifications 🔒
### PATCH /notifications/:id/read 🔒
### PATCH /notifications/mark-all-read 🔒
