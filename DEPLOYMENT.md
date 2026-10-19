# NetGuard AI: Production Deployment & Custom Domain Architecture

This document specifies the deployment architecture, configuration, process management, reverse proxy setups, DNS records, automated TLS provisioning, and pre-launch verification checklist for deploying **NetGuard AI** into production under a custom domain.

---

## 1. Production Architecture Overview

```
                          Internet (Clients / SecOps Analysts)
                                        │
                                        ▼ HTTPS (443)
                   ┌──────────────────────────────────────────┐
                   │        Reverse Proxy (Nginx / Caddy)     │
                   │  - TLS Termination (Let's Encrypt)       │
                   │  - Security Headers (HSTS, CSP, etc.)    │
                   │  - Static SPA Serving (Vite build dist)  │
                   └──────┬────────────────────────────┬──────┘
                          │                            │
             Static Assets│                API Requests│ /summary, /metrics,
             /index.html  │                            │ /alerts, /ai/*
                          ▼                            ▼
                 ┌─────────────────┐          ┌──────────────────────┐
                 │  Frontend Files │          │   Uvicorn / Gunicorn │
                 │  /var/www/      │          │   FastAPI Application│
                 │  netguard/dist  │          │   127.0.0.1:8000     │
                 └─────────────────┘          └──────────┬───────────┘
                                                         │
                                               Telemetry │ Storage
                                                         ▼
                                              ┌──────────────────────┐
                                              │ Persistent Storage   │
                                              │ - SQLite (netguard.db│
                                              │ - or MongoDB Atlas   │
                                              └──────────────────────┘
```

---

## 2. Environment Configuration

### A. Backend Production Environment (`/etc/netguard/.env`)

```ini
# NetGuard AI - Production Environment Configuration
APP_ENV=production
DEBUG=false
HOST=127.0.0.1
PORT=8000

# Secret Key for session signing or tokens
SECRET_KEY=generate-a-strong-random-64-character-hex-string

# Allowed CORS Origins (comma-separated production domains)
CORS_ORIGINS=https://netguard.yourdomain.com,https://console.yourdomain.com

# Database Connection (MongoDB Atlas or unset for resilient local SQLite)
# MONGODB_URI=mongodb+srv://netguard_app:<secure_password>@cluster0.mongodb.net/netguard?retryWrites=true&w=majority
SQLITE_DB_PATH=/var/lib/netguard/netguard.db

# Telemetry Collector Controls
ENABLE_BACKGROUND_COLLECTOR=true
DEFAULT_REFRESH_INTERVAL=5
ICMP_ENABLED=false
TCP_PING_FALLBACK=true

# Alerting Thresholds
CPU_WARNING_THRESHOLD=80.0
CPU_CRITICAL_THRESHOLD=95.0
MEMORY_WARNING_THRESHOLD=85.0
LATENCY_WARNING_THRESHOLD=100.0
```

### B. Frontend Production Environment (`frontend/.env.production`)

```ini
# Production API Base URL (empty string for relative path when proxied by Nginx)
VITE_API_BASE_URL=https://netguard.yourdomain.com/api
```

---

## 3. Production Process Management

### Option A: Systemd Daemon Service (`/etc/systemd/system/netguard-backend.service`)

```ini
[Unit]
Description=NetGuard AI Backend Application Service
After=network.target

[Service]
Type=simple
User=netguard
Group=netguard
WorkingDirectory=/opt/netguard
EnvironmentFile=/etc/netguard/.env
ExecStart=/opt/netguard/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000 --workers 2 --proxy-headers --forwarded-allow-ips="127.0.0.1"

Restart=always
RestartSec=5s

# Security Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/var/lib/netguard /var/log/netguard

StandardOutput=journal
StandardError=journal
SyslogIdentifier=netguard-backend

[Install]
WantedBy=multi-user.target
```

Commands to enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable netguard-backend
sudo systemctl start netguard-backend
sudo systemctl status netguard-backend
```

---

## 4. Reverse Proxy Configuration

### Option A: Nginx Production Configuration (`/etc/nginx/sites-available/netguard.conf`)

```nginx
# Upstream application server
upstream netguard_backend {
    server 127.0.0.1:8000 max_fails=3 fail_timeout=10s;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name netguard.yourdomain.com;
    return 301 https://$host$request_uri;
}

