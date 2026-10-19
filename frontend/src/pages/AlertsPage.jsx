import React, { useState } from "react";
import { Search, Plus } from "lucide-react";
import AlertItem from "../components/AlertItem";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";

export function AlertsPage({
  alerts = [],
  backendOnline,
  onAcknowledgeAlert,
  onResolveAlert,
  onCreateAlert,
}) {
  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ACTIVE"); // "ACTIVE", "RESOLVED", "ALL"
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSeverity, setNewSeverity] = useState("WARNING");
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newSource, setNewSource] = useState("SecOps Manual");

  const filteredAlerts = alerts.filter((alt) => {
    // Severity filter
    if (filterSeverity !== "ALL" && (alt.severity || "INFO").toUpperCase() !== filterSeverity) {
      return false;
    }
    // Status filter
    if (filterStatus === "ACTIVE" && alt.resolved) return false;
    if (filterStatus === "RESOLVED" && !alt.resolved) return false;

    // Search filter
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
        <div className="alert-count-card count-critical" onClick={() => setFilterSeverity("CRITICAL")}>
          <span className="count-label">Active Critical</span>
          <strong className="count-value">{criticalCount}</strong>
          <span className="count-sub">High priority events</span>
        </div>

        <div className="alert-count-card count-warning" onClick={() => setFilterSeverity("WARNING")}>
          <span className="count-label">Active Warnings</span>
          <strong className="count-value">{warningCount}</strong>
          <span className="count-sub">Potential degradation</span>
        </div>

        <div className="alert-count-card count-info" onClick={() => setFilterSeverity("INFO")}>
          <span className="count-label">Informational</span>
          <strong className="count-value">{infoCount}</strong>
          <span className="count-sub">System notices</span>
        </div>

        <div className="alert-count-card count-total" onClick={() => setFilterSeverity("ALL")}>
          <span className="count-label">Total Recorded</span>
          <strong className="count-value">{alerts.length}</strong>
          <span className="count-sub">All historical alerts</span>
        </div>
      </div>

      {/* 2. FILTER & CONTROLS TOOLBAR */}
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

        {/* 3. ALERTS LIST */}
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
