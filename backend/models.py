"""
models.py — SQLAlchemy ORM models for e-Partogram multi-tenant SaaS.

Security features:
  - EncryptedString TypeDecorator: Fernet field-level encryption for PHI columns
    (Patient.name and others). FAIL-CLOSED: refuses to import without a valid key.
  - AuditLog model: HIPAA §164.312(b) PHI access trail (no payload stored)
  - TokenBlocklist: server-side JWT revocation (logout + refresh rotation)
  - ObservationHistory: immutable audit trail for observation edits
  - Alert: acknowledged_by / acknowledged_at for WHO-acknowledged attribution
  - Patient: consent_obtained / consent_date / consent_method for GDPR/DPDP
  - Admin: totp_secret / totp_enabled columns for TOTP MFA (M-7)

Multi-tenant RBAC:
  - SUPER_ADMIN  → Admin model
  - HOSPITAL     → Hospital model (enterprise client)
  - DOCTOR       → Doctor model (individual practitioner)
"""
import logging
import os
from datetime import datetime

from extensions import db
from sqlalchemy import TypeDecorator, String

log = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# C-3: Field-level encryption — FAIL-CLOSED key initialisation
# ──────────────────────────────────────────────────────────────────────────────
# Previously, missing FIELD_ENCRYPTION_KEY caused _fernet=None and the
# EncryptedString columns silently degraded to plaintext storage. That meant
# patient names could be written unencrypted whenever an env var was forgotten.
#
# New behaviour: refuse to even import this module without a valid Fernet key.
# Combined with the matching guard in config/settings.py, this guarantees PHI
# is never written in clear text under any environment.
# ──────────────────────────────────────────────────────────────────────────────
from cryptography.fernet import Fernet, InvalidToken as _InvalidToken  # noqa: E402

_raw_key = os.environ.get("FIELD_ENCRYPTION_KEY", "")
_fernet_key_bytes = _raw_key.encode() if isinstance(_raw_key, str) else _raw_key

if not _fernet_key_bytes or len(_fernet_key_bytes) < 32:
    # Hard fail at import time. The error message intentionally does NOT echo
    # any key material — only the remediation instructions.
    raise RuntimeError(
        "[SECURITY] FIELD_ENCRYPTION_KEY is missing or invalid. "
        "e-Partogram refuses to start without PHI encryption configured.\n"
        "Generate a key with:\n"
        "  python3 -c \"from cryptography.fernet import Fernet; "
        "print(Fernet.generate_key().decode())\"\n"
        "Then add to your .env as:  FIELD_ENCRYPTION_KEY=<value>"
    )

try:
    _fernet = Fernet(_fernet_key_bytes)
except Exception as exc:  # invalid base64 / wrong length
    raise RuntimeError(
        "[SECURITY] FIELD_ENCRYPTION_KEY is not a valid Fernet key. "
        f"Underlying error type: {type(exc).__name__}"
    ) from exc


# ── Encrypted column type ─────────────────────────────────────────────────────

class EncryptedString(TypeDecorator):
    """
    Fernet-based AES-128-CBC + HMAC-SHA256 encrypted column for PHI fields.

    Write path  : plain → Fernet.encrypt → store ciphertext (~96 bytes overhead).
    Read path   : ciphertext → Fernet.decrypt → plain.

    Backward-compat read: if a row contains plaintext (e.g. legacy data written
    before encryption was enabled), Fernet.decrypt raises InvalidToken. We log
    a warning AND return the raw value so the application keeps working. Run
    `scripts/migrate_encrypt_patient_names.py` to convert legacy rows.
    """
    impl = String(512)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        # _fernet is GUARANTEED non-None by the import-time guard above.
        if value is None:
            return value
        return _fernet.encrypt(value.encode()).decode()

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        try:
            return _fernet.decrypt(value.encode()).decode()
        except _InvalidToken:
            # Legacy plaintext row OR key rotation — warn once and pass through.
            # We do NOT log the value itself to avoid logging PHI.
            log.warning(
                "EncryptedString: decrypt failed (legacy plaintext or key "
                "rotation). Run scripts/migrate_encrypt_patient_names.py."
            )
            return value
        except Exception:
            # Defensive: any other crypto failure → return raw so the app
            # remains operational; surface in logs for ops to investigate.
            log.exception("EncryptedString: unexpected decrypt error.")
            return value


# ── Token revocation blocklist ────────────────────────────────────────────────

