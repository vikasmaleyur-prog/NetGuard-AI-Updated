import React from "react";
import { AlertCircle, AlertTriangle, Info, Check, CheckCheck } from "lucide-react";
import Badge from "./Badge";

export function AlertItem({ alert, onAcknowledge, onResolve, isUpdating = false }) {
  if (!alert) return null;

  const severity = (alert.severity || "INFO").toUpperCase();
  const isCritical = severity === "CRITICAL";
  const isWarning = severity === "WARNING";
  const isResolved = alert.resolved;
  const isAcknowledged = alert.acknowledged;

  let Icon = Info;
  let severityClass = "alert-info";

  if (isCritical) {
    Icon = AlertCircle;
    severityClass = "alert-critical";
  } else if (isWarning) {
    Icon = AlertTriangle;
    severityClass = "alert-warning";
  }

  const timeStr = alert.timestamp
    ? new Date(alert.timestamp).toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Unknown timestamp";

  return (
    <div className={`alert-card ${severityClass} ${isResolved ? "alert-resolved" : ""}`}>
      <div className="alert-card-left">
        <div className="alert-icon-box" aria-hidden="true">
          <Icon size={18} />
        </div>
      </div>

      <div className="alert-card-content">
        <div className="alert-header-row">
          <div className="alert-title-wrap">
            <h4 className="alert-title">{alert.title}</h4>
            <Badge status={severity} />
            {isResolved && <Badge variant="success">RESOLVED</Badge>}
            {isAcknowledged && !isResolved && <Badge variant="info">ACKNOWLEDGED</Badge>}
          </div>
          <span className="alert-time">{timeStr}</span>
        </div>

        <p className="alert-message">{alert.message}</p>

        <div className="alert-footer-row">
          <span className="alert-source">
            Source: <strong>{alert.source || "System"}</strong>
          </span>

          <div className="alert-actions">
            {!isAcknowledged && !isResolved && onAcknowledge && (
              <button
                type="button"
                className="btn-action btn-sm btn-secondary"
                onClick={() => onAcknowledge(alert.id)}
                disabled={isUpdating}
                title="Acknowledge alert"
              >
                <Check size={13} />
                Acknowledge
              </button>
            )}

            {!isResolved && onResolve && (
              <button
                type="button"
                className="btn-action btn-sm btn-primary"
                onClick={() => onResolve(alert.id)}
                disabled={isUpdating}
                title="Mark alert as resolved"
              >
                <CheckCheck size={13} />
                Resolve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlertItem;
