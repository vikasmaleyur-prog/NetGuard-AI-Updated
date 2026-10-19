import React, { useState } from "react";
import { Search, Download, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";

export function LogsPage({ logs = [], backendOnline, isLoading, onRefresh }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== "ALL" && (log.level || "").toUpperCase() !== levelFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMsg = (log.message || "").toLowerCase().includes(q);
      const matchSrc = (log.source || "").toLowerCase().includes(q);
      const matchId = (log.id || "").toLowerCase().includes(q);
      if (!matchMsg && !matchSrc && !matchId) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportCSV = () => {
    if (!filteredLogs.length) return;
    const headers = ["ID", "Timestamp", "Level", "Source", "Message"];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      l.level,
      l.source,
      `"${(l.message || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `netguard-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container logs-page">
      <div className="panel logs-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">System & Security Event Logs</h3>
            <span className="panel-subtitle">Persisted audit trail from database ({filteredLogs.length} matching events)</span>
          </div>

          <div className="panel-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              title="Download CSV export"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw size={14} className={isLoading ? "refresh-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="logs-filter-toolbar">
          <div className="search-input-wrap">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search message, source, ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="input-search"
            />
          </div>

          <div className="filter-button-group" role="group" aria-label="Filter by level">
            {["ALL", "INFO", "WARNING", "CRITICAL"].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`btn-filter ${levelFilter === lvl ? "active" : ""}`}
                onClick={() => {
                  setLevelFilter(lvl);
                  setCurrentPage(1);
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* LOGS TABLE */}
        <div className="table-responsive">
          {!backendOnline ? (
            <EmptyState
              type="danger"
              title="Database Disconnected"
              description="Unable to query operational logs while backend is offline."
            />
          ) : paginatedLogs.length === 0 ? (
            <EmptyState
              title="No Logs Found"
              description={
                logs.length === 0
                  ? "Zero system events currently stored in database."
                  : "No log records match your filter criteria."
              }
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "90px" }}>Log ID</th>
                  <th style={{ width: "170px" }}>Timestamp</th>
                  <th style={{ width: "100px" }}>Level</th>
                  <th style={{ width: "130px" }}>Source</th>
                  <th>Event Message</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log) => (
                  <tr key={log.id} className="log-table-row">
                    <td className="font-mono text-muted">{log.id}</td>
                    <td className="font-mono text-sm">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : "--"}
                    </td>
                    <td>
                      <Badge status={log.level} />
                    </td>
                    <td className="font-medium text-slate-200">{log.source || "System"}</td>
                    <td className="log-message-cell">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION */}
        {filteredLogs.length > pageSize && (
          <div className="table-pagination-row">
            <span className="pagination-info">
              Showing {(currentPage - 1) * pageSize + 1} to{" "}
              {Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length} records
            </span>

            <div className="pagination-controls">
              <button
                type="button"
                className="btn-icon btn-sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-page-indicator">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="btn-icon btn-sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LogsPage;
