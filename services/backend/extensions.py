"""
extensions.py — Flask extension singletons.

Defined here (not in app.py) to avoid circular imports when blueprints
import db, jwt, limiter, etc. directly.

Usage in app.py:
    from extensions import db, jwt, limiter, compress, talisman
    db.init_app(app); jwt.init_app(app) ...

Usage in any blueprint:
    from extensions import db, limiter
"""
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, get_jwt_identity
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from flask_compress import Compress

db       = SQLAlchemy()
jwt      = JWTManager()
compress = Compress()
talisman = Talisman()


def _jwt_or_ip_key() -> str:
    """Rate-limit key: prefer JWT identity (per-user), fall back to IP."""
    try:
        uid = get_jwt_identity()
        if uid:
            return f"user:{uid}"
    except Exception:
        pass
    return get_remote_address()


limiter = Limiter(
    key_func=get_remote_address,           # default: IP-based
    default_limits=["500 per day", "100 per hour"],
    headers_enabled=True,                  # X-RateLimit-* headers in responses
)
