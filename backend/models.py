from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Admin(db.Model):
    __tablename__ = "admins"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    company = db.Column(db.String(120), default="TanPrish Dynamics")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "company": self.company,
        }


class Doctor(db.Model):
    __tablename__ = "doctors"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    license_number = db.Column(db.String(50))
    hospital = db.Column(db.String(120), default="TanPrish Dynamics Medical Center")
    patients = db.relationship("Patient", backref="doctor", lazy=True)


class Patient(db.Model):
    __tablename__ = "patients"
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.String(20), unique=True, nullable=False)  # e.g. "PTH-001"
    name = db.Column(db.String(120), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    gravida = db.Column(db.Integer, default=1)
    parity = db.Column(db.Integer, default=0)
    gestational_age = db.Column(db.Integer, nullable=False)  # weeks
    admission_time = db.Column(db.DateTime, default=datetime.utcnow)
    membrane_rupture_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default="Active")
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=True)
    observations = db.relationship("Observation", backref="patient", lazy=True, cascade="all, delete-orphan")
    alerts = db.relationship("Alert", backref="patient", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "name": self.name,
            "age": self.age,
            "gravida": self.gravida,
            " parity": self.parity,
            "gestational_age": self.gestational_age,
            "admission_time": self.admission_time.isoformat() if self.admission_time else None,
            "membrane_rupture_time": self.membrane_rupture_time.isoformat() if self.membrane_rupture_time else None,
            "status": self.status,
            "doctor_id": self.doctor_id,
        }


class Observation(db.Model):
    __tablename__ = "observations"
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Labor progress
    cervical_dilation = db.Column(db.Float)        # 0–10 cm
    head_station = db.Column(db.Float)             # -5 to +5

    # Fetal
    fetal_heart_rate = db.Column(db.Integer)       # bpm
    amniotic_fluid = db.Column(db.String(30))      # clear / meconium / blood / absent
    moulding = db.Column(db.String(5))             # 0, +, ++, +++

    # Contractions
    contraction_freq = db.Column(db.Float)         # per 10 min
    contraction_duration = db.Column(db.Integer)   # seconds

    # Maternal vitals
    maternal_pulse = db.Column(db.Integer)         # bpm
    bp_systolic = db.Column(db.Integer)
    bp_diastolic = db.Column(db.Integer)
    temperature = db.Column(db.Float)              # Celsius

    # Urine
    urine_protein = db.Column(db.String(10))       # nil / + / ++ / +++
    urine_ketones = db.Column(db.String(10))       # nil / + / ++ / +++
    urine_volume = db.Column(db.Integer)           # mL

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "cervical_dilation": self.cervical_dilation,
            "head_station": self.head_station,
            "fetal_heart_rate": self.fetal_heart_rate,
            "amniotic_fluid": self.amniotic_fluid,
            "moulding": self.moulding,
            "contraction_freq": self.contraction_freq,
            "contraction_duration": self.contraction_duration,
            "maternal_pulse": self.maternal_pulse,
            "bp_systolic": self.bp_systolic,
            "bp_diastolic": self.bp_diastolic,
            "temperature": self.temperature,
            "urine_protein": self.urine_protein,
            "urine_ketones": self.urine_ketones,
            "urine_volume": self.urine_volume,
        }


class Alert(db.Model):
    __tablename__ = "alerts"
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    alert_type = db.Column(db.String(60), nullable=False)
    severity = db.Column(db.String(10), nullable=False)   # green / yellow / red
    message = db.Column(db.String(300), nullable=False)
    observation_id = db.Column(db.Integer, db.ForeignKey("observations.id"), nullable=True)
    acknowledged = db.Column(db.Boolean, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "alert_type": self.alert_type,
            "severity": self.severity,
            "message": self.message,
            "observation_id": self.observation_id,
            "acknowledged": self.acknowledged,
        }
