import React from "react";
import { ShieldCheck, Activity, Cpu, Lock, CheckCircle2 } from "lucide-react";

export function AuthHeroVisual({ theme = "light", isRegister = false }) {
  return (
    <div className="auth-hero-visual-root" aria-hidden="true">
      {/* Background ambient glow shapes inspired by Craftly's layered ani-img elements */}
      <div className="ani-glow-shape ani-glow-1" />
      <div className="ani-glow-shape ani-glow-2" />
      <div className="ani-glow-shape ani-glow-3" />

      {/* Centerpiece: Neural Network Node Matrix & Shield Geometry */}
      <div className="hero-matrix-wrapper">
        <svg
          className="hero-matrix-svg"
          viewBox="0 0 600 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="matrixGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={theme === "dark" ? "#38bdf8" : "#2563eb"} stopOpacity="0.25" />
              <stop offset="100%" stopColor={theme === "dark" ? "#38bdf8" : "#2563eb"} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="netLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme === "dark" ? "#38bdf8" : "#2563eb"} stopOpacity="0.6" />
              <stop offset="100%" stopColor={theme === "dark" ? "#059669" : "#10b981"} stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme === "dark" ? "#1e293b" : "#ffffff"} />
              <stop offset="100%" stopColor={theme === "dark" ? "#0f172a" : "#f1f5f9"} />
            </linearGradient>
          </defs>

          {/* Concentric radar rings */}
          <circle cx="300" cy="300" r="240" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" className="svg-ring ring-outer" />
          <circle cx="300" cy="300" r="175" stroke="currentColor" strokeWidth="1" strokeDasharray="2 6" className="svg-ring ring-mid" />
          <circle cx="300" cy="300" r="110" stroke="currentColor" strokeWidth="1.5" className="svg-ring ring-inner" />
          <circle cx="300" cy="300" r="220" fill="url(#matrixGlow)" />

          {/* Interconnecting neural telemetry vectors */}
          <path d="M120 180 L230 250 L300 210 L370 250 L480 180" stroke="url(#netLineGrad)" strokeWidth="1.5" />
          <path d="M120 420 L230 350 L300 390 L370 350 L480 420" stroke="url(#netLineGrad)" strokeWidth="1.5" />
          <path d="M230 250 L230 350 M370 250 L370 350" stroke="url(#netLineGrad)" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M300 130 L300 210 M300 390 L300 470" stroke="url(#netLineGrad)" strokeWidth="1.5" />

          {/* Telemetry Node Points */}
          <circle cx="120" cy="180" r="5" className="svg-node node-pulse" />
          <circle cx="480" cy="180" r="5" className="svg-node node-pulse" />
          <circle cx="120" cy="420" r="5" className="svg-node node-pulse" />
          <circle cx="480" cy="420" r="5" className="svg-node node-pulse" />
          <circle cx="230" cy="250" r="6" className="svg-node node-active" />
          <circle cx="370" cy="250" r="6" className="svg-node node-active" />
          <circle cx="230" cy="350" r="6" className="svg-node node-active" />
          <circle cx="370" cy="350" r="6" className="svg-node node-active" />
          <circle cx="300" cy="130" r="4" className="svg-node" />
          <circle cx="300" cy="470" r="4" className="svg-node" />

          {/* Core Central Shield Emblem */}
          <g transform="translate(255, 250)">
            <rect x="0" y="0" width="90" height="100" rx="20" fill="url(#shieldGrad)" stroke={theme === "dark" ? "#38bdf8" : "#2563eb"} strokeWidth="2" className="svg-shield-box" />
            <path
              d="M45 22 L22 33 V50 C22 66 32 80 45 84 C58 80 68 66 68 50 V33 L45 22 Z"
              fill={theme === "dark" ? "#38bdf8" : "#111827"}
              opacity="0.9"
            />
            <path
              d="M38 52 L43 57 L54 44"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>

        {/* Floating Telemetry Glassmorphic Cards (Craftly.ai inspired floating elements) */}
        <div className="floating-metric-card float-card-top-left">
          <div className="float-card-icon icon-success">
            <ShieldCheck size={16} />
          </div>
          <div className="float-card-info">
            <span className="float-card-title">Ensemble Verdict</span>
            <span className="float-card-value font-mono">NORMAL (Consensus: 99.4%)</span>
          </div>
        </div>

        <div className="floating-metric-card float-card-top-right">
          <div className="float-card-icon icon-info">
            <Activity size={16} />
          </div>
          <div className="float-card-info">
            <span className="float-card-title">Gateway Latency</span>
            <span className="float-card-value font-mono">14.2 ms (Verified)</span>
          </div>
        </div>

        <div className="floating-metric-card float-card-bottom-left">
          <div className="float-card-icon icon-brand">
            <Cpu size={16} />
          </div>
          <div className="float-card-info">
            <span className="float-card-title">AI Engine</span>
            <span className="float-card-value font-mono">Isolation Forest Active</span>
          </div>
        </div>

        <div className="floating-metric-card float-card-bottom-right">
          <div className="float-card-icon icon-secure">
            <Lock size={16} />
          </div>
          <div className="float-card-info">
            <span className="float-card-title">Security Session</span>
            <span className="float-card-value font-mono">Bcrypt & JWT Verified</span>
          </div>
        </div>
      </div>

      {/* Large Typography Statement (Inspired by Craftly's "Changing the way the world writes") */}
      <div className="hero-text-block">
        <h2 className="hero-punchline">
          {isRegister ? (
            <>
              Next-Gen Observability for <span className="highlight-text">Autonomous Security</span>
            </>
          ) : (
            <>
              Changing how SecOps <span className="highlight-text">defends the network</span>
            </>
          )}
        </h2>
        <p className="hero-subpunchline">
          Real-time packet telemetry, zero fabricated metrics, and deterministic multi-model consensus
          running 24/7 on your infrastructure.
        </p>

        {/* Feature badges */}
        <div className="hero-feature-pills">
          <span className="feature-pill">
            <CheckCircle2 size={13} />
            <span>Zero Mock Telemetry</span>
          </span>
          <span className="feature-pill">
            <CheckCircle2 size={13} />
            <span>Constant-Time Bcrypt</span>
          </span>
          <span className="feature-pill">
            <CheckCircle2 size={13} />
            <span>Multi-Model AI Consensus</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default AuthHeroVisual;
