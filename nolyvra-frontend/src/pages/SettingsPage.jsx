import { useState, useEffect, Fragment } from "react";
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  Alert, CircularProgress, LinearProgress, Slider
} from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePlanLimit } from "../hooks/usePlanLimit";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706", WARN_BG = "#FFFBEB", WARN_BR = "#FDE68A";
const DANGER = "#DC2626", DANGER_BG = "#FEF2F2", DANGER_BR = "#FECACA";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE";
const SURFACE = "#FAFBFD";
// ── Usage bar component ───────────────────────────────────────────────────────
function UsageBar({ label, used, max, remainingLabel }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const color = pct >= 90 ? DANGER : pct >= 70 ? WARN : SUCCESS;
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, color: TEXT }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color }}>
          {used} / {max}
        </Typography>
      </Box>
      <Box sx={{ height: 6, bgcolor: "#F0F2F6", borderRadius: "4px", overflow: "hidden" }}>
        <Box sx={{
          width: `${pct}%`, height: "100%", bgcolor: color,
          borderRadius: "4px", transition: "width .3s"
        }} />
      </Box>
      <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>
        {remainingLabel ?? `${max - used} ${label.toLowerCase()} remaining`}
      </Typography>
    </Box>
  );
}

// ── Plan badge ────────────────────────────────────────────────────────────────
function PlanBadge({ name }) {
  const styles = {
    Free: { bg: "#F1F3F7", border: BORDER, color: MUTED, },
    Silver: { bg: ACCENT_BG, border: ACCENT_BR, color: ACCENT, },
    Gold: { bg: WARN_BG, border: WARN_BR, color: WARN, },
  };
  const s = styles[name] ?? styles.Free;
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "20px", px: 1.5, py: 0.4,
      fontSize: 12, fontWeight: 700, color: s.color
    }}>
      {name === "Gold" ? "🏆 " : name === "Silver" ? "⭐ " : ""}
      {name} Plan
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const loginId = localStorage.getItem("loginId") || "";
  const name = localStorage.getItem("name") || "";

  // Show success banner if returning from Stripe checkout
  const [upgradeSuccess, setUpgradeSuccess] = useState(
    searchParams.get("upgraded") === "true"
  );
  const [tokensPurchased, setTokensPurchased] = useState(
    searchParams.get("tokens_purchased") === "true"
  );

  // Outlook OAuth
  const [outlookSuccess,      setOutlookSuccess]      = useState(searchParams.get("outlook") === "connected");
  const [outlookError,        setOutlookError]        = useState(searchParams.get("outlook") === "error");
  const [outlookOAuthConnected, setOutlookOAuthConnected] = useState(false);
  const [outlookOAuthEmail,   setOutlookOAuthEmail]   = useState("");
  const [outlookEmail,        setOutlookEmail]        = useState(
    () => localStorage.getItem("outlookEmail") || ""
  );
  const [outlookInput,        setOutlookInput]        = useState(
    () => localStorage.getItem("outlookEmail") || ""
  );
  const [outlookSaved,        setOutlookSaved]        = useState(false);

  const outlookConnected = outlookOAuthConnected || outlookEmail.trim() !== "";
  const displayEmail     = outlookOAuthEmail || outlookEmail;

  // Gmail OAuth
  const [gmailSuccess, setGmailSuccess] = useState(searchParams.get("gmail") === "connected");
  const [gmailError, setGmailError] = useState(searchParams.get("gmail") === "error");
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState("");

  // Xero OAuth
  const [xeroSuccess, setXeroSuccess] = useState(searchParams.get("xero") === "connected");
  const [xeroError, setXeroError] = useState(searchParams.get("xero") === "error");
  const [xeroConnected, setXeroConnected] = useState(false);
  const [xeroTenantName, setXeroTenantName] = useState("");
  const [xeroReconnectRequired, setXeroReconnectRequired] = useState(false);

  useEffect(() => {
    if (!loginId) return;
    fetch(`${API_BASE}/auth/microsoft/status?loginId=${encodeURIComponent(loginId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.connected) { setOutlookOAuthConnected(true); setOutlookOAuthEmail(d.email || ""); } })
      .catch(() => {});
    fetch(`${API_BASE}/auth/google/status?loginId=${encodeURIComponent(loginId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.connected) { setGmailConnected(true); setGmailEmail(d.email || ""); } })
      .catch(() => {});
    fetch(`${API_BASE}/auth/xero/status?loginId=${encodeURIComponent(loginId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setXeroConnected(!!d.connected);
        setXeroTenantName(d.tenantName || "");
        setXeroReconnectRequired(!!d.reconnectRequired);
      })
      .catch(() => {});
  }, [loginId]);

  function handleOutlookConnect() {
    window.location.href = `${API_BASE}/auth/microsoft/connect?loginId=${encodeURIComponent(loginId)}`;
  }

  function handleGmailConnect() {
    window.location.href = `${API_BASE}/auth/google/connect?loginId=${encodeURIComponent(loginId)}`;
  }

  function handleXeroConnect() {
    window.location.href = `${API_BASE}/auth/xero/connect?loginId=${encodeURIComponent(loginId)}`;
  }

  async function handleXeroDisconnect() {
    await fetch(`${API_BASE}/auth/xero/disconnect?loginId=${encodeURIComponent(loginId)}`,
      { method: "DELETE" }).catch(() => {});
    setXeroConnected(false);
    setXeroTenantName("");
    setXeroReconnectRequired(false);
  }

  function handleOutlookSave() {
    const trimmed = outlookInput.trim();
    localStorage.setItem("outlookEmail", trimmed);
    setOutlookEmail(trimmed);
    setOutlookSaved(true);
    setTimeout(() => setOutlookSaved(false), 2500);
  }

  async function handleOutlookDisconnect() {
    await fetch(`${API_BASE}/auth/microsoft/disconnect?loginId=${encodeURIComponent(loginId)}`,
      { method: "DELETE" }).catch(() => {});
    localStorage.removeItem("outlookEmail");
    setOutlookOAuthConnected(false);
    setOutlookOAuthEmail("");
    setOutlookEmail("");
    setOutlookInput("");
  }

  async function handleGmailDisconnect() {
    await fetch(`${API_BASE}/auth/google/disconnect?loginId=${encodeURIComponent(loginId)}`,
      { method: "DELETE" }).catch(() => {});
    setGmailConnected(false);
    setGmailEmail("");
  }

  // Plan usage from shared hook
  const { usage, loading: planLoading } = usePlanLimit();

  // ── Monthly Target state ──────────────────────────────────────────────────
  const [monthlyTarget, setMonthlyTarget] = useState(35);
  const [targetSaving,  setTargetSaving]  = useState(false);
  const [targetSaved,   setTargetSaved]   = useState(false);

  useEffect(() => {
    if (!loginId) return;
    const url = new URL(`${API_BASE}/api/settings`);
    url.searchParams.set("loginId", loginId);
    fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.monthlyTarget !== undefined) setMonthlyTarget(d.monthlyTarget); })
      .catch(() => {});
  }, [loginId]);

  async function handleSaveTarget() {
    setTargetSaving(true);
    try {
      const url = new URL(`${API_BASE}/api/settings/monthly-target`);
      url.searchParams.set("loginId", loginId);
      await fetch(url.toString(), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify({ monthlyTarget }),
      });
      setTargetSaved(true);
      setTimeout(() => setTargetSaved(false), 2500);
    } catch { /* silent */ }
    finally { setTargetSaving(false); }
  }

  // ── Update Password state ─────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });

  // ── Admin panel state ─────────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [onboarding, setOnboarding] = useState(null);
  const [selectedAdminUser, setSelectedAdminUser] = useState("");
  const [additionalLimits, setAdditionalLimits] = useState({ tokens: "", jobs: "", candidates: "" });
  const [limitsUpdating, setLimitsUpdating] = useState(false);
  const [limitsSuccess, setLimitsSuccess] = useState(false);
  const [interestRecipients, setInterestRecipients] = useState("");
  const [interestRecipientsLoading, setInterestRecipientsLoading] = useState(false);
  const [interestRecipientsSaving, setInterestRecipientsSaving] = useState(false);
  const [interestRecipientsSaved, setInterestRecipientsSaved] = useState(false);
  const [interestRecipientsError, setInterestRecipientsError] = useState("");
  const [interestTemplates, setInterestTemplates] = useState({
    confirmationSubject: "",
    confirmationHtml: "",
    notificationSubject: "",
    notificationHtml: "",
  });
  const [onboardingRecipients, setOnboardingRecipients] = useState("");
  const [onboardingRecipientsLoading, setOnboardingRecipientsLoading] = useState(false);
  const [onboardingRecipientsSaving, setOnboardingRecipientsSaving] = useState(false);
  const [onboardingRecipientsSaved, setOnboardingRecipientsSaved] = useState(false);
  const [onboardingRecipientsError, setOnboardingRecipientsError] = useState("");
  const [onboardingTemplates, setOnboardingTemplates] = useState({
    confirmationSubject: "",
    confirmationHtml: "",
    notificationSubject: "",
    notificationHtml: "",
  });

  useEffect(() => {
    if (!loginId) return;
    fetch(`${API_BASE}/api/auth/admin/users?loginId=${encodeURIComponent(loginId)}`, { headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } })
      .then(r => { if (r.ok) { setIsAdmin(true); return r.json(); } throw new Error(); })
      .then(d => setAdminUsers(d))
      .catch(() => setIsAdmin(false));
  }, [loginId]);

  useEffect(() => {
    if (!loginId || !isAdmin) return;
    setInterestRecipientsLoading(true);
    fetch(`${API_BASE}/api/auth/admin/register-interest-notifications?loginId=${encodeURIComponent(loginId)}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setInterestRecipients((d.emails || []).join(", "));
        setInterestTemplates({
          confirmationSubject: d.confirmationSubject || "",
          confirmationHtml: d.confirmationHtml || "",
          notificationSubject: d.notificationSubject || "",
          notificationHtml: d.notificationHtml || "",
        });
      })
      .catch(() => setInterestRecipientsError("Could not load notification recipients."))
      .finally(() => setInterestRecipientsLoading(false));
  }, [loginId, isAdmin]);

  useEffect(() => {
    if (!loginId || !isAdmin) return;
    setOnboardingRecipientsLoading(true);
    fetch(`${API_BASE}/api/auth/admin/onboarding-notifications?loginId=${encodeURIComponent(loginId)}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setOnboardingRecipients((d.emails || []).join(", "));
        setOnboardingTemplates({
          confirmationSubject: d.confirmationSubject || "",
          confirmationHtml: d.confirmationHtml || "",
          notificationSubject: d.notificationSubject || "",
          notificationHtml: d.notificationHtml || "",
        });
      })
      .catch(() => setOnboardingRecipientsError("Could not load onboarding notification settings."))
      .finally(() => setOnboardingRecipientsLoading(false));
  }, [loginId, isAdmin]);

  useEffect(() => {
    if (!loginId || !isAdmin) return;
    setLeadsLoading(true);
    fetch(`${API_BASE}/api/stack-audit/leads`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setStackLeads)
      .catch(() => {})
      .finally(() => setLeadsLoading(false));
  }, [loginId, isAdmin]);

  async function handleOnboard(targetId) {
    setOnboarding(targetId);
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/onboard?loginId=${encodeURIComponent(loginId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: JSON.stringify({ targetLoginId: targetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Onboard failed.");
      if (data.emailError) console.warn(data.emailError);
      setAdminUsers(prev => prev.map(u =>
        u.id === targetId ? { ...u, planId: "plan-free", planName: "Free" } : u));
    } catch (e) {
      console.error("Onboard failed", e);
    } finally {
      setOnboarding(null);
    }
  }

  function handleAdminUserSelect(userId) {
    setSelectedAdminUser(userId);
    setLimitsSuccess(false);
    const u = adminUsers.find(u => u.id === userId);
    setAdditionalLimits({
      tokens:     u?.additionalTokens     ?? "",
      jobs:       u?.additionalJobs       ?? "",
      candidates: u?.additionalCandidates ?? "",
    });
  }

  async function handleUpdateLimits() {
    if (!selectedAdminUser) return;
    setLimitsUpdating(true); setLimitsSuccess(false);
    try {
      await fetch(`${API_BASE}/api/auth/admin/update-limits?loginId=${encodeURIComponent(loginId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: JSON.stringify({
          targetLoginId:       selectedAdminUser,
          additionalTokens:     Number(additionalLimits.tokens)     || 0,
          additionalJobs:       Number(additionalLimits.jobs)       || 0,
          additionalCandidates: Number(additionalLimits.candidates) || 0,
        }),
      });
      setLimitsSuccess(true);
    } catch (e) {
      console.error("Update limits failed", e);
    } finally {
      setLimitsUpdating(false);
    }
  }

  async function handleSaveInterestRecipients() {
    setInterestRecipientsSaving(true);
    setInterestRecipientsSaved(false);
    setInterestRecipientsError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/register-interest-notifications?loginId=${encodeURIComponent(loginId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: JSON.stringify({ emails: interestRecipients, ...interestTemplates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save notification recipients.");
      setInterestRecipients((data.emails || []).join(", "));
      setInterestTemplates({
        confirmationSubject: data.confirmationSubject || "",
        confirmationHtml: data.confirmationHtml || "",
        notificationSubject: data.notificationSubject || "",
        notificationHtml: data.notificationHtml || "",
      });
      setInterestRecipientsSaved(true);
      setTimeout(() => setInterestRecipientsSaved(false), 2500);
    } catch (e) {
      setInterestRecipientsError(e.message);
    } finally {
      setInterestRecipientsSaving(false);
    }
  }

  function updateInterestTemplate(key, value) {
    setInterestTemplates(p => ({ ...p, [key]: value }));
    setInterestRecipientsError("");
    setInterestRecipientsSaved(false);
  }

  async function handleSaveOnboardingRecipients() {
    setOnboardingRecipientsSaving(true);
    setOnboardingRecipientsSaved(false);
    setOnboardingRecipientsError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/admin/onboarding-notifications?loginId=${encodeURIComponent(loginId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: JSON.stringify({ emails: onboardingRecipients, ...onboardingTemplates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save onboarding notification settings.");
      setOnboardingRecipients((data.emails || []).join(", "));
      setOnboardingTemplates({
        confirmationSubject: data.confirmationSubject || "",
        confirmationHtml: data.confirmationHtml || "",
        notificationSubject: data.notificationSubject || "",
        notificationHtml: data.notificationHtml || "",
      });
      setOnboardingRecipientsSaved(true);
      setTimeout(() => setOnboardingRecipientsSaved(false), 2500);
    } catch (e) {
      setOnboardingRecipientsError(e.message);
    } finally {
      setOnboardingRecipientsSaving(false);
    }
  }

  function updateOnboardingTemplate(key, value) {
    setOnboardingTemplates(p => ({ ...p, [key]: value }));
    setOnboardingRecipientsError("");
    setOnboardingRecipientsSaved(false);
  }

  function updatePw(k, v) {
    setPwForm(p => ({ ...p, [k]: v }));
    setPwError(null);
    setPwSuccess(false);
  }

  async function encryptPassword(plaintext) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const hashBuf = await crypto.subtle.digest("SHA-256", data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleChangePassword() {
    if (!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      setPwError("All fields are required."); return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("New passwords do not match."); return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError("New password must be at least 6 characters."); return;
    }
    setPwSaving(true); setPwError(null);
    try {
      const [hashedCurrent, hashedNew] = await Promise.all([
        encryptPassword(pwForm.currentPassword),
        encryptPassword(pwForm.newPassword),
      ]);
      const url = new URL(`${API_BASE}/api/auth/change-password`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: JSON.stringify({
          currentPassword: hashedCurrent,
          newPassword: hashedNew,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update password.");
      }
      setPwSuccess(true);
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (e) {
      setPwError(e.message);
    } finally {
      setPwSaving(false);
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  function handleLogout() {
    localStorage.removeItem("loginId");
    localStorage.removeItem("name");
    localStorage.removeItem("sessionToken");
    nav("/login");
  }

  // ── Buy Tokens ────────────────────────────────────────────────────────────
  const TOKEN_PACKS = [
    { id: "token-pack-100",  tokens: 100,   price: 5,  perToken: "5¢" },
    { id: "token-pack-250",  tokens: 250,   price: 10, perToken: "4¢", popular: true },
    { id: "token-pack-600",  tokens: 600,   price: 20, perToken: "3.3¢" },
    { id: "token-pack-1500", tokens: 1500,  price: 50, perToken: "3.3¢", best: true },
  ];
  const [selectedPack, setSelectedPack] = useState(null);
  const [buyLoading,   setBuyLoading]   = useState(false);

  async function handleBuyTokens() {
    if (!selectedPack) return;
    setBuyLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/stripe/token-checkout?` +
        `loginId=${encodeURIComponent(loginId)}` +
        `&packId=${encodeURIComponent(selectedPack)}` +
        `&successUrl=${encodeURIComponent(window.location.origin + "/settings")}` +
        `&cancelUrl=${encodeURIComponent(window.location.origin + "/settings")}`,
        { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setBuyLoading(false);
    }
  }

  // ── Form Leads (Stack Audit) ──────────────────────────────────────────────
  const [stackLeads,        setStackLeads]        = useState([]);
  const [leadsLoading,      setLeadsLoading]      = useState(false);
  const [selectedLeadId,    setSelectedLeadId]    = useState(null);

  // ── Manage Subscription (Stripe Portal) ──────────────────────────────────
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/stripe/portal?` +
        `loginId=${encodeURIComponent(loginId)}` +
        `&returnUrl=${encodeURIComponent(window.location.origin + "/settings")}`,
        { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open billing portal.");
      }
    } catch (e) {
      alert("Network error. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 540 }}>

      {/* Page header */}
      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Settings</Typography>
        <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
          Manage your account and preferences
        </Typography>
      </Box>

      {/* ── Stripe upgrade success banner ─────────────────────────────────── */}
      {upgradeSuccess && (
        <Alert severity="success" onClose={() => setUpgradeSuccess(false)}
          sx={{ borderRadius: "10px", fontSize: 13 }}>
          🎉 Your plan has been upgraded successfully! Your new limits are now active.
        </Alert>
      )}

      {/* ── Token purchase success banner ─────────────────────────────────── */}
      {tokensPurchased && (
        <Alert severity="success" onClose={() => setTokensPurchased(false)}
          sx={{ borderRadius: "10px", fontSize: 13 }}>
          🪙 Tokens added to your account successfully! Your balance has been updated.
        </Alert>
      )}

      {/* ── Outlook connection banners ────────────────────────────────────── */}
      {outlookSuccess && (
        <Alert severity="success" onClose={() => setOutlookSuccess(false)}
          sx={{ borderRadius: "10px", fontSize: 13 }}>
          📧 Microsoft Outlook connected successfully! Emails will now be sent via your Outlook account.
        </Alert>
      )}
      {outlookError && (
        <Alert severity="error" onClose={() => setOutlookError(false)}
          sx={{ borderRadius: "10px", fontSize: 13 }}>
          Failed to connect Microsoft Outlook. Please try again.
        </Alert>
      )}
      {gmailSuccess && (
        <Alert severity="success" onClose={() => setGmailSuccess(false)}
          sx={{ borderRadius: "10px", fontSize: 13 }}>
          Gmail connected successfully. Emails will now be sent via your Gmail account.
        </Alert>
      )}
      {gmailError && (
        <Alert severity="error" onClose={() => setGmailError(false)}
          sx={{ borderRadius: "10px", fontSize: 13 }}>
          Failed to connect Gmail. Please try again.
        </Alert>
      )}
      {xeroSuccess && (
        <Alert severity="success" onClose={() => setXeroSuccess(false)}
          sx={{ borderRadius: "10px", fontSize: 13 }}>
          Xero connected successfully.
        </Alert>
      )}
      {xeroError && (
        <Alert severity="error" onClose={() => setXeroError(false)}
          sx={{ borderRadius: "10px", fontSize: 13 }}>
          Failed to connect Xero. Please try again.
        </Alert>
      )}

      {/* ── Subscription Plan ─────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        border: `1px solid ${BORDER}`, borderRadius: "10px",
        overflow: "hidden", bgcolor: "#fff"
      }}>
        <Box sx={{
          px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
              Subscription Plan
            </Typography>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
              Your current plan and usage limits
            </Typography>
          </Box>
          {!planLoading && usage && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <PlanBadge name={usage.planName} />
              {/* Show portal button for paid plans */}
              {usage.planName !== "Free" && usage.planName !== "Registered" && (
                <Button size="small" variant="outlined"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  sx={{ fontSize: 11, borderRadius: "6px", textTransform: "none",
                    borderColor: BORDER, color: MUTED,
                    "&:hover": { borderColor: ACCENT, color: ACCENT } }}>
                  {portalLoading ? "Opening…" : "Manage"}
                </Button>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ p: 2.25 }}>
          {planLoading ? (
            <LinearProgress sx={{ borderRadius: "4px" }} />
          ) : usage ? (
            <>
              {/* Plan limits overview */}
              <Box sx={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 1.5, mb: 2, p: 1.5,
                bgcolor: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: "8px"
              }}>
                {[
                  { label: "Max Jobs", value: usage.maxJobs },
                  { label: "Max Candidates", value: usage.maxCandidates },
                  { label: "Max Tokens", value: usage.maxTokens },
                  {
                    label: "Renews On", value: usage.renewDate
                      ? new Date(usage.renewDate).toLocaleDateString("en-GB",
                        { day: "numeric", month: "short", year: "numeric" })
                      : "—"
                  },
                ].map(item => (
                  <Box key={item.label}>
                    <Typography sx={{
                      fontSize: 10, color: MUTED, fontWeight: 600,
                      textTransform: "uppercase", letterSpacing: ".5px"
                    }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT, mt: 0.25 }}>
                      {item.value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Usage bars */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75, mb: 2 }}>
                <UsageBar label="Jobs" used={usage.currentJobs} max={usage.maxJobs} />
                <UsageBar label="Candidates" used={usage.currentCandidates} max={usage.maxCandidates} />
                <UsageBar label="Tokens"
                  used={(usage.maxTokens ?? 0) - (usage.tokensRemaining ?? 0)}
                  max={usage.maxTokens ?? 0}
                  remainingLabel={`${usage.tokensRemaining ?? 0} tokens remaining · renews ${usage.renewDate
                      ? new Date(usage.renewDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                      : "—"
                    }`}
                />
              </Box>

              {/* Upgrade nudge for Free plan */}
              {usage.planName !== "Registered" && (
                <Box sx={{
                  display: "flex", gap: 1.25, alignItems: "center",
                  bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`,
                  borderRadius: "8px", p: "10px 14px"
                }}>
                  <Typography sx={{ fontSize: 13 }}>✦</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: PURPLE }}>
                      {usage.planName === "Free" ? "Upgrade to Silver or Gold" : "View All Plans"}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
                      {usage.planName === "Free"
                        ? "Silver: 20 jobs · 50 candidates \u00a0|\u00a0 Gold: 100 jobs · 500 candidates"
                        : "Upgrade your plan or add additional capacity"}
                    </Typography>
                  </Box>
                  <Button size="small" variant="contained"
                    onClick={() => nav(`/pricing?loginId=${encodeURIComponent(loginId)}`)}
                    sx={{
                      fontSize: 11, fontWeight: 600, bgcolor: PURPLE, borderRadius: "6px",
                      textTransform: "none", boxShadow: "none", flexShrink: 0,
                      "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" }
                    }}>
                    {usage.planName === "Free" ? "Upgrade" : "View Plans"}
                  </Button>
                </Box>
              )}
            </>
          ) : (
            <Typography sx={{ fontSize: 12, color: MUTED }}>
              Could not load plan details.
            </Typography>
          )}
        </Box>
      </Paper>

      {/* ── Buy Tokens ────────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        border: `1px solid ${BORDER}`, borderRadius: "10px",
        overflow: "hidden", bgcolor: "#fff"
      }}>
        <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>🪙 Buy Tokens</Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Top up your token balance. Tokens are added instantly after payment.
          </Typography>
        </Box>
        <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
            {TOKEN_PACKS.map(pack => {
              const isSelected = selectedPack === pack.id;
              return (
                <Box key={pack.id} onClick={() => setSelectedPack(pack.id)}
                  sx={{
                    position: "relative", p: "12px 14px", borderRadius: "8px", cursor: "pointer",
                    border: `1.5px solid ${isSelected ? ACCENT : BORDER}`,
                    bgcolor: isSelected ? ACCENT_BG : SURFACE,
                    transition: "all .15s",
                    "&:hover": { borderColor: ACCENT, bgcolor: ACCENT_BG },
                  }}>
                  {pack.popular && (
                    <Box sx={{
                      position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                      bgcolor: ACCENT, color: "#fff", fontSize: 9, fontWeight: 700,
                      px: 1, py: 0.25, borderRadius: "10px", whiteSpace: "nowrap",
                      letterSpacing: ".4px", textTransform: "uppercase"
                    }}>Popular</Box>
                  )}
                  {pack.best && (
                    <Box sx={{
                      position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                      bgcolor: SUCCESS, color: "#fff", fontSize: 9, fontWeight: 700,
                      px: 1, py: 0.25, borderRadius: "10px", whiteSpace: "nowrap",
                      letterSpacing: ".4px", textTransform: "uppercase"
                    }}>Best Value</Box>
                  )}
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: isSelected ? ACCENT : TEXT, lineHeight: 1 }}>
                    {pack.tokens.toLocaleString()}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", mt: 0.25 }}>
                    tokens
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mt: 1 }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 700, color: isSelected ? ACCENT : TEXT }}>
                      ${pack.price}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: MUTED }}>· {pack.perToken} / token</Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
          <Button variant="contained" onClick={handleBuyTokens}
            disabled={!selectedPack || buyLoading}
            sx={{
              alignSelf: "stretch", fontSize: 13, fontWeight: 600,
              bgcolor: ACCENT, borderRadius: "8px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
              "&.Mui-disabled": { bgcolor: ACCENT_BG, color: ACCENT }
            }}>
            {buyLoading ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Checkout →"}
          </Button>
        </Box>
      </Paper>

      {/* ── Recruitment Targets ──────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        border: `1px solid ${BORDER}`, borderRadius: "10px",
        overflow: "hidden", bgcolor: "#fff"
      }}>
        <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
            Recruitment Targets
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Set your monthly placement goal — tracked on your dashboard
          </Typography>
        </Box>
        <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
          {targetSaved && (
            <Alert severity="success" onClose={() => setTargetSaved(false)}
              sx={{ borderRadius: "8px", fontSize: 12 }}>
              Monthly target saved.
            </Alert>
          )}
          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.25 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>
                Monthly Target
              </Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: PURPLE }}>
                {monthlyTarget} candidates
              </Typography>
            </Box>
            <Slider
              value={monthlyTarget}
              onChange={(_, v) => setMonthlyTarget(v)}
              min={0} max={100} step={5}
              marks={[
                { value: 0,   label: "0"   },
                { value: 25,  label: "25"  },
                { value: 50,  label: "50"  },
                { value: 75,  label: "75"  },
                { value: 100, label: "100" },
              ]}
              sx={{
                color: PURPLE,
                "& .MuiSlider-markLabel": { fontSize: 10, color: MUTED },
                "& .MuiSlider-thumb": {
                  "&:hover, &.Mui-focusVisible": { boxShadow: "0 0 0 8px rgba(124,58,237,0.12)" },
                },
              }}
            />
          </Box>
          <Button
            variant="contained"
            onClick={handleSaveTarget}
            disabled={targetSaving}
            sx={{
              alignSelf: "flex-start", fontSize: 12, fontWeight: 500,
              bgcolor: PURPLE, borderRadius: "8px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" }
            }}>
            {targetSaving ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Save Target"}
          </Button>
        </Box>
      </Paper>

      {/* ── Update Password ────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        border: `1px solid ${BORDER}`, borderRadius: "10px",
        overflow: "hidden", bgcolor: "#fff"
      }}>
        <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
            Update Password
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Choose a strong password of at least 6 characters
          </Typography>
        </Box>
        <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>

          {pwError && <Alert severity="error" onClose={() => setPwError(null)}>{pwError}</Alert>}
          {pwSuccess && (
            <Alert severity="success" onClose={() => setPwSuccess(false)}>
              Password updated successfully.
            </Alert>
          )}

          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>
              Current Password
            </Typography>
            <TextField fullWidth size="small"
              type={showPw.current ? "text" : "password"}
              value={pwForm.currentPassword}
              onChange={e => updatePw("currentPassword", e.target.value)}
              placeholder="Enter current password"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }}
              InputProps={{ endAdornment: (
                <Box component="span" onClick={() => setShowPw(p => ({ ...p, current: !p.current }))}
                  sx={{ cursor: "pointer", fontSize: 16, color: MUTED, userSelect: "none",
                    "&:hover": { color: TEXT } }}>
                  {showPw.current ? "🙈" : "👁"}
                </Box>
              )}} />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>
              New Password
            </Typography>
            <TextField fullWidth size="small"
              type={showPw.new ? "text" : "password"}
              value={pwForm.newPassword}
              onChange={e => updatePw("newPassword", e.target.value)}
              placeholder="Enter new password"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }}
              InputProps={{ endAdornment: (
                <Box component="span" onClick={() => setShowPw(p => ({ ...p, new: !p.new }))}
                  sx={{ cursor: "pointer", fontSize: 16, color: MUTED, userSelect: "none",
                    "&:hover": { color: TEXT } }}>
                  {showPw.new ? "🙈" : "👁"}
                </Box>
              )}} />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>
              Confirm New Password
            </Typography>
            <TextField fullWidth size="small"
              type={showPw.confirm ? "text" : "password"}
              value={pwForm.confirmPassword}
              onChange={e => updatePw("confirmPassword", e.target.value)}
              placeholder="Re-enter new password"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }}
              InputProps={{ endAdornment: (
                <Box component="span" onClick={() => setShowPw(p => ({ ...p, confirm: !p.confirm }))}
                  sx={{ cursor: "pointer", fontSize: 16, color: MUTED, userSelect: "none",
                    "&:hover": { color: TEXT } }}>
                  {showPw.confirm ? "🙈" : "👁"}
                </Box>
              )}} />
          </Box>

          <Button variant="contained" onClick={handleChangePassword} disabled={pwSaving}
            sx={{
              alignSelf: "flex-start", fontSize: 12, fontWeight: 500,
              bgcolor: ACCENT, borderRadius: "8px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" }
            }}>
            {pwSaving
              ? <CircularProgress size={14} sx={{ color: "#fff" }} />
              : "Update Password"}
          </Button>
        </Box>
      </Paper>

      {/* ── Admin Panel — only visible to admin users ─────────────────────── */}
      {isAdmin && (
        <Paper elevation={0} sx={{
          border: `1px solid ${WARN_BR}`, borderRadius: "10px",
          overflow: "hidden", bgcolor: "#fff"
        }}>
          <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, bgcolor: WARN_BG }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>
              🔐 Admin Panel
            </Typography>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
              All registered users and their current plans
            </Typography>
          </Box>
          <Box>
            {adminUsers.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: MUTED, p: 2.25 }}>No users found.</Typography>
            ) : adminUsers.map(u => (
              <Box key={u.id} sx={{
                px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
                "&:last-child": { borderBottom: "none" },
              }}>
                <Box sx={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 2,
                }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: 12, fontWeight: 600, color: TEXT,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                      {u.name || u.id}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
                      {u.id}
                      {u.createdAt && ` · Joined ${new Date(u.createdAt).toLocaleDateString("en-GB",
                        { day: "numeric", month: "short", year: "numeric" })}`}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexShrink: 0 }}>
                    {/* Plan badge */}
                    <Box sx={{
                      display: "inline-flex", alignItems: "center",
                      bgcolor: u.planId === "registered" ? WARN_BG
                        : u.planId === "plan-free" ? "#F1F3F7"
                          : ACCENT_BG,
                      border: `1px solid ${u.planId === "registered" ? WARN_BR
                        : u.planId === "plan-free" ? BORDER
                          : ACCENT_BR}`,
                      borderRadius: "20px", px: 1.25, py: 0.25,
                      fontSize: 11, fontWeight: 600,
                      color: u.planId === "registered" ? WARN
                        : u.planId === "plan-free" ? MUTED
                          : ACCENT,
                    }}>
                      {u.planName}
                    </Box>
                    {/* Onboard button — only for registered users */}
                    {u.planId === "registered" && (
                      <Button size="small" variant="contained"
                        disabled={onboarding === u.id}
                        onClick={() => handleOnboard(u.id)}
                        sx={{
                          fontSize: 11, bgcolor: WARN, borderRadius: "6px",
                          textTransform: "none", boxShadow: "none", whiteSpace: "nowrap",
                          "&:hover": { bgcolor: "#B45309", boxShadow: "none" },
                          "&.Mui-disabled": { bgcolor: WARN_BG, color: "#92400E" }
                        }}>
                        {onboarding === u.id ? "Onboarding…" : "Onboard"}
                      </Button>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* ── Admin: Additional Limits ──────────────────────────────────────── */}
      {isAdmin && (
        <Paper elevation={0} sx={{ border: `1px solid ${WARN_BR}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
          <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, bgcolor: WARN_BG }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>
              ➕ Additional Limits
            </Typography>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
              Grant extra tokens, jobs or candidates on top of plan limits
            </Typography>
          </Box>
          <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {limitsSuccess && (
              <Alert severity="success" onClose={() => setLimitsSuccess(false)}>
                Limits updated successfully.
              </Alert>
            )}
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Select User</Typography>
              <TextField select fullWidth size="small" value={selectedAdminUser}
                onChange={e => handleAdminUserSelect(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}>
                <MenuItem value="" sx={{ fontSize: 12 }}>— Select a user —</MenuItem>
                {adminUsers.map(u => (
                  <MenuItem key={u.id} value={u.id} sx={{ fontSize: 12 }}>
                    {u.name || u.id} ({u.planName})
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
              {[
                { label: "Additional Tokens", key: "tokens" },
                { label: "Additional Jobs",   key: "jobs" },
                { label: "Additional Candidates", key: "candidates" },
              ].map(({ label, key }) => (
                <Box key={key}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>{label}</Typography>
                  <TextField fullWidth size="small" type="number" value={additionalLimits[key]}
                    onChange={e => setAdditionalLimits(p => ({ ...p, [key]: e.target.value }))}
                    placeholder="0"
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }} />
                </Box>
              ))}
            </Box>
            <Button variant="contained" onClick={handleUpdateLimits}
              disabled={limitsUpdating || !selectedAdminUser}
              sx={{ alignSelf: "flex-start", fontSize: 12, bgcolor: WARN, borderRadius: "6px",
                textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#B45309", boxShadow: "none" } }}>
              {limitsUpdating ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Update Limits"}
            </Button>
          </Box>
        </Paper>
      )}

      {/* ── Admin: Onboarding Email Notifications ──────────────────────── */}
      {isAdmin && (
        <Paper elevation={0} sx={{ border: `1px solid ${WARN_BR}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
          <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, bgcolor: WARN_BG }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>
              Onboarding Email Notifications
            </Typography>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
              Email templates for approved users and internal onboarding alerts
            </Typography>
          </Box>
          <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {onboardingRecipientsSaved && (
              <Alert severity="success" onClose={() => setOnboardingRecipientsSaved(false)}>
                Onboarding email settings saved.
              </Alert>
            )}
            {onboardingRecipientsError && (
              <Alert severity="error" onClose={() => setOnboardingRecipientsError("")}>
                {onboardingRecipientsError}
              </Alert>
            )}
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>
                Internal Recipient Emails
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                size="small"
                value={onboardingRecipients}
                onChange={e => {
                  setOnboardingRecipients(e.target.value);
                  setOnboardingRecipientsError("");
                  setOnboardingRecipientsSaved(false);
                }}
                disabled={onboardingRecipientsLoading}
                placeholder="info@nolyvra.com, admin@nolyvra.com"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
              <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>
                Internal emails are sent only after the approved user email succeeds.
              </Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, pt: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT }}>
                Approved User Email Template
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={onboardingTemplates.confirmationSubject}
                onChange={e => updateOnboardingTemplate("confirmationSubject", e.target.value)}
                disabled={onboardingRecipientsLoading}
                placeholder="Welcome to Nolyvra - registration approved"
                label="Subject"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
              <TextField
                fullWidth
                multiline
                minRows={5}
                size="small"
                value={onboardingTemplates.confirmationHtml}
                onChange={e => updateOnboardingTemplate("confirmationHtml", e.target.value)}
                disabled={onboardingRecipientsLoading}
                placeholder="<p>Hi {{name}},</p>"
                label="HTML Body"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, pt: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT }}>
                Internal Notification Template
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={onboardingTemplates.notificationSubject}
                onChange={e => updateOnboardingTemplate("notificationSubject", e.target.value)}
                disabled={onboardingRecipientsLoading}
                placeholder="Nolyvra registration approved: {{name}}"
                label="Subject"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
              <TextField
                fullWidth
                multiline
                minRows={6}
                size="small"
                value={onboardingTemplates.notificationHtml}
                onChange={e => updateOnboardingTemplate("notificationHtml", e.target.value)}
                disabled={onboardingRecipientsLoading}
                placeholder="<h2>Registration Approved</h2>"
                label="HTML Body"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
              <Typography sx={{ fontSize: 11, color: MUTED, mt: -0.5 }}>
                Available variables: {"{{name}}"}, {"{{email}}"}, {"{{company}}"}, {"{{password}}"}, {"{{adminLoginId}}"}.
              </Typography>
            </Box>
            <Button variant="contained" onClick={handleSaveOnboardingRecipients}
              disabled={onboardingRecipientsSaving || onboardingRecipientsLoading}
              sx={{ alignSelf: "flex-start", fontSize: 12, bgcolor: WARN, borderRadius: "6px",
                textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#B45309", boxShadow: "none" } }}>
              {onboardingRecipientsSaving ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Save Onboarding Email Settings"}
            </Button>
          </Box>
        </Paper>
      )}

      {/* ── Admin: Register Interest Notifications ───────────────────────── */}
      {isAdmin && (
        <Paper elevation={0} sx={{ border: `1px solid ${WARN_BR}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
          <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, bgcolor: WARN_BG }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>
              Register Interest Notifications
            </Typography>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
              Email recipients notified when someone submits the landing page form
            </Typography>
          </Box>
          <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {interestRecipientsSaved && (
              <Alert severity="success" onClose={() => setInterestRecipientsSaved(false)}>
                Notification recipients saved.
              </Alert>
            )}
            {interestRecipientsError && (
              <Alert severity="error" onClose={() => setInterestRecipientsError("")}>
                {interestRecipientsError}
              </Alert>
            )}
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>
                Recipient Emails
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={3}
                size="small"
                value={interestRecipients}
                onChange={e => {
                  setInterestRecipients(e.target.value);
                  setInterestRecipientsError("");
                  setInterestRecipientsSaved(false);
                }}
                disabled={interestRecipientsLoading}
                placeholder="info@nolyvra.com, admin@nolyvra.com"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
              <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>
                Separate multiple emails with commas, spaces or new lines.
              </Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, pt: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT }}>
                Thank-you Email Template
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={interestTemplates.confirmationSubject}
                onChange={e => updateInterestTemplate("confirmationSubject", e.target.value)}
                disabled={interestRecipientsLoading}
                placeholder="Thanks for your interest in Nolyvra"
                label="Subject"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
              <TextField
                fullWidth
                multiline
                minRows={5}
                size="small"
                value={interestTemplates.confirmationHtml}
                onChange={e => updateInterestTemplate("confirmationHtml", e.target.value)}
                disabled={interestRecipientsLoading}
                placeholder="<p>Hi {{name}},</p>"
                label="HTML Body"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, pt: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT }}>
                Internal Notification Template
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={interestTemplates.notificationSubject}
                onChange={e => updateInterestTemplate("notificationSubject", e.target.value)}
                disabled={interestRecipientsLoading}
                placeholder="New register interest submission: {{name}}"
                label="Subject"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
              <TextField
                fullWidth
                multiline
                minRows={6}
                size="small"
                value={interestTemplates.notificationHtml}
                onChange={e => updateInterestTemplate("notificationHtml", e.target.value)}
                disabled={interestRecipientsLoading}
                placeholder="<h2>New Register Interest Submission</h2>"
                label="HTML Body"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
              <Typography sx={{ fontSize: 11, color: MUTED, mt: -0.5 }}>
                Available variables: {"{{name}}"}, {"{{email}}"}, {"{{company}}"}, {"{{phone}}"}.
              </Typography>
            </Box>
            <Button variant="contained" onClick={handleSaveInterestRecipients}
              disabled={interestRecipientsSaving || interestRecipientsLoading}
              sx={{ alignSelf: "flex-start", fontSize: 12, bgcolor: WARN, borderRadius: "6px",
                textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#B45309", boxShadow: "none" } }}>
              {interestRecipientsSaving ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Save Notification Settings"}
            </Button>
          </Box>
        </Paper>
      )}

      {/* ── Connected Accounts ───────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        border: `1px solid ${BORDER}`, borderRadius: "10px",
        overflow: "hidden", bgcolor: "#fff"
      }}>
        <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
            Connected Accounts
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Link your email account to send emails directly from your inbox
          </Typography>
        </Box>
        <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>

          {/* Gmail row */}
          <Box sx={{
            p: "12px 14px",
            bgcolor: gmailConnected ? SUCCESS_BG : SURFACE,
            border: `1px solid ${gmailConnected ? SUCCESS_BR : BORDER}`,
            borderRadius: "8px",
            display: "flex", flexDirection: "column", gap: 1.25
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box sx={{ fontSize: 20, lineHeight: 1 }}>G</Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  Gmail
                </Typography>
                <Typography sx={{ fontSize: 11, color: gmailConnected ? SUCCESS : MUTED, mt: 0.25 }}>
                  {gmailConnected ? `Connected · ${gmailEmail}` : "Not connected"}
                </Typography>
              </Box>
              {gmailConnected && (
                <Button size="small" variant="outlined"
                  onClick={handleGmailDisconnect}
                  sx={{
                    fontSize: 11, borderRadius: "6px", textTransform: "none",
                    borderColor: DANGER_BR, color: DANGER, flexShrink: 0,
                    "&:hover": { bgcolor: DANGER_BG, borderColor: DANGER }
                  }}>
                  Remove
                </Button>
              )}
            </Box>

            <Button
              variant="contained"
              onClick={handleGmailConnect}
              fullWidth
              sx={{
                fontSize: 12, fontWeight: 600, bgcolor: "#EA4335", borderRadius: "8px",
                textTransform: "none", boxShadow: "none",
                "&:hover": { bgcolor: "#D93025", boxShadow: "none" }
              }}>
              Connect with Google
            </Button>
          </Box>

          {outlookSaved && (
            <Alert severity="success" onClose={() => setOutlookSaved(false)}
              sx={{ fontSize: 12, borderRadius: "8px" }}>
              Outlook email saved successfully.
            </Alert>
          )}

          {/* Outlook row */}
          <Box sx={{
            p: "12px 14px",
            bgcolor: outlookConnected ? SUCCESS_BG : SURFACE,
            border: `1px solid ${outlookConnected ? SUCCESS_BR : BORDER}`,
            borderRadius: "8px",
            display: "flex", flexDirection: "column", gap: 1.25
          }}>

            {/* Header row: icon + name + status + Remove */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box sx={{ fontSize: 20, lineHeight: 1 }}>📧</Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  Microsoft Outlook
                </Typography>
                <Typography sx={{ fontSize: 11, color: outlookConnected ? SUCCESS : MUTED, mt: 0.25 }}>
                  {outlookConnected ? `Connected · ${displayEmail}` : "Not connected"}
                </Typography>
              </Box>
              {outlookConnected && (
                <Button size="small" variant="outlined"
                  onClick={handleOutlookDisconnect}
                  sx={{
                    fontSize: 11, borderRadius: "6px", textTransform: "none",
                    borderColor: DANGER_BR, color: DANGER, flexShrink: 0,
                    "&:hover": { bgcolor: DANGER_BG, borderColor: DANGER }
                  }}>
                  Remove
                </Button>
              )}
            </Box>

            {/* OAuth button — always visible */}
            <Button
              variant="contained"
              onClick={handleOutlookConnect}
              fullWidth
              sx={{
                fontSize: 12, fontWeight: 600, bgcolor: "#0078D4", borderRadius: "8px",
                textTransform: "none", boxShadow: "none",
                "&:hover": { bgcolor: "#006CBF", boxShadow: "none" }
              }}>
              🔗 Connect with Microsoft
            </Button>

            {/* Divider */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ flex: 1, height: "1px", bgcolor: BORDER }} />
              <Typography sx={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>
                or add email manually
              </Typography>
              <Box sx={{ flex: 1, height: "1px", bgcolor: BORDER }} />
            </Box>

            {/* Manual email input — always visible as fallback */}
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                fullWidth size="small"
                type="email"
                value={outlookInput}
                onChange={e => setOutlookInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleOutlookSave()}
                placeholder="Enter your Outlook email address"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}
              />
              <Button
                variant="outlined"
                onClick={handleOutlookSave}
                disabled={!outlookInput.trim()}
                sx={{
                  fontSize: 11, fontWeight: 600, borderColor: ACCENT_BR, color: ACCENT,
                  borderRadius: "8px", textTransform: "none", whiteSpace: "nowrap", flexShrink: 0,
                  "&:hover": { bgcolor: ACCENT_BG, borderColor: ACCENT },
                  "&.Mui-disabled": { borderColor: BORDER, color: MUTED }
                }}>
                Save
              </Button>
            </Box>
          </Box>

          {/* Xero row */}
          <Box sx={{
            p: "12px 14px",
            bgcolor: xeroConnected ? SUCCESS_BG : xeroReconnectRequired ? WARN_BG : SURFACE,
            border: `1px solid ${xeroConnected ? SUCCESS_BR : xeroReconnectRequired ? WARN_BR : BORDER}`,
            borderRadius: "8px",
            display: "flex", flexDirection: "column", gap: 1.25
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Box sx={{ fontSize: 20, lineHeight: 1 }}>🧾</Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  Xero
                </Typography>
                <Typography sx={{
                  fontSize: 11,
                  color: xeroConnected ? SUCCESS : xeroReconnectRequired ? WARN : MUTED,
                  mt: 0.25
                }}>
                  {xeroConnected
                    ? `Connected · ${xeroTenantName}`
                    : xeroReconnectRequired
                      ? "Reconnect required"
                      : "Not connected"}
                </Typography>
              </Box>
              {xeroConnected && (
                <Button size="small" variant="outlined"
                  onClick={handleXeroDisconnect}
                  sx={{
                    fontSize: 11, borderRadius: "6px", textTransform: "none",
                    borderColor: DANGER_BR, color: DANGER, flexShrink: 0,
                    "&:hover": { bgcolor: DANGER_BG, borderColor: DANGER }
                  }}>
                  Disconnect
                </Button>
              )}
            </Box>

            {!xeroConnected && (
              <Button
                variant="contained"
                onClick={handleXeroConnect}
                fullWidth
                sx={{
                  fontSize: 12, fontWeight: 600, bgcolor: "#13B5EA", borderRadius: "8px",
                  textTransform: "none", boxShadow: "none",
                  "&:hover": { bgcolor: "#0FA0D1", boxShadow: "none" }
                }}>
                {xeroReconnectRequired ? "Reconnect to Xero" : "Connect to Xero"}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* ── Form Leads (Stack Audit submissions) — admin only ────────────── */}
      {isAdmin && <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
        <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Form Leads</Typography>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>Stack Audit submissions from the public page</Typography>
          </Box>
          <Typography sx={{ fontSize: 11, color: MUTED }}>{stackLeads.length} lead{stackLeads.length !== 1 ? "s" : ""}</Typography>
        </Box>
        <Box sx={{ p: 2.25 }}>
          {leadsLoading ? (
            <LinearProgress sx={{ borderRadius: "4px" }} />
          ) : stackLeads.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: MUTED, textAlign: "center", py: 2 }}>No submissions yet.</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {["Name","Company","Email","Phone","Submitted","Est. monthly saving","% saving","Demo",""].map(h => (
                      <th key={h} style={{ padding: "7px 8px", color: MUTED, fontWeight: 600, textAlign: h === "" ? "center" : "left", whiteSpace: "nowrap", fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stackLeads.map(lead => {
                    const rep     = lead.report;
                    const isOpen  = selectedLeadId === lead.id;
                    const saving  = rep?.totalMonthlySaving ?? "—";
                    const pct     = rep?.savingPercent ?? "—";
                    const fmtAUD  = n => n != null ? `$${Number(n).toLocaleString("en-AU")}` : "—";
                    const fmtDate = s => s ? new Date(s).toLocaleDateString("en-AU", { day:"2-digit", month:"short", year:"numeric" }) : "—";
                    return (
                      <Fragment key={lead.id}>
                        <tr style={{ borderBottom: `1px solid ${BORDER}`, cursor: "pointer", background: isOpen ? ACCENT_BG : "transparent" }}
                          onClick={() => setSelectedLeadId(isOpen ? null : lead.id)}>
                          <td style={{ padding:"9px 8px", color: TEXT, fontWeight: 500 }}>{lead.fullName}</td>
                          <td style={{ padding:"9px 8px", color: TEXT }}>{lead.companyName}</td>
                          <td style={{ padding:"9px 8px", color: MUTED }}>{lead.email}</td>
                          <td style={{ padding:"9px 8px", color: MUTED }}>{lead.phone}</td>
                          <td style={{ padding:"9px 8px", color: MUTED, whiteSpace:"nowrap" }}>{fmtDate(lead.createdAt)}</td>
                          <td style={{ padding:"9px 8px", color: SUCCESS, fontWeight: 600 }}>{fmtAUD(saving)}/mo</td>
                          <td style={{ padding:"9px 8px", color: SUCCESS }}>{pct !== "—" ? `~${pct}%` : "—"}</td>
                          <td style={{ padding:"9px 8px", textAlign:"center" }}>
                            {lead.demoRequested
                              ? <span style={{ fontSize:10, fontWeight:700, color:"#16a34a", background:"#dcfce7", border:"1px solid #bbf7d0", borderRadius:6, padding:"2px 8px", whiteSpace:"nowrap" }}>Requested</span>
                              : <span style={{ fontSize:10, color:MUTED }}>—</span>}
                          </td>
                          <td style={{ padding:"9px 8px", textAlign:"center", color: ACCENT, fontSize: 11, fontWeight: 600 }}>{isOpen ? "▲ Hide" : "▼ View"}</td>
                        </tr>
                        {isOpen && rep && (
                          <tr>
                            <td colSpan={9} style={{ padding:"16px 12px", background: ACCENT_BG, borderBottom: `1px solid ${BORDER}` }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, letterSpacing: "1.5px", textTransform: "uppercase", mb: 1 }}>Breakdown</Typography>
                              {[rep.candidateSearch, rep.ats, rep.crm, rep.aiAndAgent].map(cat => cat && (
                                <Box key={cat.label} sx={{ display:"flex", justifyContent:"space-between", py:0.5, borderBottom:`1px solid ${BORDER}` }}>
                                  <Typography sx={{ fontSize:12, color: TEXT }}>{cat.label}</Typography>
                                  <Typography sx={{ fontSize:12, color: MUTED }}>
                                    {`$${(cat.currentMonthly||0).toLocaleString("en-AU")} → $${(cat.nolyvraMonthly||0).toLocaleString("en-AU")} `}
                                    <span style={{ color: SUCCESS }}>({`+$${(cat.saving||0).toLocaleString("en-AU")}`})</span>
                                  </Typography>
                                </Box>
                              ))}
                              <Box sx={{ display:"flex", justifyContent:"space-between", pt:1, mb: rep.narrative ? 1.5 : 0 }}>
                                <Typography sx={{ fontSize:12, fontWeight:600, color: TEXT }}>Annual saving est.</Typography>
                                <Typography sx={{ fontSize:12, fontWeight:700, color: SUCCESS }}>${(rep.totalAnnualisedSaving||0).toLocaleString("en-AU")}/yr</Typography>
                              </Box>
                              {rep.narrative && (
                                <Box sx={{ mt:1.5, p:1.5, bgcolor:"#fff", border:`1px solid ${BORDER}`, borderRadius:"8px" }}>
                                  <Typography sx={{ fontSize:11, fontWeight:700, color: MUTED, mb:0.5, textTransform:"uppercase", letterSpacing:"1px" }}>AI Narrative</Typography>
                                  <Typography sx={{ fontSize:12, color: TEXT, lineHeight:1.7 }}>{rep.narrative}</Typography>
                                </Box>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          )}
        </Box>
      </Paper>}

      {/* ── Session / Logout ──────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        border: `1px solid ${BORDER}`, borderRadius: "10px",
        overflow: "hidden", bgcolor: "#fff"
      }}>
        <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Session</Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Signed in as <strong>{name}</strong>
          </Typography>
        </Box>
        <Box sx={{ p: 2.25 }}>
          <Typography sx={{ fontSize: 12, color: MUTED, mb: 1.5, lineHeight: 1.6 }}>
            Logging out will end your current session. You will need to sign in again to access your data.
          </Typography>
          <Button variant="outlined" onClick={handleLogout}
            sx={{
              fontSize: 12, fontWeight: 500, borderColor: DANGER_BR, color: DANGER,
              borderRadius: "8px", textTransform: "none",
              "&:hover": { bgcolor: DANGER_BG, borderColor: DANGER }
            }}>
            ⎋ Logout
          </Button>
        </Box>
      </Paper>

    </Box>
  );
}
