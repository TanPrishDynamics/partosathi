"""
seed_test_cases.py
──────────────────
Seeds the 5 WHO-standard test cases into the e-Partogram database.
Run from the project root:

    cd backend
    python ../scripts/seed_test_cases.py

Cases:
  PTH-WHO-01  Sita Devi      — Normal Labour (ideal WHO pattern)
  PTH-WHO-02  Meena Kumari   — Slow Progress (alert line crossing)
  PTH-WHO-03  Rekha Singh    — Danger (action line + rising FHR)
  PTH-WHO-04  Fetal Distress — Tachycardia scenario
  PTH-WHO-05  Hyperactive    — Too-fast labour
"""

import sys
import os

# Allow running from scripts/ or project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from datetime import datetime, timedelta
from app import app
from models import db, Patient, Observation, Alert, Doctor
from alerts import evaluate_observation
from werkzeug.security import generate_password_hash


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_or_create_test_doctor():
    """Return the seeded demo doctor, or create a test doctor if missing."""
    doc = Doctor.query.filter_by(email="admin@hospital.com").first()
    if doc:
        return doc
    doc = Doctor(
        name="Dr. Test Clinician",
        email="test@hospital.com",
        password_hash=generate_password_hash("TestPass#2026"),
        license_number="TEST-001",
        hospital="WHO Test Hospital",
    )
    db.session.add(doc)
    db.session.flush()
    return doc


def _seed_patient_with_observations(patient_id, name, age, gravida, parity,
                                    gestational_age, admission_dt,
                                    rupture_dt, obs_data, doctor_id):
    """
    Create (or skip if exists) a patient + observations + alerts.
    obs_data: list of dicts with keys:
        hours_offset, dilation, fhr, contractions, station,
        pulse, bp_sys, bp_dia (all optional except hours_offset/dilation)
    """
    if Patient.query.filter_by(patient_id=patient_id).first():
        print(f"  ⏭  {patient_id} already exists — skipping.")
        return

    p = Patient(
        patient_id=patient_id,
        name=name,
        age=age,
        gravida=gravida,
        parity=parity,
        gestational_age=gestational_age,
        admission_time=admission_dt,
        membrane_rupture_time=rupture_dt,
        doctor_id=doctor_id,
    )
    db.session.add(p)
    db.session.flush()

    obs_objects = []
    for row in obs_data:
        o = Observation(
            patient_id=p.id,
            timestamp=admission_dt + timedelta(hours=row["hours_offset"]),
            cervical_dilation=row.get("dilation"),
            fetal_heart_rate=row.get("fhr"),
            contraction_freq=row.get("contractions"),
            contraction_duration=row.get("contraction_duration", 35),  # default 35 s
            head_station=row.get("station"),
            amniotic_fluid=row.get("amniotic_fluid", "clear"),
            moulding=row.get("moulding", "0"),
            maternal_pulse=row.get("pulse"),
            bp_systolic=row.get("bp_sys"),
            bp_diastolic=row.get("bp_dia"),
            temperature=row.get("temperature", 36.8),
            urine_protein=row.get("urine_protein", "nil"),
            urine_ketones=row.get("urine_ketones", "nil"),
            urine_volume=row.get("urine_volume", 150),
        )
        db.session.add(o)
        obs_objects.append(o)

    db.session.flush()

    # Evaluate and store alerts
    all_obs = Observation.query.filter_by(patient_id=p.id).all()
    alert_count = 0
    for o in obs_objects:
        triggered = evaluate_observation(o, all_obs)
        for a_data in triggered:
            al = Alert(
                patient_id=p.id,
                timestamp=o.timestamp,
                observation_id=o.id,
                **a_data,
            )
            db.session.add(al)
            alert_count += 1

    db.session.commit()
    print(f"  ✅ {patient_id} ({name}) — {len(obs_objects)} obs, {alert_count} alerts generated.")


