import { Box } from "@mui/material";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BG     = "#0F1623";
const ACCENT = "#1D72E8";
const PURPLE = "#7C3AED";
const BORDER = "rgba(255,255,255,0.05)";

const PILLS = [
  { num: "①", label: "Dashboard",          to: "/dashboard" },
  { num: "②", label: "Jobs List",           to: "/jobs" },
  { num: "③", label: "Create Job",          to: "/jobs/new" },
  { num: "④", label: "Candidates",          to: "/candidates" },
  { num: "⑤", label: "Add Candidate",       to: "/candidates/new-modern" },
  { num: "⑥", label: "Analysis",            to: null },
  { num: "⑦", label: "AI Talent Search ✦",  to: "/talent-search",  isNew: true },
  { num: "⑧", label: "Candidate Workflow ✦",to: null,               isNew: true },
  { num: "⑨", label: "Scheduler ✦",         to: "/scheduler",      isNew: true },
  { num: "⑩", label: "Email ✦",             to: "/email",          isNew: true },
  { num: "⑪", label: "Reminders ✦",         to: "/reminders",      isNew: true },
];

function NavPill({ num, label, to, active, isNew }) {
  const nav = useNavigate();
  const activeBg    = isNew ? PURPLE : ACCENT;
  const inactiveBg  = isNew ? "rgba(124,58,237,0.2)" : "transparent";
  const inactiveColor = isNew ? "rgba(200,180,255,0.8)" : "rgba(255,255,255,0.45)";
  const inactiveBorder = isNew ? "rgba(124,58,237,0.5)" : "transparent";

  return (
    <Box onClick={() => to && nav(to)} sx={{
      px: "11px", py: "4px", borderRadius: "20px",
      fontSize: 11, fontWeight: active ? 600 : 500,
      cursor: to ? "pointer" : "default",
      color: active ? "#fff" : inactiveColor,
      bgcolor: active ? activeBg : inactiveBg,
      border: `1px solid ${active ? activeBg : inactiveBorder}`,
      whiteSpace: "nowrap", transition: "all .15s", userSelect: "none", flexShrink: 0,
      "&:hover": to && !active ? {
        color: "rgba(255,255,255,0.9)",
        borderColor: isNew ? "rgba(124,58,237,0.8)" : "rgba(255,255,255,0.15)",
      } : {},
    }}>
      {num} {label}
    </Box>
  );
}

function Arrow() {
  return (
    <Box component="span" sx={{
      fontSize: 10, color: "rgba(255,255,255,0.18)",
      lineHeight: 1, userSelect: "none", flexShrink: 0,
    }}>›</Box>
  );
}

export default function TopBar() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const loginId = localStorage.getItem("name") || "";

  const [tokens, setTokens] = useState(null);

  useEffect(() => {
    const id = localStorage.getItem("loginId") || "";
    if (!id) return;
    fetch(`${API_BASE}/api/plans/me?loginId=${encodeURIComponent(id)}`, { headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setTokens(d.tokensRemaining); })
      .catch(() => {});
  }, [pathname]); // refresh on every navigation

  function handleLogout() {
    localStorage.removeItem("loginId");
    nav("/login");
  }

  function isActive(pill) {
    if (!pill.to) {
      if (pill.num === "⑥") return pathname.includes("/analysis");
      if (pill.num === "⑧") return pathname.includes("/workflow");
      return false;
    }
    if (pill.to === "/dashboard") return pathname === "/" || pathname === "/dashboard";
    if (pill.to === "/jobs")      return pathname === "/jobs";
    if (pill.to === "/jobs/new")  return pathname === "/jobs/new";
    if (pill.to === "/candidates")     return pathname === "/candidates";
    if (pill.to === "/candidates/new-modern") return pathname === "/candidates/new-modern" || pathname === "/candidates/new";
    return pathname.startsWith(pill.to);
  }

  return (
    <Box sx={{
      bgcolor: BG, borderBottom: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", gap: "5px",
      px: "14px", py: "7px", flexShrink: 0, minHeight: 42,
      overflowX: "auto",
      "&::-webkit-scrollbar": { display: "none" },
      scrollbarWidth: "none",
    }}>
      {/* Brand */}
    {/*  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 1.5, flexShrink: 0 }}>
        <Box sx={{ width: 26, height: 26, bgcolor: ACCENT, borderRadius: "6px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>IQ</Box>
        <Box>
          <Box sx={{ color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: "-0.3px", lineHeight: 1.2 }}>
            nolyvra
          </Box>
          <Box sx={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px", lineHeight: 1.2 }}>
            MVP v2.0
          </Box>
        </Box>
      </Box> */} 

      <Box component="span" sx={{ fontSize: 14, color: "rgba(255,255,255,0.15)", mr: 0.5, userSelect: "none", flexShrink: 0 }}>│</Box>
      <Box component="span" sx={{ fontSize: 10, color: "rgba(255,255,255,0.25)", mr: "4px", whiteSpace: "nowrap", userSelect: "none", flexShrink: 0 }}>
        PAGES:
      </Box>

      {PILLS.map((pill, i) => (
        <Box key={pill.label} sx={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <NavPill num={pill.num} label={pill.label} to={pill.to} active={isActive(pill)} isNew={pill.isNew} />
          {i < PILLS.length - 1 && <Arrow />}
        </Box>
      ))}

      {/* Token balance pill */}
      {tokens !== null && (
        <Box sx={{
          ml: "auto", display: "flex", alignItems: "center", gap: "5px",
          px: "10px", py: "4px", borderRadius: "20px", flexShrink: 0,
          border: `1px solid ${tokens < 30 ? "#DC2626" : tokens < 100 ? "#D97706" : "rgba(124,58,237,0.6)"}`,
          color: tokens < 30 ? "#FF6B6B" : tokens < 100 ? "#FBB040" : "rgba(200,180,255,0.85)",
          fontSize: 11, fontWeight: 600, userSelect: "none",
        }}>
          ✦ {tokens} tokens
        </Box>
      )}

      {/* Logout */}
      <Box onClick={handleLogout} sx={{
        ml: tokens !== null ? "8px" : "auto",
        display: "flex", alignItems: "center", gap: "6px",
        px: "12px", py: "4px", borderRadius: "20px",
        border: `1px solid ${ACCENT}`, color: ACCENT,
        fontSize: 11, fontWeight: 500, cursor: "pointer",
        userSelect: "none", flexShrink: 0, transition: "all .15s",
        "&:hover": { borderColor: "#3D8EFF", color: "#3D8EFF" },
      }}>
        <Box component="span" sx={{ color: "rgba(255,255,255,0.25)", mr: "4px" }}>{loginId}</Box>
        ⎋ Logout
      </Box>
    </Box>
  );
}
