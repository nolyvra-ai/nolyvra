import { useEffect, useRef, useState } from "react";
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip, Divider,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const SURFACE  = "#FFFFFF";
const BORDER   = "#E8ECF2";
const MUTED    = "#8A94A6";
const TEXT     = "#0F1623";
const PURPLE   = "#7C3AED";
const PURPLE_L = "#F5F3FF";
const SUCCESS  = "#16A34A";
const SUCCESS_L= "#F0FDF4";
const WARN     = "#D97706";
const WARN_L   = "#FFFBEB";
const DANGER   = "#DC2626";
const DANGER_L = "#FEF2F2";

const CARD_BASE = {
  bgcolor: SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: "12px", boxShadow: "0 1px 4px rgba(15,22,35,0.05)", overflow: "hidden",
};

const STEPS = [
  { key: "investigated",     label: "Investigation"   },
  { key: "manager_reviewed", label: "Manager Review"  },
  { key: "hr_decided",       label: "HR Decision"     },
];

function camelStep(key) {
  return "step" + key.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("");
}

function StatusChip({ status }) {
  const map = {
    IN_PROGRESS: { bg: WARN_L,    border: "#FDE68A", color: WARN    },
    CLOSED:      { bg: SUCCESS_L, border: "#BBF7D0", color: SUCCESS  },
    CANCELLED:   { bg: "#F1F3F7", border: BORDER,    color: MUTED    },
  };
  const s = map[status] || map.CANCELLED;
  return (
    <Box sx={{
      display: "inline-flex", fontSize: 11, fontWeight: 700, px: "8px", py: "2px",
      borderRadius: "20px", bgcolor: s.bg, border: `1px solid ${s.border}`, color: s.color,
    }}>{status?.replace("_", " ")}</Box>
  );
}

// ─── Detail drawer / dialog ───────────────────────────────────────────────────

