import { useEffect, useState } from "react";
import { Box, Paper, Typography, Button, TextField, MenuItem, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Checkbox, FormControlLabel,
  Tabs, Tab, Tooltip } from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706", WARN_BG = "#FFFBEB", WARN_BR = "#FDE68A";
const DANGER = "#DC2626", DANGER_BG = "#FEF2F2", DANGER_BR = "#FECACA";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";
const SURFACE = "#FAFBFD";

const STAGES = ["Screening","Interview","Assessment","Offer","Selected","Rejected"];

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };
}

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { headers: authHeader() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPatch(path, body) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(path, body) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    method: "POST", headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDelete(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { method: "DELETE", headers: authHeader() });
  if (!res.ok) throw new Error(await res.text());
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function Badge({ label, variant = "neutral" }) {
  const s = {
    success:{bg:SUCCESS_BG,border:SUCCESS_BR,color:SUCCESS},
    warning:{bg:WARN_BG,border:WARN_BR,color:WARN},
    danger:{bg:DANGER_BG,border:DANGER_BR,color:DANGER},
    accent:{bg:ACCENT_BG,border:ACCENT_BR,color:ACCENT},
    neutral:{bg:"#F1F3F7",border:BORDER,color:MUTED},
    purple:{bg:PURPLE_BG,border:PURPLE_BR,color:PURPLE},
  }[variant]??{bg:"#F1F3F7",border:BORDER,color:MUTED};
  return (
    <Box sx={{display:"inline-flex",alignItems:"center",bgcolor:s.bg,border:`1px solid ${s.border}`,
      borderRadius:"20px",px:1.25,py:0.25,fontSize:11,fontWeight:600,color:s.color,whiteSpace:"nowrap"}}>
      {label}
    </Box>
  );
}

function NewTag() {
  return (
    <Box sx={{display:"inline-flex",alignItems:"center",px:"7px",py:"2px",
      bgcolor:PURPLE_BG,border:`1px solid ${PURPLE_BR}`,borderRadius:"4px",
      fontSize:10,fontWeight:600,color:PURPLE,ml:1}}>NEW</Box>
  );
}

function Card({ children, sx={}, isNew=false }) {
  return (
    <Paper elevation={0} sx={{border:`1px solid ${isNew?PURPLE_BR:BORDER}`,borderRadius:"10px",
      boxShadow:"0 1px 3px rgba(0,0,0,0.05)",overflow:"hidden",bgcolor:"#fff",...sx}}>
      {children}
    </Paper>
  );
}

function CardHead({ title, action, isNew=false }) {
  return (
    <Box sx={{px:2.25,py:1.5,borderBottom:`1px solid ${BORDER}`,
      display:"flex",alignItems:"center",justifyContent:"space-between",bgcolor:"#fff"}}>
      <Box sx={{display:"flex",alignItems:"center",gap:0.75}}>
        {isNew && <Typography sx={{fontSize:15}}>✦</Typography>}
        <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>{title}</Typography>
        {isNew && <NewTag />}
      </Box>
      {action}
    </Box>
  );
}

function TabEmptyState({ icon, title, desc }) {
  return (
    <Box sx={{ py: "40px", textAlign: "center" }}>
      <Box sx={{ fontSize: 36, mb: "10px", color: "#C7CDD6" }}>{icon}</Box>
      <Box sx={{ fontSize: 13, fontWeight: 700, color: TEXT, mb: "4px" }}>{title}</Box>
      {desc && <Box sx={{ fontSize: 11.5, color: MUTED }}>{desc}</Box>}
    </Box>
  );
}

const TABS = [
  { key: "jobs",       label: "Jobs Applied" },
  { key: "activity",   label: "Activity Pipeline" },
  { key: "notes",      label: "Recruiter's Note" },
  { key: "cv",         label: "CV / Resume" },
  { key: "email",      label: "Email" },
  { key: "files",      label: "Files" },
  { key: "meetings",   label: "Meetings" },
];

// ─── One row in the Jobs Applied tab — owns its own message/stage/interview
// -analysis state so expanding/acting on one job never touches another. ───
function JobApplicationRow({ application, candidateId, candidateName, candidateEmail,
    expanded, onToggle, onStageChanged, onOpenQuestions }) {

  const [selectedStage, setSelectedStage] = useState(application.stage);
  const [stageLoading,  setStageLoading]  = useState(false);
  const [msgType,    setMsgType]    = useState("INTERVIEW_INVITE");
  const [msgPrompt,  setMsgPrompt]  = useState("");
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgResult,  setMsgResult]  = useState(null);
  const [msgError,   setMsgError]   = useState(null);
  const [analyses,        setAnalyses]        = useState([]);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => { setSelectedStage(application.stage); }, [application.stage]);

  useEffect(() => {
    if (!expanded) return;
    setAnalysesLoading(true);
    apiGet(`/api/candidates/${candidateId}/interview-analysis?jobId=${application.jobId}`)
      .then(d => setAnalyses(d || []))
      .catch(() => {})
      .finally(() => setAnalysesLoading(false));
  }, [expanded, candidateId, application.jobId]);

  async function changeStage(stage) {
    setStageLoading(true);
    try {
      await apiPatch(`/api/candidates/${candidateId}/applications/${application.id}/stage`, { stage });
      onStageChanged(application.id, stage);
    } catch (e) { console.error(e); }
    finally { setStageLoading(false); }
  }

  async function handleGenerateMessage() {
    setMsgLoading(true); setMsgError(null); setMsgResult(null);
    try {
      const data = await apiPost("/api/messages/generate", {
        candidateId, jobId: application.jobId, messageType: msgType,
        customPrompt: msgPrompt || null,
      });
      setMsgResult(data);
    } catch (e) { setMsgError(e.message); }
    finally { setMsgLoading(false); }
  }

  const latestAnalysis = analyses[0];

  return (
    <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden", mb: 1.25 }}>
      <Box onClick={onToggle} sx={{ px: 2, py: 1.5, bgcolor: SURFACE, display: "flex",
        alignItems: "center", justifyContent: "space-between", cursor: "pointer",
        "&:hover": { bgcolor: "#F0F2F6" } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
            {application.jobTitle || "Untitled Role"}
          </Typography>
          <Typography sx={{ fontSize: 12, color: MUTED }}>{application.jobCompany}</Typography>
          <Badge label={application.stage} variant={
            application.stage === "Selected" ? "success" :
            application.stage === "Rejected" ? "danger" : "accent"} />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: MUTED }}>
            Applied {application.createdAt ? new Date(application.createdAt).toLocaleDateString("en-GB") : ""}
          </Typography>
          <Typography sx={{ fontSize: 13, color: MUTED }}>{expanded ? "▾" : "▸"}</Typography>
        </Box>
      </Box>

      {expanded && (
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>

          {/* Stage stepper */}
          <Box>
            <Box sx={{ display: "flex", mb: 1 }}>
              {["Screening","Interview","Assessment","Offer","Selected"].map((s,i) => {
                const isCurrent = application.stage === s;
                const isPast    = STAGES.indexOf(application.stage) > i;
                return (
                  <Box key={s} sx={{flex:1,py:"8px",px:"10px",textAlign:"center",fontSize:10.5,fontWeight:500,
                    bgcolor: isCurrent ? ACCENT_BG : isPast ? "#F0FDF4" : "#fff",
                    color:   isCurrent ? ACCENT    : isPast ? SUCCESS    : MUTED,
                    border:`1px solid ${isCurrent?ACCENT:isPast?SUCCESS_BR:BORDER}`,
                    borderRight: i < 4 ? "none" : `1px solid ${isCurrent?ACCENT:BORDER}`,
                    borderRadius: i===0?"6px 0 0 6px":i===4?"0 6px 6px 0":"0",
                  }}>{s}</Box>
                );
              })}
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <TextField select size="small" value={selectedStage} onChange={e => setSelectedStage(e.target.value)}
                sx={{width:180,"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}}>
                {STAGES.map(s => <MenuItem key={s} value={s} sx={{fontSize:12}}>{s}</MenuItem>)}
              </TextField>
              <Button variant="contained" size="small" disabled={stageLoading}
                onClick={() => changeStage(selectedStage)}
                sx={{fontSize:11,bgcolor:ACCENT,borderRadius:"6px",textTransform:"none",boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
                {stageLoading ? <CircularProgress size={12} sx={{color:"#fff"}} /> : "Update Stage"}
              </Button>
              <Button variant="contained" size="small" disabled={stageLoading || application.stage === "Selected"}
                onClick={() => changeStage("Selected")}
                sx={{fontSize:11,bgcolor:SUCCESS,borderRadius:"6px",textTransform:"none",boxShadow:"none","&:hover":{bgcolor:"#15803D",boxShadow:"none"},"&.Mui-disabled":{bgcolor:SUCCESS_BG,color:SUCCESS}}}>
                ✓ {application.stage === "Selected" ? "Approved" : "Approve"}
              </Button>
              <Button variant="contained" size="small" disabled={stageLoading || application.stage === "Rejected"}
                onClick={() => changeStage("Rejected")}
                sx={{fontSize:11,bgcolor:DANGER,borderRadius:"6px",textTransform:"none",boxShadow:"none","&:hover":{bgcolor:"#B91C1C",boxShadow:"none"},"&.Mui-disabled":{bgcolor:DANGER_BG,color:DANGER}}}>
                ✗ {application.stage === "Rejected" ? "Rejected" : "Reject"}
              </Button>
              {(application.stage === "Selected" || application.stage === "Rejected") && (
                <Button variant="outlined" size="small" disabled={stageLoading}
                  onClick={() => changeStage("Screening")}
                  sx={{fontSize:11,borderRadius:"6px",textTransform:"none",borderColor:WARN,color:WARN,"&:hover":{bgcolor:WARN_BG,borderColor:WARN}}}>
                  ↩ Revert to Screening
                </Button>
              )}
              <Button variant="outlined" size="small" onClick={() => onOpenQuestions(application)}
                sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none","&:hover":{bgcolor:SURFACE}}}>
                💡 Suggested Questions
              </Button>
            </Box>
          </Box>

          {/* AI Message Generator */}
          <Card isNew>
            <CardHead title="AI Message Generator" isNew />
            <Box sx={{p:2}}>
              <Box sx={{display:"flex",gap:1,flexWrap:"wrap",mb:1}}>
                {[["INTERVIEW_INVITE","Interview Invitation"],["FOLLOW_UP","Follow-up"],
                  ["REJECTION","Rejection"],["OFFER","Offer"]].map(([v,label]) => (
                  <Button key={v} size="small" variant={msgType===v?"contained":"outlined"}
                    onClick={() => setMsgType(v)}
                    sx={{fontSize:11,borderRadius:"6px",textTransform:"none",
                      ...(msgType===v ? {bgcolor:ACCENT,boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}
                        : {borderColor:BORDER,color:TEXT,"&:hover":{borderColor:ACCENT,color:ACCENT}})}}>
                    {label}
                  </Button>
                ))}
              </Box>
              <TextField multiline rows={2} fullWidth value={msgPrompt}
                onChange={e => setMsgPrompt(e.target.value)}
                placeholder={`e.g. 'Write a professional ${msgType.toLowerCase().replace("_"," ")} for ${candidateName}'`}
                sx={{mb:1.5,"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}} />
              <Button variant="contained" onClick={handleGenerateMessage} disabled={msgLoading}
                sx={{fontSize:12,fontWeight:600,bgcolor:PURPLE,borderRadius:"8px",textTransform:"none",
                  mb:msgResult?1.5:0,boxShadow:"none","&:hover":{bgcolor:"#6D28D9",boxShadow:"none"}}}>
                {msgLoading ? <><CircularProgress size={14} sx={{color:"#fff",mr:1}} /> Generating…</> : "✦ Generate Message"}
              </Button>
              {msgError && <Alert severity="error" sx={{mt:1}}>{msgError}</Alert>}
              {msgResult && (
                <Box sx={{bgcolor:"#F8F7FF",border:`1px solid ${PURPLE_BR}`,borderRadius:"7px",p:1.75}}>
                  <Box sx={{mb:1}}>
                    <Typography sx={{fontSize:11,fontWeight:600,color:TEXT,mb:0.5}}>Subject</Typography>
                    <TextField fullWidth size="small" defaultValue={msgResult.subject}
                      sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}} />
                  </Box>
                  <TextField multiline rows={6} fullWidth defaultValue={msgResult.body}
                    sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12,fontFamily:"monospace"}}} />
                  <Box sx={{display:"flex",gap:1,mt:1.25}}>
                    <Button variant="contained" size="small" onClick={() => nav("/email", {
                        state: { candidateId, candidateName, toAddress: candidateEmail || "",
                          subject: msgResult.subject || "", body: msgResult.body || "" }
                      })}
                      sx={{flex:1,fontSize:11,bgcolor:ACCENT,borderRadius:"6px",textTransform:"none",boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
                      ✉ Send Email
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => navigator.clipboard?.writeText(msgResult.body)}
                      sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>
                      📋 Copy
                    </Button>
                    <Button size="small" variant="outlined" onClick={handleGenerateMessage}
                      sx={{fontSize:11,borderColor:PURPLE_BR,color:PURPLE,borderRadius:"6px",textTransform:"none"}}>
                      ✦ Regenerate
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          </Card>

          {/* Interview Analysis (compact) */}
          <Card>
            <CardHead title="Interview Analysis" action={
              <Box sx={{ display:"flex", gap:1 }}>
                <Button size="small" onClick={() => nav(`/candidates/${candidateId}/interview-analysis`)}
                  sx={{ fontSize: 11, textTransform:"none", color: PURPLE }}>Analyze Transcript</Button>
              </Box>
            } />
            <Box sx={{p:2}}>
              {analysesLoading ? (
                <Box sx={{ display:"flex", justifyContent:"center", py:1.5 }}><CircularProgress size={18} /></Box>
              ) : !latestAnalysis ? (
                <Typography sx={{fontSize:12,color:MUTED}}>No interview analysis for this job yet.</Typography>
              ) : (
                <Box>
                  <Box sx={{ display:"flex", gap:1.5, flexWrap:"wrap", mb:1 }}>
                    {[["Communication",latestAnalysis.communicationScore],["Technical",latestAnalysis.technicalScore],
                      ["Cultural Fit",latestAnalysis.culturalFitScore]].map(([label,score]) => (
                      <Box key={label} sx={{ fontSize:11, color:MUTED }}>
                        {label}: <b style={{color:TEXT}}>{score ?? "—"}</b>
                      </Box>
                    ))}
                  </Box>
                  {latestAnalysis.hiringRecommendation && (
                    <Badge label={latestAnalysis.hiringRecommendation} variant={
                      /strong yes|yes/i.test(latestAnalysis.hiringRecommendation) ? "success" :
                      /no/i.test(latestAnalysis.hiringRecommendation) ? "danger" : "warning"} />
                  )}
                  <Button size="small" onClick={() => nav(`/candidates/${candidateId}/interview-analysis`)}
                    sx={{ display:"block", mt:1, fontSize: 11, textTransform:"none", color: ACCENT }}>
                    View Full Report →
                  </Button>
                </Box>
              )}
            </Box>
          </Card>
        </Box>
      )}
    </Box>
  );
}

export default function CandidateWorkflowPage() {
  const { candidateId } = useParams();
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  const [candidate,     setCandidate]     = useState(null);
  const [workflow,      setWorkflow]      = useState(null); // only used for activityTimeline + capabilityScore/riskLevel
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [linkedContact,      setLinkedContact]      = useState(null);
  const [linkedClientNotes,  setLinkedClientNotes]  = useState([]);
  const [notes,         setNotes]         = useState([]);
  const [notesLoading,  setNotesLoading]  = useState(true);
  const [newNote,       setNewNote]       = useState("");
  const [addingNote,    setAddingNote]    = useState(false);
  const [noteError,     setNoteError]     = useState(null);
  const [analysisRunning,  setAnalysisRunning]  = useState(false);
  const [analysisError,    setAnalysisError]    = useState(null);

  const [tab, setTab] = useState("jobs");

  // Jobs Applied
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState(null);

  // Work Experience / Education
  const [experience, setExperience] = useState(null);
  const [experienceLoading, setExperienceLoading] = useState(true);
  const [experienceRegenerating, setExperienceRegenerating] = useState(false);

  // Email tab
  const [emails, setEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(true);

  // Files tab
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileError, setFileError] = useState("");

  // Meetings tab
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);

  // Format CV dialog state
  const [formatCvOpen,            setFormatCvOpen]            = useState(false);
  const [formatCvTemplates,       setFormatCvTemplates]       = useState([]);
  const [formatCvTemplatesLoading, setFormatCvTemplatesLoading] = useState(false);
  const [formatCvTemplateId,      setFormatCvTemplateId]      = useState("");
  const [formatCvAttachScore,     setFormatCvAttachScore]     = useState(false);
  const [formatCvLoading,         setFormatCvLoading]         = useState(false);
  const [formatCvError,           setFormatCvError]           = useState("");
  const [newTemplateName,       setNewTemplateName]       = useState("");
  const [newTemplateFile,       setNewTemplateFile]       = useState(null);
  const [newTemplateUploading,  setNewTemplateUploading]  = useState(false);
  const [newTemplateError,      setNewTemplateError]      = useState("");

  // Suggestive Questions dialog state — shared across Jobs Applied rows;
  // `questionsApp` tracks which application it's currently targeting.
  const [questionsOpen,       setQuestionsOpen]       = useState(false);
  const [questionsApp,        setQuestionsApp]        = useState(null);
  const [questionsData,       setQuestionsData]       = useState(null);
  const [questionsGenerating, setQuestionsGenerating] = useState(false);
  const [questionsSaving,     setQuestionsSaving]     = useState(false);
  const [questionsSaved,      setQuestionsSaved]      = useState(false);
  const [expandedSections,    setExpandedSections]    = useState({});

  useEffect(() => {
    setLoading(true);
    apiGet(`/api/candidates/${candidateId}`)
      .then(setCandidate)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));

    apiGet(`/api/candidates/${candidateId}/workflow`).then(setWorkflow).catch(() => {});

    setApplicationsLoading(true);
    apiGet(`/api/candidates/${candidateId}/applications`)
      .then(d => setApplications(d || []))
      .catch(() => {})
      .finally(() => setApplicationsLoading(false));

    setExperienceLoading(true);
    apiGet(`/api/candidates/${candidateId}/experience`)
      .then(setExperience)
      .catch(() => {})
      .finally(() => setExperienceLoading(false));

    setNotesLoading(true);
    apiGet(`/api/candidates/${candidateId}/notes`)
      .then(d => setNotes(d || []))
      .catch(() => {})
      .finally(() => setNotesLoading(false));

    setEmailsLoading(true);
    apiGet(`/api/emails/history?candidateId=${candidateId}`)
      .then(d => setEmails(d || []))
      .catch(() => {})
      .finally(() => setEmailsLoading(false));

    setFilesLoading(true);
    apiGet(`/api/candidates/${candidateId}/files`)
      .then(d => setFiles(d || []))
      .catch(() => {})
      .finally(() => setFilesLoading(false));

    setMeetingsLoading(true);
    apiGet(`/api/interviews/candidate/${candidateId}`)
      .then(d => setMeetings(d || []))
      .catch(() => {})
      .finally(() => setMeetingsLoading(false));
  }, [candidateId]);

  // Reverse lookup — is this candidate linked to a Client Contact?
  useEffect(() => {
    setLinkedContact(null);
    setLinkedClientNotes([]);
    apiGet(`/api/contacts/by-candidate/${candidateId}`)
      .then(c => {
        setLinkedContact(c);
        return apiGet(`/api/clients/${c.clientId}/notes`);
      })
      .then(n => setLinkedClientNotes(n || []))
      .catch(() => {});
  }, [candidateId]);

  function handleStageChanged(applicationId, stage) {
    setApplications(prev => prev.map(a => a.id === applicationId ? { ...a, stage } : a));
  }

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    setNoteError(null);
    try {
      await apiPost(`/api/candidates/${candidateId}/notes`, { note: newNote.trim() });
      const updated = await apiGet(`/api/candidates/${candidateId}/notes`);
      setNotes(updated || []);
      setNewNote("");
    } catch(e) { setNoteError(e.message); }
    finally { setAddingNote(false); }
  }

  async function handleRunAnalysis() {
    if (!candidate?.cvText?.trim()) {
      setAnalysisError("Please upload a CV first before running analysis.");
      return;
    }
    setAnalysisRunning(true); setAnalysisError(null);
    try {
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/analyze`);
      url.searchParams.set("loginId", loginId);
      await fetch(url.toString(), { method: "POST", headers: authHeader() });
      const updated = await apiGet(`/api/candidates/${candidateId}/workflow`);
      setWorkflow(updated);
      nav(`/analysis/${candidateId}`);
    } catch(e) { setAnalysisError(e.message); }
    finally { setAnalysisRunning(false); }
  }

  async function handleRegenerateExperience() {
    setExperienceRegenerating(true);
    try {
      const data = await apiPost(`/api/candidates/${candidateId}/experience/generate`, {});
      setExperience(data);
    } catch (e) { console.error(e); }
    finally { setExperienceRegenerating(false); }
  }

  // ── CV templates / Format CV ──────────────────────────────────────────────

  async function loadCvTemplates() {
    setFormatCvTemplatesLoading(true);
    try {
      const data = await apiGet(`/api/cv-templates`);
      setFormatCvTemplates(data ?? []);
      if ((data ?? []).length > 0) setFormatCvTemplateId(prev => prev || data[0].id);
    } catch (e) {
      setFormatCvError(e.message || "Failed to load CV templates");
    } finally {
      setFormatCvTemplatesLoading(false);
    }
  }

  function openFormatCvDialog() {
    setFormatCvError("");
    setFormatCvOpen(true);
    loadCvTemplates();
  }

  async function handleUploadNewTemplate() {
    if (!newTemplateFile || !newTemplateName.trim()) {
      setNewTemplateError("Please provide a name and a .docx file.");
      return;
    }
    setNewTemplateUploading(true); setNewTemplateError("");
    try {
      const fd = new FormData();
      fd.append("file", newTemplateFile);
      const url = new URL(`${API_BASE}/api/cv-templates`);
      url.searchParams.set("loginId", loginId);
      url.searchParams.set("name", newTemplateName.trim());
      const res = await fetch(url.toString(), { method: "POST", headers: authHeader(), body: fd });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Failed to upload template");
      const created = await res.json();
      setFormatCvTemplates(prev => [created, ...prev]);
      setFormatCvTemplateId(created.id);
      setNewTemplateName(""); setNewTemplateFile(null);
    } catch (e) {
      setNewTemplateError(e.message || "Failed to upload template");
    } finally {
      setNewTemplateUploading(false);
    }
  }

  async function handleDeleteTemplate(templateId) {
    if (!window.confirm("Delete this CV template?")) return;
    try {
      const url = new URL(`${API_BASE}/api/cv-templates/${templateId}`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { method: "DELETE", headers: authHeader() });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Failed to delete template");
      setFormatCvTemplates(prev => prev.filter(t => t.id !== templateId));
      if (formatCvTemplateId === templateId) setFormatCvTemplateId("");
    } catch (e) {
      setFormatCvError(e.message || "Failed to delete template");
    }
  }

  async function handleFormatCv() {
    if (!formatCvTemplateId) { setFormatCvError("Please select a CV template."); return; }
    setFormatCvLoading(true); setFormatCvError("");
    try {
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/format-cv`);
      url.searchParams.set("loginId", loginId);
      url.searchParams.set("templateId", formatCvTemplateId);
      url.searchParams.set("attachScore", formatCvAttachScore ? "true" : "false");
      const res = await fetch(url.toString(), { method: "POST", headers: authHeader() });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Failed to format CV");
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${(candidate.name || "candidate").replace(/\s+/g, "_")}_formatted_cv.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
      setFormatCvOpen(false);
    } catch (e) {
      setFormatCvError(e.message || "Failed to format CV");
    } finally {
      setFormatCvLoading(false);
    }
  }

  // ── Suggested Questions (shared dialog, scoped to questionsApp) ───────────

  function parseQuestionsJson(raw) {
    if (!raw) return null;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed && parsed.questions && parsed.skillsRequired) return parsed;
    } catch {
      // not valid JSON — fall through to null
    }
    return null;
  }

  function handleOpenQuestions(application) {
    setQuestionsApp(application);
    setQuestionsData(parseQuestionsJson(application.interviewQuestions));
    setQuestionsSaved(false);
    setExpandedSections({ coreSkills: true, gapBased: true, experienceDeepDive: true,
      behavioural: true, authenticityCheck: true, communicationCultural: true });
    setQuestionsOpen(true);
  }

  async function handleGenerateQuestions() {
    if (!questionsApp) return;
    setQuestionsGenerating(true);
    try {
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/interview-questions/generate`);
      url.searchParams.set("loginId", loginId);
      url.searchParams.set("jobId", questionsApp.jobId);
      const res = await fetch(url.toString(), { method: "POST", headers: authHeader() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuestionsData(data);
      setExpandedSections({ coreSkills: true, gapBased: true, experienceDeepDive: true,
        behavioural: true, authenticityCheck: true, communicationCultural: true });
    } catch (e) { console.error("Generate questions failed", e); }
    finally { setQuestionsGenerating(false); }
  }

  async function handleSaveQuestions() {
    if (!questionsData || !questionsApp) return;
    setQuestionsSaving(true);
    try {
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/interview-questions`);
      url.searchParams.set("loginId", loginId);
      url.searchParams.set("jobId", questionsApp.jobId);
      await fetch(url.toString(), {
        method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ questions: questionsData }),
      });
      setApplications(prev => prev.map(a => a.id === questionsApp.id
        ? { ...a, interviewQuestions: JSON.stringify(questionsData) } : a));
      setQuestionsSaved(true);
      setTimeout(() => setQuestionsSaved(false), 2500);
    } catch (e) { console.error("Save questions failed", e); }
    finally { setQuestionsSaving(false); }
  }

  // ── Files tab ──────────────────────────────────────────────────────────────

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileUploading(true); setFileError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/files`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { method: "POST", headers: authHeader(), body: fd });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || "Failed to upload file");
      const created = await res.json();
      setFiles(prev => [created, ...prev]);
    } catch (e) {
      setFileError(e.message || "Failed to upload file.");
    } finally {
      setFileUploading(false);
    }
  }

  async function handleFileDelete(fileId) {
    if (!window.confirm("Delete this file?")) return;
    try {
      await apiDelete(`/api/candidates/${candidateId}/files/${fileId}`);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (e) {
      setFileError(e.message || "Failed to delete file.");
    }
  }

  function handleFileDownload(f) {
    const url = new URL(`${API_BASE}/api/candidates/${candidateId}/files/${f.id}`);
    url.searchParams.set("loginId", loginId);
    fetch(url.toString(), { headers: authHeader() })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = f.fileName;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => setFileError("Failed to download file."));
  }

  // ── Meetings tab ───────────────────────────────────────────────────────────

  async function handleCancelMeeting(interviewId) {
    if (!window.confirm("Cancel this interview?")) return;
    try {
      await apiPatch(`/api/interviews/${interviewId}/cancel`, {});
      setMeetings(prev => prev.map(m => m.id === interviewId ? { ...m, status: "Cancelled" } : m));
    } catch (e) { console.error(e); }
  }

  if (loading) return <Box sx={{p:4,textAlign:"center"}}><CircularProgress /></Box>;
  if (error)   return <Alert severity="error">{error}</Alert>;
  if (!candidate) return null;

  const isAnalysed = workflow?.capabilityScore != null;

  return (
    <Box sx={{display:"flex",flexDirection:"column",gap:2}}>
      {/* Header — person info only */}
      <Box sx={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",
        border:`1px solid ${BORDER}`,borderRadius:"10px",p:"18px 22px",bgcolor:"#fff"}}>
        <Box sx={{display:"flex",gap:2,alignItems:"center"}}>
          <Box sx={{width:52,height:52,borderRadius:"50%",bgcolor:ACCENT,color:"#fff",display:"flex",
            alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,flexShrink:0}}>
            {candidate.name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
          </Box>
          <Box>
            <Typography sx={{fontSize:18,fontWeight:700,color:TEXT}}>{candidate.name}</Typography>
            {candidate.currentTitle && (
              <Typography sx={{fontSize:13,color:MUTED,mt:0.25}}>{candidate.currentTitle}</Typography>
            )}
            <Box sx={{display:"flex",gap:0.75,flexWrap:"wrap",mt:1}}>
              {candidate.email && <Badge label={`✉ ${candidate.email}`} />}
              {candidate.phone && <Badge label={`☎ ${candidate.phone}`} />}
              {(candidate.location || candidate.state) && (
                <Badge label={`📍 ${[candidate.location, candidate.state].filter(Boolean).join(", ")}`} />
              )}
              {candidate.linkedinUrl && (
                <Box component="a" href={candidate.linkedinUrl} target="_blank" rel="noopener noreferrer"
                  sx={{textDecoration:"none"}}>
                  <Badge label="🔗 LinkedIn" variant="accent" />
                </Box>
              )}
            </Box>
          </Box>
        </Box>
        <Box sx={{display:"flex",gap:1,flexShrink:0}}>
          <Button variant="outlined" size="small" onClick={() => nav("/candidates")}
            sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>
            ← Back
          </Button>
          <Button variant="outlined" size="small"
            onClick={() => nav("/candidates/new", { state: { prefill: { candidateId } } })}
            sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>
            ✎ Edit Profile
          </Button>
          <Button variant="outlined" size="small"
            onClick={() => nav("/email", { state: { candidateId, candidateName: candidate.name, toAddress: candidate.email || "" } })}
            sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>
            ✉ Send Email
          </Button>
          <Button variant="contained" size="small"
            onClick={() => nav("/scheduler", { state: { candidateId } })}
            sx={{fontSize:11,bgcolor:ACCENT,borderRadius:"6px",textTransform:"none",boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
            📅 Schedule Interview
          </Button>
        </Box>
      </Box>

      {/* Linked Client Contact */}
      {linkedContact && (
        <Paper elevation={0} sx={{ border:`1px solid ${BORDER}`, borderRadius:"10px", p:"16px 18px", bgcolor:"#fff" }}>
          <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", mb:"8px" }}>
            <Box sx={{ fontSize:13, fontWeight:700, color:TEXT }}>Linked Client Contact</Box>
            <Button size="small" onClick={() => nav(`/contacts/${linkedContact.id}`)}
              sx={{ fontSize:11, textTransform:"none", color:ACCENT }}>
              View full contact profile →
            </Button>
          </Box>
          <Box sx={{ fontSize:12.5, color:TEXT, fontWeight:600 }}>{linkedContact.name}</Box>
          <Box sx={{ fontSize:11.5, color:MUTED, mt:"2px" }}>
            {[linkedContact.title, linkedContact.clientCompanyName].filter(Boolean).join(" · ") || "—"}
          </Box>
          {linkedClientNotes.length > 0 && (
            <Box sx={{ mt:"10px", pt:"10px", borderTop:`1px solid ${BORDER}` }}>
              <Box sx={{ fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", letterSpacing:".5px", mb:"6px" }}>
                Client Notes
              </Box>
              {linkedClientNotes.slice(0, 3).map((n, i) => (
                <Box key={n.id || i} sx={{ fontSize:12, color:TEXT, mb:"4px", whiteSpace:"pre-wrap" }}>{n.note}</Box>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {/* Work Experience / Education */}
      <Card>
        <CardHead title="Work Experience & Education" action={
          <Button size="small" onClick={handleRegenerateExperience} disabled={experienceRegenerating}
            sx={{fontSize:11,textTransform:"none",color:PURPLE}}>
            {experienceRegenerating ? <CircularProgress size={12} sx={{mr:0.75}} /> : "✦"} Regenerate
          </Button>
        } />
        <Box sx={{p:2.25}}>
          {experienceLoading ? (
            <Box sx={{ display:"flex", justifyContent:"center", py:2 }}><CircularProgress size={20} /></Box>
          ) : (
            <Box sx={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:3}}>
              <Box>
                <Typography sx={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:".5px",mb:1}}>
                  Work Experience
                </Typography>
                {(!experience?.workExperience || experience.workExperience.length === 0) ? (
                  <Typography sx={{fontSize:12,color:MUTED}}>No work history extracted from the CV.</Typography>
                ) : experience.workExperience.map((w, i) => (
                  <Box key={i} sx={{py:1.25,borderTop:i>0?`1px solid #F0F2F6`:"none"}}>
                    <Typography sx={{fontSize:12.5,fontWeight:600,color:TEXT}}>{w.title} · {w.company}</Typography>
                    <Typography sx={{fontSize:11,color:MUTED,mt:0.25}}>{[w.startDate, w.endDate].filter(Boolean).join(" – ")}</Typography>
                    {w.description && <Typography sx={{fontSize:11.5,color:TEXT,mt:0.5}}>{w.description}</Typography>}
                  </Box>
                ))}
              </Box>
              <Box>
                <Typography sx={{fontSize:11,fontWeight:700,color:MUTED,textTransform:"uppercase",letterSpacing:".5px",mb:1}}>
                  Education
                </Typography>
                {(!experience?.education || experience.education.length === 0) ? (
                  <Typography sx={{fontSize:12,color:MUTED}}>No education history extracted from the CV.</Typography>
                ) : experience.education.map((ed, i) => (
                  <Box key={i} sx={{py:1.25,borderTop:i>0?`1px solid #F0F2F6`:"none"}}>
                    <Typography sx={{fontSize:12.5,fontWeight:600,color:TEXT}}>{ed.degree}{ed.fieldOfStudy ? ` — ${ed.fieldOfStudy}` : ""}</Typography>
                    <Typography sx={{fontSize:11,color:MUTED,mt:0.25}}>{ed.institution}</Typography>
                    <Typography sx={{fontSize:11,color:MUTED}}>{[ed.startDate, ed.endDate].filter(Boolean).join(" – ")}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
        borderBottom: `1px solid ${BORDER}`,
        "& .MuiTab-root": { fontSize: 12.5, fontWeight: 600, textTransform: "none", minHeight: 40, color: MUTED },
        "& .Mui-selected": { color: ACCENT },
        "& .MuiTabs-indicator": { bgcolor: ACCENT },
      }}>
        {TABS.map(t => {
          const badge =
            t.key === "jobs"     ? applications.length :
            t.key === "notes"    ? notes.length :
            t.key === "email"    ? emails.length :
            t.key === "files"    ? files.length :
            t.key === "meetings" ? meetings.length : null;
          return (
            <Tab key={t.key} value={t.key} label={
              <Box sx={{ display:"flex", alignItems:"center", gap:"6px" }}>
                {t.label}
                {badge !== null && (
                  <Box sx={{ fontSize:10, fontWeight:700, color:MUTED, bgcolor:"#F1F3F7", borderRadius:"10px", px:"6px", py:"1px" }}>{badge}</Box>
                )}
              </Box>
            } />
          );
        })}
      </Tabs>

      <Paper elevation={0} sx={{ border:`1px solid ${BORDER}`, borderRadius:"10px", p:"18px", bgcolor:"#fff" }}>

        {tab === "jobs" && (
          applicationsLoading ? <Box sx={{ display:"flex", justifyContent:"center", py:4 }}><CircularProgress size={20} /></Box> :
          applications.length === 0 ? <TabEmptyState icon="💼" title="No Applications Yet" desc="This candidate hasn't been added to any job yet." /> :
          applications.map(app => (
            <JobApplicationRow key={app.id} application={app}
              candidateId={candidateId} candidateName={candidate.name} candidateEmail={candidate.email}
              expanded={expandedJobId === app.id}
              onToggle={() => setExpandedJobId(prev => prev === app.id ? null : app.id)}
              onStageChanged={handleStageChanged}
              onOpenQuestions={handleOpenQuestions} />
          ))
        )}

        {tab === "activity" && (
          (workflow?.activityTimeline || []).length === 0 ? (
            <TabEmptyState icon="🕒" title="No Activity Recorded Yet" />
          ) : (
            workflow.activityTimeline.map((ev,i) => (
              <Box key={ev.id} sx={{display:"flex",gap:1.25,alignItems:"flex-start",
                py:1.25,borderBottom:i<workflow.activityTimeline.length-1?`1px solid #F0F2F6`:"none"}}>
                <Box sx={{ width:8, height:8, borderRadius:"50%", bgcolor:ACCENT, mt:"5px", flexShrink:0 }} />
                <Box>
                  <Typography sx={{fontSize:12,fontWeight:600,color:TEXT}}>{ev.description}</Typography>
                  {ev.note && <Typography sx={{fontSize:11,color:MUTED,mt:0.25}}>{ev.note}</Typography>}
                  <Typography sx={{fontSize:10,color:MUTED,mt:0.25}}>
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString("en-GB") : ""}
                  </Typography>
                </Box>
              </Box>
            ))
          )
        )}

        {tab === "notes" && (
          <Box>
            <TextField multiline rows={3} fullWidth value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Add a note…" disabled={addingNote}
              sx={{mb:1,"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}} />
            <Button variant="outlined" size="small" onClick={handleAddNote}
              disabled={addingNote || !newNote.trim()}
              sx={{mb:1.5,fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>
              {addingNote ? <CircularProgress size={12} /> : "Add Note"}
            </Button>
            {noteError && <Typography sx={{fontSize:11,color:DANGER,mb:1}}>{noteError}</Typography>}
            {notesLoading ? (
              <Box sx={{ display:"flex", justifyContent:"center", py:2 }}><CircularProgress size={18} /></Box>
            ) : notes.length === 0 ? (
              <TabEmptyState icon="📝" title="No Notes Yet" />
            ) : (
              notes.map((n,i) => (
                <Box key={n.id} sx={{py:1,borderTop:i>0?`1px solid #F0F2F6`:"none"}}>
                  <Typography sx={{fontSize:12,color:TEXT,whiteSpace:"pre-wrap"}}>{n.note}</Typography>
                  <Typography sx={{fontSize:10,color:MUTED,mt:0.25}}>
                    {n.createdAt ? new Date(n.createdAt).toLocaleString("en-GB") : ""}
                  </Typography>
                </Box>
              ))
            )}
          </Box>
        )}

        {tab === "cv" && (
          <Box>
            {analysisError && <Alert severity="error" sx={{mb:1.5}} onClose={() => setAnalysisError(null)}>{analysisError}</Alert>}
            <Box sx={{ display:"flex", gap:1, flexWrap:"wrap", mb:2 }}>
              <Button variant="outlined" size="small" disabled={!candidate.cvText?.trim()} onClick={openFormatCvDialog}
                sx={{fontSize:11,borderColor:ACCENT_BR,color:ACCENT,borderRadius:"6px",textTransform:"none","&:hover":{bgcolor:ACCENT_BG},"&.Mui-disabled":{borderColor:BORDER,color:MUTED}}}>
                📄 Format CV
              </Button>
              {!candidate.cvText?.trim() && (
                <Button variant="outlined" size="small"
                  onClick={() => nav("/candidates/new", { state: { prefill: {
                    name: candidate.name ?? "", email: candidate.email ?? "",
                    linkedinUrl: candidate.linkedinUrl ?? "", cvText: "" } } })}
                  sx={{fontSize:11,borderColor:WARN_BR,color:WARN,borderRadius:"6px",textTransform:"none","&:hover":{bgcolor:WARN_BG,borderColor:WARN}}}>
                  ⬆ Upload CV
                </Button>
              )}
              {isAnalysed ? (
                <Button variant="contained" size="small" onClick={() => nav(`/analysis/${candidateId}`)}
                  sx={{fontSize:11,bgcolor:ACCENT,borderRadius:"6px",textTransform:"none",boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
                  📊 View Analysis {workflow?.capabilityScore != null ? `(${workflow.capabilityScore}%)` : ""}
                </Button>
              ) : (
                <Button variant="contained" size="small" onClick={handleRunAnalysis} disabled={analysisRunning}
                  sx={{fontSize:11,bgcolor:PURPLE,borderRadius:"6px",textTransform:"none",boxShadow:"none","&:hover":{bgcolor:"#6D28D9",boxShadow:"none"}}}>
                  {analysisRunning ? <><CircularProgress size={12} sx={{color:"#fff",mr:0.75}}/> Running…</> : "🔍 Run Analysis"}
                </Button>
              )}
            </Box>
            {candidate.cvText ? (
              <Box sx={{
                bgcolor:"#F7F8FA", border:`1px solid ${BORDER}`, borderRadius:"8px",
                p:1.5, maxHeight:500, overflowY:"auto",
                fontSize:11.5, color:TEXT, lineHeight:1.7,
                fontFamily:"monospace", whiteSpace:"pre-wrap", wordBreak:"break-word"
              }}>
                {candidate.cvText}
              </Box>
            ) : (
              <TabEmptyState icon="📄" title="No CV Uploaded" />
            )}
          </Box>
        )}

        {tab === "email" && (
          <Box>
            <Box sx={{ display:"flex", justifyContent:"flex-end", mb:1.5 }}>
              <Button variant="outlined" size="small"
                onClick={() => nav("/email", { state: { candidateId, candidateName: candidate.name, toAddress: candidate.email || "" } })}
                sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>
                ✉ Send Email
              </Button>
            </Box>
            {emailsLoading ? (
              <Box sx={{ display:"flex", justifyContent:"center", py:3 }}><CircularProgress size={20} /></Box>
            ) : emails.length === 0 ? (
              <TabEmptyState icon="✉️" title="No Emails Found" />
            ) : (
              emails.map((e,i) => (
                <Box key={e.id} sx={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  py:"10px", borderBottom: i < emails.length-1 ? `1px solid ${BORDER}` : "none" }}>
                  <Box>
                    <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>{e.subject || "(no subject)"}</Typography>
                    <Typography sx={{fontSize:11,color:MUTED,mt:"2px"}}>
                      To: {e.toAddress} · {e.sentAt ? new Date(e.sentAt).toLocaleString("en-GB") : ""}
                    </Typography>
                  </Box>
                  <Badge label={e.status} variant={e.status === "Sent" ? "success" : "danger"} />
                </Box>
              ))
            )}
          </Box>
        )}

        {tab === "files" && (
          <Box>
            <Box sx={{ display:"flex", justifyContent:"flex-end", mb:1.5 }}>
              <Button component="label" size="small" variant="outlined" disabled={fileUploading}
                sx={{fontSize:11,textTransform:"none",borderRadius:"8px",borderColor:BORDER,color:TEXT}}>
                {fileUploading ? "Uploading…" : "⬆ Upload File"}
                <input type="file" hidden onChange={handleFileUpload} />
              </Button>
            </Box>
            {fileError && <Alert severity="error" sx={{mb:1.5}}>{fileError}</Alert>}
            {filesLoading ? (
              <Box sx={{ display:"flex", justifyContent:"center", py:3 }}><CircularProgress size={20} /></Box>
            ) : files.length === 0 ? (
              <TabEmptyState icon="📄" title="No Files Found" desc="Files uploaded for this candidate will appear here." />
            ) : (
              files.map((f,i) => (
                <Box key={f.id} sx={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  py:"10px", borderBottom: i < files.length-1 ? `1px solid ${BORDER}` : "none" }}>
                  <Box>
                    <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>{f.fileName}</Typography>
                    <Typography sx={{fontSize:11,color:MUTED,mt:"2px"}}>{formatBytes(f.sizeBytes)}</Typography>
                  </Box>
                  <Box sx={{ display:"flex", gap:"4px" }}>
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => handleFileDownload(f)} sx={{color:MUTED,"&:hover":{color:ACCENT}}}>⬇</IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleFileDelete(f.id)} sx={{color:MUTED,"&:hover":{color:DANGER}}}>✕</IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              ))
            )}
          </Box>
        )}

        {tab === "meetings" && (
          <Box>
            <Box sx={{ display:"flex", justifyContent:"flex-end", mb:1.5 }}>
              <Button variant="contained" size="small" onClick={() => nav("/scheduler", { state: { candidateId } })}
                sx={{fontSize:11,bgcolor:ACCENT,borderRadius:"6px",textTransform:"none",boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
                📅 Schedule Interview
              </Button>
            </Box>
            {meetingsLoading ? (
              <Box sx={{ display:"flex", justifyContent:"center", py:3 }}><CircularProgress size={20} /></Box>
            ) : meetings.length === 0 ? (
              <TabEmptyState icon="📅" title="No Meetings Scheduled" />
            ) : (
              meetings.map((m,i) => (
                <Box key={m.id} sx={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  py:"10px", borderBottom: i < meetings.length-1 ? `1px solid ${BORDER}` : "none" }}>
                  <Box>
                    <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>
                      {m.interviewType || "Interview"} — {m.jobTitle || ""}
                    </Typography>
                    <Typography sx={{fontSize:11,color:MUTED,mt:"2px"}}>
                      {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString("en-GB") : ""} · {m.interviewer || "Unassigned"}
                    </Typography>
                  </Box>
                  <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
                    <Badge label={m.status} variant={
                      m.status === "Cancelled" ? "danger" : m.status === "Completed" ? "success" : "accent"} />
                    {m.status === "Scheduled" && (
                      <Button size="small" onClick={() => handleCancelMeeting(m.id)}
                        sx={{fontSize:11,textTransform:"none",color:DANGER}}>Cancel</Button>
                    )}
                  </Box>
                </Box>
              ))
            )}
          </Box>
        )}
      </Paper>

      {/* ── Suggestive Questions Dialog ──────────────────────────────────── */}
      <Dialog open={questionsOpen} onClose={() => setQuestionsOpen(false)}
        fullWidth maxWidth="lg"
        slotProps={{ paper: { sx: { borderRadius: "12px", border: `1px solid ${BORDER}`, maxHeight: "90vh" } } }}>
        <DialogTitle sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                💡 Suggestive Interview Questions {questionsApp ? `— ${questionsApp.jobTitle}` : ""}
              </Typography>
              <NewTag />
            </Box>
            <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
              AI-generated · role-specific · evidence-based
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" variant="outlined"
              onClick={handleGenerateQuestions}
              disabled={questionsGenerating}
              sx={{ fontSize: 11, borderColor: PURPLE_BR, color: PURPLE,
                borderRadius: "6px", textTransform: "none", "&:hover": { bgcolor: PURPLE_BG } }}>
              {questionsGenerating
                ? <><CircularProgress size={12} sx={{ color: PURPLE, mr: 0.75 }} /> Generating…</>
                : questionsData ? "✦ Regenerate" : "✦ Generate Questions"}
            </Button>
            <IconButton size="small" onClick={() => setQuestionsOpen(false)} sx={{ color: MUTED }}>✕</IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, overflow: "auto" }}>
          {questionsGenerating && !questionsData ? (
            <Box sx={{ p: 5, textAlign: "center" }}>
              <CircularProgress sx={{ color: PURPLE, mb: 2 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, mb: 0.5 }}>
                Analysing candidate profile…
              </Typography>
              <Typography sx={{ fontSize: 11, color: MUTED }}>
                Identifying gaps, strengths and generating targeted questions
              </Typography>
            </Box>
          ) : !questionsData ? (
            <Box sx={{ p: 3 }}>
              <Box sx={{ p: "12px 16px", bgcolor: ACCENT_BG, border: `1px solid ${ACCENT_BR}`,
                borderRadius: "8px" }}>
                <Typography sx={{ fontSize: 12, color: ACCENT }}>
                  Click <strong>Generate Questions</strong> to get AI-suggested interview questions tailored
                  to this candidate's CV and this job's description.
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
                {[
                  { label: "Skills Required", items: questionsData.skillsRequired, color: ACCENT, bg: ACCENT_BG, border: ACCENT_BR },
                  { label: "Candidate Strengths", items: questionsData.candidateStrengths, color: SUCCESS, bg: SUCCESS_BG, border: SUCCESS_BR },
                  { label: "Identified Gaps", items: questionsData.identifiedGaps, color: DANGER, bg: DANGER_BG, border: DANGER_BR },
                ].map(({ label, items = [], color, bg, border }) => (
                  <Box key={label} sx={{ bgcolor: bg, border: `1px solid ${border}`, borderRadius: "8px", p: "10px 14px" }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase",
                      letterSpacing: ".5px", mb: 0.75 }}>{label}</Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {items.map((item, i) => (
                        <Box key={i} sx={{ bgcolor: "#fff", border: `1px solid ${border}`, borderRadius: "4px",
                          px: "7px", py: "2px", fontSize: 11, color, fontWeight: 500 }}>
                          {item}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>

              {[
                { key: "coreSkills",          label: "A. Core Skill Validation",        color: ACCENT,  count: "5–7" },
                { key: "gapBased",            label: "B. Gap & Risk-Based",             color: DANGER,  count: "3–5" },
                { key: "experienceDeepDive",  label: "C. Experience Deep-Dive",         color: PURPLE,  count: "3–5" },
                { key: "behavioural",         label: "D. Behavioural & Situational",    color: WARN,    count: "3–4" },
                { key: "authenticityCheck",   label: "E. Authenticity Check",           color: SUCCESS, count: "2–3" },
                { key: "communicationCultural", label: "F. Communication & Cultural Fit", color: "#0891B2", count: "5–7" },
              ].map(({ key, label, color }) => {
                const qs = (questionsData.questions?.[key] ?? []);
                const open = expandedSections[key] !== false;
                return (
                  <Box key={key} sx={{ border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden" }}>
                    <Box onClick={() => setExpandedSections(p => ({ ...p, [key]: !open }))}
                      sx={{ px: 2, py: 1.25, bgcolor: SURFACE, display: "flex",
                        alignItems: "center", justifyContent: "space-between", cursor: "pointer",
                        "&:hover": { bgcolor: "#F0F2F6" } }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{label}</Typography>
                        <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: "10px",
                          px: "7px", py: "1px", fontSize: 10, color: MUTED }}>
                          {qs.length} questions
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: 13, color: MUTED }}>{open ? "▾" : "▸"}</Typography>
                    </Box>

                    {open && (
                      <Box>
                        {qs.length === 0 ? (
                          <Typography sx={{ px: 2, py: 1.5, fontSize: 12, color: MUTED, fontStyle: "italic" }}>
                            No questions generated for this section.
                          </Typography>
                        ) : qs.map((q, i) => (
                          <Box key={i} sx={{ px: 2, py: 1.5,
                            borderTop: `1px solid #F0F2F6`,
                            bgcolor: i % 2 === 0 ? "#fff" : SURFACE }}>
                            <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
                              <Box sx={{ width: 20, height: 20, borderRadius: "50%",
                                bgcolor: color, color: "#fff", fontSize: 10, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, mt: "1px" }}>
                                {i + 1}
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontSize: 12, color: TEXT, lineHeight: 1.6, fontWeight: 500 }}>
                                  {typeof q === "string" ? q : q.question}
                                </Typography>
                                {Array.isArray(q.followUps) && q.followUps.length > 0 && (
                                  <Box sx={{ mt: 0.75, ml: 0.5, pl: 1.25,
                                    borderLeft: `2px solid ${color}40`, display: "flex",
                                    flexDirection: "column", gap: 0.5 }}>
                                    {q.followUps.map((fu, j) => (
                                      <Box key={j} sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}>
                                        <Typography sx={{ fontSize: 10, color, fontWeight: 700, mt: "2px",
                                          flexShrink: 0 }}>↳</Typography>
                                        <Typography sx={{ fontSize: 11, color: MUTED, lineHeight: 1.55 }}>
                                          {fu}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Box>
                                )}
                              </Box>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 1.75, borderTop: `1px solid ${BORDER}`,
          display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
          <Typography sx={{ fontSize: 11, color: MUTED }}>
            {questionsData
              ? `${Object.values(questionsData.questions ?? {}).reduce((s, a) => s + a.length, 0)} questions across 6 categories`
              : "No questions yet"}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" variant="outlined"
              onClick={() => setQuestionsOpen(false)}
              sx={{ fontSize: 11, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
              Cancel
            </Button>
            <Button size="small" variant="contained"
              onClick={handleSaveQuestions}
              disabled={questionsSaving || !questionsData}
              sx={{ fontSize: 11, bgcolor: questionsSaved ? SUCCESS : ACCENT, borderRadius: "6px",
                textTransform: "none", boxShadow: "none",
                "&:hover": { bgcolor: questionsSaved ? "#15803D" : "#1660CC", boxShadow: "none" } }}>
              {questionsSaving
                ? <><CircularProgress size={12} sx={{ color: "#fff", mr: 0.75 }} /> Saving…</>
                : questionsSaved ? "✓ Saved!" : "Save Questions"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* ── Format CV Dialog ─────────────────────────────────────────────── */}
      <Dialog open={formatCvOpen} onClose={() => !formatCvLoading && setFormatCvOpen(false)}
        maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { borderRadius: "12px", border: `1px solid ${BORDER}` } } }}>
        <DialogTitle sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT }}>📄 Format CV</Typography>
          <IconButton size="small" disabled={formatCvLoading}
            onClick={() => setFormatCvOpen(false)} sx={{ color: MUTED }}>✕</IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: 12, color: MUTED, mb: 1.75, lineHeight: 1.6 }}>
            Pick a saved CV template — the candidate's details will be stamped into it,
            preserving its exact formatting, and downloaded as a .docx file.
          </Typography>

          {formatCvTemplatesLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : formatCvTemplates.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: MUTED, mb: 1.5 }}>
              No CV templates saved yet. Upload one below to get started.
            </Typography>
          ) : (
            <>
              <TextField select fullWidth size="small" label="CV Template" value={formatCvTemplateId}
                disabled={formatCvLoading}
                onChange={e => setFormatCvTemplateId(e.target.value)}
                sx={{ mb: 0.75, "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }}>
                {formatCvTemplates.map(t => (
                  <MenuItem key={t.id} value={t.id} sx={{ fontSize: 13 }}>{t.name}</MenuItem>
                ))}
              </TextField>
              {formatCvTemplateId && (
                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
                  <Box onClick={() => handleDeleteTemplate(formatCvTemplateId)}
                    sx={{ fontSize: 11, color: DANGER, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
                    Delete selected template
                  </Box>
                </Box>
              )}
            </>
          )}

          <FormControlLabel
            sx={{ mt: 0.5, ml: 0 }}
            control={
              <Checkbox size="small" checked={formatCvAttachScore} disabled={formatCvLoading}
                onChange={e => setFormatCvAttachScore(e.target.checked)} />
            }
            label={<Typography sx={{ fontSize: 12.5, color: TEXT }}>Attach candidate analysis score with the CV</Typography>}
          />

          {formatCvError && (
            <Typography sx={{ fontSize: 12, color: DANGER, mt: 1.25, fontWeight: 500 }}>⚠ {formatCvError}</Typography>
          )}

          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, mb: 1 }}>
              Add a New Template
            </Typography>
            <TextField fullWidth size="small" placeholder="Template name (e.g. Nolyvra Standard CV)"
              value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
              disabled={newTemplateUploading}
              sx={{ mb: 1, "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }} />
            <Box
              component="label"
              htmlFor="cv-template-file-input"
              sx={{
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 0.5,
                border: `2px dashed ${newTemplateFile ? SUCCESS_BR : BORDER}`,
                borderRadius: "8px", p: "14px 12px",
                bgcolor: newTemplateFile ? SUCCESS_BG : SURFACE,
                cursor: newTemplateUploading ? "default" : "pointer", transition: "all .15s",
                "&:hover": newTemplateUploading ? {} : { borderColor: ACCENT, bgcolor: ACCENT_BG },
              }}>
              <Typography sx={{ fontSize: 18 }}>{newTemplateFile ? "✅" : "📎"}</Typography>
              <Typography sx={{ fontSize: 11.5, fontWeight: 500,
                color: newTemplateFile ? SUCCESS : TEXT, textAlign: "center" }}>
                {newTemplateFile ? newTemplateFile.name : "Click to upload a .docx template"}
              </Typography>
              <Box
                id="cv-template-file-input"
                component="input"
                type="file"
                disabled={newTemplateUploading}
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setNewTemplateFile(f);
                    setNewTemplateName(prev => prev.trim() ? prev : f.name.replace(/\.docx$/i, ""));
                  }
                  e.target.value = "";
                }}
                sx={{ display: "none" }}
              />
            </Box>
            {newTemplateError && (
              <Typography sx={{ fontSize: 11.5, color: DANGER, mt: 0.75 }}>⚠ {newTemplateError}</Typography>
            )}
            <Button size="small" variant="outlined" fullWidth onClick={handleUploadNewTemplate}
              disabled={newTemplateUploading || !newTemplateFile || !newTemplateName.trim()}
              sx={{ mt: 1, fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "7px", textTransform: "none" }}>
              {newTemplateUploading
                ? <><CircularProgress size={12} sx={{ mr: 0.75 }} /> Uploading…</>
                : "Save Template"}
            </Button>
            {!newTemplateUploading && (!newTemplateFile || !newTemplateName.trim()) && (
              <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.5 }}>
                {!newTemplateFile && !newTemplateName.trim()
                  ? "Enter a name and choose a .docx file to enable Save."
                  : !newTemplateFile
                    ? "Choose a .docx file to enable Save."
                    : "Enter a template name to enable Save."}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2.25, gap: 1 }}>
          <Button variant="outlined" size="small" disabled={formatCvLoading}
            onClick={() => setFormatCvOpen(false)}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" size="small" onClick={handleFormatCv}
            disabled={formatCvLoading || !formatCvTemplateId}
            sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none",
              boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            {formatCvLoading
              ? <><CircularProgress size={12} sx={{ color: "#fff", mr: 0.75 }} /> Building…</>
              : "Format & Download"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
