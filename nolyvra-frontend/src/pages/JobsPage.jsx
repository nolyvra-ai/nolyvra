import {
  Box, Paper, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Button, TextField, InputAdornment,
  Alert, LinearProgress, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`${res.status} - ${t}`); }
  return res.json();
}

async function apiDelete(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } });
  if (!res.ok && res.status !== 204) { const t = await res.text().catch(() => ""); throw new Error(`${res.status} - ${t}`); }
}

async function apiPostJson(path, body = undefined) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}`
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;
    try { message = JSON.parse(text)?.message || JSON.parse(text)?.error || text; } catch {}
    throw new Error(message || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

// ─── Style tokens ─────────────────────────────────────────────────────────────
const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706", WARN_BG = "#FFFBEB", WARN_BR = "#FDE68A";
const DANGER = "#DC2626", DANGER_BG = "#FEF2F2", DANGER_BR = "#FECACA";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";
const NEUTRAL_BG = "#F1F3F7", SURFACE = "#FAFBFD", SELECTED_BG = "#EBF2FF";

const thSx = {
  fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
  letterSpacing: "0.5px", borderBottom: `1px solid ${BORDER}`,
  bgcolor: SURFACE, py: 1.25, px: 2, whiteSpace: "nowrap",
};

// ─── Shared UI components ─────────────────────────────────────────────────────
function Badge({ label, variant = "neutral" }) {
  const s = {
    success: { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
    warning: { bg: WARN_BG, border: WARN_BR, color: WARN },
    danger: { bg: DANGER_BG, border: DANGER_BR, color: DANGER },
    accent: { bg: ACCENT_BG, border: ACCENT_BR, color: ACCENT },
    neutral: { bg: NEUTRAL_BG, border: BORDER, color: MUTED },
  }[variant] ?? { bg: NEUTRAL_BG, border: BORDER, color: MUTED };
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", bgcolor: s.bg,
      border: `1px solid ${s.border}`, borderRadius: "20px", px: 1.25, py: 0.25,
      fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap"
    }}>
      {label}
    </Box>
  );
}

function StatusBadge({ status }) {
  const map = {
    Active:      "success",
    Approved:    "success",
    Fulfilling:  "warning",
    Complete:    "neutral",
    Review:      "warning",
    Draft:       "warning",
    Flagged:     "danger",
    "Not Run":   "accent",
    Pending:     "neutral",
    Analysed:    "success",
  };
  return <Badge label={status || "Active"} variant={map[status] ?? "neutral"} />;
}

function HubSpotJobBadge({ status }) {
  if (!status) return <Badge label="HubSpot" variant="neutral" />;
  if (status.state === "linked") return <Badge label="In HubSpot" variant="success" />;
  if (status.state === "sync_failed") return <Badge label="HubSpot failed" variant="danger" />;
  if (status.state === "disconnected") return <Badge label="HubSpot off" variant="neutral" />;
  return <Badge label="Not in HubSpot" variant="neutral" />;
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
    <Box onClick={onClick} sx={{
      display: "inline-flex", alignItems: "center", px: 1.5, py: 0.5,
      borderRadius: "20px", border: `1px solid ${active ? ACCENT : BORDER}`,
      bgcolor: active ? ACCENT_BG : "#fff", color: active ? ACCENT : MUTED,
      fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", userSelect: "none",
      "&:hover": { borderColor: ACCENT, color: ACCENT }, transition: "all .12s",
    }}>{label}</Box>
  );
}

function AvgMatch({ value }) {
  if (!value) return <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>;
  const color = value >= 80 ? SUCCESS : value >= 60 ? WARN : DANGER;
  return <Typography sx={{ fontSize: 13, fontWeight: 700, color }}>{value}%</Typography>;
}

function StageBadge({ stage }) {
  const cfg = {
    Screening: { variant: "accent", label: "Screening" },
    Interview: { variant: "warning", label: "Interview" },
    Assessment: { variant: "warning", label: "Assessment" },
    Offer: { variant: "success", label: "Offer" },
    Selected: { variant: "success", label: "Selected" },
    Rejected: { variant: "danger", label: "Rejected" },
  };
  const c = cfg[stage] ?? { variant: "neutral", label: stage ?? "—" };
  return <Badge label={c.label} variant={c.variant} />;
}
// ─── Candidate sub-table ──────────────────────────────────────────────────────
function CandidateSubTable({ candidates, jobTitle, onRunAnalysis, onRemoveCandidate, onAnalysisStarted }) {
  const nav = useNavigate();

  if (candidates.length === 0) {
    return (
      <Box sx={{ px: 3, py: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: 13, color: MUTED }}>No candidates added to this job yet.</Typography>
      </Box>
    );
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell sx={thSx}>Candidate</TableCell>
          <TableCell sx={thSx}>Applied For</TableCell>
          <TableCell sx={thSx}>Stage</TableCell>
          <TableCell sx={{ ...thSx, textAlign: "center" }}>Consistency Score</TableCell>
          <TableCell sx={{ ...thSx, textAlign: "center" }}>Capability Match</TableCell>
          <TableCell sx={thSx}>Risk Flags</TableCell>
          <TableCell sx={{ ...thSx, textAlign: "center" }}>Status</TableCell>
          <TableCell sx={{ ...thSx, textAlign: "right" }} />
        </TableRow>
      </TableHead>
      <TableBody>
        {candidates.map((c, idx) => (
          <TableRow key={c.id}
            onClick={() => nav(`/candidates/${c.id}/workflow`)}
            sx={{
              bgcolor: idx % 2 === 1 ? SURFACE : "#fff", cursor: "pointer",
              "&:hover": { bgcolor: "#F0F4FF" }, "&:last-child td": { borderBottom: "none" }
            }}>

            <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
                {c.name || "—"}
              </Typography>
              {c.email && <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>{c.email}</Typography>}
            </TableCell>
            <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
              {jobTitle}
            </TableCell>
            <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
              <StageBadge stage={c.stage} />
            </TableCell>
            <TableCell sx={{ py: 1.5, px: 2, textAlign: "center", borderBottom: `1px solid ${BORDER}` }}>
              <Box sx={{ display: "inline-block", textAlign: "left" }}><ScoreBar value={c.consistencyScore} /></Box>
            </TableCell>
            <TableCell sx={{ py: 1.5, px: 2, textAlign: "center", borderBottom: `1px solid ${BORDER}` }}>
              <Box sx={{ display: "inline-block", textAlign: "left" }}><ScoreBar value={c.capabilityScore} /></Box>
            </TableCell>
            <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
              {c.risk
                ? <Badge label={c.risk} variant={c.risk === "High" ? "danger" : c.risk === "Medium" ? "warning" : "accent"} />
                : <Badge label="—" variant="neutral" />}
            </TableCell>
            <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
              <StatusBadge status={c.status} />
            </TableCell>
            <TableCell sx={{ py: 1.5, px: 2, textAlign: "right", borderBottom: `1px solid ${BORDER}` }}
              onClick={e => e.stopPropagation()}>
              <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end" }}>
                {c.status === "Analysed" ? (
                  <Button size="small" variant="contained"
                    onClick={() => nav(`/candidates/${c.id}/workflow`)}
                    sx={{
                      fontSize: 11, fontWeight: 500, bgcolor: ACCENT, borderRadius: "6px",
                      textTransform: "none", boxShadow: "none", whiteSpace: "nowrap",
                      "&:hover": { bgcolor: "#1660CC", boxShadow: "none" }
                    }}>
                    Open Profile
                  </Button>
                ) : (
                  <Button size="small" variant="contained"
                    onClick={() => { onRunAnalysis(c.id); onAnalysisStarted(); }}
                    sx={{
                      fontSize: 11, fontWeight: 500, bgcolor: ACCENT, borderRadius: "6px",
                      textTransform: "none", boxShadow: "none", whiteSpace: "nowrap",
                      "&:hover": { bgcolor: "#1660CC", boxShadow: "none" }
                    }}>
                    Run Analysis
                  </Button>
                )}
                <Button size="small" variant="outlined"
                  onClick={e => { e.stopPropagation(); onRemoveCandidate(c.id); }}
                  sx={{
                    fontSize: 11, fontWeight: 500, borderColor: DANGER_BR, color: DANGER,
                    borderRadius: "6px", textTransform: "none",
                    "&:hover": { bgcolor: DANGER_BG, borderColor: DANGER }
                  }}>
                  Remove
                </Button>
              </Box>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Suitable Candidate card (internal DB match) ───────────────────────────────
function SuitableCandidateCard({ c, onView, onAdd, adding, added, alreadyOnJob }) {
  const tierColor = c.matchTier === "Strong Match" ? SUCCESS
    : c.matchTier === "Hidden Gem" ? PURPLE
    : c.matchTier === "Needs Review" ? WARN : DANGER;
  return (
    <Box onClick={onView} sx={{
      display: "flex", alignItems: "center", gap: 1.25, p: "10px 14px",
      border: `1px solid ${BORDER}`, borderLeft: `3px solid ${tierColor}`, borderRadius: "8px",
      bgcolor: "#fff", cursor: "pointer", "&:hover": { boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
    }}>
      <Box sx={{ width: 30, height: 30, borderRadius: "50%", bgcolor: ACCENT, color: "#fff", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {(c.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.name}
        </Typography>
        <Typography sx={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[c.currentTitle, c.location].filter(Boolean).join(" · ") || "—"}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tierColor }}>{c.matchScore}%</Typography>
        <Typography sx={{ fontSize: 9.5, color: MUTED }}>{c.matchTier}</Typography>
      </Box>
      {alreadyOnJob ? (
        <Badge label="On This Job" variant="neutral" />
      ) : (
        <Button size="small" variant={added ? "outlined" : "contained"}
          onClick={e => { e.stopPropagation(); if (!adding && !added) onAdd(); }}
          disabled={adding || added}
          sx={{
            fontSize: 10.5, fontWeight: 500, ml: 0.5, flexShrink: 0, borderRadius: "6px",
            textTransform: "none", whiteSpace: "nowrap",
            ...(added
              ? { borderColor: SUCCESS_BR, color: SUCCESS }
              : { bgcolor: ACCENT, boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } })
          }}>
          {adding ? <CircularProgress size={12} sx={{ color: added ? SUCCESS : "#fff" }} /> : added ? "Added ✓" : "Add to Job"}
        </Button>
      )}
    </Box>
  );
}

// ─── External Candidate card (Bright Data / LinkedIn match) ────────────────────
function ExternalCandidateCard({ c, onAdd, adding, added }) {
  const hasPhoto = !!c.avatarUrl && c.defaultAvatar !== true;
  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 1.25, p: "10px 14px",
      border: `1px solid ${PURPLE_BR}`, borderLeft: `3px solid ${PURPLE}`, borderRadius: "8px", bgcolor: "#fff",
    }}>
      <Box sx={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", bgcolor: hasPhoto ? "transparent" : PURPLE, color: "#fff", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {hasPhoto
          ? <Box component="img" src={c.avatarUrl} alt={c.name || ""} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : (c.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.name}
        </Typography>
        <Typography sx={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[c.currentTitle, c.currentCompany].filter(Boolean).join(" at ") || "—"}
        </Typography>
        {c.matchedSkills?.length > 0 && (
          <Typography sx={{ fontSize: 10.5, color: SUCCESS, mt: 0.25 }}>
            Matches: {c.matchedSkills.join(", ")}
          </Typography>
        )}
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: PURPLE }}>{c.matchScore}%</Typography>
        {c.linkedinUrl && (
          <Typography component="a" href={c.linkedinUrl} target="_blank" rel="noreferrer"
            sx={{ fontSize: 10.5, color: ACCENT, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
            LinkedIn ↗
          </Typography>
        )}
        <Button size="small" variant={added ? "outlined" : "contained"}
          onClick={() => { if (!adding && !added) onAdd(); }}
          disabled={adding || added}
          sx={{
            fontSize: 10.5, fontWeight: 500, borderRadius: "6px", textTransform: "none", whiteSpace: "nowrap",
            ...(added
              ? { borderColor: SUCCESS_BR, color: SUCCESS }
              : { bgcolor: PURPLE, boxShadow: "none", "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" } })
          }}>
          {adding ? <CircularProgress size={12} sx={{ color: added ? SUCCESS : "#fff" }} /> : added ? "Added ✓" : "Add to Job"}
        </Button>
      </Box>
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function JobsPage() {
  const nav = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [candidatesByJob, setCandidatesByJob] = useState(new Map());
  const [jobHubSpotStatuses, setJobHubSpotStatuses] = useState(new Map());
  const [hubSpotPushingIds, setHubSpotPushingIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [analysisDialog, setAnalysisDialog] = useState(false); // Change 4
  // ── Removed: editJob, editOpen state — no longer needed ──────────────────

  // ── Suitable / External candidates (per selected job) ────────────────────
  const [suitableCandidates, setSuitableCandidates] = useState([]);
  const [suitableLoading, setSuitableLoading]       = useState(false);
  const [suitableError, setSuitableError]           = useState("");
  const [suitableFetched, setSuitableFetched]       = useState(false);

  const [externalCandidates, setExternalCandidates] = useState([]);
  const [externalLoading, setExternalLoading]       = useState(false);
  const [externalLoadingMore, setExternalLoadingMore] = useState(false);
  const [externalError, setExternalError]           = useState("");
  const [externalFetched, setExternalFetched]       = useState(false);

  // ── Add to Job (Suitable / External candidate cards) ─────────────────────
  const [addingKeys, setAddingKeys] = useState(new Set());
  const [addedKeys, setAddedKeys]   = useState(new Set());

  useEffect(() => {
    // Switching jobs invalidates any previous find/search results
    setSuitableCandidates([]); setSuitableFetched(false); setSuitableError("");
    setExternalCandidates([]); setExternalFetched(false); setExternalError("");
    setAddingKeys(new Set()); setAddedKeys(new Set());
  }, [selectedJobId]);

  async function handleFindSuitableCandidates() {
    if (!selectedJobId) return;
    setSuitableLoading(true); setSuitableError("");
    try {
      const data = await apiGet(`/api/jobs/${selectedJobId}/suitable-candidates`);
      setSuitableCandidates(data ?? []);
      setSuitableFetched(true);
    } catch (e) {
      setSuitableError(e?.message || "Failed to find candidates");
    } finally {
      setSuitableLoading(false);
    }
  }

  async function handleSearchExternalCandidates() {
    if (!selectedJobId) return;
    setExternalLoading(true); setExternalError("");
    try {
      const data = await apiGet(`/api/jobs/${selectedJobId}/external-candidates`);
      setExternalCandidates(data ?? []);
      setExternalFetched(true);
    } catch (e) {
      setExternalError(e?.message || "Failed to search external candidates");
    } finally {
      setExternalLoading(false);
    }
  }

  async function handleLoadMoreExternalCandidates() {
    if (!selectedJobId) return;
    setExternalLoadingMore(true); setExternalError("");
    try {
      const fresh = await apiGet(`/api/jobs/${selectedJobId}/external-candidates/load-more`);
      const existingIds = new Set(externalCandidates.filter(c => c.coresignalId).map(c => c.coresignalId));
      const deduped = (fresh ?? []).filter(c => c.coresignalId && !existingIds.has(c.coresignalId));
      setExternalCandidates(prev => [...prev, ...deduped]);
    } catch (e) {
      setExternalError(e?.message || "Failed to load more external candidates");
    } finally {
      setExternalLoadingMore(false);
    }
  }

  function suitableCandidatePayload(c) {
    return {
      name: c.name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      linkedinUrl: c.linkedinUrl ?? "",
      cvText: "",
      skills: c.skills ?? [],
      currentTitle: c.currentTitle ?? "",
      location: c.location ?? "",
      state: c.state ?? "",
      yearsExperience: c.yearsExperience ?? null,
      seniorityLevel: c.seniorityLevel ?? "",
      expectedSalaryMin: c.expectedSalaryMin ?? null,
      expectedSalaryMax: c.expectedSalaryMax ?? null,
      salaryCurrency: c.salaryCurrency ?? "",
      noticePeriodWeeks: c.noticePeriodWeeks ?? null,
      workRights: c.workRights ?? "",
      remoteFlexible: c.remoteFlexible ?? null,
    };
  }

  function externalCandidatePayload(c) {
    return {
      name: c.name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      linkedinUrl: c.linkedinUrl ?? "",
      cvText: "",
      skills: c.matchedSkills ?? [],
      currentTitle: c.currentTitle ?? "",
      yearsExperience: c.yearsExperience ?? null,
    };
  }

  async function handleAddToJob(key, payload) {
    if (!selectedJobId || addingKeys.has(key) || addedKeys.has(key)) return;
    setAddingKeys(prev => new Set(prev).add(key));
    try {
      const loginId = localStorage.getItem("loginId") || "";
      const url = new URL(`${API_BASE}/api/jobs/${selectedJobId}/candidates`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        setAddedKeys(prev => new Set(prev).add(key));
        return;
      }
      if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`${res.status} - ${t}`); }
      const created = await res.json();
      setAddedKeys(prev => new Set(prev).add(key));
      setCandidatesByJob(prev => {
        const next = new Map(prev);
        const existing = next.get(selectedJobId) ?? [];
        next.set(selectedJobId, [
          ...existing,
          { ...created, consistencyScore: null, capabilityScore: null, risk: null, status: "Pending" }
        ]);
        return next;
      });
    } catch (e) {
      setErr(e?.message || "Failed to add candidate to job");
    } finally {
      setAddingKeys(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setErr("");
      try {
        const jobsResp = await apiGet("/api/jobs");
        if (cancelled) return;
        setJobs(jobsResp ?? []);

        const statusPairs = await Promise.all(
          (jobsResp ?? []).map(async (job) => {
            try {
              const status = await apiGet(`/api/jobs/${job.id}/hubspot/status`);
              return [job.id, status];
            } catch {
              return [job.id, null];
            }
          })
        );
        if (cancelled) return;
        setJobHubSpotStatuses(new Map(statusPairs));

        const map = new Map();
        await Promise.all(
          (jobsResp ?? []).map(async (job) => {
            try {
              const candidates = await apiGet(`/api/jobs/${job.id}/candidates`);
              const enriched = await Promise.all(
                (candidates ?? []).map(async (c) => {
                  try {
                    const analysis = await apiGet(`/api/candidates/${c.id}/analysis`);
                    return {
                      ...c, consistencyScore: analysis?.consistencyScore ?? null,
                      capabilityScore: analysis?.capabilityScore ?? null,
                      risk: analysis?.riskLevel ?? null, status: "Analysed"
                    };
                  } catch {
                    return {
                      ...c, consistencyScore: null, capabilityScore: null,
                      risk: null, status: "Pending"
                    };
                  }
                })
              );
              map.set(job.id, enriched);
            } catch {
              map.set(job.id, []);
            }
          })
        );
        if (cancelled) return;
        setCandidatesByJob(map);
        if ((jobsResp ?? []).length > 0) setSelectedJobId(jobsResp[0].id);
      } catch (e) {
        if (cancelled) return;
        setErr(e?.message || "Failed to load jobs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────
  const jobsWithDefaults = useMemo(() =>
    (jobs ?? []).map(j => ({
      ...j,
      company: j.company ?? "—", jobType: j.jobType ?? "—",
      location: j.location ?? "—", status: j.status ?? "Active"
    })), [jobs]);

  const statusCounts = useMemo(() => ({
    All:        jobsWithDefaults.length,
    Active:     jobsWithDefaults.filter(j => j.status === "Active").length,
    Fulfilling: jobsWithDefaults.filter(j => j.status === "Fulfilling").length,
    Complete:   jobsWithDefaults.filter(j => j.status === "Complete").length,
    Draft:      jobsWithDefaults.filter(j => j.status === "Draft").length,
  }), [jobsWithDefaults]);

  const visibleJobs = useMemo(() =>
    jobsWithDefaults.filter(j => {
      const matchSearch = !search ||
        (j.title ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (j.company ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || j.status === statusFilter;
      return matchSearch && matchStatus;
    }), [jobsWithDefaults, search, statusFilter]);

  const selectedJob = jobsWithDefaults.find(j => j.id === selectedJobId);
  const selectedCandidates = selectedJobId ? (candidatesByJob.get(selectedJobId) ?? []) : [];

  function jobAvg(jobId) {
    const analysed = (candidatesByJob.get(jobId) ?? []).filter(c => c.capabilityScore != null);
    if (!analysed.length) return null;
    return Math.round(analysed.reduce((s, c) => s + c.capabilityScore, 0) / analysed.length);
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleRunAnalysis(candidateId) {
    try {
      const loginId = localStorage.getItem("loginId") || "";
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/analyze`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } });
      if (res.status === 402) { setErr("You have run out of tokens. Please upgrade your plan to continue."); return; }
      if (!res.ok) { setErr("Analysis failed. Please try again."); return; }
      const analysis = await apiGet(`/api/candidates/${candidateId}/analysis`);
      setCandidatesByJob(prev => {
        const next = new Map(prev);
        for (const [jid, cands] of next.entries()) {
          next.set(jid, cands.map(c => c.id === candidateId
            ? {
              ...c, consistencyScore: analysis?.consistencyScore ?? null,
              capabilityScore: analysis?.capabilityScore ?? null,
              risk: analysis?.riskLevel ?? null, status: "Analysed"
            }
            : c));
        }
        return next;
      });
    } catch (e) { setErr("Analysis failed: " + (e.message || "Please try again.")); }
  }

  async function handleRemoveCandidate(candidateId) {
    if (!window.confirm("Remove this candidate from the pipeline?")) return;
    try {
      await apiDelete(`/api/candidates/${candidateId}`);
      setCandidatesByJob(prev => {
        const next = new Map(prev);
        for (const [jid, cands] of next.entries()) {
          next.set(jid, cands.filter(c => c.id !== candidateId));
        }
        return next;
      });
    } catch (e) { setErr(e.message); }
  }

  async function handleRemoveJob(jobId, e) {
    e.stopPropagation();
    if (!window.confirm("Delete this job and all its candidates? This cannot be undone.")) return;
    try {
      await apiDelete(`/api/jobs/${jobId}`);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedJobId === jobId) setSelectedJobId(null);
    } catch (e) { setErr(e.message); }
  }

  async function handlePushJobToHubSpot(jobId, e) {
    e.stopPropagation();
    if (hubSpotPushingIds.has(jobId)) return;
    setHubSpotPushingIds(prev => new Set(prev).add(jobId));
    setErr("");
    try {
      const status = await apiPostJson(`/api/jobs/${jobId}/hubspot/push`);
      setJobHubSpotStatuses(prev => new Map(prev).set(jobId, status));
    } catch (e) {
      setErr(e.message || "Failed to sync job with HubSpot");
      try {
        const status = await apiGet(`/api/jobs/${jobId}/hubspot/status`);
        setJobHubSpotStatuses(prev => new Map(prev).set(jobId, status));
      } catch {}
    } finally {
      setHubSpotPushingIds(prev => { const next = new Set(prev); next.delete(jobId); return next; });
    }
  }

  // ── Removed: handleJobSaved — no longer needed ────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{
      display: "flex", flexDirection: "column", height: "100%",
      overflow: "hidden", bgcolor: "#F7F8FA"
    }}>

      {/* Page header */}
      <Box sx={{
        bgcolor: "#fff", borderBottom: `1px solid ${BORDER}`,
        px: 3, py: 1.5, display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0
      }}>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: "-0.2px" }}>Jobs</Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            All active and draft job vacancies — click a row to view its candidates
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TextField size="small" placeholder="Search jobs…" value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment:
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 15, color: MUTED }} />
                </InputAdornment>
            }}
            sx={{
              width: 200,
              "& .MuiOutlinedInput-root": {
                borderRadius: "7px", fontSize: 12, bgcolor: SURFACE,
                "& fieldset": { borderColor: BORDER },
                "&:hover fieldset": { borderColor: "#C0C8D8" },
                "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 1.5 }
              }
            }} />
          <Button size="small" variant="contained"
            startIcon={<AddIcon sx={{ fontSize: 14 }} />}
            onClick={() => nav("/jobs/new")}
            sx={{
              fontSize: 12, fontWeight: 500, bgcolor: ACCENT,
              borderRadius: "6px", textTransform: "none", boxShadow: "none",
              "&:hover": { bgcolor: "#1660CC", boxShadow: "none" }
            }}>
            Create Job
          </Button>
        </Box>
      </Box>

      {/* Scrollable content */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>

        {err && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }} onClose={() => setErr("")}>
            {err}
          </Alert>
        )}
        {loading && (
          <Paper elevation={0} sx={{ p: 2.5, mb: 2, border: `1px solid ${BORDER}`, borderRadius: "10px" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, mb: 1 }}>Loading jobs…</Typography>
            <LinearProgress sx={{ borderRadius: "4px" }} />
          </Paper>
        )}

        {/* Filter chips */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.75 }}>
          <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>Filter:</Typography>
          {["All", "Active", "Fulfilling", "Complete", "Draft"].map(s => (
            <FilterChip key={s} label={`${s} (${statusCounts[s] ?? 0})`}
              active={statusFilter === s} onClick={() => setStatusFilter(s)} />
          ))}
          <Typography sx={{ fontSize: 12, color: MUTED, ml: "auto" }}>
            {visibleJobs.length} job{visibleJobs.length !== 1 ? "s" : ""} found
          </Typography>
        </Box>

        {/* Jobs table */}
        <Paper elevation={0} sx={{
          border: `1px solid ${BORDER}`, borderRadius: "10px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", mb: 1.75
        }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...thSx, width: 28, px: 1.5 }} />
                <TableCell sx={thSx}>Job Title</TableCell>
                <TableCell sx={thSx}>Client</TableCell>
                <TableCell sx={thSx}>Location</TableCell>
                <TableCell sx={thSx}>Type</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "center" }}>Candidates</TableCell>
                <TableCell sx={thSx}>Avg. Match</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
                <TableCell sx={thSx}>Created</TableCell>
                <TableCell sx={thSx}>Est. Fee</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && visibleJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} sx={{ textAlign: "center", py: 5, color: MUTED, fontSize: 13 }}>
                    No jobs found
                  </TableCell>
                </TableRow>
              )}
              {visibleJobs.map((job, idx) => {
                const isSelected = job.id === selectedJobId;
                const candCount = (candidatesByJob.get(job.id) ?? []).length;
                const avg = jobAvg(job.id);
                const hubSpotStatus = jobHubSpotStatuses.get(job.id);
                const hubSpotLinked = hubSpotStatus?.linked;
                const hubSpotSyncing = hubSpotPushingIds.has(job.id);
                return (
                  <TableRow key={job.id}
                    onClick={() => setSelectedJobId(isSelected ? null : job.id)}
                    sx={{
                      bgcolor: isSelected ? SELECTED_BG : idx % 2 === 1 ? SURFACE : "#fff",
                      cursor: "pointer",
                      "&:hover": { bgcolor: isSelected ? SELECTED_BG : "#F0F4FF" },
                      "&:last-child td": { borderBottom: "none" },
                      transition: "background .1s"
                    }}>

                    <TableCell sx={{ px: 1.5, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
                      <Typography sx={{
                        fontSize: 11, fontWeight: 700,
                        color: isSelected ? ACCENT : MUTED, userSelect: "none"
                      }}>
                        {isSelected ? "▼" : "▶"}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
                        {job.title}
                      </Typography>
                      {job.seniority && (
                        <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>{job.seniority}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                      {job.company}
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                      {job.location}
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <Badge label={job.jobType} variant="neutral" />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, textAlign: "center", borderBottom: `1px solid ${BORDER}` }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{candCount}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <AvgMatch value={avg} />
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell sx={{
                      py: 1.5, px: 2, fontSize: 11, color: MUTED,
                      borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap"
                    }}>
                      {job.createdAt
                        ? new Date(job.createdAt).toLocaleDateString("en-GB",
                          { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                      {job.estimatedFee != null
                        ? <Typography sx={{ fontSize: 13, fontWeight: 700, color: SUCCESS }}>
                            {job.currency} {Number(job.estimatedFee).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </Typography>
                        : <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>}
                    </TableCell>

                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}
                      onClick={e => e.stopPropagation()}>
                      <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                        <HubSpotJobBadge status={hubSpotStatus} />
                        {hubSpotLinked && hubSpotStatus?.externalUrl && (
                          <Button size="small" variant="outlined"
                            component="a"
                            href={hubSpotStatus.externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            sx={{
                              fontSize: 11, fontWeight: 500, borderColor: SUCCESS_BR, color: SUCCESS,
                              borderRadius: "6px", textTransform: "none",
                              "&:hover": { bgcolor: SUCCESS_BG, borderColor: SUCCESS }
                            }}>
                            Open
                          </Button>
                        )}
                        <Button size="small" variant={hubSpotLinked ? "outlined" : "contained"}
                          onClick={e => handlePushJobToHubSpot(job.id, e)}
                          disabled={hubSpotSyncing || hubSpotStatus?.state === "disconnected"}
                          sx={{
                            fontSize: 11, fontWeight: 500, borderRadius: "6px", textTransform: "none",
                            ...(hubSpotLinked
                              ? { borderColor: ACCENT_BR, color: ACCENT, "&:hover": { bgcolor: ACCENT_BG, borderColor: ACCENT } }
                              : { bgcolor: ACCENT, boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } })
                          }}>
                          {hubSpotSyncing ? "Syncing..." : hubSpotLinked ? "Sync HubSpot" : "Push to HubSpot"}
                        </Button>
                        {/* ── Edit now navigates to edit page with job prepopulated ── */}
                        <Button size="small" variant="outlined"
                          onClick={e => { e.stopPropagation(); nav(`/jobs/${job.id}/edit`); }}
                          sx={{
                            fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
                            borderRadius: "6px", textTransform: "none",
                            "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE }
                          }}>
                          Edit
                        </Button>
                        <Button size="small" variant="outlined"
                          onClick={e => handleRemoveJob(job.id, e)}
                          sx={{
                            fontSize: 11, fontWeight: 500, borderColor: DANGER_BR, color: DANGER,
                            borderRadius: "6px", textTransform: "none",
                            "&:hover": { bgcolor: DANGER_BG, borderColor: DANGER }
                          }}>
                          Remove
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>

        {/* Candidate panel */}
        {selectedJob && (
          <Paper elevation={0} sx={{
            border: `1px solid ${BORDER}`, borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", mb: 1.75
          }}>
            <Box sx={{
              px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, bgcolor: "#F7F9FF",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 3, height: 18, bgcolor: ACCENT, borderRadius: "2px", flexShrink: 0 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  Candidates — {selectedJob.title}
                </Typography>
                <Badge label={selectedJob.company} variant="accent" />
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: MUTED }}>
                  {selectedCandidates.length} candidate{selectedCandidates.length !== 1 ? "s" : ""}
                </Typography>
                <Button size="small" variant="contained"
                  startIcon={<AddIcon sx={{ fontSize: 12 }} />}
                  onClick={() => nav("/candidates/new")}
                  sx={{
                    fontSize: 11, fontWeight: 500, bgcolor: ACCENT,
                    borderRadius: "6px", textTransform: "none", boxShadow: "none",
                    "&:hover": { bgcolor: "#1660CC", boxShadow: "none" }
                  }}>
                  Add Candidate
                </Button>
              </Box>
            </Box>
            <CandidateSubTable
              candidates={selectedCandidates}
              jobTitle={selectedJob.title}
              onRunAnalysis={handleRunAnalysis}
              onRemoveCandidate={handleRemoveCandidate}
              onAnalysisStarted={() => setAnalysisDialog(true)}
            />
          </Paper>
        )}

        {/* Suitable Candidates from Database */}
        {selectedJob && (
          <Paper elevation={0} sx={{
            border: `1px solid ${BORDER}`, borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", mb: 1.75
          }}>
            <Box sx={{
              px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, bgcolor: "#F7F9FF",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 3, height: 18, bgcolor: ACCENT, borderRadius: "2px", flexShrink: 0 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  Suitable Candidates from Database
                </Typography>
              </Box>
              <Button size="small" variant="contained" onClick={handleFindSuitableCandidates} disabled={suitableLoading}
                sx={{
                  fontSize: 11, fontWeight: 500, bgcolor: ACCENT, borderRadius: "6px",
                  textTransform: "none", boxShadow: "none",
                  "&:hover": { bgcolor: "#1660CC", boxShadow: "none" }
                }}>
                {suitableLoading ? "Searching…" : "Find Candidate"}
              </Button>
            </Box>
            <Box sx={{ p: 2.25 }}>
              {suitableError && <Alert severity="error" sx={{ mb: 1.5 }}>{suitableError}</Alert>}
              {!suitableFetched && !suitableLoading && (
                <Typography sx={{ fontSize: 12.5, color: MUTED, textAlign: "center", py: 1.5 }}>
                  Click "Find Candidate" to match top candidates in your database against this job's title, skills and location.
                </Typography>
              )}
              {suitableFetched && !suitableLoading && suitableCandidates.length === 0 && !suitableError && (
                <Typography sx={{ fontSize: 12.5, color: MUTED, textAlign: "center", py: 1.5 }}>
                  No matching candidates found in your database.
                </Typography>
              )}
              {suitableCandidates.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {suitableCandidates.map(c => {
                    const key = `suitable-${c.candidateId}`;
                    return (
                      <SuitableCandidateCard key={c.candidateId} c={c}
                        onView={() => nav(`/candidates/${c.candidateId}/workflow`)}
                        onAdd={() => handleAddToJob(key, suitableCandidatePayload(c))}
                        adding={addingKeys.has(key)}
                        added={addedKeys.has(key)}
                        alreadyOnJob={c.jobId === selectedJobId} />
                    );
                  })}
                </Box>
              )}
            </Box>
          </Paper>
        )}

        {/* Search External Candidates (Bright Data / LinkedIn) */}
        {selectedJob && (
          <Paper elevation={0} sx={{
            border: `1px solid ${BORDER}`, borderRadius: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", mb: 1.75
          }}>
            <Box sx={{
              px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, bgcolor: "#FAF8FF",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 3, height: 18, bgcolor: PURPLE, borderRadius: "2px", flexShrink: 0 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  Search External Candidates
                </Typography>
              </Box>
              <Button size="small" variant="contained" onClick={handleSearchExternalCandidates} disabled={externalLoading}
                startIcon={externalLoading ? <CircularProgress size={13} sx={{ color: "#fff" }} /> : null}
                sx={{
                  fontSize: 11, fontWeight: 500, bgcolor: PURPLE, borderRadius: "6px",
                  textTransform: "none", boxShadow: "none",
                  "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" }
                }}>
                {externalLoading ? "Searching…" : "Search External"}
              </Button>
            </Box>
            <Box sx={{ p: 2.25 }}>
              {externalError && <Alert severity="error" sx={{ mb: 1.5 }}>{externalError}</Alert>}
              {!externalFetched && !externalLoading && (
                <Typography sx={{ fontSize: 12.5, color: MUTED, textAlign: "center", py: 1.5 }}>
                  Click "Search External" to blend cached matches with fresh LinkedIn candidates for this job.
                </Typography>
              )}
              {externalLoading && (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, py: 2 }}>
                  <CircularProgress size={20} sx={{ color: PURPLE }} />
                  <Typography sx={{ fontSize: 11.5, color: MUTED }}>
                    Live LinkedIn lookups can take up to 1 minute — hang tight.
                  </Typography>
                </Box>
              )}
              {externalFetched && !externalLoading && externalCandidates.length === 0 && !externalError && (
                <Typography sx={{ fontSize: 12.5, color: MUTED, textAlign: "center", py: 1.5 }}>
                  No external candidates found for this job's title, skills and location.
                </Typography>
              )}
              {externalCandidates.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {externalCandidates.map((c, i) => {
                    const key = `external-${c.coresignalId ?? i}`;
                    return (
                      <ExternalCandidateCard key={c.coresignalId ?? i} c={c}
                        onAdd={() => handleAddToJob(key, externalCandidatePayload(c))}
                        adding={addingKeys.has(key)}
                        added={addedKeys.has(key)} />
                    );
                  })}
                </Box>
              )}
              {externalFetched && !externalLoading && (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, mt: 1.5 }}>
                  <Button size="small" variant="outlined" onClick={handleLoadMoreExternalCandidates} disabled={externalLoadingMore}
                    startIcon={externalLoadingMore ? <CircularProgress size={13} sx={{ color: PURPLE }} /> : null}
                    sx={{ fontSize: 11, borderColor: PURPLE_BR, color: PURPLE, borderRadius: "6px", textTransform: "none", "&:hover": { borderColor: PURPLE, bgcolor: PURPLE_BG } }}>
                    {externalLoadingMore ? "Fetching from LinkedIn…" : "Load More External Candidates"}
                  </Button>
                  {externalLoadingMore && (
                    <Typography sx={{ fontSize: 11.5, color: "#B4BCC9" }}>
                      This can take up to 1 minute while we pull fresh LinkedIn profiles.
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Paper>
        )}

        {/* Footer */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
          {["copyright@ nolyvra",
            "This AI tool is designed to assist you, not replace professional judgment. Always consult with a qualified expert."]
            .map(label => (
              <Box key={label} sx={{
                display: "inline-flex", alignItems: "center",
                bgcolor: "#F0F2F6", border: `1px solid ${BORDER}`, borderRadius: "5px",
                px: 1, py: 0.25, fontSize: 10, fontWeight: 500, color: MUTED
              }}>
                {label}
              </Box>
            ))}
        </Box>
      </Box>
      {/* ── Removed: EditJobDialog — replaced by /jobs/:jobId/edit route ────── */}

      {/* Change 4: Analysis in progress dialog */}
      <Dialog open={analysisDialog} onClose={() => setAnalysisDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: TEXT, pb: 1 }}>
          🔍 Analysis In Progress
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
            Your candidate analysis is being generated. This may take a moment.
          </Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 1, lineHeight: 1.6 }}>
            You can view it once complete from the candidate's profile.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" size="small" onClick={() => setAnalysisDialog(false)}
            sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            OK, Got It
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
