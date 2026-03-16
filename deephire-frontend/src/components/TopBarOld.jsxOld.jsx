import { Box } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

// ─── Style tokens ─────────────────────────────────────────────────────────────
const BG = "#0F1623";
const ACCENT = "#1D72E8";
const BORDER = "rgba(255,255,255,0.05)";

// ─── Page pill definitions ────────────────────────────────────────────────────
const PILLS = [
  { num: "①", label: "Dashboard", to: "/dashboard" },
  { num: "②", label: "Jobs List", to: "/jobs" },
  { num: "③", label: "Create Job", to: "/jobs/new" },
  { num: "④", label: "Candidates List", to: "/candidates" },
  { num: "⑤", label: "Add Candidate", to: "/candidates/new" },
  { num: "⑥", label: "Analysis Result", to: null }, // no direct route
];

// ─── Single pill ──────────────────────────────────────────────────────────────
function NavPill({ num, label, to, active }) {
  const nav = useNavigate();
  return (
    <Box
      onClick={() => to && nav(to)}
      sx={{
        px: "13px",
        py: "4px",
        borderRadius: "20px",
        fontSize: 11,
        fontWeight: active ? 600 : 500,
        cursor: to ? "pointer" : "default",
        color: active ? "#fff" : "rgba(255,255,255,0.45)",
        bgcolor: active ? ACCENT : "transparent",
        border: `1px solid ${active ? ACCENT : "transparent"}`,
        whiteSpace: "nowrap",
        transition: "all .15s",
        userSelect: "none",
        "&:hover": to && !active
          ? { color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.1)" }
          : {},
      }}
    >
      {num} {label}
    </Box>
  );
}

// ─── Separator arrow ─────────────────────────────────────────────────────────
function Arrow() {
  return (
    <Box
      component="span"
      sx={{ fontSize: 10, color: "rgba(255,255,255,0.18)", lineHeight: 1, userSelect: "none" }}
    >
      ›
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TopBar() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const loginId = localStorage.getItem("name") || "";

  function handleLogout() {
    localStorage.removeItem("loginId");
    nav("/login");
  }

  // Determine which pill is active based on current route
  function isActive(pill) {
    if (!pill.to) return pathname.includes("/analysis");
    if (pill.to === "/dashboard") return pathname === "/" || pathname === "/dashboard";
    if (pill.to === "/jobs") return pathname === "/jobs";
    if (pill.to === "/jobs/new") return pathname === "/jobs/new";
    if (pill.to === "/candidates") return pathname === "/candidates";
    if (pill.to === "/candidates/new") return pathname === "/candidates/new";
    return pathname.startsWith(pill.to);
  }

  return (
    <Box
      sx={{
        bgcolor: BG,
        borderBottom: `1px solid ${BORDER}`,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        px: "14px",
        py: "7px",
        flexShrink: 0,
        minHeight: 42,
      }}
    >
      {/* ── Brand ────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mr: 2,
          flexShrink: 0,
        }}
      >
        {/* IQ icon tile */}
        <Box
          sx={{
            width: 26,
            height: 26,
            bgcolor: ACCENT,
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#fff",
            flexShrink: 0,
          }}
        >
          IQ
        </Box>
        <Box>
          <Box
            sx={{
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.3px",
              lineHeight: 1.2,
            }}
          >
            DeepHire
          </Box>
          <Box
            sx={{
              fontSize: 9,
              color: "rgba(255,255,255,0.3)",
              letterSpacing: "0.5px",
              lineHeight: 1.2,
            }}
          >
            MVP v0.1
          </Box>
        </Box>
      </Box>

      {/* ── Divider ──────────────────────────────────────────────────── */}
      <Box
        component="span"
        sx={{ fontSize: 14, color: "rgba(255,255,255,0.15)", mr: 0.5, userSelect: "none" }}
      >
        │
      </Box>

      {/* ── Pages label ──────────────────────────────────────────────── */}
      <Box
        component="span"
        sx={{
          fontSize: 10,
          color: "rgba(255,255,255,0.25)",
          mr: "4px",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        PAGES:
      </Box>

      {/* ── Nav pills ────────────────────────────────────────────────── */}
      {PILLS.map((pill, i) => (
        <Box key={pill.label} sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <NavPill
            num={pill.num}
            label={pill.label}
            to={pill.to}
            active={isActive(pill)}
          />
          {i < PILLS.length - 1 && <Arrow />}
        </Box>
      ))}

      {/* ── Logout button ────────────────────────────────────────────── */}
      <Box
        onClick={handleLogout}
        sx={{
          ml: "auto",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          px: "12px",
          py: "4px",
          borderRadius: "20px",
          border: `1px solid ${ACCENT}`,
          color: ACCENT,
          fontSize: 11,
          fontWeight: 500,
          cursor: "pointer",
          userSelect: "none",
          flexShrink: 0,
          transition: "all .15s",
          "&:hover": {
            borderColor: "#3D8EFF",
            color: "#3D8EFF",
          },
        }}
      >
        <Box component="span" sx={{ color: "rgba(255,255,255,0.25)", mr: "4px" }}>
          {loginId}
        </Box>
        ⎋ Logout
      </Box>

      {/* ── Hint (right-aligned) ─────────────────────────────────────── */}
      <Box
        sx={{
          ml: 2,
          fontSize: 10,
          color: "rgba(255,255,255,0.2)",
          whiteSpace: "nowrap",
          userSelect: "none",
          flexShrink: 0,
        }}
      >
        ← click any tab or sidebar link to switch pages
      </Box>
    </Box>
  );
}
