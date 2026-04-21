// H-2: Auth helpers for cookie-based JWT session management.
// The JWT token lives exclusively in an httpOnly cookie set by the backend.
// JS cannot read it — that's intentional (XSS protection).
import api from '../../services/api';

/**
 * Logout: calls the backend to clear the httpOnly cookie.
 * After this, no further authenticated requests will succeed.
 */
export const logout = async () => {
  try {
    await api.post('/api/auth/logout');
  } catch { /* ignore network errors on logout */ }
};
