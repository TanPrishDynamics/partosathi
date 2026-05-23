/**
 * NeuroLayout.jsx — Passthrough to ImmersiveLayout (clinical mode only)
 *
 * The 3D presentation mode has been removed.
 * This component now renders ImmersiveLayout directly, which is the
 * clinical light-theme partogram view.
 */
import React, { lazy, Suspense } from 'react';
import { Activity } from 'lucide-react';

// Lazy-load clinical layout
const ImmersiveLayout = lazy(() => import('./ImmersiveLayout'));

// ── Spinner fallback ──────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #E8F4FF 0%, #F0EBFF 35%, #FFF0F6 65%, #F0FDF8 100%)',
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '20px', margin: '0 auto 20px',
        background: 'linear-gradient(135deg, #4A90E2 0%, #8B5CF6 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 16px 40px rgba(74,144,226,0.3)',
      }}>
        <Activity style={{ width: '32px', height: '32px', color: '#fff', animation: 'spin 1s linear infinite' }} />
      </div>
      <p style={{ color: '#64748B', fontWeight: 600, fontFamily: 'Poppins, sans-serif' }}>
        Loading patient data…
      </p>
    </div>
  </div>
);

// ── Main export ───────────────────────────────────────────────────────────────
export default function NeuroLayout({ patientId }) {
  return (
    <Suspense fallback={<Spinner />}>
      <ImmersiveLayout patientId={patientId} onToggleMode={null} />
    </Suspense>
  );
}
