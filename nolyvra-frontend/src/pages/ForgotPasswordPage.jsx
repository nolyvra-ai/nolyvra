import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PasswordResetShell from "../components/PasswordResetShell";
import {
  resetButtonStyle,
  resetInputStyle,
  resetMessageStyle,
} from "../components/passwordResetStyles";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function ForgotPasswordPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const accountType = searchParams.get("type") === "employee" ? "employee" : "tenant";
  const isEmployee = accountType === "employee";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), accountType }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to request a reset link.");
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError.message || "Unable to request a reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordResetShell
      title="Forgot your password?"
      description={`Enter your ${isEmployee ? "employee" : "account"} email and we'll send you a secure link to choose a new password.`}
    >
      {message ? (
        <>
          <div style={{
            ...resetMessageStyle,
            color: "#86efac",
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.28)",
          }}>{message}</div>
          <button type="button" style={resetButtonStyle} onClick={() => nav("/login")}>
            Back to login
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: 7, fontSize: 12, fontWeight: 700 }}>
            {isEmployee ? "Employee email address" : "Email address"}
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            autoFocus
            required
            style={resetInputStyle}
          />
          {error && <div style={{
            ...resetMessageStyle,
            marginTop: 12,
            color: "#fca5a5",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
          }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            ...resetButtonStyle,
            opacity: loading ? 0.65 : 1,
          }}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <button type="button" onClick={() => nav("/login")} style={{
            width: "100%",
            marginTop: 14,
            border: 0,
            background: "transparent",
            color: "rgba(255,255,255,0.62)",
            cursor: "pointer",
          }}>Back to login</button>
        </form>
      )}
    </PasswordResetShell>
  );
}
