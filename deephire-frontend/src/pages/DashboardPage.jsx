import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  LinearProgress,
  Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiGet(path) {

  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

function scoreColor(score) {
  if (score >= 85) return "#16A34A";
  if (score >= 70) return "#D97706";
  return "#DC2626";
}

function riskFlagStyles(level) {
  if (level === "High") return { bg: "#FEF2F2", border: "#FECACA", fg: "#DC2626" };
  if (level === "Medium") return { bg: "#FFFBEB", border: "#FDE68A", fg: "#D97706" };
  return { bg: "#EBF2FF", border: "#BFDBFE", fg: "#1D72E8" };
}

// ─── Style tokens ─────────────────────────────────────────────────────────────
const BORDER = "#E8ECF2";
const MUTED = "#9AA3B4";
const TEXT = "#0F1623";
const ACCENT = "#1D72E8";
const SUCCESS = "#16A34A";
const SUCCESS_BG = "#F0FDF4";
const SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706";
const WARN_BG = "#FFFBEB";
const WARN_BR = "#FDE68A";
const DANGER = "#DC2626";
const DANGER_BG = "#FEF2F2";
const DANGER_BR = "#FECACA";
const ACCENT_BG = "#EBF2FF";
const ACCENT_BR = "#BFDBFE";
const NEUTRAL_BG = "#F1F3F7";
const SURFACE = "#FAFBFD";

// ─── Shared table header cell ─────────────────────────────────────────────────
const thSx = {
  fontSize: 10,
  fontWeight: 700,
  color: MUTED,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  borderBottom: `1px solid ${BORDER}`,
  bgcolor: SURFACE,
  py: 1.25,
  px: 2,
  whiteSpace: "nowrap",
};

// ─── Generic pill badge ───────────────────────────────────────────────────────
function Badge({ label, variant = "neutral" }) {
  const styles = {
    success: { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
    warning: { bg: WARN_BG, border: WARN_BR, color: WARN },
    danger: { bg: DANGER_BG, border: DANGER_BR, color: DANGER },
    accent: { bg: ACCENT_BG, border: ACCENT_BR, color: ACCENT },
    neutral: { bg: NEUTRAL_BG, border: BORDER, color: MUTED },
  };
  const s = styles[variant] ?? styles.neutral;
  return (
    <Box
      sx={{
        display: "inline-flex", alignItems: "center",
        bgcolor: s.bg, border: `1px solid ${s.border}`,
        borderRadius: "20px", px: 1.25, py: 0.25,
        fontSize: 11, fontWeight: 600, color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Box>
  );
}

// ─── KPI Stat card ────────────────────────────────────────────────────────────
function KpiCard({ label, value, delta, deltaUp, valueColor }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${BORDER}`, borderRadius: "10px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        p: 2.25, bgcolor: "#fff",
        display: "flex", flexDirection: "column", gap: 0.5,
      }}
    >
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 800, color: valueColor ?? TEXT, lineHeight: 1.1, my: 0.5 }}>
        {value ?? 0}
      </Typography>
      {delta && (
        <Typography sx={{ fontSize: 11, fontWeight: 500, color: deltaUp ? SUCCESS : MUTED }}>
          {deltaUp ? "↑ " : ""}{delta}
        </Typography>
      )}
    </Paper>
  );
}

// ─── Pipeline bar row ─────────────────────────────────────────────────────────
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

// ─── Risk summary row ─────────────────────────────────────────────────────────
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

// ─── Score bar cell ───────────────────────────────────────────────────────────
function ScoreCell({ value, showBar = false }) {
  if (value == null || value === 0)
    return <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>;
  const color = scoreColor(value);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color }}>{value}%</Typography>
      {showBar && (
        <Box sx={{ width: 60, height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
          <Box sx={{ width: `${value}%`, height: "100%", bgcolor: color, borderRadius: "3px" }} />
        </Box>
      )}
    </Box>
  );
}

// ─── Ghost link button ────────────────────────────────────────────────────────
function GhostBtn({ onClick, children }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        fontSize: 12, fontWeight: 600, color: ACCENT,
        cursor: "pointer", userSelect: "none",
        "&:hover": { textDecoration: "underline" },
      }}
    >
      {children}
    </Box>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Card({ children, sx = {} }) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${BORDER}`, borderRadius: "10px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        overflow: "hidden", bgcolor: "#fff",
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function CardHead({ title, action }) {
  return (
    <Box
      sx={{
        px: 2.25, py: 1.75,
        borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</Typography>
      {action}
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const nav = useNavigate();

  // ── State (identical to original) ────────────────────────────────────────
  const [jobs, setJobs] = useState([]);
  const [candidatesByJob, setCandidatesByJob] = useState(new Map());
  const [latestAnalysisByCandidate, setLatestAnalysisByCandidate] = useState(new Map());
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ── Data loading (identical to original) ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");
      try {
        const jobsResp = await apiGet("/api/jobs");
        if (cancelled) return;
        setJobs(jobsResp ?? []);

        const jobList = jobsResp ?? [];
        const candMap = new Map();
        await Promise.all(
          jobList.map(async (j) => {
            try {
              const cands = await apiGet(`/api/jobs/${j.id}/candidates`);
              candMap.set(j.id, cands ?? []);
            } catch (e) {
              candMap.set(j.id, []);
              console.warn("Failed to load candidates for job", j.id, e);
            }
          })
        );
        if (cancelled) return;
        setCandidatesByJob(candMap);

        try {
          const analyses = await apiGet(`/api/analyses/recent`);
          if (cancelled) return;
          setRecentAnalyses(analyses ?? []);
          setLatestAnalysisByCandidate(new Map());
        } catch (e) {
          console.warn("Failed to load recent analyses", e);
          setRecentAnalyses([]);
          setLatestAnalysisByCandidate(new Map());
        }
      } catch (e) {
        if (cancelled) return;
        setErr(e?.message || "Failed to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Derived stats (identical to original) ────────────────────────────────
  const totalCandidates = useMemo(
    () => Array.from(candidatesByJob.values()).reduce((sum, arr) => sum + (arr?.length ?? 0), 0),
    [candidatesByJob]
  );

  const analysedCount = useMemo(() => {
    return recentAnalyses.length;
  }, [recentAnalyses]);

  const avgMatch = useMemo(() => {
    const scores = recentAnalyses
      .map(a => a?.capabilityScore)
      .filter(v => typeof v === "number" && v > 0);
    if (!scores.length) return 0;
    return Math.round(scores.reduce((s, x) => s + x, 0) / scores.length);
  }, [recentAnalyses]);

  const highRiskCount = useMemo(() => {
    return recentAnalyses.filter(a => a?.riskLevel === "High").length;
  }, [recentAnalyses]);

  const recentJobs = useMemo(
    () =>
      (jobs ?? []).slice(0, 5).map((j) => ({
        ...j,
        company: j.company ?? "—",
        jobType: j.jobType ?? "—",
        candidateCount: candidatesByJob.get(j.id)?.length ?? 0,
        status: j.status ?? "Active",
      })),
    [jobs, candidatesByJob]
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        display: "flex", flexDirection: "column", height: "100%",
        overflow: "hidden", bgcolor: "#F7F8FA",
      }}
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          bgcolor: "#fff", borderBottom: `1px solid ${BORDER}`,
          px: 3, py: 1.5,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: "-0.2px" }}>
            Dashboard
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Your recruitment pipeline at a glance
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            size="small" variant="outlined"
            sx={{
              fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT,
              borderRadius: "6px", textTransform: "none",
              "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE },
            }}
          >
            Export Report
          </Button>
          <Button
            size="small" variant="contained"
            onClick={() => nav("/jobs/new")}
            sx={{
              fontSize: 12, fontWeight: 500, bgcolor: ACCENT,
              borderRadius: "6px", textTransform: "none", boxShadow: "none",
              "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
            }}
          >
            ＋ New Job
          </Button>
        </Box>
      </Box>

      {/* ── Scrollable content ─────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>

        {err && <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }}>{err}</Alert>}

        {loading && (
          <Card sx={{ p: 2.5, mb: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, mb: 1 }}>
              Loading dashboard…
            </Typography>
            <LinearProgress sx={{ borderRadius: "4px" }} />
          </Card>
        )}

        {/* ── KPI cards ─────────────────────────────────────────────── */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1.5,
            mb: 1.75,
          }}
        >
          <KpiCard
            label="Active Jobs"
            value={jobs.length}
            delta="↑ 1 this week"
            deltaUp
          />
          <KpiCard
            label="Total Candidates"
            value={totalCandidates}
            delta="↑ 4 this week"
            deltaUp
          />
          <KpiCard
            label="Analyses Run"
            value={analysedCount}
            delta={avgMatch ? `Avg match ${avgMatch}%` : "All processed"}
            valueColor={ACCENT}
          />
          <KpiCard
            label="High-Risk Flags"
            value={highRiskCount}
            delta="Needs review"
            valueColor={DANGER}
          />
        </Box>

        {/* ── Middle row: Recent Jobs + Pipeline + Risk ──────────────── */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 1.75, alignItems: "flex-start" }}>

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
                    <TableCell sx={{ ...thSx, textAlign: "center" }}>Candidates</TableCell>
                    <TableCell sx={thSx}>Status</TableCell>
                    <TableCell sx={{ ...thSx, textAlign: "right" }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentJobs.map((j, idx) => (
                    <TableRow
                      key={j.id}
                      onClick={() => nav("/jobs")}
                      sx={{
                        bgcolor: idx % 2 === 1 ? SURFACE : "#fff",
                        cursor: "pointer",
                        "&:hover": { bgcolor: "#F0F4FF" },
                        "&:last-child td": { borderBottom: "none" },
                      }}
                    >
                      <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                          {j.title}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                        {j.company}
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, textAlign: "center", borderBottom: `1px solid ${BORDER}` }}>
                        <Badge label={String(j.candidateCount)} variant="neutral" />
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                        <Badge
                          label={j.status}
                          variant={j.status === "Draft" ? "warning" : "success"}
                        />
                      </TableCell>
                      <TableCell
                        sx={{ py: 1.5, px: 2, textAlign: "right", borderBottom: `1px solid ${BORDER}` }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="small" variant="outlined"
                          onClick={() => nav("/jobs")}
                          sx={{
                            fontSize: 11, fontWeight: 500,
                            borderColor: BORDER, color: TEXT,
                            borderRadius: "6px", textTransform: "none",
                            "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE },
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!loading && recentJobs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ py: 4, textAlign: "center", fontSize: 12, color: MUTED }}>
                        No jobs yet. Create your first job to start analysing candidates.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </Box>

          {/* Right col: Pipeline + Risk Summary */}
          <Box sx={{ flex: "0 0 210px", display: "flex", flexDirection: "column", gap: 1.5 }}>

            {/* Pipeline funnel */}
            <Card>
              <CardHead title="Pipeline" />
              <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {(() => {
                  const high = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) >= 80).length;
                  const medium = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) >= 60 && (a?.capabilityScore ?? 0) < 80).length;
                  const low = recentAnalyses.filter(a => (a?.capabilityScore ?? 0) < 60).length;
                  const total = recentAnalyses.length || 1; // avoid divide by zero

                  return (
                    <>
                      <PipelineBar label="High Match ≥80%" count={high} pct={Math.round(high / total * 100)} color={SUCCESS} />
                      <PipelineBar label="Moderate 60–79%" count={medium} pct={Math.round(medium / total * 100)} color={WARN} />
                      <PipelineBar label="Low Match <60%" count={low} pct={Math.round(low / total * 100)} color={DANGER} />
                    </>
                  );
                })()}
              </Box>
            </Card>

            {/* Risk Summary */}
            <Card>
              <CardHead title="Risk Summary" />
              <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
                <RiskRow dotColor={DANGER} label="High Risk" count={recentAnalyses.filter(a => a?.riskLevel === "High").length} variant="danger" />
                <RiskRow dotColor={WARN} label="Medium" count={recentAnalyses.filter(a => a?.riskLevel === "Medium").length} variant="warning" />
                <RiskRow dotColor={ACCENT} label="Low" count={recentAnalyses.filter(a => a?.riskLevel === "Low").length} variant="accent" />
              </Box>
            </Card>

          </Box>
        </Box>

        {/* ── Recent Candidate Analyses ──────────────────────────────── */}
        <Card sx={{ mb: 1.75 }}>
          <CardHead
            title="Recent Candidate Analyses"
            action={<GhostBtn onClick={() => nav("/candidates")}>View All →</GhostBtn>}
          />
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Candidate</TableCell>
                <TableCell sx={thSx}>Job</TableCell>
                <TableCell sx={thSx}>Consistency Score</TableCell>
                <TableCell sx={thSx}>Capability Match</TableCell>
                <TableCell sx={thSx}>Risk Flags</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {recentAnalyses.map((row, idx) => {
                console.log("analysis row fields:", row);
                const consistency = row?.consistencyScore ?? 0;
                const capability = row?.capabilityScore ?? 0;
                const riskLevel = row?.riskLevel || "Medium";
                const riskCount = riskLevel === "High" ? 2 : riskLevel === "Medium" ? 1 : 0;
                const riskStyle = riskFlagStyles(riskLevel);

                return (
                  <TableRow
                    key={row.id}
                    onClick={() => nav(`/analysis/${row.candidateId}`)}
                    sx={{
                      bgcolor: idx % 2 === 1 ? SURFACE : "#fff",
                      cursor: "pointer",
                      "&:hover": { bgcolor: "#F0F4FF" },
                      "&:last-child td": { borderBottom: "none" },
                    }}
                  >
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                        {row.candidate_name}
                      </Typography>
                    </TableCell>

                    <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: MUTED, fontWeight: 600, borderBottom: `1px solid ${BORDER}` }}>
                      {row.jobId}
                    </TableCell>

                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <ScoreCell value={consistency} showBar />
                    </TableCell>

                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <ScoreCell value={capability} />
                    </TableCell>

                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <Box
                        sx={{
                          display: "inline-flex", alignItems: "center",
                          bgcolor: riskStyle.bg, border: `1px solid ${riskStyle.border}`,
                          borderRadius: "20px", px: 1.25, py: 0.25,
                          fontSize: 11, fontWeight: 600, color: riskStyle.fg,
                          gap: 0.5,
                        }}
                      >
                        <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: riskStyle.fg }} />
                        {riskCount} {riskLevel}
                      </Box>
                    </TableCell>

                    <TableCell
                      sx={{ py: 1.5, px: 2, textAlign: "right", borderBottom: `1px solid ${BORDER}` }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="small" variant="outlined"
                        onClick={() => nav(`/analysis/${row.candidateId}`)}
                        sx={{
                          fontSize: 11, fontWeight: 500,
                          borderColor: BORDER, color: TEXT,
                          borderRadius: "6px", textTransform: "none",
                          "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE },
                        }}
                      >
                        Results
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {!loading && recentAnalyses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 4, textAlign: "center", fontSize: 12, color: MUTED }}>
                    No analyses yet. Run analysis on a candidate to see results here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Annotation strip */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {[
            "copyright@ DeepHire",
            "A product of Golden Wattle Ventures Pvt Ltd",
            "This AI tool is designed to assist you, not replace professional judgment. Always consult with a qualified expert.",
          ].map((label) => (
            <Box
              key={label}
              sx={{
                display: "inline-flex", alignItems: "center",
                bgcolor: "#F0F2F6", border: `1px solid ${BORDER}`,
                borderRadius: "5px", px: 1, py: 0.25,
                fontSize: 10, fontWeight: 500, color: MUTED,
              }}
            >
              {label}
            </Box>
          ))}
        </Box>

      </Box>
    </Box>
  );
}
