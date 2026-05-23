# Phase-5 — Multi-Tenant Doctor-Isolation Audit Report

**Audit date:** 2026-05-23
**Branch:** `enterprise-restructure`
**Scope:** Complete review of doctor-tenant data isolation across backend, frontend, database, storage, and tests. Builds on the Phase 1–4 hardening pass documented in [HARDENING_IMPLEMENTATION_SUMMARY.md](HARDENING_IMPLEMENTATION_SUMMARY.md).

---

## TL;DR

Doctor isolation was already enforced **end-to-end** in Phase 1–4 (fail-closed ownership checks, repository layer, audit logging, no localStorage tokens). Phase 5 focuses on **tightening the rails** rather than rebuilding:

| Area | Phase 1–4 state | Phase 5 change |
|---|---|---|
| `Patient.doctor_id` | FK present but **NULL allowed** | **NOT NULL + composite indexes** (`(doctor_id, admission_time)`, `(doctor_id, status)`) |
| `AuditLog` | `user_id` only as a string | Typed `doctor_id` FK + `(doctor_id, timestamp)` index for tenant-investigation queries |
| New entity tables | Not present | `LaborRecord`, `FetalMonitoring`, `AIPrediction`, `Report`, `UploadedFile`, `Appointment`, `Prescription` — each with `doctor_id NOT NULL + index` |
| File storage | No isolation primitives | `utils/storage.py` — per-doctor path prefixes, traversal rejection, signed-URL bound to `doctor_id` |
| Frontend session leak on fast logout/login | Untested | `cancelAllRequests()` aborts in-flight axios calls at logout |
| Tenant tests | None | 17 pytest cases covering IDOR, smuggled `doctor_id`, orphan, signed-URL replay, schema regression |
| Migration tooling | One-off encrypt-names script | `scripts/tenant_isolation_migration.py` — backup + orphan-scan + reassign/quarantine + DDL enforcement |

Result: **no known cross-tenant data leak remains** under the current threat model. The detailed analysis below names every vector we considered and the control that mitigates it.

---

## 1. Before vs After — architecture comparison

### Backend ownership flow (unchanged contract, tightened guarantee)

```
        ┌─────────────────────────┐
        │ HTTP request + cookies  │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │ Flask + @jwt_required() │
        └────────────┬────────────┘
                     │  get_jwt_identity() → doctor_id (integer, signed claim)
        ┌────────────▼────────────┐
        │ Route handler           │
        └────────────┬────────────┘
                     │  doctor_id is NEVER read from request body
        ┌────────────▼────────────┐
        │ Repository layer        │  utils/repository.py
        │  - get_doctor_patients  │  filter(doctor_id == X) — no OR-NULL bypass
        │  - get_patient_…        │  fail-closed: NULL → 403
        │  - create_…             │  doctor_id always overwritten from JWT
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │ SQLAlchemy ORM          │
        │  Patient.doctor_id      │  NOT NULL + index (Phase 5)
        │  composite indexes      │  (doctor_id, admission_time / status)
        └────────────┬────────────┘
                     │
                     ▼
                 PostgreSQL / SQLite
```

### Where the prior IDOR lived (pre-Phase 1–4) vs now

| Vector | Pre-hardening | Phase 1–4 fix | Phase 5 reinforcement |
|---|---|---|---|
| `GET /api/patients` returned orphans to all doctors via `OR doctor_id IS NULL` | leak | OR-clause removed | DB constraint makes orphans impossible to create |
| Direct URL fetch of another doctor's patient | leak | `get_patient_for_doctor` ownership check | Composite index makes scoped read O(log n) |
| Direct URL fetch of another doctor's observation | leak | `get_observation_for_doctor` ownership check (transitive via patient) | (unchanged) |
| Smuggled `doctor_id` in request body | possible | `create_doctor_patient` ignores body, uses JWT | New schema regression test asserts this |
| Cross-doctor analytics aggregation | possible | All aggregates filter by `doctor_id` | Repository remains the only entry point |
| Cross-doctor file access via guessed path | not yet possible (no upload feature) | n/a | `utils/storage.resolve_doctor_path()` rejects traversal |
| Stolen signed URL replayed for another doctor | n/a | n/a | URL signature binds (doctor_id, key, expiry) — verified by test |
| Logout-then-login leakage in same tab | possible | HttpOnly cookies + page unmount via route guards | `cancelAllRequests()` aborts in-flight reads |

