"""
routes/cds_routes.py — Clinical Decision Support, Alerts, AI summary, PDF export.

*** IDOR FIXES APPLIED HERE ***
The following 5 endpoints previously had no ownership check:
  1. GET  /api/alerts/<patient_id>           ← FIXED
  2. GET  /api/ai/summary/<patient_id>       ← FIXED
  3. GET  /api/export/pdf/<patient_id>       ← FIXED
  4. POST /api/cds/analyze-observation       ← FIXED
  5. POST /api/cds/batch-analyze             ← FIXED

All 5 now call get_patient_for_doctor() before touching any patient data.
"""
import io
import logging
from datetime import datetime, timezone

from flask import Blueprint, abort, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db, limiter
from extensions import _jwt_or_ip_key
from models import Alert, Observation, Patient
from utils.crypto import get_patient_for_doctor
from services.alerts import evaluate_observation
from services.pdf_export import generate_pdf

logger = logging.getLogger(__name__)
cds_bp = Blueprint("cds", __name__)

# ML predictors injected by app factory (None until loaded)
lstm_predictor       = None
production_predictor = None
generate_clinical_summary = None
process_labor_observation = None


def init_ml(lp, pp, gcs, plo):
    global lstm_predictor, production_predictor, generate_clinical_summary, process_labor_observation
    lstm_predictor, production_predictor = lp, pp
    generate_clinical_summary, process_labor_observation = gcs, plo


# ── Alerts ────────────────────────────────────────────────────────────────────

@cds_bp.route("/api/alerts/<patient_id>", methods=["GET"])
@jwt_required()
def get_alerts(patient_id):
    """FIXED: ownership check added — previously any doctor could read any patient's alerts."""
    doc_id = int(get_jwt_identity())
    p      = get_patient_for_doctor(patient_id, doc_id)      # ← IDOR fix
    alerts = Alert.query.filter_by(patient_id=p.id).order_by(Alert.timestamp.desc()).all()
    return jsonify([a.to_dict() for a in alerts])


@cds_bp.route("/api/alerts/<int:alert_id>/acknowledge", methods=["PATCH"])
@jwt_required()
def acknowledge_alert(alert_id):
    doc_id  = int(get_jwt_identity())
    alert   = Alert.query.get_or_404(alert_id)
    patient = Patient.query.get_or_404(alert.patient_id)
    get_patient_for_doctor(patient.patient_id, doc_id)   # ownership check

    alert.acknowledged    = True
    alert.acknowledged_by = doc_id
    alert.acknowledged_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"success": True})


# ── AI Summary ────────────────────────────────────────────────────────────────

@cds_bp.route("/api/ai/summary/<patient_id>", methods=["GET"])
@jwt_required()
def get_ai_summary(patient_id):
    """FIXED: ownership check added."""
    doc_id = int(get_jwt_identity())
    p      = get_patient_for_doctor(patient_id, doc_id)   # ← IDOR fix

    observations = Observation.query.filter_by(patient_id=p.id).order_by(
        Observation.timestamp.asc()
    ).all()
    alerts       = Alert.query.filter_by(patient_id=p.id).order_by(
        Alert.timestamp.desc()
    ).limit(5).all()

    obs_data   = [o.to_dict() for o in observations]
    alert_data = [a.to_dict() for a in alerts]

    if not obs_data:
        return jsonify({
            "labor_progress":      "No observations recorded yet.",
            "risk_status":         "Unknown",
            "suggested_attention": "Please add initial patient observation.",
        })

    def _to_naive_utc(dt):
        return dt.replace(tzinfo=None) if dt.tzinfo is None else dt.astimezone(timezone.utc).replace(tzinfo=None)

    admission_time  = _to_naive_utc(p.admission_time)
    latest          = observations[-1]
    hours_in_labor  = (_to_naive_utc(latest.timestamp) - admission_time).total_seconds() / 3600
    active_start    = next(
        (o for o in observations if o.cervical_dilation and o.cervical_dilation >= 4.0), None
    )

    if active_start:
        hours_active = (
            _to_naive_utc(latest.timestamp) - _to_naive_utc(active_start.timestamp)
        ).total_seconds() / 3600
        alert_line  = round(min(10.0, 4.0 + hours_active), 1)
        action_line = round(min(10.0, 4.0 + max(0.0, hours_active - 4.0)), 1) if hours_active > 4 else None
        dil         = latest.cervical_dilation or 0
        if action_line and dil < action_line:
            who_status = "action_line_crossed"
        elif dil < alert_line:
            who_status = "alert_line_crossed"
        else:
            who_status = "normal_progress"
    else:
        hours_active, alert_line, action_line = None, None, None
        who_status = "latent_phase"

    pred = {
        "hours_in_labor":        round(hours_in_labor, 1),
        "hours_in_active_phase": round(hours_active, 1) if hours_active is not None else None,
        "current_dilation_cm":   latest.cervical_dilation,
        "alert_line_cm":         alert_line,
        "action_line_cm":        action_line,
        "who_status":            who_status,
    }

    if generate_clinical_summary:
        summary = generate_clinical_summary(
            patient_data={"gravida": p.gravida, "parity": p.parity, "latest_observations": obs_data[-3:]},
            prediction=pred,
            risk_alerts=alert_data,
        )
        return jsonify(summary)

    return jsonify({
        "labor_progress":      f"Patient is in {who_status.replace('_', ' ')}.",
        "risk_status":         "Elevated" if who_status != "normal_progress" else "Normal",
        "who_partograph_status": pred,
    })


