import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LanguagePill from '../components/shared/LanguagePill';

const STATS = [
  { value:'2M+',  label:'Rural Patients',  icon:'👥' },
  { value:'800+', label:'Verified Doctors', icon:'🩺' },
  { value:'94%',  label:'Claim Accuracy',   icon:'✅' },
  { value:'9',    label:'Languages',        icon:'🌐' },
];

const STORY_POINTS = [
  { icon:'🏥', title:'Patient Registers & Consults', desc:'Village patient registers in Hindi, books free teleconsult, gets AI triage summary — even on 2G.', color:'#e8f5ee', border:'#b0d8c0' },
  { icon:'👨‍⚕️', title:'Verified Doctor Reviews', desc:'WHO-credential-checked doctor reviews case, issues prescription, adds Ayurveda + allopathy notes.', color:'#ebf4ff', border:'#bee3f8' },
  { icon:'🏷️', title:'AI Codes the Consultation', desc:'Ops agent auto-suggests ICD-10 + CPT codes from clinical notes, flags ambiguities for human review.', color:'#f0ebff', border:'#d6bcfa' },
  { icon:'📋', title:'Prior Auth & Claims Flow', desc:'Agent checks coverage criteria, generates prior auth request, submits coded claim — with full audit trail.', color:'#fef3dc', border:'#f6c46a' },
  { icon:'💰', title:'Clinic Gets Reimbursed', desc:'Rural clinic receives faster reimbursement. Reduced paperwork. Traceable, compliant, trusted.', color:'#fff5f5', border:'#fed7d7' },
];