---

## 2. Database changes (Phase 5)

### `Patient` table

- `doctor_id` — was `nullable=True`, now `nullable=False, index=True`.
- New composite indexes:
  - `ix_patients_doctor_admission(doctor_id, admission_time)` — backs the default doctor dashboard list query.
  - `ix_patients_doctor_status(doctor_id, status)` — backs the status filter (`?status=Active`).

### `AuditLog` table

- New `doctor_id` Integer FK column (alongside the legacy `user_id` String, which is preserved for hospital/admin actors).
- New indexes:
  - `ix_audit_logs_doctor_time(doctor_id, timestamp)` — fast per-tenant incident lookups.
  - `ix_audit_logs_action_time(action, timestamp)` — fast retrieval of all `IDOR_ATTEMPT` rows.
- `action` widened to `String(20)`, `resource` to `String(120)` to fit new resource paths cleanly.

### New tenant-scoped tables

Every table has `doctor_id INTEGER NOT NULL REFERENCES doctors(id)` plus a leading composite index.

| Table | Composite index | Purpose |
|---|---|---|
| `labor_records` | `(doctor_id, patient_id)` | Per-episode admission/delivery record |
| `fetal_monitoring` | `(doctor_id, patient_id, recorded_at)` | CTG/NST trace metadata |
| `ai_predictions` | `(doctor_id, created_at)` | Persistent AI inference log, doctor-scoped |
| `reports` | `(doctor_id, report_type, created_at)` | Generated PDF/CSV exports |
| `uploaded_files` | `(doctor_id, patient_id)` | File-upload index — actual blob in `utils/storage` |
| `appointments` | `(doctor_id, scheduled_for)` | Calendar entries |
| `prescriptions` | `(doctor_id, patient_id, prescribed_at)` | Drug orders |

### Migration

`scripts/tenant_isolation_migration.py` — idempotent, runnable in three modes:

```bash
# Just report orphans (pipeline-friendly: exits 2 if any found)
python scripts/tenant_isolation_migration.py --mode report

# Bulk-reassign orphans to a known doctor (e.g. admin's personal account)
python scripts/tenant_isolation_migration.py --mode reassign --to 1

# Mark orphans Inactive (retain for audit, hide from doctor dashboards)
python scripts/tenant_isolation_migration.py --mode quarantine
```

Each invocation:
1. Backs up the SQLite DB to `<db>.bak-<UTC-timestamp>` (PostgreSQL prints a `pg_dump` command).
2. Runs `db.create_all()` so Phase-5 tables exist.
3. Adds `audit_logs.doctor_id` via `ALTER TABLE` if missing.
4. After orphans are resolved, applies `ALTER TABLE patients ALTER COLUMN doctor_id SET NOT NULL` on PostgreSQL. On SQLite the constraint is enforced at the ORM layer; the script prints the table-rebuild procedure if the DB-level constraint is also required.

---

## 3. Authentication & authorization (unchanged — already correct)

- `extract_doctor_identity` is `get_jwt_identity()` — JWT subject is the doctor's integer PK; the role claim is `"doctor"`.
- `middleware/rbac.py` exposes:
  - `@doctor_required()` — allows `doctor` and `admin`.
  - `@admin_required()` / `@hospital_required()` — strict role gates.
  - `validate_patient_ownership(patient_id)` — declarative wrapper over `get_patient_for_doctor`.
  - `inject_doctor_context` — populates `g.doctor_id`, `g.user_role`, etc., for routes that prefer the context style.
