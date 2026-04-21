import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Plus, Search, Activity, Clock, Edit2, Baby,
  ShieldCheck, AlertCircle, AlertTriangle, Loader2,
  ChevronRight, Zap, Users, TrendingUp,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import EditPatientModal from '../features/patients/EditPatientModal';
import { formatDistanceToNow } from 'date-fns';

/* ─── Status helpers ──────────────────────────────────────────────────────── */
const getStatus = (p) => {
  if (p.alert_counts?.red > 0)    return 'critical';
  if (p.alert_counts?.yellow > 0) return 'warning';
  return 'normal';
};

const STATUS = {
  critical: {
    color: '#F87171', glow: 'rgba(248,113,113,0.18)', border: 'rgba(248,113,113,0.3)',
    bg: 'rgba(239,68,68,0.08)', label: 'Critical', Icon: AlertCircle,
    barGradient: 'linear-gradient(180deg,#F87171,#EF4444)',
    pulse: true,
  },
  warning: {
    color: '#FBBF24', glow: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.25)',
    bg: 'rgba(245,158,11,0.07)', label: 'Warning', Icon: AlertTriangle,
    barGradient: 'linear-gradient(180deg,#FBBF24,#F59E0B)',
    pulse: false,
  },
  normal: {
    color: '#34D399', glow: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.2)',
    bg: 'rgba(16,185,129,0.06)', label: 'Normal', Icon: ShieldCheck,
    barGradient: 'linear-gradient(180deg,#34D399,#10B981)',
    pulse: false,
  },
};

/* ─── Stat strip ──────────────────────────────────────────────────────────── */
const StatChip = ({ icon: Icon, value, label, color = '#22D3EE' }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '14px 20px', borderRadius: '14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    flex: 1, minWidth: '120px',
  }}>
    <div style={{
      width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
      background: `${color}14`, border: `1px solid ${color}28`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon style={{ width: '16px', height: '16px', color }} />
    </div>
    <div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: '#F1F5F9', lineHeight: 1, fontFamily: 'Roboto Mono, monospace' }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '3px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
    </div>
  </div>
);

