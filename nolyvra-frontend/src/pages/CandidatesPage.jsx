// ─── CandidatesPage.jsx — Smart Talent Lens ──────────────────────────────────
// Structured filter search over internal candidates, rule-based match scoring
// (no AI call, no token cost). Replaces the old plain analysed-candidate table;
// consistency/capability/risk/status now live in the right-side detail panel.
import { useEffect, useState } from "react";
import {
  Box, Paper, Typography, Button, TextField, MenuItem, Switch, Slider,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate } from "react-router-dom";
import { usePlanLimit } from "../hooks/usePlanLimit";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706", WARN_BG = "#FFFBEB", WARN_BR = "#FDE68A";
const DANGER = "#DC2626", DANGER_BG = "#FEF2F2", DANGER_BR = "#FECACA";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE";
const NEUTRAL_BG = "#F1F3F7", SURFACE = "#FAFBFD";

function authHeaders(extra) {
  return { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`, ...extra };
}

// ─── Small shared visual atoms (kept local to this page, matching the rest
//     of the app's per-page styling convention) ──────────────────────────
function Tag({ label, variant = "neutral" }) {
  const s = {
    match:   { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
    gap:     { bg: DANGER_BG,  border: DANGER_BR,  color: DANGER  },
    neutral: { bg: "#F1F3F7",  border: BORDER,     color: MUTED   },
  }[variant] ?? { bg: "#F1F3F7", border: BORDER, color: MUTED };
  return (
    <Box sx={{ display: "inline-flex", px: 1, py: 0.25, bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: "4px", fontSize: 11, fontWeight: 500, color: s.color, m: "2px" }}>
      {label}
    </Box>
  );
}

const TIER_STYLE = {
  "Strong Match":    { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
  "Hidden Gem":      { bg: PURPLE_BG,  border: PURPLE_BR,  color: PURPLE  },
  "Needs Review":    { bg: WARN_BG,    border: WARN_BR,    color: WARN    },
  "Not Recommended": { bg: DANGER_BG,  border: DANGER_BR,  color: DANGER  },
};

function TierBadge({ tier }) {
  const s = TIER_STYLE[tier] ?? { bg: NEUTRAL_BG, border: BORDER, color: MUTED };
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: "20px", px: 1.25, py: 0.25, fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap" }}>
      {tier}
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
      <Box sx={{ mt: 0.5, width: 100, height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
        <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: color, borderRadius: "3px" }} />
      </Box>
    </Box>
  );
}

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "7px", fontSize: 12.5, bgcolor: "#fff",
    "& fieldset": { borderColor: BORDER },
    "&:hover fieldset": { borderColor: "#C0C8D8" },
    "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 1.5 },
  },
};

const AU_STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

function FilterSection({ icon, title, children }) {
  return (
    <Box sx={{ flex: 1, minWidth: 220 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, mb: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
        <span>{icon}</span> {title}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>{children}</Box>
    </Box>
  );
}

function matchQuality(results) {
  if (!results.length) return { pct: 0, label: "—" };
  const avg = Math.round(results.reduce((s, r) => s + (r.matchScore ?? 0), 0) / results.length);
  const label = avg >= 85 ? "High" : avg >= 65 ? "Medium" : "Low";
  return { pct: avg, label };
}

function formatMinSalary(c) {
  if (c.expectedSalaryMin == null) return "—";
  return `${c.salaryCurrency || "AUD"} ${Number(c.expectedSalaryMin).toLocaleString()}`;
}

function skillsPreview(skills) {
  if (!skills || skills.length === 0) return "—";
  return skills.slice(0, 3).join(", ");
}

function formatUpdatedAt(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// "City, State" if both exist, otherwise whichever one is present, otherwise "—"
function formatLocation(c) {
  const parts = [c.location, c.state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

// ─── New "all candidates" table/grid column field list, shared by both views ──
const SUMMARY_FIELDS = [
  { key: "currentTitle", label: "Current Title", get: c => c.currentTitle || "—" },
  { key: "linkedinUrl",  label: "LinkedIn",      get: c => c.linkedinUrl || "—", link: true },
  { key: "jobTitle",     label: "Job Applied",   get: c => c.jobTitle || "—" },
  { key: "email",        label: "Email",         get: c => c.email || "—" },
  { key: "phone",        label: "Phone",         get: c => c.phone || "—" },
  { key: "skills",       label: "Skills",        get: c => skillsPreview(c.skills) },
  { key: "location",     label: "Location",      get: c => formatLocation(c) },
  { key: "yearsExperience", label: "Years Exp",  get: c => c.yearsExperience != null ? `${c.yearsExperience} yrs` : "—" },
  { key: "minSalary",    label: "Min Expected Salary", get: c => formatMinSalary(c) },
];

export default function CandidatesPage() {
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";
  const { checkCandidateLimit, usage } = usePlanLimit();

  const [limitDialog, setLimitDialog] = useState(false);
  const [analysisDialog, setAnalysisDialog] = useState(false);

  // ── Filter panel state ───────────────────────────────────────────────────
  const [jobTitleKeywords, setJobTitleKeywords] = useState("");
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [location, setLocation] = useState("");
  const [searchState, setSearchState] = useState("");
  const [radiusKm, setRadiusKm] = useState(25);
  const [remoteFlexible, setRemoteFlexible] = useState(false);
  const [minYears, setMinYears] = useState("");
  const [maxYears, setMaxYears] = useState("");
  const [seniorityLevel, setSeniorityLevel] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [noticePeriodMaxWeeks, setNoticePeriodMaxWeeks] = useState("");
  const [workRights, setWorkRights] = useState("");

  // ── Results state ────────────────────────────────────────────────────────
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [selected, setSelected] = useState(null);

  // ── Assign-to-job dialog (reuses TalentSearchPage's "+ Pipeline" pattern) ──
  const [assignJobs, setAssignJobs] = useState([]);
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignCandidate, setAssignCandidate] = useState(null);
  const [assignJobId, setAssignJobId] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState("");

  useEffect(() => {
    if (!loginId) return;
    const url = new URL(`${API_BASE}/api/jobs`);
    url.searchParams.set("loginId", loginId);
    fetch(url.toString(), { headers: authHeaders() }).then(r => r.json()).then(setAssignJobs).catch(() => {});
  }, [loginId]);

  function buildFilterPayload() {
    const num = v => (v === "" || v == null ? null : Number(v));
    return {
      skills,
      jobTitleKeywords: jobTitleKeywords.trim() || null,
      location: location.trim() || null,
      state: searchState || null,
      radiusKm: location.trim() && searchState ? radiusKm : null,
      minYears: num(minYears),
      maxYears: num(maxYears),
      seniorityLevel: seniorityLevel || null,
      salaryMin: num(salaryMin),
      salaryMax: num(salaryMax),
      noticePeriodMaxWeeks: num(noticePeriodMaxWeeks),
      workRights: workRights || null,
      remoteFlexible,
    };
  }

  async function runSearch() {
    setLoading(true); setError(null);
    try {
      const url = new URL(`${API_BASE}/api/candidates/search`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(buildFilterPayload()),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResults(data ?? []);
      setSelected(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { runSearch(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  function addSkill() {
    const v = skillInput.trim();
    if (v && !skills.includes(v)) setSkills([...skills, v]);
    setSkillInput("");
  }
  function removeSkill(s) { setSkills(skills.filter(x => x !== s)); }

  function toggleSaved(id) {
    setSavedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function viewProfile(c) {
    if (c.status === "Analysed") nav(`/analysis/${c.candidateId}`);
    else nav(`/candidates/${c.candidateId}/workflow`);
  }

  async function handleRunAnalysis(candidateId) {
    const url = new URL(`${API_BASE}/api/candidates/${candidateId}/analyze`);
    url.searchParams.set("loginId", loginId);
    setAnalysisDialog(true);
    try {
      await fetch(url.toString(), { method: "POST", headers: authHeaders() });
      setResults(prev => prev.map(c => c.candidateId === candidateId ? { ...c, status: "Analysed" } : c));
      setSelected(prev => prev && prev.candidateId === candidateId ? { ...prev, status: "Analysed" } : prev);
    } catch (e) {
      console.error("Failed to run analysis", e);
    }
  }

  function openAssignDialog(c) {
    setAssignCandidate(c); setAssignJobId(""); setAssignError(""); setAssignDialog(true);
  }

  async function handleAssignSave() {
    setAssignSaving(true); setAssignError("");
    try {
      const path = assignJobId ? `/api/jobs/${assignJobId}/candidates` : `/api/candidates`;
      const url = new URL(`${API_BASE}${path}`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          name: assignCandidate?.name ?? "",
          email: assignCandidate?.email ?? "",
          linkedinUrl: assignCandidate?.linkedinUrl ?? "",
          cvText: "",
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setAssignError(res.status === 409 || text.toLowerCase().includes("already in the pipeline")
          ? "This candidate is already in the pipeline for that job."
          : "Failed to assign candidate: " + text);
        return;
      }
      setAssignDialog(false);
      runSearch();
    } catch (e) {
      setAssignError("Failed to assign candidate: " + e.message);
    } finally {
      setAssignSaving(false);
    }
  }

  const quality = matchQuality(results);
  const tierCounts = results.reduce((acc, r) => {
    acc[r.matchTier] = (acc[r.matchTier] ?? 0) + 1;
    return acc;
  }, {});

  const toggleBtn = active => ({
    display: "inline-flex", alignItems: "center", gap: "5px",
    fontSize: 11, fontWeight: active ? 600 : 500,
    px: "10px", py: "5px", border: "none", borderRadius: "6px", cursor: "pointer",
    bgcolor: active ? "#fff" : "transparent",
    color: active ? ACCENT : MUTED,
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
    fontFamily: "inherit",
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Smart Talent Lens</Typography>
            <Box sx={{ display: "inline-flex", px: "7px", py: "2px", bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", fontSize: 10, fontWeight: 600, color: PURPLE }}>AI</Box>
          </Box>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>AI-powered candidate discovery. Smarter matches, deeper insights.</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={() => { if (!checkCandidateLimit()) { setLimitDialog(true); } else { nav("/candidates/new-modern"); } }}
            sx={{ fontSize: 12, fontWeight: 500, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}
          >
            Add Candidate
          </Button>
        </Box>
      </Box>

      {/* ── Filter panel ──────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", p: 2.5, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT, mb: 2 }}>Define your ideal candidate</Typography>
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          <FilterSection icon="🎯" title="Role & Skills">
            <TextField size="small" placeholder="Job title" value={jobTitleKeywords}
              onChange={e => setJobTitleKeywords(e.target.value)} sx={fieldSx} />
            <TextField size="small" placeholder="Add skill or keyword" value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
              sx={fieldSx} />
            <Box>{skills.map(s => (
              <Tag key={s} variant="match" label={<>{s} <Box component="span" onClick={() => removeSkill(s)} sx={{ ml: 0.5, cursor: "pointer", fontWeight: 700 }}>×</Box></>} />
            ))}</Box>
          </FilterSection>

          <FilterSection icon="📍" title="Location Intelligence">
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField size="small" placeholder="City or suburb" value={location}
                onChange={e => setLocation(e.target.value)} sx={{ ...fieldSx, flex: 1.4 }} />
              <TextField select size="small" value={searchState} displayEmpty
                onChange={e => setSearchState(e.target.value)} sx={{ ...fieldSx, flex: 1 }}>
                <MenuItem value="" sx={{ fontSize: 12.5, color: MUTED }}>State</MenuItem>
                {AU_STATES.map(s => (
                  <MenuItem key={s} value={s} sx={{ fontSize: 12.5 }}>{s}</MenuItem>
                ))}
              </TextField>
            </Box>
            <Box sx={{ opacity: location.trim() && searchState ? 1 : 0.45 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 12, color: TEXT }}>Commute radius</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{radiusKm} km</Typography>
              </Box>
              <Slider size="small" value={radiusKm} min={5} max={100} step={5}
                disabled={!(location.trim() && searchState)}
                onChange={(e, v) => setRadiusKm(v)}
                sx={{ color: ACCENT, py: 0.5 }} />
              {!(location.trim() && searchState) && (
                <Typography sx={{ fontSize: 10.5, color: MUTED, mt: -0.5 }}>Enter a city/suburb and state to enable proximity search</Typography>
              )}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 12, color: TEXT }}>Hybrid / Remote flexible</Typography>
              <Switch size="small" checked={remoteFlexible} onChange={e => setRemoteFlexible(e.target.checked)} />
            </Box>
          </FilterSection>

          <FilterSection icon="🧩" title="Experience & Fit">
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField size="small" type="number" placeholder="Min yrs" value={minYears}
                onChange={e => setMinYears(e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
              <TextField size="small" type="number" placeholder="Max yrs" value={maxYears}
                onChange={e => setMaxYears(e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
            </Box>
            <TextField select size="small" value={seniorityLevel} displayEmpty
              onChange={e => setSeniorityLevel(e.target.value)} sx={fieldSx}>
              <MenuItem value="" sx={{ fontSize: 12.5, color: MUTED }}>Seniority Level (any)</MenuItem>
              {["Junior", "Mid", "Mid-Senior", "Senior", "Lead/Principal"].map(s => (
                <MenuItem key={s} value={s} sx={{ fontSize: 12.5 }}>{s}</MenuItem>
              ))}
            </TextField>
          </FilterSection>

          <FilterSection icon="⚙" title="Other Preferences">
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField size="small" type="number" placeholder="Salary min" value={salaryMin}
                onChange={e => setSalaryMin(e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
              <TextField size="small" type="number" placeholder="Salary max" value={salaryMax}
                onChange={e => setSalaryMax(e.target.value)} sx={{ ...fieldSx, flex: 1 }} />
            </Box>
            <TextField size="small" type="number" placeholder="Max notice period (weeks)" value={noticePeriodMaxWeeks}
              onChange={e => setNoticePeriodMaxWeeks(e.target.value)} sx={fieldSx} />
            <TextField select size="small" value={workRights} displayEmpty
              onChange={e => setWorkRights(e.target.value)} sx={fieldSx}>
              <MenuItem value="" sx={{ fontSize: 12.5, color: MUTED }}>Work Rights: Any</MenuItem>
              {["Citizen", "Permanent Resident", "Visa (sponsorship required)"].map(w => (
                <MenuItem key={w} value={w} sx={{ fontSize: 12.5 }}>{w}</MenuItem>
              ))}
            </TextField>
          </FilterSection>

          {/* AI Fit Tuning gauge */}
          <Box sx={{ width: 150, flexShrink: 0, textAlign: "center" }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, mb: 1 }}>
              AI Fit Tuning <Box component="span" sx={{ fontSize: 10, color: SUCCESS, fontWeight: 600 }}>Recommended</Box>
            </Typography>
            <Box sx={{ position: "relative", display: "inline-flex" }}>
              <CircularProgress variant="determinate" value={quality.pct} size={84} thickness={4}
                sx={{ color: quality.pct >= 85 ? SUCCESS : quality.pct >= 65 ? ACCENT : WARN }} />
              <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{quality.pct}%</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>{quality.label} Match Quality</Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
          <Button variant="contained" size="small" onClick={runSearch} disabled={loading}
            sx={{ fontSize: 12, fontWeight: 600, bgcolor: PURPLE, borderRadius: "7px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" } }}>
            {loading ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "✦ Search Candidates"}
          </Button>
        </Box>
      </Paper>

      {error && (
        <Box sx={{ fontSize: 12.5, color: DANGER, bgcolor: DANGER_BG, border: `1px solid ${DANGER_BR}`, borderRadius: "8px", p: 1.5 }}>
          {error}
        </Box>
      )}

      {/* ── Results summary bar ──────────────────────────────────────────── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
            {results.length} candidate{results.length !== 1 ? "s" : ""} found
          </Typography>
          {["Strong Match", "Hidden Gem", "Needs Review", "Not Recommended"].map(t => (
            tierCounts[t] ? <Box key={t} sx={{ fontSize: 11, color: TIER_STYLE[t].color, fontWeight: 600 }}>{tierCounts[t]} {t}</Box> : null
          ))}
        </Box>
        <Box sx={{ display: "inline-flex", p: "2px", bgcolor: "#F1F3F7", border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
          <Box component="button" onClick={() => setViewMode("list")} sx={toggleBtn(viewMode === "list")}>List</Box>
          <Box component="button" onClick={() => setViewMode("grid")} sx={toggleBtn(viewMode === "grid")}>Grid</Box>
        </Box>
      </Box>

      {/* ── Results + detail panel ───────────────────────────────────────── */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, justifyContent: "center", py: 6, color: MUTED, fontSize: 13 }}>
              <CircularProgress size={18} sx={{ color: ACCENT }} /> Loading candidates…
            </Box>
          )}

          {!loading && results.length === 0 && (
            <Box sx={{ textAlign: "center", py: 6, color: MUTED, fontSize: 13 }}>No candidates found.</Box>
          )}

          {/* ── Table view ──────────────────────────────────────────────── */}
          {!loading && results.length > 0 && viewMode === "list" && (
            <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "auto", bgcolor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: SURFACE }}>
                    {["Name", ...SUMMARY_FIELDS.map(f => f.label), "Match", ""].map(h => (
                      <TableCell key={h} sx={{ fontSize: 11, fontWeight: 700, color: MUTED, borderBottom: `1px solid ${BORDER}`, py: 1.25, whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map(c => {
                    const isSelected = selected?.candidateId === c.candidateId;
                    return (
                      <TableRow key={c.candidateId} onClick={() => setSelected(c)}
                        sx={{ cursor: "pointer", bgcolor: isSelected ? ACCENT_BG : "transparent", "&:hover": { bgcolor: isSelected ? ACCENT_BG : SURFACE } }}>
                        <TableCell sx={{ py: 1, borderBottom: `1px solid ${BORDER}` }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {(c.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                            </Box>
                            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT, whiteSpace: "nowrap" }}>
                              {c.name}{c.verified && <Box component="span" sx={{ color: ACCENT, ml: 0.5 }}>✓</Box>}
                            </Typography>
                          </Box>
                        </TableCell>
                        {SUMMARY_FIELDS.map(f => (
                          <TableCell key={f.key} sx={{ py: 1, borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT, whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {f.link && c.linkedinUrl ? (
                              <Typography component="a" href={c.linkedinUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                sx={{ fontSize: 12, color: ACCENT, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                                LinkedIn ↗
                              </Typography>
                            ) : f.get(c)}
                          </TableCell>
                        ))}
                        <TableCell sx={{ py: 1, borderBottom: `1px solid ${BORDER}` }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: TIER_STYLE[c.matchTier]?.color ?? TEXT }}>{c.matchScore}%</Typography>
                            <TierBadge tier={c.matchTier} />
                          </Box>
                        </TableCell>
                        <TableCell sx={{ py: 1, borderBottom: `1px solid ${BORDER}` }} onClick={e => e.stopPropagation()}>
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            <Button size="small" variant="contained" onClick={() => viewProfile(c)}
                              sx={{ fontSize: 11, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                              View
                            </Button>
                            <Box component="button" onClick={() => toggleSaved(c.candidateId)}
                              sx={{ border: `1px solid ${BORDER}`, borderRadius: "6px", bgcolor: "#fff", display: "inline-flex", alignItems: "center", px: 1, cursor: "pointer" }}>
                              {savedIds.has(c.candidateId)
                                ? <BookmarkIcon sx={{ fontSize: 16, color: ACCENT }} />
                                : <BookmarkBorderIcon sx={{ fontSize: 16, color: MUTED }} />}
                            </Box>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* ── Grid (card) view ────────────────────────────────────────── */}
          {!loading && results.length > 0 && viewMode === "grid" && (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 1.25 }}>
              {results.map(c => {
                const isSelected = selected?.candidateId === c.candidateId;
                return (
                  <Paper key={c.candidateId} elevation={0} onClick={() => setSelected(c)}
                    sx={{
                      border: `1px solid ${isSelected ? ACCENT : BORDER}`,
                      borderLeft: `3px solid ${TIER_STYLE[c.matchTier]?.color ?? MUTED}`,
                      borderRadius: "10px", p: 2, bgcolor: "#fff", cursor: "pointer",
                      boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.10)" : "0 1px 3px rgba(0,0,0,0.04)",
                      "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.10)" },
                      transition: "box-shadow .15s",
                    }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5, mb: 1.25 }}>
                      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", minWidth: 0 }}>
                        <Box sx={{ width: 38, height: 38, borderRadius: "50%", bgcolor: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                          {(c.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                        </Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.name}{c.verified && <Box component="span" sx={{ fontSize: 11, color: ACCENT, ml: 0.5 }}>✓</Box>}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        <TierBadge tier={c.matchTier} />
                        <Typography sx={{ fontSize: 18, fontWeight: 700, color: TIER_STYLE[c.matchTier]?.color ?? TEXT, lineHeight: 1.4 }}>{c.matchScore}%</Typography>
                      </Box>
                    </Box>

                    {/* Field summary grid */}
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", mb: 1.25, p: 1.25, bgcolor: SURFACE, border: `1px solid #EEF1F6`, borderRadius: "8px" }}>
                      {SUMMARY_FIELDS.map(f => (
                        <Box key={f.key} sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 9.5, fontWeight: 600, color: "#B4BCC9", textTransform: "uppercase", letterSpacing: "0.4px" }}>{f.label}</Typography>
                          {f.link && c.linkedinUrl ? (
                            <Typography component="a" href={c.linkedinUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              sx={{ fontSize: 11.5, color: ACCENT, textDecoration: "none", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", "&:hover": { textDecoration: "underline" } }}>
                              LinkedIn ↗
                            </Typography>
                          ) : (
                            <Typography sx={{ fontSize: 11.5, color: TEXT, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {f.get(c)}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.75 }} onClick={e => e.stopPropagation()}>
                      <Button size="small" variant="contained" onClick={() => viewProfile(c)}
                        sx={{ flex: 1, fontSize: 11, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                        View Profile
                      </Button>
                      <Box component="button" onClick={() => toggleSaved(c.candidateId)}
                        sx={{ border: `1px solid ${BORDER}`, borderRadius: "6px", bgcolor: "#fff", display: "inline-flex", alignItems: "center", px: 1, cursor: "pointer" }}>
                        {savedIds.has(c.candidateId)
                          ? <BookmarkIcon sx={{ fontSize: 16, color: ACCENT }} />
                          : <BookmarkBorderIcon sx={{ fontSize: 16, color: MUTED }} />}
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>

        {/* ── Right-side detail panel ────────────────────────────────────── */}
        {selected && (
          <Paper elevation={0} sx={{ width: 340, flexShrink: 0, border: `1px solid ${BORDER}`, borderRadius: "10px", p: 2.5, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", position: "sticky", top: 12 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                Profile Review
              </Typography>
              <Box component="button" onClick={() => setSelected(null)} sx={{ border: "none", bgcolor: "transparent", cursor: "pointer", color: MUTED }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </Box>
            </Box>

            {/* Additional candidate info */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2, pb: 2, borderBottom: `1px solid ${BORDER}` }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: 12, color: MUTED }}>Notice Period</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>
                  {selected.noticePeriodWeeks != null ? (selected.noticePeriodWeeks === 0 ? "Immediate" : `${selected.noticePeriodWeeks} weeks`) : "—"}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: 12, color: MUTED }}>Work Rights</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{selected.workRights ?? "—"}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: 12, color: MUTED }}>Hybrid / Remote Flexible</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{selected.remoteFlexible ? "Yes" : "No"}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: 12, color: MUTED }}>Last Updated</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{formatUpdatedAt(selected.updatedAt)}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, color: MUTED, mb: 0.5 }}>Skills</Typography>
                {selected.skills?.length > 0 ? (
                  <Box>{selected.skills.map(s => <Tag key={s} label={s} variant="neutral" />)}</Box>
                ) : (
                  <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>
                )}
              </Box>
              {(location.trim() && searchState) && (
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontSize: 12, color: MUTED }}>Proximity</Typography>
                  {selected.distanceKm != null ? (
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: selected.distanceKm <= radiusKm ? SUCCESS : WARN }}>
                      {selected.distanceKm <= radiusKm ? "✓ Match" : "✗ Not a Match"} (~{selected.distanceKm.toFixed(1)} km from location)
                    </Typography>
                  ) : (
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: DANGER }}>
                      Location Mismatch
                    </Typography>
                  )}
                </Box>
              )}
            </Box>

            {/* Reasons */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 2 }}>
              {selected.matchedSkills?.length > 0 && (
                <Typography sx={{ fontSize: 12, color: TEXT }}>✅ Matches on {selected.matchedSkills.join(", ")}.</Typography>
              )}
              {selected.distanceKm != null && selected.distanceKm <= radiusKm ? (
                <Typography sx={{ fontSize: 12, color: TEXT }}>✅ {selected.distanceKm.toFixed(1)} km from your search location — within your {radiusKm} km radius.</Typography>
              ) : (
                location && selected.location?.toLowerCase().includes(location.toLowerCase()) && (
                  <Typography sx={{ fontSize: 12, color: TEXT }}>✅ Located in {formatLocation(selected)} — fits your location preference.</Typography>
                )
              )}
              {(selected.expectedSalaryMin || selected.expectedSalaryMax) && (
                <Typography sx={{ fontSize: 12, color: TEXT }}>✅ Expected salary {selected.salaryCurrency || "AUD"} {selected.expectedSalaryMin ?? "?"}{selected.expectedSalaryMax ? `–${selected.expectedSalaryMax}` : ""}.</Typography>
              )}
              {selected.noticePeriodWeeks != null && (
                <Typography sx={{ fontSize: 12, color: TEXT }}>✅ {selected.noticePeriodWeeks === 0 ? "Immediately available" : `Available in ${selected.noticePeriodWeeks} weeks`}.</Typography>
              )}
            </Box>

            {/* Potential considerations */}
            {(selected.gapSkills?.length > 0
              || (location && selected.location && !selected.location.toLowerCase().includes(location.toLowerCase()))
              || (selected.distanceKm != null && selected.distanceKm > radiusKm)) && (
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, mb: 0.75 }}>Potential considerations</Typography>
                {selected.gapSkills?.length > 0 && (
                  <Typography sx={{ fontSize: 12, color: WARN }}>⚠ Missing {selected.gapSkills.join(", ")}.</Typography>
                )}
                {location && selected.location && !selected.location.toLowerCase().includes(location.toLowerCase()) && (
                  <Typography sx={{ fontSize: 12, color: WARN }}>⚠ Based in {formatLocation(selected)}, different from your preferred location.</Typography>
                )}
                {selected.distanceKm != null && selected.distanceKm > radiusKm && (
                  <Typography sx={{ fontSize: 12, color: WARN }}>⚠ Proximity not matching — {selected.distanceKm.toFixed(1)} km away, outside your {radiusKm} km radius.</Typography>
                )}
              </Box>
            )}

            {/* Dropped analysis fields */}
            <Box sx={{ borderTop: `1px solid ${BORDER}`, pt: 1.5, mb: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>CV Analysis</Typography>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: 12, color: MUTED }}>Consistency Score</Typography>
                <ScoreBar value={selected.consistencyScore} />
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: 12, color: MUTED }}>Capability Match</Typography>
                <ScoreBar value={selected.capabilityScore} />
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: 12, color: MUTED }}>Risk Level</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{selected.riskLevel ?? "—"}</Typography>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: 12, color: MUTED }}>Status</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{selected.status}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {selected.status === "Analysed" ? (
                <Button variant="contained" fullWidth onClick={() => viewProfile(selected)}
                  sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "7px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                  View Full Profile
                </Button>
              ) : (
                <Button variant="contained" fullWidth onClick={() => handleRunAnalysis(selected.candidateId)}
                  sx={{ fontSize: 12, bgcolor: PURPLE, borderRadius: "7px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" } }}>
                  Run Analysis
                </Button>
              )}
              <Button variant="outlined" fullWidth onClick={() => openAssignDialog(selected)}
                sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "7px", textTransform: "none", "&:hover": { borderColor: ACCENT, color: ACCENT } }}>
                Assign to Job
              </Button>
            </Box>
          </Paper>
        )}
      </Box>

      {/* ── Plan limit dialog ─────────────────────────────────────────────── */}
      <Dialog open={limitDialog} onClose={() => setLimitDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: TEXT, pb: 1 }}>Candidate Limit Reached</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
            You have used all <strong>{usage?.currentCandidates ?? 0} / {usage?.maxCandidates ?? 0}</strong> candidate slots on your <strong>{usage?.planName ?? "Free"}</strong> plan.
          </Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 1, lineHeight: 1.6 }}>
            To add more candidates, please upgrade your plan or remove an existing candidate.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => setLimitDialog(false)} sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" size="small" onClick={() => setLimitDialog(false)} sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>Upgrade Plan</Button>
        </DialogActions>
      </Dialog>

      {/* ── Analysis in progress dialog ───────────────────────────────────── */}
      <Dialog open={analysisDialog} onClose={() => setAnalysisDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: TEXT, pb: 1 }}>🔍 Analysis In Progress</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>Your candidate analysis is being generated. This may take a moment.</Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 1, lineHeight: 1.6 }}>You can view it once complete from the candidate's profile.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" size="small" onClick={() => setAnalysisDialog(false)} sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>OK, Got It</Button>
        </DialogActions>
      </Dialog>

      {/* ── Assign to Job dialog ──────────────────────────────────────────── */}
      <Dialog open={assignDialog} onClose={() => !assignSaving && setAssignDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: TEXT, pb: 1 }}>Assign to Job</DialogTitle>
        <DialogContent>
          {assignCandidate && (
            <Typography sx={{ fontSize: 13, color: MUTED, mb: 2 }}>
              Assigning <strong style={{ color: TEXT }}>{assignCandidate.name}</strong> to a job pipeline.
            </Typography>
          )}
          <TextField select fullWidth size="small" label="Job" value={assignJobId}
            onChange={e => { setAssignJobId(e.target.value); setAssignError(""); }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }}>
            <MenuItem value="" sx={{ fontSize: 13, color: MUTED }}>— Not Assigned —</MenuItem>
            {assignJobs.map(job => (
              <MenuItem key={job.id} value={job.id} sx={{ fontSize: 13 }}>{job.title}{job.company ? ` — ${job.company}` : ""}</MenuItem>
            ))}
          </TextField>
          {assignError && <Typography sx={{ fontSize: 12, color: DANGER, mt: 1.25, fontWeight: 500 }}>⚠ {assignError}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => setAssignDialog(false)} disabled={assignSaving} sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" size="small" onClick={handleAssignSave} disabled={assignSaving} sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            {assignSaving ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Assign"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
