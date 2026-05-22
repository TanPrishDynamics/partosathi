import React from 'react';
import { motion } from 'framer-motion';
import { useAnimationConfig, getHoverAnimation } from '../../context/AnimationContext';

export default function AnimatedButton({ children, onClick, style, disabled, ...props }) {
  const config = useAnimationConfig();
  const hoverAnim = getHoverAnimation(config);

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0, transition: { duration: config.duration.standard, ease: config.easing.smooth } }}
      whileHover={disabled ? {} : hoverAnim.whileHover}
      whileTap={disabled ? {} : hoverAnim.whileTap}
      style={{
        ...style,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        willChange: 'transform',
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
