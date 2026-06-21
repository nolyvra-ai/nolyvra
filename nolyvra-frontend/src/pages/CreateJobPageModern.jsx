import { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  Alert, CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Color tokens matching DashboardPage.jsx
const SURFACE   = "#FFFFFF";
const BORDER    = "#E8ECF2";
const MUTED     = "#9AA3B4";
const TEXT      = "#0F1623";
const ACCENT    = "#1D72E8";
const PURPLE    = "#7C3AED";
const DANGER    = "#DC2626";
const ACCENT_L  = "#EFF6FF";
const ACCENT_BR = "#BFDBFE";
const PURPLE_L  = "#F5F3FF";
const PURPLE_BR = "#C4B5FD";
const SUCCESS   = "#16A34A";
const CURRENCIES = ["AUD", "USD", "GBP", "EUR", "NZD", "SGD"];

const TITLE_SUGGESTIONS = [
  "Software Engineer", "Senior Software Engineer", "Product Manager",
  "DevOps Engineer", "Data Scientist", "Frontend Developer",
  "Backend Developer", "Full Stack Developer", "QA Engineer",
  "Business Analyst", "UX Designer", "Scrum Master",
  "Tech Lead", "Engineering Manager", "Solutions Architect",
];

// ── Icons ──────────────────────────────────────────────────────────────────
function SparkleIcon({ color = "#fff", size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function FormIcon({ color = "#fff", size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// ── 3-step breadcrumb + progress bar ──────────────────────────────────────
function StepsHeader({ step }) {
  const steps = ["AI Job Description", "Job Details", "Review & Publish"];
  const pct = step === 1 ? 33 : step === 2 ? 67 : 100;
  return (
    <Box sx={{ mb: 3.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.5, mb: 1.5 }}>
        {steps.map((s, i) => (
          <Box key={s} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography sx={{
              fontSize: 13, fontWeight: step === i + 1 ? 600 : 400,
              color: step === i + 1 ? ACCENT : MUTED,
            }}>
              {i + 1}. {s}
            </Typography>
            {i < steps.length - 1 && (
              <Typography sx={{ fontSize: 13, color: "#D1D5DB" }}>›</Typography>
            )}
          </Box>
        ))}
      </Box>
      {/* Progress bar */}
      <Box sx={{ height: 5, bgcolor: "#E8ECF2", borderRadius: "3px" }}>
        <Box sx={{
          height: "100%", width: `${pct}%`, bgcolor: ACCENT,
          borderRadius: "3px", transition: "width 0.4s ease",
        }} />
      </Box>
    </Box>
  );
}

// ── Card shell ─────────────────────────────────────────────────────────────
const CARD_SX = {
  bgcolor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(15,22,35,0.07)",
  p: "36px 40px",
};

// ── Card icon header ───────────────────────────────────────────────────────
function CardIconHeader({ icon, title, subtitle, iconBg = ACCENT }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2.5, mb: 3.5 }}>
      <Box sx={{
        width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
        bgcolor: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 4px 16px rgba(29,114,232,0.22)`,
      }}>
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.4, lineHeight: 1.5 }}>
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Skill chip ─────────────────────────────────────────────────────────────
function SkillChip({ label }) {
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: ACCENT_L, border: `1px solid ${ACCENT_BR}`,
      borderRadius: "20px", px: 1.25, py: "3px",
      fontSize: 11, fontWeight: 600, color: ACCENT, m: "2px",
    }}>
      {label}
    </Box>
  );
}

// ── Meta chip ──────────────────────────────────────────────────────────────
function MetaChip({ label, value }) {
  if (!value) return null;
  return (
    <Box>
      <Typography sx={{
        fontSize: 10, color: MUTED, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: ".4px", mb: 0.4,
      }}>
        {label}
      </Typography>
      <Box sx={{
        display: "inline-flex", alignItems: "center",
        bgcolor: ACCENT_L, border: `1px solid ${ACCENT_BR}`,
        borderRadius: "20px", px: 1.25, py: "2px",
        fontSize: 11, fontWeight: 600, color: ACCENT,
      }}>
        {value}
      </Box>
    </Box>
  );
}

// ── Suggestive input ───────────────────────────────────────────────────────
function SuggestInput({ label, required, value, onChange, suggestions, placeholder }) {
  const [show, setShow] = useState(false);
  const filtered = value.trim()
    ? suggestions.filter(s =>
        s.toLowerCase().includes(value.toLowerCase()) &&
        s.toLowerCase() !== value.toLowerCase()
      )
    : suggestions;
  return (
    <Box sx={{ position: "relative" }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, mb: 0.75 }}>
        {label}{required && <Box component="span" sx={{ color: DANGER }}> *</Box>}
      </Typography>
      <TextField
        fullWidth size="small"
        value={value}
        onChange={e => { onChange(e.target.value); setShow(true); }}
        onFocus={() => setShow(true)}
        onBlur={() => setTimeout(() => setShow(false), 150)}
        placeholder={placeholder}
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: "10px", fontSize: 14, bgcolor: "#FAFBFD",
            "& fieldset": { borderColor: BORDER },
            "&:hover fieldset": { borderColor: "#C0C8D8" },
            "&.Mui-focused fieldset": { borderColor: ACCENT },
          },
        }}
      />
      {show && filtered.length > 0 && (
        <Box sx={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999,
          bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: "10px",
          boxShadow: "0 4px 12px rgba(15,22,35,0.08)",
          maxHeight: 220, overflowY: "auto",
        }}>
          {filtered.slice(0, 8).map(s => (
            <Box key={s}
              onMouseDown={e => { e.preventDefault(); onChange(s); setShow(false); }}
              sx={{
                px: 2, height: 38, display: "flex", alignItems: "center",
                fontSize: 13, color: TEXT, cursor: "pointer",
                "&:hover": { bgcolor: ACCENT_L },
              }}
            >
              {s}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// ── Field label helper ─────────────────────────────────────────────────────
function FieldLabel({ children, required }) {
  return (
    <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, mb: 0.75 }}>
      {children}
      {required && <Box component="span" sx={{ color: DANGER }}> *</Box>}
    </Typography>
  );
}

const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "10px", fontSize: 14, bgcolor: "#FAFBFD",
    "& fieldset": { borderColor: BORDER },
    "&:hover fieldset": { borderColor: "#C0C8D8" },
    "&.Mui-focused fieldset": { borderColor: ACCENT },
  },
};

// ── Generate button ────────────────────────────────────────────────────────
function GenerateBtn({ onClick, loading, disabled }) {
  return (
    <Button
      fullWidth
      onClick={onClick}
      disabled={loading || disabled}
      sx={{
        borderRadius: "50px",
        py: 1.75,
        mt: 1,
        fontSize: 15,
        fontWeight: 600,
        textTransform: "none",
        boxShadow: "none",
        gap: 1,
        background: (loading || disabled)
          ? "#E2E5EC"
          : "linear-gradient(135deg, #7C3AED 0%, #1D72E8 100%)",
        color: (loading || disabled) ? "#A0A8B8" : "#fff",
        "&:hover": {
          background: "linear-gradient(135deg, #6D28D9 0%, #1660CC 100%)",
          boxShadow: "0 4px 18px rgba(124,58,237,0.28)",
        },
        "&.Mui-disabled": {
          background: "#E2E5EC",
          color: "#A0A8B8",
        },
      }}
    >
      {loading
        ? <><CircularProgress size={16} sx={{ color: "#A0A8B8", mr: 0.5 }} />Generating…</>
        : <><SparkleIcon color={(loading || disabled) ? "#A0A8B8" : "#fff"} size={18} />Generate Job Description</>}
    </Button>
  );
}

// ── Local skill extractor (used for paste-JD path — no API call needed) ───
function extractSkillsFromJd(jdText) {
  if (!jdText.trim()) return { technical: [], soft: [], seniority: null };
  const lower = jdText.toLowerCase();
  const techKeywords = [
    "java", "kotlin", "spring boot", "spring", "python", "javascript", "typescript",
    "react", "node.js", "node", "angular", "vue", "golang", "rust", "c#", ".net",
    "php", "ruby", "rails", "django", "flask", "fastapi", "aws", "azure", "gcp",
    "docker", "kubernetes", "k8s", "terraform", "ansible", "jenkins", "github actions",
    "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch",
    "kafka", "rabbitmq", "microservices", "rest api", "graphql", "grpc",
    "machine learning", "tensorflow", "pytorch", "sql", "nosql", "git", "linux",
  ];
  const softKeywords = [
    "leadership", "mentoring", "communication", "collaboration", "teamwork",
    "problem solving", "analytical", "agile", "scrum", "code review",
  ];
  const seniorityRules = [
    { keys: ["senior", "sr.", "lead", "principal", "staff", "architect"], label: "Senior · 5+ yrs" },
    { keys: ["junior", "jr.", "entry", "graduate"],                        label: "Junior · 0-2 yrs" },
    { keys: ["mid-level", "mid level", "intermediate"],                    label: "Mid-level · 2-5 yrs" },
    { keys: ["manager", "head of", "director", "vp "],                    label: "Manager" },
  ];
  const cap = s => s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const technical = techKeywords.filter(k => lower.includes(k)).map(cap).slice(0, 10);
  const soft      = softKeywords.filter(k => lower.includes(k)).map(cap).slice(0, 6);
  let seniority = null;
  for (const rule of seniorityRules) {
    if (rule.keys.some(k => lower.includes(k))) { seniority = rule.label; break; }
  }
  return { technical, soft, seniority };
}

// ── Main component ─────────────────────────────────────────────────────────
export default function CreateJobPageModern() {
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  const [step, setStep] = useState(1);

  // Step 1
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);
  const [editedJD, setEditedJD] = useState("");
  const [jdEditable, setJdEditable] = useState(false);

  // Paste-existing-JD path
  const [showExistingJD, setShowExistingJD] = useState(false);
  const [pastedJD, setPastedJD] = useState("");
  const [manualSkills, setManualSkills] = useState([]);
  const [skillInput, setSkillInput] = useState("");

  // Step 2
  const [form, setForm] = useState({
    title: "", company: "", location: "",
    jobType: "Full-time", jobStatus: "Active",
    salary: "", currency: "AUD", feePercentage: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [jdOpen, setJdOpen] = useState(false);
  const [existingCompanies, setExistingCompanies] = useState([]);

  useEffect(() => {
    const url = new URL(`${API_BASE}/api/clients`);
    url.searchParams.set("loginId", loginId);
    fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(clients => {
        setExistingCompanies((clients || []).map(c => c.companyName).filter(Boolean));
      })
      .catch(() => {});
  }, [loginId]);

  function handleSkillKeyDown(e) {
    if ((e.key === " " || e.key === "Enter") && skillInput.trim()) {
      e.preventDefault();
      const s = skillInput.trim();
      if (!manualSkills.includes(s)) setManualSkills(p => [...p, s]);
      setSkillInput("");
    }
    if (e.key === "Backspace" && !skillInput && manualSkills.length > 0) {
      setManualSkills(p => p.slice(0, -1));
    }
  }

  async function handleGenerate() {
    const hasBrief = brief.trim();
    const hasJD    = pastedJD.trim();
    if (!hasBrief && !hasJD) return;

    // Paste path — no API call; extract skills locally and use JD as-is
    if (!hasBrief && hasJD) {
      const extracted = extractSkillsFromJd(pastedJD);
      setAiResponse({
        generatedJdText: pastedJD,
        extractedSkills: extracted.technical,
        softSkills:      extracted.soft,
        seniorityLevel:  extracted.seniority,
        roleType:  null,
        industry:  null,
      });
      setEditedJD(pastedJD);
      setJdEditable(false);
      return;
    }

    // Brief path — call AI API
    setLoading(true);
    setBriefError(null);
    try {
      const url = new URL(`${API_BASE}/api/jobs/analyze-brief`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify({ briefText: brief }),
      });
      if (res.status === 402) throw new Error("Token limit reached. Please upgrade your plan.");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAiResponse(data);
      setEditedJD(data.generatedJdText || "");
      setJdEditable(false);
      setForm(p => ({
        ...p,
        ...(data.company  ? { company:  data.company  } : {}),
        ...(data.location ? { location: data.location } : {}),
      }));
    } catch (e) {
      setBriefError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.title.trim()) { setSaveError("Job title is required."); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const url = new URL(`${API_BASE}/api/jobs`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify({
          title:     form.title,
          company:   form.company,
          location:  form.location,
          jobType:   form.jobType,
          jobStatus: form.jobStatus,
          salary:    form.salary !== "" ? Number(form.salary) : null,
          currency:  form.currency,
          feePercentage: form.feePercentage !== "" ? Number(form.feePercentage) : null,
          jdText:    editedJD,
          seniority: aiResponse?.seniorityLevel || null,
          stackTags: [...new Set([
            ...(aiResponse?.extractedSkills || []),
            ...(aiResponse?.softSkills || []),
            ...manualSkills,
          ])],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const newJob = await res.json();
      if (!newJob?.id) throw new Error("Unexpected response from server.");
      nav(`/jobs/${newJob.id}/add-candidates-modern`, {
        state: { jobTitle: form.title, job: newJob },
      });
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const generatedJD = editedJD;
  const allSkills   = [
    ...(aiResponse?.extractedSkills || []),
    ...(aiResponse?.softSkills || []),
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: 860, mx: "auto" }}>

      {/* ── Top nav row ──────────────────────────────────────────────────── */}
      <Box sx={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", mb: 3,
      }}>
        <Box
          onClick={() => nav("/dashboard")}
          sx={{
            display: "flex", alignItems: "center", gap: 0.75,
            cursor: "pointer", color: TEXT,
            "&:hover": { color: ACCENT },
          }}
        >
          <Typography sx={{ fontSize: 18, lineHeight: 1 }}>←</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 500 }}>Back to Dashboard</Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => nav("/jobs/new-classic")}
          sx={{
            borderRadius: "50px", fontSize: 13, fontWeight: 500,
            borderColor: "#DDE3EE", color: TEXT, textTransform: "none",
            px: 2.5, py: 0.75,
            "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" },
          }}
        >
          Switch to Classic View
        </Button>
      </Box>

      {/* ── Steps breadcrumb + progress bar ──────────────────────────────── */}
      <StepsHeader step={step} />

      {step === 1 ? (

        /* ══ STEP 1 — AI Job Brief ════════════════════════════════════════ */
        <Paper elevation={0} sx={CARD_SX}>
          <CardIconHeader
            icon={<SparkleIcon color="#fff" size={26} />}
            iconBg={ACCENT}
            title="AI-Powered Job Description"
            subtitle="Let AI help you create a compelling job posting"
          />

          {/* Brief textarea */}
          <FieldLabel>Enter Job Brief</FieldLabel>
          <TextField
            multiline rows={7} fullWidth
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder="E.g., We need a senior React developer with 5 years experience to build our SaaS platform..."
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px", fontSize: 14, bgcolor: "#FAFBFD",
                "& fieldset": { borderColor: BORDER },
                "&:hover fieldset": { borderColor: "#C0C8D8" },
                "&.Mui-focused fieldset": { borderColor: ACCENT },
              },
            }}
          />
          <Typography sx={{ fontSize: 12, color: MUTED, mt: 1, mb: 2.5, lineHeight: 1.5 }}>
            Provide a brief description of the role, key requirements, and any specific details
          </Typography>

          {briefError && <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>{briefError}</Alert>}

          {/* "Already have existing JD?" toggle */}
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
            <Box
              onClick={() => setShowExistingJD(p => !p)}
              sx={{
                fontSize: 13, fontWeight: 500, color: showExistingJD ? MUTED : ACCENT,
                cursor: "pointer", textDecoration: "underline",
                textDecorationColor: showExistingJD ? MUTED : ACCENT,
                textUnderlineOffset: "2px",
                "&:hover": { opacity: 0.75 },
              }}
            >
              {showExistingJD ? "× Hide existing JD" : "Already have an existing JD?"}
            </Box>
          </Box>

          {/* Expandable paste-JD section */}
          {showExistingJD && (
            <Box sx={{
              border: `1px solid ${BORDER}`, borderRadius: "12px",
              bgcolor: "#FAFBFD", p: "20px 22px", mb: 2,
            }}>
              {/* Section header */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.75 }}>
                <Box sx={{
                  width: 28, height: 28, borderRadius: "8px", bgcolor: ACCENT_L,
                  border: `1px solid ${ACCENT_BR}`, display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
                    Paste Existing Job Description
                  </Typography>
                  <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.25 }}>
                    Skip AI generation — paste your JD and we'll extract skills automatically
                  </Typography>
                </Box>
              </Box>

              {/* JD textarea */}
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, mb: 0.75 }}>
                Job Description
              </Typography>
              <TextField
                multiline rows={8} fullWidth
                value={pastedJD}
                onChange={e => setPastedJD(e.target.value)}
                placeholder="Paste the full job description here…"
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px", fontSize: 13.5, bgcolor: "#fff",
                    "& fieldset": { borderColor: BORDER },
                    "&:hover fieldset": { borderColor: "#C0C8D8" },
                    "&.Mui-focused fieldset": { borderColor: ACCENT },
                  },
                }}
              />

              {/* Skills tag input */}
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, mb: 0.75 }}>
                Add Skills <Box component="span" sx={{ fontSize: 11.5, fontWeight: 400, color: MUTED }}>
                  — type a skill and press Space to add
                </Box>
              </Typography>
              <Box
                onClick={() => document.getElementById("modern-skill-input").focus()}
                sx={{
                  display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center",
                  border: `1px solid ${BORDER}`, borderRadius: "10px",
                  p: "8px 12px", minHeight: 46, bgcolor: "#fff", cursor: "text",
                  transition: "border-color .15s, box-shadow .15s",
                  "&:focus-within": {
                    borderColor: ACCENT,
                    boxShadow: `0 0 0 3px rgba(29,114,232,0.08)`,
                  },
                }}
              >
                {manualSkills.map(s => (
                  <Box key={s} sx={{
                    display: "inline-flex", alignItems: "center", gap: 0.5,
                    bgcolor: ACCENT_L, border: `1px solid ${ACCENT_BR}`,
                    borderRadius: "20px", px: 1.25, py: "3px",
                    fontSize: 11.5, fontWeight: 600, color: ACCENT,
                  }}>
                    {s}
                    <Box
                      onClick={e => { e.stopPropagation(); setManualSkills(p => p.filter(x => x !== s)); }}
                      sx={{ cursor: "pointer", fontSize: 14, lineHeight: 1, opacity: 0.5, "&:hover": { opacity: 1 } }}
                    >×</Box>
                  </Box>
                ))}
                <Box
                  id="modern-skill-input"
                  component="input"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  placeholder={manualSkills.length === 0 ? "e.g. Kafka   Docker   FinTech…" : ""}
                  sx={{
                    border: "none", outline: "none", background: "transparent",
                    fontSize: 13, color: TEXT, fontFamily: "inherit",
                    minWidth: 160, flex: 1, p: "2px 4px",
                    "&::placeholder": { color: MUTED },
                  }}
                />
              </Box>
              {manualSkills.length > 0 && (
                <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.75 }}>
                  {manualSkills.length} skill{manualSkills.length !== 1 ? "s" : ""} added
                </Typography>
              )}

              <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 1.5, lineHeight: 1.5 }}>
                Click "Generate Job Description" below — your pasted JD will be used as-is and skills will be extracted automatically.
              </Typography>
            </Box>
          )}

          <GenerateBtn onClick={handleGenerate} loading={loading} disabled={!brief.trim() && !pastedJD.trim()} />

          {/* ── Output section (appears after generation) ── */}
          {aiResponse && (
            <Box sx={{ mt: 4, pt: 3.5, borderTop: `1px solid ${BORDER}` }}>

              {/* JD label + NEW badge + Edit toggle */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: TEXT }}>
                  {brief.trim() ? "AI Generated Job Description" : "Job Description"}
                </Typography>
                <Box sx={{
                  fontSize: 9, fontWeight: 700, color: PURPLE, bgcolor: PURPLE_L,
                  border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", px: "6px", py: "2px",
                }}>
                  NEW
                </Box>
                <Box sx={{ flex: 1 }} />
                <Button
                  size="small"
                  variant={jdEditable ? "contained" : "outlined"}
                  onClick={() => setJdEditable(p => !p)}
                  sx={{
                    fontSize: 12, fontWeight: 600, borderRadius: "20px",
                    textTransform: "none", boxShadow: "none",
                    px: 2, py: 0.5,
                    ...(jdEditable
                      ? {
                          bgcolor: ACCENT,
                          "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
                        }
                      : {
                          borderColor: BORDER, color: TEXT,
                          "&:hover": { borderColor: ACCENT, color: ACCENT },
                        }),
                  }}
                >
                  {jdEditable ? "✓ Done" : "✏ Edit"}
                </Button>
              </Box>

              {/* JD — readonly display or editable textarea */}
              {jdEditable ? (
                <TextField
                  multiline fullWidth
                  minRows={9}
                  value={editedJD}
                  onChange={e => setEditedJD(e.target.value)}
                  sx={{
                    mb: 2.5,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px", fontSize: 14,
                      fontFamily: "inherit", lineHeight: 1.75,
                      "& fieldset": { borderColor: ACCENT },
                      "&:hover fieldset": { borderColor: ACCENT },
                      "&.Mui-focused fieldset": { borderColor: ACCENT, borderWidth: 2 },
                    },
                  }}
                />
              ) : (
                <Box sx={{
                  bgcolor: "#FAFBFD", border: `1px solid ${BORDER}`, borderRadius: "12px",
                  minHeight: 200, p: "18px 20px", fontSize: 14, color: TEXT,
                  overflowY: "auto", lineHeight: 1.75, whiteSpace: "pre-wrap",
                  fontFamily: "inherit", mb: 2.5,
                }}>
                  {generatedJD || "—"}
                </Box>
              )}

              {/* Skills */}
              {allSkills.length > 0 && (
                <Box sx={{ mb: 2.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, mb: 1 }}>
                    Skills
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                    {allSkills.map(s => <SkillChip key={s} label={s} />)}
                  </Box>
                </Box>
              )}

              {/* Meta row */}
              <Box sx={{ display: "flex", gap: 3.5, flexWrap: "wrap", mb: 1 }}>
                <MetaChip label="Seniority" value={aiResponse.seniorityLevel} />
                <MetaChip label="Role Type" value={aiResponse.roleType} />
                <MetaChip label="Industry"  value={aiResponse.industry} />
              </Box>
            </Box>
          )}

          {/* Next button */}
          {aiResponse && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3.5 }}>
              <Button
                variant="contained"
                onClick={() => setStep(2)}
                sx={{
                  fontSize: 14, fontWeight: 600, bgcolor: ACCENT,
                  borderRadius: "50px", textTransform: "none",
                  boxShadow: "none", px: 4, py: 1.25,
                  "&:hover": { bgcolor: "#1660CC", boxShadow: "0 4px 14px rgba(29,114,232,0.28)" },
                }}
              >
                Next: Job Details →
              </Button>
            </Box>
          )}
        </Paper>

      ) : (

        /* ══ STEP 2 — Job Details ═════════════════════════════════════════ */
        <Paper elevation={0} sx={CARD_SX}>
          <CardIconHeader
            icon={<FormIcon color="#fff" size={24} />}
            iconBg="#1D72E8"
            title="Job Details"
            subtitle="Fill in the specifics for your job posting"
          />

          {saveError && <Alert severity="error" sx={{ mb: 2.5, borderRadius: "10px" }}>{saveError}</Alert>}

          {/* 2-column form grid */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2.5, mb: 2.5 }}>
            <SuggestInput
              label="Job Title" required
              value={form.title}
              onChange={v => setForm(p => ({ ...p, title: v }))}
              suggestions={TITLE_SUGGESTIONS}
              placeholder="e.g. Senior Backend Engineer"
            />
            <SuggestInput
              label="Client / Company"
              value={form.company}
              onChange={v => setForm(p => ({ ...p, company: v }))}
              suggestions={existingCompanies}
              placeholder="e.g. FinTech Co."
            />
            <Box>
              <FieldLabel>Location</FieldLabel>
              <TextField fullWidth size="small"
                value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="e.g. London / Remote"
                sx={fieldSx}
              />
            </Box>
            <Box>
              <FieldLabel>Employment Type</FieldLabel>
              <TextField select fullWidth size="small"
                value={form.jobType}
                onChange={e => setForm(p => ({ ...p, jobType: e.target.value }))}
                sx={fieldSx}
              >
                {["Full-time", "Part-time", "Contract", "Casual", "Fixed Term"].map(o => (
                  <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>
                ))}
              </TextField>
            </Box>
            <Box>
              <FieldLabel>Status</FieldLabel>
              <TextField select fullWidth size="small"
                value={form.jobStatus}
                onChange={e => setForm(p => ({ ...p, jobStatus: e.target.value }))}
                sx={fieldSx}
              >
                {["Active", "Fulfilling", "On Hold", "Complete"].map(o => (
                  <MenuItem key={o} value={o} sx={{ fontSize: 13 }}>{o}</MenuItem>
                ))}
              </TextField>
            </Box>
            <Box>
              <FieldLabel>Salary</FieldLabel>
              <Box sx={{ display: "flex", gap: 0.75 }}>
                <TextField select size="small" value={form.currency}
                  onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                  sx={{ width: 100, ...fieldSx }}>
                  {CURRENCIES.map(c => <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>{c}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" type="number" value={form.salary}
                  onChange={e => setForm(p => ({ ...p, salary: e.target.value }))}
                  placeholder="e.g. 120000"
                  sx={fieldSx} />
              </Box>
            </Box>
            <Box>
              <FieldLabel>% Fees</FieldLabel>
              <TextField fullWidth size="small" type="number" value={form.feePercentage}
                onChange={e => setForm(p => ({ ...p, feePercentage: e.target.value }))}
                placeholder="e.g. 15"
                sx={fieldSx} />
            </Box>
            {form.salary !== "" && form.feePercentage !== "" && (
              <Box sx={{ display: "flex", alignItems: "flex-end", fontSize: 13, color: MUTED }}>
                Estimated Fee:{" "}
                <Box component="span" sx={{ fontWeight: 700, color: SUCCESS, ml: 0.5 }}>
                  {form.currency} {(Number(form.salary) * Number(form.feePercentage) / 100)
                    .toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Box>
              </Box>
            )}
          </Box>

          {/* Collapsible JD preview */}
          <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "12px", overflow: "hidden", mb: 3 }}>
            <Box
              onClick={() => setJdOpen(p => !p)}
              sx={{
                px: 2.5, py: 1.5, display: "flex", alignItems: "center",
                justifyContent: "space-between", cursor: "pointer",
                bgcolor: "#FAFBFD", "&:hover": { bgcolor: "#F0F2F6" },
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                View Generated JD {jdOpen ? "▴" : "▾"}
              </Typography>
            </Box>
            {jdOpen && (
              <Box sx={{
                p: "16px 20px", bgcolor: "#fff", fontSize: 13, color: TEXT,
                overflowY: "auto", maxHeight: 280, lineHeight: 1.75,
                whiteSpace: "pre-wrap", fontFamily: "inherit",
                borderTop: `1px solid ${BORDER}`,
              }}>
                {generatedJD || "—"}
              </Box>
            )}
          </Box>

          {/* Action row */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box
              onClick={() => { setStep(1); setSaveError(null); }}
              sx={{
                display: "flex", alignItems: "center", gap: 0.75,
                fontSize: 14, fontWeight: 500, color: MUTED, cursor: "pointer",
                "&:hover": { color: TEXT },
              }}
            >
              <Typography sx={{ fontSize: 18, lineHeight: 1 }}>←</Typography>
              Back
            </Box>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={saving}
              sx={{
                fontSize: 14, fontWeight: 600, bgcolor: ACCENT,
                borderRadius: "50px", textTransform: "none",
                boxShadow: "none", px: 4, py: 1.25,
                "&:hover": { bgcolor: "#1660CC", boxShadow: "0 4px 14px rgba(29,114,232,0.28)" },
              }}
            >
              {saving
                ? <><CircularProgress size={15} sx={{ color: "#fff", mr: 1 }} />Creating…</>
                : "Create Job & Continue →"}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
