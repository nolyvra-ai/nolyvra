import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

// ─── Encryption helper ────────────────────────────────────────────────────────
// Uses Web Crypto API (built-in to all modern browsers, no extra deps needed)
async function encryptPassword(plaintext) {
  const encoder = new TextEncoder();
  const data     = encoder.encode(plaintext);
  const hashBuf  = await crypto.subtle.digest("SHA-256", data);
  const hashArr  = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Leaf SVG (reusable) ──────────────────────────────────────────────────────
function Leaf({ gradientId, gradientProps, pathD, veinD, shimmer, style }) {
  return (
    <div style={style}>
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" fill="none"
           style={{ width: "100%", height: "100%" }}>
        <defs>
          <radialGradient id={gradientId} {...gradientProps}>
            {gradientProps.stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity} />
            ))}
          </radialGradient>
          {shimmer && <filter id={`blur-${gradientId}`}><feGaussianBlur stdDeviation="6"/></filter>}
        </defs>
        <path d={pathD} fill={`url(#${gradientId})`} opacity="0.9" />
        <path d={veinD} stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="none" />
        {shimmer && (
          <ellipse cx="150" cy="130" rx="60" ry="90"
                   fill="rgba(255,255,255,0.07)"
                   transform="rotate(-20 150 130)"
                   filter={`url(#blur-${gradientId})`} />
        )}
      </svg>
    </div>
  );
}

