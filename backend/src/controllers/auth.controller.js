const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query, withTransaction } = require('../config/database');
const AppError = require('../utils/AppError');
const { initiateOTP, verifyOTP } = require('../services/otp.service');
const { sendEmail } = require('../services/email.service');
const logger = require('../utils/logger');

function signTokens(payload) {
  const accessToken  = jwt.sign(payload, process.env.JWT_SECRET,         { expiresIn: process.env.JWT_EXPIRES_IN         || '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET,  { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'  });
  return { accessToken, refreshToken };
}

exports.registerUser = async (req, res, next) => {
  try {
    const { first_name, last_name, mobile, email, password, village, district, state, preferred_lang, date_of_birth, gender } = req.body;
    const existing = await query('SELECT id FROM users WHERE mobile=$1', [mobile]);
    if (existing.rows[0]) return next(new AppError('Mobile number already registered', 409));
    const password_hash = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    await query(
      `INSERT INTO users (id,first_name,last_name,mobile,email,password_hash,village,district,state,preferred_lang,date_of_birth,gender)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [userId,first_name,last_name,mobile,email||null,password_hash,village,district,state,preferred_lang||'en',date_of_birth||null,gender||null]
    );
    const otpResult = await initiateOTP(mobile, 'registration');
    await query(`INSERT INTO audit_logs (actor_id,actor_role,action,entity_type,entity_id,ip_address) VALUES ($1,'patient','USER_REGISTERED','users',$1,$2)`,[userId,req.ip]);
    res.status(201).json({ success:true, message:`OTP sent to ${otpResult.maskedMobile}`, data:{ user_id:userId, masked_mobile:otpResult.maskedMobile, expires_in_minutes:otpResult.expiresInMinutes, cooldown_seconds:otpResult.cooldownSeconds, requires_otp_verification:true }});
  } catch(err){next(err);}
};

exports.loginUser = async (req, res, next) => {
  try {
    const { mobile, password } = req.body;
    const result = await query(`SELECT id,first_name,last_name,mobile,email,password_hash,is_active,mobile_verified,preferred_lang,profile_photo,health_score,streak_days FROM users WHERE mobile=$1`,[mobile]);
    const user = result.rows[0];
    if(!user || !(await bcrypt.compare(password,user.password_hash))) return next(new AppError('Invalid mobile or password',401));
    if(!user.is_active) return next(new AppError('Account deactivated',403));
    if(!user.mobile_verified){
      const otpResult = await initiateOTP(mobile,'login');
      return res.json({success:true,message:`OTP sent to ${otpResult.maskedMobile}`,data:{requires_otp:true,masked_mobile:otpResult.maskedMobile,expires_in_minutes:otpResult.expiresInMinutes}});
    }
    const tokens = signTokens({id:user.id,role:'patient'});
    await query('UPDATE users SET refresh_token=$1,last_login=NOW() WHERE id=$2',[tokens.refreshToken,user.id]);
    res.json({success:true,message:'Login successful',data:{user:{...user,role:'patient'},...tokens}});
  } catch(err){next(err);}
};

exports.loginUserWithOTP = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;
    const userRes = await query(`SELECT id,first_name,last_name,mobile,email,is_active,preferred_lang,profile_photo,health_score FROM users WHERE mobile=$1`,[mobile]);
    if(!userRes.rows[0]) return next(new AppError('Mobile not registered',404));
    const user = userRes.rows[0];
    if(!user.is_active) return next(new AppError('Account deactivated',403));
    await verifyOTP(mobile,'login',otp);
    await query('UPDATE users SET mobile_verified=TRUE WHERE id=$1',[user.id]);
    const tokens = signTokens({id:user.id,role:'patient'});
    await query('UPDATE users SET refresh_token=$1,last_login=NOW() WHERE id=$2',[tokens.refreshToken,user.id]);
    res.json({success:true,message:'Login successful',data:{user:{...user,role:'patient'},...tokens}});
  } catch(err){next(err);}
};

exports.loginDoctorWithOTP = async (req, res, next) => {
  try {
    const { mobile, otp } = req.body;
    const doctorRes = await query(`SELECT id,first_name,last_name,mobile,email,verification_status,is_active,preferred_lang,profile_photo FROM doctors WHERE mobile=$1`, [mobile]);
    if(!doctorRes.rows[0]) return next(new AppError('Mobile not registered',404));
    const doctor = doctorRes.rows[0];
    if(!doctor.is_active) return next(new AppError('Account deactivated',403));
    if(doctor.verification_status === 'rejected') return next(new AppError('Doctor application rejected. Contact support.',403));
    await verifyOTP(mobile,'login',otp);
    await query('UPDATE doctors SET mobile_verified=TRUE WHERE id=$1',[doctor.id]);
    const tokens = signTokens({id:doctor.id,role:'doctor'});
    await query('UPDATE doctors SET refresh_token=$1,last_login=NOW() WHERE id=$2',[tokens.refreshToken,doctor.id]);
    res.json({success:true,message:'Login successful',data:{user:{...doctor,role:'doctor'},...tokens}});
  } catch(err){next(err);}
};

exports.registerDoctor = async (req, res, next) => {
  try {
    const { first_name,last_name,mobile,email,password,specialization,mci_number,registration_authority,years_experience,hospital_affiliation,clinic_name,clinic_address,district,state,languages_spoken } = req.body;
    const [em,emci,eemail] = await Promise.all([
      query('SELECT id FROM doctors WHERE mobile=$1',[mobile]),
      query('SELECT id FROM doctors WHERE mci_number=$1',[mci_number]),
      email?query('SELECT id FROM doctors WHERE email=$1',[email]):Promise.resolve({rows:[]}),
    ]);
    if(em.rows[0])    return next(new AppError('Mobile already registered',409));
    if(emci.rows[0])  return next(new AppError('MCI number already registered',409));
    if(eemail.rows[0])return next(new AppError('Email already registered',409));
    const degree_certificate = req.files?.degree_certificate?.[0]?.filename||null;
    const mci_certificate    = req.files?.mci_certificate?.[0]?.filename||null;
    const additional_docs    = req.files?.additional_docs?.map(f=>f.filename)||[];
    if(!degree_certificate||!mci_certificate) return next(new AppError('Both degree certificate and MCI certificate are required',400));
    const password_hash = await bcrypt.hash(password,12);
    const doctorId = uuidv4();
    await withTransaction(async(client)=>{
      await client.query(
        `INSERT INTO doctors (id,first_name,last_name,mobile,email,password_hash,specialization,mci_number,registration_authority,years_experience,hospital_affiliation,clinic_name,clinic_address,district,state,languages_spoken,degree_certificate,mci_certificate,additional_docs,verification_status,mobile_verified)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending',FALSE)`,
        [doctorId,first_name,last_name,mobile,email||null,password_hash,specialization,mci_number,registration_authority||'MCI',parseInt(years_experience)||0,hospital_affiliation,clinic_name,clinic_address,district,state,JSON.stringify(languages_spoken||['en']),degree_certificate,mci_certificate,JSON.stringify(additional_docs)]
      );
      await client.query(`INSERT INTO doctor_verifications (id,doctor_id,status,submitted_at) VALUES ($1,$2,'pending',NOW())`,[uuidv4(),doctorId]);
      await client.query(`INSERT INTO audit_logs (actor_id,actor_role,action,entity_type,entity_id,ip_address) VALUES ($1,'doctor','DOCTOR_REGISTERED','doctors',$1,$2)`,[doctorId,req.ip]);
    });
    const otpResult = await initiateOTP(mobile,'doctor_register');
    await sendEmail(process.env.BOARD_EMAIL||process.env.ADMIN_EMAIL,'SwasthyaAI: New Doctor Registration — Review Required',
      `<h2>New Doctor</h2><p><strong>Dr. ${first_name} ${last_name}</strong> | MCI: ${mci_number} | ${specialization} | ${years_experience} yrs | ${district}, ${state}</p><p><a href="${process.env.FRONTEND_URL}/admin">Review credentials →</a></p>`
    );
    res.status(201).json({success:true,message:`OTP sent to ${otpResult.maskedMobile}. Credentials reviewed within 24–48 hrs.`,data:{doctor_id:doctorId,masked_mobile:otpResult.maskedMobile,requires_otp_verification:true,verification_status:'pending',cooldown_seconds:otpResult.cooldownSeconds}});
  } catch(err){next(err);}
};