- JWT is delivered exclusively via HttpOnly cookies. CSRF double-submit is always on; refresh tokens rotate JTI on every refresh and old JTIs land in `TokenBlocklist`.

No frontend can supply `doctor_id`. The repository functions ignore it on every write path.

---

## 4. Backend route coverage

| Blueprint | File | Status |
|---|---|---|
| Patients | [backend/routes/patient_routes.py](backend/routes/patient_routes.py) | All routes call `get_patient_for_doctor` / `get_doctor_patients` |
| Observations | [backend/routes/observation_routes.py](backend/routes/observation_routes.py) | All routes call `get_patient_for_doctor` / `get_observation_for_doctor` |
| CDS / AI | [backend/routes/cds_routes.py](backend/routes/cds_routes.py) | All 5 patient-facing routes call `get_patient_for_doctor` (see in-file comments) |
| Auth | [backend/routes/auth_routes.py](backend/routes/auth_routes.py) | No patient data — only mints/revokes JWTs; logout fully unsets cookies |
| Admin | [backend/routes/admin_routes.py](backend/routes/admin_routes.py) | Admin role intentionally bypasses ownership — covered by `@admin_required()` |
| Hospital | [backend/routes/hospital_routes.py](backend/routes/hospital_routes.py) | All queries scoped via `Doctor.hospital_id == h_id` join — hospital cannot see another hospital's patients |

Routes for the new entity tables (`labor_records`, `prescriptions`, etc.) are deliberately **not** added in this audit — that is feature work. The repository contracts are in place so that adding routes later is mechanical: each handler is a 5-line shim over a repo function.

---

## 5. Frontend session isolation

- HttpOnly cookies — JS cannot read JWTs (XSS-exfiltration-proof).
- No `localStorage` / `sessionStorage` references (grep-confirmed).
- No Redux / Zustand / React-Query / SWR / module-level singletons (grep-confirmed).
- Route guards in [doctor-frontend/src/App.jsx](doctor-frontend/src/App.jsx) unmount every protected page the moment `setUser(null)` runs.
- **New (Phase 5):** [doctor-frontend/src/services/api.js](doctor-frontend/src/services/api.js) exposes `cancelAllRequests()`, called from `handleLogout` BEFORE the server invalidates the JWT. Any in-flight request that started under Doctor A's session is aborted; its response cannot land in Doctor B's React tree after a fast same-tab login switch.

---

## 6. File-storage isolation

[backend/utils/storage.py](backend/utils/storage.py) — every helper takes `doctor_id` and constructs the path itself:

```
<STORAGE_ROOT>/doctors/<doctor_id>/patients/<patient_pk>/<key>
<STORAGE_ROOT>/doctors/<doctor_id>/reports/<key>
```

Guarantees:

1. `resolve_doctor_path(doc, key)` resolves the key against the doctor's prefix and `os.path.commonpath`-asserts the result still lives under that prefix. `../etc/passwd` and absolute paths both abort 403/400.
2. `sign_doctor_url(doc, key, ttl)` produces a `(doctor_id, key, expiry)` HMAC token using a key derived from `SECRET_KEY` (NOT the JWT secret — separation of concern). The signature is HMAC-SHA256 (32 bytes) appended to the payload; NUL byte (`\x00`) is the field separator inside the payload to keep keys with dots (`.pdf`) parseable.
3. `verify_doctor_url(doc, key, token)` does constant-time HMAC compare AND verifies the embedded doctor_id matches the caller AND the expiry is in the future.

Test coverage (`tests/test_tenant_isolation.py`):
- `test_storage_rejects_path_traversal` — `..` rejected.
- `test_storage_rejects_absolute_paths` — `/etc/passwd` rejected.
- `test_storage_resolves_clean_relative_path_under_doctor_prefix` — correct prefix.
- `test_signed_url_bound_to_doctor` — token signed for doctor A does not verify for doctor B (or for a different key).
- `test_signed_url_expires` — expired token rejected.

