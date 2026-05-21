import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
// Importing this module patches the global axios instance with:
//   - withCredentials: true (HttpOnly JWT cookies)
//   - X-CSRF-TOKEN header echo on every write (H-4 CSRF double-submit)
//   - 401 → /login redirect interceptor
// This MUST be imported once at app boot, before any axios call is issued.
import './services/axios-csrf';
import { useIdleLogout } from './hooks/useIdleLogout';

// Lazy-split the two pages — AdminDashboard is 44KB, only load when authenticated
const AdminLogin     = lazy(() => import('./pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const Spinner = () => (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0f172a',
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      border: '3px solid #334155', borderTopColor: '#6366f1',
      animation: 'spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

const App = () => {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  // L-6: enforce client-side idle logout on the admin SPA.
  // Default 30-minute idle window mirrors backend IDLE_TIMEOUT_MINUTES.
  // Disabled while the user is unauthenticated.
  useIdleLogout({
    enabled: !!user,
    timeoutMs: 30 * 60 * 1000,
    onLogout: () => setUser(null),
  });

  useEffect(() => {
    axios.get('/api/auth/me')
      .then(resp => { if (resp.data.role === 'admin') setUser(resp.data); else setUser(null); })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <Router>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login"     element={!user ? <AdminLogin onLogin={setUser} /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={user ? <AdminDashboard user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" />} />
          <Route path="/"          element={<Navigate to={user ? '/dashboard' : '/login'} />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
