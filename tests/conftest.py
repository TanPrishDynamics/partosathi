"""
backend/tests/conftest.py
=========================
Shared pytest fixtures and module reset helpers.

Why this exists:
  Flask-SQLAlchemy keeps a module-level `db` singleton. When multiple tests
  call `create_app()` in the same Python process, the singleton remembers
  the previous binding and refuses to talk to the new app. The fixtures
  below give each test a clean session and a deterministic teardown.
"""
from __future__ import annotations

import sys
import pytest


@pytest.fixture
def isolated_app(monkeypatch, tmp_path):
    """
    Build a fresh Flask app for a single test, with a fresh in-memory DB.

    Use this in any test that needs to hit the route layer through
    `app.test_client()`. Returns (app, db) — call `db.create_all()` and
    `db.drop_all()` inside an `app.app_context()` block.
    """
    monkeypatch.setenv("FLASK_ENV", "testing")
    monkeypatch.setenv("JWT_SECRET_KEY", "x" * 64)
    monkeypatch.setenv("SECRET_KEY", "y" * 64)
    monkeypatch.setenv(
        "FIELD_ENCRYPTION_KEY",
        "kZcj9PuJzcm1V13_GqLvy7tQqv4UvALYHGCm4Tn1QXY=",
    )
    monkeypatch.setenv("SEED_ADMIN_PASSWORD", "TestPw#StrongValue1234")
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}/test.db")
    monkeypatch.setenv("RATELIMIT_STORAGE_URI", "memory://")
    monkeypatch.setenv("SEED_DEMO_DATA", "0")

    # Hard reset: drop every module that holds Flask / SQLAlchemy / Settings
    # state so the fresh import binds cleanly to the new app instance.
    for mod in list(sys.modules):
        if mod.startswith((
            "config", "models", "extensions", "utils", "app",
            "routes", "ml", "middleware", "validators", "email_service",
            "audio_routes", "alerts", "pdf_export", "clinical_decision_support",
        )):
            sys.modules.pop(mod, None)

    from app import create_app  # noqa: E402
    from extensions import db   # noqa: E402

    app = create_app()
    with app.app_context():
        db.create_all()
        yield app, db
        db.session.remove()
        db.drop_all()
