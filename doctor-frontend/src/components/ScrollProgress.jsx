import React, { useEffect, useState } from 'react';

export default function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el  = document.documentElement;
      const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
      setPct(isNaN(pct) ? 0 : Math.min(100, pct));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (pct <= 1) return null;

  return (
    <div className="scroll-progress-track" style={{ display: 'none' }}>
      <div className="scroll-progress-fill" style={{ height: `${pct}%` }} />
    </div>
  );
}
