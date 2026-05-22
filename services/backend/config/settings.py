"""
config/settings.py — Pydantic-settings environment validation.

Python equivalent of Joi/Zod schema validation.
App startup fails fast with a clear error when required secrets are missing
or misconfigured — rather than silently starting in an insecure state.

Security hardening (audit branch final-security-hardening):
    C-1 Cloud secrets manager bootstrap (AWS Secrets Manager / Vault / GCP).
    C-3 FIELD_ENCRYPTION_KEY is mandatory in EVERY environment — PHI protection
        must not silently degrade in dev/test.
    C-4 FLASK_ENV defaults to "production"; opting in to "development" is explicit.
    H-1 RATELIMIT_STORAGE_URI=memory:// is REJECTED in production.

Install: pip install pydantic-settings
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import List, Optional

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# ── Bootstrap order ──────────────────────────────────────────────────────────
# Step 1: populate os.environ from a local .env if one exists. This is
#         IDEMPOTENT — values already set in the parent environment win.
#         We do this BEFORE the cloud-secrets loader so that operators can
#         override vault values with a local .env during break-glass work.
# Step 2: pull additional secrets from AWS Secrets Manager / Vault / GCP
#         Secret Manager into os.environ (without overwriting existing keys).
# Step 3: Pydantic reads os.environ to build the Settings instance.
#
# Doing both steps here (not just in app.py) means every import path —
# `python -c "import models"`, pytest, the CLI scripts, and the Gunicorn
# entrypoint — sees the same fully-resolved environment.
# ──────────────────────────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv  # type: ignore
    # Look for the project-level .env (one directory above backend/).
    _project_root = Path(__file__).resolve().parents[2]
    _env_file = _project_root / ".env"
    if _env_file.is_file():
        load_dotenv(_env_file)
    else:
        # Fallback to backend/.env if present
        _backend_env = Path(__file__).resolve().parents[1] / ".env"
        if _backend_env.is_file():
            load_dotenv(_backend_env)
        else:
            load_dotenv()  # default search behaviour
except ImportError:
    # python-dotenv is a hard requirement in requirements.txt; if missing
    # the operator gets an ImportError from the very first import path.
    pass

# C-1: Cloud secrets bootstrap (no-op when no AWS/Vault/GCP envs are set).
from utils.secrets_loader import load_secrets_from_cloud  # noqa: E402
load_secrets_from_cloud()

log = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Environment ────────────────────────────────────────────────────────────
    # C-4: Default to "production" — opt-in to development.
    # Rationale: a deploy that forgets to set FLASK_ENV must NOT silently drop
    # CSRF / Secure-cookie / HSTS protections.
    FLASK_ENV: str = "production"

    # ── Security — required in production ──────────────────────────────────────
    JWT_SECRET_KEY: str = ""
    SECRET_KEY: str = ""
    # C-3: FIELD_ENCRYPTION_KEY is required in EVERY environment to prevent
    # silent PHI plaintext writes when the key is missing.
    FIELD_ENCRYPTION_KEY: str = ""
    SEED_ADMIN_PASSWORD: str = ""

    # ── Database ────────────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///partogram.db"
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None

    # ── Redis / Rate Limiting ───────────────────────────────────────────────────
    # H-1: memory:// is rejected in production — see model_validator below.
    RATELIMIT_STORAGE_URI: str = "memory://"

    # ── Token lifetimes ────────────────────────────────────────────────────────
    ACCESS_TOKEN_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 7
    IDLE_TIMEOUT_MINUTES: int = 30

    # ── CORS ───────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = '["http://localhost:5173","http://localhost:5174","http://localhost:5175"]'

    # ── Server ─────────────────────────────────────────────────────────────────
    PORT: int = 5001

    # ── ML / AI ────────────────────────────────────────────────────────────────
    GOOGLE_API_KEY: Optional[str] = None
    ML_MODEL_PATH: str = "./ai/models/lstm_model.pth"
    # C-2: hard cap on LLM call latency so a slow provider never starves a worker.
    LLM_TIMEOUT_SECONDS: int = 8

    # ── Email ──────────────────────────────────────────────────────────────────
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_NAME: str = "e-Partogram"
    ADMIN_NOTIFY_EMAIL: Optional[str] = None

    # ── Demo seeding (H-6) ─────────────────────────────────────────────────────
    # Set to "1" to allow demo-data seeding on app start. Production startup
    # REFUSES to seed regardless of this flag.
    SEED_DEMO_DATA: str = "0"

    # ── Derived ────────────────────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.FLASK_ENV.lower() == "production"

    @property
    def is_testing(self) -> bool:
        return self.FLASK_ENV.lower() == "testing"

    @property
    def cors_origins(self) -> List[str]:
        try:
            return json.loads(self.ALLOWED_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return ["http://localhost:5173"]

    # ── Validators ─────────────────────────────────────────────────────────────

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def jwt_secret_must_be_strong(cls, v: str) -> str:
        if not v:
            return v  # model_validator handles production check
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        return v

    @model_validator(mode="after")
    def field_encryption_key_required_everywhere(self) -> "Settings":
        """
        C-3: PHI field-level encryption key MUST be present in every environment.

        Previously the app only required this in production. That meant dev/test
        databases stored Patient.name as plaintext, and there was no migration
        path from "dev with key" to "prod with key". Refuse to start without it.

        Exception: the 'testing' environment is allowed to use a deterministic
        Fernet key supplied by the test harness — but it still must be present.
        """
        if not self.FIELD_ENCRYPTION_KEY:
            raise ValueError(
                "[STARTUP BLOCKED] FIELD_ENCRYPTION_KEY is required in every "
                "environment (dev/test/prod) to prevent silent PHI plaintext "
                "writes. Generate one with:\n"
                '  python3 -c "from cryptography.fernet import Fernet; '
                'print(Fernet.generate_key().decode())"\n'
                "Then add to your .env as:  FIELD_ENCRYPTION_KEY=<value>"
            )
        # Fernet keys are 44-character urlsafe base64 strings. The exact length
        # check happens in models.py at Fernet construction time; here we just
        # ensure a non-trivial value is supplied.
        if len(self.FIELD_ENCRYPTION_KEY) < 32:
            raise ValueError(
                "FIELD_ENCRYPTION_KEY appears too short — expected a Fernet "
                "key (44 url-safe base64 chars)."
            )
        return self

    @model_validator(mode="after")
    def production_secrets_required(self) -> "Settings":
        """
        Hard gates that apply only in production.
        Fail-CLOSED: any missing/weak secret blocks startup.
        """
        if not self.is_production:
            return self

        errors: list[str] = []

        if not self.JWT_SECRET_KEY or len(self.JWT_SECRET_KEY) < 32:
            errors.append("JWT_SECRET_KEY must be set and >= 32 chars in production")
        if not self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            errors.append("SECRET_KEY must be set and >= 32 chars in production")

        # SEED_ADMIN_PASSWORD: must be present and not a known weak value.
        weak_seed_passwords = {
            "", "ChangeMe#2026", "ChangeMe#2026_ReplaceThis",
            "password", "admin", "changeme", "test", "demo",
        }
        if self.SEED_ADMIN_PASSWORD in weak_seed_passwords:
            errors.append(
                "SEED_ADMIN_PASSWORD must be a strong unique value in production "
                "(none of the known-weak defaults are accepted)"
            )

        # H-1: Memory rate limiter is REJECTED in production.
        if self.RATELIMIT_STORAGE_URI == "memory://":
            errors.append(
                "RATELIMIT_STORAGE_URI must NOT be memory:// in production. "
                "Configure Redis: RATELIMIT_STORAGE_URI=redis://redis:6379/0"
            )

        if errors:
            raise ValueError(
                "[STARTUP BLOCKED] Production configuration errors:\n  - "
                + "\n  - ".join(errors)
            )
        return self


def get_settings() -> Settings:
    """Return cached settings instance."""
    return _settings


# Eagerly instantiate so import-time failures are loud and immediate.
_settings = Settings()
