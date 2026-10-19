# NetGuard AI: Intelligent Network Monitoring & Security Operations Console

NetGuard AI is a production-grade network telemetry, anomaly detection, and security operations console. It continuously samples host and network performance, evaluates metrics against statistical baselines and machine learning models, manages actionable alerts, tracks monitored infrastructure, and exports compliance reports.

---

## 1. Architecture & Design Principles

NetGuard AI is designed with strict enterprise SecOps principles:
- **No Invented Metrics:** Every displayed graph, latency reading, CPU percentage, alert, and AI decision is grounded in verified telemetry or explicitly labeled `UNAVAILABLE` / `INSUFFICIENT DATA`.
- **Restrained Security Console UI:** Dark slate aesthetic (`#060a12`), emerald for healthy states, amber for warnings, crimson for critical alerts. Zero purple gradients, zero emojis, zero em dashes in interface copy, zero pill-shaped buttons.
- **Resilient Dual-Engine Storage:** Out-of-the-box local SQLite storage with zero external dependencies, with automatic fallback and optional MongoDB Atlas integration.
- **Transparent AI Inference:** Active Isolation Forest anomaly detection, supervised Random Forest with explicit sample prerequisites, and accurate environment detection for deep-learning runtimes (e.g., Python 3.13 / TensorFlow status).
- **Automated Fallbacks:** Unprivileged TCP handshake latency probing when raw ICMP sockets are restricted by the OS kernel without root privileges.

---

## 2. Directory Layout

```
NetGuard-AI/
├── ai/
│   ├── service.py             # Unified AI engine (Isolation Forest, RF, LSTM, Consensus)
│   ├── netguard_lstm.keras    # Pre-trained Keras model artifact
│   └── scaler.pkl             # Feature normalization scaler
├── backend/
│   └── main.py                # FastAPI REST API with CORS, background collector, lifespan
├── database/
│   ├── connection.py          # Unified database client with auto SQLite fallback
│   ├── storage.py             # SQLite document storage engine & table manager
│   └── netguard.db            # Persistent SQLite database
├── frontend/
│   ├── public/
│   │   └── favicon.svg        # Clean SVG shield security icon
│   ├── src/
│   │   ├── api/client.js      # Centralized API client with timeout & abort controllers
│   │   ├── components/        # Reusable design tokens (MetricCard, AlertItem, StatusBanner)
│   │   ├── pages/             # All 8 console pages + Privacy Policy & Terms of Service
│   │   ├── App.jsx            # Hash-based router & central telemetry polling state
│   │   └── index.css          # Cohesive SecOps dark console design system
│   └── package.json
├── monitoring/
│   ├── agent.py               # Telemetry sampling runner
│   ├── collector.py           # Combined host & network metrics collector
│   ├── latency_monitor.py     # Resilient TCP handshake latency prober
│   └── network_monitor.py     # Network throughput and interface statistics
├── tests/
│   ├── test_backend.py        # Comprehensive backend endpoint test suite
│   └── test_integration_states.py # Validation suite for the 9 critical operational states
├── AUDIT.md                   # Full engineering audit and architectural report
├── DEPLOYMENT.md              # Production Nginx, Caddy, Systemd, and DNS guide
├── Dockerfile                 # Multi-stage production container definition
└── docker-compose.yml         # Container composition with persistent volume
```

---

## 3. Quickstart & Local Execution

### Prerequisites
- Python 3.10+ (tested on Python 3.11, 3.12, 3.13)
- Node.js 18+ and npm

### A. Backend Setup
1. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure environment (optional - defaults to local SQLite persistence):
   ```bash
   cp .env.example .env
   ```
4. Start the backend application server:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   The backend API will be available at `http://127.0.0.1:8000`. Test health:
   ```bash
   curl -s http://127.0.0.1:8000/health
   ```

### B. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open `http://127.0.0.1:5173` in your browser.

---

## 4. API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | API status, version, and server timestamp |
| `GET` | `/health` | Health probe: storage connectivity, database backend |
| `GET` | `/summary` | High-level operations overview, health verdict, latest metrics |
| `GET` | `/metrics` | Latest host and network telemetry snapshot |
| `POST`| `/metrics/collect` | Trigger immediate collection cycle and inference |
| `GET` | `/metrics/history` | Chronological telemetry history records |
| `GET` | `/ai/status` | Verified statuses of Isolation Forest, Random Forest, and LSTM |
| `POST`| `/ai/run-inference`| Force execution of anomaly detection ensemble |
| `GET` | `/decision` | Latest ensemble decision, consensus verdict, and action |
| `GET` | `/alerts` | Query alerts filtered by severity or status |
| `POST`| `/alerts/create` | Manually register a security alert |
| `POST`| `/alerts/{id}/acknowledge` | Acknowledge active alert |
| `POST`| `/alerts/{id}/resolve` | Mark alert as resolved |
| `GET` | `/logs` | System operations and security audit log entries |
| `GET` | `/devices` | Monitored network devices inventory |
| `POST`| `/devices` | Register new network device |
| `POST`| `/devices/{id}/ping` | Perform active TCP latency probe against device |
| `DELETE`| `/devices/{id}` | Remove device from inventory |
| `GET` | `/reports/summary` | Aggregate operational statistics across 24h, 7d, or 30d |
| `GET` | `/reports/export` | Export telemetry and alerts to CSV |
| `GET` | `/settings` | System configuration, collector flags, and thresholds |
| `POST`| `/settings` | Update system thresholds and refresh intervals |

---

## 5. Automated Test Suite

Run all automated test suites using `pytest`:

```bash
# Run all 18 backend and integration tests
pytest tests/

# Run the 9 Integration States verification suite specifically
pytest tests/test_integration_states.py

# Run frontend lint check
cd frontend && npm run lint

# Run frontend production build
npm run build
```

---

## 6. Production Deployment

See [DEPLOYMENT.md](file:///DEPLOYMENT.md) for complete instructions on:
- Nginx reverse proxy configuration with TLS termination and security headers
- Caddyfile zero-config setup
- Systemd service daemon unit file (`netguard-backend.service`)
- Custom domain DNS records (A, AAAA, CNAME)
- Automated Let's Encrypt certificate renewal via Certbot
- Container deployment with `docker-compose up -d`
