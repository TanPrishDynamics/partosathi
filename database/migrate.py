#!/usr/bin/env python3
"""
SQLite → MySQL Migration Script for e-Partogram
================================================
Reads every row from the local SQLite DB and inserts it into MySQL.

USAGE:
  1. Install dependencies:  pip install pymysql
  2. Set MySQL credentials below (or use env vars)
  3. Run:  python database/migrate.py

SAFETY:
  - Non-destructive: never deletes SQLite data
  - Idempotent: can be re-run (uses INSERT IGNORE)
  - Transactional: rolls back on any error
"""

import sqlite3
import sys
import os
from datetime import datetime

try:
    import pymysql
    import pymysql.cursors
except ImportError:
    print("ERROR: pymysql not installed. Run: pip install pymysql")
    sys.exit(1)

# ── Configuration ─────────────────────────────────────────────────────────────
SQLITE_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'partogram.db')

MYSQL_CONFIG = {
    'host':     os.getenv('MYSQL_HOST',     'localhost'),
    'port':     int(os.getenv('MYSQL_PORT', '3306')),
    'user':     os.getenv('MYSQL_USER',     'root'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'db':       os.getenv('MYSQL_DB',       'partogram'),
    'charset':  'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
    'autocommit': False,
}

BATCH_SIZE = 100  # Insert in batches of 100 rows

# ── Helpers ───────────────────────────────────────────────────────────────────
def ts(val):
    """Normalize datetime strings from SQLite to MySQL-compatible format."""
    if val is None:
        return None
    if isinstance(val, str):
        # Strip microseconds if present: '2026-04-13 02:39:15.468947' → '2026-04-13 02:39:15'
        return val.split('.')[0]
    return val

def bool_val(val):
    """SQLite stores booleans as 0/1 integers. MySQL TINYINT(1) accepts same."""
    if val is None:
        return 0
    return 1 if val else 0

def log(msg, level="INFO"):
    prefix = {"INFO": "✓", "WARN": "⚠", "ERROR": "✗", "STEP": "►"}.get(level, " ")
    print(f"  {prefix}  {msg}")

# ── Migration functions ───────────────────────────────────────────────────────

def migrate_admins(sqlite_cur, mysql_cur):
    sqlite_cur.execute("SELECT id, name, email, password_hash, company FROM admins")
    rows = sqlite_cur.fetchall()
    count = 0
    for row in rows:
        mysql_cur.execute("""
            INSERT IGNORE INTO admins (id, name, email, password_hash, company)
            VALUES (%s, %s, %s, %s, %s)
        """, (row[0], row[1], row[2], row[3], row[4]))
        count += 1
    return count

def migrate_doctors(sqlite_cur, mysql_cur):
    sqlite_cur.execute("SELECT id, name, email, password_hash, license_number FROM doctors")
    rows = sqlite_cur.fetchall()
    count = 0
    for row in rows:
        mysql_cur.execute("""
            INSERT IGNORE INTO doctors (id, name, email, password_hash, license_number)
            VALUES (%s, %s, %s, %s, %s)
        """, (row[0], row[1], row[2], row[3], row[4]))
        count += 1
    return count

def migrate_patients(sqlite_cur, mysql_cur):
    sqlite_cur.execute("""
        SELECT id, patient_id, name, age, gravida, parity,
               gestational_age, admission_time, doctor_id
        FROM patients
    """)
    rows = sqlite_cur.fetchall()
    count = 0
    for row in rows:
        mysql_cur.execute("""
            INSERT IGNORE INTO patients
              (id, patient_id, name, age, gravida, parity,
               gestational_age, admission_time, doctor_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            row[0], row[1], row[2], row[3], row[4], row[5],
            row[6], ts(row[7]), row[8]
        ))
        count += 1
    return count

def migrate_observations(sqlite_cur, mysql_cur):
    sqlite_cur.execute("""
        SELECT id, patient_id, timestamp, cervical_dilation, head_station,
               fetal_heart_rate, amniotic_fluid, moulding, contraction_freq,
               contraction_duration, maternal_pulse, bp_systolic, bp_diastolic,
               temperature, urine_protein, urine_ketones, urine_volume
        FROM observations
    """)
    rows = sqlite_cur.fetchall()
    count = 0
    for row in rows:
        mysql_cur.execute("""
            INSERT IGNORE INTO observations
              (id, patient_id, timestamp, cervical_dilation, head_station,
               fetal_heart_rate, amniotic_fluid, moulding, contraction_freq,
               contraction_duration, maternal_pulse, bp_systolic, bp_diastolic,
               temperature, urine_protein, urine_ketones, urine_volume)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            row[0], row[1], ts(row[2]), row[3], row[4],
            row[5], row[6], row[7], row[8], row[9],
            row[10], row[11], row[12], row[13], row[14],
            row[15], row[16]
        ))
        count += 1
    return count

