import { Box, Drawer } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

const W = 224;

const SIDEBAR_BG     = "#0F1623";
const SIDEBAR_BORDER = "rgba(255,255,255,0.06)";
const SIDEBAR_HOVER  = "rgba(255,255,255,0.06)";
const SIDEBAR_ACTIVE = "rgba(29,114,232,0.22)";
const ACCENT         = "#1D72E8";
const PURPLE         = "#7C3AED";
const TEXT_DIM       = "rgba(255,255,255,0.5)";
const TEXT_ACTIVE    = "#ffffff";
const TEXT_LABEL     = "rgba(255,255,255,0.25)";

function SectionLabel({ children, isNew = false }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1,
      fontSize: 10, fontWeight: 600, color: TEXT_LABEL,
      letterSpacing: "0.8px", textTransform: "uppercase",
      px: 1, mb: 0.5, mt: 0.5 }}>
      {children}
      {isNew && (
        <Box sx={{ fontSize: 9, color: "rgba(180,160,255,0.7)", letterSpacing: ".5px",
          background: "rgba(124,58,237,0.2)", px: "5px", py: "1px",
          borderRadius: "3px", fontWeight: 700 }}>
          NEW
        </Box>
      )}
    </Box>
  );
}

function NavItem({ to, icon, label, badge, isNew = false }) {
  const nav = useNavigate();
  const { pathname } = useLocation();

  const active =
    pathname === to ||
    (to && to !== "/dashboard" && to !== "/jobs/new" &&
     to !== "/candidates/new" && pathname.startsWith(to));

  return (
    <Box onClick={() => to && nav(to)} sx={{
      display: "flex", alignItems: "center", gap: "9px",
      px: "10px", py: "7px", borderRadius: "6px",
      cursor: to ? "pointer" : "default",
      color: active ? TEXT_ACTIVE : TEXT_DIM,
      bgcolor: active ? SIDEBAR_ACTIVE : "transparent",
      fontWeight: active ? 500 : 400, fontSize: "12.5px",
      mb: "1px", transition: "all .15s",
      "&:hover": to ? { bgcolor: active ? SIDEBAR_ACTIVE : SIDEBAR_HOVER,
        color: "rgba(255,255,255,0.85)" } : {},
      userSelect: "none",
    }}>
      <Box sx={{ width: 15, textAlign: "center", fontSize: 13, flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>{label}</Box>
      {isNew && !badge && (
        <Box sx={{ ml: "auto", bgcolor: PURPLE, color: "#fff",
          fontSize: 9, fontWeight: 700, px: "5px", py: "1px",
          borderRadius: "10px", flexShrink: 0 }}>
          NEW
        </Box>
      )}
      {badge != null && (
        <Box sx={{ ml: "auto", bgcolor: ACCENT, color: "#fff",
          fontSize: 10, fontWeight: 600, px: "6px", py: "1px",
          borderRadius: "10px", lineHeight: 1.4, flexShrink: 0 }}>
          {badge}
        </Box>
      )}
    </Box>
  );
}

function Section({ label, isNew = false, children }) {
  return (
    <Box sx={{ px: "10px", pt: "12px", pb: "4px" }}>
      <SectionLabel isNew={isNew}>{label}</SectionLabel>
      {children}
    </Box>
  );
}

export default function Sidebar() {
  const loginId = localStorage.getItem("name") || "";
  return (
    <Drawer variant="permanent" sx={{
      width: W, flexShrink: 0,
      "& .MuiDrawer-paper": {
        width: W, bgcolor: SIDEBAR_BG, color: "#fff",
        border: "none", borderRight: `1px solid ${SIDEBAR_BORDER}`,
        boxShadow: "none", display: "flex", flexDirection: "column", overflow: "hidden",
      },
    }}>
      {/* Brand */}
      <Box sx={{ px: 2, py: "18px", borderBottom: `1px solid ${SIDEBAR_BORDER}`,
        display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
        <Box sx={{ width: 26, height: 26, bgcolor: ACCENT, borderRadius: "6px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>IQ</Box>
        <Box>
          <Box sx={{ color: "#fff", fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>DeepHire</Box>
          <Box sx={{ fontSize: 9, color: "rgba(255,255,255,0.3)", lineHeight: 1.2 }}>MVP v2.0</Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", py: 0.5 }}>

        <Section label="Overview">
          <NavItem to="/dashboard"        icon="⊞"  label="Dashboard" />
          <NavItem to="/reminders"        icon="🔔" label="Reminders" isNew />
        </Section>

        <Section label="Jobs">
          <NavItem to="/jobs"             icon="📋" label="All Jobs"      badge={3} />
          <NavItem to="/jobs/new"         icon="＋"  label="Create Job" />
        </Section>

        <Section label="Candidates">
          <NavItem to="/candidates"       icon="👤" label="All Candidates" badge={9} />
          <NavItem to="/candidates/new"   icon="＋"  label="Add Candidate" />
        </Section>

        <Section label="AI Tools" isNew>
          <NavItem to="/talent-search"    icon="🔍" label="AI Talent Search" isNew />
          <NavItem to="/coworker"         icon="🤖" label="Co-worker AI"     isNew />
          <NavItem to="/scheduler"        icon="📅" label="Interview Scheduler" isNew />
          <NavItem to="/email"            icon="✉"  label="Email Centre" isNew />
        </Section>

        <Section label="Settings">
          <NavItem to="/settings" icon="⚙" label="Settings" />
        </Section>
      </Box>

      {/* User footer */}
      <Box sx={{ px: "10px", py: "12px", borderTop: `1px solid ${SIDEBAR_BORDER}`, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "9px",
          px: "10px", py: "7px", borderRadius: "6px", cursor: "pointer",
          "&:hover": { bgcolor: SIDEBAR_HOVER }, transition: "background .15s" }}>
          <Box sx={{ width: 28, height: 28, borderRadius: "50%", bgcolor: ACCENT,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            {loginId.slice(0, 2).toUpperCase()}
          </Box>
          <Box>
            <Box sx={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>
              {loginId}
            </Box>
            <Box sx={{ color: "rgba(255,255,255,0.3)", fontSize: 10, lineHeight: 1.3 }}>Recruiter</Box>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}
