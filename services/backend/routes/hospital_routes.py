"""
routes/hospital_routes.py — Hospital dashboard blueprint.
All routes require hospital JWT role via @hospital_required().
"""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from extensions import db
from middleware.rbac import hospital_required
from models import Alert, Doctor, Hospital, CreditRequest, Observation, Patient

hospital_bp = Blueprint("hospital", __name__)


@hospital_bp.route("/api/hospital/me", methods=["GET"])
@hospital_required()
def hospital_me():
    h_id = int(get_jwt_identity())
    h    = Hospital.query.get_or_404(h_id)
    d    = h.to_dict()
    d["doctors_count"]  = Doctor.query.filter_by(hospital_id=h_id).count()
    d["total_patients"] = (
        db.session.query(db.func.count(Patient.id))
        .join(Doctor, Patient.doctor_id == Doctor.id)
        .filter(Doctor.hospital_id == h_id).scalar() or 0
    )
    return jsonify(d)


@hospital_bp.route("/api/hospital/doctors", methods=["GET"])
@hospital_required()
def hospital_doctors():
    h_id    = int(get_jwt_identity())
    doctors = Doctor.query.filter_by(hospital_id=h_id).all()
    result  = []
    for d in doctors:
        info = d.to_dict()
        info["patient_count"] = Patient.query.filter_by(doctor_id=d.id).count()
        result.append(info)
    return jsonify(result)


@hospital_bp.route("/api/hospital/doctors/invite", methods=["POST"])
@hospital_required()
def hospital_invite_doctor():
    """
    Invite a doctor to this hospital by email.

    H-3: Returns the SAME 202 response whether or not a matching doctor
    exists. The previous version leaked account existence via distinct error
    messages ("No doctor found" vs "already linked to another hospital").
    The actual link operation still happens when the doctor exists AND is
    either unaffiliated or already linked to this hospital — so legitimate
    workflows are preserved, but the enumeration probe sees nothing useful.
    """
    h_id  = int(get_jwt_identity())
    h     = Hospital.query.get_or_404(h_id)
    email = (request.get_json() or {}).get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "email required"}), 422

    uniform_body = {
        "message": "If a doctor with that email exists, an invitation has been processed.",
    }

    doctor = Doctor.query.filter_by(email=email).first()
    # Only act when the doctor exists AND is free to be linked here. Other
    # cases silently no-op so the response is identical in every branch.
    if doctor and (not doctor.hospital_id or doctor.hospital_id == h_id):
        doctor.hospital_id = h_id
        doctor.hospital    = h.name
        db.session.commit()

    return jsonify(uniform_body), 202


@hospital_bp.route("/api/hospital/patients", methods=["GET"])
@hospital_required()
def hospital_patients():
    h_id = int(get_jwt_identity())
    page = request.args.get("page", 1, type=int)
    per  = min(request.args.get("per_page", 25, type=int), 100)
    q = (
        Patient.query
        .join(Doctor, Patient.doctor_id == Doctor.id)
        .filter(Doctor.hospital_id == h_id)
        .order_by(Patient.admission_time.desc())
    )
    total    = q.count()
    patients = q.offset((page - 1) * per).limit(per).all()
    items    = []
    for p in patients:
        d    = p.to_dict()
        doc  = Doctor.query.get(p.doctor_id)
        d["doctor_name"] = doc.name if doc else None
        items.append(d)
    return jsonify({"patients": items, "total": total, "page": page, "per_page": per})


@hospital_bp.route("/api/hospital/analytics", methods=["GET"])
@hospital_required()
def hospital_analytics():
    h_id    = int(get_jwt_identity())
    h       = Hospital.query.get_or_404(h_id)
    now     = datetime.utcnow()
    doctors = Doctor.query.filter_by(hospital_id=h_id).all()
    doc_ids = [d.id for d in doctors]

    if not doc_ids:
        return jsonify({
            "total_patients": 0, "total_observations": 0, "total_alerts": 0,
            "credits_used": h.patients_used,
            "credits_remaining": max(0, h.patient_limit - h.patients_used),
            "daily": [], "weekly": [], "per_doctor": [], "status_breakdown": [],
        })

    daily = []
    for i in range(29, -1, -1):
        ds = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        de = ds + timedelta(days=1)
        daily.append({
            "date":     ds.strftime("%b %d"),
            "patients": Patient.query.filter(
                Patient.doctor_id.in_(doc_ids),
                Patient.admission_time >= ds, Patient.admission_time < de,
            ).count(),
        })

    weekly = []
    for i in range(11, -1, -1):
        ws = (now - timedelta(weeks=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        we = ws + timedelta(weeks=1)
        weekly.append({
            "week":     ws.strftime("W%U %b"),
            "patients": Patient.query.filter(
                Patient.doctor_id.in_(doc_ids),
                Patient.admission_time >= ws, Patient.admission_time < we,
            ).count(),
        })

    per_doctor = sorted(
        [{"name": d.name, "patients": Patient.query.filter_by(doctor_id=d.id).count(),
          "credits_used": d.patients_used} for d in doctors],
        key=lambda x: x["patients"], reverse=True,
    )

    statuses = (
        db.session.query(Patient.status, db.func.count())
        .filter(Patient.doctor_id.in_(doc_ids))
        .group_by(Patient.status).all()
    )

    return jsonify({
        "total_patients": Patient.query.filter(Patient.doctor_id.in_(doc_ids)).count(),
        "total_observations": (
            db.session.query(db.func.count(Observation.id))
            .join(Patient, Observation.patient_id == Patient.id)
            .filter(Patient.doctor_id.in_(doc_ids)).scalar() or 0
        ),
        "total_alerts": (
            db.session.query(db.func.count(Alert.id))
            .join(Patient, Alert.patient_id == Patient.id)
            .filter(Patient.doctor_id.in_(doc_ids)).scalar() or 0
        ),
        "credits_used":      h.patients_used,
        "credits_remaining": max(0, h.patient_limit - h.patients_used),
        "daily":             daily,
        "weekly":            weekly,
        "per_doctor":        per_doctor,
        "status_breakdown":  [{"name": s, "value": c} for s, c in statuses],
    })


@hospital_bp.route("/api/hospital/credits", methods=["GET"])
@hospital_required()
def hospital_credits():
    h_id     = int(get_jwt_identity())
    h        = Hospital.query.get_or_404(h_id)
    requests = CreditRequest.query.filter_by(
        requester_type="hospital", requester_id=h_id
    ).order_by(CreditRequest.created_at.desc()).limit(10).all()
    return jsonify({
        "patient_limit":   h.patient_limit,
        "patients_used":   h.patients_used,
        "remaining":       max(0, h.patient_limit - h.patients_used),
        "quota_pct":       round((h.patients_used / h.patient_limit) * 100, 1) if h.patient_limit else 0,
        "recent_requests": [r.to_dict() for r in requests],
    })


@hospital_bp.route("/api/hospital/doctors/<int:doctor_id>/credits", methods=["PATCH"])
@hospital_required()
def hospital_assign_credits(doctor_id):
    h_id      = int(get_jwt_identity())
    doctor    = Doctor.query.filter_by(id=doctor_id, hospital_id=h_id).first_or_404()
    data      = request.get_json() or {}
    new_limit = data.get("patient_limit")
    if not isinstance(new_limit, int) or new_limit < 1:
        return jsonify({"error": "patient_limit must be a positive integer"}), 422
    doctor.patient_limit = new_limit
    db.session.commit()
    return jsonify({"message": f"Credit limit updated to {new_limit} for Dr. {doctor.name}.", "doctor": doctor.to_dict()})
