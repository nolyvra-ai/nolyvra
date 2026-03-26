import { useEffect, useState, useCallback } from "react";
import { Box, Paper, Typography, Button, TextField, MenuItem, Alert, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER="#E8ECF2",MUTED="#9AA3B4",TEXT="#0F1623",ACCENT="#1D72E8";
const SUCCESS="#16A34A",SUCCESS_BG="#F0FDF4",SUCCESS_BR="#BBF7D0";
const WARN="#D97706",WARN_BG="#FFFBEB";
const DANGER="#DC2626",DANGER_BG="#FEF2F2",DANGER_BR="#FECACA";
const ACCENT_BG="#EBF2FF",ACCENT_BR="#BFDBFE";
const PURPLE="#7C3AED",PURPLE_BG="#F5F3FF",PURPLE_BR="#C4B5FD";
const SURFACE="#FAFBFD";

const INTERVIEW_TYPES = ["Technical","HR Screening","Final Round","Casual Chat","System Design"];
const LOCATIONS       = ["Google Meet","Zoom","In Office","Phone","Microsoft Teams"];

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId")||"";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function NewTag() {
  return <Box sx={{display:"inline-flex",alignItems:"center",px:"7px",py:"2px",bgcolor:PURPLE_BG,border:`1px solid ${PURPLE_BR}`,borderRadius:"4px",fontSize:10,fontWeight:600,color:PURPLE,ml:1}}>NEW</Box>;
}

function Badge({ label, variant="neutral" }) {
  const s={success:{bg:SUCCESS_BG,border:SUCCESS_BR,color:SUCCESS},warning:{bg:WARN_BG,border:"#FDE68A",color:WARN},accent:{bg:ACCENT_BG,border:ACCENT_BR,color:ACCENT},neutral:{bg:"#F1F3F7",border:BORDER,color:MUTED}}[variant]??{bg:"#F1F3F7",border:BORDER,color:MUTED};
  return <Box sx={{display:"inline-flex",alignItems:"center",bgcolor:s.bg,border:`1px solid ${s.border}`,borderRadius:"20px",px:1.25,py:0.25,fontSize:11,fontWeight:600,color:s.color,whiteSpace:"nowrap"}}>{label}</Box>;
}

