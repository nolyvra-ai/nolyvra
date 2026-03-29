import { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import { usePlanLimit } from "../hooks/usePlanLimit";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706", WARN_BG = "#FFFBEB", WARN_BR = "#FDE68A";
const DANGER = "#DC2626", DANGER_BG = "#FEF2F2", DANGER_BR = "#FECACA";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";
const SURFACE = "#FAFBFD";

function NewTag() {
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", px: "7px", py: "2px",
      bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`, borderRadius: "4px",
      fontSize: 10, fontWeight: 600, color: PURPLE, ml: 1
    }}>NEW</Box>
  );
}

function Tag({ label, variant = "neutral" }) {
  const s = {
    match: { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
    neutral: { bg: "#F1F3F7", border: BORDER, color: MUTED },
  }[variant] ?? { bg: "#F1F3F7", border: BORDER, color: MUTED };
  return (
    <Box sx={{
      display: "inline-flex", px: 1, py: 0.25, bgcolor: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "4px", fontSize: 11, fontWeight: 500, color: s.color, m: "2px"
    }}>
      {label}
    </Box>
  );
}

function StepBar({ step }) {
  const steps = ["Job Details", "Job Description", "Review & Save"];
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
      {steps.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <Box key={s} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{
                width: 21, height: 21, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600,
                bgcolor: done ? SUCCESS : active ? ACCENT : "#EEF0F5",
                color: done ? "#fff" : active ? "#fff" : MUTED
              }}>
                {done ? "✓" : i + 1}
              </Box>
              <Typography sx={{
                fontSize: 12, fontWeight: active ? 500 : 400,
                color: active ? TEXT : MUTED
              }}>{s}</Typography>
            </Box>
            {i < steps.length - 1 && (
              <Box sx={{ flex: 1, minWidth: 24, height: 1, bgcolor: BORDER }} />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

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
    { keys: ["junior", "jr.", "entry", "graduate"], label: "Junior · 0-2 yrs" },
    { keys: ["mid-level", "mid level", "intermediate"], label: "Mid-level · 2-5 yrs" },
    { keys: ["manager", "head of", "director", "vp "], label: "Manager" },
  ];
  const technical = techKeywords
    .filter(k => lower.includes(k))
    .map(k => k.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "))
    .slice(0, 10);
  const soft = softKeywords
    .filter(k => lower.includes(k))
    .map(k => k.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "))
    .slice(0, 6);
  let seniority = null;
  for (const rule of seniorityRules) {
    if (rule.keys.some(k => lower.includes(k))) { seniority = rule.label; break; }
  }
  return { technical, soft, seniority };
}

export default function CreateJobPage() {
  const nav = useNavigate();
  const { jobId } = useParams();
  const isEditMode = !!jobId;
  const loginId = localStorage.getItem("loginId") || "";
  const { checkJobLimit, usage } = usePlanLimit();
  const [limitDialog, setLimitDialog] = useState(false);

  const [form, setForm] = useState({ title: "", company: "", location: "", jobType: "Full-time", jdText: "", jobStatus: "Fulfilling" });
  const [briefText, setBriefText] = useState("");
  const [briefResult, setBriefResult] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [previewSkills, setPreviewSkills] = useState({ technical: [], soft: [], seniority: null });
  const [manualSkills, setManualSkills] = useState([]);
  const [skillInput, setSkillInput] = useState("");

  function updateForm(key, val) { setForm(p => ({ ...p, [key]: val })); }

  function handleSkillKeyDown(e) {
    if ((e.key === " " || e.key === "Enter") && skillInput.trim()) {
      e.preventDefault();
      const newSkill = skillInput.trim();
      if (!manualSkills.includes(newSkill)) setManualSkills(p => [...p, newSkill]);
      setSkillInput("");
    }
    if (e.key === "Backspace" && !skillInput && manualSkills.length > 0) {
      setManualSkills(p => p.slice(0, -1));
    }
  }

  useEffect(() => {
    if (!isEditMode) return;
    setLoadingJob(true);
    const url = new URL(`${API_BASE}/api/jobs/${jobId}`);
    url.searchParams.set("loginId", loginId);
    fetch(url.toString())
      .then(res => { if (!res.ok) throw new Error("Failed to load job"); return res.json(); })
      .then(job => {
        setForm({
          title: job.title ?? "",
          company: job.company ?? "",
          location: job.location ?? "",
          jobType: job.jobType ?? "Full-time",
          jdText: job.jdText ?? "",
          jobStatus: job.jobStatus ?? "Fulfilling",
        });
        if (job.jdText) setPreviewSkills(extractSkillsFromJd(job.jdText));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingJob(false));
  }, [jobId]);

  async function handleAnalyzeBrief() {
    if (!briefText.trim()) return;
    setBriefLoading(true); setBriefError(null);
    try {
      const res = await fetch(`${API_BASE}/api/jobs/analyze-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefText }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBriefResult(data);
      if (data.generatedJdText) updateForm("jdText", data.generatedJdText);
      if (data.company)  updateForm("company",  data.company);
      if (data.location) updateForm("location", data.location);
      setPreviewSkills({
        technical: data.extractedSkills ?? [],
        soft: data.softSkills ?? [],
        seniority: data.seniorityLevel ?? null,
      });
    } catch (e) {
      setBriefError(e.message);
    } finally {
      setBriefLoading(false);
    }
  }

  async function handleSave() {
    // Plan limit check — only on create, not edit
    if (!isEditMode && !checkJobLimit()) { setLimitDialog(true); return; }
    if (!form.title || !form.jdText) { setError("Job title and description are required."); return; }
    setSaving(true); setError(null);
    try {
      if (isEditMode) {
        const url = new URL(`${API_BASE}/api/jobs/${jobId}`);
        url.searchParams.set("loginId", loginId);
        const res = await fetch(url.toString(), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            seniority: briefResult?.seniorityLevel || null,
            stackTags: [...new Set([...(briefResult?.extractedSkills || []), ...manualSkills])],
          }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else {
        const url = new URL(`${API_BASE}/api/jobs`);
        url.searchParams.set("loginId", loginId);
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            seniority: briefResult?.seniorityLevel || null,
            stackTags: [...new Set([...(briefResult?.extractedSkills || []), ...manualSkills])],
          }),
        });
        if (!res.ok) throw new Error(await res.text());
      }
      nav("/jobs");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
            {isEditMode ? "Edit Job" : "Create New Job"}
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            {isEditMode ? "Update job details and description" : "Paste JD or client brief to create a vacancy"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => nav("/jobs")}
            sx={{ fontSize: 11, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" size="small" onClick={handleSave} disabled={saving || loadingJob}
            sx={{
              fontSize: 11, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" }
            }}>
            {saving
              ? <CircularProgress size={14} sx={{ color: "#fff" }} />
              : isEditMode ? "Save Changes" : "Save Job"}
          </Button>
        </Box>
      </Box>

      <StepBar step={1} />
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loadingJob && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 2 }}>
          <CircularProgress size={16} />
          <Typography sx={{ fontSize: 12, color: MUTED }}>Loading job details…</Typography>
        </Box>
      )}

      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: 1.3, display: "flex", flexDirection: "column", gap: 2 }}>

          {/* Job Details */}
          <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
            <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Job Details</Typography>
            </Box>
            <Box sx={{ p: 2.25 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.75, mb: 1.75 }}>
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>
                    Job Title <Box component="span" sx={{ color: DANGER }}>*</Box>
                  </Typography>
                  <TextField fullWidth size="small" value={form.title}
                    onChange={e => updateForm("title", e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Client / Company</Typography>
                  <TextField fullWidth size="small" value={form.company}
                    onChange={e => updateForm("company", e.target.value)}
                    placeholder="e.g. FinTech Co."
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }} />
                </Box>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.75 }}>
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Location</Typography>
                  <TextField fullWidth size="small" value={form.location}
                    onChange={e => updateForm("location", e.target.value)}
                    placeholder="e.g. London / Remote"
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Employment Type</Typography>
                  <TextField select fullWidth size="small" value={form.jobType}
                    onChange={e => updateForm("jobType", e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }}>
                    {["Full-time", "Contract", "Part-time"].map(o =>
                      <MenuItem key={o} value={o} sx={{ fontSize: 12 }}>{o}</MenuItem>)}
                  </TextField>
                </Box>
              </Box>

              {/* Change 3: Job Status dropdown — only visible in edit mode */}
              {isEditMode && (
                <Box sx={{ mt: 1.75 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>
                    Job Status
                  </Typography>
                  <TextField select fullWidth size="small" value={form.jobStatus}
                    onChange={e => updateForm("jobStatus", e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }}>
                    {["Fulfilling", "Complete"].map(o =>
                      <MenuItem key={o} value={o} sx={{ fontSize: 12 }}>{o}</MenuItem>)}
                  </TextField>
                </Box>
              )}
            </Box>
          </Paper>

          {/* AI Client Brief Analyzer */}
          <Paper elevation={0} sx={{
            border: `1px solid ${PURPLE_BR}`, borderRadius: "10px",
            overflow: "hidden", bgcolor: "#fff", boxShadow: `0 0 0 2px rgba(124,58,237,0.06)`
          }}>
            <Box sx={{
              px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: 15 }}>✦</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>AI Client Brief Analyzer</Typography>
                <NewTag />
              </Box>
              <Box sx={{ fontSize: 10, color: MUTED, fontStyle: "italic" }}>POST /api/jobs/analyze-brief</Box>
            </Box>
            <Box sx={{ p: 2.25 }}>
              <Typography sx={{ fontSize: 12, color: MUTED, mb: 1.25, lineHeight: 1.6 }}>
                Paste raw client notes, emails, or an unstructured brief. AI will extract a structured Job Description, required skills, and seniority level automatically.
              </Typography>
              <TextField multiline rows={5} fullWidth value={briefText}
                onChange={e => setBriefText(e.target.value)}
                placeholder="e.g. 'We need someone senior in Java, ideally fintech background, team lead experience, working closely with our CTO, startup culture, fast paced, Series B…'"
                sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12, fontFamily: "monospace" } }} />
              <Button variant="contained" fullWidth onClick={handleAnalyzeBrief}
                disabled={briefLoading || !briefText.trim()}
                sx={{
                  fontSize: 12, fontWeight: 600, bgcolor: PURPLE, borderRadius: "8px",
                  textTransform: "none", boxShadow: "none", mb: 1.5,
                  "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" }
                }}>
                {briefLoading
                  ? <><CircularProgress size={14} sx={{ color: "#fff", mr: 1 }} /> Generating…</>
                  : "✦ Generate Job Description & Skills"}
              </Button>
              {briefError && <Alert severity="error" sx={{ mt: 1, mb: 1 }}>{briefError}</Alert>}
              <Box sx={{ bgcolor: "#F8F7FF", border: `1px solid ${PURPLE_BR}`, borderRadius: "8px", p: 1.75 }}>
                <Typography sx={{
                  fontSize: 10, fontWeight: 700, color: PURPLE,
                  textTransform: "uppercase", letterSpacing: ".5px", mb: 1.25
                }}>
                  ✦ AI Analysis Output — will populate below fields
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, mb: 1.25 }}>
                  {[
                    { label: "Seniority Level", value: briefResult?.seniorityLevel },
                    { label: "Role Type", value: briefResult?.roleType },
                    { label: "Industry", value: briefResult?.industry },
                  ].map(item => (
                    <Box key={item.label} sx={{
                      bgcolor: "#fff", border: `1px solid ${BORDER}`,
                      borderRadius: "6px", p: "8px 10px"
                    }}>
                      <Typography sx={{
                        fontSize: 10, color: MUTED, fontWeight: 600,
                        textTransform: "uppercase", mb: 0.5
                      }}>{item.label}</Typography>
                      {item.value ? (
                        <Box sx={{
                          display: "inline-flex", alignItems: "center", px: 1.25, py: 0.25,
                          bgcolor: ACCENT_BG, border: `1px solid ${ACCENT_BR}`,
                          borderRadius: "20px", fontSize: 11, fontWeight: 600, color: ACCENT
                        }}>
                          {item.value}
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: 11, color: MUTED }}>—</Typography>
                      )}
                    </Box>
                  ))}
                </Box>
                <Typography sx={{
                  fontSize: 11, color: MUTED, fontWeight: 600,
                  textTransform: "uppercase", letterSpacing: ".4px", mb: 0.75
                }}>
                  Extracted Skills Preview
                </Typography>
                <Box sx={{ mb: 1 }}>
                  {briefResult
                    ? <>
                        {(briefResult.extractedSkills || []).map(s => <Tag key={s} label={s} variant="match" />)}
                        {(briefResult.softSkills || []).map(s => <Tag key={s} label={s} />)}
                      </>
                    : <Typography sx={{ fontSize: 11, color: MUTED, fontStyle: "italic" }}>
                        Skills will appear here after generation
                      </Typography>
                  }
                </Box>
                <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>
                  ↓ Click "Generate" to auto-fill the Job Description field below
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* ── Job Description card ─────────────────────────────────────────── */}
          <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>

            {/* Card header */}
            <Box sx={{
              px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                Job Description (JD) <Box component="span" sx={{ color: DANGER }}>*</Box>
              </Typography>
              <Typography sx={{ fontSize: 10, color: MUTED, fontStyle: "italic" }}>
                Auto-filled by AI Brief Analyzer above, or paste manually
              </Typography>
            </Box>

            {/* Card body — ALL content inside one padding box */}
            <Box sx={{ p: 2.25 }}>

              {/* 1. JD textarea */}
              <TextField multiline rows={11} fullWidth value={form.jdText}
                onChange={e => updateForm("jdText", e.target.value)}
                placeholder="AI will populate this from your client brief above, or paste manually…"
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12, fontFamily: "monospace" } }} />

              {/* 2. Annotation + Preview button row */}
              <Box sx={{ mt: 1.25, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: 11, color: MUTED, fontStyle: "italic" }}>
                  POST /api/jobs — Spring Boot REST
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    if (!form.jdText.trim()) return;
                    setPreviewSkills(extractSkillsFromJd(form.jdText));
                  }}
                  sx={{
                    fontSize: 11, fontWeight: 500, borderColor: BORDER, color: TEXT,
                    borderRadius: "6px", textTransform: "none",
                    "&:hover": { borderColor: ACCENT, color: ACCENT }
                  }}>
                  🔍 Preview Extracted Skills
                </Button>
              </Box>

              {/* 3. Add Skills section — full width, below the button row */}
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${BORDER}` }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 1 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>
                    Add Skills
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: MUTED }}>
                    Type a skill and press Space to add it
                  </Typography>
                </Box>

                {/* Tag input */}
                <Box
                  onClick={() => document.getElementById("skill-input").focus()}
                  sx={{
                    display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center",
                    border: `1px solid ${BORDER}`, borderRadius: "8px",
                    p: "8px 10px", minHeight: 44, bgcolor: SURFACE, cursor: "text",
                    transition: "border-color .15s, box-shadow .15s",
                    "&:focus-within": {
                      borderColor: ACCENT,
                      boxShadow: `0 0 0 3px rgba(29,114,232,0.08)`,
                    },
                  }}>
                  {manualSkills.map(s => (
                    <Box key={s} sx={{
                      display: "inline-flex", alignItems: "center", gap: 0.5,
                      px: "8px", py: "3px",
                      bgcolor: ACCENT_BG, border: `1px solid ${ACCENT_BR}`,
                      borderRadius: "4px", fontSize: 11, fontWeight: 500, color: ACCENT,
                    }}>
                      {s}
                      <Box
                        onClick={e => { e.stopPropagation(); setManualSkills(p => p.filter(x => x !== s)); }}
                        sx={{ cursor: "pointer", fontSize: 13, lineHeight: 1, opacity: 0.5, "&:hover": { opacity: 1 } }}>
                        ×
                      </Box>
                    </Box>
                  ))}
                  <Box
                    id="skill-input"
                    component="input"
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    placeholder={manualSkills.length === 0 ? "e.g. Kafka   Docker   FinTech…" : ""}
                    sx={{
                      border: "none", outline: "none", background: "transparent",
                      fontSize: 12, color: TEXT, fontFamily: "inherit",
                      minWidth: 160, flex: 1, p: "2px 4px",
                      "&::placeholder": { color: MUTED },
                    }}
                  />
                </Box>

                {manualSkills.length > 0 && (
                  <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.75 }}>
                    {manualSkills.length} skill{manualSkills.length !== 1 ? "s" : ""} added
                  </Typography>
                )}
              </Box>

            </Box>{/* end card body */}
          </Paper>

        </Box>

        {/* Right panel */}
        <Box sx={{ flex: "0 0 220px", display: "flex", flexDirection: "column", gap: 2 }}>

          <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
            <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                {isEditMode ? "After saving changes:" : "After saving you can:"}
              </Typography>
            </Box>
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 0.75 }}>
              {["✓ Add candidates to this job", "✓ Run CV vs JD analysis", "✓ Review validation questions"]
                .map(l => <Typography key={l} sx={{ fontSize: 12, color: MUTED }}>{l}</Typography>)}
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
            <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Extracted Skills Preview</Typography>
            </Box>
            <Box sx={{ p: 2 }}>
              <Typography sx={{
                fontSize: 10, color: MUTED, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75
              }}>Technical</Typography>
              <Box sx={{ mb: 1.25 }}>
                {previewSkills.technical.length > 0
                  ? previewSkills.technical.map(s => <Tag key={s} label={s} />)
                  : <Typography sx={{ fontSize: 11, color: MUTED, fontStyle: "italic" }}>—</Typography>}
              </Box>

              <Box sx={{ height: 1, bgcolor: BORDER, my: 1 }} />

              <Typography sx={{
                fontSize: 10, color: MUTED, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75
              }}>Soft Skills</Typography>
              <Box sx={{ mb: 1.25 }}>
                {previewSkills.soft.length > 0
                  ? previewSkills.soft.map(s => <Tag key={s} label={s} />)
                  : <Typography sx={{ fontSize: 11, color: MUTED, fontStyle: "italic" }}>—</Typography>}
              </Box>

              <Box sx={{ height: 1, bgcolor: BORDER, my: 1 }} />

              <Typography sx={{
                fontSize: 10, color: MUTED, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75
              }}>Seniority Signal</Typography>
              {previewSkills.seniority ? (
                <Box sx={{
                  display: "inline-flex", alignItems: "center", px: 1.25, py: 0.25,
                  bgcolor: ACCENT_BG, border: `1px solid ${ACCENT_BR}`,
                  borderRadius: "20px", fontSize: 11, fontWeight: 600, color: ACCENT
                }}>
                  {previewSkills.seniority}
                </Box>
              ) : (
                <Typography sx={{ fontSize: 11, color: MUTED, fontStyle: "italic" }}>—</Typography>
              )}
            </Box>
          </Paper>

        </Box>
      </Box>
    </Box>

    {/* Plan limit dialog */}
    <Dialog open={limitDialog} onClose={() => setLimitDialog(false)} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: "12px" } }}>
      <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: TEXT, pb: 1 }}>
        Job Limit Reached
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
          You have used all <strong>{usage?.currentJobs ?? 0} / {usage?.maxJobs ?? 0}</strong> job
          slots on your <strong>{usage?.planName ?? "Free"}</strong> plan.
        </Typography>
        <Typography sx={{ fontSize: 13, color: MUTED, mt: 1, lineHeight: 1.6 }}>
          To create more jobs, please upgrade your plan or remove an existing job.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="outlined" size="small" onClick={() => setLimitDialog(false)}
          sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
          Cancel
        </Button>
        <Button variant="contained" size="small" onClick={() => setLimitDialog(false)}
          sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none",
            boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
          Upgrade Plan
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
