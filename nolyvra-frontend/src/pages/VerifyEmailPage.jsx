import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PasswordResetShell from "../components/PasswordResetShell";
import {
  resetButtonStyle,
  resetInputStyle,
  resetMessageStyle,
} from "../components/passwordResetStyles";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function VerifyEmailPage() {
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

    fetch(`${API_BASE}/api/auth/verify-email/validate?token=${encodeURIComponent(token)}`)
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
      const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to verify your email.");
      setStatus("success");
    } catch (requestError) {
      setError(requestError.message || "Unable to verify your email.");
      setStatus("ready");
    }
  }

  if (status === "checking") {
    return <PasswordResetShell title="Checking your link" description="Please wait a moment…" />;
  }

  if (status === "invalid") {
    return (
      <PasswordResetShell title="Link unavailable" description="This verification link is invalid, expired, or has already been used.">
        <button type="button" style={resetButtonStyle} onClick={() => nav("/")}>
          Back to nolyvra
        </button>
      </PasswordResetShell>
    );
  }

  if (status === "success") {
    return (
      <PasswordResetShell title="Your account is active" description="Your email is verified and your nolyvra account is ready to use.">
        <div style={{
          ...resetMessageStyle,
          color: "#86efac",
          background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.28)",
        }}>You can now sign in with the password you just set.</div>
        <button type="button" style={resetButtonStyle} onClick={() => nav("/login")}>
          Continue to login
        </button>
      </PasswordResetShell>
    );
  }

  return (
    <PasswordResetShell
      title="Verify your email"
      description="Set a password to activate your nolyvra account. Use at least 8 characters and avoid a password you use elsewhere."
    >
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>
          Password
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
          Confirm password
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
          {status === "saving" ? "Activating…" : "Activate account"}
        </button>
      </form>
    </PasswordResetShell>
  );
}
