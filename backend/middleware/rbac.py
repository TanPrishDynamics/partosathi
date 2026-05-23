"""
middleware/rbac.py — Role-Based Access Control decorators.

Usage:
    @app.route("/api/admin/doctors")
    @admin_required()
    def list_doctors(): ...

    @app.route("/api/hospital/me")
    @hospital_required()
    def hospital_me(): ...

    @app.route("/api/patient/<patient_id>")
    @doctor_required()
    def get_patient(patient_id): ...

Multi-tenant ownership validators (added for doctor isolation):
    validatePatientOwnership  — call inside a route to verify patient belongs
                                to the authenticated doctor before operating.
    validateObservationOwnership — same for observation routes.

These are thin wrappers over utils.crypto which is the single source of
truth for IDOR protection. They exist so route code reads declaratively.
"""
from functools import wraps

from flask import jsonify, g
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity


def _role_required(required_role: str):
    """Factory that returns a decorator enforcing a specific JWT role claim."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            role = get_jwt().get("role")
            if role != required_role:
                return jsonify({
                    "error": f"{required_role.title()} access required"
                }), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def admin_required():
    return _role_required("admin")


def hospital_required():
    return _role_required("hospital")


def doctor_required():
    """Allows both 'doctor' and 'admin' (admin can act on behalf of any doctor)."""
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            role = get_jwt().get("role")
            if role not in ("doctor", "admin"):
                return jsonify({"error": "Doctor or admin access required"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


# ── Ownership Validators ──────────────────────────────────────────────────────
# These are callable functions (not decorators) for use inside route handlers.
# They abort(403) on ownership failure, exactly like get_patient_for_doctor().

def validate_patient_ownership(patient_id_str: str):
    """
    Verify that the authenticated doctor owns patient_id_str.

    Call this inside a @jwt_required() route before any data operation:
        validate_patient_ownership(patient_id)
        # 403 aborted automatically if not owner

    Returns the Patient instance on success.
    """
    from utils.crypto import get_patient_for_doctor
    doc_id = int(get_jwt_identity())
    return get_patient_for_doctor(patient_id_str, doc_id)


def validate_observation_ownership(obs_id: int):
    """
    Verify that the authenticated doctor owns the patient of observation obs_id.

    Returns the Observation instance on success.
    """
    from utils.crypto import get_observation_for_doctor
    doc_id = int(get_jwt_identity())
    return get_observation_for_doctor(obs_id, doc_id)


def inject_doctor_context(fn):
    """
    Decorator: extracts doctor_id from JWT and injects it into Flask g.

    Usage:
        @app.route("/api/some-route")
        @jwt_required()
        @inject_doctor_context
        def some_route():
            doctor_id = g.doctor_id  # always from JWT, never from request body
            ...
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        claims = get_jwt()
        role   = claims.get("role", "")
        identity = get_jwt_identity()
        g.doctor_id  = int(identity) if identity else None
        g.user_role  = role
        g.is_admin   = role == "admin"
        g.is_doctor  = role in ("doctor", "admin")
        g.is_hospital = role == "hospital"
        return fn(*args, **kwargs)
    return wrapper
