import { useEffect, useState } from "react";
import { Box, Paper, Typography, Button, TextField, MenuItem, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton } from "@mui/material";
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

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPatch(path, body) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    method: "PATCH", headers: { "Content-Type": "application/json" },
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
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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

export default function CandidateWorkflowPage() {
  const { candidateId } = useParams();
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  const [workflow,      setWorkflow]      = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [selectedStage, setSelectedStage] = useState("");
  const [stageLoading,  setStageLoading]  = useState(false);
  const [notes,         setNotes]         = useState("");
  const [notesSaving,      setNotesSaving]      = useState(false);
  const [notesSaved,       setNotesSaved]       = useState(false);
  const [analysisRunning,  setAnalysisRunning]  = useState(false); // Change 1
  const [analysisError,    setAnalysisError]    = useState(null);  // Change 1

  // Suggestive Questions dialog state
  const [questionsOpen,       setQuestionsOpen]       = useState(false);
  const [questionsData,       setQuestionsData]       = useState(null);   // parsed JSON
  const [questionsGenerating, setQuestionsGenerating] = useState(false);
  const [questionsSaving,     setQuestionsSaving]     = useState(false);
  const [questionsSaved,      setQuestionsSaved]      = useState(false);
  const [expandedSections,    setExpandedSections]    = useState({});

  // AI Message Generator state
  const [msgType,      setMsgType]      = useState("INTERVIEW_INVITE");
  const [msgPrompt,    setMsgPrompt]    = useState("");
  const [msgLoading,   setMsgLoading]   = useState(false);
  const [msgResult,    setMsgResult]    = useState(null);
  const [msgError,     setMsgError]     = useState(null);

  useEffect(() => {
    apiGet(`/api/candidates/${candidateId}/workflow`)
      .then(d => { setWorkflow(d); setSelectedStage(d.stage); setNotes(d.recruiterNotes || ""); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [candidateId]);

  async function handleUpdateStage() {
    setStageLoading(true);
    try {
      await apiPatch(`/api/candidates/${candidateId}/stage`, { stage: selectedStage, recruiterNotes: notes });
      setWorkflow(p => ({ ...p, stage: selectedStage }));
    } catch(e) { setError(e.message); }
    finally { setStageLoading(false); }
  }

  async function handleApprove() {
    setStageLoading(true);
    try {
      await apiPatch(`/api/candidates/${candidateId}/stage`, { stage: "Selected" });
      setWorkflow(p => ({ ...p, stage: "Selected" }));
      setSelectedStage("Selected");
    } catch(e) { setError(e.message); }
    finally { setStageLoading(false); }
  }

  async function handleReject() {
    setStageLoading(true);
    try {
      await apiPatch(`/api/candidates/${candidateId}/stage`, { stage: "Rejected" });
      setWorkflow(p => ({ ...p, stage: "Rejected" }));
      setSelectedStage("Rejected");
    } catch(e) { setError(e.message); }
    finally { setStageLoading(false); }
  }

  async function handleRevert() {
    setStageLoading(true);
    try {
      await apiPatch(`/api/candidates/${candidateId}/stage`, { stage: "Screening" });
      setWorkflow(p => ({ ...p, stage: "Screening" }));
      setSelectedStage("Screening");
    } catch(e) { setError(e.message); }
    finally { setStageLoading(false); }
  }

  async function handleSaveNotes() {
    setNotesSaving(true);
    try {
      await apiPatch(`/api/candidates/${candidateId}/notes`, { notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch(e) { setError(e.message); }
    finally { setNotesSaving(false); }
  }

  // Change 2: run analysis handler
  async function handleRunAnalysis() {
    setAnalysisRunning(true); setAnalysisError(null);
    try {
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/analyze`);
      url.searchParams.set("loginId", loginId);
      await fetch(url.toString(), { method: "POST" });
      // Refresh workflow to pick up new scores
      const updated = await apiGet(`/api/candidates/${candidateId}/workflow`);
      setWorkflow(updated);
      // Navigate to analysis result page after completion
      nav(`/analysis/${candidateId}`);
    } catch(e) { setAnalysisError(e.message); }
    finally { setAnalysisRunning(false); }
  }

  function parseQuestionsJson(raw) {
    if (!raw) return null;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (parsed && parsed.questions && parsed.skillsRequired) return parsed;
    } catch {}
    return null;
  }

  function handleOpenQuestions() {
    setQuestionsData(parseQuestionsJson(workflow.interviewQuestions));
    setQuestionsSaved(false);
    setExpandedSections({ coreSkills: true, gapBased: true, experienceDeepDive: true,
      behavioural: true, authenticityCheck: true, communicationCultural: true });
    setQuestionsOpen(true);
  }

  async function handleGenerateQuestions() {
    setQuestionsGenerating(true);
    try {
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/interview-questions/generate`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setQuestionsData(data);
      setExpandedSections({ coreSkills: true, gapBased: true, experienceDeepDive: true,
        behavioural: true, authenticityCheck: true, communicationCultural: true });
    } catch (e) { console.error("Generate questions failed", e); }
    finally { setQuestionsGenerating(false); }
  }

  async function handleSaveQuestions() {
    if (!questionsData) return;
    setQuestionsSaving(true);
    try {
      const url = new URL(`${API_BASE}/api/candidates/${candidateId}/interview-questions`);
      url.searchParams.set("loginId", loginId);
      await fetch(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: questionsData }),
      });
      setQuestionsSaved(true);
      setTimeout(() => setQuestionsSaved(false), 2500);
    } catch (e) { console.error("Save questions failed", e); }
    finally { setQuestionsSaving(false); }
  }

  async function handleGenerateMessage() {
    setMsgLoading(true); setMsgError(null); setMsgResult(null);
    try {
      const data = await apiPost("/api/messages/generate", {
        candidateId, messageType: msgType,
        customPrompt: msgPrompt || null,
      });
      setMsgResult(data);
    } catch(e) { setMsgError(e.message); }
    finally { setMsgLoading(false); }
  }

  if (loading) return <Box sx={{p:4,textAlign:"center"}}><CircularProgress /></Box>;
  if (error)   return <Alert severity="error">{error}</Alert>;
  if (!workflow) return null;

  const isAnalysed = workflow.capabilityScore != null;

  return (
    <Box sx={{display:"flex",flexDirection:"column",gap:2}}>
      {/* Change 3: analysis error banner */}
      {analysisError && (
        <Alert severity="error" onClose={() => setAnalysisError(null)}>{analysisError}</Alert>
      )}
      {/* Header */}
      <Box sx={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Box>
          <Box sx={{display:"flex",alignItems:"center",gap:1}}>
            <Typography sx={{fontSize:15,fontWeight:600,color:TEXT}}>
              Candidate Workflow — {workflow.candidateName}
            </Typography>
            <NewTag />
          </Box>
          <Typography sx={{fontSize:11,color:MUTED,mt:0.25}}>
            {workflow.jobTitle} · {workflow.company} · Pipeline management
          </Typography>
        </Box>
        <Box sx={{display:"flex",gap:1}}>
          <Button variant="outlined" size="small" onClick={() => nav("/candidates")}
            sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>
            ← Back to Candidates
          </Button>
          {/* Change 3: show Run Analysis or View Analysis based on isAnalysed */}
          <Button variant="outlined" size="small"
            onClick={() => nav(`/candidates/${candidateId}/interview-analysis`)}
            sx={{fontSize:11,borderColor:PURPLE_BR,color:PURPLE,borderRadius:"6px",
              textTransform:"none","&:hover":{bgcolor:PURPLE_BG}}}>
            🎤 Interview Analysis
          </Button>
          {isAnalysed ? (
            <Button variant="contained" size="small" onClick={() => nav(`/analysis/${candidateId}`)}
              sx={{fontSize:11,bgcolor:ACCENT,borderRadius:"6px",textTransform:"none",
                boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
              📊 View Analysis
            </Button>
          ) : (
            <Button variant="contained" size="small" onClick={handleRunAnalysis}
              disabled={analysisRunning}
              sx={{fontSize:11,bgcolor:PURPLE,borderRadius:"6px",textTransform:"none",
                boxShadow:"none","&:hover":{bgcolor:"#6D28D9",boxShadow:"none"}}}>
              {analysisRunning
                ? <><CircularProgress size={12} sx={{color:"#fff",mr:0.75}}/> Running…</>
                : "🔍 Run Analysis"}
            </Button>
          )}
        </Box>
      </Box>

      {/* Profile hero */}
      <Box sx={{background:"linear-gradient(135deg,#1B3A6B 0%,#0F1623 100%)",
        borderRadius:"10px",p:"20px 24px",color:"#fff",display:"flex",gap:2.5,alignItems:"center"}}>
        <Box sx={{width:52,height:52,borderRadius:"50%",bgcolor:ACCENT,color:"#fff",display:"flex",
          alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,flexShrink:0}}>
          {workflow.candidateName?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
        </Box>
        <Box sx={{flex:1}}>
          <Typography sx={{fontSize:18,fontWeight:700,mb:0.5}}>{workflow.candidateName}</Typography>
          <Typography sx={{fontSize:13,color:"rgba(255,255,255,0.6)",mb:1}}>
            {workflow.jobTitle} · {workflow.company}
          </Typography>
          <Box sx={{display:"flex",gap:0.75,flexWrap:"wrap"}}>
            <Box sx={{bgcolor:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.8)",
              px:"10px",py:"3px",borderRadius:"20px",fontSize:11}}>
              Stage: {workflow.stage}
            </Box>
            {workflow.email && (
              <Box sx={{bgcolor:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.8)",
                px:"10px",py:"3px",borderRadius:"20px",fontSize:11}}>
                {workflow.email}
              </Box>
            )}
          </Box>
        </Box>
        <Box sx={{textAlign:"right",flexShrink:0}}>
          <Typography sx={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:".5px",mb:0.5}}>
            Match Score
          </Typography>
          <Typography sx={{fontSize:36,fontWeight:700,lineHeight:1,
            color:workflow.capabilityScore>=80?"#86EFAC":workflow.capabilityScore>=60?"#FDE047":"#FCA5A5"}}>
            {workflow.capabilityScore ?? "—"}{workflow.capabilityScore != null ? "%" : ""}
          </Typography>
          <Box sx={{mt:0.75}}>
            <Badge label={workflow.riskLevel ? `${workflow.riskLevel} Risk` : "Not Analysed"}
              variant={workflow.riskLevel==="High"?"danger":workflow.riskLevel==="Medium"?"warning":"accent"} />
          </Box>
        </Box>
      </Box>

      {/* Pipeline stages */}
      <Box>
        <Typography sx={{fontSize:11,fontWeight:600,color:MUTED,textTransform:"uppercase",letterSpacing:".5px",mb:1}}>
          Workflow Stage
        </Typography>
        <Box sx={{display:"flex",mb:1.5}}>
          {["Screening","Interview","Assessment","Offer","Selected"].map((s,i) => {
            const isCurrent = workflow.stage === s;
            const isPast    = STAGES.indexOf(workflow.stage) > i;
            return (
              <Box key={s} sx={{flex:1,py:"10px",px:"14px",textAlign:"center",fontSize:11,fontWeight:500,
                bgcolor: isCurrent ? ACCENT_BG : isPast ? "#F0FDF4" : SURFACE,
                color:   isCurrent ? ACCENT    : isPast ? SUCCESS    : MUTED,
                border:`1px solid ${isCurrent?ACCENT:isPast?SUCCESS_BR:BORDER}`,
                borderRight: i < 4 ? "none" : `1px solid ${isCurrent?ACCENT:BORDER}`,
                borderRadius: i===0?"6px 0 0 6px":i===4?"0 6px 6px 0":"0",
              }}>
                <Box component="span" sx={{display:"block",fontSize:16,fontWeight:700,mb:"2px"}}>
                  {isPast ? "✓" : `${i+1}`}
                </Box>
                {s}
              </Box>
            );
          })}
        </Box>
        <Box sx={{display:"flex",gap:1,alignItems:"center"}}>
          <Typography sx={{fontSize:12,color:MUTED}}>Move to stage:</Typography>
          <TextField select size="small" value={selectedStage} onChange={e => setSelectedStage(e.target.value)}
            sx={{width:200,"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}}>
            {STAGES.map(s => <MenuItem key={s} value={s} sx={{fontSize:12}}>{s}</MenuItem>)}
          </TextField>
          <Button variant="contained" size="small" onClick={handleUpdateStage} disabled={stageLoading}
            sx={{fontSize:11,bgcolor:ACCENT,borderRadius:"6px",textTransform:"none",
              boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
            {stageLoading ? <CircularProgress size={12} sx={{color:"#fff"}} /> : "Update Stage"}
          </Button>
        </Box>
      </Box>

      <Box sx={{display:"flex",gap:2,alignItems:"flex-start"}}>
        <Box sx={{flex:1.3,display:"flex",flexDirection:"column",gap:2}}>

          {/* AI Message Generator */}
          <Card isNew>
            <CardHead title="AI Message Generator" isNew
              action={<Typography sx={{fontSize:10,color:MUTED,fontStyle:"italic"}}>POST /api/messages/generate</Typography>} />
            <Box sx={{p:2.25}}>
              <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.75}}>What message do you need?</Typography>
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
                placeholder={`e.g. 'Write a professional ${msgType.toLowerCase().replace("_"," ")} for ${workflow.candidateName}'`}
                sx={{mb:1.5,"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}} />
              <Button variant="contained" onClick={handleGenerateMessage} disabled={msgLoading}
                sx={{fontSize:12,fontWeight:600,bgcolor:PURPLE,borderRadius:"8px",textTransform:"none",
                  mb:msgResult?1.5:0,boxShadow:"none","&:hover":{bgcolor:"#6D28D9",boxShadow:"none"}}}>
                {msgLoading ? <><CircularProgress size={14} sx={{color:"#fff",mr:1}} /> Generating…</> : "✦ Generate Message"}
              </Button>
              {msgError && <Alert severity="error" sx={{mt:1}}>{msgError}</Alert>}

              {msgResult && (
                <Box sx={{bgcolor:"#F8F7FF",border:`1px solid ${PURPLE_BR}`,borderRadius:"7px",p:1.75}}>
                  <Typography sx={{fontSize:10,fontWeight:700,color:PURPLE,textTransform:"uppercase",letterSpacing:".5px",mb:1}}>
                    ✦ Generated Message — Editable
                  </Typography>
                  <Box sx={{mb:1}}>
                    <Typography sx={{fontSize:11,fontWeight:600,color:TEXT,mb:0.5}}>Subject</Typography>
                    <TextField fullWidth size="small" defaultValue={msgResult.subject}
                      sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}} />
                  </Box>
                  <TextField multiline rows={7} fullWidth defaultValue={msgResult.body}
                    sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12,fontFamily:"monospace"}}} />
                  <Box sx={{display:"flex",gap:1,mt:1.25}}>
                    <Button variant="contained" size="small" onClick={() => nav("/email", {
                        state: {
                          candidateId,
                          candidateName: workflow.candidateName,
                          toAddress: workflow.email || "",
                          subject: msgResult.subject || "",
                          body: msgResult.body || "",
                        }
                      })}
                      sx={{flex:1,fontSize:11,bgcolor:ACCENT,borderRadius:"6px",textTransform:"none",
                        boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
                      ✉ Send Email
                    </Button>
                    <Button size="small" variant="outlined"
                      onClick={() => navigator.clipboard?.writeText(msgResult.body)}
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

          {/* Activity Timeline */}
          <Card>
            <CardHead title="Activity Timeline" />
            <Box sx={{p:0,px:2.25}}>
              {(workflow.activityTimeline || []).length === 0 ? (
                <Typography sx={{py:2.5,fontSize:12,color:MUTED}}>No activity recorded yet.</Typography>
              ) : (
                workflow.activityTimeline.map((ev,i) => (
                  <Box key={ev.id} sx={{display:"flex",gap:1.25,alignItems:"flex-start",
                    py:1.25,borderBottom:i<workflow.activityTimeline.length-1?`1px solid #F0F2F6`:"none"}}>
                    <Box sx={{width:8,height:8,borderRadius:"50%",bgcolor:ACCENT,mt:"5px",flexShrink:0}} />
                    <Box>
                      <Typography sx={{fontSize:12,fontWeight:600,color:TEXT}}>{ev.description}</Typography>
                      {ev.note && <Typography sx={{fontSize:11,color:MUTED,mt:0.25}}>{ev.note}</Typography>}
                      <Typography sx={{fontSize:10,color:MUTED,mt:0.25}}>
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleString("en-GB") : ""}
                      </Typography>
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          </Card>
        </Box>

        {/* Right panel */}
        <Box sx={{flex:"0 0 220px",display:"flex",flexDirection:"column",gap:2}}>
          <Card>
            <CardHead title="Actions" />
            <Box sx={{p:1.75,display:"flex",flexDirection:"column",gap:1}}>
              <Button fullWidth variant="outlined" size="small" onClick={() => nav("/email")}
                sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none",justifyContent:"flex-start"}}>
                ✉ Send Email
              </Button>
              <Button fullWidth variant="outlined" size="small" onClick={() => nav("/scheduler")}
                sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none",justifyContent:"flex-start"}}>
                📅 Schedule Interview
              </Button>
              <Button fullWidth variant="outlined" size="small"
                onClick={() => nav(`/candidates/${candidateId}/interview-analysis`)}
                sx={{fontSize:11,borderColor:PURPLE_BR,color:PURPLE,borderRadius:"6px",textTransform:"none",justifyContent:"flex-start","&:hover":{bgcolor:PURPLE_BG}}}>
                🎤 Interview Analysis
              </Button>
              <Button fullWidth variant="outlined" size="small"
                onClick={handleOpenQuestions}
                sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none",justifyContent:"flex-start","&:hover":{bgcolor:SURFACE}}}>
                💡 Suggestive Questions
              </Button>
              {/* Change 3: show Run Analysis or View Analysis in Actions panel */}
              {isAnalysed ? (
                <Button fullWidth variant="contained" size="small" onClick={() => nav(`/analysis/${candidateId}`)}
                  sx={{fontSize:11,bgcolor:ACCENT,borderRadius:"6px",textTransform:"none",boxShadow:"none",justifyContent:"flex-start","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
                  📊 View Analysis
                </Button>
              ) : (
                <Button fullWidth variant="contained" size="small" onClick={handleRunAnalysis}
                  disabled={analysisRunning}
                  sx={{fontSize:11,bgcolor:PURPLE,borderRadius:"6px",textTransform:"none",boxShadow:"none",justifyContent:"flex-start","&:hover":{bgcolor:"#6D28D9",boxShadow:"none"}}}>
                  {analysisRunning
                    ? <><CircularProgress size={12} sx={{color:"#fff",mr:0.75}}/> Running…</>
                    : "🔍 Run Analysis"}
                </Button>
              )}
              <Box sx={{height:1,bgcolor:BORDER,my:0.5}} />
              <Button fullWidth variant="contained" size="small"
                onClick={handleApprove}
                disabled={stageLoading || workflow.stage === "Selected"}
                sx={{fontSize:11,bgcolor:SUCCESS,borderRadius:"6px",textTransform:"none",boxShadow:"none",justifyContent:"flex-start","&:hover":{bgcolor:"#15803D",boxShadow:"none"},"&.Mui-disabled":{bgcolor:SUCCESS_BG,color:SUCCESS}}}>
                ✓ {workflow.stage === "Selected" ? "Approved" : "Approve"}
              </Button>
              <Button fullWidth variant="contained" size="small"
                onClick={handleReject}
                disabled={stageLoading || workflow.stage === "Rejected"}
                sx={{fontSize:11,bgcolor:DANGER,borderRadius:"6px",textTransform:"none",boxShadow:"none",justifyContent:"flex-start","&:hover":{bgcolor:"#B91C1C",boxShadow:"none"},"&.Mui-disabled":{bgcolor:DANGER_BG,color:DANGER}}}>
                ✗ {workflow.stage === "Rejected" ? "Rejected" : "Reject"}
              </Button>
              {(workflow.stage === "Selected" || workflow.stage === "Rejected") && (
                <Button fullWidth variant="outlined" size="small"
                  onClick={handleRevert}
                  disabled={stageLoading}
                  sx={{fontSize:11,borderRadius:"6px",textTransform:"none",borderColor:WARN,color:WARN,justifyContent:"flex-start","&:hover":{bgcolor:WARN_BG,borderColor:WARN}}}>
                  ↩ Revert to Screening
                </Button>
              )}
            </Box>
          </Card>

          <Card>
            <CardHead title="Candidate Info" />
            <Box sx={{p:1.75,display:"flex",flexDirection:"column",gap:1.25}}>
              {[
                {label:"Email",       val:workflow.email,       link:true},
                {label:"LinkedIn",    val:workflow.linkedinUrl, link:true},
                {label:"Applied For", val:workflow.jobTitle},
                {label:"Stage",       val:null},
                {label:"Match Score", val:null},
              ].map(item => (
                <Box key={item.label}>
                  <Typography sx={{fontSize:10,color:MUTED,textTransform:"uppercase",letterSpacing:".5px",fontWeight:600}}>
                    {item.label}
                  </Typography>
                  {item.label === "Stage" ? (
                    <Box sx={{mt:"3px"}}><Badge label={workflow.stage} variant="accent" /></Box>
                  ) : item.label === "Match Score" ? (
                    <Typography sx={{fontSize:16,fontWeight:700,mt:"3px",
                      color:workflow.capabilityScore>=80?SUCCESS:workflow.capabilityScore>=60?WARN:DANGER}}>
                      {workflow.capabilityScore != null ? `${workflow.capabilityScore}%` : "—"}
                    </Typography>
                  ) : (
                    <Typography sx={{fontSize:12,mt:"2px",color:item.link?ACCENT:TEXT,
                      overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {item.val || "—"}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Card>

          <Card>
            <CardHead title="Recruiter Notes" />
            <Box sx={{p:1.75}}>
              <TextField multiline rows={4} fullWidth value={notes}
                onChange={e => { setNotes(e.target.value); setNotesSaved(false); }}
                placeholder="Add notes…"
                sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12,fontFamily:"monospace"}}} />
              <Button fullWidth variant="outlined" size="small" onClick={handleSaveNotes}
                disabled={notesSaving}
                sx={{mt:1,fontSize:11,borderColor:BORDER,color:notesSaved?SUCCESS:TEXT,
                  borderRadius:"6px",textTransform:"none"}}>
                {notesSaving ? <CircularProgress size={12} /> : notesSaved ? "✓ Saved" : "Save Notes"}
              </Button>
            </Box>
          </Card>

          {/* CV / Resume Text */}
          {workflow.cvText && (
            <Card>
              <CardHead title="CV / Resume" />
              <Box sx={{p:1.75}}>
                <Box sx={{
                  bgcolor:"#F7F8FA", border:`1px solid ${BORDER}`, borderRadius:"8px",
                  p:1.5, maxHeight:300, overflowY:"auto",
                  fontSize:11.5, color:TEXT, lineHeight:1.7,
                  fontFamily:"monospace", whiteSpace:"pre-wrap", wordBreak:"break-word"
                }}>
                  {workflow.cvText}
                </Box>
              </Box>
            </Card>
          )}
        </Box>
      </Box>

      {/* ── Suggestive Questions Dialog ──────────────────────────────────── */}
      <Dialog open={questionsOpen} onClose={() => setQuestionsOpen(false)}
        fullWidth maxWidth="lg"
        slotProps={{ paper: { sx: { borderRadius: "12px", border: `1px solid ${BORDER}`, maxHeight: "90vh" } } }}>
        <DialogTitle sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
                💡 Suggestive Interview Questions
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
                  to this candidate's CV and the job description.
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 2 }}>

              {/* ── Summary strip ─────────────────────────────────────────── */}
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

              {/* ── Question sections ──────────────────────────────────────── */}
              {[
                { key: "coreSkills",          label: "A. Core Skill Validation",        color: ACCENT,  count: "5–7" },
                { key: "gapBased",            label: "B. Gap & Risk-Based",             color: DANGER,  count: "3–5" },
                { key: "experienceDeepDive",  label: "C. Experience Deep-Dive",         color: PURPLE,  count: "3–5" },
                { key: "behavioural",         label: "D. Behavioural & Situational",    color: WARN,    count: "3–4" },
                { key: "authenticityCheck",   label: "E. Authenticity Check",           color: SUCCESS, count: "2–3" },
                { key: "communicationCultural", label: "F. Communication & Cultural Fit", color: "#0891B2", count: "5–7" },
              ].map(({ key, label, color, count }) => {
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
    </Box>
  );
}
