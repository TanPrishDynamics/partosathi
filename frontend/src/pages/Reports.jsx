import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Download, FileText, Calendar, Loader2, AlertCircle, ShieldCheck, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import Sidebar from '../components/Sidebar';

const TableRow = ({ p, downloading, onExport }) => {
  const [hovered, setHovered] = useState(false);
  const isCompleted = p.status === 'Completed';
  const hasAlert    = p.alert_counts?.red > 0;
  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: hovered ? 'rgba(255,255,255,0.025)' : 'transparent', transition: 'background 0.15s ease' }}
    >
      <td style={{ padding: '16px 20px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D1D5DB', fontSize: '14px', marginBottom: '4px' }}>
          <Calendar style={{ width: '14px', height: '14px', color: '#22D3EE', flexShrink: 0 }} />
          {format(new Date(p.admission_time), 'MMM dd, yyyy')}
        </div>
        <div style={{ fontSize: '12px', color: '#6B7280', paddingLeft: '22px' }}>
          {format(new Date(p.admission_time), 'HH:mm')} · {formatDistanceToNow(new Date(p.admission_time), { addSuffix: true })}
        </div>
      </td>
      <td style={{ padding: '16px 20px' }}>
        <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '15px', fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>{p.name}</p>
        <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '11px', color: '#22D3EE', letterSpacing: '0.05em', margin: 0 }}>{p.patient_id}</p>
      </td>
      <td style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '3px' }}>
          <span style={{ color: '#6B7280' }}>G</span>{p.gravida} <span style={{ color: '#6B7280' }}>P</span>{p.parity} · {p.gestational_age}wks
        </div>
        <div style={{ fontSize: '12px', color: '#4B5563' }}>
          Rupture: {p.membrane_rupture_time ? format(new Date(p.membrane_rupture_time), 'HH:mm, MMM d') : 'N/A'}
        </div>
      </td>
      <td style={{ padding: '16px 20px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '4px 12px', borderRadius: '99px',
          fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
          background: isCompleted ? 'rgba(148,163,184,0.08)' : hasAlert ? 'rgba(248,113,113,0.08)' : 'rgba(34,211,238,0.08)',
          color:      isCompleted ? '#94A3B8'                : hasAlert ? '#F87171'                 : '#22D3EE',
          border:     `1px solid ${isCompleted ? 'rgba(148,163,184,0.2)' : hasAlert ? 'rgba(248,113,113,0.2)' : 'rgba(34,211,238,0.2)'}`,
        }}>
          {isCompleted ? <ShieldCheck style={{ width: '10px', height: '10px' }} /> : hasAlert ? <AlertCircle style={{ width: '10px', height: '10px' }} /> : null}
          {p.status || 'Active'}
        </span>
      </td>
      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
        <button
          onClick={() => onExport(p.patient_id)}
          disabled={downloading === p.patient_id}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '9px 18px', borderRadius: '10px',
            background: hovered ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${hovered ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.08)'}`,
            color: hovered ? '#22D3EE' : '#9CA3AF',
            fontSize: '13px', fontWeight: 600,
            cursor: downloading === p.patient_id ? 'wait' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: downloading === p.patient_id ? 0.6 : 1,
          }}
        >
          {downloading === p.patient_id
            ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
            : <Download style={{ width: '14px', height: '14px' }} />}
          Export PDF
        </button>
      </td>
    </tr>
  );
};

const Reports = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    api.get('/api/patients')
      .then(r => setPatients(r.data.sort((a, b) => new Date(a.admission_time) - new Date(b.admission_time))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExportPDF = async (patientId) => {
    setDownloading(patientId);
    try {
      const resp = await api.get(`/api/export/pdf/${patientId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `partogram_${patientId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Error exporting PDF.');
    } finally {
      setDownloading(null);
    }
  };

  const completed = patients.filter(p => p.status === 'Completed').length;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'radial-gradient(ellipse at top left, #0d1929 0%, #0B1220 55%, #060D18 100%)' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(9,15,27,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1440px', margin: '0 auto' }}>
            <div>
              <h1 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '28px', fontWeight: 700, color: '#F9FAFB', margin: 0, letterSpacing: '-0.02em' }}>
                Clinical Reports
              </h1>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '5px' }}>
                Patient archives · <span style={{ color: '#22D3EE', fontWeight: 600 }}>{patients.length - completed} active</span> · <span style={{ color: '#94A3B8', fontWeight: 600 }}>{completed} completed</span>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText style={{ width: '16px', height: '16px', color: '#22D3EE' }} />
              </div>
              <div>
                <p style={{ fontSize: '10px', color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, margin: 0 }}>Total Records</p>
                <p style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '20px', fontWeight: 700, color: '#F9FAFB', margin: 0 }}>{patients.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ padding: '28px 40px 48px', maxWidth: '1440px', margin: '0 auto' }}>
          <div style={{ background: 'rgba(15,21,37,0.85)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '80px 0', gap: '16px' }}>
                <Loader2 style={{ width: '32px', height: '32px', color: '#22D3EE', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: '14px', color: '#6B7280' }}>Loading records…</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['Date & Time', 'Patient', 'Obstetric History', 'Status', 'Action'].map((h, i) => (
                        <th key={h} style={{ padding: '14px 20px', fontSize: '11px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.09em', textAlign: i === 4 ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {patients.length === 0
                      ? <tr><td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#4B5563', fontSize: '14px' }}>No patient records found.</td></tr>
                      : patients.map(p => <TableRow key={p.id} p={p} downloading={downloading} onExport={handleExportPDF} />)
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Reports;
