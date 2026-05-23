"""
utils/repository.py — Secure Doctor-Scoped Data Access Layer.

This module is the ONLY place that issues raw database queries against
patient-linked tables. All queries are scoped by doctor_id.

Design principles:
  - Every function that reads or mutates patient data requires doctor_id.
  - doctor_id is ALWAYS sourced from the authenticated JWT — never from
    frontend request bodies. Callers are responsible for extracting it
    from get_jwt_identity() before calling these functions.
  - Functions raise 403/404 via abort() on ownership failure.
  - No raw SQL — all queries go through SQLAlchemy ORM for parameterisation.

Repository functions:
  Patients:
    get_doctor_patients(doctor_id, page, limit, status_filter)
    create_doctor_patient(doctor_id, data) → Patient
    get_doctor_patient_by_id(doctor_id, patient_id_str) → Patient
    update_doctor_patient(doctor_id, patient_id_str, data) → Patient
    delete_doctor_patient(doctor_id, patient_id_str) → None

  Observations (scoped through patient ownership):
    get_patient_observations(doctor_id, patient_id_str) → [Observation]
    get_observation(doctor_id, obs_id) → Observation

  Analytics (doctor-scoped aggregations):
    get_doctor_analytics(doctor_id) → dict
    get_doctor_quota(doctor_id) → dict

  Phase-5 entities (all doctor-scoped, ownership enforced before any access):
    Labor records:
      list_labor_records(doctor_id, patient_id_str=None) → [LaborRecord]
      create_labor_record(doctor_id, patient_id_str, data) → LaborRecord
    Fetal monitoring:
      list_fetal_monitoring(doctor_id, patient_id_str) → [FetalMonitoring]
      create_fetal_monitoring(doctor_id, patient_id_str, data) → FetalMonitoring
    AI predictions:
      list_ai_predictions(doctor_id, patient_id_str=None, limit=100) → [AIPrediction]
      create_ai_prediction(doctor_id, patient_id_str, data) → AIPrediction
    Reports:
      list_reports(doctor_id, patient_id_str=None) → [Report]
      create_report(doctor_id, data, patient_id_str=None) → Report
      get_report(doctor_id, report_id) → Report
    Uploaded files:
      list_uploaded_files(doctor_id, patient_id_str=None) → [UploadedFile]
      create_uploaded_file(doctor_id, data, patient_id_str=None) → UploadedFile
      get_uploaded_file(doctor_id, file_id) → UploadedFile
    Appointments:
      list_appointments(doctor_id, since=None, until=None) → [Appointment]
      create_appointment(doctor_id, patient_id_str, data) → Appointment
    Prescriptions:
      list_prescriptions(doctor_id, patient_id_str=None) → [Prescription]
      create_prescription(doctor_id, patient_id_str, data) → Prescription
"""
import logging
from datetime import datetime, timedelta, timezone

from flask import abort

log = logging.getLogger(__name__)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _require_approved_doctor(doctor_id: int):
    """Load a Doctor by ID and verify it exists. Returns Doctor instance."""
    from models import Doctor
    return Doctor.query.get_or_404(doctor_id)


# ── Patient Repository ────────────────────────────────────────────────────────

def get_doctor_patients(
    doctor_id: int,
    page: int = None,
    limit: int = 50,
    status_filter: str = None,
):
    """
    Return patients belonging STRICTLY to doctor_id.

    Security contract:
      - Filters ONLY on doctor_id == doctor_id (no NULL bypass)
      - Admin routes use their own unscoped queries — this function is
        exclusively for doctor-role access

    Returns (items, total) if paginated, else list of Patient objects.
    """
    from models import Patient, Observation, Alert
    from extensions import db

    limit = min(int(limit), 200)  # hard cap

    base = Patient.query.filter(
        Patient.doctor_id == doctor_id
    ).order_by(Patient.admission_time.desc())

    if status_filter and status_filter != "all":
        base = base.filter(Patient.status == status_filter)

    if page is not None:
        pag = base.paginate(page=int(page), per_page=limit, error_out=False)
        patients = pag.items
        total = pag.total
        pages = pag.pages
    else:
        patients = base.all()
        total = len(patients)
        pages = 1

    if not patients:
        return ([], total, pages) if page is not None else []

    # Batch-load alerts and observation counts to avoid N+1.
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

    if page is not None:
        return result, total, pages
    return result


