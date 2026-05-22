"""
backend/tests/test_security.py
================================
Security-focused pytest suite added during the final-security-hardening sprint.

Coverage:
  C-1  Settings refuses to start without FIELD_ENCRYPTION_KEY.
  C-2  LLM output schema rejects malicious payloads; fallback labels source.
  C-3  EncryptedString actually encrypts on write and decrypts on read.
  C-4  Production mode requires strong secrets + Redis limiter.
  H-1  Production startup with memory:// limiter is refused.
  H-3  Signup endpoints return uniform 202 regardless of email existence.
  H-5  notify_all_admins fans out to every admin row.
  M-8  Account lockout activates after MAX_FAILURES failed attempts.

Run:
    cd backend
    pytest tests/test_security.py -v
"""
from __future__ import annotations

import importlib
import os
import sys

import pytest

# ──────────────────────────────────────────────────────────────────────────────
# Shared test bootstrap
# ──────────────────────────────────────────────────────────────────────────────

# Deterministic Fernet key (44-char urlsafe base64) — test only, never deploy.
TEST_FERNET_KEY = "kZcj9PuJzcm1V13_GqLvy7tQqv4UvALYHGCm4Tn1QXY="


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch, tmp_path):
    """Provide a clean test environment for every test."""
    monkeypatch.setenv("FLASK_ENV", "testing")
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 64)
    monkeypatch.setenv("SECRET_KEY", "y" * 64)
    monkeypatch.setenv("FIELD_ENCRYPTION_KEY", TEST_FERNET_KEY)
    monkeypatch.setenv("SEED_ADMIN_PASSWORD", "TestPw#StrongValue1234")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/test.db")
    monkeypatch.setenv("RATELIMIT_STORAGE_URI", "memory://")
    monkeypatch.setenv("SEED_DEMO_DATA", "0")
    # Force re-import of settings + models so env changes take effect.
    for mod in list(sys.modules):
        if mod.startswith(("config", "models", "extensions", "utils", "app")):
            sys.modules.pop(mod, None)
    yield


# ──────────────────────────────────────────────────────────────────────────────
# C-1 / C-3 — FIELD_ENCRYPTION_KEY is mandatory
# ──────────────────────────────────────────────────────────────────────────────

def test_c3_settings_refuses_without_field_encryption_key(monkeypatch):
    # Setting to empty string wins over .env (dotenv doesn't overwrite by default),
    # so this is the reliable way to simulate "missing" in pytest.
    monkeypatch.setenv("FIELD_ENCRYPTION_KEY", "")
    # Importing config.settings instantiates the Settings model eagerly.
    with pytest.raises(Exception) as exc:
        importlib.import_module("config.settings")
    assert "FIELD_ENCRYPTION_KEY" in str(exc.value)


def test_c3_models_refuses_without_field_encryption_key(monkeypatch):
    monkeypatch.setenv("FIELD_ENCRYPTION_KEY", "")
    # Re-import after clearing the env var must blow up.
    sys.modules.pop("models", None)
    with pytest.raises(RuntimeError) as exc:
        importlib.import_module("models")
    assert "FIELD_ENCRYPTION_KEY" in str(exc.value)


# ──────────────────────────────────────────────────────────────────────────────
# C-3 — EncryptedString round-trip + plaintext fallback
# ──────────────────────────────────────────────────────────────────────────────

def test_c3_encrypted_string_round_trip():
    from cryptography.fernet import Fernet
    import models  # imports trigger Fernet init via env var

    f = Fernet(TEST_FERNET_KEY.encode())
    plain = "Amrita Deshpande"
    encrypted = f.encrypt(plain.encode()).decode()
    decoder = models.EncryptedString()
    assert decoder.process_result_value(encrypted, None) == plain


def test_c3_encrypted_string_falls_through_on_plaintext_legacy_row():
    """Legacy plaintext rows must round-trip the raw value (with a warning)."""
    import models
    decoder = models.EncryptedString()
    raw = "plain-legacy-value"
    # Not Fernet ciphertext → must return raw, not raise.
    assert decoder.process_result_value(raw, None) == raw


# ──────────────────────────────────────────────────────────────────────────────
# C-4 — Production-mode secret strength gates
# ──────────────────────────────────────────────────────────────────────────────

def test_c4_production_rejects_weak_seed_password(monkeypatch):
    monkeypatch.setenv("FLASK_ENV", "production")
    monkeypatch.setenv("SEED_ADMIN_PASSWORD", "ChangeMe#2026")  # known weak
    sys.modules.pop("config.settings", None)
    with pytest.raises(Exception) as exc:
        importlib.import_module("config.settings")
    assert "SEED_ADMIN_PASSWORD" in str(exc.value)


