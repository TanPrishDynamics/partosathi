/**
 * useIdleLogout — L-6 client-side idle auto-logout (HIPAA §164.312(a)(2)(iii)).
 *
 * Mirrors the backend IDLE_TIMEOUT_MINUTES setting on the client so an
 * unattended session in a clinical workstation drops automatically.
 *
 * Uses the centralised `api` instance so the X-CSRF-TOKEN header is added.
 */
import { useEffect, useRef } from 'react';
import api from '../services/api';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

export function useIdleLogout({ enabled = true, timeoutMs = 30 * 60 * 1000, onLogout } = {}) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const fireLogout = async () => {
      try {
        await api.post('/api/auth/logout');
      } catch (_) {
        // Best-effort: even if logout fails, clear client state and redirect.
      } finally {
        if (typeof onLogout === 'function') onLogout();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    };

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(fireLogout, timeoutMs);
    };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [enabled, timeoutMs, onLogout]);
}
