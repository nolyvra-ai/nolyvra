import { useEffect, useState } from "react";
import {
  Box, Paper, Typography, Button, Table, TableHead,
  TableRow, TableCell, TableBody, LinearProgress, Alert, TextField,
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

// ─── Reusable components ──────────────────────────────────────────────────────
function Card({ children, sx = {} }) {
  return (
    <Paper elevation={0} sx={{
      border: `1px solid ${BORDER}`, borderRadius: "10px",
      boxShadow: CARD_SHADOW, overflow: "hidden", bgcolor: "#fff", ...sx,
    }}>
      {children}
    </Paper>
  );
}

function CardHead({ title, action }) {
  return (
    <Box sx={{
      px: 2.25, py: 1.75, borderBottom: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</Typography>
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

function RiskDot({ level }) {
  const color = level === "High" ? DANGER : level === "Medium" ? WARN : ACCENT;
  return <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color, flexShrink: 0, mt: "4px" }} />;
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const { candidateId } = useParams();
  const nav = useNavigate();

  const [analysis,   setAnalysis]   = useState(null);
  const [candidate,  setCandidate]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState("");
  const [notes,      setNotes]      = useState("");
  const [rerunning,  setRerunning]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr("");
      try {
        const [analysisResp, candidateResp] = await Promise.all([
          apiGet(`/api/candidates/${candidateId}/aianalysis`),
          apiGet(`/api/candidates/${candidateId}`),
        ]);
        if (cancelled) return;
        setAnalysis(analysisResp);
        console.log("RAW analysis response:", JSON.stringify(analysisResp, null, 2));
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
      const loginId = localStorage.getItem("loginId") || "";
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/analyze`);
      url.searchParams.set("loginId", loginId);
      await fetch(url.toString(), { method: "POST" });
      const updated = await apiGet(`/api/candidates/${candidateId}/analysis`);
      setAnalysis(updated);
    } catch (e) {
      console.error("Re-run failed", e);
    } finally {
      setRerunning(false);
    }
  }

  // ── Derived values — mapped to exact API payload structure ───────────────
  // scores are nested under analysis.scores
  const consistency   = analysis?.scores?.consistencyScore ?? null;
  const capability    = analysis?.scores?.capabilityScore  ?? null;
  const riskLevel     = analysis?.scores?.riskLevel        ?? "—";

  // riskFlags is a flat string array
  const riskFlagsRaw  = analysis?.riskFlags ?? [];

  // consistency object holds timelineMatchPercent and flags
  const timelineMatch        = analysis?.consistency?.timelineMatchPercent ?? null;
  const consistencyFlags     = analysis?.consistency?.flags ?? [];

  // capabilityMatrix is nested: { rows: [...], weights: {...} }
  const capMatrix     = analysis?.capabilityMatrix?.rows ?? [];

  // suggestedQuestions (not interviewQuestions)
  const questions     = analysis?.suggestedQuestions ?? [];

  // recommendation string
  const recommendation = analysis?.recommendation ?? null;

  // candidate name
  const candidateName = analysis?.candidate_name ?? candidate?.name ?? "—";

  // fields not in current payload — keep graceful fallbacks
  const matchedSkills        = analysis?.matchedSkills        ?? [];
  const missingSkills        = analysis?.missingSkills        ?? [];
  const strengths            = analysis?.strengthSignals      ?? [];
  const aiVerdict            = analysis?.aiVerdict            ?? null;
  const aiConfidence         = analysis?.aiConfidence         ?? null;
  const executionTier        = analysis?.executionTier        ?? null;
  const consistencyBreakdown = analysis?.consistencyBreakdown ?? [];

  const analysedAt = analysis?.analyzedAt
    ? new Date(analysis.analyzedAt).toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", bgcolor: "#F7F8FA" }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <Box sx={{
        bgcolor: "#fff", borderBottom: `1px solid ${BORDER}`,
        px: 3, py: 1.5,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
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
            sx={{ fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none", "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
            ← Back
          </Button>
          <Button size="small" variant="outlined"
            sx={{ fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none", "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
            ⬇ Export PDF
          </Button>
          <Button size="small" variant="contained" onClick={handleRerun} disabled={rerunning}
            sx={{ fontSize: 12, fontWeight: 500, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            {rerunning ? "Running…" : "🔄 Re-run Analysis"}
          </Button>
        </Box>
      </Box>

      {/* ── Scrollable content ─────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>

        {err && <Alert severity="error" sx={{ mb: 2, borderRadius: "8px" }}>{err}</Alert>}

        {loading && (
          <Card sx={{ p: 2.5, mb: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, mb: 1 }}>Loading analysis…</Typography>
            <LinearProgress sx={{ borderRadius: "4px" }} />
          </Card>
        )}

        {!loading && !analysis && !err && (
          <Card sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: 13, color: MUTED, mb: 2 }}>No analysis found for this candidate.</Typography>
            <Button variant="contained" size="small" onClick={handleRerun}
              sx={{ fontSize: 12, fontWeight: 500, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
              Run Analysis Now
            </Button>
          </Card>
        )}

        {!loading && analysis && (
          <>
            {/* ── Score meta strip ──────────────────────────────────────── */}
            <Paper elevation={0} sx={{
              border: `1px solid ${BORDER}`, borderRadius: "10px", boxShadow: CARD_SHADOW,
              bgcolor: "#fff", px: 3, py: 2, mb: 2,
              display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap",
            }}>
              {/* Consistency circle */}
              {consistency != null && (
                <>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{
                      width: 72, height: 72, borderRadius: "50%",
                      border: `3px solid ${scoreCircleColor(consistency).border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontWeight: 700, color: scoreCircleColor(consistency).color,
                    }}>
                      {consistency}%
                    </Box>
                    <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 500, textAlign: "center", lineHeight: 1.3 }}>
                      Consistency<br />Score
                    </Typography>
                  </Box>
                  <Box sx={{ width: "1px", bgcolor: BORDER, height: 56, flexShrink: 0 }} />
                </>
              )}

              {/* Capability circle */}
              {capability != null && (
                <>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{
                      width: 72, height: 72, borderRadius: "50%",
                      border: `3px solid ${scoreCircleColor(capability).border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontWeight: 700, color: scoreCircleColor(capability).color,
                    }}>
                      {capability}%
                    </Box>
                    <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 500, textAlign: "center", lineHeight: 1.3 }}>
                      Capability<br />Match
                    </Typography>
                  </Box>
                  <Box sx={{ width: "1px", bgcolor: BORDER, height: 56, flexShrink: 0 }} />
                </>
              )}

              {/* Timeline Match circle */}
              {timelineMatch != null && (
                <>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{
                      width: 72, height: 72, borderRadius: "50%",
                      border: `3px solid ${scoreCircleColor(timelineMatch).border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 20, fontWeight: 700, color: scoreCircleColor(timelineMatch).color,
                    }}>
                      {timelineMatch}%
                    </Box>
                    <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 500, textAlign: "center", lineHeight: 1.3 }}>
                      Timeline<br />Match
                    </Typography>
                  </Box>
                  <Box sx={{ width: "1px", bgcolor: BORDER, height: 56, flexShrink: 0 }} />
                </>
              )}

              {/* Candidate info */}
              <Box sx={{ flex: 1, display: "flex", gap: 4 }}>
                <Box>
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Candidate</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 500, mt: 0.25 }}>{candidateName}</Typography>
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", mt: 1 }}>Applied For</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 500, mt: 0.25 }}>{candidate?.jobTitle ?? analysis?.jobTitle ?? "—"}</Typography>
                </Box>
                <Box>
                  {candidate?.linkedinUrl && (
                    <>
                      <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>LinkedIn</Typography>
                      <Typography component="a" href={candidate.linkedinUrl} target="_blank"
                        sx={{ fontSize: 13, fontWeight: 500, mt: 0.25, color: ACCENT, textDecoration: "none", display: "block", "&:hover": { textDecoration: "underline" } }}>
                        {candidate.linkedinUrl.replace("https://", "")}
                      </Typography>
                    </>
                  )}
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", mt: 1 }}>Overall Risk</Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Badge label={`${riskLevel} · ${riskFlagsRaw.length} Flag${riskFlagsRaw.length !== 1 ? "s" : ""}`} variant={riskVariant(riskLevel)} />
                  </Box>
                </Box>
              </Box>

              {/* AI Confidence */}
              {aiConfidence && (
                <>
                  <Box sx={{ width: "1px", bgcolor: BORDER, height: 56, flexShrink: 0 }} />
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, px: 1 }}>
                    <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>AI Confidence</Typography>
                    <Badge label={aiConfidence} variant={aiConfidence === "High" ? "success" : aiConfidence === "Medium" ? "warning" : "danger"} />
                    {analysis?.aiConfidenceNote && (
                      <Typography sx={{ fontSize: 10, color: MUTED, textAlign: "center", lineHeight: 1.4, maxWidth: 120 }}>
                        {analysis.aiConfidenceNote}
                      </Typography>
                    )}
                  </Box>
                </>
              )}
            </Paper>

            {/* ── Two-column layout ─────────────────────────────────────── */}
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>

              {/* ── Left column ───────────────────────────────────────── */}
              <Box sx={{ flex: 1.4, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>

                {/* Analysis Summary — always shown first when scores are present */}
                {(consistency != null || capability != null || timelineMatch != null) && (
                  <Card>
                    <CardHead title="Analysis Summary" />
                    <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>
                      {[
                        { label: "Consistency Score", value: consistency   },
                        { label: "Capability Match",  value: capability    },
                        { label: "Timeline Match",    value: timelineMatch },
                      ].filter(r => r.value != null).map((row, i) => (
                        <Box key={i}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                            <Typography sx={{ fontSize: 12, color: TEXT }}>{row.label}</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: scoreColor(row.value) }}>{row.value}%</Typography>
                          </Box>
                          <Box sx={{ height: 6, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
                            <Box sx={{ width: `${row.value}%`, height: "100%", bgcolor: scoreColor(row.value), borderRadius: "3px" }} />
                          </Box>
                        </Box>
                      ))}
                      <Box sx={{ pt: 1, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography sx={{ fontSize: 12, color: MUTED }}>Overall Risk</Typography>
                        <Badge label={`${riskLevel} · ${riskFlagsRaw.length} Flag${riskFlagsRaw.length !== 1 ? "s" : ""}`} variant={riskVariant(riskLevel)} />
                      </Box>
                    </Box>
                  </Card>
                )}

                {/* CV vs LinkedIn Consistency */}
                {consistencyBreakdown.length > 0 && (
                  <Card>
                    <CardHead
                      title="CV vs LinkedIn Consistency"
                      action={<Badge label={`${consistency}% Match`} variant={consistency >= 80 ? "success" : consistency >= 60 ? "warning" : "danger"} />}
                    />
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
                            <Box sx={{ width: `${item.score ?? (item.match ? 100 : 60)}%`, height: "100%", bgcolor: item.match ? SUCCESS : WARN, borderRadius: "3px" }} />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Card>
                )}

                {/* Skill Alignment */}
                {(matchedSkills.length > 0 || missingSkills.length > 0) && (
                  <Card>
                    <CardHead
                      title="CV vs JD Capability Alignment"
                      action={<Badge label={`${capability}% Match`} variant={capability >= 80 ? "success" : capability >= 60 ? "warning" : "danger"} />}
                    />
                    <Box sx={{ p: 2.25 }}>
                      {matchedSkills.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography sx={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, mb: 0.75 }}>Matched Skills</Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                            {matchedSkills.map((s, i) => (
                              <Box key={i} sx={{ bgcolor: SUCCESS_BG, border: `1px solid ${SUCCESS_BR}`, borderRadius: "4px", px: 1, py: 0.25, fontSize: 11, fontWeight: 500, color: SUCCESS }}>
                                {s} ✓
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                      {missingSkills.length > 0 && (
                        <Box>
                          <Typography sx={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, mb: 0.75 }}>Gaps / Not Evidenced</Typography>
                          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                            {missingSkills.map((s, i) => (
                              <Box key={i} sx={{ bgcolor: DANGER_BG, border: `1px solid ${DANGER_BR}`, borderRadius: "4px", px: 1, py: 0.25, fontSize: 11, fontWeight: 500, color: DANGER }}>
                                {s} ✗
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Card>
                )}

                {/* Capability Matrix */}
                {capMatrix.length > 0 && (
                  <Card>
                    <CardHead
                      title="Capability Matrix Breakdown"
                      action={<Badge label={`Weighted Score: ${capability}%`} variant="warning" />}
                    />
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
                          <TableRow key={idx} sx={{ bgcolor: idx % 2 === 1 ? SURFACE : "#fff", "&:last-child td": { borderBottom: "none" } }}>
                            <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, fontWeight: 600, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>{row.capability}</TableCell>
                            <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>{row.weightPercent}%</TableCell>
                            <TableCell sx={{ py: 1.25, px: 2, borderBottom: `1px solid ${BORDER}` }}><ScoreBar value={row.scorePercent} /></TableCell>
                            <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, fontWeight: 700, color: scoreColor(row.scorePercent), borderBottom: `1px solid ${BORDER}` }}>
                              {((row.scorePercent * row.weightPercent) / 100).toFixed(1)}
                            </TableCell>
                            <TableCell sx={{ py: 1.25, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                              <Badge
                                label={`${row.gapLevel} Gap`}
                                variant={row.gapLevel === "High" ? "danger" : row.gapLevel === "Medium" ? "warning" : "success"}
                                sx={{ fontSize: 10 }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: "#F0F7FF", borderTop: `2px solid ${BORDER}` }}>
                          <TableCell colSpan={3} sx={{ py: 1.5, px: 2, fontWeight: 700, fontSize: 12, color: TEXT }}>Total Weighted Capability Score</TableCell>
                          <TableCell sx={{ py: 1.5, px: 2, fontWeight: 800, fontSize: 15, color: scoreColor(capability) }}>{capability}</TableCell>
                          <TableCell sx={{ py: 1.5, px: 2 }}>
                            <Badge
                              label={capability >= 80 ? "Strong Match" : capability >= 60 ? "Moderate Match — Proceed with targeted screening" : "Low Match — Review carefully"}
                              variant={capability >= 80 ? "success" : capability >= 60 ? "warning" : "danger"}
                            />
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Card>
                )}

                {/* Strength Signals */}
                {strengths.length > 0 && (
                  <Card>
                    <CardHead title="Top Strength Signals" action={<Typography sx={{ fontSize: 11, color: MUTED }}>AI-extracted from CV</Typography>} />
                    <Box sx={{ p: 2.25, display: "flex", flexDirection: "column" }}>
                      {strengths.map((s, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, py: 1.5, borderBottom: i < strengths.length - 1 ? `1px solid #F0F2F6` : "none" }}>
                          <Box sx={{ width: 32, height: 32, borderRadius: "8px", bgcolor: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                            {s.icon ?? "⭐"}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT, mb: 0.25 }}>{s.title}</Typography>
                            <Typography sx={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{s.description}</Typography>
                          </Box>
                          {s.tag && <Badge label={s.tag} variant="accent" sx={{ flexShrink: 0, mt: 0.25 }} />}
                        </Box>
                      ))}
                    </Box>
                  </Card>
                )}

                {/* Execution Depth */}
                {executionTier != null && (
                  <Card>
                    <CardHead title="Execution Depth Classification" action={<Typography sx={{ fontSize: 11, color: MUTED }}>AI-assessed</Typography>} />
                    <Box sx={{ p: 2.25 }}>
                      <Box sx={{ display: "flex", mb: 2 }}>
                        {[
                          { num: 1, label: "Contributor"   },
                          { num: 2, label: "Owner"         },
                          { num: 3, label: "Architect"     },
                          { num: 4, label: "Strategic Lead"},
                        ].map(({ num, label }, i) => {
                          const isActive = executionTier === num || executionTier === label;
                          return (
                            <Box key={label} sx={{
                              flex: 1, textAlign: "center", py: 1.25, px: 0.75,
                              borderRadius: i === 0 ? "6px 0 0 6px" : i === 3 ? "0 6px 6px 0" : 0,
                              bgcolor: isActive ? ACCENT : NEUTRAL_BG,
                              border: `1px solid ${isActive ? ACCENT : BORDER}`,
                              borderLeft: i > 0 ? "none" : undefined,
                            }}>
                              <Typography sx={{ fontSize: 10, fontWeight: 700, color: isActive ? "rgba(255,255,255,0.75)" : MUTED, mb: 0.25 }}>
                                TIER {num}{isActive ? " ✓" : ""}
                              </Typography>
                              <Typography sx={{ fontSize: 12, fontWeight: isActive ? 700 : 400, color: isActive ? "#fff" : MUTED }}>
                                {label}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                      {analysis?.executionTierNote && (
                        <Box sx={{ bgcolor: ACCENT_BG, borderRadius: "6px", px: 2, py: 1.5, fontSize: 12, color: "#1E3A6E", lineHeight: 1.5 }}>
                          {analysis.executionTierNote}
                        </Box>
                      )}
                    </Box>
                  </Card>
                )}

                {/* Risk & Authenticity */}
            {/*    {riskFlags.length > 0 && (
                  <Card>
                    <CardHead title="Risk & Authenticity Analysis" action={<Badge label={`Overall: ${riskLevel} Risk`} variant={riskVariant(riskLevel)} />} />
                    <Box sx={{ p: 2.25, display: "flex", flexDirection: "column" }}>
                      {riskFlags.map((flag, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, py: 1.5, borderBottom: i < riskFlags.length - 1 ? `1px solid #F0F2F6` : "none" }}>
                          <RiskDot level={flag.level} />
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>{flag.title}</Typography>
                              <Badge label={`${flag.level} Risk`} variant={riskVariant(flag.level)} />
                            </Box>
                            <Typography sx={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{flag.description}</Typography>
                          </Box>
                        </Box>
                      ))}
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>Overall Risk Assessment</Typography>
                        <Badge label={`⚠ ${riskLevel} — Verify before advancing`} variant={riskVariant(riskLevel)} sx={{ fontSize: 12, px: 1.5, py: 0.5 }} />
                      </Box>
                    </Box>
                  </Card>
                )}*/}

                {/* Interview Questions */}
                {questions.length > 0 && (
                  <Card>
                    <CardHead
                      title="AI-Generated Validation Questions"
                      action={<Badge label={`${questions.length} Questions`} variant="accent" />}
                    />
                    <Box>
                      {questions.map((q, i) => {
                        const typeKey = q.type?.toLowerCase();
                        const numBg    = typeKey === "debugging" || typeKey === "system_design" ? WARN_BG : ACCENT_BG;
                        const numColor = typeKey === "debugging" || typeKey === "system_design" ? WARN    : ACCENT;
                        const typeLabel = q.type?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                        return (
                          <Box key={i} sx={{ px: 2.25, py: 2, borderBottom: i < questions.length - 1 ? `1px solid #F0F2F6` : "none" }}>
                            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, mb: 0.75 }}>
                              <Box sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: numBg, color: numColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, flexShrink: 0, mt: "1px" }}>
                                {q.order ?? i + 1}
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Box sx={{ display: "flex", gap: 0.75, mb: 0.75, flexWrap: "wrap" }}>
                                  <Badge label={typeLabel} variant={typeKey === "debugging" ? "warning" : typeKey === "leadership" ? "success" : "accent"} sx={{ fontSize: 10 }} />
                                </Box>
                                <Typography sx={{ fontSize: 13, fontWeight: 500, color: TEXT, lineHeight: 1.5 }}>{q.question}</Typography>
                              </Box>
                            </Box>
                            {q.intent && (
                              <Box sx={{ ml: "34px" }}>
                                <Box sx={{ bgcolor: SURFACE, borderRadius: "5px", p: 1 }}>
                                  <Typography sx={{ fontSize: 11, color: ACCENT, fontWeight: 600, mb: 0.25 }}>▸ Intent</Typography>
                                  <Typography sx={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }}>{q.intent}</Typography>
                                </Box>
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Box>
                  </Card>
                )}

                {/* Fallback — no data at all */}
                {consistencyBreakdown.length === 0 && matchedSkills.length === 0 && capMatrix.length === 0 && riskFlagsRaw.length === 0 && questions.length === 0 && consistency == null && (
                  <Card sx={{ p: 3, textAlign: "center" }}>
                    <Typography sx={{ fontSize: 13, color: MUTED }}>
                      Analysis scores loaded. Detailed breakdown not available for this candidate.
                    </Typography>
                  </Card>
                )}

              </Box>

              {/* ── Right column ──────────────────────────────────────── */}
              <Box sx={{ flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 2 }}>

                {/* Recommendation */}
                {recommendation && (
                  <Paper elevation={0} sx={{ border: `1px solid ${ACCENT_BR}`, borderRadius: "10px", overflow: "hidden" }}>
                    <Box sx={{ p: 2, bgcolor: ACCENT_BG }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 600, color: ACCENT, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.5 }}>AI Recommendation</Typography>
                      <Typography sx={{ fontSize: 12, color: "#1E3A6E", lineHeight: 1.6 }}>{recommendation}</Typography>
                    </Box>
                  </Paper>
                )}

                {/* Risk Flags — flat string array */}
                {riskFlagsRaw.length > 0 && (
                  <Card>
                    <CardHead
                      title="Risk Flags"
                      action={<Badge label={`${riskFlagsRaw.length} Flag${riskFlagsRaw.length !== 1 ? "s" : ""}`} variant="warning" />}
                    />
                    <Box sx={{ px: 2, py: 1.5, display: "flex", flexDirection: "column" }}>
                      {riskFlagsRaw.map((flag, i) => (
                        <Box key={i} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", py: 1.25, borderBottom: i < riskFlagsRaw.length - 1 ? `1px solid #F0F2F6` : "none" }}>
                          <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: WARN, flexShrink: 0, mt: "5px" }} />
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
                        const variant = flag.severity === "High" ? "danger" : flag.severity === "Medium" ? "warning" : "neutral";
                        return (
                          <Box key={i} sx={{ py: 1.25, borderBottom: i < consistencyFlags.length - 1 ? `1px solid #F0F2F6` : "none" }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                              <Typography sx={{ fontSize: 11, fontWeight: 600, color: TEXT }}>{flag.type?.replace(/_/g, " ")}</Typography>
                              <Badge label={flag.severity} variant={variant} sx={{ fontSize: 10 }} />
                            </Box>
                            <Typography sx={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{flag.message}</Typography>
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
                    <TextField
                      multiline rows={4} fullWidth
                      placeholder="Add your notes here…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          fontSize: 12,
                          bgcolor: SURFACE, borderRadius: "6px",
                          "& fieldset": { borderColor: BORDER },
                          "&:hover fieldset": { borderColor: "#C0C8D8" },
                          "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 1.5 },
                        },
                      }}
                    />
                    <Button fullWidth size="small" variant="outlined"
                      sx={{ mt: 1, fontSize: 11, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none", "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
                      Save Notes
                    </Button>
                  </Box>
                </Card>

                {/* AI Verdict */}
                {aiVerdict && (
                  <Paper elevation={0} sx={{ border: `1px solid ${WARN_BR}`, borderRadius: "10px", overflow: "hidden" }}>
                    <Box sx={{ p: 2, bgcolor: WARN_BG, borderRadius: "10px" }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 600, color: WARN, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.5 }}>AI Verdict</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#78350F", mb: 0.5 }}>{aiVerdict.title}</Typography>
                      <Typography sx={{ fontSize: 11, color: "#92400E", lineHeight: 1.5 }}>{aiVerdict.summary}</Typography>
                    </Box>
                  </Paper>
                )}

                {/* Actions */}
                <Card>
                  <CardHead title="Actions" />
                  <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                    <Button fullWidth variant="contained" size="small"
                      sx={{ fontSize: 12, fontWeight: 500, bgcolor: SUCCESS, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#15803D", boxShadow: "none" } }}>
                      ✓ Approve for Interview
                    </Button>
                    <Button fullWidth variant="outlined" size="small"
                      sx={{ fontSize: 12, fontWeight: 500, borderColor: DANGER_BR, color: DANGER, borderRadius: "6px", textTransform: "none", "&:hover": { bgcolor: DANGER_BG } }}>
                      ✗ Reject Candidate
                    </Button>
                    <Button fullWidth variant="outlined" size="small"
                      onClick={handleRerun} disabled={rerunning}
                      sx={{ fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none", "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE } }}>
                      🔄 Re-run Analysis
                    </Button>
                  </Box>
                </Card>

              </Box>
            </Box>

            {/* Annotation strip */}
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2 }}>
              {[
                `⚡ GET /api/candidates/${candidateId}/analysis`,
                "📊 MUI LinearProgress + Chip components",
                "📤 Export PDF via backend endpoint",
              ].map((label) => (
                <Box key={label} sx={{
                  display: "inline-flex", alignItems: "center",
                  bgcolor: "#F0F2F6", border: `1px solid ${BORDER}`,
                  borderRadius: "5px", px: 1, py: 0.25,
                  fontSize: 10, fontWeight: 500, color: MUTED,
                }}>
                  {label}
                </Box>
              ))}
            </Box>
          </>
        )}

      </Box>
    </Box>
  );
}
