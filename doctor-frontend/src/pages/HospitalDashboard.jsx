import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, Activity, Building2, CreditCard, BarChart2, LogOut,
  UserPlus, X, Loader2, CheckCircle, AlertTriangle, TrendingUp,
  RefreshCw, Bell, ChevronRight, Mail, Phone, Shield, Zap,
} from 'lucide-react';
import api from '../services/api';

// ── Design tokens ───────────────────────────────────────────────────────────
const C = {
  purple: '#7C3AED',
  blue:   '#4A90E2',
  green:  '#10B981',
  amber:  '#F59E0B',
  red:    '#EF4444',
  bg:     '#060B18',
  card:   'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.07)',
};

const CHART_COLORS = ['#7C3AED', '#4A90E2', '#10B981', '#F59E0B', '#EF4444'];

// ── Helpers ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="rounded-2xl p-6 flex flex-col justify-between"
    style={{ background: C.card, border: `1px solid ${color}20`, backdropFilter: 'blur(12px)' }}
  >
    <div className="flex items-center justify-between mb-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      {sub !== undefined && (
        <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: `${color}15`, color }}>
          {sub}
        </span>
      )}
    </div>
    <div>
      <p className="text-3xl font-black text-white mb-1">{value}</p>
      <p className="text-xs font-medium" style={{ color: '#475569' }}>{label}</p>
    </div>
  </motion.div>
);

