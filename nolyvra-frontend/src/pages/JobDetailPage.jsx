import { useEffect, useState } from "react";
import {
  Box, Paper, Typography, Button, CircularProgress, Tabs, Tab, TextField,
  Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706", WARN_BG = "#FFFBEB", WARN_BR = "#FDE68A";
const DANGER = "#DC2626", DANGER_BG = "#FEF2F2", DANGER_BR = "#FECACA";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";
const SURFACE = "#FAFBFD";

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

async function apiPostJson(path, body) {
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

function skillsPreview(skills) {
  if (!skills || skills.length === 0) return "—";
  return skills.slice(0, 3).join(", ");
}

// "City, State" if both exist, otherwise whichever one is present, otherwise "—"
function formatLocation(c) {
  const parts = [c.location, c.state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function Badge({ label, variant = "neutral" }) {
  const s = {
    success: { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
    warning: { bg: WARN_BG, border: WARN_BR, color: WARN },
    danger:  { bg: DANGER_BG, border: DANGER_BR, color: DANGER },
    accent:  { bg: ACCENT_BG, border: ACCENT_BR, color: ACCENT },
    neutral: { bg: "#F1F3F7", border: BORDER, color: MUTED },
    purple:  { bg: PURPLE_BG, border: PURPLE_BR, color: PURPLE },
  }[variant] ?? { bg: "#F1F3F7", border: BORDER, color: MUTED };
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", bgcolor: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "20px", px: 1.25, py: 0.25, fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap" }}>
      {label}
    </Box>
  );
}

function StatusBadge({ status }) {
  const map = { Active: "success", Fulfilling: "warning", Complete: "neutral", Draft: "warning" };
  return <Badge label={status || "Active"} variant={map[status] ?? "neutral"} />;
}

function StageBadge({ stage }) {
  const cfg = {
    Screening: { variant: "accent", label: "Screening" },
    Interview: { variant: "warning", label: "Interview" },
    Assessment: { variant: "warning", label: "Assessment" },
    Offer: { variant: "success", label: "Offer" },
    Selected: { variant: "success", label: "Selected" },
    Rejected: { variant: "danger", label: "Rejected" },
  };
  const c = cfg[stage] ?? { variant: "neutral", label: stage ?? "—" };
  return <Badge label={c.label} variant={c.variant} />;
}

function Card({ children, sx = {} }) {
  return (
    <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden", bgcolor: "#fff", ...sx }}>
      {children}
    </Paper>
  );
}

function CardHead({ title, action }) {
  return (
    <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: "#fff" }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{title}</Typography>
      {action}
    </Box>
  );
}

function computeEstimatedFee(job) {
  if (job.feeType === "FIXED") return job.fixedFee;
  if (job.salary == null || job.feePercentage == null) return null;
  return (Number(job.salary) * Number(job.feePercentage)) / 100;
}

export default function JobDetailPage() {
  const { jobId } = useParams();
  const nav = useNavigate();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);

  const [client, setClient] = useState(null);
  const [clientLoading, setClientLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [noteError, setNoteError] = useState("");
  const [emails, setEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);

  const [tab, setTab] = useState("candidates");
  const [jdExpanded, setJdExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    apiGet(`/api/jobs/${jobId}`)
      .then(d => { if (!cancelled) setJob(d); })
      .catch(e => { if (!cancelled) setError(e.message || "Failed to load job."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    setCandidatesLoading(true);
    apiGet(`/api/jobs/${jobId}/candidates?limit=10&offset=0`)
      .then(d => { if (!cancelled) setCandidates(d || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCandidatesLoading(false); });

    return () => { cancelled = true; };
  }, [jobId]);

  // Resolve the client tied to this job's company (exact match — see
  // ClientService.findByCompanyName), then load its notes + related emails.
  useEffect(() => {
    if (!job?.company) { setClientLoading(false); return; }
    let cancelled = false;
    setClientLoading(true);
    apiGet(`/api/clients/by-company?company=${encodeURIComponent(job.company)}`)
      .then(d => { if (!cancelled) setClient(d); })
      .catch(() => { if (!cancelled) setClient(null); })
      .finally(() => { if (!cancelled) setClientLoading(false); });
    return () => { cancelled = true; };
  }, [job?.company]);

  useEffect(() => {
    if (!client?.id) return;
    let cancelled = false;
    setNotesLoading(true);
    apiGet(`/api/clients/${client.id}/notes`)
      .then(d => { if (!cancelled) setNotes(d || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setNotesLoading(false); });

    setEmailsLoading(true);
    apiGet(`/api/clients/${client.id}/emails`)
      .then(d => { if (!cancelled) setEmails(d || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEmailsLoading(false); });
    return () => { cancelled = true; };
  }, [client?.id]);

  async function handleAddNote() {
    if (!newNote.trim() || !client) return;
    setAddingNote(true); setNoteError("");
    try {
      const updated = await apiPostJson(`/api/clients/${client.id}/notes`, { note: newNote.trim() });
      setNotes(updated || []);
      setNewNote("");
    } catch (e) {
      setNoteError(e.message || "Failed to add note.");
    } finally {
      setAddingNote(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={22} sx={{ color: ACCENT }} />
      </Box>
    );
  }

  if (error || !job) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography sx={{ fontSize: 13, color: DANGER }}>{error || "Job not found."}</Typography>
        <Button size="small" onClick={() => nav("/jobs")} sx={{ mt: 1.5, textTransform: "none", color: ACCENT }}>
          ← Back to Jobs
        </Button>
      </Box>
    );
  }

  const estimatedFee = computeEstimatedFee(job);

  return (
    <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        border: `1px solid ${BORDER}`, borderRadius: "10px", p: "18px 22px", bgcolor: "#fff" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{job.title}</Typography>
          {job.company && <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.25 }}>{job.company}</Typography>}
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1.25 }}>
            <StatusBadge status={job.status} />
            {job.location && <Badge label={`📍 ${job.location}`} variant="accent" />}
            {job.jobType && <Badge label={job.jobType} />}
            {job.seniority && <Badge label={job.seniority} />}
            {job.salary != null && (
              <Badge label={`${job.currency || ""} ${Number(job.salary).toLocaleString()}`} variant="success" />
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
          <Button variant="outlined" size="small" onClick={() => nav("/jobs")}
            sx={{ fontSize: 11, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
            ← Back
          </Button>
          <Button variant="contained" size="small" onClick={() => nav(`/jobs/${jobId}/edit`)}
            sx={{ fontSize: 11, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none",
              "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            ✎ Edit
          </Button>
        </Box>
      </Box>

      {/* Job Details */}
      <Card>
        <CardHead title="Job Description" />
        <Box sx={{ p: 2.25 }}>
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mb: 2 }}>
            <Box>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".5px" }}>
                Employment Type
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: TEXT, mt: 0.25 }}>{job.jobType || "—"}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".5px" }}>
                Fee
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: TEXT, mt: 0.25 }}>
                {job.feeType === "FIXED"
                  ? (job.fixedFee != null ? `${job.currency || ""} ${Number(job.fixedFee).toLocaleString()} (fixed)` : "—")
                  : (job.feePercentage != null ? `${job.feePercentage}%` : "—")}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".5px" }}>
                Estimated Fee
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: SUCCESS, fontWeight: 700, mt: 0.25 }}>
                {estimatedFee != null ? `${job.currency || ""} ${Number(estimatedFee).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".5px" }}>
                Created
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: TEXT, mt: 0.25 }}>
                {job.createdAt ? new Date(job.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </Typography>
            </Box>
          </Box>

          {job.stackTags?.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 2 }}>
              {job.stackTags.map(tag => <Badge key={tag} label={tag} variant="purple" />)}
            </Box>
          )}

          <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".5px", mb: 0.75 }}>
            Description
          </Typography>
          <Typography sx={{
            fontSize: 12.5, color: TEXT, whiteSpace: "pre-wrap", lineHeight: 1.6,
            ...(jdExpanded ? {} : {
              display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
            }),
          }}>
            {job.jdText || "No job description added yet."}
          </Typography>
          {job.jdText && job.jdText.length > 280 && (
            <Button size="small" onClick={() => setJdExpanded(v => !v)}
              sx={{ mt: 0.5, px: 0, fontSize: 11.5, textTransform: "none", color: ACCENT }}>
              {jdExpanded ? "Show less" : "Load more"}
            </Button>
          )}
        </Box>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: `1px solid ${BORDER}`, minHeight: 0,
          "& .MuiTab-root": { textTransform: "none", fontSize: 12.5, fontWeight: 600, minHeight: 42 } }}>
          <Tab value="candidates" label={`Candidates (${candidates.length})`} />
          <Tab value="notes" label="Notes" />
          <Tab value="emails" label="Emails" />
        </Tabs>

        {tab === "candidates" && (
          <Box sx={{ p: 2.25 }}>
            {candidatesLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={18} /></Box>
            ) : candidates.length === 0 ? (
              <Typography sx={{ fontSize: 12.5, color: MUTED }}>No candidates linked to this job yet.</Typography>
            ) : (
              <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "auto", bgcolor: "#fff" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: SURFACE }}>
                      {["Name", "Title", "Location", "Skills", "Email", "Phone", "Stage"].map(h => (
                        <TableCell key={h} sx={{
                          fontSize: 11, fontWeight: 700, color: MUTED,
                          borderBottom: `1px solid ${BORDER}`, py: 1.25, whiteSpace: "nowrap",
                        }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {candidates.map(c => (
                      <TableRow key={c.id} onClick={() => nav(`/candidates/${c.id}/workflow`)}
                        sx={{ cursor: "pointer", "&:hover": { bgcolor: SURFACE } }}>
                        <TableCell sx={{ py: 1, borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, fontWeight: 700, color: TEXT, whiteSpace: "nowrap" }}>
                          {c.name || "—"}
                        </TableCell>
                        <TableCell sx={{ py: 1, borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT, whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.currentTitle || "—"}
                        </TableCell>
                        <TableCell sx={{ py: 1, borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT, whiteSpace: "nowrap" }}>
                          {formatLocation(c)}
                        </TableCell>
                        <TableCell sx={{ py: 1, borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT, whiteSpace: "nowrap", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {skillsPreview(c.skills)}
                        </TableCell>
                        <TableCell sx={{ py: 1, borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT, whiteSpace: "nowrap" }}>
                          {c.email || "—"}
                        </TableCell>
                        <TableCell sx={{ py: 1, borderBottom: `1px solid ${BORDER}`, fontSize: 12, color: TEXT, whiteSpace: "nowrap" }}>
                          {c.phone || "—"}
                        </TableCell>
                        <TableCell sx={{ py: 1, borderBottom: `1px solid ${BORDER}` }}>
                          <StageBadge stage={c.stage} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
            <Button size="small" onClick={() => nav("/jobs")}
              sx={{ mt: 1.5, fontSize: 11.5, textTransform: "none", color: ACCENT }}>
              Find more candidates →
            </Button>
          </Box>
        )}

        {tab === "notes" && (
          <Box sx={{ p: 2.25 }}>
            {clientLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={18} /></Box>
            ) : !client ? (
              <Typography sx={{ fontSize: 12.5, color: MUTED }}>
                No client record found for "{job.company || "this company"}" yet.
              </Typography>
            ) : (
              <>
                <Box sx={{ display: "flex", gap: 1, mb: 1.25 }}>
                  <TextField size="small" fullWidth placeholder="Add a note…" value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12.5 } }} />
                  <Button variant="contained" size="small" onClick={handleAddNote} disabled={addingNote || !newNote.trim()}
                    sx={{ fontSize: 11.5, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none",
                      "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                    Add
                  </Button>
                </Box>
                {noteError && <Typography sx={{ fontSize: 11, color: DANGER, mb: 1 }}>{noteError}</Typography>}
                {notesLoading ? (
                  <CircularProgress size={16} />
                ) : notes.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: MUTED }}>No notes yet.</Typography>
                ) : (
                  notes.map(n => (
                    <Box key={n.id} sx={{ py: 1, borderTop: `1px solid #F0F2F6` }}>
                      <Typography sx={{ fontSize: 12, color: TEXT, whiteSpace: "pre-wrap" }}>{n.note}</Typography>
                      <Typography sx={{ fontSize: 10.5, color: MUTED, mt: 0.25 }}>
                        {n.createdAt ? new Date(n.createdAt).toLocaleString("en-GB") : ""}
                      </Typography>
                    </Box>
                  ))
                )}
                <Button size="small" onClick={() => nav("/clients")}
                  sx={{ mt: 1.5, fontSize: 11.5, textTransform: "none", color: ACCENT }}>
                  View full client record →
                </Button>
              </>
            )}
          </Box>
        )}

        {tab === "emails" && (
          <Box sx={{ p: 2.25 }}>
            {clientLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress size={18} /></Box>
            ) : !client ? (
              <Typography sx={{ fontSize: 12.5, color: MUTED }}>
                No client record found for "{job.company || "this company"}" yet.
              </Typography>
            ) : emailsLoading ? (
              <CircularProgress size={16} />
            ) : emails.length === 0 ? (
              <Typography sx={{ fontSize: 12, color: MUTED }}>No emails logged for this client yet.</Typography>
            ) : (
              <>
                {emails.map(email => (
                  <Box key={email.id} sx={{ py: 1, borderTop: `1px solid #F0F2F6` }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>{email.subject}</Typography>
                    <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
                      To {email.toAddress} · {email.sentAt ? new Date(email.sentAt).toLocaleString("en-GB") : ""}
                    </Typography>
                  </Box>
                ))}
                <Button size="small" onClick={() => nav("/clients")}
                  sx={{ mt: 1.5, fontSize: 11.5, textTransform: "none", color: ACCENT }}>
                  View full client record →
                </Button>
              </>
            )}
          </Box>
        )}
      </Card>
    </Box>
  );
}
