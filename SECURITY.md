# Security Policy — e-Partogram

This document describes how to report security vulnerabilities and what to expect from the maintainers.

---

## Reporting a Vulnerability

**Do not file public GitHub issues for security vulnerabilities.**

Email **security@tanprish-dynamics.com** with:
- Affected component (backend / admin-frontend / clinician-frontend / infra / ML pipeline).
- Reproduction steps.
- Impact assessment (data exposure / privilege escalation / denial of service / ...).
- Suggested remediation if you have one.

You may encrypt the report with our PGP key (`security-pgp.asc` published at the project root once available).

### Response targets

| Severity      | Acknowledgement | Triage         | Patch                |
|---------------|-----------------|----------------|----------------------|
| Critical      | 24 hours        | 48 hours       | 7 days               |
| High          | 48 hours        | 5 business days| 30 days              |
| Medium / Low  | 5 business days | 15 business days| 90 days             |

Coordinated disclosure: we ask that you withhold public disclosure for at least **90 days** or until a fix is released, whichever is sooner. We will credit reporters in release notes unless they prefer to remain anonymous.

---

## Scope

In scope:
- `backend/` (Flask API)
- `frontend/` (clinician React SPA)
- `admin-frontend/` (admin React SPA)
- `database/`, `nginx/`, `docker-compose.yml`
- `scripts/` (operational tooling)
- `.github/workflows/` (CI / supply chain)
- Released ML model artefacts in `backend/ml/`

Out of scope:
- Denial-of-Service attacks against shared infrastructure
- Social engineering / phishing of staff
- Physical attacks on data centres
- Third-party SaaS providers (Google Gemini, SMTP relay, AWS, GCP)
- Vulnerabilities requiring rooted client devices or browser extensions

---

## Supported Versions

Security fixes are applied to the `main` branch and the latest tagged release. Older releases are unsupported.

---

## Security Controls in Place

| Class             | Control                                                                            |
|-------------------|------------------------------------------------------------------------------------|
| Authentication    | HttpOnly cookie JWT, scrypt password hashing, 15-min access + 7-day refresh-rotation, MFA (TOTP) for admins, per-account login lockout, IP-based rate limiting |
| Session           | SameSite=Strict cookies, Secure cookies in production, server-side JTI revocation  |
| Authorization     | Role-based access control + IDOR ownership checks on every PHI route               |
| Input             | Marshmallow schema validation on all writes, HTML-encoding sanitiser, payload caps |
| Data at rest      | Fernet field-level encryption on PHI columns (Patient.name) — fail-closed          |
| Data in transit   | TLS 1.2/1.3 only, HSTS preload, strict cipher suites                               |
| Browser           | CSP, X-Frame-Options=DENY, Referrer-Policy, Permissions-Policy with FLoC opt-out   |
| Logging           | Structured JSON logs with PII scrubber, HIPAA §164.312(b) audit log                |
| LLM               | System/user prompt separation, Pydantic output schema, deterministic fallback      |
| Supply chain      | All deps pinned, CI runs pip-audit + bandit + npm audit + Trivy + Dependabot       |
| Infrastructure    | Non-root containers, Docker bridge isolation, ProxyFix-aware audit IPs             |

See `security_audit/SECURITY_AUDIT_REPORT.md` for the full audit and `security_audit/REMEDIATION_GUIDE.md` for engineer-ready fix recipes.

---

## Reporting Suspected Breach

If you believe an active compromise is in progress, additionally page **secops@tanprish-dynamics.com** with subject `BREACH SUSPECTED — e-Partogram` for 24/7 escalation.

---

*This file is reviewed at every major release.*
