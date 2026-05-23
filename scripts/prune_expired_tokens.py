"""
scripts/prune_expired_tokens.py
================================
Nightly maintenance: delete expired entries from `token_blocklist`.

M-18: Without this job, the blocklist grows unbounded — every logout / refresh
adds a row, and rows whose `expires_at` has passed are no longer relevant
(the token has expired anyway, so blocking it is redundant).

Run via cron or a Kubernetes CronJob:
    0 3 * * *  cd /app && python ../scripts/prune_expired_tokens.py
"""
from __future__ import annotations

import logging
import os
import sys
from datetime import datetime

# Allow the script to be invoked from anywhere; resolve the backend package.
_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.normpath(os.path.join(_HERE, "..", "backend"))
sys.path.insert(0, _BACKEND_DIR)

# Load .env from the backend directory before importing settings.
from dotenv import load_dotenv  # noqa: E402
load_dotenv(os.path.join(_BACKEND_DIR, ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("prune_expired_tokens")

from app import create_app  # noqa: E402
from extensions import db  # noqa: E402
from models import TokenBlocklist  # noqa: E402


def main() -> int:
    """Delete every TokenBlocklist row whose expires_at is in the past."""
    app = create_app()
    with app.app_context():
        cutoff = datetime.utcnow()
        deleted = TokenBlocklist.query.filter(
            TokenBlocklist.expires_at < cutoff
        ).delete(synchronize_session=False)
        db.session.commit()
        log.info("Pruned %d expired token blocklist rows.", deleted)
        return deleted


if __name__ == "__main__":
    sys.exit(0 if main() >= 0 else 1)
