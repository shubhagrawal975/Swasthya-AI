# 🌿 SwasthyaAI v3.0 — Rural Healthcare Operations Intelligence Platform

> AI-powered rural healthcare delivery + operations intelligence platform  
> Agentic workflows for safe triage, doctor verification, prescription review,  
> coding/compliance support, and auditable decision-making in low-resource settings.
>
> **Team TechNerds · ET GenAI Hackathon 2026**

---

## Setup Instructions

1. Install dependencies:
   npm install

2. Set up environment variables:
   Create a .env file in the backend folder

3. Run the backend:
   npm run dev

   
## 🚀 Quick Start (Docker Compose + Local Postgres)

### 1) Docker Compose local Postgres
```bash
docker compose up -d
```
Wait 5-10 seconds until Postgres is ready.

### 2) Backend setup
```bash
cd backend
cp .env.example .env
# Update or confirm these values in backend/.env:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=swasthya_ai
# DB_USER=postgres
# DB_PASSWORD=postgres
# If you prefer env URL: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/swasthya_ai
npm install
npm run db:migrate
npm run db:seed
npm run dev
```
Open backend at http://localhost:5000.

### 3) Frontend setup (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open frontend at http://localhost:5173.

### Alternate local PostgreSQL (no Docker)
```bash
# On Windows (PowerShell)
psql -U postgres -c "CREATE DATABASE swasthya_ai;"
psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
cd backend
cp .env.example .env
# Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD as your local settings
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### Common backend start issues
- If you see `password authentication failed for user "postgres"`, check `backend/.env` and your Postgres user/password. If Postgres password is different, update `DB_PASSWORD` or set `DATABASE_URL`.
- If you see `database "swasthya_ai" does not exist`, run `npm run db:migrate` first.

### Alternate local DB setup (without Docker)

```bash
# If you already have PostgreSQL installed:
psql -U postgres -c "CREATE DATABASE swasthya_ai;"
cd backend
cp .env.example .env
# Fill DB_HOST, DB_USER, DB_PASSWORD
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### Admin consoles
- Adminer: http://localhost:8080 (login with `postgres`/`postgres`)
- Backend: http://localhost:5000
- Frontend: http://localhost:5173

**Demo Credentials:**
| Role    | Credential              | Password     |
|---------|-------------------------|--------------|
| Patient | Mobile: +919876500002   | Password123! |
| Doctor  | MCI: MCI-2019-DL-48291  | Password123! |
| Admin   | admin@swasthya.ai       | Password123! |

**Demo Ops Cases:** CC-2026-01001 (Coding) · PA-2026-01001 (Prior Auth)

---

## ✅ Final Production Readiness (Judge / Deploy)

### Local run steps
```bash
# 1) Start backend
cd backend
npm install
cp .env.example .env
# set DB_* and JWT secrets
npm run db:migrate
npm run db:seed
npm run dev

# 2) Start frontend
cd ../frontend
npm install
npm run dev
```

### Build for production
```bash
cd frontend
npm run build
# optionally serve build
npx serve dist
```

### Deployment guidance (static SPA + API)
- Build frontend once (`npm run build`) and host `frontend/dist` on any static host (Netlify/Vercel/S3/Cloudflare Pages). Use hash router.
- Deploy backend separately to Node host (Heroku, Render, Railway, DigitalOcean App, AWS ECS, etc.).
- Set `VITE_API_URL` in frontend environment to your backend URL (e.g. `https://api.example.com`).
- In backend env, configure `FRONTEND_URL`, DB, JWT secrets, OTP keys, SMS keys, and video provider keys.
- Ensure CORS allows your frontend origin.
- For static hosting, the app works with hash-based routes from `HashRouter`.

### Backend env vars (important)
- `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`
- `FRONTEND_URL`, `VITE_API_URL` for frontend runtime
- `SMS_PROVIDER`, `TWILIO_*`, `MSG91_*`, etc.

### Frontend env vars
- `VITE_API_URL` (optional for production)
- `VITE_APP_NAME` (optional)

### Quick admin login (post-migrations)
- Email: `admin@swasthya.ai`
- Password: `Password123!`

---

## 🏗️ Architecture

