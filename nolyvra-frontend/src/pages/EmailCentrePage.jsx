import { useEffect, useRef, useState } from "react";
import { Box, Paper, Typography, Button, TextField, MenuItem, Alert, CircularProgress } from "@mui/material";
import { useLocation } from "react-router-dom";
import Quill from "quill";
import "quill/dist/quill.snow.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER="#E8ECF2",MUTED="#9AA3B4",TEXT="#0F1623",ACCENT="#1D72E8";
const SUCCESS="#16A34A",SUCCESS_BG="#F0FDF4",SUCCESS_BR="#BBF7D0";
const WARN="#D97706",WARN_BG="#FFFBEB";
const DANGER="#DC2626",DANGER_BG="#FEF2F2",DANGER_BR="#FECACA";
const ACCENT_BG="#EBF2FF",ACCENT_BR="#BFDBFE";
const PURPLE="#7C3AED",PURPLE_BG="#F5F3FF",PURPLE_BR="#C4B5FD";
const SURFACE="#FAFBFD";

// ── Quill toolbar config (defined outside so refs are stable) ─────────────────
const BODY_MODULES = {
  toolbar: [
    [{ font: [] }, { size: ["small", false, "large", "huge"] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
};
const SIG_MODULES = {
  toolbar: [["bold", "italic", "underline"], ["link"], ["clean"]],
};

// ── Custom Quill wrapper (React-19-safe — no findDOMNode) ─────────────────────
function QuillEditor({ value, onChange, modules, placeholder, className = "" }) {
  const wrapperRef   = useRef(null);
  const quillRef     = useRef(null);
  const onChangeRef  = useRef(onChange);
  const lastValueRef = useRef(value || "");

  // Keep callback ref up to date without re-running the init effect
  useEffect(() => { onChangeRef.current = onChange; });

  // Initialise Quill once
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || quillRef.current) return;

    // Quill inserts a toolbar sibling before the container, so we need an
    // inner div — the wrapper div collects both toolbar + container.
    const editorDiv = document.createElement("div");
    wrapper.appendChild(editorDiv);

    const quill = new Quill(editorDiv, { theme: "snow", modules, placeholder });
    quillRef.current = quill;

    if (lastValueRef.current) {
      quill.clipboard.dangerouslyPasteHTML(lastValueRef.current);
    }

    quill.on("text-change", () => {
      const html   = quill.root.innerHTML;
      const empty  = quill.getText().trim() === "";
      const emitted = empty ? "" : html;
      lastValueRef.current = emitted;
      onChangeRef.current?.(emitted);
    });

    return () => {
      quillRef.current = null;
      wrapper.innerHTML = "";
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync value that changed externally (template load, form reset)
  useEffect(() => {
    const quill = quillRef.current;
    if (!quill || value === lastValueRef.current) return;

    if (!value) {
      quill.setContents([]);
      lastValueRef.current = "";
    } else {
      quill.clipboard.dangerouslyPasteHTML(value);
      lastValueRef.current = quill.root.innerHTML;
    }
  }, [value]);

  return <div ref={wrapperRef} className={className} />;
}

// ── Quill CSS injected once into <head> ───────────────────────────────────────
const STYLE_ID = "nolyvra-quill-theme";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    /* ── body editor ── */
    .nolyvra-quill .ql-toolbar.ql-snow {
      border: 1px solid ${BORDER}; border-radius: 8px 8px 0 0;
      background: ${SURFACE}; padding: 6px 10px;
    }
    .nolyvra-quill .ql-container.ql-snow {
      border: 1px solid ${BORDER}; border-top: none;
      border-radius: 0 0 8px 8px; font-family: inherit; font-size: 13px;
    }
    .nolyvra-quill .ql-editor { min-height: 220px; font-size: 13px; color: ${TEXT}; line-height: 1.65; }
    .nolyvra-quill .ql-editor.ql-blank::before { color: ${MUTED}; font-style: normal; font-size: 12px; }

    /* ── signature editor ── */
    .nolyvra-quill-sig .ql-toolbar.ql-snow {
      border: 1px solid ${BORDER}; border-radius: 8px 8px 0 0;
      background: ${SURFACE}; padding: 4px 8px;
    }
    .nolyvra-quill-sig .ql-container.ql-snow {
      border: 1px solid ${BORDER}; border-top: none;
      border-radius: 0 0 8px 8px; font-size: 12px;
    }
    .nolyvra-quill-sig .ql-editor { min-height: 64px; font-size: 12px; color: ${MUTED}; line-height: 1.55; }
    .nolyvra-quill-sig .ql-editor.ql-blank::before { color: #C4C9D4; font-style: normal; font-size: 12px; }
  `;
  document.head.appendChild(s);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function textToHtml(text) {
  if (!text) return "";
  if (/<[a-z][\s\S]*>/i.test(text)) return text; // already HTML
  return text
    .split(/\n{2,}/)
    .map(para => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function buildBodyWithSig(body, sigHtml) {
  if (!sigHtml || sigHtml === "<p><br></p>") return body;
  const sigText = sigHtml.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
  if (!sigText) return body;
  const sigBlock = `<br><hr style="border:none;border-top:1px solid #E8ECF2;margin:12px 0"><div style="color:#6B7280;font-size:12px">${sigHtml}</div>`;
  return body + sigBlock;
}

function NewTag() {
  return (
    <Box sx={{ display:"inline-flex", alignItems:"center", px:"7px", py:"2px",
      bgcolor:PURPLE_BG, border:`1px solid ${PURPLE_BR}`, borderRadius:"4px",
      fontSize:10, fontWeight:600, color:PURPLE, ml:1 }}>NEW</Box>
  );
}

function Badge({ label, variant = "neutral" }) {
  const s = {
    success: { bg:SUCCESS_BG, border:SUCCESS_BR, color:SUCCESS },
    warning: { bg:WARN_BG,    border:"#FDE68A",  color:WARN    },
    danger:  { bg:DANGER_BG,  border:DANGER_BR,  color:DANGER  },
    accent:  { bg:ACCENT_BG,  border:ACCENT_BR,  color:ACCENT  },
    neutral: { bg:"#F1F3F7",  border:BORDER,     color:MUTED   },
  }[variant] ?? { bg:"#F1F3F7", border:BORDER, color:MUTED };
  return (
    <Box sx={{ display:"inline-flex", alignItems:"center", bgcolor:s.bg,
      border:`1px solid ${s.border}`, borderRadius:"20px", px:1.25, py:0.25,
      fontSize:11, fontWeight:600, color:s.color, whiteSpace:"nowrap" }}>
      {label}
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmailCentrePage() {
  const loginId  = localStorage.getItem("loginId") || "";
  const location = useLocation();

  const [candidates,      setCandidates]      = useState([]);
  const [jobs,            setJobs]            = useState([]);
  const [templates,       setTemplates]       = useState([]);
  const [history,         setHistory]         = useState([]);
  const [sending,         setSending]         = useState(false);
  const [error,           setError]           = useState(null);
  const [success,         setSuccess]         = useState(false);
  const [rawTemplate,     setRawTemplate]     = useState({ subject: "", body: "" });
  const [signature,       setSignature]       = useState(
    () => localStorage.getItem("emailSignature") || ""
  );
  const [gmailEmail, setGmailEmail] = useState("");
  const [outlookEmail, setOutlookEmail] = useState("");
  const connectedEmailProvider = gmailEmail.trim()
    ? { name: "Gmail", email: gmailEmail }
    : outlookEmail.trim()
      ? { name: "Outlook", email: outlookEmail }
      : null;

  const [form, setForm] = useState({
    toAddress: "", subject: "", body: "", candidateId: "", jobId: "", templateType: "",
  });

  // ── Bulk outreach mode (navigated to from Client Tracker's "Generate Bulk
  // Outreach") — a shared subject/body template with a literal "{}" merge
  // field, sent once per recipient with "{}" substituted for their name. ──
  const [bulkMode,       setBulkMode]       = useState(false);
  const [bulkRecipients, setBulkRecipients] = useState([]); // [{ name, email, status }]
  const [bulkSubject,    setBulkSubject]    = useState("");
  const [bulkBody,       setBulkBody]       = useState("");
  const [bulkSending,    setBulkSending]    = useState(false);
  const [bulkResults,    setBulkResults]    = useState(null); // { sent, skipped, failed }

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    if (!loginId) return;
    Promise.allSettled([
      fetch(`${API_BASE}/auth/google/status?loginId=${encodeURIComponent(loginId)}`)
        .then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/auth/microsoft/status?loginId=${encodeURIComponent(loginId)}`)
        .then(r => r.ok ? r.json() : null),
    ]).then(([gmailResult, outlookResult]) => {
      const gmail = gmailResult.status === "fulfilled" ? gmailResult.value : null;
      const outlook = outlookResult.status === "fulfilled" ? outlookResult.value : null;
      setGmailEmail(gmail?.connected ? (gmail.email || "") : "");
      setOutlookEmail(outlook?.connected ? (outlook.email || "") : localStorage.getItem("outlookEmail") || "");
    }).catch(() => setOutlookEmail(localStorage.getItem("outlookEmail") || ""));
  }, [loginId]);

  useEffect(() => {
    Promise.allSettled([
      apiGet("/api/candidates/list"),
      apiGet("/api/jobs"),
      apiGet("/api/emails/templates"),
      apiGet("/api/emails/history"),
    ]).then(([cr, jr, tr, hr]) => {
      if (cr.status === "fulfilled") setCandidates(cr.value);
      if (jr.status === "fulfilled") setJobs(jr.value);
      if (tr.status === "fulfilled") setTemplates(tr.value);
      if (hr.status === "fulfilled") setHistory(hr.value);

      const s = location.state;
      if (s && Array.isArray(s.bulkRecipients) && s.bulkRecipients.length > 0) {
        setBulkMode(true);
        setBulkRecipients(s.bulkRecipients.map(r => ({ name: r.name || "there", email: r.email || "", status: "pending" })));
        setBulkSubject(s.bulkSubject || "");
        setBulkBody(s.bulkBodyTemplate ? textToHtml(s.bulkBodyTemplate) : "");
      } else if (s && (s.toAddress || s.subject || s.body)) {
        setForm(p => ({
          ...p,
          candidateId: s.candidateId || "",
          toAddress:   s.toAddress   || "",
          subject:     s.subject     || "",
          body:        s.body ? textToHtml(s.body) : "",
        }));
      }
    });
  }, [loginId]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateForm(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function substitute(text, candName, job) {
    if (!text) return text;
    const recruiterName = localStorage.getItem("name") || "Recruiter";
    const jobTitle = job?.title || "";
    const company  = job?.company || "";
    return text
      .replace(/\{name\}/gi,      candName     || "{name}")
      .replace(/\{role\}/gi,      jobTitle     || "{role}")
      .replace(/\{company\}/gi,   company      || "{company}")
      .replace(/\{recruiter\}/gi, recruiterName)
      .replace(/\[candidateName\]|\[Candidate Name\]|\[Name\]|\[CANDIDATE_NAME\]/gi, candName || "[Candidate Name]")
      .replace(/\[jobTitle\]|\[Job Title\]|\[Position\]|\[ROLE\]|\[JOB_TITLE\]/gi,  jobTitle || "[Job Title]");
  }

  function applyTemplate(template) {
    setRawTemplate({ subject: template.subject, body: template.body });
    const cand = candidates.find(c => c.id === form.candidateId);
    const job  = jobs.find(j => j.id === form.jobId);
    setForm(p => ({
      ...p,
      subject:      substitute(template.subject, cand?.name || "", job),
      body:         textToHtml(substitute(template.body, cand?.name || "", job)),
      templateType: template.templateType,
    }));
  }

  function handleCandidateChange(candId) {
    const cand = candidates.find(c => c.id === candId);
    const job  = jobs.find(j => j.id === form.jobId);
    setForm(p => ({
      ...p,
      candidateId: candId,
      toAddress:   cand?.email || p.toAddress,
      ...(rawTemplate.body ? {
        subject: substitute(rawTemplate.subject, cand?.name || "", job),
        body:    textToHtml(substitute(rawTemplate.body, cand?.name || "", job)),
      } : {}),
    }));
  }

  function handleJobChange(jobId) {
    const cand = candidates.find(c => c.id === form.candidateId);
    const job  = jobs.find(j => j.id === jobId);
    setForm(p => ({
      ...p,
      jobId,
      ...(rawTemplate.body ? {
        subject: substitute(rawTemplate.subject, cand?.name || "", job),
        body:    textToHtml(substitute(rawTemplate.body, cand?.name || "", job)),
      } : {}),
    }));
  }

  function handleSignatureChange(html) {
    setSignature(html);
    localStorage.setItem("emailSignature", html);
  }

  async function handleSend() {
    if (!form.toAddress || !form.subject || !form.body) {
      setError("To, subject and body are required."); return;
    }
    setSending(true); setError(null); setSuccess(false);
    try {
      const url = new URL(`${API_BASE}/api/emails/send`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: JSON.stringify({ ...form, body: buildBodyWithSig(form.body, signature) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const sent = await res.json();
      setHistory(p => [sent, ...p]);
      setSuccess(true);
      setForm(p => ({ ...p, toAddress: "", subject: "", body: "", candidateId: "" }));
    } catch(e) { setError(e.message); }
    finally { setSending(false); }
  }

  function updateBulkRecipient(i, email) {
    setBulkRecipients(prev => prev.map((r, idx) => idx === i ? { ...r, email } : r));
  }

  async function handleBulkSendAll() {
    setBulkSending(true); setError(null); setBulkResults(null);
    let sent = 0, skipped = 0, failed = 0;
    const recipients = [...bulkRecipients];

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      if (!r.email || !r.email.trim()) {
        recipients[i] = { ...r, status: "skipped" };
        skipped++;
        setBulkRecipients([...recipients]);
        continue;
      }
      try {
        const personalizedBody = buildBodyWithSig(bulkBody.replaceAll("{}", r.name), signature);
        const url = new URL(`${API_BASE}/api/emails/send`);
        url.searchParams.set("loginId", loginId);
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` },
          body: JSON.stringify({ toAddress: r.email, subject: bulkSubject, body: personalizedBody, candidateId: "", templateType: "" }),
        });
        if (!res.ok) throw new Error(await res.text());
        const savedRec = await res.json();
        setHistory(p => [savedRec, ...p]);
        recipients[i] = { ...r, status: "sent" };
        sent++;
      } catch (e) {
        recipients[i] = { ...r, status: "failed" };
        failed++;
      }
      setBulkRecipients([...recipients]);
    }

    setBulkResults({ sent, skipped, failed });
    setBulkSending(false);
  }

  return (
    <Box sx={{ display:"flex", flexDirection:"column", gap:2 }}>
      <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <Box>
          <Box sx={{ display:"flex", alignItems:"center", gap:1 }}>
            <Typography sx={{ fontSize:15, fontWeight:600, color:TEXT }}>Email Centre</Typography>
            <NewTag />
          </Box>
          <Typography sx={{ fontSize:11, color:MUTED, mt:0.25 }}>
            Send and manage candidate communications
          </Typography>
        </Box>
      </Box>

      {error   && <Alert severity="error"   onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess(false)}>Email sent successfully!</Alert>}

      <Box sx={{ display:"flex", gap:2, alignItems:"flex-start" }}>

        {/* ── Compose ──────────────────────────────────────────────────────── */}
        <Box sx={{ flex: 1.4 }}>
          {bulkMode ? (
          <Paper elevation={0} sx={{ border:`1px solid ${BORDER}`, borderRadius:"10px",
            overflow:"hidden", bgcolor:"#fff" }}>
            <Box sx={{ px:2.25, py:1.5, borderBottom:`1px solid ${BORDER}`,
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <Box>
                <Typography sx={{ fontSize:13, fontWeight:600, color:TEXT }}>
                  Bulk Outreach — {bulkRecipients.length} recipient{bulkRecipients.length === 1 ? "" : "s"}
                </Typography>
                <Typography sx={{ fontSize:10.5, color:MUTED, mt:0.25 }}>
                  "{"{}"}" in the message is replaced with each recipient's name when sent.
                </Typography>
              </Box>
              <Button size="small" onClick={() => { setBulkMode(false); setBulkResults(null); }}
                sx={{ fontSize:11, color:MUTED, textTransform:"none" }}>
                Switch to single email
              </Button>
            </Box>

            <Box sx={{ p:2.25, display:"flex", flexDirection:"column", gap:1.5 }}>
              <Box>
                <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT, mb:0.5 }}>Subject</Typography>
                <TextField fullWidth size="small" value={bulkSubject}
                  onChange={e => setBulkSubject(e.target.value)}
                  placeholder="Email subject…"
                  sx={{ "& .MuiOutlinedInput-root":{ borderRadius:"8px", fontSize:12 } }} />
              </Box>

              <Box>
                <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT, mb:0.5 }}>Message</Typography>
                <QuillEditor
                  value={bulkBody}
                  onChange={html => setBulkBody(html)}
                  modules={BODY_MODULES}
                  placeholder="Write your bulk message here…"
                  className="nolyvra-quill"
                />
              </Box>

              <Box>
                <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", mb:0.5 }}>
                  <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT }}>Recipients</Typography>
                  <Typography sx={{ fontSize:10, color:MUTED }}>
                    Add an email for each row you want to send to — blank rows are skipped.
                  </Typography>
                </Box>
                <Box sx={{ border:`1px solid ${BORDER}`, borderRadius:"8px", overflow:"hidden" }}>
                  {bulkRecipients.map((r, i) => (
                    <Box key={i} sx={{ display:"flex", alignItems:"center", gap:1, px:1.5, py:1,
                      borderBottom: i < bulkRecipients.length - 1 ? `1px solid ${BORDER}` : "none",
                      bgcolor: i % 2 === 1 ? SURFACE : "#fff" }}>
                      <Box sx={{ width: 8, height: 8, borderRadius:"50%", flexShrink:0,
                        bgcolor: r.status === "sent" ? SUCCESS : r.status === "failed" ? DANGER
                          : r.status === "skipped" ? MUTED : "#D1D5DB" }} />
                      <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT, width:160, flexShrink:0,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {r.name}
                      </Typography>
                      <TextField size="small" fullWidth value={r.email} disabled={bulkSending}
                        onChange={e => updateBulkRecipient(i, e.target.value)}
                        placeholder="email@company.com"
                        sx={{ "& .MuiOutlinedInput-root":{ borderRadius:"6px", fontSize:12 } }} />
                      {r.status !== "pending" && (
                        <Typography sx={{ fontSize:10.5, fontWeight:600, flexShrink:0,
                          color: r.status === "sent" ? SUCCESS : r.status === "failed" ? DANGER : MUTED }}>
                          {r.status === "sent" ? "Sent" : r.status === "failed" ? "Failed" : "Skipped"}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* ── Signature block ─────────────────────────────────────────── */}
              <Box>
                <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", mb:0.5 }}>
                  <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT }}>Email Signature</Typography>
                  <Typography sx={{ fontSize:10, color:MUTED }}>
                    Appended to every email · auto-saved
                  </Typography>
                </Box>
                <Box sx={{ border:`1px solid ${BORDER}`, borderRadius:"8px", bgcolor:SURFACE,
                  px:1.5, py:1 }}>
                  <QuillEditor
                    value={signature}
                    onChange={handleSignatureChange}
                    modules={SIG_MODULES}
                    placeholder="e.g.  Best regards, Your Name | Title | Company"
                    className="nolyvra-quill-sig"
                  />
                </Box>
              </Box>

              {bulkResults && (
                <Alert severity={bulkResults.failed > 0 ? "warning" : "success"}>
                  Sent {bulkResults.sent}{bulkResults.skipped > 0 ? `, skipped ${bulkResults.skipped} (no email)` : ""}{bulkResults.failed > 0 ? `, ${bulkResults.failed} failed` : ""}.
                </Alert>
              )}

              <Box sx={{ display:"flex", alignItems:"center", gap:1.5 }}>
                <Button variant="contained" onClick={handleBulkSendAll}
                  disabled={bulkSending || !bulkSubject || !bulkBody || bulkRecipients.length === 0}
                  sx={{ fontSize:12, fontWeight:500, bgcolor:ACCENT, borderRadius:"8px",
                    textTransform:"none", boxShadow:"none",
                    "&:hover":{ bgcolor:"#1660CC", boxShadow:"none" } }}>
                  {bulkSending ? <CircularProgress size={14} sx={{ color:"#fff" }} /> : "✉ Send All"}
                </Button>
                {connectedEmailProvider && (
                  <Box sx={{
                    display:"inline-flex", alignItems:"center", gap:0.5,
                    bgcolor:"#EFF6FF", border:"1px solid #BFDBFE",
                    borderRadius:"20px", px:1.25, py:0.4,
                    fontSize:11, fontWeight:500, color:"#1D4ED8"
                  }}>
                    Sending via {connectedEmailProvider.email || connectedEmailProvider.name}
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
          ) : (
          <Paper elevation={0} sx={{ border:`1px solid ${BORDER}`, borderRadius:"10px",
            overflow:"hidden", bgcolor:"#fff" }}>
            <Box sx={{ px:2.25, py:1.5, borderBottom:`1px solid ${BORDER}`,
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <Typography sx={{ fontSize:13, fontWeight:600, color:TEXT }}>Compose Email</Typography>
              <Typography sx={{ fontSize:10, color:MUTED, fontStyle:"italic" }}>POST /api/emails/send</Typography>
            </Box>

            <Box sx={{ p:2.25, display:"flex", flexDirection:"column", gap:1.5 }}>

              {/* To / Job / Email row */}
              <Box sx={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:1.5 }}>
                <Box>
                  <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT, mb:0.5 }}>To (Candidate)</Typography>
                  <TextField select fullWidth size="small" value={form.candidateId}
                    onChange={e => handleCandidateChange(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root":{ borderRadius:"8px", fontSize:12 } }}>
                    <MenuItem value="" sx={{ fontSize:12 }}>Select candidate…</MenuItem>
                    {candidates.map(c => (
                      <MenuItem key={c.id} value={c.id} sx={{ fontSize:12 }}>
                        {c.name}{c.email ? ` (${c.email})` : ""}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Box>
                  <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT, mb:0.5 }}>Job</Typography>
                  <TextField select fullWidth size="small" value={form.jobId}
                    onChange={e => handleJobChange(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root":{ borderRadius:"8px", fontSize:12 } }}>
                    <MenuItem value="" sx={{ fontSize:12 }}>Select job…</MenuItem>
                    {jobs.map(j => (
                      <MenuItem key={j.id} value={j.id} sx={{ fontSize:12 }}>{j.title}</MenuItem>
                    ))}
                  </TextField>
                </Box>
                <Box>
                  <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT, mb:0.5 }}>Email Address</Typography>
                  <TextField fullWidth size="small" value={form.toAddress}
                    onChange={e => updateForm("toAddress", e.target.value)}
                    placeholder="candidate@email.com"
                    sx={{ "& .MuiOutlinedInput-root":{ borderRadius:"8px", fontSize:12 } }} />
                </Box>
              </Box>

              {/* Subject */}
              <Box>
                <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT, mb:0.5 }}>Subject</Typography>
                <TextField fullWidth size="small" value={form.subject}
                  onChange={e => updateForm("subject", e.target.value)}
                  placeholder="Email subject…"
                  sx={{ "& .MuiOutlinedInput-root":{ borderRadius:"8px", fontSize:12 } }} />
              </Box>

              {/* ── Rich-text body ──────────────────────────────────────────── */}
              <Box>
                <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT, mb:0.5 }}>Message</Typography>
                <QuillEditor
                  value={form.body}
                  onChange={html => updateForm("body", html)}
                  modules={BODY_MODULES}
                  placeholder="Write your message here, or select a template on the right…"
                  className="nolyvra-quill"
                />
              </Box>

              {/* ── Signature block ─────────────────────────────────────────── */}
              <Box>
                <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", mb:0.5 }}>
                  <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT }}>Email Signature</Typography>
                  <Typography sx={{ fontSize:10, color:MUTED }}>
                    Appended to every email · auto-saved
                  </Typography>
                </Box>
                <Box sx={{ border:`1px solid ${BORDER}`, borderRadius:"8px", bgcolor:SURFACE,
                  px:1.5, py:1 }}>
                  <QuillEditor
                    value={signature}
                    onChange={handleSignatureChange}
                    modules={SIG_MODULES}
                    placeholder="e.g.  Best regards, Your Name | Title | Company"
                    className="nolyvra-quill-sig"
                  />
                </Box>
              </Box>

              {/* Send */}
              <Box sx={{ display:"flex", alignItems:"center", gap:1.5 }}>
                <Button variant="contained" onClick={handleSend} disabled={sending}
                  sx={{ fontSize:12, fontWeight:500, bgcolor:ACCENT, borderRadius:"8px",
                    textTransform:"none", boxShadow:"none",
                    "&:hover":{ bgcolor:"#1660CC", boxShadow:"none" } }}>
                  {sending ? <CircularProgress size={14} sx={{ color:"#fff" }} /> : "✉ Send Email"}
                </Button>
                {connectedEmailProvider && (
                  <Box sx={{
                    display:"inline-flex", alignItems:"center", gap:0.5,
                    bgcolor:"#EFF6FF", border:"1px solid #BFDBFE",
                    borderRadius:"20px", px:1.25, py:0.4,
                    fontSize:11, fontWeight:500, color:"#1D4ED8"
                  }}>
                    Sending via {connectedEmailProvider.email || connectedEmailProvider.name}
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
          )}

          {/* Email history */}
          <Paper elevation={0} sx={{ border:`1px solid ${BORDER}`, borderRadius:"10px",
            overflow:"hidden", bgcolor:"#fff", mt:2 }}>
            <Box sx={{ px:2.25, py:1.5, borderBottom:`1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize:13, fontWeight:600, color:TEXT }}>Email History</Typography>
            </Box>
            <Box sx={{ maxHeight:300, overflowY:"auto" }}>
              {history.length === 0 ? (
                <Box sx={{ p:3, textAlign:"center" }}>
                  <Typography sx={{ fontSize:12, color:MUTED }}>No emails sent yet.</Typography>
                </Box>
              ) : history.map((e, i) => (
                <Box key={e.id} sx={{ display:"flex", gap:1, alignItems:"flex-start",
                  px:2.25, py:1.25,
                  borderBottom: i < history.length-1 ? `1px solid #F0F2F6` : "none" }}>
                  <Box sx={{ width:8, height:8, borderRadius:"50%",
                    bgcolor: e.status==="Sent" ? SUCCESS : MUTED, mt:"5px", flexShrink:0 }} />
                  <Box sx={{ flex:1, minWidth:0 }}>
                    <Typography sx={{ fontSize:12, fontWeight:600, color:TEXT,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {e.subject}
                    </Typography>
                    <Typography sx={{ fontSize:11, color:MUTED }}>To: {e.toAddress}</Typography>
                    <Typography sx={{ fontSize:10, color:MUTED, mt:0.25 }}>
                      {e.sentAt ? new Date(e.sentAt).toLocaleString("en-GB") : "—"}
                    </Typography>
                  </Box>
                  <Badge label={e.status} variant={e.status==="Sent" ? "success" : "neutral"} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>

        {/* ── Templates sidebar ─────────────────────────────────────────────── */}
        <Box sx={{ flex:"0 0 240px" }}>
          <Paper elevation={0} sx={{ border:`1px solid ${BORDER}`, borderRadius:"10px",
            overflow:"hidden", bgcolor:"#fff" }}>
            <Box sx={{ px:2.25, py:1.5, borderBottom:`1px solid ${BORDER}`,
              display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <Typography sx={{ fontSize:13, fontWeight:600, color:TEXT }}>Templates</Typography>
            </Box>
            <Box>
              {templates.length === 0 ? (
                <Box sx={{ p:2.5, textAlign:"center" }}>
                  <Typography sx={{ fontSize:12, color:MUTED }}>Loading templates…</Typography>
                </Box>
              ) : templates.map((t, i) => (
                <Box key={t.id} onClick={() => applyTemplate(t)}
                  sx={{ px:2.25, py:1.25,
                    borderBottom: i < templates.length-1 ? `1px solid #F0F2F6` : "none",
                    cursor:"pointer", "&:hover":{ bgcolor:SURFACE }, transition:"background .1s" }}>
                  <Typography sx={{ fontSize:12, fontWeight:500, color:TEXT }}>{t.name}</Typography>
                  <Typography sx={{ fontSize:11, color:MUTED, mt:0.25 }}>
                    {t.subject.substring(0, 40)}…
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          <Box sx={{ mt:1.5, p:"10px 14px", bgcolor:PURPLE_BG, border:`1px solid ${PURPLE_BR}`,
            borderRadius:"8px" }}>
            <Typography sx={{ fontSize:10, fontWeight:700, color:PURPLE,
              textTransform:"uppercase", letterSpacing:".5px", mb:0.5 }}>✦ Rich Text</Typography>
            <Typography sx={{ fontSize:11, color:PURPLE, lineHeight:1.55 }}>
              Format with fonts, colours, lists and links. Your signature is saved automatically.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
