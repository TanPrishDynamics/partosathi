import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import {
  Activity, Users, UserPlus, LogOut, LayoutDashboard,
  FileText, HelpCircle, Bell, TrendingUp, CreditCard,
  ChevronRight,
} from 'lucide-react';
import { AuthContext } from '../App';

const NAV = [
  { to: null,            label: 'Dashboard',    icon: LayoutDashboard, dynamic: true },
  { to: '/patients',     label: 'Patients',     icon: Users },
  { to: '/new-patient',  label: 'New Patient',  icon: UserPlus },
  { to: '/productivity', label: 'Productivity', icon: TrendingUp },
  { to: '/reports',      label: 'Reports',      icon: FileText },
  { to: '/help',         label: 'Help Center',  icon: HelpCircle },
];

const NavItem = ({ to, label, icon: Icon }) => (
  <NavLink
    to={to}
    style={({ isActive }) => ({
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '9px 12px', borderRadius: '6px',
      fontSize: '13.5px', fontWeight: isActive ? 600 : 400,
      fontFamily: 'Inter, system-ui, sans-serif',
      textDecoration: 'none',
      transition: 'all 0.15s ease',
      borderLeft: isActive ? '3px solid #2563EB' : '3px solid transparent',
      background: isActive ? '#EFF6FF' : 'transparent',
      color: isActive ? '#2563EB' : '#6B7280',
      paddingLeft: isActive ? '10px' : '12px',
    })}
  >
    {({ isActive }) => (
      <>
        <Icon style={{
          width: '16px', height: '16px', flexShrink: 0,
          color: isActive ? '#2563EB' : '#9CA3AF',
          transition: 'color 0.15s ease',
        }} />
        <span>{label}</span>
        {isActive && (
          <ChevronRight style={{ width: '13px', height: '13px', marginLeft: 'auto', color: '#93C5FD' }} />
        )}
      </>
    )}
  </NavLink>
);