export default function SchedulerPage() {
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId")||"";

  const [candidates, setCandidates] = useState([]);
  const [scheduled,  setScheduled]  = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);
  const [success,    setSuccess]    = useState(false);

  // ── Conflict check state ───────────────────────────────────────────────────
  const [conflictWarning, setConflictWarning] = useState(null);
  const [conflictChecking, setConflictChecking] = useState(false);

  const [form, setForm] = useState({
    candidateId:"", jobId:"", interviewer:"", interviewType:"Technical",
    scheduledAt:"", durationMinutes:60, location:"Google Meet", meetingLink:"", notes:"",
  });

  useEffect(() => {
    Promise.all([apiGet("/api/candidates"), apiGet("/api/interviews")])
      .then(([c, s]) => {
        // Only show candidates that are assigned to a job
        setCandidates(c.filter(cand => cand.jobId));
        setScheduled(s);
      })
      .catch(e => setError(e.message));
  }, [loginId]);

  function updateForm(k, v) { setForm(p => ({ ...p, [k]: v })); }

  // Auto-fill jobId when candidate changes
  function handleCandidateChange(candId) {
    const cand = candidates.find(c => c.id === candId);
    setForm(p => ({ ...p, candidateId: candId, jobId: cand?.jobId || "" }));
    // Clear conflict warning when candidate changes
    setConflictWarning(null);
  }

  // ── Check conflict whenever candidateId, scheduledAt or durationMinutes changes
  const checkConflict = useCallback(async (candidateId, scheduledAt, durationMinutes) => {
    if (!candidateId || !scheduledAt) { setConflictWarning(null); return; }
    setConflictChecking(true);
    try {
      const isoTime = new Date(scheduledAt).toISOString();
      const url = new URL(`${API_BASE}/api/interviews/check-conflict`);
      url.searchParams.set("loginId", loginId);
      url.searchParams.set("candidateId", candidateId);
      url.searchParams.set("scheduledAt", isoTime);
      url.searchParams.set("durationMinutes", durationMinutes);
      const res = await fetch(url.toString());
      const data = await res.json();
      setConflictWarning(data.conflict ? data.message : null);
    } catch (e) {
      setConflictWarning(null);
    } finally {
      setConflictChecking(false);
    }
  }, [loginId]);

  // Trigger conflict check when relevant fields change
  useEffect(() => {
    checkConflict(form.candidateId, form.scheduledAt, form.durationMinutes);
  }, [form.candidateId, form.scheduledAt, form.durationMinutes, checkConflict]);

  async function handleSchedule() {
    if (!form.candidateId || !form.scheduledAt) { setError("Candidate and date/time are required."); return; }
    if (conflictWarning) { setError(conflictWarning); return; }
    setSaving(true); setError(null); setSuccess(false);
    try {
      const url = new URL(`${API_BASE}/api/interviews/schedule`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...form, scheduledAt: new Date(form.scheduledAt).toISOString() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const newInterview = await res.json();
      setScheduled(p => [newInterview, ...p]);
      setSuccess(true);
      setConflictWarning(null);
      setForm(p => ({ ...p, candidateId:"", scheduledAt:"", meetingLink:"", notes:"" }));
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleCancel(interviewId) {
    try {
      const url = new URL(`${API_BASE}/api/interviews/${interviewId}/cancel`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { method: "PATCH" });
      if (!res.ok) throw new Error(await res.text());
      setScheduled(p => p.map(iv =>
        iv.id === interviewId ? { ...iv, status: "Cancelled" } : iv
      ));
    } catch(e) { setError(e.message); }
  }

  function handleReschedule(iv) {
    // Convert ISO scheduledAt back to datetime-local format
    const dt = iv.scheduledAt
      ? new Date(iv.scheduledAt).toISOString().slice(0, 16)
      : "";
    setForm({
      candidateId:     iv.candidateId     || "",
      jobId:           iv.jobId           || "",
      interviewer:     iv.interviewer     || "",
      interviewType:   iv.interviewType   || "Technical",
      scheduledAt:     dt,
      durationMinutes: iv.durationMinutes || 60,
      location:        iv.location        || "Google Meet",
      meetingLink:     iv.meetingLink     || "",
      notes:           iv.notes           || "",
    });
    setConflictWarning(null);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <Box sx={{display:"flex",flexDirection:"column",gap:2}}>
      <Box sx={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Box>
          <Box sx={{display:"flex",alignItems:"center",gap:1}}>
            <Typography sx={{fontSize:15,fontWeight:600,color:TEXT}}>Interview Scheduler</Typography>
            <NewTag />
          </Box>
          <Typography sx={{fontSize:11,color:MUTED,mt:0.25}}>Schedule and manage candidate interviews</Typography>
        </Box>
        <Box sx={{display:"flex",gap:1}}>
          <Button variant="outlined" size="small" sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>Sync Google Calendar</Button>
          <Button variant="outlined" size="small" sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>Sync Outlook</Button>
        </Box>
      </Box>

      {error   && <Alert severity="error"   onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess(false)}>Interview scheduled successfully!</Alert>}

      <Box sx={{display:"flex",gap:2,alignItems:"flex-start"}}>
        {/* Form */}
        <Box sx={{flex:1.2}}>
          <Paper elevation={0} sx={{border:`1px solid ${BORDER}`,borderRadius:"10px",overflow:"hidden",bgcolor:"#fff"}}>
            <Box sx={{px:2.25,py:1.5,borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>Schedule Interview</Typography>
              <Typography sx={{fontSize:10,color:MUTED,fontStyle:"italic"}}>POST /api/interviews/schedule</Typography>
            </Box>
            <Box sx={{p:2.25,display:"flex",flexDirection:"column",gap:1.75}}>
              <Box sx={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1.75}}>
                <Box>
                  <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>Candidate <Box component="span" sx={{color:"#DC2626"}}>*</Box></Typography>
                  <TextField select fullWidth size="small" value={form.candidateId} onChange={e => handleCandidateChange(e.target.value)}
                    sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}}>
                    <MenuItem value="" sx={{fontSize:12}}>Select candidate…</MenuItem>
                    {candidates.map(c => <MenuItem key={c.id} value={c.id} sx={{fontSize:12}}>{c.name}</MenuItem>)}
                  </TextField>
                </Box>
                <Box>
                  <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>Interview Type</Typography>
                  <TextField select fullWidth size="small" value={form.interviewType} onChange={e => updateForm("interviewType", e.target.value)}
                    sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}}>
                    {INTERVIEW_TYPES.map(t => <MenuItem key={t} value={t} sx={{fontSize:12}}>{t}</MenuItem>)}
                  </TextField>
                </Box>
              </Box>
              <Box sx={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1.75}}>
                <Box>
                  <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>Date & Time <Box component="span" sx={{color:"#DC2626"}}>*</Box></Typography>
                  <TextField type="datetime-local" fullWidth size="small" value={form.scheduledAt} onChange={e => updateForm("scheduledAt", e.target.value)}
                    sx={{"& .MuiOutlinedInput-root":{
                      borderRadius:"8px", fontSize:12,
                      // Highlight in red if conflict detected
                      ...(conflictWarning ? { "& fieldset": { borderColor: DANGER } } : {})
                    }}} />
                  {/* ── Conflict warning inline below date field ── */}
                  {conflictChecking && (
                    <Box sx={{display:"flex",alignItems:"center",gap:0.5,mt:0.5}}>
                      <CircularProgress size={10} sx={{color:MUTED}} />
                      <Typography sx={{fontSize:10,color:MUTED}}>Checking availability…</Typography>
                    </Box>
                  )}
                  {conflictWarning && !conflictChecking && (
                    <Box sx={{display:"flex",alignItems:"center",gap:0.5,mt:0.5,
                      bgcolor:DANGER_BG,border:`1px solid ${DANGER_BR}`,borderRadius:"6px",px:1,py:0.5}}>
                      <Typography sx={{fontSize:10,fontWeight:600,color:DANGER}}>
                        ⚠ {conflictWarning}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box>
                  <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>Duration (minutes)</Typography>
                  <TextField select fullWidth size="small" value={form.durationMinutes} onChange={e => updateForm("durationMinutes", Number(e.target.value))}
                    sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}}>
                    {[30,45,60,90,120].map(d => <MenuItem key={d} value={d} sx={{fontSize:12}}>{d} min</MenuItem>)}
                  </TextField>
                </Box>
              </Box>
              <Box sx={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1.75}}>
                <Box>
                  <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>Location / Format</Typography>
                  <TextField select fullWidth size="small" value={form.location} onChange={e => updateForm("location", e.target.value)}
                    sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}}>
                    {LOCATIONS.map(l => <MenuItem key={l} value={l} sx={{fontSize:12}}>{l}</MenuItem>)}
                  </TextField>
                </Box>
                <Box>
                  <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>Meeting Link</Typography>
                  <TextField fullWidth size="small" value={form.meetingLink} onChange={e => updateForm("meetingLink", e.target.value)}
                    placeholder="https://meet.google.com/..."
                    sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}} />
                </Box>
              </Box>
              <Box>
                <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>Notes</Typography>
                <TextField multiline rows={2} fullWidth value={form.notes} onChange={e => updateForm("notes", e.target.value)}
                  placeholder="Any prep notes for the interviewer…"
                  sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}} />
              </Box>
              <Button variant="contained" onClick={handleSchedule}
                disabled={saving || !!conflictWarning}
                sx={{fontSize:12,fontWeight:500,bgcolor:ACCENT,borderRadius:"8px",textTransform:"none",
                  boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"},
                  "&.Mui-disabled":{bgcolor:conflictWarning?"#FEE2E2":undefined}}}>
                {saving ? <CircularProgress size={14} sx={{color:"#fff"}} /> : "📅 Schedule & Send Invite"}
              </Button>
            </Box>
          </Paper>
        </Box>

        {/* Upcoming interviews */}
        <Box sx={{flex:0.8}}>
          <Paper elevation={0} sx={{border:`1px solid ${BORDER}`,borderRadius:"10px",overflow:"hidden",bgcolor:"#fff"}}>
            <Box sx={{px:2.25,py:1.5,borderBottom:`1px solid ${BORDER}`}}>
              <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>Upcoming Interviews</Typography>
            </Box>
            <Box sx={{maxHeight:460,overflowY:"auto"}}>
              {scheduled.length === 0 ? (
                <Box sx={{p:3,textAlign:"center"}}>
                  <Typography sx={{fontSize:12,color:MUTED}}>No interviews scheduled yet.</Typography>
                </Box>
              ) : scheduled.map((iv,i) => (
                <Box key={iv.id} sx={{px:2.25,py:1.5,borderBottom:i<scheduled.length-1?`1px solid #F0F2F6`:"none"}}>
                  <Box sx={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",mb:0.5}}>
                    <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>{iv.candidateName}</Typography>
                    <Badge label={iv.status} variant={iv.status==="Scheduled"?"accent":iv.status==="Completed"?"success":"neutral"} />
                  </Box>
                  <Typography sx={{fontSize:11,color:MUTED,mb:0.5}}>{iv.jobTitle} · {iv.interviewType}</Typography>
                  <Typography sx={{fontSize:11,color:TEXT}}>
                    📅 {iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "—"}
                    {iv.durationMinutes ? ` · ${iv.durationMinutes} min` : ""}
                  </Typography>
                  {iv.location && <Typography sx={{fontSize:11,color:MUTED,mt:0.25}}>📍 {iv.location}</Typography>}
                  {/* Cancel and Reschedule buttons — only for Scheduled interviews */}
                  {iv.status === "Scheduled" && (
                    <Box sx={{display:"flex",gap:1,mt:1}}>
                      <Button size="small" variant="outlined"
                        onClick={() => handleReschedule(iv)}
                        sx={{fontSize:10,borderColor:BORDER,color:TEXT,borderRadius:"6px",
                          textTransform:"none","&:hover":{borderColor:ACCENT,color:ACCENT}}}>
                        🗓 Reschedule
                      </Button>
                      <Button size="small" variant="outlined"
                        onClick={() => handleCancel(iv.id)}
                        sx={{fontSize:10,borderColor:BORDER,color:MUTED,borderRadius:"6px",
                          textTransform:"none","&:hover":{borderColor:"#DC2626",color:"#DC2626"}}}>
                        ✕ Cancel
                      </Button>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}