import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Button, Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString());
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`${res.status} - ${t}`); }
  return res.json();
}

const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706", WARN_BG = "#FFFBEB", WARN_BR = "#FDE68A";
const DANGER = "#DC2626", DANGER_BG = "#FEF2F2", DANGER_BR = "#FECACA";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE", NEUTRAL_BG = "#F1F3F7", SURFACE = "#FAFBFD";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";

const thSx = {
  fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
  letterSpacing: "0.5px", borderBottom: `1px solid ${BORDER}`, bgcolor: SURFACE,
  py: 1.25, px: 2, whiteSpace: "nowrap"
};

function Badge({ label, variant = "neutral" }) {
  const styles = {
    success: { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
    warning: { bg: WARN_BG, border: WARN_BR, color: WARN },
    danger: { bg: DANGER_BG, border: DANGER_BR, color: DANGER },
    accent: { bg: ACCENT_BG, border: ACCENT_BR, color: ACCENT },
    neutral: { bg: NEUTRAL_BG, border: BORDER, color: MUTED },
    purple: { bg: PURPLE_BG, border: PURPLE_BR, color: PURPLE },
  };
  const s = styles[variant] ?? styles.neutral;
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", bgcolor: s.bg,
      border: `1px solid ${s.border}`, borderRadius: "20px", px: 1.25, py: 0.25,
      fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap"
    }}>
      {label}
    </Box>
  );
}

function KpiCard({ label, value, delta, deltaUp, valueColor }) {
  return (
    <Paper elevation={0} sx={{
      border: `1px solid ${BORDER}`, borderRadius: "10px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)", p: 2.25, bgcolor: "#fff",
      display: "flex", flexDirection: "column", gap: 0.5
    }}>
      <Typography sx={{
        fontSize: 10, fontWeight: 700, color: MUTED,
        textTransform: "uppercase", letterSpacing: "0.6px"
      }}>{label}</Typography>
      <Typography sx={{
        fontSize: 28, fontWeight: 800, color: valueColor ?? TEXT,
        lineHeight: 1.1, my: 0.5
      }}>{value ?? 0}</Typography>
      {delta && (
        <Typography sx={{ fontSize: 11, fontWeight: 500, color: deltaUp ? SUCCESS : MUTED }}>
          {deltaUp ? "↑ " : ""}{delta}
        </Typography>
      )}
    </Paper>
  );
}

function PipelineBar({ label, count, pct, color }) {
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, color: TEXT }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{count}</Typography>
      </Box>
      <Box sx={{ height: 6, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: "3px" }} />
      </Box>
    </Box>
  );
}

function RiskRow({ dotColor, label, count, variant }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: dotColor, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 12, color: TEXT }}>{label}</Typography>
      </Box>
      <Badge label={String(count)} variant={variant} />
    </Box>
  );
}

