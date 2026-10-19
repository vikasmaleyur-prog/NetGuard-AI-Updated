import React from "react";
import { Cpu, CircleGauge, HardDrive, Network, Brain, Shield, ArrowRight } from "lucide-react";
import StatusBanner from "../components/StatusBanner";
import MetricCard from "../components/MetricCard";
import TrafficChart from "../components/TrafficChart";
import AlertItem from "../components/AlertItem";
import EmptyState from "../components/EmptyState";
import Badge from "../components/Badge";

export function DashboardPage({
  summary,
  metrics,
  alerts = [],
  history = [],
  backendOnline,
  isLoading,
  lastUpdated,
  onNavigate,
  onAcknowledgeAlert,
  onResolveAlert,
}) {
  const m = metrics?.metrics || summary?.metrics || {};
  const ai = summary?.ai || {};
  const netStatus = summary?.network_status || "INSUFFICIENT DATA";
  const action = summary?.action || "Awaiting telemetry baseline";

  const cpu = m.cpu_usage_percent;
  const memory = m.memory_usage_percent;
  const disk = m.disk_usage_percent;
  const latency = m.latency_ms;

  const recentAlerts = alerts.slice(0, 4);

  return (
    <div className="page-container dashboard-page">
      {/* 1. STATUS HERO BANNER */}
      <StatusBanner
        networkStatus={netStatus}
        action={action}
        backendOnline={backendOnline}
        activeModels={ai.active_models || 1}
        anomalyVotes={ai.anomaly_votes || 0}
        lastUpdated={lastUpdated}
      />

      {/* 2. REAL-TIME METRICS GRID */}
      <div className="section-block">
        <div className="section-title-row">
          <h3 className="section-heading">Host System Telemetry</h3>
          <span className="section-caption">Direct sensor telemetry via psutil & socket ping</span>
        </div>

        <div className="metrics-grid">
          <MetricCard
            icon={<Cpu size={20} />}
            title="CPU Utilization"
            value={cpu !== null && cpu !== undefined ? cpu.toFixed(1) : null}
            unit="%"
            trend={cpu !== null && cpu !== undefined ? (cpu > 80 ? "HIGH" : "NOMINAL") : null}
            trendType={cpu > 90 ? "danger" : cpu > 80 ? "warning" : "positive"}
            subtitle="Host multi-core load"
            isLoading={isLoading && !m.timestamp}
          />

          <MetricCard
            icon={<CircleGauge size={20} />}
            title="Memory Usage"
            value={memory !== null && memory !== undefined ? memory.toFixed(1) : null}
            unit="%"
            trend={memory !== null && memory !== undefined ? (memory > 85 ? "ELEVATED" : "NOMINAL") : null}
            trendType={memory > 85 ? "warning" : "positive"}
            subtitle="Physical RAM consumed"
            isLoading={isLoading && !m.timestamp}
          />

          <MetricCard
            icon={<HardDrive size={20} />}
            title="Root Disk Volume"
            value={disk !== null && disk !== undefined ? disk.toFixed(1) : null}
            unit="%"
            trend={disk !== null && disk !== undefined ? (disk > 90 ? "CRITICAL" : "HEALTHY") : null}
            trendType={disk > 90 ? "danger" : "positive"}
            subtitle="Storage allocation"
            isLoading={isLoading && !m.timestamp}
          />

          <MetricCard
            icon={<Network size={20} />}
            title="Gateway / DNS Latency"
            value={latency !== null && latency !== undefined ? latency.toFixed(1) : null}
            unit="ms"
            trend={latency !== null && latency !== undefined ? (latency > 100 ? "HIGH RTT" : "LOW RTT") : null}
            trendType={latency > 150 ? "danger" : latency > 100 ? "warning" : "positive"}
            subtitle="TCP socket round-trip"
            isLoading={isLoading && !m.timestamp}
          />
        </div>
      </div>

      {/* 3. AI DETECTION & ENSEMBLE CONSENSUS */}
      <div className="section-block">
        <div className="section-title-row">
          <div>
            <h3 className="section-heading">AI Anomaly Detection Models</h3>
            <span className="section-caption">Machine learning threat classification pipeline</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate("AI Analysis")}
          >
            Detailed Model Inspection
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="ai-models-summary-grid">
          <div className="ai-model-summary-card">
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

          <div className="ai-model-summary-card">
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

          <div className="ai-model-summary-card">
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
        </div>
      </div>

      {/* 4. THROUGHPUT & RECENT ALERTS */}
      <div className="dashboard-dual-grid">
        <TrafficChart history={history} latestMetrics={m} />

        <div className="panel recent-alerts-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Active Security Alerts</h3>
              <span className="panel-subtitle">Verified incidents requiring response</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate("Alerts")}
            >
              All Alerts ({alerts.length})
            </button>
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
    </div>
  );
}

export default DashboardPage;
