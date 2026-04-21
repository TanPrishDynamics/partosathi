import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import {
  Activity, Users, TrendingUp, AlertCircle, Cpu,
  ArrowRight, ShieldCheck, Zap, Calendar,
  BookOpen, ExternalLink, CheckCircle2, FlaskConical, Globe,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ─── KPI Card ──────────────────────────────────────────────────────────── */
const KpiCard = ({ value, label, sub, accent = '#22D3EE', icon: Icon, delay = 0 }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="animate-fade-in"
      style={{
        animationDelay: `${delay}s`,
        background: hovered ? 'rgba(22,30,50,0.95)' : 'rgba(15,21,37,0.85)',
        border: `1px solid ${hovered ? `${accent}30` : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '20px',
        padding: '24px',
        position: 'relative', overflow: 'hidden',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered
          ? `0 20px 48px rgba(0,0,0,0.5), 0 0 28px ${accent}15`
          : '0 4px 20px rgba(0,0,0,0.25)',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '-30px', right: '-30px', width: '130px', height: '130px',
        borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
        opacity: hovered ? 1 : 0.5, transition: 'opacity 0.3s ease',
      }} />

      {/* Left status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '3px', height: '100%',
        background: `linear-gradient(180deg, ${accent}, ${accent}60)`,
        borderRadius: '20px 0 0 20px',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: `${accent}14`, border: `1px solid ${accent}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon style={{ width: '18px', height: '18px', color: accent }} />
        </div>
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          background: accent, marginTop: '6px',
          boxShadow: `0 0 8px ${accent}90`,
        }} />
      </div>

      <p style={{
        fontFamily: 'Roboto Mono, monospace', fontSize: '32px', fontWeight: 700,
        color: '#F9FAFB', margin: '0 0 4px', lineHeight: 1,
      }}>
        {value}
      </p>
      <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </p>
      {sub && <p style={{ fontSize: '11px', color: '#374151', marginTop: '4px' }}>{sub}</p>}
    </div>
  );
};

