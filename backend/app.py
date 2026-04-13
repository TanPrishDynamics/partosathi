"""
e-Partogram Backend — Flask REST API
"""
import os
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity,
)
from werkzeug.security import generate_password_hash, check_password_hash
import io

from models import db, Admin, Doctor, Patient, Observation, Alert
from alerts import evaluate_observation
from pdf_export import generate_pdf
from clinical_decision_support import process_labor_observation


# ---------------------------------------------------------------------------
# App configuration
# ---------------------------------------------------------------------------

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///partogram.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = "tanprish-epartogram-secret-2026"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=12)

db.init_app(app)
jwt = JWTManager(app)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])


# ---------------------------------------------------------------------------
# Seed demo data
# ---------------------------------------------------------------------------

def seed_demo_data():
    """Seed a demo admin, demo doctor and two sample patients with observations."""
    if Admin.query.first() and Doctor.query.first():
        return  # already seeded

    # Demo admin
    if not Admin.query.first():
        admin = Admin(
            name="Admin Manager",
            email="admin@tanprish-dynamics.com",
            password_hash=generate_password_hash("admin123"),
            company="TanPrish Dynamics",
        )
        db.session.add(admin)

    # Demo doctor
    if not Doctor.query.first():
        doctor = Doctor(
            name="Dr. Priya Sharma",
            email="admin@hospital.com",
            password_hash=generate_password_hash("admin123"),
            license_number="MH-2026-001",
        )
        db.session.add(doctor)
        db.session.flush()
    else:
        doctor = Doctor.query.first()

    # ---- Patient 1: PTH-001 — active labor, progressing well ----
    now = datetime.utcnow()
    admission_1 = now - timedelta(hours=10)
    p1 = Patient(
        patient_id="PTH-001",
        name="Amrita Deshpande",
        age=27,
        gravida=2,
        parity=1,
        gestational_age=39,
        admission_time=admission_1,
        doctor_id=doctor.id,
    )
    db.session.add(p1)
    db.session.flush()

    # Observations every hour
    obs_data_1 = [
        # (hours_offset, dil, fhr, freq, dur, station, fluid, mould, pulse, sys, dia, temp, prot, ket, vol)
        (0,  3.0, 142, 2, 20, -3, "clear",    "0",  78, 110, 70, 36.8, "nil", "nil", 200),
        (1,  4.0, 138, 3, 30, -3, "clear",    "0",  80, 112, 72, 36.9, "nil", "nil", 180),
        (2,  5.0, 145, 3, 35, -2, "clear",    "+",  82, 114, 74, 37.0, "nil", "nil", 150),
        (3,  6.0, 140, 4, 40, -2, "clear",    "+",  80, 116, 74, 37.1, "nil", "nil", 160),
        (4,  7.0, 148, 4, 45, -1, "clear",    "+",  84, 115, 75, 37.0, "nil", "+",  140),
        (5,  8.0, 136, 4, 50, -1, "clear",    "++", 86, 118, 76, 37.2, "nil", "+",  120),
        (6,  9.0, 144, 5, 55,  0, "clear",    "++", 88, 120, 78, 37.3, "nil", "+",  100),
        (7, 10.0, 150, 5, 60,  0, "clear",    "++", 90, 122, 80, 37.1, "nil", "+",   80),
    ]

    for h, dil, fhr, freq, dur, stn, fluid, mould, pulse, sys, dia, temp, prot, ket, vol in obs_data_1:
        o = Observation(
            patient_id=p1.id,
            timestamp=admission_1 + timedelta(hours=h),
            cervical_dilation=dil, fetal_heart_rate=fhr,
            contraction_freq=freq, contraction_duration=dur,
            head_station=stn, amniotic_fluid=fluid, moulding=mould,
            maternal_pulse=pulse, bp_systolic=sys, bp_diastolic=dia,
            temperature=temp, urine_protein=prot, urine_ketones=ket, urine_volume=vol,
        )
        db.session.add(o)

    db.session.flush()

    # Generate alerts for patient 1
    all_obs_1 = Observation.query.filter_by(patient_id=p1.id).all()
    for o in all_obs_1:
        triggered = evaluate_observation(o, all_obs_1)
        for a_data in triggered:
            al = Alert(
                patient_id=p1.id,
                timestamp=o.timestamp,
                observation_id=o.id,
                **a_data,
            )
            db.session.add(al)

    # ---- Patient 2: PTH-002 — problematic labor with alerts ----
    admission_2 = now - timedelta(hours=8)
    p2 = Patient(
        patient_id="PTH-002",
        name="Kavitha Nair",
        age=32,
        gravida=1,
        parity=0,
        gestational_age=40,
        admission_time=admission_2,
        doctor_id=doctor.id,
    )
    db.session.add(p2)
    db.session.flush()

    obs_data_2 = [
        (0,  4.0, 145, 3, 30, -3, "clear",    "0",  80, 130, 82, 36.9, "nil", "nil", 200),
        (2,  5.0, 105, 3, 35, -3, "meconium", "+",  85, 144, 92, 37.5, "+",  "nil", 180),
        (4,  5.5, 168, 4, 50, -3, "meconium", "++", 102,150, 95, 38.2, "+",  "+",  150),
        (6,  6.0, 170, 5, 55, -3, "meconium", "++", 108,155, 98, 38.5, "++", "+",  100),
    ]

    for h, dil, fhr, freq, dur, stn, fluid, mould, pulse, sys, dia, temp, prot, ket, vol in obs_data_2:
        o = Observation(
            patient_id=p2.id,
            timestamp=admission_2 + timedelta(hours=h),
            cervical_dilation=dil, fetal_heart_rate=fhr,
            contraction_freq=freq, contraction_duration=dur,
            head_station=stn, amniotic_fluid=fluid, moulding=mould,
            maternal_pulse=pulse, bp_systolic=sys, bp_diastolic=dia,
            temperature=temp, urine_protein=prot, urine_ketones=ket, urine_volume=vol,
        )
        db.session.add(o)

    db.session.flush()

    all_obs_2 = Observation.query.filter_by(patient_id=p2.id).all()
    for o in all_obs_2:
        triggered = evaluate_observation(o, all_obs_2)
        for a_data in triggered:
            al = Alert(
                patient_id=p2.id,
                timestamp=o.timestamp,
                observation_id=o.id,
                **a_data,
            )
            db.session.add(al)

    db.session.commit()
    print("✅ Demo data seeded successfully.")


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.route("/api/auth/admin-login", methods=["POST"])
def admin_login():
    """Admin/Company login endpoint"""
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    admin = Admin.query.filter_by(email=email).first()
    if not admin or not check_password_hash(admin.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(admin.id))
    return jsonify({
        "token": token,
        "user": admin.to_dict(),
        "role": "admin"
    })


