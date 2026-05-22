/**
 * Centralised Axios instance for e-Partogram (clinician frontend).
 *
 * SECURITY ARCHITECTURE
 * ─────────────────────
 *  - JWT lives exclusively in HttpOnly cookies — NEVER localStorage / sessionStorage.
 *    Tokens are inaccessible to JavaScript, so an XSS payload cannot exfiltrate
 *    the session.
 *  - H-4: CSRF protection is ALWAYS on (every environment). Flask-JWT-Extended
 *    issues a non-HttpOnly companion cookie `csrf_access_token` on login.
 *    This interceptor reads that cookie and echoes it as `X-CSRF-TOKEN` on every
 *    state-changing request (POST/PUT/PATCH/DELETE). The double-submit pattern
 *    means a cross-site attacker cannot forge writes even with cookies attached.
 *  - SILENT REFRESH: When the 15-minute access token expires (401), the
 *    interceptor calls POST /api/auth/refresh using the 7-day HttpOnly refresh
 *    cookie to get a new access+refresh pair (rotation), then retries the
 *    original request transparently. If refresh also fails (e.g. refresh token
 *    expired/revoked), the user is redirected to /login.
 *  - M-14: refresh endpoint is server-side rate-limited so a stolen refresh
 *    cookie cannot be replayed at speed.
 */
import axios from 'axios';

const api = axios.create({
  timeout: 15000,
  // Sends ALL cookies (HttpOnly access/refresh + csrf_access_token) on every
  // same-origin request, including cross-origin if the backend allow-lists
  // the SPA origin in CORS.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// ── CSRF double-submit cookie helper (H-4) ──────────────────────────────────
function _readCookie(name) {
  if (typeof document === 'undefined') return null;
  const prefix = name + '=';
  const cookies = document.cookie ? document.cookie.split(';') : [];
  for (let raw of cookies) {
    raw = raw.trim();
    if (raw.indexOf(prefix) === 0) {
      return decodeURIComponent(raw.slice(prefix.length));
    }
  }
  return null;
}

// Methods that must carry the CSRF token. GET / HEAD / OPTIONS are exempt
// (they should never have side effects).
const _CSRF_METHODS = new Set(['post', 'put', 'patch', 'delete']);

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (_CSRF_METHODS.has(method)) {
    // On the refresh endpoint, Flask-JWT-Extended verifies the *refresh*
    // CSRF cookie, not the access one.
    const isRefresh = (config.url || '').includes('/api/auth/refresh');
    const cookieName = isRefresh ? 'csrf_refresh_token' : 'csrf_access_token';
    const csrf = _readCookie(cookieName);
    if (csrf) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-TOKEN'] = csrf;
    }
  }
  return config;
});

// ── Silent refresh state ─────────────────────────────────────────────────────
let _isRefreshing = false;
let _waitQueue = [];

function _drainQueue(success) {
  _waitQueue.forEach(({ resolve, reject }) => (success ? resolve() : reject()));
  _waitQueue = [];
}

// ── Response interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Skip refresh interceptor for session-check calls (avoid redirect loop on initial load)
    if (original?._skipRefresh) return Promise.reject(error);

    if (error.response?.status === 401 && !original._retried) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => {
          _waitQueue.push({ resolve, reject });
        })
          .then(() => api(original))
          .catch(() => Promise.reject(error));
      }

      original._retried = true;
      _isRefreshing = true;

      try {
        await api.post('/api/auth/refresh');
        _drainQueue(true);
        return api(original);
      } catch (_) {
        _drainQueue(false);
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      } finally {
        _isRefreshing = false;
      }
    }

    if (import.meta.env.DEV && error.response?.status >= 500) {
      console.error('[API] Server error:', error.response.status);
    }
    return Promise.reject(error);
  }
);

export default api;
