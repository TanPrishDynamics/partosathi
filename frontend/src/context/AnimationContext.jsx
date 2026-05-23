import React, { createContext, useContext, useState, useMemo } from 'react';

const AnimationContext = createContext();

export const useAnimationConfig = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimationConfig must be used within an AnimationProvider');
  }
  return context;
};

export const AnimationProvider = ({ children }) => {
  const [speed, setSpeed] = useState('normal'); // 'fast', 'normal', 'slow'

  const config = useMemo(() => {
    const baseDurations = {
      fast: 0.15,
      normal: 0.3,
      slow: 0.5,
      verySlow: 0.8,
    };

    const speedMultipliers = {
      fast: 0.75,
      normal: 1.0,
      slow: 1.5,
    };

    const multiplier = speedMultipliers[speed] || 1.0;

    return {
      speed,
      setSpeed,
      duration: {
        micro: baseDurations.fast * multiplier,
        standard: baseDurations.normal * multiplier,
        macro: baseDurations.slow * multiplier,
        epic: baseDurations.verySlow * multiplier,
      },
      easing: {
        smooth: [0.4, 0, 0.2, 1], // easeInOut
        sharp: [0.0, 0, 0.2, 1],  // easeOut
        gentle: [0.4, 0, 0.2, 1], // gentle curve, no bounce
      }
    };
  }, [speed]);

  return (
    <AnimationContext.Provider value={config}>
      {children}
    </AnimationContext.Provider>
  );
};

// ── Shared Framer Motion Variants ───────────────────────────────────────────

export const getPageTransition = (config) => ({
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: config.duration.macro, ease: config.easing.smooth } },
  exit: { opacity: 0, y: -10, transition: { duration: config.duration.standard, ease: config.easing.sharp } },
});

export const getAlertAnimation = (config, isCritical = false) => ({
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: isCritical ? config.duration.standard * 0.8 : config.duration.standard, ease: config.easing.sharp } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: config.duration.micro, ease: config.easing.sharp } },
});

export const getHoverAnimation = (config) => ({
  whileHover: { scale: 1.03, transition: { duration: config.duration.micro, ease: config.easing.sharp } },
  whileTap: { scale: 0.97, transition: { duration: config.duration.micro, ease: config.easing.sharp } },
});
