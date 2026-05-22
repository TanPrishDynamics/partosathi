"""
routes/observation_routes.py — Observation CRUD blueprint.

Key security fix applied here:
  POST /api/observation NOW calls validate_request(ObservationSchema, ...)
  This was the critical missing validation that allowed invalid medical values
  (e.g. FHR=999, cervical_dilation=-5) to be stored and trigger false alerts.

Also:
  - PATCH records field-level changes to ObservationHistory (immutable audit trail)
  - Ownership checked on every route via get_observation_for_doctor()
"""
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db, limiter
from extensions import _jwt_or_ip_key
from models import Alert, Observation, ObservationHistory
from utils.crypto import get_observation_for_doctor, get_patient_for_doctor
from validators import ObservationSchema, validate_request
from services.alerts import evaluate_observation
from routes.patient_routes import _refresh_patient_alerts

obs_bp = Blueprint("observation", __name__)


def _nullable_float(val):
    return float(val) if val not in (None, "", "null") else None


def _nullable_int(val):
    return int(val) if val not in (None, "", "null") else None


# ── POST /api/observation ─────────────────────────────────────────────────────

@obs_bp.route("/api/observation", methods=["POST"])
@jwt_required()
def add_observation():
    """
    *** CRITICAL FIX ***
    Schema validation is now applied on POST — it was missing before.
    All clinical values (FHR, dilation, BP, temp, etc.) are range-checked
    before any DB write occurs, preventing life-safety data corruption.
    """
    doc_id = int(get_jwt_identity())

    # Step 1: validate ALL fields including medical ranges
    payload, err = validate_request(ObservationSchema, request.get_json())
    if err:
        return jsonify(err), 422

    if not payload.get("patient_id"):
        return jsonify({"error": "patient_id is required"}), 400

    # Step 2: ownership check
    p = get_patient_for_doctor(payload["patient_id"], doc_id)

    # Step 3: parse timestamp
    ts_raw = payload.get("timestamp")
    try:
        timestamp = datetime.fromisoformat(ts_raw.replace("Z", "+00:00")) if ts_raw else datetime.utcnow()
    except Exception:
        timestamp = datetime.utcnow()

    obs = Observation(
        patient_id=p.id,
        timestamp=timestamp,
        cervical_dilation=_nullable_float(payload.get("cervical_dilation")),
        head_station=_nullable_float(payload.get("head_station")),
        fetal_heart_rate=_nullable_int(payload.get("fetal_heart_rate")),
        amniotic_fluid=payload.get("amniotic_fluid") or None,
        moulding=payload.get("moulding") or None,
        contraction_freq=_nullable_float(payload.get("contraction_freq")),
        contraction_duration=_nullable_int(payload.get("contraction_duration")),
        maternal_pulse=_nullable_int(payload.get("maternal_pulse")),
        bp_systolic=_nullable_int(payload.get("bp_systolic")),
        bp_diastolic=_nullable_int(payload.get("bp_diastolic")),
        temperature=_nullable_float(payload.get("temperature")),
        urine_protein=payload.get("urine_protein") or None,
        urine_ketones=payload.get("urine_ketones") or None,
        urine_volume=_nullable_int(payload.get("urine_volume")),
    )
    db.session.add(obs)
    db.session.flush()

    all_obs    = Observation.query.filter_by(patient_id=p.id).all()
    new_alerts = []
    for a_data in evaluate_observation(obs, all_obs):
        al = Alert(patient_id=p.id, timestamp=timestamp, observation_id=obs.id, **a_data)
        db.session.add(al)
        new_alerts.append(al)

    db.session.commit()
    return jsonify({
        "observation":     obs.to_dict(),
        "alerts_triggered": [a.to_dict() for a in new_alerts],
    }), 201


# ── GET /api/observations/<patient_id> ───────────────────────────────────────

