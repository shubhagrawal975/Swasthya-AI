import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import LanguagePill from '../components/shared/LanguagePill';
import AppointmentDetailModal from '../components/teleconsult/AppointmentDetailModal';
import { PrescriptionStatusBadge } from '../components/prescription/PrescriptionTimeline';
import { doctorAPI, prescriptionService, campService, associationService, aiService, adminService } from '../services/index';
import { appointmentAPI, notificationAPI, opsAPI } from '../services/appointmentAPI';

const VERIF_COLORS = { verified:{bg:'rgba(56,161,105,.2)',color:'#68d391',icon:'✓',label:'Verified'}, pending:{bg:'rgba(245,166,35,.2)',color:'#f5a623',icon:'⏳',label:'Pending Review'}, under_review:{bg:'rgba(30,120,212,.2)',color:'#63b3ed',icon:'🔍',label:'Under Review'}, rejected:{bg:'rgba(229,62,62,.2)',color:'#fc8181',icon:'✗',label:'Rejected'} };

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [page, setPage] = useState('dashboard');
  const [stats, setStats] = useState({ total_patients:142, open_chats:4, pending_who_review:3, upcoming_camps:2 });
  const [whoQueue, setWhoQueue] = useState([]);
  const [rxList, setRxList] = useState([]);
  const [queue, setQueue] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [adForm, setAdForm] = useState({ type:'Pandemic Alert', topic:'H5N1 Avian Influenza', region:'Barwani District, MP', severity:'🔴 High Alert' });
  const [adPreview, setAdPreview] = useState(null);
  const [adLoading, setAdLoading] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatLog, setChatLog] = useState([{ role:'them', text:'Namaste Doctor. Fever 3 days, 38.5°C. Dengue cases in village last week. Please advise.', name:'RK', color:'#e53e3e' }]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rxModal, setRxModal] = useState(false);
  const [rxForm, setRxForm] = useState({ patient_id:'', complaint:'', medicines:[{name:'',dose:'',frequency:'',duration_days:'',type:'allopathic'}], ayurveda_notes:'', notes:'' });
  const [rxLoading, setRxLoading] = useState(false);
  const [campForm, setCampForm] = useState({ title:'', location:'', camp_date:'', start_time:'', end_time:'', services:'' });
  const [campLoading, setCampLoading] = useState(false);
  const chatRef = useRef(null);
  const [verificationStatus, setVerificationStatus] = useState(user?.verification_status || 'pending');
  const [verificationHistory, setVerificationHistory] = useState([]);
  const [specialtyType, setSpecialtyType] = useState('modern'); // modern | ayurveda | integrative
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const vCfg = VERIF_COLORS[verificationStatus] || VERIF_COLORS.pending;

  useEffect(() => {
    const fetchData = async () => {
      doctorAPI.getDashboard().then(r=>setStats(r.data.data)).catch(()=>{});
      prescriptionService.getDoctorRx().then(r=>setRxList(r.data.data?.prescriptions||[])).catch(()=>{});
      adminService.getWHOQueue().then(r=>setWhoQueue(r.data.data?.queue||[])).catch(()=>{});
      appointmentAPI.getDoctorAppts().then(r=>setAppointments(r.data.data?.appointments||[])).catch(()=>{});
      appointmentAPI.getQueue().then(r=>setQueue(r.data.data?.queue||[])).catch(()=>{});
      try {
        const res = await doctorAPI.getVerification();
        setVerificationStatus(res.data.data.doctor.verification_status || 'pending');
        setVerificationHistory(res.data.data.verification_history || []);
      } catch (e) { console.warn('verification fetch failed'); }
    };

    fetchData();
    if(user?.specialization?.toLowerCase().includes('ayurv')) setSpecialtyType('ayurveda');
    else if(user?.specialization?.toLowerCase().includes('integrat')) setSpecialtyType('integrative');
  }, []);

  const openAppointmentDetail = async (id) => {
    setAppointmentLoading(true);
    try {
      const res = await appointmentAPI.getDetail(id);
      setSelectedAppointment(res.data.data);
    } catch {
      toast.error('Unable to load appointment details');
    } finally {
      setAppointmentLoading(false);
    }
  };
  const closeAppointmentDetail = () => setSelectedAppointment(null);

  useEffect(()=>{ if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight; },[chatLog]);

  const sendChat = () => {
    if(!chatMsg.trim()) return;
    setChatLog(l=>[...l,{role:'me',text:chatMsg.trim(),time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}]);
    setChatMsg('');
  };

  const generateAd = async () => {
    setAdLoading(true);
    try {
      const res = await aiService.generateAd({...adForm,languages:['hi','en']});
      setAdPreview(res.data.data.content);
      toast.success('AI Ad generated!');
    } catch {
      setAdPreview({
        title_en:`${adForm.topic} Alert — ${adForm.region}`,
        title_hi:`${adForm.topic} चेतावनी — ${adForm.region}`,
        body_en:`Health Dept: Cases of ${adForm.topic} reported in ${adForm.region}. Take precautions.`,
        body_hi:`स्वास्थ्य विभाग: ${adForm.region} में ${adForm.topic} के मामले। सावधानी बरतें।`,
        dos:['✅ मास्क पहनें / Wear mask','✅ हाथ धोएं / Wash hands','✅ पानी उबालकर पीएं / Boil water','✅ बुखार → PHC जाएं / Fever: visit PHC'],
        donts:['❌ बीमार पक्षी न छुएं / No sick birds','❌ कच्चा मांस न खाएं / No raw meat','❌ Self-medication बंद / No self-med','❌ अफवाहें न फैलाएं / No rumours'],
      });
      toast.success('Ad generated (offline mode)');
    } finally { setAdLoading(false); }
  };

  const submitRx = async () => {
    if(!rxForm.patient_id || !rxForm.medicines[0]?.name) return toast.error('Fill patient ID and at least one medicine');
    setRxLoading(true);
    try {
      await prescriptionService.create(rxForm);
      toast.success('Prescription submitted for WHO review (2–4 hrs)');
      setRxModal(false);
      setRxForm({patient_id:'',complaint:'',medicines:[{name:'',dose:'',frequency:'',duration_days:'',type:'allopathic'}],ayurveda_notes:'',notes:''});
    } catch(e) { toast.error(e.response?.data?.message||'Submission failed'); }
    finally { setRxLoading(false); }
  };

  const submitCamp = async () => {
    if(!campForm.title||!campForm.location||!campForm.camp_date) return toast.error('Fill required fields');
    setCampLoading(true);
    try {
      const fd = new FormData();
      Object.entries(campForm).forEach(([k,v])=>fd.append(k,v));
      await campService.create(fd);
      toast.success('Camp published! AI ad pushed to users.');
      setCampForm({title:'',location:'',camp_date:'',start_time:'',end_time:'',services:''});
    } catch(e) { toast.error(e.response?.data?.message||'Failed to create camp'); }
    finally { setCampLoading(false); }
  };

  const completeAppt = async (id) => {
    const notes = prompt('Add consultation notes (optional):') || '';
    try {
      await appointmentAPI.complete(id, { doctor_notes: notes });
      setQueue(q=>q.filter(a=>a.id!==id));
      toast.success('Consultation completed');
    } catch { toast.error('Failed to complete'); }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const navItems = [
    {id:'dashboard',icon:'📊',label:'Dashboard'},
    {id:'queue',    icon:'📋',label:'Today Queue',  badge:queue.length||null},
    {id:'chats',    icon:'💬',label:'Patient Chats',badge:stats.open_chats||null},
    {id:'rx',       icon:'💊',label:'Prescriptions'},
    {id:'camps',    icon:'🏕️',label:'Health Camps'},
    {id:'aiads',    icon:'📢',label:'AI Alerts'},
    {id:'assoc',    icon:'🤝',label:'Associations'},
    {id:'whoqueue', icon:'🏥',label:'WHO Queue',    badge:whoQueue.length||null},
    {id:'ops',      icon:'⚙️',label:'Ops Suite'},
  ];

  const Stat = ({icon,value,label,sub,color}) => (
    <div className="bg-white rounded-2xl p-4 border" style={{borderColor:'#dde8e1',boxShadow:'0 4px 16px rgba(26,92,58,.07)'}}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-bold text-2xl" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>{value}</div>
      <div className="text-xs font-semibold mt-0.5" style={{color:'#0d1e35'}}>{label}</div>
      {sub&&<div className="text-[10px] mt-1" style={{color}}>{sub}</div>}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={()=>setSidebarOpen(false)}/>}

      {/* Sidebar */}
      <aside className={`flex-shrink-0 flex flex-col z-50 transition-transform duration-200 fixed md:relative ${sidebarOpen?'translate-x-0':'-translate-x-full'} md:translate-x-0`}
        style={{width:232,height:'100vh',background:'#0d1e35',overflowY:'auto'}}>

        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{borderColor:'rgba(255,255,255,.08)'}}>
          <div className="font-bold text-lg text-white" style={{fontFamily:"'Playfair Display',serif"}}>Swasthya<span style={{color:'#f5a623'}}>AI</span></div>
          <div className="text-[10px] tracking-wider uppercase mt-0.5" style={{color:'rgba(255,255,255,.28)'}}>Doctor Portal</div>
        </div>

        {/* Doctor info */}
        <div className="px-3 py-3 border-b" style={{borderColor:'rgba(255,255,255,.06)'}}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{background:'linear-gradient(135deg,#1e78d4,#00b4a0)'}}>
              {user?.first_name?.[0]||'D'}{user?.last_name?.[0]||'R'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">Dr. {user?.first_name} {user?.last_name}</div>
              <div className="text-[10px] truncate" style={{color:'rgba(255,255,255,.38)'}}>{user?.specialization||'Doctor'}</div>
            </div>
          </div>
          {/* Verification badge */}
          <div className="mt-2 flex items-center gap-1.5">
            <div className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:vCfg.bg,color:vCfg.color}}>
              {vCfg.icon} {vCfg.label}
            </div>
            {specialtyType !== 'modern' && (
              <div className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:'rgba(61,184,122,.15)',color:'#3db87a'}}>
                🌿 {specialtyType==='ayurveda'?'Ayurveda':'Integrative'}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2">
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>{setPage(item.id);setSidebarOpen(false);}}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-semibold transition-all"
              style={{
                margin:'1px 6px',width:'calc(100% - 12px)',borderRadius:10,
                background:page===item.id?'linear-gradient(90deg,rgba(30,120,212,.28),rgba(30,120,212,.1))':'transparent',
                color:page===item.id?'#fff':'rgba(255,255,255,.48)',
                borderLeft:page===item.id?'3px solid #1e78d4':'3px solid transparent',
              }}>
              <span className="text-base w-5 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge>0&&<span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{background:'#e53e3e',color:'#fff'}}>{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="px-3 py-3 border-t" style={{borderColor:'rgba(255,255,255,.08)'}}>
          <button onClick={()=>navigate('/help')} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl" style={{color:'rgba(255,255,255,.38)'}}>❓ Help & Support</button>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl" style={{color:'rgba(255,80,80,.6)'}}>🚪 Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 h-14 bg-white border-b" style={{borderColor:'#dde8e1',boxShadow:'0 1px 8px rgba(0,0,0,.04)'}}>
          <div className="flex items-center gap-3">
            <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="md:hidden text-xl" style={{color:'#5a7065'}}>☰</button>
            <div className="font-bold text-sm" style={{color:'#0d1e35'}}>{navItems.find(n=>n.id===page)?.label||'Dashboard'}</div>
          </div>
          <div className="flex items-center gap-3">
            {verificationStatus!=='verified'&&(
              <div className="text-xs font-bold px-3 py-1 rounded-full" style={{background:'#fef3dc',color:'#92600a'}}>⏳ Credentials Under Review</div>
            )}
            {verificationStatus==='verified'&&(
              <div className="hidden md:flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full" style={{background:'#fde8e8',color:'#c53030'}}>🚨 H5N1 Alert Active</div>
            )}
            <LanguagePill/>
            <button onClick={()=>setRxModal(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-900" style={{background:'#f5a623'}}>+ Prescribe</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* DASHBOARD */}
          {page==='dashboard' && (
            <div className="space-y-5">
              {verificationStatus!=='verified'&&(
                <div className="p-4 rounded-2xl border flex flex-col gap-3" style={{background:'linear-gradient(90deg,#fff8e7,#fffbf2)',borderColor:'#f6ad3c'}}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⏳</span>
                    <div>
                      <div className="font-bold text-sm mb-1" style={{color:'#92600a'}}>Credentials Under Review</div>
                      <div className="text-xs leading-relaxed" style={{color:'#a07028'}}>Your MCI certificate and degree are being reviewed by our Medical Board (24–48 hrs). WHO-aligned medical board reviews your prescriptions before publication.</div>
                    </div>
                  </div>
                  <div className="text-xs grid grid-cols-2 gap-2">
                    <div className="px-2 py-1 rounded-lg bg-white border" style={{borderColor:'#f0d4a7'}}><strong>Status:</strong> {verificationStatus}</div>
                    <div className="px-2 py-1 rounded-lg bg-white border" style={{borderColor:'#f0d4a7'}}><strong>Last updated:</strong> {verificationHistory[0]?.reviewed_at ? new Date(verificationHistory[0].reviewed_at).toLocaleString('en-IN') : 'Pending'}</div>
                  </div>
                  {verificationHistory.length>0 ? (
                    <div className="bg-white p-2 rounded-xl border" style={{borderColor:'#f0d4a7'}}>
                      <div className="text-[11px] font-bold mb-1" style={{color:'#5a7065'}}>Review History</div>
                      {verificationHistory.slice(0,3).map((entry, i) => (
                        <div key={entry.id || i} className="text-[11px] mb-1" style={{color:'#1a2e1f'}}>
                          <span className="font-semibold">{entry.status.toUpperCase()}</span> — {entry.reviewer_notes || 'No notes yet'}
                          <div className="text-[10px] text-[#5a7065]">{new Date(entry.created_at).toLocaleString('en-IN')}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-[#5a7065]">No review history yet. Your application is in queue.</div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat icon="👥" value={stats.total_patients} label="Total Patients"  sub="▲ 12 this week" color="#38a169"/>
                <Stat icon="💬" value={stats.open_chats}     label="Open Chats"      sub="Needs attention" color="#e53e3e"/>
                <Stat icon="🏥" value={stats.pending_who_review} label="WHO Queue"   sub="Awaiting review" color="#1e78d4"/>
                <Stat icon="🏕️" value={stats.upcoming_camps} label="Upcoming Camps"  sub="Next: Mar 25" color="#5a7065"/>
              </div>

              {/* Ops Suite quick entry */}
              <div className="rounded-2xl p-5 text-white" style={{background:'linear-gradient(135deg,#0d1e35,#1a5c3a)'}}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">⚙️</span>
                  <div>
                    <div className="font-bold" style={{fontFamily:"'Playfair Display',serif"}}>Healthcare Operations Suite</div>
                    <div className="text-xs opacity-55 mt-0.5">Medical coding, prior authorization, claims & WHO-compliant audit workflows</div>
                  </div>
                  <button onClick={()=>navigate('/ops')} className="ml-auto px-4 py-2 rounded-lg text-xs font-bold" style={{background:'rgba(255,255,255,.15)'}}>Open Suite →</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[['🏷️','Coding','Submit notes for ICD-10/CPT'],['📋','Prior Auth','Check treatment coverage'],['💰','Claims','Submit coded claim']].map(([icon,label,desc])=>(
                    <button key={label} onClick={()=>navigate('/ops')} className="rounded-xl p-3 text-left transition-all hover:bg-white/15" style={{background:'rgba(255,255,255,.08)'}}>
                      <div className="text-lg mb-1">{icon}</div>
                      <div className="text-xs font-bold">{label}</div>
                      <div className="text-[10px] opacity-50 mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {whoQueue.length>0&&(
                <div className="bg-white rounded-2xl overflow-hidden border" style={{borderColor:'#dde8e1'}}>
                  <div className="flex items-center gap-3 px-5 py-3 text-white" style={{background:'linear-gradient(90deg,#0047ab,#1e78d4)'}}>
                    <span className="text-lg">🏥</span>
                    <div className="flex-1"><div className="font-bold text-sm">WHO Review Queue</div><div className="text-xs opacity-60">{whoQueue.length} prescription(s) awaiting review</div></div>
                    <button onClick={()=>setPage('whoqueue')} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{background:'rgba(255,255,255,.15)'}}>Manage →</button>
                  </div>
                  {whoQueue.slice(0,2).map(item=>(
                    <div key={item.review_id} className="flex items-start gap-3 px-5 py-3 border-b" style={{borderColor:'#f4f7f2'}}>
                      <span className="text-base mt-0.5">💊</span>
                      <div className="flex-1"><div className="font-semibold text-sm">Rx — {item.patient_name}</div><div className="text-xs mt-0.5" style={{color:'#5a7065'}}>by Dr. {item.doctor_name} · {new Date(item.assigned_at||Date.now()).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}</div></div>
                      <PrescriptionStatusBadge status={item.status} small/>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* QUEUE */}
          {page==='queue' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>Today's Queue</h2>
                <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{background:'#e6f4ec',color:'#276749'}}>{queue.length} patients</span>
              </div>
              {queue.length===0&&<div className="text-center py-16" style={{color:'#5a7065'}}><div className="text-4xl mb-3">📋</div><p className="text-sm font-semibold">No patients in queue today</p></div>}
              {queue.map((appt,i)=>(
                <div key={appt.id} className="bg-white rounded-2xl p-4 border flex items-center gap-3" style={{borderColor:'#dde8e1'}}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{background:'#1a5c3a'}}>{i+1}</div>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{appt.patient_name}</div>
                    <div className="text-xs mt-0.5" style={{color:'#5a7065'}}>{appt.village} · {new Date(appt.scheduled_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}</div>
                    {appt.reason&&<div className="text-xs mt-1 italic" style={{color:'#5a7065'}}>"{appt.reason}"</div>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                      {appt.status==='scheduled' && <button onClick={async()=>{try{await appointmentAPI.checkIn(appt.id); toast.success('Checked in'); setQueue(q=>q.map(x=>x.id===appt.id?{...x,status:'waiting'}:x));}catch{toast.error('Check-in failed');}}} className="px-3 py-1.5 rounded-full text-xs font-bold" style={{background:'#f0f9ff',color:'#2b6cb0'}}>🕒 Check In</button>}
                      {['scheduled','waiting'].includes(appt.status) && <button onClick={async()=>{try{await appointmentAPI.start(appt.id); toast.success('Started consultation'); setQueue(q=>q.map(x=>x.id===appt.id?{...x,status:'in_progress'}:x));}catch{toast.error('Start failed');}}} className="px-3 py-1.5 rounded-full text-xs font-bold" style={{background:'#1a5c3a',color:'#fff'}}>▶ Start</button>}
                      {appt.video_doctor_url&&<a href={appt.video_doctor_url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{background:'#1a5c3a'}}>📹 Join</a>}
                      <button onClick={async()=>{try{await appointmentAPI.markNoShow(appt.id); toast.success('Marked no-show'); setQueue(q=>q.filter(x=>x.id!==appt.id));}catch{toast.error('Failed');}}} className="px-3 py-1.5 rounded-full text-xs font-bold" style={{background:'#fde8e8',color:'#c53030'}}>🚫 No-show</button>
                      <button onClick={()=>completeAppt(appt.id)} className="px-3 py-1.5 rounded-full text-xs font-bold" style={{background:'#e6f4ec',color:'#276749'}}>✅ Complete</button>
                      <button onClick={()=>openAppointmentDetail(appt.id)} className="px-3 py-1.5 rounded-full text-xs font-bold" style={{background:'#e8f5ff',color:'#1d4ed8'}}>ℹ️ Details</button>
                    </div>
                </div>
              ))}
            </div>
          )}

          {/* CHATS */}
          {page==='chats' && (
            <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'#dde8e1',height:'calc(100vh - 160px)'}}>
              <div className="flex h-full">
                <div className="w-48 border-r flex-shrink-0 flex flex-col" style={{borderColor:'#dde8e1'}}>
                  <div className="p-3 border-b" style={{borderColor:'#dde8e1'}}><input placeholder="🔍 Search…" className="w-full text-xs rounded-xl px-3 py-2 outline-none" style={{background:'#f4f7f2',border:'1px solid #dde8e1'}}/></div>
                  {[{name:'Ramesh Kumar',last:'Fever 3 days…',color:'#e53e3e',badge:2},{name:'Sunita Devi',last:'Baby not eating',color:'#d69e2e',badge:1},{name:'Mohan Patel',last:'Thank you doctor',color:'#3182ce'},{name:'Leela Bai',last:'Blood sugar 140',color:'#38a169'}].map(c=>(
                    <div key={c.name} className="flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b hover:bg-blue-50" style={{borderColor:'#f4f7f2'}}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{background:c.color}}>{c.name.split(' ').map(n=>n[0]).join('')}</div>
                      <div className="flex-1 min-w-0"><div className="text-xs font-bold truncate">{c.name}</div><div className="text-[10px] truncate" style={{color:'#5a7065'}}>{c.last}</div></div>
                      {c.badge&&<div className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{background:'#1e78d4'}}>{c.badge}</div>}
                    </div>
                  ))}
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{borderColor:'#dde8e1'}}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white" style={{background:'#e53e3e'}}>RK</div>
                      <div><div className="font-bold text-sm">Ramesh Kumar</div><div className="text-xs" style={{color:'#5a7065'}}>Patient · Sendhwa · Preferred: Hindi</div></div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>setRxModal(true)} className="px-3 py-1.5 text-xs font-bold rounded-full text-white" style={{background:'#1a5c3a'}}>💊 Prescribe</button>
                      <button className="px-3 py-1.5 text-xs font-bold rounded-full" style={{background:'#ebf4ff',color:'#2b6cb0'}}>📹 Video</button>
                    </div>
                  </div>
                  <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{background:'#f9fbff'}}>
                    {chatLog.map((m,i)=>(
                      <div key={i} className={`flex gap-2 items-end ${m.role==='me'?'flex-row-reverse':''}`}>
                        {m.role==='them'&&<div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{background:m.color||'#e53e3e'}}>{m.name||'?'}</div>}
                        <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${m.role==='me'?'text-white':'bg-white'}`}
                          style={{background:m.role==='me'?'#1e78d4':'#fff',borderBottomLeftRadius:m.role==='them'?3:undefined,borderBottomRightRadius:m.role==='me'?3:undefined,boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-x-auto px-4 py-1.5 border-t" style={{borderColor:'#dde8e1',scrollbarWidth:'none'}}>
                    {['Paracetamol 500mg TDS if fever >38.5°C.','Get CBC + Dengue NS1 test.','Visit hospital if fever >3 days.'].map(t=>(
                      <button key={t} onClick={()=>setChatMsg(t)} className="flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold" style={{background:'#f0f6ff',color:'#1e78d4'}}>{t.slice(0,30)}…</button>
                    ))}
                  </div>
                  <div className="flex gap-2 p-3 border-t bg-white" style={{borderColor:'#dde8e1'}}>
                    <input value={chatMsg} onChange={e=>setChatMsg(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder="Type medical advice…" className="flex-1 rounded-full px-4 py-2 text-sm outline-none" style={{background:'#f4f7f2',border:'1.5px solid #dde8e1'}}/>
                    <button onClick={sendChat} className="w-9 h-9 rounded-full text-white flex items-center justify-center" style={{background:'#1e78d4'}}>➤</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRESCRIPTIONS */}
          {page==='rx' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border" style={{background:'linear-gradient(135deg,#ebf4ff,#e8f0fe)',borderColor:'#bee3f8'}}>
                <div className="font-bold text-sm mb-1" style={{color:'#2b6cb0'}}>🏥 WHO Prescription Review Policy</div>
                <p className="text-xs leading-relaxed" style={{color:'#3a6fa8'}}>All prescriptions go through: ① Automated WHO drug safety check → ② Medical Board review → ③ Published to patient (avg 2–4 hrs).
                  Ayurvedic medicines are documented separately and clearly labeled. Flagged prescriptions require revision.</p>
              </div>
              {specialtyType!=='modern'&&(
                <div className="p-3 rounded-2xl border text-xs leading-relaxed" style={{background:'#f0f9f4',borderColor:'#b0d8c0',color:'#1a5c3a'}}>
                  🌿 <strong>Ayurveda Documentation:</strong> Add Ayurvedic preparations in the "Ayurveda Notes" field. These are kept separate from allopathic prescriptions and clearly labeled for the patient. All classical Ayurveda recommendations are marked as "doctor-reviewed wellness guidance."
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={()=>setRxModal(true)} className="px-4 py-2 rounded-full font-bold text-sm text-white" style={{background:'#1a5c3a'}}>+ New Prescription</button>
                <button onClick={()=>navigate('/ops?tab=coding')} className="px-4 py-2 rounded-full font-bold text-sm" style={{background:'#f4f7f2',color:'#1a5c3a',border:'1.5px solid #b0d8c0'}}>🏷️ Code Consultation</button>
              </div>
              <div className="bg-white rounded-2xl overflow-hidden border" style={{borderColor:'#dde8e1'}}>
                <table className="w-full">
                  <thead><tr style={{background:'#f4f7f2'}}>{['Patient','Medicines','Submitted','WHO Status','Visible'].map(h=><th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{color:'#5a7065'}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rxList.map((rx,i)=>(
                      <tr key={rx.id||i} style={{borderTop:'1px solid #f4f7f2'}}>
                        <td className="px-4 py-3 text-sm font-semibold">{rx.patient_name}</td>
                        <td className="px-4 py-3 text-xs" style={{color:'#5a7065'}}>{Array.isArray(rx.medicines)?rx.medicines.map(m=>m.name).join(', '):'—'}</td>
                        <td className="px-4 py-3 text-xs" style={{color:'#5a7065'}}>{new Date(rx.created_at||Date.now()).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3"><PrescriptionStatusBadge status={rx.status} small/></td>
                        <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rx.is_visible_to_patient?'bg-green-50 text-green-700':'bg-gray-100 text-gray-500'}`}>{rx.is_visible_to_patient?'Published':'Hidden'}</span></td>
                      </tr>
                    ))}
                    {rxList.length===0&&<tr><td colSpan={5} className="text-center py-8 text-sm" style={{color:'#5a7065'}}>No prescriptions yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CAMPS */}
          {page==='camps' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
                <h3 className="font-bold text-sm mb-4" style={{color:'#0d1e35'}}>Create New Health Camp</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[['title','Camp Name','Free Health Camp — PHC Sendhwa'],['location','Location','PHC Sendhwa, Barwani'],['camp_date','Date',''],['start_time','Start',''],['end_time','End','']].map(([k,lbl,ph])=>(
                    <div key={k}>
                      <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>{lbl}</label>
                      <input type={k.includes('time')?'time':k==='camp_date'?'date':'text'} value={campForm[k]} onChange={e=>setCampForm(p=>({...p,[k]:e.target.value}))} placeholder={ph} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{border:'1.5px solid #dde8e1'}}/>
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>Services (comma separated)</label>
                    <input value={campForm.services} onChange={e=>setCampForm(p=>({...p,services:e.target.value}))} placeholder="BP, Blood Sugar, Eye Check, Free Medicines, Ayurveda Consultation" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{border:'1.5px solid #dde8e1'}}/>
                  </div>
                </div>
                <div className="p-3 rounded-xl mt-3 text-xs" style={{background:'#ebf4ff',border:'1px solid #bee3f8',color:'#2b6cb0'}}>✨ AI will auto-generate a bilingual advertisement and push it to all users in your area upon publishing.</div>
                <button onClick={submitCamp} disabled={campLoading} className="mt-3 px-5 py-2.5 rounded-full font-bold text-sm text-white disabled:opacity-50" style={{background:'#1a5c3a'}}>{campLoading?'Publishing…':'📢 Publish Camp'}</button>
              </div>
            </div>
          )}

          {/* AI ADS */}
          {page==='aiads' && (
            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
                <h3 className="font-bold text-sm mb-4" style={{color:'#0d1e35'}}>⚙️ Configure AI Advertisement</h3>
                {[['type','Ad Type',['Pandemic Alert','Health Camp Promo','Seasonal Warning','Ayurveda Wellness Tip','Preventive Tips','Vaccination Drive']],['topic','Topic',''],['region','Target Region',''],['severity','Severity',['🔴 High Alert','🟡 Moderate Warning','🟢 Informational']]].map(([k,lbl,opts])=>(
                  <div key={k} className="mb-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>{lbl}</label>
                    {Array.isArray(opts)
                      ? <select value={adForm[k]} onChange={e=>setAdForm(p=>({...p,[k]:e.target.value}))} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{border:'1.5px solid #dde8e1',background:'#fff'}}>{opts.map(o=><option key={o}>{o}</option>)}</select>
                      : <input value={adForm[k]} onChange={e=>setAdForm(p=>({...p,[k]:e.target.value}))} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{border:'1.5px solid #dde8e1'}}/>
                    }
                  </div>
                ))}
                <button onClick={generateAd} disabled={adLoading} className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{background:'#1a5c3a'}}>
                  {adLoading?<span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Generating…</span>:'✨ Generate AI Advertisement'}
                </button>
              </div>
              <div>
                {adPreview
                  ? <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{background:'linear-gradient(135deg,#0d1a3a,#0e2e1a)'}}>
                      <div className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{color:'#f5a623'}}>🚨 AI-GENERATED · WHO-ALIGNED</div>
                      <div className="text-lg font-bold mb-1" style={{fontFamily:"'Playfair Display',serif"}}>{adPreview.title_en}</div>
                      <div className="text-sm font-bold mb-2 opacity-75">{adPreview.title_hi}</div>
                      <div className="text-xs leading-relaxed mb-3 opacity-70">{adPreview.body_hi}<br/><em>{adPreview.body_en}</em></div>
                      <div className="grid grid-cols-2 gap-1.5 mb-3">
                        {adPreview.dos?.map((d,i)=><div key={i} className="text-[10px] px-2 py-1.5 rounded-lg" style={{background:'rgba(56,161,105,.15)',color:'#9ae6b4'}}>{d}</div>)}
                        {adPreview.donts?.map((d,i)=><div key={i} className="text-[10px] px-2 py-1.5 rounded-lg" style={{background:'rgba(229,62,62,.12)',color:'#fc8181'}}>{d}</div>)}
                      </div>
                      <div className="text-[9px] opacity-40">🏥 WHO-Verified · SwasthyaAI Medical Board · {new Date().toLocaleDateString()}</div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={()=>toast.success('Ad pushed to all users!')} className="px-3 py-1.5 rounded-full text-[10px] font-bold text-white" style={{background:'rgba(255,255,255,.15)'}}>📤 Push to Users</button>
                        <button onClick={()=>toast.success('Draft saved!')} className="px-3 py-1.5 rounded-full text-[10px] font-bold text-white" style={{background:'rgba(255,255,255,.1)'}}>💾 Save Draft</button>
                      </div>
                    </div>
                  : <div className="bg-white rounded-2xl p-10 border text-center" style={{borderColor:'#dde8e1'}}><div className="text-4xl mb-3">📢</div><p className="text-sm" style={{color:'#5a7065'}}>Configure and generate to preview</p></div>
                }
              </div>
            </div>
          )}

          {/* ASSOCIATIONS */}
          {page==='assoc' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border flex gap-3" style={{background:'linear-gradient(90deg,#fff5f5,#fff0f0)',borderColor:'#fc8181'}}>
                <span className="text-2xl">🚨</span>
                <div className="flex-1">
                  <div className="font-bold text-sm mb-1" style={{color:'#c53030'}}>Active Pandemic: H5N1 Avian Influenza — HIGH ALERT</div>
                  <div className="text-xs leading-relaxed" style={{color:'#742a2a'}}>Detected in Barwani, Khargone & Burhanpur districts. AI advisories auto-generated.</div>
                  <div className="flex gap-2 mt-2">
                    <button className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{background:'#e53e3e'}}>Join Response Team</button>
                    <button onClick={()=>setPage('aiads')} className="px-3 py-1.5 rounded-full text-xs font-bold" style={{background:'#fde8e8',color:'#c53030'}}>View AI Alerts →</button>
                  </div>
                </div>
              </div>
              {[{name:'H5N1 Response Team',scope:'Barwani · Khargone',members:12,color:'#c53030',emoji:'🚨'},{name:'Monsoon Health Watch',scope:'Sendhwa District',members:7,color:'#38a169',emoji:'🌿'},{name:'PHC Network — Barwani',scope:'Barwani District',members:24,color:'#2b6cb0',emoji:'🏥'}].map(a=>(
                <div key={a.name} className="bg-white rounded-2xl p-4 border" style={{borderColor:'#dde8e1'}}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{background:`${a.color}22`}}>{a.emoji}</div>
                    <div className="flex-1"><div className="font-bold text-sm">{a.name}</div><div className="text-xs" style={{color:'#5a7065'}}>{a.scope} · {a.members} doctors</div></div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{background:'#1a5c3a'}}>💬 Group Chat</button>
                    <button onClick={()=>setPage('aiads')} className="px-3 py-1.5 rounded-full text-xs font-bold" style={{background:'#fef3dc',color:'#92600a'}}>📢 AI Alert</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* WHO QUEUE */}
          {page==='whoqueue' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border" style={{background:'linear-gradient(135deg,#ebf4ff,#e8f0fe)',borderColor:'#bee3f8'}}>
                <div className="font-bold text-sm mb-1" style={{color:'#2b6cb0'}}>🏥 WHO Prescription Review System</div>
                <p className="text-xs leading-relaxed" style={{color:'#3a6fa8'}}>① Doctor submits → ② Automated WHO drug check → ③ Medical Board review → ④ Approved = Published to patient. Flagged = Doctor must revise.</p>
              </div>
              {whoQueue.length===0&&<div className="text-center py-10" style={{color:'#5a7065'}}><div className="text-4xl mb-3">✅</div><p className="text-sm font-semibold">Queue empty — all prescriptions reviewed</p></div>}
              {whoQueue.map(item=>(
                <div key={item.review_id} className="bg-white rounded-2xl p-4 border" style={{borderColor:'#dde8e1'}}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">💊</span>
                    <div className="flex-1">
                      <div className="font-bold text-sm">Rx — {item.patient_name}</div>
                      <div className="text-xs mt-0.5" style={{color:'#5a7065'}}>by Dr. {item.doctor_name} · MCI: {item.mci_number}</div>
                      <div className="text-xs mt-1" style={{color:'#5a7065'}}>Complaint: {item.complaint||'—'} | Diagnosis: {item.diagnosis||'—'}</div>
                      {item.auto_check_notes&&<div className="text-xs mt-1 p-2 rounded-lg" style={{background:'#fff8e8',color:'#92600a'}}>Auto-check: {item.auto_check_notes}</div>}
                    </div>
                    <PrescriptionStatusBadge status={item.status} small/>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={async()=>{try{await adminService.reviewPrescription(item.review_id,{action:'approve',notes:'Approved by board'});setWhoQueue(q=>q.filter(x=>x.review_id!==item.review_id));toast.success('Approved & published to patient');}catch{toast.error('Review failed');}}}
                      className="px-4 py-1.5 rounded-full text-xs font-bold text-white" style={{background:'#38a169'}}>✅ Approve</button>
                    <button onClick={async()=>{const r=prompt('Reason for flagging:');if(!r)return;try{await adminService.reviewPrescription(item.review_id,{action:'flag',notes:r});setWhoQueue(q=>q.filter(x=>x.review_id!==item.review_id));toast.success('Flagged — doctor notified');}catch{toast.error('Failed');}}}
                      className="px-4 py-1.5 rounded-full text-xs font-bold" style={{background:'#fde8e8',color:'#c53030'}}>⚠️ Flag</button>
                    <button onClick={async()=>{const r=prompt('Rejection reason:');if(!r)return;try{await adminService.reviewPrescription(item.review_id,{action:'reject',notes:r});setWhoQueue(q=>q.filter(x=>x.review_id!==item.review_id));toast.success('Rejected');}catch{toast.error('Failed');}}}
                      className="px-4 py-1.5 rounded-full text-xs font-bold" style={{background:'#edf2f7',color:'#4a5568'}}>❌ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* OPS SUITE ENTRY */}
          {page==='ops' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-5 rounded-2xl text-white" style={{background:'linear-gradient(135deg,#0d1e35,#1a5c3a)'}}>
                <span className="text-3xl">⚙️</span>
                <div className="flex-1">
                  <div className="font-bold text-lg" style={{fontFamily:"'Playfair Display',serif"}}>Healthcare Operations Suite</div>
                  <div className="text-xs opacity-60 mt-0.5">AI-powered coding · Prior auth · Claims · Compliance · Referral · Public health</div>
                </div>
                <button onClick={()=>navigate('/ops')} className="px-5 py-2.5 rounded-xl font-bold text-sm text-white" style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.2)'}}>Open Full Suite →</button>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  {icon:'🏷️',title:'Medical Coding',desc:'Submit consultation notes for AI-powered ICD-10/CPT extraction. Handles Ayurveda + allopathy hybrid docs.',color:'#1e78d4'},
                  {icon:'📋',title:'Prior Authorization',desc:'Check treatment/medicine coverage. Policy-aware. Emergency escalation. Full criteria checklist.',color:'#e53e3e'},
                  {icon:'💰',title:'Claims Adjudication',desc:'Submit coded claims for rural clinics, PHC, NGO. Line-item review. Reason codes. Transparent decisions.',color:'#38a169'},
                ].map(item=>(
                  <div key={item.title} className="bg-white rounded-2xl p-5 border" style={{borderColor:'#dde8e1'}}>
                    <div className="text-3xl mb-2">{item.icon}</div>
                    <div className="font-bold text-sm mb-1" style={{color:'#0d1e35'}}>{item.title}</div>
                    <div className="text-xs leading-relaxed mb-3" style={{color:'#5a7065'}}>{item.desc}</div>
                    <button onClick={()=>navigate('/ops')} className="w-full py-2.5 rounded-xl font-bold text-sm text-white" style={{background:'#1a5c3a'}}>Open →</button>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-2xl p-4 border text-xs leading-relaxed" style={{borderColor:'#dde8e1',color:'#5a7065'}}>
                <strong style={{color:'#0d1e35'}}>📜 Audit Console:</strong> Every agent decision is logged with full reasoning, confidence score, and human reviewer action.
                <button onClick={()=>navigate('/ops')} className="ml-2 font-bold underline" style={{color:'#1a5c3a'}}>View Audit Log →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Prescription Modal */}
      {rxModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{background:'rgba(0,0,0,.5)'}} onClick={e=>e.target===e.currentTarget&&setRxModal(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{animation:'slideUp .3s ease'}}>
            <div className="w-9 h-1 bg-gray-200 rounded mx-auto mt-3 mb-3"/>
            <div className="px-5 pb-6">
              <h3 className="font-bold text-base mb-1" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>💊 Issue Prescription</h3>
              <div className="p-3 rounded-xl mb-3 text-xs" style={{background:'#ebf4ff',border:'1px solid #bee3f8',color:'#2b6cb0'}}>
                🏥 Prescription goes through WHO-aligned safety review before patient visibility (avg 2–4 hrs).
              </div>
              <div className="mb-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>Patient ID (UUID)</label>
                <input value={rxForm.patient_id} onChange={e=>setRxForm(p=>({...p,patient_id:e.target.value}))} placeholder="Patient's system ID" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{border:'1.5px solid #dde8e1'}}/>
              </div>
              <div className="mb-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>Complaint</label>
                <input value={rxForm.complaint} onChange={e=>setRxForm(p=>({...p,complaint:e.target.value}))} placeholder="Fever, headache…" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={{border:'1.5px solid #dde8e1'}}/>
              </div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{color:'#5a7065'}}>Allopathic Medicines</div>
              {rxForm.medicines.map((med,i)=>(
                <div key={i} className="grid grid-cols-5 gap-1.5 mb-2">
                  {['name','dose','frequency','duration_days'].map(k=>(
                    <input key={k} value={med[k]} onChange={e=>setRxForm(p=>({...p,medicines:p.medicines.map((m,j)=>j===i?{...m,[k]:e.target.value}:m)}))}
                      placeholder={k==='name'?'Medicine':k==='dose'?'Dose':k==='frequency'?'Freq':'Days'}
                      className="rounded-lg px-2 py-1.5 text-xs outline-none" style={{border:'1.5px solid #dde8e1'}}/>
                  ))}
                  <button onClick={()=>setRxForm(p=>({...p,medicines:p.medicines.filter((_,j)=>j!==i)}))} className="text-red-400 text-sm">✕</button>
                </div>
              ))}
              <button onClick={()=>setRxForm(p=>({...p,medicines:[...p.medicines,{name:'',dose:'',frequency:'',duration_days:'',type:'allopathic'}]}))} className="text-xs font-bold mb-3" style={{color:'#1a5c3a'}}>+ Add Medicine</button>
              {specialtyType!=='modern'&&(
                <div className="mb-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:'#1a5c3a'}}>🌿 Ayurvedic Preparations / Notes</label>
                  <textarea value={rxForm.ayurveda_notes} onChange={e=>setRxForm(p=>({...p,ayurveda_notes:e.target.value}))} placeholder="e.g. Giloy swaras 10ml BD, Chyawanprash 1 tsp AM — doctor-reviewed wellness guidance. Not a substitute for allopathic treatment." rows={2} className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none" style={{border:'1.5px solid #b0d8c0',background:'#f0f9f4'}}/>
                  <div className="text-[10px] mt-1" style={{color:'#1a5c3a'}}>These are labeled "Doctor-Reviewed Ayurveda Guidance" — kept separate from allopathic prescriptions.</div>
                </div>
              )}
              <div className="mb-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>Doctor's Notes</label>
                <textarea value={rxForm.notes} onChange={e=>setRxForm(p=>({...p,notes:e.target.value}))} placeholder="Rest 3 days. Drink ORS. Dengue protocol if fever persists." className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none" style={{border:'1.5px solid #dde8e1',minHeight:70}}/>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setRxModal(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm border-2" style={{borderColor:'#dde8e1',color:'#5a7065'}}>Cancel</button>
                <button onClick={submitRx} disabled={rxLoading} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{background:'#1a5c3a'}}>
                  {rxLoading?'Submitting…':'Submit for WHO Review →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {selectedAppointment && <AppointmentDetailModal appointment={selectedAppointment} onClose={closeAppointmentDetail} />}
    </div>
  );
}
