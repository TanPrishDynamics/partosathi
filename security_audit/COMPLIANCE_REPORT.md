# e-Partogram — Compliance Report

**Audit date:** 2026-05-20 · **Branch:** `final-security-hardening`
**Frameworks evaluated:** HIPAA (US), GDPR (EU), DPDP Act 2023 (India), SOC 2 Type II readiness, ISO/IEC 27001 readiness.

---

## 1. Executive Summary

The e-Partogram codebase demonstrates **deliberate HIPAA/GDPR engineering intent**: encryption columns, audit logging, consent capture, and immutable history tables exist. However, **three issues block compliance certification**:

1. PHI is currently written **unencrypted** to the database because `FIELD_ENCRYPTION_KEY` is empty.
2. PHI is **shipped to Google Gemini** in plaintext for clinical summary generation, without a disclosed Business Associate Agreement (BAA).
3. Production security primitives (CSRF, Secure cookies, HSTS) are **conditionally enabled** behind `FLASK_ENV=production`, creating a deploy footgun.

Once C-1 through C-4 from the Vulnerability Report are remediated and Google Cloud BAA is signed, the platform can plausibly attain HIPAA Technical Safeguards alignment within ~30 days.

---

## 2. HIPAA Compliance Matrix (45 CFR §164.308–§164.312)

### Administrative Safeguards (§164.308) — *out of scope for code audit*

These require organisational policies (sanction policy, workforce training, BAAs). Recommend separate Administrative Compliance Review.

### Physical Safeguards (§164.310) — *out of scope for code audit*

Data centre / facility controls. AWS/GCP/Azure shared-responsibility model when migrated to cloud.

### Technical Safeguards (§164.312) — *fully in scope*

| Control | Requirement | Status | Evidence | Gap |
|---------|-------------|--------|----------|-----|
| §164.312(a)(1) | Access control — unique user identification, emergency access, automatic logoff, encryption | ⚠ Partial | RBAC, IDOR helpers, JWT identity | Auto-logoff not enforced client-side; encryption blocked (C-3) |
| §164.312(a)(2)(i) | Unique user identification | ✅ Pass | Distinct `Admin`/`Doctor`/`Hospital` tables, JWT identity | none |
| §164.312(a)(2)(ii) | Emergency access procedure | ⚠ Partial | Admin role can act on any patient | No documented break-glass procedure |
| §164.312(a)(2)(iii) | Automatic logoff | ❌ Fail | `IDLE_TIMEOUT_MINUTES=30` defined but no client enforcement | Wire idle timer that calls `/api/auth/logout` |
| §164.312(a)(2)(iv) | Encryption & decryption | ❌ Fail | `EncryptedString` TypeDecorator + Fernet | `FIELD_ENCRYPTION_KEY` empty → silent no-op (C-3) |
| §164.312(b) | Audit controls | ✅ Pass | `AuditLog` writes on every PHI route (`app.py:155-180`) | Audit log retention policy missing |
| §164.312(c)(1) | Integrity controls | ⚠ Partial | `ObservationHistory` field-level audit | No HMAC row signatures; audit can be doctored by privileged DB users |
| §164.312(c)(2) | Mechanism to authenticate ePHI | ⚠ Partial | Generic 5xx handler hides corruption | Add explicit checksum on PHI tables |
| §164.312(d) | Person/entity authentication | ❌ Fail | Scrypt + JWT only; no MFA | Add TOTP for admins (M-7) |
| §164.312(e)(1) | Transmission security | ⚠ Partial | Nginx TLS 1.2/1.3 + HSTS | Only when `is_production=true` (C-4) |
| §164.312(e)(2)(i) | Integrity controls (in-transit) | ✅ Pass | HMAC inside TLS | none |
| §164.312(e)(2)(ii) | Encryption (in-transit) | ⚠ Partial | TLS 1.2/1.3 | Gated on prod flag (C-4) |

**HIPAA Technical Safeguards readiness: 7 / 12 passes (58%) — NOT certifiable today.**

**Breach Notification (§164.400-414)**: No incident-response runbook in repo.

---

## 3. HIPAA Business Associate Status

Google Gemini API (`google-generativeai 0.8.5`) receives PHI today:
- Patient `gravida`, `parity`, last 3 observations (which include vitals tied to a patient identifier in context).

For Gemini to be a permitted business associate, the organisation must:

1. Execute a **BAA with Google Cloud** (`https://cloud.google.com/security/compliance/hipaa-compliance/`).
2. Use only **Vertex AI Gemini APIs in a HIPAA-eligible region** (not the public Gemini API). The current SDK `google-generativeai` calls the **public Generative Language API**, which is **NOT BAA-covered** as of audit date.
3. Disable model training on customer data (Vertex AI default).
4. Disclose the LLM-processing step in the consent flow.

**Until BAA is in place: stop sending PHI to Gemini, or switch to a deterministic rule-based summary path only.**

---

## 4. GDPR Compliance Matrix (Articles 5, 6, 25, 32, 33, 17, 20)

