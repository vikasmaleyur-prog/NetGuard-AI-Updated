import React from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

function formatBytesPerSec(bytes) {
  if (bytes === null || bytes === undefined || isNaN(bytes)) return "--";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB/s`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
  return `${Number(bytes).toFixed(0)} B/s`;
}

export function TrafficChart({ history = [], latestMetrics = null }) {
  // Extract chronological data points
  // history is sorted newest-first from backend, so reverse it for chronological display
  const points = [...history].reverse();

  // If we have history records with throughput rates, use them
  const series = points.map((r, i) => {
    const m = r.metrics || {};
    const sent = Number(m.bytes_sent_per_sec || 0);
    const recv = Number(m.bytes_recv_per_sec || 0);
    const timeStr = m.timestamp
      ? new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : `#${i + 1}`;
    return { sent, recv, timeStr };
  });

  const latestSent = latestMetrics?.bytes_sent_per_sec ?? series[series.length - 1]?.sent ?? 0;
  const latestRecv = latestMetrics?.bytes_recv_per_sec ?? series[series.length - 1]?.recv ?? 0;

  // Compute scale
  const maxVal = Math.max(
    ...series.map((p) => Math.max(p.sent, p.recv)),
    latestSent,
    latestRecv,
    1024 // minimum 1 KB/s ceiling
  );

  const width = 640;
  const height = 180;
  const padLeft = 40;
  const padBottom = 25;
  const padTop = 15;
  const padRight = 15;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const numPoints = series.length;
  const getX = (idx) => padLeft + (numPoints <= 1 ? chartW / 2 : (idx / (numPoints - 1)) * chartW);
  const getY = (val) => padTop + chartH - (val / maxVal) * chartH;

  const sentPath = series.length > 1
    ? series.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(p.sent).toFixed(1)}`).join(" ")
    : "";

  const recvPath = series.length > 1
    ? series.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(p.recv).toFixed(1)}`).join(" ")
    : "";

  return (
    <div className="panel traffic-panel">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">Network Throughput</h3>
          <span className="panel-subtitle">Real-time bandwidth utilization rate</span>
        </div>

        <div className="traffic-live-stats">
          <div className="stat-pill stat-in">
            <ArrowDownLeft size={14} />
            <span>In: <strong>{formatBytesPerSec(latestRecv)}</strong></span>
          </div>
          <div className="stat-pill stat-out">
            <ArrowUpRight size={14} />
            <span>Out: <strong>{formatBytesPerSec(latestSent)}</strong></span>
          </div>
        </div>
      </div>

      <div className="traffic-chart-container">
        {series.length < 2 ? (
          <div className="chart-empty-state">
            <span>Collecting time-series throughput samples (need at least 2 readings)...</span>
          </div>
        ) : (
          <svg
            className="traffic-svg"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Network throughput chart"
          >
            {/* Grid lines */}
            <line x1={padLeft} y1={padTop} x2={width - padRight} y2={padTop} stroke="var(--chart-grid, #e5e7eb)" strokeDasharray="3 3" />
            <line x1={padLeft} y1={padTop + chartH / 2} x2={width - padRight} y2={padTop + chartH / 2} stroke="var(--chart-grid, #e5e7eb)" strokeDasharray="3 3" />
            <line x1={padLeft} y1={padTop + chartH} x2={width - padRight} y2={padTop + chartH} stroke="var(--chart-grid, #e5e7eb)" />

            {/* Y axis labels */}
            <text x={padLeft - 6} y={padTop + 4} textAnchor="end" fill="var(--chart-axis, #6b7280)" className="chart-axis-label">
              {formatBytesPerSec(maxVal)}
            </text>
            <text x={padLeft - 6} y={padTop + chartH / 2 + 4} textAnchor="end" fill="var(--chart-axis, #6b7280)" className="chart-axis-label">
              {formatBytesPerSec(maxVal / 2)}
            </text>
            <text x={padLeft - 6} y={padTop + chartH + 4} textAnchor="end" fill="var(--chart-axis, #6b7280)" className="chart-axis-label">
              0
            </text>

            {/* Inbound Line (Emerald) */}
            {recvPath && (
              <path
                d={recvPath}
                fill="none"
                stroke="var(--chart-inbound, #16a34a)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Outbound Line (Blue) */}
            {sentPath && (
              <path
                d={sentPath}
                fill="none"
                stroke="var(--chart-outbound, #2563eb)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* X Axis Time Labels */}
            {series.map((p, i) => {
              // Show label on first, middle, and last
              const isFirst = i === 0;
              const isLast = i === series.length - 1;
              const isMid = i === Math.floor(series.length / 2);
              if (!isFirst && !isLast && !isMid) return null;
              return (
                <text
                  key={i}
                  x={getX(i)}
                  y={height - 6}
                  textAnchor={isFirst ? "start" : isLast ? "end" : "middle"}
                  fill="var(--chart-axis, #6b7280)"
                  className="chart-axis-label"
                >
                  {p.timeStr}
                </text>
              );
            })}
          </svg>
        )}
      </div>

      <div className="chart-footer-legend">
        <span className="legend-item">
          <span className="legend-indicator" style={{ backgroundColor: "var(--chart-inbound, #16a34a)" }} />
          Inbound Traffic (bytes received / sec)
        </span>
        <span className="legend-item">
          <span className="legend-indicator" style={{ backgroundColor: "var(--chart-outbound, #2563eb)" }} />
          Outbound Traffic (bytes sent / sec)
        </span>
        <span className="legend-note">
          Based on {series.length} recorded samples
        </span>
      </div>
    </div>
  );
}

export default TrafficChart;
