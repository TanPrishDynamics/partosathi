"""
middleware/rbac.py — Role-Based Access Control decorators.

Usage:
    @app.route("/api/admin/doctors")
    @admin_required()
    def list_doctors(): ...

    @app.route("/api/hospital/me")
    @hospital_required()
    def hospital_me(): ...
"""
from functools import wraps

from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt


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
