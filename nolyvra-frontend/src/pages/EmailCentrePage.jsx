import { useEffect, useState } from "react";
import { Box, Paper, Typography, Button, TextField, MenuItem, Alert, CircularProgress } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER="#E8ECF2",MUTED="#9AA3B4",TEXT="#0F1623",ACCENT="#1D72E8";
const SUCCESS="#16A34A",SUCCESS_BG="#F0FDF4",SUCCESS_BR="#BBF7D0";
const WARN="#D97706",WARN_BG="#FFFBEB";
const DANGER="#DC2626",DANGER_BG="#FEF2F2",DANGER_BR="#FECACA";
const ACCENT_BG="#EBF2FF",ACCENT_BR="#BFDBFE";
const PURPLE="#7C3AED",PURPLE_BG="#F5F3FF",PURPLE_BR="#C4B5FD";
const SURFACE="#FAFBFD";

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
  const s={success:{bg:SUCCESS_BG,border:SUCCESS_BR,color:SUCCESS},warning:{bg:WARN_BG,border:"#FDE68A",color:WARN},danger:{bg:DANGER_BG,border:DANGER_BR,color:DANGER},accent:{bg:ACCENT_BG,border:ACCENT_BR,color:ACCENT},neutral:{bg:"#F1F3F7",border:BORDER,color:MUTED}}[variant]??{bg:"#F1F3F7",border:BORDER,color:MUTED};
  return <Box sx={{display:"inline-flex",alignItems:"center",bgcolor:s.bg,border:`1px solid ${s.border}`,borderRadius:"20px",px:1.25,py:0.25,fontSize:11,fontWeight:600,color:s.color,whiteSpace:"nowrap"}}>{label}</Box>;
}

