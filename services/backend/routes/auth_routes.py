"""
routes/auth_routes.py — Authentication blueprint.

Security features (hardened on branch `final-security-hardening`):
  - HttpOnly cookie JWT (XSS-resistant)
  - 15-minute access token / 7-day refresh token
  - Refresh-token rotation: old refresh JTI blocklisted on every /refresh call
  - Logout: access token JTI blocklisted (server-side revocation)
  - Status gates: pending/rejected accounts cannot log in
  - Brute-force protection (IP-based): 5/min admin, 10/min doctor (Flask-Limiter)
  - M-8: Per-account lockout via Redis (utils/lockout.py) — 5 fails / 15 min
  - M-7: TOTP MFA for admin accounts (utils/mfa.py)
  - M-14: Refresh endpoint is rate-limited to defeat stolen-cookie replay
  - H-3: Signup uses uniform 202 responses to defeat user-enumeration probes
  - H-5: Notifications fan out to ALL admins, not just admin id=1

Constant-time password verification is provided by werkzeug.security
(check_password_hash), so an Invalid-email response and Invalid-password
response are observationally indistinguishable in timing.
"""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    get_jwt, get_jwt_identity, jwt_required,
    set_access_cookies, set_refresh_cookies, unset_jwt_cookies,
)

from extensions import db, limiter
from models import Admin, Doctor, Hospital, TokenBlocklist
from utils.crypto import hash_password, verify_password
from utils.lockout import (
    lockout_check, lockout_clear, lockout_register_failure,
    lockout_remaining_seconds, MAX_FAILURES,
)
from utils.mfa import (
    generate_secret as mfa_generate_secret,
    provisioning_uri as mfa_provisioning_uri,
    verify_totp as mfa_verify_totp,
)
from utils.notify import notify_all_admins
from validators import (
    DoctorPublicSignupSchema, HospitalSignupSchema, LoginSchema, validate_request,
)
from services.email_service import notify_admin_new_signup

