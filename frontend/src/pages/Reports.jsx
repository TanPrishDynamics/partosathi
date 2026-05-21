import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import {
  Download, FileText, Calendar, Loader2,
  AlertCircle, ShieldCheck, Activity, Users, CheckCircle2, Search,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Sidebar from '../components/Sidebar';

/* ─── Table row ──────────────────────────────────────────────────────────── */
const TableRow = ({ p, downloading, onExport, delay = 0 }) => {
  const [hovered, setHovered] = useState(false);
  const isCompleted = p.status === 'Completed';
  const hasAlert    = p.alert_counts?.red > 0;

  const statusColor  = isCompleted ? '#16A34A' : hasAlert ? '#DC2626' : '#2563EB';
  const statusBg     = isCompleted ? '#F0FDF4' : hasAlert ? '#FEF2F2' : '#EFF6FF';
  const statusBorder = isCompleted ? '#BBF7D0' : hasAlert ? '#FECACA' : '#BFDBFE';
  const StatusIcon   = isCompleted ? ShieldCheck : hasAlert ? AlertCircle : Activity;

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: '1px solid #F1F5F9',
        background: hovered ? '#F8FAFC' : 'transparent',
        transition: 'background 0.2s ease',
        cursor: 'default',
      }}
    >
      {/* Date/Time */}
      <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          <Calendar style={{ width: '13px', height: '13px', color: '#2563EB', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', fontFamily: 'Inter, sans-serif' }}>
            {format(new Date(p.admission_time), 'MMM dd, yyyy')}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#64748B', paddingLeft: '21px', fontFamily: 'Inter, sans-serif' }}>
          {format(new Date(p.admission_time), 'HH:mm')} · {formatDistanceToNow(new Date(p.admission_time), { addSuffix: true })}
        </div>
      </td>

      {/* Patient */}
      <td style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 700, color: '#2563EB',
            fontFamily: 'Inter, sans-serif',
          }}>
            {p.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B', margin: 0, fontFamily: 'Inter, sans-serif' }}>
              {p.name}
            </p>
            <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '2px 0 0', fontFamily: 'Inter, sans-serif' }}>
              {p.patient_id}
            </p>
          </div>
        </div>
      </td>

      {/* Obstetric */}
      <td style={{ padding: '16px 20px' }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: '#475569', margin: '0 0 3px', fontFamily: 'Inter, sans-serif' }}>
          G{p.gravida} P{p.parity} · {p.gestational_age}wks
        </p>
        <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, fontFamily: 'Inter, sans-serif' }}>
          Rupture: {p.membrane_rupture_time ? format(new Date(p.membrane_rupture_time), 'HH:mm, MMM d') : 'N/A'}
        </p>
      </td>

      {/* Status */}
      <td style={{ padding: '16px 20px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', borderRadius: '99px',
          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          background: statusBg, color: statusColor, border: `1px solid ${statusBorder}`,
          fontFamily: 'DM Sans, sans-serif',
        }}>
          <StatusIcon style={{ width: '10px', height: '10px' }} />
          {p.status || 'Active'}
        </span>
      </td>

      {/* Action */}
      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          onClick={() => onExport(p.patient_id)}
          disabled={downloading === p.patient_id}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '8px 16px', borderRadius: '10px',
            background: hovered ? '#EFF6FF' : '#F9FAFB',
            border: `1px solid ${hovered ? '#BFDBFE' : '#E5E7EB'}`,
            color: '#2563EB',
            fontSize: '12px', fontWeight: 600,
            cursor: downloading === p.patient_id ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: downloading === p.patient_id ? 0.5 : 1,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {downloading === p.patient_id
            ? <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
            : <Download style={{ width: '12px', height: '12px' }} />}
          Export PDF
        </motion.button>
      </td>
    </motion.tr>
  );
};

