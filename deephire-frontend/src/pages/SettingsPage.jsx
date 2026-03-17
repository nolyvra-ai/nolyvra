import { useState } from "react";
import { Box, Paper, Typography, Button, TextField,
  Alert, CircularProgress, LinearProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { usePlanLimit } from "../hooks/usePlanLimit";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const BORDER   = "#E8ECF2", MUTED   = "#9AA3B4", TEXT    = "#0F1623", ACCENT  = "#1D72E8";
const SUCCESS  = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN     = "#D97706", WARN_BG    = "#FFFBEB", WARN_BR    = "#FDE68A";
const DANGER   = "#DC2626", DANGER_BG  = "#FEF2F2", DANGER_BR  = "#FECACA";
const PURPLE   = "#7C3AED", PURPLE_BG  = "#F5F3FF", PURPLE_BR  = "#C4B5FD";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE";
const SURFACE  = "#FAFBFD";

// ── Usage bar component ───────────────────────────────────────────────────────
function UsageBar({ label, used, max }) {
  const pct   = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
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
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color,
          borderRadius: "4px", transition: "width .3s" }} />
      </Box>
      <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>
        {max - used} {label.toLowerCase()} remaining
      </Typography>
    </Box>
  );
}

// ── Plan badge ────────────────────────────────────────────────────────────────
function PlanBadge({ name }) {
  const styles = {
    Free:   { bg: "#F1F3F7",  border: BORDER,     color: MUTED,   },
    Silver: { bg: ACCENT_BG,  border: ACCENT_BR,  color: ACCENT,  },
    Gold:   { bg: WARN_BG,    border: WARN_BR,     color: WARN,    },
  };
  const s = styles[name] ?? styles.Free;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center",
      bgcolor: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "20px", px: 1.5, py: 0.4,
      fontSize: 12, fontWeight: 700, color: s.color }}>
      {name === "Gold" ? "🏆 " : name === "Silver" ? "⭐ " : ""}
      {name} Plan
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SettingsPage() {
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";
  const name = localStorage.getItem("name") || "";

  // Plan usage from shared hook
  const { usage, loading: planLoading } = usePlanLimit();

  // ── Update Password state ─────────────────────────────────────────────────
  const [pwForm,    setPwForm]    = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving,  setPwSaving]  = useState(false);
  const [pwError,   setPwError]   = useState(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  function updatePw(k, v) {
    setPwForm(p => ({ ...p, [k]: v }));
    setPwError(null);
    setPwSuccess(false);
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
      const url = new URL(`${API_BASE}/api/auth/change-password`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword:     pwForm.newPassword,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update password.");
      }
      setPwSuccess(true);
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch(e) {
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

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 540 }}>

      {/* Page header */}
      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Settings</Typography>
        <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
          Manage your account and preferences
        </Typography>
      </Box>

      {/* ── Subscription Plan ─────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px",
        overflow: "hidden", bgcolor: "#fff" }}>
        <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
              Subscription Plan
            </Typography>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
              Your current plan and usage limits
            </Typography>
          </Box>
          {!planLoading && usage && <PlanBadge name={usage.planName} />}
        </Box>

        <Box sx={{ p: 2.25 }}>
          {planLoading ? (
            <LinearProgress sx={{ borderRadius: "4px" }} />
          ) : usage ? (
            <>
              {/* Plan limits overview */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 1.5, mb: 2, p: 1.5,
                bgcolor: SURFACE, border: `1px solid ${BORDER}`,
                borderRadius: "8px" }}>
                {[
                  { label: "Max Jobs",       value: usage.maxJobs       },
                  { label: "Max Candidates", value: usage.maxCandidates },
                ].map(item => (
                  <Box key={item.label}>
                    <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                      textTransform: "uppercase", letterSpacing: ".5px" }}>
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
                <UsageBar label="Jobs"       used={usage.currentJobs}       max={usage.maxJobs} />
                <UsageBar label="Candidates" used={usage.currentCandidates} max={usage.maxCandidates} />
              </Box>

              {/* Upgrade nudge for Free plan */}
              {usage.planName === "Free" && (
                <Box sx={{ display: "flex", gap: 1.25, alignItems: "center",
                  bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`,
                  borderRadius: "8px", p: "10px 14px" }}>
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
                    sx={{ fontSize: 11, fontWeight: 600, bgcolor: PURPLE, borderRadius: "6px",
                      textTransform: "none", boxShadow: "none", flexShrink: 0,
                      "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" } }}>
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
      <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px",
        overflow: "hidden", bgcolor: "#fff" }}>
        <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
            Update Password
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Choose a strong password of at least 6 characters
          </Typography>
        </Box>
        <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>

          {pwError   && <Alert severity="error"   onClose={() => setPwError(null)}>{pwError}</Alert>}
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
            sx={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 500,
              bgcolor: ACCENT, borderRadius: "8px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            {pwSaving
              ? <CircularProgress size={14} sx={{ color: "#fff" }} />
              : "Update Password"}
          </Button>
        </Box>
      </Paper>

      {/* ── Session / Logout ──────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px",
        overflow: "hidden", bgcolor: "#fff" }}>
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
            sx={{ fontSize: 12, fontWeight: 500, borderColor: DANGER_BR, color: DANGER,
              borderRadius: "8px", textTransform: "none",
              "&:hover": { bgcolor: DANGER_BG, borderColor: DANGER } }}>
            ⎋ Logout
          </Button>
        </Box>
      </Paper>

    </Box>
  );
}
