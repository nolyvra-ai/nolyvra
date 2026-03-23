import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Divider,
  MenuItem,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

async function apiPost(path, body) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
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

// ─── Shared style tokens ──────────────────────────────────────────────────────
const BORDER = "#E8ECF2";
const MUTED = "#9AA3B4";
const TEXT = "#0F1623";
const ACCENT = "#1D72E8";
const WARN_BG = "#F0F7FF";
const WARN_BORDER = "#BFDBFE";
const WARN_TEXT = "#1E40AF";
const SURFACE = "#FAFBFD";
const CARD_SHADOW = "0 1px 3px rgba(0,0,0,0.05)";
const WARNING_BG = "#FFFBEB";
const WARNING_BORDER = "#FDE68A";
const WARNING_TEXT = "#D97706";
const WARNING_BODY = "#92400E";

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
  "& .MuiFormHelperText-root": { fontSize: 11, color: MUTED, mx: 0 },
};

// ─── Skill tag chip ───────────────────────────────────────────────────────────
function SkillTag({ label }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        bgcolor: "#F1F3F7",
        border: `1px solid ${BORDER}`,
        borderRadius: "5px",
        px: 1,
        py: 0.25,
        fontSize: 11,
        fontWeight: 500,
        color: "#3D4A63",
        mr: 0.5,
        mb: 0.5,
      }}
    >
      {label}
    </Box>
  );
}

