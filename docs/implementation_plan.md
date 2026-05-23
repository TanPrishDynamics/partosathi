# E-Partogram: Complete Production-Ready Web Application

A full-stack electronic partogram (e-Partograph) system for monitoring labor progress, styled to the TanPrish Dynamics premium brand aesthetic (teal & navy, glassmorphism, dark-themed).

---

## Architecture Overview

```
e partogram/
├── backend/
│   ├── app.py               # Flask main app + API routes
│   ├── models.py            # SQLAlchemy models (Patient, Observation, Alert)
│   ├── alerts.py            # Clinical decision support engine
│   ├── pdf_export.py        # PDF generation (WeasyPrint)
│   ├── requirements.txt
│   └── partogram.db         # SQLite database (auto-created)
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css        # Global design system (TanPrish brand)
│   │   ├── components/
│   │   │   ├── PatientForm.jsx       # Patient registration
│   │   │   ├── ObservationForm.jsx   # Labor data entry
│   │   │   ├── PartographChart.jsx   # Main WHO partograph chart (Chart.js)
│   │   │   ├── FHRChart.jsx          # Fetal heart rate trend chart
│   │   │   ├── ContractionChart.jsx  # Contractions bar chart
│   │   │   ├── AlertsPanel.jsx       # Color-coded clinical alerts
│   │   │   ├── PatientSummary.jsx    # Patient header card
│   │   │   ├── ObservationsTable.jsx # Tabular vitals display
│   │   │   ├── LoginPage.jsx         # Doctor login
│   │   │   └── Sidebar.jsx           # Navigation sidebar
│   │   └── pages/
│   │       ├── Dashboard.jsx         # Main monitoring dashboard
│   │       ├── PatientList.jsx       # All patients list
│   │       └── NewPatient.jsx        # New patient registration
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## Proposed Changes

### Backend (Flask + SQLAlchemy + SQLite)

#### [NEW] backend/app.py
Main Flask application with CORS, all API endpoints, and auth.

**Endpoints:**
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Doctor login |
| POST | `/api/patient` | Register new patient |
| GET | `/api/patients` | List all patients |
| GET | `/api/patient/{id}` | Get patient details |
| POST | `/api/observation` | Add labor observation |
| GET | `/api/observations/{patient_id}` | Get all observations |
| GET | `/api/alerts/{patient_id}` | Get clinical alerts |
| GET | `/api/export/pdf/{patient_id}` | Export partogram as PDF |

#### [NEW] backend/models.py
SQLAlchemy models:
- **Doctor**: id, name, email, password_hash, license_number
- **Patient**: id, patient_id, name, age, gravida, parity, gestational_age, admission_time, doctor_id
- **Observation**: id, patient_id, timestamp, cervical_dilation, fetal_heart_rate, contraction_freq, contraction_duration, head_station, amniotic_fluid, moulding, maternal_pulse, bp_systolic, bp_diastolic, temperature, urine_protein, urine_ketones, urine_volume
- **Alert**: id, patient_id, timestamp, alert_type, severity, message

#### [NEW] backend/alerts.py
Clinical Decision Support Engine with rules:
- FHR < 110 or > 160 → **RED** "Fetal Distress"
- Cervical dilation rate < 1 cm/hr → **YELLOW** "Slow Progress of Labor"
- Dilation plot crosses alert line → **YELLOW** warning
- Dilation plot crosses action line → **RED** "URGENT: Action Required"
- Strong contractions (≥4/10min, ≥45s) + no head descent → **RED** "Possible Obstruction"
- BP ≥ 140/90 + urine protein → **RED** "Risk of Pre-eclampsia"
- BP ≥ 130/80 → **YELLOW** "Elevated Blood Pressure – Monitor"
- Temp > 38°C → **YELLOW** "Maternal Fever"
- Meconium-stained fluid → **YELLOW** "Meconium-Stained Amniotic Fluid"

#### [NEW] backend/requirements.txt
```
flask==3.1.0
flask-cors==5.0.0
flask-sqlalchemy==3.1.1
flask-jwt-extended==4.7.1
werkzeug==3.1.3
reportlab==4.2.5
```

---

### Frontend (React + Vite + Tailwind CSS)

#### [NEW] frontend/src/index.css
TanPrish Dynamics design system:
- **Primary**: Teal (`#00C9A7` → `#006D77`)
- **Background**: Deep navy (`#0A0F1E`, `#0D1B2A`)
- **Glassmorphism** cards with `backdrop-filter: blur`
- **Font**: Poppins (headings), Inter (body)
- **Animations**: Smooth transitions, pulse effects for alerts

#### [NEW] frontend/src/components/PartographChart.jsx
Main WHO partograph using **Chart.js** (react-chartjs-2):
- X-axis: Time (hours from admission)
- Y-axis Left: Cervical dilation (0–10 cm)
- Y-axis Right: Head station (-5 to +5)
- **Lines plotted**:
  - 🔵 Cervical dilation curve (actual)
  - 🟠 Alert Line (1 cm/hr from 4cm at active phase start)
  - 🔴 Action Line (4 hours right of alert line)
  - 🟢 Head descent markers
- Dual-axis chart with gradient fills

#### [NEW] frontend/src/components/FHRChart.jsx
Line chart for fetal heart rate with:
- Normal range shading (110–160 bpm)
- Red highlight when out of range

#### [NEW] frontend/src/components/ContractionChart.jsx
Bar chart showing contraction frequency and duration over time.

#### [NEW] frontend/src/components/AlertsPanel.jsx
Real-time alerts with:
- 🟢 Green: Normal
- 🟡 Yellow: Warning  
- 🔴 Red: Critical (pulsing animation)

---

## Medical Standards Applied

This implementation uses the **traditional WHO partogram** (as requested in the spec):
- Alert line: 1 cm/hr slope starting at active phase (4 cm dilation)
- Action line: 4 hours to the right of the alert line
- Active phase: from 4 cm dilation onward
- FHR normal range: 110–160 bpm

> **Note**: The 2020 WHO Labour Care Guide superseded this, but the traditional format is still widely used clinically and is what the spec requires.

---

## Verification Plan

### Automated
1. Backend: `flask run` — verify all API endpoints return correct JSON
2. Frontend: `npm run dev` — verify UI renders in browser
3. Chart: Add dummy observations and verify graph updates

### Manual
- Register a new patient → verify patient appears in list
- Add multiple observations over time → verify partograph chart plots correctly
- Trigger each alert condition → verify correct color + message appears
- Test export PDF download
- Test login/logout flow

---

## Installation Plan

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```