function DetailDialog({ action: da, loginId, authH, onClose, onRefresh }) {
  const [newItem,   setNewItem]   = useState("");
  const [adding,    setAdding]    = useState(false);
  const [acting,    setActing]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const hrFileRef  = useRef();

  if (!da) return null;

  const allStepsDone = STEPS.every(s => da[camelStep(s.key)]);

  async function toggleStep(step, checked) {
    try {
      await fetch(`${API_BASE}/api/crm/disciplinary-actions/${da.id}/step?loginId=${loginId}`,
        { method: "PUT", headers: { ...authH, "Content-Type": "application/json" },
          body: JSON.stringify({ step, checked }) });
      onRefresh();
    } catch (e) { alert(e.message); }
  }

  async function addItem() {
    if (!newItem.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm/disciplinary-actions/${da.id}/corrective-actions?loginId=${loginId}`,
        { method: "POST", headers: { ...authH, "Content-Type": "application/json" },
          body: JSON.stringify({ itemText: newItem.trim() }) });
      if (!res.ok) { alert(await res.text()); return; }
      setNewItem("");
      onRefresh();
    } catch (e) { alert(e.message); }
    finally { setAdding(false); }
  }

  async function toggleItem(itemId, done) {
    try {
      await fetch(`${API_BASE}/api/crm/disciplinary-actions/${da.id}/corrective-actions/${itemId}/toggle?loginId=${loginId}&done=${done}`,
        { method: "PUT", headers: authH });
      onRefresh();
    } catch (e) { alert(e.message); }
  }

  async function deleteItem(itemId) {
    try {
      await fetch(`${API_BASE}/api/crm/disciplinary-actions/${da.id}/corrective-actions/${itemId}?loginId=${loginId}`,
        { method: "DELETE", headers: authH });
      onRefresh();
    } catch (e) { alert(e.message); }
  }

  async function uploadHrDecision(file) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("hrDecision", file);
      const res = await fetch(
        `${API_BASE}/api/crm/disciplinary-actions/${da.id}/hr-decision?loginId=${loginId}`,
        { method: "POST", headers: { Authorization: authH.Authorization }, body: fd }
      );
      if (!res.ok) { alert(await res.text()); return; }
      onRefresh();
    } catch (e) { alert(e.message); }
    finally { setUploading(false); }
  }

  async function close() {
    if (!allStepsDone) { alert("Complete all 3 checklist steps before closing."); return; }
    setActing(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm/disciplinary-actions/${da.id}/close?loginId=${loginId}`,
        { method: "POST", headers: authH });
      if (!res.ok) { alert(await res.text()); return; }
      onRefresh(); onClose();
    } catch (e) { alert(e.message); }
    finally { setActing(false); }
  }

  return (
    <Dialog open={!!da} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 0.5 }}>
        {da.firstName} {da.lastName} — {da.title}
      </DialogTitle>
      <DialogContent sx={{ pt: "8px !important" }}>
        {/* Description */}
        {da.incidentDescription && (
          <Typography sx={{ fontSize: 12.5, color: MUTED, mb: 2 }}>{da.incidentDescription}</Typography>
        )}

        {/* Checklist steps */}
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 1 }}>Checklist</Typography>
        <Box sx={{ mb: 2 }}>
          {STEPS.map(s => {
            const done = da[camelStep(s.key)];
            return (
              <Box key={s.key} onClick={() => da.status === "IN_PROGRESS" && toggleStep(s.key, !done)}
                sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.75,
                      cursor: da.status === "IN_PROGRESS" ? "pointer" : "default",
                      "&:hover": da.status === "IN_PROGRESS" ? { bgcolor: "#F7F9FC" } : {},
                      borderRadius: "6px", px: 0.5, mx: -0.5 }}>
                <Box sx={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                  bgcolor: done ? SUCCESS : "transparent",
                  border: `2px solid ${done ? SUCCESS : "#CBD5E1"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </Box>
                <Typography sx={{ fontSize: 13, color: done ? SUCCESS : TEXT,
                  textDecoration: done ? "line-through" : "none", fontWeight: done ? 400 : 500 }}>
                  {s.label}
                </Typography>
                {/* HR Decision upload trigger */}
                {s.key === "hr_decided" && (
                  <Box sx={{ ml: "auto", display: "flex", gap: 0.75 }}>
                    {da.hrDecisionName && (
                      <Button size="small" component="a"
                        href={`${API_BASE}/api/crm/disciplinary-actions/${da.id}/hr-decision?loginId=${loginId}`}
                        sx={{ fontSize: 10, textTransform: "none", borderRadius: "6px", px: 1,
                              color: PURPLE, border: `1px solid ${PURPLE}`, "&:hover": { bgcolor: PURPLE_L } }}>
                        ⬇ {da.hrDecisionName}
                      </Button>
                    )}
                    {da.status === "IN_PROGRESS" && (
                      <>
                        <input type="file" ref={hrFileRef} style={{ display: "none" }}
                          onChange={e => uploadHrDecision(e.target.files[0])} />
                        <Button size="small" onClick={e => { e.stopPropagation(); hrFileRef.current.click(); }}
                          disabled={uploading}
                          sx={{ fontSize: 10, textTransform: "none", borderRadius: "6px", px: 1,
                                color: MUTED, border: `1px solid ${BORDER}`, "&:hover": { bgcolor: "#F7F9FC" } }}>
                          {uploading ? "…" : "Upload"}
                        </Button>
                      </>
                    )}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Corrective Action Plan */}
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 1 }}>
          Corrective Action Plan
        </Typography>
        <Box sx={{ mb: 1.5 }}>
          {da.correctiveActions?.length === 0 && (
            <Typography sx={{ fontSize: 12, color: MUTED, mb: 1 }}>No items yet. Add corrective actions below.</Typography>
          )}
          {da.correctiveActions?.map(item => (
            <Box key={item.id} sx={{
              display: "flex", alignItems: "center", gap: 1, py: 0.75,
              borderBottom: `1px solid ${BORDER}`, "&:last-child": { borderBottom: "none" },
            }}>
              <Box onClick={() => da.status === "IN_PROGRESS" && toggleItem(item.id, !item.isDone)}
                sx={{
                  width: 16, height: 16, borderRadius: "3px", flexShrink: 0,
                  bgcolor: item.isDone ? PURPLE : "transparent",
                  border: `2px solid ${item.isDone ? PURPLE : "#CBD5E1"}`,
                  cursor: da.status === "IN_PROGRESS" ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                {item.isDone && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
              </Box>
              <Typography sx={{ fontSize: 12.5, flex: 1, color: TEXT,
                textDecoration: item.isDone ? "line-through" : "none",
                opacity: item.isDone ? 0.6 : 1 }}>{item.itemText}</Typography>
              {da.status === "IN_PROGRESS" && (
                <Button size="small" onClick={() => deleteItem(item.id)} sx={{
                  minWidth: 0, p: "2px 6px", fontSize: 11, color: MUTED,
                  "&:hover": { color: DANGER, bgcolor: DANGER_L },
                }}>✕</Button>
              )}
            </Box>
          ))}
        </Box>
        {da.status === "IN_PROGRESS" && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField size="small" value={newItem} onChange={e => setNewItem(e.target.value)}
              placeholder="Add corrective action…" fullWidth
              onKeyDown={e => e.key === "Enter" && addItem()}
              sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
            <Button size="small" variant="outlined" onClick={addItem} disabled={adding || !newItem.trim()}
              sx={{ textTransform: "none", fontSize: 12, borderRadius: "7px",
                    borderColor: PURPLE, color: PURPLE, whiteSpace: "nowrap",
                    "&:hover": { bgcolor: PURPLE_L } }}>
              {adding ? "…" : "Add"}
            </Button>
          </Box>
        )}

        {/* Incident report download */}
        {da.incidentReportName && (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${BORDER}` }}>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.75 }}>Incident Report</Typography>
            <Button size="small" component="a"
              href={`${API_BASE}/api/crm/disciplinary-actions/${da.id}/incident-report?loginId=${loginId}`}
              sx={{ fontSize: 12, textTransform: "none", borderRadius: "7px",
                    color: PURPLE, border: `1px solid ${PURPLE}`, "&:hover": { bgcolor: PURPLE_L } }}>
              ⬇ {da.incidentReportName}
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Close</Button>
        {da.status === "IN_PROGRESS" && (
          <Button variant="contained" onClick={close} disabled={!allStepsDone || acting}
            sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", boxShadow: "none",
                  bgcolor: allStepsDone ? SUCCESS : "#E2E8F0", color: allStepsDone ? "#fff" : MUTED,
                  "&:hover": allStepsDone ? { bgcolor: "#15803D" } : {} }}>
            {acting ? "Closing…" : "Close Case ✓"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CrmDisciplinaryPage() {
  const nav     = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";
  const authH   = { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };

  const [actions,   setActions]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("IN_PROGRESS");
  const [newDlg,    setNewDlg]    = useState(false);
  const [detail,    setDetail]    = useState(null);
  const [form,      setForm]      = useState({ employeeId: "", title: "", incidentDescription: "", notes: "" });
  const [incident,  setIncident]  = useState(null);
  const [creating,  setCreating]  = useState(false);
  const fileRef = useRef();

  async function load() {
    setLoading(true);
    try {
      const [aRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/disciplinary-actions?loginId=${loginId}${filter ? `&status=${filter}` : ""}`, { headers: authH }),
        fetch(`${API_BASE}/api/crm/employees?loginId=${loginId}&status=ACTIVE`, { headers: authH }),
      ]);
      if (aRes.ok)   setActions(await aRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (_) {}
    finally { setLoading(false); }
  }

  // refresh detail when actions reload
  useEffect(() => {
    if (detail) {
      const refreshed = actions.find(a => a.id === detail.id);
      if (refreshed) setDetail(refreshed);
    }
  }, [actions]); // eslint-disable-line

  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  async function create() {
    if (!form.employeeId || !form.title.trim()) return;
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append("loginId", loginId);
      fd.append("title",   form.title.trim());
      if (form.incidentDescription) fd.append("incidentDescription", form.incidentDescription);
      if (form.notes)               fd.append("notes",               form.notes);
      if (incident)                 fd.append("incidentReport",      incident);
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${form.employeeId}/disciplinary-actions`,
        { method: "POST", headers: { Authorization: authH.Authorization }, body: fd }
      );
      if (!res.ok) { alert(await res.text()); return; }
      setNewDlg(false);
      setForm({ employeeId: "", title: "", incidentDescription: "", notes: "" });
      setIncident(null);
      await load();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function refreshDetail() {
    await load();
  }

  const pending = actions.filter(a => a.status === "IN_PROGRESS").length;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F7F9FC", p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Disciplinary Actions</Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.25 }}>
            {pending > 0 ? `${pending} open` : "No open disciplinary cases"}
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setNewDlg(true)} sx={{
          bgcolor: PURPLE, textTransform: "none", fontWeight: 600, borderRadius: "8px",
          boxShadow: "none", "&:hover": { bgcolor: "#6D28D9" },
        }}>+ Open Case</Button>
      </Box>

      {/* Filter */}
      <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
        {["IN_PROGRESS", "CLOSED", "CANCELLED", ""].map(s => (
          <Button key={s} size="small" onClick={() => setFilter(s)} sx={{
            textTransform: "none", fontSize: 12, fontWeight: filter === s ? 700 : 400,
            borderRadius: "20px", px: 2,
            bgcolor: filter === s ? PURPLE_L : "transparent",
            color:   filter === s ? PURPLE   : MUTED,
            border: `1px solid ${filter === s ? PURPLE : BORDER}`,
          }}>{s === "" ? "All" : s.replace("_", " ")}</Button>
        ))}
      </Box>

      {/* Table */}
      <Paper elevation={0} sx={{ ...CARD_BASE }}>
        <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Cases</Typography>
        </Box>
        {loading ? (
          <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={24} sx={{ color: PURPLE }} /></Box>
        ) : actions.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: 13, color: MUTED }}>No disciplinary cases found.</Typography>
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr 80px", px: 2.5, py: 1,
                        borderBottom: `1px solid ${BORDER}`, bgcolor: "#F7F9FC" }}>
              {["Employee", "Title", "Checklist", "Status", ""].map(h => (
                <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</Typography>
              ))}
            </Box>
            {actions.map(da => {
              const doneCt = STEPS.filter(s => da[camelStep(s.key)]).length;
              return (
                <Box key={da.id} sx={{
                  display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr 80px",
                  px: 2.5, py: 1.5, borderBottom: `1px solid ${BORDER}`, alignItems: "center",
                  "&:last-child": { borderBottom: "none" }, "&:hover": { bgcolor: "#FAFBFD" },
                }}>
                  <Box sx={{ cursor: "pointer" }} onClick={() => nav(`/crm/employees/${da.employeeId}`)}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                      {da.firstName} {da.lastName}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 12.5, color: TEXT, fontWeight: 500 }}>{da.title}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ display: "flex", gap: "4px" }}>
                      {STEPS.map(s => (
                        <Tooltip key={s.key} title={s.label} arrow>
                          <Box sx={{
                            width: 10, height: 10, borderRadius: "50%",
                            bgcolor: da[camelStep(s.key)] ? SUCCESS : BORDER,
                            border: `1.5px solid ${da[camelStep(s.key)] ? SUCCESS : "#CBD5E1"}`,
                          }} />
                        </Tooltip>
                      ))}
                    </Box>
                    <Typography sx={{ fontSize: 11, color: MUTED }}>{doneCt}/3</Typography>
                    {da.correctiveActions?.length > 0 && (
                      <Typography sx={{ fontSize: 11, color: PURPLE }}>
                        {da.correctiveActions.filter(i => i.isDone).length}/{da.correctiveActions.length} actions
                      </Typography>
                    )}
                  </Box>
                  <StatusChip status={da.status} />
                  <Button size="small" variant="outlined" onClick={() => setDetail(da)} sx={{
                    fontSize: 11, textTransform: "none", borderRadius: "6px",
                    borderColor: BORDER, color: TEXT, "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L },
                  }}>Open</Button>
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      {/* New case dialog */}
      <Dialog open={newDlg} onClose={() => setNewDlg(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 1 }}>Open Disciplinary Case</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
          <TextField select size="small" label="Employee *" value={form.employeeId}
            onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} fullWidth>
            {employees.map(emp => (
              <MenuItem key={emp.id} value={emp.id} sx={{ fontSize: 13 }}>
                {emp.firstName} {emp.lastName}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Title *" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} fullWidth />
          <TextField size="small" label="Incident description" value={form.incidentDescription}
            onChange={e => setForm(f => ({ ...f, incidentDescription: e.target.value }))}
            fullWidth multiline rows={3} />
          <TextField size="small" label="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
          <Box>
            <input type="file" ref={fileRef} style={{ display: "none" }}
              onChange={e => setIncident(e.target.files[0] || null)} />
            <Button size="small" variant="outlined" onClick={() => fileRef.current.click()} sx={{
              fontSize: 12, textTransform: "none", borderRadius: "7px", borderColor: BORDER, color: TEXT,
            }}>
              {incident ? `📎 ${incident.name}` : "Attach incident report (optional)"}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setNewDlg(false)} sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button variant="contained" onClick={create}
            disabled={creating || !form.employeeId || !form.title.trim()}
            sx={{ fontSize: 12, textTransform: "none", bgcolor: PURPLE, boxShadow: "none", borderRadius: "8px",
                  "&:hover": { bgcolor: "#6D28D9" } }}>
            {creating ? "Opening…" : "Open Case"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail dialog */}
      <DetailDialog action={detail} loginId={loginId} authH={authH}
        onClose={() => setDetail(null)} onRefresh={refreshDetail} />
    </Box>
  );
}
