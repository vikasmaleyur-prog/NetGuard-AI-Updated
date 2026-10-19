# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend Runtime
FROM python:3.12-slim-bookworm AS production

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt* ./
RUN pip install --no-cache-dir \
    fastapi==0.115.6 \
    uvicorn==0.34.0 \
    psutil==6.1.1 \
    ping3==4.0.8 \
    scikit-learn==1.6.0 \
    numpy==2.2.1 \
    pymongo==4.10.1 \
    certifi==2024.12.14 \
    python-dotenv==1.0.1 \
    httpx==0.28.1

# Copy Backend, AI, Database, and Monitoring modules
COPY backend/ ./backend/
COPY ai/ ./ai/
COPY database/ ./database/
COPY monitoring/ ./monitoring/

# Copy built frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create persistent storage directory
RUN mkdir -p /app/database && chmod -R 775 /app/database

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