const Sidebar = () => {
  const [user, setUser]          = useState(null);
  const [unreadCount, setUnread] = useState(0);
  const { id }  = useParams();
  const navigate = useNavigate();
  const { onLogout } = useContext(AuthContext);

  useEffect(() => {
    api.get('/api/auth/me')
      .then(r => setUser(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    const fetch = () => {
      api.get('/api/admin/notifications')
        .then(r => setUnread((r.data || []).filter(n => !n.is_read).length))
        .catch(() => {});
    };
    fetch();
    const t = setInterval(fetch, 60000);
    return () => clearInterval(t);
  }, [user]);

  const handleLogout = () => { onLogout(); navigate('/login'); };

  const quotaPct = user?.patient_limit > 0
    ? (user.patients_used / user.patient_limit) * 100 : 0;
  const quotaColor = quotaPct >= 90 ? '#DC2626' : quotaPct >= 70 ? '#F59E0B' : '#16A34A';

  return (
    <div style={{
      width: '220px', minHeight: '100vh', flexShrink: 0,
      background: '#FFFFFF',
      borderRight: '1px solid #E5E7EB',
      boxShadow: '1px 0 4px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column',
      padding: '20px 12px',
      position: 'sticky', top: 0, zIndex: 50,
    }}>

      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 4px', marginBottom: '24px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
          background: '#FFF',
          border: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
        }}>
          <img src="/logo.jpg" alt="PartoSathi Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{
            fontFamily: 'Inter, system-ui, sans-serif', fontSize: '15px', fontWeight: 700,
            color: '#111827', letterSpacing: '-0.01em',
          }}>
            PartoSathi
          </div>
          <div style={{
            fontSize: '10px', color: '#9CA3AF', textTransform: 'uppercase',
            letterSpacing: '0.08em', fontWeight: 500, marginTop: '1px',
          }}>
            Clinical System
          </div>
        </div>
      </div>

      {/* ── AI status chip ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 10px', marginBottom: '20px',
        background: '#F0FDF4',
        border: '1px solid #BBF7D0',
        borderRadius: '6px',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: '#16A34A', flexShrink: 0,
          animation: 'pulse-soft 2s ease-in-out infinite',
        }} />
        <span style={{
          fontSize: '11px', fontWeight: 600, color: '#15803D',
          letterSpacing: '0.02em',
        }}>
          AI Monitoring Active
        </span>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────── */}
      <div style={{ height: '1px', background: '#F3F4F6', margin: '0 4px 14px' }} />

      {/* ── Nav links ─────────────────────────────────────────────── */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV.map(({ to, label, icon, dynamic }) => {
          const href = dynamic ? (id ? `/dashboard/${id}` : '/dashboard') : to;
          return <NavItem key={label} to={href} label={label} icon={icon} />;
        })}
      </nav>

      {/* ── Admin notification bell ───────────────────────────────── */}
      {user?.role === 'admin' && (
        <NavLink
          to="/admin/pending"
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 12px', borderRadius: '6px', marginBottom: '4px',
            fontSize: '13.5px', fontWeight: 500, textDecoration: 'none',
            transition: 'all 0.15s ease',
            background: unreadCount > 0 ? '#FEF2F2' : 'transparent',
            borderLeft: unreadCount > 0 ? '3px solid #DC2626' : '3px solid transparent',
            color: unreadCount > 0 ? '#DC2626' : '#6B7280',
          })}
        >
          <div style={{ position: 'relative' }}>
            <Bell style={{ width: '16px', height: '16px' }} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-5px', right: '-7px',
                background: '#DC2626', color: '#fff',
                borderRadius: '50%', fontSize: '9px', fontWeight: 700,
                width: '14px', height: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span>Approvals {unreadCount > 0 ? `(${unreadCount})` : ''}</span>
        </NavLink>
      )}

      {/* ── Quota meter ──────────────────────────────────────────── */}
      {user?.role === 'doctor' && user.patient_limit > 0 && (
        <div style={{
          margin: '4px 0 8px', padding: '10px 12px',
          background: '#F9FAFB',
          border: '1px solid #E5E7EB', borderRadius: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Credits
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: quotaColor, fontFamily: 'DM Mono, monospace' }}>
              {user.patients_used}/{user.patient_limit}
            </span>
          </div>
          <div style={{ height: '4px', background: '#E5E7EB', borderRadius: '9999px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{
              height: '100%', borderRadius: '9999px',
              width: `${Math.min(100, quotaPct)}%`,
              background: quotaColor,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <NavLink to="/productivity" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            padding: '5px 10px', borderRadius: '5px', textDecoration: 'none',
            fontSize: '11px', fontWeight: 600, color: '#2563EB',
            background: '#EFF6FF', border: '1px solid #BFDBFE',
          }}>
            <CreditCard style={{ width: '11px', height: '11px' }} />
            <span>Request Credits</span>
          </NavLink>
        </div>
      )}

      {/* ── Divider ───────────────────────────────────────────────── */}
      <div style={{ height: '1px', background: '#F3F4F6', margin: '8px 4px' }} />

      {/* ── User card ─────────────────────────────────────────────── */}
      {user && (
        <div style={{
          padding: '10px 12px',
          background: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: '6px', marginBottom: '6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '6px', flexShrink: 0,
              background: '#EFF6FF', border: '1px solid #BFDBFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '13px', fontWeight: 700, color: '#2563EB' }}>
                {user.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                fontSize: '12.5px', fontWeight: 600, color: '#111827', margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.name}
              </p>
              {user.license_number && (
                <p style={{
                  fontSize: '9.5px', color: '#9CA3AF', fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '1px',
                  fontFamily: 'DM Mono, monospace',
                }}>
                  {user.license_number}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sign out ──────────────────────────────────────────────── */}
      <button
        onClick={handleLogout}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 12px', borderRadius: '6px',
          fontSize: '13px', fontWeight: 500,
          fontFamily: 'Inter, system-ui, sans-serif',
          color: '#6B7280', background: 'none', border: '1px solid transparent',
          cursor: 'pointer', transition: 'all 0.15s ease', width: '100%',
        }}
        onMouseOver={e => {
          e.currentTarget.style.background = '#FEF2F2';
          e.currentTarget.style.color = '#DC2626';
          e.currentTarget.style.borderColor = '#FECACA';
        }}
        onMouseOut={e => {
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.color = '#6B7280';
          e.currentTarget.style.borderColor = 'transparent';
        }}
      >
        <LogOut style={{ width: '15px', height: '15px', flexShrink: 0 }} />
        <span>Sign out</span>
      </button>
    </div>
  );
};

export default Sidebar;
