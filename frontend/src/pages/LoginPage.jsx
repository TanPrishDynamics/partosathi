import React, { useState } from 'react';
import api from '../services/api';
import { Activity, Lock, Mail, ChevronRight, Loader2, Stethoscope, Building2, Shield } from 'lucide-react';

const MODES = [
  { id: 'doctor', label: 'Doctor', icon: Stethoscope },
  { id: 'admin',  label: 'Admin',  icon: Building2 },
];

const LoginPage = ({ onLogin }) => {
  const [mode, setMode]         = useState('doctor');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleModeChange = m => {
    setMode(m); setEmail(''); setPassword(''); setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const endpoint = mode === 'admin' ? '/api/auth/admin-login' : '/api/auth/login';
      const resp = await api.post(endpoint, { email, password });
      // H-2: token is now in httpOnly cookie set by backend — NOT stored in localStorage
      // Only non-sensitive user info is in the JSON body
      const userData = mode === 'admin' ? resp.data.user : resp.data.doctor;
      onLogin({ ...userData, role: resp.data.role });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check credentials.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0B1220', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden' }}>

      {/* Background glows */}
      <div style={{ position: 'absolute', top: '20%', left: '30%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '25%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.05) 0%, transparent 65%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 10 }} className="animate-fade-in">

        {/* Brand header */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '68px', height: '68px', borderRadius: '20px', margin: '0 auto 18px',
            background: 'linear-gradient(135deg, #22D3EE 0%, #14B8A6 100%)',
            boxShadow: '0 20px 50px rgba(34,211,238,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Activity style={{ width: '34px', height: '34px', color: '#060D1A' }} />
          </div>
          <h1 style={{ fontFamily: 'Poppins, system-ui, sans-serif', fontSize: '34px', fontStyle: 'italic', fontWeight: 400, color: '#F9FAFB', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            e-Partogram
          </h1>
          <p style={{ color: '#6B7280', fontSize: '13px' }}>Electronic Labour Monitoring · WHO 2020</p>
          <div style={{ marginTop: '10px' }} className="ai-pulse" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '10px' }}>
            <span className="ai-pulse-dot" />
            ColpAI Engine Active
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(17,24,39,0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '30px',
          boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 40px 80px rgba(0,0,0,0.55)',
        }}>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', marginBottom: '26px' }}>
            {MODES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleModeChange(id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '10px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 700, transition: 'all 0.2s ease',
                  background: mode === id ? 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)' : 'transparent',
                  color: mode === id ? '#060D1A' : '#6B7280',
                  boxShadow: mode === id ? '0 4px 16px rgba(34,211,238,0.3)' : 'none',
                }}
              >
                <Icon style={{ width: '16px', height: '16px' }} />
                {label}
              </button>
            ))}
          </div>

          <h2 style={{ fontFamily: 'Roboto, system-ui, sans-serif', fontSize: '17px', fontWeight: 700, color: '#E5E7EB', marginBottom: '22px' }}>
            {mode === 'admin' ? 'Admin Portal Access' : 'Clinician Sign In'}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: '7px' }}>
                {mode === 'admin' ? 'Company Email' : 'Hospital Email'}
              </label>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#4B5563' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '42px' }}
                  placeholder="doctor@hospital.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6B7280', marginBottom: '7px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#4B5563' }} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '42px' }}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: '10px', fontSize: '12px', color: '#F87171', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px',
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '13px 22px',
                background: 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)',
                color: '#060D1A', fontWeight: 800, fontSize: '14px',
                borderRadius: '11px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 24px rgba(34,211,238,0.35), 0 1px 0 rgba(255,255,255,0.2) inset',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.7 : 1,
              }}
              onMouseOver={e => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {loading
                ? <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                : <>
                  {mode === 'admin' ? 'Access Admin Portal' : 'Enter Dashboard'}
                  <ChevronRight style={{ width: '18px', height: '18px' }} />
                </>
              }
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#4B5563' }}>
              <Shield style={{ width: '12px', height: '12px' }} />
              WHO-2020 Compliant
            </div>
            <p style={{ fontSize: '10px', color: '#374151' }}>TanPrish Dynamics © 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
