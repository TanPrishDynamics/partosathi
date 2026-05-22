"""
services/backend/schemas/__init__.py

Marshmallow/Pydantic input validation schemas for e-Partogram.

All write endpoints use schema validation to prevent injection,
reject invalid PHI field values, and enforce data integrity.
Validators currently live in validators.py (root); they will be
migrated here incrementally as the codebase evolves.

Future modules:
    patient_schema      — Patient registration & update schemas
    observation_schema  — Observation creation schemas (WHO partograph fields)
    auth_schema         — Login, signup, MFA schemas
    admin_schema        — Admin approval / credit request schemas
"""
