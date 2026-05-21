# e-Partogram — Security Scorecard

**Audit date:** 2026-05-20  •  **Branch:** `final-security-hardening`

---

## Top-Line Score

```
╔══════════════════════════════════════════════════════════╗
║                  OVERALL SECURITY SCORE                  ║
║                                                          ║
║                       68 / 100                           ║
║                                                          ║
║              Risk Level:  MEDIUM-HIGH                    ║
║              Maturity:    L2 — Repeatable                ║
║                                                          ║
║  Production-Ready: NO (3 Critical findings open)         ║
╚══════════════════════════════════════════════════════════╝
```

---

## Domain Scorecard

| #  | Domain                          | Score | Grade | Risk        | Trend |
|----|---------------------------------|-------|-------|-------------|-------|
| 1  | Authentication                  | 72    | B-    | Medium      | ▲ improving |
| 2  | API Security                    | 70    | C+    | Medium      | ▲ improving |
| 3  | Backend                         | 74    | B-    | Medium      | ▲ improving |
| 4  | Frontend                        | 78    | B     | Medium      | ▶ stable |
| 5  | Database                        | 64    | C     | Medium-High | ▼ blocked by C-3 |
| 6  | Infrastructure (Docker/Nginx)   | 73    | B-    | Medium      | ▶ stable |
| 7  | DevSecOps / CI-CD               | 71    | C+    | Medium      | ▲ improving |
| 8  | Cloud                           | 55    | D     | High        | — n/a (no IaC) |
| 9  | AI / ML                         | 42    | F     | High        | ▼ critical |
| 10 | Secret Hygiene                  | 38    | F     | Critical    | ▼ critical |
| 11 | HIPAA Posture                   | 60    | C-    | Medium-High | ▼ blocked |
| 12 | GDPR / DPDP Posture             | 66    | C     | Medium      | ▶ stable |
| 13 | Logging & Monitoring            | 65    | C     | Medium      | ▲ improving |
| 14 | Dependency Management           | 82    | B+    | Low         | ▲ improving |
| 15 | Scalability under Security Load | 70    | C+    | Medium      | ▶ stable |

---

## Score Breakdown — How Each Domain Was Graded

### Authentication — 72 / 100
- (+) HttpOnly JWT cookies, scrypt hashing, refresh-token rotation, server-side revocation: **+45**
- (+) Rate-limited login (10/min) and admin-login (5/min): **+10**
- (+) Status gates (pending/rejected/inactive) enforced: **+8**
- (+) Marshmallow validation on auth schemas: **+5**
- (+) Pre-load email normalization + length caps: **+4**
- (–) No MFA / 2FA: **–8**
- (–) No account lockout per-user: **–5**
- (–) No password rotation/history/breached-password check: **–3**
- (–) Login schema permits 1-character password (`min=1`) — only signup enforces complexity: **–3**

### API Security — 70 / 100
- (+) Marshmallow on every write endpoint, EXCLUDE unknown fields: **+15**
- (+) IDOR enforced via `get_patient_for_doctor()`: **+15**
- (+) RBAC decorators (`@admin_required`, `@hospital_required`): **+10**
- (+) Per-endpoint rate limits via Flask-Limiter: **+10**
- (+) HIPAA audit hook on all PHI routes: **+8**
- (+) Generic 5xx error handler (no stack traces leaked): **+5**
- (+) CORS restricted to env-driven origin list: **+5**
- (+) Request body capped at 512 KB: **+2**
- (–) `db.text("cnt DESC")` in admin analytics — safe today but pattern is risky: **–2**
- (–) Two parallel API versions for predict-delivery, no deprecation policy: **–3**
- (–) ProxyFix missing → rate limits and audit IPs broken behind Nginx: **–5**
- (–) Memory-store rate limiter risks multi-worker bypass: **–5**

### Backend — 74 / 100
- (+) Application factory, blueprints, lazy ML init: **+10**
- (+) Pydantic-settings startup validation: **+10**
- (+) Centralised error handler — no stack traces in responses: **+10**
- (+) Sanitization middleware on JSON bodies: **+10**
- (+) Logger with PII scrubber + JSON output: **+10**
- (+) Idempotent schema migrations: **+5**
- (+) Audit-trail design (3 separate tables): **+10**
- (–) `_seed_demo_data` runs on every boot: **–6**
- (–) `print()` statements in seed and LLM modules: **–2**
- (–) Migration failures silently swallowed (`except: pass`): **–3**

### Frontend — 78 / 100
- (+) Zero `localStorage` token usage — relies on HttpOnly cookies: **+25**
- (+) Axios `withCredentials=true`, central response interceptor: **+10**
- (+) Silent refresh + queue + redirect-on-failure pattern: **+10**
- (+) No `dangerouslySetInnerHTML` / `eval` / `new Function` in app code: **+15**
- (+) Vite production build drops `console.*`, mangles top-level identifiers: **+10**
- (+) No client-side secrets (only `VITE_API_BASE_URL`): **+8**
- (–) Admin portal URL hardcoded to `http://localhost:5175`: **–2**
- (–) Bleeding-edge React 19.2 / Vite 8.0 — minor supply-chain risk: **–2**

