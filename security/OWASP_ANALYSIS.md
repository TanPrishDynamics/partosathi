# e-Partogram — OWASP Top 10 (2021) & OWASP API Top 10 (2023) Analysis

**Audit date:** 2026-05-20 · **Branch:** `final-security-hardening`

---

## 1. OWASP Top 10 (Web Application) — 2021

| Rank | Category                              | Status                  | Score (out of 10) |
|------|---------------------------------------|-------------------------|-------------------|
| A01  | Broken Access Control                 | ⚠ Partial               | 7.0 |
| A02  | Cryptographic Failures                | ❌ Critical Issues       | 4.5 |
| A03  | Injection                             | ✅ Strong                | 8.5 |
| A04  | Insecure Design                       | ⚠ Partial               | 6.5 |
| A05  | Security Misconfiguration             | ⚠ Partial               | 6.0 |
| A06  | Vulnerable & Outdated Components      | ✅ Strong                | 8.0 |
| A07  | Identification & Authentication Failures | ⚠ Partial             | 6.5 |
| A08  | Software & Data Integrity Failures    | ✅ Strong                | 8.5 |
| A09  | Logging & Monitoring Failures         | ⚠ Partial               | 6.5 |
| A10  | Server-Side Request Forgery (SSRF)    | ✅ No surface today      | 9.0 |
|      | **Weighted average**                  |                         | **7.1 / 10** |

---

### A01 — Broken Access Control (Score 7.0)

**Mitigations present**
- RBAC decorators (`middleware/rbac.py:35-54`): `@admin_required()`, `@hospital_required()`, `@doctor_required()`.
- IDOR helpers (`utils/crypto.py:35-63`): `get_patient_for_doctor()` and `get_observation_for_doctor()` invoked on every PHI route.
- `routes/cds_routes.py` explicitly notes the 5 IDOR fixes (alerts, ai/summary, export/pdf, cds/analyze-observation, cds/batch-analyze).
- Patient list (`routes/patient_routes.py:43-48`) filters by `doctor_id` for non-admins.

**Gaps**
- **H-3** User enumeration through hospital invite + signup conflict responses.
- **H-5** `recipient_id=1` hardcoded in notifications — implicit assumption admin id=1 is the only admin.
- **M-17** Hospital can attach a doctor to itself without doctor consent.
- Vertical privilege check on `acknowledge_alert` works through `get_patient_for_doctor`, but it relies on the path string `patient.patient_id` (PTH-NNN) rather than the integer id; a doctor with no patients of their own would still get a 404, which is the correct behaviour.

**Verdict:** Strong primary controls; secondary issues are enumeration and a stale hardcoded admin id.

---

### A02 — Cryptographic Failures (Score 4.5)

**Mitigations present**
- Fernet (AES-128-CBC + HMAC) field-level encryption on `Patient.name` via `EncryptedString` TypeDecorator (`models.py:36-52`).
- JWT signed with HS256, 64-char hex key required in production (`config/settings.py:79-86`).
- Scrypt password hashing via `werkzeug.security.generate_password_hash`.
- Nginx TLS 1.2/1.3 only, modern cipher suite, HSTS preload, OCSP stapling.
- Refresh-token rotation with server-side blocklist (`auth_routes.py:140-162`).

**Gaps**
- **C-1** Live secrets on dev disk in `.env`.
- **C-3** FIELD_ENCRYPTION_KEY empty → Patient.name written plaintext in dev, can leak into prod via DB migration.
- **C-4** Cookie `Secure` and HSTS gated behind `is_production` flag.
- **M-10** `process_result_value` swallows InvalidToken (silent decrypt failure).
- No KMS-backed key wrapping (FIELD_ENCRYPTION_KEY stored as plain env var).
- Other PII (Doctor.email, Hospital.email, license numbers) is plaintext — searchability vs encryption trade-off.

**Verdict:** Architecture is correct; key-management and runtime guards are weak. The C-3 + C-1 combination is the blocker for any PHI-bearing deployment.

---

### A03 — Injection (Score 8.5)

