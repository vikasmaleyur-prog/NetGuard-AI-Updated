"""
NetGuard AI - Database Connection Module
Provides resilient database connectivity: MongoDB Atlas when available,
with automatic fallback to local SQLite persistence for high availability.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

from database.storage import SQLiteCollection, StorageManager, DEFAULT_SQLITE_PATH

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

client = None
database = None
db_backend = "sqlite"
is_connected = False
connection_error = None

# Initialize local SQLite storage manager
storage_manager = StorageManager(DEFAULT_SQLITE_PATH)
monitoring_collection = None

if MONGODB_URI:
    try:
        from pymongo import MongoClient
        import certifi

        client = MongoClient(
            MONGODB_URI,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
        )
        # Test connection
        client.admin.command("ping")
        database = client["netguard"]
        monitoring_collection = database["monitoring"]
        db_backend = "mongodb"
        is_connected = True
    except Exception as err:
        connection_error = str(err)
        is_connected = False
        db_backend = "sqlite"
        monitoring_collection = SQLiteCollection(DEFAULT_SQLITE_PATH)
else:
    # No MONGODB_URI set - use local SQLite storage engine
    db_backend = "sqlite"
    is_connected = True
    monitoring_collection = SQLiteCollection(DEFAULT_SQLITE_PATH)


def test_connection():
    """Test the active database connection."""
    if db_backend == "mongodb" and client:
        try:
            client.admin.command("ping")
            return True
        except Exception:
            return False
    # SQLite is always reachable
    return True


def get_db_info():
    """Return database telemetry and health status."""
    return {
        "backend": db_backend,
        "connected": test_connection(),
        "fallback_active": db_backend == "sqlite" and bool(MONGODB_URI),
        "sqlite_path": str(DEFAULT_SQLITE_PATH),
        "error": connection_error if not is_connected and MONGODB_URI else None,
    }


def save_metrics(metrics):
    """Save monitoring metrics document to the active collection."""
    document = {
        "metrics": metrics
    }
    result = monitoring_collection.insert_one(document)
    return str(result.inserted_id)