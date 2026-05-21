"""
middleware/error_handler.py — Centralised error handlers.

Rule: NEVER expose stack traces, internal paths, or DB details to the client.
All 5xx responses return a single generic JSON message regardless of cause.
Flask-JWT-Extended errors are intercepted and normalised here too.
"""
import logging
import traceback

from flask import jsonify
from flask_jwt_extended.exceptions import (
    CSRFError,
    FreshTokenRequired,
    InvalidHeaderError,
    JWTDecodeError,
    NoAuthorizationError,
    RevokedTokenError,
    UserClaimsVerificationError,
)
from werkzeug.exceptions import (
    BadRequest,
    Forbidden,
    MethodNotAllowed,
    NotFound,
    RequestEntityTooLarge,
    TooManyRequests,
    UnprocessableEntity,
)

logger = logging.getLogger(__name__)


def register_error_handlers(app) -> None:
    """Call once from create_app() to attach all error handlers."""

    # ── HTTP 4xx ────────────────────────────────────────────────────────────────

    @app.errorhandler(BadRequest)
    def bad_request(e):
        return jsonify({"error": "Bad request"}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "Authentication required"}), 401

    @app.errorhandler(Forbidden)
    def forbidden(e):
        return jsonify({"error": "You do not have permission to perform this action"}), 403

    @app.errorhandler(NotFound)
    def not_found(e):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(MethodNotAllowed)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(RequestEntityTooLarge)
    def payload_too_large(e):
        return jsonify({"error": "Request payload too large"}), 413

    @app.errorhandler(UnprocessableEntity)
    def unprocessable(e):
        return jsonify({"error": "Unprocessable entity"}), 422

    @app.errorhandler(TooManyRequests)
    def rate_limited(e):
        return jsonify({
            "error": "Too many requests. Please wait before trying again.",
            "retry_after": e.description,
        }), 429

    # ── HTTP 5xx — generic, no internals ────────────────────────────────────────

    @app.errorhandler(Exception)
    def internal_error(e):
        logger.error(
            "Unhandled exception: %s — %s",
            type(e).__name__,
            traceback.format_exc(),
        )
        return jsonify({"error": "An internal error occurred. Please contact support."}), 500

    # ── JWT errors ──────────────────────────────────────────────────────────────

    @app.errorhandler(NoAuthorizationError)
    def missing_token(e):
        return jsonify({"error": "Authentication token is missing"}), 401

    @app.errorhandler(JWTDecodeError)
    def invalid_token(e):
        return jsonify({"error": "Invalid or expired authentication token"}), 401

    @app.errorhandler(RevokedTokenError)
    def revoked_token(e):
        return jsonify({"error": "Session has been revoked. Please log in again."}), 401

    @app.errorhandler(FreshTokenRequired)
    def fresh_token_required(e):
        return jsonify({"error": "Please log in again to perform this action"}), 401

    @app.errorhandler(CSRFError)
    def csrf_error(e):
        return jsonify({"error": "CSRF validation failed"}), 403

    @app.errorhandler(InvalidHeaderError)
    def invalid_header(e):
        return jsonify({"error": "Invalid authorization header"}), 401

    @app.errorhandler(UserClaimsVerificationError)
    def claims_error(e):
        return jsonify({"error": "Token claims verification failed"}), 401
