import { Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody, Chip, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useState } from "react";
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

export default function CandidatesPage() {
  const nav = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const jobsResp = await apiGet("/api/jobs");
        setJobs(jobsResp ?? []);

        const allCandidates = [];

        for (const job of jobsResp ?? []) {
          try {
            const candidatesResp = await apiGet(`/api/jobs/${job.id}/candidates`);

            for (const c of candidatesResp ?? []) {
              try {
                const analysis = await apiGet(`/api/candidates/${c.id}/analysis`);

                allCandidates.push({
                  ...c,
                  jobTitle: job.title,
                  consistencyScore: analysis?.scores?.consistencyScore ?? null,
                  capabilityScore: analysis?.scores?.capabilityScore ?? null,
                  risk: analysis?.scores?.riskLevel ?? null,
                  status: "Analysed",
                });
              } catch {
                allCandidates.push({
                  ...c,
                  jobTitle: job.title,
                  consistencyScore: null,
                  capabilityScore: null,
                  risk: null,
                  status: "Pending",
                });
              }
            }
          } catch (e) {
            console.warn("Failed to load candidates for job", job.id, e);
          }
        }

        setCandidates(allCandidates);
      } catch (e) {
        console.error("Failed to load candidates page", e);
      }
    }

    load();
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Candidates</Typography>
          <Typography variant="body2" color="text.secondary">
            All candidates across jobs.
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => nav("/candidates/new")}>
          Add Candidate
        </Button>
      </Box>

      <Paper sx={{ p: 1 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Job</TableCell>
              <TableCell align="right">Consistency</TableCell>
              <TableCell align="right">Capability</TableCell>
              <TableCell>Risk</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {candidates.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{c.name}</TableCell>
                <TableCell>{c.jobTitle || c.jobId}</TableCell>
                <TableCell align="right">{c.consistencyScore ? `${c.consistencyScore}%` : "—"}</TableCell>
                <TableCell align="right">{c.capabilityScore ? `${c.capabilityScore}%` : "—"}</TableCell>
                <TableCell>
                  <Chip size="small" label={c.risk || "—"} color={riskColor(c.risk)} />
                </TableCell>
                <TableCell>{c.status || "Pending"}</TableCell>
                <TableCell>
                  <Button size="small" onClick={() => nav(`/analysis/${c.id}`)}>
                    {c.status === "Analysed" ? "View analysis" : "Analyse"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}