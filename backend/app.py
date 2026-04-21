"""
e-Partogram Backend — Flask REST API
Security-hardened: rate limiting, CSP headers, input validation, env-driven config.
"""
import os
from dotenv import load_dotenv
load_dotenv() # Load variables from .env
import json as _json
import re
import warnings
from datetime import datetime, timedelta, timezone
from functools import wraps
import io

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity, get_jwt,
    set_access_cookies, unset_jwt_cookies,
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from werkzeug.security import generate_password_hash, check_password_hash
from marshmallow import ValidationError

from models import db, Admin, Doctor, Patient, Observation, Alert
from alerts import evaluate_observation
from pdf_export import generate_pdf
from clinical_decision_support import process_labor_observation
from ml.inference import lstm_predictor
from audio_routes import audio_bp
from validators import (
    PatientSchema, ObservationSchema, DoctorCreateSchema,
    LoginSchema, validate_request
)


# ---------------------------------------------------------------------------
# App + Security Configuration
# ---------------------------------------------------------------------------

FLASK_ENV = os.environ.get("FLASK_ENV", "production")
IS_DEV    = FLASK_ENV == "development"

app = Flask(__name__)

# ── Request size limit: 512 KB max (protects against payload flooding) ─────────
app.config["MAX_CONTENT_LENGTH"] = 512 * 1024

# ── Database ───────────────────────────────────────────────────────────────────
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///partogram.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# ── JWT ───────────────────────────────────────────────────────────────────────
if IS_DEV:
    _jwt_secret = os.environ.get(
        "JWT_SECRET_KEY",
        "dev-only-insecure-key-do-NOT-use-in-production"
    )
    if "dev-only" in _jwt_secret:
        warnings.warn("[SECURITY] JWT_SECRET_KEY not set — using insecure dev key.",
                      stacklevel=2)
else:
    _jwt_secret = os.environ.get("JWT_SECRET_KEY")
    if not _jwt_secret or len(_jwt_secret) < 32:
        raise RuntimeError(
            "[SECURITY] JWT_SECRET_KEY must be set and at least 32 characters in production. "
            "Generate one: python3 -c \"import secrets; print(secrets.token_hex(32))\""
        )

app.config["JWT_SECRET_KEY"]         = _jwt_secret
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)
app.config["JWT_ALGORITHM"]           = "HS256"

# ── H-2: JWT via HttpOnly Cookies (XSS-resistant) ─────────────────────────────
app.config["JWT_TOKEN_LOCATION"]      = ["cookies"]
app.config["JWT_COOKIE_SECURE"]       = not IS_DEV   # True = HTTPS only in production
app.config["JWT_COOKIE_SAMESITE"]     = "Lax"
app.config["JWT_COOKIE_CSRF_PROTECT"] = not IS_DEV   # CSRF protection in production
app.config["JWT_ACCESS_COOKIE_NAME"]  = "access_token"

db.init_app(app)
jwt = JWTManager(app)

# ── CORS — must allow credentials for cookie-based auth ──────────────────────
_cors_origins = _json.loads(
    os.environ.get(
        "ALLOWED_ORIGINS",
        '["http://localhost:5173","http://127.0.0.1:5173","http://localhost:5174","http://localhost:5175"]'
    )
)
CORS(app, origins=_cors_origins, supports_credentials=True)

# ── M-1: Rate Limiter — Redis with memory fallback ───────────────────────────
_ratelimit_storage = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
if _ratelimit_storage.startswith("redis://"):
    try:
        import redis as _redis_client
        _r = _redis_client.from_url(_ratelimit_storage, socket_connect_timeout=2)
        _r.ping()
        app.logger.info("[RATELIMIT] Redis connected: %s", _ratelimit_storage)
    except Exception as _re:
        app.logger.warning("[RATELIMIT] Redis unavailable (%s) — falling back to memory.", _re)
        _ratelimit_storage = "memory://"
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["500 per day", "100 per hour"],
    storage_uri=_ratelimit_storage,
)

