import { useEffect, useRef, useState } from "react";
import {
  Box, Paper, Typography, Button, TextField, CircularProgress, Alert, LinearProgress,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// ─── Style tokens (same palette as AnalysisPage) ─────────────────────────────
const BORDER     = "#E8ECF2";
const MUTED      = "#9AA3B4";
const TEXT       = "#0F1623";
const ACCENT     = "#1D72E8";
const SUCCESS    = "#16A34A";
const SUCCESS_BG = "#F0FDF4";
const SUCCESS_BR = "#BBF7D0";
const WARN       = "#D97706";
const WARN_BG    = "#FFFBEB";
const WARN_BR    = "#FDE68A";
const DANGER     = "#DC2626";
const DANGER_BG  = "#FEF2F2";
const DANGER_BR  = "#FECACA";
const ACCENT_BG  = "#EBF2FF";
const ACCENT_BR  = "#BFDBFE";
const SURFACE    = "#FAFBFD";
const PURPLE     = "#7C3AED";
const PURPLE_BG  = "#F5F3FF";
const PURPLE_BR  = "#C4B5FD";
const SHADOW     = "0 1px 3px rgba(0,0,0,0.05)";

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

async function apiPost(path, body) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 402) throw new Error("You have run out of tokens. Please upgrade your plan to continue.");
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

// ─── Shared components ────────────────────────────────────────────────────────
function Card({ children, sx = {}, isNew = false }) {
  return (
    <Paper elevation={0} sx={{
      border: `1px solid ${isNew ? PURPLE_BR : BORDER}`,
      borderRadius: "10px", boxShadow: SHADOW,
      overflow: "hidden", bgcolor: "#fff", ...sx,
    }}>
      {children}
    </Paper>
  );
}

function CardHead({ title, action, isNew = false }) {
  return (
    <Box sx={{ px: 2.25, py: 1.75, borderBottom: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
    neutral: { bg: "#F1F3F7",  border: BORDER,     color: MUTED   },
    purple:  { bg: PURPLE_BG,  border: PURPLE_BR,  color: PURPLE  },
  };
  const s = styles[variant] ?? styles.neutral;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center",
      bgcolor: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "20px", px: 1.25, py: 0.25,
      fontSize: 11, fontWeight: 600, color: s.color,
      whiteSpace: "nowrap", ...extraSx }}>
      {label}
    </Box>
  );
}

