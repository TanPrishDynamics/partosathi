import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInMinutes } from 'date-fns';
import api from '../../services/api';
import {
  Activity, Clock, Heart, Bell, RefreshCw,
  ArrowLeft, Loader2, Plus, AlertCircle, AlertTriangle, ShieldCheck, X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { computeWHOClassification } from '../../utils/colpai';
import ImmersiveSidebar from './ImmersiveSidebar';
import ImmersiveGraph   from './ImmersiveGraph';
import ImmersiveInput   from './ImmersiveInput';
import DeliveryPredictor from '../partogram/DeliveryPredictor';
import AISummaryBox from '../partogram/AISummaryBox';

/**
 * ImmersiveLayout — Single Source of Truth Architecture
 *
 * Data flow:
 *   API fetch → observations[]
 *       └─► computeWHOClassification()  (colpai.js — run ONCE)
 *             ├─► ImmersiveGraph   (chart + clinical badges)
 *             ├─► ImmersiveSidebar (alerts + WHO status)
 *             └─► ImmersiveInput   (triggers onUpdate → re-fetch)
 *
 * There are NO separate data sources. The graph, sidebar alerts,
 * and delivery predictor all read from the SAME observations array.
 */
const ImmersiveLayout = ({ patientId }) => {
  const [patient,      setPatient]      = useState(null);
  const [observations, setObservations] = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);

  const navigate     = useNavigate();
  const containerRef = useRef(null);
  // Parallax refs — transforms applied directly to DOM, no React state involved
  const leftPanelRef  = useRef(null);
  const rightPanelRef = useRef(null);
  const rafRef        = useRef(null);
  const mousePosRef   = useRef({ x: 0, y: 0 });

  // ── Fetch from backend ──────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!patientId) return;
    try {
      // 1. Fetch patient
      const pRes = await api.get(`/api/patient/${patientId}`);
      setPatient(pRes.data);
      
      // 2. Fetch observations (non-blocking if it fails)
      try {
        const oRes = await api.get(`/api/observations/${patientId}`);
        setObservations(oRes.data || []);
      } catch (err) {
        console.error("Failed to load observations:", err);
        setObservations([]);
      }

      // 3. Fetch alerts (non-blocking)
      try {
        const aRes = await api.get(`/api/alerts/${patientId}`);
        setAlerts(aRes.data || []);
      } catch (err) {
        console.error("Failed to load alerts:", err);
        setAlerts([]);
      }
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to load patient:", err);
      if (err.response?.status === 401) navigate('/login');
      else navigate('/patients');
    } finally {
      setLoading(false);
    }
  }, [patientId, navigate]);

  useEffect(() => { fetchData(); }, [patientId]);

  // Auto-refresh every 30 s — depends on fetchData (useCallback, stable ref)
  useEffect(() => {
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // Parallax via direct DOM mutation — ZERO React re-renders from mouse movement
  useEffect(() => {
    const handleMove = e => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mousePosRef.current = {
        x: (e.clientX - rect.left - rect.width  / 2) / rect.width,
        y: (e.clientY - rect.top  - rect.height / 2) / rect.height,
      };
    };

    const animate = () => {
      const { x, y } = mousePosRef.current;
      if (leftPanelRef.current) {
        leftPanelRef.current.style.transform = `translateX(${x * -4}px) translateY(${y * -2}px)`;
      }
      if (rightPanelRef.current) {
        rightPanelRef.current.style.transform = `translateX(${x * -6}px) translateY(${y * -3}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── SINGLE SOURCE OF TRUTH: derive WHO classification once ─────────────────
  // All child components read from this result — graph, sidebar, predictor.
  const whoResult = useMemo(() => {
    if (!patient || observations.length === 0) return null;

    const admissionTime = new Date(patient.admission_time);
    const parsedObs = observations
      .map(obs => ({
        ...obs,
        hourOffset: differenceInMinutes(new Date(obs.timestamp), admissionTime) / 60,
      }))
      .sort((a, b) => a.hourOffset - b.hourOffset);

    const firstActive = parsedObs.find(
      o => o.cervical_dilation !== null && o.cervical_dilation >= 4
    );
    const timeAt4cm = firstActive ? firstActive.hourOffset : null;

    return computeWHOClassification(parsedObs, timeAt4cm);
  }, [patient, observations]);

  // ── Derived: unacknowledged backend alerts ─────────────────────────────────
  const unacknowledged = alerts.filter(a => !a.acknowledged);
  const criticalAlerts = unacknowledged.filter(a => a.severity === 'red');

  const handleAck = async (alertId) => {
    try {
      await api.post(`/api/alerts/${alertId}/acknowledge`);
      fetchData();
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #E8F4FF 0%, #F0EBFF 35%, #FFF0F6 65%, #F0FDF8 100%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '20px', margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #4A90E2 0%, #8B5CF6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 16px 40px rgba(74,144,226,0.3)' }}>
            <Loader2 style={{ width: '32px', height: '32px', color: '#fff', animation: 'spin 1s linear infinite' }} />
          </div>
          <p style={{ color: '#64748B', fontWeight: 600 }}>Loading patient data…</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #E8F4FF 0%, #F0EBFF 35%, #FFF0F6 65%, #F0FDF8 100%)',
      backgroundAttachment: 'fixed',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',        // LOCKED to viewport — no page scroll
      overflow: 'hidden',
    }}>

      {/* ── TOP BAR ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          borderBottom: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 4px 20px rgba(74,144,226,0.07)',
          padding: '0 32px', height: '64px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
        }}
      >
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/patients')} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '12px',
            border: '1px solid rgba(74,144,226,0.18)',
            background: 'rgba(74,144,226,0.07)', color: '#4A90E2',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}>
            <ArrowLeft style={{ width: '15px', height: '15px' }} />
            Patients
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '11px',
              background: 'linear-gradient(135deg, #4A90E2, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 18px rgba(74,144,226,0.3)' }}>
              <Activity style={{ width: '18px', height: '18px', color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '15px', fontWeight: 800, color: '#1E293B', lineHeight: 1 }}>
                {patient?.name || 'Labour Monitor'}
              </div>
              <div style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {patient?.patient_id} · Active Labour Monitoring
              </div>
            </div>
          </div>
        </div>

        {/* Centre: WHO status pill — derived from the single source */}
        {whoResult && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '99px',
            background: whoResult.status === 'ABNORMAL'
              ? 'rgba(220,38,38,0.08)' : whoResult.status === 'BORDERLINE'
              ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)',
            border: whoResult.status === 'ABNORMAL'
              ? '1px solid rgba(220,38,38,0.25)' : whoResult.status === 'BORDERLINE'
              ? '1px solid rgba(217,119,6,0.25)' : '1px solid rgba(22,163,74,0.25)',
          }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
              background: whoResult.status === 'ABNORMAL' ? '#EF4444'
                : whoResult.status === 'BORDERLINE' ? '#F59E0B' : '#22C55E',
              boxShadow: `0 0 8px ${whoResult.status === 'ABNORMAL' ? 'rgba(239,68,68,0.6)'
                : whoResult.status === 'BORDERLINE' ? 'rgba(245,158,11,0.5)' : 'rgba(34,197,94,0.5)'}`,
              animation: 'ai-pulse-anim 1.8s ease-in-out infinite',
            }} />
            <Heart style={{ width: '12px', height: '12px', color: whoResult.status === 'ABNORMAL' ? '#EF4444' : whoResult.status === 'BORDERLINE' ? '#F59E0B' : '#22C55E' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: whoResult.status === 'ABNORMAL' ? '#EF4444' : whoResult.status === 'BORDERLINE' ? '#F59E0B' : '#22C55E',
            }}>
              ColpAI · {whoResult.status}
            </span>
          </div>
        )}

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {unacknowledged.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Bell style={{ width: '20px', height: '20px', color: '#DC2626' }} />
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '16px', height: '16px',
                borderRadius: '50%', background: '#EF4444', color: '#fff', fontSize: '9px', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {unacknowledged.length}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#94A3B8' }}>
            <Clock style={{ width: '12px', height: '12px' }} />
            {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button onClick={fetchData} style={{ padding: '8px 14px', borderRadius: '12px',
            border: '1px solid rgba(74,144,226,0.18)',
            background: 'rgba(74,144,226,0.07)', color: '#4A90E2', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw style={{ width: '13px', height: '13px' }} />
            Refresh
          </button>
          

        </div>
      </motion.div>

      {/* ── THREE-PANEL LAYOUT ────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '260px 1fr 300px',
        gap: '16px',
        padding: '16px 24px',
        minHeight: 0,          // CRITICAL: lets flex children shrink below content size
        overflow: 'hidden',
      }}>

        {/* LEFT — Patient info + alerts from backend + WHO status from colpai */}
        <motion.div
          ref={leftPanelRef}
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          style={{
            willChange: 'transform',
            display: 'flex', flexDirection: 'column', gap: '14px',
            overflowY: 'auto', height: '100%', minHeight: 0,
          }}
        >
          {/* Pass both backend alerts AND the computed whoResult — single source */}
          <ImmersiveSidebar
            patient={patient}
            observations={observations}
            alerts={alerts}
            whoResult={whoResult}
            onAcknowledge={fetchData}
          />

          {/* AI Clinical Summary — light theme to match clinical mode */}
          {patient?.patient_id && (
            <AISummaryBox patientId={patient.patient_id} theme="light" />
          )}
        </motion.div>

        {/* CENTER — Partogram chart. Reads from observations (same array) */}
        {/* NOTE: no mousePos transform here — it fights Chart.js responsive canvas measurement */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
          style={{
            display: 'flex', flexDirection: 'column', gap: '14px',
            overflowY: 'hidden', height: '100%', minHeight: 0,
          }}
        >
          <ImmersiveGraph
            patient={patient}
            observations={observations}
            whoResult={whoResult}
            onDelete={fetchData}
          />
        </motion.div>

        {/* RIGHT — Info Split Panel */}
        <motion.div
          ref={rightPanelRef}
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
          style={{
            willChange: 'transform',
            display: 'flex', flexDirection: 'column', gap: '16px',
            height: '100%', minHeight: 0,
          }}
        >
          {/* New Observation Button */}
          <button onClick={() => setIsInputModalOpen(true)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '16px', borderRadius: '20px', width: '100%',
            background: 'linear-gradient(135deg, #4A90E2, #8B5CF6)',
            color: '#fff', fontSize: '15px', fontWeight: 800,
            border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(74,144,226,0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}>
            <Plus style={{ width: '20px', height: '20px' }} />
            Live Observation
          </button>

          {/* Top Half: Delivery Prediction */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <DeliveryPredictor patient={patient} observations={observations} />
          </div>

          {/* Bottom Half: Active Alerts */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {unacknowledged.length > 0 ? (
              <div style={{ borderRadius: '20px', padding: '16px', height: '100%', display: 'flex', flexDirection: 'column',
                background: criticalAlerts.length > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.06)',
                border: criticalAlerts.length > 0 ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(217,119,6,0.2)',
                backdropFilter: 'blur(16px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexShrink: 0 }}>
                  {criticalAlerts.length > 0
                    ? <AlertCircle   style={{ width: '16px', height: '16px', color: '#DC2626' }} />
                    : <AlertTriangle style={{ width: '16px', height: '16px', color: '#D97706' }} />}
                  <h4 style={{ fontSize: '12px', fontWeight: 800,
                    color: criticalAlerts.length > 0 ? '#DC2626' : '#D97706',
                    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    {unacknowledged.length} Active Alert{unacknowledged.length > 1 ? 's' : ''}
                  </h4>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px' }}>
                  {unacknowledged.map(alert => (
                    <div key={alert.id} style={{ padding: '10px 12px', borderRadius: '12px',
                      background: alert.severity === 'red' ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)',
                      border: alert.severity === 'red' ? '1px solid rgba(220,38,38,0.18)' : '1px solid rgba(217,119,6,0.18)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <p style={{ fontSize: '11px',
                        color: alert.severity === 'red' ? '#DC2626' : '#D97706',
                        fontWeight: 600, flex: 1, lineHeight: 1.4, margin: 0 }}>
                        {alert.message}
                      </p>
                      <button onClick={() => handleAck(alert.id)} style={{ padding: '4px 12px',
                        borderRadius: '8px', background: 'rgba(255,255,255,0.6)',
                        border: '1px solid rgba(255,255,255,0.8)',
                        fontSize: '10px', fontWeight: 700, color: '#64748B', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Ack
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ borderRadius: '20px', padding: '16px', height: '100%',
                background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)', backdropFilter: 'blur(16px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <ShieldCheck style={{ width: '16px', height: '16px', color: '#16A34A' }} />
                  <h4 style={{ fontSize: '12px', fontWeight: 800, color: '#16A34A',
                    textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    Normal Progress
                  </h4>
                </div>
                <p style={{ fontSize: '12px', color: '#4B7A5C', lineHeight: 1.6, margin: 0 }}>
                  Patient is progressing normally within WHO guidelines.
                </p>
              </div>
            )}
          </div>
        </motion.div>

      </div>

      {/* ── Modal for Live Observation ─────────────────────────────────────── */}
      <AnimatePresence>
        {isInputModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(12px)',
              zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
            }}
            onClick={() => setIsInputModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                background: '#fff', borderRadius: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
                position: 'relative', overflow: 'hidden'
              }}
            >
              <button onClick={() => setIsInputModalOpen(false)} style={{
                position: 'absolute', top: '16px', right: '16px', zIndex: 10,
                width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)',
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}>
                <X style={{ width: '16px', height: '16px', color: '#475569' }} />
              </button>
              
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <ImmersiveInput patientId={patientId} onUpdate={() => { fetchData(); setIsInputModalOpen(false); }} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ImmersiveLayout;
