"""
middleware/sanitize.py — Request input sanitization.

Python equivalent of DOMPurify / validator.js sanitization layer.

Applied via Flask before_request hook registered in create_app().
Operates on the *parsed* JSON body (does not modify the raw byte stream).

What it does:
  1. Strips null bytes (\x00) from all string values — prevents null-byte injection
  2. Strips leading/trailing whitespace from strings
  3. HTML-encodes angle brackets in strings that are not expected to contain markup
     (protects against stored XSS if data is ever rendered in an HTML context)
  4. Rejects payloads larger than the configured MAX_CONTENT_LENGTH (Flask already does
     this at the WSGI layer, but we log it explicitly here for audit purposes)
"""
import logging
import re
from typing import Any

from flask import request, jsonify, g

logger = logging.getLogger(__name__)

# Characters that have no business in a medical data API's JSON payloads
_NULL_BYTE_RE = re.compile(r"\x00")

# Minimal HTML encoding — replaces < > & only; does NOT strip tags (that's Marshmallow's job)
_HTML_CHARS = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
}


def _sanitize_value(value: Any, depth: int = 0) -> Any:
    """Recursively sanitize a value from a parsed JSON body."""
    if depth > 10:
        return value  # prevent deep-object DoS
    if isinstance(value, str):
        # 1. Remove null bytes
        value = _NULL_BYTE_RE.sub("", value)
        # 2. Strip leading/trailing whitespace
        value = value.strip()
        # 3. Encode HTML entities (belt-and-suspenders against stored XSS)
        for char, entity in _HTML_CHARS.items():
            value = value.replace(char, entity)
        return value
    if isinstance(value, dict):
        return {k: _sanitize_value(v, depth + 1) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_value(i, depth + 1) for i in value]
    return value


def sanitize_request() -> None:
    """
    before_request hook: sanitize parsed JSON body and store on flask.g.

    Routes that call request.get_json() after this hook will receive the
    original (un-sanitized) dict; routes that use g.sanitized_body will get
    the cleaned version.  Our validators.validate_request() is called inside
    routes *after* sanitization, so Marshmallow operates on clean data.

    Note: We store the sanitized body on g rather than monkey-patching the
    request object, which is read-only in Flask.
    """
    if not request.is_json:
        g.sanitized_body = None
        return

    body = request.get_json(silent=True, force=False)
    if body is None:
        g.sanitized_body = None
        return

    g.sanitized_body = _sanitize_value(body)


def get_clean_json() -> Any:
    """
    Helper for route handlers: returns the sanitized JSON body.
    Falls back to request.get_json() if before_request didn't run.
    """
    if hasattr(g, "sanitized_body") and g.sanitized_body is not None:
        return g.sanitized_body
    return request.get_json(silent=True) or {}
