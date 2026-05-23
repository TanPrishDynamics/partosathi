"""
utils/storage.py — Per-doctor file storage isolation.

Layout on disk (or in the configured backend):
    <STORAGE_ROOT>/doctors/<doctor_id>/patients/<patient_id>/<storage_key>
    <STORAGE_ROOT>/doctors/<doctor_id>/reports/<storage_key>

Security contract:
  1. The ONLY way to read or write a file is through the helpers below.
  2. Every path is *constructed* from the authenticated doctor_id — clients
    cannot supply a doctor_id, and any caller-supplied storage_key is
    constrained to the doctor's prefix by resolve_doctor_path().
  3. Path traversal (".." or absolute paths) is rejected. The resolved path
    MUST start with the doctor's prefix or the function raises 403.
  4. Signed URL helpers (sign_doctor_url / verify_doctor_url) embed the
    doctor_id in the signature, so a URL signed for Doctor A cannot be
    replayed for Doctor B's files even if it leaks.

The signing key is derived from SECRET_KEY; it is NOT the JWT secret because
file URLs may need to outlive an access-token lifetime (e.g. for a 1-hour
PDF download link).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import time
from pathlib import Path

from flask import abort, current_app

__all__ = [
    "doctor_prefix",
    "patient_prefix",
    "resolve_doctor_path",
    "write_doctor_blob",
    "read_doctor_blob",
    "delete_doctor_blob",
    "sign_doctor_url",
    "verify_doctor_url",
]


# ── Path helpers ──────────────────────────────────────────────────────────────

def _storage_root() -> Path:
    """
    Resolve the storage root directory. Defaults to <CWD>/storage and is
    created on first use. Configurable via STORAGE_ROOT env var or
    current_app.config["STORAGE_ROOT"].
    """
    root = (
        (current_app and current_app.config.get("STORAGE_ROOT"))
        if current_app
        else None
    ) or os.environ.get("STORAGE_ROOT") or "storage"
    p = Path(root).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def doctor_prefix(doctor_id: int) -> Path:
    """Return <ROOT>/doctors/<doctor_id> — created on demand."""
    p = _storage_root() / "doctors" / str(int(doctor_id))
    p.mkdir(parents=True, exist_ok=True)
    return p


def patient_prefix(doctor_id: int, patient_pk: int) -> Path:
    """Return <ROOT>/doctors/<doctor_id>/patients/<patient_pk> — created on demand."""
    p = doctor_prefix(doctor_id) / "patients" / str(int(patient_pk))
    p.mkdir(parents=True, exist_ok=True)
    return p


def resolve_doctor_path(doctor_id: int, storage_key: str) -> Path:
    """
    Resolve `storage_key` (relative path under the doctor's prefix) to an
    absolute path. Rejects any key that escapes the doctor's prefix.

    Aborts 400 on invalid input, 403 on traversal attempts.
    """
    if not storage_key or "\x00" in storage_key:
        abort(400, description="Invalid storage_key")

    # Disallow absolute paths and Windows drive letters.
    if storage_key.startswith(("/", "\\")) or (len(storage_key) > 1 and storage_key[1] == ":"):
        abort(403, description="Absolute paths are forbidden")

    base = doctor_prefix(doctor_id)
    candidate = (base / storage_key).resolve()

    # Ensure candidate is inside `base`. Path.is_relative_to is 3.9+; we use
    # commonpath for broader compat.
    try:
        common = Path(os.path.commonpath([str(candidate), str(base)]))
    except ValueError:
        # Different drives on Windows — definitely an escape.
        abort(403, description="Path traversal blocked")

    if common != base:
        abort(403, description="Path traversal blocked")

    return candidate


# ── I/O helpers ──────────────────────────────────────────────────────────────

def write_doctor_blob(doctor_id: int, storage_key: str, data: bytes) -> Path:
    """Write `data` to the doctor-scoped location. Returns the absolute path."""
    path = resolve_doctor_path(doctor_id, storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Write atomically: tmp + rename.
    tmp = path.with_name(path.name + ".tmp-" + secrets.token_hex(4))
    with open(tmp, "wb") as fh:
        fh.write(data)
    os.replace(tmp, path)
    return path


def read_doctor_blob(doctor_id: int, storage_key: str) -> bytes:
    """Read bytes from a doctor-scoped location. 404 if the file is missing."""
    path = resolve_doctor_path(doctor_id, storage_key)
    if not path.exists() or not path.is_file():
        abort(404)
    return path.read_bytes()


def delete_doctor_blob(doctor_id: int, storage_key: str) -> bool:
    """Delete a doctor-scoped file. Returns True if removed, False if absent."""
    path = resolve_doctor_path(doctor_id, storage_key)
    if not path.exists():
        return False
    path.unlink()
    return True


# ── Signed URL helpers ───────────────────────────────────────────────────────

def _signing_key() -> bytes:
    """
    Derive the signing key. We do NOT reuse the JWT secret directly — a
    deliberate separation so that a leaked file URL signature cannot be used
    to mint JWT tokens (and vice versa).

    Source precedence: app.config["SECRET_KEY"] (when in an app context) →
    env var SECRET_KEY → raise. Using `current_app._get_current_object()` to
    side-step the LocalProxy truthiness check, which raises rather than
    returning falsy outside an active app context.
    """
    base = ""
    try:
        # Resolve the proxy explicitly — accessing current_app outside a
        # context would raise, hence the try/except.
        cfg = current_app.config
        base = cfg.get("SECRET_KEY") or ""
    except RuntimeError:
        pass
    if not base:
        base = os.environ.get("SECRET_KEY", "")
    if not base:
        raise RuntimeError("[SECURITY] SECRET_KEY missing — refusing to sign URLs.")
    return hashlib.sha256(("epartogram.fs.v1|" + base).encode()).digest()


_SIG_LEN = 32   # HMAC-SHA256 digest size (fixed)


def sign_doctor_url(doctor_id: int, storage_key: str, expires_in: int = 600) -> str:
    """
    Produce a short-lived token binding (doctor_id, storage_key, expiry).
    The token is opaque and URL-safe; callers append it as a query string.

    Wire format (after base64-url decoding):
        <payload_bytes><HMAC-SHA256 of payload, fixed 32 bytes>
    The 32-byte trailing signature has no separator — HMAC output can contain
    any byte, so a printable separator would be ambiguous.

    Example:
        token = sign_doctor_url(doc_id, "reports/x.pdf", 600)
        url   = f"/api/files/{file_id}?t={token}"
    """
    exp = int(time.time()) + int(expires_in)
    # NUL-byte (\x00) separator: storage_key cannot contain NUL — we reject
    # it in resolve_doctor_path(). Using '.' broke for keys containing dots
    # like 'patients/9/scan.pdf' because they collided with the exp suffix.
    payload = f"{int(doctor_id)}\x00{storage_key}\x00{exp}".encode()
    sig = hmac.new(_signing_key(), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(payload + sig).decode().rstrip("=")


def verify_doctor_url(doctor_id: int, storage_key: str, token: str) -> bool:
    """
    Constant-time verify that `token` was signed for THIS doctor and key, and
    is not yet expired. Returns True on success, False otherwise.

    Note: callers should still confirm the authenticated identity matches
    `doctor_id` — this function only enforces that the token itself is valid.
    """
    if not token:
        return False
    try:
        padding = "=" * (-len(token) % 4)
        raw = base64.urlsafe_b64decode(token + padding)
    except Exception:
        return False

    if len(raw) <= _SIG_LEN:
        return False
    payload_bytes, sig = raw[:-_SIG_LEN], raw[-_SIG_LEN:]
    expected = hmac.new(_signing_key(), payload_bytes, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, sig):
        return False

    try:
        parts = payload_bytes.decode().split("\x00")
        if len(parts) != 3:
            return False
        d_str, key, exp_str = parts
        if int(d_str) != int(doctor_id):
            return False
        if key != storage_key:
            return False
        if int(exp_str) < int(time.time()):
            return False
    except (ValueError, AttributeError):
        return False
    return True
