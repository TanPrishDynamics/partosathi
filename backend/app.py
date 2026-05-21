"""
app.py — Flask application factory for e-Partogram.

Security architecture (hardened on branch `final-security-hardening`):
  - JWT via HttpOnly cookies (XSS-resistant)
  - 15-minute access token + 7-day refresh token with rotation
  - Server-side token revocation via TokenBlocklist
  - RBAC: admin / hospital / doctor roles
  - IDOR protection on all patient/observation routes
  - Schema validation on ALL write endpoints (including Observation POST)
  - Rate limiting: IP-based default, user-based on bulk GET
  - Flask-Talisman: CSP, HSTS, X-Frame-Options, Permissions-Policy
  - Flask-Compress: gzip responses EXCEPT auth/admin endpoints (BREACH mitigation)
  - HIPAA §164.312(b) audit logging on every PHI request
  - Pydantic-settings startup validation (fails fast on missing secrets)
  - C-4: FLASK_ENV defaults to "production" — secure-by-default
  - H-2: ProxyFix middleware so audit-log IP and rate-limit keys see the real
        client IP behind Nginx instead of the proxy IP
  - H-4: CSRF protection is ALWAYS on; SameSite tightened to "Strict"
  - H-6: Demo data seeding is gated behind SEED_DEMO_DATA=1 AND non-production
  - M-11: Auth/admin responses are NOT compressed → blocks BREACH on
         secret-bearing bodies
  - M-16: Permissions-Policy hardened with FLoC opt-out
"""
import logging
import os
import warnings
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, g, request
from flask_cors import CORS
from flask_jwt_extended import get_jwt, get_jwt_identity
from werkzeug.middleware.proxy_fix import ProxyFix

from config.settings import get_settings
from config.logger import setup_logging
from extensions import compress, db, jwt, limiter, talisman
from middleware.error_handler import register_error_handlers
from middleware.sanitize import sanitize_request
from models import AuditLog, TokenBlocklist

log = logging.getLogger(__name__)


# ── Content Security Policy ───────────────────────────────────────────────────
# style-src keeps 'unsafe-inline' because the React SPA emits `style={...}`
# attributes (style-src-attr-inline) and many third-party charting libraries
# (Recharts, Chart.js, framer-motion) inject runtime <style> tags. Switching
# to nonces would require deep refactors across both frontends. Layered
# mitigations: strict X-Frame-Options DENY, X-Content-Type-Options nosniff,
# CSP frame-ancestors 'none', and Marshmallow input validation that rejects
# < > characters in PHI fields.
_CSP = {
    "default-src": "'self'",
    "script-src":  ["'self'"],
    "style-src":   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src":    ["'self'", "https://fonts.gstatic.com"],
    "img-src":     ["'self'", "data:"],
    "connect-src": ["'self'"],
    "frame-ancestors": "'none'",
    "form-action": "'self'",
    "base-uri":    "'self'",
    "object-src":  "'none'",
}

# PHI routes that need HIPAA §164.312(b) audit logging.
# Extended to cover logout, signup, refresh, voice-input, MFA, and CDS paths
# that touch PHI in addition to PHI CRUD routes.
_AUDIT_PREFIXES = (
    "/api/patient",
    "/api/observation",
    "/api/alerts",
    "/api/ai/summary",
    "/api/export",
    "/api/auth/login",
    "/api/auth/admin-login",
    "/api/auth/hospital-login",
    "/api/auth/logout",
    "/api/auth/refresh",
    "/api/auth/signup",
    "/api/auth/mfa",
    "/api/cds/voice-input",
    "/api/cds/extract-text",
    "/api/cds/analyze-observation",
    "/api/cds/batch-analyze",
    "/api/cds/predict-delivery",
    "/api/v2/cds/predict-delivery",
    "/api/admin/approve-user",
    "/api/admin/reject-user",
    "/api/admin/credit-requests",
)

# M-11: routes whose responses must NOT be gzipped — auth + admin bodies can
# contain tokens or CSRF nonces; compressing them creates a BREACH oracle.
_NO_COMPRESS_PREFIXES = (
    "/api/auth",
    "/api/admin",
)


