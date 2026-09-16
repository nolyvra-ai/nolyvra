import { useEffect, useState } from "react";
import {
  Box, Paper, Typography, Button, TextField, MenuItem, Alert,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", DANGER = "#DC2626", WARN = "#D97706";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";
const SURFACE = "#FAFBFD";
const BIN_GREY = "#6B7280", BIN_GREY_BG = "#F3F4F6", BIN_GREY_BORDER = "#9CA3AF";

const COLUMNS = [
  { key: "To Do",              headerBg: "#FDEDE3", headerColor: "#C2521B" },
  { key: "In Progress",        headerBg: "#E3EEFD", headerColor: "#1D5FC2" },
  { key: "Awaiting Response",  headerBg: "#FDF6DC", headerColor: "#B8860B" },
  { key: "Done",                headerBg: "#E4F5E9", headerColor: "#1E8E4A" },
];

const PRIORITY_COLOR = { High: DANGER, Normal: WARN, Low: SUCCESS };

const AVATAR_COLORS = ["#7C5CFC", "#F5A623", "#14B8A6", "#6366F1", "#8B5CF6", "#F97316", "#0EA5E9"];
function avatarColor(name) {
  let hash = 0;
  for (const ch of (name || "?")) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function dueInfo(dueAt, isCompleted) {
  if (!dueAt) return { label: "—", overdue: false };
  const due = new Date(dueAt);
  const now = new Date();
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(due) - startOfDay(now)) / 86400000);
  if (!isCompleted && diffDays < 0) return { label: "Overdue", overdue: true };
  if (diffDays === 0) return { label: "Today", soon: true };
  if (diffDays === 1) return { label: "Tomorrow", soon: true };
  if (diffDays < 14) return { label: `${diffDays} days` };
  if (diffDays < 60) return { label: `${Math.round(diffDays / 7)} weeks` };
  return { label: `${Math.round(diffDays / 30)} months` };
}

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
async function apiPatchJson(path, body) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiDelete(path) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } });
  if (!res.ok) throw new Error(await res.text());
}