# HTTPS Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name netguard.yourdomain.com;

    # SSL Certificates (managed via Certbot)
    ssl_certificate /etc/letsencrypt/live/netguard.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/netguard.yourdomain.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/netguard.yourdomain.com/chain.pem;

    # SSL Protocols & Ciphers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Enterprise Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://netguard.yourdomain.com;" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Frontend Static Files
    root /var/www/netguard/dist;
    index index.html;

    # Static asset caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform, immutable";
    }

    # SPA Client-Side Hash/History Route Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxying
    location /api/ {
        rewrite ^/api/(.*)$ /$1 break;
        proxy_pass http://netguard_backend;
        proxy_http_version 1.1;

        # WebSocket and Connection Upgrade support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Forwarded Client Identity Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts and Buffers
        proxy_connect_timeout 10s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_buffering off;
    }

    # Direct Health Check Probe
    location = /health {
        proxy_pass http://netguard_backend/health;
        proxy_set_header Host $host;
        access_log off;
    }
}
```

### Option B: Caddyfile Configuration (`/etc/caddy/Caddyfile`)

```caddy
netguard.yourdomain.com {
    # Automatic Let's Encrypt TLS
    encode gzip zstd

    # Security Headers
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://netguard.yourdomain.com;"
    }

    # Reverse Proxy API requests
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy 127.0.0.1:8000
    }

    # Frontend Single Page Application
    handle {
        root * /var/www/netguard/dist
        try_files {path} /index.html
        file_server
    }
}
```

---

## 5. DNS Configuration for Custom Domain

Configure the following records with your authoritative DNS provider (Cloudflare, AWS Route53, Google Cloud DNS):

| Type | Name | Value / Target | TTL | Description |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `netguard` | `203.0.113.10` *(Server Public IPv4)* | 300 | Primary application subdomain |
| **AAAA** | `netguard` | `2001:db8::10` *(Server Public IPv6, if assigned)* | 300 | IPv6 access |
| **CNAME**| `console` | `netguard.yourdomain.com.` | 300 | Optional alias |

### Verification Steps

Run standard diagnostic queries to verify propagation:

```bash
# Verify A record resolution
dig +short A netguard.yourdomain.com

# Verify nameserver response with nslookup
nslookup netguard.yourdomain.com

# Verify end-to-end TLS handshake and certificate validity
openssl s_client -connect netguard.yourdomain.com:443 -servername netguard.yourdomain.com
```

---

## 6. Automated Certificate Provisioning & Renewal

Using Certbot with the Nginx plugin:

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate and automatically configure Nginx SSL directives
sudo certbot --nginx -d netguard.yourdomain.com --agree-tos -m security@yourdomain.com

# Test automated renewal
sudo certbot renew --dry-run
```

Certbot installs an automated systemd timer (`certbot.timer`) that checks certificate validity twice daily.

---

## 7. Pre-Launch Verification Checklist

Before directing production traffic or updating DNS records:

- [ ] **Database Integrity:** Verify `database/netguard.db` is writable by `netguard` system user and permissions are `600`.
- [ ] **API Endpoint Health:** Query `curl -s https://netguard.yourdomain.com/health` and verify HTTP 200 with `status: "healthy"`.
- [ ] **CORS Verification:** Test preflight `OPTIONS` request with `Origin: https://netguard.yourdomain.com` and ensure access-control headers match.
- [ ] **Security Headers:** Verify HSTS, CSP, and `X-Content-Type-Options: nosniff` are returned using `curl -I https://netguard.yourdomain.com/`.
- [ ] **Static Assets:** Ensure `dist/index.html` loads and links to hashed JS/CSS bundles without 404s.
- [ ] **Telemetry Loop:** Confirm background collector writes timestamped records to database every 5 seconds.
- [ ] **Direct Navigation:** Test navigating directly to `/#/alerts`, `/#/devices`, `/#/privacy`, and `/#/terms`.
- [ ] **No Unprivileged Ping Crashes:** Verify TCP socket latency probe executes without root permissions.
- [ ] **AI Inference Grounding:** Verify `/ai/status` accurately reports Isolation Forest, Random Forest, and unconfigured models without inventing data.
- [ ] **Offline Indicator:** Test stopping the backend service (`sudo systemctl stop netguard-backend`) and verify UI cleanly transitions to `BACKEND OFFLINE` with `UNAVAILABLE` badges without crashing.
