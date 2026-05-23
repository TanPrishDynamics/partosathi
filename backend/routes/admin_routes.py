"""
routes/admin_routes.py — Admin management blueprint.
All routes require admin JWT role via @admin_required().
"""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

from extensions import db
from middleware.rbac import admin_required
from models import (
    Admin, AdminAction, CreditRequest, Doctor, Hospital,
    Notification, Patient, Observation,
)
from utils.crypto import hash_password
from utils.notify import notify_all_admins  # H-5 helper (not used here yet but
                                            # re-exported for future routes)
from validators import (
    AdminApproveSchema, AdminRejectSchema,
    DoctorCreateSchema, DoctorUpdateSchema,
    validate_request,
)
from email_service import send_approval_email, send_rejection_email

admin_bp = Blueprint("admin", __name__)


# ── Doctor CRUD ───────────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/doctors", methods=["GET"])
@admin_required()
def list_doctors_admin():
    doctors = Doctor.query.all()
    return jsonify([{
        "id": d.id, "name": d.name, "email": d.email,
        "license_number": d.license_number, "hospital": d.hospital,
    } for d in doctors])


@admin_bp.route("/api/admin/doctors", methods=["POST"])
@admin_required()
def create_doctor_admin():
    payload, err = validate_request(DoctorCreateSchema, request.get_json())
    if err:
        return jsonify(err), 422

    if Doctor.query.filter_by(email=payload["email"]).first():
        return jsonify({"error": "Doctor email already exists"}), 400

    doctor = Doctor(
        name=payload["name"],
        email=payload["email"],
        password_hash=hash_password(payload["password"]),
        license_number=payload.get("license_number"),
        hospital=payload.get("hospital", "General Hospital"),
    )
    db.session.add(doctor)
    db.session.commit()
    return jsonify({"success": True, "doctor": {"id": doctor.id, "name": doctor.name, "email": doctor.email}}), 201


