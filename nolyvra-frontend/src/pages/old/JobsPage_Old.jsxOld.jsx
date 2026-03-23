import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Collapse, Chip, Button, Alert, LinearProgress
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

function riskColor(risk) {
  if (risk === "High") return "error";
  if (risk === "Medium") return "warning";
  if (risk === "Low") return "info";
  return "default";
}

function JobRow({ job, candidates }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const analysedCandidates = candidates.filter(c => c.status === "Analysed");
  const avg = analysedCandidates.length
    ? Math.round(
        analysedCandidates.reduce((s, c) => s + (c.capabilityScore ?? 0), 0) / analysedCandidates.length
      )
    : 0;

  return (
    <>
      <TableRow hover>
        <TableCell width={40}>
          <IconButton size="small" onClick={() => setOpen(v => !v)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 700 }}>{job.title}</TableCell>
        <TableCell>{job.company || "—"}</TableCell>
        <TableCell>{job.location || "—"}</TableCell>
        <TableCell>
          <Chip size="small" label={job.jobType || "—"} variant="outlined" />
        </TableCell>
        <TableCell align="right">{candidates.length}</TableCell>
        <TableCell align="right">{analysedCandidates.length ? `${avg}%` : "—"}</TableCell>
        <TableCell>
          <Button size="small" onClick={() => nav("/candidates/new")} startIcon={<AddIcon />}>
            Add candidate
          </Button>
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={8} sx={{ p: 0, borderBottom: 0 }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: "rgba(0,0,0,.02)" }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>Candidates for this Job</Typography>

              {candidates.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No candidates added yet.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell align="right">Consistency</TableCell>
                      <TableCell align="right">Capability</TableCell>
                      <TableCell>Risk</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {candidates.map(c => (
                      <TableRow key={c.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                        <TableCell align="right">
                          {c.consistencyScore != null ? `${c.consistencyScore}%` : "—"}
                        </TableCell>
                        <TableCell align="right">
                          {c.capabilityScore != null ? `${c.capabilityScore}%` : "—"}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={c.risk || "—"} color={riskColor(c.risk)} />
                        </TableCell>
                        <TableCell>{c.status || "Pending"}</TableCell>
                        <TableCell>
                          {c.status === "Analysed" ? (
                            <Button size="small" onClick={() => nav(`/analysis/${c.id}`)}>
                              View analysis
                            </Button>
                          ) : (
                            <Button size="small" variant="outlined" onClick={() => nav(`/analysis/${c.id}`)}>
                              Analyse
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function JobsPage() {
  const nav = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [candidatesByJob, setCandidatesByJob] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const jobsResp = await apiGet("/api/jobs");
        if (cancelled) return;

        setJobs(jobsResp ?? []);

        const map = new Map();

        await Promise.all(
          (jobsResp ?? []).map(async (job) => {
            try {
              const candidates = await apiGet(`/api/jobs/${job.id}/candidates`);
              map.set(job.id, (candidates ?? []).map((c) => ({
                ...c,
                consistencyScore: null,
                capabilityScore: null,
                risk: null,
                status: "Pending",
              })));
            } catch (e) {
              map.set(job.id, []);
              console.warn("Failed to load candidates for job", job.id, e);
            }
          })
        );

        if (cancelled) return;
        setCandidatesByJob(map);
      } catch (e) {
        if (cancelled) return;
        setErr(e?.message || "Failed to load jobs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const jobsWithDefaults = useMemo(() => {
    return (jobs ?? []).map((job) => ({
      ...job,
      company: job.company ?? "—",
      jobType: job.jobType ?? "—",
      location: job.location ?? "—",
    }));
  }, [jobs]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Jobs</Typography>
          <Typography variant="body2" color="text.secondary">
            Expand a job to view candidates and jump to analysis.
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" onClick={() => nav("/jobs/new")} startIcon={<AddIcon />}>
          Create Job
        </Button>
      </Box>

      {err && <Alert severity="error">{err}</Alert>}

      {loading && (
        <Paper sx={{ p: 2 }}>
          <Typography sx={{ fontWeight: 700, mb: 1 }}>Loading jobs…</Typography>
          <LinearProgress />
        </Paper>
      )}

      <Paper sx={{ p: 1 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Role</TableCell>
              <TableCell>Company</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Candidates</TableCell>
              <TableCell align="right">Avg Match</TableCell>
              <TableCell>Quick action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobsWithDefaults.map(job => (
              <JobRow
                key={job.id}
                job={job}
                candidates={candidatesByJob.get(job.id) || []}
              />
            ))}

            {!loading && jobsWithDefaults.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} sx={{ color: "text.secondary" }}>
                  No jobs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}