"""
backend/tests/test_tenant_isolation.py
======================================
Phase-5 multi-tenant isolation tests.

Every test in this module simulates two doctors (A, B) operating against the
same backend and verifies that Doctor B can NEVER read, mutate, or enumerate
Doctor A's data. The tests target known IDOR / cache / signed-URL vectors:

  * patient enumeration via list endpoint
  * direct URL access by string patient_id
  * mutation (PATCH / DELETE) cross-tenant
  * observation access via the patient relation
  * orphan (doctor_id IS NULL) — fail-closed to ALL doctors
  * file-storage path traversal (..) and prefix escape
  * signed-URL replay across doctors

Conventions:
  - Uses the `isolated_app` fixture from conftest.py (fresh in-memory DB).
  - Doctors are CSRF-double-submit-protected, so write tests echo
    `csrf_access_token` as X-CSRF-TOKEN.
"""
from __future__ import annotations

import pytest


# ── Helpers ──────────────────────────────────────────────────────────────────

def _create_doctor(db, email: str, status: str = "approved"):
    """Insert an approved doctor with a generous patient limit. Returns the
    Doctor instance after a flush — call .commit() afterwards."""
    from models import Doctor
    from utils.crypto import hash_password
    d = Doctor(
        name=f"Dr {email.split('@')[0]}",
        email=email,
        password_hash=hash_password("ValidPw1!StrongValue"),
        status=status,
        patient_limit=10,
        patients_used=0,
    )
    db.session.add(d)
    db.session.flush()
    return d


def _login(client, email: str, password: str = "ValidPw1!StrongValue"):
    """Log in as a doctor; the test client stores the resulting cookies."""
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.get_json()
    return resp


def _csrf(client) -> dict:
    """Return the X-CSRF-TOKEN header derived from the access cookie."""
    # Flask 3+: client.get_cookie returns a Cookie object or None.
    # The cookie name is set by Flask-JWT-Extended; default is csrf_access_token.
    try:
        cookie = client.get_cookie("csrf_access_token")
    except TypeError:
        # Older Flask: get_cookie requires (server_name, key).
        cookie = client.get_cookie("localhost", "csrf_access_token")
    if cookie is None:
        return {}
    return {"X-CSRF-TOKEN": cookie.value}


def _create_patient(client, name: str = "Jane Doe"):
    """Create a patient via POST /api/patient — returns the response JSON."""
    body = {
        "name": name,
        "age": 30,
        "gravida": 1,
        "parity": 0,
        "gestational_age": 38,
        "consent_obtained": True,
        "consent_method": "digital",
    }
    resp = client.post("/api/patient", json=body, headers=_csrf(client))
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


def _logout(client):
    client.post("/api/auth/logout", headers=_csrf(client))


# ── Test cases ───────────────────────────────────────────────────────────────


def test_doctor_b_cannot_list_doctor_a_patients(isolated_app):
    """Mandatory case: Doctor A creates patient → Doctor B's list must be empty."""
    app, db = isolated_app
    _create_doctor(db, "a@example.com")
    _create_doctor(db, "b@example.com")
    db.session.commit()

    client_a = app.test_client()
    _login(client_a, "a@example.com")
    pa = _create_patient(client_a, name="Alice Patient")
    assert pa.get("patient_id"), "create returned no patient_id"

    client_b = app.test_client()
    _login(client_b, "b@example.com")
    resp = client_b.get("/api/patients")
    assert resp.status_code == 200
    items = resp.get_json()
    assert items == [] or all(p.get("patient_id") != pa["patient_id"] for p in items), \
        "Doctor B's list leaked Doctor A's patient"