function ReminderCard({ reminder, index }) {
  const due = dueInfo(reminder.dueAt, reminder.isCompleted);
  return (
    <Draggable draggableId={String(reminder.id)} index={index}>
      {(provided, snapshot) => (
        <Box
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          sx={{
            border: `1px solid ${BORDER}`, borderRadius: "10px", bgcolor: "#fff",
            p: 1.75, mb: 1.25, cursor: "grab",
            boxShadow: snapshot.isDragging ? "0 8px 20px rgba(15,22,35,0.15)" : "0 1px 2px rgba(15,22,35,0.04)",
          }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT, mb: 1.25, lineHeight: 1.4 }}>
            {reminder.title}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{
                width: 26, height: 26, borderRadius: "50%", bgcolor: avatarColor(reminder.candidateName),
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10.5, fontWeight: 700, flexShrink: 0,
              }}>
                {initials(reminder.candidateName)}
              </Box>
              <Box sx={{
                width: 7, height: 7, borderRadius: "50%",
                bgcolor: PRIORITY_COLOR[reminder.priority] ?? MUTED,
              }} />
            </Box>
            <Box sx={{
              fontSize: 10.5, fontWeight: 600, px: 1, py: "3px", borderRadius: "6px",
              color: due.overdue ? DANGER : due.soon ? "#C2521B" : MUTED,
              bgcolor: due.overdue ? "#FEF2F2" : due.soon ? "#FDEDE3" : SURFACE,
              whiteSpace: "nowrap",
            }}>
              {due.label}
            </Box>
          </Box>
        </Box>
      )}
    </Draggable>
  );
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", candidateId: "", dueAt: "", priority: "Normal", description: "" });
  const [isDragging, setIsDragging] = useState(false);

  function loadReminders() {
    setLoading(true);
    Promise.all([apiGet("/api/reminders"), apiGet("/api/candidates/list")])
      .then(([r, c]) => { setReminders(r); setCandidates(c); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadReminders(); }, []);

  function updateForm(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleAdd() {
    if (!form.title || !form.dueAt) { setError("Title and due date are required."); return; }
    setSaving(true); setError(null);
    try {
      const r = await apiPost("/api/reminders", { ...form, dueAt: new Date(form.dueAt).toISOString() });
      setReminders(p => [r, ...p]);
      setForm({ title: "", candidateId: "", dueAt: "", priority: "Normal", description: "" });
      setAddOpen(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function onDragEnd(result) {
    setIsDragging(false);
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const reminderId = Number(draggableId);
    const previous = reminders;

    if (destination.droppableId === "delete-zone") {
      setReminders(prev => prev.filter(r => r.id !== reminderId));
      apiDelete(`/api/reminders/${reminderId}`)
        .catch(e => { setError(e.message); setReminders(previous); });
      return;
    }

    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceStatus = source.droppableId;
    const destStatus = destination.droppableId;

    // Reorder the underlying list itself, not just its status — `columns`
    // below derives each column's display order directly from this array's
    // order, so without actually splicing it a reordered card would just
    // snap back to its old position on the next render.
    setReminders(prev => {
      const byColumn = {};
      for (const col of COLUMNS) byColumn[col.key] = prev.filter(r => (r.status || "To Do") === col.key);

      const sourceItems = Array.from(byColumn[sourceStatus]);
      const [moved] = sourceItems.splice(source.index, 1);
      const updatedMoved = sourceStatus === destStatus
        ? moved
        : { ...moved, status: destStatus, isCompleted: destStatus === "Done" };

      if (sourceStatus === destStatus) {
        sourceItems.splice(destination.index, 0, updatedMoved);
        byColumn[sourceStatus] = sourceItems;
      } else {
        byColumn[sourceStatus] = sourceItems;
        const destItems = Array.from(byColumn[destStatus]);
        destItems.splice(destination.index, 0, updatedMoved);
        byColumn[destStatus] = destItems;
      }

      const reordered = COLUMNS.flatMap(col => byColumn[col.key]);
      const reorderedIds = new Set(reordered.map(r => r.id));
      const leftovers = prev.filter(r => !reorderedIds.has(r.id));
      return [...reordered, ...leftovers];
    });

    // Status change is the only thing persisted server-side — there's no
    // order/position column on reminders, so within-column reordering is
    // visual-only for this session and will reset to due-date order next load.
    if (sourceStatus !== destStatus) {
      apiPatchJson(`/api/reminders/${reminderId}/status`, { status: destStatus })
        .catch(e => { setError(e.message); setReminders(previous); });
    }
  }

  const columns = COLUMNS.map(col => ({
    ...col,
    items: reminders.filter(r => (r.status || "To Do") === col.key),
  }));

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Tasks</Typography>
          <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.25 }}>Organized by status</Typography>
        </Box>
        <Button variant="contained" onClick={() => setAddOpen(true)}
          sx={{
            fontSize: 12, fontWeight: 600, bgcolor: ACCENT, borderRadius: "8px", textTransform: "none",
            boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" }
          }}>
          + New Reminder
        </Button>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress size={22} sx={{ color: ACCENT }} />
        </Box>
      ) : (
        <DragDropContext onDragStart={() => setIsDragging(true)} onDragEnd={onDragEnd}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1.75, alignItems: "start" }}>
            {columns.map(col => (
              <Box key={col.key}>
                <Box sx={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  bgcolor: col.headerBg, color: col.headerColor, borderRadius: "10px",
                  px: 1.75, py: 1.25, mb: 1.25,
                }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: "inherit" }}>{col.key}</Typography>
                  <Box sx={{
                    minWidth: 22, height: 22, borderRadius: "50%", bgcolor: "rgba(255,255,255,0.6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11.5, fontWeight: 700, color: "inherit", px: "6px",
                  }}>
                    {col.items.length}
                  </Box>
                </Box>

                <Droppable droppableId={col.key}>
                  {(provided, snapshot) => (
                    <Box
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      sx={{
                        minHeight: 80, borderRadius: "10px", p: snapshot.isDraggingOver ? 0.75 : 0,
                        bgcolor: snapshot.isDraggingOver ? "#F0F4FF" : "transparent",
                        transition: "background .15s",
                      }}>
                      {col.items.length === 0 && !snapshot.isDraggingOver && (
                        <Typography sx={{ fontSize: 12.5, color: MUTED, textAlign: "center", py: 3 }}>
                          {col.key === "Done" ? "No completed tasks" : "No tasks"}
                        </Typography>
                      )}
                      {col.items.map((reminder, index) => (
                        <ReminderCard key={reminder.id} reminder={reminder} index={index} />
                      ))}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </Box>
            ))}
          </Box>

          {/* Always mounted — @hello-pangea/dnd requires every Droppable to be
              registered before a drag starts; conditionally mounting this on
              isDragging caused an "Invariant failed" crash mid-drag. It's kept
              fixed to the viewport bottom (not in normal document flow) so it
              stays reachable without scrolling even when a column is long —
              visibility toggles by sliding off-screen, never by unmounting. */}
          <Box sx={{
            position: "fixed", left: 0, right: 0, bottom: isDragging ? 20 : -120,
            display: "flex", justifyContent: "center", zIndex: 1300,
            transition: "bottom .2s ease", pointerEvents: isDragging ? "auto" : "none",
          }}>
            <Droppable droppableId="delete-zone">
              {(provided, snapshot) => (
                <Box
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{
                    width: 320, borderRadius: "12px",
                    border: `2px dashed ${BIN_GREY_BORDER}`,
                    bgcolor: snapshot.isDraggingOver ? "#E5E7EB" : BIN_GREY_BG,
                    boxShadow: "0 10px 30px rgba(15,22,35,0.18)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 1, py: 2, transition: "background .15s",
                  }}>
                  <DeleteOutlineRoundedIcon sx={{ color: BIN_GREY, fontSize: 22 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: BIN_GREY }}>
                    Drop here to delete
                  </Typography>
                  {provided.placeholder}
                </Box>
              )}
            </Droppable>
          </Box>
        </DragDropContext>
      )}

      {/* Add Reminder dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700, color: TEXT, display: "flex", alignItems: "center", gap: 1 }}>
          New Reminder
          <Box sx={{ display: "inline-flex", alignItems: "center", px: "7px", py: "2px", bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", fontSize: 10, fontWeight: 600, color: PURPLE }}>
            Lands in To Do
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: "8px !important" }}>
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
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={saving}
            sx={{ fontSize: 12, fontWeight: 600, bgcolor: ACCENT, borderRadius: "8px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            {saving ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Add Reminder"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
