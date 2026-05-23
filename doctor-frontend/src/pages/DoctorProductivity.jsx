import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Activity, Users, TrendingUp, CreditCard, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

const C = { blue: '#4A90E2', purple: '#7C3AED', green: '#10B981', amber: '#F59E0B', red: '#EF4444' };
const CHART_COLORS = ['#4A90E2', '#7C3AED', '#10B981', '#F59E0B', '#EF4444'];

function useCountUp(target, delay = 0) {
  const [val, setVal] = useState(0);
  const num = Number(target);
  useEffect(() => {
    if (isNaN(num)) { setVal(target); return; }
    setVal(0);
    let intervalId = null;
    const timeoutId = setTimeout(() => {
      const steps = 32;
      const ms = 900 / steps;
      let i = 0;
      intervalId = setInterval(() => {
        i++;
        const eased = 1 - Math.pow(1 - i / steps, 3);
        setVal(Math.round(eased * num));
        if (i >= steps) { clearInterval(intervalId); setVal(num); }
      }, ms);
    }, delay * 1000);
    return () => { clearTimeout(timeoutId); if (intervalId) clearInterval(intervalId); };
  }, [num, delay]);
  return isNaN(Number(target)) ? target : val;
}

const PeriodBtn = ({ label, active, onClick }) => (
  <button onClick={onClick}
    style={{
      padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
      border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
      background: active ? '#2563EB' : '#F3F4F6',
      color: active ? '#fff' : '#6B7280',
      boxShadow: 'none',
    }}>
    {label}
  </button>
);

