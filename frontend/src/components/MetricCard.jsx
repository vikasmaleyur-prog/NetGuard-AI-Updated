import React from "react";
import useTilt from "../hooks/useTilt";
import AnimatedCounter from "./AnimatedCounter";

export function MetricCard({
  icon,
  title,
  value,
  unit = "",
  trend,
  trendType = "neutral", // "positive", "negative", "neutral", "danger", "warning"
  subtitle,
  progressPercent,
  details,
  isLoading = false,
  className = "",
}) {
  const cardRef = useTilt({ maxTilt: 5, perspective: 850, scale: 1.018, glow: true });

  const isNumeric = value !== null && value !== undefined && !isNaN(Number(value)) && value !== "";
  const isAvailable = value !== null && value !== undefined && value !== "";
  const numericVal = isNumeric ? Number(value) : null;

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
    <div
      ref={cardRef}
      className={`metric-card interactive-card ${className}`}
    >
      {/* Dynamic Cursor Spotlight Radial Overlay */}
      <div className="card-spotlight-layer" aria-hidden="true" />

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
              {isNumeric ? (
                <span className="metric-value-text">
                  <AnimatedCounter value={numericVal} decimals={1} />
                </span>
              ) : (
                <span className="metric-value-text">{isAvailable ? value : "--"}</span>
              )}

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
