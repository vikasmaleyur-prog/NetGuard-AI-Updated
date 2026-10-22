import React, { useState, useMemo } from "react";
import {
  Shield,
  Lock,
  Mail,
  User,
  Building,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  AlertCircle,
  Sun,
  Moon,
} from "lucide-react";
import api from "../api/client";
import AuthHeroVisual from "../components/AuthHeroVisual";

export function RegisterPage({
  onRegisterSuccess,
  onNavigateLogin,
  onNavigateTerms,
  onNavigatePrivacy,
  theme = "light",
  onToggleTheme,
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Real-time password strength metrics
  const passwordCriteria = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumberOrSymbol: /[0-9!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  }, [password]);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (passwordCriteria.minLength) score += 1;
    if (passwordCriteria.hasLetter) score += 1;
    if (passwordCriteria.hasNumberOrSymbol) score += 1;
    if (password.length >= 12) score += 1;
    return score;
  }, [passwordCriteria, password]);

  const strengthLabel = useMemo(() => {
    if (!password) return "Enter password";
    if (passwordScore <= 1) return "Weak";
    if (passwordScore === 2) return "Moderate";
    if (passwordScore === 3) return "Strong";
    return "Very Strong";
  }, [passwordScore, password]);

  const validate = () => {
    const errors = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length < 2) {
      errors.fullName = "Please enter your full name (minimum 2 characters).";
    }

    if (!trimmedEmail) {
      errors.email = "Email address is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    } else if (!passwordCriteria.hasLetter || !passwordCriteria.hasNumberOrSymbol) {
      errors.password = "Password must contain at least one letter and one number or special character.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirm password is required.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (!termsAccepted) {
      errors.termsAccepted = "You must agree to the Terms of Service and Privacy Policy.";
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
      const res = await api.register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        organization: organization.trim() || undefined,
        password,
        confirm_password: confirmPassword,
        terms_accepted: termsAccepted,
      });

      if (res.ok && res.data && res.data.user) {
        onRegisterSuccess(res.data.user, res.data.token);
      } else {
        setErrorMessage(
          res.error || "Registration could not be completed. Please review your details."
        );
      }
    } catch {
      setErrorMessage("Unable to connect to registration service. Please verify server connectivity.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="craftly-auth-page" data-theme={theme}>
      {/* Top Header */}
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
        {/* Left Side: Visual Showcase & Hero Section */}
        <section className="craftly-hero-pane" aria-labelledby="register-hero-title">
          <AuthHeroVisual theme={theme} isRegister={true} />
        </section>

        {/* Right Side: Registration Card */}
        <section className="craftly-form-pane" aria-labelledby="register-title">
          <div className="craftly-form-card">
            {/* Header */}
            <div className="craftly-card-header">
              <span className="craftly-kicker">New Operator Provisioning</span>
              <h1 id="register-title" className="craftly-card-title">Create Account</h1>
              <p className="craftly-card-subtitle">
                Set up your operator credentials to monitor network interfaces and investigate threat alerts.
              </p>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="craftly-error-alert" role="alert">
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} noValidate className="craftly-form">
              {/* Full Name */}
              <div className="craftly-form-group">
                <label htmlFor="reg-fullname" className="craftly-label">
                  Full Name
                </label>
                <div className={`craftly-input-wrapper ${fieldErrors.fullName ? "has-error" : ""}`}>
                  <span className="craftly-input-icon" aria-hidden="true">
                    <User size={16} />
                  </span>
                  <input
                    id="reg-fullname"
                    type="text"
                    className="craftly-input"
                    placeholder="Alex Morgan"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: null }));
                    }}
                    disabled={isLoading}
                    required
                  />
                </div>
                {fieldErrors.fullName && (
                  <span className="craftly-field-error" role="alert">
                    {fieldErrors.fullName}
                  </span>
                )}
              </div>

              {/* Work Email */}
              <div className="craftly-form-group">
                <label htmlFor="reg-email" className="craftly-label">
                  Work Email Address
                </label>
                <div className={`craftly-input-wrapper ${fieldErrors.email ? "has-error" : ""}`}>
                  <span className="craftly-input-icon" aria-hidden="true">
                    <Mail size={16} />
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    className="craftly-input"
                    placeholder="alex.morgan@organization.com"
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

              {/* Organization (Optional) */}
              <div className="craftly-form-group">
                <label htmlFor="reg-org" className="craftly-label">
                  Organization / Unit <span className="craftly-optional">(Optional)</span>
                </label>
                <div className="craftly-input-wrapper">
                  <span className="craftly-input-icon" aria-hidden="true">
                    <Building size={16} />
                  </span>
                  <input
                    id="reg-org"
                    type="text"
                    className="craftly-input"
                    placeholder="Security Operations Center"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="craftly-form-group">
                <label htmlFor="reg-password" className="craftly-label">
                  Password
                </label>
                <div className={`craftly-input-wrapper ${fieldErrors.password ? "has-error" : ""}`}>
                  <span className="craftly-input-icon" aria-hidden="true">
                    <Lock size={16} />
                  </span>
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    className="craftly-input"
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
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

                {/* Password Strength Meter */}
                {password && (
                  <div className="craftly-strength-block" aria-live="polite">
                    <div className="craftly-strength-meter">
                      <div className={`craftly-strength-bar ${passwordScore >= 1 ? "is-filled" : ""}`} />
                      <div className={`craftly-strength-bar ${passwordScore >= 2 ? "is-filled" : ""}`} />
                      <div className={`craftly-strength-bar ${passwordScore >= 3 ? "is-filled" : ""}`} />
                      <div className={`craftly-strength-bar ${passwordScore >= 4 ? "is-filled" : ""}`} />
                    </div>
                    <span className="craftly-strength-text">Rating: {strengthLabel}</span>
                  </div>
                )}

                {/* Password Criteria Checklist */}
                <div className="craftly-checklist">
                  <span className={`craftly-check-item ${passwordCriteria.minLength ? "is-met" : ""}`}>
                    <Check size={12} /> 8+ Characters
                  </span>
                  <span className={`craftly-check-item ${passwordCriteria.hasLetter ? "is-met" : ""}`}>
                    <Check size={12} /> Letter
                  </span>
                  <span className={`craftly-check-item ${passwordCriteria.hasNumberOrSymbol ? "is-met" : ""}`}>
                    <Check size={12} /> Number or symbol
                  </span>
                </div>

                {fieldErrors.password && (
                  <span className="craftly-field-error" role="alert">
                    {fieldErrors.password}
                  </span>
                )}
              </div>

              {/* Confirm Password */}
              <div className="craftly-form-group">
                <label htmlFor="reg-confirm-password" className="craftly-label">
                  Confirm Password
                </label>
                <div className={`craftly-input-wrapper ${fieldErrors.confirmPassword ? "has-error" : ""}`}>
                  <span className="craftly-input-icon" aria-hidden="true">
                    <Lock size={16} />
                  </span>
                  <input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    className="craftly-input"
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (fieldErrors.confirmPassword) {
                        setFieldErrors((prev) => ({ ...prev, confirmPassword: null }));
                      }
                    }}
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    className="craftly-eye-btn"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && (
                  <span className="craftly-field-error" role="alert">
                    {fieldErrors.confirmPassword}
                  </span>
                )}
              </div>

              {/* Terms & Privacy acceptance */}
              <div className="craftly-form-group">
                <label className="craftly-checkbox-label craftly-terms-label">
                  <input
                    type="checkbox"
                    className="craftly-checkbox"
                    checked={termsAccepted}
                    onChange={(e) => {
                      setTermsAccepted(e.target.checked);
                      if (fieldErrors.termsAccepted) {
                        setFieldErrors((prev) => ({ ...prev, termsAccepted: null }));
                      }
                    }}
                    disabled={isLoading}
                    required
                  />
                  <span>
                    I accept the{" "}
                    <button
                      type="button"
                      className="craftly-text-link"
                      onClick={onNavigateTerms}
                    >
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button
                      type="button"
                      className="craftly-text-link"
                      onClick={onNavigatePrivacy}
                    >
                      Privacy Policy
                    </button>
                  </span>
                </label>
                {fieldErrors.termsAccepted && (
                  <span className="craftly-field-error" role="alert">
                    {fieldErrors.termsAccepted}
                  </span>
                )}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="craftly-primary-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span>Registering Account...</span>
                ) : (
                  <>
                    <span>Create Operator Account</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Login Switcher */}
            <div className="craftly-card-footer">
              <span className="craftly-footer-prompt">Already have an account?</span>
              <button
                type="button"
                className="craftly-action-link"
                onClick={onNavigateLogin}
              >
                Sign in
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default RegisterPage;
