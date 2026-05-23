#!/usr/bin/env python3
"""
Post-Migration Validation Script for e-Partogram
=================================================
Compares row counts and spot-checks records between
SQLite (source of truth) and MySQL (target).

USAGE:  python database/validate.py
"""

import sqlite3
import sys
import os

try:
    import pymysql
    import pymysql.cursors
except ImportError:
    print("ERROR: pymysql not installed. Run: pip install pymysql")
    sys.exit(1)

SQLITE_PATH = os.path.join(os.path.dirname(__file__), '..', 'instance', 'partogram.db')

MYSQL_CONFIG = {
    'host':     os.getenv('MYSQL_HOST',     'localhost'),
    'port':     int(os.getenv('MYSQL_PORT', '3306')),
    'user':     os.getenv('MYSQL_USER',     'root'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'db':       os.getenv('MYSQL_DB',       'partogram'),
    'charset':  'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
}

TABLES = ['admins', 'doctors', 'patients', 'observations', 'alerts']

def main():
    print("\n" + "="*58)
    print("  e-Partogram: Post-Migration Validation")
    print("="*58)

    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_cur  = sqlite_conn.cursor()

    mysql_conn = pymysql.connect(**MYSQL_CONFIG)
    mysql_cur  = mysql_conn.cursor()

    all_passed = True

    # ── 1. Row count comparison ──────────────────────────────
    print("\n► CHECK 1: Row counts (SQLite vs MySQL)")
    print(f"  {'Table':<18} {'SQLite':>8} {'MySQL':>8} {'Match':>8}")
    print(f"  {'-'*44}")

    for table in TABLES:
        sqlite_cur.execute(f"SELECT COUNT(*) FROM {table}")
        sq_count = sqlite_cur.fetchone()[0]

        mysql_cur.execute(f"SELECT COUNT(*) as cnt FROM {table}")
        my_count = mysql_cur.fetchone()['cnt']

        match = "✓" if sq_count == my_count else "✗ MISMATCH"
        if sq_count != my_count:
            all_passed = False
        print(f"  {table:<18} {sq_count:>8} {my_count:>8} {match:>8}")

    # ── 2. Spot-check: first patient ────────────────────────
    print("\n► CHECK 2: Patient spot-check (first record)")
    sqlite_cur.execute("SELECT patient_id, name, age FROM patients ORDER BY id LIMIT 1")
    sq_row = sqlite_cur.fetchone()

    mysql_cur.execute("SELECT patient_id, name, age FROM patients ORDER BY id LIMIT 1")
    my_row = mysql_cur.fetchone()

    if sq_row and my_row:
        match = (sq_row[0] == my_row['patient_id'] and
                 sq_row[1] == my_row['name'] and
                 sq_row[2] == my_row['age'])
        status = "✓ Match" if match else "✗ Mismatch"
        if not match:
            all_passed = False
        print(f"  SQLite : {sq_row}")
        print(f"  MySQL  : {(my_row['patient_id'], my_row['name'], my_row['age'])}")
        print(f"  Result : {status}")

    # ── 3. Spot-check: alert boolean ────────────────────────
    print("\n► CHECK 3: Alert boolean (acknowledged field)")
    sqlite_cur.execute("SELECT id, acknowledged FROM alerts LIMIT 3")
    sq_alerts = sqlite_cur.fetchall()

    mysql_cur.execute("SELECT id, acknowledged FROM alerts LIMIT 3")
    my_alerts = mysql_cur.fetchall()

    print(f"  {'ID':<6} {'SQLite ACK':>12} {'MySQL ACK':>12} {'Match':>8}")
    for sq, my in zip(sq_alerts, my_alerts):
        sq_ack = bool(sq[1])
        my_ack = bool(my['acknowledged'])
        match  = "✓" if sq_ack == my_ack else "✗"
        if sq_ack != my_ack:
            all_passed = False
        print(f"  {sq[0]:<6} {str(sq_ack):>12} {str(my_ack):>12} {match:>8}")

    # ── 4. FK integrity check ────────────────────────────────
    print("\n► CHECK 4: Referential integrity (orphaned rows)")
    checks = [
        ("Orphaned patients",    "SELECT COUNT(*) as c FROM patients p LEFT JOIN doctors d ON p.doctor_id=d.id WHERE p.doctor_id IS NOT NULL AND d.id IS NULL"),
        ("Orphaned observations","SELECT COUNT(*) as c FROM observations o LEFT JOIN patients p ON o.patient_id=p.id WHERE p.id IS NULL"),
        ("Orphaned alerts",      "SELECT COUNT(*) as c FROM alerts a LEFT JOIN patients p ON a.patient_id=p.id WHERE p.id IS NULL"),
    ]
    for label, query in checks:
        mysql_cur.execute(query)
        count = mysql_cur.fetchone()['c']
        status = "✓ Clean" if count == 0 else f"✗ {count} orphaned rows"
        if count > 0:
            all_passed = False
        print(f"  {label:<28} {status}")

    # ── Final result ─────────────────────────────────────────
    print("\n" + "="*58)
    if all_passed:
        print("  ✓ ALL CHECKS PASSED — MySQL migration is valid.")
        print("  ✓ Safe to update backend DATABASE_URL to MySQL.\n")
    else:
        print("  ✗ SOME CHECKS FAILED — Do NOT switch to MySQL yet.")
        print("  ✗ Re-run migrate.py or inspect mismatched tables.\n")

    sqlite_conn.close()
    mysql_conn.close()
    sys.exit(0 if all_passed else 1)

if __name__ == '__main__':
    main()
