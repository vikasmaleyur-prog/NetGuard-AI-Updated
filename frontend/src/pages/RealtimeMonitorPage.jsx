import React from "react";
import { Cpu, CircleGauge, HardDrive, Network, Radio, RefreshCw, Clock, ArrowDown, ArrowUp, Activity } from "lucide-react";
import MetricCard from "../components/MetricCard";
import TrafficChart from "../components/TrafficChart";
import Badge from "../components/Badge";

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "--";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function RealtimeMonitorPage({
  metrics,
  history = [],
  backendOnline,
  isLoading,
  lastUpdated,
  onRefresh,
}) {
  const m = metrics?.metrics || {};

  const cpu = m.cpu_usage_percent;
  const memory = m.memory_usage_percent;
  const disk = m.disk_usage_percent;
  const latency = m.latency_ms;

  // Stale data calculation (> 15 seconds since last update)
  const isStale = lastUpdated && Date.now() - new Date(lastUpdated).getTime() > 15000;

  return (
    <div className="page-container realtime-monitor-page">
      {/* 1. MONITOR HEADER BAR */}
      <div className="monitor-status-header">
        <div className="monitor-status-left">
          <div className="monitor-pulse-wrap">
            <Radio size={20} className={backendOnline && !isStale ? "pulse-active" : "pulse-idle"} />
          </div>
          <div>
            <h3 className="monitor-heading">
              {backendOnline
                ? isStale
                  ? "Real-Time Telemetry (Stale Data Warning)"
                  : "Live System Telemetry Stream"
                : "Real-Time Telemetry Disconnected"}
            </h3>
            <span className="monitor-subheading">
              {backendOnline
                ? `Active polling cycle at host daemon • Last reading at ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "--"}`
                : "Backend offline. Reconnecting to local telemetry collector..."}
            </span>
          </div>
        </div>

        <div className="monitor-status-right">
          <Badge status={backendOnline ? (isStale ? "WARNING" : "ONLINE") : "OFFLINE"} />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? "refresh-spin" : ""} />
            Poll Now
          </button>
        </div>
      </div>

      {/* 2. REAL-TIME METRICS */}
      <div className="metrics-grid">
        <MetricCard
          icon={<Cpu size={20} />}
          title="CPU Utilization"
          value={cpu !== null && cpu !== undefined ? cpu.toFixed(1) : null}
          unit="%"
          trend={backendOnline && !isStale ? "LIVE" : "STALE"}
          trendType={cpu > 90 ? "danger" : cpu > 80 ? "warning" : "positive"}
          subtitle="All physical & logical cores"
          isLoading={isLoading && !m.timestamp}
        />

        <MetricCard
          icon={<CircleGauge size={20} />}
          title="Memory Consumption"
          value={memory !== null && memory !== undefined ? memory.toFixed(1) : null}
          unit="%"
          trend={backendOnline && !isStale ? "LIVE" : "STALE"}
          trendType={memory > 85 ? "warning" : "positive"}
          subtitle="Active virtual memory"
          isLoading={isLoading && !m.timestamp}
        />

        <MetricCard
          icon={<HardDrive size={20} />}
          title="Disk Capacity"
          value={disk !== null && disk !== undefined ? disk.toFixed(1) : null}
          unit="%"
          trend={backendOnline && !isStale ? "LIVE" : "STALE"}
          trendType={disk > 90 ? "danger" : "positive"}
          subtitle="Root filesystem usage"
          isLoading={isLoading && !m.timestamp}
        />

        <MetricCard
          icon={<Network size={20} />}
          title="Network Latency"
          value={latency !== null && latency !== undefined ? latency.toFixed(1) : null}
          unit="ms"
          trend={backendOnline && !isStale ? "LIVE" : "STALE"}
          trendType={latency > 150 ? "danger" : latency > 100 ? "warning" : "positive"}
          subtitle="Handshake round-trip time"
          isLoading={isLoading && !m.timestamp}
        />
      </div>

      {/* 3. NETWORK I/O COUNTERS & PACKET METRICS */}
      <div className="panel network-telemetry-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Cumulative Network Hardware Telemetry</h3>
            <span className="panel-subtitle">NIC interface metrics from system kernel</span>
          </div>
          <span className="telemetry-timestamp">
            <Clock size={13} />
            {m.timestamp ? `Captured ${new Date(m.timestamp).toLocaleTimeString()}` : "Awaiting capture"}
          </span>
        </div>

        <div className="nic-stats-grid">
          <div className="nic-stat-card">
            <div className="nic-stat-icon incoming">
              <ArrowDown size={18} />
            </div>
            <div className="nic-stat-content">
              <span className="nic-stat-label">Total Bytes Received</span>
              <strong className="nic-stat-value">{formatBytes(m.bytes_received)}</strong>
              <small className="nic-stat-rate">Rate: {m.bytes_recv_per_sec ? `${m.bytes_recv_per_sec.toFixed(0)} B/s` : "0 B/s"}</small>
            </div>
          </div>

          <div className="nic-stat-card">
            <div className="nic-stat-icon outgoing">
              <ArrowUp size={18} />
            </div>
            <div className="nic-stat-content">
              <span className="nic-stat-label">Total Bytes Transmitted</span>
              <strong className="nic-stat-value">{formatBytes(m.bytes_sent)}</strong>
              <small className="nic-stat-rate">Rate: {m.bytes_sent_per_sec ? `${m.bytes_sent_per_sec.toFixed(0)} B/s` : "0 B/s"}</small>
            </div>
          </div>

          <div className="nic-stat-card">
            <div className="nic-stat-icon neutral">
              <Activity size={18} />
            </div>
            <div className="nic-stat-content">
              <span className="nic-stat-label">Total Packets In / Out</span>
              <strong className="nic-stat-value">
                {m.packets_received ? m.packets_received.toLocaleString() : "--"} / {m.packets_sent ? m.packets_sent.toLocaleString() : "--"}
              </strong>
              <small className="nic-stat-rate">
                NIC drops: {m.drops_in || 0} in, {m.drops_out || 0} out
              </small>
            </div>
          </div>

          <div className="nic-stat-card">
            <div className="nic-stat-icon neutral">
              <Network size={18} />
            </div>
            <div className="nic-stat-content">
              <span className="nic-stat-label">Interface Errors</span>
              <strong className="nic-stat-value">
                {m.errors_in || 0} Inbound • {m.errors_out || 0} Outbound
              </strong>
              <small className="nic-stat-rate">
                Status: {m.errors_in === 0 && m.errors_out === 0 ? "Zero frame errors" : "Errors recorded"}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* 4. ACTIVE NETWORK INTERFACES TABLE */}
      <div className="panel network-interfaces-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Active Network Interfaces & Sockets</h3>
            <span className="panel-subtitle">Physical and logical network interface bindings from psutil</span>
          </div>
          <span className="telemetry-timestamp">
            {Array.isArray(m.interfaces) ? `${m.interfaces.length} Interfaces Active` : "Detecting interfaces..."}
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Interface</th>
                <th>Status</th>
                <th>IPv4 Address</th>
                <th>MTU Size</th>
                <th>Speed</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(m.interfaces) && m.interfaces.length > 0 ? (
                m.interfaces.map((iface) => (
                  <tr key={iface.name}>
                    <td>
                      <strong className="code-text">{iface.name}</strong>
                    </td>
                    <td>
                      <span className="status-badge-inline status-badge-online">
                        <span className="status-dot-sm" />
                        {iface.status}
                      </span>
                    </td>
                    <td>
                      <span className="code-text">{iface.ip_address}</span>
                    </td>
                    <td>{iface.mtu} octets</td>
                    <td>{iface.speed_mbps > 0 ? `${iface.speed_mbps} Mbps` : "Auto-negotiate"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="table-empty-cell">
                    Gathering network interface telemetry from kernel...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. THROUGHPUT TIME-SERIES */}
      <TrafficChart history={history} latestMetrics={m} />
    </div>
  );
}

export default RealtimeMonitorPage;
