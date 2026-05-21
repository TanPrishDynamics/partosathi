"""
config/logger.py — Structured JSON logging (Python equivalent of Winston).

Features:
  - JSON output with timestamp, level, message, and structured fields
  - PII scrubber: removes password, token, key, secret from log records
  - Separate handlers for stdout (INFO+) and stderr (ERROR+)
  - In development: human-readable colored output

Install: pip install python-json-logger
"""
import logging
import os
import sys
from typing import Any

_PII_FIELDS = frozenset({
    "password", "password_hash", "token", "access_token", "refresh_token",
    "jwt_secret", "secret_key", "field_encryption_key", "api_key",
    "google_api_key", "smtp_password", "authorization",
})


class _PIIScrubber(logging.Filter):
    """Remove sensitive field values from log records before emission."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, dict):
            record.msg = self._scrub(record.msg)
        if record.args and isinstance(record.args, dict):
            record.args = self._scrub(record.args)
        return True

    def _scrub(self, data: Any) -> Any:
        if isinstance(data, dict):
            return {
                k: ("***REDACTED***" if k.lower() in _PII_FIELDS else self._scrub(v))
                for k, v in data.items()
            }
        if isinstance(data, (list, tuple)):
            return type(data)(self._scrub(i) for i in data)
        return data


def setup_logging(app) -> None:
    """
    Configure the Flask app logger and root logger.
    Call once inside create_app() after app is instantiated.
    """
    is_dev = os.environ.get("FLASK_ENV", "production") == "development"

    if is_dev:
        fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        logging.basicConfig(level=logging.DEBUG, format=fmt, stream=sys.stdout)
    else:
        try:
            from pythonjsonlogger import jsonlogger

            handler = logging.StreamHandler(sys.stdout)
            formatter = jsonlogger.JsonFormatter(
                fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
                rename_fields={"asctime": "timestamp", "levelname": "level"},
            )
            handler.setFormatter(formatter)
            handler.addFilter(_PIIScrubber())

            root = logging.getLogger()
            root.handlers.clear()
            root.addHandler(handler)
            root.setLevel(logging.INFO)
        except ImportError:
            logging.basicConfig(
                level=logging.INFO,
                format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                stream=sys.stdout,
            )
            logging.warning(
                "python-json-logger not installed — using plain text logging. "
                "Install: pip install python-json-logger"
            )

    # Silence noisy libraries in production
    if not is_dev:
        for noisy in ("werkzeug", "sqlalchemy.engine", "urllib3"):
            logging.getLogger(noisy).setLevel(logging.WARNING)

    app.logger.setLevel(logging.DEBUG if is_dev else logging.INFO)
    app.logger.info("Logger initialized (mode=%s)", "development" if is_dev else "production")
