import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Heart, Thermometer, Wind, Plus, Loader2,
  Activity, Mic, Check, AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';

// ── WHO physiological validation ranges ──────────────────────────────────────
const VALIDATORS = {
  cervical_dilation:    { min: 0,  max: 10,  label: 'Cervical Dilation (0–10 cm)' },
  fetal_heart_rate:     { min: 50, max: 200, label: 'FHR (50–200 bpm)' },
  contraction_freq:     { min: 0,  max: 10,  label: 'Contraction Freq (0–10 / 10 min)' },
  contraction_duration: { min: 0,  max: 120, label: 'Duration (0–120 s)' },
  bp_systolic:          { min: 60, max: 200, label: 'Systolic BP (60–200 mmHg)' },
  bp_diastolic:         { min: 40, max: 130, label: 'Diastolic BP (40–130 mmHg)' },
  maternal_pulse:       { min: 40, max: 200, label: 'Pulse (40–200 bpm)' },
  temperature:          { min: 35, max: 42,  label: 'Temperature (35–42 °C)' },
};

const FIELD_GROUPS = [
  {
    key: 'labor',
    title: 'Labor Progress',
    icon: Activity,
    accent: '#4A90E2',
    bg: 'rgba(74,144,226,0.07)',
    border: 'rgba(74,144,226,0.18)',
    fields: [
      { name: 'cervical_dilation', label: 'Cervical Dilation', unit: 'cm',  placeholder: '4–10',  type: 'number', min: 0,  max: 10,  step: 0.5 },
    ],
  },
  {
    key: 'fetal',
    title: 'Fetal Wellbeing',
    icon: Heart,
    accent: '#F472B6',
    bg: 'rgba(244,114,182,0.07)',
    border: 'rgba(244,114,182,0.18)',
    fields: [
      { name: 'fetal_heart_rate', label: 'Heart Rate', unit: 'bpm', placeholder: '110–160', type: 'number' },
    ],
  },
  {
    key: 'contractions',
    title: 'Contractions',
    icon: Wind,
    accent: '#F59E0B',
    bg: 'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.18)',
    fields: [
      { name: 'contraction_freq',     label: 'Freq / 10 min', placeholder: '3',  type: 'number' },
      { name: 'contraction_duration', label: 'Duration (s)',   placeholder: '40', type: 'number' },
    ],
  },
  {
    key: 'vitals',
    title: 'Maternal Vitals',
    icon: Thermometer,
    accent: '#10B981',
    bg: 'rgba(16,185,129,0.07)',
    border: 'rgba(16,185,129,0.18)',
    fields: [
      { name: 'bp_systolic',    label: 'BP Systolic',  placeholder: '120',  type: 'number' },
      { name: 'bp_diastolic',   label: 'BP Diastolic', placeholder: '80',   type: 'number' },
      { name: 'maternal_pulse', label: 'Pulse', unit: 'bpm', placeholder: '72',   type: 'number' },
      { name: 'temperature',    label: 'Temp',  unit: '°C',  placeholder: '37.0', type: 'number', step: 0.1 },
    ],
  },
];

const EMPTY = {
  cervical_dilation: '', fetal_heart_rate: '',
  contraction_freq: '', contraction_duration: '',
  maternal_pulse: '', bp_systolic: '', bp_diastolic: '', temperature: '',
};

// ── Client-side validation ────────────────────────────────────────────────────
function validateForm(form) {
  const errors = [];
  for (const [field, rule] of Object.entries(VALIDATORS)) {
    const raw = form[field];
    if (raw === '' || raw === undefined) continue; // all fields are optional
    const val = parseFloat(raw);
    if (isNaN(val)) {
      errors.push(`${rule.label}: must be a number`);
      continue;
    }
    if (val < rule.min || val > rule.max) {
      errors.push(`${rule.label}: ${val} is out of range (${rule.min}–${rule.max})`);
    }
  }
  if (!Object.values(form).some(v => v !== '')) {
    errors.push('Please enter at least one observation value');
  }
  return errors;
}

