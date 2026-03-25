import React from 'react';

export default function LoadingSpinner({ fullScreen = false, size = 'md', light = false }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  const spinnerClass = `${sizes[size]} border-2 rounded-full animate-spin ${
    light
      ? 'border-white/30 border-t-white'
      : 'border-green-100 border-t-green-700'
  }`;

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="flex flex-col items-center gap-4">
          <div className={spinnerClass} style={{ width: 48, height: 48 }} />
          <p className="text-sm font-semibold text-green-700" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Loading SwasthyaAI…
          </p>
        </div>
      </div>
    );
  }

  return <div className={spinnerClass} />;
}
