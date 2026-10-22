import React, { useState } from "react";
import { X, Mail, ShieldAlert, CheckCircle, ArrowRight } from "lucide-react";
import api from "../api/client";

export function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your registered email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.forgotPassword(trimmed);
      if (res.ok) {
        setStatusMessage(
          res.data?.message ||
            "If an account matches that email address, password reset instructions have been dispatched."
        );
      } else {
        setError(res.error || "Unable to dispatch reset instructions. Please try again.");
      }
    } catch {
      setError("Network connection error. Please verify server connectivity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 id="modal-title" className="modal-title">Reset Operator Password</h3>
            <span className="modal-subtitle">
              Enter your verified email to receive cryptographic password reset credentials.
            </span>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {statusMessage ? (
          <div className="modal-body">
            <div className="auth-alert auth-alert-success" role="alert">
              <CheckCircle size={18} />
              <span>{statusMessage}</span>
            </div>
            <div className="modal-actions" style={{ marginTop: "24px" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
              >
                Return to Sign In
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body">
            {error && (
              <div className="auth-alert auth-alert-error" role="alert">
                <ShieldAlert size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="reset-email" className="form-label">
                Registered Email Address
              </label>
              <div className="input-with-icon">
                <span className="input-icon" aria-hidden="true">
                  <Mail size={16} />
                </span>
                <input
                  id="reset-email"
                  type="email"
                  className="form-input"
                  placeholder="operator@netguard.ai"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  "Sending..."
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default ForgotPasswordModal;