# ──────────────────────────────────────────────────────────────────────────────
# Test Cases
# ──────────────────────────────────────────────────────────────────────────────

def seed_case_1(doctor_id):
    """Case 1 — Sita Devi: Normal Labour (ideal WHO pattern)."""
    adm = datetime(2026, 4, 21, 8, 0, 0)   # 08:00
    rup = datetime(2026, 4, 21, 7, 30, 0)   # 07:30
    obs = [
        # hours_offset relative to 08:00
        dict(hours_offset=0.0,  dilation=4,  fhr=140, contractions=2, station=-2, pulse=82,  bp_sys=120, bp_dia=80),
        dict(hours_offset=2.0,  dilation=5,  fhr=138, contractions=3, station=-1, pulse=84,  bp_sys=118, bp_dia=78),
        dict(hours_offset=4.0,  dilation=6,  fhr=142, contractions=3, station=0,  pulse=86,  bp_sys=120, bp_dia=80),
        dict(hours_offset=6.0,  dilation=7,  fhr=145, contractions=4, station=1,  pulse=88,  bp_sys=122, bp_dia=82),
        dict(hours_offset=8.0,  dilation=9,  fhr=148, contractions=4, station=2,  pulse=90,  bp_sys=120, bp_dia=80),
        dict(hours_offset=9.5,  dilation=10, fhr=150, contractions=5, station=3,  pulse=92,  bp_sys=118, bp_dia=80),
    ]
    _seed_patient_with_observations(
        patient_id="PTH-WHO-01",
        name="Sita Devi",
        age=26, gravida=2, parity=1,
        gestational_age=39,
        admission_dt=adm, rupture_dt=rup,
        obs_data=obs, doctor_id=doctor_id,
    )


def seed_case_2(doctor_id):
    """Case 2 — Meena Kumari: Slow Progress (crosses alert line)."""
    adm = datetime(2026, 4, 21, 9, 0, 0)
    obs = [
        dict(hours_offset=0.0, dilation=4, fhr=142, contractions=2, station=-3, pulse=80, bp_sys=116, bp_dia=76),
        dict(hours_offset=2.0, dilation=4, fhr=140, contractions=2, station=-3, pulse=82, bp_sys=118, bp_dia=78),
        dict(hours_offset=4.0, dilation=5, fhr=138, contractions=2, station=-2, pulse=84, bp_sys=116, bp_dia=76),
        dict(hours_offset=6.0, dilation=5, fhr=136, contractions=3, station=-2, pulse=86, bp_sys=120, bp_dia=80),
        dict(hours_offset=8.0, dilation=6, fhr=135, contractions=3, station=-1, pulse=88, bp_sys=118, bp_dia=78),
        dict(hours_offset=10.0, dilation=6, fhr=134, contractions=3, station=-1, pulse=90, bp_sys=120, bp_dia=80),
    ]
    _seed_patient_with_observations(
        patient_id="PTH-WHO-02",
        name="Meena Kumari",
        age=22, gravida=1, parity=0,
        gestational_age=40,
        admission_dt=adm, rupture_dt=None,
        obs_data=obs, doctor_id=doctor_id,
    )


def seed_case_3(doctor_id):
    """Case 3 — Rekha Singh: Danger zone (action line + rising FHR)."""
    adm = datetime(2026, 4, 21, 8, 0, 0)
    obs = [
        dict(hours_offset=0.0,  dilation=4, fhr=150, contractions=2, station=-3, pulse=80, bp_sys=118, bp_dia=76),
        dict(hours_offset=2.0,  dilation=4, fhr=152, contractions=2, station=-3, pulse=82, bp_sys=120, bp_dia=78),
        dict(hours_offset=4.0,  dilation=5, fhr=155, contractions=2, station=-2, pulse=84, bp_sys=118, bp_dia=76),
        dict(hours_offset=6.0,  dilation=5, fhr=158, contractions=2, station=-2, pulse=86, bp_sys=122, bp_dia=80),
        dict(hours_offset=8.0,  dilation=6, fhr=160, contractions=2, station=-1, pulse=88, bp_sys=120, bp_dia=80),
        dict(hours_offset=10.0, dilation=6, fhr=165, contractions=2, station=-1, pulse=92, bp_sys=124, bp_dia=82),
    ]
    _seed_patient_with_observations(
        patient_id="PTH-WHO-03",
        name="Rekha Singh",
        age=29, gravida=2, parity=1,
        gestational_age=39,
        admission_dt=adm, rupture_dt=None,
        obs_data=obs, doctor_id=doctor_id,
    )


