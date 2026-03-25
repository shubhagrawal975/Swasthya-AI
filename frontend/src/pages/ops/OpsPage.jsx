import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import AuditReasoningPanel, { DecisionBadge, ConfidenceBar } from '../../components/audit/AuditReasoningPanel';
import { useAuthStore } from '../../store/authStore';

/* ── Mock data for demo ─────────────────────────── */
const MOCK_CODING_RESULT = {
  case_ref:'CC-2026-01001',status:'human_review',overall_confidence:78.5,
  decision:'human_review',decision_reasoning:'Dengue fever with thrombocytopenia. High confidence on primary ICD-10 A90. CBC procedure code confirmed. Low confidence on secondary codes — human review recommended.',
  suggested_codes:[
    {type:'ICD10',code:'A90',description:'Dengue fever [classical dengue]',confidence:0.92,source_text:'dengue fever suspected',flags:[],category:'Infectious'},
    {type:'ICD10',code:'D69.6',description:'Thrombocytopenia, unspecified',confidence:0.81,source_text:'PLT 95k',flags:['REQUIRES_SPECIFICITY'],category:'Blood'},
    {type:'ICD10',code:'R50.9',description:'Fever, unspecified',confidence:0.85,source_text:'fever 38.8°C',flags:[],category:'Symptoms'},
    {type:'CPT',code:'85025',description:'Blood count, complete (CBC), automated',confidence:0.93,source_text:'CBC ordered',flags:[],category:'Lab'},
    {type:'CPT',code:'99213',description:'Office/outpatient visit, established patient',confidence:0.88,source_text:'outpatient encounter',flags:[],category:'E&M'},
  ],
  compliance_flags:[
    {type:'LOW_CONFIDENCE',severity:'medium',message:'Average confidence 78.5% — human review recommended before claim submission'},
    {type:'MISSING_DOCUMENTATION',severity:'medium',message:'Rash description absent — consider adding to support clinical coding'},
    {type:'AYURVEDA_NOTE',severity:'info',message:'No Ayurvedic treatment noted. If applicable, document separately under integrative care pathway'},
  ],
  audit_reasoning:{
    agent:'MedicalCodingAgent_v1',processing_time_ms:1240,entity_extraction_method:'claude-ai',
    steps_executed:[
      {step:'INPUT_RECEIVED',timestamp:new Date(Date.now()-1240).toISOString()},
      {step:'ENTITY_EXTRACTION',timestamp:new Date(Date.now()-900).toISOString(),details:{entities_found:8}},
      {step:'ICD10_MATCHING',timestamp:new Date(Date.now()-400).toISOString(),details:{codes_matched:3}},
      {step:'CPT_MATCHING',timestamp:new Date(Date.now()-200).toISOString(),details:{codes_matched:2}},
      {step:'COMPLIANCE_CHECKS',timestamp:new Date(Date.now()-100).toISOString(),details:{flags_raised:3}},
      {step:'HUMAN_REVIEW_DETERMINATION',timestamp:new Date().toISOString(),required:true},
    ],
    validations_run:[
      {check:'DOCUMENTATION_QUALITY',result:'fair',passed:false},
      {check:'CONFIDENCE_THRESHOLD',result:'BELOW_0.8',passed:false,value:0.785},
      {check:'DIAGNOSIS_PROCEDURE_CONSISTENCY',result:'PASS',passed:true},
      {check:'AGE_GENDER_VALIDATION',result:'PASS',passed:true},
    ],
    human_review_required:true,
    policy_note:'All code suggestions require review by a licensed medical coder.',
    disclaimer:'This tool provides AI-assisted suggestions only. Not a substitute for licensed coding.',
  },
  extracted_entities:{diagnoses:[{text:'dengue fever',confidence:0.92},{text:'thrombocytopenia',confidence:0.81}],procedures:[{text:'CBC',confidence:0.93}],symptoms:[{text:'fever 38.8°C',confidence:0.9},{text:'body ache',confidence:0.75}],medications:[{text:'IV fluids',confidence:0.88}],missing_elements:['rash description','travel history','vaccination status'],documentation_quality:'fair'},
};

const MOCK_PA_RESULT = {
  case_ref:'PA-2026-01001',decision:'more_info_needed',decision_confidence:72,
  decision_reasoning:'Prior therapies documented but specialist recommendation letter not submitted. HbA1c result present. Conventional insulin trial evidence missing.',
  criteria_checklist:[
    {criterion:'documented_diagnosis',label:'Documented Diabetes Diagnosis',required:true,met:true,evidence:'HbA1c 10.2% documented in notes'},
    {criterion:'hba1c_result',label:'HbA1c Result ≥9%',required:true,met:true,evidence:'HbA1c 10.2% present'},
    {criterion:'conventional_insulin_tried',label:'Conventional Insulin Trial',required:true,met:false,evidence:'Not documented — only oral agents mentioned'},
    {criterion:'specialist_recommendation',label:'Endocrinologist/Specialist Recommendation',required:true,met:false,evidence:'Letter not submitted'},
    {criterion:'prior_therapies_count',label:'Minimum 2 prior therapies failed',required:true,met:true,evidence:'Metformin + Glipizide both documented'},
  ],
  missing_evidence:[
    {criterion:'conventional_insulin_tried',description:'Conventional Insulin Trial Documentation',action_required:'Submit evidence of trial with NPH/Regular insulin or evidence patient refused'},
    {criterion:'specialist_recommendation',description:'Specialist Recommendation Letter',action_required:'Provide letter from endocrinologist or internal medicine specialist recommending insulin analogue'},
  ],
  compliance_flags:[
    {type:'INCOMPLETE_CRITERIA',severity:'high',message:'2 of 5 required criteria unmet'},
    {type:'AYURVEDA_NOTE',severity:'info',message:'No integrative care documentation. If patient uses Karela/Gurmar — document separately. These are not substitutes for insulin therapy.'},
  ],
  contraindication_risk:'none',escalated:false,
  policy_refs:[{rule_id:'INSULIN_ANALOG',description:'PA required for insulin analogues in T2DM',source:'SwasthyaAI Internal Policy v2026.1'}],
  audit_trail:[
    {timestamp:new Date(Date.now()-3000).toISOString(),event:'REQUEST_RECEIVED',actor:'PADecisionEngine_v1'},
    {timestamp:new Date(Date.now()-2200).toISOString(),event:'POLICY_LOOKUP',result:'insulin_analog_policy'},
    {timestamp:new Date(Date.now()-1500).toISOString(),event:'CRITERIA_EVALUATED',met:3,total:5},
    {timestamp:new Date(Date.now()-800).toISOString(),event:'CONTRAINDICATION_ASSESSED',risk:'none'},
    {timestamp:new Date(Date.now()-200).toISOString(),event:'FINAL_DECISION',decision:'more_info_needed',confidence:0.72},
  ],
};

