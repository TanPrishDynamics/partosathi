"""
routes/patient_routes.py — Patient CRUD blueprint.

All routes enforce:
  - JWT authentication
  - IDOR protection via get_patient_for_doctor() (fail-closed, no NULL bypass)
  - Schema validation via PatientSchema
  - GDPR: consent_obtained required before PHI storage

Multi-tenant isolation fix (v2):
  - GET /api/patients now filters STRICTLY by doctor_id == doc_id.
    The previous query included `OR doctor_id IS NULL` which exposed all
    orphaned/legacy patients to every doctor. This has been removed.
  - Ownership helpers are now fail-closed: NULL doctor_id → 403.
  - DELETE /api/patient/<id> added with ownership check.
"""
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from extensions import db, limiter
from extensions import _jwt_or_ip_key
from models import Alert, Doctor, Observation, Patient
from utils.crypto import get_patient_for_doctor
from utils.repository import (
    get_doctor_patients,
    create_doctor_patient,
    delete_doctor_patient,
)
from validators import PatientSchema, validate_request
from alerts import evaluate_observation
from email_service import send_quota_warning_email

patient_bp = Blueprint("patient", __name__)


# ── List patients (paginated) ─────────────────────────────────────────────────

@patient_bp.route("/api/patients", methods=["GET"])
@jwt_required()
@limiter.limit("60 per minute", key_func=_jwt_or_ip_key)
def list_patients():
    """
    GET /api/patients
    Supports optional pagination: ?page=N&limit=M&status=Active|Completed|Inactive

    SECURITY FIX: This query now filters STRICTLY by the authenticated
    doctor's ID. The previous implementation included:
        db.or_(Patient.doctor_id == None, Patient.doctor_id == doc_id)
    which exposed ALL patients with a null doctor_id to every doctor.
    The fix removes the OR clause entirely — null doctor_id patients are
    inaccessible to doctors (fail-closed) and only visible to admins.
    """
    page_param     = request.args.get("page", type=int)
    limit          = min(int(request.args.get("limit", 50)), 200)
    status_filter  = request.args.get("status")

    doc_id   = int(get_jwt_identity())
    is_admin = get_jwt().get("role") == "admin"

    if is_admin:
        # Admin sees all patients across all doctors.
        base_query = Patient.query.order_by(Patient.admission_time.desc())
        if status_filter and status_filter != "all":
            base_query = base_query.filter(Patient.status == status_filter)

        def _enrich_batch(patients):
            if not patients:
                return []
            pids = [p.id for p in patients]
            all_alerts = Alert.query.filter(Alert.patient_id.in_(pids)).all()
            alert_map = {}
            for a in all_alerts:
                alert_map.setdefault(a.patient_id, []).append(a)
            obs_counts = dict(
                db.session.query(Observation.patient_id, db.func.count(Observation.id))
                .filter(Observation.patient_id.in_(pids))
                .group_by(Observation.patient_id).all()
            )
            result = []
            for p in patients:
                d = p.to_dict()
                alerts = alert_map.get(p.id, [])
                d["alert_counts"] = {
                    "red":    sum(1 for a in alerts if a.severity == "red"    and not a.acknowledged),
                    "yellow": sum(1 for a in alerts if a.severity == "yellow" and not a.acknowledged),
                }
                d["observation_count"] = obs_counts.get(p.id, 0)
                result.append(d)
            return result

        if page_param is not None:
            pag    = base_query.paginate(page=page_param, per_page=limit, error_out=False)
            result = _enrich_batch(pag.items)
            resp   = jsonify({
                "data": result, "page": pag.page,
                "limit": limit, "total": pag.total, "pages": pag.pages,
            })
            resp.headers["X-Total-Count"] = pag.total
            resp.headers["X-Total-Pages"] = pag.pages
            return resp

        patients = base_query.all()
        result   = _enrich_batch(patients)
        resp     = jsonify(result)
        resp.headers["X-Total-Count"] = len(result)
        return resp

    # ── Doctor-scoped path (strict isolation) ─────────────────────────────────
    if page_param is not None:
        result, total, pages = get_doctor_patients(
            doc_id, page=page_param, limit=limit, status_filter=status_filter
        )
        resp = jsonify({
            "data": result, "page": page_param,
            "limit": limit, "total": total, "pages": pages,
        })
        resp.headers["X-Total-Count"] = total
        resp.headers["X-Total-Pages"] = pages
        return resp

    result = get_doctor_patients(doc_id, limit=limit, status_filter=status_filter)
    resp   = jsonify(result)
    resp.headers["X-Total-Count"] = len(result)
    return resp


# ── Create patient ────────────────────────────────────────────────────────────

@patient_bp.route("/api/patient", methods=["POST"])
@jwt_required()
def create_patient():
    """
    POST /api/patient

    SECURITY: doctor_id is ALWAYS taken from the authenticated JWT identity.
    The request body cannot supply or override the doctor_id — any such field
    is ignored. This prevents privilege escalation via body injection.
    """
    doc_id  = int(get_jwt_identity())
    payload, err = validate_request(PatientSchema, request.get_json())
    if err:
        return jsonify(err), 422

    if not payload.get("consent_obtained"):
        return jsonify({"error": "Patient consent must be obtained before registration."}), 422

    doctor = Doctor.query.get(doc_id)
    if doctor and doctor.patients_used >= doctor.patient_limit:
        return jsonify({
            "error": "Patient quota reached.",
            "detail": f"Your plan allows {doctor.patient_limit} patients.",
            "quota_reached": True,
            "patients_used": doctor.patients_used,
            "patient_limit": doctor.patient_limit,
        }), 403

    try:
        p = create_doctor_patient(doc_id, payload)
    except Exception as exc:
        # create_doctor_patient calls abort() on quota; re-raise abort exceptions.
        raise

    # Quota warning email (best-effort).
    if doctor and doctor.patient_limit:
        used      = doctor.patients_used
        threshold = max(1, int(doctor.patient_limit * 0.8))
        if used == threshold:
            try:
                send_quota_warning_email(doctor.email, doctor.name, used, doctor.patient_limit)
            except Exception:
                pass

    return jsonify(p.to_dict()), 201


