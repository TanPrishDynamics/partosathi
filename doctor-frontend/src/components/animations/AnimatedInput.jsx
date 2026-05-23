import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAnimationConfig } from '../../context/AnimationContext';

export default function AnimatedInput({ 
  label, 
  value, 
  onChange, 
  placeholder, 
  type = 'text', 
  error,
  style, 
  ...props 
}) {
  const config = useAnimationConfig();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: config.duration.standard, ease: config.easing.smooth }}
      style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}
    >
      {label && (
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
      )}
      
      <motion.div
        animate={{
          boxShadow: isFocused ? '0 0 0 3px rgba(74, 144, 226, 0.15)' : '0 0 0 0px rgba(74, 144, 226, 0)',
          borderColor: error ? '#EF4444' : isFocused ? '#4A90E2' : 'rgba(255,255,255,0.7)'
        }}
        transition={{ duration: config.duration.standard, ease: config.easing.smooth }}
        style={{
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.8)',
          border: '1px solid',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        <input
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '12px 14px',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontSize: '14px',
            color: '#1E293B',
            width: '100%'
          }}
          {...props}
        />
      </motion.div>
      
      {error && (
        <motion.span 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: config.duration.micro, ease: config.easing.sharp }}
          style={{ fontSize: '11px', color: '#EF4444', fontWeight: 500 }}
        >
          {error}
        </motion.span>
      )}
    </motion.div>
  );
}