**Mitigations present**
- 100% ORM (SQLAlchemy 2.0) — no string-concatenated SQL anywhere.
- Marshmallow `validate_request()` applied on every write endpoint, including `POST /api/observation` (a previous bug — fixed and documented in `routes/observation_routes.py:42-46`).
- `EXCLUDE` unknown fields on every `Meta` block.
- Input sanitization middleware (`middleware/sanitize.py`) strips null bytes, HTML-encodes `<>&`, depth-limits recursion to 10.
- Marshmallow regex on `Patient.name` blocks `<script>` payloads.
- All schema enum fields use `validate.OneOf(...)`.

**Gaps**
- **C-2** Prompt injection in `ml/llm_summary.py` (treated separately because it isn't classic SQLi but is the modern equivalent for LLM workflows).
- **M-9** `db.text("cnt DESC")` is a static literal today, but the pattern would be dangerous if a contributor parameterised it.
- **M-4** Voice transcript has no length cap before regex extractor — CPU exhaustion vector, not injection per se.
- NoSQL: no NoSQL store, so no NoSQL injection surface.
- Command injection: no `subprocess`, `os.system`, `os.popen`, `eval`, `exec`, `pickle.load`, or `yaml.load` in the runtime code paths (verified by grep over `backend/routes`, `backend/ml`, `backend/middleware`, `backend/utils`).
- XXE: no XML parsing identified.

**Verdict:** Classical injection well-mitigated. Modern AI-prompt injection is the open issue.

---

### A04 — Insecure Design (Score 6.5)

**Mitigations present**
- Multi-tenant data model with explicit `Admin/Hospital/Doctor` separation and approval gates.
- HIPAA-aligned audit logging architecture (`AuditLog`, `AdminAction`, `ObservationHistory`).
- Token revocation by JTI blocklist is the right design (vs short-TTL only).
- Marshmallow schemas with `EXCLUDE` defaults prevent mass-assignment.
- Consent capture model (`Patient.consent_*`) baked into the schema.
- Patient quota model (`patient_limit / patients_used`) prevents resource abuse.

**Gaps**
- **C-4** Production-mode gating is a footgun design — security primitives should be on by default.
- **H-6** Demo seeding runs on every startup.
- **H-7** Silent LLM ↔ rule-based fallback hides system behaviour from clinicians.
- No threat-modelling artefact in repo (e.g. STRIDE diagram).
- No risk register / DPIA.

**Verdict:** Sound multi-tenant skeleton; production-readiness defaults are weak.

---

### A05 — Security Misconfiguration (Score 6.0)

**Mitigations present**
- Flask-Talisman: CSP, HSTS, X-Frame-Options=DENY, Referrer-Policy=strict-origin-when-cross-origin.
- Permissions-Policy header for camera/mic/geolocation/payment/sensors.
- Generic error handler (`middleware/error_handler.py`) hides stack traces.
- CORS restricted to allow-listed origins from env.
- Gunicorn slow-loris caps; request-line and field count limited.
- Postgres + Redis not exposed to host.

**Gaps**
- **C-4** Production-mode gating.
- **H-1** Memory rate limiter in multi-worker.
- **H-2** No ProxyFix.
- **M-1** CSP `style-src 'unsafe-inline'`.
- **M-11** Flask-Compress enabled → BREACH window.
- **M-16** `Permissions-Policy` missing `interest-cohort=()` / `browsing-topics=()`.
- Redis `requirepass` not set (defensible inside Docker bridge).
- No `.dockerignore` → image bloats with `__pycache__` and `venv/` artifacts (informational).

**Verdict:** Strong header hygiene; runtime guard rails (rate limiting, proxy fixup) need work.

---

### A06 — Vulnerable & Outdated Components (Score 8.0)

**Mitigations present**
- All Python deps pinned to exact versions (`backend/requirements.txt`).
- All Node deps pinned via `package-lock.json`.
- CI runs `pip-audit`, `bandit`, `flake8`, `pytest`, `npm audit --audit-level=high`, and Trivy container scan.
- Trivy fails build on Critical/High image CVEs (`unfixed` ignored).
- All pinned versions are current as of 2026-Q1 (Flask 3.1.0, SQLAlchemy 2.0.49, cryptography 44.0.2, PyMySQL 1.1.1).

**Gaps**
- **I-1** TensorFlow 2.18.0 listed but unused — unnecessary attack surface.
- No Dependabot/Renovate auto-PR cadence.
- `lstm_pipeline/requirements.txt` exists separately — not clear it's covered by the same audit job.
- No SBOM published (CycloneDX/SPDX).
- No image signature verification (cosign) in deploy.

**Verdict:** Best-in-class for an early-stage project; productionisation gaps remain.

---

### A07 — Identification & Authentication Failures (Score 6.5)

**Mitigations present**
- Scrypt hashing.
- Refresh-rotation with server-side revocation.
- Per-endpoint rate limits (login 10/min, admin-login 5/min, signup 5/min).
- Generic error message on login (`"Invalid email or password"`).
- Constant-time password comparison via `werkzeug.security.check_password_hash`.

**Gaps**
- **M-7** No MFA.
- **M-8** No per-account lockout.
- **M-6** No password rotation / history.
- **M-14** No rate limit on refresh endpoint.
- No CAPTCHA on signup.
- No HIBP-style breached-password check.

**Verdict:** Solid foundation; missing modern controls.

---

### A08 — Software & Data Integrity Failures (Score 8.5)

**Mitigations present**
- All deps pinned (no version drift).
- SHA-256 model checksum verification (`ml/inference.py:15-35`).
- ObservationHistory provides field-level audit trail (`models.py:274-298`).
- AdminAction immutable log (`models.py:348-368`).
- JWT signed; rotation pattern correct.
- No `pickle.load` / `yaml.load` of untrusted input.

**Gaps**
- No image signing (cosign) on deploy.
- No row-hash integrity (HMAC) on audit logs — a privileged DB attacker could doctor history undetectably.
- `ObservationHistory` writes are not in the same transaction as the Observation update (`observation_routes.py:117-171`) — a crash between PATCH and history write could lose audit data.

**Verdict:** Strong. Add cosign + row-HMAC for top-tier integrity.

---

### A09 — Logging & Monitoring Failures (Score 6.5)

**Mitigations present**
- Structured JSON logging in production (`config/logger.py`).
- PII scrubber filter on auth-related field names (`_PII_FIELDS` set).
- Audit-log persistence to DB on every PHI route.
- Rate-limit headers exposed to client.
- Generic 5xx errors log full traceback server-side, generic message client-side.

**Gaps**
- No SIEM/log-shipping pipeline (Datadog, Splunk, ELK, CloudWatch).
- No alerting on 5xx surge, auth-failure surge, audit-write failures.
- `print()` still present in `app.py:313` and `ml/llm_summary.py:59`.
- IP recorded in audit log is the proxy IP (H-2).
- No log retention/purge policy (M-18).

**Verdict:** Good in-process discipline; ops integration missing.

---

### A10 — Server-Side Request Forgery (Score 9.0)

**Surface analysis**
- No user-supplied URL fetching.
- LLM call is to a fixed Google endpoint inside `google-generativeai` SDK.
- No webhook callbacks.
- No image / PDF / XML fetcher.
- No URL preview / proxy / image-proxy.

**Risk:** Effectively zero today. If SMS / WhatsApp / EHR webhooks are added, re-audit this row.

**Verdict:** Strong by construction.

---

## 2. OWASP API Top 10 (2023)

| Rank   | Category                                       | Status   | Score |
|--------|------------------------------------------------|----------|-------|
| API1   | Broken Object Level Authorization (BOLA)       | ⚠ Partial | 7.0 |
| API2   | Broken Authentication                          | ⚠ Partial | 6.5 |
| API3   | Broken Object Property Level Authorization     | ✅ Strong | 8.5 |
| API4   | Unrestricted Resource Consumption              | ⚠ Partial | 6.0 |
| API5   | Broken Function Level Authorization (BFLA)     | ✅ Strong | 8.5 |
| API6   | Unrestricted Access to Sensitive Business Flows| ⚠ Partial | 6.0 |
| API7   | Server-Side Request Forgery (SSRF)             | ✅ No surface | 9.0 |
| API8   | Security Misconfiguration                      | ⚠ Partial | 6.0 |
| API9   | Improper Inventory Management                  | ⚠ Partial | 6.5 |
| API10  | Unsafe Consumption of APIs                     | ⚠ Partial | 5.5 |

**API1 / BOLA** — Mitigated by `get_patient_for_doctor` on PHI routes; H-3 user enumeration partially leaks data.

**API2 / Broken Authentication** — Strong JWT design; no MFA (M-7), no lockout (M-8), no refresh-endpoint rate-limit (M-14).

**API3 / Broken Object Property Level** — `EXCLUDE` unknown fields + explicit assignment after validation prevents mass-assignment cleanly.

**API4 / Unrestricted Resource Consumption** — Patient list paginates and caps at 200; voice transcript uncapped (M-4); memory-store limiter risks bypass (H-1); audit-log growth unbounded (M-18).

**API5 / BFLA** — `@admin_required`, `@hospital_required`, `@doctor_required` cleanly partition function access.

**API6 / Sensitive Business Flows** — Doctor signup is rate-limited (5/min) and admin-approval-gated. Hospital invite leaks existence (H-3). Credit-request flow lacks proof-of-work / CAPTCHA.

**API7 / SSRF** — No surface (see A10 above).

**API8 / Security Misconfiguration** — See A05 above.

**API9 / Improper Inventory Management** — Two predict-delivery versions (`/api/cds/predict-delivery/*` and `/api/v2/cds/predict-delivery/*`) coexist; no deprecation policy. No public OpenAPI spec to reason about exposed endpoints.

**API10 / Unsafe Consumption of APIs** — Gemini API consumed without:
- Output schema validation (C-2).
- Timeout configuration (LLM call can block worker thread until provider times out).
- Retry / circuit breaker.
- Disclosed BAA / Data Processing Addendum.

---

## 3. OWASP Mobile / LLM Top 10 (Bonus)

Because this platform uses Gemini, the **OWASP LLM Top 10 (2025)** applies:

| Rank   | Category                          | Status      |
|--------|-----------------------------------|-------------|
| LLM01  | Prompt Injection                  | ❌ Critical (C-2) |
| LLM02  | Insecure Output Handling          | ❌ High (silent fallback, no schema enforce) |
| LLM03  | Training Data Poisoning           | n/a (using foundation model) |
| LLM04  | Model Denial of Service           | ⚠ Partial (no timeout) |
| LLM05  | Supply Chain Vulnerabilities      | ✅ Strong (pinned `google-generativeai`) |
| LLM06  | Sensitive Information Disclosure  | ❌ High (PHI sent to LLM without BAA disclosure) |
| LLM07  | Insecure Plugin Design            | n/a |
| LLM08  | Excessive Agency                  | ⚠ Partial (LLM output displayed as clinical guidance) |
| LLM09  | Overreliance                      | ⚠ Partial (no UI flag for AI-vs-rule output) |
| LLM10  | Model Theft                       | n/a (foundation model) |

**LLM01 + LLM02 + LLM06 + LLM09 should be remediated together** before this platform handles a single real patient.

---

## 4. Summary Matrix

```
                          ┌─────────────────────────────────┐
                          │      OWASP Coverage Heatmap     │
                          ├──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┤
                          │A1│A2│A3│A4│A5│A6│A7│A8│A9│10│  │
                          ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
                          │ ⚠│ ❌│ ✅│ ⚠│ ⚠│ ✅│ ⚠│ ✅│ ⚠│ ✅│  │
                          └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
                            ✅ = Strong   ⚠ = Partial   ❌ = Issues
```

**Composite OWASP score: 7.1 / 10** — solid foundation with three Critical issues blocking enterprise sign-off (A02, plus the LLM-related issues that span A04/A09/LLM01-09).
