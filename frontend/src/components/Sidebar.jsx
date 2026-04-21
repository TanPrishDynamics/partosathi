import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { Activity, Users, UserPlus, LogOut, LayoutDashboard, FileText, LogIn, Zap } from 'lucide-react';
import { AuthContext } from '../App';

const NAV = [
  { to: null,           label: 'Dashboard',   icon: LayoutDashboard, dynamic: true },
  { to: '/patients',    label: 'Patients',    icon: Users },
  { to: '/new-patient', label: 'New Patient', icon: UserPlus },
  { to: '/reports',     label: 'Reports',     icon: FileText },
];

const Sidebar = () => {
  const [user, setUser] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const { onLogout } = useContext(AuthContext);

  useEffect(() => {
    api.get('/api/auth/me')
      .then(r => setUser(r.data)).catch(() => {});
  }, []);

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div style={{
      width: '232px', minHeight: '100vh', flexShrink: 0,
      background: 'rgba(5,10,20,0.97)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column',
      padding: '24px 14px',
      position: 'sticky', top: 0, zIndex: 50,
    }}>

      {/* ── Logo ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '0 6px', marginBottom: '28px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0,
          background: 'linear-gradient(135deg, #22D3EE 0%, #14B8A6 100%)',
          boxShadow: '0 4px 20px rgba(34,211,238,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Activity style={{ width: '20px', height: '20px', color: '#030D18' }} />
        </div>
        <div>
          <div style={{
            fontFamily: 'Poppins, sans-serif', fontSize: '16px', fontWeight: 700,
            color: '#F9FAFB', lineHeight: 1, letterSpacing: '-0.01em',
          }}>
            e-Partogram
          </div>
          <div style={{
            fontSize: '9px', color: '#4B5563', textTransform: 'uppercase',
            letterSpacing: '0.12em', fontWeight: 600, marginTop: '3px',
          }}>
            ColpAI Engine
          </div>
        </div>
      </div>

      {/* ── AI Pulse chip ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '9px 14px', marginBottom: '22px',
        background: 'rgba(34,211,238,0.06)',
        border: '1px solid rgba(34,211,238,0.14)',
        borderRadius: '11px',
        boxShadow: '0 0 20px rgba(34,211,238,0.04) inset',
      }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: '#22D3EE', flexShrink: 0,
          boxShadow: '0 0 10px rgba(34,211,238,0.9)',
          animation: 'ai-pulse-anim 1.8s ease-in-out infinite',
        }} />
        <Zap style={{ width: '11px', height: '11px', color: '#22D3EE' }} />
        <span style={{
          fontSize: '10px', fontWeight: 700, color: '#22D3EE',
          textTransform: 'uppercase', letterSpacing: '0.09em',
        }}>
          AI Monitoring Active
        </span>
      </div>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <div style={{ height: '1px', background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)', margin: '0 4px 18px' }} />

      {/* ── Nav links ────────────────────────────────────────────── */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {NAV.map(({ to, label, icon: Icon, dynamic }) => {
          const href = dynamic ? (id ? `/dashboard/${id}` : '/dashboard') : to;
          return (
            <NavLink
              key={label}
              to={href}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '11px',
                padding: '11px 14px', borderRadius: '11px',
                fontSize: '14px', fontWeight: isActive ? 600 : 500,
                fontFamily: 'Roboto, sans-serif',
                textDecoration: 'none',
                transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                border: `1px solid ${isActive ? 'rgba(34,211,238,0.18)' : 'transparent'}`,
                background: isActive
                  ? 'rgba(34,211,238,0.1)'
                  : 'transparent',
                color: isActive ? '#22D3EE' : '#9CA3AF',
                position: 'relative',
                boxShadow: isActive ? '0 0 20px rgba(34,211,238,0.06) inset' : 'none',
              })}
            >
              {({ isActive }) => (
                <>
                  {/* Active glow dot */}
                  {isActive && (
                    <span style={{
                      position: 'absolute', left: '-1px', top: '50%',
                      transform: 'translateY(-50%)',
                      width: '3px', height: '24px', borderRadius: '0 3px 3px 0',
                      background: 'linear-gradient(180deg, #22D3EE, #0EA5E9)',
                      boxShadow: '0 0 8px rgba(34,211,238,0.5)',
                    }} />
                  )}
                  <Icon style={{
                    width: '18px', height: '18px', flexShrink: 0,
                    color: isActive ? '#22D3EE' : '#6B7280',
                    transition: 'color 0.2s ease',
                  }} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── User card ────────────────────────────────────────────── */}
      {user && (
        <div style={{
          margin: '18px 0 10px',
          padding: '13px',
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '13px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 14px rgba(34,211,238,0.1) inset',
            }}>
              <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: '15px', fontWeight: 700, color: '#22D3EE' }}>
                {user.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{
                fontSize: '13px', fontWeight: 600, color: '#D1D5DB',
                margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.name}
              </p>
              {user.license_number && (
                <p style={{
                  fontSize: '9px', color: '#4B5563', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '2px',
                }}>
                  {user.license_number}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sign out ─────────────────────────────────────────────── */}
      <button
        onClick={handleLogout}
        style={{
          display: 'flex', alignItems: 'center', gap: '11px',
          padding: '10px 14px', borderRadius: '11px',
          fontSize: '14px', fontWeight: 500,
          fontFamily: 'Roboto, sans-serif',
          color: '#4B3333',
          background: 'none', border: '1px solid transparent',
          cursor: 'pointer', transition: 'all 0.2s ease', width: '100%',
        }}
        onMouseOver={e => {
          e.currentTarget.style.background = 'rgba(239,68,68,0.07)';
          e.currentTarget.style.color = '#F87171';
          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.14)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.color = '#4B3333';
          e.currentTarget.style.borderColor = 'transparent';
        }}
      >
        <LogOut style={{ width: '17px', height: '17px', flexShrink: 0 }} />
        <span>Sign out</span>
      </button>
    </div>
  );
};

export default Sidebar;
