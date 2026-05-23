import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MESSAGES = [
  'Initializing PartoSathi...',
  'Loading WHO 2020 protocol...',
  'Calibrating ColpAI engine...',
  'Connecting clinical systems...',
  'Ready.',
];

/* Simple ECG line */
function ECGLine({ progress }) {
  const ecgPath = `M 0 30 L 20 30 L 30 30 L 40 30 L 50 5 L 60 55 L 70 10 L 80 50 L 90 30 L 110 30 L 120 30`;
  return (
    <svg width="140" height="60" viewBox="0 0 140 60" style={{ overflow: 'visible' }}>
      <path
        d={ecgPath}
        fill="none"
        stroke="#2563EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.8"
        style={{
          strokeDasharray: 300,
          strokeDashoffset: 300 - (progress / 100) * 300,
          transition: 'stroke-dashoffset 0.15s ease',
        }}
      />
    </svg>
  );
}

export default function LoadingScreen({ onComplete }) {
  const [progress, setProgress]   = useState(0);
  const [msgIdx, setMsgIdx]       = useState(0);
  const [done, setDone]           = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    let p = 0;
    intervalRef.current = setInterval(() => {
      p += Math.random() * 14 + 4;
      if (p >= 100) {
        p = 100;
        clearInterval(intervalRef.current);
        setTimeout(() => {
          setDone(true);
          setTimeout(onComplete, 600);
        }, 300);
      }
      setProgress(Math.min(100, p));
      setMsgIdx(Math.floor((Math.min(100, p) / 100) * (MESSAGES.length - 1)));
    }, 140);

    return () => clearInterval(intervalRef.current);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#FFFFFF',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '20px', fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {/* Logo mark */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 14, margin: '0 auto',
              background: '#FFF',
              border: '1px solid #E5E7EB',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}>
              <img src="/logo.jpg" alt="PartoSathi Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          </motion.div>

          {/* Brand name */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            style={{ textAlign: 'center' }}
          >
            <h1 style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 20, fontWeight: 700, color: '#111827',
              letterSpacing: '-0.01em', marginBottom: 4,
            }}>
              PartoSathi{' '}
              <span style={{ color: '#2563EB' }}>Pro</span>
            </h1>
            <p style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.16em',
              color: '#9CA3AF', textTransform: 'uppercase',
            }}>
              WHO 2020 · ColpAI Engine
            </p>
          </motion.div>

          {/* ECG line */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <ECGLine progress={progress} />
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            style={{ width: 240 }}
          >
            <div style={{
              height: 3, background: '#E5E7EB',
              borderRadius: 9999, overflow: 'hidden', marginBottom: 10,
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: '#2563EB',
                borderRadius: 9999,
                transition: 'width 0.15s ease',
              }} />
            </div>

            {/* Status text */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{
                fontSize: 11, color: '#6B7280',
                fontFamily: 'DM Mono, monospace', fontWeight: 500,
              }}>
                {MESSAGES[msgIdx]}
              </p>
              <span style={{
                fontSize: 11, fontFamily: 'DM Mono, monospace',
                color: '#9CA3AF', fontWeight: 600,
              }}>
                {Math.round(progress)}%
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
