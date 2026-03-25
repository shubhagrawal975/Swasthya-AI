import React from 'react';

const STATUS_CONFIG = {
  draft:        { label: 'Draft',          icon: '📝', color: '#718096', bg: '#edf2f7', bar: 0   },
  submitted:    { label: 'Submitted',      icon: '📤', color: '#2b6cb0', bg: '#ebf4ff', bar: 20  },
  who_check:    { label: 'WHO Check',      icon: '🔍', color: '#92600a', bg: '#fef3dc', bar: 40  },
  under_review: { label: 'Under Review',   icon: '👨‍⚕️', color: '#6b46c1', bg: '#f0ebff', bar: 60  },
  board_review: { label: 'Board Review',   icon: '🏥', color: '#2b6cb0', bg: '#ebf4ff', bar: 70  },
  verified:     { label: 'Verified',       icon: '✅', color: '#276749', bg: '#e6f4ec', bar: 85  },
  approved:     { label: 'Approved',       icon: '✅', color: '#276749', bg: '#e6f4ec', bar: 90  },
  published:    { label: 'Published',      icon: '✅', color: '#276749', bg: '#e6f4ec', bar: 100 },
  flagged:      { label: 'Flagged',        icon: '⚠️', color: '#c53030', bg: '#fde8e8', bar: 50  },
  rejected:     { label: 'Rejected',       icon: '❌', color: '#c53030', bg: '#fde8e8', bar: 0   },
};

const STEPS = [
  { key: 'submitted',    label: 'Submitted by Doctor' },
  { key: 'who_check',    label: 'Automated WHO Check' },
  { key: 'board_review', label: 'Medical Board Review' },
  { key: 'published',    label: 'Published to You' },
];

function stepIndex(status) {
  const map = { draft:0, submitted:1, who_check:2, under_review:2, board_review:3, verified:3, approved:3, published:4, flagged:2, rejected:0 };
  return map[status] ?? 0;
}

export function PrescriptionStatusBadge({ status, small = false }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
  return (
    <span className={`inline-flex items-center gap-1 font-bold rounded-full ${small ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

export function PrescriptionTimeline({ prescription }) {
  const { status, medicines, complaint, diagnosis, notes, doctor_name, published_at, created_at } = prescription;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
  const curStep = stepIndex(status);
  const isPublished = status === 'published' || status === 'approved' || status === 'verified';
  const isFlagged = status === 'flagged' || status === 'rejected';

  return (
    <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: '#dde8e1', boxShadow: '0 4px 16px rgba(26,92,58,.07)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <div className="font-bold text-sm" style={{ color: '#0d1e35' }}>Prescription from Dr. {doctor_name}</div>
          <div className="text-xs mt-0.5" style={{ color: '#5a7065' }}>
            {new Date(created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <PrescriptionStatusBadge status={status} />
      </div>

      {/* Progress bar */}
      <div className="mx-4 h-1.5 rounded-full overflow-hidden mb-3" style={{ background: '#edf1e8' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${cfg.bar}%`, background: isFlagged ? '#e53e3e' : 'linear-gradient(90deg,#3db87a,#1a5c3a)' }} />
      </div>

      {/* Step indicators */}
      <div className="flex mx-4 mb-4">
        {STEPS.map((step, idx) => {
          const done    = idx < curStep;
          const active  = idx === curStep - 1;
          const blocked = isFlagged && idx >= curStep;
          return (
            <div key={step.key} className="flex-1 text-center relative">
              {idx < STEPS.length - 1 && (
                <div className="absolute top-2.5 left-1/2 w-full h-0.5"
                  style={{ background: done ? '#3db87a' : '#dde8e1' }} />
              )}
              <div className="relative z-10 w-5 h-5 rounded-full mx-auto flex items-center justify-center text-[9px] font-bold"
                style={{
                  background: done ? '#3db87a' : active ? '#f5a623' : blocked ? '#e53e3e' : '#edf1e8',
                  color: (done || active || blocked) ? '#fff' : '#a0b0a5',
                }}>
                {done ? '✓' : idx + 1}
              </div>
              <div className="text-[9px] mt-1 leading-tight hidden sm:block" style={{ color: done ? '#276749' : '#a0b0a5' }}>
                {step.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Flagged notice */}
      {isFlagged && (
        <div className="mx-4 mb-3 p-3 rounded-xl" style={{ background: '#fde8e8', border: '1px solid #fc8181' }}>
          <div className="text-xs font-bold mb-1" style={{ color: '#c53030' }}>⚠️ Prescription Under Revision</div>
          <div className="text-xs leading-relaxed" style={{ color: '#9b2c2c' }}>
            This prescription was flagged by our Medical Board for revision. Your doctor has been notified and will resubmit. This does not affect your care.
          </div>
        </div>
      )}

      {/* Medicines — only shown when published */}
      {isPublished && medicines && (
        <div className="mx-4 mb-4">
          <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: '#276749' }}>
            <span>🏥 WHO-Reviewed & Approved</span>
          </div>
          {complaint && <div className="text-xs mb-1" style={{ color: '#5a7065' }}><strong>Complaint:</strong> {complaint}</div>}
          {diagnosis && <div className="text-xs mb-2" style={{ color: '#5a7065' }}><strong>Diagnosis:</strong> {diagnosis}</div>}
          <div className="space-y-1.5">
            {(Array.isArray(medicines) ? medicines : JSON.parse(medicines)).map((med, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: '#f0f9f4' }}>
                <span className="text-base">💊</span>
                <div className="flex-1">
                  <div className="font-bold text-sm" style={{ color: '#1a2e1f' }}>{med.name}</div>
                  <div className="text-xs" style={{ color: '#5a7065' }}>
                    {med.dose} · {med.frequency} · {med.duration_days} days
                  </div>
                </div>
              </div>
            ))}
          </div>
          {notes && (
            <div className="mt-2 p-2.5 rounded-xl text-xs leading-relaxed" style={{ background: '#fef3dc', color: '#92600a' }}>
              📋 <strong>Doctor's Note:</strong> {notes}
            </div>
          )}
        </div>
      )}

      {/* Pending message */}
      {!isPublished && !isFlagged && (
        <div className="mx-4 mb-4 p-3 rounded-xl" style={{ background: '#fef3dc', border: '1px solid #f6c46a' }}>
          <div className="text-xs leading-relaxed" style={{ color: '#92600a' }}>
            ⏳ Your prescription is being reviewed by our WHO-aligned Medical Board for safety. Medicines will appear here once approved (avg. 2–4 hours).
          </div>
        </div>
      )}
    </div>
  );
}

export default PrescriptionTimeline;