const KPICard = ({ label, value, sub, icon: Icon, color, delay }) => {
  const cardInnerRef = useRef(null);
  const displayVal = useCountUp(value, delay + 0.3);

  const handleMouseMove = (e) => {
    if (!cardInnerRef.current) return;
    const rect = cardInnerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    cardInnerRef.current.style.transform = `perspective(500px) rotateY(${x * 18}deg) rotateX(${-y * 14}deg) translateZ(10px)`;
    cardInnerRef.current.style.boxShadow = `0 24px 60px ${color}28, 0 8px 24px rgba(0,0,0,0.07), 0 0 40px ${color}12`;
  };
  const handleMouseLeave = () => {
    if (!cardInnerRef.current) return;
    cardInnerRef.current.style.transform = 'perspective(500px) rotateY(0deg) rotateX(0deg) translateZ(0)';
    cardInnerRef.current.style.boxShadow = `0 4px 20px ${color}08, 0 1px 4px rgba(0,0,0,0.04)`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div
        ref={cardInnerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          borderRadius: 8, padding: 20, position: 'relative', overflow: 'hidden',
          background: '#FFFFFF',
          border: `1px solid #E5E7EB`,
          borderTop: `3px solid ${color}`,
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          transition: 'box-shadow 0.15s ease',
        }}
      >
        {/* Color top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${color}, ${color}50)`,
          borderRadius: '3px 3px 0 0',
        }} />
        {/* Background glow orb */}
        <div style={{
          position: 'absolute', bottom: -20, right: -20, width: 80, height: 80,
          background: `radial-gradient(circle, ${color}12 0%, transparent 70%)`,
          borderRadius: '50%', pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: `${color}10`, border: `1px solid ${color}22`,
            boxShadow: `0 4px 16px ${color}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon style={{ width: 19, height: 19, color }} />
          </div>
          {sub && (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 8,
              background: `${color}12`, color, border: `1px solid ${color}22`,
              letterSpacing: '0.04em', animation: 'ai-pulse-anim 2s ease-in-out infinite',
            }}>{sub}</span>
          )}
        </div>
        <p style={{
          fontSize: 28, fontWeight: 800, color: '#111827', lineHeight: 1, marginBottom: 4,
          fontFamily: 'DM Mono, monospace',
        }}>{displayVal}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.04em', fontFamily: 'Inter, system-ui, sans-serif' }}>{label}</p>
      </div>
    </motion.div>
  );
};

const CreditBar = ({ used, limit }) => {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const col  = pct >= 90 ? C.red : pct >= 70 ? C.amber : C.green;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: '#64748B' }}>{used} used / {limit} allocated</span>
        <span style={{ color: col, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 6, overflow: 'hidden', background: 'rgba(74,144,226,0.1)' }}>
        <motion.div style={{ height: '100%', borderRadius: 6, background: col }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.1, ease: 'easeOut' }} />
      </div>
    </div>
  );
};

const ChartCard = ({ title, children, delay, style = {} }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}
    style={{
      borderRadius: 8, padding: 20,
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      ...style,
    }}
  >
    {title && (
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 16, letterSpacing: '-0.01em', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {title}
      </h3>
    )}
    {children}
  </motion.div>
);

export default function DoctorProductivity({ user }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [period, setPeriod]     = useState('daily');
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqAmount, setReqAmount] = useState(50);
  const [reqReason, setReqReason] = useState('');
  const [reqState, setReqState] = useState('idle');

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/api/doctor/analytics'); setData(r.data); }
    catch (_) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const chartData = period === 'daily' ? data?.daily?.slice(-14) : data?.weekly;

  const submitCreditReq = async () => {
    setReqState('loading');
    try {
      await api.post('/api/credits/request', { amount: reqAmount, reason: reqReason });
      setReqState('done');
    } catch (_) { setReqState('error'); }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F5F7FA' }}>
      <div style={{ flexShrink: 0 }}>
        <Sidebar user={user} />
      </div>

      <main style={{ flex: 1, padding: '36px 40px', overflowY: 'auto', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>

          {/* Header */}
          <motion.div
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}
            initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <h1 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4, letterSpacing: '-0.01em' }}>
                My Productivity
              </h1>
              <p style={{ fontSize: 14, color: '#64748B' }}>Track your clinical performance and credit usage</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <motion.button
                onClick={() => setShowReqModal(true)}
                whileHover={{ scale: 1.03, boxShadow: '0 12px 36px rgba(74,144,226,0.45)' }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
                  borderRadius: 8, fontWeight: 700, fontSize: 13, color: '#fff', border: 'none',
                  cursor: 'pointer', fontFamily: 'Inter, system-ui, sans-serif',
                  background: '#2563EB',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.22)',
                }}
              >
                <Zap style={{ width: 14, height: 14 }} />
                <span>Request Credits</span>
              </motion.button>
              <motion.button
                onClick={load}
                whileHover={{ scale: 1.08, rotate: 90 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: 9, borderRadius: 8, border: '1px solid #E5E7EB',
                  background: '#FFFFFF', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}>
                <RefreshCw style={{ width: 15, height: 15, color: '#6B7280' }} />
              </motion.button>
            </div>
          </motion.div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 96, paddingBottom: 96 }}>
              <motion.div
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  border: `3px solid ${C.blue}25`, borderTopColor: C.blue,
                }}
                animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
            </div>
          ) : !data ? (
            <div style={{ textAlign: 'center', paddingTop: 80, color: '#94A3B8', fontSize: 14 }}>
              Failed to load analytics
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
                <KPICard label="Total Patients"  value={data.total_patients}      icon={Users}      color={C.blue}   delay={0}    />
                <KPICard label="Observations"    value={data.total_observations}  icon={Activity}   color={C.purple} delay={0.06} />
                <KPICard label="Credits Used"    value={data.credits_used}        icon={CreditCard} color={C.amber}  delay={0.12} />
                <KPICard label="Credits Left"    value={data.credits_remaining}   icon={Zap}        color={C.green}  delay={0.18}
                  sub={data.credits_remaining <= 5 ? 'Low!' : undefined} />
              </div>

              {/* Credit bar */}
              <ChartCard title="Credit Usage" delay={0.22} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 13, color: '#64748B' }}>
                    {data.credits_used + data.credits_remaining} total allocated
                  </span>
                </div>
                <CreditBar used={data.credits_used} limit={data.credits_used + data.credits_remaining} />
                {data.credits_remaining <= Math.max(5, Math.floor((data.credits_used + data.credits_remaining) * 0.1)) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '10px 14px',
                      borderRadius: 12, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)',
                    }}>
                    <AlertTriangle style={{ width: 14, height: 14, color: C.amber, flexShrink: 0 }} />
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#92400E' }}>
                      Credits running low — request more to continue adding patients.
                    </p>
                  </motion.div>
                )}
              </ChartCard>

              {/* Line chart */}
              <ChartCard delay={0.26} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>Patient Admissions Over Time</h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <PeriodBtn label="Daily (14d)"  active={period === 'daily'}  onClick={() => setPeriod('daily')} />
                    <PeriodBtn label="Weekly (12w)" active={period === 'weekly'} onClick={() => setPeriod('weekly')} />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={chartData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,144,226,0.07)" />
                    <XAxis dataKey={period === 'daily' ? 'date' : 'week'} tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(74,144,226,0.15)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', fontSize: 12 }} />
                    <Line type="monotone" dataKey="patients" stroke={C.blue} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: C.blue }} name="Patients" />
                    {period === 'daily' && (
                      <Line type="monotone" dataKey="observations" stroke={C.purple} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: C.purple }} name="Observations" />
                    )}
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#64748B' }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Bottom row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <ChartCard title="Patient Status Breakdown" delay={0.32}>
                  {data.status_breakdown?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={data.status_breakdown} cx="50%" cy="50%" innerRadius={52} outerRadius={74} dataKey="value" paddingAngle={3}>
                          {data.status_breakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(74,144,226,0.15)', borderRadius: 10, fontSize: 12 }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 192, color: '#CBD5E1', fontSize: 13 }}>
                      No patient data yet
                    </div>
                  )}
                </ChartCard>

                <ChartCard title="Clinical Alerts Severity" delay={0.36}>
                  {data.alert_breakdown?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.alert_breakdown} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,144,226,0.07)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: '#64748B', fontSize: 12 }} tickLine={false} axisLine={false} width={62} />
                        <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(74,144,226,0.15)', borderRadius: 10, fontSize: 12 }} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {data.alert_breakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.name?.toLowerCase().includes('red') ? C.red : C.amber} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 192, color: '#CBD5E1', fontSize: 13 }}>
                      No alerts generated yet
                    </div>
                  )}
                </ChartCard>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Credit Request Modal */}
      {showReqModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <motion.div
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)' }}
            onClick={() => { setShowReqModal(false); setReqState('idle'); }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          />
          <motion.div
            style={{
              position: 'relative', zIndex: 10, width: '100%', maxWidth: 420, borderRadius: 28, padding: 36,
              background: 'rgba(255,255,255,0.96)',
              backdropFilter: 'blur(30px)',
              border: '1px solid rgba(74,144,226,0.2)',
              boxShadow: '0 40px 100px rgba(74,144,226,0.15), 0 10px 40px rgba(0,0,0,0.1)',
            }}
            initial={{ opacity: 0, scale: 0.93, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            {reqState === 'done' ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 18, background: 'rgba(16,185,129,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}>
                  <TrendingUp style={{ width: 28, height: 28, color: C.green }} />
                </div>
                <h3 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                  Request Submitted!
                </h3>
                <p style={{ fontSize: 14, color: '#64748B' }}>Admin will review your request shortly.</p>
                <button
                  onClick={() => { setShowReqModal(false); setReqState('idle'); load(); }}
                  style={{
                    marginTop: 24, padding: '12px 32px', borderRadius: 12, fontWeight: 800,
                    fontSize: 14, color: '#fff', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #4A90E2, #7C3AED)',
                    boxShadow: '0 6px 22px rgba(74,144,226,0.35)',
                  }}>Done</button>
              </div>
            ) : (
              <>
                <h3 style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20 }}>
                  Request More Credits
                </h3>
                {reqState === 'error' && (
                  <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                    Request failed. Please try again.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 800, marginBottom: 8, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.blue }}>
                      Credits Needed
                    </label>
                    <input type="number" min="1" max="10000" value={reqAmount} onChange={e => setReqAmount(Number(e.target.value))}
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14, outline: 'none', background: 'rgba(74,144,226,0.05)', border: '1px solid rgba(74,144,226,0.18)', color: '#1E293B', fontFamily: 'Roboto,sans-serif' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 800, marginBottom: 8, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.blue }}>
                      Reason
                    </label>
                    <textarea rows={3} value={reqReason} onChange={e => setReqReason(e.target.value)}
                      placeholder="e.g., High volume month expected..."
                      style={{ width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14, outline: 'none', resize: 'none', background: 'rgba(74,144,226,0.05)', border: '1px solid rgba(74,144,226,0.18)', color: '#1E293B', fontFamily: 'Roboto,sans-serif' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                    <button onClick={() => setShowReqModal(false)} style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={submitCreditReq} disabled={reqState === 'loading'}
                      style={{
                        padding: '10px 22px', borderRadius: 10, fontWeight: 800, fontSize: 13, color: '#fff',
                        border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        background: 'linear-gradient(135deg, #4A90E2, #7C3AED)',
                        opacity: reqState === 'loading' ? 0.7 : 1,
                        boxShadow: '0 4px 16px rgba(74,144,226,0.35)',
                      }}>
                      {reqState === 'loading' ? (
                        <motion.div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }}
                          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity }} />
                      ) : <Zap style={{ width: 13, height: 13 }} />}
                      <span>Submit Request</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
