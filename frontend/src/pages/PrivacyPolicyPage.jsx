import React from "react";
import { ShieldCheck } from "lucide-react";

export function PrivacyPolicyPage() {
  return (
    <div className="page-container legal-page">
      <div className="panel legal-panel">
        <div className="legal-header">
          <div className="legal-icon-wrap" aria-hidden="true">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h2 className="legal-title">Privacy Policy</h2>
            <span className="legal-subtitle">Last Updated: October 19, 2026 • NetGuard AI Telemetry Architecture</span>
          </div>
        </div>

        <div className="legal-content">
          <section className="legal-section">
            <h3>1. Introduction and Scope</h3>
            <p>
              NetGuard AI is an on-premises and private-cloud network monitoring, telemetry ingestion, and anomaly detection system. This Privacy Policy outlines how operational system metrics, network throughput counters, and diagnostic logs are captured, processed, stored, and protected within the NetGuard AI software deployment.
            </p>
          </section>

          <section className="legal-section">
            <h3>2. Data Captured and Processed</h3>
            <p>NetGuard AI collects technical telemetry solely for operational health and security analysis:</p>
            <ul>
              <li><strong>Host Hardware Metrics:</strong> CPU utilization percentage, physical and virtual memory consumption, and mounted storage capacity.</li>
              <li><strong>Network Interface Telemetry:</strong> Cumulative byte and packet counters (inbound and outbound), interface packet drop counts, and socket error indicators.</li>
              <li><strong>Latency Probes:</strong> Round-trip time (RTT) measurements to designated network gateways, DNS resolvers, and operator-registered endpoints.</li>
              <li><strong>Machine Learning Features:</strong> Feature vectors extracted from consecutive telemetry frames to perform Isolation Forest, Random Forest, and sequence anomaly detection.</li>
              <li><strong>Operator Audit Logs:</strong> Timestamped operational events, threshold incident alerts, and administrative configuration updates.</li>
            </ul>
            <p>
              NetGuard AI does <strong>not</strong> perform deep packet inspection (DPI) of unencrypted user payloads, nor does it capture browsing history, personal user identifiers, or private message contents.
            </p>
          </section>

          <section className="legal-section">
            <h3>3. Data Storage and Retention</h3>
            <p>
              All captured telemetry is persisted in the operator-configured database storage layer (local SQLite database at <code>database/netguard.db</code> or operator-supplied MongoDB Atlas cluster).
            </p>
            <ul>
              <li><strong>Telemetry History:</strong> Rolling historical telemetry is bounded by operator-defined retention settings (default 200 chronological records).</li>
              <li><strong>Security Alerts & Audit Logs:</strong> Incident records and logs are maintained until explicitly marked resolved or purged by the authorized administrator.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h3>4. Access Controls and Third-Party Disclosure</h3>
            <p>
              NetGuard AI operates within your private local network or dedicated virtual private cloud (VPC). Telemetry data is never shared with, sold to, or syndicated to advertising networks or external data brokers.
            </p>
            <p>
              If an external MongoDB Atlas cluster is configured, telemetry transmission is encrypted in transit using Transport Layer Security (TLS 1.3) with verified certificate authorities.
            </p>
          </section>

          <section className="legal-section">
            <h3>5. Organizational Contact Information</h3>
            <p>
              For privacy inquiries, security disclosures, or compliance audits relating to this deployment:
            </p>
            <div className="callout-card callout-neutral">
              <p className="callout-text">
                <strong>Deployment Entity:</strong> [Organization Name Requiring Confirmation]<br />
                <strong>Security Officer Contact:</strong> [security@yourcompany.internal / Requires Confirmation]<br />
                <strong>Deployment Scope:</strong> Internal Infrastructure Telemetry Monitoring
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
