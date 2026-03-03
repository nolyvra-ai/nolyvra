import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Collapse, Chip, Button
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import AddIcon from "@mui/icons-material/Add";
import { useMemo, useState } from "react";
import { mockJobs } from "../data/mockJobs";
import { mockCandidates } from "../data/mockCandidates";
import { useNavigate } from "react-router-dom";

function riskColor(risk) {
  if (risk === "High") return "error";
  if (risk === "Medium") return "warning";
  if (risk === "Low") return "info";
  return "default";
}

function JobRow({ job, candidates }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const analysed = candidates.filter(c => c.status === "Analysed").length;
  const avg = candidates.length
    ? Math.round(candidates.reduce((s, c) => s + (c.capabilityScore ?? 0), 0) / candidates.length)
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
        <TableCell>{job.company}</TableCell>
        <TableCell>{job.location}</TableCell>
        <TableCell><Chip size="small" label={job.jobType} variant="outlined" /></TableCell>
        <TableCell align="right">{candidates.length}</TableCell>
        <TableCell align="right">{analysed ? `${avg}%` : "—"}</TableCell>
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
                        <TableCell align="right">{c.consistencyScore ? `${c.consistencyScore}%` : "—"}</TableCell>
                        <TableCell align="right">{c.capabilityScore ? `${c.capabilityScore}%` : "—"}</TableCell>
                        <TableCell>
                          <Chip size="small" label={c.risk} color={riskColor(c.risk)} />
                        </TableCell>
                        <TableCell>{c.status}</TableCell>
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

  const candidatesByJob = useMemo(() => {
    const map = new Map();
    for (const j of mockJobs) map.set(j.id, []);
    for (const c of mockCandidates) {
      if (!map.has(c.jobId)) map.set(c.jobId, []);
      map.get(c.jobId).push(c);
    }
    return map;
  }, []);

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
            {mockJobs.map(job => (
              <JobRow key={job.id} job={job} candidates={candidatesByJob.get(job.id) || []} />
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
