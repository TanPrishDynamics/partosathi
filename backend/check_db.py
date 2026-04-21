import os
import sys
from dotenv import load_dotenv

# Load from project root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def check_db():
    print("=== DATABASE CONNECTION DIAGNOSTIC ===")
    
    env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '.env'))
    print(f"Checking for .env at: {env_path}")
    if os.path.exists(env_path):
        print(f"✓ .env file found")
    else:
        print(f"✗ .env file NOT found")

    db_uri = os.environ.get("DATABASE_URL")
    print(f"\nDATABASE_URL from environment: {db_uri}")
    
    if not db_uri:
        print("✗ No DATABASE_URL found in environment. App will default to SQLite.")
        db_uri = "sqlite:///partogram.db"
        
    if db_uri.startswith("sqlite"):
        print("ℹ Mode: SQLite (Local file)")
        path = db_uri.replace("sqlite:///", "")
        
        # Check standard path and instance path
        paths_to_check = [
            os.path.abspath(os.path.join(os.getcwd(), path)),
            os.path.abspath(os.path.join(os.getcwd(), 'instance', path))
        ]
        
        found = False
        for p in paths_to_check:
            if os.path.exists(p):
                print(f"  ✓ Database file exists at: {p}")
                try:
                    import sqlite3
                    conn = sqlite3.connect(p)
                    cur = conn.cursor()
                    cur.execute("SELECT COUNT(*) FROM patients")
                    count = cur.fetchone()[0]
                    print(f"  ✓ Connection successful. Patient count: {count}")
                    conn.close()
                except Exception as e:
                    print(f"  ✗ Connection failed: {e}")
                found = True
                break
        
        if not found:
            print(f"  ✗ Database file does NOT exist at standard or instance paths.")
            
    elif db_uri.startswith("mysql"):
        print("ℹ Mode: MySQL (Network)")
        try:
            import pymysql
            print("✓ pymysql driver installed.")
            # Check if host is specified
            print(f"  Target host: {db_uri.split('@')[-1].split('/')[0]}")
        except ImportError:
            print("✗ pymysql driver NOT installed. Run: pip install pymysql")
    else:
        print(f"⚠ Unknown database URI format: {db_uri}")

    print("\n=== End of Diagnostic ===")

if __name__ == "__main__":
    check_db()
