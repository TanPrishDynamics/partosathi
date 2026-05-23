# SQLite → MySQL Migration Guide
## e-Partogram — Step-by-Step Execution

---

## Pre-Migration Status

| Table        | SQLite Rows | Backup |
|---|---|---|
| admins       | 1           | ✅ `database/partogram_backup_*.db` |
| doctors      | 1           | ✅ |
| patients     | 2           | ✅ |
| observations | 13          | ✅ |
| alerts       | 19          | ✅ |

---

## Step 1 — Install MySQL

### macOS (Homebrew)
```bash
brew install mysql
brew services start mysql
mysql_secure_installation   # set root password
```

### Ubuntu / Debian
```bash
sudo apt install mysql-server -y
sudo systemctl start mysql
sudo mysql_secure_installation
```

---

## Step 2 — Create the Database & Schema

```bash
# Login to MySQL
mysql -u root -p

# Inside MySQL shell:
CREATE DATABASE partogram CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;

# Apply schema
mysql -u root -p partogram < database/schema.sql
```

Expected output: clean run with no errors.

---

## Step 3 — Install Python MySQL Driver

```bash
source backend/venv/bin/activate
pip install pymysql
```

---

## Step 4 — Set Environment Variables

```bash
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your-password-here
export MYSQL_DB=partogram
```

Or create a `.env` file at the root (copy `.env.example`).

---

## Step 5 — Run the Migration

```bash
python database/migrate.py
```

Expected output:
```
========================================================
  e-Partogram: SQLite → MySQL Migration
========================================================

►  Migrating: admins
  ✓  1 rows migrated
►  Migrating: doctors
  ✓  1 rows migrated
►  Migrating: patients
  ✓  2 rows migrated
►  Migrating: observations
  ✓  13 rows migrated
►  Migrating: alerts
  ✓  19 rows migrated

========================================================
  MIGRATION COMPLETE — Summary
========================================================
  ✓ All data migrated successfully.
  ✓ Next step: run  python database/validate.py
```

---

## Step 6 — Validate the Migration

```bash
python database/validate.py
```

Expected output: all checks show ✓.

> **If any check fails:** Do NOT update the backend. Re-run `migrate.py` after fixing the issue.

---

## Step 7 — Update Backend Config

Once validation passes, update `backend/app.py`:

```python
# BEFORE (SQLite):
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///partogram.db'

# AFTER (MySQL):
import os
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASS = os.getenv('MYSQL_PASSWORD', '')
MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_PORT = os.getenv('MYSQL_PORT', '3306')
MYSQL_DB   = os.getenv('MYSQL_DB',   'partogram')

app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASS}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DB}"
    "?charset=utf8mb4"
)
```

---

## Step 8 — Test All API Endpoints

```bash
# Start the backend (pointing at MySQL now)
cd backend && python app.py

# Quick sanity checks (in another terminal):
curl http://localhost:5001/api/patients        # should return 2 patients
curl http://localhost:5001/api/auth/me         # should return doctor
```

---

## Rollback Plan

If anything goes wrong at any step:

```bash
# Stop the backend
# Revert app.py DATABASE_URI to SQLite:
#   sqlite:///partogram.db

# Verify SQLite backup is intact:
sqlite3 database/partogram_backup_*.db ".tables"
sqlite3 database/partogram_backup_*.db "SELECT COUNT(*) FROM patients;"
```

The SQLite database is **never modified** by the migration script.

---

## Key Schema Differences (SQLite → MySQL)

| Aspect | SQLite | MySQL |
|---|---|---|
| Auto increment | `INTEGER PRIMARY KEY` | `INT AUTO_INCREMENT` |
| Boolean | `0 / 1` | `TINYINT(1)` |
| Alert message | `VARCHAR(300)` | `TEXT` (emoji support) |
| Charset | default | `utf8mb4` (full Unicode) |
| FK enforcement | Off by default | Strict (InnoDB) |
| Datetime | Stored as text | Native `DATETIME` |
