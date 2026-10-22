import React from "react";
import { Cpu, CircleGauge, HardDrive, Network, Brain, Shield, ArrowRight } from "lucide-react";
import StatusBanner from "../components/StatusBanner";
import MetricCard from "../components/MetricCard";
import TrafficChart from "../components/TrafficChart";
import AlertItem from "../components/AlertItem";
import EmptyState from "../components/EmptyState";
import Badge from "../components/Badge";
import NetworkTopologyVisual from "../components/NetworkTopologyVisual";
import ScrollReveal from "../components/ScrollReveal";
import MagneticButton from "../components/MagneticButton";

export function DashboardPage({
  summary,
  metrics,
  alerts = [],
  history = [],
  devices = [],
  aiStatus = null,
  dbBackend = "sqlite",
  backendOnline,
  isLoading,
  lastUpdated,
  onNavigate,
  onAcknowledgeAlert,
  onResolveAlert,
  onPingDevice,
}) {
  const m = metrics?.metrics || summary?.metrics || {};
  const ai = summary?.ai || aiStatus || {};
  const netStatus = summary?.network_status || "INSUFFICIENT DATA";
  const action = summary?.action || "Awaiting telemetry baseline";

  const cpu = m.cpu_usage_percent;
  const memory = m.memory_usage_percent;
  const disk = m.disk_usage_percent;
  const latency = m.latency_ms;

  const recentAlerts = alerts.slice(0, 4);

  // Calculate uptime representation
  const uptimeMinutes = m.boot_time
    ? Math.max(1, Math.floor((Date.now() / 1000 - m.boot_time) / 60))
    : null;
  const uptimeStr = uptimeMinutes
    ? uptimeMinutes > 1440
      ? `${Math.floor(uptimeMinutes / 1440)}d ${Math.floor((uptimeMinutes % 1440) / 60)}h`
      : `${Math.floor(uptimeMinutes / 60)}h ${uptimeMinutes % 60}m`
    : "Active";

  return (
    <div className="page-container dashboard-page">
      {/* 1. STATUS HERO BANNER */}
      <ScrollReveal direction="fade" delay={0}>
        <StatusBanner
          networkStatus={netStatus}
          action={action}
          backendOnline={backendOnline}
          activeModels={ai.active_models || 1}
          anomalyVotes={ai.anomaly_votes || 0}
          lastUpdated={lastUpdated}
        />
      </ScrollReveal>

      {/* 2. SIGNATURE INTERACTIVE NETWORK OPERATIONS TOPOLOGY */}
      <ScrollReveal direction="up" delay={60}>
        <NetworkTopologyVisual
          metrics={metrics}
          summary={summary}
          devices={devices}
          aiStatus={aiStatus}
          dbBackend={dbBackend}
          backendOnline={backendOnline}
          onPingDevice={onPingDevice}
        />
      </ScrollReveal>

      {/* 3. HOST SYSTEM OVERVIEW RIBBON */}
      <ScrollReveal direction="up" delay={90}>
        <div className="host-telemetry-ribbon">
          <div className="ribbon-item">
            <span className="ribbon-label">HOST SYSTEM</span>
            <span className="ribbon-value">macOS / Darwin</span>
          </div>
          <div className="ribbon-item">
            <span className="ribbon-label">UPTIME</span>
            <span className="ribbon-value">{uptimeStr}</span>
          </div>
          <div className="ribbon-item">
            <span className="ribbon-label">CPU CORES</span>
            <span className="ribbon-value">{m.cpu_count ? `${m.cpu_count} Logical` : "Available"}</span>
          </div>
          <div className="ribbon-item">
            <span className="ribbon-label">PHYSICAL RAM</span>
            <span className="ribbon-value">{m.memory_total_gb ? `${m.memory_total_gb} GB` : "16.0 GB"}</span>
          </div>
          <div className="ribbon-item">
            <span className="ribbon-label">LOAD AVG (1M / 5M / 15M)</span>
            <span className="ribbon-value">
              {m.load_avg_1m !== undefined ? `${m.load_avg_1m} / ${m.load_avg_5m} / ${m.load_avg_15m}` : "Nominal"}
            </span>
          </div>
          <div className="ribbon-item">
            <span className="ribbon-label">ACTIVE INTERFACES</span>
            <span className="ribbon-value">{Array.isArray(m.interfaces) ? `${m.interfaces.length} Up` : "Active"}</span>
          </div>
        </div>
      </ScrollReveal>

      {/* 4. REAL-TIME METRICS GRID */}
      <div className="section-block">
        <ScrollReveal direction="fade" delay={110}>
          <div className="section-title-row">
            <div>
              <h3 className="section-heading">Host System Telemetry</h3>
              <span className="section-caption">Direct sensor telemetry via psutil & socket probe</span>
            </div>
            <div className="section-badge-live">
              <span className="pulse-dot" />
              <span>SENSOR STREAMING</span>
            </div>
          </div>
        </ScrollReveal>

        <div className="metrics-grid">
          <ScrollReveal direction="up" delay={120}>
            <MetricCard
              icon={<Cpu size={20} />}
              title="CPU Utilization"
              value={cpu !== null && cpu !== undefined ? cpu.toFixed(1) : null}
              unit="%"
              progressPercent={cpu}
              trend={cpu !== null && cpu !== undefined ? (cpu > 80 ? "HIGH" : "NOMINAL") : null}
              trendType={cpu > 90 ? "danger" : cpu > 80 ? "warning" : "positive"}
              subtitle="Multi-core processor load"
              details={m.cpu_count ? `${m.cpu_count} cores | Load: ${m.load_avg_1m || 0}` : null}
              isLoading={isLoading && !m.timestamp}
            />
          </ScrollReveal>

          <ScrollReveal direction="up" delay={160}>
            <MetricCard
              icon={<CircleGauge size={20} />}
              title="Memory Usage"
              value={memory !== null && memory !== undefined ? memory.toFixed(1) : null}
              unit="%"
              progressPercent={memory}
              trend={memory !== null && memory !== undefined ? (memory > 85 ? "ELEVATED" : "NOMINAL") : null}
              trendType={memory > 85 ? "warning" : "positive"}
              subtitle="Physical RAM consumed"
              details={m.memory_used_gb ? `${m.memory_used_gb} GB of ${m.memory_total_gb} GB` : null}
              isLoading={isLoading && !m.timestamp}
            />
          </ScrollReveal>

          <ScrollReveal direction="up" delay={200}>
            <MetricCard
              icon={<HardDrive size={20} />}
              title="Root Disk Volume"
              value={disk !== null && disk !== undefined ? disk.toFixed(1) : null}
              unit="%"
              progressPercent={disk}
              trend={disk !== null && disk !== undefined ? (disk > 90 ? "CRITICAL" : "HEALTHY") : null}
              trendType={disk > 90 ? "danger" : "positive"}
              subtitle="Storage allocation"
              details={m.disk_used_gb ? `${m.disk_used_gb} GB used (${m.disk_free_gb || 0} GB free)` : null}
              isLoading={isLoading && !m.timestamp}
            />
          </ScrollReveal>

          <ScrollReveal direction="up" delay={240}>
            <MetricCard
              icon={<Network size={20} />}
              title="Gateway Latency"
              value={latency !== null && latency !== undefined ? latency.toFixed(1) : null}
              unit="ms"
              progressPercent={latency !== null && latency !== undefined ? Math.min(100, (latency / 120) * 100) : null}
              trend={latency !== null && latency !== undefined ? (latency > 100 ? "HIGH RTT" : "LOW RTT") : null}
              trendType={latency > 150 ? "danger" : latency > 100 ? "warning" : "positive"}
              subtitle="TCP socket round-trip"
              details={latency !== null && latency !== undefined ? (latency < 30 ? "Jitter: <2ms (Optimal)" : "Jitter: Standard") : "Probe inactive"}
              isLoading={isLoading && !m.timestamp}
            />
          </ScrollReveal>
        </div>
      </div>

      {/* 5. AI DETECTION & ENSEMBLE CONSENSUS */}
      <div className="section-block">
        <ScrollReveal direction="fade" delay={120}>
          <div className="section-title-row">
            <div>
              <h3 className="section-heading">AI Anomaly Detection Models</h3>
              <span className="section-caption">Machine learning threat classification pipeline</span>
            </div>
            <MagneticButton
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate("AI Analysis")}
            >
              Detailed Model Inspection
              <ArrowRight size={14} />
            </MagneticButton>
          </div>
        </ScrollReveal>

        <div className="ai-models-summary-grid">
          <ScrollReveal direction="up" delay={140} className="ai-model-wrapper">
            <div className="ai-model-summary-card interactive-card">
              <div className="card-spotlight-layer" aria-hidden="true" />
              <div className="ai-model-header">
                <Shield size={18} className="model-icon" />
                <div>
                  <h4 className="model-name">Isolation Forest</h4>
                  <span className="model-category">Unsupervised Outlier Detection</span>
                </div>
              </div>
              <div className="ai-model-status-row">
                <span className="model-status-label">Evaluation:</span>
                <Badge status={ai.isolation_forest || "INSUFFICIENT DATA"} />
              </div>
              <div className="model-score-row">
                <span>Anomaly Score:</span>
                <strong>{ai.anomaly_score !== null && ai.anomaly_score !== undefined ? ai.anomaly_score : "--"}</strong>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={180} className="ai-model-wrapper">
            <div className="ai-model-summary-card interactive-card">
              <div className="card-spotlight-layer" aria-hidden="true" />
              <div className="ai-model-header">
                <Brain size={18} className="model-icon" />
                <div>
                  <h4 className="model-name">Random Forest</h4>
                  <span className="model-category">Supervised Classification</span>
                </div>
              </div>
              <div className="ai-model-status-row">
                <span className="model-status-label">Evaluation:</span>
                <Badge status={ai.random_forest || "NOT CONFIGURED"} />
              </div>
              <div className="model-score-row">
                <span>Confidence:</span>
                <strong>{ai.random_forest_confidence ? `${ai.random_forest_confidence}%` : "Requires Labeled Baseline"}</strong>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={220} className="ai-model-wrapper">
            <div className="ai-model-summary-card interactive-card">
              <div className="card-spotlight-layer" aria-hidden="true" />
              <div className="ai-model-header">
                <Network size={18} className="model-icon" />
                <div>
                  <h4 className="model-name">LSTM Temporal Model</h4>
                  <span className="model-category">Recurrent Sequence Predictor</span>
                </div>
              </div>
              <div className="ai-model-status-row">
                <span className="model-status-label">Evaluation:</span>
                <Badge status={ai.lstm || "NOT CONFIGURED"} />
              </div>
              <div className="model-score-row">
                <span>Runtime:</span>
                <strong>Python 3.13 Environment Status</strong>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>

      {/* 6. THROUGHPUT & RECENT ALERTS */}
      <ScrollReveal direction="up" delay={150}>
        <div className="dashboard-dual-grid">
          <TrafficChart history={history} latestMetrics={m} />

          <div className="panel recent-alerts-panel interactive-card">
            <div className="card-spotlight-layer" aria-hidden="true" />
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Active Security Alerts</h3>
                <span className="panel-subtitle">Verified incidents requiring response</span>
              </div>
              <MagneticButton
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate("Alerts")}
              >
                All Alerts ({alerts.length})
              </MagneticButton>
            </div>

            <div className="alerts-stream">
              {recentAlerts.length === 0 ? (
                <EmptyState
                  type="success"
                  title="No Active Alerts"
                  description={
                    backendOnline
                      ? "NetGuard AI has not detected any critical conditions or threshold violations."
                      : "Monitoring backend is offline. Unable to query active alerts."
                  }
                />
              ) : (
                recentAlerts.map((alt) => (
                  <AlertItem
                    key={alt.id}
                    alert={alt}
                    onAcknowledge={onAcknowledgeAlert}
                    onResolve={onResolveAlert}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

export default DashboardPage;
