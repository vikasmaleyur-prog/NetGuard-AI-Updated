import React, { useState, useEffect, useCallback } from "react";
import { Download, Calendar, Activity, AlertTriangle, RefreshCw } from "lucide-react";
import MetricCard from "../components/MetricCard";
import EmptyState from "../components/EmptyState";
import api from "../api/client";

export function ReportsPage({ backendOnline }) {
  const [period, setPeriod] = useState("24h");
  const [summaryData, setSummaryData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const fetchReport = useCallback(async (selectedPeriod = period) => {
    if (!backendOnline) return;
    setIsLoading(true);
    try {
      const res = await api.getReportSummary(selectedPeriod);
      if (res.ok) {
        setSummaryData(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [backendOnline, period]);

  useEffect(() => {
    fetchReport(period);
  }, [fetchReport, period]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await api.exportReport(period);
      if (res.ok && res.data) {
        const url = window.URL.createObjectURL(res.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `netguard-telemetry-audit-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert("Failed to export report CSV: " + (res.error || "Unknown error"));
      }
    } catch (err) {
      alert("Export error: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const mSummary = summaryData?.metrics_summary || {};
  const aSummary = summaryData?.alerts_summary || {};

  return (
    <div className="page-container reports-page">
      {/* 1. REPORT HEADER & PERIOD SELECTOR */}
      <div className="panel report-controls-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Telemetry Audit & Reporting</h3>
            <span className="panel-subtitle">Aggregated performance and security metrics from persistent storage</span>
          </div>

          <div className="report-actions-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleExportCSV}
              disabled={isExporting || !backendOnline || summaryData?.total_telemetry_samples === 0}
            >
              <Download size={14} className={isExporting ? "refresh-spin" : ""} />
              {isExporting ? "Generating CSV..." : "Export Full CSV Report"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fetchReport(period)}
              disabled={isLoading}
            >
              <RefreshCw size={14} className={isLoading ? "refresh-spin" : ""} />
              Recalculate
            </button>
          </div>
        </div>

        <div className="report-period-selector-row">
          <span className="period-label">
            <Calendar size={14} />
            Reporting Window:
          </span>

          <div className="filter-button-group">
            {[
              { id: "1h", label: "Past 1 Hour" },
              { id: "6h", label: "Past 6 Hours" },
              { id: "24h", label: "Past 24 Hours" },
              { id: "7d", label: "Past 7 Days" },
              { id: "all", label: "All Historical" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn-filter ${period === p.id ? "active" : ""}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <span className="report-gen-time">
            Generated: {summaryData?.generated_at ? new Date(summaryData.generated_at).toLocaleString() : "--"}
          </span>
        </div>
      </div>

      {/* 2. AGGREGATED METRICS */}
      <div className="metrics-grid" style={{ marginTop: "20px" }}>
        <MetricCard
          icon={<Activity size={20} />}
          title="Average CPU Load"
          value={mSummary.avg_cpu_percent !== null && mSummary.avg_cpu_percent !== undefined ? mSummary.avg_cpu_percent : null}
          unit="%"
          subtitle={mSummary.peak_cpu_percent ? `Peak: ${mSummary.peak_cpu_percent}%` : null}
          trend={mSummary.avg_cpu_percent ? (mSummary.avg_cpu_percent > 80 ? "ELEVATED" : "NORMAL") : null}
          trendType={mSummary.avg_cpu_percent > 80 ? "warning" : "positive"}
          isLoading={isLoading}
        />

        <MetricCard
          icon={<Activity size={20} />}
          title="Average Memory Load"
          value={mSummary.avg_memory_percent !== null && mSummary.avg_memory_percent !== undefined ? mSummary.avg_memory_percent : null}
          unit="%"
          subtitle={mSummary.peak_memory_percent ? `Peak: ${mSummary.peak_memory_percent}%` : null}
          trend={mSummary.avg_memory_percent ? (mSummary.avg_memory_percent > 85 ? "HIGH" : "NOMINAL") : null}
          trendType={mSummary.avg_memory_percent > 85 ? "warning" : "positive"}
          isLoading={isLoading}
        />

        <MetricCard
          icon={<Activity size={20} />}
          title="Average Network Latency"
          value={mSummary.avg_latency_ms !== null && mSummary.avg_latency_ms !== undefined ? mSummary.avg_latency_ms : null}
          unit="ms"
          subtitle="Round-trip time baseline"
          trend={mSummary.avg_latency_ms ? (mSummary.avg_latency_ms > 100 ? "ELEVATED" : "OPTIMAL") : null}
          trendType={mSummary.avg_latency_ms > 100 ? "warning" : "positive"}
          isLoading={isLoading}
        />

        <MetricCard
          icon={<AlertTriangle size={20} />}
          title="Total Security Incidents"
          value={aSummary.total_alerts !== null && aSummary.total_alerts !== undefined ? aSummary.total_alerts : null}
          subtitle={`${aSummary.critical || 0} Critical, ${aSummary.warning || 0} Warning`}
          trend={aSummary.critical > 0 ? "ACTION REQUIRED" : "NOMINAL"}
          trendType={aSummary.critical > 0 ? "danger" : "positive"}
          isLoading={isLoading}
        />
      </div>

      {/* 3. DETAILED SUMMARY BREAKDOWN */}
      <div className="panel report-summary-table-panel" style={{ marginTop: "20px" }}>
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Audit Record Breakdown</h3>
            <span className="panel-subtitle">Total telemetry samples in selected period: {summaryData?.total_telemetry_samples ?? 0}</span>
          </div>
        </div>

        {!backendOnline ? (
          <EmptyState
            type="danger"
            title="Backend Offline"
            description="Unable to compile audit report while backend server is disconnected."
          />
        ) : summaryData?.total_telemetry_samples === 0 ? (
          <EmptyState
            title="No Samples in Time Window"
            description={`Zero telemetry records found in the ${period} window. Telemetry is saved as the collector executes.`}
          />
        ) : (
          <div className="report-breakdown-grid">
            <div className="breakdown-card">
              <h4 className="breakdown-title">Telemetry Ingestion Samples</h4>
              <div className="breakdown-metric-row">
                <span>Samples Processed:</span>
                <strong>{summaryData?.total_telemetry_samples}</strong>
              </div>
              <div className="breakdown-metric-row">
                <span>Peak Host CPU:</span>
                <strong>{mSummary.peak_cpu_percent !== null ? `${mSummary.peak_cpu_percent}%` : "--"}</strong>
              </div>
              <div className="breakdown-metric-row">
                <span>Peak Host RAM:</span>
                <strong>{mSummary.peak_memory_percent !== null ? `${mSummary.peak_memory_percent}%` : "--"}</strong>
              </div>
            </div>

            <div className="breakdown-card">
              <h4 className="breakdown-title">Security Incidents Breakdown</h4>
              <div className="breakdown-metric-row">
                <span>Critical Incidents:</span>
                <strong className={aSummary.critical > 0 ? "text-danger" : "text-slate"}>{aSummary.critical || 0}</strong>
              </div>
              <div className="breakdown-metric-row">
                <span>Warning Flags:</span>
                <strong className={aSummary.warning > 0 ? "text-warning" : "text-slate"}>{aSummary.warning || 0}</strong>
              </div>
              <div className="breakdown-metric-row">
                <span>Informational Events:</span>
                <strong>{aSummary.info || 0}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReportsPage;