const AGENT_CARDS = [
  { icon:'🏷️', name:'Medical Coding Agent',          desc:'ICD-10 + CPT extraction from rural consultation notes. Handles Ayurveda + allopathy hybrid documentation.', badge:'Coding' },
  { icon:'⚖️', name:'Claims Adjudication Agent',     desc:'Policy-aware claims review for NGO, government schemes, and private insurance. Rule-conflict detection.', badge:'Claims' },
  { icon:'📋', name:'Prior Authorization Agent',      desc:'Treatment necessity checks, coverage criteria, urgency flags, escalation to human reviewer.', badge:'Prior Auth' },
  { icon:'💊', name:'Prescription Compliance Agent',  desc:'WHO protocol checks, dangerous interaction flags, Ayurveda separation, unverified doctor blocks.', badge:'Compliance' },
  { icon:'🔁', name:'Referral & Follow-up Agent',    desc:'Specialist referral generation, follow-up scheduling, continuity-of-care tracking for rural patients.', badge:'Referral' },
  { icon:'📢', name:'Public Health Campaign Agent',  desc:'AI-generated multilingual alerts, health camp notifications, epidemic response coordination.', badge:'Public Health' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d1e35', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── NAVBAR ── */}
      <nav className="sticky top-0 z-50 flex-shrink-0" style={{ background: 'rgba(13,30,53,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg,#1a5c3a,#3db87a)' }}>🌿</div>
            <span className="text-lg font-bold text-white" style={{ fontFamily: "'Playfair Display',serif" }}>
              Swasthya<span style={{ color: '#f5a623' }}>AI</span>
            </span>
            <span className="hidden md:inline text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(61,184,122,.15)', color: '#3db87a', border: '1px solid rgba(61,184,122,.25)' }}>
              Rural Healthcare Ops
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {[['#story','Our Story'],['#agents','Ops Agents'],['#workflow','Workflow'],['#who','WHO Review']].map(([href, label]) => (
              <a key={href} href={href} className="px-3 py-2 text-sm font-semibold rounded-lg transition-colors"
                style={{ color: 'rgba(255,255,255,.55)' }}
                onMouseEnter={e => e.target.style.color='#fff'} onMouseLeave={e => e.target.style.color='rgba(255,255,255,.55)'}>
                {label}
              </a>
            ))}
            <div className="w-px h-5 mx-2" style={{ background: 'rgba(255,255,255,.12)' }} />
            <button onClick={() => navigate('/login')} className="px-4 py-2 text-sm font-bold rounded-lg border transition-all" style={{ border: '1px solid rgba(255,255,255,.25)', color: '#fff' }}>
              Sign In
            </button>
            <button onClick={() => navigate('/login')} className="ml-1 px-4 py-2 text-sm font-extrabold rounded-lg transition-all" style={{ background: '#f5a623', color: '#0d1e35' }}>
              Get Started →
            </button>
            <div className="ml-2"><LanguagePill dark /></div>
          </div>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <LanguagePill dark />
            <button onClick={() => navigate('/login')} className="px-3 py-1.5 text-sm font-bold rounded-lg" style={{ background: '#f5a623', color: '#0d1e35' }}>Login</button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(160deg,#0d1e35 0%,#091c33 40%,#0d2d1a 100%)' }}>
        {/* Grid bg */}
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)', backgroundSize: '56px 56px' }} />
        {/* Orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(61,184,122,.1),transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle,rgba(245,166,35,.07),transparent 70%)' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-5 py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center mb-12">
            {/* Badge row */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {['🌿 Rural-First','🤖 AI Operations','🏥 WHO-Aligned','🌐 10 Languages','📴 Offline-Ready'].map(b => (
                <span key={b} className="text-[10px] font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.65)' }}>{b}</span>
              ))}
            </div>

            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-5" style={{ fontFamily: "'Playfair Display',serif" }}>
              AI Healthcare for<br />
              <span style={{ color: '#f5a623' }}>Every Village</span>
              <br />
              <span className="text-3xl md:text-4xl" style={{ color: 'rgba(255,255,255,.6)' }}>+ Operations Intelligence</span>
            </h1>

            <p className="text-base md:text-lg leading-relaxed mb-8 max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,.6)' }}>
              SwasthyaAI brings verified doctors, Ayurveda + modern care, and free teleconsultation to rural India —
              while helping clinics, NGOs, and health programs handle <strong style={{ color: '#f5a623' }}>coding, claims, prior authorization,
              and compliance</strong> with auditable AI agents.
            </p>

            <div className="flex flex-wrap gap-3 justify-center mb-8">
              <button onClick={() => navigate('/login')} className="px-8 py-3.5 text-base font-extrabold rounded-full transition-all hover:shadow-2xl" style={{ background: '#f5a623', color: '#0d1e35' }}>
                Get Started Free →
              </button>
              <button onClick={() => navigate('/login')} className="px-8 py-3.5 text-base font-bold rounded-full transition-all" style={{ background: 'rgba(255,255,255,.08)', color: '#fff', border: '1px solid rgba(255,255,255,.2)' }}>
                Doctor / Clinic Portal
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto">
              {STATS.map(s => (
                <div key={s.label} className="rounded-2xl p-3 text-center" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
                  <div className="text-xl mb-1">{s.icon}</div>
                  <div className="font-extrabold text-lg" style={{ color: '#f5a623', fontFamily: "'Playfair Display',serif" }}>{s.value}</div>
                  <div className="text-[10px] leading-tight mt-0.5" style={{ color: 'rgba(255,255,255,.4)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero visual — platform preview */}
          <div className="hidden md:grid grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { icon:'👩‍⚕️', title:'Patient Dashboard', sub:'Hindi AI assistant, health plans, free consult', tag:'For Patients', color:'#e8f5ee' },
              { icon:'🩺', title:'Doctor Portal', sub:'Verified credentials, prescriptions, WHO review', tag:'For Doctors', color:'#ebf4ff' },
              { icon:'⚙️', title:'Operations Suite', sub:'Coding · Claims · Prior Auth · Audit', tag:'For Clinics & Partners', color:'#fef3dc' },
            ].map(card => (
              <div key={card.title} className="rounded-2xl p-4 cursor-pointer transition-all hover:-translate-y-1" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }} onClick={() => navigate('/login')}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: card.color }}>{card.icon}</div>
                <div className="text-sm font-bold text-white mb-1">{card.title}</div>
                <div className="text-xs leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,.45)' }}>{card.sub}</div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.6)' }}>{card.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLATFORM STORY ── */}
      <section id="story" className="py-16 px-5" style={{ background: '#071524' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#3db87a' }}>End-to-End Patient Journey</div>
            <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "'Playfair Display',serif" }}>
              From Village Consultation to<br />Clinic Reimbursement
            </h2>
            <p className="text-sm mt-3 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,.45)' }}>
              One platform connects patient care with operational efficiency — reducing paperwork, improving compliance, and ensuring rural clinics get paid.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {STORY_POINTS.map((s, i) => (
              <div key={s.title} className="relative">
                {i < STORY_POINTS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 z-10" style={{ background: 'linear-gradient(90deg,rgba(255,255,255,.15),transparent)', transform: 'translateX(-50%)' }} />
                )}
                <div className="rounded-2xl p-4 h-full" style={{ background: 'rgba(255,255,255,.04)', border: `1px solid ${s.border}30` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base mb-3" style={{ background: s.color }}>{s.icon}</div>
                  <div className="text-xs font-black mb-1" style={{ color: 'rgba(255,255,255,.3)' }}>STEP {i + 1}</div>
                  <div className="text-sm font-bold text-white mb-1">{s.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.45)' }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RURAL PROBLEM → SOLUTION ── */}
      <section className="py-16 px-5" style={{ background: '#0a1e30' }}>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#f5a623' }}>Why This Exists</div>
            <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "'Playfair Display',serif" }}>
              Rural Healthcare Faces<br />Unique Operational Barriers
            </h2>
            <div className="space-y-3">
              {[
                ['📄','Poor Documentation','Rural doctors lack structured note-taking tools, causing claim rejections.'],
                ['❌','Delayed Reimbursements','Manual coding + paper claims take 30-90 days. Clinics can\'t sustain operations.'],
                ['🌿','Ayurveda + Allopathy Mix','Hybrid care is poorly documented — insurers don\'t know what to cover.'],
                ['📶','Low Connectivity','Health workers need offline-first tools that sync when internet returns.'],
                ['🔒','Trust & Compliance Gaps','Unverified practitioners, unsafe prescriptions, no audit trail.'],
              ].map(([icon, title, desc]) => (
                <div key={title} className="flex gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                  <span className="text-xl flex-shrink-0">{icon}</span>
                  <div>
                    <div className="text-sm font-bold text-white">{title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.4)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#3db87a' }}>SwasthyaAI Solves This</div>
            <div className="space-y-3">
              {[
                ['🤖','AI-Structured Notes','Voice/text consultation notes auto-structured into codeable clinical records.','#e8f5ee','#276749'],
                ['⚡','Faster Claims','Coded claims submitted in minutes, not weeks. Audit trail built-in.','#ebf4ff','#2b6cb0'],
                ['🌿','Hybrid Documentation','Separate Ayurveda + allopathy coding paths with policy-aware coverage notes.','#f0ebff','#6b46c1'],
                ['📴','Offline First','Works fully offline. Syncs automatically when connectivity returns.','#fef3dc','#92600a'],
                ['🔐','Verified & Auditable','Doctor credentials verified. Every AI decision logged with full reasoning.','#f0f9f4','#1a5c3a'],
              ].map(([icon, title, desc, bg, color]) => (
                <div key={title} className="flex gap-3 p-3 rounded-xl" style={{ background: bg + '20', border: `1px solid ${bg}40` }}>
                  <span className="text-xl flex-shrink-0">{icon}</span>
                  <div>
                    <div className="text-sm font-bold" style={{ color }}>{title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.5)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── OPERATIONS AGENTS ── */}
      <section id="agents" className="py-16 px-5" style={{ background: '#071524' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#f5a623' }}>Healthcare Operations Intelligence</div>
            <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "'Playfair Display',serif" }}>Six Specialized AI Agents<br />Built for Rural Healthcare Ops</h2>
            <p className="text-sm mt-3 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,.45)' }}>
              Every agent produces auditable decisions, flags edge cases, and routes to human reviewers when confidence is low.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {AGENT_CARDS.map(card => (
              <div key={card.name} className="rounded-2xl p-5 transition-all hover:-translate-y-1 cursor-pointer" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }} onClick={() => navigate('/login')}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{card.icon}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,166,35,.15)', color: '#f5a623', border: '1px solid rgba(245,166,35,.2)' }}>{card.badge}</span>
                </div>
                <div className="font-bold text-sm text-white mb-2" style={{ fontFamily: "'Playfair Display',serif" }}>{card.name}</div>
                <div className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,.45)' }}>{card.desc}</div>
                <div className="flex flex-wrap gap-1">
                  {['Audit Trail','Human Override','Confidence Score'].map(tag => (
                    <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.4)' }}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="workflow" className="py-16 px-5" style={{ background: '#0a1e30' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#3db87a' }}>Simple Process</div>
            <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "'Playfair Display',serif" }}>How SwasthyaAI Works</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { n:'1', icon:'📝', title:'Patient Registers', desc:'Free account in local language. Works on 2G. Offline mode available.' },
              { n:'2', icon:'🤖', title:'AI Triage + Consult', desc:'Multilingual AI health assistant + free video consultation with verified doctor.' },
              { n:'3', icon:'🏷️', title:'Ops Agent Codes', desc:'Consultation auto-coded with ICD-10/CPT. Prescriptions checked for compliance.' },
              { n:'4', icon:'💰', title:'Clinic Gets Paid', desc:'Coded claim submitted. Prior auth handled. Full audit trail. Faster reimbursement.' },
            ].map(({ n, icon, title, desc }) => (
              <div key={n} className="rounded-2xl p-5 text-center transition-all hover:-translate-y-1" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
                <div className="w-9 h-9 rounded-full text-sm font-extrabold flex items-center justify-center mx-auto mb-3" style={{ background: '#f5a623', color: '#0d1e35' }}>{n}</div>
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-sm font-bold text-white mb-1">{title}</div>
                <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.45)' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO REVIEW ── */}
      <section id="who" className="py-16 px-5" style={{ background: '#071524' }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: '#00b4a0' }}>Safety First</div>
            <h2 className="text-3xl font-bold text-white mb-4 leading-tight" style={{ fontFamily: "'Playfair Display',serif" }}>
              WHO-Aligned Review at<br />Every Step
            </h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(255,255,255,.5)' }}>
              No prescription reaches a patient without safety review. No claim is auto-approved without policy checks.
              Every AI decision is auditable, explainable, and overrideable by human reviewers.
            </p>
            <div className="space-y-2">
              {[
                ['✅','Doctor credentials verified by Medical Board before activation'],
                ['✅','Every prescription checked against WHO drug safety protocols'],
                ['✅','AI operations agents show full reasoning — no black boxes'],
                ['✅','Human-in-the-loop override on every major decision'],
                ['✅','Emergency cases auto-escalated to senior reviewer'],
                ['✅','Ayurveda recommendations clearly labeled as doctor-reviewed guidance'],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(255,255,255,.6)' }}>
                  <span style={{ color: '#3db87a', flexShrink: 0 }}>{icon}</span>{text}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {[
              { n:'1', title:'Doctor Submits Consultation + Prescription', desc:'After teleconsult, doctor submits structured notes, diagnosis, and medicines via portal.' },
              { n:'2', title:'AI Protocol Check', desc:'System checks dosages, combinations, WHO guidelines, and interaction risks within seconds.' },
              { n:'3', title:'Medical Board Review', desc:'Human reviewer sees AI findings. Approves, flags, or requests revision. Avg: 2-4 hours.' },
              { n:'4', title:'Published + Coded + Claimed', desc:'Patient sees approved prescription. Clinic gets coded consultation. Claim submitted.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex gap-3 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
                <div className="w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#00b4a0', color: '#071524' }}>{n}</div>
                <div>
                  <div className="text-sm font-bold text-white mb-0.5">{title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.45)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section className="py-16 px-5" style={{ background: '#0a1e30' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "'Playfair Display',serif" }}>One Platform, Every Stakeholder</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { icon:'🧑‍🌾', title:'Rural Patients', items:['Free AI health assistant','Teleconsultation','Health plans & preventive care','Prescription tracking','Multilingual + offline'] },
              { icon:'👨‍⚕️', title:'Verified Doctors', items:['Credential-verified portal','Patient queue management','Prescription + WHO review','AI ad generation','Ops agent access'] },
              { icon:'🏥', title:'Rural Clinics & NGOs', items:['Medical coding support','Claims submission','Prior authorization','Billing compliance','Audit dashboard'] },
              { icon:'🔍', title:'Reviewers & Admin', items:['Doctor verification queue','WHO prescription review','Ops case management','Full audit console','Human override tools'] },
            ].map(card => (
              <div key={card.title} className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
                <div className="text-3xl mb-3">{card.icon}</div>
                <div className="font-bold text-sm text-white mb-3">{card.title}</div>
                <div className="space-y-1.5">
                  {card.items.map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,.5)' }}>
                      <span style={{ color: '#3db87a', flexShrink: 0 }}>•</span>{item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-5" style={{ background: 'linear-gradient(135deg,#1a5c3a,#0d1e35)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-4xl mb-4">🌿</div>
          <h2 className="text-3xl font-bold text-white mb-4" style={{ fontFamily: "'Playfair Display',serif" }}>
            Healthcare that Reaches Every Village
          </h2>
          <p className="text-sm leading-relaxed mb-8 max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,.6)' }}>
            SwasthyaAI is a platform where rural care delivery and healthcare operations intelligence work as one.
            Whether you are a patient, doctor, clinic, NGO, or reviewer — your workflow is here.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button onClick={() => navigate('/login')} className="px-8 py-3.5 font-extrabold text-base rounded-full" style={{ background: '#f5a623', color: '#0d1e35' }}>
              Start Free →
            </button>
            <button onClick={() => navigate('/login')} className="px-8 py-3.5 font-bold text-base rounded-full" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)' }}>
              Clinic / Ops Portal
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="flex-shrink-0 px-5 py-8" style={{ background: '#040d18', borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="font-bold text-lg text-white" style={{ fontFamily: "'Playfair Display',serif" }}>Swasthya<span style={{ color: '#f5a623' }}>AI</span></div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.2)' }}>© 2026 Team TechNerds · ET GenAI Hackathon · Rural Healthcare Operations Intelligence</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['🌿 Rural-First','🏥 WHO-Aligned','🤖 Ops Agents','🛡️ Auditable','📴 Offline-Ready'].map(b => (
              <span key={b} className="text-[10px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: 'rgba(255,255,255,.35)' }}>{b}</span>
            ))}
          </div>
          <div className="flex gap-4">
            {[['Login','/login'],['Terms','/terms'],['Help','/help']].map(([l,p]) => (
              <button key={l} onClick={() => navigate(p)} className="text-xs transition-colors" style={{ color: 'rgba(255,255,255,.3)' }}>{l}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