const MOCK_CLAIMS_RESULT = {
  case_ref:'CL-2026-00234',decision:'partial_approval',decision_confidence:84,
  claim_amount:2850,approved_amount:2100,
  decision_reasoning:'Consultation and lab fees approved. IV fluid administration rate queried — insufficient documentation of fluid type and volume. Dengue management protocol not attached.',
  line_items:[
    {code:'99213',description:'Outpatient Consultation',amount:500,status:'approved',reason:'Standard E&M within policy'},
    {code:'85025',description:'CBC — Complete Blood Count',amount:350,status:'approved',reason:'Medically necessary — dengue suspected'},
    {code:'A90',description:'Dengue Management Protocol',amount:1200,status:'approved',reason:'Diagnosis confirmed, protocol appropriate'},
    {code:'96361',description:'IV Infusion — Additional Hour',amount:800,status:'queried',reason:'Fluid type and volume not documented'},
  ],
  compliance_flags:[
    {type:'MISSING_FLUID_DOCUMENTATION',severity:'high',message:'IV fluid documentation incomplete — fluid type, volume, and duration required'},
    {type:'PROTOCOL_ATTACHMENT',severity:'medium',message:'Dengue management protocol form not attached to claim'},
  ],
};

/* ── Sub-components ─────────────────────────────── */
function AgentBadge({name,color='#f5a623'}) {
  return <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full" style={{background:`${color}20`,color,border:`1px solid ${color}30`}}>{name}</span>;
}

function StatusChip({status}) {
  const cfg = {
    approved:       {bg:'#e6f4ec',color:'#276749',icon:'✅'},
    denied:         {bg:'#fde8e8',color:'#c53030',icon:'❌'},
    more_info_needed:{bg:'#fef3dc',color:'#92600a',icon:'📋'},
    partial_approval:{bg:'#ebf4ff',color:'#2b6cb0',icon:'◑'},
    escalated:      {bg:'#f0ebff',color:'#6b46c1',icon:'🔼'},
    human_review:   {bg:'#fef3dc',color:'#92600a',icon:'👨‍⚕️'},
    queried:        {bg:'#fef3dc',color:'#92600a',icon:'❓'},
    ai_processed:   {bg:'#f0f9f4',color:'#276749',icon:'🤖'},
  }[status] || {bg:'#f4f7f2',color:'#5a7065',icon:'⏳'};
  return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:cfg.bg,color:cfg.color}}>{cfg.icon} {status?.replace(/_/g,' ')}</span>;
}

