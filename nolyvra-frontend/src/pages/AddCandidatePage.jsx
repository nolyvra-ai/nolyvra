import {
  Box,
  Typography,
  TextField,
  Button,
  MenuItem,
  Paper,
  Chip,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from "@mui/material";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlanLimit } from "../hooks/usePlanLimit";
import { validateCvContent } from "../utils/cvValidation";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function parseApiError(status, statusText, bodyText) {
  let message = bodyText || statusText || "Request failed";
  try {
    const body = JSON.parse(bodyText);
    message = body.message || body.error || message;
  } catch {
    // Non-JSON error body; keep the original text.
  }
  return { status, message, detail: bodyText };
}

function formatCandidateSaveError(error, candidateName) {
  const message = error?.message || "";
  if (error?.status === 409 || message.toLowerCase().includes("already in the pipeline")) {
    return `${candidateName || "This candidate"} is already in the pipeline for this job.`;
  }
  return message || "Failed to save candidate.";
}

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = parseApiError(res.status, res.statusText, text);
    throw Object.assign(new Error(error.message), error);
  }
  return res.json();
}

async function apiPost(path, body) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = parseApiError(res.status, res.statusText, text);
    throw Object.assign(new Error(error.message), error);
  }
  return res.json();
}

async function apiPut(path, body) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = parseApiError(res.status, res.statusText, text);
    throw Object.assign(new Error(error.message), error);
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
  const nav      = useNavigate();
  const location = useLocation();
  const prefill  = location.state?.prefill;
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const { checkCandidateLimit, usage } = usePlanLimit();
  const [limitDialog,        setLimitDialog]        = useState(false);
  const [analysisDialog,     setAnalysisDialog]     = useState(false);
  const [analysisCandidateId, setAnalysisCandidateId] = useState(null);

  // Change 3: jobId defaults to "" = "Not Assigned"
  const [form, setForm] = useState({
    name:           prefill?.name        ?? "",
    email:          prefill?.email       ?? "",
    phone:          prefill?.phone       ?? "",
    linkedinUrl:    prefill?.linkedinUrl ?? "",
    cvText:         prefill?.cvText      ?? "",
    skills:         [],
    recruiterNotes: "",
    jobId:          "",
    currentTitle:        "",
    location:            "",
    state:               "",
    yearsExperience:     "",
    seniorityLevel:      "",
    expectedSalaryMin:   "",
    expectedSalaryMax:   "",
    noticePeriodWeeks:   "",
    workRights:          "",
    remoteFlexible:      false,
  });
  const [jobs,          setJobs]          = useState([]);
  const [cvFile,        setCvFile]        = useState(null);
  const [cvUploading,   setCvUploading]   = useState(false);
  const [cvUploadError, setCvUploadError] = useState(null);
  const [validationErr, setValidationErr] = useState("");

  // ── Edit Profile mode (entered via prefill.candidateId from CandidateWorkflowPage) ──
  const isEditMode = !!prefill?.candidateId;
  const editCandidateId = prefill?.candidateId ?? null;
  const [editOriginalJobId, setEditOriginalJobId] = useState(null);
  const [editOriginalJobStatus, setEditOriginalJobStatus] = useState(null);
  const [editLoaded, setEditLoaded] = useState(!isEditMode);

  // The job assignment is only "locked" (can't reassign this same candidate
  // record) while their existing job is still open — Active or Fulfilling.
  // Once a job is Filled/Closed/On Hold/etc., the dropdown unlocks naturally.
  const isJobLocked = isEditMode && !!editOriginalJobId
    && ["active", "fulfilling"].includes((editOriginalJobStatus || "").toLowerCase());

  // A candidate can apply to more than one job — when the existing job is
  // locked, "Add Candidate to Another Job" unlocks the dropdown to instead
  // create a separate candidate record for a second job application.
  const [duplicateForNewJob, setDuplicateForNewJob] = useState(false);
  const [duplicateNoticeOpen, setDuplicateNoticeOpen] = useState(false);

  const jobDropdownDisabled = isEditMode && (!editLoaded || (isJobLocked && !duplicateForNewJob));

  // Change 2: Bulk upload state
  const [bulkDialog,     setBulkDialog]     = useState(false);
  const [bulkFiles,      setBulkFiles]      = useState([]);   // { file, status, name, email, cvText, error }
  const [bulkJobId,      setBulkJobId]      = useState("");
  const [bulkSaving,     setBulkSaving]     = useState(false);
  const [bulkDone,       setBulkDone]       = useState(false);
  const [bulkAnalyzing,  setBulkAnalyzing]  = useState(false);
  const [recentBulkCandidates, setRecentBulkCandidates] = useState([]);
  const [bulkAnalysisStatus, setBulkAnalysisStatus] = useState(null);

  function setField(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  // Smart Talent Lens search/match fields, shared by both submit paths below
  function searchFieldsPayload() {
    const num = (v) => (v === "" || v == null ? null : Number(v));
    return {
      currentTitle:      form.currentTitle || null,
      location:          form.location || null,
      state:             form.state || null,
      yearsExperience:   num(form.yearsExperience),
      seniorityLevel:    form.seniorityLevel || null,
      expectedSalaryMin: num(form.expectedSalaryMin),
      expectedSalaryMax: num(form.expectedSalaryMax),
      noticePeriodWeeks: form.noticePeriodWeeks === "" ? null : Number(form.noticePeriodWeeks),
      workRights:        form.workRights || null,
      remoteFlexible:    form.remoteFlexible,
    };
  }

  const bulkAnalysisBatchId = bulkAnalysisStatus?.batchId;
  const bulkAnalysisActive = !!bulkAnalysisStatus &&
    ((bulkAnalysisStatus.queued ?? 0) + (bulkAnalysisStatus.running ?? 0) > 0);

  useEffect(() => {
    if (!bulkAnalysisBatchId) return undefined;

    const poll = async () => {
      const loginId = localStorage.getItem("loginId") || "";
      const url = new URL(`${API_BASE}/api/analysis-jobs/batches/${bulkAnalysisBatchId}`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
      });
      if (res.ok) setBulkAnalysisStatus(await res.json());
    };

    poll();
    const timer = window.setInterval(poll, 3000);
    return () => window.clearInterval(timer);
  }, [bulkAnalysisBatchId]);

  // ── Change 1: CV upload — extracts text AND prefills name/email/linkedinUrl ─
  async function handleCvUpload(file) {
    if (!file) return;
    const allowed = ["application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword"];
    if (!allowed.includes(file.type)) {
      setCvUploadError("Only PDF and Word (.docx / .doc) files are supported.");
      return;
    }
    setCvFile(file.name);
    setCvUploading(true);
    setCvUploadError(null);
    try {
      const loginId = localStorage.getItem("loginId") || "";
      const formData = new FormData();
      formData.append("file", file);
      const url = new URL(`${API_BASE}/api/cv/extract`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` }, body: formData });

      // Read body as text first to avoid JSON parse errors
      const rawBody = await res.text();

      if (!res.ok) {
        if (res.status === 402) {
          setCvUploadError("You have run out of tokens. Please upgrade your plan to continue.");
        } else {
          setCvUploadError("Could not read the file. Please try a different document.");
        }
        setCvFile(null);
        return;
      }

      let data;
      try {
        data = JSON.parse(rawBody);
      } catch {
        setCvUploadError("Unexpected response from server. Please try again.");
        setCvFile(null);
        return;
      }

      const extractedText = data.text || "";

      // Run CV validation on extracted text
      const validationError = validateCvContent(extractedText);
      if (validationError) {
        setCvUploadError(validationError);
        setCvFile(null);
        return;
      }

      // Prefill all available fields from CV
      setForm(prev => ({
        ...prev,
        cvText:      extractedText        || prev.cvText,
        name:        data.name        || prev.name,
        email:       data.email       || prev.email,
        linkedinUrl: data.linkedinUrl || prev.linkedinUrl,
        skills:      Array.isArray(data.skills) && data.skills.length > 0 ? data.skills : prev.skills,
      }));
    } catch (e) {
      setCvUploadError("Failed to read the file: " + e.message);
      setCvFile(null);
    } finally {
      setCvUploading(false);
    }
  }

  useEffect(() => {
    async function loadJobs() {
      try {
        const data = await apiGet("/api/jobs");
        setJobs(data ?? []);
        // Do NOT auto-select first job — default is "Not Assigned"
      } catch (e) {
        console.error("Failed to load jobs", e);
      }
    }
    loadJobs();
  }, []);

  // Edit Profile mode: fetch the full candidate record and prefill every field.
  useEffect(() => {
    if (!editCandidateId) return;
    apiGet(`/api/candidates/${editCandidateId}`)
      .then(async candidate => {
        if (!candidate) return;
        setEditOriginalJobId(candidate.jobId ?? null);
        setForm(p => ({
          ...p,
          name:               candidate.name ?? "",
          email:              candidate.email ?? "",
          phone:              candidate.phone ?? "",
          linkedinUrl:        candidate.linkedinUrl ?? "",
          cvText:             candidate.cvText ?? "",
          jobId:              candidate.jobId ?? "",
          currentTitle:       candidate.currentTitle ?? "",
          location:           candidate.location ?? "",
          state:              candidate.state ?? "",
          yearsExperience:    candidate.yearsExperience ?? "",
          seniorityLevel:     candidate.seniorityLevel ?? "",
          expectedSalaryMin:  candidate.expectedSalaryMin ?? "",
          expectedSalaryMax:  candidate.expectedSalaryMax ?? "",
          noticePeriodWeeks:  candidate.noticePeriodWeeks ?? "",
          workRights:         candidate.workRights ?? "",
          remoteFlexible:     candidate.remoteFlexible ?? false,
        }));
        // Job assignment is only "locked" while that job is still open —
        // fetch its status to decide whether the dropdown should stay disabled.
        if (candidate.jobId) {
          try {
            const job = await apiGet(`/api/jobs/${candidate.jobId}`);
            setEditOriginalJobStatus(job?.status ?? null);
          } catch (err) {
            console.error("[AddCandidate] failed to load assigned job status:", err);
            setEditOriginalJobStatus(null);
          }
        }
      })
      .catch(err => console.error("[AddCandidate] edit prefill fetch failed:", err))
      .finally(() => setEditLoaded(true));
  }, [editCandidateId]);

  // ── Save candidate (no analysis) ──────────────────────────────────────────

  // Change 2: bulk upload handlers
  async function handleBulkFiles(files) {
    const arr = Array.from(files).map(f => ({
      file: f, status: "pending", name: "", email: "", cvText: "", skills: [], error: null
    }));
    setBulkFiles(arr);
    setBulkDone(false);
    for (let i = 0; i < arr.length; i++) {
      setBulkFiles(prev => prev.map((b, idx) =>
        idx === i ? { ...b, status: "extracting" } : b));
      try {
        const formData = new FormData();
        formData.append("file", arr[i].file);
        const loginId = localStorage.getItem("loginId") || "";
        const url = new URL(`${API_BASE}/api/cv/extract`);
        url.searchParams.set("loginId", loginId);
        const res = await fetch(url.toString(), { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` }, body: formData });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setBulkFiles(prev => prev.map((b, idx) =>
          idx === i ? { ...b, status: "ready",
            name:   data.name   || arr[i].file.name,
            email:  data.email  || "",
            cvText: data.text   || "",
            skills: Array.isArray(data.skills) ? data.skills : [],
          } : b));
      } catch (e) {
        setBulkFiles(prev => prev.map((b, idx) =>
          idx === i ? { ...b, status: "error", error: e.message } : b));
      }
    }
  }

  async function handleBulkSave() {
    // Check if there is room for at least 1 more candidate before starting
    if (!checkCandidateLimit()) {
      setBulkDialog(false);
      setLimitDialog(true);
      return;
    }

    setBulkSaving(true);
    const loginId = localStorage.getItem("loginId") || "";
    const readyFiles = bulkFiles.filter(b => b.status === "ready");
    const slotsAvailable = (usage?.maxCandidates ?? 0) - (usage?.currentCandidates ?? 0);

    if (readyFiles.length > slotsAvailable) {
      // Warn user how many can actually be saved
      setBulkFiles(prev => prev.map((b, idx) => {
        const readyIndex = readyFiles.indexOf(b);
        if (b.status === "ready" && readyIndex >= slotsAvailable) {
          return { ...b, status: "error", error: "Candidate limit reached — slot not available" };
        }
        return b;
      }));
    }

    let savedCount = 0;
    let limitHit = false;
    const savedCandidates = [];
    for (let i = 0; i < bulkFiles.length; i++) {
      const b = bulkFiles[i];
      if (b.status !== "ready") continue;

      // Stop saving if limit reached mid-bulk
      if (savedCount >= slotsAvailable) {
        limitHit = true;
        setBulkFiles(prev => prev.map((bf, idx) =>
          idx === i && bf.status === "ready"
            ? { ...bf, status: "error", error: "Candidate limit reached — slot not available" }
            : bf));
        continue;
      }

      try {
        const path = bulkJobId
          ? `/api/jobs/${bulkJobId}/candidates`
          : `/api/candidates`;
        const url = new URL(`${API_BASE}${path}`);
        url.searchParams.set("loginId", loginId);
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
          body: JSON.stringify({ name: b.name, email: b.email, cvText: b.cvText, linkedinUrl: "", skills: b.skills || [] }),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          const error = parseApiError(res.status, res.statusText, text);
          throw Object.assign(new Error(error.message), error);
        }
        const candidate = await res.json();
        const savedCandidate = { ...b, status: "saved", candidateId: candidate.id };
        savedCandidates.push(savedCandidate);
        setBulkFiles(prev => prev.map((bf, idx) =>
          idx === i ? savedCandidate : bf));
        savedCount++;
      } catch (e) {
        setBulkFiles(prev => prev.map((bf, idx) =>
          idx === i ? { ...bf, status: "error", error: formatCandidateSaveError(e, b.name) } : bf));
      }
    }
    setBulkSaving(false);
    setBulkDone(true);
    setRecentBulkCandidates(savedCandidates);
    setBulkAnalysisStatus(null);

    // If limit was hit mid-bulk, show the limit dialog after
    if (limitHit) {
      setBulkDialog(false);
      setLimitDialog(true);
    }
  }

  function closeBulkDialog() {
    setBulkDialog(false);
    setBulkFiles([]);
    setBulkDone(false);
    setBulkAnalyzing(false);
  }

  async function handleBulkAnalysis(candidates = bulkFiles) {
    const savedCandidates = candidates.filter(b => b.status === "saved" && b.candidateId);
    if (!savedCandidates.length || bulkAnalyzing) return;

    setBulkAnalyzing(true);
    setAnalysisDialog(true);
    const loginId = localStorage.getItem("loginId") || "";

    try {
      const url = new URL(`${API_BASE}/api/analysis-jobs/bulk`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify({ candidateIds: savedCandidates.map(b => b.candidateId) }),
      });
      if (!res.ok) throw new Error(await res.text());
      setBulkAnalysisStatus(await res.json());
    } catch {
      setValidationErr("Failed to queue bulk analysis. Please try again.");
    } finally {
      if (isMountedRef.current) setBulkAnalyzing(false);
    }
  }

  async function onSave(e) {
    e.preventDefault();
    // "Add Candidate to Another Job" creates a brand-new candidate record,
    // even though we got here via Edit Profile — so it counts against the
    // plan limit and goes through the create flow, not the update flow.
    const isDuplicateCreate = isEditMode && duplicateForNewJob;
    if ((!isEditMode || isDuplicateCreate) && !checkCandidateLimit()) { setLimitDialog(true); return; }
    if (!hasName)  { setValidationErr("Candidate name is required."); return; }
    if (!hasEmail) { setValidationErr("Email address is required."); return; }
    if (!hasCv)    { setValidationErr("CV text is required. Please paste or upload a CV."); return; }
    if (isDuplicateCreate && !form.jobId) { setValidationErr("Please select a job for this second application."); return; }
    setValidationErr("");
    try {
      if (isEditMode && !duplicateForNewJob) {
        await apiPut(`/api/candidates/${editCandidateId}`, {
          name:        form.name,
          email:       form.email,
          phone:       form.phone,
          linkedinUrl: form.linkedinUrl,
          cvText:      form.cvText,
          jobId:       jobDropdownDisabled ? editOriginalJobId : (form.jobId || null),
          ...searchFieldsPayload(),
        });
        nav(`/candidates/${editCandidateId}/workflow`);
        return;
      }
      // Change 3: use unassigned endpoint when no job selected (also used for
      // "Add Candidate to Another Job", which always has a job selected)
      const apiPath = form.jobId
        ? `/api/jobs/${form.jobId}/candidates`
        : `/api/candidates`;
      const candidate = await apiPost(apiPath, {
        name:           form.name,
        email:          form.email,
        phone:          form.phone,
        linkedinUrl:    form.linkedinUrl,
        cvText:         form.cvText,
        skills:         form.skills,
        recruiterNotes: form.recruiterNotes,
        ...searchFieldsPayload(),
      });
      nav(isDuplicateCreate ? `/candidates/${candidate.id}/workflow` : "/candidates");
    } catch (e) {
      setValidationErr(formatCandidateSaveError(e, form.name));
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const isDuplicateCreate = isEditMode && duplicateForNewJob;
    if ((!isEditMode || isDuplicateCreate) && !checkCandidateLimit()) { setLimitDialog(true); return; }
    if (!hasName)  { setValidationErr("Candidate name is required."); return; }
    if (!hasEmail) { setValidationErr("Email address is required."); return; }
    if (!hasCv)    { setValidationErr("CV text is required. Please paste or upload a CV."); return; }
    const effectiveJobId = isDuplicateCreate
      ? form.jobId
      : (jobDropdownDisabled ? editOriginalJobId : form.jobId);
    if (!effectiveJobId) { setValidationErr("Please assign the candidate to a job before running analysis."); return; }
    setValidationErr("");
    try {
      let candidateId;
      if (isEditMode && !duplicateForNewJob) {
        const candidate = await apiPut(`/api/candidates/${editCandidateId}`, {
          name:        form.name,
          email:       form.email,
          phone:       form.phone,
          linkedinUrl: form.linkedinUrl,
          cvText:      form.cvText,
          jobId:       effectiveJobId,
          ...searchFieldsPayload(),
        });
        candidateId = candidate.id;
      } else {
        // Used both for brand-new candidates and "Add Candidate to Another Job"
        const candidate = await apiPost(`/api/jobs/${effectiveJobId}/candidates`, {
          name:           form.name,
          email:          form.email,
          phone:          form.phone,
          linkedinUrl:    form.linkedinUrl,
          cvText:         form.cvText,
          skills:         form.skills,
          recruiterNotes: form.recruiterNotes,
          ...searchFieldsPayload(),
        });
        candidateId = candidate.id;
      }

      const loginId = localStorage.getItem("loginId") || "";
      const analyzeUrl = new URL(`${API_BASE}/api/candidates/${candidateId}/analyze`);
      analyzeUrl.searchParams.set("loginId", loginId);

      // Fire analysis in background — navigate when done only if still on this page
      fetch(analyzeUrl.toString(), {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
      }).then(analyzeRes => {
        if (!isMountedRef.current) return;
        if (analyzeRes.status === 402) {
          setValidationErr("You have run out of tokens. Please upgrade your plan to run analysis.");
        } else if (!analyzeRes.ok) {
          setValidationErr("Analysis failed. Please try again.");
        } else {
          nav(`/analysis/${candidateId}`);
        }
      }).catch(() => {
        if (isMountedRef.current) {
          setValidationErr("Analysis failed. Please try again.");
        }
      });

      setAnalysisCandidateId(candidateId);
      setAnalysisDialog(true);

    } catch (err) {
      setValidationErr(formatCandidateSaveError(err, form.name));
    }
  }

  const [firstName = "", ...rest] = (form.name ?? "").trim().split(" ");
  const hasName    = firstName.length > 0;
  const hasEmail   = form.email.trim().length > 0;
  const hasJob     = true; // Change 3: "Not Assigned" is always valid
  const hasLinkedin = form.linkedinUrl.trim().length > 0;
  const hasCv      = form.cvText.trim().length > 0;
  const wordCount  = form.cvText.trim()
    ? form.cvText.trim().split(/\s+/).length
    : 0;
  const allReady = hasName && hasEmail && hasJob && hasCv;

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
            {duplicateForNewJob ? "Add Candidate to Another Job" : isEditMode ? "Edit Candidate" : "Add Candidate"}
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            {duplicateForNewJob
              ? "This creates a separate candidate profile for the new job — the existing one is untouched."
              : isEditMode ? "Update this candidate's profile details" : "Paste CV and LinkedIn for validation analysis"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          {!isEditMode && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => nav("/candidates/new-modern")}
              sx={{
                fontSize: 11, borderColor: "#C4B5FD", color: "#7C3AED",
                borderRadius: "50px", textTransform: "none", px: 2,
                bgcolor: "#F5F3FF",
                "&:hover": { borderColor: "#7C3AED", bgcolor: "#EDE9FE" },
              }}
            >
              ✦ Switch to New AI Add Candidate
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            onClick={() => nav(isEditMode ? `/candidates/${editCandidateId}/workflow` : "/candidates")}
            sx={{
              fontSize: 12, fontWeight: 500, borderColor: BORDER, color: TEXT,
              borderRadius: "6px", textTransform: "none",
              "&:hover": { borderColor: "#C0C8D8", bgcolor: SURFACE },
            }}
          >
            Cancel
          </Button>
          {/* Change 2: Bulk Upload button */}
          {!isEditMode && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => { setBulkFiles([]); setBulkDone(false); setBulkAnalyzing(false); setBulkAnalysisStatus(null); setBulkDialog(true); }}
              sx={{
                fontSize: 12, fontWeight: 500, borderColor: "#C4B5FD", color: "#7C3AED",
                borderRadius: "6px", textTransform: "none",
                "&:hover": { borderColor: "#7C3AED", bgcolor: "#F5F3FF" },
              }}
            >
              📦 Bulk Upload CVs
            </Button>
          )}
          <Button
            size="small"
            variant="contained"
            onClick={onSubmit}
            sx={{
              fontSize: 12, fontWeight: 500, bgcolor: ACCENT, borderRadius: "6px",
              textTransform: "none", boxShadow: "none",
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

      {recentBulkCandidates.length > 0 && (
        <Box
          sx={{
            bgcolor: "#F0FDF4",
            borderBottom: "1px solid #BBF7D0",
            px: 3,
            py: 1.25,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            flexShrink: 0,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#166534" }}>
              {recentBulkCandidates.length} newest uploaded CV(s) added to pipeline
            </Typography>
            <Typography sx={{ fontSize: 11, color: "#15803D", mt: 0.25 }}>
              {bulkAnalysisStatus
                ? `${bulkAnalysisStatus.queued ?? 0} queued, ${bulkAnalysisStatus.running ?? 0} running, ${bulkAnalysisStatus.succeeded ?? 0} completed, ${bulkAnalysisStatus.failed ?? 0} failed`
                : "Run analysis for this latest bulk upload batch when you are ready."}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            disabled={bulkAnalyzing || bulkAnalysisActive}
            onClick={() => handleBulkAnalysis(recentBulkCandidates)}
            sx={{
              fontSize: 12,
              bgcolor: ACCENT,
              borderRadius: "6px",
              textTransform: "none",
              boxShadow: "none",
              flexShrink: 0,
              "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
            }}
          >
            {bulkAnalyzing || bulkAnalysisActive ? "Running…" : "🔍 Run Bulk Analysis"}
          </Button>
        </Box>
      )}

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflow: "auto", p: 2.5 }}>

        {/* Change 3: validation error banner */}
        {validationErr && (
          <Box sx={{ mb: 2, p: "10px 14px", bgcolor: "#FEF2F2",
            border: "1px solid #FECACA", borderRadius: "8px",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: 12, color: "#DC2626", fontWeight: 500 }}>
              ⚠ {validationErr}
            </Typography>
            <Box onClick={() => setValidationErr("")}
              sx={{ cursor: "pointer", fontSize: 14, color: "#DC2626", opacity: 0.6,
                "&:hover": { opacity: 1 }, ml: 2, flexShrink: 0 }}>×</Box>
          </Box>
        )}
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
                    label="Email *"
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
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    sx={fieldSx}
                  />
                </Box>

                {/* Job selector */}
                <TextField
                  fullWidth
                  select
                  label="Assign to Job"
                  size="small"
                  disabled={jobDropdownDisabled}
                  value={form.jobId}
                  onChange={(e) => setField("jobId", e.target.value)}
                  helperText={
                    duplicateForNewJob
                      ? "Pick a different job — this will create a separate candidate profile for it."
                      : jobDropdownDisabled
                        ? "This candidate is already assigned to an open job."
                        : undefined
                  }
                  sx={{ ...fieldSx, mb: duplicateForNewJob || isJobLocked ? 0.5 : 1.5 }}
                >
                  {/* Change 3: Not Assigned default option */}
                  <MenuItem value="" sx={{ fontSize: 13, color: MUTED }}>
                    — Not Assigned —
                  </MenuItem>
                  {jobs
                    .filter((job) => !(duplicateForNewJob && job.id === editOriginalJobId))
                    .map((job) => (
                      <MenuItem key={job.id} value={job.id} sx={{ fontSize: 13 }}>
                        {job.title}{job.company ? ` — ${job.company}` : ""}
                      </MenuItem>
                    ))}
                </TextField>

                {isJobLocked && !duplicateForNewJob && (
                  <Typography
                    onClick={() => setDuplicateNoticeOpen(true)}
                    sx={{ fontSize: 12, color: ACCENT, cursor: "pointer", mb: 1.5, "&:hover": { textDecoration: "underline" } }}
                  >
                    + Add Candidate to Another Job
                  </Typography>
                )}

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

                {/* Smart Talent Lens search/match fields */}
                <Divider sx={{ borderColor: BORDER, my: 2 }} />
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, mb: 1.25 }}>
                  Search &amp; Matching Details
                </Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5, mb: 1.5 }}>
                  <TextField fullWidth label="Current Title" size="small"
                    value={form.currentTitle} onChange={(e) => setField("currentTitle", e.target.value)} sx={fieldSx} />
                  <TextField fullWidth label="Location" size="small" placeholder="City or suburb"
                    value={form.location} onChange={(e) => setField("location", e.target.value)} sx={fieldSx} />
                  <TextField fullWidth label="State" size="small" placeholder="e.g. VIC"
                    value={form.state} onChange={(e) => setField("state", e.target.value)} sx={fieldSx} />
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 1.5 }}>
                  <TextField fullWidth label="Years of Experience" size="small" type="number"
                    value={form.yearsExperience} onChange={(e) => setField("yearsExperience", e.target.value)} sx={fieldSx} />
                  <TextField fullWidth select label="Seniority Level" size="small"
                    value={form.seniorityLevel} onChange={(e) => setField("seniorityLevel", e.target.value)} sx={fieldSx}>
                    <MenuItem value="" sx={{ fontSize: 13, color: MUTED }}>— Not Set —</MenuItem>
                    {["Junior", "Mid", "Mid-Senior", "Senior", "Lead/Principal"].map((s) => (
                      <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s}</MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 1.5 }}>
                  <TextField fullWidth label="Expected Salary Min" size="small" type="number"
                    value={form.expectedSalaryMin} onChange={(e) => setField("expectedSalaryMin", e.target.value)} sx={fieldSx} />
                  <TextField fullWidth label="Expected Salary Max" size="small" type="number"
                    value={form.expectedSalaryMax} onChange={(e) => setField("expectedSalaryMax", e.target.value)} sx={fieldSx} />
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 1.5 }}>
                  <TextField fullWidth label="Notice Period (weeks)" size="small" type="number"
                    value={form.noticePeriodWeeks} onChange={(e) => setField("noticePeriodWeeks", e.target.value)} sx={fieldSx} />
                  <TextField fullWidth select label="Work Rights" size="small"
                    value={form.workRights} onChange={(e) => setField("workRights", e.target.value)} sx={fieldSx}>
                    <MenuItem value="" sx={{ fontSize: 13, color: MUTED }}>— Not Set —</MenuItem>
                    {["Citizen", "Permanent Resident", "Visa (sponsorship required)"].map((w) => (
                      <MenuItem key={w} value={w} sx={{ fontSize: 13 }}>{w}</MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <input type="checkbox" id="remoteFlexible" checked={form.remoteFlexible}
                    onChange={(e) => setField("remoteFlexible", e.target.checked)} />
                  <label htmlFor="remoteFlexible" style={{ fontSize: 12, color: TEXT, cursor: "pointer" }}>
                    Open to hybrid / remote work
                  </label>
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

                {/* Change 1: CV upload section */}
                <Box sx={{ mb: 1.75 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.75 }}>
                    Upload CV (PDF or Word)
                  </Typography>
                  <Box
                    component="label"
                    htmlFor="cv-file-input"
                    sx={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexDirection: "column", gap: 0.75,
                      border: `2px dashed ${cvFile ? "#BBF7D0" : BORDER}`,
                      borderRadius: "8px", p: "18px 16px",
                      bgcolor: cvFile ? "#F0FDF4" : SURFACE,
                      cursor: "pointer", transition: "all .15s",
                      "&:hover": { borderColor: ACCENT, bgcolor: "#EBF2FF" },
                    }}>
                    <Typography sx={{ fontSize: 20 }}>
                      {cvUploading ? "⏳" : cvFile ? "✅" : "📎"}
                    </Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 500,
                      color: cvFile ? SUCCESS : TEXT, textAlign: "center" }}>
                      {cvUploading
                        ? "Extracting text…"
                        : cvFile
                          ? cvFile
                          : "Click to upload PDF or Word document"}
                    </Typography>
                    {!cvFile && !cvUploading && (
                      <Typography sx={{ fontSize: 11, color: MUTED }}>
                        .pdf · .docx · .doc — text will auto-fill below
                      </Typography>
                    )}
                    {cvFile && !cvUploading && (
                      <Typography sx={{ fontSize: 11, color: SUCCESS }}>
                        Text extracted and filled below
                      </Typography>
                    )}
                    <Box
                      id="cv-file-input"
                      component="input"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCvUpload(f); e.target.value = ""; }}
                      sx={{ display: "none" }}
                    />
                  </Box>
                  {cvUploadError && (
                    <Typography sx={{ fontSize: 11, color: "#DC2626", mt: 0.75 }}>
                      ⚠ {cvUploadError}
                    </Typography>
                  )}
                  {cvFile && (
                    <Box sx={{ mt: 0.75, display: "flex", alignItems: "center",
                      justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 11, color: MUTED }}>
                        Or edit extracted text manually below
                      </Typography>
                      <Box onClick={() => { setCvFile(null); setField("cvText", ""); }}
                        sx={{ fontSize: 11, color: "#DC2626", cursor: "pointer",
                          "&:hover": { textDecoration: "underline" } }}>
                        Remove file
                      </Box>
                    </Box>
                  )}
                </Box>

                <Box sx={{ mb: 1.25, display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ flex: 1, height: 1, bgcolor: BORDER }} />
                  <Typography sx={{ fontSize: 11, color: MUTED, px: 1, flexShrink: 0 }}>
                    or paste manually
                  </Typography>
                  <Box sx={{ flex: 1, height: 1, bgcolor: BORDER }} />
                </Box>

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
                    analysis. nolyvra does not store any personally identifiable information
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
                  <CheckItem done={hasName}    label="Candidate name entered" />
                  <CheckItem done={hasEmail}   label="Email address provided" />
                  <CheckItem done={hasJob}     label="Job assigned" />
                  <CheckItem done={hasLinkedin} label="LinkedIn URL provided" />
                  <CheckItem done={hasCv}      label="CV text pasted" />
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
                {/* Change 2: wired to form state; no Save Notes button — saves with candidate */}
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  placeholder="Add any notes about this candidate…"
                  value={form.recruiterNotes}
                  onChange={e => setField("recruiterNotes", e.target.value)}
                  sx={{
                    ...fieldSx,
                    "& .MuiOutlinedInput-root": {
                      ...fieldSx["& .MuiOutlinedInput-root"],
                      fontSize: 12,
                      alignItems: "flex-start",
                    },
                  }}
                />
                <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.75 }}>
                  Notes are saved automatically with the candidate record
                </Typography>
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
              {duplicateForNewJob ? "Create New Application" : isEditMode ? "Save Changes" : "Save Without Analysis"}
            </Button>

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

      {/* Plan limit dialog */}
      <Dialog open={limitDialog} onClose={() => setLimitDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, pb: 1 }}>
          Candidate Limit Reached
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: "#9AA3B4", lineHeight: 1.6 }}>
            You have used all <strong>{usage?.currentCandidates ?? 0} / {usage?.maxCandidates ?? 0}</strong> candidate
            slots on your <strong>{usage?.planName ?? "Free"}</strong> plan.
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#9AA3B4", mt: 1, lineHeight: 1.6 }}>
            To add more candidates, please upgrade your plan or remove an existing candidate.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => setLimitDialog(false)}
            sx={{ fontSize: 12, borderColor: "#E8ECF2", color: "#0F1623", borderRadius: "6px", textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" size="small" onClick={() => setLimitDialog(false)}
            sx={{ fontSize: 12, bgcolor: "#1D72E8", borderRadius: "6px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            Upgrade Plan
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Candidate to Another Job — confirmation notice */}
      <Dialog open={duplicateNoticeOpen} onClose={() => setDuplicateNoticeOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: "#0F1623", pb: 1 }}>
          Add Candidate to Another Job?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: "#9AA3B4", lineHeight: 1.6 }}>
            This will create a new candidate profile for the new job, with a separate assessment
            based on that job's requirements. The existing profile will not be impacted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => setDuplicateNoticeOpen(false)}
            sx={{ fontSize: 12, borderColor: "#E8ECF2", color: "#0F1623", borderRadius: "6px", textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" size="small"
            onClick={() => {
              setField("jobId", "");
              setDuplicateForNewJob(true);
              setDuplicateNoticeOpen(false);
            }}
            sx={{ fontSize: 12, bgcolor: "#1D72E8", borderRadius: "6px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Analysis in progress dialog */}
      <Dialog open={analysisDialog} onClose={() => setAnalysisDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: "#0F1623", pb: 1 }}>
          🔍 Analysis In Progress
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: "#9AA3B4", lineHeight: 1.6 }}>
            Analysis is running in the background. You will be taken to the results page automatically when it completes.
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#9AA3B4", mt: 1, lineHeight: 1.6 }}>
            You can also navigate away — the analysis will keep running and you can view the results from the Candidates page.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" size="small" onClick={() => setAnalysisDialog(false)}
            sx={{ fontSize: 12, bgcolor: "#1D72E8", borderRadius: "6px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            OK, Got It
          </Button>
        </DialogActions>
      </Dialog>

      {/* Change 2: Bulk Upload dialog */}
      <Dialog open={bulkDialog}
        onClose={() => { if (!bulkSaving && !bulkAnalyzing) closeBulkDialog(); }}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: TEXT, pb: 1 }}>
          📦 Bulk Upload CVs
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 12, color: MUTED, mb: 2, lineHeight: 1.6 }}>
            Upload multiple CV files. Name and email will be auto-extracted from each.
          </Typography>

          {bulkFiles.length > 0 && (
            <Box sx={{
              mb: 2,
              p: 1.5,
              border: `1px solid ${BORDER}`,
              borderRadius: "8px",
              bgcolor: SURFACE,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
            }}>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT }}>
                  {bulkFiles.filter(b => b.status === "saved").length} candidate(s) added
                </Typography>
                <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
                  {bulkFiles.filter(b => b.status === "ready").length} ready, {bulkFiles.filter(b => b.status === "error").length} need attention
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                disabled={bulkAnalyzing || bulkFiles.filter(b => b.status === "saved" && b.candidateId).length === 0}
                onClick={handleBulkAnalysis}
                sx={{
                  fontSize: 12,
                  bgcolor: ACCENT,
                  borderRadius: "6px",
                  textTransform: "none",
                  boxShadow: "none",
                  flexShrink: 0,
                  "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
                }}
              >
                {bulkAnalyzing ? "Running…" : "🔍 Run Bulk Analysis"}
              </Button>
            </Box>
          )}

          {/* Job selector for bulk */}
          <TextField select fullWidth size="small" label="Assign all to Job"
            value={bulkJobId} onChange={e => setBulkJobId(e.target.value)}
            sx={{ ...fieldSx, mb: 2 }}>
            <MenuItem value="" sx={{ fontSize: 13, color: MUTED }}>— Not Assigned —</MenuItem>
            {jobs.map(j => (
              <MenuItem key={j.id} value={j.id} sx={{ fontSize: 13 }}>{j.title}{j.company ? ` — ${j.company}` : ""}</MenuItem>
            ))}
          </TextField>

          {/* File drop zone */}
          {bulkFiles.length === 0 && (
            <Box component="label" htmlFor="bulk-file-input"
              sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                border: `2px dashed ${BORDER}`, borderRadius: "8px", p: 3, cursor: "pointer",
                bgcolor: SURFACE, "&:hover": { borderColor: ACCENT, bgcolor: "#EBF2FF" } }}>
              <Typography sx={{ fontSize: 22 }}>📂</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 500, color: TEXT }}>
                Click to select multiple CV files
              </Typography>
              <Typography sx={{ fontSize: 11, color: MUTED }}>
                PDF or Word (.docx) — multiple files supported
              </Typography>
              <Box id="bulk-file-input" component="input" type="file" multiple
                accept=".pdf,.doc,.docx"
                onChange={e => handleBulkFiles(e.target.files)}
                sx={{ display: "none" }} />
            </Box>
          )}

          {/* File list */}
          {bulkFiles.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {bulkFiles.map((b, i) => (
                <Box key={i} sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  p: 1.25, border: `1px solid ${BORDER}`, borderRadius: "8px",
                  bgcolor: b.status === "saved"  ? SUCCESS_BG
                         : b.status === "error"  ? "#FEF2F2"
                         : SURFACE
                }}>
                  <Typography sx={{ fontSize: 18, flexShrink: 0 }}>
                    {b.status === "extracting" ? "⏳"
                      : b.status === "ready"   ? "✅"
                      : b.status === "saved"   ? "🎉"
                      : b.status === "error"   ? "❌"
                      : "📄"}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.name || b.file.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: MUTED }}>
                      {b.status === "extracting" ? "Extracting…"
                        : b.status === "ready"   ? (b.email || "No email found")
                        : b.status === "saved"   ? "Added to pipeline ✓"
                        : b.status === "error"   ? b.error
                        : "Pending"}
                    </Typography>
                    {b.status === "extracting" && (
                      <LinearProgress sx={{ mt: 0.5, borderRadius: "3px", height: 3 }} />
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {bulkDone && (
            <Alert severity="success" sx={{ mt: 2, borderRadius: "8px" }}>
              {bulkFiles.filter(b => b.status === "saved").length} candidate(s) added to pipeline successfully.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" size="small" disabled={bulkSaving || bulkAnalyzing}
            onClick={closeBulkDialog}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
            {bulkDone ? "Close" : "Cancel"}
          </Button>
          {!bulkDone && bulkFiles.some(b => b.status === "ready") && (
            <Button variant="contained" size="small"
              onClick={handleBulkSave} disabled={bulkSaving}
              sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none",
                boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
              {bulkSaving
                ? "Saving…"
                : `Add ${bulkFiles.filter(b => b.status === "ready").length} to Pipeline`}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