# ── HTTP Security Headers (Flask-Talisman) ───────────────────────────────────────────
CONTENT_SECURITY_POLICY = {
    "default-src": "'self'",
    "script-src":  ["'self'"],
    "style-src":   ["'self'", "'unsafe-inline'",
                    "https://fonts.googleapis.com"],
    "font-src":    ["'self'", "https://fonts.gstatic.com"],
    "img-src":     ["'self'", "data:"],
    "connect-src": ["'self'"],
    "frame-ancestors": "'none'",    # X-Frame-Options: DENY equivalent
}
Talisman(
    app,
    force_https=not IS_DEV,          # HTTPS enforced in production only
    content_security_policy=CONTENT_SECURITY_POLICY,
    content_security_policy_nonce_in=["script-src"],
    strict_transport_security=not IS_DEV,
    strict_transport_security_max_age=31536000,  # 1 year HSTS
    frame_options="DENY",
    referrer_policy="strict-origin-when-cross-origin",
)

app.register_blueprint(audio_bp)



# ---------------------------------------------------------------------------
# Helper Decorators
# ---------------------------------------------------------------------------

def admin_required():
    """Decorator: verifies JWT role claim == 'admin' (cryptographically bound at issuance)."""
    def wrapper(fn):
        @wraps(fn)
        @jwt_required()
        def decorator(*args, **kwargs):
            claims = get_jwt()
            if claims.get("role") != "admin":
                return jsonify({"error": "Admin access required"}), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

# ---------------------------------------------------------------------------
# H-4: Ownership helpers — doctor can only touch their own patients' data
# ---------------------------------------------------------------------------

def _get_observation_for_doctor(obs_id, doc_id):
    """Returns observation if requesting doctor owns the patient. Aborts 403 otherwise."""
    from flask import abort
    obs = Observation.query.get_or_404(obs_id)
    patient = Patient.query.get_or_404(obs.patient_id)
    if patient.doctor_id is not None and patient.doctor_id != doc_id:
        abort(403)
    return obs


def _get_patient_for_doctor(patient_id_str, doc_id):
    """Returns patient if requesting doctor owns it. Aborts 403 otherwise."""
    from flask import abort
    p = Patient.query.filter_by(patient_id=patient_id_str).first_or_404()
    if p.doctor_id is not None and p.doctor_id != doc_id:
        abort(403)
    return p


# ---------------------------------------------------------------------------
# Seed demo data
# ---------------------------------------------------------------------------