def seed_case_4(doctor_id):
    """Case 4 — Fetal Distress Scenario (tachycardia >160 bpm)."""
    adm = datetime(2026, 4, 21, 10, 0, 0)
    obs = [
        dict(hours_offset=0.0,  dilation=6, fhr=170, contractions=3, station=-1, pulse=88, bp_sys=118, bp_dia=76),
        dict(hours_offset=0.5,  dilation=6, fhr=172, contractions=3, station=-1, pulse=90, bp_sys=120, bp_dia=78),
        dict(hours_offset=1.0,  dilation=7, fhr=175, contractions=4, station=0,  pulse=92, bp_sys=118, bp_dia=76),
    ]
    _seed_patient_with_observations(
        patient_id="PTH-WHO-04",
        name="Priya Mehta",
        age=24, gravida=1, parity=0,
        gestational_age=38,
        admission_dt=adm, rupture_dt=None,
        obs_data=obs, doctor_id=doctor_id,
    )


def seed_case_5(doctor_id):
    """Case 5 — Hyperactive Labour (precipitous, >2 cm/hr)."""
    adm = datetime(2026, 4, 21, 8, 0, 0)
    obs = [
        dict(hours_offset=0.0, dilation=4,  fhr=142, contractions=4, station=-2, pulse=85, bp_sys=118, bp_dia=76,
             contraction_duration=50),
        dict(hours_offset=1.0, dilation=6,  fhr=148, contractions=5, station=-1, pulse=90, bp_sys=120, bp_dia=78,
             contraction_duration=55),
        dict(hours_offset=2.0, dilation=8,  fhr=152, contractions=5, station=0,  pulse=92, bp_sys=118, bp_dia=76,
             contraction_duration=55),
        dict(hours_offset=3.0, dilation=10, fhr=156, contractions=6, station=2,  pulse=96, bp_sys=122, bp_dia=80,
             contraction_duration=60),
    ]
    _seed_patient_with_observations(
        patient_id="PTH-WHO-05",
        name="Anita Joshi",
        age=31, gravida=3, parity=2,
        gestational_age=40,
        admission_dt=adm, rupture_dt=None,
        obs_data=obs, doctor_id=doctor_id,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def main():
    print("\n🌱  Seeding WHO test cases into e-Partogram database…\n")
    with app.app_context():
        db.create_all()
        doctor = _get_or_create_test_doctor()

        seed_case_1(doctor.id)
        seed_case_2(doctor.id)
        seed_case_3(doctor.id)
        seed_case_4(doctor.id)
        seed_case_5(doctor.id)

    print("\n🎉  All WHO test cases seeded successfully!\n")
    print("  PTH-WHO-01  Sita Devi      → Normal labour (graph left of alert line)")
    print("  PTH-WHO-02  Meena Kumari   → Slow progress (alert line crossed, augmentation advised)")
    print("  PTH-WHO-03  Rekha Singh    → Danger zone (action line crossed, C-section alert)")
    print("  PTH-WHO-04  Priya Mehta    → Fetal tachycardia (urgent evaluation)")
    print("  PTH-WHO-05  Anita Joshi    → Hyperactive labour (precipitous delivery risk)")


if __name__ == "__main__":
    main()
