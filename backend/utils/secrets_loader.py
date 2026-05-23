"""
utils/secrets_loader.py
=======================
Optional cloud secrets-manager loader for e-Partogram.

Security rationale (C-1):
    Storing long-lived secrets (JWT_SECRET_KEY, SECRET_KEY, FIELD_ENCRYPTION_KEY,
    GOOGLE_API_KEY, SEED_ADMIN_PASSWORD, SMTP_PASSWORD, etc.) inside a `.env`
    file on a developer workstation is treated as compromised the moment any
    backup, screen-share, or LLM transcript captures the file. This loader
    fetches secrets from a managed vault at startup and injects them into the
    process environment **before** pydantic-settings reads `os.environ`.

Supported providers (mutually exclusive — first match wins):
    1. AWS Secrets Manager      — set AWS_SECRETS_ARN=arn:aws:secretsmanager:...
    2. Doppler (via env var)    — already populated by Doppler CLI; no-op here
    3. HashiCorp Vault          — set VAULT_ADDR + VAULT_TOKEN + VAULT_PATH
    4. GCP Secret Manager       — set GCP_SECRET_NAME=projects/<id>/secrets/<n>/versions/latest

Behaviour:
    - Each provider is loaded lazily — boto3 / hvac / google-cloud-secret-manager
      are imported only inside the function that needs them, so they remain
      optional dependencies.
    - Existing environment variables are NEVER overwritten — local dev
      overrides always win, matching the principle of least surprise.
    - Fetch failures in production are FAIL-CLOSED: a critical exception is
      raised so the application refuses to start with partial config.
    - Fetch failures in dev/test log a structured warning and continue.

This module is invoked from `backend/config/settings.py` BEFORE the Settings
class is instantiated.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Mapping

log = logging.getLogger(__name__)

# Marker env var so the loader is idempotent even if called twice
_LOADED_FLAG = "_E_PARTOGRAM_SECRETS_LOADED"


# ──────────────────────────────────────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────────────────────────────────────

def load_secrets_from_cloud() -> None:
    """
    Detect which provider is configured and fetch secrets from it.
    Call this exactly once, at process startup, before any setting is read.
    """
    if os.environ.get(_LOADED_FLAG) == "1":
        return  # Already loaded — idempotent

    flask_env = os.environ.get("FLASK_ENV", "production")
    is_production = flask_env == "production"

    provider = None
    try:
        if os.environ.get("AWS_SECRETS_ARN"):
            provider = "aws_secrets_manager"
            _load_aws_secrets_manager()
        elif os.environ.get("VAULT_ADDR") and os.environ.get("VAULT_TOKEN"):
            provider = "vault"
            _load_hashicorp_vault()
        elif os.environ.get("GCP_SECRET_NAME"):
            provider = "gcp_secret_manager"
            _load_gcp_secret_manager()
        else:
            log.info("Secrets loader: no cloud provider configured — using local environment.")
            os.environ[_LOADED_FLAG] = "1"
            return
    except Exception as exc:
        # Fail-CLOSED in production — never silently downgrade
        if is_production:
            log.critical(
                "Secrets loader (%s) failed in production — refusing to start.",
                provider,
                # exc_info is intentionally OFF in critical so the message
                # itself is not poisoned by secret values appearing in tracebacks
                exc_info=False,
            )
            log.critical("Underlying error: %s", type(exc).__name__)
            raise RuntimeError(
                f"[STARTUP BLOCKED] Cloud secrets provider '{provider}' failed. "
                f"See logs for details."
            ) from exc
        # In dev/test, warn loudly but allow startup so local development is not blocked.
        log.warning(
            "Secrets loader (%s) failed in non-production — falling back to local env. "
            "Underlying error type: %s",
            provider, type(exc).__name__,
        )

    os.environ[_LOADED_FLAG] = "1"
    log.info("Secrets loader: completed using provider=%s", provider or "local")


# ──────────────────────────────────────────────────────────────────────────────
# AWS Secrets Manager
# ──────────────────────────────────────────────────────────────────────────────

def _load_aws_secrets_manager() -> None:
    """Fetch a JSON blob from AWS Secrets Manager and merge into os.environ."""
    try:
        import boto3  # type: ignore  # lazy import
    except ImportError as exc:
        raise RuntimeError(
            "AWS_SECRETS_ARN is set but boto3 is not installed. "
            "Install with: pip install boto3"
        ) from exc

    arn = os.environ["AWS_SECRETS_ARN"]
    region = os.environ.get("AWS_REGION", "us-east-1")
    client = boto3.client("secretsmanager", region_name=region)
    response = client.get_secret_value(SecretId=arn)
    payload = response.get("SecretString") or ""
    _merge_payload(payload, provider="aws_secrets_manager")


# ──────────────────────────────────────────────────────────────────────────────
# HashiCorp Vault
# ──────────────────────────────────────────────────────────────────────────────

def _load_hashicorp_vault() -> None:
    """Fetch a KV-v2 secret from Vault and merge into os.environ."""
    try:
        import hvac  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "VAULT_ADDR is set but hvac is not installed. "
            "Install with: pip install hvac"
        ) from exc

    client = hvac.Client(
        url=os.environ["VAULT_ADDR"],
        token=os.environ["VAULT_TOKEN"],
    )
    if not client.is_authenticated():
        raise RuntimeError("Vault token rejected by server.")

    path = os.environ.get("VAULT_PATH", "secret/data/e-partogram")
    mount = os.environ.get("VAULT_MOUNT", "secret")
    secret = client.secrets.kv.v2.read_secret_version(
        path=path.removeprefix(f"{mount}/data/"),
        mount_point=mount,
    )
    data = secret.get("data", {}).get("data", {})
    _merge_mapping(data, provider="vault")


# ──────────────────────────────────────────────────────────────────────────────
# GCP Secret Manager
# ──────────────────────────────────────────────────────────────────────────────

def _load_gcp_secret_manager() -> None:
    """Fetch a JSON blob from GCP Secret Manager and merge into os.environ."""
    try:
        from google.cloud import secretmanager  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "GCP_SECRET_NAME is set but google-cloud-secret-manager is not installed. "
            "Install with: pip install google-cloud-secret-manager"
        ) from exc

    client = secretmanager.SecretManagerServiceClient()
    name = os.environ["GCP_SECRET_NAME"]
    response = client.access_secret_version(request={"name": name})
    payload = response.payload.data.decode("utf-8")
    _merge_payload(payload, provider="gcp_secret_manager")


# ──────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────────

def _merge_payload(payload: str, *, provider: str) -> None:
    """Parse a JSON/dotenv string and merge into os.environ (no overwrite)."""
    if not payload:
        log.warning("Secrets loader (%s): empty payload — nothing to merge.", provider)
        return

    # Try JSON first (preferred), then fall back to dotenv format.
    parsed: Mapping[str, str] | None = None
    try:
        loaded = json.loads(payload)
        if isinstance(loaded, dict):
            parsed = {str(k): str(v) for k, v in loaded.items()}
    except json.JSONDecodeError:
        parsed = _parse_dotenv_string(payload)

    if not parsed:
        raise RuntimeError(f"Secrets payload from {provider} could not be parsed.")

    _merge_mapping(parsed, provider=provider)


def _merge_mapping(data: Mapping[str, str], *, provider: str) -> None:
    """Inject mapping into os.environ. Existing env vars take precedence."""
    injected = 0
    for key, value in data.items():
        if key in os.environ:
            # Local override wins — preserves dev ergonomics.
            continue
        os.environ[key] = str(value)
        injected += 1
    log.info(
        "Secrets loader (%s): injected %d new keys into the process environment.",
        provider, injected,
    )


def _parse_dotenv_string(text: str) -> dict[str, str]:
    """Tiny dotenv parser — used when the cloud payload is dotenv-formatted."""
    out: dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        out[key.strip()] = value.strip().strip("'").strip('"')
    return out
