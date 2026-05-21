# e-Partogram — Architecture Diagram, Attack Surface, and Risk Heatmap

**Audit date:** 2026-05-20

---

## 1. System Architecture (security overlay)

```
                            ┌────────────────────────────────────────────┐
                            │            Internet (untrusted)            │
                            └───────────────────┬────────────────────────┘
                                                │ 443 (TLS 1.2 / 1.3)
                                                ▼
                            ┌────────────────────────────────────────────┐
                            │   Nginx 1.27-alpine — TLS terminator       │
                            │                                            │
                            │   ▸ HSTS (max-age=1y; preload)             │
                            │   ▸ HTTP→HTTPS 301 redirect                │
                            │   ▸ X-Frame: DENY, X-CT: nosniff           │
                            │   ▸ Referrer-Policy, Permissions-Policy    │
                            │   ▸ TLS 1.2/1.3 + modern ciphers           │
                            │   ▸ OCSP stapling                          │
                            │   ▸ client_max_body_size 512k              │
                            │                                            │
                            │   ✗  Self-signed cert by default (M)       │
                            │   ✗  Should add WAF (CRS rules)            │
                            └─────────┬───────────────────────┬──────────┘
                                      │                       │
                          /api/* ─────┘                       └───── /* (frontend)
                                      ▼                       ▼
                  ┌───────────────────────────────────┐  ┌────────────────────────┐
                  │  Flask 3.1.0 + Gunicorn (Docker)  │  │ React 19 SPA (Vite 8)  │
                  │                                   │  │                        │
                  │  ▸ Talisman (CSP, HSTS, headers)  │  │ ▸ HttpOnly cookie only │
                  │  ▸ Flask-Limiter (Redis-backed)   │  │ ▸ Axios withCredentials│
                  │  ▸ Flask-Compress (BREACH risk!)  │  │ ▸ Silent refresh queue │
                  │  ▸ Flask-JWT-Extended (cookies)   │  │ ▸ No localStorage      │
                  │  ▸ Marshmallow validation         │  │ ▸ Build: drop_console  │
                  │  ▸ Sanitize middleware            │  │                        │
                  │  ▸ RBAC + IDOR helpers            │  │ ✗ Hardcoded admin URL  │
                  │  ▸ Audit-log writer (after_req)   │  │                        │
                  │  ▸ scrypt password hashing        │  └────────────────────────┘
                  │                                   │
                  │  ✗ No ProxyFix → IP fidelity lost │
                  │  ✗ Prod-gated CSRF/Secure cookies │
                  │  ✗ LLM prompt-injection vector    │
                  └───────┬─────────┬─────────────────┘
                          │         │
                          │         └──────────────────────────┐
                          ▼                                    ▼
        ┌──────────────────────────────────┐    ┌────────────────────────────────┐
        │   PostgreSQL 16-alpine           │    │   Redis 7-alpine               │
        │                                  │    │                                │
        │   ▸ Bridge network only          │    │   ▸ Bridge network only        │
        │   ▸ Cascade delete (GDPR)        │    │   ▸ Ephemeral (no persistence) │
        │   ▸ ORM-only (no raw SQL)        │    │   ▸ Rate-limit counters        │
        │   ▸ Indexes on audit / blocklist │    │                                │
        │                                  │    │   ✗ No `requirepass`           │
        │   ✗ FIELD_ENCRYPTION_KEY missing │    │      (defensible inside bridge)│
        │      → PHI plaintext at rest     │    │                                │
        │   ✗ No backup encryption SOP     │    └────────────────────────────────┘
        │   ✗ No row-HMAC integrity        │
        └──────────────────────────────────┘
                          │
                          ▼
        ┌──────────────────────────────────┐    ┌────────────────────────────────┐
        │  LSTM model (.pth) on disk       │    │  Google Gemini API (external)  │
        │                                  │    │                                │
        │  ▸ SHA-256 checksum verification │    │  ✗ PHI sent in plaintext (!)   │
        │  ▸ Output bounding (0-24h, 0-2)  │    │  ✗ No BAA disclosed            │
        │  ▸ Currently mocked              │    │  ✗ Prompt injection vector     │
        │                                  │    │  ✗ Silent rule-based fallback  │
        └──────────────────────────────────┘    └────────────────────────────────┘
```

Legend: ▸ = control present · ✗ = gap or risk · (M) = medium-risk · (H) = high · (C) = critical.

---

## 2. Trust Boundaries

| # | Boundary                              | What crosses it                       | Controls               |
|---|---------------------------------------|---------------------------------------|------------------------|
| 1 | Internet ↔ Nginx                      | HTTPS, JWT cookies                    | TLS 1.2/1.3, HSTS, rate caps |
| 2 | Nginx ↔ Flask                         | HTTP (internal), forwarded headers    | Bridge network isolation; should add ProxyFix (H-2) |
| 3 | Flask ↔ Postgres                      | SQL (ORM)                             | Bridge network; no host exposure; not encrypted on wire (mitigated by network isolation) |
| 4 | Flask ↔ Redis                         | RESP                                  | Bridge network; no auth (defensible inside) |
| 5 | Flask ↔ Gemini (Internet)             | HTTPS + PHI in prompt                 | **Insufficient** — C-2, LLM06 |
| 6 | Doctor browser ↔ Patient data         | JSON API responses                    | RBAC + IDOR enforced |
| 7 | Admin browser ↔ Doctor accounts       | Approve/reject, credit grants         | Admin RBAC + AdminAction audit |
| 8 | Hospital browser ↔ Doctor invite      | Email match                           | **User enumeration** (H-3) |
| 9 | Filesystem ↔ Audio temp files         | Decoded user audio (PHI-derived)      | `tempfile.delete=False`; race window (M-5) |

