"""
backend/validators.py
=====================
Marshmallow schemas for strict input validation on all API endpoints.
Ensures no invalid, missing, or out-of-range data reaches the database.
"""
from marshmallow import Schema, fields, validate, validates, ValidationError, pre_load
import re


# ── Shared validators ─────────────────────────────────────────────────────────

def _strip_str(value):
    return value.strip() if isinstance(value, str) else value


class LoginSchema(Schema):
    email    = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=1))

    @pre_load
    def strip_fields(self, data, **kwargs):
        if isinstance(data.get("email"), str):
            data["email"] = data["email"].strip().lower()
        return data


class PatientSchema(Schema):
    name            = fields.Str(required=True,  validate=validate.Length(min=2, max=120))
    age             = fields.Int(required=True,  validate=validate.Range(min=10, max=60))
    gravida         = fields.Int(load_default=1, validate=validate.Range(min=0, max=20))
    parity          = fields.Int(load_default=0, validate=validate.Range(min=0, max=20))
    gestational_age = fields.Int(required=True,  validate=validate.Range(min=20, max=45))
    admission_time  = fields.Str(load_default=None)
    membrane_rupture_time = fields.Str(load_default=None)

    @pre_load
    def strip_strings(self, data, **kwargs):
        if isinstance(data.get("name"), str):
            data["name"] = data["name"].strip()
        return data

    @validates("name")
    def validate_name(self, value):
        # Only allow letters, spaces, hyphens, periods (no injection chars)
        if not re.match(r"^[A-Za-z\s\-\.\']+$", value):
            raise ValidationError("Name contains invalid characters.")


class ObservationSchema(Schema):
    patient_id          = fields.Str(required=True)
    timestamp           = fields.Str(load_default=None)
    cervical_dilation   = fields.Float(load_default=None, validate=validate.Range(min=0, max=10))
    head_station        = fields.Float(load_default=None, validate=validate.Range(min=-5, max=5))
    fetal_heart_rate    = fields.Int(load_default=None,   validate=validate.Range(min=50, max=250))
    amniotic_fluid      = fields.Str(load_default=None,
                                     validate=validate.OneOf(["clear", "meconium", "blood", "absent", "other", None],
                                                             error="Invalid amniotic_fluid value."))
    moulding            = fields.Str(load_default=None,
                                     validate=validate.OneOf(["0", "+", "++", "+++", None],
                                                             error="Invalid moulding value."))
    contraction_freq    = fields.Float(load_default=None, validate=validate.Range(min=0, max=10))
    contraction_duration= fields.Int(load_default=None,   validate=validate.Range(min=0, max=120))
    maternal_pulse      = fields.Int(load_default=None,   validate=validate.Range(min=30, max=250))
    bp_systolic         = fields.Int(load_default=None,   validate=validate.Range(min=50, max=250))
    bp_diastolic        = fields.Int(load_default=None,   validate=validate.Range(min=30, max=160))
    temperature         = fields.Float(load_default=None, validate=validate.Range(min=34.0, max=42.0))
    urine_protein       = fields.Str(load_default=None,
                                     validate=validate.OneOf(["nil", "+", "++", "+++", None]))
    urine_ketones       = fields.Str(load_default=None,
                                     validate=validate.OneOf(["nil", "+", "++", "+++", None]))
    urine_volume        = fields.Int(load_default=None,   validate=validate.Range(min=0, max=2000))


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
        if not re.search(r"[A-Z]", value):
            raise ValidationError("Password must contain at least one uppercase letter.")
        if not re.search(r"[0-9]", value):
            raise ValidationError("Password must contain at least one number.")


# ── Helper ─────────────────────────────────────────────────────────────────────

def validate_request(schema_class, data):
    """
    Validate incoming request data against a schema.
    Returns (validated_data, None) on success.
    Returns (None, error_response_dict) on failure.

    Usage in route:
        data, err = validate_request(PatientSchema, request.get_json())
        if err: return jsonify(err), 422
    """
    schema = schema_class()
    try:
        return schema.load(data or {}), None
    except ValidationError as e:
        return None, {"error": "Validation failed", "details": e.messages}
