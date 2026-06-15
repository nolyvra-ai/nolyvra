import { useState, useEffect } from "react";
import { Box, Drawer, Tooltip } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

const W_FULL      = 224;
const W_COLLAPSED = 64;

const SIDEBAR_BG     = "#0F1623";
const SIDEBAR_BORDER = "rgba(255,255,255,0.06)";
const SIDEBAR_HOVER  = "rgba(255,255,255,0.06)";
const SIDEBAR_ACTIVE = "rgba(29,114,232,0.22)";
const ACCENT         = "#1D72E8";
const PURPLE         = "#7C3AED";
const TEXT_DIM       = "rgba(255,255,255,0.5)";
const TEXT_ACTIVE    = "#ffffff";
const TEXT_LABEL     = "rgba(255,255,255,0.25)";

function SectionLabel({ children, isNew = false, collapsed }) {
  if (collapsed) return <Box sx={{ height: 8 }} />;
  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 1,
      fontSize: 10, fontWeight: 600, color: TEXT_LABEL,
      letterSpacing: "0.8px", textTransform: "uppercase",
      px: 1, mb: 0.5, mt: 0.5
    }}>
      {children}
      {isNew && (
        <Box sx={{
          fontSize: 9, color: "rgba(180,160,255,0.7)", letterSpacing: ".5px",
          background: "rgba(124,58,237,0.2)", px: "5px", py: "1px",
          borderRadius: "3px", fontWeight: 700
        }}>NEW</Box>
      )}
    </Box>
  );
}

