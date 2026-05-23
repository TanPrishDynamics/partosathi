import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Calendar, Droplets, Baby, Info,
  ShieldCheck, AlertCircle, AlertTriangle,
  TrendingUp, Activity, ChevronDown, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import DeliveryPredictor from '../partogram/DeliveryPredictor';

// ── Sub-components ────────────────────────────────────────────────────────────
const StatRow = ({ icon: Icon, label, value, accent = '#4A90E2' }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px', borderRadius: '14px',
    background: 'rgba(255,255,255,0.50)',
    border: '1px solid rgba(255,255,255,0.75)',
    marginBottom: '8px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '30px', height: '30px', borderRadius: '10px',
        background: `${accent}14`, border: `1px solid ${accent}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon style={{ width: '14px', height: '14px', color: accent }} />
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
    </div>
    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B' }}>{value}</span>
  </div>
);

// ── WHO colour maps ───────────────────────────────────────────────────────────
const STATUS_COLORS = {
  NORMAL:     { bg: 'rgba(22,163,74,0.07)',  border: 'rgba(22,163,74,0.22)',  text: '#16A34A' },
  BORDERLINE: { bg: 'rgba(217,119,6,0.07)',  border: 'rgba(217,119,6,0.22)',  text: '#D97706' },
  ABNORMAL:   { bg: 'rgba(220,38,38,0.07)',  border: 'rgba(220,38,38,0.22)',  text: '#DC2626' },
};
const LINE_COLORS = {
  normal: { text: '#16A34A', label: 'Left of Alert Line' },
  alert:  { text: '#D97706', label: 'Alert Line Crossed' },
  action: { text: '#DC2626', label: 'Action Line Crossed' },
};

// ── Main component ────────────────────────────────────────────────────────────
/**
 * ImmersiveSidebar
 *
 * Props:
 *   patient    — patient object from backend
 *   observations — observation data array
 *   alerts     — backend Alert[] (for Ack buttons)
 *   whoResult  — result of computeWHOClassification() — passed from ImmersiveLayout
 *                (single source of truth; NOT recomputed here)
 *   onAcknowledge — callback after Ack click
 */
export default function ImmersiveSidebar({ patient, observations, alerts = [], whoResult, onAcknowledge }) {
  const [clinicalExpanded, setClinicalExpanded] = useState(false);

  if (!patient) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: '120px', borderRadius: '24px',
          background: 'rgba(255,255,255,0.40)', border: '1px solid rgba(255,255,255,0.70)',
          animation: 'ai-pulse-anim 1.8s ease-in-out infinite' }} />
      ))}
    </div>
  );

  const unack          = alerts.filter(a => !a.acknowledged);
  const criticalAlerts = unack.filter(a => a.severity === 'red');

  const handleAck = async (alertId) => {
    try {
      const api = (await import('../../services/api')).default;
      // Correct endpoint: PATCH /api/alerts/{id}/acknowledge
      await api.post(`/api/alerts/${alertId}/acknowledge`);
      onAcknowledge?.();
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── Patient avatar card ───────────────────────────────────────────── */}
      <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.3 }}
        style={{ borderRadius: '24px', background: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.80)', padding: '24px', textAlign: 'center',
          boxShadow: '0 8px 30px rgba(74,144,226,0.08), inset 0 1px 0 rgba(255,255,255,0.95)' }}>
        <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '72px', height: '72px', borderRadius: '50%', margin: '0 auto 14px',
            background: 'linear-gradient(135deg, rgba(74,144,226,0.15) 0%, rgba(139,92,246,0.12) 100%)',
            border: '3px solid rgba(255,255,255,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(74,144,226,0.15)' }}>
          <User style={{ width: '36px', height: '36px', color: '#4A90E2' }} />
        </motion.div>
        <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '18px', fontWeight: 800, color: '#1E293B', margin: '0 0 6px' }}>
          {patient.name}
        </h2>
        <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, color: '#4A90E2',
          background: 'rgba(74,144,226,0.08)', padding: '3px 12px', borderRadius: '99px',
          textTransform: 'uppercase', letterSpacing: '0.1em', border: '1px solid rgba(74,144,226,0.2)' }}>
          {patient.patient_id}
        </span>
        {patient.age && (
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px', fontWeight: 500 }}>
            {patient.age} years old
          </p>
        )}
      </motion.div>

      {/* ── Clinical summary ─────────────────────────────────────────────── */}
      <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3 }}
        style={{ borderRadius: '24px', background: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.80)', padding: '20px',
          boxShadow: '0 8px 30px rgba(74,144,226,0.07), inset 0 1px 0 rgba(255,255,255,0.95)' }}>
        <div 
          onClick={() => setClinicalExpanded(!clinicalExpanded)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            marginBottom: clinicalExpanded ? '14px' : '0',
            paddingBottom: clinicalExpanded ? '12px' : '0', borderBottom: clinicalExpanded ? '1px solid rgba(74,144,226,0.08)' : 'none',
            cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info style={{ width: '14px', height: '14px', color: '#4A90E2' }} />
            <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '13px', fontWeight: 700,
              color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              Clinical Summary
            </h3>
          </div>
          <div style={{ padding: '4px', borderRadius: '50%', background: 'rgba(74,144,226,0.1)' }}>
            {clinicalExpanded ? <ChevronDown style={{ width: '14px', height: '14px', color: '#4A90E2' }} /> : <ChevronRight style={{ width: '14px', height: '14px', color: '#4A90E2' }} />}
          </div>
        </div>
        
        <AnimatePresence>
          {clinicalExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden' }}
            >
              <StatRow icon={Baby}     label="Gravida/Para" value={`G${patient.gravida} P${patient.parity ?? '—'}`} />
              <StatRow icon={Calendar} label="Gestational"  value={`${patient.gestational_age}w`} accent="#8B5CF6" />
              <StatRow icon={Droplets} label="Membranes"    value={patient.membrane_status || 'Intact'} accent="#F472B6" />
              <StatRow icon={Calendar} label="Admitted"
                value={formatDistanceToNow(new Date(patient.admission_time), { addSuffix: true })}
                accent="#22C55E" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── WHO Classification panel ──────────────────────────────────────── */}
      {/* Reads from whoResult prop — computed ONCE in ImmersiveLayout.      */}
      {/* This is NOT recomputed here. Single source of truth.               */}
      {whoResult && (
        <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.3 }}
          style={{ borderRadius: '24px', padding: '18px',
            background: STATUS_COLORS[whoResult.status]?.bg ?? 'rgba(255,255,255,0.6)',
            border: `1px solid ${STATUS_COLORS[whoResult.status]?.border ?? 'rgba(255,255,255,0.8)'}`,
            backdropFilter: 'blur(16px)' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Activity style={{ width: '14px', height: '14px', color: STATUS_COLORS[whoResult.status]?.text }} />
            <h4 style={{ fontSize: '12px', fontWeight: 800,
              color: STATUS_COLORS[whoResult.status]?.text,
              textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
              WHO Classification
            </h4>
          </div>

          {/* Overall status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Overall</span>
            <span style={{ fontSize: '13px', fontWeight: 800, color: STATUS_COLORS[whoResult.status]?.text }}>
              {whoResult.status}
            </span>
          </div>

          {/* Graph vs Clinical sub-status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            {[
              { label: 'Graph',    val: whoResult.graph_status },
              { label: 'Clinical', val: whoResult.clinical_status },
            ].map(({ label, val }) => (
              <div key={label} style={{ padding: '8px 10px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.75)' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#94A3B8',
                  textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '12px', fontWeight: 800,
                  color: STATUS_COLORS[val]?.text ?? '#1E293B' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Dilation rate + line status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 10px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.70)',
            marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp style={{ width: '12px', height: '12px', color: '#64748B' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#1E293B' }}>
                {whoResult.dilation_rate}
              </span>
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700,
              color: LINE_COLORS[whoResult.lineStatus]?.text ?? '#64748B' }}>
              {LINE_COLORS[whoResult.lineStatus]?.label}
            </span>
          </div>

          {/* Clinical insight */}
          {whoResult.insight && (
            <p style={{ fontSize: '11px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
              {whoResult.insight}
            </p>
          )}
        </motion.div>
      )}

    </div>
  );
}
