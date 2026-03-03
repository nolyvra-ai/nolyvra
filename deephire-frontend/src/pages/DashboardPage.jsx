import { Box, Grid, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody, Chip } from "@mui/material";
import { mockJobs } from "../data/mockJobs";
import { mockCandidates } from "../data/mockCandidates";
import { useNavigate } from "react-router-dom";
import StatCard from "../components/StatCard";
import { Button, LinearProgress } from "@mui/material";

function Stat({ label, value }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>{value}</Typography>
    </Paper>
  );
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

  const analysed = mockCandidates.filter(c => c.status === "Analysed").length;
  const avgMatch = Math.round(
    mockCandidates
      .filter(c => c.capabilityScore != null)
      .reduce((s, c) => s + c.capabilityScore, 0) / Math.max(1, analysed)
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Dashboard</Typography>
        <Typography variant="body2" color="text.secondary">
          Quick snapshot of jobs, candidates and recent analyses.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "1fr 1fr",
            md: "repeat(4, 1fr)",
          },
          gap: 2,
          width: "100%",
        }}
      >
        <StatCard label="Active Jobs" value={mockJobs.length} subtext="↑ 1 this week" accent="success" />
        <StatCard label="Total Candidates" value={mockCandidates.length} subtext="↑ 4 this week" accent="success" />
        <StatCard label="Analyses Run" value={analysed} subtext="All processed" accent="primary" />
        <StatCard label="High-risk Flags" value={4} subtext="Needs review" accent="error" />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Recent Jobs */}
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}></Typography>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>
              Recent Jobs
            </Typography>

            <Box sx={{ flex: 1 }} />

            <Button
              variant="text"
              onClick={() => nav("/jobs")}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                fontSize: 13,
              }}
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
                <TableCell sx={{ fontWeight: 700 }} align="center">Candidates</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Job Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {mockJobs.slice(0, 5).map(j => (
                <TableRow key={j.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {j.title}
                  </TableCell>

                  <TableCell>
                    {j.company}
                  </TableCell>

                  {/* Candidates Count */}
                  <TableCell align="center">
                    <Chip
                      label={j.candidateCount || Math.floor(Math.random() * 5) + 1}
                      size="small"
                      sx={{
                        bgcolor: "#EEF2F7",
                        fontWeight: 600,
                        borderRadius: "8px",
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">

                    <Chip
                      label={j.jobType}
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

                  {/* Status */}
                  <TableCell>
                    <Chip
                      label={j.status || "Active"}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        bgcolor:
                          j.status === "Draft"
                            ? "#FFF4E5"
                            : "#E8F5E9",
                        color:
                          j.status === "Draft"
                            ? "#D97706"
                            : "#16A34A",
                        borderRadius: "8px",
                      }}
                    />
                  </TableCell>

                  {/* Action */}
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => nav("/jobs")}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        borderRadius: "10px",
                      }}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {/* Recent Analyses */}
        <Paper sx={{ p: 2 }}>
          {/* Header row with View All */}
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>
              Recent Candidate Analyses
            </Typography>
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
              {mockCandidates
                .filter((c) => c.status === "Analysed")
                .slice(0, 5)
                .map((c) => {
                  const consistencyColor = scoreColor(c.consistencyScore);
                  const capabilityColor = scoreColor(c.capabilityScore);

                  const riskLevel = c.riskLevel || c.risk || "Medium";
                  const riskCount = c.riskFlagCount ?? (riskLevel === "High" ? 2 : riskLevel === "Medium" ? 1 : 0);
                  const riskStyle = riskFlagStyles(riskLevel);

                  return (
                    <TableRow
                      key={c.id}
                      hover
                      sx={{
                        "& td": { py: 1 },   // tighter vertical padding
                      }}
                    >
                      {/* Candidate */}
                      <TableCell sx={{ fontWeight: 700 }}>
                        {c.name}
                      </TableCell>

                      {/* Job */}
                      <TableCell sx={{ color: "text.secondary", fontWeight: 600 }}>
                        {c.jobTitle || "Sr. Backend Eng."}
                      </TableCell>

                      {/* Consistency with mini progress bar */}
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: 12, color: consistencyColor }}>
                            {c.consistencyScore}%
                          </Typography>

                          <Box sx={{ width: 90 }}>
                            <LinearProgress
                              variant="determinate"
                              value={c.consistencyScore}
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

                      {/* Capability colored */}
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: 12, color: capabilityColor }}>
                          {c.capabilityScore}%
                        </Typography>
                      </TableCell>

                      {/* Risk flags chip */}
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

                      {/* Results button */}
                      <TableCell align="right">
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => nav(`/analysis/${c.id}`)}
                          sx={{
                            textTransform: "none",
                            fontWeight: 700,
                            borderRadius: "10px",
                          }}
                        >
                          Results
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Box>
  );
}