// ─── After-save next-step item ────────────────────────────────────────────────
function NextStep({ label }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          bgcolor: "#F0FDF4",
          border: "1px solid #BBF7D0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9">
          <path
            d="M1.5 4.5l2 2L7.5 2"
            stroke="#16A34A"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Box>
      <Typography sx={{ fontSize: 12, color: "#3D4A63" }}>{label}</Typography>
    </Box>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CreateJobPage() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    jobType: "Hybrid",
    jdText: "",
    tags: "Java, Spring Boot, AWS, Kafka, Postgres",
  });

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const tagList = form.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // ── Derived checklist / step state ─────────────────────────────────────────
  const hasDetails = form.title.trim().length > 0;
  const hasJd = form.jdText.trim().length > 0;
  const allReady = hasDetails && hasJd;
  const wordCount = form.jdText.trim() ? form.jdText.trim().split(/\s+/).length : 0;

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function onSubmit(e) {
    e.preventDefault();
    try {
      await apiPost("/api/jobs", {
        title: form.title,
        company: form.company,
        jobType: form.jobType,
        seniority: "",
        jdText: form.jdText,
        location: form.location,
        stackTags: tagList,
      });
      nav("/jobs");
    } catch (err) {
      console.error("Failed to create job", err);
      alert("Failed to save job");
    }
  }

  // ── Extracted skills (derived from JD text or tags field) ──────────────────
  const techSkills = ["Java / Kotlin", "Spring Boot", "REST API", "Microservices", "AWS", "Docker", "Kubernetes"];
  const softSkills = ["Mentoring", "Code Review", "Collaboration"];

  // ─────────────────────────────────────────────────────────────────────────────
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
          <Typography
            sx={{ fontSize: 14, fontWeight: 700, color: TEXT, letterSpacing: "-0.2px" }}
          >
            Create New Job
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Paste JD to create a vacancy and enable candidate analysis
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => nav("/jobs")}
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
            Save Job
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
          flexShrink: 0,
        }}
      >
        {[
          { label: "Job Details", done: hasDetails, active: !hasDetails },
          { label: "Job Description", done: hasJd, active: hasDetails && !hasJd },
          { label: "Review & Save", done: false, active: allReady },
        ].map((step, i, arr) => {
          const isLast = i === arr.length - 1;
          const circleColor = step.done
            ? "#16A34A"
            : step.active
              ? ACCENT
              : SURFACE;
          const circleBorder = step.done
            ? "none"
            : step.active
              ? "none"
              : `1.5px solid ${BORDER}`;
          const textColor = step.done
            ? "#16A34A"
            : step.active
              ? TEXT
              : MUTED;
          return (
            <Box
              key={step.label}
              sx={{ display: "flex", alignItems: "center", flex: isLast ? "none" : 1 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    bgcolor: circleColor,
                    border: circleBorder,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {step.done ? (
                    <svg width="11" height="11" viewBox="0 0 11 11">
                      <path
                        d="M2 5.5l2.5 2.5L9 3"
                        stroke="#fff"
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <Typography
                      sx={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: step.active ? "#fff" : MUTED,
                        lineHeight: 1,
                      }}
                    >
                      {i + 1}
                    </Typography>
                  )}
                </Box>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: step.active || step.done ? 600 : 400,
                    color: textColor,
                    whiteSpace: "nowrap",
                  }}
                >
                  {step.label}
                </Typography>
              </Box>
              {!isLast && (
                <Box sx={{ flex: 1, height: "1px", bgcolor: BORDER, mx: 1.5 }} />
              )}
            </Box>
          );
        })}
      </Box>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>
        <Box component="form" onSubmit={onSubmit}>
          <Box sx={{ display: "flex", gap: 1.75, alignItems: "flex-start" }}>

            {/* ── LEFT: Form ──────────────────────────────────────────────── */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.75, minWidth: 0 }}>

              {/* Job Details card */}
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
                      💼
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                      Job Details
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ p: 2.25 }}>
                  {/* Title / Company */}
                  <Box
                    sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 1.5 }}
                  >
                    <TextField
                      fullWidth
                      label="Job Title *"
                      size="small"
                      value={form.title}
                      onChange={(e) => setField("title", e.target.value)}
                      sx={fieldSx}
                    />
                    <TextField
                      fullWidth
                      label="Client / Company"
                      size="small"
                      value={form.company}
                      onChange={(e) => setField("company", e.target.value)}
                      sx={fieldSx}
                    />
                  </Box>
                  {/* Location / Job Type */}
                  <Box
                    sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}
                  >
                    <TextField
                      fullWidth
                      label="Location"
                      size="small"
                      placeholder="e.g. London / Remote"
                      value={form.location}
                      onChange={(e) => setField("location", e.target.value)}
                      sx={fieldSx}
                    />
                    <TextField
                      fullWidth
                      select
                      label="Employment Type"
                      size="small"
                      value={form.jobType}
                      onChange={(e) => setField("jobType", e.target.value)}
                      helperText="Remote / Hybrid / Onsite"
                      sx={fieldSx}
                    >
                      {["Full-time", "Contract", "Part-time", "Remote", "Hybrid", "Onsite"].map(
                        (opt) => (
                          <MenuItem key={opt} value={opt} sx={{ fontSize: 13 }}>
                            {opt}
                          </MenuItem>
                        )
                      )}
                    </TextField>
                  </Box>
                </Box>
              </Paper>

              {/* Job Description card */}
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
                      📋
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                      Job Description (JD) *
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 11, color: MUTED }}>
                    Paste full JD text here
                  </Typography>
                </Box>
                <Box sx={{ p: 2.25 }}>
                  <Typography sx={{ fontSize: 11, color: MUTED, mb: 1, lineHeight: 1.6 }}>
                    Paste the complete job description. nolyvra will extract required
                    capabilities, seniority signals and technical skills automatically.
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
                      <strong>Do not include any candidate personal information</strong> (names,
                      emails, phone numbers, addresses or other PII) in the job description.
                      nolyvra does not store any personally identifiable information entered in
                      this field.
                    </Typography>
                  </Box>

                  {/* JD textarea */}
                  <TextField
                    fullWidth
                    multiline
                    minRows={13}
                    placeholder="Paste the full job description here…"
                    value={form.jdText}
                    onChange={(e) => setField("jdText", e.target.value)}
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

                  {/* Footer row */}
                  <Box
                    sx={{
                      mt: 1.25,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography sx={{ fontSize: 11, color: MUTED }}>
                      {wordCount > 0
                        ? `~${wordCount} words · POST /api/jobs — Spring Boot REST`
                        : "POST /api/jobs — Spring Boot REST"}
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
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
                      🔍 Preview Extracted Skills
                    </Button>
                  </Box>
                </Box>
              </Paper>

              {/* Stack Tags card */}
              <Paper elevation={0} sx={cardSx}>
                <Box sx={cardHeadSx}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: "7px",
                        bgcolor: "#F0FDF4",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                      }}
                    >
                      🏷
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                      Stack Tags
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 11, color: MUTED }}>
                    Comma-separated
                  </Typography>
                </Box>
                <Box sx={{ p: 2.25 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Stack Tags"
                    value={form.tags}
                    onChange={(e) => setField("tags", e.target.value)}
                    helperText="Separate each tag with a comma — these map to stackTags[] in the API payload"
                    sx={fieldSx}
                  />
                  {tagList.length > 0 && (
                    <Box sx={{ mt: 1.25, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {tagList.map((t) => (
                        <Chip
                          key={t}
                          label={t}
                          size="small"
                          variant="outlined"
                          sx={{
                            fontSize: 11,
                            fontWeight: 500,
                            borderColor: BORDER,
                            color: TEXT,
                            bgcolor: SURFACE,
                            borderRadius: "5px",
                            height: 24,
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              </Paper>

            </Box>

            {/* ── RIGHT: Sidebar ───────────────────────────────────────────── */}
            <Box
              sx={{ flex: "0 0 216px", display: "flex", flexDirection: "column", gap: 1.75 }}
            >

              {/* Extracted Skills Preview */}
              <Paper elevation={0} sx={cardSx}>
                <Box sx={cardHeadSx}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                    Extracted Skills Preview
                  </Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                  <Typography
                    sx={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: MUTED,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      mb: 0.75,
                    }}
                  >
                    Technical
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", mb: 1.25 }}>
                    {techSkills.map((s) => (
                      <SkillTag key={s} label={s} />
                    ))}
                  </Box>

                  <Divider sx={{ borderColor: BORDER, my: 1.25 }} />

                  <Typography
                    sx={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: MUTED,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      mb: 0.75,
                    }}
                  >
                    Soft Skills
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", mb: 1.25 }}>
                    {softSkills.map((s) => (
                      <SkillTag key={s} label={s} />
                    ))}
                  </Box>

                  <Divider sx={{ borderColor: BORDER, my: 1.25 }} />

                  <Typography
                    sx={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: MUTED,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      mb: 0.75,
                    }}
                  >
                    Seniority Signal
                  </Typography>
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      bgcolor: "#EBF2FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: "20px",
                      px: 1.25,
                      py: 0.375,
                      fontSize: 11,
                      fontWeight: 600,
                      color: ACCENT,
                    }}
                  >
                    Senior · 5+ yrs
                  </Box>
                </Box>
              </Paper>

              {/* Tip card */}
              <Box
                sx={{
                  bgcolor: WARNING_BG,
                  border: `1px solid ${WARNING_BORDER}`,
                  borderRadius: "10px",
                  p: 1.75,
                }}
              >
                <Typography
                  sx={{ fontSize: 12, fontWeight: 600, color: WARNING_TEXT, mb: 0.5 }}
                >
                  ⚠ Tip
                </Typography>
                <Typography
                  sx={{ fontSize: 11, color: WARNING_BODY, lineHeight: 1.6 }}
                >
                  Include measurable outcomes in your JD (e.g. "process 1M
                  transactions/day") for more precise capability scoring.
                </Typography>
              </Box>

              {/* After saving */}
              <Box sx={{ px: 0.25 }}>
                <Typography sx={{ fontSize: 11, color: MUTED, mb: 1 }}>
                  After saving you can:
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  <NextStep label="Add candidates to this job" />
                  <NextStep label="Run CV vs JD analysis" />
                  <NextStep label="Review validation questions" />
                </Box>
              </Box>

            </Box>
          </Box>

          {/* Annotation strip */}
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2, mb: 1 }}>
            {[
              "copyright@ nolyvra",
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
      </Box>
    </Box>
  );
}