/* ─── Summary chip ───────────────────────────────────────────────────────── */
const SummaryChip = ({ icon: Icon, label, value, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 20px', borderRadius: '12px',
    background: '#fff',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 6px rgba(15,23,42,0.06)',
    minWidth: '140px',
  }}>
    <div style={{
      width: '38px', height: '38px', borderRadius: '11px',
      background: `${color}12`, border: `1px solid ${color}22`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon style={{ width: '17px', height: '17px', color }} />
    </div>
    <div>
      <p style={{
        fontSize: '22px', fontWeight: 700, color: '#1E293B', margin: 0, lineHeight: 1,
        fontFamily: 'Inter, sans-serif',
      }}>
        {value}
      </p>
      <p style={{
        fontSize: '9px', color: '#64748B', margin: 0,
        textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginTop: '4px',
        fontFamily: 'DM Sans, sans-serif',
      }}>
        {label}
      </p>
    </div>
  </div>
);

/* ─── Page ───────────────────────────────────────────────────────────────── */
const Reports = () => {
  const [patients, setPatients]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [downloading, setDownloading] = useState(null);
  const [search, setSearch]           = useState('');

  useEffect(() => {
    api.get('/api/patients')
      .then(r => setPatients(r.data.sort((a, b) => new Date(a.admission_time) - new Date(b.admission_time))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExportPDF = async (patientId) => {
    setDownloading(patientId);
    try {
      const resp = await api.get(`/api/export/pdf/${patientId}`, { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `partogram_${patientId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Error exporting PDF.');
    } finally {
      setDownloading(null);
    }
  };

  const completed = patients.filter(p => p.status === 'Completed').length;
  const critical  = patients.filter(p => p.alert_counts?.red > 0).length;

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.patient_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />

      <main style={{ flex: 1, overflowY: 'auto', background: '#F8FAFC', fontFamily: 'Inter, sans-serif' }}>

        {/* Sticky header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'rgba(248,250,252,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #E2E8F0',
          padding: '18px 40px',
          boxShadow: '0 2px 12px rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1440px', margin: '0 auto' }}>
            <div>
              <h1 style={{
                fontFamily: 'Inter, sans-serif', fontSize: '20px', fontWeight: 700,
                color: '#1E293B', margin: 0, letterSpacing: '-0.01em',
              }}>
                Clinical Reports
              </h1>
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: '3px', fontFamily: 'Inter, sans-serif' }}>
                Patient archives ·&nbsp;
                <span style={{ color: '#2563EB', fontWeight: 600 }}>{patients.length - completed} active</span>
                &nbsp;·&nbsp;
                <span style={{ color: '#16A34A', fontWeight: 600 }}>{completed} completed</span>
              </p>
            </div>

            {/* Total records badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 16px', borderRadius: '8px',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: '#DBEAFE', border: '1px solid #BFDBFE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText style={{ width: '16px', height: '16px', color: '#2563EB' }} />
              </div>
              <div>
                <p style={{ fontSize: '9px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, margin: 0 }}>
                  Total Records
                </p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '20px', fontWeight: 700, color: '#2563EB', margin: 0, lineHeight: 1 }}>
                  {patients.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '28px 40px 60px', maxWidth: '1440px', margin: '0 auto' }}>

          {/* Summary chips */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <SummaryChip icon={Users}        label="Total Patients" value={patients.length}             color="#2563EB" />
            <SummaryChip icon={Activity}     label="Active"         value={patients.length - completed} color="#6B7280" />
            <SummaryChip icon={CheckCircle2} label="Completed"      value={completed}                   color="#16A34A" />
            <SummaryChip icon={AlertCircle}  label="Critical"       value={critical}                    color="#DC2626" />
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '400px' }}>
            <Search style={{
              position: 'absolute', left: '14px', top: '50%',
              transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#94A3B8',
            }} />
            <input
              type="text" placeholder="Search patients or ID…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', paddingLeft: '40px', paddingRight: '16px',
                paddingTop: '10px', paddingBottom: '10px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px', fontSize: '14px',
                color: '#1E293B', outline: 'none',
                fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#2563EB';
                e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.10)';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#D1D5DB';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Table card */}
          <motion.div
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }}
            style={{
              background: '#fff',
              border: '1px solid #E2E8F0',
              borderRadius: '16px', overflow: 'hidden',
              boxShadow: '0 2px 16px rgba(15,23,42,0.07)',
            }}
          >
            {/* Top accent */}
            <div style={{ height: '3px', background: '#2563EB' }} />

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '80px 0', gap: '16px' }}>
                <Loader2 style={{ width: '28px', height: '28px', color: '#6366F1', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: '13px', color: '#64748B', fontWeight: 500, fontFamily: 'DM Sans, sans-serif' }}>
                  Loading records…
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['Date & Time', 'Patient', 'Obstetric History', 'Status', 'Action'].map((h, i) => (
                        <th key={h} style={{
                          padding: '12px 20px',
                          fontSize: '10px', fontWeight: 700, color: '#94A3B8',
                          textTransform: 'uppercase', letterSpacing: '0.1em',
                          textAlign: i === 4 ? 'right' : 'left',
                          fontFamily: 'Inter, sans-serif',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{
                          padding: '60px', textAlign: 'center',
                          color: '#94A3B8', fontSize: '14px', fontWeight: 500,
                          fontFamily: 'DM Sans, sans-serif',
                        }}>
                          No patient records found.
                        </td>
                      </tr>
                    ) : filtered.map((p, i) => (
                      <TableRow
                        key={p.id || p.patient_id}
                        p={p}
                        downloading={downloading}
                        onExport={handleExportPDF}
                        delay={i * 0.04}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Footer note */}
          {!loading && filtered.length > 0 && (
            <p style={{
              fontSize: '11px', color: '#94A3B8', textAlign: 'center', marginTop: '20px', fontWeight: 500,
              fontFamily: 'Inter, sans-serif',
            }}>
              Showing {filtered.length} of {patients.length} patient records · WHO 2020 compliant partograph system
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Reports;