class TokenBlocklist(db.Model):
    """
    Server-side JWT revocation store.
    On logout or refresh-token rotation, the old JTI is inserted here.
    The JWT @token_in_blocklist_loader checks this table on every request.
    Entries can be pruned after their expires_at timestamp passes.
    """
    __tablename__ = "token_blocklist"
    id         = db.Column(db.Integer,   primary_key=True)
    jti        = db.Column(db.String(36), nullable=False, unique=True, index=True)
    created_at = db.Column(db.DateTime,  default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime,  nullable=False, index=True)


# ── Admin ─────────────────────────────────────────────────────────────────────

class Admin(db.Model):
    __tablename__ = "admins"
    id            = db.Column(db.Integer,     primary_key=True)
    name          = db.Column(db.String(120),  nullable=False)
    email         = db.Column(db.String(120),  unique=True, nullable=False)
    password_hash = db.Column(db.String(256),  nullable=False)
    company       = db.Column(db.String(120),  default="TanPrish Dynamics")

    # ── M-7: TOTP MFA columns ────────────────────────────────────────────────
    # totp_secret holds the base32-encoded shared secret (pyotp.random_base32()).
    # totp_enabled is the explicit on/off switch — login MFA enforcement reads
    # this flag, so a deployed Admin with totp_enabled=False keeps working
    # exactly as before until enrollment is completed via /api/auth/mfa/setup.
    totp_secret   = db.Column(db.String(64),  nullable=True)
    totp_enabled  = db.Column(db.Boolean,     default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id, "name": self.name,
            "email": self.email, "company": self.company,
            "role": "admin",
            # totp_enabled is the only MFA-related field exposed to the client;
            # the secret itself is NEVER returned.
            "totp_enabled": bool(self.totp_enabled),
        }


# ── Hospital ──────────────────────────────────────────────────────────────────

class Hospital(db.Model):
    """Enterprise hospital client — strict admin-approval required."""
    __tablename__ = "hospitals"
    id                  = db.Column(db.Integer,    primary_key=True)
    name                = db.Column(db.String(200), nullable=False)
    email               = db.Column(db.String(120), unique=True, nullable=False)
    password_hash       = db.Column(db.String(256), nullable=False)
    contact_person      = db.Column(db.String(120), nullable=False)
    phone               = db.Column(db.String(30),  nullable=True)
    address             = db.Column(db.String(500), nullable=True)
    license_number      = db.Column(db.String(80),  nullable=True)
    registration_number = db.Column(db.String(80),  nullable=True)
    num_doctors         = db.Column(db.Integer,     nullable=True)
    status              = db.Column(db.String(20),  default="pending_approval", nullable=False)
    patient_limit       = db.Column(db.Integer,     default=100, nullable=False)
    patients_used       = db.Column(db.Integer,     default=0,   nullable=False)
    created_at          = db.Column(db.DateTime,    default=datetime.utcnow, nullable=False)
    approved_at         = db.Column(db.DateTime,    nullable=True)
    approved_by         = db.Column(db.Integer,     nullable=True)
    rejection_reason    = db.Column(db.String(500), nullable=True)

    google_id           = db.Column(db.String(100), unique=True, nullable=True)
    auth_provider       = db.Column(db.String(20),  default="local", nullable=False)
    profile_picture     = db.Column(db.String(500), nullable=True)

    doctors = db.relationship("Doctor", backref="hospital_account", lazy=True,
                              foreign_keys="Doctor.hospital_id")

    def to_dict(self):
        return {
            "id":                  self.id,
            "name":                self.name,
            "email":               self.email,
            "contact_person":      self.contact_person,
            "phone":               self.phone,
            "address":             self.address,
            "license_number":      self.license_number,
            "registration_number": self.registration_number,
            "num_doctors":         self.num_doctors,
            "status":              self.status,
            "patient_limit":       self.patient_limit,
            "patients_used":       self.patients_used,
            "credits_remaining":   max(0, self.patient_limit - self.patients_used),
            "created_at":          self.created_at.isoformat() if self.created_at else None,
            "approved_at":         self.approved_at.isoformat() if self.approved_at else None,
            "rejection_reason":    self.rejection_reason,
            "auth_provider":       self.auth_provider,
            "profile_picture":     self.profile_picture,
            "type":                "hospital",
            "role":                "hospital",
        }


# ── Doctor ────────────────────────────────────────────────────────────────────

