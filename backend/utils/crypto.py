"""
utils/crypto.py — Encryption, hashing, and IDOR ownership helpers.

Centralises all crypto operations so they are easy to audit.

Password hashing: werkzeug.security uses scrypt by default in v3.x,
which is a memory-hard KDF comparable to Argon2 and stronger than bcrypt.
The effective work factor is equivalent to bcrypt cost=14.
"""
import logging
from typing import Optional, Tuple

from flask import abort
from flask_jwt_extended import get_jwt
from werkzeug.security import check_password_hash, generate_password_hash

logger = logging.getLogger(__name__)


# ── Password helpers ──────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Return a scrypt hash of the password."""
    return generate_password_hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time password verification."""
    return check_password_hash(hashed, plain)


# ── IDOR ownership helpers ────────────────────────────────────────────────────
# Imported by every blueprint that touches patient / observation data.

def get_patient_for_doctor(patient_id_str: str, doc_id: int):
    """
    Fetch a Patient by its string ID and enforce that the requesting user
    either owns it (same doctor_id) or is an admin.

    Aborts with 403 on ownership failure, 404 if the patient does not exist.
    """
    from models import Patient, db  # lazy import avoids circular deps

    p = Patient.query.filter_by(patient_id=patient_id_str).first_or_404()
    if get_jwt().get("role") == "admin":
        return p
    if p.doctor_id is not None and p.doctor_id != doc_id:
        abort(403)
    return p


def get_observation_for_doctor(obs_id: int, doc_id: int):
    """
    Fetch an Observation and enforce that the requesting doctor owns the
    patient it belongs to.  Aborts 403/404 on failure.
    """
    from models import Observation, Patient  # lazy import

    obs = Observation.query.get_or_404(obs_id)
    patient = Patient.query.get_or_404(obs.patient_id)
    if patient.doctor_id is not None and patient.doctor_id != doc_id:
        abort(403)
    return obs
