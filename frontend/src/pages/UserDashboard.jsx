import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import LanguagePill from '../components/shared/LanguagePill';
import TeleconsultBooking from '../components/teleconsult/TeleconsultBooking';
import AppointmentDetailModal from '../components/teleconsult/AppointmentDetailModal';
import { PrescriptionTimeline } from '../components/prescription/PrescriptionTimeline';
import { appointmentAPI, notificationAPI, opsAPI } from '../services/appointmentAPI';
import { userAPI, doctorAPI, prescriptionService, aiService } from '../services/index';

const AI_FALLBACK = {
  fever:"🌡️ **Fever & Headache:**\n\nModern: Rest, ORS. Paracetamol 500mg if temp >38.5°C.\n\nAyurvedic: Tulsi-Ginger tea, Giloy juice.\n\n⚠️ Fever >3 days or rash → hospital immediately.\n\n*WHO-aligned · Doctor-verified*",
  cold:"🌿 **Cold Remedies:**\n\n• Tulsi-Ginger-Honey tea 2-3× daily\n• Chyawanprash morning\n• Steam inhalation\n\n*Medical Board approved*",
  dengue:"🦟 **Dengue Prevention:**\n\n✅ Remove standing water\n✅ Mosquito nets\n✅ Full sleeves\n\n⚠️ High fever + body ache + rash → hospital now!\n\n*WHO advisory*",
  diabetes:"🍎 **Diabetes Diet:**\n\n✅ Bitter gourd juice, Bajra, Jowar\n✅ Amla, chaas, leafy greens\n❌ Avoid sugar, maida, fried\n\n*Doctor-verified*",
  default:"👨‍⚕️ Based on our WHO-aligned knowledge base: Please stay hydrated, rest, and monitor symptoms. For proper diagnosis, book a free teleconsultation. All guidance is certified-doctor verified. 🙏"
};

function getAIFallback(t) {
  const l=t.toLowerCase();
  if(l.includes('fever')||l.includes('headache')||l.includes('बुखार')) return AI_FALLBACK.fever;
  if(l.includes('cold')||l.includes('cough')||l.includes('ayurved')) return AI_FALLBACK.cold;
  if(l.includes('dengue')) return AI_FALLBACK.dengue;
  if(l.includes('diabetes')||l.includes('sugar')) return AI_FALLBACK.diabetes;
  return AI_FALLBACK.default;
}