def test_doctor_b_cannot_get_doctor_a_patient_by_id(isolated_app):
    """IDOR: direct URL fetch of another doctor's patient must return 403."""
    app, db = isolated_app
    _create_doctor(db, "a@example.com")
    _create_doctor(db, "b@example.com")
    db.session.commit()

    client_a = app.test_client()
    _login(client_a, "a@example.com")
    pa = _create_patient(client_a, name="Alice")

    client_b = app.test_client()
    _login(client_b, "b@example.com")
    resp = client_b.get(f"/api/patient/{pa['patient_id']}")
    assert resp.status_code == 403, \
        f"Expected 403 cross-doctor read, got {resp.status_code}: {resp.get_json()}"


def test_doctor_b_cannot_patch_doctor_a_patient(isolated_app):
    """IDOR write: PATCH another doctor's patient must return 403."""
    app, db = isolated_app
    _create_doctor(db, "a@example.com")
    _create_doctor(db, "b@example.com")
    db.session.commit()

    client_a = app.test_client()
    _login(client_a, "a@example.com")
    pa = _create_patient(client_a, name="Alice")

    client_b = app.test_client()
    _login(client_b, "b@example.com")
    resp = client_b.patch(
        f"/api/patient/{pa['patient_id']}",
        json={"name": "TAMPERED"},
        headers=_csrf(client_b),
    )
    assert resp.status_code == 403


def test_doctor_b_cannot_delete_doctor_a_patient(isolated_app):
    """IDOR delete: must return 403 and leave the row intact."""
    app, db = isolated_app
    _create_doctor(db, "a@example.com")
    _create_doctor(db, "b@example.com")
    db.session.commit()

    client_a = app.test_client()
    _login(client_a, "a@example.com")
    pa = _create_patient(client_a, name="Alice")

    client_b = app.test_client()
    _login(client_b, "b@example.com")
    resp = client_b.delete(
        f"/api/patient/{pa['patient_id']}",
        headers=_csrf(client_b),
    )
    assert resp.status_code == 403

    # Doctor A's view of the patient should be untouched.
    resp_a = client_a.get(f"/api/patient/{pa['patient_id']}")
    assert resp_a.status_code == 200


def test_request_body_doctor_id_cannot_smuggle_ownership(isolated_app):
    """
    Privilege escalation probe: client puts doctor_id=<other doctor> in the
    request body. The server MUST NOT honour it — either the field is
    silently dropped by the schema OR the request is rejected with 4xx.
    A 201 that returns doctor_id == B is a critical failure.
    """
    app, db = isolated_app
    a = _create_doctor(db, "a@example.com")
    b = _create_doctor(db, "b@example.com")
    db.session.commit()
    a_id, b_id = a.id, b.id

    client_a = app.test_client()
    _login(client_a, "a@example.com")
    resp = client_a.post(
        "/api/patient",
        json={
            "name": "Smuggled", "age": 30, "gravida": 1, "parity": 0,
            "gestational_age": 38, "consent_obtained": True,
            "doctor_id": b_id,   # malicious — must be rejected or stripped
        },
        headers=_csrf(client_a),
    )

    if resp.status_code == 201:
        # Schema dropped the field — verify the persisted owner is A, not B.
        body = resp.get_json()
        assert body["doctor_id"] == a_id, "doctor_id smuggled from request body"
    else:
        # Schema rejected the unknown field — also acceptable (defense in depth).
        assert 400 <= resp.status_code < 500, resp.get_json()


def test_orphan_fail_closed_path_aborts_403(isolated_app):
    """
    The DB now enforces patients.doctor_id NOT NULL, so legacy orphans cannot
    be created via the ORM. We still want to confirm that the *defensive*
    fail-closed branch in get_patient_for_doctor() returns 403 if such a row
    ever surfaces (e.g. from a malformed raw SQL import).

    We exercise the branch directly with a stub Patient.
    """
    from unittest.mock import patch
    from werkzeug.exceptions import HTTPException
    from utils.crypto import get_patient_for_doctor

    app, _db = isolated_app

    class _StubPatient:
        doctor_id = None
        patient_id = "ORPH-001"

    # Bypass the DB lookup and the JWT context — we're testing the branch only.
    with app.test_request_context("/"):
        with patch("models.Patient.query") as mock_q, \
             patch("utils.crypto.get_jwt", return_value={"role": "doctor"}), \
             patch("utils.crypto.log_unauthorized_access"):
            mock_q.filter_by.return_value.first_or_404.return_value = _StubPatient()
            with pytest.raises(HTTPException) as exc:
                get_patient_for_doctor("ORPH-001", doc_id=99)
    assert exc.value.code == 403


