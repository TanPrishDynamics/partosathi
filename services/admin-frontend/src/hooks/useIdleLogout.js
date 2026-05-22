/**
 * useIdleLogout — L-6 client-side idle auto-logout (HIPAA §164.312(a)(2)(iii)).
 *
 * Mirrors the backend IDLE_TIMEOUT_MINUTES setting on the client so an
 * unattended session in a clinical workstation drops automatically. The hook:
 *   1. Listens to user-activity events (mouse, key, touch, scroll).
 *   2. Resets a single internal timer on each event.
 *   3. On timeout, calls POST /api/auth/logout (which blocklists the JTI
 *      server-side) and invokes the optional onLogout() callback so the
 *      SPA's auth state clears.
 *
 * Defensive: hook is a no-op when `enabled === false` (e.g. while the user
 * is on the login page).
 */
import { useEffect, useRef } from 'react';
import axios from 'axios';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

export function useIdleLogout({ enabled = true, timeoutMs = 30 * 60 * 1000, onLogout } = {}) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const fireLogout = async () => {
      try {
        await axios.post('/api/auth/logout');
      } catch (_) {
        // Even if the network call fails (e.g. token already revoked),
        // we still drop the in-memory user state and redirect.
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
