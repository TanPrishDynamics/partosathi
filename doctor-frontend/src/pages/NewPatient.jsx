import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import {
  ArrowLeft, UserPlus, ChevronRight, Loader2,
  User, Calendar, Baby, Heart, Info,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import PatientQuotaMeter from '../components/PatientQuotaMeter';

/* ─── Field wrapper ──────────────────────────────────────────────────────── */
const Field = ({ label, icon: Icon, span = 1, children }) => (
  <div style={{ gridColumn: span === 2 ? '1 / -1' : undefined }}>
    <label style={{
      display: 'block', fontSize: '10px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.12em',
      color: '#64748B', marginBottom: '7px',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      {label}
    </label>
    <div style={{ position: 'relative' }}>
      {Icon && (
        <Icon style={{
          position: 'absolute', left: '14px', top: '50%',
          transform: 'translateY(-50%)', width: '16px', height: '16px',
          color: '#94A3B8', pointerEvents: 'none', zIndex: 1,
        }} />
      )}
      {children}
    </div>
  </div>
);

const inp = (hasIcon = false) => ({
  width: '100%',
  paddingLeft: hasIcon ? '42px' : '16px',
  paddingRight: '16px',
  paddingTop: '12px',
  paddingBottom: '12px',
  background: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: '10px',
  fontSize: '14px',
  fontFamily: 'Inter, sans-serif',
  color: '#1E293B',
  outline: 'none',
  transition: 'all 0.2s ease',
  boxSizing: 'border-box',
});

const onFocus = e => {
  e.target.style.borderColor = '#2563EB';
  e.target.style.boxShadow   = '0 0 0 3px rgba(37,99,235,0.10)';
  e.target.style.background  = '#fff';
};
const onBlur = e => {
  e.target.style.borderColor = '#D1D5DB';
  e.target.style.boxShadow   = 'none';
  e.target.style.background  = '#F9FAFB';
};

/* ─── Section header ─────────────────────────────────────────────────────── */
const SectionHeader = ({ icon: Icon, label, color }) => (
  <div style={{
    gridColumn: '1 / -1',
    display: 'flex', alignItems: 'center', gap: '9px',
    marginBottom: '4px', paddingBottom: '12px',
    borderBottom: `1px solid #E5E7EB`,
  }}>
    <Icon style={{ width: '14px', height: '14px', color, flexShrink: 0 }} />
    <span style={{
      fontSize: '10px', fontWeight: 700, color,
      textTransform: 'uppercase', letterSpacing: '0.10em',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {label}
    </span>
  </div>
);

/* ─── Page ───────────────────────────────────────────────────────────────── */
const NewPatient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gravida: 1,
    parity: 0,
    gestational_age: '',
    admission_time: new Date().toISOString().slice(0, 16),
    membrane_rupture_time: '',
  });

  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setSubmitError(null);
    try {
      const resp = await api.post('/api/patient', formData);
      const id = resp.data?.patient_id;
      if (id) {
        navigate(`/dashboard/${id}`);
      } else {
        navigate('/patients');
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.quota_reached) {
        setSubmitError({ type: 'quota', message: data.detail || 'Patient quota reached. Contact your administrator to increase your limit.' });
      } else {
        setSubmitError({ type: 'error', message: data?.error || 'Error registering patient. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <main style={{
        flex: 1, overflowY: 'auto',
        background: '#F8FAFC',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 32px 80px' }}>

          {/* Back button */}
          <motion.button
            whileHover={{ x: -2 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/patients')}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '8px 16px', borderRadius: '10px', marginBottom: '32px',
              border: '1px solid #E2E8F0',
              background: '#fff', color: '#64748B',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <ArrowLeft style={{ width: '14px', height: '14px' }} />
            Back to Patients
          </motion.button>

          {/* Page header */}
          <motion.div
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45 }}
            style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '32px' }}
          >
            <div style={{
              width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0,
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserPlus style={{ width: '24px', height: '24px', color: '#2563EB' }} />
            </div>
            <div>
              <h1 style={{
                fontFamily: 'Inter, sans-serif', fontSize: '22px', fontWeight: 700,
                color: '#1E293B', margin: 0, letterSpacing: '-0.01em',
              }}>
                New Admission
              </h1>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px', fontFamily: 'DM Sans, sans-serif' }}>
                Initialize digital partograph for a new patient
              </p>
            </div>
          </motion.div>

          {/* Quota meter */}
          <PatientQuotaMeter />

          {/* Error banner */}
          {submitError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '14px 18px', borderRadius: '12px', marginBottom: '20px',
                background: 'rgba(255,45,85,0.07)',
                border: '1px solid rgba(255,45,85,0.25)',
                color: '#ff2d55', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
              }}
            >
              <span style={{ flexShrink: 0, fontWeight: 700 }}>
                {submitError.type === 'quota' ? '⚠ Quota Reached' : '✕ Error'}
              </span>
              <span>{submitError.message}</span>
            </motion.div>
          )}

          {/* Form card */}
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45, delay: 0.08 }}
            style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: '20px', padding: '36px',
              boxShadow: '0 4px 24px rgba(15,23,42,0.07)',
            }}
          >
            {/* Top accent line */}
            <div style={{
              height: '3px',
              background: '#2563EB',
              marginBottom: '32px', marginLeft: '-36px', marginRight: '-36px',
              marginTop: '-36px', borderRadius: '20px 20px 0 0',
            }} />

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px' }}>

                {/* Section: Patient Identity */}
                <SectionHeader icon={User} label="Patient Identity" color="#2563EB" />

                <Field label="Full Name" icon={User} span={2}>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} required
                    placeholder="e.g. Jane Doe" style={inp(true)} onFocus={onFocus} onBlur={onBlur} />
                </Field>

                <Field label="Age (Years)">
                  <input type="number" name="age" value={formData.age} onChange={handleChange} required
                    placeholder="28" min={10} max={60} style={inp()} onFocus={onFocus} onBlur={onBlur} />
                </Field>

                <Field label="Gestational Age (Weeks)" icon={Baby}>
                  <input type="number" name="gestational_age" value={formData.gestational_age} onChange={handleChange} required
                    placeholder="39" min={20} max={45} style={inp(true)} onFocus={onFocus} onBlur={onBlur} />
                </Field>

                {/* Section: Obstetric History */}
                <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                  <SectionHeader icon={Heart} label="Obstetric History" color="#DC2626" />
                </div>

                <Field label="Gravida">
                  <input type="number" name="gravida" value={formData.gravida} onChange={handleChange} required
                    min={1} style={inp()} onFocus={onFocus} onBlur={onBlur} />
                </Field>

                <Field label="Parity">
                  <input type="number" name="parity" value={formData.parity} onChange={handleChange} required
                    min={0} style={inp()} onFocus={onFocus} onBlur={onBlur} />
                </Field>

                {/* Section: Admission Details */}
                <div style={{ gridColumn: '1 / -1', marginTop: '8px' }}>
                  <SectionHeader icon={Calendar} label="Admission Details" color="#2563EB" />
                </div>

                <Field label="Admission Timestamp" icon={Calendar} span={2}>
                  <input type="datetime-local" name="admission_time" value={formData.admission_time} onChange={handleChange} required
                    style={inp(true)} onFocus={onFocus} onBlur={onBlur} />
                </Field>

                <Field label="Membrane Rupture Time (Optional)" icon={Calendar} span={2}>
                  <input type="datetime-local" name="membrane_rupture_time" value={formData.membrane_rupture_time} onChange={handleChange}
                    style={inp(true)} onFocus={onFocus} onBlur={onBlur} />
                </Field>
              </div>

              {/* Info banner */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '14px 18px', borderRadius: '8px', marginTop: '24px',
                background: '#EFF6FF', border: '1px solid #BFDBFE',
              }}>
                <Info style={{ width: '15px', height: '15px', color: '#2563EB', flexShrink: 0, marginTop: '2px' }} />
                <p style={{
                  fontSize: '13px', color: '#475569', lineHeight: 1.65, margin: 0,
                  fontFamily: 'Inter, sans-serif',
                }}>
                  Initializing a new patient profile sets the baseline for labor monitoring.
                  The partograph automatically tracks progress from the first observation recorded at ≥ 4 cm dilation.
                </p>
              </div>

              {/* Submit button */}
              <motion.button
                type="submit" disabled={loading}
                whileHover={!loading ? { scale: 1.01 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                style={{
                  marginTop: '24px', width: '100%', padding: '14px 28px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  background: loading ? '#94A3B8' : '#2563EB',
                  color: '#fff',
                  fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700, fontSize: '14px',
                  borderRadius: '8px', border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 2px 8px rgba(37,99,235,0.25)',
                  transition: 'all 0.2s ease',
                }}
              >
                {loading ? (
                  <><Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} /> Registering…</>
                ) : (
                  <><UserPlus style={{ width: '18px', height: '18px' }} /> Register &amp; Start Partograph <ChevronRight style={{ width: '18px', height: '18px' }} /></>
                )}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default NewPatient;