def create_app() -> Flask:
    """
    Application factory.  Creates and configures the Flask app.
    Startup fails immediately if any required secret is missing or weak.
    """
    settings = get_settings()
    app = Flask(__name__)

    # ── H-2: ProxyFix ─────────────────────────────────────────────────────────
    # Behind Nginx (and any TLS-terminating ALB / CloudFront), Flask must trust
    # exactly ONE proxy hop's X-Forwarded-* headers so that:
    #   - request.remote_addr reflects the client IP (used for rate-limit keys
    #     and HIPAA audit-log IP fields)
    #   - request.scheme reflects "https" (used by url_for and Secure cookies)
    # Trusting more than one hop is unsafe (allows clients to forge IP/scheme).
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

    # ── Core config ────────────────────────────────────────────────────────────
    app.config["MAX_CONTENT_LENGTH"]         = 512 * 1024      # 512 KB max payload
    app.config["SQLALCHEMY_DATABASE_URI"]    = settings.DATABASE_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    # Defence-in-depth against session-fixation when the SECRET_KEY rotates.
    app.config["SESSION_COOKIE_SECURE"]      = settings.is_production
    app.config["SESSION_COOKIE_HTTPONLY"]    = True
    app.config["SESSION_COOKIE_SAMESITE"]    = "Strict"

    # ── JWT ────────────────────────────────────────────────────────────────────
    _jwt_key = settings.JWT_SECRET_KEY
    if not _jwt_key:
        if not settings.is_production:
            _jwt_key = "dev-only-insecure-key-do-NOT-use-in-production"
            warnings.warn("[SECURITY] JWT_SECRET_KEY not set — using insecure dev key.", stacklevel=2)
        else:
            # This path is defence-in-depth: settings.py model_validator should
            # already have raised. Re-check to fail-CLOSED.
            raise RuntimeError("[SECURITY] JWT_SECRET_KEY must be set in production.")

    app.config["JWT_SECRET_KEY"]            = _jwt_key
    app.config["JWT_ACCESS_TOKEN_EXPIRES"]  = timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=settings.REFRESH_TOKEN_DAYS)
    app.config["JWT_ALGORITHM"]             = "HS256"
    app.config["JWT_TOKEN_LOCATION"]        = ["cookies"]
    # H-4: CSRF protection is ALWAYS on, regardless of FLASK_ENV. Cookies are
    # marked Secure only in production (HTTPS) so local HTTP dev still works,
    # but the CSRF double-submit token is enforced everywhere — preventing
    # cross-site form posts from forging state-changing requests.
    app.config["JWT_COOKIE_SECURE"]         = settings.is_production
    # SameSite=Strict is acceptable here because the SPAs run on the same
    # apex domain as the API in production (or via Vite proxy in dev). If a
    # cross-subdomain launch flow is added later, drop to "Lax" on that
    # subdomain only — never globally.
    app.config["JWT_COOKIE_SAMESITE"]       = "Strict"
    app.config["JWT_COOKIE_CSRF_PROTECT"]   = True
    app.config["JWT_CSRF_IN_COOKIES"]       = True
    # Allow API callers (the React SPAs) to read the CSRF token from a non-
    # HttpOnly cookie so they can echo it as an X-CSRF-TOKEN header on writes.
    app.config["JWT_ACCESS_CSRF_COOKIE_NAME"]  = "csrf_access_token"
    app.config["JWT_REFRESH_CSRF_COOKIE_NAME"] = "csrf_refresh_token"
    app.config["JWT_ACCESS_COOKIE_NAME"]    = "access_token"
    app.config["JWT_REFRESH_COOKIE_NAME"]   = "refresh_token"
    # Tighter session blocklist behaviour: revoked refresh tokens are
    # checked on every request (not just access).
    app.config["JWT_BLACKLIST_TOKEN_CHECKS"] = ["access", "refresh"]

    # ── FIELD_ENCRYPTION_KEY guard (defence-in-depth) ──────────────────────────
    # config/settings.py already refuses to construct Settings without the key.
    # This second check protects against future refactors that might bypass the
    # validator. NEVER allow startup without PHI encryption.
    if not settings.FIELD_ENCRYPTION_KEY:
        raise RuntimeError(
            "[SECURITY] FIELD_ENCRYPTION_KEY must be set in every environment "
            "to protect PHI at rest."
        )

    # ── Extensions ─────────────────────────────────────────────────────────────
    db.init_app(app)
    jwt.init_app(app)
    compress.init_app(app)

    limiter.storage_uri = settings.RATELIMIT_STORAGE_URI
    limiter.init_app(app)

    talisman.init_app(
        app,
        force_https=settings.is_production,
        content_security_policy=_CSP,
        content_security_policy_nonce_in=["script-src"],
        strict_transport_security=settings.is_production,
        strict_transport_security_max_age=31536000,
        strict_transport_security_include_subdomains=True,
        strict_transport_security_preload=settings.is_production,
        frame_options="DENY",
        referrer_policy="strict-origin-when-cross-origin",
        # X-Permitted-Cross-Domain-Policies blocks Flash/PDF cross-domain
        # loaders. Defence-in-depth, near-zero cost.
        x_content_type_options=True,
    )

    # ── CORS ───────────────────────────────────────────────────────────────────
    CORS(app, origins=settings.cors_origins, supports_credentials=True)

    # ── Logging ────────────────────────────────────────────────────────────────
    setup_logging(app)

    # ── Security posture banner ────────────────────────────────────────────────
    # Print exactly which guards are active at boot. This is the canonical
    # cross-check for the C-4 footgun (production starting in development mode).
    app.logger.info(
        "Security posture: FLASK_ENV=%s  CSRF=%s  Secure-cookie=%s  HSTS=%s  "
        "ratelimit=%s  field_encryption=on  MFA_support=on",
        settings.FLASK_ENV,
        app.config["JWT_COOKIE_CSRF_PROTECT"],
        app.config["JWT_COOKIE_SECURE"],
        settings.is_production,
        "redis" if settings.RATELIMIT_STORAGE_URI.startswith("redis") else "memory",
    )

    # ── JWT token blocklist loader ─────────────────────────────────────────────
    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        """Called on every authenticated request. Checks revoked JTIs."""
        jti   = jwt_payload.get("jti")
        entry = TokenBlocklist.query.filter_by(jti=jti).first()
        return entry is not None

    # ── Permissions-Policy header (M-16: FLoC + Topics opt-out) ───────────────
    # Flask-Talisman does not emit Permissions-Policy directly. We add a strict
    # opt-out for every sensor and tracking signal that is not used by the SPA.
    @app.after_request
    def add_permissions_policy(response):
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=(), "
            "accelerometer=(), gyroscope=(), magnetometer=(), "
            "interest-cohort=(), browsing-topics=(), "
            "usb=(), serial=(), hid=()"
        )
        # Defence-in-depth: legacy header in case browsers still honour it.
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        return response

    # ── M-11: BREACH mitigation — skip compression for auth/admin responses ───
    # The Flask-Compress extension wraps `after_request`. We must prevent it
    # from gzipping bodies that may echo CSRF tokens or auth state.
    @app.after_request
    def _strip_compression_on_sensitive_paths(response):
        path = request.path or ""
        if any(path.startswith(p) for p in _NO_COMPRESS_PREFIXES):
            # Vary header keeps caches honest if a sensitive path is later
            # served behind a CDN.
            response.headers["Vary"] = "Cookie"
            response.headers.pop("Content-Encoding", None)
        return response

    # ── Input sanitization ─────────────────────────────────────────────────────
    @app.before_request
    def _sanitize():
        sanitize_request()

    # ── HIPAA §164.312(b) PHI audit logging ────────────────────────────────────
    # Writes one AuditLog row per PHI-touching request. The row stores:
    #   - user_id / user_role (resolved from JWT if present)
    #   - HTTP method + resource prefix (NEVER the request body)
    #   - request.remote_addr — now the REAL client IP thanks to ProxyFix (H-2)
    #   - response.status_code so 4xx/5xx are visible to compliance review
    # Audit failures are logged but never block the response — refusing the
    # response on a logging failure would create a DoS-shaped availability hit
    # on a non-security-critical write path. The application logs surface the
    # missing row so SecOps can investigate.
    @app.after_request
    def _write_audit_log(response):
        path = request.path
        if not any(path.startswith(p) for p in _AUDIT_PREFIXES):
            return response
        try:
            uid  = get_jwt_identity()
            role = get_jwt().get("role")
        except Exception:
            uid, role = None, None
        parts    = path.strip("/").split("/")
        resource = "/".join(parts[1:3]) if len(parts) >= 3 else path
        try:
            entry = AuditLog(
                user_id=str(uid) if uid else None,
                user_role=role,
                action=request.method,
                resource=resource[:80],
                # request.remote_addr is the real client IP — ProxyFix already
                # consumed X-Forwarded-For. Truncate to 45 chars (IPv6 max).
                ip_address=(request.remote_addr or "")[:45] or None,
                status_code=response.status_code,
            )
            db.session.add(entry)
            db.session.commit()
        except Exception as exc:
            # Never log the request body — defence against accidental PHI leak.
            app.logger.error(
                "AuditLog write failed for %s %s: %s",
                request.method, path, type(exc).__name__,
            )
            db.session.rollback()
        return response

    # ── Blueprints ─────────────────────────────────────────────────────────────
    from routes.auth_routes     import auth_bp
    from routes.patient_routes  import patient_bp
    from routes.observation_routes import obs_bp
    from routes.admin_routes    import admin_bp
    from routes.hospital_routes import hospital_bp
    from routes.cds_routes      import cds_bp
    from audio_routes           import audio_bp

    for bp in (auth_bp, patient_bp, obs_bp, admin_bp, hospital_bp, cds_bp, audio_bp):
        app.register_blueprint(bp)

    # ── Error handlers ─────────────────────────────────────────────────────────
    register_error_handlers(app)

    return app