@app.route("/api/auth/login", methods=["POST"])
def login():
    """Doctor login endpoint"""
    data = request.get_json()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    doctor = Doctor.query.filter_by(email=email).first()
    if not doctor or not check_password_hash(doctor.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_access_token(identity=str(doctor.id))
    return jsonify({
        "token": token,
        "doctor": {"id": doctor.id, "name": doctor.name, "email": doctor.email},
        "role": "doctor"
    })


@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def me():
    doc_id = int(get_jwt_identity())
    doctor = Doctor.query.get_or_404(doc_id)
    return jsonify({"id": doctor.id, "name": doctor.name, "email": doctor.email})


# ---------------------------------------------------------------------------
# Patient routes
# ---------------------------------------------------------------------------

@app.route("/api/patients", methods=["GET"])
@jwt_required()
def list_patients():
    patients = Patient.query.order_by(Patient.admission_time.desc()).all()
    result = []
    for p in patients:
        d = p.to_dict()
        # Add alert counts
        alerts = Alert.query.filter_by(patient_id=p.id).all()
        d["alert_counts"] = {
            "red":    sum(1 for a in alerts if a.severity == "red" and not a.acknowledged),
            "yellow": sum(1 for a in alerts if a.severity == "yellow" and not a.acknowledged),
        }
        d["observation_count"] = Observation.query.filter_by(patient_id=p.id).count()
        result.append(d)
    return jsonify(result)


@app.route("/api/patient", methods=["POST"])
@jwt_required()
def create_patient():
    doc_id = int(get_jwt_identity())
    data = request.get_json()

    # Auto-generate patient_id
    count = Patient.query.count() + 1
    patient_id = f"PTH-{count:03d}"
    # Ensure uniqueness
    while Patient.query.filter_by(patient_id=patient_id).first():
        count += 1
        patient_id = f"PTH-{count:03d}"

    admission_time = data.get("admission_time")
    if admission_time:
        try:
            admission_time = datetime.fromisoformat(admission_time.replace("Z", "+00:00"))
        except Exception:
            admission_time = datetime.utcnow()
    else:
        admission_time = datetime.utcnow()

    p = Patient(
        patient_id=patient_id,
        name=data["name"],
        age=int(data["age"]),
        gravida=int(data.get("gravida", 1)),
        parity=int(data.get("parity", 0)),
        gestational_age=int(data["gestational_age"]),
        admission_time=admission_time,
        doctor_id=doc_id,
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@app.route("/api/patient/<patient_id>", methods=["GET"])
@jwt_required()
def get_patient(patient_id):
    p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
    return jsonify(p.to_dict())


# ---------------------------------------------------------------------------
# Observation routes
# ---------------------------------------------------------------------------

@app.route("/api/observation", methods=["POST"])
@jwt_required()
def add_observation():
    data = request.get_json()

    p = Patient.query.filter_by(patient_id=data["patient_id"]).first_or_404()

    timestamp = data.get("timestamp")
    if timestamp:
        try:
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except Exception:
            timestamp = datetime.utcnow()
    else:
        timestamp = datetime.utcnow()

    def nullable_float(val):
        return float(val) if val not in (None, "", "null") else None

    def nullable_int(val):
        return int(val) if val not in (None, "", "null") else None

    obs = Observation(
        patient_id=p.id,
        timestamp=timestamp,
        cervical_dilation=nullable_float(data.get("cervical_dilation")),
        head_station=nullable_float(data.get("head_station")),
        fetal_heart_rate=nullable_int(data.get("fetal_heart_rate")),
        amniotic_fluid=data.get("amniotic_fluid") or None,
        moulding=data.get("moulding") or None,
        contraction_freq=nullable_float(data.get("contraction_freq")),
        contraction_duration=nullable_int(data.get("contraction_duration")),
        maternal_pulse=nullable_int(data.get("maternal_pulse")),
        bp_systolic=nullable_int(data.get("bp_systolic")),
        bp_diastolic=nullable_int(data.get("bp_diastolic")),
        temperature=nullable_float(data.get("temperature")),
        urine_protein=data.get("urine_protein") or None,
        urine_ketones=data.get("urine_ketones") or None,
        urine_volume=nullable_int(data.get("urine_volume")),
    )
    db.session.add(obs)
    db.session.flush()

    # Run clinical decision support
    all_obs = Observation.query.filter_by(patient_id=p.id).all()
    triggered = evaluate_observation(obs, all_obs)
    new_alerts = []
    for a_data in triggered:
        al = Alert(
            patient_id=p.id,
            timestamp=timestamp,
            observation_id=obs.id,
            **a_data,
        )
        db.session.add(al)
        new_alerts.append(al)

    db.session.commit()

    return jsonify({
        "observation": obs.to_dict(),
        "alerts_triggered": [a.to_dict() for a in new_alerts],
    }), 201


@app.route("/api/observations/<patient_id>", methods=["GET"])
@jwt_required()
def get_observations(patient_id):
    p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
    obs = Observation.query.filter_by(patient_id=p.id).order_by(Observation.timestamp).all()
    return jsonify([o.to_dict() for o in obs])


# ---------------------------------------------------------------------------
# Clinical Decision Support Routes
# ---------------------------------------------------------------------------

@app.route("/api/cds/analyze-observation", methods=["POST"])
@jwt_required()
def analyze_observation_cds():
    """
    Clinical Decision Support analysis of a labor observation.
    Accepts: raw/freetext OR structured JSON format
    Returns: Normalized data + Clinical alerts + Graph-ready format
    
    Request body:
    {
        "patient_id": "PTH-001",
        "data": {raw observation data as JSON or freetext string}
    }
    """
    try:
        request_data = request.get_json()
        patient_id = request_data.get("patient_id")
        observation_data = request_data.get("data")
        
        if not patient_id or not observation_data:
            return jsonify({"error": "Missing patient_id or data"}), 400
        
        # Get patient for context
        p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
        
        # Get previous observation for dilation rate calculation
        previous_obs = Observation.query.filter_by(patient_id=p.id).order_by(
            Observation.timestamp.desc()
        ).first()
        
        previous_dilation = None
        time_diff_hours = None
        
        if previous_obs:
            previous_dilation = previous_obs.cervical_dilation
            if previous_obs.timestamp and "timestamp" in observation_data:
                try:
                    current_time = datetime.fromisoformat(
                        observation_data["timestamp"].replace("Z", "+00:00")
                    )
                    time_diff = current_time - previous_obs.timestamp
                    time_diff_hours = time_diff.total_seconds() / 3600
                except:
                    pass
        
        # Process observation through CDS
        cds_result = process_labor_observation(
            observation_data,
            previous_dilation=previous_dilation,
            time_diff_hours=time_diff_hours
        )
        
        if not cds_result["success"]:
            return jsonify(cds_result), 400
        
        # Prepare plotting data
        plot_data = {
            "x": cds_result["normalized_data"]["time_hours"],
            "y_dilation": cds_result["normalized_data"]["labor"]["cervical_dilation"],
            "y_station": cds_result["normalized_data"]["labor"]["head_descent"],
            "fhr": cds_result["normalized_data"]["fetal"]["fhr"],
            "contractions": cds_result["normalized_data"]["labor"]["contractions"]["count"]
        }
        
        return jsonify({
            "success": True,
            "patient_id": patient_id,
            "normalized_data": cds_result["normalized_data"],
            "alerts": cds_result["alerts"],
            "status": cds_result["status"],
            "alert_summary": {
                "total": cds_result["alert_count"],
                "critical": cds_result["critical_alerts"],
                "warning": cds_result["warning_alerts"]
            },
            "plot_ready": plot_data
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/cds/batch-analyze", methods=["POST"])
@jwt_required()
def batch_analyze_observations():
    """
    Analyze multiple observations at once for a patient.
    Useful for historical data import or bulk analysis.
    
    Request body:
    {
        "patient_id": "PTH-001",
        "observations": [
            {observation1},
            {observation2},
            ...
        ]
    }
    """
    try:
        request_data = request.get_json()
        patient_id = request_data.get("patient_id")
        observations = request_data.get("observations", [])
        
        if not patient_id or not observations:
            return jsonify({"error": "Missing patient_id or observations"}), 400
        
        p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
        
        results = []
        previous_dilation = None
        previous_time = None
        
        for obs_data in observations:
            time_diff_hours = None
            
            if previous_time and "timestamp" in obs_data:
                try:
                    current_time = datetime.fromisoformat(
                        obs_data["timestamp"].replace("Z", "+00:00")
                    )
                    time_diff = current_time - previous_time
                    time_diff_hours = time_diff.total_seconds() / 3600
                    previous_time = current_time
                except:
                    pass
            elif "timestamp" in obs_data:
                try:
                    previous_time = datetime.fromisoformat(
                        obs_data["timestamp"].replace("Z", "+00:00")
                    )
                except:
                    pass
            
            cds_result = process_labor_observation(
                obs_data,
                previous_dilation=previous_dilation,
                time_diff_hours=time_diff_hours
            )
            
            if cds_result["success"]:
                previous_dilation = cds_result["normalized_data"]["labor"]["cervical_dilation"]
                results.append({
                    "normalized_data": cds_result["normalized_data"],
                    "alerts": cds_result["alerts"],
                    "status": cds_result["status"]
                })
        
        return jsonify({
            "success": True,
            "patient_id": patient_id,
            "observations_analyzed": len(results),
            "results": results
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Alerts routes
# ---------------------------------------------------------------------------

@app.route("/api/alerts/<patient_id>", methods=["GET"])
@jwt_required()
def get_alerts(patient_id):
    p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
    alerts = Alert.query.filter_by(patient_id=p.id).order_by(Alert.timestamp.desc()).all()
    return jsonify([a.to_dict() for a in alerts])


@app.route("/api/alerts/<int:alert_id>/acknowledge", methods=["PATCH"])
@jwt_required()
def acknowledge_alert(alert_id):
    alert = Alert.query.get_or_404(alert_id)
    alert.acknowledged = True
    db.session.commit()
    return jsonify({"success": True})


# ---------------------------------------------------------------------------
# PDF export
# ---------------------------------------------------------------------------

@app.route("/api/export/pdf/<patient_id>", methods=["GET"])
@jwt_required()
def export_pdf(patient_id):
    p = Patient.query.filter_by(patient_id=patient_id).first_or_404()
    observations = Observation.query.filter_by(patient_id=p.id).order_by(Observation.timestamp).all()
    alerts = Alert.query.filter_by(patient_id=p.id).order_by(Alert.timestamp).all()

    pdf_bytes = generate_pdf(p, observations, alerts)
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"partogram_{patient_id}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf",
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_demo_data()
    app.run(debug=True, port=5001)