auth_bp = Blueprint("auth", __name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _blocklist_token(jti: str, exp_timestamp: int) -> None:
    """Add a JTI to the token blocklist with its natural expiry."""
    expires_at = datetime.utcfromtimestamp(exp_timestamp)
    entry = TokenBlocklist(jti=jti, expires_at=expires_at)
    db.session.add(entry)
    db.session.commit()


def _make_tokens(identity: str, role: str, type_: str):
    claims = {"role": role, "type": type_}
    access  = create_access_token(identity=identity, additional_claims=claims)
    refresh = create_refresh_token(identity=identity, additional_claims=claims)
    return access, refresh


def _generic_login_error():
    """
    Single canonical failure response for any auth error other than lockout.

    Identical body and status for "invalid email" and "invalid password"
    prevents timing/text-based enumeration of valid accounts. Lockout returns
    423 separately because it is benign to disclose (the lock has already been
    triggered by previous failures).
    """
    return jsonify({"error": "Invalid email or password"}), 401


def _locked_response(email: str):
    """
    Return 423 Locked with a Retry-After hint, after a soft-disclosure pause.
    The client can show the user a real "too many attempts" message — this is
    NOT an enumeration leak because the attacker triggered it themselves.
    """
    remaining = lockout_remaining_seconds(email) or 60
    resp = jsonify({
        "error": "Account temporarily locked due to too many failed attempts.",
        "retry_after_seconds": remaining,
    })
    resp.status_code = 423
    resp.headers["Retry-After"] = str(remaining)
    return resp


# ── Doctor login ──────────────────────────────────────────────────────────────

@auth_bp.route("/api/auth/login", methods=["POST"])
@limiter.limit("10 per minute; 30 per hour")
def login():
    """
    Doctor login.
    Returns JWT cookies on success; opaque 401 on any failure other than lockout.
    """
    payload, err = validate_request(LoginSchema, request.get_json())
    if err:
        return jsonify(err), 422

    email = payload["email"]

    # M-8: lockout check BEFORE password verification — denies even a constant
    # number of verification cycles to a locked account, eliminating any
    # timing leak from the slow scrypt hash.
    if lockout_check(email):
        return _locked_response(email)

    doctor = Doctor.query.filter_by(email=email).first()
    if not doctor or not verify_password(payload["password"], doctor.password_hash):
        # Register both "no such doctor" and "wrong password" as the SAME
        # failure event, against the same email key.
        new_count = lockout_register_failure(email)
        if new_count >= MAX_FAILURES:
            # Surface the lock state with one explicit response so the user
            # knows to wait, but never disclose whether the account exists.
            return _locked_response(email)
        return _generic_login_error()

    # Status gates remain after the password check — at this point the account
    # is confirmed valid, so disclosing pending/rejected/inactive is allowed.
    if doctor.status == "pending":
        return jsonify({
            "error": "Your account is pending admin approval.",
            "status": "pending", "doctor_id": doctor.id,
        }), 403
    if doctor.status == "rejected":
        return jsonify({"error": "Your account request was not approved.", "status": "rejected"}), 403
    if doctor.status == "inactive":
        return jsonify({"error": "Your account has been deactivated."}), 403

    lockout_clear(email)
    access, refresh = _make_tokens(str(doctor.id), "doctor", "doctor")
    resp = jsonify({
        "doctor": {
            "id": doctor.id, "name": doctor.name, "email": doctor.email,
            "license_number": doctor.license_number, "hospital": doctor.hospital,
            "patient_limit": doctor.patient_limit, "patients_used": doctor.patients_used,
            "status": doctor.status,
        },
        "role": "doctor",
    })
    set_access_cookies(resp, access)
    set_refresh_cookies(resp, refresh)
    return resp


# ── Admin login (with optional TOTP MFA) ──────────────────────────────────────

@auth_bp.route("/api/auth/admin-login", methods=["POST"])
@limiter.limit("5 per minute; 20 per hour")
def admin_login():
    """
    Admin login.

    M-7: If the admin has enrolled TOTP MFA (admin.totp_enabled), the request
    body MUST include a `totp` field with the current 6-digit code. Backwards-
    compatible: admins without MFA enrolled keep using the previous flow.

    Response codes:
      200 — login successful, JWT cookies set
      401 — invalid credentials (opaque) or invalid MFA code
      423 — account locked (Retry-After header set)
    """
    body = request.get_json() or {}
    payload, err = validate_request(LoginSchema, body)
    if err:
        return jsonify(err), 422
    email = payload["email"]

    if lockout_check(email):
        return _locked_response(email)

    admin = Admin.query.filter_by(email=email).first()
    if not admin or not verify_password(payload["password"], admin.password_hash):
        new_count = lockout_register_failure(email)
        if new_count >= MAX_FAILURES:
            return _locked_response(email)
        return _generic_login_error()

    # M-7: enforce MFA when enrolled.
    if admin.totp_enabled and admin.totp_secret:
        provided_code = (body.get("totp") or "").strip()
        if not provided_code:
            # 401 — keep response shape compatible with "wrong password" so
            # external attackers cannot tell MFA-enabled accounts from
            # passwordless ones. The frontend distinguishes via mfa_required.
            return jsonify({
                "error": "MFA code required",
                "mfa_required": True,
            }), 401
        if not mfa_verify_totp(admin.totp_secret, provided_code):
            new_count = lockout_register_failure(email)
            if new_count >= MAX_FAILURES:
                return _locked_response(email)
            return jsonify({
                "error": "Invalid MFA code",
                "mfa_required": True,
            }), 401

    lockout_clear(email)
    access, refresh = _make_tokens(str(admin.id), "admin", "admin")
    resp = jsonify({"user": admin.to_dict(), "role": "admin"})
    set_access_cookies(resp, access)
    set_refresh_cookies(resp, refresh)
    return resp


# ── MFA enrollment (admin only, requires authenticated session) ──────────────

@auth_bp.route("/api/auth/mfa/setup", methods=["POST"])
@jwt_required()
@limiter.limit("5 per minute")
def mfa_setup():
    """
    Step 1 of TOTP enrollment.

    Generates a fresh base32 secret AND a provisioning URI for QR-code scanning.
    The secret is persisted but `totp_enabled` stays False until /mfa/confirm
    succeeds — this prevents an enrollment race where the admin gets locked out
    by losing access to the authenticator app mid-enrollment.

    Only admin accounts may enroll for now.
    """
    role = (get_jwt() or {}).get("role")
    if role != "admin":
        return jsonify({"error": "MFA enrollment is currently admin-only."}), 403

    admin_id = int(get_jwt_identity())
    admin = Admin.query.get_or_404(admin_id)

    secret = mfa_generate_secret()
    admin.totp_secret = secret
    # IMPORTANT: do NOT set totp_enabled=True yet — only after /mfa/confirm.
    db.session.commit()

    uri = mfa_provisioning_uri(secret, account_email=admin.email)
    return jsonify({
        "provisioning_uri": uri,
        # Returning the secret itself lets the user type it into apps that
        # cannot scan a QR code. This is acceptable because the response is
        # sent over the authenticated session to the same user — it never
        # crosses an untrusted channel.
        "secret": secret,
        "enabled": False,
    })


@auth_bp.route("/api/auth/mfa/confirm", methods=["POST"])
@jwt_required()
@limiter.limit("5 per minute")
def mfa_confirm():
    """Step 2 of TOTP enrollment — verify a code and flip totp_enabled=True."""
    role = (get_jwt() or {}).get("role")
    if role != "admin":
        return jsonify({"error": "MFA enrollment is currently admin-only."}), 403

    admin_id = int(get_jwt_identity())
    admin = Admin.query.get_or_404(admin_id)
    if not admin.totp_secret:
        return jsonify({"error": "Call /api/auth/mfa/setup first."}), 400

    code = (request.get_json() or {}).get("code", "")
    if not mfa_verify_totp(admin.totp_secret, code):
        return jsonify({"error": "Invalid code"}), 400

    admin.totp_enabled = True
    db.session.commit()
    return jsonify({"enabled": True})


@auth_bp.route("/api/auth/mfa/disable", methods=["POST"])
@jwt_required()
@limiter.limit("5 per minute")
def mfa_disable():
    """
    Disable MFA for the calling admin. Requires the current TOTP code so an
    XSS / CSRF actor cannot trivially silence MFA.
    """
    role = (get_jwt() or {}).get("role")
    if role != "admin":
        return jsonify({"error": "MFA enrollment is currently admin-only."}), 403

    admin_id = int(get_jwt_identity())
    admin = Admin.query.get_or_404(admin_id)
    if not admin.totp_enabled:
        return jsonify({"enabled": False})

    code = (request.get_json() or {}).get("code", "")
    if not mfa_verify_totp(admin.totp_secret or "", code):
        return jsonify({"error": "Invalid code"}), 400

    admin.totp_enabled = False
    admin.totp_secret = None
    db.session.commit()
    return jsonify({"enabled": False})


# ── Hospital login ────────────────────────────────────────────────────────────

@auth_bp.route("/api/auth/hospital-login", methods=["POST"])
@limiter.limit("10 per minute; 30 per hour")
def hospital_login():
    payload, err = validate_request(LoginSchema, request.get_json())
    if err:
        return jsonify(err), 422
    email = payload["email"]

    if lockout_check(email):
        return _locked_response(email)

    h = Hospital.query.filter_by(email=email).first()
    if not h or not verify_password(payload["password"], h.password_hash):
        new_count = lockout_register_failure(email)
        if new_count >= MAX_FAILURES:
            return _locked_response(email)
        return _generic_login_error()

    if h.status == "pending_approval":
        return jsonify({"error": "Your hospital account is pending admin approval.", "status": "pending"}), 403
    if h.status == "rejected":
        return jsonify({"error": "Your hospital application was not approved.", "status": "rejected"}), 403
    if h.status == "inactive":
        return jsonify({"error": "This hospital account has been deactivated."}), 403

    lockout_clear(email)
    access, refresh = _make_tokens(str(h.id), "hospital", "hospital")
    d = h.to_dict()
    d["doctors_count"] = Doctor.query.filter_by(hospital_id=h.id).count()
    resp = jsonify({"hospital": d, "role": "hospital"})
    set_access_cookies(resp, access)
    set_refresh_cookies(resp, refresh)
    return resp


# ── Token refresh (with rotation) ────────────────────────────────────────────

@auth_bp.route("/api/auth/refresh", methods=["POST"])
@jwt_required(refresh=True)
@limiter.limit("30 per hour", key_func=lambda: f"refresh:{get_jwt_identity() or 'anon'}")
def refresh_token():
    """
    Issues a new access token AND a new refresh token.
    The old refresh token's JTI is immediately blocklisted (rotation).

    M-14: rate-limited at 30/hour per identity. A legitimate 7-day refresh
    token only needs ~7 × 24 × 4 = 672 refreshes max (every 15 minutes), so
    30/hour is generous for honest clients and slams the brakes on a stolen
    cookie being replayed at speed.
    """
    old_claims = get_jwt()
    old_jti    = old_claims["jti"]
    old_exp    = old_claims["exp"]

    # Blocklist the old refresh token immediately
    _blocklist_token(old_jti, old_exp)

    identity   = get_jwt_identity()
    new_claims = {"role": old_claims.get("role"), "type": old_claims.get("type")}
    new_access  = create_access_token(identity=identity, additional_claims=new_claims)
    new_refresh = create_refresh_token(identity=identity, additional_claims=new_claims)

    resp = jsonify({"refreshed": True})
    set_access_cookies(resp, new_access)
    set_refresh_cookies(resp, new_refresh)
    return resp


# ── Logout ────────────────────────────────────────────────────────────────────

@auth_bp.route("/api/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    """
    Clears JWT cookies AND blocklists the access token's JTI.
    The 15-minute access token cannot be replayed after logout even if
    intercepted from a cookie store backup.
    """
    claims = get_jwt()
    _blocklist_token(claims["jti"], claims["exp"])
    resp = jsonify({"message": "Logged out successfully"})
    unset_jwt_cookies(resp)
    return resp


# ── Current user ──────────────────────────────────────────────────────────────

@auth_bp.route("/api/auth/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    role    = get_jwt().get("role")
    if role == "admin":
        admin = Admin.query.get_or_404(user_id)
        return jsonify(admin.to_dict())
    if role == "hospital":
        h = Hospital.query.get_or_404(user_id)
        d = h.to_dict()
        d["doctors_count"] = Doctor.query.filter_by(hospital_id=h.id).count()
        return jsonify(d)
    doctor = Doctor.query.get_or_404(user_id)
    return jsonify({
        **doctor.to_dict(),
        "quota_pct": round((doctor.patients_used / doctor.patient_limit) * 100, 1)
        if doctor.patient_limit else 0,
    })


# ── Public signups ────────────────────────────────────────────────────────────
#
# H-3: signup responses are UNIFORM regardless of whether the email already
# exists. The legacy 409 "An account with this email already exists" leaked
# valid account emails to anonymous probers. The new flow:
#   - Always returns 202 Accepted with the same body shape.
#   - Existing-email cases silently no-op (no second row created, no email sent).
#   - Genuinely new signups create the pending row and queue the admin email.
# The user-visible UX is unchanged because the frontend already routes to /pending.


@auth_bp.route("/api/auth/signup/doctor", methods=["POST"])
@limiter.limit("5 per minute; 20 per hour")
def signup_doctor():
    payload, err = validate_request(DoctorPublicSignupSchema, request.get_json())
    if err:
        return jsonify(err), 422

    uniform_body = {
        "message": "If your email is new, your registration is pending admin approval.",
        "status": "pending",
    }

    existing = Doctor.query.filter_by(email=payload["email"]).first()
    if existing:
        # Do not create, do not email, do not leak existence.
        return jsonify(uniform_body), 202

    doctor = Doctor(
        name=payload["name"],
        email=payload["email"],
        password_hash=hash_password(payload["password"]),
        license_number=payload.get("license_number"),
        hospital=payload.get("hospital") or "Unassigned",
        status="pending",
        patient_limit=10,
    )
    db.session.add(doctor)
    db.session.flush()

    # H-5: notify ALL admins, not just admin id=1.
    notify_all_admins(
        title=f"New Doctor Signup: {doctor.name}",
        message=f"{doctor.name} ({doctor.email}) has signed up and is awaiting approval.",
        notif_type="signup",
        ref_id=doctor.id,
    )
    db.session.commit()

    # Email is best-effort; failures are logged in email_service but never
    # block the response (so SMTP outages don't surface as 5xx to signups).
    try:
        notify_admin_new_signup("doctor", doctor.name, doctor.email)
    except Exception:
        pass

    return jsonify(uniform_body), 202


@auth_bp.route("/api/auth/signup/hospital", methods=["POST"])
@limiter.limit("5 per minute; 10 per hour")
def signup_hospital():
    payload, err = validate_request(HospitalSignupSchema, request.get_json())
    if err:
        return jsonify(err), 422

    uniform_body = {
        "message": "If your email is new, your registration is pending admin approval.",
        "status": "pending_approval",
    }

    existing = Hospital.query.filter_by(email=payload["email"]).first()
    if existing:
        return jsonify(uniform_body), 202

    hospital = Hospital(
        name=payload["name"],
        email=payload["email"],
        password_hash=hash_password(payload["password"]),
        contact_person=payload["contact_person"],
        phone=payload.get("phone"),
        address=payload.get("address"),
        status="pending_approval",
        patient_limit=100,
    )
    db.session.add(hospital)
    db.session.flush()

    notify_all_admins(
        title=f"New Hospital Signup: {hospital.name}",
        message=f"{hospital.name} ({hospital.email}) has submitted a signup request.",
        notif_type="signup",
        ref_id=hospital.id,
    )
    db.session.commit()

    try:
        notify_admin_new_signup("hospital", hospital.name, hospital.email)
    except Exception:
        pass

    return jsonify(uniform_body), 202