# ── PDF Export ────────────────────────────────────────────────────────────────

@cds_bp.route("/api/export/pdf/<patient_id>", methods=["GET"])
@jwt_required()
def export_pdf(patient_id):
    """FIXED: ownership check added — previously any doctor could export any patient's PDF."""
    doc_id = int(get_jwt_identity())
    p      = get_patient_for_doctor(patient_id, doc_id)   # ← IDOR fix

    observations = Observation.query.filter_by(patient_id=p.id).order_by(Observation.timestamp).all()
    alerts       = Alert.query.filter_by(patient_id=p.id).order_by(Alert.timestamp).all()
    pdf_bytes    = generate_pdf(p, observations, alerts)

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"partogram_{patient_id}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf",
    )


# ── CDS Analyze (single + batch) ─────────────────────────────────────────────

@cds_bp.route("/api/cds/analyze-observation", methods=["POST"])
@jwt_required()
def analyze_observation_cds():
    """FIXED: ownership check added."""
    if not process_labor_observation:
        return jsonify({"error": "CDS module not initialized"}), 503

    doc_id       = int(get_jwt_identity())
    request_data = request.get_json() or {}
    patient_id   = request_data.get("patient_id")
    obs_data     = request_data.get("data")

    if not patient_id or not obs_data:
        return jsonify({"error": "Missing patient_id or data"}), 400

    p = get_patient_for_doctor(patient_id, doc_id)   # ← IDOR fix

    previous_obs = Observation.query.filter_by(patient_id=p.id).order_by(
        Observation.timestamp.desc()
    ).first()
    previous_dilation = None
    time_diff_hours   = None
    if previous_obs:
        previous_dilation = previous_obs.cervical_dilation
        if previous_obs.timestamp and "timestamp" in obs_data:
            try:
                current_time    = datetime.fromisoformat(obs_data["timestamp"].replace("Z", "+00:00"))
                time_diff_hours = (current_time - previous_obs.timestamp).total_seconds() / 3600
            except Exception:
                pass

    try:
        cds_result = process_labor_observation(
            obs_data, previous_dilation=previous_dilation, time_diff_hours=time_diff_hours
        )
        if not cds_result["success"]:
            return jsonify(cds_result), 400
        return jsonify({"success": True, "patient_id": patient_id, **cds_result}), 200
    except Exception as e:
        logger.error("CDS analyze error: %s", e, exc_info=True)
        return jsonify({"error": "An internal error occurred. Please contact support."}), 500


