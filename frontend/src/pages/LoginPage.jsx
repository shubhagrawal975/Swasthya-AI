import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { authService, otpService } from '../services/index';
import OTPInput from '../components/otp/OTPInput';
import LanguagePill from '../components/shared/LanguagePill';

const SPECS = ['General Physician','Ayurveda Specialist','Pediatrician','Gynaecologist','Cardiologist','Dermatologist','Orthopedic','ENT Specialist','Psychiatrist','Community Health Officer','Other'];
const LANGS = [{value:'en',label:'English'},{value:'hi',label:'हिंदी'},{value:'mr',label:'मराठी'},{value:'bn',label:'বাংলা'},{value:'te',label:'తెలుగు'},{value:'ta',label:'தமிழ்'}];

function Inp({label,placeholder,value,onChange,type='text',required=false}) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>
        {label}{required&&<span style={{color:'#e53e3e'}}> *</span>}
      </label>
      <input type={type} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
        style={{border:'1.5px solid #dde8e1',fontFamily:"'Plus Jakarta Sans',sans-serif",background:'#fff',color:'#1a2e1f'}}
        onFocus={e=>e.target.style.borderColor='#1a5c3a'}
        onBlur={e=>e.target.style.borderColor='#dde8e1'}/>
    </div>
  );
}