/* ─── Patient Card ────────────────────────────────────────────────────────── */
const PatientCard = ({ p, onEdit, onNavigate, onStatusChange, index }) => {
  const [hovered, setHovered] = useState(false);
  const status = getStatus(p);
  const s = STATUS[status];
  const count = status === 'critical' ? p.alert_counts.red
              : status === 'warning'  ? p.alert_counts.yellow : 0;

  return (
    <div
      onClick={() => onNavigate(p.patient_id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', borderRadius: '20px', cursor: 'pointer', overflow: 'hidden',
        background: hovered
          ? 'rgba(22,30,50,0.95)'
          : 'rgba(15,21,37,0.85)',
        border: `1px solid ${hovered ? s.border : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hovered
          ? `0 0 0 1px ${s.border}, 0 24px 64px rgba(0,0,0,0.6), 0 0 32px ${s.glow}`
          : '0 4px 24px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-4px) scale(1.01)' : 'translateY(0) scale(1)',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        animationDelay: `${index * 60}ms`,
      }}
      className="animate-fade-in"
    >
      {/* Status bar — left edge */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '4px', height: '100%',
        background: s.barGradient, borderRadius: '20px 0 0 20px',
        boxShadow: hovered ? `0 0 12px ${s.color}` : 'none',
        transition: 'box-shadow 0.3s ease',
      }} />

      {/* Top ambient glow */}
      <div style={{
        position: 'absolute', top: '-40px', right: '-30px', width: '180px', height: '180px',
        borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, ${s.glow} 0%, transparent 65%)`,
        opacity: hovered ? 1 : 0.4, transition: 'opacity 0.3s ease',
      }} />

      <div style={{ padding: '20px 20px 20px 24px' }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
            {/* Avatar */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '13px', flexShrink: 0,
              background: hovered ? `${s.color}18` : 'rgba(255,255,255,0.05)',
              border: `1.5px solid ${hovered ? s.border : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.25s ease',
              boxShadow: hovered ? `0 0 16px ${s.glow}` : 'none',
            }}>
              <span style={{
                fontFamily: 'Poppins, sans-serif', fontSize: '18px', fontWeight: 700,
                color: hovered ? s.color : '#6B7280',
                transition: 'color 0.25s ease',
              }}>
                {p.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 style={{
                fontFamily: 'Poppins, sans-serif', fontSize: '15px', fontWeight: 700,
                color: hovered ? '#F9FAFB' : '#E2E8F0',
                margin: 0, lineHeight: 1.2, transition: 'color 0.2s ease',
              }}>
                {p.name}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{
                  fontFamily: 'Roboto Mono, monospace', fontSize: '10px',
                  color: '#4B5563', letterSpacing: '0.05em',
                }}>
                  {p.patient_id}
                </span>
                {(p.age) && (
                  <span style={{ fontSize: '10px', color: '#374151' }}>· {p.age}y</span>
                )}
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Alert indicator */}
            {status === 'critical' && (
              <div style={{
                width: '9px', height: '9px', borderRadius: '50%',
                background: '#F87171', flexShrink: 0,
                boxShadow: '0 0 10px rgba(248,113,113,0.8)',
                animation: 'ai-pulse-anim 1.3s ease-in-out infinite',
              }} />
            )}
            {status === 'warning' && (
              <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#FBBF24', boxShadow: '0 0 8px rgba(251,191,36,0.6)' }} />
            )}
            {/* Edit button */}
            {hovered && (
              <button
                onClick={e => { e.stopPropagation(); onEdit(p); }}
                style={{
                  width: '30px', height: '30px', borderRadius: '9px',
                  background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                }}
              >
                <Edit2 style={{ width: '13px', height: '13px', color: '#22D3EE' }} />
              </button>
            )}
            <ChevronRight style={{
              width: '16px', height: '16px',
              color: hovered ? s.color : '#374151',
              transform: hovered ? 'translateX(3px)' : 'translateX(0)',
              transition: 'all 0.2s ease',
            }} />
          </div>
        </div>

        {/* ── Stats rows ──────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '9px',
          padding: '14px 0', borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity style={{ width: '12px', height: '12px' }} />
              Observations
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8', fontFamily: 'Roboto Mono, monospace' }}>
              {p.observation_count ?? 0}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock style={{ width: '12px', height: '12px' }} />
              Admitted
            </span>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>
              {formatDistanceToNow(new Date(p.admission_time), { addSuffix: true })}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Baby style={{ width: '12px', height: '12px' }} />
              Obstetric
            </span>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>G{p.gravida} P{p.parity} · {p.gestational_age}w</span>
          </div>
        </div>

        {/* ── Footer: badge + action ───────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: '4px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          {/* Status badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 11px', borderRadius: '99px',
            fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
          }}>
            <s.Icon style={{ width: '10px', height: '10px' }} />
            {count > 0 ? `${count} ${s.label}` : s.label}
          </span>

          {/* AI monitor tag */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '3px 9px', borderRadius: '99px',
            background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.12)',
          }}>
            <Zap style={{ width: '9px', height: '9px', color: '#22D3EE' }} />
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#22D3EE', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              AI Monitor
            </span>
          </div>
        </div>

        {/* Complete link (visible on hover) */}
        {hovered && (
          <button
            onClick={e => { e.stopPropagation(); onStatusChange(e, p.patient_id, 'Completed'); }}
            style={{
              marginTop: '10px', width: '100%',
              padding: '7px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              fontSize: '11px', fontWeight: 600, color: '#6B7280',
              cursor: 'pointer', transition: 'all 0.15s ease',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}
            onMouseOver={e => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            onMouseOut={e => { e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
          >
            Mark as Completed
          </button>
        )}
      </div>
    </div>
  );
};

/* ─── Page ────────────────────────────────────────────────────────────────── */
const PatientList = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('Active');
  const [editingPatient, setEditingPatient] = useState(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/api/patients', {
    })
      .then(r => setPatients(r.data))
      .catch(e => { if (e.response?.status === 401) navigate('/login'); })
      .finally(() => setLoading(false));
  }, [navigate]);

  const filtered = patients.filter(p =>
    (p.status || 'Active') === filterStatus &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
     p.patient_id.toLowerCase().includes(search.toLowerCase()))
  );

  const activeCount   = patients.filter(p => (p.status || 'Active') === 'Active').length;
  const criticalCount = patients.filter(p => p.alert_counts?.red > 0).length;
  const warningCount  = patients.filter(p => p.alert_counts?.yellow > 0 && !p.alert_counts?.red).length;

  const handleStatusChange = async (e, pid, status) => {
    e.stopPropagation();
    try {
      await api.patch(`/api/patient/${pid}/status`, { status }, {
      });
      setPatients(prev => prev.map(p => p.patient_id === pid ? { ...p, status } : p));
    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'radial-gradient(ellipse at top left, #0d1929 0%, #0B1220 55%, #060D18 100%)' }}>
      <Sidebar />

      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── Sticky header ─────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'rgba(9,15,27,0.92)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '20px 40px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1440px', margin: '0 auto' }}>
            <div>
              <h1 style={{
                fontFamily: 'Poppins, sans-serif', fontSize: '28px', fontWeight: 700,
                color: '#F9FAFB', margin: 0, letterSpacing: '-0.02em', lineHeight: 1,
              }}>
                Patients
              </h1>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#22D3EE', fontWeight: 700 }}>{activeCount}</span> active
                {criticalCount > 0 && <> · <span style={{ color: '#F87171', fontWeight: 700 }}>{criticalCount} critical</span></>}
                {warningCount  > 0 && <> · <span style={{ color: '#FBBF24', fontWeight: 600 }}>{warningCount} warning</span></>}
                &nbsp;· {patients.length} total
              </p>
            </div>

            <button
              onClick={() => navigate('/new-patient')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)',
                color: '#030D18', fontWeight: 700, fontSize: '15px',
                fontFamily: 'Poppins, sans-serif',
                borderRadius: '12px', border: 'none', cursor: 'pointer',
                boxShadow: '0 6px 28px rgba(34,211,238,0.38), 0 1px 0 rgba(255,255,255,0.2) inset',
                transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
              }}
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(34,211,238,0.5)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(34,211,238,0.38)'; }}
            >
              <Plus style={{ width: '18px', height: '18px' }} />
              Register Patient
            </button>
          </div>
        </div>

        <div style={{ padding: '28px 40px 48px', maxWidth: '1440px', margin: '0 auto', width: '100%', flex: 1 }}>

          {/* ── Stat strip ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
            <StatChip icon={Users}       value={activeCount}    label="Active"    color="#22D3EE" />
            <StatChip icon={AlertCircle} value={criticalCount}  label="Critical"  color="#F87171" />
            <StatChip icon={AlertTriangle} value={warningCount} label="Warning"   color="#FBBF24" />
            <StatChip icon={TrendingUp}  value={patients.length} label="Total"   color="#34D399" />
          </div>

          {/* ── Search + filter ──────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
            {/* Search bar */}
            <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
              <Search style={{
                position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                width: '17px', height: '17px',
                color: searchFocused ? '#22D3EE' : '#4B5563',
                transition: 'color 0.2s ease',
              }} />
              <input
                type="text"
                placeholder="Search patients, ID, or risk level…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                style={{
                  width: '100%', paddingLeft: '48px', paddingRight: '20px',
                  paddingTop: '13px', paddingBottom: '13px',
                  background: searchFocused ? 'rgba(34,211,238,0.03)' : 'rgba(255,255,255,0.04)',
                  border: `1.5px solid ${searchFocused ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.09)'}`,
                  borderRadius: '13px', fontSize: '15px', color: '#E5E7EB',
                  fontFamily: 'Roboto, sans-serif',
                  outline: 'none', transition: 'all 0.25s ease',
                  boxShadow: searchFocused ? '0 0 0 4px rgba(34,211,238,0.08)' : 'none',
                }}
              />
            </div>

            {/* Filter pills */}
            <div style={{
              display: 'flex', gap: '4px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '13px', padding: '4px',
            }}>
              {['Active', 'Completed'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  style={{
                    padding: '9px 22px', borderRadius: '10px', border: 'none',
                    cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                    fontFamily: 'Poppins, sans-serif',
                    transition: 'all 0.22s ease',
                    background: filterStatus === s
                      ? 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)'
                      : 'transparent',
                    color: filterStatus === s ? '#030D18' : '#6B7280',
                    boxShadow: filterStatus === s ? '0 4px 14px rgba(34,211,238,0.35)' : 'none',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── Grid / States ────────────────────────────────────────── */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '18px' }}>
              <Loader2 style={{ width: '36px', height: '36px', color: '#22D3EE', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: '15px', color: '#6B7280', fontWeight: 500 }}>Loading patients…</p>
            </div>

          ) : filtered.length === 0 ? (
            <div style={{
              padding: '80px 40px', textAlign: 'center',
              background: 'rgba(17,24,39,0.4)',
              border: '1px dashed rgba(255,255,255,0.07)',
              borderRadius: '20px',
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '18px',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <Search style={{ width: '28px', height: '28px', color: '#374151' }} />
              </div>
              <h3 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '20px', fontWeight: 600, color: '#4B5563', marginBottom: '8px' }}>
                No patients found
              </h3>
              <p style={{ fontSize: '14px', color: '#374151' }}>
                Try adjusting the search or switching the filter tab.
              </p>
            </div>

          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '18px',
            }}>
              {filtered.map((p, i) => (
                <PatientCard
                  key={p.id}
                  p={p}
                  index={i}
                  onEdit={setEditingPatient}
                  onNavigate={pid => navigate(`/dashboard/${pid}`)}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {editingPatient && (
        <EditPatientModal
          patient={editingPatient}
          onSave={updated => {
            setPatients(prev => prev.map(p =>
              p.patient_id === updated.patient_id ? { ...p, ...updated } : p
            ));
            setEditingPatient(null);
          }}
          onClose={() => setEditingPatient(null)}
        />
      )}
    </div>
  );
};

export default PatientList;