@admin_bp.route("/api/admin/doctors/<int:doctor_id>", methods=["PATCH"])
@admin_required()
def update_doctor_admin(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    payload, err = validate_request(DoctorUpdateSchema, request.get_json(), partial=True)
    if err:
        return jsonify(err), 422

    if payload.get("name"):            doctor.name            = payload["name"]
    if payload.get("license_number"):  doctor.license_number  = payload["license_number"]
    if payload.get("hospital"):        doctor.hospital        = payload["hospital"]
    if payload.get("password"):        doctor.password_hash   = hash_password(payload["password"])
    if payload.get("email"):
        existing = Doctor.query.filter_by(email=payload["email"]).first()
        if existing and existing.id != doctor.id:
            return jsonify({"error": "Email already in use"}), 400
        doctor.email = payload["email"]

    db.session.commit()
    return jsonify({"success": True})


@admin_bp.route("/api/admin/doctors/<int:doctor_id>", methods=["DELETE"])
@admin_required()
def delete_doctor_admin(doctor_id):
    doctor = Doctor.query.get_or_404(doctor_id)
    db.session.delete(doctor)
    db.session.commit()
    return jsonify({"success": True})


# ── Approval workflow ─────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/pending-users", methods=["GET"])
@admin_required()
def get_pending_users():
    pending_doctors = Doctor.query.filter(
        Doctor.status.in_(["pending", "rejected"])
    ).order_by(Doctor.created_at.desc()).all()
    pending_hospitals = Hospital.query.filter(
        Hospital.status.in_(["pending_approval", "rejected"])
    ).order_by(Hospital.created_at.desc()).all()
    return jsonify({
        "doctors":   [d.to_dict() for d in pending_doctors],
        "hospitals": [h.to_dict() for h in pending_hospitals],
        "total":     len(pending_doctors) + len(pending_hospitals),
    })


@admin_bp.route("/api/admin/approve-user", methods=["POST"])
@admin_required()
def approve_user():
    payload, err = validate_request(AdminApproveSchema, request.get_json())
    if err:
        return jsonify(err), 422

    admin_id  = int(get_jwt_identity())
    user_type = payload["user_type"]
    user_id   = payload["user_id"]
    limit     = payload.get("patient_limit")

    if user_type == "doctor":
        user = Doctor.query.get_or_404(user_id)
    else:
        user = Hospital.query.get_or_404(user_id)

    user.status      = "approved"
    user.approved_at = datetime.utcnow()
    user.approved_by = admin_id
    if limit is not None:
        user.patient_limit = limit
    effective_limit = user.patient_limit

    db.session.add(AdminAction(
        admin_id=admin_id, action=f"approve_{user_type}",
        target_type=user_type, target_id=user_id,
        details=f"Approved with patient_limit={effective_limit}",
    ))
    db.session.add(Notification(
        recipient_type=user_type, recipient_id=user_id,
        title="Your account has been approved",
        message=f"Welcome to e-Partogram! Patient limit: {effective_limit}.",
        notif_type="approval",
    ))
    db.session.commit()

    send_approval_email(user.email, user.name, user_type, effective_limit)
    return jsonify({"message": f"{user_type.title()} approved.", "patient_limit": effective_limit})


@admin_bp.route("/api/admin/reject-user", methods=["POST"])
@admin_required()
def reject_user():
    payload, err = validate_request(AdminRejectSchema, request.get_json())
    if err:
        return jsonify(err), 422

    admin_id  = int(get_jwt_identity())
    user_type = payload["user_type"]
    user_id   = payload["user_id"]
    reason    = payload.get("reason") or "Not specified"

    user = (Doctor if user_type == "doctor" else Hospital).query.get_or_404(user_id)
    user.status           = "rejected"
    user.rejection_reason = reason

    db.session.add(AdminAction(
        admin_id=admin_id, action=f"reject_{user_type}",
        target_type=user_type, target_id=user_id,
        details=f"Rejected: {reason}",
    ))
    db.session.add(Notification(
        recipient_type=user_type, recipient_id=user_id,
        title="Account request not approved",
        message=f"Your account request was not approved. Reason: {reason}",
        notif_type="rejection",
    ))
    db.session.commit()

    send_rejection_email(user.email, user.name, user_type, reason)
    return jsonify({"message": f"{user_type.title()} rejected."})


# ── Notifications ─────────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/notifications", methods=["GET"])
@admin_required()
def admin_notifications():
    notifs = (
        Notification.query.filter_by(recipient_type="admin")
        .order_by(Notification.created_at.desc()).limit(50).all()
    )
    return jsonify([n.to_dict() for n in notifs])


@admin_bp.route("/api/admin/notifications/read", methods=["POST"])
@admin_required()
def mark_notifications_read():
    Notification.query.filter_by(recipient_type="admin", is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"message": "All notifications marked as read."})


@admin_bp.route("/api/admin/actions", methods=["GET"])
@admin_required()
def admin_action_log():
    actions = AdminAction.query.order_by(AdminAction.timestamp.desc()).limit(100).all()
    return jsonify([a.to_dict() for a in actions])


# ── Credit requests ───────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/credit-requests", methods=["GET"])
@admin_required()
def admin_credit_requests():
    status = request.args.get("status")
    q = CreditRequest.query.order_by(CreditRequest.created_at.desc())
    if status:
        q = q.filter_by(status=status)
    return jsonify([r.to_dict() for r in q.limit(100).all()])


