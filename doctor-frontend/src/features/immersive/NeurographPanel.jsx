/**
 * NeurographPanel.jsx
 *
 * Dark-mode replacement for ImmersiveGraph.
 * Features:
 *   • Glowing neon Chart.js partogram
 *   • Graph / Observations toggle (same as before but restyled)
 *   • Floating stat strip with glow badges
 *   • Animated WHO line drawing via borderDash animation
 */
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Tooltip, Filler, Legend,
} from 'chart.js';
import { differenceInMinutes } from 'date-fns';
import { TrendingUp, Activity, Clock, Trash2, BarChart2, List, Zap } from 'lucide-react';
import api from '../../services/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend);

// ── Glass card style ──────────────────────────────────────────────────────────
const glassCard = {
  background: 'rgba(15,23,42,0.55)',
  backdropFilter: 'blur(24px)',
  border: '1px solid rgba(79,209,197,0.18)',
  borderRadius: '20px',
  boxShadow: '0 0 30px rgba(79,209,197,0.06), inset 0 1px 0 rgba(255,255,255,0.06)',
};

export default function NeurographPanel({ patient, observations, whoResult, onDelete }) {
  const [deletingId, setDeletingId] = useState(null);
  const [activeView, setActiveView] = useState('graph');

  // ── Chart data ────────────────────────────────────────────────────────────
  const { chartData, latestDilation, laborPhase } = useMemo(() => {
    if (!patient || !observations?.length)
      return { chartData: null, latestDilation: null, laborPhase: 'Latent' };

    const admissionTime = new Date(patient.admission_time);
    const sorted = [...observations].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const dataPoints = sorted
      .map(obs => ({
        x: Math.round(differenceInMinutes(new Date(obs.timestamp), admissionTime) / 60 * 10) / 10,
        // Guard null: Math.min(10, null) = 0 which is wrong — keep null to filter out
        y: obs.cervical_dilation != null ? Math.min(10, obs.cervical_dilation) : null,
      }))
      .filter(p => p.y !== null && p.y !== undefined && !isNaN(p.y));

    const activeStart = dataPoints.find(p => p.y >= 4);
    const alertLine = [], actionLine = [];
    if (activeStart) {
      for (let h = 0; h <= 6; h += 0.5) {
        const y = Math.min(10, 4 + h);
        alertLine.push({ x: +(activeStart.x + h).toFixed(2), y });
        actionLine.push({ x: +(activeStart.x + 4 + h).toFixed(2), y });
        if (y >= 10) break;
      }
    }

    const latest = dataPoints[dataPoints.length - 1];
    const phase  = latest?.y >= 10 ? 'Transitional' : latest?.y >= 4 ? 'Active' : 'Latent';

    return {
      chartData: {
        datasets: [
          {
            label: 'Cervical Dilation',
            data: dataPoints,
            borderColor: '#4FD1C5',
            backgroundColor: ctx => {
              const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
              g.addColorStop(0, 'rgba(79,209,197,0.25)');
              g.addColorStop(1, 'rgba(79,209,197,0.00)');
              return g;
            },
            pointBackgroundColor: '#0F172A',
            pointBorderColor: '#4FD1C5',
            pointBorderWidth: 2.5,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointHoverBackgroundColor: '#4FD1C5',
            tension: 0.45,
            fill: true,
            borderWidth: 3,
          },
          {
            label: 'Alert Line',
            data: alertLine,
            borderColor: 'rgba(251,191,36,0.7)',
            borderDash: [7, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          },
          {
            label: 'Action Line',
            data: actionLine,
            borderColor: 'rgba(239,68,68,0.65)',
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
    animation: false, // Disable — avoids re-animate on every parent state update
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.92)',
        titleColor: '#4FD1C5',
        bodyColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(79,209,197,0.3)',
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
        title: { display: true, text: 'Hours from Admission', color: 'rgba(255,255,255,0.35)',
          font: { size: 10, weight: '600' } },
        grid: { color: 'rgba(79,209,197,0.06)' },
        ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 10 }, stepSize: 1 },
        border: { display: false },
      },
      y: {
        min: 0, max: 10,
        title: { display: true, text: 'Dilation (cm)', color: 'rgba(255,255,255,0.35)',
          font: { size: 10, weight: '600' } },
        grid: { color: 'rgba(79,209,197,0.06)' },
        ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 10 }, stepSize: 1 },
        border: { display: false },
      },
    },
  }), []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this observation?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/observation/${id}`);
      onDelete?.();
    } catch (e) { console.error(e); }
    finally { setDeletingId(null); }
  };

  // ── Stat data ─────────────────────────────────────────────────────────────
  const stats = [
    { label:'Dilation', value: latestDilation ? `${latestDilation} cm` : '—', color:'#4FD1C5', Icon: TrendingUp },
    { label:'Phase',    value: laborPhase,                                     color:'#B794F4', Icon: Activity   },
    { label:'Entries',  value: observations?.length ?? 0,                      color:'#F472B6', Icon: Clock      },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'10px', height:'100%', minHeight:0 }}>

      {/* ── Stat strip ───────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:'10px', flexShrink:0 }}>
        {stats.map(({ label, value, color, Icon }) => (
          <motion.div key={label} whileHover={{ y:-2, boxShadow:`0 0 20px ${color}40` }}
            transition={{ duration:0.2 }}
            style={{ flex:1, padding:'10px 14px', borderRadius:'14px', ...glassCard,
              display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'9px', flexShrink:0,
              background:`${color}18`, border:`1px solid ${color}30`,
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:`0 0 10px ${color}30` }}>
              <Icon style={{ width:'13px', height:'13px', color }} />
            </div>
            <div>
              <p style={{ fontSize:'8px', fontWeight:700, color:'rgba(255,255,255,0.35)',
                textTransform:'uppercase', letterSpacing:'0.1em', margin:'0 0 1px' }}>{label}</p>
              <p style={{ fontSize:'15px', fontWeight:800, color:'#fff', lineHeight:1,
                fontFamily:'Poppins,sans-serif', margin:0 }}>{value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Chart card ───────────────────────────────────────────────────── */}
      <motion.div
        style={{ flex:1, minHeight:0, ...glassCard, padding:'14px 18px 12px',
          display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px',
          marginBottom:'10px', flexShrink:0 }}>

          {/* Title + WHO badge */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <Zap style={{ width:'14px', height:'14px', color:'#4FD1C5' }} />
            <h3 style={{ fontSize:'13px', fontWeight:800, color:'#fff', margin:0,
              fontFamily:'Poppins,sans-serif', whiteSpace:'nowrap' }}>
              WHO Partogram
            </h3>
          </div>

          {/* Toggle pill */}
          <div style={{ display:'flex', gap:'2px', padding:'3px', borderRadius:'12px',
            background:'rgba(79,209,197,0.06)', border:'1px solid rgba(79,209,197,0.18)' }}>
            {[
              { key:'graph',        label:'Graph',        Icon:BarChart2 },
              { key:'observations', label:'Observations', Icon:List      },
            ].map(({ key, label, Icon }) => {
              const active = activeView === key;
              return (
                <button key={key} id={`neuro-toggle-${key}`} onClick={() => setActiveView(key)}
                  style={{ display:'flex', alignItems:'center', gap:'5px',
                    padding:'5px 12px', borderRadius:'9px', border:'none', cursor:'pointer',
                    transition:'all 0.22s ease', fontFamily:'Poppins,sans-serif',
                    fontSize:'11px', fontWeight:700,
                    background: active ? 'rgba(79,209,197,0.18)' : 'transparent',
                    color: active ? '#4FD1C5' : 'rgba(255,255,255,0.3)',
                    boxShadow: active ? `0 0 12px rgba(79,209,197,0.25)` : 'none' }}>
                  <Icon style={{ width:'12px', height:'12px' }} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Legend — graph only */}
          {activeView === 'graph' && (
            <div style={{ display:'flex', gap:'12px', marginLeft:'auto' }}>
              {[{color:'rgba(251,191,36,0.85)', label:'Alert'},{color:'rgba(239,68,68,0.75)', label:'Action'}].map(({ color, label }) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                  <div style={{ width:'14px', height:'2px', background:color, borderRadius:'2px' }} />
                  <span style={{ fontSize:'10px', fontWeight:600, color:'rgba(255,255,255,0.35)' }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Body — use flex+minHeight:0 with an absolute inner div so Chart.js
             can reliably measure canvas height in a flex container */}
        <div style={{ flex:1, minHeight:0, position:'relative' }}>

          {/* GRAPH */}
          {activeView === 'graph' && (
            <motion.div key="graph" initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }}
              transition={{ duration:0.2 }}
              style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column' }}>
              {chartData
                ? <Line data={chartData} options={chartOptions} style={{ flex:1 }} />
                : <EmptyState icon={Activity} msg="No observations yet" sub="Add data using the input panel →" />}
            </motion.div>
          )}

          {/* OBSERVATIONS LIST */}
          {activeView === 'observations' && (
            <motion.div key="obs" initial={{ opacity:0, x:10 }} animate={{ opacity:1, x:0 }}
              transition={{ duration:0.2 }}
              style={{ height:'100%', overflowY:'auto', display:'flex', flexDirection:'column', gap:'6px' }}>
              {observations?.length > 0 ? [...observations].reverse().map((obs, i) => (
                <motion.div key={obs.id || i}
                  initial={{ opacity:0, y:5 }} animate={{ opacity:1, y:0 }}
                  transition={{ delay:i*0.03 }}
                  style={{ display:'flex', alignItems:'flex-start', gap:'12px',
                    padding:'10px 14px', borderRadius:'13px',
                    background:'rgba(79,209,197,0.04)', border:'1px solid rgba(79,209,197,0.14)',
                    flexShrink:0 }}>
                  {/* Time */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
                    gap:'2px', flexShrink:0, width:'40px' }}>
                    <Clock style={{ width:'11px', height:'11px', color:'rgba(255,255,255,0.3)' }} />
                    <span style={{ fontSize:'10px', fontWeight:700, color:'#4FD1C5',
                      textAlign:'center', lineHeight:1.25 }}>
                      {new Date(obs.timestamp).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </div>
                  {/* Vitals */}
                  <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'5px' }}>
                    {[
                      { label:'Dilation', value: obs.cervical_dilation != null ? `${obs.cervical_dilation} cm` : null, color:'#4FD1C5' },
                      { label:'FHR',      value: obs.fetal_heart_rate  != null ? `${obs.fetal_heart_rate} bpm` : null, color:'#F472B6' },
                      { label:'Cx',       value: obs.contraction_freq  != null ? `${obs.contraction_freq}/10m` : null, color:'#F59E0B' },
                      { label:'BP',       value: obs.bp_systolic       != null ? `${obs.bp_systolic}/${obs.bp_diastolic}` : null, color:'#B794F4' },
                      { label:'Pulse',    value: obs.maternal_pulse    != null ? `${obs.maternal_pulse} bpm`   : null, color:'#4ADE80' },
                      { label:'Temp',     value: obs.temperature       != null ? `${obs.temperature} °C`       : null, color:'#EF4444' },
                    ].filter(v => v.value !== null).map(({ label, value, color }) => (
                      <div key={label} style={{ padding:'5px 8px', borderRadius:'9px',
                        background:`${color}0A`, border:`1px solid ${color}22` }}>
                        <div style={{ fontSize:'8px', fontWeight:700, color:'rgba(255,255,255,0.3)',
                          textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'2px' }}>
                          {label}
                        </div>
                        <div style={{ fontSize:'12px', fontWeight:800, color:'#fff', lineHeight:1 }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Delete */}
                  <button onClick={() => handleDelete(obs.id)} disabled={deletingId === obs.id}
                    style={{ padding:'4px 6px', borderRadius:'8px', border:'1px solid transparent',
                      background:'transparent', color:'rgba(239,68,68,0.35)', cursor:'pointer',
                      opacity: deletingId === obs.id ? 0.4 : 1, alignSelf:'center',
                      transition:'all 0.2s ease' }}
                    onMouseOver={e => { e.currentTarget.style.background='rgba(239,68,68,0.12)'; e.currentTarget.style.color='#EF4444'; e.currentTarget.style.borderColor='rgba(239,68,68,0.25)'; }}
                    onMouseOut={e  => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(239,68,68,0.35)'; e.currentTarget.style.borderColor='transparent'; }}>
                    <Trash2 style={{ width:'12px', height:'12px' }} />
                  </button>
                </motion.div>
              )) : <EmptyState icon={List} msg="No observations yet" />}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function EmptyState({ icon: Icon, msg, sub }) {
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:'10px' }}>
      <div style={{ width:'46px', height:'46px', borderRadius:'14px',
        background:'rgba(79,209,197,0.08)', border:'1px solid rgba(79,209,197,0.15)',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Icon style={{ width:'22px', height:'22px', color:'rgba(79,209,197,0.4)' }} />
      </div>
      <p style={{ color:'rgba(255,255,255,0.35)', fontSize:'13px', fontWeight:500, margin:0 }}>{msg}</p>
      {sub && <p style={{ color:'rgba(255,255,255,0.2)', fontSize:'11px', margin:0 }}>{sub}</p>}
    </div>
  );
}
