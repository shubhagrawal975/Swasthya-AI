import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL || '/api';

/**
 * OTPInput Component
 * Props:
 *  - mobile: string (the mobile to verify)
 *  - purpose: 'registration' | 'login' | 'forgot_password' | 'doctor_register'
 *  - role: 'patient' | 'doctor'
 *  - onVerified: function(data) - called when OTP verified successfully
 *  - onBack: function() - called when user clicks back
 *  - autoSend: boolean - whether to auto-send OTP on mount
 */
export default function OTPInput({ mobile, purpose, role = 'patient', onVerified, onBack, autoSend = false }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [maskedMobile, setMaskedMobile] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [sent, setSent] = useState(false);
  const inputRefs = useRef([]);
  const timerRef = useRef(null);
  const expiryRef = useRef(null);

  // ── Send OTP ──────────────────────────────────────────
  const sendOTP = useCallback(async () => {
    if (cooldown > 0) return;
    setSending(true);
    try {
      const res = await axios.post(`${API}/otp/send`, { mobile, purpose });
      const { masked_mobile, expires_in_minutes, cooldown_seconds } = res.data.data;
      setMaskedMobile(masked_mobile);
      setExpiresIn(expires_in_minutes * 60);
      setCooldown(cooldown_seconds);
      setSent(true);
      toast.success(`OTP sent to ${masked_mobile}`);

      // Start cooldown timer
      clearInterval(timerRef.current);
      let c = cooldown_seconds;
      timerRef.current = setInterval(() => {
        c -= 1;
        setCooldown(c);
        if (c <= 0) clearInterval(timerRef.current);
      }, 1000);

      // Start expiry timer
      clearInterval(expiryRef.current);
      let e = expires_in_minutes * 60;
      expiryRef.current = setInterval(() => {
        e -= 1;
        setExpiresIn(e);
        if (e <= 0) clearInterval(expiryRef.current);
      }, 1000);

      // Focus first input
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send OTP';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }, [mobile, purpose, cooldown]);

  useEffect(() => {
    if (autoSend) sendOTP();
    return () => { clearInterval(timerRef.current); clearInterval(expiryRef.current); };
  }, []);

  // ── Handle digit input ────────────────────────────────
  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();

    // Auto-submit when all filled
    if (value && index === 5) {
      const otp = [...newDigits.slice(0, 5), value.slice(-1)].join('');
      if (otp.length === 6) setTimeout(() => verifyOTP(otp), 100);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...'      '].map((_, i) => pasted[i] || '');
    setDigits(newDigits);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) setTimeout(() => verifyOTP(pasted), 100);
  };

  // ── Verify OTP ────────────────────────────────────────
  const verifyOTP = async (otpOverride) => {
    const otp = otpOverride || digits.join('');
    if (otp.length < 6) return toast.error('Please enter all 6 digits');
    setLoading(true);
    setAttempts(a => a + 1);
    try {
      const res = await axios.post(`${API}/otp/verify`, { mobile, purpose, otp });
      toast.success('OTP verified successfully!');
      onVerified?.({otp, data: res.data.data});
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid OTP';
      toast.error(msg);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const isExpired  = sent && expiresIn <= 0;
  const otp        = digits.join('');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="text-3xl mb-2">📱</div>
        <h3 className="font-bold text-base" style={{ color: '#0d1e35', fontFamily: "'Playfair Display',serif" }}>
          Verify Your Mobile
        </h3>
        {sent && maskedMobile ? (
          <p className="text-sm mt-1" style={{ color: '#5a7065' }}>
            OTP sent to <strong>{maskedMobile}</strong>
          </p>
        ) : (
          <p className="text-sm mt-1" style={{ color: '#5a7065' }}>
            We'll send a 6-digit OTP to <strong>{mobile}</strong>
          </p>
        )}
      </div>

      {/* Send OTP button (shown before first send) */}
      {!sent && (
        <button
          onClick={sendOTP}
          disabled={sending}
          className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all"
          style={{ background: '#1a5c3a' }}
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending OTP…
            </span>
          ) : 'Send OTP'}
        </button>
      )}

      {/* OTP Input boxes */}
      {sent && (
        <>
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={el => (inputRefs.current[i] = el)}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={loading || isExpired}
                className="w-12 h-14 text-center text-xl font-bold rounded-xl transition-all outline-none"
                style={{
                  border: `2px solid ${d ? '#1a5c3a' : '#dde8e1'}`,
                  background: d ? '#f0f9f4' : '#fff',
                  color: '#1a2e1f',
                }}
              />
            ))}
          </div>

          {/* Timer */}
          {!isExpired && expiresIn > 0 && (
            <p className="text-center text-xs" style={{ color: expiresIn < 60 ? '#e53e3e' : '#5a7065' }}>
              OTP expires in <strong>{formatTime(expiresIn)}</strong>
            </p>
          )}
          {isExpired && (
            <p className="text-center text-xs font-bold" style={{ color: '#e53e3e' }}>
              OTP expired. Please request a new one.
            </p>
          )}

          {/* Verify button */}
          <button
            onClick={() => verifyOTP()}
            disabled={loading || otp.length < 6 || isExpired}
            className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-50"
            style={{ background: '#1a5c3a' }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying…
              </span>
            ) : 'Verify OTP →'}
          </button>

          {/* Resend */}
          <div className="text-center">
            {cooldown > 0 ? (
              <p className="text-xs" style={{ color: '#5a7065' }}>
                Resend OTP in <strong>{cooldown}s</strong>
              </p>
            ) : (
              <button
                onClick={sendOTP}
                disabled={sending}
                className="text-xs font-bold underline"
                style={{ color: '#1a5c3a' }}
              >
                {sending ? 'Sending…' : "Didn't receive OTP? Resend"}
              </button>
            )}
          </div>
        </>
      )}

      {/* Back */}
      {onBack && (
        <button
          onClick={onBack}
          className="w-full py-2.5 rounded-xl font-semibold text-sm border-2 transition-all"
          style={{ borderColor: '#dde8e1', color: '#5a7065' }}
        >
          ← Back
        </button>
      )}
    </div>
  );
}
