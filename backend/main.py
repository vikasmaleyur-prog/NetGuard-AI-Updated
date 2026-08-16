from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.connection import monitoring_collection


# ============================================================
# NETGUARD AI - BACKEND
# ============================================================

app = FastAPI(
    title="NetGuard AI",
    description="Intelligent Network Monitoring and Self-Healing System",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():
    return {
        "project": "NetGuard AI",
        "status": "running",
        "message": "NetGuard AI backend is working!"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


# ============================================================
# LATEST MONITORING DATA
# ============================================================

@app.get("/metrics")
def metrics():
    """
    Return the latest monitoring record from MongoDB.
    """

    latest = monitoring_collection.find_one(
        {},
        sort=[("_id", -1)]
    )

    if not latest:
        return {
            "status": "no_data",
            "message": "No monitoring data found"
        }

    latest["_id"] = str(latest["_id"])

    return latest


# ============================================================
# MONITORING HISTORY
# ============================================================

@app.get("/metrics/history")
def metrics_history():
    """
    Return the latest 20 monitoring records.
    """

    records = list(
        monitoring_collection.find(
            {},
            {
                "_id": 1,
                "metrics": 1
            }
        )
        .sort("_id", -1)
        .limit(20)
    )

    for record in records:
        record["_id"] = str(record["_id"])

    return {
        "count": len(records),
        "records": records
    }


# ============================================================
# AI STATUS
# ============================================================

@app.get("/ai/status")
def ai_status():
    """
    Return the latest AI analysis results.
    """

    latest = monitoring_collection.find_one(
        {
            "ai_analysis": {
                "$exists": True
            }
        },
        {
            "_id": 1,
            "ai_analysis": 1
        },
        sort=[("_id", -1)]
    )

    if not latest:
        return {
            "status": "no_data",
            "message": "No AI analysis found"
        }

    return {
        "record_id": str(latest["_id"]),
        "ai_analysis": latest.get(
            "ai_analysis",
            {}
        )
    }


# ============================================================
# DECISION STATUS
# ============================================================

@app.get("/decision")
def decision():
    """
    Return the latest NetGuard AI decision.
    """

    latest = monitoring_collection.find_one(
        {
            "decision": {
                "$exists": True
            }
        },
        {
            "_id": 1,
            "decision": 1
        },
        sort=[("_id", -1)]
    )

    if not latest:
        return {
            "status": "no_data",
            "message": "No decision found"
        }

    return {
        "record_id": str(latest["_id"]),
        "decision": latest.get(
            "decision",
            {}
        )
    }


# ============================================================
# ALERTS
# ============================================================

@app.get("/alerts")
def alerts():
    """
    Return recent records where the final decision
    is WARNING or CRITICAL.
    """

    records = list(
        monitoring_collection.find(
            {
                "decision.status": {
                    "$in": [
                        "WARNING",
                        "CRITICAL"
                    ]
                }
            },
            {
                "_id": 1,
                "metrics": 1,
                "ai_analysis": 1,
                "decision": 1
            }
        )
        .sort("_id", -1)
        .limit(20)
    )

    for record in records:
        record["_id"] = str(record["_id"])

    return {
        "count": len(records),
        "alerts": records
    }


# ============================================================
# SYSTEM SUMMARY
# ============================================================

@app.get("/summary")
def summary():
    """
    Return a simple overall NetGuard AI summary.
    """

    latest = monitoring_collection.find_one(
        {},
        sort=[("_id", -1)]
    )

    if not latest:
        return {
            "status": "no_data",
            "message": "No monitoring data found"
        }

    metrics_data = latest.get(
        "metrics",
        {}
    )

    ai_data = latest.get(
        "ai_analysis",
        {}
    )

    decision_data = latest.get(
        "decision",
        {}
    )

    return {
        "network_status": decision_data.get(
            "status",
            ai_data.get(
                "status",
                "UNKNOWN"
            )
        ),

        "action": decision_data.get(
            "action",
            "No action available"
        ),

        "metrics": {
            "cpu_usage_percent": metrics_data.get(
                "cpu_usage_percent"
            ),

            "memory_usage_percent": metrics_data.get(
                "memory_usage_percent"
            ),

            "disk_usage_percent": metrics_data.get(
                "disk_usage_percent"
            ),

            "latency_ms": metrics_data.get(
                "latency_ms"
            )
        },

        "ai": {
            "isolation_forest": ai_data.get(
                "status",
                "UNKNOWN"
            ),

            "random_forest": ai_data.get(
                "random_forest_status",
                "UNKNOWN"
            ),

            "lstm": (
                "ANOMALY"
                if ai_data.get(
                    "lstm_anomaly",
                    False
                )
                else "NORMAL"
            )
        }
    }  