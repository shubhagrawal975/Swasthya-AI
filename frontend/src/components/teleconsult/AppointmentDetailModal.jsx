import React from 'react';

export default function AppointmentDetailModal({ appointment, onClose }) {
  if (!appointment) return null;
  const formatVal = v => (v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const statusColor = {
    scheduled: '#1a73e8', waiting: '#f59e0b', in_progress: '#059669', completed: '#2f855a', cancelled: '#e53e3e', no_show: '#c53030', rejected: '#c53030', under_review: '#dd6b20'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/40" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e2e8f0' }}>
          <div>
            <div className="text-base font-bold">Appointment Summary</div>
            <div className="text-xs text-slate-500">Detailed timeline and consultation notes</div>
          </div>
          <button onClick={onClose} className="text-sm font-bold text-slate-500">✕ Close</button>
        </div>
        <div className="p-4 space-y-3 text-sm text-slate-700">
          <div className="grid grid-cols-2 gap-3">
            <div><strong>Appointment ID</strong><div className="text-xs text-slate-500">{appointment.id}</div></div>
            <div><strong>Status</strong><div className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full" style={{ background: `${statusColor[appointment.status] || '#e2e8f0'}33`, color: statusColor[appointment.status] || '#334155' }}>{appointment.status?.replace('_',' ')}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><strong>Patient</strong><div className="text-xs text-slate-500">{appointment.patient_name || appointment.patient?.name || '—'}</div></div>
            <div><strong>Doctor</strong><div className="text-xs text-slate-500">{appointment.doctor_name || appointment.doctor?.name || '—'}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><strong>Scheduled Time</strong><div className="text-xs text-slate-500">{formatVal(appointment.scheduled_at)}</div></div>
            <div><strong>Type</strong><div className="text-xs text-slate-500">{appointment.type || 'Video'}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><strong>Check-in</strong><div className="text-xs text-slate-500">{formatVal(appointment.waiting_at || appointment.started_at)}</div></div>
            <div><strong>Completed At</strong><div className="text-xs text-slate-500">{formatVal(appointment.ended_at)}</div></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><strong>Follow-up</strong><div className="text-xs text-slate-500">{appointment.follow_up_date ? new Date(appointment.follow_up_date).toLocaleDateString('en-IN') : 'None'}</div></div>
            <div><strong>Language</strong><div className="text-xs text-slate-500">{appointment.language || 'en'}</div></div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 border" style={{ borderColor: '#e2e8f0' }}>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-bold mb-1">Reason</div>
            <div className="text-[12px] leading-relaxed">{appointment.reason || 'Not provided'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 border" style={{ borderColor: '#e2e8f0' }}>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-bold mb-1">Doctor Notes</div>
            <div className="text-[12px] leading-relaxed">{appointment.doctor_notes || 'No notes yet.'}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 border" style={{ borderColor: '#e2e8f0' }}>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-bold mb-1">Video/Consultation Info</div>
            <div className="text-[12px] leading-relaxed">{appointment.video_url ? <a href={appointment.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Join Video Consultation</a> : 'No video link available'}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: '#f7f9ff', border: '1px dashed #cddbfe' }}>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-bold">Timeline</div>
            <div className="text-[12px] mt-2 space-y-1">
              <div>• Scheduled: {formatVal(appointment.scheduled_at)}</div>
              {appointment.waiting_at && <div>• Checked in: {formatVal(appointment.waiting_at)}</div>}
              {appointment.started_at && <div>• Started: {formatVal(appointment.started_at)}</div>}
              {appointment.ended_at && <div>• Completed: {formatVal(appointment.ended_at)}</div>}
              {appointment.follow_up_date && <div>• Follow-up: {formatVal(appointment.follow_up_date)}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
