/**
 * NeuroSidebar.jsx — Dark glassmorphic patient sidebar
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Baby, Calendar, Droplets,
  ShieldCheck, AlertCircle, AlertTriangle, Activity,
  TrendingUp, ChevronDown, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../../services/api';
import DeliveryPredictor from '../partogram/DeliveryPredictor';

const glass = {
  background: 'rgba(15,23,42,0.55)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(79,209,197,0.18)',
  borderRadius: '20px',
  boxShadow: '0 0 24px rgba(79,209,197,0.05), inset 0 1px 0 rgba(255,255,255,0.05)',
};

const STATUS_CFG = {
  NORMAL:     { glow:'#4FD1C5', text:'#4FD1C5', bg:'rgba(79,209,197,0.06)', border:'rgba(79,209,197,0.2)' },
  BORDERLINE: { glow:'#F59E0B', text:'#FCD34D', bg:'rgba(245,158,11,0.06)', border:'rgba(245,158,11,0.2)' },
  ABNORMAL:   { glow:'#EF4444', text:'#FCA5A5', bg:'rgba(239,68,68,0.06)',  border:'rgba(239,68,68,0.2)'  },
};

function Row({ icon: Icon, label, value, color = '#4FD1C5' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'9px 12px', borderRadius:'12px',
      background:'rgba(79,209,197,0.04)', border:'1px solid rgba(79,209,197,0.10)',
      marginBottom:'6px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <div style={{ width:'26px', height:'26px', borderRadius:'8px',
          background:`${color}14`, border:`1px solid ${color}25`,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon style={{ width:'12px', height:'12px', color }} />
        </div>
        <span style={{ fontSize:'11px', fontWeight:700, color:'rgba(255,255,255,0.4)',
          textTransform:'uppercase', letterSpacing:'0.07em' }}>{label}</span>
      </div>
      <span style={{ fontSize:'12px', fontWeight:700, color:'#fff' }}>{value}</span>
    </div>
  );
}

export default function NeuroSidebar({ patient, observations, alerts = [], whoResult, onAcknowledge }) {
  const [clinicalExpanded, setClinicalExpanded] = useState(false);

  if (!patient) return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ height:'120px', ...glass, opacity:0.4,
          animation:'pulse 2s ease-in-out infinite' }} />
      ))}
    </div>
  );

  const unack        = alerts.filter(a => !a.acknowledged);
  const hasCritical  = unack.some(a => a.severity === 'red');
  const cfg          = STATUS_CFG[whoResult?.status] ?? STATUS_CFG.NORMAL;

  const handleAck = async (alertId) => {
    try {
      await api.post(`/api/alerts/${alertId}/acknowledge`);
      onAcknowledge?.();
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

      {/* ── Patient card ──────────────────────────────────────────────────── */}
      <motion.div whileHover={{ y:-2, boxShadow:'0 0 32px rgba(79,209,197,0.14)' }}
        transition={{ duration:0.3 }}
        style={{ ...glass, padding:'22px 18px', textAlign:'center' }}>
        <motion.div animate={{ y:[0,-5,0] }} transition={{ duration:5, repeat:Infinity, ease:'easeInOut' }}
          style={{ width:'68px', height:'68px', borderRadius:'50%', margin:'0 auto 12px',
            background:'linear-gradient(135deg,rgba(79,209,197,0.2),rgba(107,70,193,0.2))',
            border:'2px solid rgba(79,209,197,0.3)',
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 0 28px rgba(79,209,197,0.25)' }}>
          <User style={{ width:'32px', height:'32px', color:'#4FD1C5' }} />
        </motion.div>
        <h2 style={{ fontFamily:'Poppins,sans-serif', fontSize:'17px', fontWeight:800,
          color:'#fff', margin:'0 0 5px' }}>{patient.name}</h2>
        <span style={{ fontSize:'10px', fontWeight:700, color:'#4FD1C5',
          background:'rgba(79,209,197,0.1)', padding:'3px 12px', borderRadius:'99px',
          border:'1px solid rgba(79,209,197,0.25)', textTransform:'uppercase', letterSpacing:'0.1em' }}>
          {patient.patient_id}
        </span>
        {patient.age && (
          <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.35)', margin:'8px 0 0', fontWeight:500 }}>
            {patient.age} years old
          </p>
        )}
      </motion.div>

      {/* ── Clinical info ─────────────────────────────────────────────────── */}
      <motion.div whileHover={{ y:-2 }} style={{ ...glass, padding:'18px' }}>
        <div 
          onClick={() => setClinicalExpanded(!clinicalExpanded)}
          style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            marginBottom: clinicalExpanded ? '12px' : '0',
            paddingBottom: clinicalExpanded ? '10px' : '0', 
            borderBottom: clinicalExpanded ? '1px solid rgba(79,209,197,0.08)' : 'none',
            cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Activity style={{ width:'12px', height:'12px', color:'#4FD1C5' }} />
            <span style={{ fontSize:'11px', fontWeight:800, color:'rgba(255,255,255,0.55)',
              textTransform:'uppercase', letterSpacing:'0.09em' }}>Clinical Summary</span>
          </div>
          <div style={{ padding: '3px', borderRadius: '50%', background: 'rgba(79,209,197,0.1)' }}>
            {clinicalExpanded ? <ChevronDown style={{ width: '12px', height: '12px', color: '#4FD1C5' }} /> : <ChevronRight style={{ width: '12px', height: '12px', color: '#4FD1C5' }} />}
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
              <Row icon={Baby}     label="Gravida/Para" value={`G${patient.gravida} P${patient.parity ?? '—'}`} />
              <Row icon={Calendar} label="Gestation"    value={`${patient.gestational_age}w`} color="#B794F4" />
              <Row icon={Droplets} label="Membranes"    value={patient.membrane_status || 'Intact'} color="#F472B6" />
              <Row icon={Calendar} label="Admitted"
                value={formatDistanceToNow(new Date(patient.admission_time), { addSuffix:true })}
                color="#4ADE80" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── WHO classification ────────────────────────────────────────────── */}
      {whoResult && (
        <motion.div whileHover={{ y:-2 }} transition={{ duration:0.3 }}
          style={{ ...glass, padding:'16px',
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            boxShadow: `0 0 24px ${cfg.glow}14` }}>
          <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'10px' }}>
            <TrendingUp style={{ width:'12px', height:'12px', color:cfg.text }} />
            <span style={{ fontSize:'11px', fontWeight:800, color:cfg.text,
              textTransform:'uppercase', letterSpacing:'0.09em' }}>WHO Classification</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
            <span style={{ fontSize:'9px', fontWeight:700, color:'rgba(255,255,255,0.35)',
              textTransform:'uppercase' }}>Status</span>
            <motion.span
              animate={{ textShadow:[`0 0 8px ${cfg.glow}00`,`0 0 16px ${cfg.glow}99`,`0 0 8px ${cfg.glow}00`] }}
              transition={{ duration:2.5, repeat:Infinity }}
              style={{ fontSize:'14px', fontWeight:900, color:cfg.text,
                fontFamily:'Poppins,sans-serif' }}>
              {whoResult.status}
            </motion.span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'8px' }}>
            {[
              { label:'Graph',    val:whoResult.graph_status },
              { label:'Clinical', val:whoResult.clinical_status },
            ].map(({ label, val }) => (
              <div key={label} style={{ padding:'7px 9px', borderRadius:'10px',
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize:'8px', fontWeight:700, color:'rgba(255,255,255,0.3)',
                  textTransform:'uppercase', marginBottom:'2px' }}>{label}</div>
                <div style={{ fontSize:'12px', fontWeight:800,
                  color:STATUS_CFG[val]?.text ?? '#fff' }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'7px 9px', borderRadius:'10px',
            background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontSize:'11px', fontWeight:700, color:'#fff' }}>
              {whoResult.dilation_rate}
            </span>
            <span style={{ fontSize:'9px', fontWeight:700, color:cfg.text }}>
              {whoResult.lineStatus === 'normal' ? '✓ Left of Alert'
               : whoResult.lineStatus === 'alert' ? '⚠ Alert Crossed'
               : '🚨 Action Crossed'}
            </span>
          </div>
          {whoResult.insight && (
            <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.45)', lineHeight:1.6, margin:'8px 0 0' }}>
              {whoResult.insight}
            </p>
          )}
        </motion.div>
      )}

    </div>
  );
}
