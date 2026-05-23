"""
utils/crypto.py — Encryption, hashing, and IDOR ownership helpers.

Centralises all crypto operations so they are easy to audit.

Password hashing: werkzeug.security uses scrypt by default in v3.x,
which is a memory-hard KDF comparable to Argon2 and stronger than bcrypt.
The effective work factor is equivalent to bcrypt cost=14.

Security hardening (multi-tenant isolation):
  - get_patient_for_doctor() is FAIL-CLOSED: a patient with doctor_id=None
    is treated as unowned and returns 403 to ALL doctors (not just admins).
    Previously the nullable check `if p.doctor_id is not None` allowed any
    doctor to access orphaned patients — this was the secondary IDOR vector.
  - get_observation_for_doctor() has the same fix applied.
  - log_unauthorized_access() records IDOR attempts in the AuditLog table
    for HIPAA compliance and security monitoring.
"""
import logging
from typing import Optional

from flask import abort, request
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


# ── Unauthorized access logger ────────────────────────────────────────────────

def log_unauthorized_access(
    doc_id: int,
    resource_type: str,
    resource_id,
    reason: str = "ownership_mismatch",
) -> None:
    """
    Write an AuditLog entry for a failed ownership check.

    This is called BEFORE abort(403) so the attempt is always recorded even
    though the response never reaches the caller. Failures here are logged
    but never allowed to surface a 500 — recording a security event should
    never break the application.
    """
    try:
        from extensions import db
        from models import AuditLog

        entry = AuditLog(
            user_id=str(doc_id),
            user_role="doctor",
            action="IDOR_ATTEMPT",
            resource=f"{resource_type}/{resource_id}"[:80],
            ip_address=(request.remote_addr or "")[:45] or None,
            status_code=403,
        )
        db.session.add(entry)
        db.session.commit()
    except Exception:
        logger.exception(
            "AuditLog write failed for unauthorized access attempt by doctor=%s "
            "on %s/%s (reason=%s). This is a secondary failure — primary 403 "
            "is still returned to the caller.",
            doc_id, resource_type, resource_id, reason,
        )
        try:
            from extensions import db
            db.session.rollback()
        except Exception:
            pass


# ── IDOR ownership helpers ────────────────────────────────────────────────────
# Imported by every blueprint that touches patient / observation data.

def get_patient_for_doctor(patient_id_str: str, doc_id: int):
    """
    Fetch a Patient by its string ID and enforce strict doctor ownership.

    SECURITY: This function is FAIL-CLOSED.
      - If the patient does not exist → 404 (no information leak)
      - If doctor_id is None (orphaned/legacy patient) → 403 for all non-admins
        PREVIOUSLY: `if p.doctor_id is not None and p.doctor_id != doc_id`
        allowed any doctor to read/write orphaned patients — this was an IDOR
        vulnerability. The fix removes the `is not None` guard entirely.
      - If doctor_id != requesting doctor → 403 + audit log
      - Admin role bypasses ownership (admin sees all patients by design)

    Aborts with 403 on ownership failure, 404 if the patient does not exist.
    """
    from models import Patient  # lazy import avoids circular deps

    p = Patient.query.filter_by(patient_id=patient_id_str).first_or_404()

    # Admin role bypasses ownership check — admins manage the whole system.
    if get_jwt().get("role") == "admin":
        return p

    # FAIL-CLOSED: treat NULL doctor_id as inaccessible to all doctors.
    # This prevents orphaned records (created before the isolation migration,
    # or via a seeding bug) from being visible to the entire doctor pool.
    if p.doctor_id is None:
        log_unauthorized_access(
            doc_id, "patient", patient_id_str,
            reason="null_doctor_id_fail_closed",
        )
        abort(403)

    # Strict ownership check.
    if p.doctor_id != doc_id:
        log_unauthorized_access(
            doc_id, "patient", patient_id_str,
            reason="ownership_mismatch",
        )
        abort(403)

    return p


def get_observation_for_doctor(obs_id: int, doc_id: int):
    """
    Fetch an Observation and enforce that the requesting doctor owns the
    patient it belongs to.

    SECURITY: Same fail-closed logic as get_patient_for_doctor().
    A patient with doctor_id=None returns 403 — not transparent access.

    Aborts 403/404 on failure.
    """
    from models import Observation, Patient  # lazy import

    obs = Observation.query.get_or_404(obs_id)
    patient = Patient.query.get_or_404(obs.patient_id)

    # Admin bypass.
    if get_jwt().get("role") == "admin":
        return obs

    # FAIL-CLOSED: NULL doctor_id → deny.
    if patient.doctor_id is None:
        log_unauthorized_access(
            doc_id, "observation", obs_id,
            reason="null_doctor_id_fail_closed",
        )
        abort(403)

    # Strict ownership.
    if patient.doctor_id != doc_id:
        log_unauthorized_access(
            doc_id, "observation", obs_id,
            reason="ownership_mismatch",
        )
        abort(403)

    return obs