@admin_bp.route("/api/admin/credit-requests/<int:req_id>/approve", methods=["POST"])
@admin_required()
def approve_credit_request(req_id):
    admin_id = int(get_jwt_identity())
    cr       = CreditRequest.query.get_or_404(req_id)
    if cr.status != "pending":
        return jsonify({"error": "Request already resolved"}), 409

    note   = (request.get_json() or {}).get("note", "")
    entity = (Hospital if cr.requester_type == "hospital" else Doctor).query.get_or_404(cr.requester_id)
    entity.patient_limit = (entity.patient_limit or 0) + cr.amount

    cr.status          = "approved"
    cr.resolved_at     = datetime.utcnow()
    cr.resolved_by     = admin_id
    cr.resolution_note = note

    db.session.add(Notification(
        recipient_type=cr.requester_type, recipient_id=cr.requester_id,
        title="Credit request approved",
        message=f"{cr.amount} credits added. New limit: {entity.patient_limit}.",
        notif_type="approval",
    ))
    db.session.commit()
    return jsonify({"message": f"Approved. +{cr.amount} credits added.", "new_limit": entity.patient_limit})


@admin_bp.route("/api/admin/credit-requests/<int:req_id>/reject", methods=["POST"])
@admin_required()
def reject_credit_request(req_id):
    admin_id = int(get_jwt_identity())
    cr       = CreditRequest.query.get_or_404(req_id)
    if cr.status != "pending":
        return jsonify({"error": "Request already resolved"}), 409

    data               = request.get_json() or {}
    cr.status          = "rejected"
    cr.resolved_at     = datetime.utcnow()
    cr.resolved_by     = admin_id
    cr.resolution_note = data.get("reason", "")

    db.session.add(Notification(
        recipient_type=cr.requester_type, recipient_id=cr.requester_id,
        title="Credit request not approved",
        message=f"Your request for {cr.amount} credits was not approved. {cr.resolution_note or ''}",
        notif_type="rejection",
    ))
    db.session.commit()
    return jsonify({"message": "Request rejected."})


# ── Global analytics ──────────────────────────────────────────────────────────

@admin_bp.route("/api/admin/analytics", methods=["GET"])
@admin_required()
def admin_analytics():
    now = datetime.utcnow()

    daily = []
    for i in range(29, -1, -1):
        ds = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        de = ds + timedelta(days=1)
        daily.append({
            "date":     ds.strftime("%b %d"),
            "patients": Patient.query.filter(
                Patient.admission_time >= ds, Patient.admission_time < de
            ).count(),
            "doctors":  Doctor.query.filter(
                Doctor.created_at >= ds, Doctor.created_at < de
            ).count(),
        })

    # M-9: ORM-safe ORDER BY — db.text("cnt DESC") with a literal column alias
    # was safe today but is exactly the pattern that turns into SQL injection
    # the moment a future contributor interpolates a user-controlled value.
    # Use the function expression directly so SQLAlchemy parametrises it.
    top_hospitals = (
        db.session.query(Hospital.name, db.func.count(Patient.id).label("cnt"))
        .join(Doctor, Doctor.hospital_id == Hospital.id)
        .join(Patient, Patient.doctor_id == Doctor.id)
        .group_by(Hospital.id)
        .order_by(db.func.count(Patient.id).desc())
        .limit(5).all()
    )
    top_doctors = (
        db.session.query(Doctor.name, db.func.count(Patient.id).label("cnt"))
        .join(Patient, Patient.doctor_id == Doctor.id)
        .group_by(Doctor.id)
        .order_by(db.func.count(Patient.id).desc())
        .limit(5).all()
    )

    return jsonify({
        "totals": {
            "doctors":            Doctor.query.count(),
            "hospitals":          Hospital.query.count(),
            "patients":           Patient.query.count(),
            "observations":       Observation.query.count(),
            "pending_approvals":  (
                Doctor.query.filter_by(status="pending").count() +
                Hospital.query.filter_by(status="pending_approval").count()
            ),
            "pending_credit_requests": CreditRequest.query.filter_by(status="pending").count(),
        },
        "daily":         daily,
        "top_hospitals": [{"name": n, "patients": c} for n, c in top_hospitals],
        "top_doctors":   [{"name": n, "patients": c} for n, c in top_doctors],
    })
