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
  TextField,
  MenuItem,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlanLimit } from "../hooks/usePlanLimit";

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
const NEUTRAL_BG = "#F1F3F7";
const ACCENT_BG = "#EBF2FF";
const ACCENT_BR = "#BFDBFE";
const SURFACE = "#FAFBFD";

// ─── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ risk }) {
  const cfg = {
    High: { bg: DANGER_BG, border: DANGER_BR, color: DANGER, label: "High" },
    Medium: { bg: WARN_BG, border: WARN_BR, color: WARN, label: "Medium" },
    Low: { bg: ACCENT_BG, border: ACCENT_BR, color: ACCENT, label: "Low" },
    default: { bg: NEUTRAL_BG, border: BORDER, color: MUTED, label: risk || "—" },
  };
  const s = cfg[risk] ?? cfg.default;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        bgcolor: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: "20px",
        px: 1.25,
        py: 0.25,
        fontSize: 11,
        fontWeight: 600,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      <Box
        sx={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          bgcolor: s.color,
          flexShrink: 0,
        }}
      />
      {s.label}
    </Box>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    Approved: { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
    Review: { bg: WARN_BG, border: WARN_BR, color: WARN },
    Flagged: { bg: DANGER_BG, border: DANGER_BR, color: DANGER },
    "Not Run": { bg: ACCENT_BG, border: ACCENT_BR, color: ACCENT },
    Pending: { bg: NEUTRAL_BG, border: BORDER, color: MUTED },
    Analysed: { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
    default: { bg: NEUTRAL_BG, border: BORDER, color: MUTED },
  };
  const s = cfg[status] ?? cfg.default;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        bgcolor: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: "20px",
        px: 1.25,
        py: 0.25,
        fontSize: 11,
        fontWeight: 600,
        color: s.color,
        whiteSpace: "nowrap",
      }}
    >
      {status || "Pending"}
    </Box>
  );
}

// ─── Mini score bar ───────────────────────────────────────────────────────────
function ScoreBar({ value }) {
  if (value == null) return <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>;
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 80 ? SUCCESS : pct >= 60 ? WARN : DANGER;
  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.2 }}>
        {pct}%
      </Typography>
      <Box
        sx={{
          mt: 0.5,
          width: 68,
          height: 5,
          bgcolor: "#F0F2F6",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            width: `${pct}%`,
            height: "100%",
            bgcolor: color,
            borderRadius: "3px",
          }}
        />
      </Box>
    </Box>
  );
}

// ─── Risk flag cell ───────────────────────────────────────────────────────────
function RiskFlagCell({ risk, flagCount }) {
  if (!risk || risk === "Pending") {
    return (
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          bgcolor: NEUTRAL_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: "20px",
          px: 1.25,
          py: 0.25,
          fontSize: 11,
          fontWeight: 600,
          color: MUTED,
        }}
      >
        None
      </Box>
    );
  }
  const cfg = {
    High: { bg: DANGER_BG, border: DANGER_BR, color: DANGER },
    Medium: { bg: WARN_BG, border: WARN_BR, color: WARN },
    Low: { bg: ACCENT_BG, border: ACCENT_BR, color: ACCENT },
  };
  const s = cfg[risk] ?? cfg[NEUTRAL_BG];
  const label = flagCount ? `${flagCount} ${risk}` : risk;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        bgcolor: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: "20px",
        px: 1.25,
        py: 0.25,
        fontSize: 11,
        fontWeight: 600,
        color: s.color,
      }}
    >
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: s.color }} />
      {label}
    </Box>
  );
}

// ─── Filter chip button ───────────────────────────────────────────────────────
function FilterChip({ label, active, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1.5,
        py: 0.5,
        borderRadius: "20px",
        border: `1px solid ${active ? ACCENT : BORDER}`,
        bgcolor: active ? ACCENT_BG : "#fff",
        color: active ? ACCENT : MUTED,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        userSelect: "none",
        "&:hover": { borderColor: ACCENT, color: ACCENT },
        transition: "all .12s",
      }}
    >
      {label}
    </Box>
  );
}

