"""
utils/notify.py — Multi-admin notification fan-out (H-5).

Previously, every signup / credit-request / admin alert was inserted into the
Notification table with a hardcoded `recipient_id=1`, on the assumption that
admin id=1 always exists. When that admin is deleted, replaced, or renumbered,
the entire approval workflow silently breaks.

This helper resolves recipients dynamically — one Notification row per admin —
so the workflow keeps working as the admin roster changes. It is idempotent
and safe to call from any blueprint.
"""
from __future__ import annotations

import logging
from typing import Optional

from extensions import db

log = logging.getLogger(__name__)


def notify_all_admins(
    title: str,
    message: str,
    notif_type: str,
    ref_id: Optional[int] = None,
) -> int:
    """
    Insert one Notification row for every Admin currently in the database.
    Returns the number of rows queued (not yet committed — the caller controls
    the transaction so this can be batched with the business-logic write).

    Failure modes:
      - DB error during admin enumeration → propagate (caller decides).
      - Zero admins → log a warning and return 0; never raise (defensive — a
        platform without an admin should not block doctor signups).
    """
    # Lazy import to avoid circular dependency (models imports extensions).
    from models import Admin, Notification

    admins = Admin.query.all()
    if not admins:
        log.warning(
            "notify_all_admins(%s): no admin accounts found — notification dropped.",
            notif_type,
        )
        return 0

    for admin in admins:
        db.session.add(Notification(
            recipient_type="admin",
            recipient_id=admin.id,
            title=title,
            message=message,
            notif_type=notif_type,
            ref_id=ref_id,
        ))

    return len(admins)
