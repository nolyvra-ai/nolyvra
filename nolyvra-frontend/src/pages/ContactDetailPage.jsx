import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Button, CircularProgress, Alert, IconButton, Tooltip,
  Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from "@mui/material";

const API     = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const loginId = () => localStorage.getItem("loginId") || "";
const hdrs    = () => ({
  Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
  "Content-Type": "application/json",
});

async function apiError(response) {
  const text = await response.text();
  try { const j = JSON.parse(text); return new Error(j.message || j.error || "Request failed"); }
  catch { return new Error(text || "Request failed"); }
}
async function apiGet(path) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${API}${path}${sep}loginId=${encodeURIComponent(loginId())}`, { headers: hdrs() });
  if (!r.ok) throw await apiError(r);
  return r.json();
}
async function apiPostJson(path, body) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${API}${path}${sep}loginId=${encodeURIComponent(loginId())}`, {
    method: "POST", headers: hdrs(), body: JSON.stringify(body),
  });
  if (!r.ok) throw await apiError(r);
  return r.json();
}
async function apiPutJson(path, body) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${API}${path}${sep}loginId=${encodeURIComponent(loginId())}`, {
    method: "PUT", headers: hdrs(), body: JSON.stringify(body),
  });
  if (!r.ok) throw await apiError(r);
  return r.json();
}

// ─── Design tokens (matches ClientTrackerPage.jsx) ────────────────────────────
const SURFACE   = "#FFFFFF";
const BORDER    = "#E8ECF2";
const MUTED     = "#8A94A6";
const TEXT      = "#0F1623";
const ACCENT    = "#1D72E8";
const ACCENT_L  = "rgba(29,114,232,0.08)";
const SUCCESS   = "#16A34A";
const SUCCESS_L = "rgba(22,163,74,0.08)";
const WARN      = "#D97706";
const WARN_L    = "rgba(217,119,6,0.08)";

const CARD = { bgcolor: SURFACE, border: `1px solid ${BORDER}`, borderRadius: "12px", boxShadow: "0 1px 4px rgba(15,22,35,0.05)" };
const FIELD_SX = {
  "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13, "& fieldset": { borderColor: BORDER } },
  "& .MuiInputLabel-root": { fontSize: 13 },
};

function Tag({ children, color = ACCENT, bg = ACCENT_L }) {
  return (
    <Box component="span" sx={{
      display: "inline-flex", alignItems: "center", bgcolor: bg, color,
      border: `1px solid ${color}33`, borderRadius: "20px", px: "10px", py: "3px",
      fontSize: 12, fontWeight: 700,
    }}>{children}</Box>
  );
}

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function InfoField({ label, value }) {
  return (
    <Box>
      <Box sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".4px", mb: "3px" }}>
        {label}
      </Box>
      <Box sx={{ fontSize: 13, color: value ? TEXT : "#C7CDD6" }}>{value || "Not available"}</Box>
    </Box>
  );
}

function SocialIcon({ href, title, svg }) {
  const enabled = !!href;
  const body = (
    <Box sx={{
      width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      bgcolor: enabled ? ACCENT_L : "#F1F3F7", color: enabled ? ACCENT : "#C7CDD6",
      cursor: enabled ? "pointer" : "default", flexShrink: 0,
    }}>{svg}</Box>
  );
  return (
    <Tooltip title={enabled ? title : `${title} — Not available`}>
      {enabled ? <Box component="a" href={href} target="_blank" rel="noopener noreferrer">{body}</Box> : body}
    </Tooltip>
  );
}

const LinkedInSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>;
const FacebookSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>;
const TwitterSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-6.9L4.4 22H1.3l8.1-9.3L1 2h7l4.9 6.4L18.9 2zm-1.2 18h1.9L7.4 4H5.4L17.7 20z"/></svg>;
const PhoneSvg = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const MailSvg = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const EditSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const LinkSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;

function TabEmptyState({ icon, title, desc }) {
  return (
    <Box sx={{ py: "48px", textAlign: "center" }}>
      <Box sx={{ fontSize: 40, mb: "12px", color: "#C7CDD6" }}>{icon}</Box>
      <Box sx={{ fontSize: 14, fontWeight: 700, color: TEXT, mb: "4px" }}>{title}</Box>
      {desc && <Box sx={{ fontSize: 12, color: MUTED }}>{desc}</Box>}
    </Box>
  );
}

const CONTACT_TABS = [
  { key: "jobs",     label: "Jobs" },
  { key: "emails",   label: "Related Emails" },
  { key: "pitched",  label: "Candidates Pitched" },
  { key: "employed", label: "Candidates Employed" },
  { key: "files",    label: "Files" },
  { key: "invoices", label: "Invoices" },
  { key: "notes",    label: "Notes" },
  { key: "clientContact", label: "Client Contact" },
];

function CandidateList({ loading, candidates, emptyTitle }) {
  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>;
  if (candidates.length === 0) return <TabEmptyState icon="👤" title={emptyTitle} />;
  return (
    <Box>
      {candidates.map((c, i) => (
        <Box key={c.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          py: "10px", borderBottom: i < candidates.length - 1 ? `1px solid ${BORDER}` : "none" }}>
          <Box>
            <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{c.name || "—"}</Box>
            <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>{[c.email, c.jobTitle].filter(Boolean).join(" · ") || "—"}</Box>
          </Box>
          <Tag color={ACCENT} bg={ACCENT_L}>{c.stage || "—"}</Tag>
        </Box>
      ))}
    </Box>
  );
}

function EditContactDialog({ open, onClose, contact, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && contact) {
      setForm({
        name: contact.name || "", title: contact.title || "",
        email: contact.email || "", phone: contact.phone || "",
        linkedinUrl: contact.linkedinUrl || "", facebookUrl: contact.facebookUrl || "",
        twitterUrl: contact.twitterUrl || "",
      });
      setError("");
    }
  }, [open, contact]);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  async function save() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    try {
      const saved = await apiPutJson(`/api/contacts/${contact.id}`, form);
      onSaved(saved);
      onClose();
    } catch (e) { setError(e.message || "Failed to save contact."); }
    finally { setSaving(false); }
  }

  if (!form) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 600, color: TEXT }}>Edit Contact</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        {error && <Alert severity="error" sx={{ fontSize: 12, borderRadius: "8px" }}>{error}</Alert>}
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <TextField label="Name" value={form.name} onChange={set("name")} size="small" fullWidth sx={{ ...FIELD_SX, gridColumn: "1 / -1" }} />
          <TextField label="Title" value={form.title} onChange={set("title")} size="small" fullWidth sx={FIELD_SX} />
          <TextField label="Email" value={form.email} onChange={set("email")} size="small" fullWidth sx={FIELD_SX} />
          <TextField label="Phone" value={form.phone} onChange={set("phone")} size="small" fullWidth sx={FIELD_SX} />
          <TextField label="LinkedIn URL" value={form.linkedinUrl} onChange={set("linkedinUrl")} size="small" fullWidth sx={FIELD_SX} />
          <TextField label="Facebook URL" value={form.facebookUrl} onChange={set("facebookUrl")} size="small" fullWidth sx={FIELD_SX} />
          <TextField label="Twitter / X URL" value={form.twitterUrl} onChange={set("twitterUrl")} size="small" fullWidth sx={FIELD_SX} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ color: MUTED, textTransform: "none" }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}
          sx={{ textTransform: "none", borderRadius: "8px", boxShadow: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
          {saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ContactDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState("jobs");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [candidateNotes, setCandidateNotes] = useState([]);
  const [candidateNotesLoading, setCandidateNotesLoading] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [emails, setEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [pitched, setPitched] = useState([]);
  const [pitchedLoading, setPitchedLoading] = useState(true);
  const [employed, setEmployed] = useState([]);
  const [employedLoading, setEmployedLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const c = await apiGet(`/api/contacts/${id}`);
      setContact(c);

      const clientId = c.clientId;
      setJobsLoading(true);
      apiGet(`/api/clients/${clientId}/jobs`).then(d => setJobs(d || [])).catch(() => {}).finally(() => setJobsLoading(false));
      setEmailsLoading(true);
      apiGet(`/api/clients/${clientId}/emails`).then(d => setEmails(d || [])).catch(() => {}).finally(() => setEmailsLoading(false));
      setPitchedLoading(true);
      apiGet(`/api/clients/${clientId}/candidates-pitched`).then(d => setPitched(d || [])).catch(() => {}).finally(() => setPitchedLoading(false));
      setEmployedLoading(true);
      apiGet(`/api/clients/${clientId}/candidates-employed`).then(d => setEmployed(d || [])).catch(() => {}).finally(() => setEmployedLoading(false));
      setFilesLoading(true);
      apiGet(`/api/clients/${clientId}/files`).then(d => setFiles(d || [])).catch(() => {}).finally(() => setFilesLoading(false));
      setInvoicesLoading(true);
      apiGet(`/api/clients/${clientId}/invoices`).then(d => setInvoices(d || [])).catch(() => {}).finally(() => setInvoicesLoading(false));
      setNotesLoading(true);
      apiGet(`/api/clients/${clientId}/notes`).then(d => setNotes(d || [])).catch(() => {}).finally(() => setNotesLoading(false));
    } catch (e) {
      setError(e.message || "Failed to load contact.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Candidate's own notes — fetched independently once linked, so linking
  // doesn't need to be part of the main contact load.
  useEffect(() => {
    if (!contact?.candidateId) { setCandidateNotes([]); return; }
    setCandidateNotesLoading(true);
    apiGet(`/api/candidates/${contact.candidateId}/notes`)
      .then(d => setCandidateNotes(d || []))
      .catch(() => {})
      .finally(() => setCandidateNotesLoading(false));
  }, [contact?.candidateId]);

  async function handleAddNote() {
    if (!newNote.trim() || !contact) return;
    setAddingNote(true);
    try {
      const updated = await apiPostJson(`/api/clients/${contact.clientId}/notes`, { note: newNote.trim() });
      setNotes(updated || []);
      setNewNote("");
    } catch (e) { alert(e.message); }
    finally { setAddingNote(false); }
  }

  async function handleLinkCandidate() {
    if (!contact) return;
    setLinking(true);
    setLinkError("");
    try {
      const updated = await apiPostJson(`/api/contacts/${contact.id}/link-candidate`, {});
      setContact(updated);
    } catch (e) {
      setLinkError(e.message || "Failed to link candidate.");
    } finally {
      setLinking(false);
    }
  }

  if (loading) {
    return <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  }
  if (error || !contact) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error || "Contact not found."}</Alert></Box>;
  }

  const isClient = contact.clientStatus === "CLIENT";

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>
      {/* Header */}
      <Paper elevation={0} sx={{ ...CARD, p: "24px", mb: "18px" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: ACCENT, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
              {initials(contact.name)}
            </Box>
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Box sx={{ fontSize: 19, fontWeight: 700, color: TEXT }}>{contact.name}</Box>
                <Tag color={MUTED} bg="#F1F3F7">ID-{contact.id}</Tag>
                <Tag color={isClient ? SUCCESS : WARN} bg={isClient ? SUCCESS_L : WARN_L}>{isClient ? "Client" : "Lead"}</Tag>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mt: "6px", fontSize: 13, color: MUTED }}>
                {contact.title || "No title"} {contact.clientCompanyName ? `· ${contact.clientCompanyName}` : ""}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mt: "10px" }}>
                <SocialIcon href={contact.linkedinUrl} title="LinkedIn" svg={LinkedInSvg} />
                <SocialIcon href={contact.facebookUrl} title="Facebook" svg={FacebookSvg} />
                <SocialIcon href={contact.twitterUrl} title="Twitter / X" svg={TwitterSvg} />
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: "8px" }}>
            <Button size="small" variant="outlined" startIcon={PhoneSvg}
              component={contact.phone ? "a" : "button"} href={contact.phone ? `tel:${contact.phone}` : undefined}
              disabled={!contact.phone}
              sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", borderColor: BORDER, color: TEXT }}>
              Call
            </Button>
            <Button size="small" variant="contained" startIcon={MailSvg}
              onClick={() => nav("/email", { state: { toAddress: contact.email || "" } })}
              sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", boxShadow: "none", bgcolor: ACCENT, "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
              Email
            </Button>
            {contact.candidateId ? (
              <Button size="small" variant="outlined" startIcon={LinkSvg}
                onClick={() => nav(`/candidates/${contact.candidateId}/workflow`)}
                sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", borderColor: BORDER, color: TEXT }}>
                View Candidate
              </Button>
            ) : (
              <Button size="small" variant="outlined" startIcon={LinkSvg} onClick={handleLinkCandidate} disabled={linking}
                sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", borderColor: BORDER, color: TEXT }}>
                {linking ? <CircularProgress size={14} /> : "Link to Candidate"}
              </Button>
            )}
            <IconButton size="small" onClick={() => setEditOpen(true)} sx={{ color: MUTED, border: `1px solid ${BORDER}`, "&:hover": { color: ACCENT, borderColor: ACCENT } }}>
              {EditSvg}
            </IconButton>
          </Box>
        </Box>

        {linkError && <Alert severity="error" sx={{ mt: "12px", fontSize: 12, borderRadius: "8px" }}>{linkError}</Alert>}

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "16px", mt: "20px", pt: "18px", borderTop: `1px solid ${BORDER}` }}>
          <InfoField label="Email" value={contact.email} />
          <InfoField label="Phone" value={contact.phone} />
          <InfoField label="Company" value={contact.clientCompanyName} />
          <InfoField label="Industry" value={contact.clientIndustry} />
        </Box>
      </Paper>

      {contact.candidateId && (
        <Paper elevation={0} sx={{ ...CARD, p: "18px", mb: "18px" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "10px" }}>
            <Box sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Linked Candidate</Box>
            <Button size="small" onClick={() => nav(`/candidates/${contact.candidateId}/workflow`)}
              sx={{ fontSize: 12, textTransform: "none", color: ACCENT }}>
              View full candidate profile →
            </Button>
          </Box>
          {candidateNotesLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: "12px" }}><CircularProgress size={18} sx={{ color: ACCENT }} /></Box>
          ) : candidateNotes.length === 0 ? (
            <Box sx={{ fontSize: 12, color: MUTED }}>No candidate notes yet.</Box>
          ) : (
            candidateNotes.slice(0, 3).map((n, i) => (
              <Box key={n.id || i} sx={{ py: "8px", borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                <Box sx={{ fontSize: 12.5, color: TEXT, whiteSpace: "pre-wrap" }}>{n.note}</Box>
              </Box>
            ))
          )}
        </Paper>
      )}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
        mb: "16px", borderBottom: `1px solid ${BORDER}`,
        "& .MuiTab-root": { fontSize: 12.5, fontWeight: 600, textTransform: "none", minHeight: 40, color: MUTED },
        "& .Mui-selected": { color: ACCENT },
        "& .MuiTabs-indicator": { bgcolor: ACCENT },
      }}>
        {CONTACT_TABS.map(t => {
          const badge =
            t.key === "jobs"     ? jobs.length :
            t.key === "emails"   ? emails.length :
            t.key === "pitched"  ? pitched.length :
            t.key === "employed" ? employed.length :
            t.key === "files"    ? files.length :
            t.key === "invoices" ? invoices.length : null;
          return (
            <Tab key={t.key} value={t.key} label={
              <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {t.label}
                {badge !== null && (
                  <Box sx={{ fontSize: 10, fontWeight: 700, color: MUTED, bgcolor: "#F1F3F7", borderRadius: "10px", px: "6px", py: "1px" }}>{badge}</Box>
                )}
              </Box>
            } />
          );
        })}
      </Tabs>

      <Paper elevation={0} sx={{ ...CARD, p: "18px" }}>
        {tab === "jobs" && (
          jobsLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box> :
          jobs.length === 0 ? <TabEmptyState icon="💼" title="No Jobs Found" /> :
          jobs.map((job, i) => (
            <Box key={i} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              py: "10px", borderBottom: i < jobs.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <Box>
                <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{job.title}</Box>
                <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>
                  {job.salary != null ? `${job.currency} ${Number(job.salary).toLocaleString()}` : "No salary set"} · {job.status}
                </Box>
              </Box>
              <Box sx={{ fontSize: 13, fontWeight: 700, color: job.estimatedFee != null ? SUCCESS : MUTED }}>
                {job.estimatedFee != null ? `${job.currency} ${Number(job.estimatedFee).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
              </Box>
            </Box>
          ))
        )}

        {tab === "emails" && (
          emailsLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box> :
          emails.length === 0 ? <TabEmptyState icon="✉️" title="No Related Emails Found" /> :
          emails.map((e, i) => (
            <Box key={e.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              py: "10px", borderBottom: i < emails.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <Box>
                <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{e.subject || "(no subject)"}</Box>
                <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>To: {e.toAddress}</Box>
              </Box>
              <Tag color={e.status === "Sent" ? SUCCESS : "#DC2626"} bg={e.status === "Sent" ? SUCCESS_L : "rgba(220,38,38,0.08)"}>{e.status}</Tag>
            </Box>
          ))
        )}

        {tab === "pitched" && <CandidateList loading={pitchedLoading} candidates={pitched} emptyTitle="No Candidates Pitched Yet" />}
        {tab === "employed" && <CandidateList loading={employedLoading} candidates={employed} emptyTitle="No Candidates Employed Yet" />}

        {tab === "files" && (
          filesLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box> :
          files.length === 0 ? <TabEmptyState icon="📄" title="No Files Found" /> :
          files.map((f, i) => (
            <Box key={f.id} sx={{ py: "10px", borderBottom: i < files.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{f.fileName}</Box>
            </Box>
          ))
        )}

        {tab === "invoices" && (
          invoicesLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box> :
          invoices.length === 0 ? <TabEmptyState icon="🧾" title="No Invoices Found" /> :
          invoices.map((inv, i) => (
            <Box key={inv.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              py: "10px", borderBottom: i < invoices.length - 1 ? `1px solid ${BORDER}` : "none" }}>
              <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{inv.xeroInvoiceNumber || `Invoice #${inv.id}`}</Box>
              <Box sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{inv.currency} {Number(inv.total).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Box>
            </Box>
          ))
        )}

        {tab === "notes" && (
          <Box>
            <Box sx={{ display: "flex", gap: "8px", mb: "12px" }}>
              <TextField value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note…"
                size="small" fullWidth multiline maxRows={4} sx={FIELD_SX} disabled={addingNote} />
              <Button onClick={handleAddNote} disabled={addingNote || !newNote.trim()} variant="contained"
                sx={{ borderRadius: "8px", textTransform: "none", fontSize: 12, fontWeight: 600, bgcolor: ACCENT, boxShadow: "none", flexShrink: 0 }}>
                {addingNote ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Add"}
              </Button>
            </Box>
            {notesLoading ? <Box sx={{ display: "flex", justifyContent: "center", py: "12px" }}><CircularProgress size={18} sx={{ color: ACCENT }} /></Box> :
             notes.length === 0 ? <TabEmptyState icon="📝" title="No Notes Yet" /> :
             notes.map((n, i) => (
               <Box key={n.id} sx={{ py: "8px", borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                 <Box sx={{ fontSize: 13, color: TEXT, whiteSpace: "pre-wrap" }}>{n.note}</Box>
               </Box>
             ))}
          </Box>
        )}

        {tab === "clientContact" && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            p: "16px", borderRadius: "10px", border: `1px solid ${BORDER}`, bgcolor: "#F8FAFC" }}>
            <Box>
              <Box sx={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{contact.clientCompanyName}</Box>
              <Box sx={{ fontSize: 12, color: MUTED, mt: "3px" }}>
                {[contact.clientIndustry, contact.clientLocation].filter(Boolean).join(" · ") || "No company details set"}
              </Box>
              <Box sx={{ mt: "8px" }}>
                <Tag color={isClient ? SUCCESS : WARN} bg={isClient ? SUCCESS_L : WARN_L}>{isClient ? "Client" : "Lead"}</Tag>
              </Box>
            </Box>
            <Button size="small" variant="outlined" onClick={() => nav("/clients")}
              sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", borderColor: BORDER, color: TEXT }}>
              View in Client Tracker
            </Button>
          </Box>
        )}
      </Paper>

      <EditContactDialog open={editOpen} onClose={() => setEditOpen(false)} contact={contact} onSaved={setContact} />
    </Box>
  );
}
