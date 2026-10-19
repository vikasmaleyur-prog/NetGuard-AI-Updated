# NetGuard AI: Engineering Audit and System Architecture Review

**Date:** 2026-10-16  
**Auditor:** Senior Full-Stack, Security & Systems Architecture Reviewer  
**Repository:** NetGuard AI  
**Status:** Audit Completed; Functional Repair and Redesign in Progress

---

## 1. Executive Summary

NetGuard AI is designed as an intelligent network monitoring, anomaly detection, and self-healing system combining:
1. Python FastAPI backend for telemetry ingestion, querying, and AI orchestration.
2. Scikit-learn and Keras/TensorFlow ML pipelines for anomaly detection (Isolation Forest, Random Forest, LSTM sequence prediction, and voting ensemble).
3. System and network metric collectors using `psutil` and `ping3`.
4. React 19 + Vite frontend operations dashboard.
5. MongoDB data persistence layer.

The engineering audit identified critical architectural bottlenecks, top-level import crashes, database single points of failure, CORS mismatches, hardcoded metrics, unstyled UI components, and missing production requirements.

---

## 2. Identified Root Causes and Defects

### 2.1 Backend Crashing on Startup
- **Root Cause:** In `database/connection.py`, lines 9–12:
  ```python
  MONGODB_URI = os.getenv("MONGODB_URI")
  if not MONGODB_URI:
      raise RuntimeError("MONGODB_URI is not set in .env")
  ```
  `backend/main.py` performs `from database.connection import monitoring_collection` at module import time. If `.env` is absent or `MONGODB_URI` is not defined, FastAPI crashes with `RuntimeError` before starting.
- **Impact:** The backend cannot boot in standalone local environments without a pre-configured MongoDB Atlas connection string.
- **Remediation:** Implement an adaptive database layer that supports MongoDB when configured, but automatically falls back to a high-performance local persistent store (SQLite / document store) with identical collection interfaces. The application must never crash due to an unconfigured remote database.

### 2.2 CORS and Host Binding
- **Root Cause:** `backend/main.py` explicitly allows:
  ```python
  allow_origins=["http://localhost:5173", "http://localhost:5174"]
  ```
  The user accesses `http://127.0.0.1:5173`. Browsers treat `127.0.0.1` and `localhost` as distinct origins under SOP/CORS. Requests from `127.0.0.1:5173` were rejected with CORS errors.
- **Remediation:** Include `http://127.0.0.1:5173`, `http://127.0.0.1:5174`, environment-configured production domains, and standard local development origins.

### 2.3 Fabricated and Hardcoded Metrics in Frontend
- **Root Cause:**
  - `Overall network health: 95%` hardcoded in `App.jsx` when `networkStatus === "NORMAL"`.
  - Missing metrics defaulted to `0` (`?? 0`), showing misleading `0.0%` CPU/Memory.
  - `TrafficChart` used static SVG paths and fake time ticks (`10:00` - `19:00`).
  - `AlertsPanel` fabricated static dummy alerts to avoid showing an empty state.
  - LSTM was hardcoded to default to `"NORMAL"` when no AI data existed, while Isolation Forest and Random Forest showed `"UNKNOWN"`.
- **Remediation:** Strictly ground every metric, status, and chart in actual API responses. When metrics are not yet collected, display `INSUFFICIENT DATA` or `UNAVAILABLE`.

### 2.4 AI Model Loading and Inference Pipeline
- **Root Cause:** ML scripts (`ai/anomaly_detector.py`, `ai/random_forest.py`, `ai/lstm_model.py`) were written as batch offline scripts requiring MongoDB records and manual terminal execution. The FastAPI backend only read pre-stored `ai_analysis` documents from MongoDB. If the batch script hadn't run, the backend returned `null`, rendering `UNKNOWN` and raw JSON objects.
- **Remediation:**
  1. Build an active inference service inside the backend that can score incoming telemetry in real-time or on-demand using trained/initialized models.
  2. If models are unconfigured or insufficient data exists for sequence inference, label them clearly as `NOT CONFIGURED` or `INSUFFICIENT TELEMETRY (x/10 frames)`.
  3. Ensure the ensemble decision engine follows strict, documented logic.

### 2.5 Settings Page Broken UI
- **Root Cause:** The Settings page in `App.jsx` and `App.css` used non-matching class names (`.settings-list`, `.setting-row`, `.setting-toggle`), unstyled buttons, overlapping absolute elements, and lacked input controls or state persistence.
- **Remediation:** Rebuild the settings page with modular form components, configurable refresh intervals (with validation), backend URL tester, alert thresholds, and persistent configuration.

### 2.6 Missing Compliance and Launch Requirements
- Missing dedicated `/privacy` and `/terms` routes.
- Missing custom domain documentation and deployment configs.
- Missing responsive design for small viewports.
- Raw JSON dumps in production views.

---

## 3. Implementation Plan

1. **Database & Storage Layer:**
   - Create resilient database provider (`database/connection.py` + `database/storage.py`) supporting MongoDB Atlas when reachable and automatic local persistent storage (SQLite/JSON file store) with full CRUD operations for metrics, history, alerts, device inventory, and system logs.
2. **Backend API Overhaul:**
   - Add robust `/health`, `/metrics`, `/metrics/history`, `/ai/status`, `/ai/run-inference`, `/decision`, `/alerts` (with acknowledge/resolve endpoints), `/logs`, `/devices`, `/reports`, `/settings` endpoints.
   - Comprehensive error handling and schema validation.
   - Integrated live metric collector service (runs in background or on-demand).
3. **AI Inference Integration:**
   - Unify Isolation Forest, Random Forest, and LSTM inference into callable service.
   - Handle cold-start, model weights loading, and graceful degradation.
4. **Frontend Architecture & Redesign:**
   - Refactor frontend into modular components: `components/` (MetricCard, AlertBadge, DataTable, TrafficChart, StatusBanner, Topbar, Sidebar, Modal), `pages/` (Dashboard, RealtimeMonitor, AIAnalysis, Alerts, Logs, Devices, Reports, Settings, Privacy, Terms).
   - Implement consistent enterprise cybersecurity visual language (deep navy/near-black, slate borders, emerald/amber/crimson semantic indicators, clean typography, Lucide outline icons, accessible focus states).
   - Configurable API URL via `import.meta.env.VITE_API_BASE_URL` with retry and timeout management.
5. **Testing & Verification:**
   - Unit and integration tests for backend API, database storage, and AI inference.
   - Frontend linting and production build (`vite build`).
   - Integration checks under all 9 specified conditions.
6. **Production Readiness:**
   - Favicon, metadata, `.env.example`, deployment guide for custom domain with HTTPS and reverse proxy.