---

## 3. Authentication & Session Flow

```
Login (POST /api/auth/login)
       │
       │  Body: { email, password }
       ▼
   Marshmallow LoginSchema validate
       │
       ▼
   Doctor.query.filter_by(email=...).first()
       │
       │  scrypt verify_password (constant-time)
       ▼
   Status gate: pending/rejected/inactive?
       │
       ▼
   create_access_token (15 min) + create_refresh_token (7 d)
       │
       ▼
   set_access_cookies (HttpOnly, Secure-in-prod, SameSite=Lax)
   set_refresh_cookies (same)
       │
       ▼  every API call carries both cookies (withCredentials=true)
       ▼
   401 on expired access → frontend interceptor → POST /api/auth/refresh
       │
       ▼  blocklist old refresh JTI, mint new pair  (rotation)
       ▼
   Logout → blocklist access JTI + unset cookies

Token revocation table (TokenBlocklist):
   ✓ checked on every authenticated request via @token_in_blocklist_loader
   ✗ no purge job → grows unbounded (M-18)
```

---

## 4. Attack Surface Inventory

### 4.1 Externally-reachable endpoints (Nginx → Flask)

| Path | Auth required | Limit (per IP) | Notes |
|------|---------------|----------------|-------|
| `POST /api/auth/login` | no | 10/min, 30/hr | brute-force vector |
| `POST /api/auth/admin-login` | no | 5/min, 20/hr | privileged target |
| `POST /api/auth/hospital-login` | no | 10/min, 30/hr | brute-force vector |
| `POST /api/auth/signup/doctor` | no | 5/min, 20/hr | spam + enumeration |
| `POST /api/auth/signup/hospital` | no | 5/min, 10/hr | spam + enumeration |
| `POST /api/auth/refresh` | refresh cookie | none (M-14) | cookie replay |
| `POST /api/auth/logout` | access cookie | none | safe |
| `GET /api/auth/me` | access cookie | default | safe |
| `GET /api/health` | no | default | safe |
| `GET /api/patients` | doctor/admin | 60/min/user | PHI list |
| `POST /api/patient` | doctor | default | PHI write |
| `GET/PATCH /api/patient/<id>` | doctor (IDOR) | default | PHI |
| `POST /api/observation` | doctor (IDOR) | default | PHI write |
| `GET /api/observations/<patient_id>` | doctor (IDOR) | 120/min/user | PHI read |
| `PATCH /api/observation/<int:id>` | doctor (IDOR) | default | PHI write with history |
| `DELETE /api/observation/<int:id>` | doctor (IDOR) | default | PHI delete |
| `GET /api/alerts/<patient_id>` | doctor (IDOR) | default | PHI |
| `PATCH /api/alerts/<int:id>/acknowledge` | doctor (IDOR) | default | PHI |
| `GET /api/ai/summary/<patient_id>` | doctor (IDOR) | default | LLM call (C-2) |
| `GET /api/export/pdf/<patient_id>` | doctor (IDOR) | default | PHI export |
| `POST /api/cds/analyze-observation` | doctor (IDOR) | default | derived PHI |
| `POST /api/cds/batch-analyze` | doctor (IDOR) | default | derived PHI |
| `GET /api/cds/predict-delivery/<id>` | doctor (IDOR) | default | ML inference |
| `GET /api/v2/cds/predict-delivery/<id>` | doctor (IDOR) | default | ML inference |
| `POST /api/cds/voice-input` | doctor | default | audio + transcript |
| `POST /api/cds/extract-text` | doctor | default | transcript |
| `GET /api/doctor/quota` | doctor | default | self-data |
| `GET /api/doctor/analytics` | doctor | default | self-data |
| `POST /api/credits/request` | doctor/hospital | default | workflow |
| `GET /api/credits/my-requests` | doctor/hospital | default | workflow |
| `GET /api/admin/*` (multiple) | admin | default | admin-only |
| `POST /api/admin/approve-user` | admin | default | admin-only |
| `POST /api/admin/reject-user` | admin | default | admin-only |
| `GET/POST /api/admin/credit-requests*` | admin | default | admin-only |
| `GET /api/admin/notifications*` | admin | default | admin-only |
| `GET /api/admin/analytics` | admin | default | admin-only |
| `GET /api/hospital/*` (multiple) | hospital | default | tenant-scoped |
| `POST /api/hospital/doctors/invite` | hospital | default | **enumeration (H-3)** |

### 4.2 Externally-reachable static surface

