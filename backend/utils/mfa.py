"""
utils/mfa.py — TOTP MFA helpers (M-7).

TOTP (RFC 6238) provides time-based one-time passcodes that any authenticator
app (Google Authenticator, 1Password, Authy, Bitwarden) can generate.

Backward-compat:
  - An Admin row with totp_enabled=False bypasses MFA — the existing
    /api/auth/admin-login flow continues to work for accounts that haven't
    enrolled yet. Enforcement is per-account, not platform-wide.

Provisioning flow (admin only):
  1. POST /api/auth/mfa/setup  → server generates a secret, returns provisioning URI.
  2. Admin scans QR code in authenticator app.
  3. POST /api/auth/mfa/confirm with the current 6-digit code → server verifies,
     sets totp_enabled=True, persists the secret.
  4. Subsequent /api/auth/admin-login calls require `totp` field in body.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)

try:
    import pyotp  # type: ignore
    _PYOTP_AVAILABLE = True
except ImportError:
    pyotp = None  # type: ignore
    _PYOTP_AVAILABLE = False
    log.warning(
        "pyotp not installed — TOTP MFA disabled. "
        "Add 'pyotp==2.9.0' to backend/requirements.txt."
    )


def generate_secret() -> str:
    """Generate a base32 TOTP secret for a fresh enrollment."""
    if not _PYOTP_AVAILABLE:
        raise RuntimeError("pyotp is not installed; cannot enrol TOTP MFA.")
    return pyotp.random_base32()


def provisioning_uri(secret: str, account_email: str, issuer: str = "e-Partogram Admin") -> str:
    """Return the otpauth:// URI that authenticator apps consume via QR code."""
    if not _PYOTP_AVAILABLE:
        raise RuntimeError("pyotp is not installed; cannot enrol TOTP MFA.")
    return pyotp.TOTP(secret).provisioning_uri(name=account_email, issuer_name=issuer)


def verify_totp(secret: str, code: str, valid_window: int = 1) -> bool:
    """
    Verify a 6-digit code against the stored secret.

    valid_window=1 allows the immediately previous AND next 30-second window,
    mitigating minor client-clock drift. Larger windows weaken security; keep
    at 1 unless audit requires otherwise.
    """
    if not _PYOTP_AVAILABLE or not secret or not code:
        return False
    code = (code or "").strip()
    if not code.isdigit() or len(code) != 6:
        return False
    try:
        return bool(pyotp.TOTP(secret).verify(code, valid_window=valid_window))
    except Exception:
        log.exception("TOTP verify error")
        return False