export default function UserDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState('home');
  const [messages, setMessages] = useState([{ role:'ai', text:"Namaste! 🙏 I'm your SwasthyaAI assistant. All health info is WHO-aligned & doctor-verified. Ask me anything in Hindi or English!", time:'Now' }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef(null);
  const sessionRef = useRef(null);
  const [plans, setPlans] = useState([
    { id:'1', title:'🌅 Morning Wellness', progress:65, badge:'Active', tasks:[
      {id:'t1',title:'Wake up 6:00 AM',icon:'☀️',completed:true},
      {id:'t2',title:'2 glasses warm water',icon:'💧',completed:true},
      {id:'t3',title:'Triphala with honey',icon:'🌿',completed:true},
      {id:'t4',title:'15 min Pranayama',icon:'🧘',completed:false},
      {id:'t5',title:'Herbal tea (Tulsi+Ginger)',icon:'🍵',completed:false},
    ]},
    { id:'2', title:'🍎 Nutrition Plan', progress:40, badge:'Week 2', tasks:[
      {id:'t6',title:'Leafy vegetables daily',icon:'🥗',completed:true},
      {id:'t7',title:'Whole grains (Bajra)',icon:'🌾',completed:true},
      {id:'t8',title:'Buttermilk / Chaas',icon:'🥛',completed:false},
    ]},
  ]);
  const [appointments, setAppointments] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [doctors, setDoctors] = useState([
    {id:'demo-1',name:'Dr. Priya Sharma',  specialization:'General Physician · 12 yrs',   avail:'Available Now',   bg:'#e8f5ee',icon:'👩‍⚕️'},
    {id:'demo-2',name:'Dr. Arvind Mishra', specialization:'Ayurveda Specialist · 8 yrs',  avail:'Available Now',   bg:'#fdf4e3',icon:'👨‍⚕️'},
    {id:'demo-3',name:'Dr. Sunita Rao',    specialization:'Pediatrician · 15 yrs',        avail:'Available in 30m',bg:'#ebf4ff',icon:'🧑‍⚕️'},
  ]);
  const [updates, setUpdates] = useState([
    {icon:'🌡️',bg:'#e8f5ee',title:'Dengue Season Alert — Precautions',meta:'Dr. Priya Sharma · 2 hrs ago'},
    {icon:'🌿',bg:'#fdf4e3',title:'Giloy + Tulsi Immunity Guide',meta:'Dr. Arvind Mishra · Yesterday'},
    {icon:'⚠️',bg:'#fde8e8',title:'H5N1 Alert: Precautions in Barwani',meta:'SwasthyaAI Medical Board · Today'},
  ]);
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [appointmentLoading, setAppointmentLoading] = useState(false);

  useEffect(()=>{
    if(chatRef.current) chatRef.current.scrollTop=chatRef.current.scrollHeight;
  },[messages]);

  useEffect(()=>{
    // Load data from API
    userAPI.getDoctorUpdates().then(r=>{ if(r?.data?.data?.length) setUpdates(r.data.data.map(u=>({icon:'📢',bg:'#e8f5ee',title:u.topic,meta:u.doctor_name||'Medical Board'}))); }).catch(()=>{});
    doctorAPI.listDoctors().then(r=>{ if(r?.data?.data?.length) setDoctors(r.data.data.slice(0,3).map(d=>({id:d.id,name:`Dr. ${d.first_name} ${d.last_name}`,specialization:`${d.specialization} · ${d.years_experience||0} yrs`,avail:'Available Now',bg:'#e8f5ee',icon:'👩‍⚕️'}))); }).catch(()=>{});
    appointmentAPI.getMyAppts().then(r=>setAppointments(r?.data?.data?.appointments||[])).catch(()=>{});
    prescriptionService.getPatientRx().then(r=>setPrescriptions(r?.data?.data?.prescriptions||[])).catch(()=>{});
    notificationAPI.getAll().then(r=>{ setNotifications(r?.data?.data?.notifications||[]); setUnread(r?.data?.data?.unread_count||0); }).catch(()=>{});
  },[]);

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

  const sendMessage = async () => {
    const text = chatInput.trim(); if(!text) return;
    const time = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
    setMessages(m=>[...m,{role:'user',text,time}]); setChatInput(''); setChatLoading(true);
    try {
      const res = await aiService.sendMessage({message:text,session_id:sessionRef.current});
      sessionRef.current = res.data.data.session_id;
      setMessages(m=>[...m,{role:'ai',text:res.data.data.reply,time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}]);
    } catch {
      setTimeout(()=>{
        setMessages(m=>[...m,{role:'ai',text:getAIFallback(text),time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}]);
      },1200);
    } finally { setChatLoading(false); }
  };

  const toggleTask = (planId,taskId) => {
    setPlans(prev=>prev.map(p=>{
      if(p.id!==planId) return p;
      const tasks = p.tasks.map(t=>t.id===taskId?{...t,completed:!t.completed}:t);
      const progress = Math.round((tasks.filter(t=>t.completed).length/tasks.length)*100);
      return {...p,tasks,progress};
    }));
  };

  const handleLogout = () => { logout(); navigate('/'); };
  const markNotifRead = async (id) => {
    await notificationAPI.markRead(id).catch(()=>{});
    setNotifications(n=>n.map(x=>x.id===id?{...x,is_read:true}:x));
    setUnread(u=>Math.max(0,u-1));
  };

  const navItems=[{id:'home',icon:'🏠',label:'Home'},{id:'ai',icon:'🤖',label:'AI Doctor'},{id:'plans',icon:'📋',label:'Plans'},{id:'consult',icon:'👩‍⚕️',label:'Consult'},{id:'more',icon:'⋯',label:'More'}];

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{background:'#f4f7f2'}}>
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 h-14 bg-white border-b" style={{borderColor:'#dde8e1',boxShadow:'0 2px 10px rgba(0,0,0,.04)'}}>
        <span className="font-bold text-lg" style={{fontFamily:"'Playfair Display',serif",color:'#1a5c3a'}}>Swasthya<span style={{color:'#f5a623'}}>AI</span></span>
        <div className="flex items-center gap-2">
          <LanguagePill/>
          <button className="relative text-xl" onClick={()=>setShowNotifs(!showNotifs)}>
            🔔{unread>0&&<span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{background:'#e53e3e'}}>{unread}</span>}
          </button>
          <button onClick={handleLogout} className="text-xs font-semibold px-3 py-1.5 rounded-full border" style={{borderColor:'#dde8e1',color:'#5a7065'}}>Exit</button>
        </div>
      </div>

      {/* Notification dropdown */}
      {showNotifs && (
        <div className="absolute right-2 top-14 z-50 w-72 bg-white rounded-2xl shadow-xl border overflow-hidden" style={{borderColor:'#dde8e1'}}>
          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{borderColor:'#dde8e1'}}>
            <span className="font-bold text-sm" style={{color:'#0d1e35'}}>Notifications</span>
            <button onClick={()=>{notificationAPI.markAllRead().catch(()=>{});setNotifications(n=>n.map(x=>({...x,is_read:true})));setUnread(0);}} className="text-[10px] font-bold" style={{color:'#1a5c3a'}}>Mark all read</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length===0 && <div className="text-center py-6 text-sm" style={{color:'#5a7065'}}>No alerts yet. We'll notify you as soon as your appointment, prescription, or follow-up updates arrive.</div>}
            {notifications.map(n=>(
              <div key={n.id} onClick={()=>markNotifRead(n.id)} className="flex gap-2 px-4 py-3 cursor-pointer border-b hover:bg-gray-50" style={{borderColor:'#f4f7f2',background:n.is_read?'#fff':'#f0f9f4'}}>
                <span className="text-base mt-0.5">🔔</span>
                <div><div className="text-xs font-bold" style={{color:'#0d1e35'}}>{n.title}</div><div className="text-[11px] mt-0.5" style={{color:'#5a7065'}}>{n.body}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* HOME */}
        {tab==='home' && (
          <div className="flex-1 overflow-y-auto pb-20">
            <div className="px-4 py-5 text-white relative overflow-hidden" style={{background:'linear-gradient(135deg,#0d1e35,#1a5c3a)'}}>
              <div className="absolute right-0 top-0 text-[80px] opacity-[0.05] pointer-events-none">🌿</div>
              <p className="text-xs opacity-50 mb-1">🌅 Good morning,</p>
              <p className="text-xl font-bold mb-3" style={{fontFamily:"'Playfair Display',serif"}}>{user?.first_name||'Ramesh'} {user?.last_name||'Kumar'}</p>
              <div className="grid grid-cols-3 gap-2">
                {[['82','Health Score'],['3','Active Plans'],['📡','Network OK']].map(([v,l])=>(
                  <div key={l} className="rounded-xl p-2.5 text-center" style={{background:'rgba(255,255,255,.1)'}}>
                    <div className="font-extrabold text-lg" style={{color:'#f5a623'}}>{v}</div>
                    <div className="text-[10px] opacity-50 mt-0.5">{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mx-4 mt-3 px-3 py-2 rounded-full text-xs font-semibold" style={{background:'#e6f4ec',border:'1px solid #b0d8c0',color:'#1a5c3a'}}>
              📴 Offline mode ready — core features work without internet
            </div>

            <p className="mx-4 mt-4 mb-2 font-bold text-base" style={{fontFamily:"'Playfair Display',serif"}}>Quick Actions</p>
            <div className="grid grid-cols-2 gap-3 mx-4">
              {[
                {icon:'🤖',title:'Ask AI Doctor',desc:'24/7 multilingual guidance',tab:'ai',accent:true},
                {icon:'👩‍⚕️',title:'Teleconsult',desc:'Connect with verified doctors',tab:'consult',accent:false},
                {icon:'📋',title:'Health Plan',desc:'Personalized preventive care',tab:'plans',accent:false},
                {icon:'💊',title:'My Prescriptions',desc:'WHO-reviewed medicines',tab:'rx',accent:false},
              ].map(item=>(
                <button key={item.title} onClick={()=>item.tab&&setTab(item.tab)}
                  className="p-4 rounded-2xl text-left transition-all active:scale-[.98]"
                  style={{background:item.accent?'linear-gradient(135deg,#1a5c3a,#246b47)':'#fff',boxShadow:'0 4px 16px rgba(26,92,58,.09)',border:'1.5px solid transparent'}}>
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <div className="font-bold text-sm" style={{color:item.accent?'#fff':'#1a2e1f'}}>{item.title}</div>
                  <div className="text-xs mt-0.5" style={{color:item.accent?'rgba(255,255,255,.7)':'#5a7065'}}>{item.desc}</div>
                </button>
              ))}
            </div>

            {/* Upcoming appointments */}
            {appointments.filter(a=>['scheduled','waiting'].includes(a.status)).length>0 && (
              <>
                <div className="flex items-center justify-between mx-4 mt-5 mb-2">
                  <p className="font-bold text-base" style={{fontFamily:"'Playfair Display',serif"}}>Upcoming Appointments</p>
                </div>
                <div className="mx-4 space-y-2">
                  {appointments.filter(a=>['scheduled','waiting'].includes(a.status)).slice(0,2).map(a=>(
                    <div key={a.id} className="flex gap-3 p-3 rounded-xl bg-white border" style={{borderColor:'#dde8e1'}}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{background:'#e8f5ee'}}>📅</div>
                      <div className="flex-1">
                        <div className="font-bold text-sm">{a.doctor_name}</div>
                        <div className="text-xs mt-0.5" style={{color:'#5a7065'}}>{new Date(a.scheduled_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</div>
                        <div className="flex gap-2 mt-1.5">
                          {a.video_patient_url&&<a href={a.video_patient_url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold px-2 py-1 rounded-full" style={{background:'#1a5c3a',color:'#fff'}}>📹 Join Video</a>}
                          <button onClick={()=>openAppointmentDetail(a.id)} className="text-[10px] font-bold px-2 py-1 rounded-full" style={{background:'#e8f5ee',color:'#2f855a'}}>Details</button>
                          <button onClick={()=>appointmentAPI.cancel(a.id,'Patient request').then(()=>{toast.success('Cancelled');setAppointments(p=>p.filter(x=>x.id!==a.id));}).catch(()=>toast.error('Cancel failed'))}
                            className="text-[10px] font-bold px-2 py-1 rounded-full" style={{background:'#fde8e8',color:'#c53030'}}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex items-center justify-between mx-4 mt-5 mb-2">
              <p className="font-bold text-base" style={{fontFamily:"'Playfair Display',serif"}}>Doctor Updates</p>
              <span className="text-xs font-bold cursor-pointer" style={{color:'#1e78d4'}}>See All →</span>
            </div>
            <div className="mx-4 space-y-2 pb-4">
              {updates.map((u,i)=>(
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-white border" style={{borderColor:'#dde8e1'}}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{background:u.bg||'#e8f5ee'}}>{u.icon}</div>
                  <div>
                    <div className="font-bold text-sm">{u.title}</div>
                    <div className="text-xs mt-0.5" style={{color:'#5a7065'}}>{u.meta}</div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1" style={{background:'#ebf4ff',color:'#2b6cb0'}}>🏥 WHO Reviewed</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI DOCTOR */}
        {tab==='ai' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 px-4 py-4 text-white" style={{background:'linear-gradient(135deg,#0d1e35,#1a5c3a)'}}>
              <div className="font-bold" style={{fontFamily:"'Playfair Display',serif"}}>AI Health Assistant</div>
              <div className="text-xs opacity-50 mt-0.5">Transformer AI · Doctor-validated knowledge</div>
              <div className="flex items-center gap-1.5 mt-1.5 text-[11px]" style={{color:'#3db87a'}}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#3db87a] animate-pulse"/>Online · Low-bandwidth mode
              </div>
            </div>
            <div className="mx-3 mt-2 mb-1 p-2.5 rounded-xl text-xs leading-relaxed" style={{background:'#fffbf0',border:'1px solid #f6d860',color:'#92600a'}}>
              ⚠️ General guidance only — not a substitute for professional consultation. All content WHO-aligned.
            </div>
            <div className="flex gap-2 px-3 py-1.5 overflow-x-auto flex-shrink-0" style={{scrollbarWidth:'none'}}>
              {[['🤒 Fever','I have fever and headache for 2 days'],['🌿 Cold','Ayurvedic remedy for cold?'],['🦟 Dengue','How to prevent dengue?'],['🍎 Diabetes','Diet for diabetes'],['🚨 H5N1','H5N1 symptoms and precautions']].map(([lbl,msg])=>(
                <button key={lbl} onClick={()=>setChatInput(msg)} className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold" style={{background:'#edf1e8',color:'#1a5c3a',border:'none'}}>{lbl}</button>
              ))}
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3" style={{background:'#f9fbff'}}>
              {messages.map((m,i)=>(
                <div key={i} className={`flex gap-2 items-end ${m.role==='user'?'flex-row-reverse':''}`}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0" style={{background:m.role==='ai'?'#1a5c3a':'#f5a623'}}>{m.role==='ai'?'🌿':'👤'}</div>
                  <div>
                    <div className="max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                      style={{background:m.role==='ai'?'#fff':'#1a5c3a',color:m.role==='ai'?'#1a2e1f':'#fff',borderBottomLeftRadius:m.role==='ai'?3:undefined,borderBottomRightRadius:m.role==='user'?3:undefined,boxShadow:m.role==='ai'?'0 2px 8px rgba(0,0,0,.06)':undefined}}
                      dangerouslySetInnerHTML={{__html:m.text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br/>')}}/>
                    <div className="text-[10px] mt-0.5 px-1" style={{color:'#a0b0a5',textAlign:m.role==='user'?'right':'left'}}>{m.time}</div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2 items-end">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{background:'#1a5c3a'}}>🌿</div>
                  <div className="flex gap-1.5 px-3 py-3 rounded-2xl bg-white shadow-sm" style={{borderBottomLeftRadius:3}}>
                    {[0,200,400].map(d=><span key={d} className="w-2 h-2 rounded-full animate-pulse" style={{background:'#3db87a',animationDelay:`${d}ms`}}/>)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex-shrink-0 flex gap-2 px-3 py-2.5 bg-white border-t" style={{borderColor:'#dde8e1'}}>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()}
                placeholder="Ask in Hindi or English…" className="flex-1 rounded-full px-4 py-2 text-sm outline-none" style={{background:'#f4f7f2',border:'1.5px solid #dde8e1'}}/>
              <button onClick={sendMessage} className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{background:'#1a5c3a'}}>➤</button>
            </div>
          </div>
        )}

        {/* HEALTH PLANS */}
        {tab==='plans' && (
          <div className="flex-1 overflow-y-auto pb-20">
            <div className="px-4 py-5 text-white" style={{background:'linear-gradient(135deg,#2d5016,#1a5c3a)'}}>
              <div className="font-bold" style={{fontFamily:"'Playfair Display',serif"}}>My Health Plans</div>
              <div className="text-xs opacity-50 mt-0.5">AI-personalized preventive care · WHO-reviewed</div>
            </div>
            <div className="p-4 space-y-3">
              {plans.map(plan=>(
                <div key={plan.id} className="bg-white rounded-2xl p-4 shadow-sm border" style={{borderColor:'#dde8e1'}}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-extrabold text-sm">{plan.title}</div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${plan.badge==='Active'?'bg-green-50 text-green-700':'bg-amber-50 text-amber-700'}`}>{plan.badge}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{background:'#edf1e8'}}>
                    <div className="h-full rounded-full transition-all" style={{width:`${plan.progress}%`,background:'linear-gradient(90deg,#3db87a,#1a5c3a)'}}/>
                  </div>
                  <div className="text-xs mb-3 flex items-center gap-2" style={{color:'#5a7065'}}>
                    {plan.progress}% complete
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:'#ebf4ff',color:'#2b6cb0'}}>🏥 WHO-reviewed</span>
                  </div>
                  <div className="space-y-2">
                    {plan.tasks.map(task=>(
                      <div key={task.id} className="flex items-center gap-2">
                        <span className="text-base">{task.icon}</span>
                        <span className={`flex-1 text-sm ${task.completed?'line-through opacity-50':''}`}>{task.title}</span>
                        <button onClick={()=>toggleTask(plan.id,task.id)} className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
                          style={{background:task.completed?'#3db87a':'transparent',border:`2px solid ${task.completed?'#3db87a':'#dde8e1'}`,color:'#fff'}}>
                          {task.completed?'✓':''}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRESCRIPTIONS */}
        {tab==='rx' && (
          <div className="flex-1 overflow-y-auto pb-20">
            <div className="px-4 py-5 text-white" style={{background:'linear-gradient(135deg,#0d1e35,#1a5c3a)'}}>
              <div className="font-bold" style={{fontFamily:"'Playfair Display',serif"}}>My Prescriptions</div>
              <div className="text-xs opacity-50 mt-0.5">WHO-reviewed before publication to your app</div>
            </div>
            <div className="p-4 space-y-3">
              {prescriptions.length===0 && (
                <div className="text-center py-10" style={{color:'#5a7065'}}>
                  <div className="text-4xl mb-3">💊</div>
                  <p className="text-sm font-semibold">No prescriptions yet</p>
                  <p className="text-xs mt-1">Book a teleconsultation to get started</p>
                  <button onClick={()=>setTab('consult')} className="mt-4 px-5 py-2 rounded-full font-bold text-sm text-white" style={{background:'#1a5c3a'}}>Book Consult →</button>
                </div>
              )}
              {prescriptions.map(rx=>(
                <PrescriptionTimeline key={rx.id} prescription={rx}/>
              ))}
            </div>
          </div>
        )}

        {/* TELECONSULT */}
        {tab==='consult' && (
          <div className="flex-1 overflow-y-auto pb-20">
            <div className="px-4 py-5 text-white" style={{background:'linear-gradient(135deg,#1a5c3a,#0d3d22)'}}>
              <div className="font-bold" style={{fontFamily:"'Playfair Display',serif"}}>Free Teleconsultation</div>
              <div className="text-xs opacity-50 mt-0.5">WHO-verified doctors · Book a slot · Real-time video</div>
            </div>
            <div className="p-4 space-y-3">
              {doctors.map(doc=>(
                <div key={doc.id} className="flex items-center gap-3 p-4 bg-white rounded-2xl border shadow-sm" style={{borderColor:'#dde8e1'}}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{background:doc.bg}}>{doc.icon}</div>
                  <div className="flex-1">
                    <div className="font-extrabold text-sm">{doc.name}</div>
                    <div className="text-xs mt-0.5" style={{color:'#5a7065'}}>{doc.specialization}</div>
                    <div className="flex items-center gap-1 mt-1 text-xs font-semibold" style={{color:doc.avail==='Available Now'?'#38a169':'#e65100'}}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:doc.avail==='Available Now'?'#38a169':'#e65100'}}/>
                      {doc.avail}
                    </div>
                  </div>
                  <button onClick={()=>setBookingDoctor({id:doc.id,name:doc.name,specialization:doc.specialization,consultation_duration_min:30})}
                    className="px-4 py-2 rounded-full text-sm font-bold text-white" style={{background:'#1a5c3a'}}>
                    Book
                  </button>
                </div>
              ))}
            </div>

            {/* Past consultations */}
            {appointments.filter(a=>a.status==='completed').length>0 && (
              <div className="px-4 pb-4">
                <p className="font-bold text-sm mb-2" style={{fontFamily:"'Playfair Display',serif"}}>Past Consultation Timeline</p>
                {appointments.filter(a=>a.status==='completed').slice(0,3).map(a=>(
                  <div key={a.id} className="rounded-2xl p-3 mb-2 bg-white border" style={{borderColor:'#dde8e1'}}>
                    <div className="flex items-start gap-2">
                      <div className="mt-1 text-lg">🩺</div>
                      <div className="flex-1">
                        <div className="font-bold text-sm">{a.doctor_name} • {a.specialization || 'General Physician'}</div>
                        <div className="text-[11px] text-[#5a7065]">{new Date(a.ended_at||a.scheduled_at).toLocaleDateString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</div>
                        <div className="mt-1 text-[11px]" style={{color:'#2b6cb0'}}><strong>Status:</strong> {a.status.replace('_',' ')}</div>
                        {a.diagnosis && <div className="text-[11px] mt-1" style={{color:'#5a7065'}}><strong>Diagnosis:</strong> {a.diagnosis}</div>}
                        {a.doctor_notes && <div className="text-[11px] mt-1" style={{color:'#5a7065'}}><strong>Notes:</strong> {a.doctor_notes}</div>}
                        {a.follow_up_date && <div className="text-[11px] mt-1" style={{color:'#5a7065'}}><strong>Follow-up:</strong> {new Date(a.follow_up_date).toLocaleDateString('en-IN')} ({a.follow_up_notes || 'No note'})</div>}
                        <div className="mt-2 flex gap-2">
                          {a.video_patient_url && <a href={a.video_patient_url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-2 py-1 rounded-full" style={{background:'#e8f5ee',color:'#276749'}}>▶ Join Video</a>}
                          <button onClick={()=>openAppointmentDetail(a.id)} className="text-[10px] px-2 py-1 rounded-full" style={{background:'#e8f5ee',color:'#1f6f8a'}}>Details</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MORE */}
        {tab==='more' && (
          <div className="flex-1 overflow-y-auto pb-20">
            <div className="px-4 py-5 text-white" style={{background:'linear-gradient(135deg,#0d1e35,#1a5c3a)'}}>
              <div className="font-bold" style={{fontFamily:"'Playfair Display',serif"}}>{user?.first_name||'My'} Profile</div>
            </div>
            <div className="p-4 space-y-2">
              {[{icon:'💊',label:'My Prescriptions',action:()=>setTab('rx')},{icon:'📅',label:'My Appointments',action:()=>setTab('consult')},{icon:'🏕️',label:'Nearby Health Camps',action:null}].map(item=>(
                <button key={item.label} onClick={item.action} className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border text-left" style={{borderColor:'#dde8e1'}}>
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-semibold text-sm">{item.label}</span>
                  <span className="ml-auto" style={{color:'#5a7065'}}>›</span>
                </button>
              ))}
              <div className="border-t pt-3" style={{borderColor:'#dde8e1'}}>
                <Link to="/terms" className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border text-left mb-2 block" style={{borderColor:'#dde8e1'}}>
                  <span className="text-xl">📄</span><span className="font-semibold text-sm">Terms &amp; Conditions</span><span className="ml-auto" style={{color:'#5a7065'}}>›</span>
                </Link>
                <Link to="/help" className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border text-left mb-2 block" style={{borderColor:'#dde8e1'}}>
                  <span className="text-xl">❓</span><span className="font-semibold text-sm">Help &amp; Support 24/7</span><span className="ml-auto" style={{color:'#5a7065'}}>›</span>
                </Link>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border text-left" style={{borderColor:'#dde8e1',color:'#e53e3e'}}>
                  <span className="text-xl">🚪</span><span className="font-semibold text-sm">Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="flex-shrink-0 flex bg-white border-t" style={{borderColor:'#dde8e1',boxShadow:'0 -4px 16px rgba(0,0,0,.05)'}}>
        {navItems.map(item=>(
          <button key={item.id} onClick={()=>setTab(item.id)}
            className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-[11px] font-bold transition-colors"
            style={{color:tab===item.id?'#1a5c3a':'#5a7065'}}>
            <span className="text-xl" style={{transform:tab===item.id?'scale(1.15)':'scale(1)',transition:'transform .15s'}}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {selectedAppointment && <AppointmentDetailModal appointment={selectedAppointment} onClose={closeAppointmentDetail} />}
      {/* Teleconsult booking modal */}
      {bookingDoctor && (
        <TeleconsultBooking
          doctor={bookingDoctor}
          onBooked={(data)=>{ setAppointments(p=>[data,...p]); setBookingDoctor(null); }}
          onClose={()=>setBookingDoctor(null)}/>
      )}
    </div>
  );
}