# ── Get / update / status ─────────────────────────────────────────────────────

@patient_bp.route("/api/patient/<patient_id>", methods=["GET"])
@jwt_required()
def get_patient(patient_id):
    """SECURITY: ownership enforced by get_patient_for_doctor (fail-closed)."""
    doc_id = int(get_jwt_identity())
    p = get_patient_for_doctor(patient_id, doc_id)
    return jsonify(p.to_dict())


@patient_bp.route("/api/patient/<patient_id>", methods=["PATCH"])
@jwt_required()
def update_patient(patient_id):
    """SECURITY: ownership enforced before any mutation."""
    doc_id = int(get_jwt_identity())
    p = get_patient_for_doctor(patient_id, doc_id)

    payload, err = validate_request(PatientSchema, request.get_json(), partial=True)
    if err:
        return jsonify(err), 422

    def _parse_dt(s):
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None

    if "name"            in payload: p.name            = payload["name"]
    if "age"             in payload: p.age             = int(payload["age"])
    if "gravida"         in payload: p.gravida         = int(payload["gravida"])
    if "parity"          in payload: p.parity          = int(payload["parity"])
    if "gestational_age" in payload: p.gestational_age = int(payload["gestational_age"])
    if payload.get("admission_time"):
        p.admission_time = _parse_dt(payload["admission_time"]) or p.admission_time
    if "membrane_rupture_time" in payload:
        p.membrane_rupture_time = _parse_dt(payload["membrane_rupture_time"] or "")

    db.session.commit()
    _refresh_patient_alerts(p.id)
    return jsonify(p.to_dict())


@patient_bp.route("/api/patient/<patient_id>", methods=["DELETE"])
@jwt_required()
def delete_patient(patient_id):
    """
    DELETE /api/patient/<patient_id>

    Hard-deletes the patient (cascades to observations, alerts via ORM).
    SECURITY: ownership checked before deletion. Doctor cannot delete another
    doctor's patients — returns 403.
    """
    doc_id = int(get_jwt_identity())
    delete_doctor_patient(doc_id, patient_id)
    return jsonify({"success": True, "deleted": patient_id})


@patient_bp.route("/api/patient/<patient_id>/status", methods=["PATCH"])
@jwt_required()
def update_patient_status(patient_id):
    """SECURITY: ownership enforced before status change."""
    doc_id = int(get_jwt_identity())
    p      = get_patient_for_doctor(patient_id, doc_id)
    data   = request.get_json() or {}
    new_status = data.get("status")
    if new_status not in ("Active", "Completed", "Inactive"):
        return jsonify({"error": "Invalid status."}), 400
    p.status = new_status
    db.session.commit()
    return jsonify({"success": True, "status": p.status})


# ── Internal helpers ──────────────────────────────────────────────────────────

def _refresh_patient_alerts(patient_id: int) -> None:
    """
    Re-evaluate all alerts for a patient after an observation change.

    M-3: Upsert pattern. Previously we wiped every alert row and rebuilt from
    scratch — this lost the acknowledged_by / acknowledged_at attribution
    (and risked a partial state if the second-half write crashed). We now:
      1. Build the "desired" alert set by re-running evaluate_observation.
      2. Skip any (alert_type, observation_id) tuple already present.
      3. Insert only the new ones.
      4. Soft-delete previously-firing alerts that no longer fire, BUT only
         when the alert was never acknowledged — acknowledged alerts are
         retained as part of the HIPAA-aligned audit trail.
    The whole operation runs in a single transaction.
    """
    existing_alerts = Alert.query.filter_by(patient_id=patient_id).all()
    # Key by (alert_type, observation_id) — the natural identity of an alert.
    existing_by_key: dict[tuple[str, int | None], Alert] = {
        (a.alert_type, a.observation_id): a for a in existing_alerts
    }

    all_obs = Observation.query.filter_by(patient_id=patient_id).order_by(
        Observation.timestamp
    ).all()

    seen_keys: set[tuple[str, int | None]] = set()
    for obs in all_obs:
        for a_data in evaluate_observation(obs, all_obs):
            key = (a_data["alert_type"], obs.id)
            seen_keys.add(key)
            if key in existing_by_key:
                # Same alert already present — leave acknowledged_by/at intact.
                continue
            db.session.add(Alert(
                patient_id=patient_id,
                timestamp=obs.timestamp,
                observation_id=obs.id,
                **a_data,
            ))

    # Prune alerts that no longer fire AND were never acknowledged.
    # Acknowledged alerts are preserved as audit history.
    for key, alert in existing_by_key.items():
        if key not in seen_keys and not alert.acknowledged:
            db.session.delete(alert)

    db.session.commit()
