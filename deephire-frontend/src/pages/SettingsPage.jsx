import { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Button, TextField,
  Alert, CircularProgress, LinearProgress
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

  // Plan usage from shared hook
  const { usage, loading: planLoading } = usePlanLimit();

  // ── Update Password state ─────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  // ── Admin panel state ─────────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [onboarding, setOnboarding] = useState(null);

  useEffect(() => {
    if (!loginId) return;
    fetch(`${API_BASE}/api/auth/admin/users?loginId=${encodeURIComponent(loginId)}`)
      .then(r => { if (r.ok) { setIsAdmin(true); return r.json(); } throw new Error(); })
      .then(d => setAdminUsers(d))
      .catch(() => setIsAdmin(false));
  }, [loginId]);

  async function handleOnboard(targetId) {
    setOnboarding(targetId);
    try {
      await fetch(`${API_BASE}/api/auth/admin/onboard?loginId=${encodeURIComponent(loginId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLoginId: targetId }),
      });
      setAdminUsers(prev => prev.map(u =>
        u.id === targetId ? { ...u, planId: "plan-free", planName: "Free" } : u));
    } catch (e) {
      console.error("Onboard failed", e);
    } finally {
      setOnboarding(null);
    }
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
        headers: { "Content-Type": "application/json" },
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
    nav("/login");
  }

  // ── Manage Subscription (Stripe Portal) ──────────────────────────────────
  const [portalLoading, setPortalLoading] = useState(false);

  async function handleManageSubscription() {
    setPortalLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/stripe/portal?` +
        `loginId=${encodeURIComponent(loginId)}` +
        `&returnUrl=${encodeURIComponent(window.location.origin + "/settings")}`,
        { method: "POST" }
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
        <Alert
          severity="success"
          onClose={() => setUpgradeSuccess(false)}
          sx={{ borderRadius: "10px", fontSize: 13 }}
        >
          🎉 Your plan has been upgraded successfully! Your new limits are now active.
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
              {usage.planName === "Free" && (
                <Box sx={{
                  display: "flex", gap: 1.25, alignItems: "center",
                  bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`,
                  borderRadius: "8px", p: "10px 14px"
                }}>
                  <Typography sx={{ fontSize: 13 }}>✦</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: PURPLE }}>
                      Upgrade to Silver or Gold
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
                      Silver: 20 jobs · 50 candidates &nbsp;|&nbsp; Gold: 100 jobs · 500 candidates
                    </Typography>
                  </Box>
                  <Button size="small" variant="contained"
                    onClick={() => nav(`/pricing?loginId=${encodeURIComponent(loginId)}`)}
                    sx={{
                      fontSize: 11, fontWeight: 600, bgcolor: PURPLE, borderRadius: "6px",
                      textTransform: "none", boxShadow: "none", flexShrink: 0,
                      "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" }
                    }}>
                    Upgrade
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
            <TextField fullWidth size="small" type="password"
              value={pwForm.currentPassword}
              onChange={e => updatePw("currentPassword", e.target.value)}
              placeholder="Enter current password"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }} />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>
              New Password
            </Typography>
            <TextField fullWidth size="small" type="password"
              value={pwForm.newPassword}
              onChange={e => updatePw("newPassword", e.target.value)}
              placeholder="Enter new password"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }} />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>
              Confirm New Password
            </Typography>
            <TextField fullWidth size="small" type="password"
              value={pwForm.confirmPassword}
              onChange={e => updatePw("confirmPassword", e.target.value)}
              placeholder="Re-enter new password"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }} />
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
                display: "flex", alignItems: "center", justifyContent: "space-between",
                px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
                "&:last-child": { borderBottom: "none" },
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexShrink: 0, ml: 2 }}>
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
            ))}
          </Box>
        </Paper>
      )}

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