def test_doctor_b_cannot_read_doctor_a_observations(isolated_app):
    """Observations are reachable via patient; ownership must transitively apply."""
    app, db = isolated_app
    _create_doctor(db, "a@example.com")
    _create_doctor(db, "b@example.com")
    db.session.commit()

    client_a = app.test_client()
    _login(client_a, "a@example.com")
    pa = _create_patient(client_a)
    obs_resp = client_a.post(
        "/api/observation",
        json={
            "patient_id": pa["patient_id"],
            "cervical_dilation": 4, "fetal_heart_rate": 140,
            "maternal_pulse": 80, "bp_systolic": 120, "bp_diastolic": 80,
            "temperature": 37.0,
        },
        headers=_csrf(client_a),
    )
    assert obs_resp.status_code == 201, obs_resp.get_json()

    client_b = app.test_client()
    _login(client_b, "b@example.com")
    resp = client_b.get(f"/api/observations/{pa['patient_id']}")
    assert resp.status_code == 403


def test_idor_attempt_writes_audit_log(isolated_app):
    """Every cross-doctor access attempt must leave an IDOR_ATTEMPT audit row."""
    app, db = isolated_app
    from models import AuditLog
    _create_doctor(db, "a@example.com")
    _create_doctor(db, "b@example.com")
    db.session.commit()

    client_a = app.test_client()
    _login(client_a, "a@example.com")
    pa = _create_patient(client_a)

    client_b = app.test_client()
    _login(client_b, "b@example.com")
    client_b.get(f"/api/patient/{pa['patient_id']}")  # expected 403

    rows = AuditLog.query.filter_by(action="IDOR_ATTEMPT").all()
    assert rows, "No IDOR_ATTEMPT audit row written"
    assert any(pa["patient_id"] in r.resource for r in rows)


# ── Repository-layer regression tests ────────────────────────────────────────


def test_repository_create_patient_ignores_caller_doctor_id(isolated_app):
    """
    Even if `data` somehow contains a doctor_id, create_doctor_patient must
    write the *caller's* doctor_id. This guards against future refactors
    accidentally passing the raw request body.
    """
    app, db = isolated_app
    a = _create_doctor(db, "a@example.com")
    b = _create_doctor(db, "b@example.com")
    db.session.commit()
    a_id, b_id = a.id, b.id

    from utils.repository import create_doctor_patient
    payload = {
        "name": "X", "age": 30, "gravida": 1, "parity": 0,
        "gestational_age": 38, "consent_obtained": True,
        "doctor_id": b_id,   # would-be smuggled value
    }
    p = create_doctor_patient(a_id, payload)
    assert p.doctor_id == a_id, "Repository wrote caller-supplied doctor_id"


def test_repository_get_quota_isolates_per_doctor(isolated_app):
    app, db = isolated_app
    a = _create_doctor(db, "a@example.com")
    b = _create_doctor(db, "b@example.com")
    db.session.commit()

    from utils.repository import get_doctor_quota
    qa = get_doctor_quota(a.id)
    qb = get_doctor_quota(b.id)
    assert qa["patient_limit"] == a.patient_limit
    assert qb["patient_limit"] == b.patient_limit
    # Critically: quota figures must not include cross-doctor counts.
    assert qa["patients_used"] == 0
    assert qb["patients_used"] == 0


# ── File-storage isolation tests ─────────────────────────────────────────────


