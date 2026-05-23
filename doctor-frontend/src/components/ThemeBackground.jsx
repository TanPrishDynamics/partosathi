export default function ThemeBackground() {
  return (
    <div aria-hidden="true" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Indigo bloom — top left */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        left: '-10%',
        width: '60vw',
        height: '60vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)',
      }} />
      {/* Violet glow — bottom right */}
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '-10%',
        width: '55vw',
        height: '55vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 65%)',
      }} />
      {/* Sky tint — center top */}
      <div style={{
        position: 'absolute',
        top: '10%',
        right: '20%',
        width: '35vw',
        height: '35vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 65%)',
      }} />
    </div>
  );
}
