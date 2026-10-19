import React from "react";
import { FileText } from "lucide-react";

export function TermsPage() {
  return (
    <div className="page-container legal-page">
      <div className="panel legal-panel">
        <div className="legal-header">
          <div className="legal-icon-wrap" aria-hidden="true">
            <FileText size={28} />
          </div>
          <div>
            <h2 className="legal-title">Terms and Conditions</h2>
            <span className="legal-subtitle">Effective Date: October 19, 2026 • NetGuard AI Software License & Usage Agreement</span>
          </div>
        </div>

        <div className="legal-content">
          <section className="legal-section">
            <h3>1. Authorized Network Monitoring</h3>
            <p>
              NetGuard AI is designed strictly for monitoring, diagnostic analysis, and incident alerting across systems, servers, and networks that you own or have express, authorized permission to inspect.
            </p>
            <p>
              Probing, latency measurement, or telemetry extraction against third-party networks, IP addresses, or host infrastructure without explicit authorization is strictly prohibited.
            </p>
          </section>

          <section className="legal-section">
            <h3>2. Heuristic and Machine Learning Disclaimer</h3>
            <p>
              NetGuard AI utilizes statistical anomaly detection and machine learning algorithms (including Isolation Forest, Random Forest, and sequence prediction models).
            </p>
            <ul>
              <li>
                <strong>Heuristic Nature:</strong> Anomaly detection scores reflect statistical deviation from established baseline parameters and must not be treated as absolute or infallible proof of compromise or hardware failure.
              </li>
              <li>
                <strong>Human-in-the-Loop:</strong> Operators must independently verify alerts, telemetry data, and recommended mitigation actions before taking destructive or service-impacting remediation actions.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h3>3. Operator Responsibilities</h3>
            <p>The operator of NetGuard AI agrees to:</p>
            <ul>
              <li>Maintain safe storage and environment credentials (such as database credentials and API secrets).</li>
              <li>Configure reasonable polling intervals and latency timeout parameters that do not saturate monitored network interfaces.</li>
              <li>Ensure all administrative users accessing the SecOps console possess appropriate clearance within your organization.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h3>4. Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by applicable law, NetGuard AI is provided "as is" and "as available", without warranty of any kind, express or implied. Under no circumstances shall the authors or copyright holders be liable for any direct, indirect, incidental, or consequential damages resulting from network downtime, false positive alerts, false negative detections, or unperformed recovery actions.
            </p>
          </section>

          <section className="legal-section">
            <h3>5. Legal Entity & Jurisdiction</h3>
            <div className="callout-card callout-neutral">
              <p className="callout-text">
                <strong>Governing Entity:</strong> [Legal Entity Requiring Confirmation]<br />
                <strong>Applicable Jurisdiction:</strong> [Jurisdiction Requiring Legal Review]<br />
                <strong>Contact Email:</strong> [legal@yourcompany.internal / Requires Confirmation]
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TermsPage;
