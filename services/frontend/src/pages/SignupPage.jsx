import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Activity, Mail, Lock, User, Stethoscope, Building2,
  ChevronRight, Loader2, Shield, Phone, MapPin, FileText,
  CheckCircle2,
} from 'lucide-react';

const ROLES = [
  { id: 'doctor',   label: 'Doctor',   icon: Stethoscope, desc: 'Individual practitioner account' },
  { id: 'hospital', label: 'Hospital', icon: Building2,   desc: 'Organisation / multi-provider account' },
];

const Field = ({ label, icon: Icon, children }) => (
  <div>
    <label style={{
      display: 'block', fontSize: '10.5px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B7280', marginBottom: '6px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      {Icon && <Icon style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#9CA3AF', pointerEvents: 'none' }} />}
      {children}
    </div>
  </div>
);

const inputStyle = (hasIcon = true) => ({
  width: '100%', boxSizing: 'border-box',
  paddingLeft: hasIcon ? '40px' : '13px', paddingRight: '13px',
  paddingTop: '10px', paddingBottom: '10px',
  border: '1px solid #D1D5DB',
  borderRadius: '6px', fontSize: '13.5px', color: '#111827',
  background: '#F9FAFB', outline: 'none',
  fontFamily: 'Inter, system-ui, sans-serif',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
});

const onFocusIn  = e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; e.target.style.background = '#fff'; };
const onFocusOut = e => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F9FAFB'; };

