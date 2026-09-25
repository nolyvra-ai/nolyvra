import {
  Box, Paper, Typography, Table, TableHead, TableRow,
  TableCell, TableBody, Button, TextField, InputAdornment,
  Alert, LinearProgress, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SyncIcon from "@mui/icons-material/Sync";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ColumnPickerButton from "../components/ColumnPickerButton";

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
    try { message = JSON.parse(text)?.message || JSON.parse(text)?.error || text; } catch {
      // Keep the raw response text when the API does not return JSON.
    }
    const error = new Error(message || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
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
const SELTZ = "#DB2777", SELTZ_BG = "#FDF2F8", SELTZ_BR = "#FBCFE8";
const PARALLEL = "#4F46E5", PARALLEL_BG = "#EEF2FF", PARALLEL_BR = "#C7D2FE";
const EXA = "#0891B2", EXA_BG = "#ECFEFF", EXA_BR = "#A5F3FC";
const NEUTRAL_BG = "#F1F3F7", SURFACE = "#FAFBFD", SELECTED_BG = "#EBF2FF";

// Agent-suggestion sources (Seltz/parallel.ai/exa.ai) — each its own accent
// color for the card border/avatar/score AND its "Agent Suggestion" chip.
// CoreSignal/Bright Data keeps its existing look: purple card accent, but a
// blue "LinkedIn" chip (unchanged from the original Seltz-only branching).
const AGENT_SOURCE_COLORS = {
  SELTZ:    { accent: SELTZ,    border: SELTZ_BR,    hover: "#BE185D" },
  PARALLEL: { accent: PARALLEL, border: PARALLEL_BR, hover: "#4338CA" },
  EXA:      { accent: EXA,      border: EXA_BR,      hover: "#0E7490" },
};
function externalCandidateAccent(source) {
  return AGENT_SOURCE_COLORS[source] ?? { accent: PURPLE, border: PURPLE_BR, hover: "#6D28D9" };
}
function externalCandidateChip(source) {
  const known = AGENT_SOURCE_COLORS[source];
  return known
    ? { bg: source === "SELTZ" ? SELTZ_BG : source === "PARALLEL" ? PARALLEL_BG : EXA_BG, border: known.border, color: known.accent, label: "Agent Suggestion" }
    : { bg: ACCENT_BG, border: ACCENT_BR, color: ACCENT, label: "LinkedIn" };
}
const HUBSPOT = "#FF7A59", HUBSPOT_BG = "rgba(255,122,89,0.08)", HUBSPOT_BR = "rgba(255,122,89,0.25)";
const HUBSPOT_LABEL_BG = "#FFF1EC";

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
  if (!status) return null;
  if (status.state !== "sync_failed" && !status.linked) return null;
  const failed = status.state === "sync_failed";
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: failed ? DANGER_BG : HUBSPOT_LABEL_BG,
      border: `1px solid ${failed ? DANGER_BR : HUBSPOT_BR}`,
      borderRadius: "4px", px: "6px", py: "1px",
      fontSize: 9, fontWeight: 700,
      color: failed ? DANGER : HUBSPOT, whiteSpace: "nowrap",
      cursor: "default",
      "&:hover": { bgcolor: failed ? DANGER_BG : HUBSPOT_LABEL_BG },
    }}
    onClick={e => e.stopPropagation()}>
      {failed ? "Sync failed" : "In HubSpot"}
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
function CandidateSubTable({ candidates, jobTitle, onRunAnalysis, onRemoveCandidate, onAnalysisStarted, extraColumns = [] }) {
  const nav = useNavigate();
  const [fitPopup, setFitPopup] = useState(null); // { candidate, loading, error, summary, alreadyAnalysed }

  // ── Data enrichment (Find Email) — keyed by candidate.id, which is always
  // present here (unlike the ephemeral Talent Search results). Deducts the
  // existing flat 10-token charge server-side and, once found, persists the
  // email onto the candidate row.
  const [enrichingIds,   setEnrichingIds]   = useState(new Set());
  const [enrichedEmails, setEnrichedEmails] = useState({});
  const [enrichErrors,   setEnrichErrors]   = useState({});

  function splitName(fullName) {
    const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: "", lastName: "" };
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }

  async function handleFindEmail(c) {
    if (enrichingIds.has(c.id)) return;
    const { firstName, lastName } = splitName(c.name);
    if (!firstName || !lastName) {
      setEnrichErrors(prev => ({ ...prev, [c.id]: "Need a full name to look up an email." }));
      return;
    }
    if (!window.confirm("Find this candidate's email address? This will deduct 10 tokens from your account. Continue?")) return;

    setEnrichingIds(prev => new Set(prev).add(c.id));
    setEnrichErrors(prev => { const next = { ...prev }; delete next[c.id]; return next; });
    try {
      const { jobId } = await apiPostJson("/api/enrichment/start", { candidateId: c.id, firstName, lastName, currentCompany: null });
      let email = null;
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(r => setTimeout(r, 3000));
        try {
          const data = await apiGet(`/api/enrichment/${jobId}?candidateId=${encodeURIComponent(c.id)}`);
          if (data.status !== "PENDING") { email = data.email; break; }
        } catch {
          // Transient poll failure — next tick retries.
        }
      }
      if (email) setEnrichedEmails(prev => ({ ...prev, [c.id]: email }));
      else setEnrichErrors(prev => ({ ...prev, [c.id]: "No email found for this candidate." }));
    } catch (e) {
      setEnrichErrors(prev => ({ ...prev, [c.id]: e?.message || "Enrichment failed." }));
    } finally {
      setEnrichingIds(prev => { const next = new Set(prev); next.delete(c.id); return next; });
    }
  }

  async function openFitPopup(c) {
    const alreadyAnalysed = c.status === "Analysed";
    setFitPopup({ candidate: c, loading: true, error: "", summary: "", alreadyAnalysed });
    try {
      if (alreadyAnalysed) {
        const analysis = await apiGet(`/api/candidates/${c.id}/aianalysis`);
        const summary = analysis?.aiVerdict?.summary || analysis?.recommendation || "No summary available.";
        setFitPopup({ candidate: c, loading: false, error: "", summary, alreadyAnalysed: true });
      } else {
        const preview = await apiGet(`/api/candidates/${c.id}/analysis/fit-preview`);
        setFitPopup({ candidate: c, loading: false, error: "", summary: preview?.summary || "", alreadyAnalysed: false });
      }
    } catch (e) {
      setFitPopup(prev => ({ ...prev, loading: false, error: e.message || "Failed to load preview." }));
    }
  }

  if (candidates.length === 0) {
    return (
      <Box sx={{ px: 3, py: 3, textAlign: "center" }}>
        <Typography sx={{ fontSize: 13, color: MUTED }}>No candidates added to this job yet.</Typography>
      </Box>
    );
  }

  return (
    <>
    <Box sx={{ overflowX: "auto" }}>
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
          {extraColumns.map(c => <TableCell key={c.key} sx={thSx}>{c.label}</TableCell>)}
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
              {(enrichedEmails[c.id] ?? c.email) ? (
                <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>{enrichedEmails[c.id] ?? c.email}</Typography>
              ) : (
                <Button size="small" variant="text"
                  onClick={e => { e.stopPropagation(); handleFindEmail(c); }}
                  disabled={enrichingIds.has(c.id)}
                  sx={{ fontSize: 10.5, fontWeight: 500, minWidth: 0, px: 0, py: 0, mt: 0.25, color: ACCENT, textTransform: "none" }}>
                  {enrichingIds.has(c.id) ? <CircularProgress size={10} sx={{ color: ACCENT }} /> : "✉ Find Email"}
                </Button>
              )}
              {enrichErrors[c.id] && (
                <Typography sx={{ fontSize: 10, color: DANGER, mt: 0.25 }}>⚠ {enrichErrors[c.id]}</Typography>
              )}
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
            {extraColumns.map(col => (
              <TableCell key={col.key} sx={{ py: 1.5, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                {col.get(c)}
              </TableCell>
            ))}
            <TableCell sx={{ py: 1.5, px: 2, textAlign: "right", borderBottom: `1px solid ${BORDER}` }}
              onClick={e => e.stopPropagation()}>
              <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end", alignItems: "center" }}>
                <Tooltip title="Quick AI fit check">
                  <IconButton size="small" onClick={() => openFitPopup(c)}
                    sx={{ color: PURPLE, p: 0.5, "&:hover": { bgcolor: PURPLE_BG } }}>
                    <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
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
    </Box>

    <Dialog open={!!fitPopup} onClose={() => setFitPopup(null)} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: "10px" } }}>
      <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: TEXT, pb: 1, display: "flex", alignItems: "center", gap: 0.75 }}>
        <AutoAwesomeIcon sx={{ fontSize: 16, color: PURPLE }} />
        {fitPopup?.candidate?.name || "Candidate"} — Quick Fit
      </DialogTitle>
      <DialogContent>
        {fitPopup?.loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={20} sx={{ color: PURPLE }} />
          </Box>
        ) : fitPopup?.error ? (
          <Typography sx={{ fontSize: 12.5, color: DANGER }}>{fitPopup.error}</Typography>
        ) : (
          <>
            <Typography sx={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>{fitPopup?.summary}</Typography>
            <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 1.5 }}>
              {fitPopup?.alreadyAnalysed
                ? "This candidate has already been analysed — view analysis for the full breakdown."
                : "Do you want to run a full analysis on this candidate?"}
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button size="small" onClick={() => setFitPopup(null)} sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>
          Close
        </Button>
        {!fitPopup?.loading && !fitPopup?.error && (
          fitPopup?.alreadyAnalysed ? (
            <Button variant="contained" size="small"
              onClick={() => { nav(`/analysis/${fitPopup.candidate.id}`); setFitPopup(null); }}
              sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none",
                "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
              View Analysis
            </Button>
          ) : (
            <Button variant="contained" size="small"
              onClick={() => { onRunAnalysis(fitPopup.candidate.id); onAnalysisStarted(); setFitPopup(null); }}
              sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none",
                "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
              Run Analysis
            </Button>
          )
        )}
      </DialogActions>
    </Dialog>
    </>
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
  const { accent, border: accentBorder, hover: accentHover } = externalCandidateAccent(c.source);
  const chip = externalCandidateChip(c.source);
  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 1.25, p: "10px 14px",
      border: `1px solid ${accentBorder}`, borderLeft: `3px solid ${accent}`, borderRadius: "8px", bgcolor: "#fff",
    }}>
      <Box sx={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", bgcolor: hasPhoto ? "transparent" : accent, color: "#fff", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {hasPhoto
          ? <Box component="img" src={c.avatarUrl} alt={c.name || ""} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : (c.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.name}
          </Typography>
          <Box sx={{ display: "inline-flex", px: "6px", py: "1px", bgcolor: chip.bg, border: `1px solid ${chip.border}`, borderRadius: "10px", fontSize: 9.5, fontWeight: 600, color: chip.color, whiteSpace: "nowrap", flexShrink: 0 }}>
            {chip.label}
          </Box>
        </Box>
        <Typography sx={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {[c.currentTitle, c.currentCompany].filter(Boolean).join(" at ") || "—"}
        </Typography>
        {c.matchedSkills?.length > 0 && (
          <Typography sx={{ fontSize: 10.5, color: SUCCESS, mt: 0.25 }}>
            Matches: {c.matchedSkills.slice(0, 5).join(", ")}{c.matchedSkills.length > 5 ? ", …" : ""}
          </Typography>
        )}
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: accent }}>{c.matchScore}%</Typography>
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
              : { bgcolor: accent, boxShadow: "none", "&:hover": { bgcolor: accentHover, boxShadow: "none" } })
          }}>
          {adding ? <CircularProgress size={12} sx={{ color: added ? SUCCESS : "#fff" }} /> : added ? "Added ✓" : "Add to Job"}
        </Button>
      </Box>
    </Box>
  );
}