@cds_bp.route("/api/cds/batch-analyze", methods=["POST"])
@jwt_required()
def batch_analyze_observations():
    """FIXED: ownership check added."""
    if not process_labor_observation:
        return jsonify({"error": "CDS module not initialized"}), 503

    doc_id       = int(get_jwt_identity())
    request_data = request.get_json() or {}
    patient_id   = request_data.get("patient_id")
    observations = request_data.get("observations", [])

    if not patient_id or not observations:
        return jsonify({"error": "Missing patient_id or observations"}), 400

    p = get_patient_for_doctor(patient_id, doc_id)   # ← IDOR fix

    results           = []
    previous_dilation = None
    previous_time     = None

    for obs_data in observations:
        time_diff_hours = None
        if "timestamp" in obs_data:
            try:
                current_time = datetime.fromisoformat(obs_data["timestamp"].replace("Z", "+00:00"))
                if previous_time:
                    time_diff_hours = (current_time - previous_time).total_seconds() / 3600
                previous_time = current_time
            except Exception:
                pass

        try:
            cds_result = process_labor_observation(
                obs_data, previous_dilation=previous_dilation, time_diff_hours=time_diff_hours
            )
            if cds_result["success"]:
                previous_dilation = cds_result["normalized_data"]["labor"]["cervical_dilation"]
                results.append({
                    "normalized_data": cds_result["normalized_data"],
                    "alerts":          cds_result["alerts"],
                    "status":          cds_result["status"],
                })
        except Exception as e:
            logger.warning("CDS batch item error: %s", e)

    return jsonify({
        "success": True, "patient_id": patient_id,
        "observations_analyzed": len(results), "results": results,
    }), 200


# ── LSTM Delivery Prediction ──────────────────────────────────────────────────

@cds_bp.route("/api/cds/predict-delivery/<patient_id>", methods=["GET"])
@jwt_required()
def predict_delivery_time(patient_id):
    if not lstm_predictor:
        return jsonify({"error": "ML predictor not initialized"}), 503
    doc_id = int(get_jwt_identity())
    p      = get_patient_for_doctor(patient_id, doc_id)
    obs    = Observation.query.filter_by(patient_id=p.id).order_by(Observation.timestamp.asc()).all()
    return jsonify(lstm_predictor.predict([o.to_dict() for o in obs], p.to_dict())), 200


@cds_bp.route("/api/v2/cds/predict-delivery/<patient_id>", methods=["GET"])
@jwt_required()
def predict_delivery_v2(patient_id):
    if not production_predictor:
        return jsonify({"error": "Production ML pipeline not initialized"}), 503
    doc_id = int(get_jwt_identity())
    p      = get_patient_for_doctor(patient_id, doc_id)
    obs    = Observation.query.filter_by(patient_id=p.id).order_by(Observation.timestamp.asc()).all()
    if len(obs) < 2:
        return jsonify({"error": "Need at least 2 observations for temporal analysis"}), 400

    start_time = obs[0].timestamp
    data_list  = [[
        o.cervical_dilation or 0.0,
        o.contraction_freq  or 0.0,
        o.fetal_heart_rate  or 140.0,
        o.maternal_pulse    or 80.0,
        o.bp_systolic       or 120.0,
        (o.timestamp - start_time).total_seconds() / 3600.0,
    ] for o in obs]

    if len(data_list) < 10:
        first      = data_list[0]
        data_list  = [first] * (10 - len(data_list)) + data_list
    else:
        data_list  = data_list[-10:]

    return jsonify(production_predictor.predict_patient(data_list)), 200


# ── Doctor analytics + quota ──────────────────────────────────────────────────

@cds_bp.route("/api/doctor/quota", methods=["GET"])
@jwt_required()
def doctor_quota():
    from models import Doctor
    doc_id = int(get_jwt_identity())
    doctor = Doctor.query.get_or_404(doc_id)
    used, limit = doctor.patients_used, doctor.patient_limit
    return jsonify({
        "patients_used": used, "patient_limit": limit,
        "remaining": max(0, limit - used),
        "quota_reached": used >= limit,
        "quota_pct": round((used / limit) * 100, 1) if limit else 0,
    })