class Doctor(db.Model):
    __tablename__ = "doctors"
    id             = db.Column(db.Integer,     primary_key=True)
    name           = db.Column(db.String(120),  nullable=False)
    email          = db.Column(db.String(120),  unique=True, nullable=False)
    password_hash  = db.Column(db.String(256),  nullable=False)
    license_number = db.Column(db.String(50),   nullable=True)
    hospital       = db.Column(db.String(120),  default="TanPrish Dynamics Medical Center")
    specialization = db.Column(db.String(120),  nullable=True)
    phone          = db.Column(db.String(30),   nullable=True)
    created_at     = db.Column(db.DateTime,     default=datetime.utcnow, nullable=True)
    hospital_id    = db.Column(db.Integer,      db.ForeignKey("hospitals.id"), nullable=True)
    status           = db.Column(db.String(20),  default="approved", nullable=False)
    approved_at      = db.Column(db.DateTime,    nullable=True)
    approved_by      = db.Column(db.Integer,     nullable=True)
    rejection_reason = db.Column(db.String(500), nullable=True)
    patient_limit    = db.Column(db.Integer,     default=50, nullable=False)
    patients_used    = db.Column(db.Integer,     default=0,  nullable=False)
    access_type      = db.Column(db.String(20),  default="admin_created", nullable=False)

    google_id        = db.Column(db.String(100), unique=True, nullable=True)
    auth_provider    = db.Column(db.String(20),  default="local", nullable=False)
    profile_picture  = db.Column(db.String(500), nullable=True)

    patients = db.relationship("Patient", backref="doctor", lazy=True)

    def to_dict(self):
        return {
            "id":               self.id,
            "name":             self.name,
            "email":            self.email,
            "license_number":   self.license_number,
            "hospital":         self.hospital,
            "hospital_id":      self.hospital_id,
            "specialization":   self.specialization,
            "phone":            self.phone,
            "status":           self.status,
            "patient_limit":    self.patient_limit,
            "patients_used":    self.patients_used,
            "credits_remaining": max(0, self.patient_limit - self.patients_used),
            "access_type":      self.access_type,
            "created_at":       self.created_at.isoformat() if self.created_at else None,
            "approved_at":      self.approved_at.isoformat() if self.approved_at else None,
            "rejection_reason": self.rejection_reason,
            "auth_provider":    self.auth_provider,
            "profile_picture":  self.profile_picture,
            "role":             "doctor",
        }


# ── Patient ───────────────────────────────────────────────────────────────────

class Patient(db.Model):
    __tablename__ = "patients"
    id                    = db.Column(db.Integer,       primary_key=True)
    patient_id            = db.Column(db.String(20),    unique=True, nullable=False)
    name                  = db.Column(EncryptedString,  nullable=False)   # Fernet encrypted
    age                   = db.Column(db.Integer,       nullable=False)
    gravida               = db.Column(db.Integer,       default=1)
    parity                = db.Column(db.Integer,       default=0)
    gestational_age       = db.Column(db.Integer,       nullable=False)
    admission_time        = db.Column(db.DateTime,      default=datetime.utcnow)
    membrane_rupture_time = db.Column(db.DateTime,      nullable=True)
    status                = db.Column(db.String(20),    default="Active")
    doctor_id             = db.Column(db.Integer,       db.ForeignKey("doctors.id"), nullable=True)
    consent_obtained      = db.Column(db.Boolean,       default=False, nullable=False)
    consent_date          = db.Column(db.DateTime,      nullable=True)
    consent_method        = db.Column(db.String(30),    nullable=True)

    observations = db.relationship("Observation", backref="patient", lazy=True, cascade="all, delete-orphan")
    alerts       = db.relationship("Alert",       backref="patient", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":                    self.id,
            "patient_id":            self.patient_id,
            "name":                  self.name,
            "age":                   self.age,
            "gravida":               self.gravida,
            "parity":                self.parity,
            "gestational_age":       self.gestational_age,
            "admission_time":        self.admission_time.isoformat() if self.admission_time else None,
            "membrane_rupture_time": self.membrane_rupture_time.isoformat() if self.membrane_rupture_time else None,
            "status":                self.status,
            "doctor_id":             self.doctor_id,
            "consent_obtained":      self.consent_obtained,
            "consent_date":          self.consent_date.isoformat() if self.consent_date else None,
            "consent_method":        self.consent_method,
        }


# ── Observation ───────────────────────────────────────────────────────────────

