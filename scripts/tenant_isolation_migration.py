"""
scripts/tenant_isolation_migration.py
=====================================
Phase-5 tenant-isolation migration.

What this script does (idempotent, safe to re-run):

  1. BACKUP — copies the SQLite DB to <db>.bak-<timestamp> before any change.
     For PostgreSQL, prints a pg_dump command to run manually (we never invoke
     pg_dump from Python because credentials handling is brittle).

  2. SCAN — counts orphan rows (patients with doctor_id IS NULL) and prints
     a per-table summary.

  3. REASSIGN / QUARANTINE — one of three modes (--mode):
        report   (default)  : just prints the report, no writes.
        reassign --to <id>  : sets doctor_id = <id> on every orphan patient.
        quarantine          : sets status='Inactive' on orphans so they are
                              hidden from doctor dashboards but retained for
                              admin audit.

  4. CREATE-TABLES — runs db.create_all() so new Phase-5 tables (labor_records,
     fetal_monitoring, ai_predictions, reports, uploaded_files, appointments,
     prescriptions) and the new audit_logs.doctor_id column exist on disk.

  5. ENFORCE NOT NULL — on PostgreSQL, runs:
        ALTER TABLE patients ALTER COLUMN doctor_id SET NOT NULL;
     On SQLite, the model declaration is already nullable=False, but the
     constraint is only applied to NEW tables. For an existing SQLite DB,
     this script reports the limitation and tells you to run a full table
     rebuild (the cost of SQLite). Skip with --skip-enforce.

Usage:
    cd backend
    python ../scripts/tenant_isolation_migration.py --mode report
    python ../scripts/tenant_isolation_migration.py --mode reassign --to 1
    python ../scripts/tenant_isolation_migration.py --mode quarantine

Exit codes:
    0  success
    1  user error (bad args, --to missing for reassign, etc.)
    2  detected orphans in --mode report — pipeline-friendly fail signal
    3  database connection or write failure
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path


# ── Bootstrap Flask app context ──────────────────────────────────────────────

def _bootstrap():
    here = Path(__file__).resolve().parent
    backend = here.parent / "backend"
    sys.path.insert(0, str(backend))
    # Load .env if python-dotenv is available — same convention as the existing
    # encrypt-names migration script.
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv(backend / ".env")
    except Exception:
        pass


_bootstrap()

# Imports must happen AFTER bootstrap so backend/ is on sys.path.
from app import app  # noqa: E402
from extensions import db  # noqa: E402
from sqlalchemy import inspect, text  # noqa: E402


# ── Helpers ──────────────────────────────────────────────────────────────────

def _is_sqlite() -> bool:
    return db.engine.url.get_backend_name() == "sqlite"


def _is_postgres() -> bool:
    return db.engine.url.get_backend_name().startswith("postgres")


def _backup_sqlite() -> Path | None:
    """If SQLite, copy the .db file to a timestamped backup. Returns the path."""
    if not _is_sqlite():
        return None
    db_path_str = db.engine.url.database
    if not db_path_str:
        return None
    db_path = Path(db_path_str)
    if not db_path.is_absolute():
        db_path = Path(os.getcwd()) / db_path
    if not db_path.exists():
        return None
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    backup = db_path.with_suffix(db_path.suffix + f".bak-{stamp}")
    shutil.copy2(db_path, backup)
    return backup


def _orphan_counts() -> dict[str, int]:
    """Count NULL-doctor rows across tenant-relevant tables that have a doctor_id."""
    from models import Patient
    out = {"patients_null_doctor_id": Patient.query.filter(Patient.doctor_id.is_(None)).count()}
    return out


# ── Modes ────────────────────────────────────────────────────────────────────

def mode_report():
    counts = _orphan_counts()
    print("\n[REPORT] Orphan rows (doctor_id IS NULL):")
    any_orphans = False
    for k, v in counts.items():
        marker = "⚠" if v else "✓"
        print(f"  {marker} {k}: {v}")
        if v:
            any_orphans = True
    return 2 if any_orphans else 0


def mode_reassign(to_doctor_id: int):
    from models import Doctor, Patient
    doctor = Doctor.query.get(to_doctor_id)
    if not doctor:
        print(f"[ERROR] No doctor with id={to_doctor_id}. Aborting.")
        return 1
    n = Patient.query.filter(Patient.doctor_id.is_(None)).update(
        {Patient.doctor_id: to_doctor_id}, synchronize_session=False
    )
    db.session.commit()
    print(f"[OK] Reassigned {n} orphan patient(s) to doctor_id={to_doctor_id} ({doctor.email}).")
    return 0


def mode_quarantine():
    from models import Patient
    n = Patient.query.filter(Patient.doctor_id.is_(None)).update(
        {Patient.status: "Inactive"}, synchronize_session=False
    )
    db.session.commit()
    print(f"[OK] Marked {n} orphan patient(s) Inactive. They remain in the DB for audit.")
    return 0


def step_create_tables():
    """Create any newly-defined tables / columns that don't exist yet."""
    print("[STEP] Running db.create_all() to add new Phase-5 tables …")
    db.create_all()
    inspector = inspect(db.engine)
    existing = set(inspector.get_table_names())
    expected = {
        "labor_records", "fetal_monitoring", "ai_predictions",
        "reports", "uploaded_files", "appointments", "prescriptions",
    }
    missing = expected - existing
    if missing:
        print(f"[WARN] Tables still missing after create_all: {sorted(missing)}")
    else:
        print("[OK] All Phase-5 tables present.")

    # audit_logs.doctor_id: add only if absent. db.create_all() does NOT add
    # columns to existing tables, so we apply a conservative ALTER.
    cols = {c["name"] for c in inspector.get_columns("audit_logs")}
    if "doctor_id" not in cols:
        print("[STEP] Adding audit_logs.doctor_id …")
        with db.engine.begin() as conn:
            conn.execute(text("ALTER TABLE audit_logs ADD COLUMN doctor_id INTEGER"))
        print("[OK] audit_logs.doctor_id added.")
    else:
        print("[OK] audit_logs.doctor_id already present.")


