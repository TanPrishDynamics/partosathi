import React, {
  useState, useEffect, createContext, lazy, Suspense,
} from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import api, { cancelAllRequests } from './services/api';
import { ThemeProvider } from './context/ThemeContext';
import { AnimationProvider } from './context/AnimationContext';
import LoadingScreen from './components/LoadingScreen';
import useLenis from './hooks/useLenis';
// L-6: HIPAA §164.312(a)(2)(iii) — client-side idle auto-logout.
import { useIdleLogout } from './hooks/useIdleLogout';

// ── Always-present chrome (tiny, above-the-fold) ─────────────────────────────
import ThemeBackground from './components/ThemeBackground';
import ThemeSwitcher   from './components/ThemeSwitcher';
import CustomCursor    from './components/CustomCursor';
import ScrollProgress  from './components/ScrollProgress';

// ── Route-level lazy splits — each page is its own JS chunk ──────────────────
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const SignupPage         = lazy(() => import('./pages/SignupPage'));
const PendingApproval    = lazy(() => import('./pages/PendingApproval'));
const PatientList        = lazy(() => import('./pages/PatientList'));
const NewPatient         = lazy(() => import('./pages/NewPatient'));
const MainDashboard      = lazy(() => import('./pages/MainDashboard'));
const Reports            = lazy(() => import('./pages/Reports'));
const HelpCenter         = lazy(() => import('./pages/HelpCenter'));
const HospitalDashboard  = lazy(() => import('./pages/HospitalDashboard'));
const DoctorProductivity = lazy(() => import('./pages/DoctorProductivity'));
// Three.js-heavy immersive view — downloaded only when /dashboard/:id is visited
const NeuroLayout        = lazy(() => import('./features/immersive/NeuroLayout'));

export const AuthContext = createContext({ onLogout: () => {} });

const RouteSpinner = () => (
  <div style={{
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--color-bg-soft, #EEF2FF)',
  }}>
    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    <div style={{
      width: '48px', height: '48px', borderRadius: '14px',
      background: 'var(--gradient-primary, linear-gradient(135deg,#818CF8,#6366F1))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'spin 1.4s linear infinite',
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
        <path d="M22 12A10 10 0 1 1 12 2"/>
      </svg>
    </div>
  </div>
);

const ImmersivePage = () => { const { id } = useParams(); return <NeuroLayout patientId={id} />; };

const App = () => {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [appReady, setAppReady] = useState(false);

  useLenis();

  useEffect(() => {
    // _skipRefresh: bypass the 401 refresh interceptor so a missing cookie
    // resolves in 1 round-trip instead of 3.
    api.get('/api/auth/me', { _skipRefresh: true })
      .then(r => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    // Phase-5: abort any in-flight request BEFORE the server invalidates
    // the JWT, so a slow response from the old session cannot land in the
    // new session's UI after a fast logout/login switch in the same tab.
    cancelAllRequests();
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    setUser(null);
  };

  // L-6: Idle-logout. Active only when authenticated — prevents firing on
  // the public login/signup pages. 30-minute window mirrors backend.
  useIdleLogout({
    enabled: !!user,
    timeoutMs: 30 * 60 * 1000,
    onLogout: () => setUser(null),
  });

  if (!appReady) return (
    <ThemeProvider>
      <ThemeBackground />
      <LoadingScreen onComplete={() => setAppReady(true)} />
    </ThemeProvider>
  );

  if (loading) return <RouteSpinner />;

  const isHospital = user?.role === 'hospital';
  const isDoctor   = user?.role === 'doctor' || (user && !isHospital);

  return (
    <ThemeProvider>
      <AnimationProvider>
        <AuthContext.Provider value={{ onLogout: handleLogout }}>
          <ThemeBackground />
          <CustomCursor />
          <ScrollProgress />
          <ThemeSwitcher />
          <Router>
            <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
              <Suspense fallback={<RouteSpinner />}>
                <Routes>

                  {/* Public */}
                  <Route path="/login"   element={!user ? <LoginPage onLogin={setUser} /> : <Navigate to={isHospital ? '/hospital/dashboard' : '/patients'} />} />
                  <Route path="/signup"  element={!user ? <SignupPage /> : <Navigate to={isHospital ? '/hospital/dashboard' : '/patients'} />} />
                  <Route path="/pending" element={<PendingApproval />} />

                  {/* Hospital routes */}
                  <Route path="/hospital/dashboard" element={isHospital ? <HospitalDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />

                  {/* Doctor routes */}
                  <Route path="/dashboard"     element={isDoctor ? <MainDashboard />  : <Navigate to="/login" />} />
                  <Route path="/dashboard/:id" element={isDoctor ? <ImmersivePage />  : <Navigate to="/login" />} />
                  <Route path="/patients"      element={isDoctor ? <PatientList />    : <Navigate to="/login" />} />
                  <Route path="/new-patient"   element={isDoctor ? <NewPatient />     : <Navigate to="/login" />} />
                  <Route path="/reports"       element={isDoctor ? <Reports />        : <Navigate to="/login" />} />
                  <Route path="/help"          element={isDoctor ? <HelpCenter />     : <Navigate to="/login" />} />
                  <Route path="/productivity"  element={isDoctor ? <DoctorProductivity user={user} /> : <Navigate to="/login" />} />

                  {/* Root redirect */}
                  <Route path="/" element={
                    !user ? <Navigate to="/login" /> :
                    isHospital ? <Navigate to="/hospital/dashboard" /> :
                    <Navigate to="/patients" />
                  } />

                </Routes>
              </Suspense>
            </div>
          </Router>
        </AuthContext.Provider>
      </AnimationProvider>
    </ThemeProvider>
  );
};

export default App;
