import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import LanguagePill from '../components/shared/LanguagePill';

const faqs = [
  { q: 'Is SwasthyaAI free?',          a: 'Yes, completely free for patients. Funded by government health initiatives and NGO partnerships.' },
  { q: 'Are prescriptions safe?',       a: 'Every prescription goes through our WHO-aligned review process before being shown to you. No medicine is visible without WHO safety approval.' },
  { q: 'Does it work offline?',         a: 'Yes — health plans, prescriptions, and AI responses are cached offline. Internet is only needed for live consultations and new AI queries.' },
  { q: 'How do I change my language?',  a: 'Tap the 🌐 globe icon (top-right corner) on any screen to instantly switch between 9+ supported languages including Hindi, Bengali, Arabic, and more.' },
  { q: 'Is my health data private?',    a: 'Yes. Your data is AES-256 encrypted, never sold, and compliant with DPDP Act 2023. Only your treating doctor can see your records.' },
  { q: 'How long is doctor verification?', a: 'Credential review takes 24–48 hours by our Medical Board. You\'ll receive an SMS once approved.' },
  { q: 'Can I use this in my village?', a: 'Yes! SwasthyaAI is designed for rural areas. It works on 2G/3G networks and has an offline mode for when connectivity is poor.' },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f4f7f2' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0d1e35,#1a5c3a)' }} className="flex-shrink-0">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-white/60 text-sm font-semibold hover:text-white transition-colors">
              ← Back
            </button>
            <LanguagePill dark />
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Playfair Display',serif" }}>
            Help &amp; Support
          </h1>
          <p className="text-white/48 text-sm mt-1">Available 24 hours a day, 7 days a week</p>
        </div>
      </div>

      <div className="flex-1" style={{ background: '#fff', borderRadius: '20px 20px 0 0', marginTop: -12 }}>
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* 24/7 Banner */}
          <div className="rounded-2xl p-6 text-center text-white"
            style={{ background: 'linear-gradient(135deg,#1a5c3a,#246b47)' }}>
            <div className="text-4xl mb-3">🆘</div>
            <h3 className="text-lg font-bold mb-1" style={{ fontFamily: "'Playfair Display',serif" }}>
              24/7 Support Available
            </h3>
            <p className="text-white/65 text-sm mb-3">Around-the-clock for medical emergencies and technical issues</p>
            <div className="text-xl font-extrabold" style={{ color: '#f5a623' }}>
              📞 1800-SWASTHYA (Toll Free)
            </div>
            <p className="text-white/45 text-xs mt-2">
              WhatsApp: +91 98765 00000 · support@swasthya.ai
            </p>
          </div>

          {/* Quick help cards */}
          <div>
            <h2 className="text-base font-extrabold mb-3" style={{ color: '#0d1e35' }}>Quick Help</h2>
            <div className="space-y-2">
              {[
                { icon: '🤖', title: 'Ask AI Doctor', desc: 'Get instant health guidance in your language', action: () => navigate('/dashboard') },
                { icon: '📹', title: 'Video Tutorial', desc: 'How to use SwasthyaAI — 5 minute guide', action: null },
                { icon: '💬', title: 'Live Chat Support', desc: 'Chat with a support agent in your language', action: null },
                { icon: '📧', title: 'Email Support', desc: 'support@swasthya.ai · Response within 4 hours', action: null },
                { icon: '📱', title: 'WhatsApp Support', desc: '+91 98765 00000 · Available 24/7', action: null },
              ].map(item => (
                <button key={item.title}
                  onClick={item.action || undefined}
                  className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:shadow-md"
                  style={{ background: '#fff', border: '1px solid #dde8e1' }}>
                  <span className="text-2xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="font-bold text-sm" style={{ color: '#1a2e1f' }}>{item.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#5a7065' }}>{item.desc}</div>
                  </div>
                  <span style={{ color: '#5a7065' }}>›</span>
                </button>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div>
            <h2 className="text-base font-extrabold mb-3" style={{ color: '#0d1e35' }}>
              Frequently Asked Questions
            </h2>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid #dde8e1' }}>
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left"
                    style={{ background: openFaq === i ? '#f0f9f4' : '#fff' }}>
                    <span className="font-semibold text-sm" style={{ color: '#1a2e1f' }}>{faq.q}</span>
                    <span className="text-lg ml-3" style={{ color: '#5a7065', transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                      ›
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 text-sm leading-relaxed" style={{ color: '#5a7065', background: '#f0f9f4' }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Emergency */}
          <div>
            <h2 className="text-base font-extrabold mb-3" style={{ color: '#0d1e35' }}>Emergency?</h2>
            <div className="rounded-xl p-4" style={{ background: '#fde8e8', border: '1.5px solid #fc8181' }}>
              <div className="font-extrabold text-sm mb-2" style={{ color: '#c53030' }}>
                🚨 In a Medical Emergency
              </div>
              <p className="text-sm leading-relaxed mb-3" style={{ color: '#9b2c2c' }}>
                Call 108 (National Ambulance) or visit your nearest hospital immediately.
                SwasthyaAI is NOT a substitute for emergency medical care.
              </p>
              <div className="text-lg font-extrabold" style={{ color: '#c53030' }}>
                📞 108 — National Emergency
              </div>
            </div>
          </div>

          <div className="text-center pt-2 pb-6 flex gap-3 justify-center flex-wrap">
            <button onClick={() => navigate(-1)}
              className="px-6 py-2.5 rounded-full font-bold text-sm text-white"
              style={{ background: '#1a5c3a' }}>
              ← Back
            </button>
            <Link to="/terms"
              className="px-6 py-2.5 rounded-full font-bold text-sm border-2"
              style={{ borderColor: '#1a5c3a', color: '#1a5c3a' }}>
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