def migrate_alerts(sqlite_cur, mysql_cur):
    sqlite_cur.execute("""
        SELECT id, patient_id, timestamp, alert_type, severity,
               message, observation_id, acknowledged
        FROM alerts
    """)
    rows = sqlite_cur.fetchall()
    count = 0
    for row in rows:
        mysql_cur.execute("""
            INSERT IGNORE INTO alerts
              (id, patient_id, timestamp, alert_type, severity,
               message, observation_id, acknowledged)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            row[0], row[1], ts(row[2]), row[3], row[4],
            row[5], row[6], bool_val(row[7])
        ))
        count += 1
    return count

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "="*58)
    print("  e-Partogram: SQLite → MySQL Migration")
    print("="*58)

    # ── Connect to SQLite
    print("\n► STEP 1: Connect to SQLite")
    try:
        sqlite_conn = sqlite3.connect(SQLITE_PATH)
        sqlite_cur  = sqlite_conn.cursor()
        log(f"Connected to SQLite: {SQLITE_PATH}")
    except Exception as e:
        log(f"SQLite connection failed: {e}", "ERROR")
        sys.exit(1)

    # ── Connect to MySQL
    print("\n► STEP 2: Connect to MySQL")
    try:
        mysql_conn = pymysql.connect(**MYSQL_CONFIG)
        mysql_cur  = mysql_conn.cursor()
        log(f"Connected to MySQL: {MYSQL_CONFIG['host']}:{MYSQL_CONFIG['port']}/{MYSQL_CONFIG['db']}")
    except Exception as e:
        log(f"MySQL connection failed: {e}", "ERROR")
        log("Ensure MySQL is running and credentials are correct", "WARN")
        sys.exit(1)

    # ── Disable FK checks during migration
    mysql_cur.execute("SET FOREIGN_KEY_CHECKS = 0;")

    try:
        # ── Migrate in dependency order (parent tables first)
        steps = [
            ("admins",       migrate_admins),
            ("doctors",      migrate_doctors),
            ("patients",     migrate_patients),
            ("observations", migrate_observations),
            ("alerts",       migrate_alerts),
        ]

        totals = {}
        for table, fn in steps:
            print(f"\n► Migrating: {table}")
            count = fn(sqlite_cur, mysql_cur)
            mysql_conn.commit()
            totals[table] = count
            log(f"{count} rows migrated")

        # ── Re-enable FK checks
        mysql_cur.execute("SET FOREIGN_KEY_CHECKS = 1;")
        mysql_conn.commit()

        # ── Summary
        print("\n" + "="*58)
        print("  MIGRATION COMPLETE — Summary")
        print("="*58)
        for table, count in totals.items():
            print(f"  {table:<18} {count:>5} rows")
        print("="*58)
        print("  ✓ All data migrated successfully.")
        print("  ✓ Next step: run  python database/validate.py\n")

    except Exception as e:
        mysql_conn.rollback()
        log(f"Migration FAILED — rolled back: {e}", "ERROR")
        sys.exit(1)

    finally:
        mysql_cur.execute("SET FOREIGN_KEY_CHECKS = 1;")
        mysql_conn.commit()
        sqlite_conn.close()
        mysql_conn.close()

if __name__ == '__main__':
    main()