### Database — 64 / 100
- (+) ORM-only queries; no SQL string concatenation: **+15**
- (+) Indexes on hot paths (audit, blocklist, notifications, patient.doctor_id): **+10**
- (+) Cascade-delete supports GDPR erasure: **+8**
- (+) Field-level encryption pattern correctly placed at column type: **+15**
- (+) Postgres not exposed to host port: **+8**
- (+) Audit + observation history immutable tables: **+8**
- (–) **FIELD_ENCRYPTION_KEY missing → Patient.name plaintext today**: **–20**
- (–) No backup encryption or retention SOP: **–8**
- (–) No row-hash integrity for tamper detection: **–4**
- (–) Multiple `partogram_backup_*.db` files in dev instance dir: **–3**

### Infrastructure — 73 / 100
- (+) Non-root container user; world-write removed: **+15**
- (+) Healthcheck endpoint configured: **+5**
- (+) Nginx hardened (TLS 1.2/1.3, modern ciphers, HSTS, OCSP, no session tickets): **+20**
- (+) `client_max_body_size` matches Flask cap: **+5**
- (+) Docker bridge network — DB/Redis not host-exposed: **+10**
- (+) Gunicorn slow-loris caps (`limit_request_line`, `limit_request_fields`): **+8**
- (+) `restart: unless-stopped` on all services: **+5**
- (–) No multi-stage Docker build (image larger than necessary): **–3**
- (–) Redis has no `requirepass` (defensible inside Docker bridge, would be Critical if exposed): **–3**
- (–) No image signing (cosign) or SBOM: **–4**
- (–) No runtime monitoring (Falco/sysdig): **–3**

### DevSecOps — 71 / 100
- (+) GitHub Actions workflow runs `pip-audit`, `bandit`, `flake8`, `pytest`, `npm audit`, `trivy`: **+30**
- (+) Reports uploaded as workflow artifacts with 30-day retention: **+5**
- (+) Trivy fails build on Critical/High: **+10**
- (+) Bandit runs at high severity/confidence (build-failing): **+8**
- (–) No CodeQL / Semgrep / dependency review action: **–5**
- (–) No required reviewers / branch-protection captured here: **–3**
- (–) Test coverage low — only `test_who_cases.py`: **–8**
- (–) No DAST / IAST: **–6**

### Cloud — 55 / 100
- (+) docker-compose with isolated bridge network: **+10**
- (+) Secrets via env-file: **+10**
- (+) HSTS / TLS termination at edge: **+10**
- (+) Production posture documented: **+5**
- (+) Healthchecks for DB/Redis: **+5**
- (+) Redis ephemeral memory only: **+5**
- (+) Volumes named (not bind-mounted): **+5**
- (+) No public ports beyond 80/443: **+5**
- (–) **No IaC / k8s manifests / Terraform**: **–10**
- (–) No KMS / cloud secrets manager: **–10**

### AI / ML — 42 / 100
- (+) SHA-256 model integrity check on disk (`ml/inference.py:15-35`): **+15**
- (+) Output bounding (delivery hours 0–24, risk class 0–2): **+10**
- (+) `bypass_torch` flag isolates a failing import — defensive: **+5**
- (+) Rule-based fallback exists for LLM unavailability: **+10**
- (+) Gemini API key sourced from env: **+5**
- (+) Pinned ML versions: **+5**
- (–) **Prompt injection via patient/observation/alert data → Gemini (C-2)**: **–25**
- (–) Fallback fires only on exception, not on schema-invalid LLM output: **–8**
- (–) Patient data sent to third-party LLM with no BAA disclosed: **–10**
- (–) `tensorflow` listed but not used — unnecessary attack surface: **–5**
- (–) `print()` used for LLM errors: **–2**

### Secret Hygiene — 38 / 100
- (+) `.env` in `.gitignore` and not tracked by git history: **+15**
- (+) `pydantic-settings` validates and refuses startup when secrets weak (in prod): **+10**
- (+) `.env.example` template provides clear placeholders: **+5**
- (+) PII scrubber redacts auth headers in logs: **+8**
- (–) **Live secrets on dev disk: real JWT_SECRET_KEY, SECRET_KEY, GOOGLE_API_KEY (C-1)**: **–25**
- (–) Default seed password `ChangeMe#2026` shipped: **–10**
- (–) `FIELD_ENCRYPTION_KEY` empty in working .env: **–8**
- (–) README still lists default `admin@hospital.com / admin123`: **–7**

### HIPAA Posture — 60 / 100
- (+) Audit log on PHI routes (§164.312(b)): **+15**
- (+) Field-level PHI encryption pattern (§164.312(a)(2)(iv)): **+15** (degraded by C-3)
- (+) Unique user IDs across Admin/Doctor/Hospital (§164.312(a)(2)(i)): **+10**
- (+) Consent capture (`Patient.consent_*`): **+8**
- (+) Field-level change history (§164.312(c)(1)): **+8**
- (+) Generic error responses, no PHI leakage in errors: **+5**
- (–) Encryption-at-rest blocked by C-3: **–15**
- (–) No MFA (§164.312(d) weak): **–8**
- (–) Auto-logoff defined but not enforced client-side: **–5**
- (–) No BAA disclosure with Gemini provider: **–6**

