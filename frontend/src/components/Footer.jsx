import React from "react";
import { ShieldCheck } from "lucide-react";

export function Footer({ onNavigate }) {
  return (
    <footer className="app-footer">
      <div className="footer-left">
        <span className="footer-brand">
          <ShieldCheck size={14} />
          NetGuard AI Security System
        </span>
        <span className="footer-meta">v1.0.0 (Production Core)</span>
      </div>

      <div className="footer-links">
        <button
          type="button"
          className="footer-link-btn"
          onClick={() => onNavigate("Privacy")}
        >
          Privacy Policy
        </button>
        <span className="footer-sep">•</span>
        <button
          type="button"
          className="footer-link-btn"
          onClick={() => onNavigate("Terms")}
        >
          Terms and Conditions
        </button>
        <span className="footer-sep">•</span>
        <span className="footer-note">Telemetry stored in persistent local database</span>
      </div>
    </footer>
  );
}

export default Footer;