@cds_bp.route("/api/doctor/analytics", methods=["GET"])
@jwt_required()
def doctor_analytics():
    from datetime import timedelta
    from models import Doctor
    doc_id = int(get_jwt_identity())
    doctor = Doctor.query.get_or_404(doc_id)
    now    = datetime.utcnow()

    daily = []
    for i in range(29, -1, -1):
        ds = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        de = ds + timedelta(days=1)
        daily.append({
            "date":         ds.strftime("%b %d"),
            "patients":     Patient.query.filter(Patient.doctor_id == doc_id,
                                Patient.admission_time >= ds, Patient.admission_time < de).count(),
            "observations": (
                db.session.query(db.func.count(Observation.id))
                .join(Patient, Observation.patient_id == Patient.id)
                .filter(Patient.doctor_id == doc_id, Observation.timestamp >= ds,
                        Observation.timestamp < de).scalar() or 0
            ),
        })

    weekly = []
    for i in range(11, -1, -1):
        ws = (now - timedelta(weeks=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        we = ws + timedelta(weeks=1)
        weekly.append({
            "week":     ws.strftime("W%U %b"),
            "patients": Patient.query.filter(Patient.doctor_id == doc_id,
                            Patient.admission_time >= ws, Patient.admission_time < we).count(),
        })

    statuses = db.session.query(Patient.status, db.func.count()).filter_by(
        doctor_id=doc_id
    ).group_by(Patient.status).all()
    alerts   = (
        db.session.query(Alert.severity, db.func.count())
        .join(Patient, Alert.patient_id == Patient.id)
        .filter(Patient.doctor_id == doc_id)
        .group_by(Alert.severity).all()
    )

    return jsonify({
        "total_patients":     doctor.patients_used,
        "total_observations": (
            db.session.query(db.func.count(Observation.id))
            .join(Patient, Observation.patient_id == Patient.id)
            .filter(Patient.doctor_id == doc_id).scalar() or 0
        ),
        "credits_used":      doctor.patients_used,
        "credits_remaining": max(0, doctor.patient_limit - doctor.patients_used),
        "daily":             daily,
        "weekly":            weekly,
        "status_breakdown":  [{"name": s, "value": c} for s, c in statuses],
        "alert_breakdown":   [{"name": sev.title(), "value": c} for sev, c in alerts],
    })


# ── Credit requests ───────────────────────────────────────────────────────────

@cds_bp.route("/api/credits/request", methods=["POST"])
@jwt_required()
def request_credits():
    from flask_jwt_extended import get_jwt
    from models import CreditRequest, Hospital, Notification
    role    = get_jwt().get("role")
    user_id = int(get_jwt_identity())
    data    = request.get_json() or {}
    amount  = data.get("amount")
    reason  = data.get("reason", "")

    if not isinstance(amount, int) or amount < 1:
        return jsonify({"error": "amount must be a positive integer"}), 422

    if role == "hospital":
        entity = Hospital.query.get_or_404(user_id)
        r_type, r_name, r_email = "hospital", entity.name, entity.email
    else:
        from models import Doctor
        entity = Doctor.query.get_or_404(user_id)
        r_type, r_name, r_email = "doctor", entity.name, entity.email

    cr = CreditRequest(
        requester_type=r_type, requester_id=user_id,
        requester_name=r_name, requester_email=r_email,
        amount=amount, reason=reason,
    )
    db.session.add(cr)
    db.session.add(Notification(
        recipient_type="admin", recipient_id=1,
        title=f"Credit request from {r_name}",
        message=f"{r_type.title()} '{r_name}' requests {amount} additional credits.",
        notif_type="credit_request", ref_id=user_id,
    ))
    db.session.commit()
    return jsonify({"message": "Credit request submitted.", "request_id": cr.id}), 201


@cds_bp.route("/api/credits/my-requests", methods=["GET"])
@jwt_required()
def my_credit_requests():
    from flask_jwt_extended import get_jwt
    from models import CreditRequest
    role    = get_jwt().get("role")
    user_id = int(get_jwt_identity())
    r_type  = "hospital" if role == "hospital" else "doctor"
    reqs    = CreditRequest.query.filter_by(
        requester_type=r_type, requester_id=user_id
    ).order_by(CreditRequest.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reqs])


# ── Health check ──────────────────────────────────────────────────────────────

@cds_bp.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})
