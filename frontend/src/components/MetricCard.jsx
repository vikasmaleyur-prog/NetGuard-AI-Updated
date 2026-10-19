import React from "react";

export function MetricCard({
  icon,
  title,
  value,
  unit = "",
  trend,
  trendType = "neutral", // "positive", "negative", "neutral", "danger"
  subtitle,
  progressPercent,
  details,
  isLoading = false,
  className = "",
}) {
  const isAvailable = value !== null && value !== undefined && value !== "";
  const displayValue = isAvailable ? value : "--";

  let trendClass = "trend-neutral";
  if (trendType === "positive") trendClass = "trend-positive";
  else if (trendType === "danger") trendClass = "trend-danger";
  else if (trendType === "warning") trendClass = "trend-warning";

  let barClass = "bar-normal";
  if (progressPercent !== undefined && progressPercent !== null) {
    if (progressPercent > 90) barClass = "bar-danger";
    else if (progressPercent > 75) barClass = "bar-warning";
  }

  return (
    <div className={`metric-card ${className}`}>
      <div className="metric-header">
        <div className="metric-icon-wrap" aria-hidden="true">
          {icon}
        </div>
        <div className="metric-meta">
          <span className="metric-title">{title}</span>
          {subtitle && <span className="metric-subtitle">{subtitle}</span>}
        </div>
        {trend && (
          <span className={`metric-trend-badge ${trendClass}`}>
            {trend}
          </span>
        )}
      </div>

      <div className="metric-body">
        {isLoading ? (
          <div className="skeleton skeleton-value" />
        ) : (
          <>
            <div className="metric-value-wrap">
              <span className="metric-value-text">{displayValue}</span>
              {isAvailable && unit && <span className="metric-unit">{unit}</span>}
              {!isAvailable && (
                <span className="metric-unavailable-text">UNAVAILABLE</span>
              )}
            </div>

            {progressPercent !== undefined && progressPercent !== null && !isNaN(progressPercent) && (
              <div className="metric-progress-track">
                <div
                  className={`metric-progress-bar ${barClass}`}
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>
            )}

            {details && (
              <div className="metric-details-text">
                {details}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default MetricCard;
