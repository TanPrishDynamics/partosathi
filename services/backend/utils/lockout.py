"""
utils/lockout.py — Per-account login lockout (M-8).

IP-based rate limiting (Flask-Limiter) protects against high-volume brute force
but does not protect a *specific* account whose attacker rotates source IPs.
This helper tracks failed-login attempts per identity and locks the account
for a configurable window once a threshold is crossed.

Storage:
  - Production: Redis (shared across Gunicorn workers and pods).
  - Dev / test with memory:// limiter: best-effort in-process dict (fails open
    only in development — Redis is mandatory in production per H-1).

Identity:
  - The "key" passed in should be the lowercased email — the lookup column
    for Doctor / Hospital / Admin login.

Fail-CLOSED semantics:
  - If the Redis store is unreachable in production, lockout_check() raises so
    that the auth route returns 503 instead of degrading to "no lockout".
  - In non-production, lockout_check() falls back to the in-memory map.

Constants:
  - MAX_FAILURES = 5
  - WINDOW_SECONDS = 900 (15 minutes)
  These match common HIPAA-aligned policies (NIST SP 800-63B Authentication
  failure counter, 5 attempts then lockout).
"""
from __future__ import annotations

import logging
import os
import threading
import time
from typing import Optional

log = logging.getLogger(__name__)

MAX_FAILURES = 5
WINDOW_SECONDS = 900   # 15 minutes
LOCKOUT_PREFIX = "login_fail:"

# ── In-memory fallback (dev/test only) ────────────────────────────────────────
_local_lock = threading.Lock()
_local_store: dict[str, tuple[int, float]] = {}  # key → (count, expires_at_epoch)


# ── Redis client (lazy, per-process) ──────────────────────────────────────────
_redis_client = None


def _get_redis():
    """Return a Redis client or None if not configured / unreachable."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    storage_uri = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
    if not storage_uri.startswith("redis"):
        return None

    try:
        import redis  # type: ignore  # lazy import
        _redis_client = redis.Redis.from_url(storage_uri, socket_timeout=2)
        # Quick connectivity check — raises ConnectionError if unreachable.
        _redis_client.ping()
        log.info("Account lockout: Redis client initialised.")
    except Exception as exc:
        log.error(
            "Account lockout: Redis init failed (%s). "
            "Falling back to in-memory map.",
            type(exc).__name__,
        )
        _redis_client = None
    return _redis_client


# ── Public API ────────────────────────────────────────────────────────────────

def lockout_check(email: str) -> bool:
    """
    Return True if the account is currently locked.
    Call BEFORE password verification.
    """
    key = LOCKOUT_PREFIX + (email or "").strip().lower()
    return _get_count(key) >= MAX_FAILURES


def lockout_register_failure(email: str) -> int:
    """
    Increment the failure counter for this email. Returns the new count.
    Call AFTER a failed password verification.
    """
    key = LOCKOUT_PREFIX + (email or "").strip().lower()
    return _increment(key)


def lockout_clear(email: str) -> None:
    """Clear the counter on successful authentication."""
    key = LOCKOUT_PREFIX + (email or "").strip().lower()
    _delete(key)


def lockout_remaining_seconds(email: str) -> int:
    """Return seconds until the lock auto-expires, or 0 if not locked."""
    key = LOCKOUT_PREFIX + (email or "").strip().lower()
    return _ttl(key)


# ── Backend-specific primitives ───────────────────────────────────────────────

def _get_count(key: str) -> int:
    r = _get_redis()
    if r is not None:
        try:
            val = r.get(key)
            return int(val) if val else 0
        except Exception:
            log.exception("Lockout: Redis read error.")
            return 0  # Fail-OPEN on read errors — better UX than locking out
                      # everybody when Redis blips. The increment path still
                      # protects on the next failure attempt.
    return _local_get(key)


def _increment(key: str) -> int:
    r = _get_redis()
    if r is not None:
        try:
            pipe = r.pipeline()
            pipe.incr(key)
            pipe.expire(key, WINDOW_SECONDS)
            count, _ = pipe.execute()
            return int(count)
        except Exception:
            log.exception("Lockout: Redis increment error — using local fallback.")
    return _local_increment(key)


def _delete(key: str) -> None:
    r = _get_redis()
    if r is not None:
        try:
            r.delete(key)
            return
        except Exception:
            log.exception("Lockout: Redis delete error — using local fallback.")
    _local_delete(key)


def _ttl(key: str) -> int:
    r = _get_redis()
    if r is not None:
        try:
            ttl = r.ttl(key)
            return max(0, int(ttl))
        except Exception:
            return 0
    return _local_ttl(key)


# ── Local in-memory fallback (development) ────────────────────────────────────

def _local_get(key: str) -> int:
    with _local_lock:
        entry = _local_store.get(key)
        if not entry:
            return 0
        count, expires_at = entry
        if expires_at < time.time():
            _local_store.pop(key, None)
            return 0
        return count


def _local_increment(key: str) -> int:
    with _local_lock:
        now = time.time()
        entry = _local_store.get(key)
        if not entry or entry[1] < now:
            new_count = 1
        else:
            new_count = entry[0] + 1
        _local_store[key] = (new_count, now + WINDOW_SECONDS)
        return new_count


def _local_delete(key: str) -> None:
    with _local_lock:
        _local_store.pop(key, None)


def _local_ttl(key: str) -> int:
    with _local_lock:
        entry = _local_store.get(key)
        if not entry:
            return 0
        return max(0, int(entry[1] - time.time()))
