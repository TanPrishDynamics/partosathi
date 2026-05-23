import React, { useEffect, useRef, useState } from 'react';

// Custom cursor — warm rose palette matching new design system.
// Hidden on mobile (no pointer) and on touch-primary devices.
export default function CustomCursor() {
  const dotRef  = useRef(null);
  const ringRef = useRef(null);
  const pos     = useRef({ x: -100, y: -100 });
  const ring    = useRef({ x: -100, y: -100 });
  const raf     = useRef(null);
  const [visible,  setVisible]  = useState(false);
  const [clicking, setClicking] = useState(false);
  const [hovering, setHovering] = useState(false);

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  useEffect(() => {
    if (isMobile) return;
    document.documentElement.style.cursor = 'none';
    return () => { document.documentElement.style.cursor = ''; };
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) return;

    const onMove  = (e) => { pos.current = { x: e.clientX, y: e.clientY }; if (!visible) setVisible(true); };
    const onEnter = () => setVisible(true);
    const onLeave = () => setVisible(false);
    const onDown  = () => setClicking(true);
    const onUp    = () => setClicking(false);
    const onHoverStart = (e) => {
      if (e.target.closest('button, a, [role="button"], input, select, textarea')) setHovering(true);
    };
    const onHoverEnd = () => setHovering(false);

    document.addEventListener('mousemove',  onMove,      { passive: true });
    document.addEventListener('mouseenter', onEnter);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mousedown',  onDown);
    document.addEventListener('mouseup',    onUp);
    document.addEventListener('mouseover',  onHoverStart, { passive: true });
    document.addEventListener('mouseout',   onHoverEnd,   { passive: true });

    const animate = () => {
      ring.current.x += (pos.current.x - ring.current.x) * 0.14;
      ring.current.y += (pos.current.y - ring.current.y) * 0.14;
      if (dotRef.current) {
        dotRef.current.style.left = `${pos.current.x}px`;
        dotRef.current.style.top  = `${pos.current.y}px`;
      }
      if (ringRef.current) {
        ringRef.current.style.left = `${ring.current.x}px`;
        ringRef.current.style.top  = `${ring.current.y}px`;
      }
      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove',  onMove);
      document.removeEventListener('mouseenter', onEnter);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mousedown',  onDown);
      document.removeEventListener('mouseup',    onUp);
      document.removeEventListener('mouseover',  onHoverStart);
      document.removeEventListener('mouseout',   onHoverEnd);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [isMobile]);

  if (isMobile) return null;

  const DOT_COLOR  = clicking ? '#4F46E5' : '#818CF8';
  const RING_COLOR = hovering ? 'rgba(99,102,241,0.65)'
                              : clicking ? 'rgba(79,70,229,0.50)' : 'rgba(129,140,248,0.40)';
  const ringSize   = hovering ? 42 : clicking ? 14 : 28;

  return (
    <>
      <div ref={dotRef} style={{
        position: 'fixed', pointerEvents: 'none', zIndex: 9999,
        width: clicking ? '6px' : '5px',
        height: clicking ? '6px' : '5px',
        borderRadius: '50%',
        background: DOT_COLOR,
        boxShadow: `0 0 8px ${DOT_COLOR}`,
        transform: 'translate(-50%, -50%)',
        opacity: visible ? 1 : 0,
        transition: 'width 0.15s ease, height 0.15s ease, background 0.15s ease',
      }} />
      <div ref={ringRef} style={{
        position: 'fixed', pointerEvents: 'none', zIndex: 9999,
        width:  `${ringSize}px`,
        height: `${ringSize}px`,
        borderRadius: '50%',
        border: `1.5px solid ${RING_COLOR}`,
        transform: 'translate(-50%, -50%)',
        opacity: visible ? 1 : 0,
        transition: 'width 0.18s ease, height 0.18s ease, border-color 0.18s ease',
        boxShadow: hovering ? '0 0 12px rgba(99,102,241,0.25)' : 'none',
      }} />
    </>
  );
}
