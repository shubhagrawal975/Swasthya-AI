import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from './store/authStore';
import LoadingSpinner from './components/shared/LoadingSpinner';
import api from './services/api';

const HomePage        = lazy(() => import('./pages/HomePage'));
const LoginPage       = lazy(() => import('./pages/LoginPage'));
const UserDashboard   = lazy(() => import('./pages/UserDashboard'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const OpsPage         = lazy(() => import('./pages/ops/OpsPage'));
const TermsPage       = lazy(() => import('./pages/TermsPage'));
const HelpPage        = lazy(() => import('./pages/HelpPage'));
const NotFoundPage    = lazy(() => import('./pages/NotFoundPage'));

function RequireAuth({ children, role }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) return <Navigate to="/" replace />;
  return children;
}

function RequireAnyAuth({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function RequireGuest({ children }) {
  const { isAuthenticated, user } = useAuthStore();
  if (isAuthenticated) {
    if (user?.role === 'doctor') return <Navigate to="/doctor" replace />;
    if (user?.role === 'admin') return <Navigate to="/ops" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  const [backendError, setBackendError] = useState('');

  useEffect(() => {
    axios.get('/api/health').catch(() => {
      setBackendError('Unable to reach backend API. Ensure backend is running and API URL is configured.');
    });
  }, []);

  if (backendError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f7fafc', color: '#1a202c' }}>
        <div className="max-w-xl rounded-xl border bg-white p-5 shadow">
          <h1 className="text-xl font-bold">Backend connection failed</h1>
          <p className="mt-2 text-sm text-gray-600">{backendError}</p>
          <p className="mt-3 text-xs text-gray-500">Suggested fix: start backend at <code>cd backend && npm run dev</code> and set <code>VITE_API_URL</code> if needed.</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        {/* Public */}
        <Route path="/"      element={<HomePage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/help"  element={<HelpPage />} />

        {/* Auth */}
        <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />

        {/* Patient dashboard */}
        <Route path="/dashboard/*" element={<RequireAuth role="patient"><UserDashboard /></RequireAuth>} />

        {/* Doctor dashboard */}
        <Route path="/doctor/*" element={<RequireAuth role="doctor"><DoctorDashboard /></RequireAuth>} />

        {/* Healthcare Operations Suite — accessible to doctor and admin */}
        <Route path="/ops/*" element={<RequireAnyAuth><OpsPage /></RequireAnyAuth>} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
