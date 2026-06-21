import { useState } from "react";
import {
  Box, Paper, Typography, Button, TextField, Alert,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, MenuItem,
} from "@mui/material";
import { useNavigate, useParams, useLocation } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Color tokens matching DashboardPage.jsx
const SURFACE    = "#FFFFFF";
const BORDER     = "#E8ECF2";
const MUTED      = "#9AA3B4";
const TEXT       = "#0F1623";
const ACCENT     = "#1D72E8";
const SUCCESS    = "#16A34A";
const SUCCESS_L  = "#F0FDF4";
const DANGER     = "#DC2626";
const ACCENT_L   = "#EFF6FF";
const PURPLE     = "#7C3AED";
const PURPLE_L   = "#F5F3FF";
const PURPLE_BR  = "#C4B5FD";

// ── Upload arrow SVG ───────────────────────────────────────────────────────
function UploadArrow({ color, size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

// ── Search icon SVG ────────────────────────────────────────────────────────
function SearchIcon({ color = "#fff", size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Field label ────────────────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────
export default function AddCandidatesModernPage() {
  const nav       = useNavigate();
  const { jobId } = useParams();
  const location  = useLocation();
  const jobTitle  = location.state?.jobTitle || location.state?.job?.title || "";
  const loginId   = localStorage.getItem("loginId") || "";

  const [bulkMode, setBulkMode] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // ── Single upload state ─────────────────────────────────────────────────
  const [cvFile,       setCvFile]       = useState(null);
  const [cvParsed,     setCvParsed]     = useState(false);
  const [parseLoading, setParseLoading] = useState(false);
  const [singleError,  setSingleError]  = useState(null);
  const [singleSuccess, setSingleSuccess] = useState(false);
  const [savingCandidate, setSavingCandidate] = useState(false);
  const [candidateForm, setCandidateForm] = useState({
    name: "", email: "", phone: "", linkedinUrl: "",
    currentTitle: "", location: "", state: "", cvText: "", skills: [],
    yearsExperience: "", seniorityLevel: "",
    expectedSalaryMin: "", expectedSalaryMax: "",
    noticePeriodWeeks: "", workRights: "", remoteFlexible: false,
  });

  // ── Bulk upload state ───────────────────────────────────────────────────
  const [bulkFiles,    setBulkFiles]    = useState([]);
  const [bulkRunning,  setBulkRunning]  = useState(false);
  const [bulkError,    setBulkError]    = useState(null);
  const [analysisDialog, setAnalysisDialog] = useState(false);
  const [savedCandidate,        setSavedCandidate]        = useState(null);
  const [singleAnalysisRunning, setSingleAnalysisRunning] = useState(false);

  // ── Single: parse CV ────────────────────────────────────────────────────
  async function handleSingleUpload(file) {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    if (!allowed.includes(file.type)) {
      setSingleError("Only PDF and Word (.docx / .doc) files are supported.");
      return;
    }
    setCvFile(file.name);
    setCvParsed(false);
    setParseLoading(true);
    setSingleError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const url = new URL(`${API_BASE}/api/cv/extract`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: formData,
      });
      if (res.status === 402) throw new Error("Token limit reached. Please upgrade your plan.");
      if (!res.ok) throw new Error("Could not parse CV. Please try a different file.");
      const data = await res.json();
      setCandidateForm(p => ({
        ...p,
        name:        data.name        || p.name,
        email:       data.email       || p.email,
        linkedinUrl: data.linkedinUrl || p.linkedinUrl,
        cvText:      data.text        || p.cvText,
        skills:      Array.isArray(data.skills) && data.skills.length > 0 ? data.skills : p.skills,
      }));
      setCvParsed(true);
    } catch (e) {
      setSingleError(e.message);
      setCvFile(null);
    } finally {
      setParseLoading(false);
    }
  }

  const emptyCandidateForm = {
    name: "", email: "", phone: "", linkedinUrl: "", currentTitle: "", location: "", state: "", cvText: "", skills: [],
    yearsExperience: "", seniorityLevel: "",
    expectedSalaryMin: "", expectedSalaryMax: "",
    noticePeriodWeeks: "", workRights: "", remoteFlexible: false,
  };

  function resetSingleForm() {
    setCandidateForm(emptyCandidateForm);
    setCvFile(null);
    setCvParsed(false);
    setSingleError(null);
    setSingleSuccess(false);
    setSavedCandidate(null);
  }

  async function handleSaveCandidate() {
    if (!candidateForm.name.trim())  { setSingleError("Candidate name is required."); return; }
    if (!candidateForm.email.trim()) { setSingleError("Email is required."); return; }
    setSavingCandidate(true);
    setSingleError(null);
    try {
      const url = new URL(`${API_BASE}/api/jobs/${jobId}/candidates`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify({
          name:        candidateForm.name,
          email:       candidateForm.email,
          phone:       candidateForm.phone,
          linkedinUrl: candidateForm.linkedinUrl,
          cvText:      candidateForm.cvText,
          skills:      candidateForm.skills,
          currentTitle:       candidateForm.currentTitle || null,
          location:           candidateForm.location || null,
          state:              candidateForm.state || null,
          yearsExperience:    candidateForm.yearsExperience === "" ? null : Number(candidateForm.yearsExperience),
          seniorityLevel:     candidateForm.seniorityLevel || null,
          expectedSalaryMin:  candidateForm.expectedSalaryMin === "" ? null : Number(candidateForm.expectedSalaryMin),
          expectedSalaryMax:  candidateForm.expectedSalaryMax === "" ? null : Number(candidateForm.expectedSalaryMax),
          noticePeriodWeeks:  candidateForm.noticePeriodWeeks === "" ? null : Number(candidateForm.noticePeriodWeeks),
          workRights:         candidateForm.workRights || null,
          remoteFlexible:     candidateForm.remoteFlexible,
        }),
      });
      if (res.status === 409) throw new Error("This candidate is already in the pipeline for this job.");
      if (res.status === 402) throw new Error("Candidate limit reached. Please upgrade your plan.");
      if (!res.ok) throw new Error(await res.text());
      const candidate = await res.json();
      setSavedCandidate({ id: candidate.id, name: candidateForm.name });
      setSingleSuccess(true);
      // Reset form fields so user can add another, but keep success banner visible
      setCandidateForm(emptyCandidateForm);
      setCvFile(null);
      setCvParsed(false);
    } catch (e) {
      setSingleError(e.message);
    } finally {
      setSavingCandidate(false);
    }
  }

  async function handleSingleRunAnalysis() {
    if (!savedCandidate) return;
    setSingleAnalysisRunning(true);
    try {
      const cu = new URL(`${API_BASE}/api/coworker/confirm`);
      cu.searchParams.set("loginId", loginId);
      await fetch(cu.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify({
          actionType: "RUN_ANALYSIS",
          params: { candidateIds: [savedCandidate.id], candidateNames: [savedCandidate.name] },
        }),
      });
    } catch { /* still show dialog */ }
    setSingleAnalysisRunning(false);
    setAnalysisDialog(true);
  }

  // ── Bulk ────────────────────────────────────────────────────────────────
  function handleBulkFileSelect(files) {
    const arr = Array.from(files).map(f => ({
      file: f, name: f.name, size: f.size,
      status: "pending", candidateId: null, error: null,
    }));
    setBulkFiles(prev => [...prev, ...arr]);
  }

  function removeBulkFile(idx) {
    setBulkFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleRunAnalysis() {
    const pending = bulkFiles.filter(b => b.status === "pending");
    if (pending.length === 0) return;
    setBulkRunning(true);
    setBulkError(null);
    const files = [...bulkFiles];
    const saved  = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;
      files[i] = { ...files[i], status: "uploading" };
      setBulkFiles([...files]);
      try {
        const fd = new FormData();
        fd.append("file", files[i].file);
        const extractUrl = new URL(`${API_BASE}/api/cv/extract`);
        extractUrl.searchParams.set("loginId", loginId);
        const er = await fetch(extractUrl.toString(), {
          method: "POST",
          headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
          body: fd,
        });
        if (!er.ok) throw new Error("CV parse failed");
        const cv = await er.json();
        const saveUrl = new URL(`${API_BASE}/api/jobs/${jobId}/candidates`);
        saveUrl.searchParams.set("loginId", loginId);
        const sr = await fetch(saveUrl.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}`,
          },
          body: JSON.stringify({
            name:        cv.name        || files[i].file.name.replace(/\.[^.]+$/, ""),
            email:       cv.email       || "",
            linkedinUrl: cv.linkedinUrl || "",
            cvText:      cv.text        || "",
            skills:      Array.isArray(cv.skills) ? cv.skills : [],
          }),
        });
        if (sr.status === 409) throw new Error("Already in pipeline");
        if (!sr.ok) throw new Error(await sr.text() || "Save failed");
        const candidate   = await sr.json();
        const displayName = cv.name || files[i].file.name.replace(/\.[^.]+$/, "");
        files[i] = { ...files[i], status: "done", candidateId: candidate.id, name: displayName };
        saved.push({ id: candidate.id, name: displayName });
      } catch (e) {
        files[i] = { ...files[i], status: "error", error: e.message };
      }
      setBulkFiles([...files]);
    }
    if (saved.length > 0) {
      try {
        const cu = new URL(`${API_BASE}/api/coworker/confirm`);
        cu.searchParams.set("loginId", loginId);
        await fetch(cu.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}`,
          },
          body: JSON.stringify({
            actionType: "RUN_ANALYSIS",
            params: { candidateIds: saved.map(c => c.id), candidateNames: saved.map(c => c.name) },
          }),
        });
      } catch { /* still show dialog */ }
      setAnalysisDialog(true);
    }
    setBulkRunning(false);
  }

  // ── Drag-and-drop handlers ──────────────────────────────────────────────
  function onDragOver(e)  { e.preventDefault(); setIsDragOver(true);  }
  function onDragLeave()  { setIsDragOver(false); }
  function onDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    if (bulkMode) handleBulkFileSelect(files);
    else handleSingleUpload(files[0]);
  }

  const hasPendingFiles = bulkFiles.some(b => b.status === "pending");

  // ── Upload zone content ─────────────────────────────────────────────────
  function UploadZoneContent() {
    if (parseLoading) {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
          <CircularProgress size={32} sx={{ color: ACCENT }} />
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Extracting CV…</Typography>
        </Box>
      );
    }
    if (cvParsed && !bulkMode) {
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography sx={{ fontSize: 20 }}>✅</Typography>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: SUCCESS }}>{cvFile}</Typography>
            <Typography sx={{ fontSize: 12, color: MUTED }}>Extracted — edit details below</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Box onClick={e => { e.preventDefault(); resetSingleForm(); }}
            sx={{ fontSize: 12, color: DANGER, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
            Remove
          </Box>
        </Box>
      );
    }
    return (
      <>
        <Box sx={{
          width: 64, height: 64, borderRadius: "50%", bgcolor: ACCENT_L,
          display: "flex", alignItems: "center", justifyContent: "center", mb: 0.5,
        }}>
          <UploadArrow color={ACCENT} size={28} />
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT }}>
          {bulkMode ? "Upload CVs" : "Upload CV"}
        </Typography>
        <Typography sx={{ fontSize: 14, color: MUTED }}>
          Drag and drop or click to browse (.pdf, .doc, .docx)
        </Typography>
      </>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 900, mx: "auto", display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Page header ────────────────────────────────────────────────── */}
      <Box sx={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", mb: 3.5,
      }}>
        <Box>
          <Typography sx={{ fontSize: 28, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>
            Your new job got created!
          </Typography>
          <Typography sx={{ fontSize: 15, color: MUTED, mt: 0.75 }}>
            Now let's add candidates
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => nav("/candidates/new", { state: { prefill: { jobId } } })}
          sx={{
            borderRadius: "50px", fontSize: 13, fontWeight: 500,
            borderColor: "#DDE3EE", color: TEXT, textTransform: "none",
            px: 2.5, py: 0.75, flexShrink: 0, mt: 0.5,
            "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" },
          }}
        >
          Switch to Classic View
        </Button>
      </Box>

      {/* ── Main card ──────────────────────────────────────────────────── */}
      <Paper elevation={0} sx={{
        bgcolor: SURFACE, border: `1px solid ${BORDER}`,
        borderRadius: "20px",
        boxShadow: "0 4px 24px rgba(15,22,35,0.07)",
        p: "36px 40px",
      }}>

        {/* Card header: title + bulk toggle */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT }}>
            Add CV to Populate Candidate Details
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 14, color: TEXT, fontWeight: 500 }}>Bulk Upload</Typography>
            <Switch
              checked={bulkMode}
              onChange={e => {
                setBulkMode(e.target.checked);
                resetSingleForm();
                setBulkFiles([]);
                setSingleError(null);
                setBulkError(null);
              }}
              sx={{
                "& .MuiSwitch-switchBase.Mui-checked": { color: "#fff" },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: ACCENT, opacity: 1 },
                "& .MuiSwitch-track": { bgcolor: "#C8D0DE", opacity: "1 !important" },
              }}
            />
          </Box>
        </Box>

        {/* Alerts */}
        {singleSuccess && savedCandidate && (
          <Box sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            p: "14px 18px", borderRadius: "12px",
            bgcolor: SUCCESS_L, border: "1px solid #BBF7D0", mb: 2.5,
            flexWrap: "wrap", gap: 1.5,
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Typography sx={{ fontSize: 18, lineHeight: 1 }}>✅</Typography>
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: SUCCESS }}>
                  {savedCandidate.name} added successfully
                </Typography>
                <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>
                  Ready to run AI analysis on this candidate
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Button size="small" onClick={resetSingleForm}
                sx={{
                  fontSize: 12, color: MUTED, textTransform: "none",
                  borderRadius: "20px", px: 1.5,
                  "&:hover": { bgcolor: "#E9F4E9", color: TEXT },
                }}>
                Add Another
              </Button>
              <Button size="small" variant="contained"
                onClick={handleSingleRunAnalysis}
                disabled={singleAnalysisRunning}
                sx={{
                  fontSize: 12, fontWeight: 600, bgcolor: PURPLE,
                  borderRadius: "20px", textTransform: "none",
                  boxShadow: "none", px: 2,
                  "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" },
                  "&.Mui-disabled": { bgcolor: "#E8ECF2", color: MUTED },
                }}>
                {singleAnalysisRunning
                  ? <><CircularProgress size={12} sx={{ color: "#fff", mr: 0.75 }} />Running…</>
                  : "Run Analysis"}
              </Button>
            </Box>
          </Box>
        )}
        {(singleError || bulkError) && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: "10px" }}
            onClose={() => { setSingleError(null); setBulkError(null); }}>
            {singleError || bulkError}
          </Alert>
        )}

        {/* ── Upload drop zone ── */}
        <Box
          component="label"
          htmlFor={bulkMode ? "bulk-cv-input" : "single-cv-input"}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          sx={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 1.25, cursor: "pointer",
            border: `2px dashed ${isDragOver ? ACCENT : "#C8D4E4"}`,
            borderRadius: "16px",
            p: cvParsed && !bulkMode ? "18px 24px" : "52px 24px",
            bgcolor: isDragOver ? ACCENT_L : "#FAFBFD",
            transition: "all .2s",
            "&:hover": { borderColor: ACCENT, bgcolor: ACCENT_L },
          }}
        >
          <UploadZoneContent />
          {/* Hidden file inputs */}
          <Box
            id="single-cv-input"
            component="input" type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleSingleUpload(f); e.target.value = ""; }}
            sx={{ display: "none" }}
          />
          <Box
            id="bulk-cv-input"
            component="input" type="file" multiple
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={e => { handleBulkFileSelect(e.target.files); e.target.value = ""; }}
            sx={{ display: "none" }}
          />
        </Box>

        {/* ── Single: populated form ── */}
        {!bulkMode && cvParsed && (
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
              <Box>
                <FieldLabel required>Name</FieldLabel>
                <TextField fullWidth size="small" value={candidateForm.name}
                  onChange={e => setCandidateForm(p => ({ ...p, name: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel required>Email</FieldLabel>
                <TextField fullWidth size="small" type="email" value={candidateForm.email}
                  onChange={e => setCandidateForm(p => ({ ...p, email: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel>Phone</FieldLabel>
                <TextField fullWidth size="small" value={candidateForm.phone}
                  onChange={e => setCandidateForm(p => ({ ...p, phone: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel>LinkedIn URL</FieldLabel>
                <TextField fullWidth size="small" type="url" value={candidateForm.linkedinUrl}
                  onChange={e => setCandidateForm(p => ({ ...p, linkedinUrl: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel>Current Title</FieldLabel>
                <TextField fullWidth size="small" value={candidateForm.currentTitle}
                  onChange={e => setCandidateForm(p => ({ ...p, currentTitle: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel>Location</FieldLabel>
                <TextField fullWidth size="small" value={candidateForm.location}
                  onChange={e => setCandidateForm(p => ({ ...p, location: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel>State</FieldLabel>
                <TextField fullWidth size="small" placeholder="e.g. VIC" value={candidateForm.state}
                  onChange={e => setCandidateForm(p => ({ ...p, state: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel>Years of Experience</FieldLabel>
                <TextField fullWidth size="small" type="number" value={candidateForm.yearsExperience}
                  onChange={e => setCandidateForm(p => ({ ...p, yearsExperience: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel>Seniority Level</FieldLabel>
                <TextField select fullWidth size="small" value={candidateForm.seniorityLevel}
                  onChange={e => setCandidateForm(p => ({ ...p, seniorityLevel: e.target.value }))} sx={fieldSx}>
                  <MenuItem value="" sx={{ fontSize: 13, color: MUTED }}>— Not Set —</MenuItem>
                  {["Junior", "Mid", "Mid-Senior", "Senior", "Lead/Principal"].map(s => (
                    <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s}</MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box>
                <FieldLabel>Expected Salary Min</FieldLabel>
                <TextField fullWidth size="small" type="number" value={candidateForm.expectedSalaryMin}
                  onChange={e => setCandidateForm(p => ({ ...p, expectedSalaryMin: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel>Expected Salary Max</FieldLabel>
                <TextField fullWidth size="small" type="number" value={candidateForm.expectedSalaryMax}
                  onChange={e => setCandidateForm(p => ({ ...p, expectedSalaryMax: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel>Notice Period (weeks)</FieldLabel>
                <TextField fullWidth size="small" type="number" value={candidateForm.noticePeriodWeeks}
                  onChange={e => setCandidateForm(p => ({ ...p, noticePeriodWeeks: e.target.value }))} sx={fieldSx} />
              </Box>
              <Box>
                <FieldLabel>Work Rights</FieldLabel>
                <TextField select fullWidth size="small" value={candidateForm.workRights}
                  onChange={e => setCandidateForm(p => ({ ...p, workRights: e.target.value }))} sx={fieldSx}>
                  <MenuItem value="" sx={{ fontSize: 13, color: MUTED }}>— Not Set —</MenuItem>
                  {["Citizen", "Permanent Resident", "Visa (sponsorship required)"].map(w => (
                    <MenuItem key={w} value={w} sx={{ fontSize: 13 }}>{w}</MenuItem>
                  ))}
                </TextField>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <FieldLabel>Open to Hybrid / Remote</FieldLabel>
                <Switch checked={candidateForm.remoteFlexible}
                  onChange={e => setCandidateForm(p => ({ ...p, remoteFlexible: e.target.checked }))}
                  sx={{
                    "& .MuiSwitch-switchBase.Mui-checked": { color: "#fff" },
                    "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: ACCENT, opacity: 1 },
                    "& .MuiSwitch-track": { bgcolor: "#C8D0DE", opacity: "1 !important" },
                  }} />
              </Box>
            </Box>
            <Box>
              <FieldLabel>CV Text</FieldLabel>
              <TextField fullWidth multiline rows={5} value={candidateForm.cvText}
                InputProps={{ readOnly: true }}
                sx={{
                  ...fieldSx,
                  "& .MuiOutlinedInput-root": {
                    ...fieldSx["& .MuiOutlinedInput-root"],
                    fontSize: 12, fontFamily: "monospace",
                  },
                }}
              />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2.5 }}>
              <Button variant="contained" onClick={handleSaveCandidate} disabled={savingCandidate}
                sx={{
                  bgcolor: ACCENT, borderRadius: "50px", fontSize: 14, fontWeight: 600,
                  textTransform: "none", boxShadow: "none", px: 4, py: 1.1,
                  "&:hover": { bgcolor: "#1660CC", boxShadow: "0 4px 14px rgba(29,114,232,0.25)" },
                }}>
                {savingCandidate
                  ? <><CircularProgress size={15} sx={{ color: "#fff", mr: 1 }} />Saving…</>
                  : "Save Candidate"}
              </Button>
            </Box>
          </Box>
        )}

        {/* ── Bulk: file list + run button ── */}
        {bulkMode && bulkFiles.length > 0 && (
          <Box sx={{ mt: 2.5 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
              {bulkFiles.map((bf, i) => (
                <Box key={i} sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  p: "10px 16px", border: `1px solid ${BORDER}`, borderRadius: "10px",
                  bgcolor: bf.status === "done"  ? SUCCESS_L
                         : bf.status === "error" ? "#FEF2F2"
                         : SURFACE,
                }}>
                  <Typography sx={{
                    fontSize: 15, flexShrink: 0, lineHeight: 1, fontWeight: 700,
                    color: bf.status === "done"  ? SUCCESS
                         : bf.status === "error" ? DANGER
                         : MUTED,
                  }}>
                    {bf.status === "uploading" ? "⏳"
                      : bf.status === "done"   ? "✓"
                      : bf.status === "error"  ? "✗"
                      : "📄"}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: 13, fontWeight: 600, color: TEXT,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {bf.name}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: MUTED }}>
                      {bf.status === "uploading" ? "Uploading…"
                        : bf.status === "done"   ? "Added to pipeline ✓"
                        : bf.status === "error"  ? bf.error
                        : formatFileSize(bf.size)}
                    </Typography>
                  </Box>
                  {bf.status === "pending" && (
                    <Box onClick={() => removeBulkFile(i)}
                      sx={{ fontSize: 18, color: MUTED, cursor: "pointer", "&:hover": { color: DANGER }, flexShrink: 0 }}>
                      ×
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="contained" onClick={handleRunAnalysis}
                disabled={bulkRunning || !hasPendingFiles}
                sx={{
                  bgcolor: PURPLE, borderRadius: "50px", fontSize: 14, fontWeight: 600,
                  textTransform: "none", boxShadow: "none", px: 4, py: 1.1,
                  "&:hover": { bgcolor: "#6D28D9", boxShadow: "0 4px 14px rgba(124,58,237,0.28)" },
                  "&.Mui-disabled": { bgcolor: "#E8ECF2", color: MUTED },
                }}>
                {bulkRunning
                  ? <><CircularProgress size={15} sx={{ color: "#fff", mr: 1 }} />Running…</>
                  : "Run Analysis"}
              </Button>
            </Box>
          </Box>
        )}

        {/* ── OR divider ── */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, my: 3 }}>
          <Box sx={{ flex: 1, height: 1, bgcolor: BORDER }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: MUTED, px: 1 }}>OR</Typography>
          <Box sx={{ flex: 1, height: 1, bgcolor: BORDER }} />
        </Box>

        {/* ── AI Talent Search button ── */}
        <Button
          fullWidth
          onClick={() => nav("/talent-search")}
          sx={{
            borderRadius: "50px", py: 1.75, fontSize: 15, fontWeight: 600,
            textTransform: "none", boxShadow: "0 4px 20px rgba(29,114,232,0.22)",
            bgcolor: ACCENT, color: "#fff", gap: 1.25,
            "&:hover": {
              bgcolor: "#1660CC",
              boxShadow: "0 6px 24px rgba(29,114,232,0.35)",
            },
          }}
        >
          <SearchIcon color="#fff" size={20} />
          Search Candidate from AI Talent Search
        </Button>
      </Paper>

      {/* ── Analysis dialog ── */}
      <Dialog open={analysisDialog} onClose={() => setAnalysisDialog(false)}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 1 }}>
          Analysis Running in Background ✦
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
            Your candidates are being analysed by AI. You can continue working — check
            the Candidates or Jobs page for results.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => setAnalysisDialog(false)}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "20px", textTransform: "none", px: 2 }}>
            Stay Here
          </Button>
          <Button variant="contained" size="small"
            onClick={() => { setAnalysisDialog(false); nav("/dashboard"); }}
            sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "20px", textTransform: "none",
              boxShadow: "none", px: 2, "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            Return to Dashboard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
