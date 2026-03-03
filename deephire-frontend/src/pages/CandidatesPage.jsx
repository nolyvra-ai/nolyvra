import { Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody, Chip, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { mockCandidates } from "../data/mockCandidates";
import { useNavigate } from "react-router-dom";

function riskColor(risk) {
  if (risk === "High") return "error";
  if (risk === "Medium") return "warning";
  if (risk === "Low") return "info";
  return "default";
}

export default function CandidatesPage() {
  const nav = useNavigate();

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
            {mockCandidates.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{c.name}</TableCell>
                <TableCell>{c.jobId}</TableCell>
                <TableCell align="right">{c.consistencyScore ? `${c.consistencyScore}%` : "—"}</TableCell>
                <TableCell align="right">{c.capabilityScore ? `${c.capabilityScore}%` : "—"}</TableCell>
                <TableCell>
                  <Chip size="small" label={c.risk} color={riskColor(c.risk)} />
                </TableCell>
                <TableCell>{c.status}</TableCell>
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