def get_doctor_patient_by_id(doctor_id: int, patient_id_str: str):
    """
    Fetch a single patient — FAIL-CLOSED on ownership mismatch or NULL doctor_id.

    This is the single authoritative ownership check for patient fetch.
    Wraps get_patient_for_doctor() from utils.crypto which logs IDOR attempts.
    """
    from utils.crypto import get_patient_for_doctor
    # Temporarily override JWT role context for admin bypass — not needed here
    # since this function is only called from doctor-role routes.
    return get_patient_for_doctor(patient_id_str, doctor_id)


def create_doctor_patient(doctor_id: int, data: dict):
    """
    Create a new patient owned by doctor_id.

    Security: doctor_id is ALWAYS the authenticated doctor's ID — never
    accepted from the request body. The data dict must be pre-validated.
    Returns the created Patient instance.
    """
    from models import Doctor, Patient
    from extensions import db

    doctor = Doctor.query.get_or_404(doctor_id)

    if doctor.patients_used >= doctor.patient_limit:
        abort(403, description="quota_reached")

    # Collision-safe, doctor-scoped patient_id generation.
    # Uses global count only for ID uniqueness — not for security.
    count = Patient.query.count() + 1
    patient_id = f"PTH-{count:03d}"
    while Patient.query.filter_by(patient_id=patient_id).first():
        count += 1
        patient_id = f"PTH-{count:03d}"

    def _parse_dt(s):
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None

    admission_time = _parse_dt(data.get("admission_time") or "") or datetime.utcnow()
    rupture_time   = _parse_dt(data.get("membrane_rupture_time") or "")

    p = Patient(
        patient_id=patient_id,
        name=data["name"],
        age=data["age"],
        gravida=data["gravida"],
        parity=data["parity"],
        gestational_age=data["gestational_age"],
        admission_time=admission_time,
        membrane_rupture_time=rupture_time,
        doctor_id=doctor_id,       # always from JWT, never from request body
        consent_obtained=True,
        consent_date=datetime.now(timezone.utc).replace(tzinfo=None),
        consent_method=data.get("consent_method") or "digital",
    )
    db.session.add(p)
    db.session.commit()
    return p


def update_doctor_patient(doctor_id: int, patient_id_str: str, data: dict):
    """
    Update a patient after verifying ownership. Returns updated Patient.
    """
    from extensions import db
    from utils.crypto import get_patient_for_doctor

    # Temporarily inject JWT context — ownership check uses get_jwt()
    p = get_patient_for_doctor(patient_id_str, doctor_id)

    def _parse_dt(s):
        try:
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None

    if "name"            in data: p.name            = data["name"]
    if "age"             in data: p.age             = int(data["age"])
    if "gravida"         in data: p.gravida         = int(data["gravida"])
    if "parity"          in data: p.parity          = int(data["parity"])
    if "gestational_age" in data: p.gestational_age = int(data["gestational_age"])
    if data.get("admission_time"):
        p.admission_time = _parse_dt(data["admission_time"]) or p.admission_time
    if "membrane_rupture_time" in data:
        p.membrane_rupture_time = _parse_dt(data["membrane_rupture_time"] or "")

    db.session.commit()
    return p


def delete_doctor_patient(doctor_id: int, patient_id_str: str) -> None:
    """
    Soft-delete (mark Inactive) or hard-delete a patient after ownership check.
    Hard delete cascades to observations and alerts (via ORM cascade).
    """
    from extensions import db
    from utils.crypto import get_patient_for_doctor

    p = get_patient_for_doctor(patient_id_str, doctor_id)
    db.session.delete(p)
    db.session.commit()


# ── Observation Repository ────────────────────────────────────────────────────

def get_patient_observations(doctor_id: int, patient_id_str: str):
    """Return observations for a patient the doctor owns."""
    from models import Observation
    from utils.crypto import get_patient_for_doctor

    p = get_patient_for_doctor(patient_id_str, doctor_id)
    return Observation.query.filter_by(patient_id=p.id).order_by(
        Observation.timestamp
    ).all()


