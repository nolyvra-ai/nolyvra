import { useState, useEffect } from "react";
import {
  Box, Paper, Typography, Button, TextField, Alert,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Switch, MenuItem,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Color tokens — identical to AddCandidatesModernPage.jsx
const SURFACE   = "#FFFFFF";
const BORDER    = "#E8ECF2";
const MUTED     = "#9AA3B4";
const TEXT      = "#0F1623";
const ACCENT    = "#1D72E8";
const SUCCESS   = "#16A34A";
const SUCCESS_L = "#F0FDF4";
const DANGER    = "#DC2626";
const ACCENT_L  = "#EFF6FF";
const PURPLE    = "#7C3AED";
const PURPLE_L  = "#F5F3FF";
const PURPLE_BR = "#C4B5FD";

const CARD_SX = {
  bgcolor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: "20px",
  boxShadow: "0 4px 24px rgba(15,22,35,0.07)",
  p: "36px 40px",
};

// ── SVGs ──────────────────────────────────────────────────────────────────────
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

function SearchIcon({ color = "#fff", size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function BigCheckIcon() {
  return (
    <Box sx={{
      width: 64, height: 64, borderRadius: "50%",
      bgcolor: SUCCESS_L, border: "2px solid #BBF7D0",
      display: "flex", alignItems: "center", justifyContent: "center",
      mx: "auto", mb: 2.5,
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke={SUCCESS} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </Box>
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

// ── Main component ─────────────────────────────────────────────────────────────
export default function AddCandidateModernPage() {
  const nav     = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  // ── Job assignment ────────────────────────────────────────────────────────
  const [jobs,          setJobs]          = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");

  // ── Mode toggle ───────────────────────────────────────────────────────────
  const [bulkMode,    setBulkMode]    = useState(false);
  const [isDragOver,  setIsDragOver]  = useState(false);

  // ── Single upload state ───────────────────────────────────────────────────
  const [cvFile,          setCvFile]          = useState(null);
  const [cvParsed,        setCvParsed]        = useState(false);
  const [parseLoading,    setParseLoading]    = useState(false);
  const [singleError,     setSingleError]     = useState(null);
  const [savingCandidate, setSavingCandidate] = useState(false);
  const [candidateForm,   setCandidateForm]   = useState({
    name: "", email: "", phone: "", linkedinUrl: "",
    currentTitle: "", location: "", cvText: "",
  });

  // ── Bulk upload state ─────────────────────────────────────────────────────
  const [bulkFiles,   setBulkFiles]   = useState([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkError,   setBulkError]   = useState(null);

  // ── Success state ─────────────────────────────────────────────────────────
  const [successType,      setSuccessType]      = useState(null); // null | "no-job" | "with-job"
  const [savedCandidates,  setSavedCandidates]  = useState([]);   // [{ id, name }]
  const [analysisRunning,  setAnalysisRunning]  = useState(false);
  const [analysisDialog,   setAnalysisDialog]   = useState(false);

  // ── No-job confirmation dialog ────────────────────────────────────────────
  const [noJobDialog,   setNoJobDialog]   = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // "single" | "bulk"

  // ── Load jobs on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const url = new URL(`${API_BASE}/api/jobs`);
    url.searchParams.set("loginId", loginId);
    fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setJobs(data ?? []))
      .catch(() => {});
  }, []);

  const selectedJob = jobs.find(j => String(j.id) === String(selectedJobId));

  // ── Single: parse CV ──────────────────────────────────────────────────────
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
      }));
      setCvParsed(true);
    } catch (e) {
      setSingleError(e.message);
      setCvFile(null);
    } finally {
      setParseLoading(false);
    }
  }

  function resetSingleForm() {
    setCandidateForm({ name: "", email: "", phone: "", linkedinUrl: "", currentTitle: "", location: "", cvText: "" });
    setCvFile(null);
    setCvParsed(false);
    setSingleError(null);
  }

  function resetAll(keepJob = false) {
    setSuccessType(null);
    setSavedCandidates([]);
    setBulkFiles([]);
    setBulkError(null);
    resetSingleForm();
    if (!keepJob) setSelectedJobId("");
  }

  // ── Save single candidate ─────────────────────────────────────────────────
  async function doSaveSingle() {
    setSavingCandidate(true);
    setSingleError(null);
    setNoJobDialog(false);
    try {
      const path = selectedJobId
        ? `/api/jobs/${selectedJobId}/candidates`
        : `/api/candidates`;
      const url = new URL(`${API_BASE}${path}`);
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
          linkedinUrl: candidateForm.linkedinUrl,
          cvText:      candidateForm.cvText,
        }),
      });
      if (res.status === 409) throw new Error("This candidate is already in the pipeline for this job.");
      if (res.status === 402) throw new Error("Candidate limit reached. Please upgrade your plan.");
      if (!res.ok) throw new Error(await res.text());
      const candidate = await res.json();
      setSavedCandidates([{ id: candidate.id, name: candidateForm.name }]);
      setSuccessType(selectedJobId ? "with-job" : "no-job");
      resetSingleForm();
    } catch (e) {
      setSingleError(e.message);
    } finally {
      setSavingCandidate(false);
    }
  }

  function handleSaveCandidate() {
    if (!candidateForm.name.trim())  { setSingleError("Candidate name is required."); return; }
    if (!candidateForm.email.trim()) { setSingleError("Email is required."); return; }
    if (!selectedJobId) {
      setPendingAction("single");
      setNoJobDialog(true);
    } else {
      doSaveSingle();
    }
  }

  // ── Bulk ──────────────────────────────────────────────────────────────────
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

  async function doSaveBulk() {
    setBulkRunning(true);
    setBulkError(null);
    setNoJobDialog(false);
    const files = [...bulkFiles];
    const saved = [];
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
        const path = selectedJobId
          ? `/api/jobs/${selectedJobId}/candidates`
          : `/api/candidates`;
        const saveUrl = new URL(`${API_BASE}${path}`);
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
          }),
        });
        if (sr.status === 409) throw new Error("Already in pipeline");
        if (!sr.ok) throw new Error(await sr.text() || "Save failed");
        const candidate  = await sr.json();
        const displayName = cv.name || files[i].file.name.replace(/\.[^.]+$/, "");
        files[i] = { ...files[i], status: "done", candidateId: candidate.id, name: displayName };
        saved.push({ id: candidate.id, name: displayName });
      } catch (e) {
        files[i] = { ...files[i], status: "error", error: e.message };
      }
      setBulkFiles([...files]);
    }
    setBulkRunning(false);
    if (saved.length > 0) {
      setSavedCandidates(saved);
      setSuccessType(selectedJobId ? "with-job" : "no-job");
    }
  }

  function handleSaveAllCandidates() {
    if (!bulkFiles.some(b => b.status === "pending")) return;
    if (!selectedJobId) {
      setPendingAction("bulk");
      setNoJobDialog(true);
    } else {
      doSaveBulk();
    }
  }

  // ── Run analysis ──────────────────────────────────────────────────────────
  async function handleRunAnalysis() {
    if (!savedCandidates.length) return;
    setAnalysisRunning(true);
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
          params: {
            candidateIds:   savedCandidates.map(c => c.id),
            candidateNames: savedCandidates.map(c => c.name),
          },
        }),
      });
    } catch { /* still show dialog */ }
    setAnalysisRunning(false);
    setAnalysisDialog(true);
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────
  function onDragOver(e) { e.preventDefault(); setIsDragOver(true);  }
  function onDragLeave() { setIsDragOver(false); }
  function onDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    if (bulkMode) handleBulkFileSelect(files);
    else handleSingleUpload(files[0]);
  }

  const hasPendingFiles = bulkFiles.some(b => b.status === "pending");

  // ── Upload zone content ───────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 900, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>

      {/* ── Page header ── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          {/* Breadcrumb */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
            <Typography onClick={() => nav("/candidates")}
              sx={{ fontSize: 14, color: MUTED, cursor: "pointer", "&:hover": { color: TEXT } }}>
              Candidates
            </Typography>
            <Typography sx={{ fontSize: 14, color: MUTED }}>›</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: ACCENT }}>
              Add Candidate
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 15, color: MUTED }}>
            Add a new candidate to your records or assign them directly to a job
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => nav("/candidates/new")}
          sx={{
            borderRadius: "50px", fontSize: 13, fontWeight: 500,
            borderColor: "#DDE3EE", color: TEXT, textTransform: "none",
            px: 2.5, py: 0.75, flexShrink: 0, mt: 0.25,
            "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" },
          }}>
          Switch to Classic View
        </Button>
      </Box>

      {/* ── Section 1: Assign to Job ── */}
      <Paper elevation={0} sx={CARD_SX}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT, mb: 2.5 }}>
          Assign to Job
        </Typography>
        <FieldLabel>Select Job (Optional)</FieldLabel>
        <TextField select fullWidth size="small"
          value={selectedJobId}
          onChange={e => setSelectedJobId(e.target.value)}
          sx={fieldSx}>
          <MenuItem value="" sx={{ fontSize: 14, color: MUTED }}>
            — No Job (Save to Records Only) —
          </MenuItem>
          {jobs.map(job => (
            <MenuItem key={job.id} value={String(job.id)} sx={{ fontSize: 14 }}>
              {job.title}{job.company ? ` — ${job.company}` : ""}
            </MenuItem>
          ))}
        </TextField>
        <Typography sx={{ fontSize: 12, color: MUTED, mt: 1 }}>
          Candidates assigned to a job can be run through AI analysis
        </Typography>
      </Paper>

      {/* ── Section 2/5: Success card OR Add CV card ── */}
      {successType ? (

        /* ── Success card ────────────────────────────────────────────────── */
        <Paper elevation={0} sx={{ ...CARD_SX, textAlign: "center", py: "52px" }}>
          <BigCheckIcon />

          {successType === "no-job" ? (
            <>
              <Typography sx={{ fontSize: 22, fontWeight: 700, color: TEXT, mb: 1 }}>
                Candidate Added Successfully
              </Typography>
              <Typography sx={{ fontSize: 15, color: MUTED, mb: 4, maxWidth: 480, mx: "auto", lineHeight: 1.7 }}>
                Your candidate has been saved to your records. Assign them to a job anytime
                from the Candidates page to run AI analysis.
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
                <Button variant="contained" onClick={() => nav("/dashboard")}
                  sx={{
                    bgcolor: ACCENT, borderRadius: "50px", fontSize: 14, fontWeight: 600,
                    textTransform: "none", boxShadow: "none", px: 4, py: 1.1,
                    "&:hover": { bgcolor: "#1660CC", boxShadow: "0 4px 14px rgba(29,114,232,0.25)" },
                  }}>
                  Return to Dashboard
                </Button>
                <Button variant="outlined" onClick={() => resetAll(false)}
                  sx={{
                    borderRadius: "50px", fontSize: 14, fontWeight: 500,
                    borderColor: "#DDE3EE", color: TEXT, textTransform: "none", px: 4, py: 1.1,
                    "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" },
                  }}>
                  Add Another Candidate
                </Button>
              </Box>
            </>
          ) : (
            /* ── successType === "with-job" ── */
            <>
              <Typography sx={{ fontSize: 22, fontWeight: 700, color: TEXT, mb: 1 }}>
                {savedCandidates.length === 1
                  ? `Candidate Added to ${selectedJob?.title || "Job"}`
                  : `${savedCandidates.length} Candidates Added to ${selectedJob?.title || "Job"}`}
              </Typography>
              <Typography sx={{ fontSize: 15, color: MUTED, mb: 4, maxWidth: 480, mx: "auto", lineHeight: 1.7 }}>
                {savedCandidates.length === 1 ? "Your candidate has been" : "Your candidates have been"} saved
                and assigned to the job. Run AI analysis to score and evaluate them.
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
                <Button variant="outlined" onClick={() => resetAll(true)}
                  sx={{
                    borderRadius: "50px", fontSize: 14, fontWeight: 500,
                    borderColor: "#DDE3EE", color: TEXT, textTransform: "none", px: 3, py: 1.1,
                    "&:hover": { borderColor: "#C0C8D8", bgcolor: "#F8F9FB" },
                  }}>
                  Add Another Candidate
                </Button>
                <Button variant="contained"
                  onClick={handleRunAnalysis} disabled={analysisRunning}
                  sx={{
                    bgcolor: PURPLE, borderRadius: "50px", fontSize: 14, fontWeight: 600,
                    textTransform: "none", boxShadow: "none", px: 4, py: 1.1,
                    "&:hover": { bgcolor: "#6D28D9", boxShadow: "0 4px 14px rgba(124,58,237,0.28)" },
                    "&.Mui-disabled": { bgcolor: "#E8ECF2", color: MUTED },
                  }}>
                  {analysisRunning
                    ? <><CircularProgress size={15} sx={{ color: "#fff", mr: 1 }} />Running…</>
                    : "Run Analysis"}
                </Button>
                <Button onClick={() => nav("/dashboard")}
                  sx={{
                    borderRadius: "50px", fontSize: 14, fontWeight: 500,
                    color: MUTED, textTransform: "none", px: 3, py: 1.1,
                    "&:hover": { color: TEXT, bgcolor: "#F8F9FB" },
                  }}>
                  Return to Dashboard
                </Button>
              </Box>
            </>
          )}
        </Paper>

      ) : (

        /* ── Add CV card ─────────────────────────────────────────────────── */
        <Paper elevation={0} sx={CARD_SX}>

          {/* Card header + bulk toggle */}
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

          {/* Error alerts */}
          {(singleError || bulkError) && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: "10px" }}
              onClose={() => { setSingleError(null); setBulkError(null); }}>
              {singleError || bulkError}
            </Alert>
          )}

          {/* Upload drop zone */}
          <Box
            component="label"
            htmlFor={bulkMode ? "bulk-cv-input-acm" : "single-cv-input-acm"}
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
            }}>
            <UploadZoneContent />
            <Box id="single-cv-input-acm" component="input" type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleSingleUpload(f); e.target.value = ""; }}
              sx={{ display: "none" }} />
            <Box id="bulk-cv-input-acm" component="input" type="file" multiple
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={e => { handleBulkFileSelect(e.target.files); e.target.value = ""; }}
              sx={{ display: "none" }} />
          </Box>

          {/* ── Single: form ── */}
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
                  }} />
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

          {/* ── Bulk: file list + save button ── */}
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
                          : bf.status === "done"   ? "Added to records ✓"
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
                <Button variant="contained" onClick={handleSaveAllCandidates}
                  disabled={bulkRunning || !hasPendingFiles}
                  sx={{
                    bgcolor: ACCENT, borderRadius: "50px", fontSize: 14, fontWeight: 600,
                    textTransform: "none", boxShadow: "none", px: 4, py: 1.1,
                    "&:hover": { bgcolor: "#1660CC", boxShadow: "0 4px 14px rgba(29,114,232,0.25)" },
                    "&.Mui-disabled": { bgcolor: "#E8ECF2", color: MUTED },
                  }}>
                  {bulkRunning
                    ? <><CircularProgress size={15} sx={{ color: "#fff", mr: 1 }} />Saving…</>
                    : "Save All Candidates"}
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

          {/* ── AI Talent Search ── */}
          <Button fullWidth onClick={() => nav("/talent-search")}
            sx={{
              borderRadius: "50px", py: 1.75, fontSize: 15, fontWeight: 600,
              textTransform: "none", boxShadow: "0 4px 20px rgba(29,114,232,0.22)",
              bgcolor: ACCENT, color: "#fff", gap: 1.25,
              "&:hover": { bgcolor: "#1660CC", boxShadow: "0 6px 24px rgba(29,114,232,0.35)" },
            }}>
            <SearchIcon color="#fff" size={20} />
            Search Candidate from AI Talent Search
          </Button>
        </Paper>
      )}

      {/* ── No Job confirmation dialog ── */}
      <Dialog open={noJobDialog} onClose={() => setNoJobDialog(false)}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 1 }}>
          Save Without Job Assignment?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
            These candidates will be saved to your records but won't appear under any job.
            AI analysis can only be run on candidates assigned to a job — you can reassign
            them later from the Candidates page. Do you want to continue?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" size="small"
            onClick={() => { setNoJobDialog(false); setPendingAction(null); }}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "20px", textTransform: "none", px: 2 }}>
            Go Back
          </Button>
          <Button variant="contained" size="small"
            onClick={() => {
              if (pendingAction === "single") doSaveSingle();
              else if (pendingAction === "bulk") doSaveBulk();
            }}
            sx={{
              fontSize: 12, bgcolor: ACCENT, borderRadius: "20px", textTransform: "none",
              boxShadow: "none", px: 2, "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
            }}>
            Save Anyway
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Analysis dialog ── */}
      <Dialog open={analysisDialog} onClose={() => setAnalysisDialog(false)}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 1 }}>
          Analysis Running ✦
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
            Your candidate is being analysed by AI in the background. Check the Candidates
            or Jobs page for results.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => setAnalysisDialog(false)}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "20px", textTransform: "none", px: 2 }}>
            Stay Here
          </Button>
          <Button variant="contained" size="small"
            onClick={() => { setAnalysisDialog(false); nav("/dashboard"); }}
            sx={{
              fontSize: 12, bgcolor: ACCENT, borderRadius: "20px", textTransform: "none",
              boxShadow: "none", px: 2, "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
            }}>
            Go to Dashboard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
