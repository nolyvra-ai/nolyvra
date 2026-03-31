import { useEffect, useRef, useState } from "react";
import {
  Box, Paper, Typography, Button, Table, TableHead,
  TableRow, TableCell, TableBody, LinearProgress, Alert,
  TextField, CircularProgress,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";

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
const BORDER      = "#E8ECF2";
const MUTED       = "#9AA3B4";
const TEXT        = "#0F1623";
const ACCENT      = "#1D72E8";
const SUCCESS     = "#16A34A";
const SUCCESS_BG  = "#F0FDF4";
const SUCCESS_BR  = "#BBF7D0";
const WARN        = "#D97706";
const WARN_BG     = "#FFFBEB";
const WARN_BR     = "#FDE68A";
const DANGER      = "#DC2626";
const DANGER_BG   = "#FEF2F2";
const DANGER_BR   = "#FECACA";
const ACCENT_BG   = "#EBF2FF";
const ACCENT_BR   = "#BFDBFE";
const NEUTRAL_BG  = "#F1F3F7";
const SURFACE     = "#FAFBFD";
const PURPLE      = "#7C3AED";
const PURPLE_BG   = "#F5F3FF";
const PURPLE_BR   = "#C4B5FD";
const CARD_SHADOW = "0 1px 3px rgba(0,0,0,0.05)";

const thSx = {
  fontSize: 10, fontWeight: 700, color: MUTED,
  textTransform: "uppercase", letterSpacing: "0.5px",
  borderBottom: `1px solid ${BORDER}`, bgcolor: SURFACE,
  py: 1.25, px: 2, whiteSpace: "nowrap",
};

function scoreColor(v) {
  if (v >= 80) return SUCCESS;
  if (v >= 60) return WARN;
  return DANGER;
}
function scoreCircleColor(v) {
  if (v >= 80) return { border: SUCCESS, color: SUCCESS };
  if (v >= 60) return { border: WARN,    color: WARN    };
  return              { border: DANGER,  color: DANGER  };
}
function riskVariant(level) {
  if (level === "High")   return "danger";
  if (level === "Medium") return "warning";
  if (level === "Low")    return "accent";
  return "neutral";
}

// ─── Shared components ────────────────────────────────────────────────────────
function Card({ children, sx = {}, isNew = false }) {
  return (
    <Paper elevation={0} sx={{
      border: `1px solid ${isNew ? PURPLE_BR : BORDER}`,
      borderRadius: "10px", boxShadow: CARD_SHADOW,
      overflow: "hidden", bgcolor: "#fff",
      ...(isNew && { boxShadow: `0 0 0 2px rgba(124,58,237,0.06)` }),
      ...sx,
    }}>
      {children}
    </Paper>
  );
}

function CardHead({ title, action, isNew = false }) {
  return (
    <Box sx={{
      px: 2.25, py: 1.75, borderBottom: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
        {isNew && <Typography sx={{ fontSize: 16 }}>✦</Typography>}
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</Typography>
        {isNew && (
          <Box sx={{ display: "inline-flex", alignItems: "center", px: "7px", py: "2px",
            bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`, borderRadius: "4px",
            fontSize: 10, fontWeight: 600, color: PURPLE, ml: 0.5 }}>NEW</Box>
        )}
      </Box>
      {action}
    </Box>
  );
}

function Badge({ label, variant = "neutral", sx: extraSx = {} }) {
  const styles = {
    success: { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
    warning: { bg: WARN_BG,    border: WARN_BR,    color: WARN    },
    danger:  { bg: DANGER_BG,  border: DANGER_BR,  color: DANGER  },
    accent:  { bg: ACCENT_BG,  border: ACCENT_BR,  color: ACCENT  },
    neutral: { bg: NEUTRAL_BG, border: BORDER,     color: MUTED   },
    purple:  { bg: PURPLE_BG,  border: PURPLE_BR,  color: PURPLE  },
  };
  const s = styles[variant] ?? styles.neutral;
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "20px", px: 1.25, py: 0.25,
      fontSize: 11, fontWeight: 600, color: s.color,
      whiteSpace: "nowrap", ...extraSx,
    }}>
      {label}
    </Box>
  );
}

function ScoreBar({ value }) {
  if (value == null) return null;
  const color = scoreColor(value);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color, width: 34 }}>{value}%</Typography>
      <Box sx={{ flex: 1, height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
        <Box sx={{ width: `${value}%`, height: "100%", bgcolor: color, borderRadius: "3px" }} />
      </Box>
    </Box>
  );
}

// ─── MVP2 NEW: AI Candidate Summary ──────────────────────────────────────────
// Calls GET /api/candidates/{id}/analysis/summary
function AiSummaryCard({ candidateId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState(null);

  useEffect(() => {
    apiGet(`/api/candidates/${candidateId}/analysis/summary`)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [candidateId]);

  if (loading) return (
    <Card isNew>
      <CardHead title="AI Generated Candidate Summary" isNew />
      <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <CircularProgress size={16} sx={{ color: PURPLE }} />
        <Typography sx={{ fontSize: 12, color: MUTED }}>Generating summary…</Typography>
      </Box>
    </Card>
  );
  if (err || !data) return null;

  return (
    <Card isNew>
      <CardHead title="AI Generated Candidate Summary" isNew
        action={
          <Button size="small" variant="outlined"
            onClick={() => navigator.clipboard?.writeText(data.professionalSummary || "")}
            sx={{ fontSize: 11, borderColor: BORDER, color: TEXT, borderRadius: "6px",
              textTransform: "none", "&:hover": { borderColor: "#C0C8D8" } }}>
            📋 Copy for Client
          </Button>
        } />
      <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.25 }}>

        {/* Professional summary */}
        <Box sx={{ bgcolor: "#F8F7FF", border: `1px solid ${PURPLE_BR}`,
          borderRadius: "7px", p: "12px 14px" }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: PURPLE,
            textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75 }}>
            Professional Summary
          </Typography>
          <Typography sx={{ fontSize: 12, color: TEXT, lineHeight: 1.7 }}>
            {data.professionalSummary}
          </Typography>
        </Box>

        {/* Strengths + Concerns grid */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
          <Box sx={{ bgcolor: SUCCESS_BG, border: `1px solid ${SUCCESS_BR}`,
            borderRadius: "7px", p: "10px 12px" }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: SUCCESS,
              textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75 }}>
              ✓ Strengths
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {(data.strengths ?? []).map((s, i) => (
                <Typography key={i} sx={{ fontSize: 11, color: TEXT }}>• {s}</Typography>
              ))}
            </Box>
          </Box>
          <Box sx={{ bgcolor: WARN_BG, border: `1px solid ${WARN_BR}`,
            borderRadius: "7px", p: "10px 12px" }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: WARN,
              textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75 }}>
              ⚠ Potential Concerns
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {(data.concerns ?? []).map((c, i) => (
                <Typography key={i} sx={{ fontSize: 11, color: TEXT }}>• {c}</Typography>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Interview focus areas */}
        {(data.interviewFocusAreas ?? []).length > 0 && (
          <Box sx={{ bgcolor: "#F0F7FF", border: `1px solid ${ACCENT_BR}`,
            borderRadius: "7px", p: "10px 14px" }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: ACCENT,
              textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75 }}>
              Suggested Interview Focus Areas
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {data.interviewFocusAreas.map((a, i) => (
                <Badge key={i} label={a} variant="accent" sx={{ fontSize: 11 }} />
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </Card>
  );
}

// ─── MVP2 NEW: Fraud Detection ────────────────────────────────────────────────
// Calls GET /api/candidates/{id}/analysis/fraud-signals
function FraudDetectionCard({ candidateId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState(null);

  useEffect(() => {
    apiGet(`/api/candidates/${candidateId}/analysis/fraud-signals`)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [candidateId]);

  if (loading) return (
    <Card isNew>
      <CardHead title="Profile Consistency & Authenticity Detection" isNew />
      <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <CircularProgress size={16} sx={{ color: PURPLE }} />
        <Typography sx={{ fontSize: 12, color: MUTED }}>Analysing authenticity…</Typography>
      </Box>
    </Card>
  );
  if (err || !data) return null;

  const verdictVariant = data.overallVerdict?.includes("High")
    ? "danger" : data.overallVerdict?.includes("Caution") ? "warning" : "success";

  const signalBg = {
    AI_GENERATED:          WARN_BG,
    TIMELINE_INCONSISTENCY: DANGER_BG,
    SKILL_MISMATCH:         DANGER_BG,
    CAREER_PATTERN:         SUCCESS_BG,
  };
  const signalIcon = {
    AI_GENERATED:           "🤖",
    TIMELINE_INCONSISTENCY: "📅",
    SKILL_MISMATCH:         "📋",
    CAREER_PATTERN:         "📈",
  };

  return (
    <Card isNew>
      <CardHead title="Profile Consistency & Authenticity Detection" isNew
        action={<Badge label={data.overallVerdict} variant={verdictVariant} />} />
      <Box sx={{ p: 2.25 }}>

        {/* Score + gauge + verdict */}
        <Box sx={{ display: "flex", gap: 2.5, alignItems: "center", mb: 2, flexWrap: "wrap" }}>
          <Box sx={{ textAlign: "center" }}>
            <Box sx={{ width: 64, height: 64, borderRadius: "50%",
              border: `3px solid ${scoreCircleColor(data.authenticityScore).border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, color: scoreCircleColor(data.authenticityScore).color }}>
              {data.authenticityScore}%
            </Box>
            <Typography sx={{ fontSize: 10, color: MUTED, mt: 0.5, lineHeight: 1.3 }}>
              Authenticity<br />Score
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: MUTED,
              textTransform: "uppercase", letterSpacing: ".4px", mb: 0.5 }}>
              Authenticity Gauge
            </Typography>
            <Box sx={{ height: 10, borderRadius: "5px", mb: 0.75, position: "relative",
              background: `linear-gradient(90deg,${DANGER} 0%,${WARN} 40%,${SUCCESS} 80%,#22C55E 100%)` }}>
              <Box sx={{ position: "absolute",
                left: `${Math.max(0, Math.min(96, 100 - data.authenticityScore))}%`,
                top: -5, width: 3, height: 20, bgcolor: TEXT,
                borderRadius: "2px", transform: "translateX(-50%)" }} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 10, color: MUTED }}>High Risk</Typography>
              <Typography sx={{ fontSize: 10, color: MUTED }}>Medium</Typography>
              <Typography sx={{ fontSize: 10, color: MUTED }}>Low Risk</Typography>
            </Box>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
              textTransform: "uppercase", mb: 0.75 }}>Overall Verdict</Typography>
            <Badge label={`⚠ ${data.overallVerdict}`} variant={verdictVariant}
              sx={{ fontSize: 12, px: 1.5, py: 0.5 }} />
          </Box>
        </Box>

        {/* Signals */}
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED,
          textTransform: "uppercase", letterSpacing: ".5px", mb: 1 }}>
          Detected Signals
        </Typography>
        <Box>
          {(data.signals ?? []).map((sig, i) => {
            const sigVariant = sig.severity === "High" ? "danger"
              : sig.severity === "Medium" ? "warning" : "success";
            const bg   = signalBg[sig.type]   ?? NEUTRAL_BG;
            const icon = signalIcon[sig.type] ?? "⚠";
            return (
              <Box key={i} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start",
                py: 1, borderBottom: i < data.signals.length - 1 ? `1px solid #F0F2F6` : "none" }}>
                <Box sx={{ width: 28, height: 28, borderRadius: "6px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, bgcolor: bg }}>
                  {icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center",
                    justifyContent: "space-between", mb: 0.25 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>
                      {sig.title}
                    </Typography>
                    <Badge label={sig.severity} variant={sigVariant} sx={{ fontSize: 10 }} />
                  </Box>
                  <Typography sx={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
                    {sig.description}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Card>
  );
}

// ─── MVP2 NEW: Placement Probability ─────────────────────────────────────────
// Calls GET /api/candidates/{id}/analysis/placement-probability
function PlacementProbabilityCard({ candidateId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState(null);

  useEffect(() => {
    apiGet(`/api/candidates/${candidateId}/analysis/placement-probability`)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [candidateId]);

  if (loading) return (
    <Card isNew>
      <CardHead title="Placement Probability" isNew />
      <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <CircularProgress size={16} sx={{ color: PURPLE }} />
        <Typography sx={{ fontSize: 12, color: MUTED }}>Calculating probability…</Typography>
      </Box>
    </Card>
  );
  if (err || !data) return null;

  const probColor = data.placementProbability >= 75 ? SUCCESS
    : data.placementProbability >= 50 ? WARN : DANGER;
  const confVariant = data.confidenceLevel === "High" ? "success"
    : data.confidenceLevel === "Medium" ? "warning" : "danger";

  return (
    <Card isNew>
      <CardHead title="Placement Probability" isNew
        action={
          <Typography sx={{ fontSize: 10, color: MUTED, fontStyle: "italic" }}>
            AI · Based on hiring patterns
          </Typography>
        } />
      <Box sx={{ p: 2.25 }}>
        {/* Big score + bar */}
        <Box sx={{ display: "flex", gap: 2.5, alignItems: "center", mb: 2, flexWrap: "wrap" }}>
          <Box sx={{ textAlign: "center", flexShrink: 0 }}>
            <Typography sx={{ fontSize: 42, fontWeight: 700, color: probColor, lineHeight: 1 }}>
              {data.placementProbability}%
            </Typography>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>
              Placement<br />Probability
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 500 }}>Placement Likelihood</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: probColor }}>
                {data.placementProbability}%
              </Typography>
            </Box>
            <Box sx={{ height: 10, bgcolor: "#F0F2F6", borderRadius: "5px",
              overflow: "hidden", mb: 1.25 }}>
              <Box sx={{ width: `${data.placementProbability}%`, height: "100%",
                bgcolor: probColor, borderRadius: "5px" }} />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography sx={{ fontSize: 11, color: MUTED }}>Confidence Level</Typography>
              <Badge label={`${data.confidenceLevel} Confidence`} variant={confVariant} />
            </Box>
            {data.basedOnSimilarPlacements > 0 && (
              <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>
                Based on {data.basedOnSimilarPlacements} similar placements.
              </Typography>
            )}
          </Box>
        </Box>

        {/* Positive signals + Risk factors */}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
          <Box sx={{ bgcolor: SUCCESS_BG, border: `1px solid ${SUCCESS_BR}`,
            borderRadius: "7px", p: "10px 12px" }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: SUCCESS,
              textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75 }}>
              ✓ Positive Signals
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {(data.positiveSignals ?? []).map((s, i) => (
                <Typography key={i} sx={{ fontSize: 11, color: TEXT }}>• {s}</Typography>
              ))}
            </Box>
          </Box>
          <Box sx={{ bgcolor: DANGER_BG, border: `1px solid ${DANGER_BR}`,
            borderRadius: "7px", p: "10px 12px" }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: DANGER,
              textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75 }}>
              ✗ Risk Factors
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              {(data.riskFactors ?? []).map((r, i) => (
                <Typography key={i} sx={{ fontSize: 11, color: TEXT }}>• {r}</Typography>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const { candidateId } = useParams();
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  const [analysis,   setAnalysis]   = useState(null);
  const [candidate,  setCandidate]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState("");
  const [notes,      setNotes]      = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved,  setNotesSaved]  = useState(false);
  const [rerunning,  setRerunning]  = useState(false);
  const printRef = useRef(null); // ref for the printable content area

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setErr("");
      try {
        const [analysisResp, candidateResp] = await Promise.all([
          apiGet(`/api/candidates/${candidateId}/aianalysis`),
          apiGet(`/api/candidates/${candidateId}`),
        ]);
        if (cancelled) return;
        setAnalysis(analysisResp);
        setCandidate(candidateResp);
        setNotes(analysisResp?.recruiterNotes ?? "");
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load analysis");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [candidateId]);

  async function handleRerun() {
    setRerunning(true);
    try {
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/analyze`);
      url.searchParams.set("loginId", loginId);
      await fetch(url.toString(), { method: "POST" });
      const updated = await apiGet(`/api/candidates/${candidateId}/aianalysis`);
      setAnalysis(updated);
    } catch (e) {
      console.error("Re-run failed", e);
    } finally {
      setRerunning(false);
    }
  }

  async function handleSaveNotes() {
    setNotesSaving(true);
    try {
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/notes`);
      url.searchParams.set("loginId", loginId);
      await fetch(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (e) {
      console.error("Save notes failed", e);
    } finally {
      setNotesSaving(false);
    }
  }

  // ── Export PDF — uses visibility:hidden trick so child elements can override parent
  function handleExportPdf() {
    const styleId = "nolyvra-print-style";
    document.getElementById(styleId)?.remove();

    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @media print {
        @page { margin: 14mm 12mm; size: A4 portrait; }

        /* Step 1: make every element on the page invisible */
        body * { visibility: hidden; }

        /* Step 2: make the analysis content and all its children visible —
           visibility is inherited so children of a visible ancestor are visible too.
           This works regardless of nesting depth, unlike display:none. */
        #analysis-print-root,
        #analysis-print-root * { visibility: visible; }

        /* Step 3: position the content at the top-left of the printed page */
        #analysis-print-root {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          overflow: visible !important;
          background: #fff;
          padding: 8px 0;
        }

        /* Remove shadows and overflow clipping for print */
        #analysis-print-root .MuiPaper-root {
          box-shadow: none !important;
          border: 1px solid #E8ECF2 !important;
          break-inside: avoid;
          page-break-inside: avoid;
        }

        /* Hide buttons, inputs and the annotation strip inside the content */
        #analysis-print-root button,
        #analysis-print-root input,
        #analysis-print-root textarea { visibility: hidden; }
      }
    `;
    document.head.appendChild(style);

    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => document.getElementById(styleId)?.remove(), 1500);
    });
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const consistency        = analysis?.scores?.consistencyScore ?? null;
  const capability         = analysis?.scores?.capabilityScore  ?? null;
  const riskLevel          = analysis?.scores?.riskLevel        ?? "—";
  const riskFlagsRaw       = analysis?.riskFlags ?? [];
  const timelineMatch      = analysis?.consistency?.timelineMatchPercent ?? null;
  const consistencyFlags   = analysis?.consistency?.flags ?? [];
  const capMatrix          = analysis?.capabilityMatrix?.rows ?? [];
  const questions          = analysis?.suggestedQuestions ?? [];
  const recommendation     = analysis?.recommendation ?? null;
  const candidateName      = analysis?.candidate_name ?? candidate?.name ?? "—";
  const matchedSkills      = analysis?.matchedSkills ?? [];
  const missingSkills      = analysis?.missingSkills ?? [];
  const strengths          = analysis?.strengthSignals ?? [];
  const aiVerdict          = analysis?.aiVerdict ?? null;
  const aiConfidence       = analysis?.aiConfidence ?? null;
  const executionTier      = analysis?.executionTier ?? null;
  const consistencyBreakdown = analysis?.consistencyBreakdown ?? [];

  const analysedAt = analysis?.analyzedAt
    ? new Date(analysis.analyzedAt).toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%",
      overflow: "hidden", bgcolor: "#F7F8FA" }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: "#fff", borderBottom: `1px solid ${BORDER}`,
        px: 3, py: 1.5, display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0 }}>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: "-0.2px" }}>
            Analysis Result{candidateName !== "—" ? ` — ${candidateName}` : ""}
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            {candidate?.jobTitle ?? analysis?.jobTitle ?? "—"} · Analysed {analysedAt}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" variant="outlined" onClick={() => nav("/candidates")}
            sx={{ fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT,
              borderRadius: "6px", textTransform: "none",
              "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
            ← Back
          </Button>
          <Button size="small" variant="outlined"
            onClick={handleExportPdf}
            sx={{ fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT,
              borderRadius: "6px", textTransform: "none",
              "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
            ⬇ Export PDF
          </Button>
          {/* MVP2: Open Workflow replaces Re-run in header */}
          <Button size="small" variant="contained"
            onClick={() => nav(`/candidates/${candidateId}/workflow`)}
            sx={{ fontSize: 12, fontWeight: 500, bgcolor: ACCENT, borderRadius: "6px",
              textTransform: "none", boxShadow: "none",
              "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            👤 Open Workflow
          </Button>
        </Box>
      </Box>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <Box id="analysis-print-root" ref={printRef} sx={{ flex: 1, overflow: "auto", p: 2.5 }}>

        {err && <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }}>{err}</Alert>}

        {loading && (
          <Card sx={{ p: 2.5, mb: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, mb: 1 }}>
              Loading analysis…
            </Typography>
            <LinearProgress sx={{ borderRadius: "4px" }} />
          </Card>
        )}

        {!loading && !analysis && !err && (
          <Card sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: 13, color: MUTED, mb: 2 }}>
              No analysis found for this candidate.
            </Typography>
            <Button variant="contained" size="small" onClick={handleRerun}
              sx={{ fontSize: 12, fontWeight: 500, bgcolor: ACCENT, borderRadius: "6px",
                textTransform: "none", boxShadow: "none",
                "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
              Run Analysis Now
            </Button>
          </Card>
        )}

        {!loading && analysis && (
          <>
            {/* ── Score meta strip ─────────────────────────────────────────── */}
            <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px",
              boxShadow: CARD_SHADOW, bgcolor: "#fff", px: 3, py: 2, mb: 2,
              display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>

              {consistency != null && (
                <>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ width: 72, height: 72, borderRadius: "50%",
                      border: `3px solid ${scoreCircleColor(consistency).border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontWeight: 700, color: scoreCircleColor(consistency).color }}>
                      {consistency}%
                    </Box>
                    <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 500,
                      textAlign: "center", lineHeight: 1.3 }}>
                      Consistency<br />Score
                    </Typography>
                  </Box>
                  <Box sx={{ width: "1px", bgcolor: BORDER, height: 56, flexShrink: 0 }} />
                </>
              )}

              {capability != null && (
                <>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ width: 72, height: 72, borderRadius: "50%",
                      border: `3px solid ${scoreCircleColor(capability).border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontWeight: 700, color: scoreCircleColor(capability).color }}>
                      {capability}%
                    </Box>
                    <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 500,
                      textAlign: "center", lineHeight: 1.3 }}>
                      Capability<br />Match
                    </Typography>
                  </Box>
                  <Box sx={{ width: "1px", bgcolor: BORDER, height: 56, flexShrink: 0 }} />
                </>
              )}

              {timelineMatch != null && (
                <>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ width: 72, height: 72, borderRadius: "50%",
                      border: `3px solid ${scoreCircleColor(timelineMatch).border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontWeight: 700, color: scoreCircleColor(timelineMatch).color }}>
                      {timelineMatch}%
                    </Box>
                    <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 500,
                      textAlign: "center", lineHeight: 1.3 }}>
                      Timeline<br />Match
                    </Typography>
                  </Box>
                  <Box sx={{ width: "1px", bgcolor: BORDER, height: 56, flexShrink: 0 }} />
                </>
              )}

              <Box sx={{ flex: 1, display: "flex", gap: 4 }}>
                <Box>
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.5px" }}>Candidate</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 500, mt: 0.25 }}>{candidateName}</Typography>
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.5px", mt: 1 }}>Applied For</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 500, mt: 0.25 }}>
                    {candidate?.jobTitle ?? analysis?.jobTitle ?? "—"}
                  </Typography>
                </Box>
                <Box>
                  {candidate?.linkedinUrl && (
                    <>
                      <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                        textTransform: "uppercase", letterSpacing: "0.5px" }}>LinkedIn</Typography>
                      <Typography component="a" href={candidate.linkedinUrl} target="_blank"
                        sx={{ fontSize: 13, fontWeight: 500, mt: 0.25, color: ACCENT,
                          textDecoration: "none", display: "block",
                          "&:hover": { textDecoration: "underline" } }}>
                        {candidate.linkedinUrl.replace("https://", "")}
                      </Typography>
                    </>
                  )}
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.5px", mt: 1 }}>Overall Risk</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Badge
                      label={`${riskLevel} · ${riskFlagsRaw.length} Flag${riskFlagsRaw.length !== 1 ? "s" : ""}`}
                      variant={riskVariant(riskLevel)} />
                  </Box>
                </Box>
              </Box>

              {aiConfidence && (
                <>
                  <Box sx={{ width: "1px", bgcolor: BORDER, height: 56, flexShrink: 0 }} />
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, px: 1 }}>
                    <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                      textTransform: "uppercase", letterSpacing: "0.5px" }}>AI Confidence</Typography>
                    <Badge label={aiConfidence}
                      variant={aiConfidence === "High" ? "success" : aiConfidence === "Medium" ? "warning" : "danger"} />
                    {analysis?.aiConfidenceNote && (
                      <Typography sx={{ fontSize: 10, color: MUTED, textAlign: "center",
                        lineHeight: 1.4, maxWidth: 120 }}>
                        {analysis.aiConfidenceNote}
                      </Typography>
                    )}
                  </Box>
                </>
              )}
            </Paper>

            {/* ── Two-column layout ─────────────────────────────────────────── */}
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>

              {/* ── Left column ───────────────────────────────────────────── */}
              <Box sx={{ flex: 1.4, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>

                {/* ✦ MVP2 SECTION 1: AI Summary — first card in left column */}
                <AiSummaryCard candidateId={candidateId} />

                {/* Existing: CV vs LinkedIn Consistency */}
                {consistencyBreakdown.length > 0 && (
                  <Card>
                    <CardHead title="CV vs LinkedIn Consistency"
                      action={<Badge label={`${consistency}% Match`}
                        variant={consistency >= 80 ? "success" : consistency >= 60 ? "warning" : "danger"} />} />
                    <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {consistencyBreakdown.map((item, i) => (
                        <Box key={i}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                            <Typography sx={{ fontSize: 12, color: TEXT }}>{item.label}</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 600, color: item.match ? SUCCESS : WARN }}>
                              {item.match ? "✓ Match" : `⚠ ${item.note ?? "Mismatch"}`}
                            </Typography>
                          </Box>
                          <Box sx={{ height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
                            <Box sx={{ width: `${item.score ?? (item.match ? 100 : 60)}%`,
                              height: "100%", bgcolor: item.match ? SUCCESS : WARN, borderRadius: "3px" }} />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Card>
                )}

                {/* Existing: Skill Alignment */}
                {(matchedSkills.length > 0 || missingSkills.length > 0) && (
                  <Card>
                    <CardHead title="CV vs JD Capability Alignment"
                      action={<Badge label={`${capability}% Match`}
                        variant={capability >= 80 ? "success" : capability >= 60 ? "warning" : "danger"} />} />
                    <Box sx={{ p: 2.25 }}>
                      {matchedSkills.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={{ fontSize: 10, color: MUTED, textTransform: "uppercase",
                            letterSpacing: "0.5px", fontWeight: 600, mb: 0.75 }}>Matched Skills</Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                            {matchedSkills.map((s, i) => (
                              <Box key={i} sx={{ bgcolor: SUCCESS_BG, border: `1px solid ${SUCCESS_BR}`,
                                borderRadius: "4px", px: 1, py: 0.25, fontSize: 11, fontWeight: 500, color: SUCCESS }}>
                                {s} ✓
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                      {missingSkills.length > 0 && (
                        <Box>
                          <Typography sx={{ fontSize: 10, color: MUTED, textTransform: "uppercase",
                            letterSpacing: "0.5px", fontWeight: 600, mb: 0.75 }}>Gaps / Not Evidenced</Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                            {missingSkills.map((s, i) => (
                              <Box key={i} sx={{ bgcolor: DANGER_BG, border: `1px solid ${DANGER_BR}`,
                                borderRadius: "4px", px: 1, py: 0.25, fontSize: 11, fontWeight: 500, color: DANGER }}>
                                {s} ✗
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Card>
                )}

                {/* Existing: Capability Matrix */}
                {capMatrix.length > 0 && (
                  <Card>
                    <CardHead title="Capability Matrix Breakdown"
                      action={<Badge label={`Weighted Score: ${capability}%`} variant="warning" />} />
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ ...thSx, width: "22%" }}>Capability Area</TableCell>
                          <TableCell sx={{ ...thSx, width: "10%" }}>Weight</TableCell>
                          <TableCell sx={{ ...thSx, width: "24%" }}>Candidate Score</TableCell>
                          <TableCell sx={{ ...thSx, width: "14%" }}>Weighted Impact</TableCell>
                          <TableCell sx={thSx}>Gap Level</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {capMatrix.map((row, idx) => (
                          <TableRow key={idx} sx={{ bgcolor: idx % 2 === 1 ? SURFACE : "#fff",
                            "&:last-child td": { borderBottom: "none" } }}>
                            <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, fontWeight: 600,
                              color: TEXT, borderBottom: `1px solid ${BORDER}` }}>{row.capability}</TableCell>
                            <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, color: MUTED,
                              borderBottom: `1px solid ${BORDER}` }}>{row.weightPercent}%</TableCell>
                            <TableCell sx={{ py: 1.25, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                              <ScoreBar value={row.scorePercent} />
                            </TableCell>
                            <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, fontWeight: 700,
                              color: scoreColor(row.scorePercent), borderBottom: `1px solid ${BORDER}` }}>
                              {((row.scorePercent * row.weightPercent) / 100).toFixed(1)}
                            </TableCell>
                            <TableCell sx={{ py: 1.25, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                              <Badge label={`${row.gapLevel} Gap`}
                                variant={row.gapLevel === "High" ? "danger"
                                  : row.gapLevel === "Medium" ? "warning" : "success"}
                                sx={{ fontSize: 10 }} />
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: "#F0F7FF", borderTop: `2px solid ${BORDER}` }}>
                          <TableCell colSpan={3} sx={{ py: 1.5, px: 2, fontWeight: 700,
                            fontSize: 12, color: TEXT }}>Total Weighted Capability Score</TableCell>
                          <TableCell sx={{ py: 1.5, px: 2, fontWeight: 800, fontSize: 15,
                            color: scoreColor(capability) }}>{capability}</TableCell>
                          <TableCell sx={{ py: 1.5, px: 2 }}>
                            <Badge
                              label={capability >= 80 ? "Strong Match"
                                : capability >= 60 ? "Moderate Match — Proceed with targeted screening"
                                : "Low Match — Review carefully"}
                              variant={capability >= 80 ? "success" : capability >= 60 ? "warning" : "danger"} />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Card>
                )}

                {/* ✦ MVP2 SECTION 2: Fraud Detection */}
                <FraudDetectionCard candidateId={candidateId} />

                {/* ✦ MVP2 SECTION 3: Placement Probability */}
                <PlacementProbabilityCard candidateId={candidateId} />

                {/* Existing: Interview Questions */}
                {questions.length > 0 && (
                  <Card>
                    <CardHead title="AI-Generated Validation Questions"
                      action={<Badge label={`${questions.length} Questions`} variant="accent" />} />
                    <Box>
                      {questions.map((q, i) => {
                        const typeKey   = q.type?.toLowerCase();
                        const numBg     = typeKey === "debugging" || typeKey === "system_design" ? WARN_BG : ACCENT_BG;
                        const numColor  = typeKey === "debugging" || typeKey === "system_design" ? WARN    : ACCENT;
                        const typeLabel = q.type?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                        return (
                          <Box key={i} sx={{ px: 2.25, py: 2,
                            borderBottom: i < questions.length - 1 ? `1px solid #F0F2F6` : "none" }}>
                            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, mb: 0.75 }}>
                              <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: numBg,
                                color: numColor, display: "flex", alignItems: "center",
                                justifyContent: "center", fontSize: 10, fontWeight: 800,
                                flexShrink: 0, mt: "1px" }}>
                                {q.order ?? i + 1}
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: "flex", gap: 0.75, mb: 0.75, flexWrap: "wrap" }}>
                                  <Badge label={typeLabel}
                                    variant={typeKey === "debugging" ? "warning"
                                      : typeKey === "leadership" ? "success" : "accent"}
                                    sx={{ fontSize: 10 }} />
                                </Box>
                                <Typography sx={{ fontSize: 13, fontWeight: 500, color: TEXT,
                                  lineHeight: 1.5 }}>{q.question}</Typography>
                              </Box>
                            </Box>
                            {q.intent && (
                              <Box sx={{ ml: "34px" }}>
                                <Box sx={{ bgcolor: SURFACE, borderRadius: "5px", p: 1 }}>
                                  <Typography sx={{ fontSize: 11, color: ACCENT, fontWeight: 600, mb: 0.25 }}>
                                    ▸ Intent
                                  </Typography>
                                  <Typography sx={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>
                                    {q.intent}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Card>
                )}

                {/* Fallback */}
                {consistencyBreakdown.length === 0 && matchedSkills.length === 0
                  && capMatrix.length === 0 && riskFlagsRaw.length === 0
                  && questions.length === 0 && consistency == null && (
                  <Card sx={{ p: 3, textAlign: "center" }}>
                    <Typography sx={{ fontSize: 13, color: MUTED }}>
                      Analysis scores loaded. Detailed breakdown not available for this candidate.
                    </Typography>
                  </Card>
                )}

              </Box>

              {/* ── Right column ──────────────────────────────────────────── */}
              <Box sx={{ flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 2 }}>

                {/* Recommendation */}
                {recommendation && (
                  <Paper elevation={0} sx={{ border: `1px solid ${ACCENT_BR}`,
                    borderRadius: "10px", overflow: "hidden" }}>
                    <Box sx={{ p: 2, bgcolor: ACCENT_BG }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 600, color: ACCENT,
                        textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.5 }}>
                        AI Recommendation
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#1E3A6E", lineHeight: 1.6 }}>
                        {recommendation}
                      </Typography>
                    </Box>
                  </Paper>
                )}

                {/* Risk Flags */}
                {riskFlagsRaw.length > 0 && (
                  <Card>
                    <CardHead title="Risk Flags"
                      action={<Badge
                        label={`${riskFlagsRaw.length} Flag${riskFlagsRaw.length !== 1 ? "s" : ""}`}
                        variant="warning" />} />
                    <Box sx={{ px: 2, py: 1.5, display: "flex", flexDirection: "column" }}>
                      {riskFlagsRaw.map((flag, i) => (
                        <Box key={i} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start",
                          py: 1.25, borderBottom: i < riskFlagsRaw.length - 1 ? `1px solid #F0F2F6` : "none" }}>
                          <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: WARN,
                            flexShrink: 0, mt: "5px" }} />
                          <Typography sx={{ fontSize: 12, color: TEXT, lineHeight: 1.5 }}>{flag}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Card>
                )}

                {/* Consistency Flags */}
                {consistencyFlags.length > 0 && (
                  <Card>
                    <CardHead title="Consistency Flags" />
                    <Box sx={{ px: 2, py: 1.5, display: "flex", flexDirection: "column" }}>
                      {consistencyFlags.map((flag, i) => {
                        const variant = flag.severity === "High" ? "danger"
                          : flag.severity === "Medium" ? "warning" : "neutral";
                        return (
                          <Box key={i} sx={{ py: 1.25,
                            borderBottom: i < consistencyFlags.length - 1 ? `1px solid #F0F2F6` : "none" }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between",
                              alignItems: "center", mb: 0.5 }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 600, color: TEXT }}>
                                {flag.type?.replace(/_/g, " ")}
                              </Typography>
                              <Badge label={flag.severity} variant={variant} sx={{ fontSize: 10 }} />
                            </Box>
                            <Typography sx={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>
                              {flag.message}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Card>
                )}

                {/* Recruiter Notes */}
                <Card>
                  <CardHead title="Recruiter Notes" />
                  <Box sx={{ p: 2 }}>
                    <TextField multiline rows={4} fullWidth
                      placeholder="Add your notes here…"
                      value={notes}
                      onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          fontSize: 12, bgcolor: SURFACE, borderRadius: "6px",
                          "& fieldset": { borderColor: BORDER },
                          "&:hover fieldset": { borderColor: "#C0C8D8" },
                          "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 1.5 },
                        },
                      }} />
                    <Button fullWidth size="small" variant="outlined"
                      onClick={handleSaveNotes} disabled={notesSaving}
                      sx={{ mt: 1, fontSize: 11,
                        borderColor: notesSaved ? SUCCESS_BR : BORDER,
                        color: notesSaved ? SUCCESS : TEXT,
                        borderRadius: "6px", textTransform: "none",
                        "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
                      {notesSaving ? <CircularProgress size={12} /> : notesSaved ? "✓ Saved" : "Save Notes"}
                    </Button>
                  </Box>
                </Card>

                {/* AI Verdict */}
                {aiVerdict && (
                  <Paper elevation={0} sx={{ border: `1px solid ${WARN_BR}`, borderRadius: "10px" }}>
                    <Box sx={{ p: 2, bgcolor: WARN_BG, borderRadius: "10px" }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 600, color: WARN,
                        textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.5 }}>AI Verdict</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#78350F", mb: 0.5 }}>
                        {aiVerdict.title}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#92400E", lineHeight: 1.5 }}>
                        {aiVerdict.summary}
                      </Typography>
                    </Box>
                  </Paper>
                )}

                {/* Actions — MVP2 updated: Schedule Interview + Open Workflow */}
                <Card>
                  <CardHead title="Actions" />
                  <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                    <Button fullWidth variant="contained" size="small"
                      sx={{ fontSize: 12, fontWeight: 500, bgcolor: SUCCESS, borderRadius: "6px",
                        textTransform: "none", boxShadow: "none",
                        "&:hover": { bgcolor: "#15803D", boxShadow: "none" } }}>
                      ✓ Approve for Interview
                    </Button>
                    <Button fullWidth variant="outlined" size="small"
                      onClick={() => nav("/scheduler")}
                      sx={{ fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT,
                        borderRadius: "6px", textTransform: "none",
                        "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
                      📅 Schedule Interview
                    </Button>
                    <Button fullWidth variant="outlined" size="small"
                      onClick={() => nav(`/candidates/${candidateId}/workflow`)}
                      sx={{ fontSize: 12, fontWeight: 500, borderColor: ACCENT_BR, color: ACCENT,
                        borderRadius: "6px", textTransform: "none",
                        "&:hover": { bgcolor: ACCENT_BG } }}>
                      👤 Open Workflow
                    </Button>
                    <Button fullWidth variant="outlined" size="small"
                      sx={{ fontSize: 12, fontWeight: 500, borderColor: DANGER_BR, color: DANGER,
                        borderRadius: "6px", textTransform: "none",
                        "&:hover": { bgcolor: DANGER_BG } }}>
                      ✗ Reject Candidate
                    </Button>
                  </Box>
                </Card>

              </Box>
            </Box>

            {/* Annotation strip */}
     {/*       <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2 }}>
              {[
                `⚡ GET /api/candidates/${candidateId}/aianalysis`,
                "✦ NEW: GET /api/candidates/{id}/analysis/summary",
                "✦ NEW: GET /api/candidates/{id}/analysis/fraud-signals",
                "✦ NEW: GET /api/candidates/{id}/analysis/placement-probability",
              ].map((label) => (
                <Box key={label} sx={{ display: "inline-flex", alignItems: "center",
                  bgcolor: "#F0F2F6", border: `1px solid ${BORDER}`, borderRadius: "5px",
                  px: 1, py: 0.25, fontSize: 10, fontWeight: 500, color: MUTED }}>
                  {label}
                </Box>
              ))}
            </Box>*/} 
          </>
        )}

      </Box>
    </Box>
  );
}
