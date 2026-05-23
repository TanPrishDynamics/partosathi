import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Activity, Clock, Mail, LogOut, RefreshCw } from 'lucide-react';
import api from '../services/api';

const PendingApproval = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const status     = location.state?.status || 'pending';
  const isRejected = status === 'rejected';

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    navigate('/login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F5F7FA',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: '12px', padding: '48px 40px',
        maxWidth: '440px', width: '100%', textAlign: 'center',
        border: '1px solid #E5E7EB',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>

        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '28px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: '#FFF', border: '1px solid #E5E7EB',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
          }}>
            <img src="/logo.jpg" alt="PartoSathi Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', fontWeight: 700, color: '#111827' }}>
            PartoSathi
          </span>
        </div>

        {/* Status icon */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '12px', margin: '0 auto 20px',
          background: isRejected ? '#FEF2F2' : '#FFFBEB',
          border: `1px solid ${isRejected ? '#FECACA' : '#FDE68A'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isRejected
            ? <span style={{ fontSize: '32px', color: '#DC2626' }}>✕</span>
            : <Clock style={{ width: '32px', height: '32px', color: '#D97706' }} />
          }
        </div>

        <h1 style={{
          fontFamily: 'Inter, system-ui, sans-serif', fontSize: '20px', fontWeight: 700,
          color: '#111827', margin: '0 0 10px', letterSpacing: '-0.01em',
        }}>
          {isRejected ? 'Account Not Approved' : 'Awaiting Admin Approval'}
        </h1>

        <p style={{ color: '#6B7280', fontSize: '13.5px', lineHeight: 1.65, margin: '0 0 24px' }}>
          {isRejected
            ? 'Your account request was not approved. Please contact your administrator or support team for more information.'
            : 'Your account is currently under review. An administrator will approve your request and you will receive an email once activated.'
          }
        </p>

        {/* Status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          padding: '6px 14px', borderRadius: '6px', marginBottom: '24px',
          background: isRejected ? '#FEF2F2' : '#FFFBEB',
          border: `1px solid ${isRejected ? '#FECACA' : '#FDE68A'}`,
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
            background: isRejected ? '#DC2626' : '#D97706',
          }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: isRejected ? '#DC2626' : '#D97706', letterSpacing: '0.04em' }}>
            {isRejected ? 'REJECTED' : 'PENDING REVIEW'}
          </span>
        </div>

        {/* Info steps (pending only) */}
        {!isRejected && (
          <div style={{
            background: '#EFF6FF', border: '1px solid #BFDBFE',
            borderRadius: '8px', padding: '14px 16px', marginBottom: '24px', textAlign: 'left',
          }}>
            {[
              { n: 1, text: 'Admin reviews your request' },
              { n: 2, text: 'You receive an approval email' },
              { n: 3, text: 'Log in and start monitoring patients' },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  background: '#DBEAFE', border: '1px solid #BFDBFE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700, color: '#2563EB',
                }}>
                  {n}
                </div>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Contact */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          fontSize: '12px', color: '#9CA3AF', marginBottom: '24px',
        }}>
          <Mail style={{ width: '13px', height: '13px' }} />
          Questions? Contact <strong style={{ color: '#6B7280', marginLeft: '4px' }}>admin@tanprish-dynamics.com</strong>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!isRejected && (
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '11px', borderRadius: '6px',
                border: '1px solid #BFDBFE',
                background: '#EFF6FF', color: '#2563EB',
                fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                fontFamily: 'Inter, system-ui, sans-serif',
                transition: 'all 0.15s ease',
              }}
            >
              <RefreshCw style={{ width: '14px', height: '14px' }} />
              Check Status
            </button>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '11px', borderRadius: '6px',
              border: '1px solid #FECACA',
              background: '#FEF2F2', color: '#DC2626',
              fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'all 0.15s ease',
            }}
          >
            <LogOut style={{ width: '14px', height: '14px' }} />
            Back to Login
          </button>
        </div>

        <p style={{ fontSize: '11px', color: '#D1D5DB', marginTop: '20px' }}>
          TanPrish Dynamics © 2026 · SaMD-grade Clinical Platform
        </p>
      </div>
    </div>
  );
};

export default PendingApproval;
