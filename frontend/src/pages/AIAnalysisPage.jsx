import React, { useState } from "react";
import { Brain, Shield, Network, Zap, Play, ChevronDown, ChevronUp } from "lucide-react";
import Badge from "../components/Badge";

export function AIAnalysisPage({
  aiStatus,
  decision,
  onTriggerInference,
  isProcessing = false,
}) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const aiAnalysis = aiStatus?.ai_analysis || {};
  const dec = decision?.decision || aiStatus?.decision || {};

  const models = aiAnalysis.models || {
    isolation_forest: {
      status: aiAnalysis.status || "NOT CONFIGURED",
      score: aiAnalysis.anomaly_score,
      detail: "Unsupervised anomaly detection baseline",
    },
    random_forest: {
      status: aiAnalysis.random_forest_status || "NOT CONFIGURED",
      confidence: aiAnalysis.random_forest_confidence,
      detail: "Supervised classification model",
    },
    lstm: {
      status: aiAnalysis.lstm_status || "NOT CONFIGURED",
      detail: "TensorFlow runtime not installed in environment (Python 3.13)",
    },
  };

  const iso = models.isolation_forest || {};
  const rf = models.random_forest || {};
  const lstm = models.lstm || {};

  const decStatus = dec.status || "INSUFFICIENT DATA";
  const decAction = dec.action || "Awaiting telemetry samples";
  const votes = dec.anomaly_votes ?? 0;
  const activeCount = dec.active_models ?? 0;

  return (
    <div className="page-container ai-analysis-page">
      {/* 1. ENSEMBLE DECISION ENGINE CARD */}
      <div className="panel ensemble-hero-card">
        <div className="ensemble-hero-header">
          <div className="ensemble-icon-box">
            <Zap size={22} />
          </div>
          <div className="ensemble-hero-title">
            <h3>AI Consensus & Decision Engine</h3>
            <span className="panel-subtitle">Weighted ensemble combining verified detector outputs</span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onTriggerInference}
            disabled={isProcessing}
          >
            <Play size={14} className={isProcessing ? "refresh-spin" : ""} />
            {isProcessing ? "Evaluating Models..." : "Run Anomaly Inference"}
          </button>
        </div>

        <div className="ensemble-verdict-box">
          <div className="verdict-status-block">
            <span className="verdict-label">FINAL ENSEMBLE STATUS</span>
            <div className="verdict-value-row">
              <h2 className="verdict-status-title">{decStatus}</h2>
              <Badge status={decStatus} />
            </div>
          </div>

          <div className="verdict-details-block">
            <div className="verdict-metric">
              <span className="detail-label">MODEL CONSENSUS</span>
              <strong className="detail-value">
                {activeCount > 0 ? `${votes} of ${activeCount} active models vote anomaly` : "Zero active models trained"}
              </strong>
            </div>

            <div className="verdict-metric">
              <span className="detail-label">RECOMMENDED ACTION</span>
              <strong className="detail-value">{decAction}</strong>
            </div>

            <div className="verdict-metric">
              <span className="detail-label">LAST EVALUATION</span>
              <strong className="detail-value">
                {aiAnalysis.analyzed_at || dec.decided_at
                  ? new Date(aiAnalysis.analyzed_at || dec.decided_at).toLocaleTimeString()
                  : "Awaiting baseline evaluation"}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THREE CORE AI MODELS GRID */}
      <div className="section-title-row" style={{ marginTop: "24px" }}>
        <div>
          <h3 className="section-heading">Threat Detection Model Implementations</h3>
          <span className="section-caption">Verified status and telemetry inputs per algorithm</span>
        </div>
      </div>

      <div className="ai-models-grid">
        {/* MODEL 1: ISOLATION FOREST */}
        <div className="ai-model-card">
          <div className="ai-card-top">
            <div className="model-badge-icon iso-icon">
              <Shield size={20} />
            </div>
            <div className="model-meta">
              <h4>Isolation Forest</h4>
              <span>Unsupervised Anomaly Detection</span>
            </div>
            <Badge status={iso.status} />
          </div>

          <div className="ai-card-content">
            <p className="model-desc">
              Measures isolation depth across 12 system & network telemetry dimensions. Points that isolate quickly are flagged as anomalous.
            </p>

            <div className="model-metrics-list">
              <div className="model-metric-row">
                <span>Anomaly Score:</span>
                <strong>{iso.score !== null && iso.score !== undefined ? iso.score : "Awaiting baseline"}</strong>
              </div>
              <div className="model-metric-row">
                <span>Boundary Condition:</span>
                <strong>Score &lt; 0 indicates anomaly boundary deviation</strong>
              </div>
              <div className="model-metric-row">
                <span>Input Dimensions:</span>
                <strong>12 telemetry features</strong>
              </div>
              <div className="model-metric-row">
                <span>Runtime Status:</span>
                <strong>Scikit-learn active</strong>
              </div>
            </div>

            <div className="model-detail-banner">
              <span>{iso.detail || "Operational"}</span>
            </div>
          </div>
        </div>

        {/* MODEL 2: RANDOM FOREST */}
        <div className="ai-model-card">
          <div className="ai-card-top">
            <div className="model-badge-icon rf-icon">
              <Brain size={20} />
            </div>
            <div className="model-meta">
              <h4>Random Forest Classifier</h4>
              <span>Supervised Threat Classification</span>
            </div>
            <Badge status={rf.status} />
          </div>

          <div className="ai-card-content">
            <p className="model-desc">
              Ensemble decision forest trained on labeled anomaly patterns to categorize specific security incidents and service degradation.
            </p>

            <div className="model-metrics-list">
              <div className="model-metric-row">
                <span>Classification Confidence:</span>
                <strong>{rf.confidence ? `${rf.confidence}%` : "Requires labeled samples"}</strong>
              </div>
              <div className="model-metric-row">
                <span>Estimators:</span>
                <strong>50 Decision Trees</strong>
              </div>
              <div className="model-metric-row">
                <span>Training Requirement:</span>
                <strong>Requires &gt;= 10 historical records with labeled anomalies</strong>
              </div>
              <div className="model-metric-row">
                <span>Runtime Status:</span>
                <strong>Scikit-learn active</strong>
              </div>
            </div>

            <div className="model-detail-banner">
              <span>{rf.detail || "Requires labeled data to train baseline"}</span>
            </div>
          </div>
        </div>

        {/* MODEL 3: LSTM */}
        <div className="ai-model-card">
          <div className="ai-card-top">
            <div className="model-badge-icon lstm-icon">
              <Network size={20} />
            </div>
            <div className="model-meta">
              <h4>LSTM Neural Network</h4>
              <span>Temporal Sequence Prediction</span>
            </div>
            <Badge status={lstm.status || "NOT CONFIGURED"} />
          </div>

          <div className="ai-card-content">
            <p className="model-desc">
              Long Short-Term Memory recurrent neural network for multi-step temporal prediction across sliding windows of network traffic.
            </p>

            <div className="model-metrics-list">
              <div className="model-metric-row">
                <span>Model Weights File:</span>
                <strong>ai/netguard_lstm.keras (Present)</strong>
              </div>
              <div className="model-metric-row">
                <span>Sequence Window:</span>
                <strong>10 Timesteps × 12 Features</strong>
              </div>
              <div className="model-metric-row">
                <span>Runtime Environment:</span>
                <strong className="text-warning">Python 3.13 (TensorFlow wheel unavailable)</strong>
              </div>
              <div className="model-metric-row">
                <span>Honest State:</span>
                <strong>NOT CONFIGURED (Not simulated)</strong>
              </div>
            </div>

            <div className="model-detail-banner">
              <span>{lstm.detail || "TensorFlow runtime required for neural inference"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. STRUCTURED DEVELOPER DIAGNOSTICS VIEW */}
      <div className="panel diagnostics-panel" style={{ marginTop: "24px" }}>
        <button
          type="button"
          className="diagnostics-toggle-btn"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          aria-expanded={showDiagnostics}
        >
          <span>Advanced Diagnostics & Raw Model Payloads</span>
          {showDiagnostics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDiagnostics && (
          <div className="diagnostics-content">
            <pre className="diagnostics-code-view">
              {JSON.stringify(
                {
                  decision: dec,
                  models: models,
                  record_id: aiStatus?.record_id,
                  analyzed_at: aiAnalysis.analyzed_at,
                },
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIAnalysisPage;
