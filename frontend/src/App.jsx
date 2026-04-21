import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import api from './services/api';

export const AuthContext = createContext({ onLogout: () => {} });

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import PatientList from './pages/PatientList';
import NewPatient from './pages/NewPatient';
import MainDashboard from './pages/MainDashboard';
import Reports from './pages/Reports';

// ─── Global Visual Effects ──────────────────────────────────────────────────
const GlobalEffects = () => {
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <>
      {/* Background ambient orbs */}
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
      <div className="ambient-orb ambient-orb-3" />
      
      {/* Interactive cursor glow */}
      <div 
        className="cursor-glow"
        style={{ 
          transform: `translate(${mousePos.x}px, ${mousePos.y}px)`,
          opacity: mousePos.x < 0 ? 0 : 1 
        }} 
      />
    </>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // H-2: No localStorage token — check session by calling /api/auth/me.
    // If the httpOnly cookie is valid, server returns user data.
    // If expired/missing, server returns 401 and we stay on login page.
    const restoreSession = async () => {
      try {
        const resp = await api.get('/api/auth/me');
        setUser(resp.data);
      } catch {
        // 401 = no valid session — show login page
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');  // clears httpOnly cookie server-side
    } catch { /* ignore */ }
    setUser(null);
  };

  if (loading) return null;

  return (
    <AuthContext.Provider value={{ onLogout: handleLogout }}>
      <GlobalEffects />
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={!user ? <LoginPage onLogin={setUser} /> : <Navigate to="/patients" />} 
          />
          
          <Route 
            path="/dashboard" 
            element={user ? <MainDashboard /> : <Navigate to="/login" />} 
          />
          
          <Route 
            path="/dashboard/:id" 
            element={user ? <Dashboard /> : <Navigate to="/login" />} 
          />
          
          <Route 
            path="/patients" 
            element={user ? <PatientList /> : <Navigate to="/login" />} 
          />
          
          <Route 
            path="/new-patient" 
            element={user ? <NewPatient /> : <Navigate to="/login" />} 
          />

          <Route 
            path="/reports" 
            element={user ? <Reports /> : <Navigate to="/login" />} 
          />

          <Route path="/" element={<Navigate to={user ? "/patients" : "/login"} />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
};

export default App;
