import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Button, Alert,
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

// ── Task card ──────────────────────────────────────────────────────────────
function TaskCard({ title, subtitle, urgency }) {
  const cfg = {
    overdue:  { border: "#FECACA", bg: DANGER_L,  color: DANGER  },
    upcoming: { border: "#BBF7D0", bg: SUCCESS_L, color: SUCCESS },
    nudge:    { border: PURPLE_BR, bg: PURPLE_L,  color: PURPLE  },
    normal:   { border: BORDER,    bg: "#F8F9FB",  color: MUTED   },
  };
  const c = cfg[urgency] ?? cfg.normal;
  return (
    <Box sx={{
      flexShrink: 0, minWidth: 196, maxWidth: 224, minHeight: 80,
      border: `1px solid ${c.border}`, borderRadius: "8px",
      p: 1.5, bgcolor: c.bg, display: "flex", flexDirection: "column", gap: 0.75,
    }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{
          width: 13, height: 13, flexShrink: 0, mt: "2px", borderRadius: "3px",
          border: `1.5px solid ${urgency === "normal" ? BORDER : c.border}`,
        }} />
        <Typography sx={{ fontSize: 11.5, fontWeight: 500, color: TEXT, lineHeight: 1.45 }}>
          {title}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 10.5, fontWeight: 600, color: c.color, pl: "22px" }}>
        {subtitle}
      </Typography>
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
        <KpiCard
          label="Active Jobs"
          value={recentJobs.length}
          sub="Current openings"
          iconBg={ACCENT_L}
          icon={<IcoBriefcase color={ACCENT} />}
        />
        <KpiCard
          label="Total Candidates"
          value={recentAnalyses.length}
          sub="Across all jobs"
          iconBg={PURPLE_L}
          icon={<IcoUsers color={PURPLE} />}
        />
        <KpiCard
          label="Analyses Run"
          value={recentAnalyses.length}
          sub="AI-scored profiles"
          iconBg={SUCCESS_L}
          icon={<IcoTrend color={SUCCESS} />}
        />
        <KpiCard
          label="High-Risk Flags"
          value={recentAnalyses.filter(a => a?.riskLevel === "High").length}
          sub="Needs review"
          subColor={DANGER}
          iconBg={DANGER_L}
          icon={<IcoShield color={DANGER} />}
        />
      </Box>

      {/* Today's Tasks */}
      <Card sx={{
        border: `1px solid ${PURPLE_BR}`,
        boxShadow: `0 0 0 2px rgba(124,58,237,0.04), 0 1px 4px rgba(15,22,35,0.05)`,
      }}>
        <CardHead
          title="Today's Tasks" isNew
          action={<GhostBtn onClick={() => nav("/reminders")}>View All →</GhostBtn>}
        />
        <Box sx={{ p: 2 }}>
          {todayTasks.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: MUTED, py: 0.75 }}>
              All clear — no tasks due today.
            </Typography>
          ) : (
            <Box sx={{
              display: "flex", gap: 1.5, overflowX: "auto", pb: 0.5,
              "&::-webkit-scrollbar": { height: 4 },
              "&::-webkit-scrollbar-thumb": { bgcolor: "#D1D5DB", borderRadius: 4 },
            }}>
              {todayTasks.slice(0, 6).map(r => {
                const dueDate    = new Date(r.dueAt);
                const nudgeTypes = ["AUTO_SCREENING_STUCK", "AUTO_ANALYSIS_PENDING"];
                const isNudge    = nudgeTypes.includes(r.reminderType);
                const isOverdue  = !isNudge && dueDate < now;
                const isUpcoming = r.reminderType === "AUTO_INTERVIEW_UPCOMING";

                let subtitle;
                if (isOverdue) {
                  subtitle = "Overdue";
                } else if (isUpcoming) {
                  const h = Math.round((dueDate - now) / 3600000);
                  subtitle = h <= 0 ? "In less than 1 hour" : h === 1 ? "In 1 hour" : `In ${h} hours`;
                } else {
                  subtitle = dueDate.toDateString() === now.toDateString()
                    ? "Due today"
                    : dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                }

                const urgency = isOverdue ? "overdue" : isUpcoming ? "upcoming" : isNudge ? "nudge" : "normal";
                return <TaskCard key={r.id} title={r.title} subtitle={subtitle} urgency={urgency} />;
              })}
            </Box>
          )}
        </Box>
      </Card>

      {/* Middle row: Jobs + Pipeline/Risk */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        {/* Recent Jobs table */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card>
            <CardHead
              title="Recent Jobs"
              action={<GhostBtn onClick={() => nav("/jobs")}>View All →</GhostBtn>}
            />
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Job Title</TableCell>
                  <TableCell sx={thSx}>Client</TableCell>
                  <TableCell sx={thSx}>Candidates</TableCell>
                  <TableCell sx={thSx}>Status</TableCell>
                  <TableCell sx={{ ...thSx, textAlign: "right" }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {recentJobs.map(j => (
                  <TableRow key={j.id} onClick={() => nav("/jobs")} sx={{
                    cursor: "pointer", transition: "background 0.12s",
                    "&:hover": { bgcolor: "#F2F5FF" },
                    "&:last-child td": { borderBottom: "none" },
                  }}>
                    <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{j.title}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2.5, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                      {j.company}
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                      <Badge
                        label={String(candidateCountByJob[j.id] ?? 0)}
                        variant={candidateCountByJob[j.id] > 0 ? "accent" : "neutral"}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                      <Badge
                        label={j.status ?? "Active"}
                        variant={j.status === "Complete" ? "neutral" : j.status === "Fulfilling" ? "warning" : "success"}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2.5, textAlign: "right", borderBottom: `1px solid ${BORDER}` }}
                      onClick={e => e.stopPropagation()}>
                      <Button size="small" variant="outlined" onClick={() => nav("/jobs")}
                        sx={{ fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
                          borderRadius: "6px", textTransform: "none",
                          "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" } }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && recentJobs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ py: 4, textAlign: "center", fontSize: 12, color: MUTED, borderBottom: "none" }}>
                      No jobs yet — create your first job to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Box>

        {/* Pipeline + Risk sidebar */}
        <Box sx={{ flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 2 }}>
          <Card>
            <CardHead title="Pipeline" />
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.75 }}>
              <PipelineBar label="High Match ≥80%" count={high}   pct={Math.round(high   / total * 100)} color={SUCCESS} />
              <PipelineBar label="Moderate 60–79%"  count={medium} pct={Math.round(medium / total * 100)} color={WARN}    />
              <PipelineBar label="Low Match <60%"   count={low}    pct={Math.round(low    / total * 100)} color={DANGER}  />
            </Box>
          </Card>
          <Card>
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

      {/* Recent Candidate Analyses */}
      <Card sx={{ mb: 1.5 }}>
        <CardHead
          title="Recent Candidate Analyses"
          action={<GhostBtn onClick={() => nav("/candidates")}>View All →</GhostBtn>}
        />
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}>Candidate</TableCell>
              <TableCell sx={thSx}>Job</TableCell>
              <TableCell sx={thSx}>Consistency</TableCell>
              <TableCell sx={thSx}>Capability</TableCell>
              <TableCell sx={thSx}>Risk</TableCell>
              <TableCell sx={{ ...thSx, textAlign: "right" }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {recentAnalyses.map(row => (
              <TableRow key={row.id}
                onClick={() => nav(`/candidates/${row.candidateId}/workflow`)}
                sx={{
                  cursor: "pointer", transition: "background 0.12s",
                  "&:hover": { bgcolor: "#F2F5FF" },
                  "&:last-child td": { borderBottom: "none" },
                }}>
                <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{row.candidate_name}</Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2.5, fontSize: 12, color: MUTED, fontWeight: 500, borderBottom: `1px solid ${BORDER}` }}>
                  {jobTitleMap[row.jobId] ?? row.jobId ?? "—"}
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                  <ScoreCell value={row?.consistencyScore} />
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                  <ScoreCell value={row?.capabilityScore} />
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                  <Badge
                    label={row?.riskLevel || "—"}
                    variant={row?.riskLevel === "High" ? "danger" : row?.riskLevel === "Medium" ? "warning" : "accent"}
                  />
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2.5, textAlign: "right", borderBottom: `1px solid ${BORDER}` }}
                  onClick={e => e.stopPropagation()}>
                  <Button size="small" variant="outlined"
                    onClick={() => nav(`/candidates/${row.candidateId}/workflow`)}
                    sx={{ fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
                      borderRadius: "6px", textTransform: "none",
                      "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" } }}>
                    Open Profile
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && recentAnalyses.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 4, textAlign: "center", fontSize: 12, color: MUTED, borderBottom: "none" }}>
                  No analyses yet — run analysis on a candidate to see results here.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

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