// ── Component ─────────────────────────────────────────────────────────────────
const ImmersiveInput = ({ patientId, onUpdate }) => {
  const [form, setForm]           = useState(EMPTY);
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [errors, setErrors]       = useState([]);
  const [listening, setListening] = useState(false);

  const update = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
    if (errors.length) setErrors([]);
  };

  const handleSave = async () => {
    if (!patientId) return;

    const validationErrors = validateForm(form);
    if (validationErrors.length > 0) { setErrors(validationErrors); return; }

    setLoading(true);
    setErrors([]);
    setSuccess(false);

    try {
      const payload = { patient_id: patientId, timestamp: new Date().toISOString() };
      for (const [k, v] of Object.entries(form)) {
        if (v === '') continue;
        const num = parseFloat(v);
        // Hard-clamp dilation to 10 cm before sending — WHO rule
        payload[k] = k === 'cervical_dilation' ? Math.min(10, num) : num;
      }

      // ── Correct endpoint ─────────────────────────────────────────────────
      await api.post('/api/observation', payload);

      setForm(EMPTY);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      onUpdate?.();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message;
      setErrors([msg || 'Save failed — please try again.']);
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    setListening(l => !l);
    setTimeout(() => setListening(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px', overflowY: 'auto', paddingBottom: '8px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '4px' }}>
        <Zap style={{ width: '16px', height: '16px', color: '#F59E0B' }} />
        <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '13px', fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
          Live Observation
        </h3>
      </div>

      {/* Input cards */}
      {FIELD_GROUPS.map(({ key, title, icon: Icon, accent, bg, border, fields }) => (
        <motion.div
          key={key}
          whileHover={{ y: -2, boxShadow: '0 16px 40px rgba(0,0,0,0.07)' }}
          transition={{ duration: 0.28 }}
          style={{
            padding: '16px', borderRadius: '20px',
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${border}`,
            boxShadow: '0 4px 16px rgba(74,144,226,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon style={{ width: '15px', height: '15px', color: accent }} />
            </div>
            <span style={{ fontSize: '10px', fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {title}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: fields.length > 1 ? '1fr 1fr' : '1fr', gap: '8px' }}>
            {fields.map(f => (
              <div key={f.name}>
                <label style={{ display: 'block', fontSize: '9px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '5px' }}>
                  {f.label}{f.unit && <span style={{ color: '#CBD5E1' }}> ({f.unit})</span>}
                </label>
                <input
                  id={`obs-${f.name}`}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.name]}
                  onChange={e => update(f.name, e.target.value)}
                  min={f.min} max={f.max} step={f.step}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.75)',
                    border: '1.5px solid rgba(74,144,226,0.12)',
                    fontSize: '14px', fontWeight: 600, color: '#1E293B',
                    outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 3px ${accent}18`; }}
                  onBlur={e  => { e.target.style.borderColor = 'rgba(74,144,226,0.12)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Validation errors */}
      <AnimatePresence>
        {errors.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ padding: '12px 16px', borderRadius: '14px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)' }}
          >
            {errors.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', marginBottom: i < errors.length - 1 ? '6px' : 0 }}>
                <AlertTriangle style={{ width: '13px', height: '13px', color: '#DC2626', marginTop: '1px', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>{e}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save button */}
      <button
        id="obs-save-btn"
        onClick={handleSave}
        disabled={loading}
        style={{
          width: '100%', padding: '14px', borderRadius: '16px', border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: success
            ? 'linear-gradient(135deg, #16A34A, #4ADE80)'
            : 'linear-gradient(135deg, #4A90E2 0%, #8B5CF6 100%)',
          color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '14px',
          boxShadow: success ? '0 6px 24px rgba(22,163,74,0.35)' : '0 6px 24px rgba(74,144,226,0.35)',
          transition: 'all 0.4s ease', opacity: loading ? 0.75 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
      >
        {loading
          ? <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
          : success
          ? <><Check style={{ width: '18px', height: '18px' }} />Saved Successfully</>
          : <><Plus style={{ width: '18px', height: '18px' }} />Record Observation</>
        }
      </button>

      {/* Voice input */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={toggleVoice}
        style={{
          width: '100%', padding: '12px', borderRadius: '16px',
          border: `1px solid ${listening ? 'rgba(244,114,182,0.35)' : 'rgba(74,144,226,0.18)'}`,
          background: listening ? 'rgba(244,114,182,0.10)' : 'rgba(74,144,226,0.06)',
          color: listening ? '#F472B6' : '#4A90E2',
          fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'all 0.3s ease',
        }}
      >
        <motion.div animate={listening ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.8, repeat: Infinity }}>
          <Mic style={{ width: '16px', height: '16px' }} />
        </motion.div>
        {listening ? 'Listening… speak now' : 'Voice Input (AI Mic)'}
      </motion.button>

    </div>
  );
};

export default ImmersiveInput;