### GDPR / DPDP — 66 / 100
- (+) Consent recorded with method and timestamp: **+15**
- (+) Right to erasure supported via cascade-delete: **+10**
- (+) PII scrubbed from logs: **+10**
- (+) Data-minimisation: only clinical fields collected: **+10**
- (+) Audit log retains processing trail: **+8**
- (+) CORS restricted to allow-list: **+5**
- (+) Transmission encryption (TLS 1.2/1.3 in nginx): **+8**
- (–) No data-subject self-service export: **–10**
- (–) Cross-border transfer (Gemini → US) not disclosed in consent flow: **–10**
- (–) No retention/purge job for `AuditLog`: **–5**

### Logging & Monitoring — 65 / 100
- (+) Structured JSON logging in production: **+15**
- (+) PII scrubber removes password/token/secret keys: **+15**
- (+) Audit log persists to DB with status_code and IP: **+10**
- (+) Generic 5xx handler logs full traceback server-side only: **+8**
- (+) Limiter emits `X-RateLimit-*` headers: **+5**
- (–) No SIEM hook, no alerting on 5xx surge or auth-failure surge: **–15**
- (–) `print()` still present in some paths: **–3**
- (–) IP address recorded is proxy IP (no ProxyFix): **–8**
- (–) No log rotation / shipping policy: **–7**

### Dependency Management — 82 / 100
- (+) All Python deps pinned to exact versions: **+25**
- (+) CI runs `pip-audit`, `npm audit`, Trivy on every push to main: **+25**
- (+) Trivy gates merges on Critical/High image CVEs: **+15**
- (+) `requirements.txt` annotated with purpose: **+5**
- (+) Pinned versions current as of 2026-Q1: **+10**
- (–) `tensorflow` listed but unused — unnecessary footprint: **–5**
- (–) No Dependabot/Renovate auto-PR cadence: **–8**
- (–) No `pip-audit` for `lstm_pipeline/` separate requirements file: **–5**

### Scalability ↔ Security — 70 / 100
- (+) Refresh-rotation pattern doesn't increase auth latency (single DB lookup): **+10**
- (+) Marshmallow validation O(1) per request: **+5**
- (+) Talisman headers added in-process — no extra hop: **+5**
- (+) Fernet decryption fast (~50µs) for Patient reads: **+5**
- (+) Audit log writes can be deferred to a queue: **+5**
- (+) Gunicorn workers tuned to CPU count: **+5**
- (+) Redis-backed rate limiter horizontally scalable: **+5**
- (+) Pagination supported on patient list: **+5**
- (+) Compress middleware reduces bandwidth: **+5**
- (–) Audit-log write in `after_request` blocks the response on slow DB: **–5**
- (–) `_refresh_patient_alerts` is O(n) delete-and-rebuild — degrades for long admissions: **–5**

---

## Risk Heatmap

```
                  ┌─────── LIKELIHOOD ───────┐
                  │ Low  Medium  High  Very-H │
       ┌──────────┼───────────────────────────┤
       │ Critical │           C-3   C-1  C-2 │ ← Critical
IMPACT │ High     │       H-7  H-4  H-1  C-4 │
       │ Medium   │  M-9  M-1  M-7  M-8  H-2 │
       │ Low      │  L-4  L-7  L-5            │
       └──────────┴───────────────────────────┘
```

**Hot zones**
- **Top-right (Critical × Very-High likelihood):** C-1 secrets leak, C-2 LLM injection.
- **Critical × High likelihood:** C-3 PHI plaintext at rest.
- **High × Very-High:** C-4 production-mode misconfig.

---

## Security Maturity Chart

```
Level 5 — Optimising      │
Level 4 — Quantitatively  │
Level 3 — Defined         │
Level 2 — Repeatable      │  ████████████ ◄ e-Partogram (today)
Level 1 — Initial         │
Level 0 — Ad-hoc          │

Target after roadmap: Level 3 (Defined) within 60 days,
                      Level 4 (Quantitatively-Managed) within 6 months.
```

---

## What Would Move the Score to ≥85?

| Action                                       | +pts |
|----------------------------------------------|------|
| Rotate secrets + secrets-manager integration | +6   |
| Fix LLM prompt injection (C-2)               | +5   |
| Generate FIELD_ENCRYPTION_KEY + migrate     | +5   |
| Invert FLASK_ENV default                     | +3   |
| Add MFA for admin + doctor                   | +3   |
| Add ProxyFix + mandatory Redis limiter       | +2   |
| Replace TF dep with nothing (unused)         | +1   |
| SIEM hook + 5xx alerting                     | +2   |
| Cosign + SBOM in CI                          | +1   |
| **Total swing**                              | **+28 → ~96 / 100** |