exports.loginDoctor = async (req, res, next) => {
  try {
    const { mci_number, password } = req.body;
    const result = await query(`SELECT id,first_name,last_name,mobile,email,password_hash,is_active,verification_status,specialization,profile_photo,mobile_verified FROM doctors WHERE mci_number=$1`,[mci_number]);
    const doctor = result.rows[0];
    if(!doctor || !(await bcrypt.compare(password,doctor.password_hash))) return next(new AppError('Invalid MCI number or password',401));
    if(!doctor.is_active) return next(new AppError('Account deactivated',403));
    if(doctor.verification_status==='rejected') return next(new AppError('Account rejected. Contact support@swasthya.ai',403));
    if(!doctor.mobile_verified){
      const otpResult = await initiateOTP(doctor.mobile,'login');
      return res.json({success:true,message:`OTP sent to ${otpResult.maskedMobile}`,data:{requires_otp:true,masked_mobile:otpResult.maskedMobile}});
    }
    const tokens = signTokens({id:doctor.id,role:'doctor'});
    await query('UPDATE doctors SET refresh_token=$1,last_login=NOW() WHERE id=$2',[tokens.refreshToken,doctor.id]);
    res.json({success:true,message:'Login successful',data:{user:{...doctor,role:'doctor'},...tokens}});
  } catch(err){next(err);}
};

