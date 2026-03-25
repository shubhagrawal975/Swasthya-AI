import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: 'linear-gradient(135deg,#0d1e35,#1a5c3a)' }}>
      <div className="text-6xl mb-4">🌿</div>
      <h1 className="text-5xl font-black text-white mb-3" style={{ fontFamily: "'Playfair Display',serif" }}>404</h1>
      <p className="text-white/60 text-base mb-8">This page doesn't exist. Let's get you back on track.</p>
      <div className="flex gap-3 flex-wrap justify-center">
        <button onClick={() => navigate('/')}
          className="px-6 py-3 rounded-full font-bold text-gray-900 text-sm"
          style={{ background: '#f5a623' }}>
          Go to Homepage
        </button>
        <button onClick={() => navigate(-1)}
          className="px-6 py-3 rounded-full font-bold text-white text-sm border border-white/30 hover:bg-white/10 transition-all">
          Go Back
        </button>
      </div>
    </div>
  );
}
