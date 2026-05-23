import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope, Building2, Mail, Lock, ArrowRight,
  Shield, Zap, Activity, Heart,
} from 'lucide-react';
import api from '../services/api';

/* ─── Tab config ──────────────────────────────────────────────────────────── */
const TABS = [
  {
    id: 'doctor',
    label: 'Doctor',
    icon: Stethoscope,
    endpoint: '/api/auth/login',
    userKey: 'doctor',
  },
  {
    id: 'hospital',
    label: 'Hospital',
    icon: Building2,
    endpoint: '/api/auth/hospital-login',
    userKey: 'hospital',
  },
];

/* ─── Simple ECG SVG ──────────────────────────────────────────────────────── */
function ECGLine({ color = '#2563EB', width = 280 }) {
  return (
    <svg width={width} height="32" viewBox={`0 0 ${width} 32`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="ecg-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={color} stopOpacity="0.15" />
          <stop offset="40%"  stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <path
        d={`M0 16 L${width*.1} 16 L${width*.18} 16 L${width*.24} 4 L${width*.3} 28 L${width*.36} 5 L${width*.42} 24 L${width*.5} 16 L${width*.65} 16 L${width*.71} 4 L${width*.77} 28 L${width*.83} 5 L${width*.89} 24 L${width} 16`}
        fill="none"
        stroke="url(#ecg-grad)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeDasharray: 800, strokeDashoffset: 800, animation: 'ecg-draw 2.4s ease-out infinite' }}
      />
      <style>{`@keyframes ecg-draw { from { stroke-dashoffset: 800 } to { stroke-dashoffset: 0 } }`}</style>
    </svg>
  );
}

/* ─── Pulse dot ───────────────────────────────────────────────────────────── */
function PulseDot({ color = '#2563EB' }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, flexShrink: 0 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, opacity: 0.4,
        animation: 'ping 1.8s ease-in-out infinite',
      }} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <style>{`@keyframes ping { 0%,100%{transform:scale(1);opacity:0.4} 50%{transform:scale(2);opacity:0} }`}</style>
    </span>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [tab, setTab]           = useState('doctor');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const active = TABS.find(t => t.id === tab);
  useEffect(() => { setEmail(''); setPassword(''); setError(''); }, [tab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const resp = await api.post(active.endpoint, { email, password });
      const user = resp.data[active.userKey] || resp.data.user;
      onLogin({ ...user, role: resp.data.role || tab });
      navigate(tab === 'hospital' ? '/hospital/dashboard' : '/patients');
    } catch (err) {
      const data = err.response?.data;
      if (data?.status === 'pending' || data?.status === 'rejected') {
        navigate('/pending', { state: { status: data.status } }); return;
      }
      setError(data?.error || 'Login failed. Please check your credentials.');
    } finally { setLoading(false); }
  };

  /* ── colour tokens ── */
  const blue    = '#2563EB';
  const blueLt  = '#EFF6FF';
  const blueMid = '#BFDBFE';
  const slate   = '#111827';
  const muted   = '#6B7280';
  const border  = '#E5E7EB';

  /* ── shared input style ── */
  const inputBase = {
    width: '100%', boxSizing: 'border-box',
    paddingLeft: '40px', paddingRight: '14px',
    paddingTop: '11px', paddingBottom: '11px',
    borderRadius: '10px', fontSize: '14px', color: slate,
    outline: 'none', background: '#F8FAFC',
    border: `1px solid ${border}`,
    fontFamily: 'Inter, sans-serif',
    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', overflow: 'hidden',
      background: '#F1F5F9', fontFamily: 'Inter, sans-serif',
    }}>

      {/* ═════════════════════════════════════════════
          LEFT — Branding panel (hidden on mobile)
      ═════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', padding: '64px 60px',
          background: 'linear-gradient(160deg, #1E3A8A 0%, #1D4ED8 45%, #2563EB 100%)',
          position: 'relative', overflow: 'hidden',
        }}
        className="hidden lg:flex"
      >
        {/* Subtle background pattern */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06) 0%, transparent 50%),
                            radial-gradient(circle at 80% 80%, rgba(255,255,255,0.04) 0%, transparent 50%)`,
        }} />

        {/* Decorative grid lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Logo */}
          <motion.div
            style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: '#FFF',
              border: '1px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}>
              <img src="/logo.jpg" alt="PartoSathi Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <h1 style={{
                margin: 0, fontSize: 22, fontWeight: 700, color: '#fff',
                letterSpacing: '0.02em', lineHeight: 1,
              }}>
                PartoSathi
              </h1>
              <p style={{
                margin: '4px 0 0', fontSize: 10, fontWeight: 600,
                color: 'rgba(255,255,255,0.6)', letterSpacing: '0.18em', textTransform: 'uppercase',
              }}>
                Pro · ColpAI Engine
              </p>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.65 }}
          >
            <h2 style={{
              fontSize: 40, fontWeight: 700, color: '#fff',
              lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.02em',
            }}>
              Intelligent<br />Labor<br />Monitoring
            </h2>
            <p style={{
              fontSize: 14, lineHeight: 1.75, maxWidth: 320,
              marginBottom: 40, color: 'rgba(255,255,255,0.7)',
            }}>
              WHO 2020 partograph protocol with real-time ColpAI clinical decision support for obstetric care.
            </p>
          </motion.div>

          {/* ECG line */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            style={{ marginBottom: 40 }}
          >
            <ECGLine color="rgba(255,255,255,0.80)" width={260} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
            }}>
              <PulseDot color="rgba(255,255,255,0.9)" />
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
                Live Clinical Pulse
              </span>
            </div>
          </motion.div>

          {/* Feature pills */}
          <motion.div
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62 }}
          >
            {[
              { icon: Shield,   label: 'HIPAA · GDPR · DPDP Compliant' },
              { icon: Zap,      label: 'AI-Powered Clinical Alerts' },
              { icon: Activity, label: 'Multi-tenant Hospital Architecture' },
            ].map(({ icon: Icon, label }, i) => (
              <motion.div
                key={label}
                style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon style={{ width: 13, height: 13, color: '#fff' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.78)' }}>
                  {label}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}
            style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.24em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
              Tanprish Dynamics
            </span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
          </motion.div>
        </div>
      </motion.div>

      {/* ═════════════════════════════════════════════
          RIGHT — Login form panel
      ═════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          padding: '48px 28px',
          background: '#fff',
          borderLeft: `1px solid ${border}`,
          position: 'relative', zIndex: 2,
          flexShrink: 0,
        }}
        className="w-full lg:w-[480px]"
      >
        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Mobile brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }} className="flex lg:hidden">
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: '#FFF', border: '1px solid #E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}>
              <img src="/logo.jpg" alt="PartoSathi Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700, color: slate }}>PartoSathi</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: blue }}> Pro</span>
            </div>
          </div>

          {/* Heading */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: slate, marginBottom: 4, letterSpacing: '-0.01em' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 13, color: muted, marginBottom: 28 }}>
              Sign in to your clinical dashboard
            </p>
          </motion.div>

          {/* Tab switcher */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}
            style={{
              display: 'flex', borderRadius: 12, padding: 4,
              marginBottom: 24,
              background: blueLt,
              border: `1px solid ${blueMid}`,
            }}
          >
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '10px 0', borderRadius: 9,
                  fontSize: 13, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  border: 'none', cursor: 'pointer',
                  background: tab === t.id ? blue : 'transparent',
                  color: tab === t.id ? '#fff' : muted,
                  boxShadow: tab === t.id ? '0 2px 10px rgba(232,130,26,0.25)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <t.icon style={{ width: 14, height: 14 }} />
                <span>{t.label}</span>
              </button>
            ))}
          </motion.div>

          {/* Form card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              style={{
                borderRadius: 16, padding: 24, position: 'relative',
                background: '#fff',
                border: `1px solid ${border}`,
                boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
              }}
            >
              {/* Error banner */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key="err"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    style={{
                      padding: '10px 13px', borderRadius: 9, fontSize: 13,
                      fontWeight: 500, overflow: 'hidden',
                      background: 'rgba(220,38,38,0.06)',
                      border: '1px solid rgba(220,38,38,0.2)',
                      color: '#DC2626',
                    }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Email */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 600,
                    marginBottom: 7, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: muted,
                  }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8', pointerEvents: 'none' }} />
                    <input
                      type="email" required value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={tab === 'hospital' ? 'admin@hospital.org' : 'doctor@clinic.com'}
                      style={inputBase}
                      onFocus={e => { e.target.style.borderColor = blue; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
                      onBlur={e  => { e.target.style.borderColor = border; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 600,
                    marginBottom: 7, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: muted,
                  }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8', pointerEvents: 'none' }} />
                    <input
                      type="password" required value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      style={inputBase}
                      onFocus={e => { e.target.style.borderColor = blue; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.12)'; }}
                      onBlur={e  => { e.target.style.borderColor = border; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Submit */}
                <motion.button
                  type="submit" disabled={loading}
                  whileHover={!loading ? { scale: 1.01 } : {}}
                  whileTap={!loading ? { scale: 0.98 } : {}}
                  style={{
                    marginTop: 4, width: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '12px 0', borderRadius: 10,
                    fontWeight: 700, fontSize: 14,
                    color: '#fff',
                    border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    background: loading ? '#94A3B8' : blue,
                    boxShadow: loading ? 'none' : '0 2px 8px rgba(37,99,235,0.25)',
                    transition: 'background 0.2s ease, box-shadow 0.2s ease',
                  }}
                >
                  {loading ? (
                    <motion.div
                      style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }}
                      animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                    />
                  ) : (
                    <>
                      <span>{tab === 'hospital' ? 'Access Hospital Portal' : 'Enter Doctor Dashboard'}</span>
                      <ArrowRight style={{ width: 15, height: 15 }} />
                    </>
                  )}
                </motion.button>
              </form>

              {/* System status footer */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PulseDot color={blue} />
                  <span style={{
                    fontSize: 11, fontWeight: 500, color: '#64748B',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>
                    System Online — {tab === 'doctor' ? 'Clinical' : 'Hospital'} Mode
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Footer links */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            style={{ marginTop: 20, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <p style={{ fontSize: 13, color: muted }}>
              {tab === 'hospital' ? 'New hospital?' : 'New here?'}{' '}
              <Link
                to={tab === 'hospital' ? '/signup?role=hospital' : '/signup'}
                style={{ fontWeight: 600, color: blue, textDecoration: 'none' }}
              >
                {tab === 'hospital' ? 'Register hospital →' : 'Create account →'}
              </Link>
            </p>
            <p style={{ fontSize: 11, color: '#94A3B8' }}>
              Super Admin?{' '}
              {/* M-20: admin portal URL is env-driven — avoids hardcoding
                  http://localhost:5175 into production builds. */}
              <a
                href={import.meta.env.VITE_ADMIN_PORTAL_URL || '/admin'}
                style={{ fontWeight: 600, color: muted, textDecoration: 'none' }}
              >
                Open admin portal →
              </a>
            </p>
          </motion.div>

        </div>
      </motion.div>
    </div>
  );
}