exports.loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await query(`SELECT id,name,email,password_hash,is_active,role FROM admins WHERE email=$1`,[email]);
    const admin = result.rows[0];
    if(!admin || !(await bcrypt.compare(password,admin.password_hash))) return next(new AppError('Invalid email or password',401));
    if(!admin.is_active) return next(new AppError('Account deactivated',403));
    const tokens = signTokens({id:admin.id,role:'admin'});
    await query('UPDATE admins SET refresh_token=$1,last_login=NOW() WHERE id=$2',[tokens.refreshToken,admin.id]);
    res.json({success:true,message:'Login successful',data:{user:{id:admin.id,name:admin.name,email:admin.email,role:'admin'},...tokens}});
  } catch(err){next(err);}
};

exports.verifyLoginOTP = async (req, res, next) => {
  try {
    const { mobile, otp, role } = req.body;
    const table = role==='doctor'?'doctors':'users';
    const userRes = await query(`SELECT id,first_name,last_name,mobile,email,is_active,verification_status FROM ${table} WHERE mobile=$1`,[mobile]);
    if(!userRes.rows[0]) return next(new AppError('Account not found',404));
    const user = userRes.rows[0];
    await verifyOTP(mobile,'login',otp);
    await query(`UPDATE ${table} SET mobile_verified=TRUE WHERE id=$1`,[user.id]);
    if(role==='doctor' && user.verification_status==='pending'){
      return res.json({success:true,message:'Mobile verified. Credentials under review (24–48 hrs).',data:{mobile_verified:true,verification_status:'pending'}});
    }
    const tokens = signTokens({id:user.id,role:role==='doctor'?'doctor':'patient'});
    await query(`UPDATE ${table} SET refresh_token=$1,last_login=NOW() WHERE id=$2`,[tokens.refreshToken,user.id]);
    res.json({success:true,message:'OTP verified. Login successful.',data:{user:{...user,role},...tokens}});
  } catch(err){next(err);}
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if(!refreshToken) return next(new AppError('Refresh token required',400));
    let decoded;
    try{decoded=jwt.verify(refreshToken,process.env.JWT_REFRESH_SECRET);} catch{return next(new AppError('Invalid or expired refresh token',401));}
    const table = decoded.role==='doctor' ? 'doctors' : decoded.role==='admin' ? 'admins' : 'users';
    const result = await query(`SELECT id,refresh_token,is_active FROM ${table} WHERE id=$1`,[decoded.id]);
    const record = result.rows[0];
    if(!record||record.refresh_token!==refreshToken) return next(new AppError('Refresh token invalid',401));
    if(typeof record.is_active !== 'undefined' && !record.is_active) return next(new AppError('Account deactivated',403));
    const tokens = signTokens({id:decoded.id,role:decoded.role});
    await query(`UPDATE ${table} SET refresh_token=$1 WHERE id=$2`,[tokens.refreshToken,decoded.id]);
    res.json({success:true,data:tokens});
  } catch(err){next(err);}
};

exports.logout = async (req, res, next) => {
  try {
    const table = req.user.role === 'doctor' ? 'doctors' : req.user.role === 'admin' ? 'admins' : 'users';
    await query(`UPDATE ${table} SET refresh_token=NULL WHERE id=$1`, [req.user.id]);
    res.json({success:true,message:'Logged out'});
  } catch(err){next(err);}
};