---

## 7. Test suite

[backend/tests/test_tenant_isolation.py](backend/tests/test_tenant_isolation.py) — 17 tests, all passing:

```
test_doctor_b_cannot_list_doctor_a_patients ........................ PASS
test_doctor_b_cannot_get_doctor_a_patient_by_id .................... PASS
test_doctor_b_cannot_patch_doctor_a_patient ........................ PASS
test_doctor_b_cannot_delete_doctor_a_patient ....................... PASS
test_request_body_doctor_id_cannot_smuggle_ownership ............... PASS
test_orphan_fail_closed_path_aborts_403 ............................ PASS
test_doctor_b_cannot_read_doctor_a_observations .................... PASS
test_idor_attempt_writes_audit_log ................................. PASS
test_repository_create_patient_ignores_caller_doctor_id ............ PASS
test_repository_get_quota_isolates_per_doctor ...................... PASS
test_storage_rejects_path_traversal ................................ PASS
test_storage_rejects_absolute_paths ................................ PASS
test_storage_resolves_clean_relative_path_under_doctor_prefix ...... PASS
test_signed_url_bound_to_doctor .................................... PASS
test_signed_url_expires ............................................ PASS
test_new_tables_have_doctor_id_not_null ............................ PASS
test_repository_prescription_isolation ............................. PASS
```

Combined with the pre-existing security suite, the full backend test count is 31 passing.

Mandatory cases the user requested are all covered:

| Requested case | Test |
|---|---|
| Doctor A creates patient | `_create_patient` helper, used by every IDOR test |
| Doctor B cannot see patient (list) | `test_doctor_b_cannot_list_doctor_a_patients` |
| Doctor B cannot access patient by direct URL | `test_doctor_b_cannot_get_doctor_a_patient_by_id` |
| Doctor B cannot edit/delete Doctor A data | `test_doctor_b_cannot_patch_doctor_a_patient`, `test_doctor_b_cannot_delete_doctor_a_patient` |
| Logout/login clears previous cache | Frontend `cancelAllRequests` + route-guard unmount (no in-process cache to clear) |
| Uploaded files remain isolated | `test_storage_*` battery + `test_signed_url_bound_to_doctor` |

---

## 8. Remaining vulnerabilities & follow-ups

These are known limitations or weaker links — none of them is a known active leak, but each is worth tracking.

### Low severity

1. **SQLite cannot ALTER COLUMN NOT NULL on a live table.**
   The ORM model declares `nullable=False`, but on existing SQLite deployments the DB-level constraint isn't applied until the table is rebuilt. PostgreSQL is unaffected. Documented in the migration script.

2. **Composite index ordering.**
   We chose `(doctor_id, status)` because the doctor-id is always present in the WHERE clause and is highly selective. If your data ever becomes skewed (one doctor with 90% of patients), revisit this with `EXPLAIN ANALYZE`.

3. **Storage root permissions.**
   `utils/storage.py` writes under `<CWD>/storage` by default. In production this MUST be a path on a volume not served by nginx as a static directory — otherwise a misconfigured Nginx alias could expose the doctor prefix.

4. **`Notification.recipient_*` is not typed FK.**
   Notifications are scoped via `(recipient_type, recipient_id)` — a sane pattern, but the lack of FK means a future bug that inserts a wrong-type ID will not be caught at the DB layer. Not a leak vector under current code paths.

### Medium severity

5. **Admin role bypasses all ownership checks by design.**
   This is a feature (admins administrate the platform), but every admin route therefore must be considered HIGH privilege. The existing `@admin_required()` correctly gates all admin routes; no change needed unless you split admin into "support admin" vs "platform admin" in the future.

6. **AI predictions stored in `ai_predictions` may contain identifying inputs.**
   The schema deliberately stores `inputs_hash` (SHA-256) rather than raw inputs. If you later add an `inputs_json` column for explainability, route it through `EncryptedString` like `Patient.name`.

