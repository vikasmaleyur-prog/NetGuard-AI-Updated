import React, { useState, useEffect } from "react";
import { Save, RefreshCw, CheckCircle, AlertTriangle, Shield, Sliders, Wifi, Sun, Moon } from "lucide-react";
import Badge from "../components/Badge";
import api from "../api/client";

export function SettingsPage({
  autoRefresh,
  setAutoRefresh,
  refreshInterval,
  setRefreshInterval,
  backendOnline,
  dbBackend = "sqlite",
  theme = "light",
  onToggleTheme,
  onRefreshAll,
}) {
  const [cpuWarning, setCpuWarning] = useState(80);
  const [cpuCritical, setCpuCritical] = useState(95);
  const [memWarning, setMemWarning] = useState(85);
  const [latencyWarning, setLatencyWarning] = useState(100);
  const [activeCollector, setActiveCollector] = useState(true);

  const [testEndpoint, setTestEndpoint] = useState(api.baseUrl);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Load current settings from backend
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await api.getSettings();
        if (res.ok && res.data) {
          const s = res.data;
          if (s.refresh_interval !== undefined && setRefreshInterval) {
            setRefreshInterval(s.refresh_interval);
          }
          if (s.cpu_warning_threshold !== undefined) setCpuWarning(s.cpu_warning_threshold);
          if (s.cpu_critical_threshold !== undefined) setCpuCritical(s.cpu_critical_threshold);
          if (s.memory_warning_threshold !== undefined) setMemWarning(s.memory_warning_threshold);
          if (s.latency_warning_threshold !== undefined) setLatencyWarning(s.latency_warning_threshold);
          if (s.active_collector !== undefined) setActiveCollector(s.active_collector);
        }
      } catch {
        // Fallback to defaults
      }
    }
    loadSettings();
  }, [backendOnline, setRefreshInterval]);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setFeedback(null);

    // Validation
    if (cpuWarning >= cpuCritical) {
      setFeedback({
        type: "error",
        message: "CPU Warning threshold must be strictly lower than the Critical threshold.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.updateSettings({
        auto_refresh: autoRefresh,
        refresh_interval: Number(refreshInterval),
        cpu_warning_threshold: Number(cpuWarning),
        cpu_critical_threshold: Number(cpuCritical),
        memory_warning_threshold: Number(memWarning),
        latency_warning_threshold: Number(latencyWarning),
        active_collector: activeCollector,
      });

      if (res.ok) {
        setFeedback({
          type: "success",
          message: "Configuration successfully saved and applied to telemetry daemon.",
        });
      } else {
        setFeedback({
          type: "error",
          message: res.error || "Failed to persist configuration to backend.",
        });
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to communicate with settings endpoint.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const tempClient = new (api.constructor)(testEndpoint);
      const res = await tempClient.getHealth();
      const elapsed = (performance.now() - start).toFixed(1);

      if (res.ok) {
        setTestResult({
          ok: true,
          message: `Connected successfully (${elapsed} ms latency). Backend status: ${res.data.status}`,
          details: res.data,
        });
      } else {
        setTestResult({
          ok: false,
          message: `Endpoint responded with status ${res.status}: ${res.error}`,
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: `Connection failed: ${err.message}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="page-container settings-page">
      {/* FEEDBACK ALERT */}
      {feedback && (
        <div className={`settings-alert-banner ${feedback.type === "success" ? "alert-success" : "alert-error"}`}>
          {feedback.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 0. CONSOLE APPEARANCE & THEME (HUEL UK WHITE / DARK OPS) */}
      <div className="panel settings-panel mb-4">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Console Visual Theme</h3>
            <span className="panel-subtitle">Select between clean Huel-inspired high-contrast white and dark ops console</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge status={theme === "light" ? "healthy" : "info"} label={theme === "light" ? "HUEL WHITE ACTIVE" : "DARK OPS ACTIVE"} />
          </div>
        </div>
        <div className="theme-selector-grid">
          <div
            className={`theme-card-option ${theme === "light" ? "selected" : ""}`}
            onClick={() => onToggleTheme && theme !== "light" && onToggleTheme()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onToggleTheme && theme !== "light" && onToggleTheme()}
          >
            <div className="theme-card-preview theme-preview-huel">
              <div className="preview-topbar" />
              <div className="preview-body">
                <div className="preview-sidebar" />
                <div className="preview-content">
                  <div className="preview-card" />
                  <div className="preview-card" />
                </div>
              </div>
            </div>
            <div className="theme-card-info">
              <div className="theme-card-title-row">
                <Sun size={16} className="text-amber" />
                <span className="theme-card-name">Huel White (Default)</span>
                {theme === "light" && <Badge status="healthy" label="CURRENT" />}
              </div>
              <p className="theme-card-desc">
                Clean, minimalist, high-contrast black and white aesthetic inspired by Huel UK. Pure white surfaces, jet-black typography, and razor-sharp borders.
              </p>
            </div>
          </div>

          <div
            className={`theme-card-option ${theme === "dark" ? "selected" : ""}`}
            onClick={() => onToggleTheme && theme !== "dark" && onToggleTheme()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onToggleTheme && theme !== "dark" && onToggleTheme()}
          >
            <div className="theme-card-preview theme-preview-dark">
              <div className="preview-topbar" />
              <div className="preview-body">
                <div className="preview-sidebar" />
                <div className="preview-content">
                  <div className="preview-card" />
                  <div className="preview-card" />
                </div>
              </div>
            </div>
            <div className="theme-card-info">
              <div className="theme-card-title-row">
                <Moon size={16} className="text-blue" />
                <span className="theme-card-name">Dark Operations Console</span>
                {theme === "dark" && <Badge status="info" label="CURRENT" />}
              </div>
              <p className="theme-card-desc">
                Low-emissivity deep navy and slate colorway designed for darkened security operations centers (SOC) and night telemetry monitoring.
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="settings-form-layout">
        {/* 1. MONITORING & POLLING CONFIG */}
        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Telemetry & Polling Behavior</h3>
              <span className="panel-subtitle">Controls dashboard data ingestion frequency</span>
            </div>
            <Sliders size={18} className="text-blue" />
          </div>

          <div className="settings-group-stack">
            {/* Auto Refresh Toggle */}
            <div className="setting-control-row">
              <div className="setting-label-col">
                <span className="setting-title">Automatic Dashboard Polling</span>
                <span className="setting-desc">Periodically fetch latest metrics from FastAPI backend</span>
              </div>
              <div className="setting-input-col">
                <button
                  type="button"
                  className={`switch-toggle ${autoRefresh ? "active" : ""}`}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  role="switch"
                  aria-checked={autoRefresh}
                  aria-label="Automatic dashboard polling toggle"
                >
                  <span className="switch-handle" />
                </button>
                <span className="switch-status-label">{autoRefresh ? "ENABLED" : "PAUSED"}</span>
              </div>
            </div>

            {/* Ingestion Interval */}
            <div className="setting-control-row">
              <div className="setting-label-col">
                <label htmlFor="refresh-interval-select" className="setting-title">Polling Frequency</label>
                <span className="setting-desc">Interval between automated telemetry queries</span>
              </div>
              <div className="setting-input-col">
                <select
                  id="refresh-interval-select"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="form-select setting-input-control"
                  disabled={!autoRefresh}
                >
                  <option value={2}>2 Seconds (Rapid Diagnostic)</option>
                  <option value={5}>5 Seconds (Recommended)</option>
                  <option value={10}>10 Seconds (Low Overhead)</option>
                  <option value={30}>30 Seconds (Bandwidth Conservative)</option>
                  <option value={60}>60 Seconds (Passive)</option>
                </select>
              </div>
            </div>

            {/* Daemon Collector Toggle */}
            <div className="setting-control-row">
              <div className="setting-label-col">
                <span className="setting-title">Host Telemetry Ingestion Daemon</span>
                <span className="setting-desc">Allow backend background thread to execute kernel sensor probes</span>
              </div>
              <div className="setting-input-col">
                <button
                  type="button"
                  className={`switch-toggle ${activeCollector ? "active" : ""}`}
                  onClick={() => setActiveCollector(!activeCollector)}
                  role="switch"
                  aria-checked={activeCollector}
                  aria-label="Host telemetry daemon toggle"
                >
                  <span className="switch-handle" />
                </button>
                <span className="switch-status-label">{activeCollector ? "RUNNING" : "STOPPED"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. ALERT THRESHOLDS */}
        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Automated Incident Alert Thresholds</h3>
              <span className="panel-subtitle">Configure thresholds that trigger WARNING or CRITICAL incidents</span>
            </div>
            <Shield size={18} className="text-blue" />
          </div>

          <div className="settings-group-stack">
            {/* CPU Warning */}
            <div className="setting-control-row">
              <div className="setting-label-col">
                <label htmlFor="cpu-warn-input" className="setting-title">CPU Warning Threshold (%)</label>
                <span className="setting-desc">Elevates system state to WARNING when reached</span>
              </div>
              <div className="setting-input-col">
                <input
                  id="cpu-warn-input"
                  type="number"
                  min={10}
                  max={99}
                  value={cpuWarning}
                  onChange={(e) => setCpuWarning(Number(e.target.value))}
                  className="form-input setting-input-number"
                />
                <span className="input-unit-label">%</span>
              </div>
            </div>

            {/* CPU Critical */}
            <div className="setting-control-row">
              <div className="setting-label-col">
                <label htmlFor="cpu-crit-input" className="setting-title">CPU Critical Threshold (%)</label>
                <span className="setting-desc">Triggers CRITICAL incident and self-healing review</span>
              </div>
              <div className="setting-input-col">
                <input
                  id="cpu-crit-input"
                  type="number"
                  min={10}
                  max={100}
                  value={cpuCritical}
                  onChange={(e) => setCpuCritical(Number(e.target.value))}
                  className="form-input setting-input-number"
                />
                <span className="input-unit-label">%</span>
              </div>
            </div>

            {/* Memory Warning */}
            <div className="setting-control-row">
              <div className="setting-label-col">
                <label htmlFor="mem-warn-input" className="setting-title">Memory Warning Threshold (%)</label>
                <span className="setting-desc">Triggers RAM consumption alert</span>
              </div>
              <div className="setting-input-col">
                <input
                  id="mem-warn-input"
                  type="number"
                  min={10}
                  max={100}
                  value={memWarning}
                  onChange={(e) => setMemWarning(Number(e.target.value))}
                  className="form-input setting-input-number"
                />
                <span className="input-unit-label">%</span>
              </div>
            </div>

            {/* Latency Warning */}
            <div className="setting-control-row">
              <div className="setting-label-col">
                <label htmlFor="lat-warn-input" className="setting-title">Network Round-Trip Threshold (ms)</label>
                <span className="setting-desc">Triggers network latency degradation notice</span>
              </div>
              <div className="setting-input-col">
                <input
                  id="lat-warn-input"
                  type="number"
                  min={5}
                  max={2000}
                  value={latencyWarning}
                  onChange={(e) => setLatencyWarning(Number(e.target.value))}
                  className="form-input setting-input-number"
                />
                <span className="input-unit-label">ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. BACKEND CONNECTIVITY & ENDPOINT TESTING */}
        <div className="panel settings-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Backend Connectivity & Diagnostics</h3>
              <span className="panel-subtitle">FastAPI daemon communications and persistence engine</span>
            </div>
            <Wifi size={18} className="text-blue" />
          </div>

          <div className="settings-group-stack">
            <div className="setting-control-row">
              <div className="setting-label-col">
                <span className="setting-title">Current Connection State</span>
                <span className="setting-desc">Local interface heartbeat</span>
              </div>
              <div className="setting-input-col">
                <Badge status={backendOnline ? "ONLINE" : "OFFLINE"} />
                <span className="setting-conn-detail">
                  Storage Backend: <strong>{dbBackend.toUpperCase()}</strong>
                </span>
              </div>
            </div>

            <div className="setting-control-row">
              <div className="setting-label-col">
                <label htmlFor="api-endpoint-input" className="setting-title">Target API Endpoint URL</label>
                <span className="setting-desc">Configured via environment variable VITE_API_BASE_URL</span>
              </div>
              <div className="setting-input-col-block">
                <div className="endpoint-test-wrap">
                  <input
                    id="api-endpoint-input"
                    type="url"
                    value={testEndpoint}
                    onChange={(e) => setTestEndpoint(e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                  >
                    <RefreshCw size={13} className={isTesting ? "refresh-spin" : ""} />
                    {isTesting ? "Testing..." : "Test Connection"}
                  </button>
                </div>

                {testResult && (
                  <div className={`endpoint-test-result ${testResult.ok ? "test-success" : "test-fail"}`}>
                    {testResult.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="setting-control-row">
              <div className="setting-label-col">
                <span className="setting-title">Manual Data Refresh</span>
                <span className="setting-desc">Immediately poll all metrics, alerts, devices, and AI analysis</span>
              </div>
              <div className="setting-input-col">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onRefreshAll}
                >
                  <RefreshCw size={13} />
                  Execute Full Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* FORM SUBMISSION BAR */}
        <div className="settings-submit-bar">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSaving}
          >
            <Save size={15} className={isSaving ? "refresh-spin" : ""} />
            {isSaving ? "Saving Configuration..." : "Save System Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SettingsPage;
