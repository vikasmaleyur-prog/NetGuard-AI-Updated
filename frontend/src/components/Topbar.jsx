import React from "react";
import { Menu, X, RefreshCw, Sun, Moon } from "lucide-react";

export function Topbar({
  activePage,
  sidebarOpen,
  onToggleSidebar,
  backendOnline,
  dbBackend = "sqlite",
  isLoading = false,
  theme = "light",
  onToggleTheme,
  onRefresh,
}) {
  const pageDescriptions = {
    "Dashboard": "Real-time network telemetry and automated anomaly assessment",
    "Real-time Monitor": "Continuous system metrics and throughput telemetry stream",
    "AI Analysis": "Multi-model threat classification and ensemble consensus",
    "Alerts": "Persistent security incidents and threshold violations",
    "Logs": "Structured operational event stream and diagnostic logs",
    "Devices": "Registered network endpoints and latency telemetry",
    "Reports": "Historical telemetry analysis and downloadable audit records",
    "Settings": "Telemetry thresholds, refresh intervals, and storage configuration",
    "Privacy": "Data collection, retention policy, and privacy guarantees",
    "Terms": "Terms of service, authorized monitoring parameters, and liability limits",
  };

  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  const currentTime = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="btn-icon sidebar-toggle-btn"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <div className="topbar-heading">
          <h2 className="topbar-title">{activePage}</h2>
          <span className="topbar-subtitle">
            {pageDescriptions[activePage] || "Network security console"}
          </span>
        </div>
      </div>

      <div className="topbar-right">
        {onToggleTheme && (
          <button
            type="button"
            className="btn-theme-toggle"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "Dark Ops" : "Huel White"} theme`}
          >
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
            <span className="btn-theme-label">{theme === "light" ? "Dark Mode" : "Huel White"}</span>
          </button>
        )}

        <button
          type="button"
          className="btn-refresh"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh telemetry data"
          title="Refresh telemetry data"
        >
          <RefreshCw size={15} className={isLoading ? "refresh-spin" : ""} />
          <span className="btn-refresh-label">{isLoading ? "Polling..." : "Refresh"}</span>
        </button>

        <div
          className={`connection-status-pill ${
            backendOnline ? "status-online" : "status-offline"
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="status-dot" aria-hidden="true" />
          <span className="status-text">
            {backendOnline ? `LIVE (${dbBackend.toUpperCase()})` : "BACKEND OFFLINE"}
          </span>
        </div>

        <div className="topbar-clock">
          <span className="clock-date">{currentDate}</span>
          <span className="clock-time">{currentTime}</span>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
