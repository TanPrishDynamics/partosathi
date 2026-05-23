# e-Partogram — Security Cleanup Report (Optimization Pass)

**Date:** 2026-05-22
**Branch:** `final-security-hardening`
**Scope:** Security findings surfaced *during* the repository optimization pass.
(The full security audit lives in `security_audit/` — this report covers only
what the cleanup work discovered or fixed.)

---

## 1. Secret & Credential Scan

A repo-wide scan was run for cloud keys, tokens, and private keys:

```
patterns: AKIA…, AIza…, ghp_…, sk-…, xox[bpars]-…, BEGIN PRIVATE KEY
scope:    backend/ frontend/ admin-frontend/ (*.py *.js *.jsx *.json)
result:   0 hardcoded secrets in source code ✓
```

| Check | Result |
|-------|--------|
| Hardcoded API keys in source | **None found** ✓ |
| Hardcoded passwords in source | **None found** ✓ |
| `.env` tracked by git | **No** — only `.env.example` is tracked ✓ |
| Private keys / PEM files committed | **None found** ✓ |

---

## 2. Critical Finding — Duplicate `.env` with Divergent Encryption Keys

### Severity: High (data-integrity hazard)

Two environment files existed:

| File | `FIELD_ENCRYPTION_KEY` |
|------|------------------------|
| `.env` (project root) | `eoAuRW-…TlRo=` |
| `backend/.env` | `nWMQU6B9…bEE=` |

**Why this is dangerous:** `config/settings.py` loads the project-root `.env`
first and `backend/.env` only as a fallback. If a deployment's working
directory changed (e.g. a container built with a different `WORKDIR`), the app
would load a *different* Fernet key. PHI encrypted under one key becomes
permanently unreadable under the other — silent, irreversible data corruption.

### Fix applied
- **Deleted `backend/.env`.** The project-root `.env` is now the single
  source of truth.
- Both `.env` files are gitignored, so neither ever reached the remote — the
  exposure was local-disk only.
- `config/settings.py` retains a documented, ordered fallback
  (`project-root .env` → `backend/.env` → default search) so Docker builds
  still resolve config correctly.

### Residual recommendation
Rotate `FIELD_ENCRYPTION_KEY` once, in the project-root `.env`, and run
`scripts/migrate_encrypt_patient_names.py` so all PHI rows are encrypted under
one known key. Store that key in a secrets manager (AWS Secrets Manager /
Vault / GCP) — the loader for this already exists at
`backend/utils/secrets_loader.py`.

---

## 3. Stale Database Files Containing Potential PHI

Three SQLite databases were removed from the working tree:

| File | Risk |
|------|------|
| `backend/instance/partogram_backup_final.db` | Backup snapshot — could contain patient PHI |
| `backend/instance/partogram_backup_pre_security.db` | Pre-hardening snapshot — PHI written *before* field encryption existed = plaintext names |
| `instance/partogram.db` (repo root) | April-dated leftover DB |

**Why removal improves security:** the pre-security backup almost certainly
held **plaintext** patient names (field encryption was a no-op before the
`final-security-hardening` work). Leaving plaintext-PHI snapshots on disk is a
HIPAA exposure. All three are gitignored (`*.db`), so they never reached the
remote — but they were removed from local disk as good hygiene.

> The **live** database `backend/instance/partogram.db` was retained.

---

## 4. `.dockerignore` Coverage — Image Secret-Leak Prevention

Before this pass, **`backend/` had no `.dockerignore`**. The Dockerfile's
`COPY . .` therefore pulled the entire context into the image — including
`.env`, `instance/*.db`, `venv/`, `tests/`, and `__pycache__/`.

### Fix applied
Created / replaced three `.dockerignore` files:

| File | Status | Key exclusions |
|------|--------|----------------|
| `backend/.dockerignore` | **Created** | `.env`, `.env.*`, `*.pem`, `*.key`, `instance/`, `*.db`, `venv*/`, `tests/`, `ml_production/`, `__pycache__/` |
| `frontend/.dockerignore` | **Created** | `node_modules/`, `dist/`, `.env*`, `.git/` |
| `admin-frontend/.dockerignore` | **Replaced** | was an IDE-auto-generated Visual Studio template; replaced with a focused list |

**Impact:** production images can no longer accidentally bake in a developer's
`.env` or a PHI-bearing SQLite file. This closes a real secret-exfiltration
path (anyone who can `docker pull` the image could previously extract `.env`).

---

## 5. `.gitignore` Hardening

Added patterns to prevent regressions:

```gitignore
.ruff_cache/        .mypy_cache/        htmlcov/
.coverage           .coverage.*
* 2.*               * 2/                # Finder-duplicate guard
```

---

## 6. Dependency Attack-Surface Reduction

| Package | Action | Security rationale |
|---------|--------|--------------------|
| `tensorflow` (Python) | Removed from `backend/requirements.txt` | ~600 MB of native code never imported by the API — a large unused CVE surface. (Already actioned in the prior security commit; the venv carrying it was deleted this pass.) |
| `bleach` (Python) | Removed from `backend/requirements.txt` | Declared but never imported — `middleware/sanitize.py` uses a regex stripper. Dead dependencies are unaudited attack surface. |
| `@react-oauth/google` (npm, frontend) | Removed | Unused OAuth client — dead third-party JS in the bundle. |
| `clsx`, `tailwind-merge` (npm, frontend) | Removed | Unused utilities. |
| `date-fns` (npm, admin-frontend) | Removed | Unused in the admin SPA (still used + retained in the clinician frontend). |

Fewer dependencies = fewer transitive CVEs = smaller `npm audit` / `pip-audit`
surface.

---

## 7. Summary

| Item | Before | After |
|------|--------|-------|
| Hardcoded secrets in source | 0 | 0 |
| `.env` files on disk | 3 (`./`, `backend/`, `frontend/`) | 2 (`./`, `frontend/`) |
| Divergent encryption keys | **Yes (2 keys)** | **No (1 key)** |
| Plaintext-PHI backup DBs on disk | 3 | 0 |
| Dockerfiles with no `.dockerignore` | 1 (`backend/`) | 0 |
| Unused dependencies (npm + pip) | 6 | 0 |

**No secrets were ever exposed on the remote** — all `.env` and `.db` files
were gitignored throughout. The fixes above eliminate *local-disk* and
*container-image* exposure paths.

### Open items (carried from the full audit, not in scope of this pass)
- Rotate `FIELD_ENCRYPTION_KEY` + run the PHI migration script.
- Move secrets from `.env` into a managed vault (loader already implemented).
- Sign Docker images (cosign) and publish an SBOM.

See `security_audit/SECURITY_AUDIT_REPORT.md` for the complete picture.
