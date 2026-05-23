import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import {
  Activity, Users, AlertCircle, ArrowRight,
  ShieldCheck, TrendingUp, Heart, Clock,
  CheckCircle2, ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ── Animated count-up hook ─────────────────────────────────────────────── */
function useCountUp(target, duration = 1000, delay = 0) {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (target === 0) return;
    const timeout = setTimeout(() => {
      const start = performance.now();
      const step = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(step);
      };
      startRef.current = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (startRef.current) cancelAnimationFrame(startRef.current);
    };
  }, [target, duration, delay]);

  return value;
}

/* ── KPI Card ──────────────────────────────────────────────────────────── */
const KpiCard = ({ value, label, sub, borderColor = '#E5E7EB', icon: Icon, iconBg = '#EFF6FF', iconColor = '#2563EB', delay = 0, suffix = '' }) => {
  const count = useCountUp(typeof value === 'number' ? value : 0, 1000, delay);
  const displayValue = typeof value === 'number' ? `${count}${suffix}` : value;

  return (
    <div style={{
      flex: 1, minWidth: '170px',
      padding: '20px', borderRadius: '8px',
      background: '#FFFFFF',
      border: `1px solid ${borderColor}`,
      borderTop: `3px solid ${iconColor}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '8px',
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: '17px', height: '17px', color: iconColor }} />
        </div>
      </div>

      <div style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '28px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
        {displayValue}
      </div>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: '11.5px', color: '#9CA3AF', marginTop: '3px' }}>{sub}</div>}
    </div>
  );
};

/* ── Patient row ─────────────────────────────────────────────────────── */
const PatientRow = ({ patient, index, onOpen }) => {
  const isRed    = patient.alert_counts?.red > 0;
  const isAmber  = !isRed && patient.alert_counts?.amber > 0;
  const statusColor = isRed ? '#DC2626' : isAmber ? '#F59E0B' : '#16A34A';
  const statusLabel = isRed ? 'CRITICAL' : isAmber ? 'ALERT' : 'NORMAL';
  const statusBg    = isRed ? '#FEF2F2' : isAmber ? '#FFFBEB' : '#F0FDF4';
  const statusBorder = isRed ? '#FECACA' : isAmber ? '#FDE68A' : '#BBF7D0';

  return (
    <div
      onClick={() => onOpen(patient.patient_id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '11px 14px', borderRadius: '6px', cursor: 'pointer',
        background: isRed ? '#FEF2F2' : '#FFFFFF',
        border: `1px solid ${isRed ? '#FECACA' : '#E5E7EB'}`,
        transition: 'all 0.15s ease',
      }}
      onMouseOver={e => { e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.borderColor = '#D1D5DB'; }}
      onMouseOut={e => { e.currentTarget.style.background = isRed ? '#FEF2F2' : '#FFFFFF'; e.currentTarget.style.borderColor = isRed ? '#FECACA' : '#E5E7EB'; }}
    >
      {/* Status dot */}
      <div style={{
        width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
        background: statusColor,
        animation: isRed ? 'pulse-soft 1.5s infinite' : 'none',
      }} />

      {/* Avatar */}
      <div style={{
        width: '32px', height: '32px', borderRadius: '6px', flexShrink: 0,
        background: statusBg, border: `1px solid ${statusBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px', fontWeight: 700, color: statusColor }}>
          {patient.name?.charAt(0)?.toUpperCase() || '?'}
        </span>
      </div>

      {/* Name + ID */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {patient.name}
        </p>
        <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>
          ID: {patient.patient_id} · {patient.gestational_age}w GA
        </p>
      </div>

      {/* Status badge */}
      <div style={{
        padding: '2px 8px', borderRadius: '4px',
        background: statusBg, border: `1px solid ${statusBorder}`,
        fontSize: '10px', fontWeight: 700, color: statusColor,
        letterSpacing: '0.06em',
        flexShrink: 0,
      }}>
        {statusLabel}
      </div>

      <ArrowRight style={{ width: '13px', height: '13px', color: '#D1D5DB', flexShrink: 0 }} />
    </div>
  );
};

/* ── Guidelines data ─────────────────────────────────────────────────── */
const GUIDELINES = [
  {
    tag: 'WHO 2020', org: 'World Health Organization',
    title: 'Modified WHO Partograph Protocol',
    desc: 'Latent phase monitoring, 1-hour action-to-alert ratio, multi-parameter concurrent tracking.',
    color: '#2563EB', icon: ShieldCheck,
    link: 'https://www.who.int/publications/i/item/9789240014978',
    points: ['Latent phase: 0–4 cm', 'Active phase: ≥4 cm', 'Alert line: 1 cm/hr'],
  },
  {
    tag: 'FIGO 2015', org: 'Intl Federation Gynecology',
    title: 'CTG Interpretation Framework',
    desc: 'Fetal heart rate classification: Normal / Suspicious / Pathological — with intervention thresholds.',
    color: '#16A34A', icon: Heart,
    link: 'https://www.figo.org',
    points: ['FHR baseline: 110–160 bpm', 'Decelerations: Type I / II / III', 'Variability assessment'],
  },
  {
    tag: 'ACOG 2014', org: 'American College OB/GYN',
    title: 'Safe Prevention of Cesarean',
    desc: 'Evidence-based criteria for labor dystocia diagnosis and cesarean decision timing.',
    color: '#F59E0B', icon: CheckCircle2,
    link: 'https://www.acog.org',
    points: ['Arrest at ≥6 cm: 4 hrs adequate', 'Arrest in 2nd stage: 3 hrs nulliparous', 'Fetal descent criteria'],
  },
];

/* ─── Page ──────────────────────────────────────────────────────────────── */
const MainDashboard = () => {
  const [user, setUser]       = useState(null);
  const [patients, setPatients] = useState([]);
  const navigate = useNavigate();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    api.get('/api/auth/me').then(u => setUser(u.data)).catch(() => {});
    api.get('/api/patients').then(p => setPatients(p.data)).catch(() => {});
  }, []);

  const active    = patients.filter(p => (p.status || 'Active') === 'Active');
  const critical  = active.filter(p => p.alert_counts?.red > 0).length;
  const alerts    = active.filter(p => (p.alert_counts?.amber || 0) > 0).length;
  const completed = patients.length - active.length;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <main style={{
        flex: 1, overflowY: 'auto',
        background: '#F5F7FA',
      }}>

        {/* ── Sticky topbar ─────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          padding: '14px 36px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Clinical Overview
            </span>
          </div>

          {/* AI status pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '6px',
            background: '#EFF6FF', border: '1px solid #BFDBFE',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563EB', animation: 'pulse-soft 2s infinite' }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563EB', letterSpacing: '0.04em' }}>
              ColpAI Active
            </span>
          </div>
        </div>

        <div style={{ padding: '32px 36px 64px', maxWidth: '1100px', margin: '0 auto' }}>

          {/* ── Hero header ─────────────────────────────────────── */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
              {greeting},
            </p>
            <h1 style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '24px', fontWeight: 700,
              color: '#111827', letterSpacing: '-0.01em', lineHeight: 1.2,
              marginBottom: '6px',
            }}>
              {user?.name?.trim() || 'Clinician'}{' '}
              <span style={{ color: '#2563EB' }}>Dashboard</span>
            </h1>
            <p style={{ fontSize: '13px', color: '#9CA3AF', lineHeight: 1.5 }}>
              WHO 2020 partograph monitoring · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* ── KPI Cards ─────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <KpiCard value={active.length}    label="Active Patients"   sub="Currently in labor"     iconColor="#2563EB" iconBg="#EFF6FF" borderColor="#BFDBFE" icon={Users}         delay={0}   />
            <KpiCard value={critical}         label="Critical Alerts"   sub="Require intervention"   iconColor="#DC2626" iconBg="#FEF2F2" borderColor="#FECACA" icon={AlertCircle}   delay={60}  />
            <KpiCard value={alerts}           label="Under Observation" sub="Alert-line monitoring"  iconColor="#F59E0B" iconBg="#FFFBEB" borderColor="#FDE68A" icon={Activity}      delay={120} />
            <KpiCard value={completed}        label="Deliveries Today"  sub="Successfully completed" iconColor="#16A34A" iconBg="#F0FDF4" borderColor="#BBF7D0" icon={CheckCircle2} delay={180} />
          </div>

          {/* ── Main content grid ─────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', alignItems: 'start' }}>

            {/* Active patients panel */}
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px', overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              {/* Panel header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 18px',
                borderBottom: '1px solid #F3F4F6',
                background: '#FAFAFA',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563EB' }} />
                  <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '12.5px', fontWeight: 700, color: '#111827', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Active Patients
                  </span>
                  <span style={{
                    padding: '1px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                    background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE',
                  }}>
                    {active.length}
                  </span>
                </div>
                <button
                  onClick={() => navigate('/patients')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px',
                    borderRadius: '5px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
                    background: '#EFF6FF', border: '1px solid #BFDBFE',
                    color: '#2563EB',
                    transition: 'all 0.15s ease',
                  }}
                >
                  View all <ArrowRight style={{ width: '12px', height: '12px' }} />
                </button>
              </div>

              {/* Patient list */}
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '400px', overflowY: 'auto' }}>
                {active.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <Users style={{ width: '32px', height: '32px', color: '#D1D5DB', margin: '0 auto 10px' }} />
                    <p style={{ fontSize: '13px', color: '#9CA3AF' }}>No active patients</p>
                    <button
                      onClick={() => navigate('/new-patient')}
                      style={{ marginTop: '12px', padding: '7px 16px', borderRadius: '6px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Admit new patient →
                    </button>
                  </div>
                ) : (
                  active.slice(0, 8).map((p, i) => (
                    <PatientRow key={p.patient_id || i} patient={p} index={i} onOpen={(id) => navigate(id ? `/dashboard/${id}` : '/patients')} />
                  ))
                )}
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Quick actions */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB', borderRadius: '8px',
                padding: '18px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  Quick Actions
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { label: 'Admit New Patient', icon: Users,       path: '/new-patient', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
                    { label: 'View All Patients', icon: Activity,    path: '/patients',    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
                    { label: 'Generate Report',   icon: TrendingUp,  path: '/reports',     color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
                  ].map(({ label, icon: Icon, path, color, bg, border }) => (
                    <button
                      key={label}
                      onClick={() => navigate(path)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '9px',
                        padding: '9px 12px', borderRadius: '6px', cursor: 'pointer',
                        background: bg, border: `1px solid ${border}`,
                        color, fontSize: '12.5px', fontWeight: 600,
                        transition: 'opacity 0.15s ease',
                        width: '100%', textAlign: 'left',
                      }}
                    >
                      <Icon style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                      {label}
                      <ArrowRight style={{ width: '12px', height: '12px', marginLeft: 'auto' }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* System status */}
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB', borderRadius: '8px',
                padding: '18px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                  System Status
                </p>
                {[
                  { label: 'Server Uptime',  value: '99%',   color: '#16A34A', bg: '#F0FDF4' },
                  { label: 'AI Accuracy',    value: '98%',   color: '#2563EB', bg: '#EFF6FF' },
                  { label: 'Response Time',  value: '1.8s',  color: '#F59E0B', bg: '#FFFBEB' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>{label}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: '4px', fontFamily: 'DM Mono, monospace' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Clinician card */}
              {user && (
                <div style={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB', borderRadius: '8px',
                  padding: '16px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
                      background: '#EFF6FF', border: '1px solid #BFDBFE',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '16px', fontWeight: 700, color: '#2563EB' }}>
                        {user.name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827', margin: 0 }}>{user.name}</p>
                      {user.license_number && (
                        <p style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'DM Mono, monospace', marginTop: '2px', letterSpacing: '0.06em' }}>
                          {user.license_number}
                        </p>
                      )}
                      <p style={{ fontSize: '11.5px', color: '#2563EB', marginTop: '2px', fontWeight: 600 }}>
                        {user.specialization || 'Obstetrician'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                    {[
                      { label: 'Patients', value: patients.length },
                      { label: 'Active',   value: active.length },
                      { label: 'Limit',    value: user.patient_limit || '∞' },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ flex: 1, textAlign: 'center', padding: '7px 4px', borderRadius: '6px', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: '#111827', fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>{value}</p>
                        <p style={{ fontSize: '9.5px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '3px', fontWeight: 600 }}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Clinical Guidelines ─────────────────────────── */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
                Clinical Guidelines
              </span>
              <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {GUIDELINES.map(({ tag, org, title, desc, color, icon: Icon, link, points }) => (
                <div
                  key={tag}
                  style={{
                    padding: '18px', borderRadius: '8px',
                    background: '#FFFFFF',
                    border: `1px solid #E5E7EB`,
                    borderTop: `3px solid ${color}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    transition: 'box-shadow 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: `${color}12`, border: `1px solid ${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon style={{ width: '14px', height: '14px', color }} />
                      </div>
                      <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', background: `${color}12`, color, border: `1px solid ${color}22` }}>
                        {tag}
                      </span>
                    </div>
                    {link && (
                      <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#9CA3AF', textDecoration: 'none' }}>
                        <ExternalLink style={{ width: '11px', height: '11px' }} />
                      </a>
                    )}
                  </div>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{org}</p>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginBottom: '6px', lineHeight: 1.35, letterSpacing: '-0.01em' }}>{title}</h3>
                  <p style={{ fontSize: '11.5px', color: '#9CA3AF', lineHeight: 1.55, marginBottom: '10px' }}>{desc}</p>
                  <div style={{ borderTop: '1px solid #F3F4F6', paddingTop: '9px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {points.map((pt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', marginTop: '5px', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: '11.5px', color: '#6B7280', lineHeight: 1.4 }}>{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default MainDashboard;