function NavItem({ to, icon, label, badge, isNew = false, collapsed }) {
  const nav = useNavigate();
  const { pathname } = useLocation();

  const active =
    pathname === to ||
    (to && to !== "/dashboard" && to !== "/jobs/new" &&
      to !== "/candidates/new-modern" && to !== "/candidates/new" && pathname.startsWith(to));

  const item = (
    <Box onClick={() => to && nav(to)} sx={{
      display: "flex", alignItems: "center",
      gap: collapsed ? 0 : "9px",
      px: collapsed ? 0 : "10px",
      py: "7px",
      justifyContent: collapsed ? "center" : "flex-start",
      borderRadius: "6px",
      cursor: to ? "pointer" : "default",
      color: active ? TEXT_ACTIVE : TEXT_DIM,
      bgcolor: active ? SIDEBAR_ACTIVE : "transparent",
      fontWeight: active ? 500 : 400, fontSize: "12.5px",
      mb: "1px", transition: "all .15s",
      "&:hover": to ? {
        bgcolor: active ? SIDEBAR_ACTIVE : SIDEBAR_HOVER,
        color: "rgba(255,255,255,0.85)"
      } : {},
      userSelect: "none",
    }}>
      <Box sx={{ width: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</Box>
      {!collapsed && <Box sx={{ flex: 1 }}>{label}</Box>}
      {!collapsed && isNew && !badge && (
        <Box sx={{
          ml: "auto", bgcolor: PURPLE, color: "#fff",
          fontSize: 9, fontWeight: 700, px: "5px", py: "1px",
          borderRadius: "10px", flexShrink: 0
        }}>NEW</Box>
      )}
      {!collapsed && badge != null && (
        <Box sx={{
          ml: "auto", bgcolor: ACCENT, color: "#fff",
          fontSize: 10, fontWeight: 600, px: "6px", py: "1px",
          borderRadius: "10px", lineHeight: 1.4, flexShrink: 0
        }}>{badge}</Box>
      )}
    </Box>
  );

  return collapsed
    ? <Tooltip title={label} placement="right" arrow>{item}</Tooltip>
    : item;
}

function Section({ label, isNew = false, collapsed, children }) {
  return (
    <Box sx={{ px: "10px", pt: "12px", pb: "4px" }}>
      <SectionLabel isNew={isNew} collapsed={collapsed}>{label}</SectionLabel>
      {children}
    </Box>
  );
}

export default function Sidebar() {
  const loginId    = localStorage.getItem("name")    || "";
  const loginIdVal = localStorage.getItem("loginId") || "";
  const [collapsed,      setCollapsed]      = useState(true);
  const [jobCount,       setJobCount]       = useState(null);
  const [candidateCount, setCandidateCount] = useState(null);

  const W = collapsed ? W_COLLAPSED : W_FULL;

  useEffect(() => {
    if (!loginIdVal) return;
    const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
    const authHeader = { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` };
    fetch(`${API_BASE}/api/jobs?loginId=${encodeURIComponent(loginIdVal)}`, { headers: authHeader })
      .then(r => r.ok ? r.json() : [])
      .then(d => setJobCount(Array.isArray(d) ? d.length : null))
      .catch(() => {});
    fetch(`${API_BASE}/api/candidates/count?loginId=${encodeURIComponent(loginIdVal)}`, { headers: authHeader })
      .then(r => r.ok ? r.json() : null)
      .then(d => setCandidateCount(typeof d?.count === "number" ? d.count : null))
      .catch(() => {});
  }, [loginIdVal]);

  return (
    <Drawer variant="permanent" sx={{
      width: W, flexShrink: 0,
      transition: "width .2s ease",
      "& .MuiDrawer-paper": {
        width: W, bgcolor: SIDEBAR_BG, color: "#fff",
        border: "none", borderRight: `1px solid ${SIDEBAR_BORDER}`,
        boxShadow: "none", display: "flex", flexDirection: "column",
        overflow: "visible", transition: "width .2s ease",
      },
    }}>

      {/* Collapse toggle — fixed at vertical middle of sidebar right edge */}
      <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"} placement="right">
        <Box onClick={() => setCollapsed(c => !c)} sx={{
          position: "absolute", right: -12, top: "50%",
          transform: "translateY(-50%)",
          width: 24, height: 24, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 1300,
          bgcolor: SIDEBAR_BG,
          border: `1px solid ${SIDEBAR_BORDER}`,
          color: TEXT_DIM,
          "&:hover": { bgcolor: ACCENT, color: "#fff", borderColor: ACCENT },
          transition: "all .15s",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}>
          <span style={{ fontSize: 10 }}>{collapsed ? "▶" : "◀"}</span>
        </Box>
      </Tooltip>

      {/* Brand */}
      <Box sx={{
        px: collapsed ? 1 : 2, py: "18px",
        borderBottom: `1px solid ${SIDEBAR_BORDER}`,
        display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        flexShrink: 0, gap: 1
      }}>
        {!collapsed && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <img src="/nolyvra_logo.png" alt="nolyvra"
              style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
            <Box>
              <Box sx={{ color: "#fff", fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>nolyvra</Box>
              <Box sx={{ fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1.2 }}>MVP v2.0</Box>
            </Box>
          </Box>
        )}
        {collapsed && (
          <img src="/nolyvra_logo.png" alt="nolyvra"
            style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
        )}
      </Box>

      {/* Nav items */}
      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", py: 0.5 }}>
        <Section label="Overview" collapsed={collapsed}>
          <NavItem to="/dashboard" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>} label="Dashboard" collapsed={collapsed} />
          <NavItem to="/reminders" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>} label="Reminders" isNew collapsed={collapsed} />
        </Section>

        <Section label="Jobs" collapsed={collapsed}>
          <NavItem to="/jobs"     icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>} label="All Jobs"    badge={jobCount}  collapsed={collapsed} />
          <NavItem to="/jobs/new" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>} label="Create Job"                   collapsed={collapsed} />
        </Section>

        <Section label="Clients" collapsed={collapsed}>
          <NavItem to="/clients" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>} label="Client Tracker" isNew collapsed={collapsed} />
        </Section>

        <Section label="Candidates" collapsed={collapsed}>
          <NavItem to="/candidates"     icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} label="All Candidates" badge={candidateCount} collapsed={collapsed} />
          <NavItem to="/candidates/new-modern" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>} label="Add Candidate"                        collapsed={collapsed} />
        </Section>

        <Section label="AI Tools" isNew collapsed={collapsed}>
          <NavItem to="/talent-search" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>} label="AI Talent Search"    isNew collapsed={collapsed} />
          <NavItem to="/coworker"      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="8.5" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="14" r="1.2" fill="currentColor" stroke="none"/><path d="M12 4v4M9 4h6"/></svg>} label="Co-worker AI"        isNew collapsed={collapsed} />
          <NavItem to="/scheduler"     icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} label="Interview Scheduler" isNew collapsed={collapsed} />
          <NavItem to="/email"         icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} label="Email Centre"        isNew collapsed={collapsed} />
        </Section>

        <Section label="Settings" collapsed={collapsed}>
          <NavItem to="/settings" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>} label="Settings" collapsed={collapsed} />
        </Section>
      </Box>

      {/* User footer */}
      <Box sx={{ px: "10px", py: "12px", borderTop: `1px solid ${SIDEBAR_BORDER}`, flexShrink: 0 }}>
        <Tooltip title={collapsed ? loginId : ""} placement="right">
          <Box sx={{
            display: "flex", alignItems: "center",
            gap: collapsed ? 0 : "9px",
            justifyContent: collapsed ? "center" : "flex-start",
            px: "10px", py: "7px", borderRadius: "6px", cursor: "pointer",
            "&:hover": { bgcolor: SIDEBAR_HOVER }, transition: "background .15s"
          }}>
            <Box sx={{
              width: 28, height: 28, borderRadius: "50%", bgcolor: ACCENT,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, flexShrink: 0
            }}>
              {loginId.slice(0, 2).toUpperCase()}
            </Box>
            {!collapsed && (
              <Box>
                <Box sx={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>
                  {loginId}
                </Box>
                <Box sx={{ color: "rgba(255,255,255,0.3)", fontSize: 10, lineHeight: 1.3 }}>Recruiter</Box>
              </Box>
            )}
          </Box>
        </Tooltip>
      </Box>
    </Drawer>
  );
}