```
SwasthyaAI/
├── backend/
│   ├── src/
│   │   ├── app.js                          # Express app, all routes
│   │   ├── server.js                       # HTTP + Socket.IO + cron
│   │   ├── config/database.js              # PostgreSQL pool + transactions
│   │   ├── controllers/
│   │   │   ├── auth.controller.js          # Register/login/OTP/refresh
│   │   │   ├── otp.controller.js           # Send/verify/resend/reset-pwd
│   │   │   ├── user.controller.js          # Patient profile, notifications
│   │   │   ├── doctor.controller.js        # Doctor profile, dashboard
│   │   │   ├── admin.controller.js         # Doctor verification, WHO queue
│   │   │   ├── appointment.controller.js   # Booking, slots, queue, history
│   │   │   ├── consultation.controller.js  # Logs, ratings, follow-ups
│   │   │   ├── prescription.controller.js  # Create Rx → WHO review pipeline
│   │   │   ├── notification.controller.js  # Get/mark-read notifications
│   │   │   └── ops/
│   │   │       └── ops.controller.js       # 🆕 Healthcare Ops Suite
│   │   ├── routes/                         # 16 route files
│   │   │   └── ops/ops.routes.js           # 🆕 All ops endpoints
│   │   ├── services/
│   │   │   ├── otp.service.js              # Real OTP: crypto.randomInt+bcrypt
│   │   │   ├── sms.service.js              # Twilio/MSG91/Fast2SMS/console
│   │   │   ├── video.service.js            # Jitsi/Daily/Twilio Video
│   │   │   ├── email.service.js            # Nodemailer SMTP
│   │   │   ├── whoReview.service.js        # Automated WHO drug check
│   │   │   ├── cleanup.service.js          # Cron cleanup jobs
│   │   │   └── ops/
│   │   │       ├── coding.service.js       # 🆕 ICD-10/CPT extraction agent
│   │   │       ├── priorAuth.service.js    # 🆕 PA decision engine
│   │   │       └── decisionSupport.service.js # 🆕 Case consistency checker
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js          # JWT verify, RBAC
│   │   │   ├── rateLimiter.js              # 5 different limiters
│   │   │   ├── errorHandler.js             # Centralized error handling
│   │   │   ├── validate.js                 # express-validator middleware
│   │   │   └── upload.js (utils/)          # Multer file handler
│   │   └── sockets/socket.js               # Socket.IO teleconsult
│   ├── database/
│   │   ├── migrate.js
│   │   └── seed.js
│   └── .env.example
├── database/migrations/
│   ├── 001_schema.sql                      # Base 15+ tables
│   ├── 002_enhanced_schema.sql             # Appointments, consultations, ratings
│   └── 003_ops_suite.sql                   # 🆕 Coding/PA/Decision/Audit tables
├── frontend/
│   └── src/
│       ├── App.jsx                         # React Router with /ops route
│       ├── pages/
│       │   ├── HomePage.jsx                # Navbar, hero, WHO section, footer
│       │   ├── LoginPage.jsx               # Patient/Doctor sign in + register
│       │   ├── UserDashboard.jsx           # Home/AI/Plans/Consult/Rx/More
│       │   ├── DoctorDashboard.jsx         # Sidebar + all doctor panels
│       │   ├── ops/OpsPage.jsx             # 🆕 Healthcare Operations Suite
│       │   ├── TermsPage.jsx, HelpPage.jsx, NotFoundPage.jsx
│       ├── components/
│       │   ├── otp/OTPInput.jsx            # Real OTP: 6-box, countdown, API
│       │   ├── teleconsult/TeleconsultBooking.jsx # Slot picker + video
│       │   ├── prescription/PrescriptionTimeline.jsx # WHO review pipeline
│       │   ├── audit/AuditReasoningPanel.jsx # 🆕 Structured audit UI
│       │   └── shared/                     # LanguagePill, LoadingSpinner
│       ├── services/
│       │   ├── api.js                      # Axios + token refresh interceptor
│       │   ├── appointmentAPI.js           # All appointment + ops + admin APIs
│       │   └── index.js                    # All service exports
│       └── store/authStore.js              # Zustand persist
└── docs/API.md, DEPLOYMENT.md
```

---

## ✅ Features (Fully Implemented)

