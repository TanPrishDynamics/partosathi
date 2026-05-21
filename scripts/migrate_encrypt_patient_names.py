"""
scripts/migrate_encrypt_patient_names.py
=========================================
One-time migration: encrypt existing plaintext Patient.name values in the DB
using the Fernet key set in FIELD_ENCRYPTION_KEY.

Run ONCE after setting FIELD_ENCRYPTION_KEY in your .env and restarting the app.
The EncryptedString TypeDecorator in models.py already handles graceful fallback
(plaintext values that fail decryption are returned as-is), so the app remains
functional before and after this migration.

Usage:
    cd backend
    FIELD_ENCRYPTION_KEY=<your_key> python ../scripts/migrate_encrypt_patient_names.py
    # Or with .env loaded:
    python ../scripts/migrate_encrypt_patient_names.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "/backend")

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../backend/.env"))

from cryptography.fernet import Fernet, InvalidToken

key = os.environ.get("FIELD_ENCRYPTION_KEY", "").encode()
if not key:
    print("ERROR: FIELD_ENCRYPTION_KEY not set. Aborting.")
    sys.exit(1)

fernet = Fernet(key)

from app import app
from models import db, Patient

def is_already_encrypted(value: str) -> bool:
    """Try to decrypt — if it succeeds, it's already encrypted."""
    try:
        fernet.decrypt(value.encode())
        return True
    except Exception:
        return False

with app.app_context():
    patients = Patient.query.all()
    updated = 0
    skipped = 0
    errors  = 0

    for p in patients:
        if not p.name:
            continue
        # Read the raw column value bypassing the TypeDecorator
        raw = db.session.execute(
            db.text("SELECT name FROM patients WHERE id = :id"), {"id": p.id}
        ).scalar()

        if raw and is_already_encrypted(raw):
            skipped += 1
            continue

        try:
            encrypted = fernet.encrypt(raw.encode()).decode()
            db.session.execute(
                db.text("UPDATE patients SET name = :name WHERE id = :id"),
                {"name": encrypted, "id": p.id},
            )
            updated += 1
        except Exception as e:
            print(f"  ERROR encrypting patient id={p.id}: {e}")
            errors += 1

    db.session.commit()
    print(f"\nMigration complete — updated: {updated}, already encrypted: {skipped}, errors: {errors}")
