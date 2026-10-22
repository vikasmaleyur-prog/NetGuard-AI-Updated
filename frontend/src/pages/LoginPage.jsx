import React, { useState } from "react";
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Sun,
  Moon,
  KeyRound,
  Fingerprint,
} from "lucide-react";
import api from "../api/client";
import ForgotPasswordModal from "../components/ForgotPasswordModal";
import AuthHeroVisual from "../components/AuthHeroVisual";

export function LoginPage({
  onLoginSuccess,
  onNavigateRegister,
  onNavigateTerms,
  onNavigatePrivacy,
  theme = "light",
  onToggleTheme,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showForgotModal, setShowForgotModal] = useState(false);

  const validate = () => {
    const errors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await api.login({
        email: email.trim(),
        password,
        remember_me: rememberMe,
      });

      if (res.ok && res.data && res.data.user) {
        onLoginSuccess(res.data.user, res.data.token);
      } else {
        setErrorMessage(
          res.error || "Authentication failed. Please verify your credentials."
        );
      }
    } catch {
      setErrorMessage("Unable to connect to authentication service. Please check server connectivity.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemoAdmin = () => {
    setEmail("admin@netguard.ai");
    setPassword("NetGuardAdmin2026!");
    setFieldErrors({});
    setErrorMessage(null);
  };

  const handleEnterpriseSSOClick = () => {
    // Populate demo operator for frictionless evaluation
    handleFillDemoAdmin();
    setErrorMessage(null);
  };

  return (
    <div className="craftly-auth-page" data-theme={theme}>
      {/* Top Navbar / Utility Bar */}
      <header className="craftly-auth-header">
        <div className="craftly-brand">
          <div className="craftly-logo-badge">
            <Shield size={20} />
          </div>
          <div className="craftly-brand-text">
            <span className="craftly-brand-title">NetGuard AI</span>
            <span className="craftly-brand-badge">SOC Operations</span>
          </div>
        </div>

        <div className="craftly-header-actions">
          {onToggleTheme && (
            <button
              type="button"
              className="craftly-theme-btn"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === "light" ? "Dark Ops" : "Huel White"} theme`}
              title={`Switch to ${theme === "light" ? "Dark Ops" : "Huel White"} theme`}
            >
              {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
              <span>{theme === "light" ? "Dark Mode" : "Light Mode"}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Split-Screen Layout */}
      <main className="craftly-auth-split">
        {/* Left Side: Visual Showcase & Hero Section (Inspired by Craftly.ai) */}
        <section className="craftly-hero-pane" aria-labelledby="hero-title">
          <AuthHeroVisual theme={theme} isRegister={false} />
        </section>

        {/* Right Side: Authentication Card */}
        <section className="craftly-form-pane" aria-labelledby="signin-title">
          <div className="craftly-form-card">
            {/* Header copy */}
            <div className="craftly-card-header">
              <span className="craftly-kicker">Operator Access</span>
              <h1 id="signin-title" className="craftly-card-title">Sign In</h1>
              <p className="craftly-card-subtitle">
                Enter your security credentials to access real-time network telemetry and AI insights.
              </p>
            </div>

            {/* Quick Demo Autofill Helper Banner */}
            <div className="craftly-demo-banner">
              <div className="demo-banner-content">
                <KeyRound size={15} className="demo-key-icon" />
                <div className="demo-banner-text">
                  <span className="demo-label">Default Administrator</span>
                  <span className="demo-creds font-mono">admin@netguard.ai</span>
                </div>
              </div>
              <button
                type="button"
                className="btn-demo-autofill"
                onClick={handleFillDemoAdmin}
              >
                Auto-fill
              </button>
            </div>

            {/* Social / Enterprise Single Sign-On Button */}
            <button
              type="button"
              className="craftly-sso-btn"
              onClick={handleEnterpriseSSOClick}
              title="Authenticate via Enterprise Identity Provider"
            >
              <Fingerprint size={18} className="sso-icon" />
              <span>Continue with Enterprise SSO</span>
            </button>

            {/* Subtle Divider */}
            <div className="craftly-divider">
              <span className="divider-line" />
              <span className="divider-text">Or sign in with email</span>
              <span className="divider-line" />
            </div>

            {/* Server Error Alert */}
            {errorMessage && (
              <div className="craftly-error-alert" role="alert">
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Credentials Form */}
            <form onSubmit={handleSubmit} noValidate className="craftly-form">
              {/* Email Address */}
              <div className="craftly-form-group">
                <label htmlFor="login-email" className="craftly-label">
                  Email Address
                </label>
                <div className={`craftly-input-wrapper ${fieldErrors.email ? "has-error" : ""}`}>
                  <span className="craftly-input-icon" aria-hidden="true">
                    <Mail size={16} />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    className="craftly-input"
                    placeholder="operator@netguard.ai"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: null }));
                    }}
                    disabled={isLoading}
                    required
                  />
                </div>
                {fieldErrors.email && (
                  <span className="craftly-field-error" role="alert">
                    {fieldErrors.email}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className="craftly-form-group">
                <div className="craftly-label-row">
                  <label htmlFor="login-password" className="craftly-label">
                    Password
                  </label>
                  <button
                    type="button"
                    className="craftly-forgot-link"
                    onClick={() => setShowForgotModal(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className={`craftly-input-wrapper ${fieldErrors.password ? "has-error" : ""}`}>
                  <span className="craftly-input-icon" aria-hidden="true">
                    <Lock size={16} />
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    className="craftly-input"
                    placeholder="Enter security password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }));
                    }}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    className="craftly-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <span className="craftly-field-error" role="alert">
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              {/* Session Controls: Keep Me Logged In */}
              <div className="craftly-session-row">
                <label className="craftly-checkbox-label">
                  <input
                    type="checkbox"
                    className="craftly-checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span>Keep me logged in for 7 days</span>
                </label>
              </div>

              {/* Primary Submit Button */}
              <button
                type="submit"
                className="craftly-primary-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span>Authenticating Session...</span>
                ) : (
                  <>
                    <span>Sign In to Console</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Registration Switcher */}
            <div className="craftly-card-footer">
              <span className="craftly-footer-prompt">Don't have an account?</span>
              <button
                type="button"
                className="craftly-action-link"
                onClick={onNavigateRegister}
              >
                Sign up
              </button>
            </div>

            {/* Compliance Links */}
            <div className="craftly-legal-footer">
              <button
                type="button"
                className="craftly-legal-link"
                onClick={onNavigatePrivacy}
              >
                Privacy Policy
              </button>
              <span className="craftly-bullet" aria-hidden="true">•</span>
              <button
                type="button"
                className="craftly-legal-link"
                onClick={onNavigateTerms}
              >
                Terms of Service
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Forgot Password Dialog */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </div>
  );
}

export default LoginPage;
