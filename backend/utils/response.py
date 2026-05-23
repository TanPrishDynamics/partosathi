"""
utils/response.py — Standardised API response factories.

All routes should use these helpers so the response envelope is consistent.
"""
from typing import Any, Optional

from flask import jsonify


def ok(data: Any = None, message: str = "Success", status: int = 200):
    """200 / 201 success response."""
    payload = {"success": True}
    if message != "Success":
        payload["message"] = message
    if data is not None:
        if isinstance(data, (list, dict)):
            payload.update({"data": data} if not isinstance(data, dict) else data)
        else:
            payload["data"] = data
    return jsonify(payload), status


def created(data: Any = None, message: str = "Created"):
    return ok(data, message, 201)


def error(message: str, status: int = 400, details: Any = None):
    """4xx / 5xx error response — no stack traces."""
    payload: dict = {"error": message}
    if details is not None:
        payload["details"] = details
    return jsonify(payload), status


def validation_error(details: Any):
    return error("Validation failed", 422, details)


def not_found(resource: str = "Resource"):
    return error(f"{resource} not found", 404)


def forbidden():
    return error("You do not have permission to perform this action", 403)


def unauthorized():
    return error("Authentication required", 401)
