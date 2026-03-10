import {
  Box,
  Typography,
  TextField,
  Button,
  MenuItem,
  Paper,
  Chip,
  Divider,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}

// ─── Shared style tokens (matching wireframe) ────────────────────────────────
const BORDER = "#E8ECF2";
const MUTED = "#9AA3B4";
const TEXT = "#0F1623";
const ACCENT = "#1D72E8";
const SUCCESS = "#16A34A";
const SUCCESS_BG = "#F0FDF4";
const SUCCESS_BORDER = "#BBF7D0";
const WARN_BG = "#F0F7FF";
const WARN_BORDER = "#BFDBFE";
const WARN_TEXT = "#1E40AF";
const SURFACE = "#FAFBFD";
const CARD_SHADOW = "0 1px 3px rgba(0,0,0,0.05)";

const cardSx = {
  border: `1px solid ${BORDER}`,
  borderRadius: "10px",
  boxShadow: CARD_SHADOW,
  overflow: "hidden",
  bgcolor: "#fff",
};

const cardHeadSx = {
  px: 2.25,
  py: 1.75,
  borderBottom: `1px solid ${BORDER}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  bgcolor: "#fff",
};

const cardBodySx = {
  p: 2.25,
};

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "7px",
    fontSize: 13,
    bgcolor: SURFACE,
    "& fieldset": { borderColor: BORDER },
    "&:hover fieldset": { borderColor: "#C0C8D8" },
    "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 1.5 },
  },
  "& .MuiInputLabel-root": { fontSize: 13, color: MUTED },
  "& .MuiInputLabel-root.Mui-focused": { color: ACCENT },
};

// ─── Checklist item ──────────────────────────────────────────────────────────
function CheckItem({ done, label }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: done ? "none" : `1.5px solid ${BORDER}`,
          bgcolor: done ? SUCCESS_BG : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M2 5l2.5 2.5L8 3"
              stroke={SUCCESS}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </Box>
      <Typography
        sx={{
          fontSize: 12,
          color: done ? SUCCESS : MUTED,
          fontWeight: done ? 600 : 400,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

// ─── What will be analysed item ──────────────────────────────────────────────
function AnalysisItem({ icon, title, description, divider }) {
  return (
    <>
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, mb: 0.5 }}>
          {icon}&nbsp; {title}
        </Typography>
        <Typography sx={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
          {description}
        </Typography>
      </Box>
      {divider && <Divider sx={{ borderColor: BORDER, my: 0 }} />}
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function AddCandidatePage() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    linkedinUrl: "",
    cvText: "",
    jobId: "job-1",
  });
  const [jobs, setJobs] = useState([]);

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  useEffect(() => {
    async function loadJobs() {
      try {
        const data = await apiGet("/api/jobs");
        setJobs(data ?? []);
      } catch (e) {
        console.error("Failed to load jobs", e);
      }
    }
    loadJobs();
  }, []);

  // ── Save candidate (no analysis) ──────────────────────────────────────────
  async function onSave(e) {
    e.preventDefault();
    try {
      await apiPost(`/api/jobs/${form.jobId}/candidates`, {
        name: form.name,
        email: form.email,
        linkedinUrl: form.linkedinUrl,
        cvText: form.cvText,
      });
      nav("/candidates");
    } catch (e) {
      console.error("Failed to save candidate", e);
      alert("Failed to save candidate");
    }
  }

  // ── Run analysis (MVP: navigate directly) ────────────────────────────────
  function onSubmit(e) {
    e.preventDefault();
    // MVP: no API call yet. Later:
    // 1) POST /api/jobs/{jobId}/candidates
    // 2) POST /api/candidates/{candidateId}/analyze
    nav(`/analysis/cand-123`);
  }

  // ── Derived checklist state ───────────────────────────────────────────────
  const [firstName = "", ...rest] = (form.name ?? "").trim().split(" ");
  const hasName = firstName.length > 0;
  const hasJob = !!form.jobId;
  const hasLinkedin = form.linkedinUrl.trim().length > 0;
  const hasCv = form.cvText.trim().length > 0;
  const wordCount = form.cvText.trim()
    ? form.cvText.trim().split(/\s+/).length
    : 0;
  const allReady = hasName && hasJob && hasLinkedin && hasCv;

  // ── Step indicator ────────────────────────────────────────────────────────
  const steps = ["Candidate Details", "CV / Resume", "Review & Run"];

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
      {/* ── Page header ───────────────────────────────────────────────────── */}
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
            Add Candidate
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Paste CV and LinkedIn for validation analysis
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => nav("/candidates")}
            sx={{
              fontSize: 12,
              fontWeight: 500,
              borderColor: BORDER,
              color: TEXT,
              borderRadius: "6px",
              textTransform: "none",
              "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE },
            }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={onSubmit}
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
            🔍 Run Analysis
          </Button>
        </Box>
      </Box>

      {/* ── Step progress bar ─────────────────────────────────────────────── */}
      <Box
        sx={{
          bgcolor: "#fff",
          borderBottom: `1px solid ${BORDER}`,
          px: 3,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 0,
          flexShrink: 0,
        }}
      >
        {steps.map((step, i) => {
          const active = i === 0 ? hasName : i === 1 ? hasCv : allReady;
          const isLast = i === steps.length - 1;
          return (
            <Box key={step} sx={{ display: "flex", alignItems: "center", flex: isLast ? "none" : 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    border: active ? "none" : `1.5px solid ${BORDER}`,
                    bgcolor: active ? ACCENT : SURFACE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: active ? "#fff" : MUTED }}>
                    {i + 1}
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: active ? 600 : 400,
                    color: active ? TEXT : MUTED,
                    whiteSpace: "nowrap",
                  }}
                >
                  {step}
                </Typography>
              </Box>
              {!isLast && (
                <Box
                  sx={{
                    flex: 1,
                    height: "1px",
                    bgcolor: BORDER,
                    mx: 1.5,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
        <Box sx={{ display: "flex", gap: 1.75, alignItems: "flex-start" }}>

          {/* ── LEFT: Form ────────────────────────────────────────────────── */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.75, minWidth: 0 }}>

            {/* Candidate Details card */}
            <Paper elevation={0} sx={cardSx}>
              <Box sx={cardHeadSx}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: "7px",
                      bgcolor: "#EBF2FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                    }}
                  >
                    👤
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                    Candidate Details
                  </Typography>
                </Box>
              </Box>
              <Box sx={cardBodySx}>
                {/* Name row */}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 1.5 }}>
                  <TextField
                    fullWidth
                    label="First Name *"
                    size="small"
                    value={form.name.split(" ")[0] ?? ""}
                    onChange={(e) => {
                      const last = form.name.includes(" ")
                        ? form.name.split(" ").slice(1).join(" ")
                        : "";
                      setField("name", last ? `${e.target.value} ${last}` : e.target.value);
                    }}
                    sx={fieldSx}
                  />
                  <TextField
                    fullWidth
                    label="Last Name *"
                    size="small"
                    value={form.name.includes(" ") ? form.name.split(" ").slice(1).join(" ") : ""}
                    onChange={(e) => {
                      const first = form.name.split(" ")[0] ?? "";
                      setField("name", `${first} ${e.target.value}`.trim());
                    }}
                    sx={fieldSx}
                  />
                </Box>

                {/* Email / Phone row */}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 1.5 }}>
                  <TextField
                    fullWidth
                    label="Email"
                    size="small"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    fullWidth
                    label="Phone"
                    size="small"
                    placeholder="+44 7000 000000"
                    sx={fieldSx}
                  />
                </Box>

                {/* Job selector */}
                <TextField
                  fullWidth
                  select
                  label="Assign to Job *"
                  size="small"
                  value={form.jobId}
                  onChange={(e) => setField("jobId", e.target.value)}
                  sx={{ ...fieldSx, mb: 1.5 }}
                >
                  {jobs.length > 0 ? (
                    jobs.map((job) => (
                      <MenuItem key={job.id} value={job.id} sx={{ fontSize: 13 }}>
                        {job.title}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem value="job-1" sx={{ fontSize: 13 }}>
                      Senior Backend Engineer — FinTech Co.
                    </MenuItem>
                  )}
                </TextField>

                {/* LinkedIn URL */}
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: MUTED, mb: 0.5 }}>
                    LinkedIn Profile URL *
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: MUTED, mb: 0.75, lineHeight: 1.5 }}>
                    Used to validate CV vs LinkedIn consistency
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={form.linkedinUrl}
                    onChange={(e) => setField("linkedinUrl", e.target.value)}
                    sx={fieldSx}
                  />
                </Box>
              </Box>
            </Paper>

            {/* CV / Resume card */}
            <Paper elevation={0} sx={cardSx}>
              <Box sx={cardHeadSx}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: "7px",
                      bgcolor: "#F5F3FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                    }}
                  >
                    📄
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                    CV / Resume Text *
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 11, color: MUTED }}>Paste full CV text</Typography>
              </Box>
              <Box sx={cardBodySx}>
                <Typography sx={{ fontSize: 11, color: MUTED, mb: 1, lineHeight: 1.6 }}>
                  Copy and paste the candidate's full CV. Plain text preferred for accurate analysis.
                </Typography>

                {/* PII disclaimer */}
                <Box
                  sx={{
                    display: "flex",
                    gap: 1,
                    bgcolor: WARN_BG,
                    border: `1px solid ${WARN_BORDER}`,
                    borderRadius: "7px",
                    p: 1.25,
                    mb: 1.5,
                  }}
                >
                  <Typography sx={{ fontSize: 13, flexShrink: 0, mt: 0.1 }}>🔒</Typography>
                  <Typography sx={{ fontSize: 11, color: WARN_TEXT, lineHeight: 1.6 }}>
                    <strong>Do not include any personally identifiable information</strong> (phone
                    numbers, addresses, national ID or other PII) beyond what is needed for
                    analysis. DeepHire does not store any personally identifiable information
                    entered in this field.
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  multiline
                  minRows={13}
                  placeholder="Paste full CV text here…"
                  value={form.cvText}
                  onChange={(e) => setField("cvText", e.target.value)}
                  sx={{
                    ...fieldSx,
                    "& .MuiOutlinedInput-root": {
                      ...fieldSx["& .MuiOutlinedInput-root"],
                      fontFamily: "monospace",
                      fontSize: 12,
                      lineHeight: 1.6,
                      alignItems: "flex-start",
                    },
                  }}
                />

                <Box
                  sx={{
                    mt: 1,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography sx={{ fontSize: 11, color: MUTED }}>
                    {wordCount > 0 ? `~${wordCount} words detected` : "No text pasted yet"}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setField("cvText", "")}
                    sx={{
                      fontSize: 11,
                      fontWeight: 500,
                      borderColor: BORDER,
                      color: TEXT,
                      borderRadius: "6px",
                      textTransform: "none",
                      py: 0.4,
                      "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE },
                    }}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>
            </Paper>

          </Box>

          {/* ── RIGHT: Sidebar ────────────────────────────────────────────── */}
          <Box sx={{ flex: "0 0 216px", display: "flex", flexDirection: "column", gap: 1.75 }}>

            {/* What will be analysed */}
            <Paper elevation={0} sx={cardSx}>
              <Box sx={cardHeadSx}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  What will be analysed
                </Typography>
              </Box>
              <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                <AnalysisItem
                  icon="🔄"
                  title="CV vs LinkedIn"
                  description="Timeline gaps, title mismatches, employer discrepancies"
                  divider
                />
                <AnalysisItem
                  icon="🎯"
                  title="CV vs JD Alignment"
                  description="Technical skills, seniority, experience type match score"
                  divider
                />
                <AnalysisItem
                  icon="❓"
                  title="Validation Questions"
                  description="5–8 targeted interview questions from risk flags + gaps"
                  divider={false}
                />
              </Box>
            </Paper>

            {/* Pre-flight checklist */}
            <Paper elevation={0} sx={cardSx}>
              <Box sx={cardHeadSx}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  Pre-flight Checklist
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
                  <CheckItem done={hasName} label="Candidate name entered" />
                  <CheckItem done={hasJob} label="Job assigned" />
                  <CheckItem done={hasLinkedin} label="LinkedIn URL provided" />
                  <CheckItem done={hasCv} label="CV text pasted" />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        border: `1.5px dashed ${BORDER}`,
                        flexShrink: 0,
                      }}
                    />
                    <Typography sx={{ fontSize: 12, color: MUTED }}>
                      Optional: Recruiter notes
                    </Typography>
                  </Box>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  onClick={onSubmit}
                  disabled={!allReady}
                  sx={{
                    fontSize: 12,
                    fontWeight: 600,
                    bgcolor: ACCENT,
                    borderRadius: "7px",
                    textTransform: "none",
                    boxShadow: "none",
                    py: 1,
                    "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
                    "&.Mui-disabled": { bgcolor: "#E8ECF2", color: MUTED },
                  }}
                >
                  🔍 Run Analysis
                </Button>
                <Typography sx={{ fontSize: 10, color: MUTED, textAlign: "center", mt: 0.75 }}>
                  POST /api/analysis/run
                </Typography>
              </Box>
            </Paper>

            {/* Recruiter Notes */}
            <Paper elevation={0} sx={cardSx}>
              <Box sx={cardHeadSx}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  Recruiter Notes
                </Typography>
              </Box>
              <Box sx={{ p: 2 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Add any notes about this candidate…"
                  sx={{
                    ...fieldSx,
                    mb: 1,
                    "& .MuiOutlinedInput-root": {
                      ...fieldSx["& .MuiOutlinedInput-root"],
                      fontSize: 12,
                      alignItems: "flex-start",
                    },
                  }}
                />
                <Button
                  fullWidth
                  variant="outlined"
                  sx={{
                    fontSize: 12,
                    fontWeight: 500,
                    borderColor: BORDER,
                    color: TEXT,
                    borderRadius: "7px",
                    textTransform: "none",
                    "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE },
                  }}
                >
                  Save Notes
                </Button>
              </Box>
            </Paper>

            {/* Save without analysis */}
            <Button
              fullWidth
              variant="outlined"
              onClick={onSave}
              sx={{
                fontSize: 12,
                fontWeight: 500,
                borderColor: BORDER,
                color: TEXT,
                borderRadius: "7px",
                textTransform: "none",
                bgcolor: "#fff",
                "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE },
              }}
            >
              Save Without Analysis
            </Button>

          </Box>
        </Box>

        {/* Annotation strip */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2, mb: 1 }}>
          {[
            "📋 MUI TextField multiline for CV",
            "⚡ POST /api/candidates → POST /api/analysis/run",
            "🔗 LinkedIn URL validated client-side",
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
    </Box>
  );
}