### Out of scope for Phase 5 (future work)

- WebSocket / SSE doctor-room isolation: none currently in use. If you add real-time alerts via Flask-SocketIO, register the doctor's room (`f"doctor_{doc_id}"`) at connect and reject any subscription to another doctor's room.
- Routes / controllers for the new entity tables — repository helpers are ready; controllers are feature work.
- Rate limiting per-doctor on the new endpoints — re-use the `_jwt_or_ip_key` keying already wired in `patient_routes.py`.

---

## 9. Sign-off checklist

| Requirement (user prompt) | Status |
|---|---|
| `doctor_id` on every patient-linked table | ✅ Existing 4 + new 7 |
| Indexes on `doctor_id` and `(patient_id, doctor_id)` | ✅ Composite indexes added |
| Prevent nullable `doctor_id` | ✅ ORM-enforced on new tables; ORM + DB-enforced on patients post-migration |
| Migrate existing data safely | ✅ `tenant_isolation_migration.py` with backup + 3 modes |
| Doctor identity extracted from JWT only | ✅ `get_jwt_identity()` — never from request body |
| Centralized middleware (requireAuth/requireDoctor/injectDoctorContext) | ✅ `middleware/rbac.py` |
| Every DB query filters by `doctor_id` | ✅ Repository is the only entry point |
| Return 403 for cross-tenant access | ✅ `get_patient_for_doctor` aborts 403, logs `IDOR_ATTEMPT` |
| Ownership validation middleware | ✅ `validate_patient_ownership`, `validate_observation_ownership` |
| Frontend cache cleared on logout | ✅ `cancelAllRequests()` + route-guard unmount |
| File storage isolation | ✅ `utils/storage.py` per-doctor prefix + traversal rejection |
| Realtime/Socket isolation | n/a — not in use |
| AI prediction history isolation | ✅ `AIPrediction.doctor_id NOT NULL`, listed only via doctor-scoped repo |
| Row-Level Security | n/a — not Supabase/Firestore; ORM filter is the equivalent |
| Global data access layer | ✅ `utils/repository.py` |
| Audit logs for unauthorized attempts | ✅ `IDOR_ATTEMPT` written from `log_unauthorized_access` |
| Rate limiting | ✅ Already wired (`patient_routes.py:42`, etc.) |
| JWT signature validation | ✅ `@jwt_required()` — Flask-JWT-Extended enforces HS256 |
| Sanitize IDs | ✅ All IDs typed as `int` from `get_jwt_identity()`; resource ids validated by Marshmallow schemas |
| Security tests | ✅ 17 new tests, 31 total passing |
| Performance — pagination, indexes, no N+1 | ✅ `get_doctor_patients` batches alerts & observation counts |
| Migration script | ✅ `tenant_isolation_migration.py` |
| Architecture diagram | ✅ §1 of this report |
| API ownership flow | ✅ §1 of this report |

---

## Appendix — files touched in Phase 5

| File | Change |
|---|---|
| `backend/models.py` | `Patient.doctor_id` NOT NULL + composite indexes; `AuditLog.doctor_id` typed FK; 7 new tenant-scoped models |
| `backend/utils/repository.py` | 17 new CRUD helpers (labor, fetal, AI, reports, uploads, appointments, prescriptions) |
| `backend/utils/storage.py` | **NEW** — per-doctor path helpers, signed-URL primitives |
| `backend/tests/test_tenant_isolation.py` | **NEW** — 17 multi-tenant tests |
| `doctor-frontend/src/services/api.js` | `cancelAllRequests()` exported; session-scoped AbortController |
| `doctor-frontend/src/App.jsx` | Calls `cancelAllRequests()` before logout |
| `scripts/tenant_isolation_migration.py` | **NEW** — orphan-scan + backup + DDL enforcement |
| `security_audit/PHASE5_TENANT_ISOLATION_REPORT.md` | **NEW** — this document |
