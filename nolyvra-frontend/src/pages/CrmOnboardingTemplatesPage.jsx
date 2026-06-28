import { useEffect, useState, useCallback } from "react";
import {
  Box, Paper, Typography, Button, CircularProgress, Alert,
  TextField, Select, MenuItem, FormControl, InputLabel, Switch,
  FormControlLabel, Collapse, Dialog, DialogTitle, DialogContent,
  DialogActions, Tooltip, IconButton,
} from "@mui/material";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const SURFACE   = "#FFFFFF";
const BORDER    = "#E8ECF2";
const MUTED     = "#8A94A6";
const TEXT      = "#0F1623";
const ACCENT    = "#1D72E8";
const PURPLE    = "#7C3AED";
const PURPLE_L  = "#F5F3FF";
const PURPLE_BR = "#C4B5FD";
const SUCCESS   = "#16A34A";
const SUCCESS_L = "#F0FDF4";
const WARN      = "#D97706";
const DANGER    = "#DC2626";
const DANGER_L  = "#FEF2F2";
const BG        = "#F7F9FC";

const CARD = {
  bgcolor: SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: "12px", boxShadow: "0 1px 4px rgba(15,22,35,0.05)",
};

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "FREELANCE"];

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };
}

function OwnerBadge({ role }) {
  if (!role) return null;
  const color = role === "HR" ? ACCENT : role === "IT" ? PURPLE : WARN;
  const bg    = role === "HR" ? "#EFF6FF" : role === "IT" ? PURPLE_L : "#FFFBEB";
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: bg, color, border: `1px solid ${color}22`,
      borderRadius: "4px", px: "6px", py: "1px",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.3px",
    }}>{role}</Box>
  );
}

// ─── Task row ──────────────────────────────────────────────────────────────

