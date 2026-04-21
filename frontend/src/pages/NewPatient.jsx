import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ArrowLeft, UserPlus, Save, Calendar, User, Activity, ChevronRight, Info, Loader2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const FieldLabel = ({ children }) => (
  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
    {children}
  </label>
);

const InputWrap = ({ icon: Icon, children }) => (
  <div style={{ position: 'relative' }}>
    {Icon && <Icon style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#22D3EE', pointerEvents: 'none' }} />}
    {children}
  </div>
);

const inputStyle = (hasIcon = false) => ({
  width: '100%',
  paddingLeft: hasIcon ? '48px' : '16px',
  paddingRight: '16px',
  paddingTop: '13px',
  paddingBottom: '13px',
  background: 'rgba(255,255,255,0.04)',
  border: '1.5px solid rgba(255,255,255,0.09)',
  borderRadius: '12px',
  fontSize: '15px',
  fontFamily: 'Roboto, sans-serif',
  color: '#E5E7EB',
  outline: 'none',
  transition: 'all 0.2s ease',
  boxSizing: 'border-box',
});

const NewPatient = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gravida: 1,
    parity: 0,
    gestational_age: '',
    admission_time: new Date().toISOString().slice(0, 16),
    membrane_rupture_time: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFocus = (e) => {
    e.target.style.borderColor = 'rgba(34,211,238,0.55)';
    e.target.style.boxShadow = '0 0 0 3px rgba(34,211,238,0.1)';
    e.target.style.background = 'rgba(34,211,238,0.03)';
  };
  const handleBlur = (e) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.09)';
    e.target.style.boxShadow = 'none';
    e.target.style.background = 'rgba(255,255,255,0.04)';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await api.post('/api/patient', formData, {
      });
      navigate(`/dashboard/${resp.data.patient_id}`);
    } catch (err) {
      console.error(err);
      alert('Error registering patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'radial-gradient(ellipse at top left, #0d1929 0%, #0B1220 55%, #060D18 100%)' }}>
      <Sidebar />

      <main style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>

          {/* Back button */}
          <button
            onClick={() => navigate('/patients')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px',
              color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '14px', fontWeight: 500, transition: 'color 0.2s ease',
            }}
            onMouseOver={e => e.currentTarget.style.color = '#D1D5DB'}
            onMouseOut={e => e.currentTarget.style.color = '#6B7280'}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Back to Patients
          </button>

          {/* Page title */}
          <div style={{ marginBottom: '32px' }} className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '13px',
                background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(14,165,233,0.1))',
                border: '1px solid rgba(34,211,238,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UserPlus style={{ width: '20px', height: '20px', color: '#22D3EE' }} />
              </div>
              <div>
                <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '28px', fontWeight: 700, color: '#F9FAFB', margin: 0, letterSpacing: '-0.02em' }}>
                  New Admission
                </h1>
                <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '3px' }}>
                  Initialize digital partograph for a new patient
                </p>
              </div>
            </div>
          </div>

          {/* Form card */}
          <div
            className="animate-fade-in"
            style={{
              background: 'rgba(15,21,37,0.9)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '22px', padding: '36px',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Ambient glow */}
            <div style={{
              position: 'absolute', top: '-80px', right: '-80px', width: '300px', height: '300px',
              borderRadius: '50%', pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 65%)',
            }} />

            <form onSubmit={handleSubmit} style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

                {/* Full Name */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel>Full Name</FieldLabel>
                  <InputWrap icon={User}>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required
                      placeholder="e.g. Jane Doe"
                      style={inputStyle(true)} onFocus={handleFocus} onBlur={handleBlur}
                    />
                  </InputWrap>
                </div>

                {/* Age */}
                <div>
                  <FieldLabel>Age (Years)</FieldLabel>
                  <input type="number" name="age" value={formData.age} onChange={handleChange} required
                    placeholder="28" style={inputStyle()} onFocus={handleFocus} onBlur={handleBlur}
                  />
                </div>

                {/* Gestational Age */}
                <div>
                  <FieldLabel>Gestational Age (Weeks)</FieldLabel>
                  <input type="number" name="gestational_age" value={formData.gestational_age} onChange={handleChange} required
                    placeholder="39" style={inputStyle()} onFocus={handleFocus} onBlur={handleBlur}
                  />
                </div>

                {/* Gravida */}
                <div>
                  <FieldLabel>Gravida</FieldLabel>
                  <input type="number" name="gravida" value={formData.gravida} onChange={handleChange} required
                    style={inputStyle()} onFocus={handleFocus} onBlur={handleBlur}
                  />
                </div>

                {/* Parity */}
                <div>
                  <FieldLabel>Parity</FieldLabel>
                  <input type="number" name="parity" value={formData.parity} onChange={handleChange} required
                    style={inputStyle()} onFocus={handleFocus} onBlur={handleBlur}
                  />
                </div>

                {/* Admission Time */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel>Admission Timestamp</FieldLabel>
                  <InputWrap icon={Calendar}>
                    <input type="datetime-local" name="admission_time" value={formData.admission_time} onChange={handleChange} required
                      style={inputStyle(true)} onFocus={handleFocus} onBlur={handleBlur}
                    />
                  </InputWrap>
                </div>

                {/* Membrane Rupture */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldLabel>Membrane Rupture Time (Optional)</FieldLabel>
                  <InputWrap icon={Calendar}>
                    <input type="datetime-local" name="membrane_rupture_time" value={formData.membrane_rupture_time} onChange={handleChange}
                      style={inputStyle(true)} onFocus={handleFocus} onBlur={handleBlur}
                    />
                  </InputWrap>
                </div>
              </div>

              {/* Info banner */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '16px 20px', borderRadius: '14px', marginTop: '28px',
                background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.12)',
              }}>
                <Info style={{ width: '17px', height: '17px', color: '#22D3EE', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                  Initializing a new patient profile sets the baseline for labor monitoring.
                  The partograph automatically tracks progress from the first observation recorded at ≥ 4 cm dilation.
                </p>
              </div>

              {/* Submit */}
              <div style={{ marginTop: '28px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    padding: '15px 28px',
                    background: loading ? 'rgba(34,211,238,0.5)' : 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)',
                    color: '#030D18', fontWeight: 700, fontSize: '16px',
                    fontFamily: 'Poppins, sans-serif',
                    borderRadius: '13px', border: 'none', cursor: loading ? 'wait' : 'pointer',
                    boxShadow: '0 6px 28px rgba(34,211,238,0.38)',
                    transition: 'all 0.25s ease',
                  }}
                  onMouseOver={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(34,211,238,0.5)'; }}}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(34,211,238,0.38)'; }}
                >
                  {loading
                    ? <><Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} /> Registering…</>
                    : <><UserPlus style={{ width: '18px', height: '18px' }} /> Register &amp; Start Partograph <ChevronRight style={{ width: '18px', height: '18px' }} /></>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NewPatient;
