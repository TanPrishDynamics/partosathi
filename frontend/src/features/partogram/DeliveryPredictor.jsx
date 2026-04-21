import React, { useMemo, useRef, useEffect } from 'react';
import { differenceInMinutes } from 'date-fns';
import {
  Clock, Brain, AlertTriangle, ShieldCheck, TrendingUp,
  Zap, Activity, Info, Ban,
} from 'lucide-react';
import { computeWHOClassification, computeDeliveryPrediction } from '../../utils/colpai';

// ── Confidence config ──────────────────────────────────────────────────────────
const CONF_STYLE = {
  HIGH:   { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)',  text: '#34D399', label: 'HIGH',   dot: '#34D399' },
  MEDIUM: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', text: '#FBBF24', label: 'MEDIUM', dot: '#FBBF24' },
  LOW:    { bg: 'rgba(148,163,184,0.07)',border: 'rgba(148,163,184,0.2)', text: '#94A3B8', label: 'LOW',    dot: '#94A3B8' },
};

const FLAG_ICONS = {
  'Inadequate uterine activity':        'Contractions',
  'No fetal head descent':             'Descent',
  'Slow labor progress (< 1 cm/hr)':   'Slow',
  'Rapid labor progress (> 1.5 cm/hr)':'Rapid',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

const ProgressBar = ({ pct }) => (
  <div style={{ width: '100%' }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: '#4B5563', marginBottom: '6px',
    }}>
      <span>4 cm (Active Phase)</span>
      <span>10 cm (Full Dilation)</span>
    </div>
    <div style={{
      position: 'relative', height: '8px', borderRadius: '99px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
    }}>
      {/* Track fill */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${pct}%`,
        background: 'linear-gradient(90deg, #22D3EE 0%, #14B8A6 100%)',
        borderRadius: '99px',
        boxShadow: '0 0 12px rgba(34,211,238,0.5)',
        transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
      }} />
      {/* Tick marks at 1/6 intervals (4→5→6→7→8→9→10) */}
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${(i / 6) * 100}%`,
          width: '1px', background: 'rgba(255,255,255,0.08)',
        }} />
      ))}
    </div>
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: '9px', color: '#374151', marginTop: '4px',
    }}>
      {[4,5,6,7,8,9,10].map(cm => (
        <span key={cm}>{cm}</span>
      ))}
    </div>
  </div>
);