function TaskRow({ task, templateId, groupId, loginId, onSaved, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({
    name: task.name, ownerRole: task.ownerRole || "",
    dueOffsetDays: task.dueOffsetDays ?? "", isRequired: task.isRequired,
    sequence: task.sequence,
  });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates/${templateId}/groups/${groupId}/tasks/${task.id}?loginId=${loginId}`,
        {
          method: "PUT", headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(), sequence: form.sequence,
            ownerRole: form.ownerRole || null,
            dueOffsetDays: form.dueOffsetDays !== "" ? parseInt(form.dueOffsetDays) : null,
            isRequired: form.isRequired,
          }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      onSaved(await res.json());
      setEditing(false);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function deleteTask() {
    if (!window.confirm(`Delete task "${task.name}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates/${templateId}/groups/${groupId}/tasks/${task.id}?loginId=${loginId}`,
        { method: "DELETE", headers: authHeaders() }
      );
      if (!res.ok) throw new Error(await res.text());
      onDeleted(await res.json());
    } catch (e) { alert(e.message); }
    finally { setDeleting(false); }
  }

  if (editing) {
    return (
      <Box sx={{
        px: 2, py: 1.5, bgcolor: "#FAFBFD", borderBottom: `1px solid ${BORDER}`,
        display: "flex", flexDirection: "column", gap: 1.5,
      }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
          <TextField size="small" label="Task name" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            sx={{ flex: "1 1 200px", "& .MuiInputBase-input": { fontSize: 12 } }} />
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel sx={{ fontSize: 12 }}>Owner</InputLabel>
            <Select label="Owner" value={form.ownerRole}
              onChange={e => setForm(f => ({ ...f, ownerRole: e.target.value }))}
              sx={{ fontSize: 12 }}>
              <MenuItem value="">—</MenuItem>
              {["HR", "IT", "MANAGER", "FINANCE", "HIRING_MANAGER"].map(r =>
                <MenuItem key={r} value={r} sx={{ fontSize: 12 }}>{r}</MenuItem>
              )}
            </Select>
          </FormControl>
          <TextField size="small" label="Due offset (days)" type="number"
            value={form.dueOffsetDays}
            onChange={e => setForm(f => ({ ...f, dueOffsetDays: e.target.value }))}
            sx={{ width: 130, "& .MuiInputBase-input": { fontSize: 12 } }}
            helperText="From start date" />
          <FormControlLabel
            control={<Switch size="small" checked={form.isRequired}
              onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))}
              sx={{ "& .MuiSwitch-track": { bgcolor: form.isRequired ? SUCCESS : undefined } }} />}
            label={<Typography sx={{ fontSize: 11 }}>Required</Typography>}
            sx={{ mt: 0.5 }} />
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" variant="contained" onClick={save} disabled={saving || !form.name.trim()}
            sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px",
                  bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" }, boxShadow: "none" }}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button size="small" onClick={() => setEditing(false)}
            sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", color: MUTED }}>
            Cancel
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: "flex", alignItems: "center", gap: 1.5,
      px: 2, py: 1.25, borderBottom: `1px solid ${BORDER}`,
      "&:hover": { bgcolor: "#FAFBFD" }, cursor: "default",
    }}>
      <Box sx={{ color: MUTED, fontSize: 13, cursor: "grab", userSelect: "none" }}>⠿</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: TEXT, lineHeight: 1.4 }}>
          {task.name}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
          <OwnerBadge role={task.ownerRole} />
          {task.dueOffsetDays != null && (
            <Typography sx={{ fontSize: 10.5, color: MUTED }}>
              Day {task.dueOffsetDays > 0 ? `+${task.dueOffsetDays}` : task.dueOffsetDays}
            </Typography>
          )}
          {task.isRequired && (
            <Box sx={{ fontSize: 9.5, fontWeight: 700, color: SUCCESS, bgcolor: SUCCESS_L,
                        border: `1px solid #BBF7D0`, borderRadius: "4px", px: "5px", py: "1px" }}>
              REQUIRED
            </Box>
          )}
        </Box>
      </Box>
      <Box sx={{ display: "flex", gap: 0.5, opacity: 0, ".taskrow:hover &": { opacity: 1 } }}>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => setEditing(true)} sx={{ color: MUTED, "&:hover": { color: ACCENT } }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={deleteTask} disabled={deleting}
            sx={{ color: MUTED, "&:hover": { color: DANGER } }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        <Tooltip title="Edit">
          <IconButton size="small" onClick={() => setEditing(true)} sx={{ color: MUTED, "&:hover": { color: ACCENT } }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={deleteTask} disabled={deleting}
            sx={{ color: MUTED, "&:hover": { color: DANGER } }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

// ─── Add task inline form ─────────────────────────────────────────────────

function AddTaskForm({ templateId, groupId, nextSeq, loginId, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: "", ownerRole: "HR", dueOffsetDays: "", isRequired: true,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates/${templateId}/groups/${groupId}/tasks?loginId=${loginId}`,
        {
          method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(), sequence: nextSeq,
            ownerRole: form.ownerRole || null,
            dueOffsetDays: form.dueOffsetDays !== "" ? parseInt(form.dueOffsetDays) : null,
            isRequired: form.isRequired,
          }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      onSaved(await res.json());
    } catch (e) { alert(e.message); setSaving(false); }
  }

  return (
    <Box sx={{ px: 2, py: 1.5, bgcolor: "#F0F4FF", borderBottom: `1px solid ${BORDER}`,
                display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap" }}>
        <TextField autoFocus size="small" label="Task name" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onCancel(); }}
          sx={{ flex: "1 1 180px", "& .MuiInputBase-input": { fontSize: 12 } }} />
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel sx={{ fontSize: 12 }}>Owner</InputLabel>
          <Select label="Owner" value={form.ownerRole}
            onChange={e => setForm(f => ({ ...f, ownerRole: e.target.value }))}
            sx={{ fontSize: 12 }}>
            <MenuItem value="">—</MenuItem>
            {["HR", "IT", "MANAGER", "FINANCE", "HIRING_MANAGER"].map(r =>
              <MenuItem key={r} value={r} sx={{ fontSize: 12 }}>{r}</MenuItem>
            )}
          </Select>
        </FormControl>
        <TextField size="small" label="Day offset" type="number"
          value={form.dueOffsetDays}
          onChange={e => setForm(f => ({ ...f, dueOffsetDays: e.target.value }))}
          sx={{ width: 100, "& .MuiInputBase-input": { fontSize: 12 } }} />
        <FormControlLabel
          control={<Switch size="small" checked={form.isRequired}
            onChange={e => setForm(f => ({ ...f, isRequired: e.target.checked }))} />}
          label={<Typography sx={{ fontSize: 11 }}>Required</Typography>}
          sx={{ mt: 0.5 }} />
      </Box>
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button size="small" variant="contained" onClick={save} disabled={saving || !form.name.trim()}
          sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px",
                bgcolor: ACCENT, "&:hover": { bgcolor: "#1558C0" }, boxShadow: "none" }}>
          {saving ? "Adding…" : "Add Task"}
        </Button>
        <Button size="small" onClick={onCancel}
          sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", color: MUTED }}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}

// ─── Group panel ──────────────────────────────────────────────────────────

function GroupPanel({ group, templateId, loginId, onTemplateUpdated }) {
  const [open,         setOpen]         = useState(true);
  const [editingName,  setEditingName]  = useState(false);
  const [groupName,    setGroupName]    = useState(group.name);
  const [savingName,   setSavingName]   = useState(false);
  const [addingTask,   setAddingTask]   = useState(false);
  const [deletingGrp,  setDeletingGrp]  = useState(false);

  async function saveGroupName() {
    if (!groupName.trim() || groupName.trim() === group.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates/${templateId}/groups/${group.id}?loginId=${loginId}`,
        {
          method: "PUT", headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ name: groupName.trim(), sequence: group.sequence }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      onTemplateUpdated(await res.json());
      setEditingName(false);
    } catch (e) { alert(e.message); }
    finally { setSavingName(false); }
  }

  async function deleteGroup() {
    if (!window.confirm(`Delete group "${group.name}" and all its tasks?`)) return;
    setDeletingGrp(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates/${templateId}/groups/${group.id}?loginId=${loginId}`,
        { method: "DELETE", headers: authHeaders() }
      );
      if (!res.ok) throw new Error(await res.text());
      onTemplateUpdated(await res.json());
    } catch (e) { alert(e.message); setDeletingGrp(false); }
  }

  return (
    <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "8px", overflow: "hidden", mb: 1.5 }}>
      {/* Group header */}
      <Box sx={{
        display: "flex", alignItems: "center", gap: 1,
        px: 2, py: 1.25, bgcolor: "#F7F9FC",
        borderBottom: open ? `1px solid ${BORDER}` : "none",
      }}>
        <Box sx={{ color: MUTED, fontSize: 11, cursor: "grab", userSelect: "none" }}>⠿</Box>

        {editingName ? (
          <TextField autoFocus size="small" value={groupName}
            onChange={e => setGroupName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveGroupName(); if (e.key === "Escape") { setGroupName(group.name); setEditingName(false); } }}
            onBlur={saveGroupName}
            sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: 12.5, fontWeight: 600, py: "4px" } }} />
        ) : (
          <Typography onClick={() => setEditingName(true)} sx={{
            flex: 1, fontSize: 12.5, fontWeight: 700, color: TEXT, cursor: "text",
            "&:hover": { color: ACCENT },
          }}>
            {group.name}
            <Box component="span" sx={{ fontSize: 10, fontWeight: 400, color: MUTED, ml: 1 }}>
              ({group.tasks?.length || 0} tasks)
            </Box>
          </Typography>
        )}

        {savingName && <CircularProgress size={12} sx={{ color: PURPLE }} />}

        <Tooltip title="Delete group">
          <IconButton size="small" onClick={deleteGroup} disabled={deletingGrp}
            sx={{ color: MUTED, "&:hover": { color: DANGER } }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </IconButton>
        </Tooltip>

        <Box onClick={() => setOpen(o => !o)} sx={{ cursor: "pointer", color: MUTED, fontSize: 11,
          display: "flex", alignItems: "center", userSelect: "none" }}>
          {open ? "▲" : "▼"}
        </Box>
      </Box>

      <Collapse in={open}>
        {/* Tasks */}
        {(group.tasks || []).map(task => (
          <TaskRow key={task.id} task={task}
            templateId={templateId} groupId={group.id} loginId={loginId}
            onSaved={onTemplateUpdated} onDeleted={onTemplateUpdated} />
        ))}

        {/* Add task form or button */}
        {addingTask ? (
          <AddTaskForm
            templateId={templateId} groupId={group.id}
            nextSeq={(group.tasks?.length || 0) + 1}
            loginId={loginId}
            onSaved={t => { onTemplateUpdated(t); setAddingTask(false); }}
            onCancel={() => setAddingTask(false)} />
        ) : (
          <Box sx={{ px: 2, py: 1.25 }}>
            <Button size="small" startIcon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            } onClick={() => setAddingTask(true)} sx={{
              fontSize: 11, fontWeight: 600, textTransform: "none", color: ACCENT,
              "&:hover": { bgcolor: "#EFF6FF" }, borderRadius: "6px", px: 1.25,
            }}>
              Add task
            </Button>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

// ─── Template editor (right panel) ───────────────────────────────────────

function TemplateEditor({ template, loginId, onUpdated, onDeleted }) {
  const [editName,    setEditName]    = useState(false);
  const [name,        setName]        = useState(template.name);
  const [empType,     setEmpType]     = useState(template.employmentType || "");
  const [isDefault,   setIsDefault]   = useState(template.isDefault);
  const [savingMeta,  setSavingMeta]  = useState(false);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGrpName,  setNewGrpName]  = useState("");
  const [savingGrp,   setSavingGrp]   = useState(false);
  const [cloning,     setCloning]     = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  useEffect(() => {
    setName(template.name);
    setEmpType(template.employmentType || "");
    setIsDefault(template.isDefault);
    setEditName(false);
    setAddingGroup(false);
    setNewGrpName("");
  }, [template.id]);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates/${template.id}?loginId=${loginId}`,
        {
          method: "PUT", headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), employmentType: empType || null, isDefault }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      onUpdated(await res.json());
      setEditName(false);
    } catch (e) { alert(e.message); }
    finally { setSavingMeta(false); }
  }

  async function addGroup() {
    if (!newGrpName.trim()) return;
    setSavingGrp(true);
    try {
      const nextSeq = (template.groups?.length || 0) + 1;
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates/${template.id}/groups?loginId=${loginId}`,
        {
          method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ name: newGrpName.trim(), sequence: nextSeq }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      onUpdated(await res.json());
      setNewGrpName("");
      setAddingGroup(false);
    } catch (e) { alert(e.message); }
    finally { setSavingGrp(false); }
  }

  async function clone() {
    setCloning(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates/${template.id}/clone?loginId=${loginId}`,
        { method: "POST", headers: authHeaders() }
      );
      if (!res.ok) throw new Error(await res.text());
      onUpdated(await res.json(), true); // true = select the new clone
    } catch (e) { alert(e.message); }
    finally { setCloning(false); }
  }

  async function deleteTemplate() {
    if (!window.confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates/${template.id}?loginId=${loginId}`,
        { method: "DELETE", headers: authHeaders() }
      );
      if (!res.ok) throw new Error(await res.text());
      onDeleted(template.id);
    } catch (e) { alert(e.message); setDeleting(false); }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Template meta header */}
      <Box sx={{ ...CARD, p: 2.5, mb: 2, flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            {editName ? (
              <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <TextField autoFocus size="small" value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveMeta(); if (e.key === "Escape") { setName(template.name); setEditName(false); } }}
                  sx={{ "& .MuiInputBase-input": { fontSize: 15, fontWeight: 700 } }} />
                <Button size="small" variant="contained" onClick={saveMeta} disabled={savingMeta || !name.trim()}
                  sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px",
                        bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" }, boxShadow: "none" }}>
                  {savingMeta ? "…" : "Save"}
                </Button>
                <Button size="small" onClick={() => { setName(template.name); setEditName(false); }}
                  sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", color: MUTED }}>
                  Cancel
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{template.name}</Typography>
                {template.isDefault && (
                  <Box sx={{ fontSize: 9, fontWeight: 700, color: SUCCESS, bgcolor: SUCCESS_L,
                              border: `1px solid #BBF7D0`, borderRadius: "4px", px: "6px", py: "1px" }}>
                    DEFAULT
                  </Box>
                )}
                <IconButton size="small" onClick={() => setEditName(true)}
                  sx={{ color: MUTED, "&:hover": { color: ACCENT } }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </IconButton>
              </Box>
            )}
            <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.5 }}>
              {(template.groups || []).length} groups · {(template.groups || []).reduce((s, g) => s + (g.tasks || []).length, 0)} tasks
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ fontSize: 11 }}>Employment type</InputLabel>
              <Select label="Employment type" value={empType}
                onChange={e => { setEmpType(e.target.value); }}
                onBlur={saveMeta}
                sx={{ fontSize: 11 }}>
                <MenuItem value="">Any</MenuItem>
                {EMPLOYMENT_TYPES.map(t => <MenuItem key={t} value={t} sx={{ fontSize: 11 }}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControlLabel
              control={<Switch size="small" checked={isDefault}
                onChange={e => { setIsDefault(e.target.checked); }}
                onBlur={saveMeta} />}
              label={<Typography sx={{ fontSize: 11 }}>Default</Typography>} />
          </Box>

          <Box sx={{ display: "flex", gap: 1, ml: "auto", flexShrink: 0 }}>
            <Button size="small" variant="outlined" onClick={clone} disabled={cloning}
              sx={{ fontSize: 11, textTransform: "none", borderRadius: "7px",
                    borderColor: BORDER, color: MUTED, "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L } }}>
              {cloning ? "Cloning…" : "Clone"}
            </Button>
            <Button size="small" variant="outlined" onClick={deleteTemplate} disabled={deleting}
              sx={{ fontSize: 11, textTransform: "none", borderRadius: "7px",
                    borderColor: BORDER, color: MUTED, "&:hover": { borderColor: DANGER, color: DANGER, bgcolor: DANGER_L } }}>
              Delete
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Groups */}
      <Box sx={{ flex: 1, overflowY: "auto", pr: 0.5 }}>
        {(template.groups || []).map(group => (
          <GroupPanel key={group.id} group={group}
            templateId={template.id} loginId={loginId}
            onTemplateUpdated={onUpdated} />
        ))}

        {/* Add group */}
        {addingGroup ? (
          <Box sx={{ ...CARD, p: 2, mt: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 1.5 }}>New Group</Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField autoFocus size="small" label="Group name" value={newGrpName}
                onChange={e => setNewGrpName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addGroup(); if (e.key === "Escape") setAddingGroup(false); }}
                sx={{ flex: 1, "& .MuiInputBase-input": { fontSize: 12 } }} />
              <Button size="small" variant="contained" onClick={addGroup}
                disabled={savingGrp || !newGrpName.trim()}
                sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px",
                      bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" }, boxShadow: "none" }}>
                {savingGrp ? "Adding…" : "Add Group"}
              </Button>
              <Button size="small" onClick={() => { setAddingGroup(false); setNewGrpName(""); }}
                sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", color: MUTED }}>
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <Button fullWidth variant="outlined" onClick={() => setAddingGroup(true)}
            startIcon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
            sx={{
              mt: 1, fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
              borderColor: BORDER, color: MUTED, borderStyle: "dashed",
              "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L, borderStyle: "solid" },
            }}>
            Add Group
          </Button>
        )}
      </Box>
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function CrmOnboardingTemplatesPage() {
  const loginId = localStorage.getItem("loginId") || "";

  const [templates,   setTemplates]   = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [showNewDlg,  setShowNewDlg]  = useState(false);
  const [newName,     setNewName]     = useState("");
  const [newEmpType,  setNewEmpType]  = useState("");
  const [newDefault,  setNewDefault]  = useState(false);
  const [creating,    setCreating]    = useState(false);

  const selected = templates.find(t => t.id === selectedId) || null;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates?loginId=${loginId}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setTemplates(data);
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [loginId]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  function handleUpdated(updatedTemplate, selectIt = false) {
    setTemplates(prev => {
      const idx = prev.findIndex(t => t.id === updatedTemplate.id);
      if (idx >= 0) {
        const next = [...prev]; next[idx] = updatedTemplate; return next;
      }
      // new template (clone result)
      return [...prev, updatedTemplate];
    });
    if (selectIt || !selectedId) setSelectedId(updatedTemplate.id);
  }

  function handleDeleted(deletedId) {
    setTemplates(prev => {
      const next = prev.filter(t => t.id !== deletedId);
      if (selectedId === deletedId) setSelectedId(next[0]?.id || null);
      return next;
    });
  }

  async function createTemplate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/templates?loginId=${loginId}`,
        {
          method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName.trim(), employmentType: newEmpType || null, isDefault: newDefault }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      const t = await res.json();
      setTemplates(prev => [...prev, t]);
      setSelectedId(t.id);
      setShowNewDlg(false);
      setNewName(""); setNewEmpType(""); setNewDefault(false);
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5, flexShrink: 0 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Onboarding Templates</Typography>
            <Box sx={{
              fontSize: 9, fontWeight: 700, color: PURPLE, bgcolor: PURPLE_L,
              border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", px: "6px", py: "2px",
            }}>BETA</Box>
          </Box>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Build and manage reusable onboarding checklists for your team
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setShowNewDlg(true)} startIcon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        } sx={{
          fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px", boxShadow: "none",
          background: `linear-gradient(135deg, ${PURPLE} 0%, #4F46E5 100%)`,
          "&:hover": { background: `linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)`, boxShadow: "none" },
        }}>
          New Template
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} sx={{ color: PURPLE }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>
      ) : (
        <Box sx={{ flex: 1, display: "flex", gap: 2.5, minHeight: 0 }}>
          {/* Left: template list */}
          <Box sx={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 1 }}>
            {templates.length === 0 ? (
              <Paper elevation={0} sx={{ ...CARD, p: 3, textAlign: "center" }}>
                <Typography sx={{ fontSize: 12, color: MUTED }}>No templates yet.</Typography>
              </Paper>
            ) : templates.map(t => (
              <Box key={t.id} onClick={() => setSelectedId(t.id)} sx={{
                ...CARD, p: 2, cursor: "pointer",
                borderColor: t.id === selectedId ? PURPLE : BORDER,
                borderWidth: t.id === selectedId ? 2 : 1,
                bgcolor: t.id === selectedId ? PURPLE_L : SURFACE,
                "&:hover": { borderColor: PURPLE, bgcolor: PURPLE_L },
                transition: "all .15s",
              }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: 12.5, fontWeight: 700, color: t.id === selectedId ? PURPLE : TEXT,
                      lineHeight: 1.3, wordBreak: "break-word",
                    }}>
                      {t.name}
                    </Typography>
                    <Typography sx={{ fontSize: 10.5, color: MUTED, mt: 0.25 }}>
                      {(t.groups || []).length} groups · {(t.groups || []).reduce((s, g) => s + (g.tasks || []).length, 0)} tasks
                    </Typography>
                    {t.employmentType && (
                      <Box sx={{ mt: 0.5, display: "inline-block", fontSize: 9.5, fontWeight: 600,
                                  color: ACCENT, bgcolor: "#EFF6FF", border: `1px solid #BFDBFE`,
                                  borderRadius: "4px", px: "5px", py: "1px" }}>
                        {t.employmentType}
                      </Box>
                    )}
                  </Box>
                  {t.isDefault && (
                    <Box sx={{ fontSize: 8.5, fontWeight: 700, color: SUCCESS, bgcolor: SUCCESS_L,
                                border: `1px solid #BBF7D0`, borderRadius: "4px", px: "4px", py: "1px",
                                flexShrink: 0, mt: "2px" }}>
                      DEFAULT
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Right: editor */}
          <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            {selected ? (
              <TemplateEditor
                key={selected.id}
                template={selected}
                loginId={loginId}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted} />
            ) : (
              <Paper elevation={0} sx={{ ...CARD, p: 5, textAlign: "center" }}>
                <Typography sx={{ fontSize: 13, color: MUTED }}>
                  Select a template to edit it, or create a new one.
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      )}

      {/* New template dialog */}
      <Dialog open={showNewDlg} onClose={() => setShowNewDlg(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, pb: 1 }}>New Onboarding Template</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          <TextField autoFocus size="small" label="Template name" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createTemplate()}
            fullWidth sx={{ "& .MuiInputBase-input": { fontSize: 13 } }} />
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ fontSize: 12 }}>Employment type (optional)</InputLabel>
            <Select label="Employment type (optional)" value={newEmpType}
              onChange={e => setNewEmpType(e.target.value)} sx={{ fontSize: 12 }}>
              <MenuItem value="">Any</MenuItem>
              {EMPLOYMENT_TYPES.map(t => <MenuItem key={t} value={t} sx={{ fontSize: 12 }}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControlLabel
            control={<Switch checked={newDefault} onChange={e => setNewDefault(e.target.checked)} />}
            label={<Typography sx={{ fontSize: 12 }}>Set as default template</Typography>} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setShowNewDlg(false)}
            sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button variant="contained" onClick={createTemplate}
            disabled={creating || !newName.trim()}
            sx={{
              fontSize: 12, textTransform: "none", borderRadius: "8px", boxShadow: "none",
              bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" },
            }}>
            {creating ? "Creating…" : "Create Template"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
