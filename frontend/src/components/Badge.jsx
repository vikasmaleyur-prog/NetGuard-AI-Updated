import React from "react";

export function Badge({ status, variant, children, className = "" }) {
  const value = status || children || "UNKNOWN";
  const normalized = String(value).toUpperCase();

  let styleClass = "badge-neutral";
  if (normalized === "NORMAL" || normalized === "ONLINE" || normalized === "HEALTHY" || normalized === "RESOLVED" || normalized === "ACTIVE" || variant === "success") {
    styleClass = "badge-success";
  } else if (normalized === "WARNING" || normalized === "DEGRADED" || normalized === "STANDBY" || variant === "warning") {
    styleClass = "badge-warning";
  } else if (normalized === "CRITICAL" || normalized === "OFFLINE" || normalized === "ANOMALY" || normalized === "ERROR" || variant === "danger") {
    styleClass = "badge-danger";
  } else if (normalized === "INSUFFICIENT DATA" || normalized === "NOT CONFIGURED" || normalized === "NOT EVALUATED" || normalized === "PENDING" || variant === "info") {
    styleClass = "badge-info";
  }

  return (
    <span className={`status-badge ${styleClass} ${className}`}>
      <span className="badge-dot" />
      {children || normalized}
    </span>
  );
}

export default Badge;