- `/` → React SPA served by Vite/Nginx. Google Fonts loaded over HTTPS without SRI.
- `/admin` (separate port 5175 in dev, separate Vite app) → admin SPA.

### 4.3 Outbound surface

- Gemini API (PHI sent today — C-2, LLM06).
- Gmail SMTP (transactional email; App Password stored in env).
- Google Fonts (CDN; not user-identifiable).

### 4.4 Internal-only surface (Docker bridge)

- Postgres `database:5432`.
- Redis `redis:6379`.

---

## 5. STRIDE Threat Model (per component)

### Flask backend

| Threat                  | Mitigation today | Gap |
|-------------------------|------------------|-----|
| **S**poofing            | JWT + cookies + scrypt | No MFA (M-7) |
| **T**ampering           | Marshmallow + audit log + ORM | No row-HMAC |
| **R**epudiation         | AuditLog + ObservationHistory | IP wrong (H-2) |
| **I**nformation disclosure | Generic 5xx + RBAC + IDOR | LLM leakage (C-2), PHI plaintext (C-3) |
| **D**enial of service   | Rate limiter + payload cap | Memory storage (H-1) |
| **E**levation of privilege | Strict RBAC + IDOR helpers | None notable |

### Database

| Threat | Mitigation | Gap |
|--------|------------|-----|
| **S** | Docker bridge isolation | No mTLS |
| **T** | ORM-only writes | No row signatures |
| **R** | AuditLog | Privileged-DB attacker can edit |
| **I** | Network isolation, intended encryption | C-3 |
| **D** | Healthcheck restarts | No replica/backup automation |
| **E** | Postgres role separation absent | Single app role |

### LLM call

| Threat | Mitigation | Gap |
|--------|------------|-----|
| **S** | API key | Key on disk (C-1) |
| **T** | – | Prompt injection (C-2) |
| **R** | – | No request log |
| **I** | – | PHI sent without BAA |
| **D** | – | No timeout / circuit breaker |
| **E** | – | LLM cannot escalate, but its output influences clinician decisions |

---

## 6. Risk Heatmap (Likelihood × Impact)

```
                 ┌─────── LIKELIHOOD ───────────────────┐
                 │ Low   Medium  High   Very-High      │
       ┌─────────┼──────────────────────────────────────┤
       │ Severe  │              C-3    C-1, C-2        │ ← Catastrophic if realised
       │ Major   │       H-7   H-4    H-1, C-4         │
IMPACT │ Moderate│ M-9   M-1   M-7   H-2, M-8, M-3, M-4│
       │ Minor   │ L-4   L-7   L-5                      │
       │ Trivial │ I-2   I-4                            │
       └─────────┴──────────────────────────────────────┘
```

---

## 7. Top 5 Attack Scenarios

1. **Secret leak → full takeover.** A developer's laptop is lost or its disk is scanned. Attacker reads `.env`, forges JWTs with the recovered `JWT_SECRET_KEY`, impersonates admin, exfiltrates all patient data.
2. **LLM prompt injection → false clinical guidance.** Approved doctor submits an observation whose alert message contains a hidden instruction; the AI summary shown to a colleague advises the wrong intervention. Patient-safety incident.
3. **CSRF in misconfigured production.** Deploy team forgets `FLASK_ENV=production`. SameSite=Lax + no CSRF token + cross-site form auto-submits state-changing POST as the logged-in doctor.
4. **PHI breach via DB backup.** Backup of Postgres taken; FIELD_ENCRYPTION_KEY was empty when patients were created; backup contains patient names in plaintext; backup is uploaded to a misconfigured S3 bucket.
5. **Brute-force admin login behind Nginx.** Without ProxyFix and with memory-store limiter, all login attempts share one bucket per worker × workers; attacker uses 10 IPs to multiply the effective rate by 90×.

---

## 8. Defence-in-Depth Score (per layer)

| Layer | Score | Comment |
|-------|-------|---------|
| Network (TLS, segmentation) | 80 | Strong inside Docker; add WAF + mTLS |
| Edge (Nginx) | 78 | Modern config; needs real cert + WAF |
| Application (Flask) | 75 | Solid controls; production-gating is fragile |
| Identity (JWT, scrypt) | 70 | Add MFA + lockout |
| Data (encryption, ORM) | 60 | Blocked by C-3 |
| Logging / Observability | 65 | Local good, ops absent |
| Supply chain | 82 | Strong CI gates |
| AI / LLM | 42 | Open critical |

**Composite defence-in-depth: 68 / 100** — matches the overall security score.

---

## 9. What "100/100" Would Look Like

- Zero secrets on developer disks. Vault/secrets-manager-only.
- KMS-wrapped Fernet keys with rotation policy.
- Vertex AI Gemini in HIPAA-eligible region under BAA, or in-house deterministic summary only.
- MFA mandatory for all admins and clinicians.
- WAF in front of Nginx with OWASP CRS + custom rules.
- mTLS between Flask ↔ Postgres ↔ Redis.
- SIEM ingest + PagerDuty for 5xx surge / auth surge.
- Quarterly external pentest + annual HIPAA Security Risk Assessment.
- SBOM published per release + cosign signatures.
- Annual disaster-recovery exercise.