const JOBS_PAGE_SIZE = 10;
const CANDIDATES_PAGE_SIZE = 10;

// Extra, opt-in columns for the Jobs table — checked via ColumnPickerButton,
// appended after the default columns rather than replacing any of them.
const JOB_EXTRA_COLUMNS = [
  { key: "seniority",  label: "Seniority",  get: j => j.seniority || "—" },
  { key: "salary",     label: "Salary",     get: j => j.salary != null ? `${j.currency || ""} ${Number(j.salary).toLocaleString()}` : "—" },
  { key: "feePercentage", label: "Fee %",   get: j => j.feePercentage != null ? `${j.feePercentage}%` : "—" },
  { key: "feeType",    label: "Fee Type",   get: j => j.feeType || "—" },
  { key: "fixedFee",   label: "Fixed Fee",  get: j => j.fixedFee != null ? `${j.currency || ""} ${Number(j.fixedFee).toLocaleString()}` : "—" },
  { key: "stackTags",  label: "Stack Tags", get: j => (j.stackTags && j.stackTags.length) ? j.stackTags.join(", ") : "—" },
];

// Extra, opt-in columns for the per-job Candidate sub-table.
const CANDIDATE_EXTRA_COLUMNS = [
  { key: "phoneNumber",  label: "Phone",      get: c => c.phoneNumber || "—" },
  { key: "linkedinUrl",  label: "LinkedIn",   get: c => c.linkedinUrl || "—" },
  { key: "currentTitle", label: "Current Title", get: c => c.currentTitle || "—" },
  { key: "location",     label: "Location",   get: c => [c.location, c.state].filter(Boolean).join(", ") || "—" },
  { key: "yearsExperience", label: "Years Exp", get: c => c.yearsExperience != null ? c.yearsExperience : "—" },
  { key: "seniorityLevel",  label: "Seniority Level", get: c => c.seniorityLevel || "—" },
  { key: "expectedSalary",  label: "Expected Salary", get: c => c.expectedSalaryMin != null
      ? `${c.salaryCurrency || ""} ${Number(c.expectedSalaryMin).toLocaleString()}${c.expectedSalaryMax != null ? ` – ${Number(c.expectedSalaryMax).toLocaleString()}` : ""}`
      : "—" },
  { key: "noticePeriodWeeks", label: "Notice Period", get: c => c.noticePeriodWeeks != null ? `${c.noticePeriodWeeks} wk` : "—" },
  { key: "workRights",   label: "Work Rights", get: c => c.workRights || "—" },
  { key: "remoteFlexible", label: "Remote Flexible", get: c => c.remoteFlexible == null ? "—" : (c.remoteFlexible ? "Yes" : "No") },
  { key: "createdAt",    label: "Applied On", get: c => c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB") : "—" },
];

// Canonical candidate stages, matching StageBadge's config above.
const CANDIDATE_STAGES = ["Screening", "Interview", "Assessment", "Offer", "Selected", "Rejected"];

// ─── Main component ───────────────────────────────────────────────────────────
export default function JobsPage() {
  const nav = useNavigate();

  const [jobs, setJobs] = useState([]);
  const [jobsHasMore, setJobsHasMore] = useState(false);
  const [jobsLoadingMore, setJobsLoadingMore] = useState(false);
  const [extraJobColumns, setExtraJobColumns] = useState(new Set());
  const [extraCandidateColumns, setExtraCandidateColumns] = useState(new Set());
  const [candidatesByJob, setCandidatesByJob] = useState(new Map());
  // Per-job pagination progress: jobId -> { offset, hasMore } — lets switching
  // between jobs preserve each job's own "Load More" position.
  const [candidatesMeta, setCandidatesMeta] = useState(new Map());
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesLoadingMore, setCandidatesLoadingMore] = useState(false);
  const [jobHubSpotStatuses, setJobHubSpotStatuses] = useState(new Map());
  const [hubSpotPushingIds, setHubSpotPushingIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [candidateStageFilter, setCandidateStageFilter] = useState("All");
  const [analysisDialog, setAnalysisDialog] = useState(false); // Change 4
  // ── Bulk Analysis (Candidates table) ──────────────────────────────────────
  const [bulkAnalysisStatus, setBulkAnalysisStatus] = useState(null); // {batchId, queued, running, succeeded, failed, skipped, total}
  const [bulkAnalyzing,      setBulkAnalyzing]      = useState(false);
  // ── Removed: editJob, editOpen state — no longer needed ──────────────────

  function toggleExtraJobColumn(key) {
    setExtraJobColumns(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleExtraCandidateColumn(key) {
    setExtraCandidateColumns(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

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

  // ── Bulk "Shortlist Top N" (External Candidates panel) ────────────────────
  const [shortlistTopN,        setShortlistTopN]        = useState(10);
  const [shortlistingExternal, setShortlistingExternal] = useState(false);
  const [shortlistMsg,         setShortlistMsg]         = useState("");

  useEffect(() => {
    // Switching jobs invalidates any previous find/search results
    setSuitableCandidates([]); setSuitableFetched(false); setSuitableError("");
    setExternalCandidates([]); setExternalFetched(false); setExternalError("");
    setAddingKeys(new Set()); setAddedKeys(new Set()); setShortlistMsg("");
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

  // Returns "added" | "duplicate" | "error" so bulk callers (handleShortlistTopExternal)
  // can tally outcomes — existing single-click callers ignore the return value.
  async function handleAddToJob(key, payload) {
    if (!selectedJobId || addingKeys.has(key) || addedKeys.has(key)) return "duplicate";
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
        return "duplicate";
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
      setJobs(prev => prev.map(j => j.id === selectedJobId
        ? { ...j, candidateCount: (j.candidateCount ?? 0) + 1 } : j));
      return "added";
    } catch (e) {
      setErr(e?.message || "Failed to add candidate to job");
      return "error";
    } finally {
      setAddingKeys(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  }

  // Ranks the currently-loaded external candidates by match score and adds them
  // one at a time via handleAddToJob, skipping ones already added and backfilling
  // from the next-ranked candidate so the run still lands `n` successful adds
  // when possible — bounded by how many are already loaded (never triggers a
  // fresh search/"load more").
  async function handleShortlistTopExternal(n) {
    if (!selectedJobId || shortlistingExternal || externalCandidates.length === 0) return;
    setShortlistingExternal(true); setShortlistMsg("");
    const ranked = externalCandidates
      .map((c, i) => ({ c, key: `external-${c.coresignalId ?? i}` }))
      .filter(({ key }) => !addedKeys.has(key))
      .sort((a, b) => (b.c.matchScore ?? 0) - (a.c.matchScore ?? 0));
    let added = 0, duplicates = 0, failed = 0;
    for (const { c, key } of ranked) {
      if (added >= n) break;
      const outcome = await handleAddToJob(key, externalCandidatePayload(c));
      if (outcome === "added") added++;
      else if (outcome === "duplicate") duplicates++;
      else if (outcome === "error") failed++;
    }
    const parts = [added > 0
      ? `The shortlisted candidate${added !== 1 ? "s" : ""} ${added !== 1 ? "have" : "has"} been added. Please review all the candidates.`
      : "No candidates were added."];
    if (duplicates > 0) parts.push(`${duplicates} already in pipeline`);
    if (failed > 0) parts.push(`${failed} failed`);
    if (added < n) parts.push(`not enough external candidates loaded to reach ${n}`);
    setShortlistMsg(parts.join(" · "));
    setShortlistingExternal(false);
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  // Loads only the first page of jobs — candidateCount/avgMatchScore for the
  // table come straight from the job response (server-side aggregate), so
  // there's no per-job candidates+analysis fetch here anymore. Candidates are
  // fetched lazily, per job, only once that job's row is expanded (see the
  // selectedJobId effect below).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setErr("");
      try {
        const jobsResp = await apiGet(`/api/jobs?limit=${JOBS_PAGE_SIZE}&offset=0`);
        if (cancelled) return;
        setJobs(jobsResp ?? []);
        setJobsHasMore((jobsResp ?? []).length === JOBS_PAGE_SIZE);

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

  async function handleLoadMoreJobs() {
    setJobsLoadingMore(true);
    try {
      const more = await apiGet(`/api/jobs?limit=${JOBS_PAGE_SIZE}&offset=${jobs.length}`);
      setJobs(prev => [...prev, ...(more ?? [])]);
      setJobsHasMore((more ?? []).length === JOBS_PAGE_SIZE);
      const statusPairs = await Promise.all(
        (more ?? []).map(async (job) => {
          try { return [job.id, await apiGet(`/api/jobs/${job.id}/hubspot/status`)]; }
          catch { return [job.id, null]; }
        })
      );
      setJobHubSpotStatuses(prev => new Map([...prev, ...statusPairs]));
    } catch (e) {
      setErr(e?.message || "Failed to load more jobs");
    } finally {
      setJobsLoadingMore(false);
    }
  }

  async function enrichCandidatesWithAnalysis(candidates) {
    return Promise.all(
      (candidates ?? []).map(async (c) => {
        try {
          const analysis = await apiGet(`/api/candidates/${c.id}/analysis`);
          return {
            ...c, consistencyScore: analysis?.consistencyScore ?? null,
            capabilityScore: analysis?.capabilityScore ?? null,
            risk: analysis?.riskLevel ?? null, status: "Analysed"
          };
        } catch {
          return { ...c, consistencyScore: null, capabilityScore: null, risk: null, status: "Pending" };
        }
      })
    );
  }

  async function loadCandidatesForJob(jobId, offset, isInitial) {
    if (isInitial) setCandidatesLoading(true); else setCandidatesLoadingMore(true);
    try {
      const candidates = await apiGet(`/api/jobs/${jobId}/candidates?limit=${CANDIDATES_PAGE_SIZE}&offset=${offset}`);
      const enriched = await enrichCandidatesWithAnalysis(candidates);
      setCandidatesByJob(prev => {
        const next = new Map(prev);
        const existing = isInitial ? [] : (next.get(jobId) ?? []);
        next.set(jobId, [...existing, ...enriched]);
        return next;
      });
      setCandidatesMeta(prev => {
        const next = new Map(prev);
        next.set(jobId, { offset: offset + enriched.length, hasMore: enriched.length === CANDIDATES_PAGE_SIZE });
        return next;
      });
    } catch {
      setCandidatesByJob(prev => {
        const next = new Map(prev);
        if (!next.has(jobId)) next.set(jobId, []);
        return next;
      });
    } finally {
      if (isInitial) setCandidatesLoading(false); else setCandidatesLoadingMore(false);
    }
  }

  // Fetch a job's candidates only the first time its row is expanded —
  // switching back to an already-loaded job just shows the cached page(s).
  useEffect(() => {
    if (!selectedJobId || candidatesByJob.has(selectedJobId)) return;
    loadCandidatesForJob(selectedJobId, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId]);

  // Switching to a different job shouldn't carry over the previous job's stage filter
  // or a stale bulk-analysis progress indicator from the job left behind.
  useEffect(() => {
    setCandidateStageFilter("All");
    setBulkAnalysisStatus(null);
  }, [selectedJobId]);

  function handleLoadMoreCandidates() {
    if (!selectedJobId) return;
    const meta = candidatesMeta.get(selectedJobId);
    loadCandidatesForJob(selectedJobId, meta?.offset ?? 0, false);
  }

  const bulkAnalysisBatchId = bulkAnalysisStatus?.batchId;
  const bulkAnalysisActive = !!bulkAnalysisStatus &&
    ((bulkAnalysisStatus.queued ?? 0) + (bulkAnalysisStatus.running ?? 0) > 0);

  // Polls the batch until nothing is left queued/running, then refetches the
  // job's candidates so fresh capabilityScore values flow through — the table
  // (selectedCandidates below) is already sorted descending by capabilityScore,
  // so that refetch is what "reorders by score" once analysis completes.
  useEffect(() => {
    if (!bulkAnalysisBatchId) return undefined;
    let cancelled = false;
    let timer = null;
    const jobId = selectedJobId;
    const poll = async () => {
      try {
        const data = await apiGet(`/api/analysis-jobs/batches/${bulkAnalysisBatchId}`);
        if (cancelled) return;
        setBulkAnalysisStatus(data);
        if ((data.queued ?? 0) + (data.running ?? 0) === 0) {
          if (timer) window.clearInterval(timer);
          if (jobId === selectedJobId) loadCandidatesForJob(jobId, 0, true);
        }
      } catch {
        // Transient poll failure — next tick retries.
      }
    };
    poll();
    timer = window.setInterval(poll, 3000);
    return () => { cancelled = true; window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkAnalysisBatchId]);

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
  const rawSelectedCandidates = useMemo(() =>
    selectedJobId ? (candidatesByJob.get(selectedJobId) ?? []) : [],
    [selectedJobId, candidatesByJob]);
  const candidateStageCounts = useMemo(() => {
    const counts = { All: rawSelectedCandidates.length };
    for (const stage of CANDIDATE_STAGES) {
      counts[stage] = rawSelectedCandidates.filter(c => c.stage === stage).length;
    }
    return counts;
  }, [rawSelectedCandidates]);
  const selectedCandidates = useMemo(() =>
    rawSelectedCandidates
      .filter(c => candidateStageFilter === "All" || c.stage === candidateStageFilter)
      // Best capability match first; candidates not yet analysed (no score) sort last.
      .slice()
      .sort((a, b) => (b.capabilityScore ?? -1) - (a.capabilityScore ?? -1)),
    [rawSelectedCandidates, candidateStageFilter]);
  const selectedCandidatesMeta = selectedJobId ? candidatesMeta.get(selectedJobId) : null;
  const unanalyzedCandidateCount = rawSelectedCandidates.filter(c => c.status !== "Analysed").length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleRunBulkAnalysisForJob() {
    if (!selectedJobId || bulkAnalyzing || bulkAnalysisActive) return;
    const unanalyzed = rawSelectedCandidates.filter(c => c.status !== "Analysed");
    if (unanalyzed.length === 0) return;
    setBulkAnalyzing(true);
    try {
      const data = await apiPostJson("/api/analysis-jobs/bulk", { candidateIds: unanalyzed.map(c => c.id) });
      setBulkAnalysisStatus(data);
    } catch (e) {
      setErr(e?.message || "Failed to queue bulk analysis");
    } finally {
      setBulkAnalyzing(false);
    }
  }

  async function handleRunAnalysis(candidateId) {
    try {
      const loginId = localStorage.getItem("loginId") || "";
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/analyze`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } });
      if (res.status === 402) { setErr("You have run out of tokens. Please upgrade your plan to continue."); return; }
      if (!res.ok) { setErr("Analysis failed. Please try again."); return; }
      const analysis = await apiGet(`/api/candidates/${candidateId}/analysis`);

      // Read current state directly (not via a setState updater) so the
      // resulting per-job avg recompute below can run as a plain, separate
      // setJobs call rather than a setState nested inside another one.
      const touchedJobIds = [];
      const updatedCandidatesByJob = new Map();
      for (const [jid, cands] of candidatesByJob.entries()) {
        if (!cands.some(c => c.id === candidateId)) continue;
        touchedJobIds.push(jid);
        updatedCandidatesByJob.set(jid, cands.map(c => c.id === candidateId
          ? {
            ...c, consistencyScore: analysis?.consistencyScore ?? null,
            capabilityScore: analysis?.capabilityScore ?? null,
            risk: analysis?.riskLevel ?? null, status: "Analysed"
          }
          : c));
      }

      setCandidatesByJob(prev => {
        const next = new Map(prev);
        for (const jid of touchedJobIds) next.set(jid, updatedCandidatesByJob.get(jid));
        return next;
      });

      // Best-effort live update of the table's Avg. Match — derived from
      // whichever candidates are currently loaded for the job, which may be
      // a partial page; the server-side aggregate remains authoritative on
      // the next full page load.
      if (touchedJobIds.length > 0) {
        setJobs(prevJobs => prevJobs.map(j => {
          if (!touchedJobIds.includes(j.id)) return j;
          const analysed = (updatedCandidatesByJob.get(j.id) ?? []).filter(c => c.capabilityScore != null);
          const avg = analysed.length
            ? Math.round(analysed.reduce((s, c) => s + c.capabilityScore, 0) / analysed.length)
            : j.avgMatchScore;
          return { ...j, avgMatchScore: avg };
        }));
      }
    } catch (e) { setErr("Analysis failed: " + (e.message || "Please try again.")); }
  }

  async function handleRemoveCandidate(candidateId) {
    if (!window.confirm("Remove this candidate from the pipeline?")) return;
    try {
      await apiDelete(`/api/candidates/${candidateId}`);
      const touchedJobIds = [];
      setCandidatesByJob(prev => {
        const next = new Map(prev);
        for (const [jid, cands] of next.entries()) {
          if (!cands.some(c => c.id === candidateId)) continue;
          touchedJobIds.push(jid);
          next.set(jid, cands.filter(c => c.id !== candidateId));
        }
        return next;
      });
      if (touchedJobIds.length > 0) {
        setJobs(prev => prev.map(j => touchedJobIds.includes(j.id)
          ? { ...j, candidateCount: Math.max(0, (j.candidateCount ?? 0) - 1) } : j));
      }
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
    e?.stopPropagation();
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
      } catch {
        // Best-effort refresh after a failed push.
      }
    } finally {
      setHubSpotPushingIds(prev => { const next = new Set(prev); next.delete(jobId); return next; });
    }
  }

  async function handleSyncJobWithHubSpot(job, e) {
    e?.stopPropagation();
    if (hubSpotPushingIds.has(job.id)) return;
    setHubSpotPushingIds(prev => new Set(prev).add(job.id));
    setErr("");
    try {
      const status = await apiPostJson(`/api/jobs/${job.id}/hubspot/sync`);
      setJobHubSpotStatuses(prev => new Map(prev).set(job.id, status));
      const freshJob = await apiGet(`/api/jobs/${job.id}`);
      setJobs(prev => prev.map(item => item.id === job.id ? freshJob : item));
    } catch (e) {
      if (e.status === 409) {
        const useHubSpot = window.confirm(`${e.message}\n\nOK: update Nolyvra from HubSpot.\nCancel: choose another action.`);
        let direction = useHubSpot ? "pull" : null;
        if (!direction) {
          const useNolyvra = window.confirm("Overwrite HubSpot with the Nolyvra job instead?");
          if (!useNolyvra) {
            setHubSpotPushingIds(prev => { const next = new Set(prev); next.delete(job.id); return next; });
            return;
          }
          direction = "push";
        }
        try {
          const status = await apiPostJson(`/api/jobs/${job.id}/hubspot/sync?direction=${direction}`);
          setJobHubSpotStatuses(prev => new Map(prev).set(job.id, status));
          if (direction === "pull") {
            const freshJob = await apiGet(`/api/jobs/${job.id}`);
            setJobs(prev => prev.map(item => item.id === job.id ? freshJob : item));
          }
        } catch (forcedError) {
          setErr(forcedError.message || "Failed to resolve HubSpot sync conflict");
        }
      } else {
        setErr(e.message || "Failed to sync job with HubSpot");
        try {
          const status = await apiGet(`/api/jobs/${job.id}/hubspot/status`);
          setJobHubSpotStatuses(prev => new Map(prev).set(job.id, status));
        } catch {
          // Best-effort refresh after a failed sync.
        }
      }
    } finally {
      setHubSpotPushingIds(prev => { const next = new Set(prev); next.delete(job.id); return next; });
    }
  }

  async function handleBulkHubSpot() {
    const targets = visibleJobs.filter(job => {
      const status = jobHubSpotStatuses.get(job.id);
      if (!status || status.state === "disconnected" || hubSpotPushingIds.has(job.id)) return false;
      return true;
    });
    if (targets.length === 0) return;
    setErr("");
    for (const job of targets) {
      if (jobHubSpotStatuses.get(job.id)?.linked) {
        await handleSyncJobWithHubSpot(job);
      } else {
        await handlePushJobToHubSpot(job.id);
      }
    }
  }

  const hubSpotActionCount = visibleJobs.filter(job => {
    const status = jobHubSpotStatuses.get(job.id);
    return status && status.state !== "disconnected" && !hubSpotPushingIds.has(job.id);
  }).length;
  const hubSpotBulkBusy = hubSpotPushingIds.size > 0;

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
          <Button size="small" variant="outlined"
            onClick={handleBulkHubSpot}
            disabled={hubSpotBulkBusy || hubSpotActionCount === 0}
            startIcon={hubSpotBulkBusy
              ? <SyncIcon sx={{
                  fontSize: 14,
                  animation: "hubspotSpin 0.9s linear infinite",
                  "@keyframes hubspotSpin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }} />
              : <HubOutlinedIcon sx={{ fontSize: 14 }} />}
            sx={{
              fontSize: 12, fontWeight: 500, borderRadius: "6px", textTransform: "none",
              borderColor: BORDER, color: HUBSPOT, bgcolor: "#fff", boxShadow: "none",
              "&.Mui-disabled": { bgcolor: "#F7F8FA", color: MUTED, borderColor: BORDER },
              "&:hover": { bgcolor: HUBSPOT_BG, borderColor: HUBSPOT }
            }}>
            Sync HubSpot
          </Button>
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

        <Alert severity="info" sx={{ mb: 2, borderRadius: "8px" }}>
          💡 Tip: You can create new jobs and find candidates all from{" "}
          <Box
            component="span"
            onClick={() => nav("/coworker")}
            sx={{ color: ACCENT, textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}
          >
            Co-worker
          </Box>.
        </Alert>

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
          <ColumnPickerButton options={JOB_EXTRA_COLUMNS} selected={extraJobColumns} onToggle={toggleExtraJobColumn} />
        </Box>

        {/* Jobs table */}
        <Paper elevation={0} sx={{
          border: `1px solid ${BORDER}`, borderRadius: "10px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", mb: 1.75
        }}>
          <Box sx={{ overflowX: "auto" }}>
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
                {JOB_EXTRA_COLUMNS.filter(c => extraJobColumns.has(c.key)).map(c => (
                  <TableCell key={c.key} sx={thSx}>{c.label}</TableCell>
                ))}
                <TableCell sx={{ ...thSx, textAlign: "right" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && visibleJobs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11 + extraJobColumns.size} sx={{ textAlign: "center", py: 5, color: MUTED, fontSize: 13 }}>
                    No jobs found
                  </TableCell>
                </TableRow>
              )}
              {visibleJobs.map((job, idx) => {
                const isSelected = job.id === selectedJobId;
                const candCount = job.candidateCount ?? 0;
                const avg = job.avgMatchScore ?? null;
                const hubSpotStatus = jobHubSpotStatuses.get(job.id);
                const hubSpotLinked = hubSpotStatus?.linked;
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
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
                          {job.title}
                        </Typography>
                        <HubSpotJobBadge status={hubSpotStatus} />
                      </Box>
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
                    {JOB_EXTRA_COLUMNS.filter(c => extraJobColumns.has(c.key)).map(c => (
                      <TableCell key={c.key} sx={{ py: 1.5, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                        {c.get(job)}
                      </TableCell>
                    ))}

                    <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}
                      onClick={e => e.stopPropagation()}>
                      <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                        {hubSpotLinked && hubSpotStatus?.externalUrl && (
                          <Tooltip title="Open in HubSpot">
                            <IconButton
                              component="a"
                              href={hubSpotStatus.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              size="small"
                              aria-label={`Open ${job.title} in HubSpot`}
                              sx={{
                                width: 28, height: 28, border: `1px solid ${BORDER}`, borderRadius: "6px",
                                color: HUBSPOT, bgcolor: "#fff",
                                "&:hover": { bgcolor: HUBSPOT_BG, borderColor: HUBSPOT }
                              }}>
                              <OpenInNewIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {/* ── View Job opens the read-only Job Detail page (Edit lives there) ── */}
                        <Button size="small" variant="outlined"
                          onClick={e => { e.stopPropagation(); nav(`/jobs/${job.id}`); }}
                          sx={{
                            fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
                            borderRadius: "6px", textTransform: "none",
                            "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE }
                          }}>
                          View Job
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
          </Box>
          {!search && jobsHasMore && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 1.5, borderTop: `1px solid ${BORDER}` }}>
              <Button variant="outlined" onClick={handleLoadMoreJobs} disabled={jobsLoadingMore}
                sx={{
                  fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT,
                  borderRadius: "6px", textTransform: "none",
                  "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE }
                }}>
                {jobsLoadingMore ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : "Load More Jobs"}
              </Button>
            </Box>
          )}
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
                <Button size="small" variant="outlined"
                  onClick={handleRunBulkAnalysisForJob}
                  disabled={unanalyzedCandidateCount === 0 || bulkAnalyzing || bulkAnalysisActive}
                  startIcon={(bulkAnalyzing || bulkAnalysisActive)
                    ? <CircularProgress size={12} sx={{ color: ACCENT }} />
                    : <AutoAwesomeIcon sx={{ fontSize: 12 }} />}
                  sx={{
                    fontSize: 11, fontWeight: 500, borderColor: ACCENT_BR, color: ACCENT,
                    borderRadius: "6px", textTransform: "none",
                    "&:hover": { borderColor: ACCENT, bgcolor: ACCENT_BG }
                  }}>
                  {bulkAnalysisActive
                    ? `Analyzing ${(bulkAnalysisStatus.succeeded ?? 0) + (bulkAnalysisStatus.failed ?? 0)}/${bulkAnalysisStatus.total ?? 0}…`
                    : `Run Bulk Analysis${unanalyzedCandidateCount > 0 ? ` (${unanalyzedCandidateCount})` : ""}`}
                </Button>
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
                <ColumnPickerButton options={CANDIDATE_EXTRA_COLUMNS} selected={extraCandidateColumns} onToggle={toggleExtraCandidateColumn} />
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 2.25, py: 1.25, borderBottom: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>Stage:</Typography>
              {["All", ...CANDIDATE_STAGES].map(s => (
                <FilterChip key={s} label={`${s} (${candidateStageCounts[s] ?? 0})`}
                  active={candidateStageFilter === s} onClick={() => setCandidateStageFilter(s)} />
              ))}
            </Box>
            {candidatesLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={22} sx={{ color: ACCENT }} />
              </Box>
            ) : (
              <>
                <CandidateSubTable
                  candidates={selectedCandidates}
                  jobTitle={selectedJob.title}
                  extraColumns={CANDIDATE_EXTRA_COLUMNS.filter(c => extraCandidateColumns.has(c.key))}
                  onRunAnalysis={handleRunAnalysis}
                  onRemoveCandidate={handleRemoveCandidate}
                  onAnalysisStarted={() => setAnalysisDialog(true)}
                />
                {selectedCandidatesMeta?.hasMore && (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 1.5, borderTop: `1px solid ${BORDER}` }}>
                    <Button variant="outlined" onClick={handleLoadMoreCandidates} disabled={candidatesLoadingMore}
                      sx={{
                        fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT,
                        borderRadius: "6px", textTransform: "none",
                        "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE }
                      }}>
                      {candidatesLoadingMore ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : "Load More Candidates"}
                    </Button>
                  </Box>
                )}
              </>
            )}
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
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <TextField select size="small" value={shortlistTopN}
                  onChange={e => setShortlistTopN(Number(e.target.value))}
                  disabled={shortlistingExternal}
                  sx={{ width: 74, "& .MuiOutlinedInput-root": { borderRadius: "6px", fontSize: 11 } }}>
                  {[5, 10, 20, 50].map(n => <MenuItem key={n} value={n} sx={{ fontSize: 11 }}>{n}</MenuItem>)}
                </TextField>
                <Button size="small" variant="outlined"
                  onClick={() => handleShortlistTopExternal(shortlistTopN)}
                  disabled={externalCandidates.length === 0 || shortlistingExternal}
                  startIcon={shortlistingExternal ? <CircularProgress size={13} sx={{ color: PURPLE }} /> : null}
                  sx={{
                    fontSize: 11, fontWeight: 500, borderColor: PURPLE_BR, color: PURPLE, borderRadius: "6px",
                    textTransform: "none", "&:hover": { borderColor: PURPLE, bgcolor: PURPLE_BG }
                  }}>
                  {shortlistingExternal ? "Shortlisting…" : `Shortlist Top ${shortlistTopN}`}
                </Button>
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
            </Box>
            <Box sx={{ p: 2.25 }}>
              {externalError && <Alert severity="error" sx={{ mb: 1.5 }}>{externalError}</Alert>}
              {shortlistMsg && <Alert severity="info" sx={{ mb: 1.5 }} onClose={() => setShortlistMsg("")}>{shortlistMsg}</Alert>}
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