# ── Database initialisation + seeding ─────────────────────────────────────────

def _run_migrations(app: Flask) -> None:
    """Idempotent column migrations — safe to re-run."""
    migrations = [
        "ALTER TABLE doctors ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'approved'",
        "ALTER TABLE doctors ADD COLUMN patient_limit INTEGER DEFAULT 50",
        "ALTER TABLE doctors ADD COLUMN patients_used INTEGER DEFAULT 0",
        "ALTER TABLE doctors ADD COLUMN access_type VARCHAR(20) DEFAULT 'admin_created'",
        "ALTER TABLE doctors ADD COLUMN specialization VARCHAR(120)",
        "ALTER TABLE doctors ADD COLUMN phone VARCHAR(30)",
        "ALTER TABLE doctors ADD COLUMN hospital_id INTEGER REFERENCES hospitals(id)",
        "ALTER TABLE doctors ADD COLUMN approved_at DATETIME",
        "ALTER TABLE doctors ADD COLUMN approved_by INTEGER",
        "ALTER TABLE doctors ADD COLUMN rejection_reason VARCHAR(500)",
        "ALTER TABLE doctors ADD COLUMN created_at DATETIME",
        "ALTER TABLE hospitals ADD COLUMN patients_used INTEGER DEFAULT 0",
        "ALTER TABLE hospitals ADD COLUMN registration_number VARCHAR(80)",
        "ALTER TABLE hospitals ADD COLUMN num_doctors INTEGER",
        "ALTER TABLE patients ADD COLUMN consent_obtained BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE patients ADD COLUMN consent_date DATETIME",
        "ALTER TABLE patients ADD COLUMN consent_method VARCHAR(30)",
        "ALTER TABLE alerts ADD COLUMN acknowledged_by INTEGER",
        "ALTER TABLE alerts ADD COLUMN acknowledged_at DATETIME",
        # M-7: TOTP MFA columns on Admin
        "ALTER TABLE admins ADD COLUMN totp_secret VARCHAR(64)",
        "ALTER TABLE admins ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT 0",
        
        # OAuth columns
        "ALTER TABLE doctors ADD COLUMN google_id VARCHAR(100)",
        "ALTER TABLE doctors ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'local' NOT NULL",
        "ALTER TABLE doctors ADD COLUMN profile_picture VARCHAR(500)",
        "ALTER TABLE hospitals ADD COLUMN google_id VARCHAR(100)",
        "ALTER TABLE hospitals ADD COLUMN auth_provider VARCHAR(20) DEFAULT 'local' NOT NULL",
        "ALTER TABLE hospitals ADD COLUMN profile_picture VARCHAR(500)",
        "CREATE UNIQUE INDEX ix_doctors_google_id ON doctors (google_id)",
        "CREATE UNIQUE INDEX ix_hospitals_google_id ON hospitals (google_id)",
    ]
    with db.engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(db.text(sql))
                conn.commit()
            except Exception as exc:
                # L-10: distinguish known-safe "column already exists" from real
                # schema errors. Real errors get logged so ops can see them.
                msg = str(exc).lower()
                if "duplicate column" in msg or "already exists" in msg:
                    continue
                app.logger.warning(
                    "Migration step failed (continuing): %s — %s",
                    sql[:60], type(exc).__name__,
                )