def seed_demo_data():
    """Seed a demo admin, demo doctor and two sample patients with observations."""
    
    # demo admin
    if not Admin.query.filter_by(email="admin@tanprish-dynamics.com").first():
        admin = Admin(
            name="Admin Manager",
            email="admin@tanprish-dynamics.com",
            password_hash=generate_password_hash("admin123"),
            company="TanPrish Dynamics",
        )
        db.session.add(admin)

    # demo doctor
    if not Doctor.query.filter_by(email="admin@hospital.com").first():
        doctor = Doctor(
            name="Dr. Priya Sharma",
            email="admin@hospital.com",
            password_hash=generate_password_hash("admin123"),
            license_number="MH-2026-001",
        )
        db.session.add(doctor)
        db.session.flush()
    else:
        doctor = Doctor.query.filter_by(email="admin@hospital.com").first()

    # ---- Patient 1: PTH-001 — active labor, progressing well ----
    if Patient.query.filter_by(patient_id="PTH-001").first():
        db.session.commit()
        return # already seeded patients

    now = datetime.utcnow()
    admission_1 = now - timedelta(hours=10)
    p1 = Patient(
        patient_id="PTH-001",
        name="Amrita Deshpande",
        age=27,
        gravida=2,
        parity=1,
        gestational_age=39,
        admission_time=admission_1,
        doctor_id=doctor.id,
    )
    db.session.add(p1)
    db.session.flush()

    # Observations every hour
    obs_data_1 = [
        # (hours_offset, dil, fhr, freq, dur, station, fluid, mould, pulse, sys, dia, temp, prot, ket, vol)
        (0,  3.0, 142, 2, 20, -3, "clear",    "0",  78, 110, 70, 36.8, "nil", "nil", 200),
        (1,  4.0, 138, 3, 30, -3, "clear",    "0",  80, 112, 72, 36.9, "nil", "nil", 180),
        (2,  5.0, 145, 3, 35, -2, "clear",    "+",  82, 114, 74, 37.0, "nil", "nil", 150),
        (3,  6.0, 140, 4, 40, -2, "clear",    "+",  80, 116, 74, 37.1, "nil", "nil", 160),
        (4,  7.0, 148, 4, 45, -1, "clear",    "+",  84, 115, 75, 37.0, "nil", "+",  140),
        (5,  8.0, 136, 4, 50, -1, "clear",    "++", 86, 118, 76, 37.2, "nil", "+",  120),
        (6,  9.0, 144, 5, 55,  0, "clear",    "++", 88, 120, 78, 37.3, "nil", "+",  100),
        (7, 10.0, 150, 5, 60,  0, "clear",    "++", 90, 122, 80, 37.1, "nil", "+",   80),
    ]

    for h, dil, fhr, freq, dur, stn, fluid, mould, pulse, sys, dia, temp, prot, ket, vol in obs_data_1:
        o = Observation(
            patient_id=p1.id,
            timestamp=admission_1 + timedelta(hours=h),
            cervical_dilation=dil, fetal_heart_rate=fhr,
            contraction_freq=freq, contraction_duration=dur,
            head_station=stn, amniotic_fluid=fluid, moulding=mould,
            maternal_pulse=pulse, bp_systolic=sys, bp_diastolic=dia,
            temperature=temp, urine_protein=prot, urine_ketones=ket, urine_volume=vol,
        )
        db.session.add(o)

    db.session.flush()

    # Generate alerts for patient 1
    all_obs_1 = Observation.query.filter_by(patient_id=p1.id).all()
    for o in all_obs_1:
        triggered = evaluate_observation(o, all_obs_1)
        for a_data in triggered:
            al = Alert(
                patient_id=p1.id,
                timestamp=o.timestamp,
                observation_id=o.id,
                **a_data,
            )
            db.session.add(al)

    # ---- Patient 2: PTH-002 — problematic labor with alerts ----
    admission_2 = now - timedelta(hours=8)
    p2 = Patient(
        patient_id="PTH-002",
        name="Kavitha Nair",
        age=32,
        gravida=1,
        parity=0,
        gestational_age=40,
        admission_time=admission_2,
        doctor_id=doctor.id,
    )
    db.session.add(p2)
    db.session.flush()

    obs_data_2 = [
        (0,  4.0, 145, 3, 30, -3, "clear",    "0",  80, 130, 82, 36.9, "nil", "nil", 200),
        (2,  5.0, 105, 3, 35, -3, "meconium", "+",  85, 144, 92, 37.5, "+",  "nil", 180),
        (4,  5.5, 168, 4, 50, -3, "meconium", "++", 102,150, 95, 38.2, "+",  "+",  150),
        (6,  6.0, 170, 5, 55, -3, "meconium", "++", 108,155, 98, 38.5, "++", "+",  100),
    ]

    for h, dil, fhr, freq, dur, stn, fluid, mould, pulse, sys, dia, temp, prot, ket, vol in obs_data_2:
        o = Observation(
            patient_id=p2.id,
            timestamp=admission_2 + timedelta(hours=h),
            cervical_dilation=dil, fetal_heart_rate=fhr,
            contraction_freq=freq, contraction_duration=dur,
            head_station=stn, amniotic_fluid=fluid, moulding=mould,
            maternal_pulse=pulse, bp_systolic=sys, bp_diastolic=dia,
            temperature=temp, urine_protein=prot, urine_ketones=ket, urine_volume=vol,
        )
        db.session.add(o)

    db.session.flush()

    all_obs_2 = Observation.query.filter_by(patient_id=p2.id).all()
    for o in all_obs_2:
        triggered = evaluate_observation(o, all_obs_2)
        for a_data in triggered:
            al = Alert(
                patient_id=p2.id,
                timestamp=o.timestamp,
                observation_id=o.id,
                **a_data,
            )
            db.session.add(al)

    db.session.commit()
    print("✅ Demo data seeded successfully.")


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route("/api/auth/admin-login", methods=["POST"])
@limiter.limit("5 per minute; 20 per hour")   # brute-force protection
def admin_login():
    """Admin/Company login endpoint — sets JWT as HttpOnly cookie."""
    payload, err = validate_request(LoginSchema, request.get_json())
    if err:
        return jsonify(err), 422

    admin = Admin.query.filter_by(email=payload["email"]).first()
    if not admin or not check_password_hash(admin.password_hash, payload["password"]):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(
        identity=str(admin.id),
        additional_claims={"role": "admin", "type": "admin"}
    )
    resp = jsonify({"user": admin.to_dict(), "role": "admin"})
    set_access_cookies(resp, token)   # H-2: token in HttpOnly cookie, not body
    return resp


