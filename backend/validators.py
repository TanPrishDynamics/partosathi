"""
backend/validators.py
=====================
Marshmallow schemas — strict input validation for all API endpoints.
Python equivalent of Joi/Zod schemas.

Password policy (enforced on all write paths):
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one digit
  - At least one special character  ← NEW (was missing)
"""
import re

from marshmallow import (
    Schema, ValidationError, fields, pre_load, validate, validates, EXCLUDE,
)


# ── Password strength ─────────────────────────────────────────────────────────

_SPECIAL_CHARS = r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>?/\\|`~]"


def _validate_password_strength(value: str) -> None:
    errors = []
    if not re.search(r"[A-Z]", value):
        errors.append("at least one uppercase letter")
    if not re.search(r"[0-9]", value):
        errors.append("at least one digit")
    if not re.search(_SPECIAL_CHARS, value):
        errors.append("at least one special character (!@#$%^&* etc.)")
    if errors:
        raise ValidationError(
            f"Password must contain {', '.join(errors)}."
        )


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginSchema(Schema):
    email    = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=1, max=128))

    @pre_load
    def strip_fields(self, data, **kwargs):
        if isinstance(data.get("email"), str):
            data["email"] = data["email"].strip().lower()
        return data


# ── Patient ───────────────────────────────────────────────────────────────────

class PatientSchema(Schema):
    name                  = fields.Str(required=True, validate=validate.Length(min=2, max=120))
    age                   = fields.Int(required=True, validate=validate.Range(min=10, max=60))
    gravida               = fields.Int(load_default=1, validate=validate.Range(min=0, max=20))
    parity                = fields.Int(load_default=0, validate=validate.Range(min=0, max=20))
    gestational_age       = fields.Int(required=True, validate=validate.Range(min=20, max=45))
    admission_time        = fields.Str(load_default=None)
    membrane_rupture_time = fields.Str(load_default=None)
    consent_obtained      = fields.Bool(load_default=False)
    consent_method        = fields.Str(
        load_default=None,
        validate=validate.OneOf(["verbal", "written", "digital", None])
    )

    @pre_load
    def strip_strings(self, data, **kwargs):
        if isinstance(data.get("name"), str):
            data["name"] = data["name"].strip()
        return data

    @validates("name")
    def validate_name(self, value):
        if not re.match(r"^[A-Za-z\s\-\.\']+$", value):
            raise ValidationError("Name contains invalid characters.")


# ── Observation ───────────────────────────────────────────────────────────────

class ObservationSchema(Schema):
    """Used on BOTH POST (create) and PATCH (update) observation routes."""
    class Meta:
        unknown = EXCLUDE   # silently drop unknown fields

    patient_id           = fields.Str(load_default=None)
    timestamp            = fields.Str(load_default=None)
    cervical_dilation    = fields.Float(load_default=None, validate=validate.Range(min=0.0,  max=10.0))
    head_station         = fields.Float(load_default=None, validate=validate.Range(min=-5.0, max=5.0))
    fetal_heart_rate     = fields.Int(load_default=None,   validate=validate.Range(min=50,   max=250))
    amniotic_fluid       = fields.Str(load_default=None,
                                      validate=validate.OneOf(["clear", "meconium", "blood", "absent", "other", None]))
    moulding             = fields.Str(load_default=None,
                                      validate=validate.OneOf(["0", "+", "++", "+++", None]))
    contraction_freq     = fields.Float(load_default=None, validate=validate.Range(min=0.0,  max=10.0))
    contraction_duration = fields.Int(load_default=None,   validate=validate.Range(min=0,    max=120))
    maternal_pulse       = fields.Int(load_default=None,   validate=validate.Range(min=30,   max=250))
    bp_systolic          = fields.Int(load_default=None,   validate=validate.Range(min=50,   max=250))
    bp_diastolic         = fields.Int(load_default=None,   validate=validate.Range(min=30,   max=160))
    temperature          = fields.Float(load_default=None, validate=validate.Range(min=34.0, max=42.0))
    urine_protein        = fields.Str(load_default=None,   validate=validate.OneOf(["nil", "+", "++", "+++", None]))
    urine_ketones        = fields.Str(load_default=None,   validate=validate.OneOf(["nil", "+", "++", "+++", None]))
    urine_volume         = fields.Int(load_default=None,   validate=validate.Range(min=0,    max=2000))


# ── Doctor / Hospital signup ──────────────────────────────────────────────────

class DoctorPublicSignupSchema(Schema):
    name           = fields.Str(required=True, validate=validate.Length(min=2, max=120))
    email          = fields.Email(required=True)
    password       = fields.Str(required=True, validate=validate.Length(min=8, max=128))
    license_number = fields.Str(load_default=None, validate=validate.Length(max=50))
    hospital       = fields.Str(load_default=None, validate=validate.Length(max=200))
    specialization = fields.Str(load_default=None, validate=validate.Length(max=120))
    access_type    = fields.Str(load_default="self_signup",
                                validate=validate.OneOf(["self_signup", "paid"]))

    @pre_load
    def normalize(self, data, **kwargs):
        if isinstance(data.get("email"), str):
            data["email"] = data["email"].strip().lower()
        if isinstance(data.get("name"), str):
            data["name"] = data["name"].strip()
        return data

    @validates("password")
    def validate_password_complexity(self, value):
        _validate_password_strength(value)


class HospitalSignupSchema(Schema):
    name           = fields.Str(required=True, validate=validate.Length(min=2, max=200))
    email          = fields.Email(required=True)
    password       = fields.Str(required=True, validate=validate.Length(min=8, max=128))
    contact_person = fields.Str(required=True, validate=validate.Length(min=2, max=120))
    phone          = fields.Str(load_default=None, validate=validate.Length(max=30))
    address        = fields.Str(load_default=None, validate=validate.Length(max=500))
    license_number = fields.Str(load_default=None, validate=validate.Length(max=80))

    @pre_load
    def normalize(self, data, **kwargs):
        for field in ("email", "name", "contact_person"):
            if isinstance(data.get(field), str):
                data[field] = data[field].strip()
        if isinstance(data.get("email"), str):
            data["email"] = data["email"].lower()
        return data

    @validates("password")
    def validate_password_complexity(self, value):
        _validate_password_strength(value)


# ── Admin schemas ─────────────────────────────────────────────────────────────

class DoctorCreateSchema(Schema):
    name           = fields.Str(required=True, validate=validate.Length(min=2, max=120))
    email          = fields.Email(required=True)
    password       = fields.Str(required=True, validate=validate.Length(min=8, max=128))
    license_number = fields.Str(load_default=None, validate=validate.Length(max=50))
    hospital       = fields.Str(load_default="General Hospital", validate=validate.Length(max=200))

    @pre_load
    def normalize(self, data, **kwargs):
        if isinstance(data.get("email"), str):
            data["email"] = data["email"].strip().lower()
        if isinstance(data.get("name"), str):
            data["name"] = data["name"].strip()
        return data

    @validates("password")
    def validate_password_complexity(self, value):
        _validate_password_strength(value)


class DoctorUpdateSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    name           = fields.Str(load_default=None, validate=validate.Length(min=2, max=120))
    email          = fields.Email(load_default=None)
    password       = fields.Str(load_default=None, validate=validate.Length(min=8, max=128))
    license_number = fields.Str(load_default=None, validate=validate.Length(max=50))
    hospital       = fields.Str(load_default=None, validate=validate.Length(max=200))

    @pre_load
    def normalize(self, data, **kwargs):
        if isinstance(data.get("email"), str):
            data["email"] = data["email"].strip().lower()
        if isinstance(data.get("name"), str):
            data["name"] = data["name"].strip()
        return data

    @validates("password")
    def validate_password_complexity(self, value):
        if value is not None:
            _validate_password_strength(value)


class AdminApproveSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    user_type     = fields.Str(required=True, validate=validate.OneOf(["doctor", "hospital"]))
    user_id       = fields.Int(required=True)
    patient_limit = fields.Int(load_default=50, validate=validate.Range(min=1, max=10000))
    notes         = fields.Str(load_default=None, validate=validate.Length(max=300))


class AdminRejectSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    user_type = fields.Str(required=True, validate=validate.OneOf(["doctor", "hospital"]))
    user_id   = fields.Int(required=True)
    reason    = fields.Str(load_default=None, validate=validate.Length(max=500))


class UpdateLimitSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    patient_limit = fields.Int(required=True, validate=validate.Range(min=1, max=10000))
    notes         = fields.Str(load_default=None, validate=validate.Length(max=300))


# ── Helper ─────────────────────────────────────────────────────────────────────

def validate_request(schema_class, data, partial=False):
    """
    Validate incoming request data against a Marshmallow schema.
    Returns (validated_data, None) on success.
    Returns (None, error_response_dict) on failure.
    """
    schema = schema_class()
    try:
        return schema.load(data or {}, partial=partial), None
    except ValidationError as e:
        return None, {"error": "Validation failed", "details": e.messages}