const SignupPage = () => {
  const navigate = useNavigate();
  const [role, setRole]       = useState('doctor');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [step, setStep]       = useState('form'); // 'form' | 'success'
  const [signupId, setSignupId] = useState(null);

  // Doctor fields
  const [doctorForm, setDoctorForm] = useState({
    name: '', email: '', password: '', license_number: '',
    hospital: '', specialization: '', access_type: 'self_signup',
  });

  // Hospital fields
  const [hospitalForm, setHospitalForm] = useState({
    name: '', email: '', password: '', contact_person: '',
    phone: '', address: '', license_number: '',
  });

  const setDoctor   = (k, v) => setDoctorForm(f => ({ ...f, [k]: v }));
  const setHospital = (k, v) => setHospitalForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const endpoint = role === 'doctor'
        ? '/api/auth/signup/doctor'
        : '/api/auth/signup/hospital';
      const payload = role === 'doctor' ? doctorForm : hospitalForm;
      const resp = await api.post(endpoint, payload);
      setSignupId(resp.data.doctor_id || resp.data.hospital_id);
      setStep('success');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Success screen ─────────────────────────────────────────────────────── */
  if (step === 'success') {
    return (
      <div style={{
        minHeight: '100vh', background: '#F5F7FA',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{
          background: '#FFFFFF', borderRadius: '12px', padding: '48px 40px',
          maxWidth: '420px', width: '100%', textAlign: 'center',
          border: '1px solid #E5E7EB',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '12px',
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <CheckCircle2 style={{ width: '28px', height: '28px', color: '#16A34A' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
            Request Submitted
          </h2>
          <p style={{ color: '#6B7280', fontSize: '13.5px', lineHeight: 1.65, margin: '0 0 20px' }}>
            Your {role === 'doctor' ? 'doctor' : 'hospital'} account request has been received
            and is <strong style={{ color: '#111827' }}>pending admin approval</strong>. You will
            receive an email once your account is activated — typically within 1–2 business days.
          </p>
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: '8px', padding: '14px 16px', marginBottom: '24px',
            fontSize: '13px', color: '#374151', textAlign: 'left',
          }}>
            <div style={{ fontWeight: 600, color: '#111827', marginBottom: '8px' }}>What happens next?</div>
            {['Admin reviews your request', 'You receive an approval email', 'Log in and start using PartoSathi'].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#DBEAFE', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB' }}>{i + 1}</span>
                </div>
                <span style={{ fontSize: '12.5px', color: '#6B7280' }}>{step}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/login')}
            style={{
              width: '100%', padding: '11px', borderRadius: '6px', border: 'none',
              background: '#2563EB', color: '#fff', fontSize: '14px', fontWeight: 700,
              fontFamily: 'Inter, system-ui, sans-serif', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37,99,235,0.20)',
            }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  /* ── Signup form ─────────────────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100vh', background: '#F5F7FA',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '10px', margin: '0 auto 14px',
            background: '#FFF', border: '1px solid #E5E7EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
          }}>
            <img src="/logo.jpg" alt="PartoSathi Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            Create Account
          </h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px' }}>PartoSathi · WHO 2020 Clinical Platform</p>
        </div>

        <div style={{
          background: '#FFFFFF', border: '1px solid #E5E7EB',
          borderRadius: '10px', padding: '28px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>

          {/* Role tabs */}
          <div style={{
            display: 'flex', gap: '4px', padding: '3px',
            background: '#F3F4F6', border: '1px solid #E5E7EB',
            borderRadius: '8px', marginBottom: '24px',
          }}>
            {ROLES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setRole(id); setError(''); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '7px', padding: '8px 12px', borderRadius: '6px', border: 'none',
                  cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  transition: 'all 0.15s ease',
                  background: role === id ? '#FFFFFF' : 'transparent',
                  color: role === id ? '#2563EB' : '#6B7280',
                  boxShadow: role === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  fontFamily: 'Inter, system-ui, sans-serif',
                }}
              >
                <Icon style={{ width: '14px', height: '14px' }} />
                {label}
              </button>
            ))}
          </div>

          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 18px' }}>
            {role === 'doctor' ? 'Doctor Registration' : 'Hospital Onboarding'}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {role === 'doctor' ? (
              <>
                <Field label="Full Name" icon={User}>
                  <input style={inputStyle()} type="text" value={doctorForm.name}
                    onChange={e => setDoctor('name', e.target.value)}
                    onFocus={onFocusIn} onBlur={onFocusOut}
                    placeholder="Dr. Jane Smith" required />
                </Field>
                <Field label="Email Address" icon={Mail}>
                  <input style={inputStyle()} type="email" value={doctorForm.email}
                    onChange={e => setDoctor('email', e.target.value)}
                    onFocus={onFocusIn} onBlur={onFocusOut}
                    placeholder="doctor@hospital.com" required />
                </Field>
                <Field label="Password" icon={Lock}>
                  <input style={inputStyle()} type="password" value={doctorForm.password}
                    onChange={e => setDoctor('password', e.target.value)}
                    onFocus={onFocusIn} onBlur={onFocusOut}
                    placeholder="Min 8 chars, 1 uppercase, 1 number" required />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="License Number" icon={FileText}>
                    <input style={inputStyle()} type="text" value={doctorForm.license_number}
                      onChange={e => setDoctor('license_number', e.target.value)}
                      onFocus={onFocusIn} onBlur={onFocusOut}
                      placeholder="MH-2026-001" />
                  </Field>
                  <Field label="Specialization" icon={Stethoscope}>
                    <input style={inputStyle()} type="text" value={doctorForm.specialization}
                      onChange={e => setDoctor('specialization', e.target.value)}
                      onFocus={onFocusIn} onBlur={onFocusOut}
                      placeholder="Obstetrics" />
                  </Field>
                </div>
                <Field label="Hospital / Institution" icon={Building2}>
                  <input style={inputStyle()} type="text" value={doctorForm.hospital}
                    onChange={e => setDoctor('hospital', e.target.value)}
                    onFocus={onFocusIn} onBlur={onFocusOut}
                    placeholder="General Hospital" />
                </Field>

                {/* Access type selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6B7280', marginBottom: '8px' }}>
                    Access Method
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      { id: 'self_signup', label: 'Request Access', desc: 'Admin reviews & approves' },
                      { id: 'paid',        label: 'Pay & Activate', desc: 'Coming soon — Razorpay' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDoctor('access_type', opt.id)}
                        disabled={opt.id === 'paid'}
                        style={{
                          padding: '10px 12px', borderRadius: '6px',
                          border: `1px solid ${doctorForm.access_type === opt.id ? '#BFDBFE' : '#E5E7EB'}`,
                          background: doctorForm.access_type === opt.id ? '#EFF6FF' : '#F9FAFB',
                          cursor: opt.id === 'paid' ? 'not-allowed' : 'pointer', textAlign: 'left',
                          opacity: opt.id === 'paid' ? 0.5 : 1, transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: doctorForm.access_type === opt.id ? '#2563EB' : '#374151' }}>
                          {opt.label}
                        </div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <Field label="Hospital Name" icon={Building2}>
                  <input style={inputStyle()} type="text" value={hospitalForm.name}
                    onChange={e => setHospital('name', e.target.value)}
                    onFocus={onFocusIn} onBlur={onFocusOut}
                    placeholder="City General Hospital" required />
                </Field>
                <Field label="Official Email" icon={Mail}>
                  <input style={inputStyle()} type="email" value={hospitalForm.email}
                    onChange={e => setHospital('email', e.target.value)}
                    onFocus={onFocusIn} onBlur={onFocusOut}
                    placeholder="admin@citygeneralhospital.com" required />
                </Field>
                <Field label="Password" icon={Lock}>
                  <input style={inputStyle()} type="password" value={hospitalForm.password}
                    onChange={e => setHospital('password', e.target.value)}
                    onFocus={onFocusIn} onBlur={onFocusOut}
                    placeholder="Min 8 chars, 1 uppercase, 1 number" required />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="Contact Person" icon={User}>
                    <input style={inputStyle()} type="text" value={hospitalForm.contact_person}
                      onChange={e => setHospital('contact_person', e.target.value)}
                      onFocus={onFocusIn} onBlur={onFocusOut}
                      placeholder="Dr. Head Admin" required />
                  </Field>
                  <Field label="License / Reg. No." icon={FileText}>
                    <input style={inputStyle()} type="text" value={hospitalForm.license_number}
                      onChange={e => setHospital('license_number', e.target.value)}
                      onFocus={onFocusIn} onBlur={onFocusOut}
                      placeholder="REG-2026-001" />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="Phone" icon={Phone}>
                    <input style={inputStyle()} type="tel" value={hospitalForm.phone}
                      onChange={e => setHospital('phone', e.target.value)}
                      onFocus={onFocusIn} onBlur={onFocusOut}
                      placeholder="+91 98765 43210" />
                  </Field>
                  <Field label="City" icon={MapPin}>
                    <input style={inputStyle()} type="text" value={hospitalForm.address}
                      onChange={e => setHospital('address', e.target.value)}
                      onFocus={onFocusIn} onBlur={onFocusOut}
                      placeholder="Mumbai, Maharashtra" />
                  </Field>
                </div>
              </>
            )}

            {error && (
              <div style={{
                padding: '10px 14px', background: '#FEF2F2',
                border: '1px solid #FECACA', borderRadius: '6px',
                fontSize: '13px', color: '#DC2626', display: 'flex', gap: '7px', alignItems: 'flex-start',
              }}>
                <span style={{ flexShrink: 0, fontWeight: 700 }}>⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '4px', width: '100%', padding: '12px', borderRadius: '6px',
                border: 'none', background: '#2563EB',
                color: '#fff', fontSize: '14px', fontWeight: 700,
                fontFamily: 'Inter, system-ui, sans-serif',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.75 : 1,
                boxShadow: '0 2px 8px rgba(37,99,235,0.20)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'opacity 0.15s ease',
              }}
            >
              {loading
                ? <Loader2 style={{ width: '17px', height: '17px', animation: 'spin 1s linear infinite' }} />
                : <><span>Submit Request</span><ChevronRight style={{ width: '16px', height: '16px' }} /></>
              }
            </button>
          </form>

          {/* Login link */}
          <div style={{
            marginTop: '20px', paddingTop: '16px',
            borderTop: '1px solid #F3F4F6',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#9CA3AF' }}>
              <Shield style={{ width: '11px', height: '11px' }} />
              Admin-governed access
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              style={{
                fontSize: '13px', color: '#2563EB', fontWeight: 600, background: 'none',
                border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Already have an account?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
