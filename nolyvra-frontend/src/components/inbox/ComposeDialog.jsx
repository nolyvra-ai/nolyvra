import { useEffect, useState } from "react";
import {
  Box, Dialog, DialogContent, IconButton, Typography, Button, TextField, MenuItem, Alert, CircularProgress,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { QuillEditor } from "./emailEditorUtils";
import { BODY_MODULES, SIG_MODULES, injectQuillStyles, textToHtml, buildBodyWithSig } from "./emailHelpers";
import { apiGet, apiPost } from "./inboxApi";

const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", DANGER = "#DC2626";
const SURFACE = "#FAFBFD";

// Full-featured compose modal — single email + bulk outreach (unchanged from
// the previous always-visible compose form, just moved into a dialog so the
// inbox panes have room). candidates/jobs/templates/connectedEmailProvider
// are fetched once by the parent Email Centre page and passed down.
export default function ComposeDialog({
  open, onClose, candidates, jobs, templates, connectedEmailProvider, initialSeed, onSent,
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [rawTemplate, setRawTemplate] = useState({ subject: "", body: "" });
  const [signature, setSignature] = useState(() => localStorage.getItem("emailSignature") || "");

  const [form, setForm] = useState({
    toAddress: "", subject: "", body: "", candidateId: "", jobId: "", templateType: "", clientId: "",
  });

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkRecipients, setBulkRecipients] = useState([]);
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkBody, setBulkBody] = useState("");
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  useEffect(() => { injectQuillStyles(); }, []);

  useEffect(() => {
    if (!open) return;
    setError(null); setSuccess(false); setBulkResults(null);

    const s = initialSeed;
    if (s && Array.isArray(s.bulkRecipients) && s.bulkRecipients.length > 0) {
      setBulkMode(true);
      setBulkRecipients(s.bulkRecipients.map(r => ({ name: r.name || "there", email: r.email || "", status: "pending" })));
      setBulkSubject(s.bulkSubject || "");
      setBulkBody(s.bulkBodyTemplate ? textToHtml(s.bulkBodyTemplate) : "");
    } else if (s && (s.toAddress || s.subject || s.body)) {
      setBulkMode(false);
      setForm(p => ({
        ...p,
        candidateId: s.candidateId || "",
        toAddress: s.toAddress || "",
        subject: s.subject || "",
        body: s.body ? textToHtml(s.body) : "",
        clientId: s.clientId || "",
      }));
    } else {
      setBulkMode(false);
      setForm({ toAddress: "", subject: "", body: "", candidateId: "", jobId: "", templateType: "", clientId: "" });
    }
  }, [open, initialSeed]);

  function updateForm(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function substitute(text, candName, job) {
    if (!text) return text;
    const recruiterName = localStorage.getItem("name") || "Recruiter";
    const jobTitle = job?.title || "";
    const company = job?.company || "";
    return text
      .replace(/\{name\}/gi, candName || "{name}")
      .replace(/\{role\}/gi, jobTitle || "{role}")
      .replace(/\{company\}/gi, company || "{company}")
      .replace(/\{recruiter\}/gi, recruiterName)
      .replace(/\[candidateName\]|\[Candidate Name\]|\[Name\]|\[CANDIDATE_NAME\]/gi, candName || "[Candidate Name]")
      .replace(/\[jobTitle\]|\[Job Title\]|\[Position\]|\[ROLE\]|\[JOB_TITLE\]/gi, jobTitle || "[Job Title]");
  }

  function applyTemplate(template) {
    setRawTemplate({ subject: template.subject, body: template.body });
    const cand = candidates.find(c => c.id === form.candidateId);
    const job = jobs.find(j => j.id === form.jobId);
    setForm(p => ({
      ...p,
      subject: substitute(template.subject, cand?.name || "", job),
      body: textToHtml(substitute(template.body, cand?.name || "", job)),
      templateType: template.templateType,
    }));
  }

  function handleCandidateChange(candId) {
    const cand = candidates.find(c => c.id === candId);
    const job = jobs.find(j => j.id === form.jobId);
    setForm(p => ({
      ...p,
      candidateId: candId,
      toAddress: cand?.email || p.toAddress,
      ...(rawTemplate.body ? {
        subject: substitute(rawTemplate.subject, cand?.name || "", job),
        body: textToHtml(substitute(rawTemplate.body, cand?.name || "", job)),
      } : {}),
    }));

    if (!candId) return;
    apiGet(`/api/candidates/${candId}/applications`)
      .then(applications => {
        if (!Array.isArray(applications) || applications.length !== 1) return;
        const jobId = applications[0].jobId;
        if (!jobId) return;
        setForm(p => {
          if (p.candidateId !== candId) return p;
          const linkedJob = jobs.find(j => j.id === jobId);
          return {
            ...p,
            jobId,
            ...(rawTemplate.body ? {
              subject: substitute(rawTemplate.subject, cand?.name || "", linkedJob),
              body: textToHtml(substitute(rawTemplate.body, cand?.name || "", linkedJob)),
            } : {}),
          };
        });
      })
      .catch(() => {});
  }

  function handleJobChange(jobId) {
    const cand = candidates.find(c => c.id === form.candidateId);
    const job = jobs.find(j => j.id === jobId);
    setForm(p => ({
      ...p,
      jobId,
      ...(rawTemplate.body ? {
        subject: substitute(rawTemplate.subject, cand?.name || "", job),
        body: textToHtml(substitute(rawTemplate.body, cand?.name || "", job)),
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
      const sent = await apiPost("/api/emails/send", {}, {
        ...form,
        body: buildBodyWithSig(form.body, signature),
        clientId: form.clientId ? Number(form.clientId) : null,
      });
      onSent?.(sent);
      setSuccess(true);
      setForm(p => ({ ...p, toAddress: "", subject: "", body: "", candidateId: "" }));
    } catch (e) { setError(e.message); }
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
        const savedRec = await apiPost("/api/emails/send", {}, {
          toAddress: r.email, subject: bulkSubject, body: personalizedBody, candidateId: "", templateType: "",
        });
        onSent?.(savedRec);
        recipients[i] = { ...r, status: "sent" };
        sent++;
      } catch {
        recipients[i] = { ...r, status: "failed" };
        failed++;
      }
      setBulkRecipients([...recipients]);
    }

    setBulkResults({ sent, skipped, failed });
    setBulkSending(false);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT }}>
          {bulkMode ? `Bulk Outreach — ${bulkRecipients.length} recipient${bulkRecipients.length === 1 ? "" : "s"}` : "New Email"}
        </Typography>
        <IconButton size="small" onClick={onClose}><CloseRoundedIcon fontSize="small" /></IconButton>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: "flex", gap: 0 }}>
          <Box sx={{ flex: 1.4, p: 2.25 }}>
            {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setSuccess(false)}>Email sent successfully!</Alert>}

            {bulkMode ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography sx={{ fontSize: 10.5, color: MUTED }}>
                  "{"{}"}" in the message is replaced with each recipient's name when sent.
                </Typography>
                <Button size="small" onClick={() => { setBulkMode(false); setBulkResults(null); }}
                  sx={{ fontSize: 11, color: MUTED, textTransform: "none", alignSelf: "flex-start", p: 0 }}>
                  Switch to single email
                </Button>

                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Subject</Typography>
                  <TextField fullWidth size="small" value={bulkSubject} onChange={e => setBulkSubject(e.target.value)}
                    placeholder="Email subject…" sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }} />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Message</Typography>
                  <QuillEditor value={bulkBody} onChange={html => setBulkBody(html)} modules={BODY_MODULES}
                    placeholder="Write your bulk message here…" className="nolyvra-quill" />
                </Box>

                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>Recipients</Typography>
                    <Typography sx={{ fontSize: 10, color: MUTED }}>Blank rows are skipped.</Typography>
                  </Box>
                  <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
                    {bulkRecipients.map((r, i) => (
                      <Box key={i} sx={{
                        display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1,
                        borderBottom: i < bulkRecipients.length - 1 ? `1px solid ${BORDER}` : "none",
                        bgcolor: i % 2 === 1 ? SURFACE : "#fff",
                      }}>
                        <Box sx={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          bgcolor: r.status === "sent" ? SUCCESS : r.status === "failed" ? DANGER
                            : r.status === "skipped" ? MUTED : "#D1D5DB",
                        }} />
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, width: 140, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.name}
                        </Typography>
                        <TextField size="small" fullWidth value={r.email} disabled={bulkSending}
                          onChange={e => updateBulkRecipient(i, e.target.value)} placeholder="email@company.com"
                          sx={{ "& .MuiOutlinedInput-root": { borderRadius: "6px", fontSize: 12 } }} />
                        {r.status !== "pending" && (
                          <Typography sx={{ fontSize: 10.5, fontWeight: 600, flexShrink: 0, color: r.status === "sent" ? SUCCESS : r.status === "failed" ? DANGER : MUTED }}>
                            {r.status === "sent" ? "Sent" : r.status === "failed" ? "Failed" : "Skipped"}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>

                <SignatureBlock signature={signature} onChange={handleSignatureChange} />

                {bulkResults && (
                  <Alert severity={bulkResults.failed > 0 ? "warning" : "success"}>
                    Sent {bulkResults.sent}{bulkResults.skipped > 0 ? `, skipped ${bulkResults.skipped} (no email)` : ""}{bulkResults.failed > 0 ? `, ${bulkResults.failed} failed` : ""}.
                  </Alert>
                )}

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Button variant="contained" onClick={handleBulkSendAll}
                    disabled={bulkSending || !bulkSubject || !bulkBody || bulkRecipients.length === 0}
                    sx={{ fontSize: 12, fontWeight: 500, bgcolor: ACCENT, borderRadius: "8px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                    {bulkSending ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "✉ Send All"}
                  </Button>
                  <ProviderPill provider={connectedEmailProvider} />
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1.5 }}>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>To (Candidate)</Typography>
                    <TextField select fullWidth size="small" value={form.candidateId} onChange={e => handleCandidateChange(e.target.value)}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}>
                      <MenuItem value="" sx={{ fontSize: 12 }}>Select candidate…</MenuItem>
                      {candidates.map(c => (
                        <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12 }}>{c.name}{c.email ? ` (${c.email})` : ""}</MenuItem>
                      ))}
                    </TextField>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Job</Typography>
                    <TextField select fullWidth size="small" value={form.jobId} onChange={e => handleJobChange(e.target.value)}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}>
                      <MenuItem value="" sx={{ fontSize: 12 }}>Select job…</MenuItem>
                      {jobs.map(j => <MenuItem key={j.id} value={j.id} sx={{ fontSize: 12 }}>{j.title}</MenuItem>)}
                    </TextField>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Email Address</Typography>
                    <TextField fullWidth size="small" value={form.toAddress} onChange={e => updateForm("toAddress", e.target.value)}
                      placeholder="candidate@email.com" sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }} />
                  </Box>
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Subject</Typography>
                  <TextField fullWidth size="small" value={form.subject} onChange={e => updateForm("subject", e.target.value)}
                    placeholder="Email subject…" sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }} />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Message</Typography>
                  <QuillEditor value={form.body} onChange={html => updateForm("body", html)} modules={BODY_MODULES}
                    placeholder="Write your message here, or select a template on the right…" className="nolyvra-quill" />
                </Box>

                <SignatureBlock signature={signature} onChange={handleSignatureChange} />

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Button variant="contained" onClick={handleSend} disabled={sending}
                    sx={{ fontSize: 12, fontWeight: 500, bgcolor: ACCENT, borderRadius: "8px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                    {sending ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "✉ Send Email"}
                  </Button>
                  <ProviderPill provider={connectedEmailProvider} />
                </Box>
              </Box>
            )}
          </Box>

          {/* ── Templates sidebar (click to insert into the compose form) ──── */}
          <Box sx={{ flex: "0 0 220px", borderLeft: `1px solid ${BORDER}`, bgcolor: SURFACE }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: TEXT }}>Templates</Typography>
            </Box>
            <Box sx={{ maxHeight: 480, overflowY: "auto" }}>
              {templates.length === 0 ? (
                <Box sx={{ p: 2.5, textAlign: "center" }}>
                  <Typography sx={{ fontSize: 12, color: MUTED }}>No templates yet.</Typography>
                </Box>
              ) : templates.map((t, i) => (
                <Box key={t.id} onClick={() => applyTemplate(t)}
                  sx={{
                    px: 2, py: 1.25, borderBottom: i < templates.length - 1 ? "1px solid #EDF0F5" : "none",
                    cursor: "pointer", "&:hover": { bgcolor: "#F0F2F6" }, transition: "background .1s", bgcolor: "#fff",
                  }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{t.name}</Typography>
                  <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>{t.subject.substring(0, 36)}…</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function SignatureBlock({ signature, onChange }) {
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>Email Signature</Typography>
        <Typography sx={{ fontSize: 10, color: MUTED }}>Appended to every email · auto-saved</Typography>
      </Box>
      <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "8px", bgcolor: SURFACE, px: 1.5, py: 1 }}>
        <QuillEditor value={signature} onChange={onChange} modules={SIG_MODULES}
          placeholder="e.g.  Best regards, Your Name | Title | Company" className="nolyvra-quill-sig" />
      </Box>
    </Box>
  );
}

function ProviderPill({ provider }) {
  if (!provider) return null;
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", gap: 0.5, bgcolor: "#EFF6FF", border: "1px solid #BFDBFE",
      borderRadius: "20px", px: 1.25, py: 0.4, fontSize: 11, fontWeight: 500, color: "#1D4ED8",
    }}>
      Sending via {provider.email || provider.name}
    </Box>
  );
}
