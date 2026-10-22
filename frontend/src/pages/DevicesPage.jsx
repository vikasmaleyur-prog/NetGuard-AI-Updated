import React, { useState } from "react";
import { Server, Plus, Trash2, RefreshCw, ShieldCheck } from "lucide-react";
import Badge from "../components/Badge";
import Modal from "../components/Modal";
import EmptyState from "../components/EmptyState";
import MagneticButton from "../components/MagneticButton";
import ScrollReveal from "../components/ScrollReveal";

export function DevicesPage({
  devices = [],
  backendOnline,
  onRegisterDevice,
  onPingDevice,
  onDeleteDevice,
  isOperating = false,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [role, setRole] = useState("Endpoint");
  const [pingingId, setPingingId] = useState(null);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim() || !ip.trim()) return;
    await onRegisterDevice({
      name: name.trim(),
      ip: ip.trim(),
      role: role.trim(),
    });
    setName("");
    setIp("");
    setIsModalOpen(false);
  };

  const handlePing = async (devId) => {
    setPingingId(devId);
    try {
      await onPingDevice(devId);
    } finally {
      setPingingId(null);
    }
  };

  return (
    <div className="page-container devices-page">
      {/* 1. ARCHITECTURE NOTICE */}
      <ScrollReveal direction="fade" delay={0}>
        <div className="callout-card callout-info">
          <div className="callout-icon" aria-hidden="true">
            <ShieldCheck size={20} />
          </div>
          <div className="callout-content">
            <h4 className="callout-title">Monitoring Architecture Note</h4>
            <p className="callout-text">
              NetGuard AI executes primary system telemetry collection (CPU, Memory, Disk, NIC counters) directly on the local host machine. Registered external devices represent network targets continuously probed for latency, reachability, and network path health.
            </p>
          </div>
        </div>
      </ScrollReveal>

      {/* 2. DEVICE INVENTORY PANEL */}
      <ScrollReveal direction="up" delay={80}>
        <div className="panel devices-panel" style={{ marginTop: "20px" }}>
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Monitored Endpoints & Infrastructure</h3>
            <span className="panel-subtitle">Total targets registered: {devices.length}</span>
          </div>

          <MagneticButton
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsModalOpen(true)}
            title="Register new network target"
          >
            <Plus size={14} />
            Add Target
          </MagneticButton>
        </div>

        <div className="table-responsive">
          {!backendOnline ? (
            <EmptyState
              type="danger"
              title="Backend Disconnected"
              description="Unable to load monitored devices while the backend is unreachable."
            />
          ) : devices.length === 0 ? (
            <EmptyState
              title="No Devices Registered"
              description="Register network hosts, gateways, or servers to begin latency probes."
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device / Endpoint</th>
                  <th>IP Address</th>
                  <th>Role</th>
                  <th>Network Status</th>
                  <th>Latency RTT</th>
                  <th>Last Seen</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((dev) => {
                  const isPinging = pingingId === dev.id;
                  const isHost = dev.id === "dev-host-01";

                  return (
                    <tr key={dev.id}>
                      <td>
                        <div className="device-name-wrap">
                          <Server size={16} className="text-blue" />
                          <div>
                            <strong className="device-name-text">{dev.name}</strong>
                            <span className="device-id-sub">{dev.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="font-mono text-sm">{dev.ip}</td>
                      <td>
                        <span className="role-tag">{dev.role || "Host"}</span>
                      </td>
                      <td>
                        <Badge status={dev.status} />
                      </td>
                      <td className="font-mono">
                        {dev.latency_ms !== null && dev.latency_ms !== undefined
                          ? `${dev.latency_ms.toFixed(1)} ms`
                          : "--"}
                      </td>
                      <td className="font-mono text-sm text-muted">
                        {dev.last_seen ? new Date(dev.last_seen).toLocaleTimeString() : "--"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="table-actions-group">
                          <button
                            type="button"
                            className="btn-action btn-sm btn-secondary"
                            onClick={() => handlePing(dev.id)}
                            disabled={isPinging || isOperating}
                            title="Ping this target now"
                          >
                            <RefreshCw size={13} className={isPinging ? "refresh-spin" : ""} />
                            {isPinging ? "Pinging..." : "Test Ping"}
                          </button>

                          {!isHost && (
                            <button
                              type="button"
                              className="btn-action btn-sm btn-danger"
                              onClick={() => onDeleteDevice(dev.id)}
                              disabled={isOperating}
                              title="Delete target"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ScrollReveal>

      {/* ADD TARGET MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Network Target"
      >
        <form onSubmit={handleRegister} className="form-stack">
          <div className="form-group">
            <label htmlFor="dev-name" className="form-label">Endpoint Name</label>
            <input
              id="dev-name"
              type="text"
              placeholder="e.g., Core Gateway or Web Server 01"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="dev-ip" className="form-label">IPv4 / IPv6 Address or Hostname</label>
            <input
              id="dev-ip"
              type="text"
              placeholder="e.g., 192.168.1.1 or 8.8.4.4"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="dev-role" className="form-label">Role Classification</label>
            <select
              id="dev-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-select"
            >
              <option value="Gateway">Default Gateway</option>
              <option value="DNS Resolver">DNS Resolver</option>
              <option value="Application Server">Application Server</option>
              <option value="Database Host">Database Host</option>
              <option value="Endpoint">Client Endpoint</option>
            </select>
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
              Register Target
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default DevicesPage;
