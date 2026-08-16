from datetime import datetime, timezone

from database.connection import monitoring_collection


def calculate_decision(
    isolation_status,
    random_forest_status,
    lstm_anomaly=False
):
    """
    Combine the outputs of Isolation Forest, Random Forest,
    and LSTM into one final network-health decision.
    """

    votes = 0

    if isolation_status == "ANOMALY":
        votes += 1

    if random_forest_status == "ANOMALY":
        votes += 1

    if lstm_anomaly:
        votes += 1

    if votes >= 2:
        status = "CRITICAL"
        action = "Investigate and apply corrective action"

    elif votes == 1:
        status = "WARNING"
        action = "Continue monitoring closely"

    else:
        status = "NORMAL"
        action = "No action required"

    return {
        "status": status,
        "anomaly_votes": votes,
        "action": action
    }


def get_latest_ai_results():
    """
    Get the latest available AI analysis results
    from MongoDB.
    """

    records = list(
        monitoring_collection.find(
            {"ai_analysis": {"$exists": True}},
            {"_id": 1, "metrics": 1, "ai_analysis": 1}
        )
        .sort("_id", -1)
        .limit(10)
    )

    return records


def run_decision_engine():
    """
    Run the NetGuard AI decision engine.
    """

    records = get_latest_ai_results()

    if not records:
        raise RuntimeError(
            "No AI analysis records found in MongoDB."
        )

    print("NetGuard AI - Decision Engine")
    print("--------------------------------")

    decisions = []

    for record in records:

        ai_analysis = record.get("ai_analysis", {})

        isolation_status = ai_analysis.get(
            "status",
            "NORMAL"
        )

        random_forest_status = ai_analysis.get(
            "random_forest_status",
            "NORMAL"
        )

        lstm_anomaly = ai_analysis.get(
            "lstm_anomaly",
            False
        )

        decision = calculate_decision(
            isolation_status,
            random_forest_status,
            lstm_anomaly
        )

        decisions.append(decision)

        print(
            f"Isolation Forest: {isolation_status} | "
            f"Random Forest: {random_forest_status} | "
            f"LSTM: {'ANOMALY' if lstm_anomaly else 'NORMAL'}"
        )

        print(
            f"Final Status: {decision['status']} | "
            f"Votes: {decision['anomaly_votes']} | "
            f"Action: {decision['action']}"
        )

        print("--------------------------------")

    # Latest record is first because we sorted by _id descending
    latest_record = records[0]
    latest_decision = decisions[0]

    # FIX:
    # update_one() does NOT accept sort=[("_id", -1)].
    # Instead, update the exact latest document using its _id.
    latest_id = latest_record["_id"]

    monitoring_collection.update_one(
        {"_id": latest_id},
        {
            "$set": {
                "decision": {
                    "status": latest_decision["status"],
                    "anomaly_votes": latest_decision["anomaly_votes"],
                    "action": latest_decision["action"],
                    "decided_at": datetime.now(timezone.utc)
                }
            }
        }
    )

    print(
        f"Final Network Status: "
        f"{latest_decision['status']}"
    )

    print(
        f"Recommended Action: "
        f"{latest_decision['action']}"
    )

    print("Decision saved to MongoDB.")


if __name__ == "__main__":
    run_decision_engine()