def get_observation(doctor_id: int, obs_id: int):
    """Return a single observation after verifying doctor owns the patient."""
    from utils.crypto import get_observation_for_doctor
    return get_observation_for_doctor(obs_id, doctor_id)


# ── Analytics Repository ──────────────────────────────────────────────────────

def get_doctor_quota(doctor_id: int) -> dict:
    """Return quota stats for a doctor — scoped to their own account."""
    from models import Doctor
    doctor = Doctor.query.get_or_404(doctor_id)
    used, limit = doctor.patients_used, doctor.patient_limit
    return {
        "patients_used":  used,
        "patient_limit":  limit,
        "remaining":      max(0, limit - used),
        "quota_reached":  used >= limit,
        "quota_pct":      round((used / limit) * 100, 1) if limit else 0,
    }


def get_doctor_analytics(doctor_id: int) -> dict:
    """
    Return 30-day daily + 12-week weekly analytics for the authenticated doctor.
    All queries are scoped to doctor_id — no cross-doctor data leakage.
    """
    from models import Doctor, Patient, Observation, Alert
    from extensions import db

    doctor = Doctor.query.get_or_404(doctor_id)
    now    = datetime.utcnow()

    daily = []
    for i in range(29, -1, -1):
        ds = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        de = ds + timedelta(days=1)
        daily.append({
            "date": ds.strftime("%b %d"),
            "patients": Patient.query.filter(
                Patient.doctor_id == doctor_id,
                Patient.admission_time >= ds,
                Patient.admission_time < de,
            ).count(),
            "observations": (
                db.session.query(db.func.count(Observation.id))
                .join(Patient, Observation.patient_id == Patient.id)
                .filter(
                    Patient.doctor_id == doctor_id,
                    Observation.timestamp >= ds,
                    Observation.timestamp < de,
                ).scalar() or 0
            ),
        })

    weekly = []
    for i in range(11, -1, -1):
        ws = (now - timedelta(weeks=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        we = ws + timedelta(weeks=1)
        weekly.append({
            "week": ws.strftime("W%U %b"),
            "patients": Patient.query.filter(
                Patient.doctor_id == doctor_id,
                Patient.admission_time >= ws,
                Patient.admission_time < we,
            ).count(),
        })

    statuses = db.session.query(Patient.status, db.func.count()).filter_by(
        doctor_id=doctor_id
    ).group_by(Patient.status).all()

    alerts = (
        db.session.query(Alert.severity, db.func.count())
        .join(Patient, Alert.patient_id == Patient.id)
        .filter(Patient.doctor_id == doctor_id)
        .group_by(Alert.severity).all()
    )

    total_obs = (
        db.session.query(db.func.count(Observation.id))
        .join(Patient, Observation.patient_id == Patient.id)
        .filter(Patient.doctor_id == doctor_id).scalar() or 0
    )

    return {
        "total_patients":     doctor.patients_used,
        "total_observations": total_obs,
        "credits_used":       doctor.patients_used,
        "credits_remaining":  max(0, doctor.patient_limit - doctor.patients_used),
        "daily":              daily,
        "weekly":             weekly,
        "status_breakdown":   [{"name": s, "value": c} for s, c in statuses],
        "alert_breakdown":    [{"name": sev.title(), "value": c} for sev, c in alerts],
    }


# ═════════════════════════════════════════════════════════════════════════════
# Phase-5 — tenant-scoped CRUD helpers for the new entity tables.
#
# Contract for every function below:
#   1. doctor_id MUST come from JWT (controller's responsibility).
#   2. When a patient_id_str is taken, ownership is verified via
#      get_patient_for_doctor() before any DB read or write.
#   3. doctor_id is force-stamped on every INSERT — never read from `data`.
#   4. Listing functions always filter by doctor_id in the SQL — no Python-side
#      filtering (which would still load the rows).
# ═════════════════════════════════════════════════════════════════════════════


def _patient_owned(doctor_id: int, patient_id_str: str):
    """Convenience wrapper: returns Patient or aborts 403/404."""
    from utils.crypto import get_patient_for_doctor
    return get_patient_for_doctor(patient_id_str, doctor_id)


# ── Labor records ────────────────────────────────────────────────────────────

def list_labor_records(doctor_id: int, patient_id_str: str | None = None):
    from models import LaborRecord
    q = LaborRecord.query.filter(LaborRecord.doctor_id == doctor_id)
    if patient_id_str:
        p = _patient_owned(doctor_id, patient_id_str)
        q = q.filter(LaborRecord.patient_id == p.id)
    return q.order_by(LaborRecord.started_at.desc()).all()


def create_labor_record(doctor_id: int, patient_id_str: str, data: dict):
    from extensions import db
    from models import LaborRecord
    p = _patient_owned(doctor_id, patient_id_str)
    rec = LaborRecord(
        doctor_id=doctor_id,
        patient_id=p.id,
        started_at=_parse_dt(data.get("started_at")) or datetime.utcnow(),
        ended_at=_parse_dt(data.get("ended_at")),
        delivery_mode=(data.get("delivery_mode") or None),
        outcome=(data.get("outcome") or None),
        notes=(data.get("notes") or None),
    )
    db.session.add(rec)
    db.session.commit()
    return rec


# ── Fetal monitoring ─────────────────────────────────────────────────────────

def list_fetal_monitoring(doctor_id: int, patient_id_str: str):
    from models import FetalMonitoring
    p = _patient_owned(doctor_id, patient_id_str)
    return (
        FetalMonitoring.query
        .filter(FetalMonitoring.doctor_id == doctor_id,
                FetalMonitoring.patient_id == p.id)
        .order_by(FetalMonitoring.recorded_at.desc())
        .all()
    )


def create_fetal_monitoring(doctor_id: int, patient_id_str: str, data: dict):
    from extensions import db
    from models import FetalMonitoring
    p = _patient_owned(doctor_id, patient_id_str)
    fm = FetalMonitoring(
        doctor_id=doctor_id,
        patient_id=p.id,
        recorded_at=_parse_dt(data.get("recorded_at")) or datetime.utcnow(),
        fhr_baseline=_safe_int(data.get("fhr_baseline")),
        variability=data.get("variability") or None,
        accelerations=_safe_int(data.get("accelerations")),
        decelerations=data.get("decelerations") or None,
        interpretation=data.get("interpretation") or None,
        trace_ref=data.get("trace_ref") or None,
    )
    db.session.add(fm)
    db.session.commit()
    return fm


# ── AI predictions ───────────────────────────────────────────────────────────

def list_ai_predictions(doctor_id: int, patient_id_str: str | None = None,
                        limit: int = 100):
    from models import AIPrediction
    limit = min(int(limit), 500)
    q = AIPrediction.query.filter(AIPrediction.doctor_id == doctor_id)
    if patient_id_str:
        p = _patient_owned(doctor_id, patient_id_str)
        q = q.filter(AIPrediction.patient_id == p.id)
    return q.order_by(AIPrediction.created_at.desc()).limit(limit).all()


def create_ai_prediction(doctor_id: int, patient_id_str: str, data: dict):
    from extensions import db
    from models import AIPrediction
    p = _patient_owned(doctor_id, patient_id_str)
    pred = AIPrediction(
        doctor_id=doctor_id,
        patient_id=p.id,
        model_name=data["model_name"],
        model_version=data.get("model_version"),
        prediction_type=data["prediction_type"],
        inputs_hash=data.get("inputs_hash"),
        output_json=data.get("output_json"),
        confidence=data.get("confidence"),
    )
    db.session.add(pred)
    db.session.commit()
    return pred


# ── Reports ──────────────────────────────────────────────────────────────────

def list_reports(doctor_id: int, patient_id_str: str | None = None):
    from models import Report
    q = Report.query.filter(Report.doctor_id == doctor_id)
    if patient_id_str:
        p = _patient_owned(doctor_id, patient_id_str)
        q = q.filter(Report.patient_id == p.id)
    return q.order_by(Report.created_at.desc()).all()


def create_report(doctor_id: int, data: dict, patient_id_str: str | None = None):
    from extensions import db
    from models import Report
    patient_pk = None
    if patient_id_str:
        patient_pk = _patient_owned(doctor_id, patient_id_str).id
    r = Report(
        doctor_id=doctor_id,
        patient_id=patient_pk,
        report_type=data["report_type"],
        storage_key=data["storage_key"],
        size_bytes=_safe_int(data.get("size_bytes")),
    )
    db.session.add(r)
    db.session.commit()
    return r


def get_report(doctor_id: int, report_id: int):
    from models import Report
    r = Report.query.get_or_404(int(report_id))
    if r.doctor_id != doctor_id:
        from utils.crypto import log_unauthorized_access
        log_unauthorized_access(doctor_id, "report", report_id,
                                reason="ownership_mismatch")
        abort(403)
    return r


# ── Uploaded files ───────────────────────────────────────────────────────────

def list_uploaded_files(doctor_id: int, patient_id_str: str | None = None):
    from models import UploadedFile
    q = UploadedFile.query.filter(UploadedFile.doctor_id == doctor_id)
    if patient_id_str:
        p = _patient_owned(doctor_id, patient_id_str)
        q = q.filter(UploadedFile.patient_id == p.id)
    return q.order_by(UploadedFile.uploaded_at.desc()).all()


def create_uploaded_file(doctor_id: int, data: dict,
                         patient_id_str: str | None = None):
    from extensions import db
    from models import UploadedFile
    patient_pk = None
    if patient_id_str:
        patient_pk = _patient_owned(doctor_id, patient_id_str).id
    f = UploadedFile(
        doctor_id=doctor_id,
        patient_id=patient_pk,
        filename=data["filename"],
        storage_key=data["storage_key"],
        content_type=data.get("content_type"),
        size_bytes=_safe_int(data.get("size_bytes")),
        sha256=data.get("sha256"),
    )
    db.session.add(f)
    db.session.commit()
    return f


def get_uploaded_file(doctor_id: int, file_id: int):
    from models import UploadedFile
    f = UploadedFile.query.get_or_404(int(file_id))
    if f.doctor_id != doctor_id:
        from utils.crypto import log_unauthorized_access
        log_unauthorized_access(doctor_id, "uploaded_file", file_id,
                                reason="ownership_mismatch")
        abort(403)
    return f


# ── Appointments ─────────────────────────────────────────────────────────────

def list_appointments(doctor_id: int,
                      since: datetime | None = None,
                      until: datetime | None = None):
    from models import Appointment
    q = Appointment.query.filter(Appointment.doctor_id == doctor_id)
    if since:
        q = q.filter(Appointment.scheduled_for >= since)
    if until:
        q = q.filter(Appointment.scheduled_for < until)
    return q.order_by(Appointment.scheduled_for.asc()).all()


def create_appointment(doctor_id: int, patient_id_str: str, data: dict):
    from extensions import db
    from models import Appointment
    p = _patient_owned(doctor_id, patient_id_str)
    appt = Appointment(
        doctor_id=doctor_id,
        patient_id=p.id,
        scheduled_for=_parse_dt(data["scheduled_for"]) or datetime.utcnow(),
        duration_min=_safe_int(data.get("duration_min")) or 30,
        reason=data.get("reason"),
        status=data.get("status") or "scheduled",
    )
    db.session.add(appt)
    db.session.commit()
    return appt


# ── Prescriptions ────────────────────────────────────────────────────────────

def list_prescriptions(doctor_id: int, patient_id_str: str | None = None):
    from models import Prescription
    q = Prescription.query.filter(Prescription.doctor_id == doctor_id)
    if patient_id_str:
        p = _patient_owned(doctor_id, patient_id_str)
        q = q.filter(Prescription.patient_id == p.id)
    return q.order_by(Prescription.prescribed_at.desc()).all()


def create_prescription(doctor_id: int, patient_id_str: str, data: dict):
    from extensions import db
    from models import Prescription
    p = _patient_owned(doctor_id, patient_id_str)
    rx = Prescription(
        doctor_id=doctor_id,
        patient_id=p.id,
        drug_name=data["drug_name"],
        dosage=data.get("dosage"),
        frequency=data.get("frequency"),
        duration=data.get("duration"),
        instructions=data.get("instructions"),
        prescribed_at=_parse_dt(data.get("prescribed_at")) or datetime.utcnow(),
        status=data.get("status") or "active",
    )
    db.session.add(rx)
    db.session.commit()
    return rx


# ── Shared parsing helpers (private) ─────────────────────────────────────────

def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _safe_int(value):
    if value in (None, "", "null"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