@obs_bp.route("/api/observations/<patient_id>", methods=["GET"])
@jwt_required()
@limiter.limit("120 per minute", key_func=_jwt_or_ip_key)
def get_observations(patient_id):
    doc_id = int(get_jwt_identity())
    p = get_patient_for_doctor(patient_id, doc_id)
    obs = Observation.query.filter_by(patient_id=p.id).order_by(Observation.timestamp).all()
    return jsonify([o.to_dict() for o in obs])


# ── PATCH /api/observation/<obs_id> ──────────────────────────────────────────

@obs_bp.route("/api/observation/<int:obs_id>", methods=["PATCH"])
@jwt_required()
def update_observation(obs_id):
    doc_id = int(get_jwt_identity())
    obs    = get_observation_for_doctor(obs_id, doc_id)

    payload, err = validate_request(ObservationSchema, request.get_json(), partial=True)
    if err:
        return jsonify(err), 422

    # Build field-level history entries for changed fields
    _TRACKED = [
        "cervical_dilation", "head_station", "fetal_heart_rate", "amniotic_fluid",
        "moulding", "contraction_freq", "contraction_duration", "maternal_pulse",
        "bp_systolic", "bp_diastolic", "temperature", "urine_protein",
        "urine_ketones", "urine_volume",
    ]
    for field in _TRACKED:
        if field in payload and payload[field] is not None:
            old_val = getattr(obs, field)
            new_val = payload[field]
            if str(old_val) != str(new_val):
                db.session.add(ObservationHistory(
                    observation_id=obs_id,
                    changed_by=doc_id,
                    field_name=field,
                    old_value=str(old_val) if old_val is not None else None,
                    new_value=str(new_val),
                ))

    # Apply updates
    if "timestamp" in payload and payload["timestamp"]:
        try:
            obs.timestamp = datetime.fromisoformat(payload["timestamp"].replace("Z", "+00:00"))
        except Exception:
            pass

    if "cervical_dilation"    in payload: obs.cervical_dilation    = _nullable_float(payload["cervical_dilation"])
    if "head_station"         in payload: obs.head_station         = _nullable_float(payload["head_station"])
    if "fetal_heart_rate"     in payload: obs.fetal_heart_rate     = _nullable_int(payload["fetal_heart_rate"])
    if "amniotic_fluid"       in payload: obs.amniotic_fluid       = payload["amniotic_fluid"]
    if "moulding"             in payload: obs.moulding             = payload["moulding"]
    if "contraction_freq"     in payload: obs.contraction_freq     = _nullable_float(payload["contraction_freq"])
    if "contraction_duration" in payload: obs.contraction_duration = _nullable_int(payload["contraction_duration"])
    if "maternal_pulse"       in payload: obs.maternal_pulse       = _nullable_int(payload["maternal_pulse"])
    if "bp_systolic"          in payload: obs.bp_systolic          = _nullable_int(payload["bp_systolic"])
    if "bp_diastolic"         in payload: obs.bp_diastolic         = _nullable_int(payload["bp_diastolic"])
    if "temperature"          in payload: obs.temperature          = _nullable_float(payload["temperature"])
    if "urine_protein"        in payload: obs.urine_protein        = payload["urine_protein"]
    if "urine_ketones"        in payload: obs.urine_ketones        = payload["urine_ketones"]
    if "urine_volume"         in payload: obs.urine_volume         = _nullable_int(payload["urine_volume"])

    db.session.commit()
    _refresh_patient_alerts(obs.patient_id)
    return jsonify(obs.to_dict())


# ── DELETE /api/observation/<obs_id> ─────────────────────────────────────────

@obs_bp.route("/api/observation/<int:obs_id>", methods=["DELETE"])
@jwt_required()
def delete_observation(obs_id):
    doc_id     = int(get_jwt_identity())
    obs        = get_observation_for_doctor(obs_id, doc_id)
    patient_id = obs.patient_id
    db.session.delete(obs)
    db.session.commit()
    _refresh_patient_alerts(patient_id)
    return jsonify({"success": True})