function Sel({label,value,onChange,options}) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{border:'1.5px solid #dde8e1',background:'#fff',color:'#1a2e1f'}}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FileUp({label,file,onChange,inputRef,required=false}) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1" style={{color:'#5a7065'}}>{label}{required&&<span style={{color:'#e53e3e'}}> *</span>}</label>
      <div onClick={()=>inputRef.current?.click()} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
        style={{border:`2px dashed ${file?'#1a5c3a':'#dde8e1'}`,background:file?'#f0f9f4':'#fafcfa'}}>
        <span className="text-xl">{file?'✅':'📄'}</span>
        <div>
          <div className="text-sm font-semibold" style={{color:file?'#276749':'#5a7065'}}>{file?file.name:'Click to upload'}</div>
          <div className="text-[10px]" style={{color:'#a0b0a5'}}>PDF, JPG or PNG — max 10MB</div>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e=>onChange(e.target.files[0])}/>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [role, setRole] = useState('user');
  const [mode, setMode] = useState('signin'); // signin | register | forgot | otp_verify | doc_pending
  const [docStep, setDocStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState('password');
  const [otpMobile, setOtpMobile] = useState('');
  const [otpPurpose, setOtpPurpose] = useState('registration');
  const [isPending, setIsPending] = useState(false);

  const [uf, setUF] = useState({first_name:'',last_name:'',mobile:'',password:'',village:'',district:'',state:'',preferred_lang:'en'});
  const [df, setDF] = useState({first_name:'',last_name:'',mobile:'',email:'',password:'',specialization:'',mci_number:'',registration_authority:'MCI',years_experience:'',hospital_affiliation:'',clinic_name:'',clinic_address:'',district:'',state:''});
  const [af, setAF] = useState({email:'admin@swasthya.ai',password:'Password123!'});
  const [sf, setSF] = useState({mobile:'',password:'',mci_number:''});
  const [forgotMobile, setForgotMobile] = useState('');
  const degRef = useRef(null), mciRef = useRef(null);
  const [degFile, setDegFile] = useState(null);
  const [mciFile, setMciFile] = useState(null);

  const u = (k,v) => setUF(p=>({...p,[k]:v}));
  const d = (k,v) => setDF(p=>({...p,[k]:v}));
  const s = (k,v) => setSF(p=>({...p,[k]:v}));

  const handleOTPVerified = async (payload) => {
    const otpCode = payload?.otp || '';
    if (isPending) { toast.success('Mobile verified! Credentials under review (24–48 hrs).'); navigate('/'); return; }
    if (mode === 'otp_verify') {
      try {
        if (role === 'doctor') {
          const res = await authService.loginDoctorWithOTP({ mobile: otpMobile, otp: otpCode });
          login(res.data.data.user, res.data.data.accessToken, res.data.data.refreshToken);
          navigate('/doctor');
        } else {
          const res = await authService.loginUserWithOTP({ mobile: otpMobile, otp: otpCode });
          login(res.data.data.user, res.data.data.accessToken, res.data.data.refreshToken);
          navigate('/dashboard');
        }
        return;
      } catch (e) {
        toast.error(e.response?.data?.message || 'OTP login failed');
      }
    }
    if (payload?.data?.verified) {
      toast.success('OTP verified!');
      navigate('/');
    }
  };

  const signIn = async () => {
    setLoading(true);
    try {
      if (loginMethod === 'otp') {
        if (role === 'admin') throw new Error('Admin login requires password');
        const mobile = role === 'user' ? sf.mobile : df.mobile;
        if (!mobile) throw new Error('Enter mobile to receive OTP');
        await otpService.send(mobile, 'login');
        setOtpMobile(mobile);
        setOtpPurpose('login');
        setMode('otp_verify');
        return;
      }

      let res;
      if (role === 'user') {
        res = await authService.loginUser({ mobile: sf.mobile, password: sf.password });
      } else if (role === 'doctor') {
        res = await authService.loginDoctor({ mci_number: sf.mci_number, password: sf.password });
      } else {
        res = await authService.loginAdmin({ email: af.email, password: af.password });
      }

      const dat = res.data.data;
      if (dat?.requires_otp) { setOtpMobile(dat.mobile || sf.mobile); setOtpPurpose('login'); setMode('otp_verify'); return; }
      login(dat.user, dat.accessToken, dat.refreshToken);
      toast.success('Welcome!');
      if (role === 'doctor') navigate('/doctor');
      else if (role === 'admin') navigate('/ops');
      else navigate('/dashboard');
    } catch (e) { toast.error(e.response?.data?.message || e.message || 'Login failed'); }
    finally { setLoading(false); }
  };

  const registerUser = async () => {
    if (!uf.first_name||!uf.mobile||!uf.password) return toast.error('Fill all required fields');
    if (uf.password.length<8) return toast.error('Password min 8 characters');
    setLoading(true);
    try {
      const res = await authService.registerUser(uf);
      setOtpMobile(uf.mobile); setOtpPurpose('registration'); setMode('otp_verify');
      toast.success(res.data.message||'OTP sent!');
    } catch(e) { toast.error(e.response?.data?.message||'Registration failed'); }
    finally { setLoading(false); }
  };

  const registerDoctor = async () => {
    if (!degFile||!mciFile) return toast.error('Both certificates required');
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(df).forEach(([k,v])=>fd.append(k,v));
      fd.append('degree_certificate',degFile);
      fd.append('mci_certificate',mciFile);
      const res = await authService.registerDoctor(fd);
      setOtpMobile(df.mobile); setOtpPurpose('doctor_register'); setIsPending(true); setDocStep(3);
      toast.success(res.data.message||'Submitted!');
    } catch(e) { toast.error(e.response?.data?.message||'Registration failed'); }
    finally { setLoading(false); }
  };

  const GreenBtn = ({onClick,disabled,children,dark=false}) => (
    <button onClick={onClick} disabled={disabled||loading}
      className="w-full py-3 rounded-xl font-bold text-sm text-white mt-1 transition-all disabled:opacity-50"
      style={{background:dark?'#0d1e35':'#1a5c3a'}}>
      {disabled&&loading?'Please wait…':children}
    </button>
  );
  const OutBtn = ({onClick,children}) => (
    <button onClick={onClick} className="w-full py-2.5 mt-2 rounded-xl font-bold text-sm border-2 transition-all"
      style={{borderColor:'#dde8e1',color:'#5a7065'}}>{children}</button>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{background:'linear-gradient(145deg,#0d1e35,#0e2840,#0d2a1a)'}}>
      <div className="fixed top-0 right-0 w-72 h-72 rounded-full pointer-events-none" style={{background:'radial-gradient(circle,rgba(61,184,122,.08),transparent 70%)'}}/>
      <div className="fixed bottom-0 left-0 w-64 h-64 rounded-full pointer-events-none" style={{background:'radial-gradient(circle,rgba(245,166,35,.06),transparent 70%)'}}/>

      {/* Topbar */}
      <div className="flex items-center justify-between px-5 py-4 relative z-10">
        <button onClick={()=>navigate('/')} className="text-sm font-bold" style={{color:'rgba(255,255,255,.55)'}}>← Back</button>
        <span className="text-lg font-bold" style={{fontFamily:"'Playfair Display',serif",color:'#fff'}}>Swasthya<span style={{color:'#f5a623'}}>AI</span></span>
        <LanguagePill dark/>
      </div>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-4 py-2 pb-8 relative z-10">
        <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl">

          {/* Role tabs — only on signin/register */}
          {(mode==='signin'||mode==='register') && (
            <div className="flex" style={{background:'#f4f7f2',padding:5}}>
              {[['user','👤 Patient'],['doctor','👨‍⚕️ Doctor'],['admin','🛡️ Admin']].map(([r,lbl])=>(
                <button key={r} onClick={()=>{setRole(r);setDocStep(0);if(r==='admin') setLoginMethod('password');}}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{background:role===r?'#fff':'transparent',color:role===r?'#1a5c3a':'#5a7065',boxShadow:role===r?'0 2px 8px rgba(0,0,0,.08)':'none'}}>
                  {lbl}
                </button>
              ))}
            </div>
          )}

          <div className="px-6 pt-5 pb-6">

            {/* ── OTP Screen ── */}
            {mode==='otp_verify' && (
              <>
                <OTPInput mobile={otpMobile} purpose={otpPurpose} role={role}
                  onVerified={handleOTPVerified}
                  onBack={()=>setMode(otpPurpose==='forgot_password'?'forgot':'signin')}
                  autoSend={true}/>
                {isPending && (
                  <div className="mt-3 p-3 rounded-xl text-xs leading-relaxed" style={{background:'#fef3dc',border:'1px solid #f6c46a',color:'#92600a'}}>
                    🏥 Credentials under review by Medical Board (24–48 hrs). SMS notification on approval.
                  </div>
                )}
              </>
            )}

            {/* ── Forgot Password ── */}
            {mode==='forgot' && (
              <div>
                <h3 className="font-bold text-base mb-1" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>Reset Password</h3>
                <p className="text-xs mb-4" style={{color:'#5a7065'}}>Enter your registered mobile to receive an OTP.</p>
                <Inp label="Mobile Number *" placeholder="+91 XXXXX XXXXX" value={forgotMobile} onChange={setForgotMobile}/>
                <GreenBtn onClick={()=>{if(!forgotMobile)return toast.error('Enter mobile');setOtpMobile(forgotMobile);setOtpPurpose('forgot_password');setMode('otp_verify');}}>
                  Send Reset OTP →
                </GreenBtn>
                <OutBtn onClick={()=>setMode('signin')}>← Back to Sign In</OutBtn>
              </div>
            )}

            {/* ── Sign In ── */}
            {mode==='signin' && (
              <div>
                <h3 className="font-bold text-base mb-3" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>
                  {role==='doctor' ? 'Doctor Sign In' : role==='admin' ? 'Admin Sign In' : 'Patient Sign In'}
                </h3>
                <div className="flex items-center gap-2 mb-3 text-xs">
                  {['password','otp'].map(m=> {
                    if (role==='admin' && m==='otp') return null;
                    return (
                      <button key={m} onClick={()=>setLoginMethod(m)} className="flex-1 py-2 rounded-xl font-bold" style={{background:loginMethod===m?'#1a5c3a':'#f4f7f2',color:loginMethod===m?'#fff':'#1a5c3a'}}>
                        {m==='password'?'Password':'OTP'} Login
                      </button>
                    );
                  })}
                </div>
                {loginMethod==='password' ? (
                  role==='user' ? (
                    <>
                      <Inp label="Mobile Number *" placeholder="+91 XXXXX XXXXX" value={sf.mobile} onChange={v=>s('mobile',v)}/>
                      <Inp label="Password *" type="password" placeholder="••••••••" value={sf.password} onChange={v=>s('password',v)}/>
                    </>
                  ) : role==='doctor' ? (
                    <>
                      <Inp label="MCI Registration Number *" placeholder="MCI-2019-DL-XXXXX" value={sf.mci_number} onChange={v=>s('mci_number',v)}/>
                      <Inp label="Password *" type="password" placeholder="••••••••" value={sf.password} onChange={v=>s('password',v)}/>
                    </>
                  ) : (
                    <>
                      <Inp label="Admin Email *" placeholder="admin@swasthya.ai" value={af.email} onChange={v=>setAF(p=>({...p,email:v}))}/>
                      <Inp label="Password *" type="password" placeholder="••••••••" value={af.password} onChange={v=>setAF(p=>({...p,password:v}))}/>
                    </>
                  )
                ) : (
                  <>
                    <Inp label="Mobile Number *" placeholder="+91 XXXXX XXXXX" value={role==='user'?sf.mobile:df.mobile} onChange={v=>role==='user'?s('mobile',v):d('mobile',v)}/>
                    <p className="text-[11px] mt-1" style={{color:'#5a7065'}}>You will receive a one-time code via SMS. It will log you in instantly. If you don't receive it, request again in 1 minute.</p>
                  </>
                )}
                <GreenBtn onClick={signIn} dark={role==='doctor'||role==='admin'}>{loginMethod==='password'?'Sign In →':'Send OTP & Continue'}</GreenBtn>
                <button onClick={()=>setMode('forgot')} className="text-xs font-semibold mt-2 block text-center w-full" style={{color:'#1a5c3a'}}>
                  Forgot password?
                </button>
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px" style={{background:'#dde8e1'}}/>
                  <span className="text-xs" style={{color:'#a0b0a5'}}>or</span>
                  <div className="flex-1 h-px" style={{background:'#dde8e1'}}/>
                </div>
                <button onClick={()=>setMode('register')}
                  className="w-full py-2.5 rounded-xl font-bold text-sm border-2 transition-all"
                  style={{borderColor:'#1a5c3a',color:'#1a5c3a'}}>
                  {role==='doctor'?'Register as Doctor':'Create Free Account'}
                </button>
              </div>
            )}

            {/* ── User Register ── */}
            {mode==='register' && role==='user' && (
              <div>
                <h3 className="font-bold text-base mb-3" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>Create Patient Account</h3>
                <div className="grid grid-cols-2 gap-x-3">
                  <Inp label="First Name *" value={uf.first_name} onChange={v=>u('first_name',v)} placeholder="Ramesh"/>
                  <Inp label="Last Name *"  value={uf.last_name}  onChange={v=>u('last_name',v)}  placeholder="Kumar"/>
                </div>
                <Inp label="Mobile *" value={uf.mobile} onChange={v=>u('mobile',v)} placeholder="+91 XXXXX XXXXX"/>
                <div className="grid grid-cols-2 gap-x-3">
                  <Inp label="Village/Town" value={uf.village}  onChange={v=>u('village',v)}  placeholder="Sendhwa"/>
                  <Inp label="District"     value={uf.district} onChange={v=>u('district',v)} placeholder="Barwani"/>
                </div>
                <div className="grid grid-cols-2 gap-x-3">
                  <Inp label="State" value={uf.state} onChange={v=>u('state',v)} placeholder="MP"/>
                  <Sel label="Language" value={uf.preferred_lang} onChange={v=>u('preferred_lang',v)} options={LANGS}/>
                </div>
                <Inp label="Password (min 8) *" type="password" value={uf.password} onChange={v=>u('password',v)} placeholder="Create a password"/>
                <GreenBtn onClick={registerUser}>Create Account & Send OTP →</GreenBtn>
                <OutBtn onClick={()=>setMode('signin')}>Already registered? Sign In</OutBtn>
              </div>
            )}

            {/* ── Doctor Register (multi-step) ── */}
            {mode==='register' && role==='doctor' && (
              <div>
                <h3 className="font-bold text-base mb-3" style={{fontFamily:"'Playfair Display',serif",color:'#0d1e35'}}>Register as Doctor</h3>

                {/* Step dots */}
                <div className="flex items-center mb-4">
                  {['Basic','Credentials','Documents','Verify'].map((lbl,i)=>(
                    <React.Fragment key={lbl}>
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{background:i<=docStep?'#1a5c3a':'#edf1e8',color:i<=docStep?'#fff':'#a0b0a5'}}>
                          {i<docStep?'✓':i+1}
                        </div>
                        <div className="text-[9px] mt-0.5 hidden sm:block" style={{color:i===docStep?'#1a5c3a':'#a0b0a5'}}>{lbl}</div>
                      </div>
                      {i<3&&<div className="flex-1 h-0.5 mx-1" style={{background:i<docStep?'#1a5c3a':'#dde8e1'}}/>}
                    </React.Fragment>
                  ))}
                </div>

                {/* Step 0 — Basic */}
                {docStep===0 && (
                  <>
                    <div className="grid grid-cols-2 gap-x-3">
                      <Inp label="First Name *" value={df.first_name} onChange={v=>d('first_name',v)} placeholder="Priya"/>
                      <Inp label="Last Name *"  value={df.last_name}  onChange={v=>d('last_name',v)}  placeholder="Sharma"/>
                    </div>
                    <Sel label="Specialization *" value={df.specialization} onChange={v=>d('specialization',v)}
                      options={[{value:'',label:'Select specialization…'},...SPECS.map(s=>({value:s,label:s}))]}/>
                    <Inp label="Mobile *" value={df.mobile} onChange={v=>d('mobile',v)} placeholder="+91 XXXXX XXXXX"/>
                    <Inp label="Email *" type="email" value={df.email} onChange={v=>d('email',v)} placeholder="dr@hospital.com"/>
                    <Inp label="Password (min 8) *" type="password" value={df.password} onChange={v=>d('password',v)} placeholder="Create a password"/>
                    <GreenBtn dark onClick={()=>{
                      if(!df.first_name||!df.specialization||!df.mobile||!df.email||!df.password) return toast.error('Fill all required fields');
                      if(df.password.length<8) return toast.error('Password min 8 characters');
                      setDocStep(1);
                    }}>Continue →</GreenBtn>
                    <OutBtn onClick={()=>setMode('signin')}>Already registered? Sign In</OutBtn>
                  </>
                )}

                {/* Step 1 — Credentials */}
                {docStep===1 && (
                  <>
                    <div className="p-3 rounded-xl mb-3 text-xs leading-relaxed" style={{background:'#fff8e8',border:'1px solid #f6c46a',color:'#92600a'}}>
                      🛡️ All credentials are reviewed by our Medical Board. False information = permanent ban.
                    </div>
                    <Inp label="MCI / State Council Reg. No. *" value={df.mci_number} onChange={v=>d('mci_number',v)} placeholder="MCI-2019-DL-XXXXX"/>
                    <Sel label="Issuing Authority" value={df.registration_authority} onChange={v=>d('registration_authority',v)}
                      options={[{value:'MCI',label:'MCI (Medical Council of India)'},{value:'NMC',label:'NMC (National Medical Commission)'},{value:'State',label:'State Medical Council'},{value:'Other',label:'Other'}]}/>
                    <Inp label="Years of Experience *" type="number" value={df.years_experience} onChange={v=>d('years_experience',v)} placeholder="5"/>
                    <Inp label="Hospital / Clinic Affiliation" value={df.hospital_affiliation} onChange={v=>d('hospital_affiliation',v)} placeholder="PHC Sendhwa / Private"/>
                    <Inp label="Clinic Name (if private)" value={df.clinic_name} onChange={v=>d('clinic_name',v)} placeholder="Sharma Clinic"/>
                    <div className="grid grid-cols-2 gap-x-3">
                      <Inp label="District" value={df.district} onChange={v=>d('district',v)} placeholder="Barwani"/>
                      <Inp label="State"    value={df.state}    onChange={v=>d('state',v)}    placeholder="MP"/>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>setDocStep(0)} className="flex-1 py-2.5 rounded-xl font-bold text-sm border-2" style={{borderColor:'#dde8e1',color:'#5a7065'}}>← Back</button>
                      <button onClick={()=>{
                        if(!df.mci_number||!df.years_experience) return toast.error('MCI number and experience required');
                        setDocStep(2);
                      }} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white" style={{background:'#0d1e35'}}>Continue →</button>
                    </div>
                  </>
                )}

                {/* Step 2 — Documents */}
                {docStep===2 && (
                  <>
                    <div className="p-3 rounded-xl mb-3 text-xs leading-relaxed" style={{background:'#ebf4ff',border:'1px solid #bee3f8',color:'#2b6cb0'}}>
                      🏥 Upload clear scanned copies. Stored securely, accessed only by Medical Board.
                    </div>
                    <FileUp label="MBBS / MD Degree Certificate *" file={degFile} onChange={setDegFile} inputRef={degRef} required/>
                    <FileUp label="MCI Registration Certificate *"  file={mciFile} onChange={setMciFile} inputRef={mciRef} required/>
                    <div className="p-3 rounded-xl mb-3 text-xs" style={{background:'#fef3dc',border:'1px solid #f6c46a',color:'#92600a'}}>
                      ⏰ All prescriptions you issue will go through WHO-aligned Medical Board review before reaching patients.
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>setDocStep(1)} className="flex-1 py-2.5 rounded-xl font-bold text-sm border-2" style={{borderColor:'#dde8e1',color:'#5a7065'}}>← Back</button>
                      <button onClick={registerDoctor} disabled={loading}
                        className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50" style={{background:'#0d1e35'}}>
                        {loading?'Submitting…':'Submit & Send OTP →'}
                      </button>
                    </div>
                  </>
                )}

                {/* Step 3 — OTP after submission */}
                {docStep===3 && (
                  <OTPInput mobile={df.mobile} purpose="doctor_register" role="doctor"
                    onVerified={()=>{toast.success('Mobile verified! Application submitted. SMS notification within 24–48 hrs.');navigate('/');}}
                    autoSend={false}/>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