| Article | Requirement | Status | Evidence | Gap |
|---------|-------------|--------|----------|-----|
| Art. 5(1)(a) | Lawful, fair, transparent processing | ⚠ Partial | Consent captured | No privacy notice text in repo |
| Art. 5(1)(b) | Purpose limitation | ✅ Pass | Data used only for clinical monitoring | none |
| Art. 5(1)(c) | Data minimisation | ✅ Pass | Only clinical fields collected; no demographics beyond age | none |
| Art. 5(1)(d) | Accuracy | ✅ Pass | PATCH endpoints allow correction; history tracked | none |
| Art. 5(1)(e) | Storage limitation | ❌ Fail | No retention policy / purge job | Add patient-data lifecycle policy |
| Art. 5(1)(f) | Integrity & confidentiality | ⚠ Partial | TLS + (intended) encryption-at-rest | C-3 blocks |
| Art. 6 | Lawful basis | ⚠ Partial | `consent_method` captured (`Patient.consent_*`) | No record of basis for legitimate interests |
| Art. 17 | Right to erasure | ✅ Pass | Cascade delete `Patient → Observation/Alert` | none |
| Art. 20 | Right to data portability | ❌ Fail | No self-service export endpoint | Add `/api/patient/{id}/export.json` for the data subject |
| Art. 25 | Data protection by design & by default | ⚠ Partial | Pseudonymisation via `patient_id`; encryption pattern in place | C-3 + C-4 weaken posture |
| Art. 32 | Security of processing | ⚠ Partial | TLS, scrypt, audit logs | C-1, C-3, M-7, M-8 outstanding |
| Art. 33 | Breach notification | ❌ Fail | No incident-response plan in repo | Add runbook + 72-hour notification template |
| Art. 44+ | International transfers (e.g. Gemini → US) | ❌ Fail | No SCC, no transfer impact assessment | Required before processing real PHI |

**GDPR readiness: 5 / 12 passes (42%) — NOT certifiable today.**

---

## 5. DPDP Act 2023 (India)

| Section | Requirement | Status | Notes |
|---------|-------------|--------|-------|
| §6 Notice & Consent | Notice in clear language, explicit consent | ⚠ Partial | `consent_obtained` + `consent_method` recorded; notice text not in repo |
| §8(4) Reasonable security safeguards | "Adequate" technical & organisational measures | ⚠ Partial | Strong baseline; blocked by C-1/C-3 |
| §8(7) Breach notification to Data Protection Board | Timely notification | ❌ Fail | No runbook |
| §9 Children's data | Verified parental consent for minors | ⚠ Partial | PatientSchema enforces age ≥10 (`validators.py:57`); explicit parental-consent flow needed if patients <18 |
| §11 Right to access info | Self-service access | ❌ Fail | Same gap as GDPR Art. 20 |
| §17 Significant Data Fiduciary | DPIA, DPO, audits | ⚠ Partial | Likely classification given PHI volume |

**DPDP readiness: 3 / 6 passes (50%).**

---

## 6. SOC 2 Type II Readiness (Trust Services Criteria)

| TSC | Status | Gap |
|-----|--------|-----|
| CC1 Control Environment | ⚠ | No security org chart, no policies in repo |
| CC2 Communication | ⚠ | No SECURITY.md, no incident-response email |
| CC3 Risk Assessment | ❌ | No risk register, no DPIA |
| CC4 Monitoring | ⚠ | Audit logs exist; SIEM hook missing |
| CC5 Control Activities | ✅ | Multiple control implementations in code |
| CC6 Logical & Physical Access | ⚠ | RBAC strong; MFA missing |
| CC7 System Operations | ⚠ | Healthchecks present; no runbooks |
| CC8 Change Management | ✅ | CI pipeline + branch hygiene |
| CC9 Risk Mitigation | ⚠ | No BCP/DR plan |
| A1 Availability | ⚠ | No SLO/SLA defined |
| C1 Confidentiality | ⚠ | Blocked by C-3 |
| P1-P8 Privacy | ⚠ | Strong consent capture; missing privacy notice, retention, subject-access flow |

**SOC 2 readiness: 35% — would need ~6 months of policy + monitoring work to be Type II auditable.**

---

## 7. ISO/IEC 27001:2022 Readiness

| Annex A clause | Status |
|----------------|--------|
| A.5 Organisational controls (37 controls) | 20% — only the technical sub-controls present in code |
| A.6 People controls (8 controls) | 0% — out of scope of repo |
| A.7 Physical controls (14 controls) | 0% — out of scope of repo |
| A.8 Technological controls (34 controls) | 55% — encryption, logging, auth implemented; key mgmt and DLP missing |

**ISO 27001 readiness: ~25%** — significant policy and Annex A.5/A.6 work required.

---

## 8. Privacy-by-Design Review (Cavoukian's 7 Foundational Principles)