// ─── Table header cell ────────────────────────────────────────────────────────
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function CandidatesPage() {
  const nav = useNavigate();
  const { checkCandidateLimit, usage } = usePlanLimit();
  const [limitDialog, setLimitDialog] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("All");

  // ── Data loading (unchanged) ─────────────────────────────────────────────
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
                  consistencyScore: analysis?.consistencyScore ?? null,
                  capabilityScore: analysis?.capabilityScore ?? null,
                  risk: analysis?.riskLevel ?? null,
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

  // ── Derived filter counts ────────────────────────────────────────────────
  const counts = {
    All: candidates.length,
    High: candidates.filter((c) => c.risk === "High").length,
    Medium: candidates.filter((c) => c.risk === "Medium").length,
    Low: candidates.filter((c) => c.risk === "Low").length,
  };

  // ── Filtered rows ────────────────────────────────────────────────────────
  const visible = candidates.filter((c) => {
    const matchSearch = !search
      || (c.name ?? "").toLowerCase().includes(search.toLowerCase())
      || (c.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchJob = jobFilter === "all" || c.jobId === jobFilter;
    const matchRisk = riskFilter === "All" || c.risk === riskFilter;
    return matchSearch && matchJob && matchRisk;
  });

  async function handleRunAnalysis(candidateId) {
    const loginId = localStorage.getItem("loginId") || "";
    console.log("candidateId = " + candidateId);
    const url = new URL(`${API_BASE}/api/candidates/${candidateId}/analyze`);
    url.searchParams.set("loginId", loginId);

    try {
      await fetch(url.toString(), { method: "POST" });
      // Refresh candidates list after analysis triggered
      setCandidates(prev =>
        prev.map(c =>
          c.id === candidateId ? { ...c, status: "Analysed" } : c
        )
      );
    } catch (e) {
      console.error("Failed to run analysis", e);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        bgcolor: "#F7F8FA",
      }}
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderBottom: `1px solid ${BORDER}`,
          px: 3,
          py: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: "-0.2px" }}>
            Candidates
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            All candidates across active jobs
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* Search */}
          <TextField
            size="small"
            placeholder="Search candidates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 15, color: MUTED }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: 190,
              "& .MuiOutlinedInput-root": {
                borderRadius: "7px",
                fontSize: 12,
                bgcolor: SURFACE,
                "& fieldset": { borderColor: BORDER },
                "&:hover fieldset": { borderColor: "#C0C8D8" },
                "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 1.5 },
              },
            }}
          />

          {/* Job filter */}
          <TextField
            select
            size="small"
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            sx={{
              width: 180,
              "& .MuiOutlinedInput-root": {
                borderRadius: "7px",
                fontSize: 12,
                bgcolor: SURFACE,
                "& fieldset": { borderColor: BORDER },
                "&:hover fieldset": { borderColor: "#C0C8D8" },
                "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 1.5 },
              },
            }}
          >
            <MenuItem value="all" sx={{ fontSize: 12 }}>All Jobs</MenuItem>
            {jobs.map((j) => (
              <MenuItem key={j.id} value={j.id} sx={{ fontSize: 12 }}>
                {j.title}
              </MenuItem>
            ))}
          </TextField>

          {/* Add Candidate */}
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={() => { if (!checkCandidateLimit()) { setLimitDialog(true); } else { nav("/candidates/new"); } }}
            sx={{
              fontSize: 12,
              fontWeight: 500,
              bgcolor: ACCENT,
              borderRadius: "6px",
              textTransform: "none",
              boxShadow: "none",
              "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
            }}
          >
            Add Candidate
          </Button>
        </Box>
      </Box>

      {/* ── Scrollable content ─────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>

        {/* Risk filter chips + count */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 1.75,
          }}
        >
          <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>
            Filter by risk:
          </Typography>
          {["All", "High", "Medium", "Low"].map((r) => (
            <FilterChip
              key={r}
              label={`${r}${r === "All" ? ` (${counts.All})` : ` Risk (${counts[r]})`}`}
              active={riskFilter === r}
              onClick={() => setRiskFilter(r)}
            />
          ))}
          <Typography sx={{ fontSize: 12, color: MUTED, ml: "auto" }}>
            {visible.length} candidate{visible.length !== 1 ? "s" : ""}
          </Typography>
        </Box>

        {/* Table card */}
        <Paper
          elevation={0}
          sx={{
            border: `1px solid ${BORDER}`,
            borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            overflow: "hidden",
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Candidate</TableCell>
                <TableCell sx={thSx}>Applied For</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "center" }}>Consistency Score</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "center" }}>Capability Match</TableCell>
                <TableCell sx={thSx}>Risk Flags</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "center" }}>Status</TableCell>
                {/*<TableCell sx={thSx}>Analysed</TableCell>*/}
                <TableCell sx={{ ...thSx, textAlign: "right" }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    sx={{ textAlign: "center", py: 5, color: MUTED, fontSize: 13 }}
                  >
                    No candidates found
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((c, idx) => (
                  <TableRow
                    key={c.id}
                    onClick={() => c.status === "Analysed" && nav(`/analysis/${c.id}`)}
                    sx={{
                      bgcolor: idx % 2 === 1 ? SURFACE : "#fff",
                      cursor: c.status === "Analysed" ? "pointer" : "default",
                      "&:hover": {
                        bgcolor: "#EBF2FF",
                        "& .row-action": { opacity: 1 },
                      },
                      "&:last-child td": { borderBottom: "none" },
                      transition: "background .1s",
                    }}
                  >
                    {/* Candidate name + email */}
                    <TableCell
                      sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
                        {c.name || "—"}
                      </Typography>
                      {c.email && (
                        <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
                          {c.email}
                        </Typography>
                      )}
                    </TableCell>

                    {/* Job */}
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT }}>
                      {c.jobTitle || c.jobId || "—"}
                    </TableCell>

                    {/* Consistency score */}
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "center" }}>
                      <Box sx={{ display: "inline-block", textAlign: "left" }}>
                        <ScoreBar value={c.consistencyScore} />
                      </Box>
                    </TableCell>

                    {/* Capability score */}
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "center" }}>
                      <Box sx={{ display: "inline-block", textAlign: "left" }}>
                        <ScoreBar value={c.capabilityScore} />
                      </Box>
                    </TableCell>

                    {/* Risk flags */}
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <RiskFlagCell risk={c.risk} />
                    </TableCell>

                    {/* Status */}
                    <TableCell sx={{ py: 1.5, px: 2, textAlign: "center", borderBottom: `1px solid ${BORDER}` }}>
                      <StatusBadge status={c.status} />
                    </TableCell>

                    {/* Analysed date */}
                    {/*  <TableCell
                      sx={{
                        py: 1.5,
                        px: 2,
                        borderBottom: `1px solid ${BORDER}`,
                        fontSize: 11,
                        color: MUTED,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.analysedAt
                        ? new Date(c.analysedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell> */}

                    {/* Action button */}
                    <TableCell
                      sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="small"
                        variant="contained"
                        className="row-action"
                        onClick={() => c.status === "Analysed" ? nav(`/analysis/${c.id}`) : handleRunAnalysis(c.id)}
                        sx={{
                          fontSize: 11,
                          fontWeight: 500,
                          bgcolor: ACCENT,
                          borderRadius: "6px",
                          textTransform: "none",
                          boxShadow: "none",
                          whiteSpace: "nowrap",
                          "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
                        }}
                      >
                        {c.status === "Analysed" ? "View Results" : "Run Analysis"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>

        {/* Annotation strip */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2 }}>
          {[
            "copyright@ DeepHire",
            "A product of Golden Wattle Ventures Pvt Ltd",
            "This AI tool is designed to assist you, not replace professional judgment. Always consult with a qualified expert.",
          ].map((label) => (
            <Chip
              key={label}
              label={label}
              size="small"
              sx={{
                fontSize: 10,
                fontWeight: 500,
                bgcolor: "#F0F2F6",
                color: MUTED,
                height: 22,
                borderRadius: "5px",
                border: `1px solid ${BORDER}`,
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Plan limit dialog */}
      <Dialog open={limitDialog} onClose={() => setLimitDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: TEXT, pb: 1 }}>
          Candidate Limit Reached
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
            You have used all <strong>{usage?.currentCandidates ?? 0} / {usage?.maxCandidates ?? 0}</strong> candidate
            slots on your <strong>{usage?.planName ?? "Free"}</strong> plan.
          </Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 1, lineHeight: 1.6 }}>
            To add more candidates, please upgrade your plan or remove an existing candidate.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => setLimitDialog(false)}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" size="small" onClick={() => setLimitDialog(false)}
            sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            Upgrade Plan
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