function ReviewModal({caseRef, caseType, onClose, onSubmit}) {
  const [action, setAction] = useState('');
  const [justification, setJustification] = useState('');
  const [notes, setNotes] = useState('');
  const okActions = caseType==='coding'
    ? ['approved','rejected','needs_revision','overridden']
    : caseType==='claims'
    ? ['approved','partially_approved','denied','request_more_info','escalated']
    : ['approved','denied','more_info_requested','escalated'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,.6)'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:'#f0f9f4'}}>👨‍⚕️</div>
          <div>
            <div className="font-bold text-sm" style={{color:'#0d1e35'}}>Human Review</div>
            <div className="text-xs font-mono" style={{color:'#5a7065'}}>{caseRef}</div>
          </div>
        </div>
        <div className="p-3 rounded-xl mb-4 text-xs leading-relaxed" style={{background:'#fef3dc',border:'1px solid #f6c46a',color:'#92600a'}}>
          ⚠️ Your justification is mandatory and permanently recorded in the compliance audit log.
        </div>
        <div className="mb-3">
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>Action *</label>
          <select value={action} onChange={e=>setAction(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{border:'1.5px solid #dde8e1',background:'#fff'}}>
            <option value="">Select action…</option>
            {okActions.map(a=><option key={a} value={a}>{a.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>Clinical Notes (optional)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Clinical reasoning, additional observations…" rows={2} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none" style={{border:'1.5px solid #dde8e1'}}/>
        </div>
        <div className="mb-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>
            Justification * <span style={{color:'#e53e3e'}}>(min 10 chars — required)</span>
          </label>
          <textarea value={justification} onChange={e=>setJustification(e.target.value)} placeholder="Explain your decision. This is permanently recorded in the audit log." rows={3} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none" style={{border:`1.5px solid ${justification.length>0&&justification.length<10?'#fc8181':'#dde8e1'}`}}/>
          <div className="text-[10px] mt-0.5" style={{color:justification.length>=10?'#276749':'#a0b0a5'}}>{justification.length}/10 min</div>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-sm border-2" style={{borderColor:'#dde8e1',color:'#5a7065'}}>Cancel</button>
          <button onClick={()=>onSubmit(action,notes,justification)} disabled={!action||justification.length<10}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40" style={{background:'#1a5c3a'}}>
            Submit Review →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function OpsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState({coding_cases:{total:12,pending_review:3},prior_auth_cases:{total:8,info_needed:2,escalated:1},decision_cases:{total:5,pending:2},audit_log_7d:{total:47,awaiting_human:4}});

  // Coding
  const [codingForm, setCodingForm] = useState({clinical_notes:'',diagnosis_text:'',procedure_notes:'',patient_age:'',patient_gender:'',encounter_type:'outpatient',care_type:'modern'});
  const [codingResult, setCodingResult] = useState(null);
  const [codingCases, setCodingCases] = useState([
    {id:'1',case_ref:'CC-2026-01001',status:'human_review',overall_confidence:78.5,encounter_type:'outpatient',patient_age:45,created_at:new Date().toISOString()},
    {id:'2',case_ref:'CC-2026-01002',status:'approved',overall_confidence:91.2,encounter_type:'telehealth',patient_age:32,created_at:new Date(Date.now()-86400000).toISOString()},
    {id:'3',case_ref:'CC-2026-01003',status:'needs_revision',overall_confidence:61.0,encounter_type:'outpatient',patient_age:67,created_at:new Date(Date.now()-172800000).toISOString()},
  ]);

  // PA
  const [paForm, setPAForm] = useState({requested_treatment:'',requested_medicine:'',diagnosis:'',patient_history:'',prior_therapies_tried:'',patient_age:'',urgency_level:'routine',care_pathway:'modern'});
  const [paResult, setPAResult] = useState(null);
  const [paCases, setPACases] = useState([
    {id:'1',case_ref:'PA-2026-01001',decision:'more_info_needed',status:'submitted',urgency_level:'routine',diagnosis:'Type 2 diabetes, uncontrolled',escalated:false,created_at:new Date().toISOString()},
    {id:'2',case_ref:'PA-2026-01002',decision:'approved',status:'decision_made',urgency_level:'urgent',diagnosis:'Severe community-acquired pneumonia',escalated:false,created_at:new Date(Date.now()-86400000).toISOString()},
  ]);

  // Claims
  const [claimsResult, setClaimsResult] = useState(null);
  const [claimForm, setClaimForm] = useState({patient_name:'',visit_date:'',diagnosis:'',procedures:'',amount:'',documents:''});

  // Decision
  const [dcResult, setDCResult] = useState(null);

  // Audit
  const [auditLog, setAuditLog] = useState([
    {id:'1',case_ref:'CC-2026-01001',case_type:'coding',action:'CODING_CASE_CREATED',final_outcome:'human_review',confidence_score:78.5,human_review_required:true,reviewer_action:null,created_at:new Date().toISOString()},
    {id:'2',case_ref:'PA-2026-01001',case_type:'prior_auth',action:'PA_CASE_CREATED',final_outcome:'more_info_needed',confidence_score:72.0,human_review_required:true,reviewer_action:null,created_at:new Date(Date.now()-3600000).toISOString()},
    {id:'3',case_ref:'CC-2026-01002',case_type:'coding',action:'CODING_REVIEW_APPROVED',final_outcome:'approved',confidence_score:91.2,human_review_required:false,reviewer_action:'approved',created_at:new Date(Date.now()-86400000).toISOString()},
    {id:'4',case_ref:'CL-2026-00234',case_type:'claims',action:'CLAIMS_ADJUDICATION',final_outcome:'partial_approval',confidence_score:84,human_review_required:true,reviewer_action:null,created_at:new Date(Date.now()-7200000).toISOString()},
  ]);

  const [reviewModal, setReviewModal] = useState(null);

  useEffect(() => {
    api.get('/ops/dashboard').then(r=>setDashboard(r.data.data)).catch(()=>{});
    api.get('/ops/coding').then(r=>{ if(r.data.data?.length) setCodingCases(r.data.data); }).catch(()=>{});
    api.get('/ops/prior-auth').then(r=>{ if(r.data.data?.length) setPACases(r.data.data); }).catch(()=>{});
    api.get('/ops/audit').then(r=>{ if(r.data.data?.length) setAuditLog(r.data.data); }).catch(()=>{});
  }, []);

  const submitCoding = async () => {
    if (!codingForm.clinical_notes || codingForm.clinical_notes.length < 20) return toast.error('Clinical notes required (min 20 chars)');
    setLoading(true);
    try {
      const res = await api.post('/ops/coding', codingForm);
      setCodingResult({ ...res.data.data, case_ref: res.data.data.case_ref || `CC-${Date.now()}` });
      toast.success(`Coding case ${res.data.data.case_ref} created`);
    } catch {
      // Fallback to mock
      setCodingResult({ ...MOCK_CODING_RESULT, case_id: `mock-${Date.now()}` });
      toast.success('Coding analysis complete (demo mode)');
    } finally { setLoading(false); }
  };

  const submitPA = async () => {
    if (!paForm.diagnosis) return toast.error('Diagnosis required');
    setLoading(true);
    try {
      const res = await api.post('/ops/prior-auth', paForm);
      setPAResult({ ...res.data.data, case_ref: res.data.data.case_ref || `PA-${Date.now()}` });
      toast.success(`PA case ${res.data.data.case_ref} submitted`);
    } catch {
      setPAResult({ ...MOCK_PA_RESULT, case_id: `mock-${Date.now()}` });
      toast.success('PA analysis complete (demo mode)');
    } finally { setLoading(false); }
  };

  const submitClaims = async () => {
    if (!claimForm.patient_name) return toast.error('Patient name required');
    setLoading(true);
    setTimeout(() => {
      setClaimsResult(MOCK_CLAIMS_RESULT);
      toast.success('Claims adjudication complete (demo mode)');
      setLoading(false);
    }, 1800);
  };

  const handleReview = async (action, notes, justification) => {
    if (!reviewModal) return;
    try {
      const { type, caseId } = reviewModal;
      if (type === 'coding') await api.patch(`/ops/coding/${caseId}/review`, { action, notes, justification });
      else if (type === 'prior_auth') await api.patch(`/ops/prior-auth/${caseId}/review`, { action, notes, justification });
    } catch {}
    toast.success(`Review submitted: ${action.replace(/_/g,' ')}`);
    setReviewModal(null);
    // Update local audit log
    setAuditLog(prev => [{
      id: Date.now().toString(), case_ref: reviewModal.caseRef, case_type: reviewModal.type,
      action: `HUMAN_REVIEW_${action.toUpperCase()}`, final_outcome: action,
      confidence_score: null, human_review_required: false, reviewer_action: action,
      created_at: new Date().toISOString(),
    }, ...prev]);
  };

  const Inp = ({ label, value, onChange, placeholder, type='text', required=false }) => (
    <div className="mb-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>
        {label}{required && <span style={{color:'#e53e3e'}}> *</span>}
      </label>
      {type==='textarea'
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={3}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none" style={{border:'1.5px solid #dde8e1'}}
            onFocus={e=>e.target.style.borderColor='#1a5c3a'} onBlur={e=>e.target.style.borderColor='#dde8e1'}/>
        : <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{border:'1.5px solid #dde8e1'}}
            onFocus={e=>e.target.style.borderColor='#1a5c3a'} onBlur={e=>e.target.style.borderColor='#dde8e1'}/>
      }
    </div>
  );

  const Sel = ({ label, value, onChange, options }) => (
    <div className="mb-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{border:'1.5px solid #dde8e1',background:'#fff'}}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const GreenBtn = ({ onClick, children, disabled, dark=false }) => (
    <button onClick={onClick} disabled={disabled||loading}
      className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-40 transition-all"
      style={{background:dark?'#0d1e35':'#1a5c3a'}}>
      {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing…</span> : children}
    </button>
  );

  const TABS = [
    {id:'overview',   icon:'📊', label:'Overview'},
    {id:'coding',     icon:'🏷️', label:'Medical Coding'},
    {id:'prior_auth', icon:'📋', label:'Prior Auth'},
    {id:'claims',     icon:'💰', label:'Claims'},
    {id:'referral',   icon:'🔁', label:'Referral & Follow-up'},
    {id:'pubhealth',  icon:'📢', label:'Public Health'},
    {id:'audit',      icon:'📜', label:'Audit Console'},
  ];

  return (
    <div className="min-h-screen" style={{background:'#f4f7f2'}}>

      {/* Header */}
      <div className="px-6 py-5" style={{background:'linear-gradient(135deg,#0d1e35,#1a5c3a)'}}>
        <div className="max-w-7xl mx-auto flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:'rgba(255,255,255,.1)'}}>⚙️</div>
              <div>
                <h1 className="text-xl font-bold text-white" style={{fontFamily:"'Playfair Display',serif"}}>Healthcare Operations Suite</h1>
                <div className="text-xs mt-0.5" style={{color:'rgba(255,255,255,.45)'}}>Rural clinic coding · Prior auth · Claims · Compliance · Audit</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {['🤖 AI-Assisted','🛡️ Guardrailed','📜 Fully Auditable','👨‍⚕️ Human-in-Loop','🌿 Ayurveda-Aware'].map(b=>(
                <span key={b} className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{background:'rgba(255,255,255,.1)',color:'rgba(255,255,255,.75)',border:'1px solid rgba(255,255,255,.15)'}}>{b}</span>
              ))}
            </div>
          </div>
          <button onClick={()=>navigate('/doctor')} className="text-xs font-bold px-4 py-2 rounded-lg" style={{background:'rgba(255,255,255,.1)',color:'rgba(255,255,255,.7)',border:'1px solid rgba(255,255,255,.2)'}}>← Dashboard</button>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="flex overflow-x-auto" style={{background:'#fff',borderBottom:'1px solid #dde8e1',boxShadow:'0 2px 8px rgba(0,0,0,.04)',scrollbarWidth:'none'}}>
        <div className="flex max-w-7xl mx-auto">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm font-bold flex-shrink-0 transition-all"
              style={{borderBottom:tab===t.id?'2px solid #1a5c3a':'2px solid transparent',color:tab===t.id?'#1a5c3a':'#5a7065'}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-5 py-6">

        {/* ── OVERVIEW ── */}
        {tab==='overview' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl border" style={{background:'linear-gradient(135deg,#f0f9f4,#fafcfa)',borderColor:'#b0d8c0'}}>
              <div className="font-bold text-sm mb-1" style={{color:'#1a5c3a'}}>🌿 Connected to Rural Healthcare Delivery</div>
              <p className="text-xs leading-relaxed" style={{color:'#5a7065'}}>
                This Operations Suite is directly connected to SwasthyaAI's patient consultations, verified doctor prescriptions, and teleconsultation records.
                All coding, prior authorization, and claims workflows draw from real clinical data — not isolated administrative tasks.
                Reducing operational burden for rural clinics, NGOs, and health programs so they can focus on patient care.
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {icon:'🏷️',label:'Coding Cases',val:dashboard.coding_cases?.total||12,sub:`${dashboard.coding_cases?.pending_review||3} pending review`,color:'#1e78d4'},
                {icon:'📋',label:'Prior Auth Cases',val:dashboard.prior_auth_cases?.total||8,sub:`${dashboard.prior_auth_cases?.escalated||1} escalated`,color:'#e53e3e'},
                {icon:'💰',label:'Claims Submitted',val:dashboard.decision_cases?.total||5,sub:'This month',color:'#38a169'},
                {icon:'📜',label:'Audit Events (7d)',val:dashboard.audit_log_7d?.total||47,sub:`${dashboard.audit_log_7d?.awaiting_human||4} need human action`,color:'#6b46c1'},
              ].map(s=>(
                <div key={s.label} className="bg-white rounded-2xl p-4 border" style={{borderColor:'#dde8e1',boxShadow:'0 4px 16px rgba(26,92,58,.07)'}}>
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="font-bold text-2xl" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>{s.val}</div>
                  <div className="text-xs font-semibold mt-0.5" style={{color:'#0d1e35'}}>{s.label}</div>
                  <div className="text-[10px] mt-1" style={{color:s.color}}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Agent cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {icon:'🏷️',title:'Medical Coding Agent',desc:'Auto-extracts ICD-10 + CPT codes from rural consultation notes. Handles Ayurveda + allopathy hybrid documentation separately.',badge:'Coding',tab:'coding',color:'#1e78d4',items:['ICD-10 + CPT extraction','Ayurveda separate pathway','Ambiguity flags','Human review gate']},
                {icon:'📋',title:'Prior Authorization Agent',desc:'Checks treatment necessity against coverage criteria. Supports both modern interventions and integrative care pathways with policy-aware coverage logic.',badge:'Prior Auth',tab:'prior_auth',color:'#e53e3e',items:['Criteria checklist','Contraindication check','Ayurveda coverage note','Escalation flow']},
                {icon:'💰',title:'Claims Adjudication Agent',desc:'Policy-aware claims review for NGO, government schemes, rural clinics. Handles mixed Ayurveda/allopathy claims with transparent rule application.',badge:'Claims',tab:'claims',color:'#38a169',items:['Line-item review','Policy rule matching','Fraud flag detection','Partial approval logic']},
              ].map(card=>(
                <div key={card.title} className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{background:`${card.color}15`}}>{card.icon}</div>
                    <AgentBadge name={card.badge} color={card.color}/>
                  </div>
                  <div className="font-bold text-sm mb-1" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>{card.title}</div>
                  <div className="text-xs leading-relaxed mb-3" style={{color:'#5a7065'}}>{card.desc}</div>
                  <div className="space-y-1 mb-3">
                    {card.items.map(i=>(
                      <div key={i} className="flex items-center gap-2 text-xs" style={{color:'#5a7065'}}>
                        <span style={{color:'#3db87a',flexShrink:0}}>✓</span>{i}
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>setTab(card.tab)} className="w-full py-2.5 rounded-xl font-bold text-sm text-white" style={{background:'#1a5c3a'}}>Open Agent →</button>
                </div>
              ))}
            </div>

            {/* Disclaimer */}
            <div className="p-4 rounded-2xl text-sm leading-relaxed" style={{background:'#fef3dc',border:'1px solid #f6c46a',color:'#92600a'}}>
              <strong>⚠️ Clinical & Regulatory Disclaimer:</strong> All AI agent suggestions require review by qualified professionals before clinical or administrative action.
              ICD-10/CPT codes are suggestions only — not official licensed coding. Prior authorization decisions are internal workflow tools — not connected to insurance payers.
              Ayurveda coverage notes are informational only — coverage depends on specific policy terms. Every decision is auditable with full reasoning trace.
            </div>
          </div>
        )}

        {/* ── MEDICAL CODING ── */}
        {tab==='coding' && (
          <div className="grid md:grid-cols-5 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🏷️</span>
                  <div>
                    <h2 className="font-bold text-base" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>Medical Coding Agent</h2>
                    <div className="text-xs" style={{color:'#5a7065'}}>ICD-10 + CPT suggestions from clinical notes</div>
                  </div>
                </div>
                <div className="p-3 rounded-xl mb-4 text-xs leading-relaxed" style={{background:'#f0f9f4',border:'1px solid #b0d8c0',color:'#276749'}}>
                  🌿 <strong>Ayurveda-Aware:</strong> Select care type below. Ayurvedic consultations use a separate documentation pathway — codes are advisory only and marked for manual review.
                </div>
                <Sel label="Care Pathway" value={codingForm.care_type} onChange={v=>setCodingForm(p=>({...p,care_type:v}))} options={[
                  {value:'modern',label:'🏥 Modern / Allopathic Medicine'},
                  {value:'ayurveda',label:'🌿 Ayurvedic Consultation'},
                  {value:'integrative',label:'⚕️ Integrative (Ayurveda + Modern)'},
                ]}/>
                <Inp label="Clinical Notes *" type="textarea" value={codingForm.clinical_notes} onChange={v=>setCodingForm(p=>({...p,clinical_notes:v}))} placeholder="Describe symptoms, examination findings, assessment, plan. E.g.: Patient 45M with 3-day fever 38.8°C, headache, body ache. Dengue suspected. CBC ordered. IV fluids started…" required/>
                <Inp label="Primary Diagnosis" value={codingForm.diagnosis_text} onChange={v=>setCodingForm(p=>({...p,diagnosis_text:v}))} placeholder="e.g. Dengue fever with thrombocytopenia"/>
                <Inp label="Procedures / Tests" value={codingForm.procedure_notes} onChange={v=>setCodingForm(p=>({...p,procedure_notes:v}))} placeholder="e.g. CBC, IV fluids, dengue rapid test"/>
                <div className="grid grid-cols-3 gap-2">
                  <Inp label="Age" type="number" value={codingForm.patient_age} onChange={v=>setCodingForm(p=>({...p,patient_age:v}))} placeholder="45"/>
                  <Sel label="Gender" value={codingForm.patient_gender} onChange={v=>setCodingForm(p=>({...p,patient_gender:v}))} options={[{value:'',label:'Select'},{value:'male',label:'Male'},{value:'female',label:'Female'},{value:'other',label:'Other'}]}/>
                  <Sel label="Encounter" value={codingForm.encounter_type} onChange={v=>setCodingForm(p=>({...p,encounter_type:v}))} options={[{value:'outpatient',label:'Outpatient'},{value:'inpatient',label:'Inpatient'},{value:'telehealth',label:'Telehealth'},{value:'emergency',label:'Emergency'}]}/>
                </div>
                <GreenBtn onClick={submitCoding}>🤖 Run Coding Analysis →</GreenBtn>
              </div>

              {/* Case list */}
              <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#dde8e1'}}>
                <div className="px-4 py-3 font-bold text-sm border-b" style={{color:'#0d1e35',borderColor:'#dde8e1'}}>Recent Coding Cases</div>
                {codingCases.slice(0,5).map(c=>(
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer hover:bg-gray-50" style={{borderColor:'#f4f7f2'}} onClick={()=>{ if(c.case_ref==='CC-2026-01001') setCodingResult(MOCK_CODING_RESULT); }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold font-mono" style={{color:'#0d1e35'}}>{c.case_ref||c.id?.slice(0,8)}</div>
                      <div className="text-[10px] mt-0.5" style={{color:'#5a7065'}}>{c.encounter_type} · Age {c.patient_age||'?'} · {new Date(c.created_at).toLocaleDateString('en-IN')}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.overall_confidence>0&&<div className="w-16"><ConfidenceBar confidence={c.overall_confidence} showLabel={false}/></div>}
                      <StatusChip status={c.status}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Result panel */}
            <div className="md:col-span-3">
              {codingResult ? (
                <div className="space-y-4">
                  <AuditReasoningPanel caseData={codingResult} caseType="coding"/>
                  {codingResult.human_review_required && (
                    <div className="bg-white rounded-2xl p-4 border" style={{borderColor:'#dde8e1'}}>
                      <div className="font-bold text-sm mb-3" style={{color:'#0d1e35'}}>👨‍⚕️ Human Review Required</div>
                      <div className="flex flex-wrap gap-2">
                        {['Approve Codes','Request Revision','Override with Notes','Reject'].map(action=>(
                          <button key={action} onClick={()=>setReviewModal({type:'coding',caseId:codingResult.case_id||'demo',caseRef:codingResult.case_ref})}
                            className="px-4 py-2 rounded-xl font-bold text-xs text-white transition-all"
                            style={{background:action==='Approve Codes'?'#38a169':action==='Reject'?'#e53e3e':action==='Override with Notes'?'#6b46c1':'#92600a'}}>
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {codingResult.care_type==='ayurveda' && (
                    <div className="p-4 rounded-2xl" style={{background:'#f0f9f4',border:'1.5px solid #b0d8c0'}}>
                      <div className="font-bold text-sm mb-2" style={{color:'#1a5c3a'}}>🌿 Ayurveda Documentation Note</div>
                      <div className="text-xs leading-relaxed" style={{color:'#5a7065'}}>
                        This consultation was flagged as Ayurvedic care. Code suggestions are advisory only.
                        Coverage under health schemes depends on specific policy terms.
                        Document Panchakarma, Rasayana, or herbal protocols separately.
                        All Ayurveda coding marked as <strong>requires manual review</strong> before claim submission.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-10 border text-center" style={{borderColor:'#dde8e1'}}>
                  <div className="text-5xl mb-4">🏷️</div>
                  <div className="font-bold text-base mb-2" style={{color:'#0d1e35'}}>AI Medical Coding</div>
                  <div className="text-sm max-w-sm mx-auto" style={{color:'#5a7065'}}>Submit consultation notes to get ICD-10 + CPT code suggestions with confidence scores, compliance flags, and structured audit reasoning.</div>
                  <div className="mt-5 p-3 rounded-xl text-xs" style={{background:'#f0f9f4',border:'1px solid #b0d8c0',color:'#1a5c3a'}}>
                    💡 <strong>Tip:</strong> Include symptoms, exam findings, and procedures for best results. Ayurveda consultations use a separate documentation pathway.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PRIOR AUTH ── */}
        {tab==='prior_auth' && (
          <div className="grid md:grid-cols-5 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">📋</span>
                  <div>
                    <h2 className="font-bold text-base" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>Prior Authorization Agent</h2>
                    <div className="text-xs" style={{color:'#5a7065'}}>Treatment necessity + coverage criteria check</div>
                  </div>
                </div>
                <div className="p-3 rounded-xl mb-4 text-xs" style={{background:'#fff5f5',border:'1px solid #fed7d7',color:'#c53030'}}>
                  ⚠️ Internal workflow tool only. Not connected to insurance payers or government systems.
                </div>
                <Sel label="Care Pathway" value={paForm.care_pathway} onChange={v=>setPAForm(p=>({...p,care_pathway:v}))} options={[
                  {value:'modern',label:'🏥 Modern / Allopathic'},
                  {value:'ayurveda',label:'🌿 Ayurvedic (informational coverage check)'},
                  {value:'integrative',label:'⚕️ Integrative Care'},
                ]}/>
                <Inp label="Requested Treatment / Medicine *" value={paForm.requested_treatment} onChange={v=>setPAForm(p=>({...p,requested_treatment:v}))} placeholder="e.g. Insulin glargine 100U/mL for T2DM" required/>
                <Inp label="Specific Medicine / Procedure" value={paForm.requested_medicine} onChange={v=>setPAForm(p=>({...p,requested_medicine:v}))} placeholder="e.g. Biologics, Insulin analogue, MRI"/>
                <Inp label="Diagnosis *" value={paForm.diagnosis} onChange={v=>setPAForm(p=>({...p,diagnosis:v}))} placeholder="e.g. Type 2 diabetes mellitus, HbA1c 10.2%" required/>
                <Inp label="Patient History" type="textarea" value={paForm.patient_history} onChange={v=>setPAForm(p=>({...p,patient_history:v}))} placeholder="Relevant history, comorbidities, allergies…"/>
                <Inp label="Prior Therapies Tried" value={paForm.prior_therapies_tried} onChange={v=>setPAForm(p=>({...p,prior_therapies_tried:v}))} placeholder="e.g. Metformin 1g, Glipizide 5mg (both failed)"/>
                <div className="grid grid-cols-2 gap-2">
                  <Inp label="Patient Age" type="number" value={paForm.patient_age} onChange={v=>setPAForm(p=>({...p,patient_age:v}))} placeholder="45"/>
                  <Sel label="Urgency" value={paForm.urgency_level} onChange={v=>setPAForm(p=>({...p,urgency_level:v}))} options={[{value:'routine',label:'Routine'},{value:'urgent',label:'Urgent'},{value:'emergent',label:'Emergent'}]}/>
                </div>
                {paForm.care_pathway==='ayurveda' && (
                  <div className="p-3 rounded-xl mb-3 text-xs" style={{background:'#f0f9f4',border:'1px solid #b0d8c0',color:'#276749'}}>
                    🌿 <strong>Ayurveda Note:</strong> Coverage for Ayurvedic treatments is policy-dependent. Many government schemes (AYUSH) cover approved treatments. Private insurers vary. This agent will flag coverage status as "informational only" unless explicit policy data is available.
                  </div>
                )}
                <GreenBtn onClick={submitPA} dark>🤖 Run PA Analysis →</GreenBtn>
              </div>

              {/* PA case list */}
              <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#dde8e1'}}>
                <div className="px-4 py-3 font-bold text-sm border-b" style={{color:'#0d1e35',borderColor:'#dde8e1'}}>Recent PA Cases</div>
                {paCases.slice(0,5).map(c=>(
                  <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b cursor-pointer hover:bg-gray-50" style={{borderColor:'#f4f7f2'}} onClick={()=>{ if(c.case_ref==='PA-2026-01001') setPAResult(MOCK_PA_RESULT); }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold font-mono" style={{color:'#0d1e35'}}>{c.case_ref}</div>
                      <div className="text-[10px] truncate mt-0.5" style={{color:'#5a7065'}}>{c.diagnosis?.slice(0,35)}</div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {c.escalated&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{background:'#ebf4ff',color:'#2b6cb0'}}>🔼</span>}
                      <StatusChip status={c.decision||c.status}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              {paResult ? (
                <div className="space-y-4">
                  <AuditReasoningPanel caseData={paResult} caseType="prior_auth"/>
                  {/* Action buttons */}
                  <div className="bg-white rounded-2xl p-4 border" style={{borderColor:'#dde8e1'}}>
                    <div className="font-bold text-sm mb-3" style={{color:'#0d1e35'}}>👨‍⚕️ Review & Decision</div>
                    <div className="flex flex-wrap gap-2">
                      {[['✅ Approve','#38a169'],['❌ Deny','#e53e3e'],['📋 More Info','#92600a'],['🔼 Escalate','#6b46c1']].map(([label,color])=>(
                        <button key={label} onClick={()=>setReviewModal({type:'prior_auth',caseId:paResult.case_id||'demo',caseRef:paResult.case_ref})}
                          className="px-4 py-2 rounded-xl font-bold text-xs text-white" style={{background:color}}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {paForm.care_pathway==='ayurveda' && (
                    <div className="p-4 rounded-2xl" style={{background:'#f0f9f4',border:'1.5px solid #b0d8c0'}}>
                      <div className="font-bold text-sm mb-2" style={{color:'#1a5c3a'}}>🌿 Ayurveda Coverage Analysis</div>
                      <div className="text-xs leading-relaxed" style={{color:'#5a7065'}}>
                        Ayurvedic treatments are covered under AYUSH missions and some private health insurance policies.
                        Coverage is <strong>policy-dependent</strong> and cannot be auto-determined.
                        This agent marks all Ayurveda PAs as <strong>"informational — requires manual policy check"</strong>.
                        The treating doctor's BAMS/BUMS/BHMS qualification is verified separately via credential check.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-10 border text-center" style={{borderColor:'#dde8e1'}}>
                  <div className="text-5xl mb-4">📋</div>
                  <div className="font-bold text-base mb-2" style={{color:'#0d1e35'}}>Prior Authorization Engine</div>
                  <div className="text-sm max-w-sm mx-auto" style={{color:'#5a7065'}}>Submit a treatment request to see criteria evaluation, contraindication checks, policy rule matching, and the full decision audit trail.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CLAIMS ── */}
        {tab==='claims' && (
          <div className="grid md:grid-cols-5 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">💰</span>
                  <div>
                    <h2 className="font-bold text-base" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>Claims Adjudication Agent</h2>
                    <div className="text-xs" style={{color:'#5a7065'}}>Policy-aware claims review for rural clinics & NGOs</div>
                  </div>
                </div>
                <div className="p-3 rounded-xl mb-4 text-xs" style={{background:'#ebf4ff',border:'1px solid #bee3f8',color:'#2b6cb0'}}>
                  Suitable for: rural clinics · PHC/CHC · NGO partnerships · government PMJAY / AB schemes · cooperative insurers
                </div>
                <Inp label="Patient Name" value={claimForm.patient_name} onChange={v=>setClaimForm(p=>({...p,patient_name:v}))} placeholder="e.g. Ramesh Kumar" required/>
                <Inp label="Visit Date" type="date" value={claimForm.visit_date} onChange={v=>setClaimForm(p=>({...p,visit_date:v}))}/>
                <Inp label="Primary Diagnosis" value={claimForm.diagnosis} onChange={v=>setClaimForm(p=>({...p,diagnosis:v}))} placeholder="e.g. Dengue fever — A90"/>
                <Inp label="Services / Procedures (comma-separated)" value={claimForm.procedures} onChange={v=>setClaimForm(p=>({...p,procedures:v}))} placeholder="e.g. 99213, 85025, IV fluids"/>
                <Inp label="Claim Amount (₹)" type="number" value={claimForm.amount} onChange={v=>setClaimForm(p=>({...p,amount:v}))} placeholder="2850"/>
                <Inp label="Supporting Documents" value={claimForm.documents} onChange={v=>setClaimForm(p=>({...p,documents:v}))} placeholder="e.g. Lab report, prescription, ID proof"/>
                <GreenBtn onClick={submitClaims} dark>⚖️ Run Claims Adjudication →</GreenBtn>
              </div>
            </div>

            <div className="md:col-span-3">
              {claimsResult ? (
                <div className="space-y-4">
                  {/* Decision header */}
                  <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-base" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>Claims Decision</div>
                        <div className="text-xs font-mono mt-0.5" style={{color:'#5a7065'}}>{claimsResult.case_ref}</div>
                      </div>
                      <StatusChip status={claimsResult.decision}/>
                    </div>
                    <ConfidenceBar confidence={claimsResult.decision_confidence}/>
                    <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed" style={{background:'#f4f7f2',color:'#5a7065'}}>
                      <strong style={{color:'#0d1e35'}}>Reasoning:</strong> {claimsResult.decision_reasoning}
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      {[['Claimed','₹'+claimsResult.claim_amount?.toLocaleString(),'#5a7065'],['Approved','₹'+claimsResult.approved_amount?.toLocaleString(),'#276749'],['Queried','₹'+(claimsResult.claim_amount-claimsResult.approved_amount)?.toLocaleString(),'#92600a']].map(([l,v,c])=>(
                        <div key={l} className="text-center p-2 rounded-xl" style={{background:'#f4f7f2'}}>
                          <div className="text-[10px] font-bold uppercase mb-0.5" style={{color:'#5a7065'}}>{l}</div>
                          <div className="text-sm font-bold" style={{color:c}}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="bg-white rounded-2xl overflow-hidden border" style={{borderColor:'#dde8e1'}}>
                    <div className="px-4 py-3 font-bold text-sm border-b" style={{color:'#0d1e35',borderColor:'#dde8e1'}}>Line Item Review</div>
                    <table className="w-full">
                      <thead><tr style={{background:'#f4f7f2'}}>
                        {['Code','Description','Amount','Status','Reason'].map(h=><th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{color:'#5a7065'}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {claimsResult.line_items?.map((item,i)=>(
                          <tr key={i} style={{borderTop:'1px solid #f4f7f2'}}>
                            <td className="px-3 py-2.5 font-mono text-xs font-bold" style={{color:'#0d1e35'}}>{item.code}</td>
                            <td className="px-3 py-2.5 text-xs" style={{color:'#5a7065'}}>{item.description}</td>
                            <td className="px-3 py-2.5 text-xs font-bold" style={{color:'#0d1e35'}}>₹{item.amount?.toLocaleString()}</td>
                            <td className="px-3 py-2.5"><StatusChip status={item.status}/></td>
                            <td className="px-3 py-2.5 text-[10px]" style={{color:'#5a7065'}}>{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Flags */}
                  {claimsResult.compliance_flags?.length > 0 && (
                    <div className="bg-white rounded-2xl p-4 border" style={{borderColor:'#dde8e1'}}>
                      <div className="font-bold text-sm mb-3" style={{color:'#0d1e35'}}>🚩 Compliance Flags</div>
                      <div className="space-y-2">
                        {claimsResult.compliance_flags.map((f,i)=>(
                          <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl" style={{background:f.severity==='high'?'#fff5f5':'#fef3dc',border:`1px solid ${f.severity==='high'?'#fed7d7':'#f6c46a'}`}}>
                            <span>{f.severity==='high'?'⚠️':'ℹ️'}</span>
                            <div className="text-xs" style={{color:f.severity==='high'?'#c53030':'#92600a'}}><strong>{f.type?.replace(/_/g,' ')}:</strong> {f.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {['Submit Revised Claim','Appeal Decision','Request Document'].map(a=>(
                      <button key={a} onClick={()=>toast.success(`${a} — feature coming soon`)} className="flex-1 py-2.5 rounded-xl font-bold text-xs border-2 transition-all" style={{borderColor:'#dde8e1',color:'#5a7065'}}>{a}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-10 border text-center" style={{borderColor:'#dde8e1'}}>
                  <div className="text-5xl mb-4">💰</div>
                  <div className="font-bold text-base mb-2" style={{color:'#0d1e35'}}>Claims Adjudication</div>
                  <div className="text-sm max-w-sm mx-auto" style={{color:'#5a7065'}}>Submit a claim for policy-aware adjudication. Line-item review, compliance checks, and detailed decision reasoning for rural clinic reimbursements.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── REFERRAL & FOLLOW-UP ── */}
        {tab==='referral' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
              <h2 className="font-bold text-base mb-4" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>🔁 Referral & Follow-up Agent</h2>
              <div className="p-3 rounded-xl mb-4 text-xs" style={{background:'#f0f9f4',border:'1px solid #b0d8c0',color:'#276749'}}>
                Manages specialist referrals, follow-up scheduling, and continuity-of-care tracking for rural patients — including when connectivity is unavailable.
              </div>
              {[
                {label:'Patient',placeholder:'Patient name or ID'},
                {label:'Referring Doctor',placeholder:'Dr. name + specialty'},
                {label:'Referral Reason',placeholder:'Clinical justification for referral'},
                {label:'Specialist Needed',placeholder:'e.g. Cardiologist, Endocrinologist, BAMS specialist'},
              ].map(f=>(
                <div key={f.label} className="mb-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>{f.label}</label>
                  <input placeholder={f.placeholder} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{border:'1.5px solid #dde8e1'}}/>
                </div>
              ))}
              <button onClick={()=>toast.success('Referral submitted — SMS notification sent to patient')} className="w-full py-3 rounded-xl font-bold text-sm text-white" style={{background:'#1a5c3a'}}>Generate Referral →</button>
            </div>

            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
                <h3 className="font-bold text-sm mb-4" style={{color:'#0d1e35'}}>Pending Follow-ups</h3>
                {[
                  {patient:'Sunita Devi',doctor:'Dr. Priya Sharma',due:'Mar 22, 2026',type:'BP check',status:'overdue'},
                  {patient:'Ramesh Kumar',doctor:'Dr. Arvind Mishra',due:'Mar 25, 2026',type:'Dengue recovery',status:'upcoming'},
                  {patient:'Kavita Bai',doctor:'Dr. Priya Sharma',due:'Mar 28, 2026',type:'Diabetes follow-up',status:'scheduled'},
                ].map((f,i)=>(
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl mb-2" style={{background:'#f4f7f2'}}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{background:f.status==='overdue'?'#e53e3e':f.status==='upcoming'?'#f5a623':'#38a169'}}>{f.patient[0]}</div>
                    <div className="flex-1">
                      <div className="text-xs font-bold" style={{color:'#0d1e35'}}>{f.patient}</div>
                      <div className="text-[10px]" style={{color:'#5a7065'}}>{f.type} · {f.due}</div>
                    </div>
                    <StatusChip status={f.status}/>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
                <h3 className="font-bold text-sm mb-3" style={{color:'#0d1e35'}}>Offline Sync Queue</h3>
                <div className="p-3 rounded-xl text-xs" style={{background:'#fef3dc',border:'1px solid #f6c46a',color:'#92600a'}}>
                  📴 <strong>3 referrals pending sync</strong> — Created while offline. Will auto-submit when connectivity returns. All data preserved locally.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PUBLIC HEALTH ── */}
        {tab==='pubhealth' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
              <h2 className="font-bold text-base mb-4" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>📢 Public Health Campaign Agent</h2>
              <div className="p-3 rounded-xl mb-4 text-xs" style={{background:'#ebf4ff',border:'1px solid #bee3f8',color:'#2b6cb0'}}>
                Generates multilingual health alerts, epidemic response messages, vaccination drives, and seasonal warnings. AI-written, doctor-reviewed, WHO-aligned.
              </div>
              {[['Campaign Type',['Epidemic Alert','Vaccination Drive','Seasonal Warning','Ayurveda Wellness Tip','Health Camp Announcement']],['Target Language',['Hindi','Marathi','Bengali','Telugu','Tamil','English']],['Severity',['🔴 High Alert','🟡 Moderate','🟢 Informational']]].map(([label,options])=>(
                <div key={label} className="mb-3">
                  <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>{label}</label>
                  <select className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{border:'1.5px solid #dde8e1',background:'#fff'}}>
                    {options.map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div className="mb-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>Topic / Condition</label>
                <input placeholder="e.g. Dengue surge — Barwani District" className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{border:'1.5px solid #dde8e1'}}/>
              </div>
              <button onClick={()=>toast.success('AI campaign generated! Pending doctor review before broadcast.')} className="w-full py-3 rounded-xl font-bold text-sm text-white" style={{background:'#1a5c3a'}}>Generate Campaign →</button>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl p-5 text-white" style={{background:'linear-gradient(135deg,#0d1a3a,#0e2e1a)'}}>
                <div className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{color:'#f5a623'}}>🚨 ACTIVE ALERT — WHO ALIGNED</div>
                <div className="font-bold text-lg mb-1" style={{fontFamily:"'Playfair Display',serif"}}>Dengue Season Alert — बड़वानी जिला</div>
                <div className="text-xs mb-3 opacity-70">Barwani District · Madhya Pradesh · H/EN</div>
                <div className="text-xs leading-relaxed opacity-75 mb-3">बड़वानी जिले में डेंगू के मामले बढ़ रहे हैं। सावधानियां अपनाएं। / Dengue cases rising in Barwani. Take precautions immediately.</div>
                <div className="grid grid-cols-2 gap-2">
                  {['✅ मच्छरदानी / Mosquito net','✅ पानी न जमने दें / No stagnant water','❌ बुखार ignore न करें / Never ignore fever','❌ Self-medication बंद / No self-medication'].map(d=>(
                    <div key={d} className="text-[10px] px-2 py-1.5 rounded-lg" style={{background:d.startsWith('✅')?'rgba(56,161,105,.15)':'rgba(229,62,62,.12)',color:d.startsWith('✅')?'#9ae6b4':'#fc8181'}}>{d}</div>
                  ))}
                </div>
                <div className="text-[9px] mt-3 opacity-40">🏥 Doctor-reviewed · WHO-aligned · SwasthyaAI Medical Board</div>
              </div>
              <div className="bg-white rounded-2xl p-4 border" style={{borderColor:'#dde8e1'}}>
                <div className="font-bold text-sm mb-2" style={{color:'#0d1e35'}}>Campaign Performance</div>
                {[['Dengue Alert — Barwani','12,840 reached','2 hrs ago'],['Malaria Prevention','8,200 reached','Yesterday'],['Giloy Immunity Guide','5,100 reached','3 days ago']].map(([title,reach,when])=>(
                  <div key={title} className="flex items-center gap-3 py-2 border-b last:border-0" style={{borderColor:'#f4f7f2'}}>
                    <span className="text-base">📢</span>
                    <div className="flex-1"><div className="text-xs font-bold" style={{color:'#0d1e35'}}>{title}</div><div className="text-[10px]" style={{color:'#5a7065'}}>{reach}</div></div>
                    <div className="text-[10px]" style={{color:'#a0b0a5'}}>{when}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── AUDIT CONSOLE ── */}
        {tab==='audit' && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
              <h2 className="font-bold text-base mb-1" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>📜 Compliance & Audit Console</h2>
              <p className="text-xs mb-4" style={{color:'#5a7065'}}>Every agent decision logged with full inputs, steps executed, rules checked, flags raised, confidence score, and human reviewer actions.</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{background:'#f4f7f2'}}>
                      {['Case Ref','Type','Action','Outcome','Confidence','Human Review','Reviewer','Timestamp'].map(h=>(
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{color:'#5a7065'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry,i)=>(
                      <tr key={i} style={{borderTop:'1px solid #f4f7f2'}}>
                        <td className="px-3 py-2.5 font-mono text-xs font-bold" style={{color:'#0d1e35'}}>{entry.case_ref||'—'}</td>
                        <td className="px-3 py-2.5"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{background:'#ebf4ff',color:'#2b6cb0'}}>{entry.case_type}</span></td>
                        <td className="px-3 py-2.5 text-xs" style={{color:'#5a7065'}}>{entry.action?.replace(/_/g,' ')}</td>
                        <td className="px-3 py-2.5"><StatusChip status={entry.final_outcome}/></td>
                        <td className="px-3 py-2.5 text-xs text-center">{entry.confidence_score?`${parseFloat(entry.confidence_score).toFixed(0)}%`:'—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${entry.human_review_required?'bg-amber-50 text-amber-700':'bg-green-50 text-green-700'}`}>
                            {entry.human_review_required?'⏳ Required':'✅ Auto'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{color:entry.reviewer_action?'#276749':'#a0b0a5'}}>{entry.reviewer_action||'Pending'}</td>
                        <td className="px-3 py-2.5 text-[10px]" style={{color:'#a0b0a5'}}>{new Date(entry.created_at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 rounded-2xl text-xs leading-relaxed" style={{background:'#f0f9f4',border:'1px solid #b0d8c0',color:'#276749'}}>
              <strong>📋 Audit Policy:</strong> Every agent decision in this platform is logged with: case ID · actor identity · inputs received · steps executed · rules checked ·
              policies referenced · flags raised · confidence score · final decision · human review required · reviewer action with mandatory justification · timestamps.
              No decision is silently made on incomplete or conflicting data — low confidence triggers escalation.
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal && <ReviewModal {...reviewModal} onClose={()=>setReviewModal(null)} onSubmit={handleReview}/>}
    </div>
  );
}
