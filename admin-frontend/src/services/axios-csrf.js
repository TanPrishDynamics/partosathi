/**
 * admin-frontend/src/services/axios-csrf.js
 *
 * Configures the global Axios instance for the admin SPA:
 *   - withCredentials: true (HttpOnly JWT cookies travel with every request)
 *   - X-CSRF-TOKEN echo on every state-changing request (H-4 double-submit)
 *   - On 401 to a non-login endpoint, drop to /login (no silent refresh here
 *     because the admin SPA is typically launched fresh each session, but
 *     /api/auth/refresh remains available if invoked manually)
 *
 * Importing this module is sufficient — it patches `axios` itself.
 */
import axios from 'axios';

axios.defaults.withCredentials = true;

function _readCookie(name) {
  if (typeof document === 'undefined') return null;
  const prefix = name + '=';
  const parts = document.cookie ? document.cookie.split(';') : [];
  for (let raw of parts) {
    raw = raw.trim();
    if (raw.indexOf(prefix) === 0) {
      return decodeURIComponent(raw.slice(prefix.length));
    }
  }
  return null;
}

const _MUTATING = new Set(['post', 'put', 'patch', 'delete']);

axios.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (_MUTATING.has(method)) {
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

axios.interceptors.response.use(
  (r) => r,
  (err) => {
    // On 401 outside the login flow, send the user back to /login.
    const path = err?.config?.url || '';
    const status = err?.response?.status;
    if (status === 401 && !path.includes('/api/auth/admin-login') && !path.includes('/api/auth/me')) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);