function ScoreCircle({ value, label }) {
  if (value == null) return null;
  const color = value >= 80 ? SUCCESS : value >= 60 ? WARN : DANGER;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
      <Box sx={{ width: 68, height: 68, borderRadius: "50%",
        border: `3px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: 700, color }}>
        {value}%
      </Box>
      <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 500,
        textAlign: "center", lineHeight: 1.3 }}>{label}</Typography>
    </Box>
  );
}

function recBadgeVariant(rec) {
  if (!rec) return "neutral";
  if (rec === "Strong Hire" || rec === "Strong Yes") return "success";
  if (rec === "Hire" || rec === "Yes") return "success";
  if (rec === "Borderline" || rec === "Maybe") return "warning";
  return "danger";
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function InterviewAnalysisPage() {
  const { candidateId } = useParams();
  const nav = useNavigate();

  const [interviews,    setInterviews]    = useState([]);
  const [existingList,  setExistingList]  = useState([]);  // past analyses
  const [candidate,     setCandidate]     = useState(null);
  const [loadingInit,   setLoadingInit]   = useState(true);
  const [initError,     setInitError]     = useState(null);

  // Selected interview + transcript input
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [transcriptText,    setTranscriptText]    = useState("");

  // File upload state
  const fileInputRef                          = useRef(null);
  const [uploadLoading, setUploadLoading]     = useState(false);
  const [uploadError,   setUploadError]       = useState(null);
  const [uploadedFile,  setUploadedFile]      = useState(null); // { name, wordCount }
  const [dragOver,      setDragOver]          = useState(false);

  // Analysis state
  const [analysing,   setAnalysing]   = useState(false);
  const [analyseErr,  setAnalyseErr]  = useState(null);
  const [result,      setResult]      = useState(null);  // latest analysis shown

  useEffect(() => {
    async function init() {
      try {
        const [interviewsData, candidateData, existingData] = await Promise.all([
          apiGet(`/api/interviews/candidate/${candidateId}`),
          apiGet(`/api/candidates/${candidateId}`),
          apiGet(`/api/candidates/${candidateId}/interview-analysis`).catch(() => []),
        ]);
        setInterviews(interviewsData);
        setCandidate(candidateData);
        setExistingList(existingData);
        if (existingData.length > 0) setResult(existingData[0]);
      } catch (e) {
        setInitError(e.message);
      } finally {
        setLoadingInit(false);
      }
    }
    init();
  }, [candidateId]);

  async function handleFileUpload(file) {
    if (!file) return;
    setUploadLoading(true); setUploadError(null); setUploadedFile(null);

    const ext = file.name.split(".").pop().toLowerCase();
    const textTypes = ["txt", "vtt", "srt", "md", "csv"];

    try {
      if (textTypes.includes(ext)) {
        // Read plain-text formats directly in the browser
        const text = await file.text();
        setTranscriptText(text);
        setUploadedFile({ name: file.name, wordCount: text.trim().split(/\s+/).length });
      } else if (ext === "pdf" || ext === "docx" || ext === "doc") {
        // Send to the existing CV extract endpoint — reuses PDFBox / Apache POI
        const loginId = localStorage.getItem("loginId") || "";
        const form = new FormData();
        form.append("file", file);
        const url = new URL(`${API_BASE}/api/cv/extract`);
        url.searchParams.set("loginId", loginId);
        const res = await fetch(url.toString(), { method: "POST", body: form });
        if (!res.ok) throw new Error(await res.text().catch(() => "Extraction failed"));
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        const extracted = data.text || "";
        setTranscriptText(extracted);
        setUploadedFile({ name: file.name, wordCount: extracted.trim().split(/\s+/).length });
      } else {
        throw new Error(`Unsupported file type ".${ext}". Use .txt, .vtt, .srt, .pdf, or .docx.`);
      }
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }

  async function handleAnalyse() {
    if (!transcriptText.trim()) return;
    setAnalysing(true); setAnalyseErr(null);
    try {
      const data = await apiPost(`/api/candidates/${candidateId}/interview-analysis`, {
        interviewId:    selectedInterview?.id ?? null,
        transcriptText: transcriptText.trim(),
      });
      setResult(data);
      setExistingList(prev => [data, ...prev.filter(e => e.id !== data.id)]);
      setTranscriptText("");
    } catch (e) {
      setAnalyseErr(e.message);
    } finally {
      setAnalysing(false);
    }
  }

  if (loadingInit) return (
    <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
  );
  if (initError) return <Alert severity="error">{initError}</Alert>;

  const name = candidate?.name ?? "Candidate";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%",
      overflow: "hidden", bgcolor: "#F7F8FA" }}>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <Box sx={{ bgcolor: "#fff", borderBottom: `1px solid ${BORDER}`,
        px: 3, py: 1.5, display: "flex", alignItems: "center",
        justifyContent: "space-between", flexShrink: 0 }}>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
            Interview Analysis — {name}
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Upload a transcript to get an AI-powered interview performance report
            {existingList.length > 0 && ` · ${existingList.length} past analysis`}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" variant="outlined"
            onClick={() => nav(`/candidates/${candidateId}/workflow`)}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT,
              borderRadius: "6px", textTransform: "none" }}>
            ← Workflow
          </Button>
          {candidate?.capabilityScore != null && (
            <Button size="small" variant="outlined"
              onClick={() => nav(`/analysis/${candidateId}`)}
              sx={{ fontSize: 12, borderColor: ACCENT_BR, color: ACCENT,
                borderRadius: "6px", textTransform: "none" }}>
              📊 CV Analysis
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Scrollable content ────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5, display: "flex",
        flexDirection: "column", gap: 2 }}>

        {/* ── Transcript input section ─────────────────────────────────────── */}
        <Card isNew>
          <CardHead title="Upload Interview Transcript" isNew />
          <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.5 }}>

            {/* Interview selector */}
            {interviews.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: MUTED,
                  textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75 }}>
                  Link to a scheduled interview (optional)
                </Typography>
                <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                  <Button size="small" variant={selectedInterview === null ? "contained" : "outlined"}
                    onClick={() => setSelectedInterview(null)}
                    sx={{ fontSize: 11, borderRadius: "6px", textTransform: "none",
                      ...(selectedInterview === null
                        ? { bgcolor: ACCENT, boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }
                        : { borderColor: BORDER, color: TEXT }) }}>
                    Not linked
                  </Button>
                  {interviews.map(iv => (
                    <Button key={iv.id} size="small"
                      variant={selectedInterview?.id === iv.id ? "contained" : "outlined"}
                      onClick={() => setSelectedInterview(iv)}
                      sx={{ fontSize: 11, borderRadius: "6px", textTransform: "none",
                        ...(selectedInterview?.id === iv.id
                          ? { bgcolor: PURPLE, boxShadow: "none", "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" } }
                          : { borderColor: BORDER, color: TEXT }) }}>
                      {iv.interviewType ?? "Interview"} ·{" "}
                      {iv.scheduledAt
                        ? new Date(iv.scheduledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                        : "—"}
                    </Button>
                  ))}
                </Box>
              </Box>
            )}

            {/* ── File upload zone ─────────────────────────────────────── */}
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: MUTED,
                textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75 }}>
                Upload transcript file
              </Typography>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.vtt,.srt,.md,.pdf,.docx,.doc"
                style={{ display: "none" }}
                onChange={e => handleFileUpload(e.target.files?.[0])}
              />

              {/* Drop zone */}
              <Box
                onClick={() => !uploadLoading && fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                sx={{
                  border: `2px dashed ${dragOver ? ACCENT : uploadedFile ? SUCCESS_BR : BORDER}`,
                  borderRadius: "10px",
                  bgcolor: dragOver ? ACCENT_BG : uploadedFile ? SUCCESS_BG : SURFACE,
                  p: "18px 20px",
                  display: "flex", alignItems: "center", gap: 2,
                  cursor: uploadLoading ? "wait" : "pointer",
                  transition: "border-color 0.15s, background-color 0.15s",
                  "&:hover": { borderColor: ACCENT, bgcolor: ACCENT_BG },
                }}>

                {uploadLoading ? (
                  <>
                    <CircularProgress size={22} sx={{ color: ACCENT, flexShrink: 0 }} />
                    <Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>
                        Extracting text…
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: MUTED }}>
                        Reading file content
                      </Typography>
                    </Box>
                  </>
                ) : uploadedFile ? (
                  <>
                    <Box sx={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>✅</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: SUCCESS,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {uploadedFile.name}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: MUTED }}>
                        {uploadedFile.wordCount.toLocaleString()} words extracted — pasted into transcript below
                      </Typography>
                    </Box>
                    <Button size="small" variant="outlined"
                      onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      sx={{ fontSize: 11, borderRadius: "6px", textTransform: "none",
                        borderColor: BORDER, color: MUTED, flexShrink: 0 }}>
                      Change
                    </Button>
                  </>
                ) : (
                  <>
                    <Box sx={{ fontSize: 24, lineHeight: 1, flexShrink: 0, opacity: 0.5 }}>📄</Box>
                    <Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>
                        {dragOver ? "Drop file here" : "Click to upload or drag & drop"}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: MUTED }}>
                        .txt · .vtt · .srt (Google Meet / Zoom) · .pdf · .docx
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>

              {uploadError && (
                <Alert severity="error" onClose={() => setUploadError(null)}
                  sx={{ mt: 1, borderRadius: "8px", fontSize: 12 }}>
                  {uploadError}
                </Alert>
              )}
            </Box>

            {/* Divider */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ flex: 1, height: "1px", bgcolor: BORDER }} />
              <Typography sx={{ fontSize: 11, color: MUTED, fontWeight: 500 }}>or paste manually</Typography>
              <Box sx={{ flex: 1, height: "1px", bgcolor: BORDER }} />
            </Box>

            {/* Transcript text area */}
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: MUTED,
                textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75 }}>
                Paste transcript text
              </Typography>
              <TextField
                multiline rows={10} fullWidth
                value={transcriptText}
                onChange={e => setTranscriptText(e.target.value)}
                placeholder={`Paste the interview transcript here.\n\nExample format:\nInterviewer: Can you tell me about your experience with React?\nCandidate: Sure, I've been working with React for about 3 years...\n\nGoogle Meet transcripts, Zoom transcripts, or any plain text format work.`}
                sx={{ "& .MuiOutlinedInput-root": {
                  borderRadius: "8px", fontSize: 12, fontFamily: "monospace",
                  "& fieldset": { borderColor: BORDER },
                  "&:hover fieldset": { borderColor: "#C0C8D8" },
                  "&.Mui-focused fieldset": { borderColor: PURPLE, borderWidth: 1.5 },
                }}}
              />
              <Typography sx={{ fontSize: 10, color: MUTED, mt: 0.5 }}>
                {transcriptText.length > 0 ? `${transcriptText.trim().split(/\s+/).length} words` : "No transcript yet"}
              </Typography>
            </Box>

            {analyseErr && <Alert severity="error" onClose={() => setAnalyseErr(null)}>{analyseErr}</Alert>}

            <Button variant="contained" onClick={handleAnalyse}
              disabled={analysing || !transcriptText.trim()}
              sx={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 600,
                bgcolor: PURPLE, borderRadius: "8px", textTransform: "none",
                boxShadow: "none", "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" },
                "&.Mui-disabled": { bgcolor: PURPLE_BG, color: PURPLE } }}>
              {analysing
                ? <><CircularProgress size={14} sx={{ color: "#fff", mr: 1 }} /> Analysing…</>
                : "✦ Analyse Transcript"}
            </Button>

            {analysing && (
              <Box>
                <Typography sx={{ fontSize: 11, color: MUTED, mb: 0.5 }}>
                  Running AI analysis{existingList.length > 0 ? " and comparing with CV analysis" : ""}…
                </Typography>
                <LinearProgress sx={{ borderRadius: "4px",
                  "& .MuiLinearProgress-bar": { bgcolor: PURPLE } }} />
              </Box>
            )}
          </Box>
        </Card>

        {/* ── Analysis results ─────────────────────────────────────────────── */}
        {result && (
          <>
            {/* Score strip */}
            <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px",
              boxShadow: SHADOW, bgcolor: "#fff", px: 3, py: 2,
              display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>

              <ScoreCircle value={result.communicationScore} label={"Communication\nScore"} />
              {result.technicalScore > 0 && (
                <>
                  <Box sx={{ width: "1px", bgcolor: BORDER, height: 52, flexShrink: 0 }} />
                  <ScoreCircle value={result.technicalScore} label={"Technical\nScore"} />
                </>
              )}
              <Box sx={{ width: "1px", bgcolor: BORDER, height: 52, flexShrink: 0 }} />
              <ScoreCircle value={result.culturalFitScore} label={"Cultural\nFit"} />
              <Box sx={{ width: "1px", bgcolor: BORDER, height: 52, flexShrink: 0 }} />
              <ScoreCircle value={result.sentimentScore} label={"Engagement\nScore"} />

              <Box sx={{ flex: 1, display: "flex", gap: 4, ml: 1 }}>
                <Box>
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.5px" }}>Sentiment</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, mt: 0.25, color: TEXT }}>
                    {result.overallSentiment ?? "—"}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.5px", mt: 1 }}>
                    Confidence
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Badge label={result.confidenceLevel ?? "—"}
                      variant={result.confidenceLevel === "High" ? "success"
                        : result.confidenceLevel === "Medium" ? "warning" : "danger"} />
                  </Box>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Interview
                  </Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 500, mt: 0.25, color: TEXT }}>
                    {result.interviewType ?? "General"}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.5px", mt: 1 }}>
                    Analysed
                  </Typography>
                  <Typography sx={{ fontSize: 12, mt: 0.25, color: MUTED }}>
                    {result.analyzedAt
                      ? new Date(result.analyzedAt).toLocaleString("en-GB",
                          { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </Typography>
                </Box>
              </Box>

              {/* Hiring recommendation pill */}
              <Box sx={{ textAlign: "center", flexShrink: 0 }}>
                <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.75 }}>
                  Recommendation
                </Typography>
                <Badge label={result.hiringRecommendation ?? "—"}
                  variant={recBadgeVariant(result.hiringRecommendation)}
                  sx={{ fontSize: 13, px: 1.75, py: 0.75 }} />
              </Box>
            </Paper>

            {/* Two-column layout */}
            <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>

              {/* Left column */}
              <Box sx={{ flex: 1.4, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>

                {/* Interview Summary */}
                {result.interviewSummary && (
                  <Card isNew>
                    <CardHead title="AI Interview Summary" isNew />
                    <Box sx={{ p: 2.25 }}>
                      <Box sx={{ bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`,
                        borderRadius: "7px", p: "12px 14px" }}>
                        <Typography sx={{ fontSize: 12, color: TEXT, lineHeight: 1.75 }}>
                          {result.interviewSummary}
                        </Typography>
                      </Box>
                    </Box>
                  </Card>
                )}

                {/* CV Alignment Insights */}
                {(result.cvAlignmentInsights ?? []).length > 0 && (
                  <Card isNew>
                    <CardHead title="CV vs Interview Alignment" isNew
                      action={
                        <Typography sx={{ fontSize: 10, color: MUTED, fontStyle: "italic" }}>
                          Cross-referenced with CV analysis
                        </Typography>
                      } />
                    <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 0.75 }}>
                      {result.cvAlignmentInsights.map((insight, i) => (
                        <Box key={i} sx={{ display: "flex", gap: 1.25, alignItems: "flex-start",
                          py: 0.75, borderBottom: i < result.cvAlignmentInsights.length - 1
                            ? `1px solid #F0F2F6` : "none" }}>
                          <Box sx={{ width: 7, height: 7, borderRadius: "50%",
                            bgcolor: ACCENT, mt: "6px", flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 12, color: TEXT, lineHeight: 1.6 }}>
                            {insight}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Card>
                )}

                {/* Notable Moments */}
                {(result.notableMoments ?? []).length > 0 && (
                  <Card>
                    <CardHead title="Notable Moments"
                      action={<Badge label={`${result.notableMoments.length} Quotes`} variant="accent" />} />
                    <Box>
                      {result.notableMoments.map((m, i) => (
                        <Box key={i} sx={{ px: 2.25, py: 2,
                          borderBottom: i < result.notableMoments.length - 1
                            ? `1px solid #F0F2F6` : "none" }}>
                          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 0.75 }}>
                            <Badge label={m.speaker ?? "Candidate"} variant="neutral" sx={{ fontSize: 10 }} />
                          </Box>
                          <Typography sx={{ fontSize: 12, color: TEXT, fontStyle: "italic",
                            lineHeight: 1.6, mb: 0.5, pl: 1,
                            borderLeft: `3px solid ${PURPLE_BR}` }}>
                            "{m.quote}"
                          </Typography>
                          {m.significance && (
                            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>
                              ▸ {m.significance}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Card>
                )}

              </Box>

              {/* Right column */}
              <Box sx={{ flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 2 }}>

                {/* Strengths */}
                {(result.keyStrengths ?? []).length > 0 && (
                  <Card>
                    <CardHead title="Key Strengths"
                      action={<Badge label={`${result.keyStrengths.length}`} variant="success" />} />
                    <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {result.keyStrengths.map((s, i) => (
                        <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "flex-start",
                          py: 0.5, borderBottom: i < result.keyStrengths.length - 1
                            ? `1px solid #F0F2F6` : "none" }}>
                          <Box sx={{ width: 7, height: 7, borderRadius: "50%",
                            bgcolor: SUCCESS, mt: "6px", flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 12, color: TEXT, lineHeight: 1.5 }}>{s}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Card>
                )}

                {/* Areas of concern */}
                {(result.areasOfConcern ?? []).length > 0 && (
                  <Card>
                    <CardHead title="Areas of Concern"
                      action={<Badge label={`${result.areasOfConcern.length}`} variant="warning" />} />
                    <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {result.areasOfConcern.map((c, i) => (
                        <Box key={i} sx={{ display: "flex", gap: 1, alignItems: "flex-start",
                          py: 0.5, borderBottom: i < result.areasOfConcern.length - 1
                            ? `1px solid #F0F2F6` : "none" }}>
                          <Box sx={{ width: 7, height: 7, borderRadius: "50%",
                            bgcolor: WARN, mt: "6px", flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 12, color: TEXT, lineHeight: 1.5 }}>{c}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Card>
                )}

                {/* Past analyses */}
                {existingList.length > 1 && (
                  <Card>
                    <CardHead title="Past Analyses" />
                    <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 0.75 }}>
                      {existingList.map((e, i) => (
                        <Button key={e.id} fullWidth variant="outlined" size="small"
                          onClick={() => setResult(e)}
                          sx={{ fontSize: 11, borderRadius: "6px", textTransform: "none",
                            borderColor: result?.id === e.id ? PURPLE : BORDER,
                            color: result?.id === e.id ? PURPLE : TEXT, justifyContent: "flex-start" }}>
                          {e.interviewType ?? "General"} ·{" "}
                          {e.analyzedAt
                            ? new Date(e.analyzedAt).toLocaleDateString("en-GB",
                                { day: "numeric", month: "short" })
                            : `Analysis ${i + 1}`}
                        </Button>
                      ))}
                    </Box>
                  </Card>
                )}

                {/* Quick actions */}
                <Card>
                  <CardHead title="Actions" />
                  <Box sx={{ p: 1.75, display: "flex", flexDirection: "column", gap: 1 }}>
                    <Button fullWidth variant="outlined" size="small"
                      onClick={() => nav(`/candidates/${candidateId}/workflow`)}
                      sx={{ fontSize: 11, borderRadius: "6px", textTransform: "none",
                        borderColor: BORDER, color: TEXT, justifyContent: "flex-start" }}>
                      👤 Open Workflow
                    </Button>
                    {candidate?.capabilityScore != null && (
                      <Button fullWidth variant="outlined" size="small"
                        onClick={() => nav(`/analysis/${candidateId}`)}
                        sx={{ fontSize: 11, borderRadius: "6px", textTransform: "none",
                          borderColor: ACCENT_BR, color: ACCENT, justifyContent: "flex-start" }}>
                        📊 View CV Analysis
                      </Button>
                    )}
                    <Button fullWidth variant="outlined" size="small"
                      onClick={() => nav("/scheduler")}
                      sx={{ fontSize: 11, borderRadius: "6px", textTransform: "none",
                        borderColor: BORDER, color: TEXT, justifyContent: "flex-start" }}>
                      📅 Schedule Interview
                    </Button>
                  </Box>
                </Card>

              </Box>
            </Box>
          </>
        )}

        {/* Empty state — no analysis yet */}
        {!result && !analysing && (
          <Card sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: 28, mb: 1 }}>🎤</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: TEXT, mb: 0.75 }}>
              No interview analysis yet
            </Typography>
            <Typography sx={{ fontSize: 12, color: MUTED, maxWidth: 400, mx: "auto", lineHeight: 1.7 }}>
              Paste an interview transcript above — from Google Meet, Zoom, or any recording tool —
              and get an AI-powered performance report
              {existingList.length === 0 && candidate?.capabilityScore != null
                ? " cross-referenced with this candidate's CV analysis"
                : ""}.
            </Typography>
          </Card>
        )}

      </Box>
    </Box>
  );
}
