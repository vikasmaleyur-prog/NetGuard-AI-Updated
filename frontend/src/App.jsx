import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  Cpu,
  Database,
  HardDrive,
  LayoutDashboard,
  Menu,
  Network,
  Radio,
  RefreshCw,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
  Zap,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [decision, setDecision] = useState(null);

  const [backendOnline, setBackendOnline] = useState(false);
  const [activePage, setActivePage] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // --------------------------------------------------
  // FETCH ALL BACKEND DATA
  // --------------------------------------------------

  const fetchData = async () => {
    setLoading(true);

    try {
      const [
        summaryRes,
        metricsRes,
        alertsRes,
        historyRes,
        aiRes,
        decisionRes,
      ] = await Promise.all([
        fetch(`${API_URL}/summary`),
        fetch(`${API_URL}/metrics`),
        fetch(`${API_URL}/alerts`),
        fetch(`${API_URL}/metrics/history`),
        fetch(`${API_URL}/ai/status`),
        fetch(`${API_URL}/decision`),
      ]);

      if (!summaryRes.ok || !metricsRes.ok) {
        throw new Error("Backend request failed");
      }

      const summaryData = await summaryRes.json();
      const metricsData = await metricsRes.json();

      const alertsData = alertsRes.ok
        ? await alertsRes.json()
        : { alerts: [] };

      const historyData = historyRes.ok
        ? await historyRes.json()
        : { records: [] };

      const aiData = aiRes.ok
        ? await aiRes.json()
        : null;

      const decisionData = decisionRes.ok
        ? await decisionRes.json()
        : null;

      setSummary(summaryData);
      setMetrics(metricsData);
      setAlerts(alertsData.alerts || []);
      setHistory(historyData.records || []);
      setAiStatus(aiData);
      setDecision(decisionData);

      setBackendOnline(true);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("NetGuard backend error:", error);
      setBackendOnline(false);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // INITIAL LOAD + AUTO REFRESH
  // --------------------------------------------------

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // --------------------------------------------------
  // SUMMARY DATA
  // --------------------------------------------------

  const networkStatus =
    summary?.network_status ||
    summary?.status ||
    "UNKNOWN";

  const action =
    summary?.action ||
    "No action available";

  const systemMetrics = summary?.metrics || {};

  const cpu =
    systemMetrics.cpu_usage_percent ??
    metrics?.metrics?.cpu_usage_percent ??
    0;

  const memory =
    systemMetrics.memory_usage_percent ??
    metrics?.metrics?.memory_usage_percent ??
    0;

  const disk =
    systemMetrics.disk_usage_percent ??
    metrics?.metrics?.disk_usage_percent ??
    0;

  const latency =
    systemMetrics.latency_ms ??
    metrics?.metrics?.latency_ms ??
    0;

  const ai = summary?.ai || {};

  const isolation =
    ai.isolation_forest ||
    "UNKNOWN";

  const randomForest =
    ai.random_forest ||
    "UNKNOWN";

  const lstm =
    ai.lstm ||
    "NORMAL";

  const isNormal = networkStatus === "NORMAL";
  const isCritical = networkStatus === "CRITICAL";
  const isWarning = networkStatus === "WARNING";

  const statusClass = isCritical
    ? "critical"
    : isWarning
      ? "warning"
      : isNormal
        ? "normal"
        : "unknown";

  // --------------------------------------------------
  // PAGE CONTENT
  // --------------------------------------------------

  const renderPage = () => {
    switch (activePage) {
      case "Dashboard":
        return (
          <Dashboard
            networkStatus={networkStatus}
            action={action}
            statusClass={statusClass}
            isNormal={isNormal}
            isCritical={isCritical}
            isWarning={isWarning}
            cpu={cpu}
            memory={memory}
            disk={disk}
            latency={latency}
            isolation={isolation}
            randomForest={randomForest}
            lstm={lstm}
            alerts={alerts}
            onViewAlerts={() => setActivePage("Alerts")}
          />
        );

      case "Real-time Monitor":
        return (
          <RealtimeMonitor
            cpu={cpu}
            memory={memory}
            disk={disk}
            latency={latency}
            networkStatus={networkStatus}
            action={action}
            lastUpdated={lastUpdated}
            loading={loading}
            onRefresh={fetchData}
          />
        );

      case "AI Analysis":
        return (
          <AIAnalysisPage
            isolation={isolation}
            randomForest={randomForest}
            lstm={lstm}
            networkStatus={networkStatus}
            aiStatus={aiStatus}
            decision={decision}
          />
        );

      case "Alerts":
        return (
          <AlertsPage
            alerts={alerts}
            networkStatus={networkStatus}
          />
        );

      case "Logs":
        return (
          <LogsPage
            history={history}
          />
        );

      case "Devices":
        return (
          <DevicesPage
            metrics={metrics}
            backendOnline={backendOnline}
          />
        );

      case "Reports":
        return (
          <ReportsPage
            summary={summary}
            history={history}
            alerts={alerts}
          />
        );

      case "Settings":
        return (
          <SettingsPage
            autoRefresh={autoRefresh}
            setAutoRefresh={setAutoRefresh}
            onRefresh={fetchData}
            backendOnline={backendOnline}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-shell">

      {/* SIDEBAR */}

      <aside
        className={`sidebar ${
          sidebarOpen
            ? "sidebar-open"
            : "sidebar-closed"
        }`}
      >

        <div className="brand">

          <div className="brand-icon">
            <ShieldCheck size={25} />
          </div>

          {sidebarOpen && (
            <div>
              <h1>NetGuard AI</h1>
              <span>AI-Powered Network</span>
              <span>Monitoring & Self-Healing</span>
            </div>
          )}

        </div>

        <div className="sidebar-section-title">
          {sidebarOpen && "MONITORING"}
        </div>

        <nav className="navigation">

          <NavItem
            icon={<LayoutDashboard size={18} />}
            label="Dashboard"
            active={activePage === "Dashboard"}
            open={sidebarOpen}
            onClick={() =>
              setActivePage("Dashboard")
            }
          />

          <NavItem
            icon={<Radio size={18} />}
            label="Real-time Monitor"
            active={
              activePage === "Real-time Monitor"
            }
            open={sidebarOpen}
            onClick={() =>
              setActivePage("Real-time Monitor")
            }
          />

          <NavItem
            icon={<Brain size={18} />}
            label="AI Analysis"
            active={activePage === "AI Analysis"}
            open={sidebarOpen}
            onClick={() =>
              setActivePage("AI Analysis")
            }
          />

          <NavItem
            icon={<AlertTriangle size={18} />}
            label="Alerts"
            active={activePage === "Alerts"}
            open={sidebarOpen}
            onClick={() =>
              setActivePage("Alerts")
            }
          />

          <NavItem
            icon={<Terminal size={18} />}
            label="Logs"
            active={activePage === "Logs"}
            open={sidebarOpen}
            onClick={() =>
              setActivePage("Logs")
            }
          />

          <NavItem
            icon={<Server size={18} />}
            label="Devices"
            active={activePage === "Devices"}
            open={sidebarOpen}
            hasArrow
            onClick={() =>
              setActivePage("Devices")
            }
          />

          <NavItem
            icon={<Database size={18} />}
            label="Reports"
            active={activePage === "Reports"}
            open={sidebarOpen}
            onClick={() =>
              setActivePage("Reports")
            }
          />

          <NavItem
            icon={<Settings size={18} />}
            label="Settings"
            active={activePage === "Settings"}
            open={sidebarOpen}
            onClick={() =>
              setActivePage("Settings")
            }
          />

        </nav>

        {/* ADMIN */}

        <div className="sidebar-bottom">

          <div className="admin-avatar">
            V
          </div>

          {sidebarOpen && (
            <>
              <div className="admin-info">
                <strong>Admin</strong>
                <span>Network Administrator</span>
              </div>

              <ChevronDown size={15} />
            </>
          )}

        </div>

      </aside>

      {/* MAIN */}

      <main className="main-content">

        {/* TOPBAR */}

        <header className="topbar">

          <button
            className="menu-button"
            onClick={() =>
              setSidebarOpen(!sidebarOpen)
            }
            title="Toggle sidebar"
          >
            {sidebarOpen ? (
              <X size={20} />
            ) : (
              <Menu size={20} />
            )}
          </button>

          <div className="page-heading">

            <h2>{activePage}</h2>

            <span>
              {activePage === "Dashboard"
                ? "Overview of your network security"
                : "NetGuard AI monitoring console"}
            </span>

          </div>

          <div className="topbar-right">

            <button
              className="refresh-button"
              onClick={fetchData}
              disabled={loading}
              title="Refresh data"
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? "refresh-spin"
                    : ""
                }
              />
            </button>

            <div
              className={`live-indicator ${
                backendOnline
                  ? "online"
                  : "offline"
              }`}
            >
              <span className="live-dot" />

              {backendOnline
                ? "LIVE MONITORING"
                : "BACKEND OFFLINE"}
            </div>

            <div className="top-date">

              <strong>
                {new Date().toLocaleDateString(
                  "en-US",
                  {
                    month: "short",
                    day: "2-digit",
                    year: "numeric",
                  }
                )}
              </strong>

              <span>
                {new Date().toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )}
              </span>

            </div>

          </div>

        </header>

        {/* PAGE */}

        <div className="dashboard-content">

          {renderPage()}

        </div>

      </main>

    </div>
  );
}


/* =====================================================
   DASHBOARD
===================================================== */

function Dashboard({
  networkStatus,
  action,
  statusClass,
  isNormal,
  isCritical,
  isWarning,
  cpu,
  memory,
  disk,
  latency,
  isolation,
  randomForest,
  lstm,
  alerts,
  onViewAlerts,
}) {
  return (
    <>
      {/* STATUS HERO */}

      <section
        className={`status-banner ${statusClass}`}
      >

        <div className="status-content">

          <div className="status-label">
            NETWORK STATUS
          </div>

          <div className="status-title">
            {networkStatus}
          </div>

          <p>
            {isNormal
              ? "System functioning within established parameters."
              : isCritical
                ? "Critical network condition detected."
                : isWarning
                  ? "Network requires attention."
                  : "Waiting for network intelligence data."}
          </p>

          <div className="status-meta">

            <span>
              <Activity size={14} />
              Live monitoring
            </span>

            <span>
              Overall network health:
              <strong>
                {isNormal ? "95%" : "--"}
              </strong>
            </span>

            <span>
              Action:
              <strong>{action}</strong>
            </span>

          </div>

        </div>

        <div className="network-visual">

          <div className="network-grid" />

          <div className="network-nodes">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

        </div>

      </section>

      {/* METRICS */}

      <section className="metrics-grid">

        <MetricCard
          icon={<Cpu size={19} />}
          title="CPU Usage"
          value={`${Number(cpu).toFixed(1)}%`}
          trend="+2.3%"
          positive
          graph="cpu"
        />

        <MetricCard
          icon={<CircleGauge size={19} />}
          title="Memory"
          value={`${Number(memory).toFixed(1)}%`}
          trend="+5.3%"
          positive
          graph="memory"
        />

        <MetricCard
          icon={<HardDrive size={19} />}
          title="Disk"
          value={`${Number(disk).toFixed(1)}%`}
          trend="-7.8%"
          graph="disk"
        />

        <MetricCard
          icon={<Network size={19} />}
          title="Network Latency"
          value={`${Number(latency).toFixed(2)}ms`}
          trend="Stable"
          graph="latency"
        />

      </section>

      {/* AI */}

      <div className="section-header">

        <div>
          <span className="section-kicker">
            ARTIFICIAL INTELLIGENCE
          </span>

          <h3>Threat Detection Models</h3>
        </div>

        <div className="model-status">
          <Sparkles size={15} />
          Ensemble analysis active
        </div>

      </div>

      <section className="ai-grid">

        <AIModelCard
          icon={<Shield size={21} />}
          title="Isolation Forest"
          subtitle="Anomaly Detection"
          value={isolation}
          description="Unsupervised anomaly detection"
          type="isolation"
        />

        <AIModelCard
          icon={<Network size={21} />}
          title="Random Forest"
          subtitle="Classification"
          value={randomForest}
          description="Supervised threat classification"
          type="forest"
        />

        <AIModelCard
          icon={<Activity size={21} />}
          title="LSTM Model"
          subtitle="Prediction"
          value={lstm}
          description="Temporal network prediction"
          type="lstm"
        />

        <DecisionCard
          isolation={isolation}
          randomForest={randomForest}
          lstm={lstm}
          status={networkStatus}
        />

      </section>

      {/* LOWER */}

      <section className="lower-grid">

        <TrafficChart />

        <AlertsPanel
          alerts={alerts}
          onViewAll={onViewAlerts}
        />

      </section>

      <footer className="dashboard-footer">

        <div>
          <ShieldCheck size={15} />
          NetGuard AI Security Engine
        </div>

        <span>
          AI-powered monitoring • MongoDB • FastAPI
        </span>

      </footer>
    </>
  );
}


/* =====================================================
   REAL-TIME MONITOR
===================================================== */

function RealtimeMonitor({
  cpu,
  memory,
  disk,
  latency,
  networkStatus,
  action,
  lastUpdated,
  loading,
  onRefresh,
}) {
  return (
    <div>

      <div className="section-header">

        <div>
          <span className="section-kicker">
            LIVE SYSTEM MONITORING
          </span>

          <h3>Real-time Network Metrics</h3>
        </div>

        <button
          className="panel-action"
          onClick={onRefresh}
        >
          <RefreshCw size={14} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>

      </div>

      <section className="metrics-grid">

        <MetricCard
          icon={<Cpu size={19} />}
          title="CPU Usage"
          value={`${Number(cpu).toFixed(1)}%`}
          trend="LIVE"
          positive
          graph="cpu"
        />

        <MetricCard
          icon={<CircleGauge size={19} />}
          title="Memory"
          value={`${Number(memory).toFixed(1)}%`}
          trend="LIVE"
          positive
          graph="memory"
        />

        <MetricCard
          icon={<HardDrive size={19} />}
          title="Disk"
          value={`${Number(disk).toFixed(1)}%`}
          trend="LIVE"
          graph="disk"
        />

        <MetricCard
          icon={<Network size={19} />}
          title="Latency"
          value={`${Number(latency).toFixed(2)}ms`}
          trend="LIVE"
          graph="latency"
        />

      </section>

      <div className="panel">

        <div className="panel-header">

          <div>
            <h3>Current Network State</h3>
            <span>
              Latest information received from FastAPI
            </span>
          </div>

        </div>

        <div className="alerts-list">

          <div className="alert-item info">

            <div className="alert-indicator" />

            <div className="alert-content">

              <div className="alert-title-row">
                <strong>Status</strong>
                <span>
                  {lastUpdated
                    ? lastUpdated.toLocaleTimeString()
                    : "--"}
                </span>
              </div>

              <p>
                Network status:{" "}
                <strong>{networkStatus}</strong>
              </p>

            </div>

          </div>

          <div className="alert-item info">

            <div className="alert-indicator" />

            <div className="alert-content">

              <div className="alert-title-row">
                <strong>AI Action</strong>
              </div>

              <p>{action}</p>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}


/* =====================================================
   AI ANALYSIS
===================================================== */

function AIAnalysisPage({
  isolation,
  randomForest,
  lstm,
  networkStatus,
  aiStatus,
  decision,
}) {
  return (
    <div>

      <div className="section-header">

        <div>
          <span className="section-kicker">
            ARTIFICIAL INTELLIGENCE
          </span>

          <h3>AI Analysis Engine</h3>
        </div>

        <div className="model-status">
          <Sparkles size={15} />
          Ensemble analysis active
        </div>

      </div>

      <section className="ai-grid">

        <AIModelCard
          icon={<Shield size={21} />}
          title="Isolation Forest"
          subtitle="Anomaly Detection"
          value={isolation}
          description="Unsupervised anomaly detection"
          type="isolation"
        />

        <AIModelCard
          icon={<Network size={21} />}
          title="Random Forest"
          subtitle="Classification"
          value={randomForest}
          description="Supervised threat classification"
          type="forest"
        />

        <AIModelCard
          icon={<Activity size={21} />}
          title="LSTM Model"
          subtitle="Prediction"
          value={lstm}
          description="Temporal network prediction"
          type="lstm"
        />

        <DecisionCard
          isolation={isolation}
          randomForest={randomForest}
          lstm={lstm}
          status={networkStatus}
        />

      </section>

      <section className="panel">

        <div className="panel-header">

          <div>
            <h3>AI Backend Response</h3>
            <span>
              Latest response from /ai/status
            </span>
          </div>

        </div>

        <pre className="json-viewer">
{JSON.stringify(
  {
    ai_status: aiStatus,
    decision: decision,
  },
  null,
  2
)}
        </pre>

      </section>

    </div>
  );
}


/* =====================================================
   ALERTS PAGE
===================================================== */

function AlertsPage({
  alerts,
  networkStatus,
}) {
  return (
    <div>

      <div className="section-header">

        <div>
          <span className="section-kicker">
            SECURITY
          </span>

          <h3>Network Alerts</h3>
        </div>

        <div className="model-status">
          {alerts.length} events
        </div>

      </div>

      <section className="panel">

        <div className="panel-header">

          <div>
            <h3>Recent Security Events</h3>
            <span>
              Data received from /alerts
            </span>
          </div>

        </div>

        {alerts.length === 0 ? (

          <div className="empty-state">
            <CheckCircle2 size={35} />
            <h3>No Active Alerts</h3>
            <p>
              NetGuard AI has not detected any
              WARNING or CRITICAL events.
            </p>
          </div>

        ) : (

          <div className="alerts-list">

            {alerts.map((record, index) => {

              const status =
                record?.decision?.status ||
                "UNKNOWN";

              const type =
                status === "CRITICAL"
                  ? "critical"
                  : status === "WARNING"
                    ? "warning"
                    : "info";

              return (
                <Alert
                  key={
                    record._id || index
                  }
                  type={type}
                  title={status}
                  time="Recent"
                  message={
                    record?.decision?.action ||
                    "Network event detected"
                  }
                />
              );
            })}

          </div>
        )}

      </section>

      <section className="panel">

        <div className="panel-header">

          <div>
            <h3>Current Network Status</h3>
            <span>
              Latest system decision
            </span>
          </div>

        </div>

        <div className="ai-result">
          {networkStatus}
        </div>

      </section>

    </div>
  );
}


/* =====================================================
   LOGS PAGE
===================================================== */

function LogsPage({ history }) {
  return (
    <div>

      <div className="section-header">

        <div>
          <span className="section-kicker">
            SYSTEM LOGS
          </span>

          <h3>Monitoring History</h3>
        </div>

        <div className="model-status">
          {history.length} records
        </div>

      </div>

      <section className="panel">

        <div className="panel-header">

          <div>
            <h3>Latest Monitoring Records</h3>
            <span>
              Retrieved from /metrics/history
            </span>
          </div>

        </div>

        {history.length === 0 ? (

          <div className="empty-state">
            <Terminal size={35} />
            <h3>No Logs Available</h3>
            <p>
              No monitoring history has been
              returned by MongoDB.
            </p>
          </div>

        ) : (

          <div className="log-list">

            {history.map((record, index) => {

              const metric =
                record?.metrics || {};

              return (
                <div
                  className="log-row"
                  key={
                    record._id || index
                  }
                >

                  <div className="log-id">
                    #{index + 1}
                  </div>

                  <div>
                    <strong>
                      Monitoring Record
                    </strong>

                    <span>
                      {record._id}
                    </span>
                  </div>

                  <div>
                    CPU:{" "}
                    {metric.cpu_usage_percent ??
                      "--"}
                    %
                  </div>

                  <div>
                    RAM:{" "}
                    {metric.memory_usage_percent ??
                      "--"}
                    %
                  </div>

                  <div>
                    Latency:{" "}
                    {metric.latency_ms ??
                      "--"}
                    ms
                  </div>

                </div>
              );
            })}

          </div>
        )}

      </section>

    </div>
  );
}


/* =====================================================
   DEVICES PAGE
===================================================== */

function DevicesPage({
  metrics,
  backendOnline,
}) {
  const metricData =
    metrics?.metrics || {};

  return (
    <div>

      <div className="section-header">

        <div>
          <span className="section-kicker">
            INFRASTRUCTURE
          </span>

          <h3>Monitored Devices</h3>
        </div>

      </div>

      <section className="metrics-grid">

        <MetricCard
          icon={<Server size={19} />}
          title="Backend"
          value={backendOnline ? "ONLINE" : "OFFLINE"}
          trend={backendOnline ? "ACTIVE" : "DOWN"}
          positive={backendOnline}
          graph="cpu"
        />

        <MetricCard
          icon={<Cpu size={19} />}
          title="CPU"
          value={`${metricData.cpu_usage_percent ?? 0}%`}
          trend="MONITORED"
          positive
          graph="cpu"
        />

        <MetricCard
          icon={<CircleGauge size={19} />}
          title="Memory"
          value={`${metricData.memory_usage_percent ?? 0}%`}
          trend="MONITORED"
          positive
          graph="memory"
        />

        <MetricCard
          icon={<HardDrive size={19} />}
          title="Disk"
          value={`${metricData.disk_usage_percent ?? 0}%`}
          trend="MONITORED"
          graph="disk"
        />

      </section>

      <section className="panel">

        <div className="panel-header">

          <div>
            <h3>Device Information</h3>
            <span>
              Latest monitoring source
            </span>
          </div>

        </div>

        <pre className="json-viewer">
{JSON.stringify(
  metrics,
  null,
  2
)}
        </pre>

      </section>

    </div>
  );
}


/* =====================================================
   REPORTS PAGE
===================================================== */

function ReportsPage({
  summary,
  history,
  alerts,
}) {
  return (
    <div>

      <div className="section-header">

        <div>
          <span className="section-kicker">
            REPORTING
          </span>

          <h3>Network Reports</h3>
        </div>

      </div>

      <section className="metrics-grid">

        <MetricCard
          icon={<Activity size={19} />}
          title="Network Status"
          value={
            summary?.network_status ||
            "UNKNOWN"
          }
          trend="CURRENT"
          positive
          graph="cpu"
        />

        <MetricCard
          icon={<Database size={19} />}
          title="Monitoring Records"
          value={history.length}
          trend="TOTAL"
          positive
          graph="memory"
        />

        <MetricCard
          icon={<AlertTriangle size={19} />}
          title="Alerts"
          value={alerts.length}
          trend="RECENT"
          graph="disk"
        />

        <MetricCard
          icon={<ShieldCheck size={19} />}
          title="Security Engine"
          value="ACTIVE"
          trend="ONLINE"
          positive
          graph="latency"
        />

      </section>

      <section className="panel">

        <div className="panel-header">

          <div>
            <h3>Report Summary</h3>
            <span>
              Current NetGuard AI state
            </span>
          </div>

        </div>

        <pre className="json-viewer">
{JSON.stringify(
  {
    summary,
    records: history.length,
    alerts: alerts.length,
  },
  null,
  2
)}
        </pre>

      </section>

    </div>
  );
}


/* =====================================================
   SETTINGS
===================================================== */

function SettingsPage({
  autoRefresh,
  setAutoRefresh,
  onRefresh,
  backendOnline,
}) {
  return (
    <div>

      <div className="section-header">

        <div>
          <span className="section-kicker">
            CONFIGURATION
          </span>

          <h3>NetGuard AI Settings</h3>
        </div>

      </div>

      <section className="panel">

        <div className="panel-header">

          <div>
            <h3>Monitoring Configuration</h3>
            <span>
              Control dashboard behaviour
            </span>
          </div>

        </div>

        <div className="settings-list">

          <div className="setting-row">

            <div>
              <strong>
                Automatic Refresh
              </strong>

              <span>
                Fetch latest backend data
                every 5 seconds
              </span>
            </div>

            <button
              className={`setting-toggle ${
                autoRefresh
                  ? "enabled"
                  : ""
              }`}
              onClick={() =>
                setAutoRefresh(
                  !autoRefresh
                )
              }
            >
              {autoRefresh
                ? "ON"
                : "OFF"}
            </button>

          </div>

          <div className="setting-row">

            <div>
              <strong>
                Backend Connection
              </strong>

              <span>
                FastAPI connection status
              </span>
            </div>

            <span
              className={
                backendOnline
                  ? "normal-text"
                  : "critical-text"
              }
            >
              {backendOnline
                ? "CONNECTED"
                : "DISCONNECTED"}
            </span>

          </div>

          <div className="setting-row">

            <div>
              <strong>
                Manual Data Refresh
              </strong>

              <span>
                Immediately retrieve all
                available monitoring data
              </span>
            </div>

            <button
              className="panel-action"
              onClick={onRefresh}
            >
              <RefreshCw size={14} />
              Refresh Now
            </button>

          </div>

        </div>

      </section>

    </div>
  );
}


/* =====================================================
   NAV ITEM
===================================================== */

function NavItem({
  icon,
  label,
  active,
  open,
  hasArrow,
  onClick,
}) {
  return (
    <button
      className={`nav-item ${
        active ? "active" : ""
      }`}
      onClick={onClick}
      title={!open ? label : ""}
    >

      <span className="nav-icon">
        {icon}
      </span>

      {open && (
        <>
          <span className="nav-label">
            {label}
          </span>

          {hasArrow && (
            <ChevronDown
              size={14}
              className="nav-arrow"
            />
          )}
        </>
      )}

    </button>
  );
}


/* =====================================================
   METRIC CARD
===================================================== */

function MetricCard({
  icon,
  title,
  value,
  trend,
  positive,
  graph,
}) {
  return (
    <div className="metric-card">

      <div className="metric-top">

        <div className="metric-icon">
          {icon}
        </div>

        <div className="metric-title">
          {title}
        </div>

        <span
          className={`metric-trend ${
            positive ? "positive" : ""
          }`}
        >
          {trend}
        </span>

      </div>

      <div className="metric-value">
        {value}
      </div>

      <div
        className={`mini-chart ${graph}`}
      >
        <div className="chart-line" />
      </div>

    </div>
  );
}


/* =====================================================
   AI MODEL CARD
===================================================== */

function AIModelCard({
  icon,
  title,
  subtitle,
  value,
  description,
  type,
}) {
  const normal =
    value === "NORMAL";

  const anomaly =
    value === "ANOMALY" ||
    value === "CRITICAL";

  return (
    <div
      className={`ai-card ${type}`}
    >

      <div className="ai-card-header">

        <div className="ai-icon">
          {icon}
        </div>

        <div>
          <h4>{title}</h4>
          <span>{subtitle}</span>
        </div>

        <div className="ai-chevron">
          →
        </div>

      </div>

      <div className="ai-card-body">

        <div className="ai-value-label">
          Current Result
        </div>

        <div className="ai-result">
          {value}
        </div>

        <p>{description}</p>

        <div
          className={`status-pill ${
            normal
              ? "pill-normal"
              : anomaly
                ? "pill-danger"
                : "pill-unknown"
          }`}
        >
          <span />
          {value}
        </div>

      </div>

      <div className="ai-decoration" />

    </div>
  );
}


/* =====================================================
   DECISION ENGINE
===================================================== */

function DecisionCard({
  isolation,
  randomForest,
  lstm,
  status,
}) {
  const normal =
    status === "NORMAL";

  const critical =
    status === "CRITICAL";

  return (
    <div className="decision-card">

      <div className="decision-header">

        <div className="decision-icon">
          <Zap size={20} />
        </div>

        <div>
          <h4>AI Decision Engine</h4>
          <span>Ensemble verdict</span>
        </div>

      </div>

      <div className="decision-flow">

        <div className="decision-inputs">

          <div className="decision-input">
            <span
              className={
                isolation === "ANOMALY"
                  ? "danger"
                  : ""
              }
            >
              {isolation}
            </span>
          </div>

          <div className="decision-input">
            <span
              className={
                randomForest ===
                "ANOMALY"
                  ? "danger"
                  : ""
              }
            >
              {randomForest}
            </span>
          </div>

          <div className="decision-input">
            <span
              className={
                lstm === "ANOMALY"
                  ? "danger"
                  : ""
              }
            >
              {lstm}
            </span>
          </div>

        </div>

        <div className="decision-arrow">
          →
        </div>

        <div className="final-decision">

          <span>
            FINAL STATUS:
          </span>

          <strong
            className={
              critical
                ? "critical-text"
                : normal
                  ? "normal-text"
                  : "warning-text"
            }
          >
            {status}
          </strong>

          <small>
            {normal
              ? "No action required"
              : critical
                ? "Investigate immediately"
                : "Continue monitoring"}
          </small>

        </div>

      </div>

    </div>
  );
}


/* =====================================================
   TRAFFIC CHART
===================================================== */

function TrafficChart() {
  return (
    <div className="panel traffic-panel">

      <div className="panel-header">

        <div>
          <h3>
            Incoming & Outgoing Network Traffic
          </h3>

          <span>
            Real-time network activity
          </span>
        </div>

        <div className="chart-legend">

          <span>
            <i className="legend-in" />
            Incoming
          </span>

          <span>
            <i className="legend-out" />
            Outgoing
          </span>

        </div>

      </div>

      <div className="traffic-chart">

        <div className="y-axis">

          <span>100 Mbps</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>

        </div>

        <div className="chart-area">

          <div className="grid-lines">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>

          <svg
            className="traffic-svg"
            viewBox="0 0 700 220"
            preserveAspectRatio="none"
          >

            <defs>

              <linearGradient
                id="trafficFill"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >

                <stop
                  offset="0%"
                  stopColor="#3b82f6"
                  stopOpacity="0.25"
                />

                <stop
                  offset="100%"
                  stopColor="#3b82f6"
                  stopOpacity="0"
                />

              </linearGradient>

            </defs>

            <path
              d="M0 165 C60 145 70 150 120 135 S180 150 230 125 S290 105 330 130 S390 110 430 95 S500 115 540 85 S610 105 700 65 L700 220 L0 220 Z"
              fill="url(#trafficFill)"
            />

            <path
              d="M0 165 C60 145 70 150 120 135 S180 150 230 125 S290 105 330 130 S390 110 430 95 S500 115 540 85 S610 105 700 65"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
            />

            <path
              d="M0 185 C70 175 100 180 150 165 S240 170 300 155 S380 170 440 145 S530 155 600 130 S650 145 700 120"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2"
            />

          </svg>

          <div className="x-axis">

            <span>10:00</span>
            <span>11:00</span>
            <span>12:00</span>
            <span>13:00</span>
            <span>14:00</span>
            <span>15:00</span>
            <span>16:00</span>
            <span>17:00</span>
            <span>18:00</span>
            <span>19:00</span>

          </div>

        </div>

      </div>

    </div>
  );
}


/* =====================================================
   ALERTS PANEL
===================================================== */

function AlertsPanel({
  alerts,
  onViewAll,
}) {
  return (
    <div className="panel alerts-panel">

      <div className="panel-header">

        <div>
          <h3>Recent Alerts</h3>
          <span>
            Latest security events
          </span>
        </div>

        <button
          className="panel-action"
          onClick={onViewAll}
        >
          View all
        </button>

      </div>

      <div className="alerts-list">

        {alerts.length === 0 ? (

          <>
            <Alert
              type="critical"
              title="Critical"
              time="Current"
              message="No active critical threats"
            />

            <Alert
              type="info"
              title="Information"
              time="Current"
              message="Network monitoring is active"
            />
          </>

        ) : (

          alerts
            .slice(0, 4)
            .map((record, index) => {

              const status =
                record?.decision?.status ||
                "UNKNOWN";

              const type =
                status === "CRITICAL"
                  ? "critical"
                  : status === "WARNING"
                    ? "warning"
                    : "info";

              return (
                <Alert
                  key={
                    record._id ||
                    index
                  }
                  type={type}
                  title={status}
                  time="Recent"
                  message={
                    record?.decision?.action ||
                    "Network event detected"
                  }
                />
              );
            })

        )}

      </div>

    </div>
  );
}


/* =====================================================
   ALERT
===================================================== */

function Alert({
  type,
  title,
  time,
  message,
}) {
  return (
    <div
      className={`alert-item ${type}`}
    >

      <div className="alert-indicator" />

      <div className="alert-content">

        <div className="alert-title-row">

          <strong>{title}</strong>

          <span>{time}</span>

        </div>

        <p>{message}</p>

      </div>

      <span
        className={`alert-badge ${type}`}
      >
        {title}
      </span>

    </div>
  );
}

export default App;