const ConfidenceBadge = ({ level }) => {
  if (!level) return null;
  const s = CONF_STYLE[level];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '99px',
      background: s.bg, border: `1px solid ${s.border}`,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      <span style={{ fontSize: '10px', fontWeight: 700, color: s.text, letterSpacing: '0.08em' }}>
        {s.label} CONFIDENCE
      </span>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const DeliveryPredictor = ({ patient, observations }) => {
  const prevPredRef = useRef(null);

  const { pred, parsedCount } = useMemo(() => {
    if (!patient || !observations || observations.length === 0) {
      return { pred: null, parsedCount: 0 };
    }

    const admissionTime = new Date(patient.admission_time);
    const parsedObs = observations
      .map(obs => ({
        ...obs,
        hourOffset: differenceInMinutes(new Date(obs.timestamp), admissionTime) / 60,
      }))
      .sort((a, b) => a.hourOffset - b.hourOffset);

    const firstActive = parsedObs.find(
      o => o.cervical_dilation !== null && o.cervical_dilation >= 4
    );
    const timeAt4cm = firstActive ? firstActive.hourOffset : null;
    const whoResult = computeWHOClassification(parsedObs, timeAt4cm);
    const pred = computeDeliveryPrediction(parsedObs, whoResult);

    return { pred, parsedCount: parsedObs.length };
  }, [patient, observations]);

  // Detect when prediction updates (animate)
  const cardRef = useRef(null);
  useEffect(() => {
    if (!pred || !cardRef.current) return;
    const prev = prevPredRef.current;
    if (prev !== null && prev !== pred.expected_time_remaining_hours) {
      cardRef.current.animate(
        [{ boxShadow: '0 0 0 3px rgba(34,211,238,0.4)' }, { boxShadow: '0 0 0 0px rgba(34,211,238,0)' }],
        { duration: 900, easing: 'ease-out' }
      );
    }
    prevPredRef.current = pred?.expected_time_remaining_hours ?? null;
  }, [pred]);

  if (!pred) return null;

  return (
    <div
      ref={cardRef}
      className="glass-card animate-fade-in"
      style={{ borderRadius: '18px', overflow: 'hidden', position: 'relative' }}
    >
      {/* Top accent bar */}
      <div style={{
        height: '3px',
        background: pred.available
          ? 'linear-gradient(90deg, #22D3EE 0%, #14B8A6 60%, transparent 100%)'
          : 'linear-gradient(90deg, #475569 0%, transparent 100%)',
      }} />

      {/* Glow blob */}
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px',
        width: '220px', height: '220px', borderRadius: '50%', pointerEvents: 'none',
        background: pred.available
          ? 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 65%)'
          : 'none',
      }} />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain style={{ width: '18px', height: '18px', color: '#22D3EE' }} />
          </div>
          <div>
            <h3 style={{
              fontFamily: 'Roboto, system-ui, sans-serif', fontSize: '15px', fontWeight: 700,
              color: '#F1F5F9', margin: 0, lineHeight: 1,
            }}>
              Delivery Prediction
            </h3>
            <p style={{ fontSize: '10px', color: '#4B5563', margin: '3px 0 0', letterSpacing: '0.06em' }}>
              ColpAI · Data-driven · WHO 2020 Adjusted
            </p>
          </div>
        </div>

        {/* Live indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '5px 10px', borderRadius: '99px',
          background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.1)',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#22D3EE', boxShadow: '0 0 8px rgba(34,211,238,0.7)',
            animation: 'ai-pulse-anim 1.8s ease-in-out infinite',
          }} />
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#22D3EE', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Live
          </span>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px 24px' }}>

        {pred.available ? (
          <>
            {/* Urgent warning banner (prediction still shown) */}
            {pred.urgentWarning && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              }}>
                <AlertTriangle style={{ width: '14px', height: '14px', color: '#F87171', marginTop: '1px', flexShrink: 0 }} />
                <p style={{ fontSize: '11px', color: '#F87171', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
                  {pred.urgentWarning}
                </p>
              </div>
            )}

            {/* Big time display */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '6px' }}>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4B5563', marginBottom: '4px' }}>
                  Expected Time to Full Dilation
                </div>
                <div style={{
                  fontFamily: 'Roboto Mono, monospace', fontSize: '34px', fontWeight: 500,
                  color: '#F1F5F9', lineHeight: 1, letterSpacing: '-0.02em',
                }}>
                  {pred.estimated_delivery_window}
                </div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '5px' }}>
                  ~{pred.expected_time_remaining_hours}h remaining · currently at{' '}
                  <span style={{ color: '#22D3EE', fontWeight: 700 }}>{pred.current_dilation_cm} cm</span>
                </div>
              </div>

              {/* Rate + Confidence column */}
              <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontSize: '20px', fontWeight: 500, color: '#22D3EE',
                  fontFamily: 'Roboto Mono, monospace', lineHeight: 1,
                }}>
                  {pred.dilation_rate_cmhr} cm/hr
                </div>
                <div style={{ fontSize: '9px', color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '3px' }}>
                  Dilation Rate
                </div>
                <div style={{ marginTop: '8px' }}>
                  <ConfidenceBadge level={pred.confidence} />
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ margin: '18px 0' }}>
              <ProgressBar pct={pred.progress_pct} />
            </div>

            {/* Clinical adjustment flags */}
            {pred.clinical_flags.length > 0 && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4B5563', marginBottom: '7px' }}>
                  Clinical Adjustments Applied
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {pred.clinical_flags.map((flag, i) => (
                    <div key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 10px', borderRadius: '99px',
                      background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.18)',
                      fontSize: '11px', color: '#FBBF24', fontWeight: 600,
                    }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.7 }}>{FLAG_ICONS[flag] ?? 'Note'}</span>
                      {flag}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pred.clinical_flags.length === 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '99px', marginBottom: '14px',
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)',
              }}>
                <ShieldCheck style={{ width: '12px', height: '12px', color: '#34D399' }} />
                <span style={{ fontSize: '11px', color: '#34D399', fontWeight: 600 }}>
                  Normal progress — no adverse factors detected
                </span>
              </div>
            )}

            {/* Explanation */}
            <div style={{
              padding: '11px 14px', borderRadius: '10px',
              background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.1)',
              marginBottom: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <Activity style={{ width: '13px', height: '13px', color: '#22D3EE', marginTop: '1px', flexShrink: 0 }} />
                <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
                  <span style={{ color: '#22D3EE', fontWeight: 700 }}>Model logic: </span>
                  {pred.explanation}
                </p>
              </div>
            </div>
          </>
        ) : (
          /* Unavailable state */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '28px 0 18px', gap: '14px', textAlign: 'center',
          }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ban style={{ width: '24px', height: '24px', color: '#4B5563' }} />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#94A3B8', margin: '0 0 6px' }}>
                Prediction Unavailable
              </p>
              <p style={{ fontSize: '12px', color: '#4B5563', margin: 0, maxWidth: '360px', lineHeight: 1.6 }}>
                {pred.unavailableReason}
              </p>
            </div>
            <div style={{
              padding: '8px 14px', borderRadius: '9px',
              background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)',
              fontSize: '11px', color: '#F87171',
            }}>
              <AlertTriangle style={{ width: '11px', height: '11px', display: 'inline', marginRight: '5px' }} />
              {pred.unavailableReason?.includes('active phase')
                ? 'Enter at least 2 active-phase observations (≥ 4 cm) to enable prediction'
                : pred.unavailableReason?.includes('10 cm')
                ? 'Patient has reached full dilation'
                : 'Ensure observations show a positive dilation trend'}
            </div>
          </div>
        )}

        {/* ── Medical disclaimer (always) ───────────────────────────────── */}
        <div style={{
          marginTop: pred.available ? '0' : '4px',
          paddingTop: '13px', borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'flex-start', gap: '7px',
        }}>
          <Info style={{ width: '12px', height: '12px', color: '#374151', marginTop: '1px', flexShrink: 0 }} />
          <p style={{ fontSize: '10px', color: '#374151', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
            <span style={{ fontStyle: 'normal', fontWeight: 700, color: '#4B5563' }}>AI-Assisted Estimate — </span>
            This is a clinical decision-support tool. Final decisions must be made by a qualified obstetrician.
            Prediction updates automatically with each new observation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DeliveryPredictor;
