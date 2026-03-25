import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { appointmentAPI } from '../../services/appointmentAPI';

/**
 * TeleconsultBooking
 * Props: doctor { id, name, specialization, consultation_duration_min }
 *        onBooked(appointmentData) - called after successful booking
 *        onClose()
 */
export default function TeleconsultBooking({ doctor, onBooked, onClose }) {
  const [step, setStep] = useState('select'); // select | confirm | booked
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookedData, setBookedData] = useState(null);

  // Generate next 7 days
  const availableDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().split('T')[0];
  });

  useEffect(() => {
    if (selectedDate && doctor?.id) fetchSlots();
  }, [selectedDate, doctor?.id]);

  const fetchSlots = async () => {
    setSlotsLoading(true);
    try {
      const res = await appointmentAPI.getSlots(doctor.id, selectedDate);
      setSlots(res.data.data.slots || []);
    } catch {
      toast.error('Failed to load available slots');
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const confirmBooking = async () => {
    if (!selectedSlot || !reason.trim()) return toast.error('Please select a slot and describe your reason');
    setLoading(true);
    try {
      const res = await appointmentAPI.book({
        doctor_id: doctor.id,
        scheduled_at: selectedSlot.time,
        reason: reason.trim(),
        type: 'video',
      });
      const data = res.data.data;
      setBookedData(data);
      setStep('booked');
      toast.success('Appointment booked! 🎉');
      onBooked?.(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (t) => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,.5)' }} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ animation: 'slideUp .3s ease' }}>
        {/* Handle */}
        <div className="w-9 h-1 bg-gray-200 rounded mx-auto mt-3 mb-1" />

        {step === 'select' && (
          <div className="p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: '#e8f5ee' }}>👩‍⚕️</div>
              <div>
                <div className="font-bold" style={{ color: '#0d1e35' }}>{doctor?.name}</div>
                <div className="text-sm" style={{ color: '#5a7065' }}>{doctor?.specialization}</div>
              </div>
            </div>

            {/* Date picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5a7065' }}>Select Date</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {availableDates.map(date => (
                  <button
                    key={date}
                    onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                    className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: selectedDate === date ? '#1a5c3a' : '#f4f7f2',
                      color: selectedDate === date ? '#fff' : '#1a2e1f',
                      border: `2px solid ${selectedDate === date ? '#1a5c3a' : '#dde8e1'}`,
                    }}
                  >
                    {formatDate(date)}
                  </button>
                ))}
              </div>
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5a7065' }}>
                  Available Slots
                </label>
                {slotsLoading ? (
                  <div className="text-center py-6 text-sm" style={{ color: '#5a7065' }}>Loading slots…</div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-6 text-sm" style={{ color: '#5a7065' }}>No slots available for this date</div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map(slot => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                        className="py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: selectedSlot?.time === slot.time ? '#1a5c3a' : slot.available ? '#f0f9f4' : '#f4f7f2',
                          color: selectedSlot?.time === slot.time ? '#fff' : slot.available ? '#1a5c3a' : '#a0b0a5',
                          border: `1.5px solid ${selectedSlot?.time === slot.time ? '#1a5c3a' : '#dde8e1'}`,
                        }}
                      >
                        {slot.display}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5a7065' }}>Reason for Consultation</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Describe your symptoms or concern…"
                className="w-full rounded-xl p-3 text-sm outline-none resize-none"
                style={{ border: '1.5px solid #dde8e1', minHeight: 80 }}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl font-bold text-sm border-2" style={{ borderColor: '#dde8e1', color: '#5a7065' }}>Cancel</button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!selectedSlot || !reason.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                style={{ background: '#1a5c3a' }}
              >
                Review Booking →
              </button>
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="p-5 space-y-4">
            <h3 className="font-bold text-base" style={{ fontFamily: "'Playfair Display',serif", color: '#0d1e35' }}>Confirm Appointment</h3>

            <div className="rounded-xl p-4 space-y-2.5" style={{ background: '#f0f9f4', border: '1px solid #b0d8c0' }}>
              {[
                ['👩‍⚕️', 'Doctor', doctor?.name],
                ['🏥', 'Specialty', doctor?.specialization],
                ['📅', 'Date', formatDate(selectedDate)],
                ['⏰', 'Time', formatTime(selectedSlot?.time)],
                ['⏱️', 'Duration', `${selectedSlot?.duration_minutes || 30} minutes`],
                ['📹', 'Type', 'Video Consultation (Free)'],
              ].map(([icon, label, value]) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-base w-6">{icon}</span>
                  <span className="text-xs font-semibold w-20" style={{ color: '#5a7065' }}>{label}</span>
                  <span className="text-sm font-bold" style={{ color: '#1a2e1f' }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-3" style={{ background: '#fef3dc', border: '1px solid #f6c46a' }}>
              <div className="text-xs font-bold mb-1" style={{ color: '#92600a' }}>Your Concern</div>
              <div className="text-sm" style={{ color: '#a07028' }}>{reason}</div>
            </div>

            {/* Video info */}
            <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: '#ebf4ff', border: '1px solid #bee3f8' }}>
              <span className="text-base">📹</span>
              <div className="text-xs leading-relaxed" style={{ color: '#2b6cb0' }}>
                <strong>Video link will be sent to your mobile</strong> after booking. You can also access it from your Appointments tab. No special app needed — works in your browser.
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('select')} className="flex-1 py-3 rounded-xl font-bold text-sm border-2" style={{ borderColor: '#dde8e1', color: '#5a7065' }}>← Edit</button>
              <button onClick={confirmBooking} disabled={loading} className="flex-1 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-60" style={{ background: '#1a5c3a' }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Booking…
                  </span>
                ) : '✅ Confirm Booking — Free'}
              </button>
            </div>
          </div>
        )}

        {step === 'booked' && bookedData && (
          <div className="p-5 text-center space-y-4">
            <div className="text-5xl">🎉</div>
            <h3 className="font-bold text-lg" style={{ fontFamily: "'Playfair Display',serif", color: '#0d1e35' }}>Appointment Confirmed!</h3>
            <p className="text-sm" style={{ color: '#5a7065' }}>Your appointment with {doctor?.name} is booked. A confirmation SMS has been sent.</p>

            <div className="rounded-xl p-4 text-left space-y-2" style={{ background: '#f0f9f4', border: '1px solid #b0d8c0' }}>
              <div className="text-xs font-bold" style={{ color: '#5a7065' }}>Appointment ID</div>
              <div className="text-sm font-mono" style={{ color: '#1a5c3a' }}>{bookedData.appointment_id}</div>
              <div className="text-xs font-bold mt-2" style={{ color: '#5a7065' }}>Video Link</div>
              <a href={bookedData.video_room?.patient_url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-bold underline break-all" style={{ color: '#1e78d4' }}>
                Join Video Consultation →
              </a>
              <div className="text-xs mt-1" style={{ color: '#5a7065' }}>
                Link expires: {bookedData.video_room?.expires_at ? new Date(bookedData.video_room.expires_at).toLocaleString('en-IN') : '—'}
              </div>
            </div>

            <button onClick={onClose} className="w-full py-3 rounded-xl font-bold text-sm text-white" style={{ background: '#1a5c3a' }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
