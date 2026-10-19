import React from "react";
import { ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle } from "lucide-react";
import Badge from "./Badge";

export function StatusBanner({
  networkStatus = "INSUFFICIENT DATA",
  action = "Collecting telemetry",
  backendOnline = false,
  activeModels = 0,
  anomalyVotes = 0,
  lastUpdated = null,
}) {
  const normStatus = String(networkStatus).toUpperCase();
  const isNormal = normStatus === "NORMAL";
  const isWarning = normStatus === "WARNING";
  const isCritical = normStatus === "CRITICAL";

  let bannerClass = "banner-insufficient";
  let Icon = HelpCircle;
  let statusSummary = "Awaiting verification data from telemetry collector";

  if (!backendOnline) {
    bannerClass = "banner-critical";
    Icon = AlertOctagon;
    statusSummary = "Telemetry service unreachable. Reconnecting to local daemon...";
  } else if (isCritical) {
    bannerClass = "banner-critical";
    Icon = AlertOctagon;
    statusSummary = "Immediate attention required. Multiple anomaly detectors triggered.";
  } else if (isWarning) {
    bannerClass = "banner-warning";
    Icon = AlertTriangle;
    statusSummary = "Network variance detected. System monitoring for escalation.";
  } else if (isNormal) {
    bannerClass = "banner-normal";
    Icon = ShieldCheck;
    statusSummary = "All monitored metrics operating within baseline parameters.";
  }

  return (
    <section className={`status-hero-banner ${bannerClass}`}>
      <div className="status-hero-main">
        <div className="status-kicker-row">
          <span className="status-kicker">NETWORK OPERATIONS STATUS</span>
          <Badge status={backendOnline ? normStatus : "OFFLINE"} />
        </div>

        <div className="status-headline">
          <div className="status-icon-wrap" aria-hidden="true">
            <Icon size={28} />
          </div>
          <div>
            <h2 className="status-title">{backendOnline ? normStatus : "BACKEND DISCONNECTED"}</h2>
            <p className="status-description">{statusSummary}</p>
          </div>
        </div>

        <div className="status-meta-grid">
          <div className="status-meta-item">
            <span className="meta-label">RECOMMENDED ACTION</span>
            <strong className="meta-value">{action || "None required"}</strong>
          </div>

          <div className="status-meta-item">
            <span className="meta-label">MODEL CONSENSUS</span>
            <strong className="meta-value">
              {activeModels > 0
                ? `${anomalyVotes} of ${activeModels} active models flagged variance`
                : "No active models trained"}
            </strong>
          </div>

          <div className="status-meta-item">
            <span className="meta-label">TELEMETRY SOURCE</span>
            <strong className="meta-value">
              {lastUpdated ? `Verified at ${new Date(lastUpdated).toLocaleTimeString()}` : "Awaiting baseline sample"}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StatusBanner;
