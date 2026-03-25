import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LanguagePill from '../components/shared/LanguagePill';

const sections = [
  {
    title: '1. Acceptance of Terms',
    body: 'By using SwasthyaAI ("the Platform"), you agree to these Terms and Conditions. The Platform supports — but does not replace — professional medical care. These terms comply with WHO guidelines and Indian Medical Council regulations.',
  },
  {
    title: '2. Medical Disclaimer',
    body: 'SwasthyaAI provides general health information and AI-powered guidance. This does NOT constitute a doctor-patient relationship. All critical medical decisions must be made in consultation with a certified healthcare professional.',
    bullets: ['AI responses are informational only', 'Emergencies require immediate hospital care', 'All prescriptions undergo WHO review before patient visibility'],
  },
  {
    title: '3. Doctor Verification Policy',
    body: 'All doctors must provide: a valid MBBS/MD degree certificate, MCI/State Council registration number, and mobile OTP verification. Applications are reviewed within 24–48 hours by our Medical Board. Misrepresentation will result in permanent ban and may be reported to medical authorities.',
  },
  {
    title: '4. WHO Prescription Review',
    body: 'Every prescription submitted by a doctor is: ① automatically checked against WHO drug safety protocols, ② reviewed by a board-certified Medical Board member, ③ published to the patient only after dual approval. Flagged prescriptions require doctor revision before any publication.',
  },
  {
    title: '5. Privacy & Data Protection',
    body: 'Your health data is encrypted at rest and in transit (AES-256), never sold to third parties, and accessible only to your treating doctors. The Platform is compliant with IT Act 2000 and DPDP Act 2023 (India).',
  },
  {
    title: '6. Multilingual Content',
    body: 'The Platform supports 9+ languages. While we strive for accuracy in all translations, the English version of medical content is authoritative. Always verify critical medical information with your doctor.',
  },
  {
    title: '7. Intellectual Property',
    body: 'The SwasthyaAI platform, including its AI models, Ayurvedic knowledge base, and doctor-verified content, is proprietary. Built by Team TechNerds for ET GenAI Hackathon 2026.',
  },
  {
    title: '8. Limitation of Liability',
    body: 'SwasthyaAI shall not be liable for any medical decisions made based on AI guidance. The platform is a health information tool, not a licensed medical device. Always consult a qualified physician for diagnosis and treatment.',
  },
  {
    title: '9. Changes to Terms',
    body: 'We reserve the right to modify these Terms at any time. Continued use of the Platform after changes constitutes acceptance. Users will be notified of material changes via SMS or in-app notification.',
  },
  {
    title: '10. Governing Law',
    body: 'These Terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in New Delhi, India.',
  },
];

export default function TermsPage() {
  const navigate = useNavigate();
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
            Terms &amp; Conditions
          </h1>
          <p className="text-white/48 text-sm mt-1">Last updated: March 2026 · SwasthyaAI Platform</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1" style={{ background: '#fff', borderRadius: '20px 20px 0 0', marginTop: -12 }}>
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* WHO badge */}
          <div className="flex items-start gap-3 p-4 rounded-xl mb-8"
            style={{ background: '#ebf4ff', border: '1.5px solid #bee3f8' }}>
            <span className="text-xl">🏥</span>
            <div>
              <div className="font-bold text-sm text-blue-700 mb-1">WHO-Aligned Platform</div>
              <p className="text-xs text-blue-600 leading-relaxed">
                All prescriptions issued on SwasthyaAI go through a WHO-aligned review process before being
                displayed to patients. Patient safety is our highest priority.
              </p>
            </div>
          </div>

          {sections.map((s) => (
            <div key={s.title} className="mb-7">
              <h2 className="text-base font-extrabold mb-2" style={{ color: '#0d1e35' }}>{s.title}</h2>
              <p className="text-sm leading-relaxed" style={{ color: '#5a7065' }}>{s.body}</p>
              {s.bullets && (
                <ul className="mt-2 space-y-1 pl-4">
                  {s.bullets.map(b => (
                    <li key={b} className="text-sm list-disc" style={{ color: '#5a7065' }}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="text-center pt-6 pb-4 space-y-3">
            <p className="text-xs" style={{ color: '#a0b0a5' }}>
              Questions? Contact us at{' '}
              <a href="mailto:legal@swasthya.ai" className="font-semibold" style={{ color: '#1a5c3a' }}>
                legal@swasthya.ai
              </a>
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button onClick={() => navigate(-1)}
                className="px-6 py-2.5 rounded-full font-bold text-sm text-white transition-all hover:opacity-90"
                style={{ background: '#1a5c3a' }}>
                ← Back
              </button>
              <Link to="/help"
                className="px-6 py-2.5 rounded-full font-bold text-sm border-2 transition-all"
                style={{ borderColor: '#1a5c3a', color: '#1a5c3a' }}>
                Help &amp; Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