def test_h1_production_rejects_memory_rate_limiter(monkeypatch):
    monkeypatch.setenv("FLASK_ENV", "production")
    monkeypatch.setenv("RATELIMIT_STORAGE_URI", "memory://")
    sys.modules.pop("config.settings", None)
    with pytest.raises(Exception) as exc:
        importlib.import_module("config.settings")
    assert "memory" in str(exc.value).lower()


# ──────────────────────────────────────────────────────────────────────────────
# C-2 — LLM output schema rejects malicious / malformed payloads
# ──────────────────────────────────────────────────────────────────────────────

def test_c2_llm_summary_schema_rejects_missing_keys():
    from ml.llm_summary import LlmSummary
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        LlmSummary.model_validate({"labor_progress": "ok"})


def test_c2_llm_summary_schema_rejects_overlong_strings():
    from ml.llm_summary import LlmSummary
    from pydantic import ValidationError
    payload = {
        "labor_progress": "x" * 5_000,
        "risk_status": "ok",
        "suggested_attention": "ok",
    }
    with pytest.raises(ValidationError):
        LlmSummary.model_validate(payload)


def test_c2_rule_based_fallback_when_no_api_key(monkeypatch):
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    sys.modules.pop("ml.llm_summary", None)
    from ml.llm_summary import generate_clinical_summary
    result = generate_clinical_summary(
        patient_data={"latest_observations": [{"cervical_dilation": 5, "fetal_heart_rate": 140}]},
        prediction={"who_status": "normal_progress", "hours_in_labor": 3.0},
        risk_alerts=[],
    )
    assert result["source"] == "rule_based"
    assert "labor_progress" in result


# ──────────────────────────────────────────────────────────────────────────────
# M-8 — Per-account lockout
# ──────────────────────────────────────────────────────────────────────────────

def test_m8_lockout_engages_after_threshold():
    # Use the in-memory fallback (no Redis in unit tests).
    from utils import lockout
    email = "test@example.com"
    lockout.lockout_clear(email)
    for _ in range(lockout.MAX_FAILURES):
        lockout.lockout_register_failure(email)
    assert lockout.lockout_check(email) is True
    lockout.lockout_clear(email)
    assert lockout.lockout_check(email) is False


def test_m8_lockout_clears_on_success():
    from utils import lockout
    email = "another@example.com"
    lockout.lockout_register_failure(email)
    lockout.lockout_register_failure(email)
    lockout.lockout_clear(email)
    assert lockout.lockout_check(email) is False


# ──────────────────────────────────────────────────────────────────────────────
# M-7 — TOTP helpers
# ──────────────────────────────────────────────────────────────────────────────

def test_m7_totp_round_trip():
    try:
        import pyotp
    except ImportError:
        pytest.skip("pyotp not installed in this environment")
    from utils import mfa
    secret = mfa.generate_secret()
    code = pyotp.TOTP(secret).now()
    assert mfa.verify_totp(secret, code) is True
    assert mfa.verify_totp(secret, "000000") is False
    assert mfa.verify_totp(secret, "not-a-number") is False


# ──────────────────────────────────────────────────────────────────────────────
# H-5 — notify_all_admins fans out to every admin
# ──────────────────────────────────────────────────────────────────────────────

def test_h5_notify_all_admins_fans_out(isolated_app):
    """Use the `isolated_app` fixture for clean DB isolation across tests."""
    app, db = isolated_app
    from models import Admin, Notification
    from utils.crypto import hash_password
    from utils.notify import notify_all_admins

    db.session.add(Admin(name="A1", email="a1@x.com", password_hash=hash_password("TestPw#1234")))
    db.session.add(Admin(name="A2", email="a2@x.com", password_hash=hash_password("TestPw#1234")))
    db.session.commit()
    count = notify_all_admins(
        title="Test", message="Test", notif_type="signup", ref_id=1,
    )
    db.session.commit()
    assert count == 2
    notifs = Notification.query.filter_by(recipient_type="admin").all()
    assert len(notifs) == 2
    assert {n.recipient_id for n in notifs} == {a.id for a in Admin.query.all()}


# ──────────────────────────────────────────────────────────────────────────────
# H-3 — Signup endpoints return uniform 202 regardless of email existence
# ──────────────────────────────────────────────────────────────────────────────

def test_h3_doctor_signup_uniform_response(isolated_app):
    app, _db = isolated_app
    payload = {
        "name": "Dr Test",
        "email": "doc@example.com",
        "password": "ValidPw1!StrongValue",
    }
    client = app.test_client()
    resp1 = client.post("/api/auth/signup/doctor", json=payload)
    resp2 = client.post("/api/auth/signup/doctor", json=payload)
    assert resp1.status_code == 202, resp1.get_json()
    assert resp2.status_code == 202, resp2.get_json()
    # Bodies must be identical — no leak of "already exists".
    assert resp1.get_json() == resp2.get_json()