// ─── Step progress dots ───────────────────────────────────────────────────────
function StepDots({ step }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 6,
            borderRadius: i < step ? 3 : "50%",
            background:
              i < step  ? "#1D72E8" :
              i === step ? "#ffffff" :
              "rgba(255,255,255,0.18)",
            width: i < step ? 18 : 6,
            transition: "all 0.3s ease",
          }}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LoginPage() {
  const nav = useNavigate();

  const [loginMode, setLoginMode] = useState("tenant"); // "tenant" | "employee"
  const [step, setStep]           = useState(0); // 0=email, 1=password, 2=ready
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [pwHint, setPwHint]       = useState("");
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [apiError, setApiError]   = useState("");

  // ── Change 1: popup state ─────────────────────────────────────────────────
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [policyOpen,  setPolicyOpen]  = useState(false);

  const passwordRef = useRef(null);

  // Focus password field when step advances
  useEffect(() => {
    if (step === 1 && passwordRef.current) {
      setTimeout(() => passwordRef.current?.focus(), 80);
    }
  }, [step]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  function handleEmailChange(e) {
    const v = e.target.value;
    setEmail(v);
    if (v.length > 0 && !isValidEmail(v)) {
      setEmailError("Enter a valid email address");
    } else {
      setEmailError("");
    }
  }

  function handleEmailKeyDown(e) {
    if (e.key === "Enter" && isValidEmail(email)) submitEmail();
  }

  function submitEmail() {
    if (!isValidEmail(email)) return;
    setStep(1);
  }

  function handlePasswordChange(e) {
    const v = e.target.value;
    setPassword(v);
    setApiError("");
    if (v.length === 0) {
      setPwHint("");
      setStep(1);
    } else if (v.length < 6) {
      setPwHint(`${6 - v.length} more character${6 - v.length === 1 ? "" : "s"} needed`);
      setStep(1);
    } else {
      setPwHint("✓ Password entered");
      setStep(2);
    }
  }

  function handlePasswordKeyDown(e) {
    if (e.key === "Enter" && password.length >= 6) handleSubmit();
  }

  // ── Mode toggle ────────────────────────────────────────────────────────────
  function switchLoginMode(mode) {
    if (mode === loginMode) return;
    setLoginMode(mode);
    setStep(0); setEmail(""); setPassword(""); setPwHint(""); setApiError("");
  }

  // ── Submit → API call ──────────────────────────────────────────────────────
  async function handleSubmit() {
    if (loading || password.length < 6) return;
    setLoading(true);
    setApiError("");

    const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

    try {
      const encryptedPassword = await encryptPassword(password);

      if (loginMode === "employee") {
        const res = await fetch(`${API_BASE}/api/auth/employee-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password: encryptedPassword }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Login failed (${res.status})`);
        }

        localStorage.setItem("loginId",      data.loginId);
        localStorage.setItem("employeeId",   data.employeeId);
        localStorage.setItem("name",         `${data.firstName} ${data.lastName}`.trim());
        localStorage.setItem("sessionToken", data.sessionToken);
        localStorage.setItem("authType",     "EMPLOYEE");
        setSuccess(true);
        nav("/crm/my-leave");
        return;
      }

      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId: email.trim(), password: encryptedPassword }),
      });

      const data = await res.json();

      // Free plan expiry check
      if (data.expired) {
        setApiError(data.error || "Your free trial has expired. Please contact us to update your plan.");
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || `Login failed (${res.status})`);
      }

      localStorage.setItem("loginId",      data.id);
      localStorage.setItem("name",         data.name);
      localStorage.setItem("sessionToken", data.sessionToken);
      localStorage.removeItem("authType");
      localStorage.removeItem("employeeId");
      setSuccess(true);
      nav("/dashboard");
    } catch (err) {
      setApiError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Dynamic heading ────────────────────────────────────────────────────────
  const employeeNote = loginMode === "employee" ? " (Employee)" : "";
  const heading =
    step === 0 ? { title: "Welcome!",              desc: "Enter your email to continue to nolyvra." }  :
    step === 1 ? { title: "Enter your password",   desc: `Signing in as ${email.trim()}${employeeNote}` }  :
                 { title: "Ready to sign in",       desc: "Click below to access your nolyvra workspace." };

  // ── Shared modal styles ────────────────────────────────────────────────────
  const modalOverlay = {
    position: "fixed", inset: 0, zIndex: 999,
    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
  };
  const modalBox = {
    background: "#fff", borderRadius: 14, padding: "32px 36px",
    width: "100%", maxWidth: 440, position: "relative",
    boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
  };
  const closeBtn = {
    position: "absolute", top: 14, right: 14,
    width: 30, height: 30, borderRadius: "50%",
    background: "#F7F8FA", border: "1px solid #E2E6ED",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", fontSize: 15, color: "#9AA3B4", lineHeight: 1,
  };
  const modalTitle = { fontSize: 18, fontWeight: 700, color: "#0F1623", marginBottom: 6 };
  const modalDesc  = { fontSize: 13, color: "#9AA3B4", lineHeight: 1.6, marginBottom: 20 };
  const bullet     = { width: 6, height: 6, borderRadius: "50%", background: "#1D72E8", marginTop: 6, flexShrink: 0 };
  const closeModalBtn = {
    marginTop: 8, width: "100%", padding: "10px 0",
    borderRadius: 8, background: "#1D72E8", color: "#fff",
    border: "none", fontSize: 13, fontWeight: 600,
    cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Google Font ── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Serif+Display&display=swap"
        rel="stylesheet"
      />

      <div style={{
        position: "fixed", inset: 0,
        fontFamily: "'DM Sans', sans-serif",
        overflow: "hidden",
      }}>

        {/* ── Background ── */}
        <div style={{
          position: "absolute", inset: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 20% 100%, #0D2F6E 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 90% 10%,  #071B4A 0%, transparent 55%),
            radial-gradient(ellipse 100% 100% at 50% 50%, #0A1628 0%, #060D1A 100%)
          `,
          zIndex: 0,
        }} />

        {/* ── Leaf top-right ── */}
        <Leaf
          gradientId="lg1"
          style={{
            position: "absolute", right: -120, top: -80,
            width: 640, height: 640,
            opacity: 0.18, pointerEvents: "none", zIndex: 1,
            animation: "leafFloat 8s ease-in-out infinite",
          }}
          gradientProps={{
            cx: "35%", cy: "30%", r: "70%",
            stops: [
              { offset: "0%",   color: "#3D8EFF", opacity: 1    },
              { offset: "55%",  color: "#1D72E8", opacity: 0.7  },
              { offset: "100%", color: "#ffffff", opacity: 0.15 },
            ],
          }}
          pathD="M200 20 C310 20 380 100 380 200 C380 310 300 385 200 385 C90 385 18 300 20 200 C22 90 90 20 200 20 Z"
          veinD="M200 40 C290 80 340 150 320 260 C300 340 240 375 200 385"
          shimmer
        />

        {/* ── Leaf bottom-left ── */}
        <Leaf
          gradientId="lg2"
          style={{
            position: "absolute", left: -160, bottom: -120,
            width: 520, height: 520,
            opacity: 0.10, pointerEvents: "none", zIndex: 1,
            animation: "leafFloat 11s ease-in-out infinite reverse",
          }}
          gradientProps={{
            cx: "60%", cy: "65%", r: "65%",
            stops: [
              { offset: "0%",   color: "#ffffff", opacity: 0.6 },
              { offset: "50%",  color: "#1D72E8", opacity: 0.5 },
              { offset: "100%", color: "#0A1628", opacity: 0.1 },
            ],
          }}
          pathD="M200 15 C315 15 385 100 385 205 C385 315 300 388 200 388 C88 388 15 302 15 200 C15 88 90 15 200 15 Z"
          veinD="M200 40 C285 90 330 170 310 275 C290 355 238 382 200 388"
        />

        {/* ── CSS keyframes injected inline ── */}
        <style>{`
          @keyframes leafFloat {
            0%,100% { transform: rotate(0deg) scale(1); }
            50%      { transform: rotate(4deg) scale(1.03); }
          }
          @keyframes cardIn {
            from { opacity:0; transform: translateY(20px) scale(.98); }
            to   { opacity:1; transform: translateY(0) scale(1); }
          }
          @keyframes fieldIn {
            from { opacity:0; transform: translateY(10px); }
            to   { opacity:1; transform: translateY(0); }
          }
          .login-input {
            width: 100%;
            height: 46px;
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 10px;
            padding: 0 16px;
            font-size: 14px;
            font-family: 'DM Sans', sans-serif;
            color: #fff;
            outline: none;
            transition: border-color .2s, background .2s, box-shadow .2s;
            box-sizing: border-box;
          }
          .login-input::placeholder { color: rgba(255,255,255,0.28); }
          .login-input:focus {
            border-color: #1D72E8;
            background: rgba(29,114,232,0.08);
            box-shadow: 0 0 0 3px rgba(29,114,232,0.18);
          }
          .login-input:read-only {
            opacity: 0.55;
            cursor: default;
          }
          .arrow-btn {
            flex-shrink: 0;
            width: 46px; height: 46px;
            border-radius: 10px; border: none;
            background: linear-gradient(135deg, #1D72E8, #3D8EFF);
            color: #fff;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(29,114,232,0.35);
            transition: transform .15s, box-shadow .15s, opacity .15s;
            font-size: 18px; line-height: 1;
          }
          .arrow-btn:hover:not(:disabled) {
            transform: translateX(2px);
            box-shadow: 0 6px 20px rgba(29,114,232,0.5);
          }
          .arrow-btn:disabled { opacity: 0.35; cursor: default; }
          .submit-btn {
            width: 100%; height: 48px;
            border-radius: 10px; border: none;
            background: linear-gradient(135deg, #1D72E8 0%, #3D8EFF 100%);
            color: #fff;
            font-size: 14px; font-weight: 600;
            font-family: 'DM Sans', sans-serif;
            cursor: pointer;
            box-shadow: 0 4px 18px rgba(29,114,232,0.4);
            transition: transform .15s, box-shadow .15s, background .3s;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            animation: fieldIn .35s .05s cubic-bezier(.22,1,.36,1) both;
          }
          .submit-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 8px 24px rgba(29,114,232,0.5);
          }
          .submit-btn:disabled { opacity: 0.75; cursor: default; transform: none; }
          .submit-btn.success {
            background: linear-gradient(135deg, #16A34A, #22C55E);
            box-shadow: 0 4px 18px rgba(22,163,74,0.4);
          }
          .pw-toggle {
            position: absolute; right: 14px; top: 50%;
            transform: translateY(-50%);
            background: none; border: none;
            color: rgba(255,255,255,0.35);
            cursor: pointer; font-size: 14px; padding: 0; line-height: 1;
            transition: color .15s;
          }
          .pw-toggle:hover { color: rgba(255,255,255,0.6); }
          .field-group-animate { animation: fieldIn .35s cubic-bezier(.22,1,.36,1) both; }
        `}</style>

        {/* ── Page centre ── */}
        <div style={{
          position: "relative", zIndex: 2,
          height: "100vh",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>

          {/* ── Card ── */}
          <div style={{
            width: "100%", maxWidth: 420,
            background: "rgba(12,24,50,0.72)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 18,
            padding: "40px 40px 36px",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            boxShadow: "0 0 0 1px rgba(29,114,232,0.08), 0 32px 64px rgba(0,0,0,0.48), 0 4px 16px rgba(0,0,0,0.32)",
            animation: "cardIn .5s cubic-bezier(.22,1,.36,1) both",
          }}>

            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 32 }}>
              <div style={{
                width: 36, height: 36,
                background: "linear-gradient(135deg, #1D72E8, #3D8EFF)",
                borderRadius: 9,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: "#fff",
                boxShadow: "0 4px 14px rgba(29,114,232,0.4)",
                letterSpacing: "-0.3px", flexShrink: 0,
              }}>
                IQ
              </div>
              <div>
                <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#fff", letterSpacing: "-0.3px", lineHeight: 1 }}>
                  nolyvra
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px", marginTop: 2 }}>
                  MVP v0.1
                </div>
              </div>
            </div>

            {/* Login mode toggle */}
            <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
              {[
                { key: "tenant",   label: "Login" },
                { key: "employee", label: "Employee Login" },
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => switchLoginMode(opt.key)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: `1px solid ${loginMode === opt.key ? "#1D72E8" : "rgba(255,255,255,0.14)"}`,
                    background: loginMode === opt.key ? "rgba(29,114,232,0.16)" : "transparent",
                    color: loginMode === opt.key ? "#fff" : "rgba(255,255,255,0.45)",
                    fontSize: 12, fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: "pointer",
                    transition: "all .15s",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Step dots */}
            <StepDots step={step} />

            {/* Heading */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.4px", lineHeight: 1.2, margin: "0 0 6px" }}>
                {heading.title}
              </h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, margin: 0 }}>
                {heading.desc}
              </p>
            </div>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── Email field ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                  Email
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    className="login-input"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={handleEmailChange}
                    onKeyDown={handleEmailKeyDown}
                    readOnly={step > 0}
                    autoComplete="email"
                    autoFocus
                  />
                  {step === 0 && (
                    <button
                      className="arrow-btn"
                      onClick={submitEmail}
                      disabled={!isValidEmail(email)}
                      title="Continue"
                    >
                      →
                    </button>
                  )}
                </div>
                {step === 0 && emailError && (
                  <div style={{ fontSize: 11, color: "#F87171", paddingLeft: 2 }}>{emailError}</div>
                )}
                {step > 0 && (
                  <div style={{ fontSize: 11, color: "#4ADE80", paddingLeft: 2 }}>✓ Email confirmed</div>
                )}
              </div>

              {/* ── Password field (shown from step 1) ── */}
              {step >= 1 && (
                <div className="field-group-animate" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                    Password
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <input
                        ref={passwordRef}
                        className="login-input"
                        type={pwVisible ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={handlePasswordChange}
                        onKeyDown={handlePasswordKeyDown}
                        autoComplete="current-password"
                        style={{ paddingRight: 44 }}
                      />
                      <button
                        className="pw-toggle"
                        onClick={() => setPwVisible((v) => !v)}
                        title="Show / hide password"
                        type="button"
                      >
                        {pwVisible ? "🙈" : "👁"}
                      </button>
                    </div>
                  </div>
                  {pwHint && (
                    <div style={{
                      fontSize: 11,
                      color: pwHint.startsWith("✓") ? "#4ADE80" : "rgba(255,255,255,0.35)",
                      paddingLeft: 2,
                    }}>
                      {pwHint}
                    </div>
                  )}
                </div>
              )}

              {/* ── API error ── */}
              {apiError && (
                <div style={{
                  fontSize: 12, color: "#F87171",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 8, padding: "10px 14px",
                }}>
                  {apiError}
                </div>
              )}

              {/* ── Submit button (shown from step 2) ── */}
              {step >= 2 && (
                <button
                  className={`submit-btn${success ? " success" : ""}`}
                  onClick={handleSubmit}
                  disabled={loading || success}
                >
                  {success
                    ? <><span>✓ Signed in</span><span>— redirecting…</span></>
                    : loading
                    ? <span style={{ opacity: 0.7 }}>Signing in…</span>
                    : <><span>Sign In to nolyvra</span><span>→</span></>
                  }
                </button>
              )}

            </div>

            {/* ── Change 1: Footer with clickable Privacy Policy + Password Policy ── */}
            <div style={{ marginTop: 24, textAlign: "center" }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.18)" }}>
                Protected by nolyvra ·{" "}
                <a href="#" onClick={e => { e.preventDefault(); setPrivacyOpen(true); }}
                  style={{ color: "rgba(255,255,255,0.25)", textDecoration: "none", cursor: "pointer" }}>
                  Privacy Policy
                </a>
                {" "}·{" "}
                <a href="#" onClick={e => { e.preventDefault(); setPolicyOpen(true); }}
                  style={{ color: "rgba(255,255,255,0.25)", textDecoration: "none", cursor: "pointer" }}>
                  Password Policy
                </a>
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* ── Change 1a: Privacy Policy Modal ── */}
      {privacyOpen && (
        <div style={modalOverlay} onClick={e => { if (e.target === e.currentTarget) setPrivacyOpen(false); }}>
          <div style={modalBox}>
            <button onClick={() => setPrivacyOpen(false)} style={closeBtn}>✕</button>
            <div style={{ fontSize: 22, marginBottom: 8 }}>🔐</div>
            <div style={modalTitle}>Privacy Policy</div>
            <div style={modalDesc}>
              nolyvra is committed to protecting your personal information and your right to privacy.
            </div>
            {[
              ["Data collection", "We collect only the information necessary to provide our recruitment intelligence services, including your name, email address and usage data."],
              ["Data usage", "Your data is used solely to operate and improve the nolyvra platform. We do not sell or share your personal data with third parties for marketing purposes."],
              ["Data security", "We implement industry-standard security measures including encryption and access controls to protect your information."],
              ["Data retention", "We retain your data only for as long as necessary to provide our services or as required by law."],
              ["Your rights", "You have the right to access, correct or delete your personal data at any time by contacting our support team."],
            ].map(([title, desc]) => (
              <div key={title} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                <div style={bullet} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0F1623", marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "#9AA3B4", lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
            <button onClick={() => setPrivacyOpen(false)} style={closeModalBtn}>Close</button>
          </div>
        </div>
      )}

      {/* ── Change 1b: Password Policy Modal ── */}
      {policyOpen && (
        <div style={modalOverlay} onClick={e => { if (e.target === e.currentTarget) setPolicyOpen(false); }}>
          <div style={modalBox}>
            <button onClick={() => setPolicyOpen(false)} style={closeBtn}>✕</button>
            <div style={{ fontSize: 22, marginBottom: 8 }}>🔒</div>
            <div style={modalTitle}>Password Policy</div>
            <div style={modalDesc}>
              To keep your nolyvra account secure, please follow these guidelines when creating or updating your password.
            </div>
            {[
              ["Minimum length", "Your password must be at least 6 characters long."],
              ["Mix of characters", "We recommend using a combination of uppercase and lowercase letters, numbers and symbols for a stronger password."],
              ["Avoid common passwords", "Do not use easily guessable passwords such as your name, email address, or common words like 'password123'."],
              ["Keep it private", "Never share your password with anyone, including nolyvra support staff."],
              ["Regular updates", "We recommend updating your password periodically to maintain account security."],
            ].map(([title, desc]) => (
              <div key={title} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                <div style={bullet} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0F1623", marginBottom: 2 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "#9AA3B4", lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
            <button onClick={() => setPolicyOpen(false)} style={closeModalBtn}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
