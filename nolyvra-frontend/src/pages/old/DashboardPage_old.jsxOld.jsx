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
  Chip,
  Button,
  LinearProgress,
  Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

function scoreColor(score) {
  if (score >= 85) return "#16A34A"; // green
  if (score >= 70) return "#D97706"; // orange
  return "#DC2626"; // red
}

function riskFlagStyles(level) {
  if (level === "High") return { bg: "#FEE2E2", fg: "#DC2626" };
  if (level === "Medium") return { bg: "#FEF3C7", fg: "#D97706" };
  return { bg: "#E0F2FE", fg: "#0284C7" }; // Low
}

export default function DashboardPage() {
  const nav = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [candidatesByJob, setCandidatesByJob] = useState(new Map()); // jobId -> candidates[]
  const [latestAnalysisByCandidate, setLatestAnalysisByCandidate] = useState(new Map()); // kept (used by stats below)
  const [recentAnalyses, setRecentAnalyses] = useState([]); // <-- NEW: from /api/analyses/recent
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        // 1) Jobs
        const jobsResp = await apiGet("/api/jobs");
        if (cancelled) return;
        setJobs(jobsResp ?? []);

        // 2) Candidates per job
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

        // 3) Recent analyses (single API call)
        try {
          const analyses = await apiGet(`/api/analyses/recent`);
          if (cancelled) return;

          setRecentAnalyses(analyses ?? []);

          // Optional: keep existing stats logic working by mirroring into a map
          // (your analysedCount/avgMatch/highRiskCount currently reads latestAnalysisByCandidate
          // and expects a.scores.*; those fields don't exist on AnalysisResponse).
          // So we set the map empty to avoid miscounting until you update stats later.
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
    return () => {
      cancelled = true;
    };
  }, []);

  const totalCandidates = useMemo(() => {
    return Array.from(candidatesByJob.values()).reduce(
      (sum, arr) => sum + (arr?.length ?? 0),
      0
    );
  }, [candidatesByJob]);

  // NOTE: these stats were previously based on CandidateAnalysisResponse shape (a.scores.*).
  // Your /api/analyses/recent returns AnalysisResponse with flat fields.
  // Keeping your existing stats logic untouched as requested, but they may show 0 until updated later.
  const analysedCount = useMemo(() => {
    let n = 0;
    for (const [, a] of latestAnalysisByCandidate.entries()) {
      if (a && a.scores) n += 1;
    }
    return n;
  }, [latestAnalysisByCandidate]);

  const avgMatch = useMemo(() => {
    const scores = [];
    for (const [, a] of latestAnalysisByCandidate.entries()) {
      const cap = a?.scores?.capabilityScore;
      if (typeof cap === "number") scores.push(cap);
    }
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((s, x) => s + x, 0) / scores.length);
  }, [latestAnalysisByCandidate]);

  const highRiskCount = useMemo(() => {
    let n = 0;
    for (const [, a] of latestAnalysisByCandidate.entries()) {
      if (a?.scores?.riskLevel === "High") n += 1;
    }
    return n;
  }, [latestAnalysisByCandidate]);

  const recentJobs = useMemo(() => {
    return (jobs ?? []).slice(0, 5).map((j) => ({
      ...j,
      company: j.company ?? "—",
      jobType: j.jobType ?? "—",
      candidateCount: candidatesByJob.get(j.id)?.length ?? 0,
      status: "Active", // placeholder until backend adds status
    }));
  }, [jobs, candidatesByJob]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Quick snapshot of jobs, candidates and recent analyses.
        </Typography>
      </Box>

      {err && <Alert severity="error">{err}</Alert>}

      {loading && (
        <Paper sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Loading dashboard…</Typography>
          <LinearProgress />
        </Paper>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
          width: "100%",
        }}
      >
        <StatCard label="Active Jobs" value={jobs.length} subtext="—" accent="success" />
        <StatCard label="Total Candidates" value={totalCandidates} subtext="—" accent="success" />
        <StatCard
          label="Analyses Run"
          value={analysedCount}
          subtext={avgMatch ? `Avg match ${avgMatch}%` : "—"}
          accent="primary"
        />
        <StatCard label="High-risk Flags" value={highRiskCount} subtext="Needs review" accent="error" />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Recent Jobs */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Recent Jobs</Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="text"
              onClick={() => nav("/jobs")}
              sx={{ textTransform: "none", fontWeight: 700, fontSize: 13 }}
              endIcon={<span style={{ fontSize: 16 }}>→</span>}
            >
              View All
            </Button>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Job Title</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Client</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">
                  Candidates
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">
                  Job Type
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>

            <TableBody>
              {recentJobs.map((j) => (
                <TableRow key={j.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{j.title}</TableCell>

                  <TableCell>{j.company || "—"}</TableCell>

                  <TableCell align="center">
                    <Chip
                      label={j.candidateCount}
                      size="small"
                      sx={{ bgcolor: "#EEF2F7", fontWeight: 600, borderRadius: "8px" }}
                    />
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={j.jobType || "—"}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        borderRadius: "8px",
                        bgcolor:
                          j.jobType === "Remote"
                            ? "#E3F2FD"
                            : j.jobType === "Hybrid"
                            ? "#EDE7F6"
                            : j.jobType === "Onsite"
                            ? "#F1F5F9"
                            : "#F3F4F6",
                        color:
                          j.jobType === "Remote"
                            ? "#1D72E8"
                            : j.jobType === "Hybrid"
                            ? "#6D28D9"
                            : j.jobType === "Onsite"
                            ? "#0F172A"
                            : "#374151",
                      }}
                    />
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={j.status || "Active"}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        bgcolor: j.status === "Draft" ? "#FFF4E5" : "#66e573",
                        color: j.status === "Draft" ? "#D97706" : "#16A34A",
                        borderRadius: "8px",
                      }}
                    />
                  </TableCell>

                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => nav("/jobs")}
                      sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && recentJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ color: "text.secondary" }}>
                    No jobs yet. Create your first job to start analysing candidates.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>

        {/* Recent Analyses */}
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Recent Candidate Analyses</Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="text"
              onClick={() => nav("/candidates")}
              sx={{ fontWeight: 700, textTransform: "none" }}
              endIcon={<span style={{ fontSize: 18 }}>→</span>}
            >
              View All
            </Button>
          </Box>

          <Table size="small" sx={{ "& td, & th": { fontSize: 13 } }}>
            <TableHead>
              <TableRow>
                <TableCell>CANDIDATE</TableCell>
                <TableCell>JOB</TableCell>
                <TableCell>CONSISTENCY SCORE</TableCell>
                <TableCell>CAPABILITY MATCH</TableCell>
                <TableCell>RISK FLAGS</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>

            <TableBody>
              {recentAnalyses.map((row) => {
                const consistency = row?.consistencyScore ?? 0;
                const capability = row?.capabilityScore ?? 0;
                const riskLevel = row?.riskLevel || "Medium";

                // /api/analyses/recent is a lightweight response (no riskFlags array),
                // so show a simple placeholder count.
                const riskCount =
                  riskLevel === "High" ? 2 : riskLevel === "Medium" ? 1 : 0;

                const consistencyColor = scoreColor(consistency);
                const capabilityColor = scoreColor(capability);
                const riskStyle = riskFlagStyles(riskLevel);

                return (
                  <TableRow key={row.id} hover sx={{ "& td": { py: 1 } }}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {row.candidate_name}
                    </TableCell>

                    <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>
                      {row.jobId}
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography
                          sx={{ fontWeight: 700, fontSize: 12, color: consistencyColor }}
                        >
                          {consistency}%
                        </Typography>
                        <Box sx={{ width: 90 }}>
                          <LinearProgress
                            variant="determinate"
                            value={consistency}
                            sx={{
                              height: 8,
                              borderRadius: 10,
                              bgcolor: "#EEF2F7",
                              "& .MuiLinearProgress-bar": {
                                borderRadius: 10,
                                bgcolor: consistencyColor,
                              },
                            }}
                          />
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Typography sx={{ fontWeight: 700, fontSize: 12, color: capabilityColor }}>
                        {capability}%
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Chip
                        label={`${riskCount} ${riskLevel}`}
                        size="small"
                        sx={{
                          fontSize: 11,
                          height: 22,
                          fontWeight: 600,
                          bgcolor: riskStyle.bg,
                          color: riskStyle.fg,
                          borderRadius: "8px",
                        }}
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => nav(`/analysis/${row.candidateId}`)}
                        sx={{ textTransform: "none", fontWeight: 700, borderRadius: "10px" }}
                      >
                        Results
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {!loading && recentAnalyses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ color: "text.secondary" }}>
                    No analyses yet. Run analysis on a candidate to see results here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Box>
  );
}