const CreditBar = ({ used, limit, color }) => {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barColor = pct >= 90 ? C.red : pct >= 70 ? C.amber : C.green;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span style={{ color: '#64748B' }}>{used} used / {limit} total</span>
        <span style={{ color: barColor }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

// ── Invite Doctor Modal ──────────────────────────────────────────────────────
const InviteModal = ({ onClose, onDone }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      await api.post('/api/hospital/doctors/invite', { email });
      onDone();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to invite doctor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.div
        className="relative z-10 w-full max-w-md rounded-3xl p-8"
        style={{ background: '#0D1225', border: '1px solid rgba(124,58,237,0.25)' }}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-white">Invite Doctor</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        {err && <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}>{err}</div>}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-2 tracking-wider uppercase" style={{ color: C.purple }}>Doctor Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#334155' }} />
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="doctor@clinic.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
            <p className="text-xs mt-2" style={{ color: '#475569' }}>Doctor must already have an approved account.</p>
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 font-bold text-sm" style={{ color: '#475569' }}>Cancel</button>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-white flex items-center space-x-2"
              style={{ background: C.purple, boxShadow: `0 8px 24px ${C.purple}40` }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Invite</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// ── Credit Request Modal ─────────────────────────────────────────────────────
const CreditRequestModal = ({ onClose, onDone }) => {
  const [amount, setAmount]   = useState(100);
  const [reason, setReason]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [done, setDone]       = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      await api.post('/api/credits/request', { amount, reason });
      setDone(true);
      setTimeout(() => { onDone(); onClose(); }, 1800);
    } catch (e) {
      setErr(e.response?.data?.error || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
      <motion.div
        className="relative z-10 w-full max-w-md rounded-3xl p-8"
        style={{ background: '#0D1225', border: '1px solid rgba(124,58,237,0.25)' }}
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      >
        {done ? (
          <div className="text-center py-6">
            <CheckCircle className="w-14 h-14 mx-auto mb-4" style={{ color: C.green }} />
            <p className="text-xl font-black text-white mb-2">Request Submitted!</p>
            <p className="text-sm" style={{ color: '#64748B' }}>The admin will review your request shortly.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white">Request More Credits</h3>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            {err && <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5' }}>{err}</div>}
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold mb-2 tracking-wider uppercase" style={{ color: C.purple }}>Credits Requested</label>
                <input type="number" min="1" max="10000" required value={amount} onChange={e => setAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                <p className="text-xs mt-1.5" style={{ color: '#475569' }}>Each credit = 1 patient analysis</p>
              </div>
              <div>
                <label className="block text-xs font-bold mb-2 tracking-wider uppercase" style={{ color: C.purple }}>Reason (optional)</label>
                <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="Explain why you need more credits..."
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div className="flex justify-end space-x-3 pt-1">
                <button type="button" onClick={onClose} className="px-5 py-2.5 font-bold text-sm" style={{ color: '#475569' }}>Cancel</button>
                <button type="submit" disabled={loading}
                  className="px-6 py-2.5 rounded-xl font-bold text-sm text-white flex items-center space-x-2"
                  style={{ background: C.purple }}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
};

// ── Main Hospital Dashboard ──────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview',        icon: BarChart2 },
  { id: 'doctors',   label: 'Doctors',          icon: Users },
  { id: 'patients',  label: 'Patients',         icon: Activity },
  { id: 'analytics', label: 'Analytics',        icon: TrendingUp },
  { id: 'credits',   label: 'Credits',          icon: CreditCard },
];

export default function HospitalDashboard({ user, onLogout }) {
  const [tab, setTab]             = useState('overview');
  const [profile, setProfile]     = useState(null);
  const [doctors, setDoctors]     = useState([]);
  const [patients, setPatients]   = useState([]);
  const [pTotal, setPTotal]       = useState(0);
  const [analytics, setAnalytics] = useState(null);
  const [credits, setCredits]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [modal, setModal]         = useState(null); // 'invite' | 'credit_req' | null

  const fetchProfile = useCallback(async () => {
    try { const r = await api.get('/api/hospital/me'); setProfile(r.data); } catch (_) {}
  }, []);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/api/hospital/doctors'); setDoctors(r.data); } catch (_) {}
    finally { setLoading(false); }
  }, []);

  const fetchPatients = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const r = await api.get(`/api/hospital/patients?page=${page}&per_page=25`);
      setPatients(r.data.patients || []);
      setPTotal(r.data.total || 0);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/api/hospital/analytics'); setAnalytics(r.data); } catch (_) {}
    finally { setLoading(false); }
  }, []);

  const fetchCredits = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/api/hospital/credits'); setCredits(r.data); } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    if (tab === 'overview' || tab === 'analytics') fetchAnalytics();
    if (tab === 'doctors')  fetchDoctors();
    if (tab === 'patients') fetchPatients();
    if (tab === 'credits')  fetchCredits();
  }, [tab, fetchAnalytics, fetchDoctors, fetchPatients, fetchCredits]);

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout'); } catch (_) {}
    onLogout();
  };

  const info = profile || user || {};
  const creditPct = info.patient_limit ? Math.round(((info.patients_used || 0) / info.patient_limit) * 100) : 0;

  return (
    <div className="flex min-h-screen" style={{ background: C.bg }}>

      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 sticky top-0 h-screen flex flex-col p-5"
        style={{ background: 'rgba(255,255,255,0.02)', borderRight: `1px solid ${C.border}` }}>

        {/* Brand */}
        <div className="flex items-center space-x-3 mb-8 px-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #4A90E2)' }}>
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white truncate">{info.name || 'Hospital'}</p>
            <p className="text-[10px] font-bold tracking-wider" style={{ color: C.purple }}>HOSPITAL PORTAL</p>
          </div>
        </div>

        {/* Credit mini-bar */}
        <div className="mx-2 mb-6 p-3 rounded-xl" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={{ color: '#94A3B8' }}>Credits</span>
            <span className="text-xs font-black" style={{ color: C.purple }}>{info.patients_used || 0}/{info.patient_limit || 0}</span>
          </div>
          <CreditBar used={info.patients_used || 0} limit={info.patient_limit || 1} color={C.purple} />
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 text-left"
              style={{
                background: tab === t.id ? `${C.purple}18` : 'transparent',
                color: tab === t.id ? C.purple : '#475569',
                borderLeft: tab === t.id ? `2px solid ${C.purple}` : '2px solid transparent',
              }}
            >
              <t.icon className="w-4 h-4 flex-shrink-0" />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {/* User + logout */}
        <div className="pt-4 border-t mt-4" style={{ borderColor: C.border }}>
          <div className="px-2 mb-3">
            <p className="text-xs font-bold text-white truncate">{info.contact_person || info.name}</p>
            <p className="text-[10px] truncate" style={{ color: '#334155' }}>{info.email}</p>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ color: '#EF4444' }}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-black text-white mb-1">Hospital Overview</h1>
                  <p className="text-sm" style={{ color: '#475569' }}>Real-time statistics for {info.name}</p>
                </div>
                <button onClick={fetchAnalytics} className="p-2.5 rounded-xl transition-all" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <RefreshCw className="w-4 h-4" style={{ color: '#64748B' }} />
                </button>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard label="Total Doctors"    value={analytics?.total_patients !== undefined ? (doctors.length || info.doctors_count || 0) : '—'}  icon={Users}     color={C.purple} delay={0} />
                <StatCard label="Total Patients"   value={analytics?.total_patients ?? '—'}   icon={Activity}  color={C.blue}   delay={0.05} />
                <StatCard label="Total Observations" value={analytics?.total_observations ?? '—'} icon={BarChart2} color={C.green}  delay={0.1} />
                <StatCard label="Active Alerts"    value={analytics?.total_alerts ?? '—'}     icon={Bell}      color={C.amber}  delay={0.15} />
              </div>

              {/* Charts row */}
              {analytics && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  {/* Daily patients chart */}
                  <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <h3 className="text-sm font-black text-white mb-4">Patient Admissions — Last 30 Days</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={analytics.daily?.slice(-14)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#475569', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: '#0D1225', border: `1px solid ${C.purple}30`, borderRadius: 12, color: '#fff' }} />
                        <Line type="monotone" dataKey="patients" stroke={C.purple} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: C.purple }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Status pie */}
                  <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <h3 className="text-sm font-black text-white mb-4">Patient Status</h3>
                    {analytics.status_breakdown?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={analytics.status_breakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value">
                            {analytics.status_breakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#0D1225', border: `1px solid ${C.border}`, borderRadius: 8, color: '#fff' }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-40"><p className="text-sm" style={{ color: '#334155' }}>No data yet</p></div>
                    )}
                  </div>
                </div>
              )}

              {/* Per-doctor bar chart */}
              {analytics?.per_doctor?.length > 0 && (
                <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <h3 className="text-sm font-black text-white mb-4">Patients per Doctor</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analytics.per_doctor}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: '#0D1225', border: `1px solid ${C.purple}30`, borderRadius: 12, color: '#fff' }} />
                      <Bar dataKey="patients" fill={C.purple} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          )}

          {/* ── DOCTORS ── */}
          {tab === 'doctors' && (
            <motion.div key="doctors" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-black text-white mb-1">Doctor Management</h1>
                  <p className="text-sm" style={{ color: '#475569' }}>{doctors.length} registered doctor{doctors.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setModal('invite')}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{ background: C.purple, boxShadow: `0 6px 20px ${C.purple}40` }}>
                  <UserPlus className="w-4 h-4" />
                  <span>Invite Doctor</span>
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: C.purple }} /></div>
              ) : doctors.length === 0 ? (
                <div className="rounded-2xl p-16 text-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <Users className="w-12 h-12 mx-auto mb-4" style={{ color: '#1E293B' }} />
                  <p className="text-white font-bold mb-2">No doctors linked yet</p>
                  <p className="text-sm mb-6" style={{ color: '#334155' }}>Invite doctors to join your hospital account</p>
                  <button onClick={() => setModal('invite')}
                    className="px-6 py-3 rounded-xl font-bold text-sm text-white"
                    style={{ background: C.purple }}>
                    Invite First Doctor
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <table className="w-full text-left">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Doctor', 'Specialization', 'Patients', 'Credits Used', 'Status'].map(h => (
                          <th key={h} className="py-4 px-5 text-xs font-black uppercase tracking-wider" style={{ color: '#334155' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {doctors.map((d, i) => {
                        const pct = d.patient_limit ? Math.round((d.patients_used / d.patient_limit) * 100) : 0;
                        return (
                          <motion.tr key={d.id}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                            className="transition-colors" style={{ borderBottom: `1px solid ${C.border}` }}
                          >
                            <td className="py-4 px-5">
                              <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: `${C.purple}15` }}>
                                  <Shield className="w-4 h-4" style={{ color: C.purple }} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-white">{d.name}</p>
                                  <p className="text-xs" style={{ color: '#475569' }}>{d.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-5 text-sm" style={{ color: '#64748B' }}>{d.specialization || '—'}</td>
                            <td className="py-4 px-5 text-sm font-bold text-white">{d.patient_count ?? d.patients_used}</td>
                            <td className="py-4 px-5 w-36">
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span style={{ color: '#475569' }}>{d.patients_used}/{d.patient_limit}</span>
                                  <span style={{ color: pct >= 90 ? C.red : pct >= 70 ? C.amber : C.green }}>{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? C.red : pct >= 70 ? C.amber : C.green }} />
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-5">
                              <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{
                                background: d.status === 'approved' ? `${C.green}15` : `${C.amber}15`,
                                color: d.status === 'approved' ? C.green : C.amber,
                              }}>
                                {d.status}
                              </span>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ── PATIENTS ── */}
          {tab === 'patients' && (
            <motion.div key="patients" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="mb-8">
                <h1 className="text-3xl font-black text-white mb-1">All Patients</h1>
                <p className="text-sm" style={{ color: '#475569' }}>{pTotal} total across all doctors</p>
              </div>

              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: C.purple }} /></div>
              ) : (
                <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <table className="w-full text-left">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {['Patient ID', 'Age / GA', 'Status', 'Doctor', 'Admitted'].map(h => (
                          <th key={h} className="py-4 px-5 text-xs font-black uppercase tracking-wider" style={{ color: '#334155' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((p, i) => (
                        <motion.tr key={p.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                          style={{ borderBottom: `1px solid ${C.border}` }}
                        >
                          <td className="py-4 px-5 text-sm font-mono font-bold" style={{ color: C.blue }}>{p.patient_id}</td>
                          <td className="py-4 px-5 text-sm text-white">{p.age}y / {p.gestational_age}wk</td>
                          <td className="py-4 px-5">
                            <span className="text-xs font-bold px-2 py-1 rounded-lg"
                              style={{ background: p.status === 'Active' ? `${C.green}15` : `${C.amber}15`, color: p.status === 'Active' ? C.green : C.amber }}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-4 px-5 text-sm" style={{ color: '#64748B' }}>{p.doctor_name || '—'}</td>
                          <td className="py-4 px-5 text-sm" style={{ color: '#475569' }}>
                            {p.admission_time ? new Date(p.admission_time).toLocaleDateString() : '—'}
                          </td>
                        </motion.tr>
                      ))}
                      {patients.length === 0 && (
                        <tr><td colSpan={5} className="py-16 text-center text-sm" style={{ color: '#334155' }}>No patients yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ── ANALYTICS ── */}
          {tab === 'analytics' && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <h1 className="text-3xl font-black text-white mb-2">Analytics</h1>
              <p className="text-sm mb-8" style={{ color: '#475569' }}>Performance metrics across your hospital network</p>

              {loading || !analytics ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" style={{ color: C.purple }} /></div>
              ) : (
                <div className="space-y-6">
                  {/* Weekly bar chart */}
                  <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <h3 className="text-sm font-black text-white mb-5">Weekly Patient Admissions (12 weeks)</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={analytics.weekly}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="week" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: '#0D1225', border: `1px solid ${C.purple}30`, borderRadius: 12, color: '#fff' }} />
                        <Bar dataKey="patients" fill={C.purple} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Per-doctor breakdown */}
                    <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <h3 className="text-sm font-black text-white mb-4">Doctor Productivity</h3>
                      <div className="space-y-3">
                        {(analytics.per_doctor || []).map((d, i) => (
                          <div key={i}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="font-medium text-white truncate max-w-[160px]">{d.name}</span>
                              <span className="font-black" style={{ color: C.purple }}>{d.patients} pts</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                              <motion.div className="h-full rounded-full"
                                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (d.patients / Math.max(...analytics.per_doctor.map(x => x.patients), 1)) * 100)}%` }}
                                transition={{ duration: 0.7, delay: i * 0.1 }}
                              />
                            </div>
                          </div>
                        ))}
                        {(!analytics.per_doctor?.length) && <p className="text-sm" style={{ color: '#334155' }}>No doctors linked yet</p>}
                      </div>
                    </div>

                    {/* Status distribution */}
                    <div className="rounded-2xl p-6" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <h3 className="text-sm font-black text-white mb-4">Patient Status Distribution</h3>
                      {analytics.status_breakdown?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie data={analytics.status_breakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={3}>
                              {analytics.status_breakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#0D1225', border: `1px solid ${C.border}`, borderRadius: 8, color: '#fff' }} />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748B' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-40"><p className="text-sm" style={{ color: '#334155' }}>No patients yet</p></div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── CREDITS ── */}
          {tab === 'credits' && (
            <motion.div key="credits" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-black text-white mb-1">Credits & Access</h1>
                  <p className="text-sm" style={{ color: '#475569' }}>Each patient analysis consumes 1 credit</p>
                </div>
                <button onClick={() => setModal('credit_req')}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{ background: C.purple, boxShadow: `0 6px 20px ${C.purple}40` }}>
                  <Zap className="w-4 h-4" />
                  <span>Request More Credits</span>
                </button>
              </div>

              {credits && (
                <div className="space-y-6">
                  {/* Big credit card */}
                  <motion.div className="rounded-3xl p-8" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                    style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(74,144,226,0.1))', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-xs font-bold tracking-wider uppercase mb-1" style={{ color: '#7C3AED' }}>Total Credits</p>
                        <p className="text-5xl font-black text-white">{credits.remaining} <span className="text-2xl" style={{ color: '#475569' }}>remaining</span></p>
                      </div>
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)' }}>
                        <CreditCard className="w-8 h-8" style={{ color: C.purple }} />
                      </div>
                    </div>
                    <CreditBar used={credits.patients_used} limit={credits.patient_limit} color={C.purple} />
                    <div className="flex items-center justify-between mt-3 text-xs" style={{ color: '#475569' }}>
                      <span>{credits.patients_used} consumed</span>
                      <span>{credits.patient_limit} allocated</span>
                    </div>
                  </motion.div>

                  {creditPct >= 80 && (
                    <motion.div className="flex items-center space-x-3 p-4 rounded-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}25` }}>
                      <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: C.amber }} />
                      <p className="text-sm font-medium" style={{ color: '#FCD34D' }}>
                        You have used {creditPct}% of your credits. Request more to avoid interruptions.
                      </p>
                    </motion.div>
                  )}

                  {/* Request history */}
                  <div className="rounded-2xl" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    <div className="p-5 border-b" style={{ borderColor: C.border }}>
                      <h3 className="text-sm font-black text-white">Recent Credit Requests</h3>
                    </div>
                    {credits.recent_requests?.length > 0 ? (
                      <div className="divide-y" style={{ borderColor: C.border }}>
                        {credits.recent_requests.map(r => (
                          <div key={r.id} className="flex items-center justify-between p-5">
                            <div>
                              <p className="text-sm font-bold text-white">+{r.amount} credits</p>
                              <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{r.reason || 'No reason provided'}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#334155' }}>{new Date(r.created_at).toLocaleDateString()}</p>
                            </div>
                            <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{
                              background: r.status === 'approved' ? `${C.green}15` : r.status === 'rejected' ? `${C.red}15` : `${C.amber}15`,
                              color: r.status === 'approved' ? C.green : r.status === 'rejected' ? C.red : C.amber,
                            }}>
                              {r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-sm" style={{ color: '#334155' }}>No credit requests yet</div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Modals */}
      {modal === 'invite'     && <InviteModal      onClose={() => setModal(null)} onDone={fetchDoctors}  />}
      {modal === 'credit_req' && <CreditRequestModal onClose={() => setModal(null)} onDone={fetchCredits} />}
    </div>
  );
}
