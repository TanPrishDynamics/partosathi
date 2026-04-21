/**
 * Centralized Axios instance for e-Partogram.
 *
 * SECURITY (H-2):
 *   JWT is stored in an HttpOnly cookie set by the backend.
 *   It is NEVER accessible from JavaScript (prevents XSS token theft).
 *   withCredentials: true ensures the browser sends the cookie on every request.
 *   No Authorization header is injected — authentication is handled by the cookie.
 *
 * USAGE:
 *   import api from '../services/api';
 *   const data = await api.get('/api/patients');
 */
import axios from 'axios';

const api = axios.create({
  // No baseURL: relative /api/... paths are proxied by Vite dev server to :5001
  // In production, Nginx proxies the same routes.
  timeout: 15000,
  withCredentials: true,   // H-2: sends the httpOnly cookie on every request
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Response Interceptor ─────────────────────────────────────────────────────
// Handles global HTTP errors:
//   401 → redirect to login (cookie is expired or missing)
//   5xx → logs error for monitoring
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        // Cookie is expired/missing — redirect to login
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      if (error.response.status >= 500) {
        console.error('[API] Server error:', error.response.status, error.response.data);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
