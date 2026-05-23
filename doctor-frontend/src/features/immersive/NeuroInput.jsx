/**
 * NeuroInput.jsx — Dark glassmorphic floating input panel
 *
 * Reuses WHO validation ranges from ImmersiveInput but restyled for
 * the dark neon design system.  Slight tilt on cursor via CSS transform.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Heart, Thermometer, Wind, Plus, Loader2,
  Activity, Check, AlertTriangle, Cpu,
} from 'lucide-react';
import api from '../../services/api';

// ── WHO ranges ────────────────────────────────────────────────────────────────
const VALIDATORS = {
  cervical_dilation:    { min: 0,  max: 10,  label: 'Cervical Dilation (0–10 cm)' },
  fetal_heart_rate:     { min: 50, max: 200, label: 'FHR (50–200 bpm)' },
  contraction_freq:     { min: 0,  max: 10,  label: 'Contrax Freq (0–10/10m)' },
  contraction_duration: { min: 0,  max: 120, label: 'Duration (0–120 s)' },
  bp_systolic:          { min: 60, max: 200, label: 'Systolic BP (60–200)' },
  bp_diastolic:         { min: 40, max: 130, label: 'Diastolic BP (40–130)' },
  maternal_pulse:       { min: 40, max: 200, label: 'Pulse (40–200 bpm)' },
  temperature:          { min: 35, max: 42,  label: 'Temp (35–42 °C)' },
};

const GROUPS = [
  {
    key: 'labor', title: 'Labor Progress', icon: Activity, accent: '#4FD1C5',
    fields: [
      { name:'cervical_dilation', label:'Cervical Dilation', unit:'cm',  placeholder:'4–10', type:'number', step:0.5 },
    ],
  },
  {
    key: 'fetal', title: 'Fetal Wellbeing', icon: Heart, accent: '#F472B6',
    fields: [
      { name:'fetal_heart_rate', label:'Heart Rate', unit:'bpm', placeholder:'110–160', type:'number' },
    ],
  },
  {
    key: 'cx', title: 'Contractions', icon: Wind, accent: '#F59E0B',
    fields: [
      { name:'contraction_freq',     label:'Frequency', unit:'/10m', placeholder:'2–5', type:'number' },
      { name:'contraction_duration', label:'Duration',  unit:'s',    placeholder:'20–60', type:'number' },
    ],
  },
  {
    key: 'maternal', title: 'Maternal Vitals', icon: Thermometer, accent: '#B794F4',
    fields: [
      { name:'bp_systolic',    label:'BP Systolic',  unit:'mmHg', placeholder:'90–140', type:'number' },
      { name:'bp_diastolic',   label:'BP Diastolic', unit:'mmHg', placeholder:'60–90',  type:'number' },
      { name:'maternal_pulse', label:'Pulse',        unit:'bpm',  placeholder:'60–100', type:'number' },
      { name:'temperature',    label:'Temperature',  unit:'°C',   placeholder:'36–38',  type:'number', step:0.1 },
    ],
  },
];

// ── Glass card util ───────────────────────────────────────────────────────────
const glass = {
  background: 'rgba(15,23,42,0.55)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(79,209,197,0.18)',
  borderRadius: '20px',
  boxShadow: '0 0 28px rgba(79,209,197,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function NeuroInput({ patientId, onUpdate }) {
  const emptyForm = Object.fromEntries(
    GROUPS.flatMap(g => g.fields.map(f => [f.name, '']))
  );

  const [form,      setForm]      = useState({ ...emptyForm, timestamp: '' });
  const [errors,    setErrors]    = useState({});
  const [submitting,setSubmitting]= useState(false);
  const [success,   setSuccess]   = useState(false);

  const validate = () => {
    const errs = {};
    Object.entries(form).forEach(([key, val]) => {
      if (val === '' || val === null) return;
      const v = VALIDATORS[key];
      if (!v) return;
      const n = parseFloat(val);
      if (isNaN(n) || n < v.min || n > v.max) {
        errs[key] = `${v.label}`;
      }
    });
    return errs;
  };

  const handleChange = (name, value) => {
    setForm(f => ({ ...f, [name]: value }));
    setErrors(e => { const copy = { ...e }; delete copy[name]; return copy; });
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Clamp dilation to 10
    const payload = { ...form, patient_id: patientId };
    if (payload.cervical_dilation !== '') {
      payload.cervical_dilation = Math.min(10, parseFloat(payload.cervical_dilation));
    }
    // Remove empty strings
    Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k]; });
    if (!payload.timestamp) delete payload.timestamp;

    setSubmitting(true);
    try {
      await api.post('/api/observation', payload);
      setSuccess(true);
      setForm({ ...emptyForm, timestamp: '' });
      onUpdate?.();
      setTimeout(() => setSuccess(false), 2200);
    } catch (e) {
      setErrors({ _global: e.response?.data?.error ?? 'Submission failed' });
    } finally { setSubmitting(false); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px', height:'100%', minHeight:0 }}>

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div style={{ ...glass, padding:'14px 18px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'30px', height:'30px', borderRadius:'10px',
            background:'linear-gradient(135deg,rgba(79,209,197,0.25),rgba(107,70,193,0.25))',
            border:'1px solid rgba(79,209,197,0.3)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 0 14px rgba(79,209,197,0.3)' }}>
            <Cpu style={{ width:'14px', height:'14px', color:'#4FD1C5' }} />
          </div>
          <div>
            <h3 style={{ fontFamily:'Poppins,sans-serif', fontSize:'13px', fontWeight:800,
              color:'#fff', margin:0 }}>Add Observation</h3>
            <p style={{ fontSize:'9px', color:'rgba(255,255,255,0.3)', margin:0,
              textTransform:'uppercase', letterSpacing:'0.08em' }}>WHO Labour Care Guide</p>
          </div>
        </div>

        {/* Timestamp */}
        <div style={{ marginTop:'12px' }}>
          <label style={{ fontSize:'9px', fontWeight:700, color:'rgba(255,255,255,0.35)',
            textTransform:'uppercase', letterSpacing:'0.1em', display:'block', marginBottom:'5px' }}>
            Time (leave blank = now)
          </label>
          <input
            type="datetime-local"
            value={form.timestamp}
            onChange={e => handleChange('timestamp', e.target.value)}
            style={{
              width:'100%', padding:'9px 12px', borderRadius:'11px', boxSizing:'border-box',
              background:'rgba(79,209,197,0.06)', border:'1px solid rgba(79,209,197,0.2)',
              color:'#fff', fontSize:'12px', outline:'none',
              colorScheme:'dark',
            }}
          />
        </div>
      </div>

      {/* ── Field groups ─────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'8px' }}>
        {GROUPS.map(({ key, title, icon: Icon, accent, fields }) => (
          <motion.div key={key} whileHover={{ y:-1 }} transition={{ duration:0.2 }}
            style={{ ...glass, padding:'14px',
              border:`1px solid ${accent}25`,
              background:`${accent}06` }}>
            <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'10px' }}>
              <div style={{ width:'24px', height:'24px', borderRadius:'8px',
                background:`${accent}18`, border:`1px solid ${accent}28`,
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:`0 0 8px ${accent}30` }}>
                <Icon style={{ width:'12px', height:'12px', color:accent }} />
              </div>
              <span style={{ fontSize:'11px', fontWeight:800, color:accent,
                textTransform:'uppercase', letterSpacing:'0.07em' }}>{title}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              {fields.map(field => (
                <div key={field.name}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <label style={{ fontSize:'10px', fontWeight:600,
                      color:'rgba(255,255,255,0.45)' }}>{field.label}</label>
                    <span style={{ fontSize:'9px', color:`${accent}AA`, fontWeight:700 }}>
                      {field.unit}
                    </span>
                  </div>
                  <div style={{ position:'relative' }}>
                    <input
                      id={`neuro-field-${field.name}`}
                      type={field.type}
                      step={field.step}
                      min={field.min}
                      max={field.max}
                      placeholder={field.placeholder}
                      value={form[field.name]}
                      onChange={e => handleChange(field.name, e.target.value)}
                      style={{
                        width:'100%', padding:'9px 12px', borderRadius:'11px',
                        boxSizing:'border-box',
                        background: errors[field.name]
                          ? 'rgba(239,68,68,0.08)'
                          : 'rgba(255,255,255,0.04)',
                        border: errors[field.name]
                          ? '1px solid rgba(239,68,68,0.4)'
                          : `1px solid ${accent}22`,
                        color:'#fff', fontSize:'13px', fontWeight:700,
                        outline:'none', transition:'all 0.2s ease',
                      }}
                      onFocus={e => {
                        e.target.style.borderColor = accent;
                        e.target.style.boxShadow   = `0 0 14px ${accent}35`;
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = errors[field.name]
                          ? 'rgba(239,68,68,0.4)' : `${accent}22`;
                        e.target.style.boxShadow   = 'none';
                      }}
                    />
                  </div>
                  {errors[field.name] && (
                    <p style={{ fontSize:'9px', color:'#FCA5A5', margin:'3px 0 0',
                      display:'flex', alignItems:'center', gap:'4px' }}>
                      <AlertTriangle style={{ width:'9px', height:'9px' }} />
                      {errors[field.name]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Global error ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {errors._global && (
          <motion.div initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ padding:'10px 14px', borderRadius:'12px',
              background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
              fontSize:'11px', fontWeight:600, color:'#FCA5A5',
              display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
            <AlertTriangle style={{ width:'13px', height:'13px', flexShrink:0 }} />
            {errors._global}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <motion.button
        id="neuro-submit-observation"
        whileHover={{ scale:1.02, boxShadow:'0 0 28px rgba(79,209,197,0.45)' }}
        whileTap={{ scale:0.97 }}
        onClick={handleSubmit}
        disabled={submitting}
        style={{
          width:'100%', padding:'13px',
          borderRadius:'14px', border:'none',
          background: success
            ? 'linear-gradient(135deg,#4ADE80,#22C55E)'
            : submitting
              ? 'rgba(79,209,197,0.15)'
              : 'linear-gradient(135deg,#4FD1C5,#6B46C1)',
          color:'#fff', fontSize:'13px', fontWeight:800,
          cursor: submitting ? 'not-allowed' : 'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
          transition:'background 0.3s ease',
          boxShadow: success ? '0 0 24px rgba(74,222,128,0.4)' : '0 0 18px rgba(79,209,197,0.25)',
          flexShrink:0,
          fontFamily:'Poppins,sans-serif',
        }}>
        {submitting ? (
          <><Loader2 style={{ width:'15px', height:'15px', animation:'spin 0.9s linear infinite' }} />Processing…</>
        ) : success ? (
          <><Check style={{ width:'15px', height:'15px' }} />Observation Saved</>
        ) : (
          <><Plus style={{ width:'15px', height:'15px' }} />Record Observation</>
        )}
      </motion.button>

      <style>{`
        input[type="number"]::-webkit-inner-spin-button { opacity: 0.3; }
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
      `}</style>
    </div>
  );
}