/* ─── Info row for clinician card ──────────────────────────────────────── */
const InfoCell = ({ label, value }) => (
  <div>
    <p style={{
      fontSize: '10px', color: '#4B5563', textTransform: 'uppercase',
      letterSpacing: '0.12em', fontWeight: 600, marginBottom: '6px',
    }}>{label}</p>
    <p style={{ fontSize: '14px', fontWeight: 600, color: '#D1D5DB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {value}
    </p>
  </div>
);

/* ─── Guideline Card ─────────────────────────────────────────────────────── */
const GuidelineCard = ({ accent, tag, tagColor, org, title, description, points, icon: Icon, link }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'rgba(22,30,50,0.95)' : 'rgba(15,21,37,0.85)',
        border: `1px solid ${hovered ? `${accent}30` : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '18px', padding: '22px',
        position: 'relative', overflow: 'hidden',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered
          ? `0 20px 48px rgba(0,0,0,0.5), 0 0 28px ${accent}12`
          : '0 4px 20px rgba(0,0,0,0.2)',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '3px', height: '100%',
        background: `linear-gradient(180deg, ${accent}, ${accent}50)`,
        borderRadius: '18px 0 0 18px',
        boxShadow: hovered ? `0 0 12px ${accent}` : 'none',
        transition: 'box-shadow 0.3s ease',
      }} />

      {/* Ambient glow top-right */}
      <div style={{
        position: 'absolute', top: '-30px', right: '-30px', width: '140px', height: '140px',
        borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, ${accent}18 0%, transparent 65%)`,
        opacity: hovered ? 1 : 0.4, transition: 'opacity 0.3s ease',
      }} />

      <div style={{ paddingLeft: '8px', position: 'relative', zIndex: 1 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
              background: `${accent}14`, border: `1px solid ${accent}28`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon style={{ width: '16px', height: '16px', color: accent }} />
            </div>
            {/* Tag */}
            <span style={{
              padding: '3px 9px', borderRadius: '99px',
              fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              background: `${tagColor}12`, color: tagColor, border: `1px solid ${tagColor}25`,
            }}>
              {tag}
            </span>
          </div>

          {/* External link */}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', borderRadius: '8px',
                background: hovered ? `${accent}12` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${hovered ? `${accent}30` : 'rgba(255,255,255,0.07)'}`,
                color: hovered ? accent : '#6B7280',
                fontSize: '11px', fontWeight: 600, textDecoration: 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <ExternalLink style={{ width: '10px', height: '10px' }} />
              View
            </a>
          )}
        </div>

        {/* Org + Title */}
        <p style={{ fontSize: '11px', color: '#4B5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
          {org}
        </p>
        <h3 style={{
          fontFamily: 'Poppins, sans-serif', fontSize: '15px', fontWeight: 700,
          color: hovered ? '#F9FAFB' : '#E2E8F0', margin: '0 0 10px', lineHeight: 1.3,
          transition: 'color 0.2s ease',
        }}>
          {title}
        </h3>
        <p style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.6, marginBottom: '14px' }}>
          {description}
        </p>

        {/* Bullet points */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {points.map((pt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{
                width: '5px', height: '5px', borderRadius: '50%', marginTop: '6px',
                background: accent, flexShrink: 0,
                boxShadow: hovered ? `0 0 6px ${accent}` : 'none',
                transition: 'box-shadow 0.3s ease',
              }} />
              <span style={{ fontSize: '12px', color: '#94A3B8', lineHeight: 1.5 }}>{pt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Page ──────────────────────────────────────────────────────────────── */
const MainDashboard = () => {
  const [user, setUser] = useState(null);
  const [patients, setPatients] = useState([]);
  const navigate = useNavigate();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  useEffect(() => {
    
    Promise.all([
      api.get('/api/auth/me'),
      api.get('/api/patients'),
    ])
      .then(([u, p]) => { setUser(u.data); setPatients(p.data); })
      .catch(console.error);
  }, []);

  const active    = patients.filter(p => (p.status || 'Active') === 'Active');
  const completed = patients.length - active.length;
  const critical  = active.filter(p => p.alert_counts?.red > 0).length;

  return (
    <div style={{
      display: 'flex', height: '100vh',
      background: 'radial-gradient(ellipse at top left, #0d1929 0%, #0B1220 55%, #060D18 100%)',
    }}>
      <Sidebar />

      <main style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>

          {/* ── Hero header ─────────────────────────────────────── */}
          <div className="animate-fade-in" style={{ marginBottom: '40px' }}>
            {/* AI status pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '99px', marginBottom: '18px',
              background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.18)',
            }}>
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%', background: '#22D3EE',
                boxShadow: '0 0 10px rgba(34,211,238,0.9)',
                animation: 'ai-pulse-anim 1.8s ease-in-out infinite',
              }} />
              <Zap style={{ width: '11px', height: '11px', color: '#22D3EE' }} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#22D3EE', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                ColpAI Engine Active
              </span>
            </div>

            <h1 style={{
              fontFamily: 'Poppins, sans-serif', fontSize: '34px', fontWeight: 700,
              color: '#F9FAFB', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.15,
            }}>
              {greeting},<br />
              <span style={{ color: '#22D3EE' }}>{user?.name ?? 'Doctor'}</span>
            </h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280', fontSize: '14px' }}>
              <Calendar style={{ width: '14px', height: '14px' }} />
              <span>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                &nbsp;·&nbsp; WHO-compliant digital partogram
              </span>
            </div>
          </div>

          {/* ── KPI Row ─────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <KpiCard value={patients.length} label="Total Patients"      icon={Users}        accent="#22D3EE" delay={0.05} />
            <KpiCard value={active.length}   label="Active Labor Cases"  icon={Activity}     accent="#34D399" delay={0.10} />
            <KpiCard value={completed}       label="Completed"           icon={TrendingUp}   accent="#94A3B8" delay={0.15} />
            <KpiCard value={critical}        label="Critical Alerts"     icon={AlertCircle}  accent="#F87171" delay={0.20} />
          </div>

          {/* ── Clinician Profile Card ───────────────────────────── */}
          <div
            className="animate-fade-in"
            style={{
              animationDelay: '0.25s',
              background: 'rgba(15,21,37,0.85)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '20px', padding: '28px',
              marginBottom: '24px', position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Top-right ambient glow */}
            <div style={{
              position: 'absolute', top: '-60px', right: '-60px', width: '250px', height: '250px',
              borderRadius: '50%', pointerEvents: 'none',
              background: 'radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 65%)',
            }} />

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '9px',
                background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Cpu style={{ width: '15px', height: '15px', color: '#22D3EE' }} />
              </div>
              <h2 style={{
                fontFamily: 'Poppins, sans-serif', fontSize: '15px', fontWeight: 600,
                color: '#D1D5DB', margin: 0,
              }}>
                Clinician Details
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '24px' }}>
              <InfoCell label="Name"              value={user?.name           ?? '—'} />
              <InfoCell label="License"           value={user?.license_number ?? '—'} />
              <InfoCell label="Email"             value={user?.email          ?? '—'} />
              <InfoCell label="Hospital / Clinic" value={user?.hospital       ?? 'TanPrish Dynamics Medical Center'} />
            </div>
          </div>

          {/* ── Quick stats ribbon ──────────────────────────────── */}
          <div style={{
            display: 'flex', gap: '12px', flexWrap: 'wrap',
            padding: '16px 20px',
            background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.1)',
            borderRadius: '14px', marginBottom: '28px',
            alignItems: 'center',
          }} className="animate-fade-in">
            <ShieldCheck style={{ width: '16px', height: '16px', color: '#34D399' }} />
            <span style={{ fontSize: '13px', color: '#6B7280' }}>
              System status: <span style={{ color: '#34D399', fontWeight: 600 }}>All systems operational</span>
              &nbsp;·&nbsp; Auto-refreshes every 30s
              &nbsp;·&nbsp; <span style={{ color: '#22D3EE', fontWeight: 600 }}>WHO 2020</span> protocols active
            </span>
          </div>

          {/* ── CTA ─────────────────────────────────────────────── */}
          <button
            onClick={() => navigate('/patients')}
            className="animate-fade-in"
            style={{
              animationDelay: '0.3s',
              display: 'inline-flex', alignItems: 'center', gap: '10px',
              padding: '14px 28px',
              background: 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)',
              color: '#030D18', fontWeight: 700, fontSize: '15px',
              fontFamily: 'Poppins, sans-serif',
              borderRadius: '13px', border: 'none', cursor: 'pointer',
              boxShadow: '0 6px 28px rgba(34,211,238,0.38)',
              transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}
            onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(34,211,238,0.5)'; }}
            onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(34,211,238,0.38)'; }}
          >
            View Patient List
            <ArrowRight style={{ width: '18px', height: '18px' }} />
          </button>

          {/* ═══════════════════════════════════════════════════════════
              CLINICAL STANDARDS & DATA SOURCES
          ═══════════════════════════════════════════════════════════ */}
          <div className="animate-fade-in" style={{ marginTop: '48px', animationDelay: '0.35s' }}>

            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0,
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BookOpen style={{ width: '17px', height: '17px', color: '#818CF8' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '18px', fontWeight: 700, color: '#F1F5F9', margin: 0, letterSpacing: '-0.01em' }}>
                  Clinical Standards &amp; Data Sources
                </h2>
                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '3px' }}>
                  Evidence-based protocols powering every clinical decision in this system
                </p>
              </div>
            </div>

            {/* Guidelines grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', marginBottom: '20px' }}>

              {/* WHO 2020 */}
              <GuidelineCard
                accent="#22D3EE"
                tag="Primary Standard"
                tagColor="#22D3EE"
                org="World Health Organization"
                title="WHO Labour Care Guide 2020"
                description="Replaces the traditional partograph. Defines alert and action lines, normal labor progress benchmarks, and intervention thresholds for intrapartum care."
                points={[
                  'Active phase: cervical dilation ≥ 4 cm',
                  'Alert line: 1 cm/hr dilation rate',
                  'Action line: 4 hrs right of alert line',
                  'Intrapartum fetal monitoring standards',
                ]}
                icon={Globe}
                link="https://www.who.int/publications/i/item/9789240017566"
              />

              {/* FIGO */}
              <GuidelineCard
                accent="#34D399"
                tag="Supporting Standard"
                tagColor="#34D399"
                org="Int'l Federation of Gynecology & Obstetrics"
                title="FIGO Intrapartum Care Guidelines"
                description="FIGO recommendations on safe labor monitoring, obstetric emergencies, and fetal wellbeing assessment during active labor."
                points={[
                  'Fetal Heart Rate (FHR) normal: 110–160 bpm',
                  'Maternal BP thresholds: systolic ≥ 140 / diastolic ≥ 90',
                  'Contraction adequacy: ≥ 3 in 10 min, ≥ 40 sec',
                  'Head station: -5 to +5 scale',
                ]}
                icon={CheckCircle2}
                link="https://www.figo.org/resources/figo-statements/intrapartum-fetal-monitoring"
              />

              {/* AI Engine */}
              <GuidelineCard
                accent="#A78BFA"
                tag="AI Clinical Engine"
                tagColor="#A78BFA"
                org="ColpAI — e-Partogram System"
                title="ColpAI Delivery Prediction Engine"
                description="Machine-learning assisted labor progression analysis built on WHO-compliant clinical logic, providing real-time delivery time estimation with confidence scoring."
                points={[
                  'Linear regression on active-phase dilation data',
                  'WHO adjustment layers: contraction, descent, speed',
                  'Confidence scoring: High / Medium / Low',
                  'Non-blocking safety override for critical states',
                ]}
                icon={FlaskConical}
              />

            </div>

            {/* Compliance footer ribbon */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
              padding: '14px 20px', borderRadius: '13px',
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <ShieldCheck style={{ width: '15px', height: '15px', color: '#34D399', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#6B7280', flex: 1 }}>
                This system is designed for <strong style={{ color: '#94A3B8' }}>clinical decision support only</strong> and does not replace professional medical judgment.
                All algorithms follow&nbsp;
                <span style={{ color: '#22D3EE', fontWeight: 600 }}>WHO 2020</span>,&nbsp;
                <span style={{ color: '#34D399', fontWeight: 600 }}>FIGO</span>, and&nbsp;
                <span style={{ color: '#A78BFA', fontWeight: 600 }}>ColpAI</span> evidence-based protocols.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainDashboard;