def test_storage_rejects_path_traversal(isolated_app):
    app, _db = isolated_app
    from utils.storage import resolve_doctor_path
    from werkzeug.exceptions import HTTPException

    with pytest.raises(HTTPException) as exc:
        resolve_doctor_path(1, "../../etc/passwd")
    assert exc.value.code in (400, 403)


def test_storage_rejects_absolute_paths(isolated_app):
    app, _db = isolated_app
    from utils.storage import resolve_doctor_path
    from werkzeug.exceptions import HTTPException

    with pytest.raises(HTTPException) as exc:
        resolve_doctor_path(1, "/etc/passwd")
    assert exc.value.code == 403


def test_storage_resolves_clean_relative_path_under_doctor_prefix(isolated_app):
    app, _db = isolated_app
    from utils.storage import resolve_doctor_path, doctor_prefix

    p = resolve_doctor_path(7, "patients/42/scan.pdf")
    # The resolved absolute path must start with /storage/doctors/7/.
    assert str(p).startswith(str(doctor_prefix(7)))


def test_signed_url_bound_to_doctor(isolated_app):
    """A token signed for Doctor A must NOT verify for Doctor B."""
    import os
    app, _db = isolated_app
    from utils.storage import sign_doctor_url, verify_doctor_url, _signing_key

    # Sanity: the signing key must be stable across calls within the test.
    k1 = _signing_key()
    token = sign_doctor_url(1, "patients/9/scan.pdf", expires_in=60)
    k2 = _signing_key()
    assert k1 == k2, "Signing key drifted between sign and verify"

    assert verify_doctor_url(1, "patients/9/scan.pdf", token) is True
    assert verify_doctor_url(2, "patients/9/scan.pdf", token) is False
    assert verify_doctor_url(1, "patients/9/OTHER.pdf", token) is False


def test_signed_url_expires(isolated_app):
    """An expired signature must not verify."""
    app, _db = isolated_app
    from utils.storage import sign_doctor_url, verify_doctor_url

    token = sign_doctor_url(1, "x.pdf", expires_in=-1)  # already expired
    assert verify_doctor_url(1, "x.pdf", token) is False


# ── New tenant-scoped tables ─────────────────────────────────────────────────


def test_new_tables_have_doctor_id_not_null(isolated_app):
    """
    Schema regression: every Phase-5 table must declare doctor_id NOT NULL.
    """
    app, db = isolated_app
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    expected = [
        "labor_records", "fetal_monitoring", "ai_predictions",
        "reports", "uploaded_files", "appointments", "prescriptions",
    ]
    for tbl in expected:
        cols = {c["name"]: c for c in inspector.get_columns(tbl)}
        assert "doctor_id" in cols, f"{tbl} is missing doctor_id"
        assert cols["doctor_id"]["nullable"] is False, \
            f"{tbl}.doctor_id must be NOT NULL"


def test_repository_prescription_isolation(isolated_app):
    """
    list_prescriptions must only return rows for the requesting doctor.

    The repo helpers go through get_patient_for_doctor which reads get_jwt(),
    so we set up a minimal JWT request context with the role claim.
    """
    from unittest.mock import patch

    app, db = isolated_app
    a = _create_doctor(db, "a@example.com")
    b = _create_doctor(db, "b@example.com")
    db.session.commit()

    from utils.repository import (
        create_doctor_patient, create_prescription, list_prescriptions,
    )
    pa = create_doctor_patient(a.id, {
        "name": "P-A", "age": 30, "gravida": 1, "parity": 0,
        "gestational_age": 38, "consent_obtained": True,
    })

    with app.test_request_context("/"):
        with patch("utils.crypto.get_jwt", return_value={"role": "doctor"}):
            create_prescription(a.id, pa.patient_id, {
                "drug_name": "Oxytocin", "dosage": "5 IU", "frequency": "single",
            })

    # Listing by doctor id is a pure DB filter — no JWT needed.
    assert list_prescriptions(b.id) == []
    assert len(list_prescriptions(a.id)) == 1
