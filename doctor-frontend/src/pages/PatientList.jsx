import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  Plus, Search, Activity, Clock, Edit2, Baby,
  ShieldCheck, AlertCircle, AlertTriangle, Loader2,
  ChevronRight, Users, Trash2, CheckCircle2,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import EditPatientModal from '../features/patients/EditPatientModal';
import { formatDistanceToNow } from 'date-fns';

/* ── Status config ────────────────────────────────────────────────────────── */
const getStatus = p => {
  if (p.alert_counts?.red > 0)    return 'critical';
  if (p.alert_counts?.yellow > 0) return 'warning';
  return 'normal';
};

const STATUS = {
  critical: { color: '#DC2626', bg: '#FEF2F2',  border: '#FECACA',  label: 'CRITICAL', Icon: AlertCircle,   dot: '#DC2626' },
  warning:  { color: '#D97706', bg: '#FFFBEB',  border: '#FDE68A',  label: 'ALERT',    Icon: AlertTriangle, dot: '#D97706' },
  normal:   { color: '#16A34A', bg: '#F0FDF4',  border: '#BBF7D0',  label: 'NORMAL',   Icon: ShieldCheck,   dot: '#16A34A' },
};

/* ── Patient card ────────────────────────────────────────────────────────── */
const PatientCard = ({ patient, index, onOpen, onEdit }) => {
  const status = getStatus(patient);
  const S      = STATUS[status];
  const [hovered, setHovered] = useState(false);

  const lastSeen = patient.last_observation_time
    ? formatDistanceToNow(new Date(patient.last_observation_time), { addSuffix: true })
    : 'No observations yet';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        border: `1px solid ${hovered ? S.border : '#E5E7EB'}`,
        borderTop: `3px solid ${S.dot}`,
        borderRadius: '8px', padding: '16px',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.08)' : '0 1px 4px rgba(0,0,0,0.05)',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
      }}
      onClick={() => onOpen(patient.patient_id)}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Avatar */}
          <div style={{
            width: '38px', height: '38px', borderRadius: '8px', flexShrink: 0,
            background: S.bg, border: `1px solid ${S.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '15px', fontWeight: 700, color: S.dot }}>
              {patient.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <h3 style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827', margin: 0, lineHeight: 1.25 }}>
              {patient.name}
            </h3>
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0', fontFamily: 'DM Mono, monospace' }}>
              ID: {patient.patient_id}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          padding: '3px 8px', borderRadius: '4px',
          background: S.bg, border: `1px solid ${S.border}`,
        }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: S.dot }} />
          <span style={{ fontSize: '9.5px', fontWeight: 700, color: S.color, letterSpacing: '0.06em' }}>
            {S.label}
          </span>
        </div>
      </div>

      {/* Clinical data grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '7px', marginBottom: '12px' }}>
        {[
          { label: 'Age',  value: `${patient.age}y` },
          { label: 'GA',   value: `${patient.gestational_age}w` },
          { label: 'G/P',  value: `G${patient.gravida}P${patient.parity}` },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '6px 8px', borderRadius: '5px', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
            <p style={{ fontSize: '9px', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px', fontWeight: 600 }}>{label}</p>
            <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #F3F4F6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Clock style={{ width: '10px', height: '10px', color: '#9CA3AF' }} />
          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{lastSeen}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onEdit(patient)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '5px', background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
          >
            <Edit2 style={{ width: '10px', height: '10px' }} /> Edit
          </button>
          <button
            onClick={() => onOpen(patient.patient_id)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '5px', background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
          >
            Open <ChevronRight style={{ width: '10px', height: '10px' }} />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Page ──────────────────────────────────────────────────────────────── */
const PatientList = () => {
  const [patients, setPatients]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [editingPatient, setEditing] = useState(null);
  const [page, setPage]             = useState(1);
  const navigate = useNavigate();

  const PER_PAGE = 12;

  useEffect(() => {
    setLoading(true);
    api.get('/api/patients')
      .then(r => setPatients(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const safePatients = Array.isArray(patients) ? patients : [];

const filtered = safePatients.filter((p) => {
  const matchSearch =
    !search ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    String(p.patient_id).includes(search);

  const status = getStatus(p);
  const matchFilter = filter === "all" || status === filter;

  return matchSearch && matchFilter;
});

const paginated = filtered.slice(0, page * PER_PAGE);

const hasMore = paginated.length < filtered.length;

const critical = safePatients.filter(
  (p) => getStatus(p) === "critical"
).length;

const warnings = safePatients.filter(
  (p) => getStatus(p) === "warning"
).length;

const active = safePatients.filter(
  (p) => (p.status || "Active") === "Active"
).length;

  const handleSaveEdit = (updated) => {
    setPatients(prev => prev.map(p => p.patient_id === updated.patient_id ? { ...p, ...updated } : p));
    setEditing(null);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <main style={{ flex: 1, overflowY: 'auto', background: '#F5F7FA', fontFamily: 'Inter, system-ui, sans-serif' }}>

        {/* ── Sticky header ────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          padding: '14px 36px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            {/* Title + counters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
                Patients
              </h1>
              <div style={{ display: 'flex', gap: '5px' }}>
                {[
                  { label: `${active} Active`,    color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
                  { label: `${warnings} Alert`,   color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                  { label: `${critical} Critical`, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                ].map(({ label, color, bg, border }) => (
                  <span key={label} style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: bg, color, border: `1px solid ${border}` }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Admit button */}
            <button
              onClick={() => navigate('/new-patient')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '6px', cursor: 'pointer',
                background: '#2563EB', border: '1px solid #1D4ED8',
                color: '#fff', fontSize: '13px', fontWeight: 600,
                boxShadow: '0 1px 4px rgba(37,99,235,0.20)',
                transition: 'background 0.15s ease',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#1D4ED8'}
              onMouseOut={e => e.currentTarget.style.background = '#2563EB'}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              Admit Patient
            </button>
          </div>

          {/* Search + filter row */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
              <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF', pointerEvents: 'none' }} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name or ID…"
                style={{
                  width: '100%', paddingLeft: '36px', paddingRight: '12px', height: '36px',
                  fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '6px',
                  background: '#F9FAFB', color: '#111827', outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)'; }}
                onBlur={e => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              {[
                { id: 'all',      label: 'All',      activeColor: '#2563EB', activeBg: '#EFF6FF', activeBorder: '#BFDBFE' },
                { id: 'normal',   label: 'Normal',   activeColor: '#16A34A', activeBg: '#F0FDF4', activeBorder: '#BBF7D0' },
                { id: 'warning',  label: 'Alert',    activeColor: '#D97706', activeBg: '#FFFBEB', activeBorder: '#FDE68A' },
                { id: 'critical', label: 'Critical', activeColor: '#DC2626', activeBg: '#FEF2F2', activeBorder: '#FECACA' },
              ].map(({ id, label, activeColor, activeBg, activeBorder }) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  style={{
                    padding: '5px 11px', borderRadius: '5px', fontSize: '11.5px',
                    fontWeight: 600, cursor: 'pointer',
                    background: filter === id ? activeBg : '#F9FAFB',
                    border: `1px solid ${filter === id ? activeBorder : '#E5E7EB'}`,
                    color: filter === id ? activeColor : '#6B7280',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 36px 80px' }}>

          {/* Results count */}
          {!loading && (
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '16px', fontFamily: 'DM Mono, monospace' }}>
              {filtered.length} patient{filtered.length !== 1 ? 's' : ''} {search ? `matching "${search}"` : filter !== 'all' ? `with ${filter} status` : 'total'} — showing {Math.min(paginated.length, filtered.length)}
            </p>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '14px' }}>
              <div style={{ width: '36px', height: '36px', border: '2.5px solid #E5E7EB', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: '13px', color: '#9CA3AF' }}>Fetching patients…</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '64px 20px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '10px', background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Users style={{ width: '24px', height: '24px', color: '#2563EB' }} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#6B7280', marginBottom: '8px' }}>
                {search ? 'No patients found' : 'No patients admitted'}
              </h3>
              <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '18px' }}>
                {search ? `Try a different search term` : 'Begin by admitting your first patient'}
              </p>
              {!search && (
                <button
                  onClick={() => navigate('/new-patient')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '6px', background: '#2563EB', border: '1px solid #1D4ED8', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} /> Admit Patient
                </button>
              )}
            </div>
          )}

          {/* Patient grid */}
          {!loading && filtered.length > 0 && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: '12px',
              }}>
                {paginated.map((p, i) => (
                  <PatientCard
                    key={p.patient_id}
                    patient={p}
                    index={i}
                    onOpen={(id) => navigate(id ? `/dashboard/${id}` : '/patients')}
                    onEdit={setEditing}
                  />
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    style={{
                      padding: '9px 24px', borderRadius: '6px', cursor: 'pointer',
                      background: '#EFF6FF', border: '1px solid #BFDBFE',
                      color: '#2563EB', fontSize: '13px', fontWeight: 600,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Load {Math.min(PER_PAGE, filtered.length - paginated.length)} more →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Edit modal */}
      {editingPatient && (
        <EditPatientModal
          patient={editingPatient}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
};

export default PatientList;