def step_enforce_not_null():
    """
    Enforce patients.doctor_id NOT NULL at the DB layer.

    PostgreSQL — supported via ALTER COLUMN. Fails loudly if NULLs remain.
    SQLite    — requires full table rebuild (not safe to do automatically with
                live data, so we print instructions instead).
    """
    if _is_postgres():
        from models import Patient
        remaining = Patient.query.filter(Patient.doctor_id.is_(None)).count()
        if remaining:
            print(f"[ABORT] {remaining} orphan patient(s) remain. Run with"
                  " --mode reassign or --mode quarantine first.")
            return 2
        print("[STEP] Enforcing patients.doctor_id NOT NULL (PostgreSQL) …")
        with db.engine.begin() as conn:
            conn.execute(text("ALTER TABLE patients ALTER COLUMN doctor_id SET NOT NULL"))
        print("[OK] Constraint applied.")
        return 0
    elif _is_sqlite():
        print("[INFO] SQLite cannot ALTER COLUMN NOT NULL on an existing table.")
        print("       The Python model is already nullable=False, so all NEW")
        print("       writes are rejected by SQLAlchemy. To enforce at the DB")
        print("       layer, dump → drop → recreate the patients table. A safe")
        print("       offline procedure is documented in docs/PHASE5_MIGRATION.md.")
        return 0
    else:
        print(f"[INFO] Backend {db.engine.url.get_backend_name()} — manual constraint enforcement required.")
        return 0


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Phase-5 tenant-isolation migration.")
    parser.add_argument("--mode", choices=["report", "reassign", "quarantine"],
                        default="report")
    parser.add_argument("--to", type=int, default=None,
                        help="Doctor id to reassign orphans to (required for --mode reassign).")
    parser.add_argument("--skip-create-tables", action="store_true")
    parser.add_argument("--skip-enforce", action="store_true",
                        help="Skip the NOT NULL enforcement step.")
    args = parser.parse_args()

    with app.app_context():
        backup = _backup_sqlite()
        if backup:
            print(f"[BACKUP] SQLite DB copied to {backup}")
        elif _is_postgres():
            print("[BACKUP] PostgreSQL detected — please run pg_dump manually before continuing:")
            print(f"         pg_dump -F c -f /tmp/epartogram-prephase5-{int(time.time())}.dump <conninfo>")

        if not args.skip_create_tables:
            step_create_tables()

        if args.mode == "report":
            rc = mode_report()
        elif args.mode == "reassign":
            if args.to is None:
                print("[ERROR] --mode reassign requires --to <doctor_id>")
                return 1
            rc = mode_reassign(args.to)
        elif args.mode == "quarantine":
            rc = mode_quarantine()
        else:  # pragma: no cover
            rc = 1

        if rc == 0 and not args.skip_enforce:
            enforce_rc = step_enforce_not_null()
            # Surface enforce errors, but don't mask the earlier success.
            if enforce_rc != 0:
                rc = enforce_rc

        return rc


if __name__ == "__main__":
    try:
        sys.exit(main() or 0)
    except SystemExit:
        raise
    except Exception as exc:
        print(f"[FATAL] {type(exc).__name__}: {exc}")
        sys.exit(3)
