import { Box, Paper, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Button, TextField, MenuItem,
  InputAdornment } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString());
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`${res.status} - ${t}`); }
  return res.json();
}

async function apiDelete(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  await fetch(url.toString(), { method: "DELETE" });
}

const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706", WARN_BG = "#FFFBEB", WARN_BR = "#FDE68A";
const DANGER = "#DC2626", DANGER_BG = "#FEF2F2", DANGER_BR = "#FECACA";
const NEUTRAL_BG = "#F1F3F7", ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE", SURFACE = "#FAFBFD";

const thSx = { fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
  letterSpacing: "0.5px", borderBottom: `1px solid ${BORDER}`, bgcolor: SURFACE, py: 1.25, px: 2, whiteSpace: "nowrap" };

function Badge({ label, variant = "neutral" }) {
  const s = { success:{bg:SUCCESS_BG,border:SUCCESS_BR,color:SUCCESS}, warning:{bg:WARN_BG,border:WARN_BR,color:WARN},
    danger:{bg:DANGER_BG,border:DANGER_BR,color:DANGER}, accent:{bg:ACCENT_BG,border:ACCENT_BR,color:ACCENT},
    neutral:{bg:NEUTRAL_BG,border:BORDER,color:MUTED} }[variant] ?? {bg:NEUTRAL_BG,border:BORDER,color:MUTED};
  return (
    <Box sx={{ display:"inline-flex",alignItems:"center",bgcolor:s.bg,border:`1px solid ${s.border}`,
      borderRadius:"20px",px:1.25,py:0.25,fontSize:11,fontWeight:600,color:s.color,whiteSpace:"nowrap" }}>
      {label}
    </Box>
  );
}

function ScoreBar({ value }) {
  if (value == null) return <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>;
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 80 ? SUCCESS : pct >= 60 ? WARN : DANGER;
  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color, lineHeight: 1.2 }}>{pct}%</Typography>
      <Box sx={{ mt: 0.5, width: 72, height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: "3px" }} />
      </Box>
    </Box>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <Box onClick={onClick} sx={{ display:"inline-flex",alignItems:"center",px:1.5,py:0.5,
      borderRadius:"20px",border:`1px solid ${active?ACCENT:BORDER}`,
      bgcolor:active?ACCENT_BG:"#fff",color:active?ACCENT:MUTED,
      fontSize:12,fontWeight:active?600:400,cursor:"pointer",userSelect:"none",
      "&:hover":{borderColor:ACCENT,color:ACCENT},transition:"all .12s" }}>
      {label}
    </Box>
  );
}

