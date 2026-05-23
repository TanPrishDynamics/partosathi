import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Filler, Legend,
} from 'chart.js';
import { differenceInMinutes } from 'date-fns';
import { TrendingUp, Activity, Clock, Trash2, BarChart2, List } from 'lucide-react';
import api from '../../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler, Legend);

const ImmersiveGraph = ({ patient, observations, whoResult, onDelete }) => {
  const [deletingId, setDeletingId] = useState(null);
  const [activeView, setActiveView] = useState('graph'); // 'graph' | 'observations'

  const { chartData, latestDilation, laborPhase } = useMemo(() => {
    if (!patient || !observations || observations.length === 0)
      return { chartData: null, latestDilation: null, laborPhase: 'Latent' };

    const admissionTime = new Date(patient.admission_time);
    const sorted = [...observations].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const dataPoints = sorted
      .map(obs => ({
        x: Math.round(differenceInMinutes(new Date(obs.timestamp), admissionTime) / 60 * 10) / 10,
        // Guard null: must check before passing to Math.min, otherwise null → 0
        y: obs.cervical_dilation != null ? Math.min(10, obs.cervical_dilation) : null,
      }))
      .filter(p => p.y !== null && p.y !== undefined && !isNaN(p.y));

    const activeStart = dataPoints.find(p => p.y >= 4);
    const alertLine = [], actionLine = [];
    if (activeStart) {
      for (let hrs = 0; hrs <= 6; hrs += 0.5) {
        const y = Math.min(10, 4 + hrs);
        alertLine.push({ x: +(activeStart.x + hrs).toFixed(2), y: +y.toFixed(2) });
        actionLine.push({ x: +(activeStart.x + 4 + hrs).toFixed(2), y: +y.toFixed(2) });
        if (y >= 10) break;
      }
    }

    const latest = dataPoints[dataPoints.length - 1];
    const phase = latest?.y >= 10 ? 'Transitional' : latest?.y >= 4 ? 'Active' : 'Latent';

    return {
      chartData: {
        datasets: [
          {
            label: 'Cervical Dilation',
            data: dataPoints,
            borderColor: '#4A90E2',
            backgroundColor: ctx => {
              const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
              gradient.addColorStop(0, 'rgba(74,144,226,0.18)');
              gradient.addColorStop(1, 'rgba(74,144,226,0.00)');
              return gradient;
            },
            pointBackgroundColor: '#fff',
            pointBorderColor: '#4A90E2',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: '#4A90E2',
            tension: 0.45,
            fill: true,
            borderWidth: 2.5,
          },
          {
            label: 'Alert Line',
            data: alertLine,
            borderColor: 'rgba(251,191,36,0.75)',
            borderDash: [7, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Action Line',
            data: actionLine,
            borderColor: 'rgba(239,68,68,0.7)',
            borderDash: [7, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      latestDilation: latest?.y,
      laborPhase: phase,
    };
  }, [patient, observations]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,    // Disable — chart animates on every parent state change otherwise
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(255,255,255,0.96)',
        titleColor: '#1E293B',
        bodyColor: '#64748B',
        borderColor: 'rgba(74,144,226,0.2)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} cm`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: 'Hours from Admission', font: { size: 10, weight: '600', family: 'Inter, sans-serif' }, color: '#94A3B8' },
        grid: { color: 'rgba(74,144,226,0.05)' },
        ticks: { stepSize: 1, color: '#94A3B8', font: { size: 10 } },
        border: { display: false },
      },
      y: {
        min: 0, max: 10,
        title: { display: true, text: 'Dilation (cm)', font: { size: 10, weight: '600', family: 'Inter, sans-serif' }, color: '#94A3B8' },
        grid: { color: 'rgba(74,144,226,0.06)' },
        ticks: { stepSize: 1, color: '#94A3B8', font: { size: 10 } },
        border: { display: false },
      },
    },
  }), []);

  const handleDelete = async (obsId) => {
    if (!window.confirm('Delete this observation?')) return;
    setDeletingId(obsId);
    try {
      await api.delete(`/api/observation/${obsId}`);
      onDelete?.();
    } catch (e) { console.error(e); }
    finally { setDeletingId(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', minHeight: 0 }}>

      {/* ── Compact stat strip ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
        {[
          { label: 'Dilation', value: latestDilation ? `${latestDilation} cm` : '—', icon: TrendingUp, color: '#4A90E2', bg: 'rgba(74,144,226,0.08)' },
          { label: 'Phase',    value: laborPhase,                                     icon: Activity,   color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
          { label: 'Entries',  value: observations?.length || 0,                      icon: Clock,      color: '#16A34A', bg: 'rgba(22,163,74,0.08)'  },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <motion.div key={label} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}
            style={{ flex: 1, padding: '9px 13px', borderRadius: '14px',
              background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.82)',
              boxShadow: '0 3px 10px rgba(74,144,226,0.06)',
              display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '9px', background: bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon style={{ width: '13px', height: '13px', color }} />
            </div>
            <div>
              <p style={{ fontSize: '8px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 1px' }}>{label}</p>
              <p style={{ fontSize: '15px', fontWeight: 800, color: '#1E293B', lineHeight: 1, fontFamily: 'Poppins, sans-serif', margin: 0 }}>{value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Main card — fills all remaining vertical space ───────────────────── */}
      <motion.div
        whileHover={{ boxShadow: '0 18px 48px rgba(74,144,226,0.12)' }}
        transition={{ duration: 0.35 }}
        style={{
          flex: 1, minHeight: 0,
          padding: '14px 18px 12px',
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.88)',
          boxShadow: '0 8px 28px rgba(74,144,226,0.07), inset 0 1px 0 rgba(255,255,255,0.95)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Card header: title · toggle · legend ──────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px',
          marginBottom: '10px', flexShrink: 0 }}>

          {/* Title */}
          <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '13px', fontWeight: 800,
            color: '#1E293B', margin: 0, whiteSpace: 'nowrap' }}>
            WHO Partogram
          </h3>

          {/* ── Segmented toggle pill ─────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px',
            padding: '3px', borderRadius: '12px',
            background: 'rgba(74,144,226,0.07)',
            border: '1px solid rgba(74,144,226,0.12)' }}>
            {[
              { key: 'graph',        label: 'Graph',        Icon: BarChart2 },
              { key: 'observations', label: 'Observations', Icon: List      },
            ].map(({ key, label, Icon }) => {
              const active = activeView === key;
              return (
                <button
                  key={key}
                  id={`view-toggle-${key}`}
                  onClick={() => setActiveView(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '5px 12px', borderRadius: '9px', border: 'none',
                    cursor: 'pointer', transition: 'all 0.22s ease',
                    fontFamily: 'Poppins, sans-serif', fontSize: '11px', fontWeight: 700,
                    background: active ? 'rgba(255,255,255,0.95)' : 'transparent',
                    color: active ? '#4A90E2' : '#94A3B8',
                    boxShadow: active ? '0 2px 8px rgba(74,144,226,0.14)' : 'none',
                  }}
                >
                  <Icon style={{ width: '12px', height: '12px' }} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Line legend — only shown in graph view */}
          {activeView === 'graph' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px',
              marginLeft: 'auto', flexShrink: 0 }}>
              {[
                { color: 'rgba(251,191,36,0.85)', label: 'Alert' },
                { color: 'rgba(239,68,68,0.75)',  label: 'Action' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '14px', height: '2px', background: color, borderRadius: '2px' }} />
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8' }}>{label} Line</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── View body — position:relative parent + absolute child for Chart.js ─── */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>

          {/* GRAPH VIEW */}
          {activeView === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
            >
              {chartData
                ? <Line data={chartData} options={chartOptions} style={{ flex: 1 }} />
                : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '14px',
                      background: 'rgba(74,144,226,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Activity style={{ width: '22px', height: '22px', color: 'rgba(74,144,226,0.4)' }} />
                    </div>
                    <p style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 500, margin: 0 }}>
                      No observations recorded yet
                    </p>
                    <p style={{ color: '#CBD5E1', fontSize: '11px', margin: 0 }}>
                      Use the input panel on the right →
                    </p>
                  </div>
                )}
            </motion.div>
          )}

          {/* OBSERVATIONS VIEW */}
          {activeView === 'observations' && (
            <motion.div
              key="observations"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ height: '100%', overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: '6px' }}
            >
              {observations?.length > 0 ? [...observations].reverse().map((obs, i) => (
                <motion.div
                  key={obs.id || i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.18 }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '10px 14px', borderRadius: '13px',
                    background: 'rgba(255,255,255,0.60)',
                    border: '1px solid rgba(255,255,255,0.82)',
                    boxShadow: '0 2px 8px rgba(74,144,226,0.04)',
                    flexShrink: 0 }}
                >
                  {/* Timestamp column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: '2px', flexShrink: 0, width: '40px' }}>
                    <Clock style={{ width: '11px', height: '11px', color: '#94A3B8' }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#4A90E2',
                      textAlign: 'center', lineHeight: 1.25 }}>
                      {new Date(obs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Vitals grid — only renders fields that have values */}
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                    {[
                      { label: 'Dilation', value: obs.cervical_dilation != null ? `${obs.cervical_dilation} cm`             : null, color: '#4A90E2' },
                      { label: 'FHR',      value: obs.fetal_heart_rate  != null ? `${obs.fetal_heart_rate} bpm`             : null, color: '#F472B6' },
                      { label: 'Cx',       value: obs.contraction_freq  != null ? `${obs.contraction_freq}/10m`             : null, color: '#F59E0B' },
                      { label: 'BP',       value: obs.bp_systolic       != null ? `${obs.bp_systolic}/${obs.bp_diastolic}`  : null, color: '#8B5CF6' },
                      { label: 'Pulse',    value: obs.maternal_pulse    != null ? `${obs.maternal_pulse} bpm`               : null, color: '#10B981' },
                      { label: 'Temp',     value: obs.temperature       != null ? `${obs.temperature} °C`                  : null, color: '#EF4444' },
                    ].filter(v => v.value !== null).map(({ label, value, color }) => (
                      <div key={label} style={{ padding: '5px 8px', borderRadius: '9px',
                        background: `${color}0A`, border: `1px solid ${color}1C` }}>
                        <div style={{ fontSize: '8px', fontWeight: 700, color: '#94A3B8',
                          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                          {label}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#1E293B', lineHeight: 1 }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(obs.id)}
                    disabled={deletingId === obs.id}
                    style={{ padding: '4px 6px', borderRadius: '8px', border: '1px solid transparent',
                      background: 'transparent', color: 'rgba(220,38,38,0.28)', cursor: 'pointer',
                      opacity: deletingId === obs.id ? 0.4 : 1, transition: 'all 0.2s ease',
                      flexShrink: 0, alignSelf: 'center' }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.07)'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.18)'; }}
                    onMouseOut={e  => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(220,38,38,0.28)'; e.currentTarget.style.borderColor = 'transparent'; }}
                  >
                    <Trash2 style={{ width: '12px', height: '12px' }} />
                  </button>
                </motion.div>
              )) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '14px',
                    background: 'rgba(74,144,226,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <List style={{ width: '22px', height: '22px', color: 'rgba(74,144,226,0.35)' }} />
                  </div>
                  <p style={{ color: '#94A3B8', fontSize: '13px', fontWeight: 500, margin: 0 }}>
                    No observations recorded yet
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ImmersiveGraph;
