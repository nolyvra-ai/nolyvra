import { useEffect, useState } from "react";
// ── Change 4: added Dialog, DialogTitle, DialogContent, DialogActions ─────────
import {
  Box, Paper, Typography, Button, TextField, MenuItem, Alert,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706", WARN_BG = "#FFFBEB", WARN_BR = "#FDE68A";
const DANGER = "#DC2626", DANGER_BG = "#FEF2F2", DANGER_BR = "#FECACA";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";
const SURFACE = "#FAFBFD";

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPost(path, body) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPatch(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function NewTag() {
  return <Box sx={{ display: "inline-flex", alignItems: "center", px: "7px", py: "2px", bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", fontSize: 10, fontWeight: 600, color: PURPLE, ml: 1 }}>NEW</Box>;
}

function KpiCard({ label, value, subtext, valueColor }) {
  return (
    <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", p: 2.25, bgcolor: "#fff", display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".6px" }}>{label}</Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 800, color: valueColor ?? TEXT, lineHeight: 1.1, my: 0.5 }}>{value}</Typography>
      {subtext && <Typography sx={{ fontSize: 11, color: MUTED }}>{subtext}</Typography>}
    </Paper>
  );
}

// ── Change 2: ReminderItem now accepts onRequestComplete instead of onComplete ─
function ReminderItem({ reminder, onRequestComplete }) {
  const isOverdue = !reminder.isCompleted && new Date(reminder.dueAt) < new Date();
  const dueLabel = reminder.dueAt
    ? new Date(reminder.dueAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <Box sx={{
      display: "flex", gap: 1.25, alignItems: "flex-start", py: 1.25,
      borderBottom: `1px solid #F0F2F6`, "&:last-child": { borderBottom: "none" },
      opacity: reminder.isCompleted ? 0.55 : 1
    }}>
      {/* Checkbox opens confirm dialog instead of completing directly */}
      <Box onClick={() => !reminder.isCompleted && onRequestComplete(reminder.id, reminder.title)}
        sx={{
          width: 16, height: 16,
          border: reminder.isCompleted ? `1.5px solid ${SUCCESS}` : `1.5px solid ${BORDER}`,
          borderRadius: "3px", flexShrink: 0, mt: "3px",
          cursor: reminder.isCompleted ? "default" : "pointer",
          bgcolor: reminder.isCompleted ? SUCCESS : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 9, transition: "all .15s",
          "&:hover": !reminder.isCompleted ? { borderColor: SUCCESS, bgcolor: "#F0FDF4" } : {},
        }}>
        {reminder.isCompleted && "✓"}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Typography sx={{
            fontSize: 12, fontWeight: 600, color: TEXT,
            textDecoration: reminder.isCompleted ? "line-through" : "none", lineHeight: 1.4
          }}>
            {reminder.title}
          </Typography>
          <Box sx={{
            display: "inline-flex", alignItems: "center", bgcolor: isOverdue ? DANGER_BG : SURFACE,
            border: `1px solid ${isOverdue ? DANGER_BR : BORDER}`, borderRadius: "20px", px: 1.25, py: 0.25,
            fontSize: 10, fontWeight: 600, color: isOverdue ? DANGER : MUTED, whiteSpace: "nowrap", flexShrink: 0
          }}>
            {isOverdue ? "Overdue" : dueLabel}
          </Box>
        </Box>
        {reminder.description && (
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25, lineHeight: 1.4 }}>{reminder.description}</Typography>
        )}
        {reminder.candidateName && (
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>Linked: {reminder.candidateName}</Typography>
        )}
        {reminder.completedAt && (
          <Typography sx={{ fontSize: 10, color: SUCCESS, mt: 0.25 }}>
            Completed {new Date(reminder.completedAt).toLocaleString("en-GB")}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default function RemindersPage() {
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  const [reminders, setReminders] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ title: "", candidateId: "", dueAt: "", priority: "Normal", description: "" });

  // ── Change 1: dialog state ─────────────────────────────────────────────────
  const [confirmId, setConfirmId] = useState(null);
  const [confirmTitle, setConfirmTitle] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([apiGet("/api/reminders"), apiGet("/api/candidates/list")])
      .then(([r, c]) => { setReminders(r); setCandidates(c); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [loginId]);

  function updateForm(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleComplete(id) {
    try {
      await apiPatch(`/api/reminders/${id}/complete`);
      setReminders(p => p.map(r => r.id === id ? { ...r, isCompleted: true, completedAt: new Date().toISOString() } : r));
    } catch (e) { setError(e.message); }
  }

  async function handleAdd() {
    if (!form.title || !form.dueAt) { setError("Title and due date are required."); return; }
    setSaving(true); setError(null);
    try {
      const r = await apiPost("/api/reminders", { ...form, dueAt: new Date(form.dueAt).toISOString() });
      setReminders(p => [r, ...p]);
      setForm({ title: "", candidateId: "", dueAt: "", priority: "Normal", description: "" });
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const today = reminders.filter(r => !r.isCompleted);
  const overdue = today.filter(r => new Date(r.dueAt) < new Date());
  const upcoming = reminders.filter(r => !r.isCompleted && new Date(r.dueAt) >= new Date() && new Date(r.dueAt) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const completed = reminders.filter(r => r.isCompleted).slice(0, 10);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Reminders &amp; Tasks</Typography>
            <NewTag />
          </Box>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>Automated and manual task tracking for your pipeline</Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="outlined" size="small"
            onClick={async () => { for (const r of today) await handleComplete(r.id); }}
            sx={{ fontSize: 11, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
            Mark All Done
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* KPI strip */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1.75 }}>
        <KpiCard label="Today's Tasks" value={today.length} subtext={`${overdue.length} overdue`} valueColor={ACCENT} />
        <KpiCard label="Upcoming" value={upcoming.length} subtext="Next 7 days" />
        <KpiCard label="Overdue" value={overdue.length} subtext="Needs attention" valueColor={overdue.length > 0 ? DANGER : SUCCESS} />
        <KpiCard label="Completed This Week" value={completed.length} subtext="This week" valueColor={SUCCESS} />
      </Box>

      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
        <Box sx={{ flex: 1.3, display: "flex", flexDirection: "column", gap: 2 }}>

          {/* Today */}
          <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
            <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Today's Tasks</Typography>
              {overdue.length > 0 && (
                <Box sx={{ display: "inline-flex", alignItems: "center", bgcolor: DANGER_BG, border: `1px solid ${DANGER_BR}`, borderRadius: "20px", px: 1.25, py: 0.25, fontSize: 11, fontWeight: 600, color: DANGER }}>
                  {overdue.length} Overdue
                </Box>
              )}
            </Box>
            <Box sx={{ px: 2.25 }}>
              {loading && <Typography sx={{ py: 2.5, fontSize: 12, color: MUTED }}>Loading…</Typography>}
              {!loading && today.length === 0 && <Typography sx={{ py: 2.5, fontSize: 12, color: MUTED }}>No tasks for today. 🎉</Typography>}
              {/* ── Change 5: onComplete → onRequestComplete ───────────────── */}
              {today.map(r => (
                <ReminderItem key={r.id} reminder={r} onRequestComplete={(id, title) => {
                  setConfirmId(id);
                  setConfirmTitle(title);
                }} />
              ))}
            </Box>
          </Paper>

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
              <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Upcoming (Next 7 Days)</Typography>
              </Box>
              <Box sx={{ px: 2.25 }}>
                {/* ── Change 5: onComplete → onRequestComplete ─────────────── */}
                {upcoming.map(r => (
                  <ReminderItem key={r.id} reminder={r} onRequestComplete={(id, title) => {
                    setConfirmId(id);
                    setConfirmTitle(title);
                  }} />
                ))}
              </Box>
            </Paper>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
              <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Completed This Week</Typography>
                <Box sx={{ display: "inline-flex", alignItems: "center", bgcolor: SUCCESS_BG, border: `1px solid ${SUCCESS_BR}`, borderRadius: "20px", px: 1.25, py: 0.25, fontSize: 11, fontWeight: 600, color: SUCCESS }}>
                  {completed.length} done
                </Box>
              </Box>
              <Box sx={{ px: 2.25 }}>
                {/* Completed items can't be re-completed, so onRequestComplete is a no-op */}
                {completed.map(r => (
                  <ReminderItem key={r.id} reminder={r} onRequestComplete={() => { }} />
                ))}
              </Box>
            </Paper>
          )}
        </Box>

        {/* Right: Add reminder + Auto-scan info */}
        <Box sx={{ flex: "0 0 240px", display: "flex", flexDirection: "column", gap: 2 }}>
          <Paper elevation={0} sx={{ border: `1px solid ${PURPLE_BR}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff", boxShadow: `0 0 0 2px rgba(124,58,237,0.06)` }}>
            <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Add Manual Reminder</Typography>
              <NewTag />
            </Box>
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Reminder Title</Typography>
                <TextField fullWidth size="small" value={form.title} onChange={e => updateForm("title", e.target.value)}
                  placeholder="e.g. Call James about availability"
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Link to Candidate (optional)</Typography>
                <TextField select fullWidth size="small" value={form.candidateId} onChange={e => updateForm("candidateId", e.target.value)}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}>
                  <MenuItem value="" sx={{ fontSize: 12 }}>None</MenuItem>
                  {candidates.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12 }}>{c.name}</MenuItem>)}
                </TextField>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Due Date &amp; Time</Typography>
                <TextField type="datetime-local" fullWidth size="small" value={form.dueAt} onChange={e => updateForm("dueAt", e.target.value)}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>Priority</Typography>
                <TextField select fullWidth size="small" value={form.priority} onChange={e => updateForm("priority", e.target.value)}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 12 } }}>
                  {["Normal", "High", "Low"].map(p => <MenuItem key={p} value={p} sx={{ fontSize: 12 }}>{p}</MenuItem>)}
                </TextField>
              </Box>
              <Button variant="contained" onClick={handleAdd} disabled={saving}
                sx={{
                  fontSize: 12, fontWeight: 500, bgcolor: ACCENT, borderRadius: "8px", textTransform: "none",
                  boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" }
                }}>
                {saving ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "+ Add Reminder"}
              </Button>
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff" }}>
            <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Auto-Scan Rules</Typography>
            </Box>
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography sx={{ fontSize: 11, color: MUTED }}>Platform automatically creates reminders for:</Typography>
              {[
                "Analysis pending > 24h",
                "Candidate in screening > 5 days",
                "Upcoming interview within 2 hours",
                "Follow-up email not sent after interview",
              ].map(rule => (
                <Box key={rule} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <Box component="span" sx={{ color: ACCENT, fontSize: 13, flexShrink: 0 }}>⚡</Box>
                  <Typography sx={{ fontSize: 11, color: MUTED }}>{rule}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* ── Change 3: Confirm Complete Dialog ──────────────────────────────── */}
      <Dialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: TEXT, pb: 1 }}>
          Mark as Complete
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
            Are you sure you want to mark this task as complete?
          </Typography>
          <Box sx={{
            mt: 1.25, p: 1.5, bgcolor: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: "8px"
          }}>
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: TEXT }}>
              {confirmTitle}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setConfirmId(null)}
            sx={{
              fontSize: 12, borderColor: BORDER, color: TEXT,
              borderRadius: "6px", textTransform: "none"
            }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={async () => {
              await handleComplete(confirmId);
              setConfirmId(null);
            }}
            sx={{
              fontSize: 12, bgcolor: SUCCESS, borderRadius: "6px",
              textTransform: "none", boxShadow: "none",
              "&:hover": { bgcolor: "#15803D", boxShadow: "none" }
            }}>
            ✓ Mark as Complete
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