@app.route("/api/auth/login", methods=["POST"])
@limiter.limit("10 per minute; 30 per hour")   # brute-force protection
def login():
    """Doctor login endpoint — sets JWT as HttpOnly cookie."""
    payload, err = validate_request(LoginSchema, request.get_json())
    if err:
        return jsonify(err), 422

    doctor = Doctor.query.filter_by(email=payload["email"]).first()
    if not doctor or not check_password_hash(doctor.password_hash, payload["password"]):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(
        identity=str(doctor.id),
        additional_claims={"role": "doctor", "type": "doctor"}
    )
    resp = jsonify({
        "doctor": {"id": doctor.id, "name": doctor.name, "email": doctor.email,
                   "license_number": doctor.license_number, "hospital": doctor.hospital},
        "role": "doctor"
    })
    set_access_cookies(resp, token)   # H-2: token in HttpOnly cookie, not body
    return resp


@app.route("/api/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    """Clears the JWT cookie — secure session termination."""
    resp = jsonify({"message": "Logged out successfully"})
    unset_jwt_cookies(resp)
    return resp


@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    doctor = Doctor.query.get(user_id)
    if doctor:
        return jsonify({"id": doctor.id, "name": doctor.name, "email": doctor.email, "license_number": doctor.license_number, "hospital": doctor.hospital, "role": "doctor"})
    admin = Admin.query.get_or_404(user_id)
    return jsonify({"id": admin.id, "name": admin.name, "email": admin.email, "company": admin.company, "role": "admin"})


# ---------------------------------------------------------------------------
# Admin Doctor Management Routes
# ---------------------------------------------------------------------------

@app.route("/api/admin/doctors", methods=["GET"])
@admin_required()
def list_doctors_admin():
    doctors = Doctor.query.all()
    return jsonify([{
        "id": d.id,
        "name": d.name,
        "email": d.email,
        "license_number": d.license_number,
        "hospital": d.hospital
    } for d in doctors])


@app.route("/api/admin/doctors", methods=["POST"])
@admin_required()
def create_doctor_admin():
    payload, err = validate_request(DoctorCreateSchema, request.get_json())
    if err:
        return jsonify(err), 422

    if Doctor.query.filter_by(email=payload["email"]).first():
        return jsonify({"error": "Doctor email already exists"}), 400

    doctor = Doctor(
        name=payload["name"],
        email=payload["email"],
        password_hash=generate_password_hash(payload["password"]),
        license_number=payload.get("license_number"),
        hospital=payload.get("hospital", "General Hospital")
    )
    db.session.add(doctor)
    db.session.commit()
    return jsonify({"success": True, "doctor": {"id": doctor.id, "name": doctor.name, "email": doctor.email}}), 201


@app.route("/api/admin/doctors/<int:doctor_id>", methods=["PATCH"])
@admin_required()
def update_doctor_admin(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    data = request.get_json()
    
    if "name" in data: doctor.name = data["name"]
    if "email" in data: 
        existing = Doctor.query.filter_by(email=data["email"]).first()
        if existing and existing.id != doctor.id:
            return jsonify({"error": "Email already in use"}), 400
        doctor.email = data["email"]
    if "license_number" in data: doctor.license_number = data["license_number"]
    if "hospital" in data: doctor.hospital = data["hospital"]
    if "password" in data:
        doctor.password_hash = generate_password_hash(data["password"])
        
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/admin/doctors/<int:doctor_id>", methods=["DELETE"])
@admin_required()
def delete_doctor_admin(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    db.session.delete(doctor)
    db.session.commit()
    return jsonify({"success": True})




# ---------------------------------------------------------------------------
# Patient routes
# ---------------------------------------------------------------------------

@app.route("/api/patients", methods=["GET"])
@jwt_required()
def list_patients():
    patients = Patient.query.order_by(Patient.admission_time.desc()).all()
    result = []
    for p in patients:
        d = p.to_dict()
        # Add alert counts
        alerts = Alert.query.filter_by(patient_id=p.id).all()
        d["alert_counts"] = {
            "red":    sum(1 for a in alerts if a.severity == "red" and not a.acknowledged),
            "yellow": sum(1 for a in alerts if a.severity == "yellow" and not a.acknowledged),
        }
        d["observation_count"] = Observation.query.filter_by(patient_id=p.id).count()
        result.append(d)
    return jsonify(result)


@app.route("/api/patient", methods=["POST"])
@jwt_required()
def create_patient():
    doc_id = int(get_jwt_identity())

    # ── Schema validation ─────────────────────────────────────────────────────
    payload, err = validate_request(PatientSchema, request.get_json())
    if err:
        return jsonify(err), 422

    # Auto-generate patient_id (collision-safe)
    count = Patient.query.count() + 1
    patient_id = f"PTH-{count:03d}"
    while Patient.query.filter_by(patient_id=patient_id).first():
        count += 1
        patient_id = f"PTH-{count:03d}"

    admission_time = payload.get("admission_time")
    if admission_time:
        try:
            admission_time = datetime.fromisoformat(admission_time.replace("Z", "+00:00"))
        except Exception:
            admission_time = datetime.utcnow()
    else:
        admission_time = datetime.utcnow()

    rupture_time = payload.get("membrane_rupture_time")
    if rupture_time:
        try:
            rupture_time = datetime.fromisoformat(rupture_time.replace("Z", "+00:00"))
        except Exception:
            rupture_time = None
    else:
        rupture_time = None

    p = Patient(
        patient_id=patient_id,
        name=payload["name"],
        age=payload["age"],
        gravida=payload["gravida"],
        parity=payload["parity"],
        gestational_age=payload["gestational_age"],
        admission_time=admission_time,
        membrane_rupture_time=rupture_time,
        doctor_id=doc_id,
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@app.route("/api/patient/<patient_id>", methods=["GET"])
@jwt_required()
def get_patient(patient_id):
    doc_id = int(get_jwt_identity())
    p = _get_patient_for_doctor(patient_id, doc_id)  # H-4: ownership check
    return jsonify(p.to_dict())


@app.route("/api/patient/<patient_id>", methods=["PATCH"])
@jwt_required()
def update_patient(patient_id):
    doc_id = int(get_jwt_identity())
    p = _get_patient_for_doctor(patient_id, doc_id)   # H-4: ownership check

    # H-5: Schema validation — no raw dict access on write paths
    payload, err = validate_request(PatientSchema, request.get_json())
    if err:
        return jsonify(err), 422

    if "name" in payload: p.name = payload["name"]
    if "age" in payload: p.age = int(payload["age"])
    if "gravida" in payload: p.gravida = int(payload["gravida"])
    if "parity" in payload: p.parity = int(payload["parity"])
    if "gestational_age" in payload: p.gestational_age = int(payload["gestational_age"])

    if "admission_time" in payload and payload["admission_time"]:
        try:
            p.admission_time = datetime.fromisoformat(payload["admission_time"].replace("Z", "+00:00"))
        except Exception:
            pass

    if "membrane_rupture_time" in payload:
        try:
            p.membrane_rupture_time = (
                datetime.fromisoformat(payload["membrane_rupture_time"].replace("Z", "+00:00"))
                if payload["membrane_rupture_time"] else None
            )
        except Exception:
            pass

    db.session.commit()
    refresh_patient_alerts(p.id)
    return jsonify(p.to_dict())


@app.route("/api/patient/<patient_id>/status", methods=["PATCH"])
@jwt_required()
def update_patient_status(patient_id):
    doc_id = int(get_jwt_identity())
    p = _get_patient_for_doctor(patient_id, doc_id)   # H-4: ownership check
    data = request.get_json()
    new_status = data.get("status")
    if new_status in ["Active", "Completed", "Inactive"]:
        p.status = new_status
        db.session.commit()
        return jsonify({"success": True, "status": p.status})
    return jsonify({"error": "Invalid status"}), 400


# ---------------------------------------------------------------------------
# Observation routes
# ---------------------------------------------------------------------------

@app.route("/api/observation", methods=["POST"])
@jwt_required()
def add_observation():
    data = request.get_json()

    p = Patient.query.filter_by(patient_id=data["patient_id"]).first_or_404()

    timestamp = data.get("timestamp")
    if timestamp:
        try:
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except Exception:
            timestamp = datetime.utcnow()
    else:
        timestamp = datetime.utcnow()

    def nullable_float(val):
        return float(val) if val not in (None, "", "null") else None

    def nullable_int(val):
        return int(val) if val not in (None, "", "null") else None

    obs = Observation(
        patient_id=p.id,
        timestamp=timestamp,
        cervical_dilation=nullable_float(data.get("cervical_dilation")),
        head_station=nullable_float(data.get("head_station")),
        fetal_heart_rate=nullable_int(data.get("fetal_heart_rate")),
        amniotic_fluid=data.get("amniotic_fluid") or None,
        moulding=data.get("moulding") or None,
        contraction_freq=nullable_float(data.get("contraction_freq")),
        contraction_duration=nullable_int(data.get("contraction_duration")),
        maternal_pulse=nullable_int(data.get("maternal_pulse")),
        bp_systolic=nullable_int(data.get("bp_systolic")),
        bp_diastolic=nullable_int(data.get("bp_diastolic")),
        temperature=nullable_float(data.get("temperature")),
        urine_protein=data.get("urine_protein") or None,
        urine_ketones=data.get("urine_ketones") or None,
        urine_volume=nullable_int(data.get("urine_volume")),
    )
    db.session.add(obs)
    db.session.flush()

    # Run clinical decision support
    all_obs = Observation.query.filter_by(patient_id=p.id).all()
    triggered = evaluate_observation(obs, all_obs)
    new_alerts = []
    for a_data in triggered:
        al = Alert(
            patient_id=p.id,
            timestamp=timestamp,
            observation_id=obs.id,
            **a_data,
        )
        db.session.add(al)
        new_alerts.append(al)

    db.session.commit()

    return jsonify({
        "observation": obs.to_dict(),
        "alerts_triggered": [a.to_dict() for a in new_alerts],
    }), 201


@app.route("/api/observations/<patient_id>", methods=["GET"])
@jwt_required()
def get_observations(patient_id):
    p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
    obs = Observation.query.filter_by(patient_id=p.id).order_by(Observation.timestamp).all()
    return jsonify([o.to_dict() for o in obs])


@app.route("/api/observation/<int:obs_id>", methods=["PATCH"])
@jwt_required()
def update_observation(obs_id):
    doc_id = int(get_jwt_identity())
    obs = _get_observation_for_doctor(obs_id, doc_id)  # H-4: IDOR protection
    data = request.get_json()
    
    def nullable_float(val):
        return float(val) if val not in (None, "", "null") else None
    def nullable_int(val):
        return int(val) if val not in (None, "", "null") else None

    if "timestamp" in data:
        try:
            obs.timestamp = datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
        except Exception:
            pass
        
    if "cervical_dilation" in data: obs.cervical_dilation = nullable_float(data["cervical_dilation"])
    if "head_station" in data: obs.head_station = nullable_float(data["head_station"])
    if "fetal_heart_rate" in data: obs.fetal_heart_rate = nullable_int(data["fetal_heart_rate"])
    if "amniotic_fluid" in data: obs.amniotic_fluid = data["amniotic_fluid"]
    if "moulding" in data: obs.moulding = data["moulding"]
    if "contraction_freq" in data: obs.contraction_freq = nullable_float(data["contraction_freq"])
    if "contraction_duration" in data: obs.contraction_duration = nullable_int(data["contraction_duration"])
    if "maternal_pulse" in data: obs.maternal_pulse = nullable_int(data["maternal_pulse"])
    if "bp_systolic" in data: obs.bp_systolic = nullable_int(data["bp_systolic"])
    if "bp_diastolic" in data: obs.bp_diastolic = nullable_int(data["bp_diastolic"])
    if "temperature" in data: obs.temperature = nullable_float(data["temperature"])
    if "urine_protein" in data: obs.urine_protein = data["urine_protein"]
    if "urine_ketones" in data: obs.urine_ketones = data["urine_ketones"]
    if "urine_volume" in data: obs.urine_volume = nullable_int(data["urine_volume"])

    db.session.commit()
    refresh_patient_alerts(obs.patient_id)
    return jsonify(obs.to_dict())


@app.route("/api/observation/<int:obs_id>", methods=["DELETE"])
@jwt_required()
def delete_observation(obs_id):
    doc_id = int(get_jwt_identity())
    obs = _get_observation_for_doctor(obs_id, doc_id)  # H-4: IDOR protection
    patient_id = obs.patient_id
    db.session.delete(obs)
    db.session.commit()
    refresh_patient_alerts(patient_id)
    return jsonify({"success": True})


def refresh_patient_alerts(patient_id):
    """Deletes all existing alerts for a patient and re-calculates everything."""
    # Store acknowledged alerts to try and preserve them
    old_alerts = Alert.query.filter_by(patient_id=patient_id, acknowledged=True).all()
    ack_keys = set((a.alert_type, a.observation_id) for a in old_alerts)
    
    Alert.query.filter_by(patient_id=patient_id).delete()
    db.session.flush()
    
    all_obs = Observation.query.filter_by(patient_id=patient_id).order_by(Observation.timestamp).all()
    for obs in all_obs:
        triggered = evaluate_observation(obs, all_obs)
        for a_data in triggered:
            new_al = Alert(
                patient_id=patient_id,
                timestamp=obs.timestamp,
                observation_id=obs.id,
                **a_data
            )
            # Restore acknowledgment if it was there before and observation hasn't changed its identity
            if (new_al.alert_type, new_al.observation_id) in ack_keys:
                new_al.acknowledged = True
            db.session.add(new_al)
    db.session.commit()


# ---------------------------------------------------------------------------
# Clinical Decision Support Routes
# ---------------------------------------------------------------------------

@app.route("/api/cds/predict-delivery/<patient_id>", methods=["GET"])
@jwt_required()
def predict_delivery_time(patient_id):
    p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
    observations = Observation.query.filter_by(patient_id=p.id).order_by(Observation.timestamp).all()
    
    # Format observations to dicts for model
    obs_dicts = [o.to_dict() for o in observations]
    
    # Run through phase 3 deep learning architecture
    prediction = lstm_predictor.predict(obs_dicts, p.to_dict())
    return jsonify(prediction), 200


@app.route("/api/cds/analyze-observation", methods=["POST"])
@jwt_required()
def analyze_observation_cds():
    """
    Clinical Decision Support analysis of a labor observation.
    Accepts: raw/freetext OR structured JSON format
    Returns: Normalized data + Clinical alerts + Graph-ready format
    
    Request body:
    {
        "patient_id": "PTH-001",
        "data": {raw observation data as JSON or freetext string}
    }
    """
    try:
        request_data = request.get_json()
        patient_id = request_data.get("patient_id")
        observation_data = request_data.get("data")
        
        if not patient_id or not observation_data:
            return jsonify({"error": "Missing patient_id or data"}), 400
        
        # Get patient for context
        p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
        
        # Get previous observation for dilation rate calculation
        previous_obs = Observation.query.filter_by(patient_id=p.id).order_by(
            Observation.timestamp.desc()
        ).first()
        
        previous_dilation = None
        time_diff_hours = None
        
        if previous_obs:
            previous_dilation = previous_obs.cervical_dilation
            if previous_obs.timestamp and "timestamp" in observation_data:
                try:
                    current_time = datetime.fromisoformat(
                        observation_data["timestamp"].replace("Z", "+00:00")
                    )
                    time_diff = current_time - previous_obs.timestamp
                    time_diff_hours = time_diff.total_seconds() / 3600
                except:
                    pass
        
        # Process observation through CDS
        cds_result = process_labor_observation(
            observation_data,
            previous_dilation=previous_dilation,
            time_diff_hours=time_diff_hours
        )
        
        if not cds_result["success"]:
            return jsonify(cds_result), 400
        
        # Prepare plotting data
        plot_data = {
            "x": cds_result["normalized_data"]["time_hours"],
            "y_dilation": cds_result["normalized_data"]["labor"]["cervical_dilation"],
            "y_station": cds_result["normalized_data"]["labor"]["head_descent"],
            "fhr": cds_result["normalized_data"]["fetal"]["fhr"],
            "contractions": cds_result["normalized_data"]["labor"]["contractions"]["count"]
        }
        
        return jsonify({
            "success": True,
            "patient_id": patient_id,
            "normalized_data": cds_result["normalized_data"],
            "alerts": cds_result["alerts"],
            "status": cds_result["status"],
            "alert_summary": {
                "total": cds_result["alert_count"],
                "critical": cds_result["critical_alerts"],
                "warning": cds_result["warning_alerts"]
            },
            "plot_ready": plot_data
        }), 200
        
    except Exception as e:
        app.logger.error("CDS analyze-observation error: %s", e, exc_info=True)
        return jsonify({"error": "An internal error occurred. Please contact support."}), 500


@app.route("/api/cds/batch-analyze", methods=["POST"])
@jwt_required()
def batch_analyze_observations():
    """
    Analyze multiple observations at once for a patient.
    Useful for historical data import or bulk analysis.
    
    Request body:
    {
        "patient_id": "PTH-001",
        "observations": [
            {observation1},
            {observation2},
            ...
        ]
    }
    """
    try:
        request_data = request.get_json()
        patient_id = request_data.get("patient_id")
        observations = request_data.get("observations", [])
        
        if not patient_id or not observations:
            return jsonify({"error": "Missing patient_id or observations"}), 400
        
        p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
        
        results = []
        previous_dilation = None
        previous_time = None
        
        for obs_data in observations:
            time_diff_hours = None
            
            if previous_time and "timestamp" in obs_data:
                try:
                    current_time = datetime.fromisoformat(
                        obs_data["timestamp"].replace("Z", "+00:00")
                    )
                    time_diff = current_time - previous_time
                    time_diff_hours = time_diff.total_seconds() / 3600
                    previous_time = current_time
                except:
                    pass
            elif "timestamp" in obs_data:
                try:
                    previous_time = datetime.fromisoformat(
                        obs_data["timestamp"].replace("Z", "+00:00")
                    )
                except:
                    pass
            
            cds_result = process_labor_observation(
                obs_data,
                previous_dilation=previous_dilation,
                time_diff_hours=time_diff_hours
            )
            
            if cds_result["success"]:
                previous_dilation = cds_result["normalized_data"]["labor"]["cervical_dilation"]
                results.append({
                    "normalized_data": cds_result["normalized_data"],
                    "alerts": cds_result["alerts"],
                    "status": cds_result["status"]
                })
        
        return jsonify({
            "success": True,
            "patient_id": patient_id,
            "observations_analyzed": len(results),
            "results": results
        }), 200
        
    except Exception as e:
        app.logger.error("CDS batch-analyze error: %s", e, exc_info=True)
        return jsonify({"error": "An internal error occurred. Please contact support."}), 500


# ---------------------------------------------------------------------------
# Alerts routes
# ---------------------------------------------------------------------------

@app.route("/api/alerts/<patient_id>", methods=["GET"])
@jwt_required()
def get_alerts(patient_id):
    p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
    alerts = Alert.query.filter_by(patient_id=p.id).order_by(Alert.timestamp.desc()).all()
    return jsonify([a.to_dict() for a in alerts])


@app.route("/api/alerts/<int:alert_id>/acknowledge", methods=["PATCH"])
@jwt_required()
def acknowledge_alert(alert_id):
    alert = Alert.query.get_or_404(alert_id)
    alert.acknowledged = True
    db.session.commit()
    return jsonify({"success": True})


# ---------------------------------------------------------------------------
# PDF export
# ---------------------------------------------------------------------------

@app.route("/api/export/pdf/<patient_id>", methods=["GET"])
@jwt_required()
def export_pdf(patient_id):
    p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
    observations = Observation.query.filter_by(patient_id=p.id).order_by(Observation.timestamp).all()
    alerts = Alert.query.filter_by(patient_id=p.id).order_by(Alert.timestamp).all()

    pdf_bytes = generate_pdf(p, observations, alerts)
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"partogram_{patient_id}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf",
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_demo_data()
    # ── Security: debug mode driven by env, never hardcoded ──────────────────
    _debug = os.environ.get("FLASK_ENV", "production") == "development"
    _port  = int(os.environ.get("PORT", 5001))
    app.run(debug=_debug, port=_port)
