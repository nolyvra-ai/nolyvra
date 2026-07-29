import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PasswordResetShell from "../components/PasswordResetShell";
import {
  resetButtonStyle,
  resetInputStyle,
  resetMessageStyle,
} from "../components/passwordResetStyles";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    fetch(`${API_BASE}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then((response) => {
        if (!response.ok) throw new Error();
        setStatus("ready");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("saving");
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to reset password.");
      setStatus("success");
    } catch (requestError) {
      setError(requestError.message || "Unable to reset password.");
      setStatus("ready");
    }
  }

  if (status === "checking") {
    return <PasswordResetShell title="Checking your link" description="Please wait a moment…" />;
  }

  if (status === "invalid") {
    return (
      <PasswordResetShell title="Link unavailable" description="This password reset link is invalid, expired, or has already been used.">
        <button type="button" style={resetButtonStyle} onClick={() => nav("/forgot-password")}>
          Request a new link
        </button>
      </PasswordResetShell>
    );
  }

  if (status === "success") {
    return (
      <PasswordResetShell title="Password updated" description="Your new password is ready to use. All previous sessions have been signed out.">
        <div style={{
          ...resetMessageStyle,
          color: "#86efac",
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.28)",
        }}>You can now sign in with your new password.</div>
        <button type="button" style={resetButtonStyle} onClick={() => nav("/login")}>
          Continue to login
        </button>
      </PasswordResetShell>
    );
  }

  return (
    <PasswordResetShell title="Choose a new password" description="Use at least 8 characters and avoid a password you use elsewhere.">
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            autoFocus
            required
            minLength={8}
            style={{ ...resetInputStyle, marginTop: 7 }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 700 }}>
          Confirm new password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            style={{ ...resetInputStyle, marginTop: 7 }}
          />
        </label>
        {error && <div style={{
          ...resetMessageStyle,
          color: "#fca5a5",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.25)",
        }}>{error}</div>}
        <button type="submit" disabled={status === "saving"} style={{
          ...resetButtonStyle,
          marginTop: 2,
          opacity: status === "saving" ? 0.65 : 1,
        }}>
          {status === "saving" ? "Updating…" : "Update password"}
        </button>
      </form>
    </PasswordResetShell>
  );
}