export default function EmailCentrePage() {
  const loginId = localStorage.getItem("loginId")||"";
  const location = useLocation();

  const [candidates, setCandidates] = useState([]);
  const [templates,  setTemplates]  = useState([]);
  const [history,    setHistory]    = useState([]);
  const [sending,    setSending]    = useState(false);
  const [error,      setError]      = useState(null);
  const [success,    setSuccess]    = useState(false);

  const [form, setForm] = useState({ toAddress:"", subject:"", body:"", candidateId:"", templateType:"" });

  useEffect(() => {
    Promise.all([
      apiGet("/api/candidates"),
      apiGet("/api/emails/templates"),
      apiGet("/api/emails/history"),
    ]).then(([c, t, h]) => {
      setCandidates(c);
      setTemplates(t);
      setHistory(h);
      // ── Pre-populate form from navigation state (from CandidateWorkflowPage) ──
      const s = location.state;
      if (s && (s.toAddress || s.subject || s.body)) {
        setForm(p => ({
          ...p,
          candidateId: s.candidateId || "",
          toAddress:   s.toAddress   || "",
          subject:     s.subject     || "",
          body:        s.body        || "",
        }));
      }
    }).catch(e => setError(e.message));
  }, [loginId]);

  function updateForm(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function applyTemplate(template) {
    setForm(p => ({ ...p, subject: template.subject, body: template.body, templateType: template.templateType }));
  }

  function handleCandidateChange(candId) {
    updateForm("candidateId", candId);
    const cand = candidates.find(c => c.id === candId);
    if (cand?.email) updateForm("toAddress", cand.email);
  }

  async function handleSend() {
    if (!form.toAddress || !form.subject || !form.body) { setError("To, subject and body are required."); return; }
    setSending(true); setError(null); setSuccess(false);
    try {
      const url = new URL(`${API_BASE}/api/emails/send`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await res.text());
      const sent = await res.json();
      setHistory(p => [sent, ...p]);
      setSuccess(true);
      setForm(p => ({ ...p, toAddress:"", subject:"", body:"", candidateId:"" }));
    } catch(e) { setError(e.message); }
    finally { setSending(false); }
  }

  return (
    <Box sx={{display:"flex",flexDirection:"column",gap:2}}>
      <Box sx={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Box>
          <Box sx={{display:"flex",alignItems:"center",gap:1}}>
            <Typography sx={{fontSize:15,fontWeight:600,color:TEXT}}>Email Centre</Typography>
            <NewTag />
          </Box>
          <Typography sx={{fontSize:11,color:MUTED,mt:0.25}}>Send and manage candidate communications</Typography>
        </Box>
      </Box>

      {error   && <Alert severity="error"   onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess(false)}>Email sent successfully!</Alert>}

      <Box sx={{display:"flex",gap:2,alignItems:"flex-start"}}>

        {/* Compose */}
        <Box sx={{flex:1.4}}>
          <Paper elevation={0} sx={{border:`1px solid ${BORDER}`,borderRadius:"10px",overflow:"hidden",bgcolor:"#fff"}}>
            <Box sx={{px:2.25,py:1.5,borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>Compose Email</Typography>
              <Typography sx={{fontSize:10,color:MUTED,fontStyle:"italic"}}>POST /api/emails/send</Typography>
            </Box>
            <Box sx={{p:2.25,display:"flex",flexDirection:"column",gap:1.5}}>
              <Box sx={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1.5}}>
                <Box>
                  <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>To (Candidate)</Typography>
                  <TextField select fullWidth size="small" value={form.candidateId} onChange={e => handleCandidateChange(e.target.value)}
                    sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}}>
                    <MenuItem value="" sx={{fontSize:12}}>Select candidate…</MenuItem>
                    {candidates.map(c => <MenuItem key={c.id} value={c.id} sx={{fontSize:12}}>{c.name} {c.email?`(${c.email})`:""}</MenuItem>)}
                  </TextField>
                </Box>
                <Box>
                  <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>Email Address</Typography>
                  <TextField fullWidth size="small" value={form.toAddress} onChange={e => updateForm("toAddress", e.target.value)}
                    placeholder="candidate@email.com"
                    sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}} />
                </Box>
              </Box>
              <Box>
                <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>Subject</Typography>
                <TextField fullWidth size="small" value={form.subject} onChange={e => updateForm("subject", e.target.value)}
                  placeholder="Email subject…"
                  sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12}}} />
              </Box>
              <Box>
                <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,mb:0.5}}>Message</Typography>
                <TextField multiline rows={10} fullWidth value={form.body} onChange={e => updateForm("body", e.target.value)}
                  placeholder="Write your message here, or select a template on the right…"
                  sx={{"& .MuiOutlinedInput-root":{borderRadius:"8px",fontSize:12,fontFamily:"monospace"}}} />
              </Box>
              <Button variant="contained" onClick={handleSend} disabled={sending}
                sx={{fontSize:12,fontWeight:500,bgcolor:ACCENT,borderRadius:"8px",textTransform:"none",
                  boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
                {sending ? <CircularProgress size={14} sx={{color:"#fff"}} /> : "✉ Send Email"}
              </Button>
            </Box>
          </Paper>

          {/* Email history */}
          <Paper elevation={0} sx={{border:`1px solid ${BORDER}`,borderRadius:"10px",overflow:"hidden",bgcolor:"#fff",mt:2}}>
            <Box sx={{px:2.25,py:1.5,borderBottom:`1px solid ${BORDER}`}}>
              <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>Email History</Typography>
            </Box>
            <Box sx={{maxHeight:300,overflowY:"auto"}}>
              {history.length === 0 ? (
                <Box sx={{p:3,textAlign:"center"}}>
                  <Typography sx={{fontSize:12,color:MUTED}}>No emails sent yet.</Typography>
                </Box>
              ) : history.map((e,i) => (
                <Box key={e.id} sx={{display:"flex",gap:1,alignItems:"flex-start",px:2.25,py:1.25,
                  borderBottom:i<history.length-1?`1px solid #F0F2F6`:"none"}}>
                  <Box sx={{width:8,height:8,borderRadius:"50%",bgcolor:e.status==="Sent"?SUCCESS:MUTED,mt:"5px",flexShrink:0}} />
                  <Box sx={{flex:1,minWidth:0}}>
                    <Typography sx={{fontSize:12,fontWeight:600,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {e.subject}
                    </Typography>
                    <Typography sx={{fontSize:11,color:MUTED}}>To: {e.toAddress}</Typography>
                    <Typography sx={{fontSize:10,color:MUTED,mt:0.25}}>
                      {e.sentAt ? new Date(e.sentAt).toLocaleString("en-GB") : "—"}
                    </Typography>
                  </Box>
                  <Badge label={e.status} variant={e.status==="Sent"?"success":"neutral"} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>

        {/* Templates */}
        <Box sx={{flex:"0 0 240px"}}>
          <Paper elevation={0} sx={{border:`1px solid ${BORDER}`,borderRadius:"10px",overflow:"hidden",bgcolor:"#fff"}}>
            <Box sx={{px:2.25,py:1.5,borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>Templates</Typography>
            </Box>
            <Box>
              {templates.length === 0 ? (
                <Box sx={{p:2.5,textAlign:"center"}}>
                  <Typography sx={{fontSize:12,color:MUTED}}>Loading templates…</Typography>
                </Box>
              ) : templates.map((t,i) => (
                <Box key={t.id} onClick={() => applyTemplate(t)}
                  sx={{px:2.25,py:1.25,borderBottom:i<templates.length-1?`1px solid #F0F2F6`:"none",
                    cursor:"pointer","&:hover":{bgcolor:SURFACE},transition:"background .1s"}}>
                  <Typography sx={{fontSize:12,fontWeight:500,color:TEXT}}>{t.name}</Typography>
                  <Typography sx={{fontSize:11,color:MUTED,mt:0.25}}>{t.subject.substring(0,40)}…</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
