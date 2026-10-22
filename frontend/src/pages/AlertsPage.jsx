import React, { useState, useEffect } from "react";
import { Search, Plus, Wrench, Play, CheckCircle2, Clock, AlertTriangle, Shield, RotateCcw } from "lucide-react";
import AlertItem from "../components/AlertItem";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import Badge from "../components/Badge";
import api from "../api/client";

export function AlertsPage({
  alerts = [],
  backendOnline,
  onAcknowledgeAlert,
  onResolveAlert,
  onCreateAlert,
}) {
  const [activeTab, setActiveTab] = useState("alerts"); // "alerts" | "recovery"
  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ACTIVE"); // "ACTIVE", "RESOLVED", "ALL"
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSeverity, setNewSeverity] = useState("WARNING");
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newSource, setNewSource] = useState("SecOps Manual");

  // Recovery State
  const [recoveryActions, setRecoveryActions] = useState([]);
  const [recoveryHistory, setRecoveryHistory] = useState([]);
  const [recoveryStatus, setRecoveryStatus] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [recoveryFeedback, setRecoveryFeedback] = useState(null);

  const fetchRecoveryData = async () => {
    try {
      const [actionsRes, historyRes, statusRes] = await Promise.all([
        api.getRecoveryActions(),
        api.getRecoveryHistory(30),
        api.getRecoveryStatus(),
      ]);
      if (actionsRes.ok && actionsRes.data) {
        setRecoveryActions(actionsRes.data.actions || []);
      }
      if (historyRes.ok && historyRes.data) {
        setRecoveryHistory(historyRes.data.actions || []);
      }
      if (statusRes.ok && statusRes.data) {
        setRecoveryStatus(statusRes.data);
      }
    } catch (err) {
      console.warn("Failed to fetch recovery data:", err);
    }
  };

  useEffect(() => {
    if (backendOnline) {
      fetchRecoveryData();
    }
  }, [backendOnline, activeTab]);

  const handleTriggerAction = async (actionKey, mode = "DRY_RUN") => {
    setActionInProgress(actionKey);
    setRecoveryFeedback(null);
    try {
      const res = await api.triggerRecoveryAction(actionKey, mode);
      if (res.ok && res.data) {
        setRecoveryFeedback({
          type: res.data.status === "FAILED" ? "error" : "success",
          data: res.data,
        });
        fetchRecoveryData();
      } else {
        setRecoveryFeedback({
          type: "error",
          message: res.error || "Action execution failed",
        });
      }
    } catch (err) {
      setRecoveryFeedback({
        type: "error",
        message: err.message || "Failed to trigger recovery action",
      });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleApproveAction = async (actionId) => {
    setActionInProgress(actionId);
    try {
      const res = await api.approveRecoveryAction(actionId);
      if (res.ok && res.data) {
        setRecoveryFeedback({
          type: "success",
          data: res.data,
        });
        fetchRecoveryData();
      }
    } catch (err) {
      console.warn("Approval error:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredAlerts = alerts.filter((alt) => {
    if (filterSeverity !== "ALL" && (alt.severity || "INFO").toUpperCase() !== filterSeverity) {
      return false;
    }
    if (filterStatus === "ACTIVE" && alt.resolved) return false;
    if (filterStatus === "RESOLVED" && !alt.resolved) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (alt.title || "").toLowerCase().includes(q);
      const matchMsg = (alt.message || "").toLowerCase().includes(q);
      const matchSrc = (alt.source || "").toLowerCase().includes(q);
      if (!matchTitle && !matchMsg && !matchSrc) return false;
    }

    return true;
  });

  const criticalCount = alerts.filter((a) => (a.severity || "").toUpperCase() === "CRITICAL" && !a.resolved).length;
  const warningCount = alerts.filter((a) => (a.severity || "").toUpperCase() === "WARNING" && !a.resolved).length;
  const infoCount = alerts.filter((a) => (a.severity || "").toUpperCase() === "INFO" && !a.resolved).length;

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) return;
    await onCreateAlert({
      severity: newSeverity,
      title: newTitle.trim(),
      message: newMessage.trim(),
      source: newSource.trim(),
    });
    setNewTitle("");
    setNewMessage("");
    setIsModalOpen(false);
  };

  return (
    <div className="page-container alerts-page">
      {/* 1. SEVERITY SUMMARY CARDS */}
      <div className="alerts-summary-grid">
        <div className="alert-count-card count-critical" onClick={() => { setActiveTab("alerts"); setFilterSeverity("CRITICAL"); }}>
          <span className="count-label">Active Critical</span>
          <strong className="count-value">{criticalCount}</strong>
          <span className="count-sub">High priority events</span>
        </div>

        <div className="alert-count-card count-warning" onClick={() => { setActiveTab("alerts"); setFilterSeverity("WARNING"); }}>
          <span className="count-label">Active Warnings</span>
          <strong className="count-value">{warningCount}</strong>
          <span className="count-sub">Potential degradation</span>
        </div>

        <div className="alert-count-card count-info" onClick={() => { setActiveTab("alerts"); setFilterSeverity("INFO"); }}>
          <span className="count-label">Informational</span>
          <strong className="count-value">{infoCount}</strong>
          <span className="count-sub">System notices</span>
        </div>

        <div className="alert-count-card count-total" onClick={() => { setActiveTab("recovery"); }}>
          <span className="count-label">Self-Healing Actions</span>
          <strong className="count-value">{recoveryHistory.length}</strong>
          <span className="count-sub">Audited remediations</span>
        </div>
      </div>

      {/* 2. TAB SELECTOR */}
      <div className="alerts-tabs-bar">
        <button
          type="button"
          className={`alerts-tab-btn ${activeTab === "alerts" ? "active" : ""}`}
          onClick={() => setActiveTab("alerts")}
        >
          <Shield size={16} />
          <span>Security Incidents ({filteredAlerts.length})</span>
        </button>
        <button
          type="button"
          className={`alerts-tab-btn ${activeTab === "recovery" ? "active" : ""}`}
          onClick={() => setActiveTab("recovery")}
        >
          <Wrench size={16} />
          <span>Self-Healing & Remediation Center ({recoveryActions.length} Actions)</span>
        </button>
      </div>

      {activeTab === "alerts" ? (
        /* ALERTS STREAM TAB */
        <div className="panel alerts-panel">
          <div className="panel-header">
            <div>
              <h3 className="panel-title">Incident Stream</h3>
              <span className="panel-subtitle">Persisted security alerts and threshold triggers</span>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsModalOpen(true)}
              title="Create manual security alert"
            >
              <Plus size={14} />
              Create Alert
            </button>
          </div>

          <div className="alerts-filter-toolbar">
            <div className="search-input-wrap">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Search title, message, source..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-search"
              />
            </div>

            <div className="filter-button-group" role="group" aria-label="Filter by severity">
              {["ALL", "CRITICAL", "WARNING", "INFO"].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  className={`btn-filter ${filterSeverity === sev ? "active" : ""}`}
                  onClick={() => setFilterSeverity(sev)}
                >
                  {sev}
                </button>
              ))}
            </div>

            <div className="filter-button-group" role="group" aria-label="Filter by resolution">
              {["ACTIVE", "RESOLVED", "ALL"].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`btn-filter ${filterStatus === st ? "active" : ""}`}
                  onClick={() => setFilterStatus(st)}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="alerts-list-container">
            {!backendOnline ? (
              <EmptyState
                type="danger"
                title="Monitoring Backend Offline"
                description="Unable to query alerts database. Ensure the NetGuard AI FastAPI backend is running."
              />
            ) : filteredAlerts.length === 0 ? (
              <EmptyState
                type="success"
                title="No Matching Alerts"
                description={
                  alerts.length === 0
                    ? "Zero security alerts detected. Nominal monitoring parameters maintained."
                    : "No alerts match the active severity or search filters."
                }
              />
            ) : (
              filteredAlerts.map((alt) => (
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
      ) : (
        /* SELF-HEALING RECOVERY TAB */
        <div className="recovery-panel-container">
          {/* FEEDBACK BANNER */}
          {recoveryFeedback && (
            <div className={`recovery-feedback-box ${recoveryFeedback.type === "error" ? "feedback-error" : "feedback-success"}`}>
              <div className="feedback-header">
                {recoveryFeedback.type === "error" ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                <strong>
                  {recoveryFeedback.data?.title || "Recovery Action Executed"} — {recoveryFeedback.data?.status || "Success"}
                </strong>
              </div>
              <p className="feedback-msg">
                {recoveryFeedback.data?.message || recoveryFeedback.message}
              </p>
              {recoveryFeedback.data?.verification_detail && (
                <div className="feedback-verification">
                  <span>Verification: <strong>{recoveryFeedback.data.verification_result}</strong> — {recoveryFeedback.data.verification_detail}</span>
                  <span className="duration-tag">{recoveryFeedback.data.execution_duration_ms} ms</span>
                </div>
              )}
            </div>
          )}

          {/* RECOVERY ENGINE STATUS BANNER */}
          <div className="panel recovery-status-card mb-4">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Remediation Engine Governance</h3>
                <span className="panel-subtitle">Lifecycle: Detection → Eligibility → Approval → Execution → Verification → Audit</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  status="info"
                  label={`POLICY: ${recoveryStatus?.configured_mode || "MANUAL"}`}
                />
                <Badge
                  status="healthy"
                  label={`COOLDOWN: ${recoveryStatus?.cooldown_seconds || 300}S`}
                />
              </div>
            </div>
            <div className="recovery-stats-row">
              <div className="rec-stat-col">
                <span className="rec-stat-val text-emerald">{recoveryStatus?.statistics?.verified || 0}</span>
                <span className="rec-stat-lbl">Verified Remediations</span>
              </div>
              <div className="rec-stat-col">
                <span className="rec-stat-val text-amber">{recoveryStatus?.statistics?.pending_approval || 0}</span>
                <span className="rec-stat-lbl">Pending Operator Approval</span>
              </div>
              <div className="rec-stat-col">
                <span className="rec-stat-val text-blue">{recoveryStatus?.statistics?.dry_runs || 0}</span>
                <span className="rec-stat-lbl">Dry-Run Simulations</span>
              </div>
              <div className="rec-stat-col">
                <span className="rec-stat-val text-crimson">{recoveryStatus?.statistics?.failed || 0}</span>
                <span className="rec-stat-lbl">Failed Actions</span>
              </div>
            </div>
          </div>

          {/* AVAILABLE RECOVERY ACTIONS GRID */}
          <div className="panel mb-4">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Available Recovery Playbooks</h3>
                <span className="panel-subtitle">Safe, non-disruptive, and reversible system remediations</span>
              </div>
            </div>

            <div className="recovery-actions-grid">
              {recoveryActions.map((action) => (
                <div key={action.action_key} className="recovery-action-card">
                  <div className="rec-card-header">
                    <div className="rec-icon-wrap">
                      <Wrench size={18} />
                    </div>
                    <div className="rec-header-text">
                      <h4 className="rec-title">{action.title}</h4>
                      <span className="rec-target">Target: {action.target}</span>
                    </div>
                    <div className="rec-badges">
                      {action.is_simulated ? (
                        <span className="rec-pill pill-simulated">SIMULATED</span>
                      ) : (
                        <span className="rec-pill pill-real">SYSTEM REVERSIBLE</span>
                      )}
                    </div>
                  </div>

                  <p className="rec-desc">{action.description}</p>

                  <div className="rec-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleTriggerAction(action.action_key, "DRY_RUN")}
                      disabled={actionInProgress === action.action_key}
                      title="Simulate impact without modifying configuration"
                    >
                      <RotateCcw size={13} />
                      Test Dry-Run
                    </button>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleTriggerAction(action.action_key, "MANUAL")}
                      disabled={actionInProgress === action.action_key}
                      title="Execute remediation and verify metric change"
                    >
                      <Play size={13} />
                      {actionInProgress === action.action_key ? "Executing..." : "Execute Action"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RECOVERY AUDIT TRAIL TABLE */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Remediation Audit Trail</h3>
                <span className="panel-subtitle">Chronological record of automated and manual recovery attempts</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={fetchRecoveryData}
              >
                <Clock size={13} />
                Refresh Log
              </button>
            </div>

            <div className="table-responsive">
              {recoveryHistory.length === 0 ? (
                <div className="p-4 text-center text-muted">
                  Zero recovery actions recorded in this session.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Time (UTC)</th>
                      <th>Action</th>
                      <th>Target</th>
                      <th>Mode</th>
                      <th>Status</th>
                      <th>Verification</th>
                      <th>Operator</th>
                      <th>Controls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recoveryHistory.map((rec) => (
                      <tr key={rec.id}>
                        <td className="text-mono text-sm">
                          {rec.created_at ? new Date(rec.created_at).toLocaleTimeString() : "--"}
                        </td>
                        <td><strong>{rec.title}</strong></td>
                        <td className="text-sm">{rec.target}</td>
                        <td>
                          <span className="text-xs text-mono badge-mode">{rec.mode}</span>
                        </td>
                        <td>
                          <Badge
                            status={
                              rec.status === "VERIFIED"
                                ? "healthy"
                                : rec.status === "PENDING_APPROVAL"
                                ? "warning"
                                : rec.status === "DRY_RUN"
                                ? "info"
                                : "danger"
                            }
                            label={rec.status}
                          />
                        </td>
                        <td>
                          <span className={`text-xs ${rec.verification_result === "IMPROVED" ? "text-emerald" : ""}`}>
                            {rec.verification_result || "--"}
                          </span>
                        </td>
                        <td className="text-xs text-muted">{rec.operator_email}</td>
                        <td>
                          {rec.status === "PENDING_APPROVAL" && (
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              onClick={() => handleApproveAction(rec.id)}
                              disabled={actionInProgress === rec.id}
                            >
                              Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE ALERT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Operational Alert"
      >
        <form onSubmit={handleCreateSubmit} className="form-stack">
          <div className="form-group">
            <label htmlFor="new-severity" className="form-label">Severity Level</label>
            <select
              id="new-severity"
              value={newSeverity}
              onChange={(e) => setNewSeverity(e.target.value)}
              className="form-select"
            >
              <option value="CRITICAL">CRITICAL (Immediate Action)</option>
              <option value="WARNING">WARNING (Elevated Risk)</option>
              <option value="INFO">INFO (Informational Notice)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="new-title" className="form-label">Alert Title</label>
            <input
              id="new-title"
              type="text"
              placeholder="e.g., Core Gateway Unresponsive"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-source" className="form-label">Source System</label>
            <input
              id="new-source"
              type="text"
              placeholder="e.g., Border Gateway Router"
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-message" className="form-label">Description & Findings</label>
            <textarea
              id="new-message"
              rows={3}
              placeholder="Enter observed telemetry metrics or incident details..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              required
              className="form-textarea"
            />
          </div>

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Log Alert
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default AlertsPage;