### Rural Health Platform (Original + Enhanced)
- Patient dashboard: AI doctor chat, health plans, teleconsult, prescriptions, notifications
- Doctor dashboard: Queue, chats, prescriptions, camps, AI ads, associations, WHO queue + **Ops Suite entry**
- Multilingual: 10 languages (EN, HI, MR, BN, TE, TA, GU, FR, AR, SW)
- Offline-ready: Core features cached in localStorage

### OTP Authentication (Real)
- `crypto.randomInt` generation — never stored plain
- `bcrypt` hashing before DB storage
- 10-min expiry, 60-sec cooldown, 5-attempt lockout
- SMS: Twilio / MSG91 / Fast2SMS / console (graceful fallback)

### Teleconsultation (Real)
- Slot generation, booking, reschedule, cancel, complete
- Socket.IO: real-time queue, WebRTC signalling, in-session chat
- Video: Jitsi (zero-config, free) / Daily.co / Twilio Video

### Doctor Verification (Real)
- 4-step registration: Basic → Credentials → Document upload → OTP
- `doctor_verifications` table with full status history
- Admin review: approve/reject/request_more_info/suspend + SMS + email
- Verification badge shown in doctor sidebar

### WHO Prescription Review (Real)
- Statuses: draft → submitted → who_check → board_review → published/flagged/rejected
- `PrescriptionTimeline.jsx` visual pipeline for patients
- Medicines hidden until board approval (enforced DB + UI)

### 🆕 Healthcare Operations Suite
- **Medical Coding Agent** (`coding.service.js`): Claude AI extracts ICD-10 + CPT codes, confidence scores, compliance flags, missing doc warnings, rule-based fallback
- **Prior Authorization Engine** (`priorAuth.service.js`): Criteria checklist, contraindication DB, duplicate detection, AI-assisted decision, full audit trail
- **Case Decision Support** (`decisionSupport.service.js`): 15 consistency rules, 8 age-specific rules, duplicate check, documentation completeness
- **Compliance Audit Console**: Every decision logged in `compliance_audit_log` with inputs, steps, rules, flags, outcome, confidence, reviewer
- **Human-in-the-Loop**: Approve/reject/request info/escalate/override — justification mandatory

### 🆕 AuditReasoningPanel.jsx
- Decision badge + confidence bar
- Tabbed: Decision | Criteria | Flags | Steps | Audit Trail | Codes
- Flag severity coloring (critical/high/medium/low)
- Step timeline with timestamps
- Policy note + disclaimer display

### Database
- 3 migrations: 20+ tables total
- `003_ops_suite.sql`: coding_cases, prior_auth_cases, decision_cases, compliance_audit_log
- Auto-increment case refs (CC-YYYY-NNNNN, PA-YYYY-NNNNN, DC-YYYY-NNNNN)

---

## ⚙️ Requires API Keys / Deployment

| Feature         | Configure in `.env`                         |
|-----------------|---------------------------------------------|
| Real SMS        | `SMS_PROVIDER=twilio` + `TWILIO_*`          |
| Daily.co Video  | `VIDEO_PROVIDER=daily` + `DAILY_API_KEY`    |
| Twilio Video    | `VIDEO_PROVIDER=twilio_video` + keys        |
| AI coding/PA    | `ANTHROPIC_API_KEY`                         |
| Email           | `SMTP_*` credentials                        |

Without keys: SMS→console log, Video→Jitsi (free), AI→rule-based fallback, Email→skipped.

---

## ⚠️ Honest Disclosures

| UI Label            | Actual Reality                                        |
|---------------------|-------------------------------------------------------|
| "WHO Reviewed"      | Internal medical board — not connected to real WHO    |
| "MCI Verified"      | Manual admin review — not querying MCI database       |
| ICD-10/CPT codes    | AI-assisted suggestions — not licensed ICD/CPT data   |
| Prior Authorization | Internal workflow — not connected to insurance payers |
| Medical AI advice   | Claude AI with health prompt — not a licensed device  |


## API Overview

- POST /api/ai → handles AI-based user queries
- Processes input and returns generated response


## Notes
- Initial prototype completed with core backend and AI integration
- Further improvements planned for validation, error handling, and scalability


## Final Thoughts

This project demonstrates the integration of AI services within a scalable backend architecture.  
Future scope includes improved validation, better error handling, and optimized response processing.
