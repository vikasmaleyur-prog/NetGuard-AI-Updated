import React from "react";
import {
  LayoutDashboard,
  Radio,
  Brain,
  AlertTriangle,
  Terminal,
  Server,
  Database,
  Settings,
  ShieldCheck,
  FileText,
  Shield,
  LogOut,
} from "lucide-react";

function getInitials(name) {
  if (!name) return "OP";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const NAV_ITEMS = [
  { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "Real-time Monitor", label: "Real-Time Monitor", icon: Radio },
  { id: "AI Analysis", label: "AI Analysis", icon: Brain },
  { id: "Alerts", label: "Security Alerts", icon: AlertTriangle },
  { id: "Logs", label: "System Logs", icon: Terminal },
  { id: "Devices", label: "Monitored Devices", icon: Server },
  { id: "Reports", label: "Audit Reports", icon: Database },
  { id: "Settings", label: "Configuration", icon: Settings },
];

const LEGAL_ITEMS = [
  { id: "Privacy", label: "Privacy Policy", icon: ShieldCheck },
  { id: "Terms", label: "Terms of Service", icon: FileText },
];

export function Sidebar({
  activePage,
  onNavigate,
  isOpen = true,
  unreadAlertsCount = 0,
  user = null,
  onLogout = null,
}) {
  return (
    <aside
      className={`app-sidebar ${isOpen ? "sidebar-expanded" : "sidebar-collapsed"}`}
      aria-label="Main Navigation"
    >
      <div className="sidebar-brand-box">
        <div className="sidebar-brand-logo" aria-hidden="true">
          <Shield size={20} />
        </div>
        {isOpen && (
          <div className="sidebar-brand-text">
            <h1 className="brand-name">NetGuard AI</h1>
            <span className="brand-tagline">Network Operations Console</span>
          </div>
        )}
      </div>

      <div className="sidebar-scrollable">
        <nav className="sidebar-nav-group">
          {isOpen && <span className="nav-group-title">MONITORING & INTELLIGENCE</span>}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const isAlerts = item.id === "Alerts";

            return (
              <button
                key={item.id}
                type="button"
                className={`nav-button ${isActive ? "active" : ""}`}
                onClick={() => onNavigate(item.id)}
                title={!isOpen ? item.label : ""}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                {isOpen && <span className="nav-label">{item.label}</span>}
                {isOpen && isAlerts && unreadAlertsCount > 0 && (
                  <span className="nav-badge-count">{unreadAlertsCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <nav className="sidebar-nav-group" style={{ marginTop: "24px" }}>
          {isOpen && <span className="nav-group-title">COMPLIANCE & LEGAL</span>}
          {LEGAL_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                className={`nav-button ${isActive ? "active" : ""}`}
                onClick={() => onNavigate(item.id)}
                title={!isOpen ? item.label : ""}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                {isOpen && <span className="nav-label">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="sidebar-footer-box">
        <div className="operator-profile">
          <div className="operator-avatar" aria-hidden="true" title={user?.full_name || "Operator"}>
            {getInitials(user?.full_name)}
          </div>
          {isOpen && (
            <div className="operator-info">
              <span className="operator-name" title={user?.full_name || "Operator"}>
                {user?.full_name || "SecOps Console"}
              </span>
              <span className="operator-role" title={user?.email || "Local Administrator"}>
                {user?.organization || (user?.role === "admin" ? "System Administrator" : "Security Operator")}
              </span>
            </div>
          )}
          {isOpen && onLogout && (
            <button
              type="button"
              className="btn-icon btn-logout"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign out of console"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