def _seed_demo_data() -> None:
    """
    Seed demo admin and doctor accounts.

    H-6: This function is GATED by the entrypoint — it is only invoked when
    BOTH (FLASK_ENV != "production") AND (SEED_DEMO_DATA == "1"). The internal
    re-check below is defence-in-depth in case a future caller bypasses the
    entrypoint gate.

    Passwords are derived from SEED_ADMIN_PASSWORD; existing accounts are
    NEVER overwritten by seeding.
    """
    from models import Doctor, Patient, Observation, Alert
    from utils.crypto import hash_password
    from alerts import evaluate_observation

    settings = get_settings()

    # Defence-in-depth: refuse to seed in production no matter who calls us.
    if settings.is_production:
        raise RuntimeError(
            "[SECURITY] _seed_demo_data() invoked in production — refusing. "
            "Demo data must never be written to a production database."
        )

    _seed_pw = settings.SEED_ADMIN_PASSWORD
    if not _seed_pw:
        warnings.warn(
            "[SECURITY] SEED_ADMIN_PASSWORD not set — using insecure dev default. "
            "Set SEED_ADMIN_PASSWORD in .env to suppress this warning.",
            stacklevel=2,
        )
        _seed_pw = "ChangeMe#2026"

    from models import Admin
    if not Admin.query.filter_by(email="admin@tanprish-dynamics.com").first():
        db.session.add(Admin(
            name="Admin Manager",
            email="admin@tanprish-dynamics.com",
            password_hash=hash_password(_seed_pw),
            company="TanPrish Dynamics",
        ))

    if not Doctor.query.filter_by(email="admin@hospital.com").first():
        doctor = Doctor(
            name="Dr. Priya Sharma",
            email="admin@hospital.com",
            password_hash=hash_password(_seed_pw),
            license_number="MH-2026-001",
        )
        db.session.add(doctor)
        db.session.flush()
    else:
        doctor = Doctor.query.filter_by(email="admin@hospital.com").first()

    if Patient.query.filter_by(patient_id="PTH-001").first():
        db.session.commit()
        return

    now         = datetime.utcnow()
    admission_1 = now - timedelta(hours=10)
    p1 = Patient(
        patient_id="PTH-001", name="Amrita Deshpande", age=27,
        gravida=2, parity=1, gestational_age=39,
        admission_time=admission_1, doctor_id=doctor.id,
    )
    db.session.add(p1)
    db.session.flush()

    for h, dil, fhr, freq, dur, stn, fluid, mould, pulse, sys, dia, temp, prot, ket, vol in [
        (0,  3.0, 142, 2, 20, -3, "clear", "0",  78, 110, 70, 36.8, "nil", "nil", 200),
        (2,  5.0, 140, 3, 35, -2, "clear", "+",  82, 114, 74, 37.0, "nil", "nil", 150),
        (5,  8.0, 136, 4, 50, -1, "clear", "++", 86, 118, 76, 37.2, "nil", "+",  120),
        (8, 10.0, 150, 5, 60,  0, "clear", "++", 90, 122, 80, 37.1, "nil", "+",   80),
    ]:
        obs = Observation(
            patient_id=p1.id, timestamp=admission_1 + timedelta(hours=h),
            cervical_dilation=dil, fetal_heart_rate=fhr,
            contraction_freq=freq, contraction_duration=dur,
            head_station=stn, amniotic_fluid=fluid, moulding=mould,
            maternal_pulse=pulse, bp_systolic=sys, bp_diastolic=dia,
            temperature=temp, urine_protein=prot, urine_ketones=ket, urine_volume=vol,
        )
        db.session.add(obs)

    db.session.flush()
    all_obs_1 = Observation.query.filter_by(patient_id=p1.id).all()
    for o in all_obs_1:
        for a_data in evaluate_observation(o, all_obs_1):
            db.session.add(Alert(
                patient_id=p1.id, timestamp=o.timestamp, observation_id=o.id, **a_data
            ))

    db.session.commit()
    # L-1: replace print() with structured logger so demo-seed output flows
    # through the JSON log pipeline and any SIEM hook.
    logging.getLogger(__name__).info("Demo data seeded successfully.")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # NOTE: This entrypoint is for LOCAL development only. In production the
    # container CMD is `gunicorn app:create_app()` — see backend/Dockerfile.
    app = create_app()

    with app.app_context():
        db.create_all()
        _run_migrations(app)

        # H-6: Seed only when explicitly opted in AND not in production.
        settings = get_settings()
        if not settings.is_production and settings.SEED_DEMO_DATA == "1":
            _seed_demo_data()
        else:
            app.logger.info(
                "Demo seeding skipped (FLASK_ENV=%s, SEED_DEMO_DATA=%s).",
                settings.FLASK_ENV, settings.SEED_DEMO_DATA,
            )

    settings = get_settings()
    _debug   = not settings.is_production
    _port    = settings.PORT
    app.run(debug=_debug, port=_port)