| Principle | Status | Evidence |
|-----------|--------|----------|
| 1. Proactive not reactive | ✅ | Audit log + history models built from day one |
| 2. Privacy as default setting | ⚠ | Production flags off by default (C-4) |
| 3. Privacy embedded into design | ⚠ | Encryption pattern in place but conditional |
| 4. Full functionality (positive-sum) | ✅ | Security controls do not break UX |
| 5. End-to-end security | ⚠ | TLS + (intended) encryption-at-rest; LLM call leaks PHI |
| 6. Visibility & transparency | ⚠ | No public privacy notice; no AI/rule-based disclosure (H-7) |
| 7. Respect for user privacy | ⚠ | Consent captured; data-subject self-service missing |

---

## 9. Audit Logging Compliance Coverage

**Current audit-log coverage** (`backend/app.py:56-64`):

```python
_AUDIT_PREFIXES = (
    "/api/patient",
    "/api/observation",
    "/api/alerts",
    "/api/ai/summary",
    "/api/export",
    "/api/auth/login",
    "/api/auth/admin-login",
)
```

**Missing from audit**:
- `/api/auth/refresh` — refresh actions are not logged.
- `/api/auth/logout` — logout actions are not logged.
- `/api/auth/signup/*` — signups are not logged.
- `/api/admin/approve-user` / `reject-user` — already in `AdminAction` table, but not in `AuditLog`.
- `/api/cds/voice-input` — voice transcripts touch PHI but route is not prefixed.

**Fix:** Either extend `_AUDIT_PREFIXES` or unify audit ingestion through a decorator.

---

## 10. Consent Workflow Review

`Patient` model captures `consent_obtained`, `consent_date`, `consent_method` (`models.py:199-201`).
`POST /api/patient` refuses to create a patient if consent is not set (`routes/patient_routes.py:103-104`).

**Gaps:**
- Consent text is not versioned. If the consent form changes, you cannot prove which version a patient accepted.
- No granular consent — patient cannot opt into "share with AI summary" separately from "store record".
- No record of who *captured* the consent (clinician id).
- Withdrawal: no endpoint to revoke consent and trigger deletion / pseudonymisation.

**Fix:**
```python
class Consent(db.Model):
    patient_id = db.Column(...)
    document_version = db.Column(db.String(32))
    scopes = db.Column(db.JSON)  # ["store", "ai_summary", "research"]
    captured_by_doctor_id = db.Column(db.Integer)
    captured_at = db.Column(db.DateTime)
    withdrawn_at = db.Column(db.DateTime, nullable=True)
```

---

## 11. Data-Subject Rights (GDPR Art. 15-22) — Implementation Status

| Right | Status | Endpoint needed |
|-------|--------|-----------------|
| Right of access (Art. 15) | ❌ Missing | `GET /api/patient-self/me` (authenticated patient) |
| Right to rectification (Art. 16) | ⚠ Doctor-only | `PATCH /api/patient/{id}` exists, patient-side missing |
| Right to erasure (Art. 17) | ⚠ Doctor-only | Cascade delete works; patient-initiated missing |
| Right to restriction (Art. 18) | ❌ Missing | Add `Patient.processing_restricted` flag |
| Right to portability (Art. 20) | ❌ Missing | `GET /api/patient/{id}/export?format=json` |
| Right to object (Art. 21) | ❌ Missing | Tied to consent withdrawal |
| Automated decision-making (Art. 22) | ⚠ Partial | LLM summary is "advisory" but UI doesn't disclose this |

---

## 12. Compliance Roadmap

| Phase | Goal | Effort |
|-------|------|--------|
| **Week 1-2** | Fix C-1, C-3, C-4 → unblock HIPAA Technical Safeguards | 2 engineer-weeks |
| **Week 3-4** | Sign Google Cloud BAA, migrate to Vertex AI in HIPAA-eligible region, OR remove LLM call entirely | 1 engineer-week + Legal |
| **Week 5-6** | Add MFA (M-7), per-account lockout (M-8), client-side idle logoff | 1 engineer-week |
| **Week 7-8** | Build data-subject self-service portal (access + erasure + portability) | 2 engineer-weeks |
| **Week 9-10** | DPIA + privacy notice + consent versioning + retention SOP | 1 engineer-week + Privacy Counsel |
| **Week 11-12** | SIEM integration, incident-response runbook, breach-notification templates | 1 engineer-week + SecOps |
| **Month 4-6** | SOC 2 Type II readiness program (policies, evidence collection, auditor engagement) | External SOC 2 consultancy |

---

## 13. Compliance Scorecard

```
┌─────────────────────────────────────────────────┐
│ HIPAA Technical Safeguards   58 / 100  ⚠ Medium │
│ GDPR (EU)                    42 / 100  ❌ High   │
│ DPDP Act (India)             50 / 100  ⚠ Medium │
│ SOC 2 Type II Readiness      35 / 100  ❌ High   │
│ ISO 27001 Readiness          25 / 100  ❌ High   │
│ Privacy-by-Design (7 PbD)    50 / 100  ⚠ Medium │
└─────────────────────────────────────────────────┘
```

**Overall compliance score: 43 / 100 — NOT certifiable today.**

After roadmap completion: target **80 / 100** within 6 months.
