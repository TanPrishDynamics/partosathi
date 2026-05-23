# e-Partogram — Enterprise Healthcare SaaS Platform

> **WHO Partograph Digital System** — AI-powered labor monitoring for maternal health

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)]()
[![HIPAA Compliant](https://img.shields.io/badge/HIPAA-Compliant-green.svg)]()
[![Python 3.11](https://img.shields.io/badge/Python-3.11-blue.svg)]()
[![React 19](https://img.shields.io/badge/React-19-61DAFB.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)]()

---

## 📋 Overview

**e-Partogram** is a full-stack, enterprise-grade digital partograph system built to WHO standards. It enables real-time labor monitoring, AI-powered clinical decision support, and HIPAA-compliant patient data management for hospitals and healthcare providers.

### Key Capabilities
- 📊 **Real-time Partograph** — Digital WHO partogram with live cervical dilation, FHR, and vital sign charting
- 🤖 **AI Clinical Decision Support** — Dual LSTM models (PyTorch + TensorFlow) + Gemini LLM narrative generation
- 🎤 **Voice Input** — Speech-to-text observation entry with NLP extraction
- 👥 **Multi-Tenant RBAC** — Admin / Hospital / Doctor role hierarchy
- 🔒 **HIPAA §164.312** — Audit logging, field-level PHI encryption, IDOR protection
- 📄 **PDF Export** — Signed partogram reports for clinical records

---

## 🏗️ Architecture

```
e-partogram/
├── services/
│   ├── backend/              # Flask REST API (Python 3.11)
│   │   ├── routes/           # API route blueprints
│   │   ├── services/         # Business logic (alerts, email, PDF, CDS)
│   │   ├── ai/               # ML inference layer
│   │   │   ├── pytorch/      # PyTorch LSTM inference
│   │   │   └── tensorflow/   # TF/Keras production pipeline
│   │   ├── auth/             # Auth utilities (crypto, MFA, lockout)
│   │   ├── schemas/          # Input validation schemas
│   │   ├── middleware/       # Error handlers, RBAC, sanitization
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   └── config/           # Pydantic settings & logging
│   ├── frontend/             # Doctor-facing React 19 SPA (Vite)
│   └── admin-frontend/       # Admin panel React 19 SPA (Vite)
├── ai-engine/                # Standalone LSTM training pipeline
│   ├── src/                  # model, train, predict, preprocessing
│   ├── models/               # Saved model weights
│   └── data/                 # Training datasets & scalers
├── docker/                   # All Docker & infrastructure configs
│   ├── nginx/                # Nginx reverse proxy + TLS
│   ├── backend/              # Backend Dockerfile
│   ├── frontend/             # Frontend Dockerfile
│   └── admin-frontend/       # Admin Dockerfile
├── database/                 # SQL schema & migration scripts
├── security/                 # Security audit reports & OWASP analysis
├── docs/                     # Documentation
│   ├── architecture/         # Implementation guides & API docs
│   └── reports/              # Audit, optimization & project reports
├── tests/                    # Integration test suite
├── scripts/                  # Ops & maintenance scripts
└── docker-compose.yml        # Full production stack
```

---

## 🚀 Quick Start

### Prerequisites
- Docker 24+ & Docker Compose 2.20+
- Python 3.11+ (for local backend dev)
- Node.js 20+ (for local frontend dev)

### 1. Clone & Configure
```bash
git clone https://github.com/kushalvermaaven/E-Partogram.git
cd e-partogram
cp .env.example .env
# Fill in required secrets — see Environment Variables section below
```

### 2. Generate Required Secrets
```bash
# FIELD_ENCRYPTION_KEY (required — PHI protection)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# JWT_SECRET_KEY (min 32 chars)
python3 -c "import secrets; print(secrets.token_hex(32))"

# SECRET_KEY
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 3. Start with Docker (Recommended)
```bash
docker-compose up --build
```

Access:
- **Doctor Portal**: http://localhost (via Nginx)
- **Admin Panel**: http://localhost/admin
- **API**: http://localhost/api

### 4. Local Development
```bash
# Backend
cd services/backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
FLASK_ENV=development SEED_DEMO_DATA=1 python app.py

# Doctor Frontend (port 5173)
cd services/frontend
npm install && npm run dev

# Admin Frontend (port 5174)
cd services/admin-frontend
npm install && npm run dev
```

Or use root workspace scripts:
```bash
npm run dev:frontend   # Doctor SPA
npm run dev:admin      # Admin SPA
npm run docker:up      # Full Docker stack
```

---

## 🔐 Security Architecture

| Control | Implementation |
|---------|---------------|
| Authentication | JWT (HttpOnly cookies) + CSRF double-submit |
| Authorization | RBAC: admin / hospital / doctor |
| PHI Encryption | Fernet field-level encryption (cryptography) |
| Audit Logging | HIPAA §164.312(b) — every PHI request logged |
| Rate Limiting | Flask-Limiter (Redis-backed in production) |
| TLS | Nginx TLS termination (HSTS enabled) |
| CSRF | Flask-JWT-Extended CSRF protection (always on) |
| Input Validation | Marshmallow schemas on all write endpoints |
| IDOR Protection | Ownership checks on all patient/observation routes |
| MFA | TOTP (pyotp) for Admin accounts |
| Dependencies | OWASP dependency audit in `security/` |

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FIELD_ENCRYPTION_KEY` | **Always** | Fernet key for PHI field encryption |
| `JWT_SECRET_KEY` | **Always** | JWT signing key (min 32 chars) |
| `SECRET_KEY` | **Always** | Flask session key (min 32 chars) |
| `DATABASE_URL` | Production | PostgreSQL connection string |
| `POSTGRES_USER` | Production | DB username |
| `POSTGRES_PASSWORD` | Production | DB password |
| `POSTGRES_DB` | Production | DB name |
| `RATELIMIT_STORAGE_URI` | Production | `redis://redis:6379/0` |
| `GOOGLE_API_KEY` | Optional | Gemini AI for clinical summaries |
| `SMTP_USERNAME` | Optional | Email notifications |
| `SMTP_PASSWORD` | Optional | Email password |
| `FLASK_ENV` | Optional | `production` (default) or `development` |
| `SEED_DEMO_DATA` | Dev only | `1` to seed demo accounts |

---

## 🤖 AI Engine

### Inference (Production API)
Located at `services/backend/ai/`:
- **PyTorch LSTM** (`pytorch/`) — ColPAI model for delivery time prediction
- **TensorFlow LSTM** (`tensorflow/`) — Production Keras pipeline
- **LLM Summary** (`llm_summary.py`) — Gemini AI clinical narrative generation
- **NLP Extractor** (`nlp_extractor.py`) — spaCy voice input parsing

### Training Pipeline
Located at `ai-engine/`:
```bash
cd ai-engine
pip install -r requirements.txt
python src/train.py         # Train LSTM model
python src/predict.py       # Run predictions
streamlit run app/streamlit_app.py  # Interactive dashboard
```

---

## 🐳 Deployment

### Docker Compose (Self-hosted)
```bash
FLASK_ENV=production docker-compose up -d
```

### Railway
```bash
railway login && railway up
# Set all env vars in Railway dashboard
```

### Vercel (Frontend only)
```bash
cd services/frontend && vercel --prod
cd services/admin-frontend && vercel --prod
# Set VITE_API_BASE_URL to your API domain
```

### AWS / GCP / Azure
The Docker stack is compatible with:
- **AWS**: ECS Fargate + RDS PostgreSQL + ElastiCache Redis
- **GCP**: Cloud Run + Cloud SQL + Memorystore
- **Azure**: Container Apps + Azure Database for PostgreSQL + Azure Cache for Redis

See `docs/architecture/` for cloud-specific deployment guides.

---

## 🧪 Testing

```bash
# Top-level integration tests
cd tests
python -m pytest test_who_cases.py -v

# Backend unit tests
cd services/backend
python -m pytest tests/ -v
```

---

## 📁 Maintenance Scripts

| Script | Purpose |
|--------|---------|
| `scripts/migrate_encrypt_patient_names.py` | Encrypt existing plaintext patient names |
| `scripts/prune_expired_tokens.py` | Purge expired JWT refresh tokens |
| `scripts/seed_test_cases.py` | Seed WHO test case data |
| `scripts/update_master_log.py` | Update project activity log |
| `scripts/check_db.py` | Database health check utility |

---

## 📚 Documentation

- [`docs/architecture/`](docs/architecture/) — Implementation guides, CDS integration, WHO partograph datasets
- [`docs/reports/`](docs/reports/) — Project history, optimization reports
- [`security/`](security/) — Full OWASP analysis, HIPAA compliance report, vulnerability assessments
- [`database/MIGRATION_GUIDE.md`](database/MIGRATION_GUIDE.md) — DB migration instructions

---

## 🏥 Healthcare Compliance

This system implements controls aligned with:
- **HIPAA** §164.312 — Technical safeguards (audit logging, encryption, access controls)
- **WHO Partograph Standards** — Alert line & action line per WHO Safe Motherhood guidelines
- **OWASP Top 10** — Full remediation documented in `security/OWASP_ANALYSIS.md`

---

## 📄 License

Proprietary — TanPrish Dynamics. All rights reserved.

---

*Built with ❤️ for safer maternal healthcare worldwide.*
