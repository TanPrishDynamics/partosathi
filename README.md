# e-Partogram: Electronic Labor Monitoring System

A professional, clinical-grade digital partogram (e-Partograph) for real-time monitoring of labor progress, built with a premium **TanPrish Dynamics** aesthetic.

## 🚀 Key Features
- **WHO Standard Partograph**: Automatic plotting of cervical dilation and head station with Alert (1cm/hr) and Action lines.
- **Fetal & Maternal Monitoring**: Interactive charts for Fetal Heart Rate (FHR) and Uterine Contractions.
- **Clinical Decision Support**: Real-time rule-based alerts for fetal distress, slow progress, obstruction risk, and pre-eclampsia.
- **Premium Dashboard**: Glassmorphism UI with teal & navy color palette, built for professional medical environments.
- **PDF Reports**: Export comprehensive labor history reports with charts and clinical logs.

## 🛠️ Tech Stack
- **Frontend**: React.js, Tailwind CSS (v4), Chart.js, Lucide Icons, Framer Motion.
- **Backend**: Python Flask, SQLAlchemy, JWT Authentication.
- **Data Storage**: SQLite (local database).
- **Export**: ReportLab for dynamic PDF generation.

---

## 🏃 Getting Started

### 1. Backend Setup
```bash
cd backend
# Use the absolute path to python3 found in /opt/homebrew/bin or /usr/bin if needed
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```
*Backend will run on `http://localhost:5000`*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Frontend will run on `http://localhost:5173`*

---

## 🔑 First-time setup
Demo accounts are seeded **only** when:
- `FLASK_ENV` is NOT `production`, AND
- `SEED_DEMO_DATA=1` is set in your `.env`.

The seed password is derived from `SEED_ADMIN_PASSWORD` in your `.env` —
never hardcoded in this repo. See [`.env.example`](./.env.example) for the
required variables and [`SECURITY.md`](./SECURITY.md) for reporting issues.
The application refuses to start without a valid `FIELD_ENCRYPTION_KEY`
in every environment (dev / test / prod).

## 🏥 Clinical Alerts Implemented
- **Fetal Distress**: FHR < 110 or > 160 bpm (Red Alert)
- **Slow Progress**: Dilation rate < 1 cm/hr in active phase (Yellow Alert)
- **Obstruction Risk**: Strong contractions with no head descent (Red Alert)
- **Pre-eclampsia Risk**: High BP (>140/90) with proteinuria (Red Alert)
- **Alert Line Crossed**: Dilation plot deviates from 1cm/hr slope (Yellow Alert)
- **Action Line Crossed**: Deviation exceeds 4 hours from alert line (Red Alert)

---
Developed by **TanPrish Dynamics** — Leading Healthcare AI Innovations.
