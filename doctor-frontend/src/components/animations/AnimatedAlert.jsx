import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnimationConfig, getAlertAnimation } from '../../context/AnimationContext';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const icons = {
  critical: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle,
  info: Info
};

const colors = {
  critical: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)', text: '#DC2626' },
  warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', text: '#D97706' },
  success: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', text: '#059669' },
  info: { bg: 'rgba(74,144,226,0.1)', border: 'rgba(74,144,226,0.25)', text: '#4A90E2' },
};

export default function AnimatedAlert({ 
  isVisible = true, 
  type = 'info', 
  title, 
  message, 
  onDismiss,
  style 
}) {
  const config = useAnimationConfig();
  const alertAnim = getAlertAnimation(config, type === 'critical');
  const Icon = icons[type];
  const color = colors[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          layout
          initial={alertAnim.initial}
          animate={alertAnim.animate}
          exit={alertAnim.exit}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '14px 16px',
            borderRadius: '16px',
            background: color.bg,
            border: `1px solid ${color.border}`,
            backdropFilter: 'blur(12px)',
            willChange: 'transform, opacity',
            ...style
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '50%',
            background: `rgba(255,255,255,0.5)`,
            flexShrink: 0
          }}>
            <Icon style={{ width: '16px', height: '16px', color: color.text }} />
          </div>
          
          <div style={{ flex: 1 }}>
            {title && (
              <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 700, color: color.text }}>
                {title}
              </h4>
            )}
            <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>
              {message}
            </p>
          </div>

          {onDismiss && (
            <button 
              onClick={onDismiss}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                opacity: 0.6,
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>&times;</span>
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