class Observation(db.Model):
    __tablename__ = "observations"
    id                   = db.Column(db.Integer,  primary_key=True)
    patient_id           = db.Column(db.Integer,  db.ForeignKey("patients.id"), nullable=False)
    timestamp            = db.Column(db.DateTime, default=datetime.utcnow)
    cervical_dilation    = db.Column(db.Float)
    head_station         = db.Column(db.Float)
    fetal_heart_rate     = db.Column(db.Integer)
    amniotic_fluid       = db.Column(db.String(30))
    moulding             = db.Column(db.String(5))
    contraction_freq     = db.Column(db.Float)
    contraction_duration = db.Column(db.Integer)
    maternal_pulse       = db.Column(db.Integer)
    bp_systolic          = db.Column(db.Integer)
    bp_diastolic         = db.Column(db.Integer)
    temperature          = db.Column(db.Float)
    urine_protein        = db.Column(db.String(10))
    urine_ketones        = db.Column(db.String(10))
    urine_volume         = db.Column(db.Integer)

    history = db.relationship("ObservationHistory", backref="observation", lazy=True,
                              cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":                   self.id,
            "patient_id":           self.patient_id,
            "timestamp":            self.timestamp.isoformat() if self.timestamp else None,
            "cervical_dilation":    self.cervical_dilation,
            "head_station":         self.head_station,
            "fetal_heart_rate":     self.fetal_heart_rate,
            "amniotic_fluid":       self.amniotic_fluid,
            "moulding":             self.moulding,
            "contraction_freq":     self.contraction_freq,
            "contraction_duration": self.contraction_duration,
            "maternal_pulse":       self.maternal_pulse,
            "bp_systolic":          self.bp_systolic,
            "bp_diastolic":         self.bp_diastolic,
            "temperature":          self.temperature,
            "urine_protein":        self.urine_protein,
            "urine_ketones":        self.urine_ketones,
            "urine_volume":         self.urine_volume,
        }


# ── Observation history (immutable edit audit trail) ──────────────────────────

class ObservationHistory(db.Model):
    """
    Immutable audit trail for observation PATCHes.
    Each field change is recorded with who changed it and when.
    Addresses HIPAA §164.312(b) requirement for modification audit.
    """
    __tablename__ = "observation_history"
    id             = db.Column(db.Integer,    primary_key=True)
    observation_id = db.Column(db.Integer,    db.ForeignKey("observations.id"), nullable=False, index=True)
    changed_by     = db.Column(db.Integer,    nullable=False)   # doctor_id
    changed_at     = db.Column(db.DateTime,   default=datetime.utcnow, nullable=False, index=True)
    field_name     = db.Column(db.String(50),  nullable=False)
    old_value      = db.Column(db.String(100), nullable=True)
    new_value      = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            "id":             self.id,
            "observation_id": self.observation_id,
            "changed_by":     self.changed_by,
            "changed_at":     self.changed_at.isoformat() if self.changed_at else None,
            "field_name":     self.field_name,
            "old_value":      self.old_value,
            "new_value":      self.new_value,
        }


# ── Alert ──────────────────────────────────────────────────────────────────────

class Alert(db.Model):
    __tablename__ = "alerts"
    id              = db.Column(db.Integer,    primary_key=True)
    patient_id      = db.Column(db.Integer,    db.ForeignKey("patients.id"), nullable=False)
    timestamp       = db.Column(db.DateTime,   default=datetime.utcnow)
    alert_type      = db.Column(db.String(60),  nullable=False)
    severity        = db.Column(db.String(10),  nullable=False)
    message         = db.Column(db.String(300), nullable=False)
    observation_id  = db.Column(db.Integer,    db.ForeignKey("observations.id"), nullable=True)
    acknowledged    = db.Column(db.Boolean,    default=False)
    acknowledged_by = db.Column(db.Integer,    nullable=True)   # doctor_id
    acknowledged_at = db.Column(db.DateTime,   nullable=True)

    def to_dict(self):
        return {
            "id":               self.id,
            "patient_id":       self.patient_id,
            "timestamp":        self.timestamp.isoformat() if self.timestamp else None,
            "alert_type":       self.alert_type,
            "severity":         self.severity,
            "message":          self.message,
            "observation_id":   self.observation_id,
            "acknowledged":     self.acknowledged,
            "acknowledged_by":  self.acknowledged_by,
            "acknowledged_at":  self.acknowledged_at.isoformat() if self.acknowledged_at else None,
        }


