import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Button, Alert, InputBase,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`${res.status} - ${t}`); }
  return res.json();
}

// ── Palette ────────────────────────────────────────────────────────────────
const SURFACE  = "#FFFFFF";
const BORDER   = "#E8ECF2";
const MUTED    = "#8A94A6";
const TEXT     = "#0F1623";
const ACCENT   = "#1D72E8";
const SUCCESS  = "#16A34A";
const WARN     = "#D97706";
const DANGER   = "#DC2626";
const PURPLE   = "#7C3AED";
const ACCENT_L  = "#EFF6FF";
const SUCCESS_L = "#F0FDF4";
const WARN_L    = "#FFFBEB";
const DANGER_L  = "#FEF2F2";
const PURPLE_L  = "#F5F3FF";
const PURPLE_BR = "#C4B5FD";

// ── KPI icons ──────────────────────────────────────────────────────────────
function IcoBriefcase({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  );
}
function IcoUsers({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IcoTrend({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  );
}
function IcoShield({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
function IcoBell() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

// ── Reminder icons ─────────────────────────────────────────────────────────
function IcoClock({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IcoCalendar({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IcoPeople({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IcoDoc({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IcoSpark({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
  );
}

// ── Shared card shell ──────────────────────────────────────────────────────
const CARD_BASE = {
  bgcolor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: "12px",
  boxShadow: "0 1px 4px rgba(15,22,35,0.05)",
  overflow: "hidden",
};

function Card({ children, sx = {} }) {
  return <Paper elevation={0} sx={{ ...CARD_BASE, ...sx }}>{children}</Paper>;
}

function CardHead({ title, action, isNew = false }) {
  return (
    <Box sx={{
      px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</Typography>
        {isNew && (
          <Box sx={{
            fontSize: 9, fontWeight: 700, color: PURPLE, bgcolor: PURPLE_L,
            border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", px: "6px", py: "2px",
          }}>NEW</Box>
        )}
      </Box>
      {action}
    </Box>
  );
}

function GhostBtn({ onClick, children }) {
  return (
    <Box onClick={onClick} sx={{
      fontSize: 12, fontWeight: 600, color: ACCENT,
      cursor: "pointer", userSelect: "none",
      "&:hover": { textDecoration: "underline" },
    }}>{children}</Box>
  );
}

// ── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, subColor, iconBg, icon }) {
  return (
    <Paper elevation={0} sx={{ ...CARD_BASE, p: 2.25, display: "flex", alignItems: "flex-start", gap: 2 }}>
      <Box sx={{
        width: 46, height: 46, borderRadius: "11px", bgcolor: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{
          fontSize: 10, fontWeight: 700, color: MUTED,
          textTransform: "uppercase", letterSpacing: "0.55px",
        }}>{label}</Typography>
        <Typography sx={{ fontSize: 30, fontWeight: 800, color: TEXT, lineHeight: 1.15, mt: 0.25 }}>
          {value ?? 0}
        </Typography>
        {sub && (
          <Typography sx={{ fontSize: 11, color: subColor ?? MUTED, mt: 0.2 }}>{sub}</Typography>
        )}
      </Box>
    </Paper>
  );
}

// ── Badge ──────────────────────────────────────────────────────────────────
function Badge({ label, variant = "neutral" }) {
  const styles = {
    success: { bg: SUCCESS_L, border: "#BBF7D0", color: SUCCESS },
    warning: { bg: WARN_L,    border: "#FDE68A", color: WARN    },
    danger:  { bg: DANGER_L,  border: "#FECACA", color: DANGER  },
    accent:  { bg: ACCENT_L,  border: "#BFDBFE", color: ACCENT  },
    neutral: { bg: "#F1F3F7", border: BORDER,    color: MUTED   },
    purple:  { bg: PURPLE_L,  border: PURPLE_BR, color: PURPLE  },
    urgent:  { bg: DANGER,    border: DANGER,    color: "#fff"  },
  };
  const s = styles[variant] ?? styles.neutral;
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "20px", px: 1.25, py: "2px",
      fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap",
    }}>{label}</Box>
  );
}

// ── Table header cell style ────────────────────────────────────────────────
const thSx = {
  fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
  letterSpacing: "0.5px", borderBottom: `1px solid ${BORDER}`,
  bgcolor: "#FAFBFD", py: 1.25, px: 2.5, whiteSpace: "nowrap",
};

// ── Score cell ─────────────────────────────────────────────────────────────
function ScoreCell({ value }) {
  if (!value) return <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>;
  const color = value >= 85 ? SUCCESS : value >= 70 ? WARN : DANGER;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color, minWidth: 34 }}>{value}%</Typography>
      <Box sx={{ width: 56, height: 4, bgcolor: "#F0F2F6", borderRadius: "2px", overflow: "hidden" }}>
        <Box sx={{ width: `${value}%`, height: "100%", bgcolor: color, borderRadius: "2px" }} />
      </Box>
    </Box>
  );
}

// ── Pipeline bar ───────────────────────────────────────────────────────────
function PipelineBar({ label, count, pct, color }) {
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
        <Typography sx={{ fontSize: 11.5, color: TEXT }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{count}</Typography>
      </Box>
      <Box sx={{ height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: "3px", transition: "width 0.4s ease" }} />
      </Box>
    </Box>
  );
}

// ── AI Prompt Card (Change 1) ──────────────────────────────────────────────
function AiPromptCard({ onAsk }) {
  const [input, setInput] = useState("");
  const nav = useNavigate();

  function handleAsk() {
    const q = input.trim();
    if (!q) return;
    nav("/coworker", { state: { prefillMessage: q } });
  }

  return (
    <Paper elevation={0} sx={{
      background: "linear-gradient(135deg, #EEF4FF 0%, #F0EEFF 100%)",
      border: `1px solid #D4E2FF`,
      borderRadius: "16px",
      p: 3,
      display: "flex", flexDirection: "column", gap: 1.5,
    }}>
      {/* Icon */}
      <Box sx={{
        width: 44, height: 44, borderRadius: "50%",
        bgcolor: SURFACE, display: "flex", alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 8px rgba(29,114,232,0.12)",
      }}>
        <IcoSpark color={ACCENT} />
      </Box>

      {/* Heading */}
      <Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>
          Ready To Find Top Candidates Or Revisit Your Pipeline?
        </Typography>
        <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.5 }}>
          Use AI to analyze and match the best talent for your roles
        </Typography>
      </Box>

      {/* Input row */}
      <Box
        onClick={() => document.getElementById("ai-prompt-input").focus()}
        sx={{
          display: "flex", alignItems: "center", gap: 1,
          bgcolor: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: "10px", px: 1.75, py: 0.75,
          cursor: "text", mt: 0.5,
          boxShadow: "0 1px 3px rgba(15,22,35,0.06)",
          transition: "border-color .15s, box-shadow .15s",
          "&:focus-within": {
            borderColor: ACCENT,
            boxShadow: "0 0 0 3px rgba(29,114,232,0.08)",
          },
        }}>
        <InputBase
          id="ai-prompt-input"
          fullWidth
          placeholder="Ask me anything..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAsk()}
          sx={{
            fontSize: 13, color: ACCENT, fontWeight: 500,
            "& input::placeholder": { color: ACCENT, opacity: 0.7 },
          }}
        />
        {input.trim() && (
          <Button size="small" variant="contained" onClick={handleAsk}
            sx={{
              fontSize: 11, fontWeight: 600, bgcolor: ACCENT, borderRadius: "6px",
              textTransform: "none", boxShadow: "none", flexShrink: 0,
              "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
            }}>
            Ask
          </Button>
        )}
      </Box>
    </Paper>
  );
}

// ── Reminder row (Change 2) ────────────────────────────────────────────────
function ReminderRow({ reminder, isFirst }) {
  const now = new Date();
  const dueDate = new Date(reminder.dueAt);
  const nudgeTypes = ["AUTO_SCREENING_STUCK", "AUTO_ANALYSIS_PENDING"];
  const isNudge   = nudgeTypes.includes(reminder.reminderType);
  const isOverdue = !isNudge && dueDate < now;
  const isUpcoming = reminder.reminderType === "AUTO_INTERVIEW_UPCOMING";

  // Icon and color based on type
  let iconColor = ACCENT;
  let iconBg = ACCENT_L;
  let IconEl = <IcoCalendar color={iconColor} />;

  if (isOverdue) {
    iconColor = DANGER; iconBg = DANGER_L;
    IconEl = <IcoClock color={iconColor} />;
  } else if (isUpcoming) {
    iconColor = ACCENT; iconBg = ACCENT_L;
    IconEl = <IcoCalendar color={iconColor} />;
  } else if (isNudge) {
    iconColor = PURPLE; iconBg = PURPLE_L;
    IconEl = <IcoPeople color={iconColor} />;
  } else {
    iconColor = ACCENT; iconBg = ACCENT_L;
    IconEl = <IcoDoc color={iconColor} />;
  }

  // Subtitle
  let subtitle;
  if (isOverdue) {
    subtitle = "Overdue";
  } else if (isUpcoming) {
    const h = Math.round((dueDate - now) / 3600000);
    subtitle = h <= 0 ? "In less than 1 hour" : h === 1 ? "In 1 hour" : `In ${h} hours`;
  } else {
    const isToday = dueDate.toDateString() === now.toDateString();
    const isTomorrow = dueDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();
    if (isToday) {
      subtitle = "Today at " + dueDate.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
    } else if (isTomorrow) {
      subtitle = "Tomorrow at " + dueDate.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
    } else {
      const diffDays = Math.round((dueDate - now) / 86400000);
      subtitle = diffDays > 0 ? `Due in ${diffDays} day${diffDays !== 1 ? "s" : ""}` :
        dueDate.toLocaleDateString("en-GB", { weekday: "long", hour: "numeric", minute: "2-digit" });
    }
  }

  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 1.75,
      px: 2, py: 1.5,
      bgcolor: isOverdue ? "#FFF5F5" : SURFACE,
      borderRadius: "10px",
      border: isOverdue ? `1px solid #FECACA` : `1px solid transparent`,
      transition: "background .12s",
      "&:hover": { bgcolor: isOverdue ? "#FFF0F0" : "#F8F9FB" },
    }}>
      {/* Icon bubble */}
      <Box sx={{
        width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
        bgcolor: iconBg, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {IconEl}
      </Box>

      {/* Text */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: 13, fontWeight: 600, color: TEXT,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {reminder.title}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.2 }}>
          {subtitle}
        </Typography>
      </Box>

      {/* Urgency badge */}
      {isOverdue && <Badge label="Urgent" variant="urgent" />}
    </Box>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const nav     = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";
  const name    = localStorage.getItem("name") || "";

  const [recentJobs,          setRecentJobs]          = useState([]);
  const [recentAnalyses,      setRecentAnalyses]      = useState([]);
  const [reminders,           setReminders]           = useState([]);
  const [candidateCountByJob, setCandidateCountByJob] = useState({});
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState(null);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;

    async function load() {
      try {
        const [jobs, analyses, rems] = await Promise.all([
          apiGet("/api/jobs"),
          apiGet("/api/analyses/recent"),
          apiGet("/api/reminders?filter=today"),
        ]);
        if (cancelled) return;

        const jobList = jobs ?? [];
        const countMap = {};
        await Promise.all(
          jobList.map(async (j) => {
            try {
              const cands = await apiGet(`/api/jobs/${j.id}/candidates`);
              countMap[j.id] = (cands ?? []).length;
            } catch {
              countMap[j.id] = 0;
            }
          })
        );
        if (cancelled) return;

        setRecentJobs(jobList.slice(0, 6));
        setRecentAnalyses(analyses ?? []);
        setReminders(rems ?? []);
        setCandidateCountByJob(countMap);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [loginId]);

  const todayTasks  = reminders.filter(r => !r.isCompleted);
  const jobTitleMap = useMemo(() => Object.fromEntries(recentJobs.map(j => [j.id, j.title])), [recentJobs]);
  const high   = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) >= 80).length;
  const medium = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) >= 60 && (a?.capabilityScore ?? 0) < 80).length;
  const low    = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) < 60).length;
  const total  = recentAnalyses.length || 1;

  const now       = new Date();
  const hour      = now.getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = name.split(" ")[0] || "there";
  const dateStr   = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  function handleExportPdf() {
    const styleId = "dashboard-print-style";
    document.getElementById(styleId)?.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @media print {
        @page { margin: 14mm 12mm; size: A4 portrait; }
        body * { visibility: hidden; }
        #dashboard-print-root, #dashboard-print-root * { visibility: visible; }
        #dashboard-print-root { position: absolute; left: 0; top: 0; width: 100%; overflow: visible !important; background: #fff; }
        #dashboard-print-root .MuiPaper-root { box-shadow: none !important; border: 1px solid #E8ECF2 !important; break-inside: avoid; }
        #dashboard-print-root button { visibility: hidden; }
      }
    `;
    document.head.appendChild(style);
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => document.getElementById(styleId)?.remove(), 1500);
    });
  }

  return (
    <Box id="dashboard-print-root" sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {error && <Alert severity="error" sx={{ mb: 0.5 }}>{error}</Alert>}

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>
            {greeting}, {firstName}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.3 }}>{dateStr}</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button variant="outlined" size="small" onClick={() => nav("/reminders")}
            sx={{ fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
              borderRadius: "7px", textTransform: "none", gap: 0.5,
              "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" } }}>
            <IcoBell />
            Reminders
            {todayTasks.length > 0 && (
              <Box sx={{
                bgcolor: DANGER, color: "#fff", borderRadius: "10px",
                px: "5px", py: "1px", fontSize: 9, fontWeight: 700, lineHeight: 1.4,
              }}>{todayTasks.length}</Box>
            )}
          </Button>
          <Button variant="outlined" size="small" onClick={handleExportPdf}
            sx={{ fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
              borderRadius: "7px", textTransform: "none",
              "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" } }}>
            Export PDF
          </Button>
          <Button variant="contained" size="small" onClick={() => nav("/jobs/new")}
            sx={{ fontSize: 11, fontWeight: 600, bgcolor: ACCENT, borderRadius: "7px",
              textTransform: "none", boxShadow: "none",
              "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            + New Job
          </Button>
        </Box>
      </Box>

      {/* KPI row */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
        <KpiCard label="Active Jobs" value={recentJobs.length} sub="Current openings"
          iconBg={ACCENT_L} icon={<IcoBriefcase color={ACCENT} />} />
        <KpiCard label="Total Candidates" value={recentAnalyses.length} sub="Across all jobs"
          iconBg={PURPLE_L} icon={<IcoUsers color={PURPLE} />} />
        <KpiCard label="Analyses Run" value={recentAnalyses.length} sub="AI-scored profiles"
          iconBg={SUCCESS_L} icon={<IcoTrend color={SUCCESS} />} />
        <KpiCard label="High-Risk Flags"
          value={recentAnalyses.filter(a => a?.riskLevel === "High").length}
          sub="Needs review" subColor={DANGER}
          iconBg={DANGER_L} icon={<IcoShield color={DANGER} />} />
      </Box>

      {/* ── Change 1: AI Prompt Card ── */}
      <AiPromptCard />

      {/* Middle row: Jobs + Analyses (left) | Reminders + Pipeline + Risk (right) */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "stretch" }}>

        {/* LEFT column — Recent Jobs + Recent Candidate Analyses */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>

          {/* Recent Jobs cards */}
          <Card>
            <CardHead title="Recent Jobs"
              action={<GhostBtn onClick={() => nav("/jobs")}>View All →</GhostBtn>} />
            <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              {recentJobs.map(j => (
                <Box key={j.id} onClick={() => nav("/jobs")} sx={{
                  border: `1px solid ${BORDER}`, borderRadius: "12px",
                  p: 2.25, cursor: "pointer", bgcolor: SURFACE,
                  transition: "box-shadow .15s, border-color .15s",
                  "&:hover": { boxShadow: "0 4px 16px rgba(15,22,35,0.08)", borderColor: "#C8D4E8" },
                }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.75 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT, lineHeight: 1.3, flex: 1, pr: 1 }}>
                      {j.title}
                    </Typography>
                    <Box sx={{
                      display: "flex", alignItems: "center", gap: 0.5,
                      bgcolor: "#F1F3F7", borderRadius: "20px", px: 1.25, py: 0.4, flexShrink: 0,
                    }}>
                      <IcoUsers color={MUTED} />
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: MUTED }}>
                        {candidateCountByJob[j.id] ?? 0}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: 12, color: MUTED, mb: 1.25 }}>
                    {j.company || "—"}&nbsp;·&nbsp;{j.jobType || "Full-time"}
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
                    <Badge
                      label={j.status ?? "Active"}
                      variant={j.status === "Complete" ? "neutral" : j.status === "Fulfilling" ? "warning" : "success"}
                    />
                    {(j.stackTags ?? []).slice(0, 2).map(tag => (
                      <Box key={tag} sx={{
                        bgcolor: "#F1F3F7", border: `1px solid ${BORDER}`,
                        borderRadius: "6px", px: 1, py: "2px",
                        fontSize: 11, fontWeight: 500, color: MUTED,
                      }}>{tag}</Box>
                    ))}
                  </Box>
                </Box>
              ))}
              {!loading && recentJobs.length === 0 && (
                <Box sx={{ gridColumn: "1 / -1", py: 4, textAlign: "center" }}>
                  <Typography sx={{ fontSize: 12, color: MUTED }}>
                    No jobs yet — create your first job to get started.
                  </Typography>
                </Box>
              )}
            </Box>
          </Card>

          {/* Recent Candidate Analyses — fills remaining height to align with sidebar */}
          <Card sx={{ flex: 1 }}>
            <CardHead title="Recent Candidate Analyses"
              action={<GhostBtn onClick={() => nav("/candidates")}>View All →</GhostBtn>} />

            {/* Header row */}
            <Box sx={{
              display: "flex", alignItems: "center",
              px: 2.5, py: 1.25, borderBottom: `1px solid ${BORDER}`, bgcolor: "#FAFBFD",
            }}>
              <Typography sx={{ flex: 1, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Name
              </Typography>
              <Typography sx={{ width: 100, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>
                All Scores
              </Typography>
              <Typography sx={{ width: 180, fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>
                Applied Role
              </Typography>
            </Box>

            {/* Rows — show up to 5, pad with empty rows to fill height */}
            {(() => {
              const MAX_ROWS = 5;
              const rows = recentAnalyses.slice(0, MAX_ROWS);
              const emptyCount = MAX_ROWS - rows.length;
              return (
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  {rows.map((row, idx) => {
                    const initials = (row.candidate_name ?? "")
                      .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                    const score = row?.capabilityScore ?? row?.consistencyScore ?? null;
                    const scoreColor = score >= 85 ? SUCCESS : score >= 70 ? WARN : DANGER;
                    const scoreBg   = score >= 85 ? SUCCESS_L : score >= 70 ? WARN_L : DANGER_L;
                    return (
                      <Box key={row.id}
                        onClick={() => nav(`/candidates/${row.candidateId}/workflow`)}
                        sx={{
                          display: "flex", alignItems: "center",
                          px: 2.5, py: 1.5,
                          borderBottom: `1px solid ${BORDER}`,
                          cursor: "pointer", transition: "background .12s",
                          "&:hover": { bgcolor: "#F2F5FF" },
                        }}>
                        <Box sx={{ flex: 1, display: "flex", alignItems: "center", gap: 1.5 }}>
                          <Box sx={{
                            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                            bgcolor: "#E8EDF5", display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#5A6480",
                          }}>
                            {initials}
                          </Box>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                            {row.candidate_name}
                          </Typography>
                        </Box>
                        <Box sx={{ width: 100, display: "flex", justifyContent: "center" }}>
                          {score != null ? (
                            <Box sx={{
                              bgcolor: scoreBg, borderRadius: "20px", px: 1.5, py: "3px",
                              fontSize: 12, fontWeight: 700, color: scoreColor,
                            }}>
                              {score}%
                            </Box>
                          ) : (
                            <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>
                          )}
                        </Box>
                        <Typography sx={{
                          width: 180, fontSize: 13, color: MUTED, fontWeight: 500, textAlign: "right",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {jobTitleMap[row.jobId] ?? "—"}
                        </Typography>
                      </Box>
                    );
                  })}

                  {/* Empty placeholder rows to fill height */}
                  {Array.from({ length: emptyCount }).map((_, i) => (
                    <Box key={`empty-${i}`} sx={{
                      display: "flex", alignItems: "center",
                      px: 2.5, py: 1.5, borderBottom: `1px solid ${BORDER}`,
                      minHeight: 57,
                    }}>
                      <Typography sx={{ fontSize: 12, color: "#F0F2F6" }}>—</Typography>
                    </Box>
                  ))}

                  {!loading && recentAnalyses.length === 0 && (
                    <Box sx={{ py: 3, textAlign: "center" }}>
                      <Typography sx={{ fontSize: 12, color: MUTED }}>
                        No analyses yet — run analysis on a candidate to see results here.
                      </Typography>
                    </Box>
                  )}
                </Box>
              );
            })()}
          </Card>
        </Box>

        {/* RIGHT sidebar — Reminders + Pipeline + Risk */}
        <Box sx={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 2 }}>

          {/* Reminders */}
          <Card>
            <CardHead title="Reminders"
              action={<GhostBtn onClick={() => nav("/reminders")}>View All →</GhostBtn>} />
            <Box sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {todayTasks.length === 0 ? (
                <Typography sx={{ fontSize: 12, color: MUTED, py: 1.5, px: 1 }}>
                  All clear — no tasks due today.
                </Typography>
              ) : (
                todayTasks.slice(0, 4).map((r, i) => (
                  <ReminderRow key={r.id} reminder={r} isFirst={i === 0} />
                ))
              )}
            </Box>
          </Card>

          {/* Pipeline */}
          <Card>
            <CardHead title="Pipeline" />
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.75 }}>
              <PipelineBar label="High Match ≥80%" count={high}   pct={Math.round(high   / total * 100)} color={SUCCESS} />
              <PipelineBar label="Moderate 60–79%"  count={medium} pct={Math.round(medium / total * 100)} color={WARN}    />
              <PipelineBar label="Low Match <60%"   count={low}    pct={Math.round(low    / total * 100)} color={DANGER}  />
            </Box>
          </Card>

          {/* Risk Summary */}
          <Card sx={{ flex: 1 }}>
            <CardHead title="Risk Summary" />
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
              {[
                { dot: DANGER, label: "High Risk", count: recentAnalyses.filter(a => a?.riskLevel === "High").length,   variant: "danger"  },
                { dot: WARN,   label: "Medium",    count: recentAnalyses.filter(a => a?.riskLevel === "Medium").length, variant: "warning" },
                { dot: ACCENT, label: "Low",       count: recentAnalyses.filter(a => a?.riskLevel === "Low").length,    variant: "accent"  },
              ].map(({ dot, label, count, variant }) => (
                <Box key={label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: dot, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 12, color: TEXT }}>{label}</Typography>
                  </Box>
                  <Badge label={String(count)} variant={variant} />
                </Box>
              ))}
            </Box>
          </Card>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", pb: 0.5 }}>
        {["© nolyvra", "AI is designed to assist, not replace professional judgment."].map(label => (
          <Box key={label} sx={{
            display: "inline-flex", alignItems: "center",
            bgcolor: "#F1F3F7", border: `1px solid ${BORDER}`, borderRadius: "5px",
            px: 1, py: "3px", fontSize: 10, fontWeight: 500, color: MUTED,
          }}>{label}</Box>
        ))}
      </Box>
    </Box>
  );
}
