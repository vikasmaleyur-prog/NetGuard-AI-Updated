import React from "react";
import { ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle } from "lucide-react";
import Badge from "./Badge";
import useTilt from "../hooks/useTilt";

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

  const bannerRef = useTilt({ maxTilt: 2.5, perspective: 1200, scale: 1.006, glow: true });

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
    <section
      ref={bannerRef}
      className={`status-hero-banner interactive-card ${bannerClass}`}
    >
      {/* Background Architectural Grid Lines */}
      <div className="status-grid-overlay" aria-hidden="true" />
      <div className="card-spotlight-layer" aria-hidden="true" />

      <div className="status-hero-main">
        <div className="status-kicker-row">
          <div className="status-kicker-beacon">
            <span className="beacon-ping" />
            <span className="status-kicker">NETWORK OPERATIONS STATUS</span>
          </div>
          <Badge status={backendOnline ? normStatus : "OFFLINE"} />
        </div>

        <div className="status-headline">
          <div className="status-icon-wrap" aria-hidden="true">
            <Icon size={30} />
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
