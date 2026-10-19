import React, { useEffect, useState, useCallback } from "react";
import api from "./api/client";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Footer from "./components/Footer";

// Pages
import DashboardPage from "./pages/DashboardPage";
import RealtimeMonitorPage from "./pages/RealtimeMonitorPage";
import AIAnalysisPage from "./pages/AIAnalysisPage";
import AlertsPage from "./pages/AlertsPage";
import LogsPage from "./pages/LogsPage";
import DevicesPage from "./pages/DevicesPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsPage from "./pages/TermsPage";

function parseHashRoute() {
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (hash === "privacy" || hash === "privacypolicy") return "Privacy";
  if (hash === "terms" || hash === "termsofservice") return "Terms";
  if (hash === "monitor" || hash === "realtime" || hash === "realtimemonitor") return "Real-time Monitor";
  if (hash === "ai" || hash === "aianalysis") return "AI Analysis";
  if (hash === "alerts") return "Alerts";
  if (hash === "logs") return "Logs";
  if (hash === "devices") return "Devices";
  if (hash === "reports") return "Reports";
  if (hash === "settings") return "Settings";
  return "Dashboard";
}

export function App() {
  const [activePage, setActivePage] = useState(parseHashRoute);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Application Data States
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [devices, setDevices] = useState([]);
  const [aiStatus, setAiStatus] = useState(null);
  const [decision, setDecision] = useState(null);
  const [dbBackend, setDbBackend] = useState("sqlite");
  const [backendOnline, setBackendOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);

  // Theme State: 'light' (Huel White) by default, or 'dark'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("netguard_theme") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("netguard_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Sync route with browser hash for direct navigation & bookmarks
  useEffect(() => {
    const handleHashChange = () => {
      setActivePage(parseHashRoute());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigateTo = (page) => {
    setActivePage(page);
    let hashSlug = "dashboard";
    if (page === "Real-time Monitor") hashSlug = "realtime";
    else if (page === "AI Analysis") hashSlug = "ai";
    else if (page === "Privacy") hashSlug = "privacy";
    else if (page === "Terms") hashSlug = "terms";
    else hashSlug = page.toLowerCase().replace(/[^a-z0-9]/g, "");
    window.location.hash = `/${hashSlug}`;
  };

  // Fetch all live data from backend
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        summaryRes,
        metricsRes,
        alertsRes,
        historyRes,
        logsRes,
        devicesRes,
        aiRes,
        decRes,
        healthRes,
      ] = await Promise.all([
        api.getSummary(),
        api.getMetrics(),
        api.getAlerts({ limit: 50 }),
        api.getMetricsHistory(30),
        api.getLogs({ limit: 100 }),
        api.getDevices(),
        api.getAiStatus(),
        api.getDecision(),
        api.getHealth(),
      ]);

      if (healthRes.ok && healthRes.data) {
        setBackendOnline(true);
        if (healthRes.data.database && healthRes.data.database.backend) {
          setDbBackend(healthRes.data.database.backend);
        }
      } else {
        setBackendOnline(summaryRes.ok || metricsRes.ok);
      }

      if (summaryRes.ok) setSummary(summaryRes.data);
      if (metricsRes.ok) setMetrics(metricsRes.data);
      if (alertsRes.ok && alertsRes.data) setAlerts(alertsRes.data.alerts || []);
      if (historyRes.ok && historyRes.data) setHistory(historyRes.data.records || []);
      if (logsRes.ok && logsRes.data) setLogs(logsRes.data.logs || []);
      if (devicesRes.ok && devicesRes.data) setDevices(devicesRes.data.devices || []);
      if (aiRes.ok) setAiStatus(aiRes.data);
      if (decRes.ok) setDecision(decRes.data);

      setLastUpdated(new Date());
    } catch (err) {
      console.warn("NetGuard telemetry poll error:", err.message);
      setBackendOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Automated polling loop with interval
  useEffect(() => {
    if (!autoRefresh) return;
    const intervalMs = Math.max(2, refreshInterval) * 1000;
    const timer = setInterval(() => {
      fetchAllData();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, fetchAllData]);

  // Alert Actions
  const handleAcknowledgeAlert = async (alertId) => {
    const res = await api.acknowledgeAlert(alertId);
    if (res.ok) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
    }
  };

  const handleResolveAlert = async (alertId) => {
    const res = await api.resolveAlert(alertId);
    if (res.ok) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
      );
    }
  };

  const handleCreateAlert = async (alertData) => {
    const res = await api.createAlert(alertData);
    if (res.ok) {
      fetchAllData();
    }
  };

  // Device Actions
  const handleRegisterDevice = async (deviceData) => {
    const res = await api.registerDevice(deviceData);
    if (res.ok) {
      fetchAllData();
    }
  };

  const handlePingDevice = async (deviceId) => {
    const res = await api.pingDevice(deviceId);
    if (res.ok && res.data) {
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? { ...d, status: res.data.device_status, latency_ms: res.data.latency_ms }
            : d
        )
      );
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    const res = await api.deleteDevice(deviceId);
    if (res.ok) {
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    }
  };

  // Force AI Inference
  const handleTriggerInference = async () => {
    setIsAiProcessing(true);
    try {
      const res = await api.triggerAiInference();
      if (res.ok) {
        fetchAllData();
      }
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Count active unread alerts for sidebar badge
  const unreadAlertsCount = alerts.filter((a) => !a.acknowledged && !a.resolved).length;

  const renderActivePage = () => {
    switch (activePage) {
      case "Dashboard":
        return (
          <DashboardPage
            summary={summary}
            metrics={metrics}
            alerts={alerts}
            history={history}
            backendOnline={backendOnline}
            isLoading={isLoading}
            lastUpdated={lastUpdated}
            onNavigate={navigateTo}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onResolveAlert={handleResolveAlert}
          />
        );
      case "Real-time Monitor":
        return (
          <RealtimeMonitorPage
            metrics={metrics}
            history={history}
            backendOnline={backendOnline}
            isLoading={isLoading}
            lastUpdated={lastUpdated}
            onRefresh={fetchAllData}
          />
        );
      case "AI Analysis":
        return (
          <AIAnalysisPage
            aiStatus={aiStatus}
            decision={decision}
            onTriggerInference={handleTriggerInference}
            isProcessing={isAiProcessing}
          />
        );
      case "Alerts":
        return (
          <AlertsPage
            alerts={alerts}
            backendOnline={backendOnline}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onResolveAlert={handleResolveAlert}
            onCreateAlert={handleCreateAlert}
          />
        );
      case "Logs":
        return (
          <LogsPage
            logs={logs}
            backendOnline={backendOnline}
            isLoading={isLoading}
            onRefresh={fetchAllData}
          />
        );
      case "Devices":
        return (
          <DevicesPage
            devices={devices}
            backendOnline={backendOnline}
            onRegisterDevice={handleRegisterDevice}
            onPingDevice={handlePingDevice}
            onDeleteDevice={handleDeleteDevice}
          />
        );
      case "Reports":
        return (
          <ReportsPage
            backendOnline={backendOnline}
          />
        );
      case "Settings":
        return (
          <SettingsPage
            autoRefresh={autoRefresh}
            setAutoRefresh={setAutoRefresh}
            refreshInterval={refreshInterval}
            setRefreshInterval={setRefreshInterval}
            backendOnline={backendOnline}
            dbBackend={dbBackend}
            theme={theme}
            onToggleTheme={toggleTheme}
            onRefreshAll={fetchAllData}
          />
        );
      case "Privacy":
        return <PrivacyPolicyPage />;
      case "Terms":
        return <TermsPage />;
      default:
        return (
          <DashboardPage
            summary={summary}
            metrics={metrics}
            alerts={alerts}
            history={history}
            backendOnline={backendOnline}
            isLoading={isLoading}
            lastUpdated={lastUpdated}
            onNavigate={navigateTo}
            onAcknowledgeAlert={handleAcknowledgeAlert}
            onResolveAlert={handleResolveAlert}
          />
        );
    }
  };

  return (
    <div className={`app-root ${sidebarOpen ? "layout-sidebar-open" : "layout-sidebar-closed"} theme-${theme}`} data-theme={theme}>
      <Sidebar
        activePage={activePage}
        onNavigate={navigateTo}
        isOpen={sidebarOpen}
        unreadAlertsCount={unreadAlertsCount}
      />

      <div className="app-main-viewport">
        <Topbar
          activePage={activePage}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          backendOnline={backendOnline}
          dbBackend={dbBackend}
          isLoading={isLoading}
          theme={theme}
          onToggleTheme={toggleTheme}
          onRefresh={fetchAllData}
        />

        <main className="app-page-outlet">
          {renderActivePage()}
        </main>

        <Footer onNavigate={navigateTo} />
      </div>
    </div>
  );
}

export default App;