# ── AuditLog ──────────────────────────────────────────────────────────────────

class AuditLog(db.Model):
    """HIPAA §164.312(b) — PHI access audit trail (no PHI payload stored)."""
    __tablename__ = "audit_logs"
    id          = db.Column(db.Integer,   primary_key=True)
    timestamp   = db.Column(db.DateTime,  default=datetime.utcnow, nullable=False, index=True)
    user_id     = db.Column(db.String(20), nullable=True)
    user_role   = db.Column(db.String(20), nullable=True)
    action      = db.Column(db.String(10), nullable=False)
    resource    = db.Column(db.String(80), nullable=False)
    ip_address  = db.Column(db.String(45), nullable=True)
    status_code = db.Column(db.Integer,   nullable=True)


# ── AdminAction ───────────────────────────────────────────────────────────────

class AdminAction(db.Model):
    """Immutable audit trail of admin decisions."""
    __tablename__ = "admin_actions"
    id          = db.Column(db.Integer,    primary_key=True)
    admin_id    = db.Column(db.Integer,    db.ForeignKey("admins.id"), nullable=False)
    action      = db.Column(db.String(40),  nullable=False)
    target_type = db.Column(db.String(20),  nullable=False)
    target_id   = db.Column(db.Integer,    nullable=False)
    details     = db.Column(db.String(500), nullable=True)
    timestamp   = db.Column(db.DateTime,   default=datetime.utcnow, nullable=False, index=True)

    def to_dict(self):
        return {
            "id":          self.id,
            "admin_id":    self.admin_id,
            "action":      self.action,
            "target_type": self.target_type,
            "target_id":   self.target_id,
            "details":     self.details,
            "timestamp":   self.timestamp.isoformat() if self.timestamp else None,
        }


# ── Notification ──────────────────────────────────────────────────────────────

class Notification(db.Model):
    __tablename__ = "notifications"
    id             = db.Column(db.Integer,    primary_key=True)
    recipient_type = db.Column(db.String(20),  nullable=False, index=True)
    recipient_id   = db.Column(db.Integer,    nullable=False, index=True)
    title          = db.Column(db.String(160), nullable=False)
    message        = db.Column(db.String(500), nullable=False)
    notif_type     = db.Column(db.String(40),  nullable=False)
    is_read        = db.Column(db.Boolean,    default=False, nullable=False)
    created_at     = db.Column(db.DateTime,   default=datetime.utcnow, nullable=False, index=True)
    ref_id         = db.Column(db.Integer,    nullable=True)

    def to_dict(self):
        return {
            "id":             self.id,
            "recipient_type": self.recipient_type,
            "recipient_id":   self.recipient_id,
            "title":          self.title,
            "message":        self.message,
            "notif_type":     self.notif_type,
            "is_read":        self.is_read,
            "created_at":     self.created_at.isoformat() if self.created_at else None,
            "ref_id":         self.ref_id,
        }


# ── CreditRequest ──────────────────────────────────────────────────────────────

class CreditRequest(db.Model):
    __tablename__ = "credit_requests"
    id              = db.Column(db.Integer,    primary_key=True)
    requester_type  = db.Column(db.String(20),  nullable=False, index=True)
    requester_id    = db.Column(db.Integer,    nullable=False, index=True)
    requester_name  = db.Column(db.String(120), nullable=True)
    requester_email = db.Column(db.String(120), nullable=True)
    amount          = db.Column(db.Integer,    nullable=False)
    reason          = db.Column(db.String(500), nullable=True)
    status          = db.Column(db.String(20),  default="pending", nullable=False, index=True)
    created_at      = db.Column(db.DateTime,   default=datetime.utcnow, nullable=False, index=True)
    resolved_at     = db.Column(db.DateTime,   nullable=True)
    resolved_by     = db.Column(db.Integer,    nullable=True)
    resolution_note = db.Column(db.String(500), nullable=True)

    def to_dict(self):
        return {
            "id":              self.id,
            "requester_type":  self.requester_type,
            "requester_id":    self.requester_id,
            "requester_name":  self.requester_name,
            "requester_email": self.requester_email,
            "amount":          self.amount,
            "reason":          self.reason,
            "status":          self.status,
            "created_at":      self.created_at.isoformat() if self.created_at else None,
            "resolved_at":     self.resolved_at.isoformat() if self.resolved_at else None,
            "resolution_note": self.resolution_note,
        }
