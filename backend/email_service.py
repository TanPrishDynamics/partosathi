"""
email_service.py — Transactional email via Gmail SMTP.

Configuration (add to .env):
    SMTP_USERNAME=your-gmail@gmail.com
    SMTP_PASSWORD=your-app-password          # Gmail App Password (not account password)
    SMTP_FROM_NAME=e-Partogram Admin
    ADMIN_NOTIFY_EMAIL=admin@tanprish-dynamics.com

If SMTP_USERNAME is not set, all calls are silently no-ops (dev-safe).
"""
import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger(__name__)

_SMTP_HOST     = "smtp.gmail.com"
_SMTP_PORT     = 587
_SMTP_USER     = os.environ.get("SMTP_USERNAME", "")
_SMTP_PASS     = os.environ.get("SMTP_PASSWORD", "")
_FROM_NAME     = os.environ.get("SMTP_FROM_NAME", "e-Partogram")
_ADMIN_EMAIL   = os.environ.get("ADMIN_NOTIFY_EMAIL", _SMTP_USER)


def _send(to: str, subject: str, html: str) -> bool:
    """Send a single HTML email. Returns True on success, False on failure."""
    if not _SMTP_USER or not _SMTP_PASS:
        logger.info("[EMAIL] SMTP not configured — skipping email to %s: %s", to, subject)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{_FROM_NAME} <{_SMTP_USER}>"
        msg["To"]      = to
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT, timeout=10) as s:
            s.ehlo()
            s.starttls()
            s.login(_SMTP_USER, _SMTP_PASS)
            s.sendmail(_SMTP_USER, to, msg.as_string())
        logger.info("[EMAIL] Sent '%s' to %s", subject, to)
        return True
    except Exception as exc:
        logger.error("[EMAIL] Failed to send to %s: %s", to, exc)
        return False


# ── Email templates ────────────────────────────────────────────────────────────

def _base_template(content: str) -> str:
    return f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#F8FAFC;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1E293B 0%,#0F172A 100%);padding:32px 40px;">
        <h1 style="color:#4A90E2;margin:0;font-size:22px;font-weight:700;">e-Partogram</h1>
        <p style="color:#94A3B8;margin:6px 0 0;font-size:13px;">Clinical AI Platform by TanPrish Dynamics</p>
      </div>
      <div style="padding:40px;">
        {content}
      </div>
      <div style="padding:20px 40px;background:#F1F5F9;text-align:center;">
        <p style="color:#94A3B8;font-size:12px;margin:0;">
          This is an automated message from e-Partogram. Do not reply to this email.
        </p>
      </div>
    </div>
    """


def send_signup_received_email(to: str, name: str, role: str) -> None:
    """Confirm to the user that their signup request was received."""
    role_label = role.title()
    content = f"""
    <h2 style="color:#1E293B;margin:0 0 16px;">Signup Request Received</h2>
    <p style="color:#475569;">Hi {name}, your <strong>{role_label}</strong> account request has been received.</p>
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#1E40AF;">Your account is pending admin approval. You will receive an email once it is activated — typically within 1–2 business days.</p>
    </div>
    <p style="color:#475569;">Thank you for registering with e-Partogram.</p>
    """
    _send(to, "[e-Partogram] Signup Request Received", _base_template(content))


def notify_admin_new_signup(role: str, name: str, email: str) -> None:
    """Email admin when a new doctor or hospital signs up."""
    if not _ADMIN_EMAIL:
        return
    role_label = role.title()
    content = f"""
    <h2 style="color:#1E293B;margin:0 0 16px;">New {role_label} Signup</h2>
    <p style="color:#475569;">A new {role_label} has registered and is awaiting your approval.</p>
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;"><strong>Name:</strong> {name}</p>
      <p style="margin:0 0 8px;"><strong>Email:</strong> {email}</p>
      <p style="margin:0;"><strong>Role:</strong> {role_label}</p>
    </div>
    <p style="color:#475569;">Log in to the Admin Portal to approve or reject this request.</p>
    <a href="#" style="display:inline-block;background:#4A90E2;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
      Open Admin Portal
    </a>
    """
    _send(_ADMIN_EMAIL, f"[e-Partogram] New {role_label} Signup: {name}", _base_template(content))


def send_approval_email(to: str, name: str, role: str, patient_limit: Optional[int] = None) -> None:
    """Email user when their account is approved."""
    role_label = role.title()
    limit_note = f"<p style='color:#475569;'><strong>Patient Limit:</strong> {patient_limit} patients</p>" if patient_limit else ""
    content = f"""
    <h2 style="color:#16A34A;margin:0 0 16px;">Account Approved</h2>
    <p style="color:#475569;">Congratulations, {name}! Your {role_label} account has been approved.</p>
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;color:#16A34A;font-weight:600;">Access Granted</p>
      <p style="margin:0 0 8px;"><strong>Role:</strong> {role_label}</p>
      {limit_note}
    </div>
    <p style="color:#475569;">You can now log in to the e-Partogram dashboard and start using the system.</p>
    <a href="#" style="display:inline-block;background:#16A34A;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
      Login Now
    </a>
    """
    _send(to, "[e-Partogram] Your Account Has Been Approved", _base_template(content))


def send_rejection_email(to: str, name: str, role: str, reason: Optional[str] = None) -> None:
    """Email user when their account is rejected."""
    role_label = role.title()
    reason_section = (
        f"<div style='background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:16px;margin:20px 0;'>"
        f"<p style='margin:0;color:#DC2626;'><strong>Reason:</strong> {reason}</p></div>"
    ) if reason else ""
    content = f"""
    <h2 style="color:#DC2626;margin:0 0 16px;">Account Request Not Approved</h2>
    <p style="color:#475569;">Dear {name}, your {role_label} account request has not been approved at this time.</p>
    {reason_section}
    <p style="color:#475569;">If you believe this is an error or wish to appeal, please contact your administrator.</p>
    """
    _send(to, "[e-Partogram] Account Request Update", _base_template(content))


def send_quota_warning_email(to: str, name: str, used: int, limit: int) -> None:
    """Email doctor when they reach 80% of their patient quota."""
    pct = int((used / limit) * 100)
    content = f"""
    <h2 style="color:#D97706;margin:0 0 16px;">Patient Quota Warning</h2>
    <p style="color:#475569;">Dr. {name}, you have used <strong>{used} of {limit} patients ({pct}%)</strong> in your current plan.</p>
    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#92400E;">Contact your administrator to increase your patient limit before it is reached.</p>
    </div>
    """
    _send(to, "[e-Partogram] Patient Quota Warning", _base_template(content))
