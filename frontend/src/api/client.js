/**
 * NetGuard AI - Centralized API Client
 * Configurable via VITE_API_BASE_URL with timeout handling, exponential backoff, and error parsing.
 */

const DEFAULT_BASE_URL = "http://127.0.0.1:8001";

export const API_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL)
    ? import.meta.env.VITE_API_BASE_URL
    : DEFAULT_BASE_URL;

class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = 8000;
    this.token =
      typeof window !== "undefined"
        ? localStorage.getItem("netguard_token") || sessionStorage.getItem("netguard_token")
        : null;
    this.onUnauthorizedCallback = null;
  }

  setBaseUrl(url) {
    this.baseUrl = url.replace(/\/+$/, "");
  }

  setToken(token, remember = true) {
    this.token = token;
    if (typeof window !== "undefined") {
      if (token) {
        if (remember) {
          localStorage.setItem("netguard_token", token);
          sessionStorage.removeItem("netguard_token");
        } else {
          sessionStorage.setItem("netguard_token", token);
          localStorage.removeItem("netguard_token");
        }
      } else {
        localStorage.removeItem("netguard_token");
        sessionStorage.removeItem("netguard_token");
      }
    }
  }

  getToken() {
    if (!this.token && typeof window !== "undefined") {
      this.token =
        localStorage.getItem("netguard_token") || sessionStorage.getItem("netguard_token");
    }
    return this.token;
  }

  clearToken() {
    this.setToken(null);
  }

  onUnauthorized(cb) {
    this.onUnauthorizedCallback = cb;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const controller = options.signal ? null : new AbortController();
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : null;

    const authToken = this.getToken();
    const headers = {
      "Accept": "application/json",
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || (controller ? controller.signal : undefined),
      });

      if (timeoutId) clearTimeout(timeoutId);

      // Handle CSV or non-JSON downloads
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/csv") || contentType.includes("application/octet-stream")) {
        const blob = await response.blob();
        return { ok: response.ok, status: response.status, data: blob };
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Trigger session expiration callback on 401 (excluding login attempts)
        if (
          response.status === 401 &&
          !endpoint.includes("/auth/login") &&
          !endpoint.includes("/auth/register")
        ) {
          this.clearToken();
          if (this.onUnauthorizedCallback) {
            this.onUnauthorizedCallback();
          }
        }

        const errorMsg = (data && data.detail) || response.statusText || "Request failed";
        return { ok: false, status: response.status, error: errorMsg, data: null };
      }

      return { ok: true, status: response.status, data, error: null };
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      const isAbort = err.name === "AbortError";
      return {
        ok: false,
        status: 0,
        error: isAbort ? "Request timed out" : (err.message || "Network connection error"),
        data: null,
      };
    }
  }

  // Convenience methods
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  }

  // Health and System Diagnostics
  async getHealth() {
    let res = await this.get("/health");
    if ((!res.ok || !res.data || !res.data.database) && this.baseUrl.includes(":8000")) {
      try {
        const altUrl = this.baseUrl.replace(":8000", ":8001");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const altResponse = await fetch(`${altUrl}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (altResponse.ok) {
          const altData = await altResponse.json().catch(() => null);
          if (altData && altData.status === "healthy" && altData.database) {
            this.setBaseUrl(altUrl);
            return { ok: true, status: 200, data: altData, error: null };
          }
        }
      } catch {
        // Fallback probe failed, return original response
      }
    }
    return res;
  }

  async getSummary() {
    return this.get("/summary");
  }

  async getMetrics() {
    return this.get("/metrics");
  }

  async triggerCollect() {
    return this.post("/metrics/collect");
  }

  async getMetricsHistory(limit = 30) {
    return this.get(`/metrics/history?limit=${limit}`);
  }

  async getAiStatus() {
    return this.get("/ai/status");
  }

  async triggerAiInference() {
    return this.post("/ai/run-inference");
  }

  async getDecision() {
    return this.get("/decision");
  }

  async getAlerts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/alerts${query ? `?${query}` : ""}`);
  }

  async acknowledgeAlert(alertId) {
    return this.post(`/alerts/${alertId}/acknowledge`);
  }

  async resolveAlert(alertId) {
    return this.post(`/alerts/${alertId}/resolve`);
  }

  async createAlert(alertData) {
    return this.post("/alerts/create", alertData);
  }

  async getLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.get(`/logs${query ? `?${query}` : ""}`);
  }

  async getDevices() {
    return this.get("/devices");
  }

  async registerDevice(deviceData) {
    return this.post("/devices", deviceData);
  }

  async pingDevice(deviceId) {
    return this.post(`/devices/${deviceId}/ping`);
  }

  async deleteDevice(deviceId) {
    return this.delete(`/devices/${deviceId}`);
  }

  async getReportSummary(period = "24h") {
    return this.get(`/reports/summary?period=${period}`);
  }

  async exportReport(period = "24h") {
    return this.get(`/reports/export?period=${period}`);
  }

  async getSettings() {
    return this.get("/settings");
  }

  async updateSettings(settings) {
    return this.post("/settings", settings);
  }

  // ==========================================================
  // SELF-HEALING & RECOVERY
  // ==========================================================

  async getRecoveryActions() {
    return this.get("/recovery/actions");
  }

  async getRecoveryHistory(limit = 50) {
    return this.get(`/recovery/history?limit=${limit}`);
  }

  async getRecoveryStatus() {
    return this.get("/recovery/status");
  }

  async triggerRecoveryAction(actionKey, mode = "DRY_RUN") {
    return this.post("/recovery/trigger", { action_key: actionKey, mode });
  }

  async approveRecoveryAction(actionId) {
    return this.post(`/recovery/approve/${actionId}`);
  }

  // ==========================================================
  // AUTHENTICATION & SESSION MANAGEMENT
  // ==========================================================

  async login({ email, password, remember_me = false }) {
    const res = await this.post("/auth/login", { email, password, remember_me });
    if (res.ok && res.data && res.data.token) {
      this.setToken(res.data.token, remember_me);
    }
    return res;
  }

  async register(registrationData) {
    const res = await this.post("/auth/register", registrationData);
    if (res.ok && res.data && res.data.token) {
      this.setToken(res.data.token, false);
    }
    return res;
  }

  async logout() {
    const res = await this.post("/auth/logout");
    this.clearToken();
    return res;
  }

  async getCurrentUser() {
    return this.get("/auth/me");
  }

  async forgotPassword(email) {
    return this.post("/auth/forgot-password", { email });
  }
}


export const api = new ApiClient();
export default api;