export default function CandidatesPage() {
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  const [candidates,    setCandidates]    = useState([]);
  const [analyses,      setAnalyses]      = useState([]);
  const [jobs,          setJobs]          = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [search,        setSearch]        = useState("");
  const [jobFilter,     setJobFilter]     = useState("all");
  const [riskFilter,    setRiskFilter]    = useState("all");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiGet("/api/candidates"),
      apiGet("/api/analyses/recent"),
      apiGet("/api/jobs"),
    ])
      .then(([c, a, j]) => { setCandidates(c); setAnalyses(a); setJobs(j); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [loginId]);

  const analysisMap = new Map(analyses.map(a => [a.candidateId, a]));

  // Merge candidates with their analysis data
  const enriched = candidates.map(c => {
    const a = analysisMap.get(c.id);
    const job = jobs.find(j => j.id === c.jobId);
    return { ...c, jobTitle: job?.title ?? c.jobId,
      consistencyScore: a?.consistencyScore ?? null,
      capabilityScore:  a?.capabilityScore  ?? null,
      riskLevel:        a?.riskLevel        ?? null,
      status:           a ? "Analysed" : "Not Run" };
  });

  const visible = enriched.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchJob  = jobFilter === "all" || c.jobId === jobFilter;
    const matchRisk = riskFilter === "all" || c.riskLevel === riskFilter ||
      (riskFilter === "none" && !c.riskLevel);
    return matchSearch && matchJob && matchRisk;
  });

  async function handleRemove(candidateId, e) {
    e.stopPropagation();
    if (!window.confirm("Remove this candidate?")) return;
    await apiDelete(`/api/candidates/${candidateId}`);
    setCandidates(prev => prev.filter(c => c.id !== candidateId));
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Header */}
      <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Box>
          <Typography sx={{ fontSize:15, fontWeight:600, color:TEXT }}>Candidates</Typography>
          <Typography sx={{ fontSize:11, color:MUTED, mt:0.25 }}>All candidates across active jobs</Typography>
        </Box>
        <Box sx={{ display:"flex", gap:1, alignItems:"center" }}>
          <TextField size="small" placeholder="🔍 Search candidates…" value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize:14, color:MUTED }} /></InputAdornment> }}
            sx={{ width:190, "& .MuiOutlinedInput-root":{ borderRadius:"8px", fontSize:12 } }} />
          <TextField select size="small" value={jobFilter} onChange={e => setJobFilter(e.target.value)}
            sx={{ width:180, "& .MuiOutlinedInput-root":{ borderRadius:"8px", fontSize:12 } }}>
            <MenuItem value="all" sx={{ fontSize:12 }}>All Jobs</MenuItem>
            {jobs.map(j => <MenuItem key={j.id} value={j.id} sx={{ fontSize:12 }}>{j.title}</MenuItem>)}
          </TextField>
          <Button variant="contained" size="small" startIcon={<AddIcon sx={{ fontSize:12 }} />}
            onClick={() => nav("/candidates/new")}
            sx={{ fontSize:11, fontWeight:500, bgcolor:ACCENT, borderRadius:"6px",
              textTransform:"none", boxShadow:"none", "&:hover":{bgcolor:"#1660CC",boxShadow:"none"} }}>
            Add Candidate
          </Button>
        </Box>
      </Box>

      {/* Filter chips */}
      <Box sx={{ display:"flex", gap:1, alignItems:"center", flexWrap:"wrap" }}>
        <Typography sx={{ fontSize:12, color:MUTED, fontWeight:500 }}>Filter by risk:</Typography>
        {[["all","All"], ["High","High Risk"], ["Medium","Medium"], ["Low","Low"], ["none","None"]]
          .map(([v, label]) => (
            <FilterChip key={v} label={`${label} (${v === "all" ? visible.length : enriched.filter(c => v === "none" ? !c.riskLevel : c.riskLevel === v).length})`}
              active={riskFilter === v} onClick={() => setRiskFilter(v)} />
          ))}
        <Typography sx={{ ml:"auto", fontSize:12, color:MUTED }}>{visible.length} candidates</Typography>
      </Box>

      {error && <Box sx={{ p:2, bgcolor:DANGER_BG, border:`1px solid ${DANGER_BR}`, borderRadius:"8px",
        fontSize:12, color:DANGER }}>{error}</Box>}

      {/* Table */}
      <Paper elevation={0} sx={{ border:`1px solid ${BORDER}`, borderRadius:"10px",
        boxShadow:"0 1px 3px rgba(0,0,0,0.05)", overflow:"hidden" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}>Candidate</TableCell>
              <TableCell sx={thSx}>Applied For</TableCell>
              <TableCell sx={{ ...thSx, textAlign:"center" }}>Consistency</TableCell>
              <TableCell sx={{ ...thSx, textAlign:"center" }}>Capability</TableCell>
              <TableCell sx={thSx}>Risk</TableCell>
              <TableCell sx={thSx}>Status</TableCell>
              <TableCell sx={{ ...thSx, textAlign:"right" }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} sx={{ py:4, textAlign:"center", fontSize:12, color:MUTED }}>Loading…</TableCell></TableRow>
            )}
            {!loading && visible.length === 0 && (
              <TableRow><TableCell colSpan={7} sx={{ py:4, textAlign:"center", fontSize:12, color:MUTED }}>No candidates found.</TableCell></TableRow>
            )}
            {visible.map((c, idx) => (
              <TableRow key={c.id}
                onClick={() => nav(`/candidates/${c.id}/workflow`)}
                sx={{ bgcolor: idx%2===1 ? SURFACE : "#fff", cursor:"pointer",
                  "&:hover":{bgcolor:"#F0F4FF"}, "&:last-child td":{borderBottom:"none"} }}>
                <TableCell sx={{ py:1.5, px:2, borderBottom:`1px solid ${BORDER}` }}>
                  <Typography sx={{ fontSize:13, fontWeight:700, color:TEXT, lineHeight:1.2 }}>{c.name}</Typography>
                  {c.email && <Typography sx={{ fontSize:11, color:MUTED, mt:0.25 }}>{c.email}</Typography>}
                </TableCell>
                <TableCell sx={{ py:1.5, px:2, fontSize:12, color:TEXT, borderBottom:`1px solid ${BORDER}` }}>
                  {c.jobTitle}
                </TableCell>
                <TableCell sx={{ py:1.5, px:2, textAlign:"center", borderBottom:`1px solid ${BORDER}` }}>
                  <ScoreBar value={c.consistencyScore} />
                </TableCell>
                <TableCell sx={{ py:1.5, px:2, textAlign:"center", borderBottom:`1px solid ${BORDER}` }}>
                  <ScoreBar value={c.capabilityScore} />
                </TableCell>
                <TableCell sx={{ py:1.5, px:2, borderBottom:`1px solid ${BORDER}` }}>
                  {c.riskLevel
                    ? <Badge label={c.riskLevel} variant={c.riskLevel==="High"?"danger":c.riskLevel==="Medium"?"warning":"accent"} />
                    : <Badge label="—" variant="neutral" />}
                </TableCell>
                <TableCell sx={{ py:1.5, px:2, borderBottom:`1px solid ${BORDER}` }}>
                  <Badge label={c.status}
                    variant={c.status==="Analysed"?"success":c.status==="Not Run"?"accent":"neutral"} />
                </TableCell>
                {/* MVP2: Open Profile + Remove */}
                <TableCell sx={{ py:1.5, px:2, borderBottom:`1px solid ${BORDER}`, textAlign:"right" }}
                  onClick={e => e.stopPropagation()}>
                  <Box sx={{ display:"flex", gap:0.75, justifyContent:"flex-end" }}>
                    <Button size="small" variant="contained"
                      onClick={() => nav(`/candidates/${c.id}/workflow`)}
                      sx={{ fontSize:11, fontWeight:500, bgcolor:ACCENT, borderRadius:"6px",
                        textTransform:"none", boxShadow:"none",
                        "&:hover":{bgcolor:"#1660CC",boxShadow:"none"} }}>
                      Open Profile
                    </Button>
                    <Button size="small" variant="outlined"
                      onClick={e => handleRemove(c.id, e)}
                      sx={{ fontSize:11, fontWeight:500, borderColor:DANGER_BR, color:DANGER,
                        borderRadius:"6px", textTransform:"none",
                        "&:hover":{bgcolor:DANGER_BG,borderColor:DANGER} }}>
                      Remove
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Box sx={{ display:"flex", gap:1, flexWrap:"wrap", mt:0.5 }}>
        {["copyright@ DeepHire","A product of Golden Wattle Ventures Pvt Ltd",
          "This AI tool is designed to assist you, not replace professional judgment."]
          .map(l => <Box key={l} sx={{ display:"inline-flex",alignItems:"center",bgcolor:"#F0F2F6",
            border:`1px solid ${BORDER}`,borderRadius:"5px",px:1,py:0.25,fontSize:10,fontWeight:500,color:MUTED }}>{l}</Box>)}
      </Box>
    </Box>
  );
}