function ScoreCell({ value }) {
  if (!value) return <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>;
  const color = value >= 85 ? SUCCESS : value >= 70 ? WARN : DANGER;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{value}%</Typography>
      <Box sx={{ width: 60, height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
        <Box sx={{ width: `${value}%`, height: "100%", bgcolor: color, borderRadius: "3px" }} />
      </Box>
    </Box>
  );
}

function Card({ children, sx = {}, isNew = false }) {
  return (
    <Paper elevation={0} sx={{
      border: `1px solid ${isNew ? PURPLE_BR : BORDER}`,
      borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      overflow: "hidden", bgcolor: "#fff",
      ...(isNew && { boxShadow: `0 0 0 2px rgba(124,58,237,0.06)` }),
      ...sx,
    }}>{children}</Paper>
  );
}

function CardHead({ title, action, isNew = false }) {
  return (
    <Box sx={{
      px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: "#fff"
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</Typography>
        {isNew && (
          <Box sx={{
            display: "inline-flex", alignItems: "center", px: "7px", py: "2px",
            bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`,
            borderRadius: "4px", fontSize: 10, fontWeight: 600, color: PURPLE
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
      cursor: "pointer", userSelect: "none", "&:hover": { textDecoration: "underline" }
    }}>
      {children}
    </Box>
  );
}

function TaskCard({ title, subtitle, urgency }) {
  const cfg = {
    overdue:  { border: DANGER_BR,  bg: DANGER_BG,  color: DANGER  },
    upcoming: { border: SUCCESS_BR, bg: SUCCESS_BG, color: SUCCESS },
    nudge:    { border: WARN_BR,    bg: WARN_BG,    color: WARN    },
    normal:   { border: WARN_BR,    bg: WARN_BG,    color: WARN    },
  };
  const c = cfg[urgency] ?? cfg.normal;
  return (
    <Box sx={{
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      flexShrink: 0, minWidth: 200, maxWidth: 230, minHeight: 88,
      border: `1px solid ${c.border}`, borderRadius: "7px", p: 1.5, bgcolor: c.bg,
    }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{
          width: 14, height: 14,
          border: `1.5px solid ${urgency === "normal" ? BORDER : c.border}`,
          borderRadius: "3px", flexShrink: 0, mt: "2px",
        }} />
        <Typography sx={{ fontSize: 12, fontWeight: 500, color: TEXT, lineHeight: 1.4 }}>
          {title}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 11, fontWeight: 500, color: c.color, mt: 1, pl: "22px" }}>
        {subtitle}
      </Typography>
    </Box>
  );
}

export default function DashboardPage() {
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  const [recentJobs,         setRecentJobs]         = useState([]);
  const [recentAnalyses,     setRecentAnalyses]     = useState([]);
  const [reminders,          setReminders]          = useState([]);
  const [candidateCountByJob,setCandidateCountByJob]= useState({}); // ← Change 1
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState(null);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;

    async function load() {
      try {
        // ── Change 2: fetch jobs + candidates + analyses + reminders together ──
        const [jobs, analyses, rems] = await Promise.all([
          apiGet("/api/jobs"),
          apiGet("/api/analyses/recent"),
          apiGet("/api/reminders?filter=today"),
        ]);
        if (cancelled) return;

        const jobList = jobs ?? [];

        // Fetch candidate counts for each job in parallel
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

        // Set all state together so renders are consistent
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

  const todayTasks   = reminders.filter(r => !r.isCompleted);
  const high   = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) >= 80).length;
  const medium = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) >= 60 && (a?.capabilityScore ?? 0) < 80).length;
  const low    = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) < 60).length;
  const total  = recentAnalyses.length || 1;

  // ── Change 1: Export dashboard as PDF using print stylesheet ─────────────
  function handleExportPdf() {
    const styleId = "dashboard-print-style";
    document.getElementById(styleId)?.remove();
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @media print {
        @page { margin: 14mm 12mm; size: A4 portrait; }
        body * { visibility: hidden; }
        #dashboard-print-root,
        #dashboard-print-root * { visibility: visible; }
        #dashboard-print-root {
          position: absolute; left: 0; top: 0;
          width: 100%; overflow: visible !important; background: #fff;
        }
        #dashboard-print-root .MuiPaper-root {
          box-shadow: none !important; border: 1px solid #E8ECF2 !important;
          break-inside: avoid; page-break-inside: avoid;
        }
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
    <Box id="dashboard-print-root" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {/* Page header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Dashboard</Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>Your recruitment pipeline at a glance</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button variant="outlined" size="small" onClick={() => nav("/reminders")}
            sx={{ fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
              borderRadius: "6px", textTransform: "none",
              "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
            🔔 Reminders
            {todayTasks.length > 0 && (
              <Box component="span" sx={{
                ml: 0.75, bgcolor: DANGER, color: "#fff",
                borderRadius: "10px", px: "5px", py: "1px", fontSize: 9, fontWeight: 700
              }}>{todayTasks.length}</Box>
            )}
          </Button>
          <Button variant="outlined" size="small" onClick={handleExportPdf}
            sx={{ fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
              borderRadius: "6px", textTransform: "none" }}>
            ⬇ Export PDF
          </Button>
          <Button variant="contained" size="small" onClick={() => nav("/jobs/new")}
            sx={{ fontSize: 11, fontWeight: 500, bgcolor: ACCENT,
              borderRadius: "6px", textTransform: "none", boxShadow: "none",
              "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            ＋ New Job
          </Button>
        </Box>
      </Box>

      {/* KPI row */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1.75 }}>
        <KpiCard label="Active Jobs"       value={recentJobs.length}      delta="from jobs table" />
        <KpiCard label="Total Candidates"  value={recentAnalyses.length}  delta="all analysed" />
        <KpiCard label="Analyses Run"      value={recentAnalyses.length}  valueColor={ACCENT} />
        <KpiCard label="High-Risk Flags"
          value={recentAnalyses.filter(a => a?.riskLevel === "High").length}
          valueColor={DANGER} delta="Needs review" />
      </Box>

      {/* Today's Tasks strip */}
      <Card isNew sx={{ overflow: "unset" }}>
        <CardHead title="Today's Tasks" isNew
          action={<GhostBtn onClick={() => nav("/reminders")}>View All →</GhostBtn>} />
        <Box sx={{ p: 1.75 }}>
          {todayTasks.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: MUTED, py: 1 }}>No tasks for today. 🎉</Typography>
          ) : (
            <Box sx={{ display: "flex", gap: 2, overflowX: "auto", pb: 0.5,
              "&::-webkit-scrollbar": { height: 4 },
              "&::-webkit-scrollbar-thumb": { bgcolor: "#D1D5DB", borderRadius: 4 } }}>
              {todayTasks.slice(0, 6).map(r => {
                const dueDate = new Date(r.dueAt);
                const now = new Date();
                const nudgeTypes = ["AUTO_SCREENING_STUCK", "AUTO_ANALYSIS_PENDING"];
                const isNudge    = nudgeTypes.includes(r.reminderType);
                const isOverdue  = !isNudge && dueDate < now;
                const isUpcoming = r.reminderType === "AUTO_INTERVIEW_UPCOMING";

                let subtitle;
                if (isOverdue) {
                  subtitle = "Overdue";
                } else if (isUpcoming) {
                  const diffHours = Math.round((dueDate - now) / (1000 * 60 * 60));
                  subtitle = diffHours <= 1 ? "In less than 1 hour"
                    : diffHours === 1 ? "In 1 hour" : `In ${diffHours} hours`;
                } else if (isNudge) {
                  subtitle = "Due today";
                } else {
                  const isToday = dueDate.toDateString() === now.toDateString();
                  subtitle = isToday ? "Due today"
                    : dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                }

                const urgency = isOverdue ? "overdue"
                  : isUpcoming ? "upcoming"
                  : isNudge    ? "nudge"
                  : "normal";

                return (
                  <TaskCard key={r.id} title={r.title} subtitle={subtitle} urgency={urgency} />
                );
              })}
            </Box>
          )}
        </Box>
      </Card>

      {/* Middle row: Recent Jobs + Pipeline + Risk */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: 1 }}>
          <Card>
            <CardHead title="Recent Jobs"
              action={<GhostBtn onClick={() => nav("/jobs")}>View All →</GhostBtn>} />
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
                    cursor: "pointer", "&:hover": { bgcolor: "#F0F4FF" },
                    "&:last-child td": { borderBottom: "none" } }}>
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{j.title}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                      {j.company}
                    </TableCell>
                    {/* ── Change 3: show real candidate count from candidateCountByJob ── */}
                    <TableCell sx={{ py: 1.5, px: 2, textAlign: "center", borderBottom: `1px solid ${BORDER}` }}>
                      <Badge
                        label={String(candidateCountByJob[j.id] ?? 0)}
                        variant={candidateCountByJob[j.id] > 0 ? "accent" : "neutral"}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <Badge
                        label={j.status ?? "Active"}
                        variant={j.status === "Complete" ? "neutral" : j.status === "Fulfilling" ? "warning" : "success"}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, textAlign: "right", borderBottom: `1px solid ${BORDER}` }}
                      onClick={e => e.stopPropagation()}>
                      <Button size="small" variant="outlined" onClick={() => nav("/jobs")}
                        sx={{ fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
                          borderRadius: "6px", textTransform: "none",
                          "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && recentJobs.length === 0 && (
                  <TableRow><TableCell colSpan={5} sx={{ py: 4, textAlign: "center", fontSize: 12, color: MUTED }}>
                    No jobs yet. Create your first job to start.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Box>

        <Box sx={{ flex: "0 0 210px", display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Card>
            <CardHead title="Pipeline" />
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
              <PipelineBar label="High Match ≥80%"  count={high}   pct={Math.round(high   / total * 100)} color={SUCCESS} />
              <PipelineBar label="Moderate 60–79%"  count={medium} pct={Math.round(medium / total * 100)} color={WARN}    />
              <PipelineBar label="Low Match <60%"   count={low}    pct={Math.round(low    / total * 100)} color={DANGER}  />
            </Box>
          </Card>
          <Card>
            <CardHead title="Risk Summary" />
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
              <RiskRow dotColor={DANGER} label="High Risk" count={recentAnalyses.filter(a => a?.riskLevel === "High").length}   variant="danger"  />
              <RiskRow dotColor={WARN}   label="Medium"    count={recentAnalyses.filter(a => a?.riskLevel === "Medium").length} variant="warning" />
              <RiskRow dotColor={ACCENT} label="Low"       count={recentAnalyses.filter(a => a?.riskLevel === "Low").length}    variant="accent"  />
            </Box>
          </Card>
        </Box>
      </Box>

      {/* Recent Candidate Analyses */}
      <Card sx={{ mb: 1.75 }}>
        <CardHead title="Recent Candidate Analyses"
          action={<GhostBtn onClick={() => nav("/candidates")}>View All →</GhostBtn>} />
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
            {recentAnalyses.map((row, idx) => (
              <TableRow key={row.id}
                onClick={() => nav(`/candidates/${row.candidateId}/workflow`)}
                sx={{ bgcolor: idx % 2 === 1 ? SURFACE : "#fff", cursor: "pointer",
                  "&:hover": { bgcolor: "#F0F4FF" }, "&:last-child td": { borderBottom: "none" } }}>
                <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{row.candidate_name}</Typography>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>
                  {row.jobId}
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <ScoreCell value={row?.consistencyScore} />
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <ScoreCell value={row?.capabilityScore} />
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <Badge label={row?.riskLevel || "—"}
                    variant={row?.riskLevel === "High" ? "danger" : row?.riskLevel === "Medium" ? "warning" : "accent"} />
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2, textAlign: "right", borderBottom: `1px solid ${BORDER}` }}
                  onClick={e => e.stopPropagation()}>
                  <Button size="small" variant="outlined"
                    onClick={() => nav(`/candidates/${row.candidateId}/workflow`)}
                    sx={{ fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
                      borderRadius: "6px", textTransform: "none",
                      "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
                    Open Profile
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && recentAnalyses.length === 0 && (
              <TableRow><TableCell colSpan={6} sx={{ py: 4, textAlign: "center", fontSize: 12, color: MUTED }}>
                No analyses yet. Run analysis on a candidate to see results here.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Footer */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {["copyright@ nolyvra", "A product of Golden Wattle Ventures Pvt Ltd",
          "This AI tool is designed to assist you, not replace professional judgment."]
          .map(label => (
            <Box key={label} sx={{ display: "inline-flex", alignItems: "center",
              bgcolor: "#F0F2F6", border: `1px solid ${BORDER}`, borderRadius: "5px",
              px: 1, py: 0.25, fontSize: 10, fontWeight: 500, color: MUTED }}>{label}</Box>
          ))}
      </Box>
    </Box>
  );
}
