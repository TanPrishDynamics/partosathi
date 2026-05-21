import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Users, AlertTriangle, Lock } from 'lucide-react';

const PatientQuotaMeter = ({ compact = false }) => {
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    api.get('/api/doctor/quota')
      .then(r => setQuota(r.data))
      .catch(() => {});
  }, []);

  if (!quota) return null;

  const { patients_used, patient_limit, remaining, quota_reached, quota_pct } = quota;
  const isWarning = quota_pct >= 80 && !quota_reached;

  const barColor   = quota_reached ? '#DC2626' : isWarning ? '#F59E0B' : '#16A34A';
  const borderColor = quota_reached ? '#FECACA' : isWarning ? '#FDE68A' : '#BBF7D0';
  const bgColor    = quota_reached ? '#FEF2F2' : isWarning ? '#FFFBEB' : '#F0FDF4';

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 10px', borderRadius: '6px',
        background: bgColor, border: `1px solid ${borderColor}`,
      }}>
        {quota_reached
          ? <Lock style={{ width: '12px', height: '12px', color: '#DC2626', flexShrink: 0 }} />
          : <Users style={{ width: '12px', height: '12px', color: barColor, flexShrink: 0 }} />}
        <span style={{
          fontSize: '11.5px', fontWeight: 700, color: barColor,
          fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap',
        }}>
          {patients_used}/{patient_limit} patients
        </span>
      </div>
    );
  }

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '8px',
      padding: '14px 18px',
      marginBottom: '18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          {quota_reached
            ? <Lock style={{ width: '13px', height: '13px', color: '#DC2626' }} />
            : isWarning
            ? <AlertTriangle style={{ width: '13px', height: '13px', color: '#F59E0B' }} />
            : <Users style={{ width: '13px', height: '13px', color: '#16A34A' }} />}
          <span style={{
            fontSize: '11px', fontWeight: 700, color: '#6B7280',
            fontFamily: 'Inter, system-ui, sans-serif', textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            Patient Quota
          </span>
        </div>
        <span style={{
          fontSize: '13px', fontWeight: 700, color: barColor,
          fontFamily: 'DM Mono, monospace',
        }}>
          {patients_used} / {patient_limit}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '4px', background: '#E5E7EB',
        borderRadius: '9999px', overflow: 'hidden', marginBottom: '8px',
      }}>
        <div style={{
          height: '100%', borderRadius: '9999px',
          width: `${Math.min(100, quota_pct)}%`,
          background: barColor,
          transition: 'width 0.5s ease',
        }} />
      </div>

      <p style={{
        fontSize: '12px', fontFamily: 'Inter, system-ui, sans-serif',
        color: barColor, margin: 0, fontWeight: 500,
      }}>
        {quota_reached
          ? 'Quota reached. Contact your administrator to register more patients.'
          : isWarning
          ? `Warning: ${remaining} slot${remaining !== 1 ? 's' : ''} remaining.`
          : `${remaining} slot${remaining !== 1 ? 's' : ''} remaining`}
      </p>
    </div>
  );
};

export default PatientQuotaMeter;
