import { useEffect, useRef, useState } from "react";
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Tooltip,
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

const STAGES = [
  { key: "investigated", label: "Investigation"  },
  { key: "hr_reviewed",  label: "HR Review"       },
  { key: "resolved",     label: "Resolution"      },
  { key: "closed",       label: "Closure"         },
];

function camelStep(key) {
  return "step" + key.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("");
}

function StatusChip({ status }) {
  const map = {
    IN_PROGRESS: { bg: WARN_L,    border: "#FDE68A", color: WARN    },
    RESOLVED:    { bg: SUCCESS_L, border: "#BBF7D0", color: SUCCESS  },
    REJECTED:    { bg: DANGER_L,  border: "#FECACA", color: DANGER   },
    CANCELLED:   { bg: "#F1F3F7", border: BORDER,    color: MUTED    },
  };
  const s = map[status] || map.CANCELLED;
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 700,
      px: "8px", py: "2px", borderRadius: "20px",
      bgcolor: s.bg, border: `1px solid ${s.border}`, color: s.color,
    }}>{status?.replace("_", " ")}</Box>
  );
}

export default function CrmGrievancePage() {
  const nav     = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";
  const authH   = { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };

  const [grievances,  setGrievances]  = useState([]);
  const [employees,   setEmployees]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("IN_PROGRESS");
  const [newDlg,      setNewDlg]      = useState(false);
  const [resolveDlg,  setResolveDlg]  = useState(null);
  const [resolveNotes,setResolveNotes]= useState("");
  const [form,        setForm]        = useState({ employeeId: "", title: "", description: "" });
  const [complaint,   setComplaint]   = useState(null);
  const [creating,    setCreating]    = useState(false);
  const [acting,      setActing]      = useState(false);
  const fileRef = useRef();

  async function load() {
    setLoading(true);
    try {
      const [gRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/grievances?loginId=${loginId}${filter ? `&status=${filter}` : ""}`, { headers: authH }),
        fetch(`${API_BASE}/api/crm/employees?loginId=${loginId}&status=ACTIVE`, { headers: authH }),
      ]);
      if (gRes.ok)   setGrievances(await gRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (_) {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filter]); // eslint-disable-line

  async function create() {
    if (!form.employeeId || !form.title.trim()) return;
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append("loginId",     loginId);
      fd.append("title",       form.title.trim());
      if (form.description) fd.append("description", form.description);
      if (complaint)        fd.append("complaint",   complaint);
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${form.employeeId}/grievances`,
        { method: "POST", headers: { Authorization: authH.Authorization }, body: fd }
      );
      if (!res.ok) { alert(await res.text()); return; }
      setNewDlg(false);
      setForm({ employeeId: "", title: "", description: "" });
      setComplaint(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function toggleStep(id, step, checked) {
    try {
      await fetch(`${API_BASE}/api/crm/grievances/${id}/step?loginId=${loginId}`,
        { method: "PUT", headers: { ...authH, "Content-Type": "application/json" },
          body: JSON.stringify({ step, checked }) });
      load();
    } catch (e) { alert(e.message); }
  }

  async function resolve(id) {
    setActing(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/grievances/${id}/resolve?loginId=${loginId}&resolutionNotes=${encodeURIComponent(resolveNotes)}`,
        { method: "POST", headers: authH }
      );
      if (!res.ok) { alert(await res.text()); return; }
      setResolveDlg(null);
      setResolveNotes("");
      load();
    } catch (e) { alert(e.message); }
    finally { setActing(false); }
  }

  async function reject(id) {
    if (!window.confirm("Reject this grievance?")) return;
    setActing(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm/grievances/${id}/reject?loginId=${loginId}`,
        { method: "POST", headers: authH });
      if (!res.ok) { alert(await res.text()); return; }
      load();
    } catch (e) { alert(e.message); }
    finally { setActing(false); }
  }

  const pending = grievances.filter(g => g.status === "IN_PROGRESS").length;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F7F9FC", p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Employee Grievances</Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.25 }}>
            {pending > 0 ? `${pending} open` : "No open grievances"}
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setNewDlg(true)} sx={{
          bgcolor: PURPLE, textTransform: "none", fontWeight: 600, borderRadius: "8px",
          boxShadow: "none", "&:hover": { bgcolor: "#6D28D9" },
        }}>+ Raise Grievance</Button>
      </Box>

      {/* Filter */}
      <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
        {["IN_PROGRESS", "RESOLVED", "REJECTED", "CANCELLED", ""].map(s => (
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
        ) : grievances.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: 13, color: MUTED }}>No grievances found.</Typography>
          </Box>
        ) : (
          <Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr 120px", px: 2.5, py: 1,
                        borderBottom: `1px solid ${BORDER}`, bgcolor: "#F7F9FC" }}>
              {["Employee", "Title", "Stages", "Status", ""].map(h => (
                <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</Typography>
              ))}
            </Box>
            {grievances.map(g => {
              const allDone = STAGES.every(s => g[camelStep(s.key)]);
              return (
                <Box key={g.id} sx={{
                  display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 1fr 120px",
                  px: 2.5, py: 1.5, borderBottom: `1px solid ${BORDER}`, alignItems: "center",
                  "&:last-child": { borderBottom: "none" }, "&:hover": { bgcolor: "#FAFBFD" },
                }}>
                  <Box sx={{ cursor: "pointer" }} onClick={() => nav(`/crm/employees/${g.employeeId}`)}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                      {g.firstName} {g.lastName}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 12.5, color: TEXT, fontWeight: 500 }}>{g.title}</Typography>
                    {g.description && <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.25 }} noWrap>{g.description}</Typography>}
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    {STAGES.map(s => {
                      const done = g[camelStep(s.key)];
                      return (
                        <Box key={s.key} onClick={() => g.status === "IN_PROGRESS" && toggleStep(g.id, s.key, !done)}
                          sx={{ display: "flex", alignItems: "center", gap: 0.75,
                                cursor: g.status === "IN_PROGRESS" ? "pointer" : "default" }}>
                          <Box sx={{
                            width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
                            bgcolor: done ? SUCCESS : "transparent",
                            border: `2px solid ${done ? SUCCESS : "#CBD5E1"}`,
                          }} />
                          <Typography sx={{ fontSize: 11, color: done ? SUCCESS : MUTED,
                            textDecoration: done ? "line-through" : "none" }}>{s.label}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                  <StatusChip status={g.status} />
                  <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                    {g.status === "IN_PROGRESS" && (
                      <>
                        <Tooltip title={allDone ? "Resolve grievance" : "Complete all stages first"} arrow>
                          <span>
                            <Button size="small" variant="contained" disabled={!allDone || acting}
                              onClick={() => { setResolveDlg(g.id); setResolveNotes(""); }}
                              sx={{ fontSize: 10, textTransform: "none", borderRadius: "6px", boxShadow: "none", minWidth: 0, px: 1,
                                    bgcolor: allDone ? SUCCESS : "#E2E8F0", color: allDone ? "#fff" : MUTED,
                                    "&:hover": allDone ? { bgcolor: "#15803D" } : {} }}>✓</Button>
                          </span>
                        </Tooltip>
                        <Button size="small" disabled={acting} onClick={() => reject(g.id)} sx={{
                          fontSize: 10, textTransform: "none", borderRadius: "6px", px: 1, minWidth: 0,
                          color: DANGER, border: `1px solid ${DANGER}`, "&:hover": { bgcolor: DANGER_L },
                        }}>✕</Button>
                      </>
                    )}
                    {g.complaintName && (
                      <Tooltip title={`Download: ${g.complaintName}`} arrow>
                        <Button size="small" component="a"
                          href={`${API_BASE}/api/crm/grievances/${g.id}/complaint?loginId=${loginId}`}
                          sx={{ fontSize: 10, textTransform: "none", borderRadius: "6px", px: 1, minWidth: 0,
                                color: PURPLE, border: `1px solid ${PURPLE}`, "&:hover": { bgcolor: PURPLE_L } }}>⬇</Button>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      {/* New grievance dialog */}
      <Dialog open={newDlg} onClose={() => setNewDlg(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 1 }}>Raise Grievance</DialogTitle>
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
          <TextField size="small" label="Description" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            fullWidth multiline rows={3} />
          <Box>
            <input type="file" ref={fileRef} style={{ display: "none" }}
              onChange={e => setComplaint(e.target.files[0] || null)} />
            <Button size="small" variant="outlined" onClick={() => fileRef.current.click()} sx={{
              fontSize: 12, textTransform: "none", borderRadius: "7px", borderColor: BORDER, color: TEXT,
            }}>
              {complaint ? `📎 ${complaint.name}` : "Attach complaint document (optional)"}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setNewDlg(false)} sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button variant="contained" onClick={create}
            disabled={creating || !form.employeeId || !form.title.trim()}
            sx={{ fontSize: 12, textTransform: "none", bgcolor: PURPLE, boxShadow: "none", borderRadius: "8px",
                  "&:hover": { bgcolor: "#6D28D9" } }}>
            {creating ? "Raising…" : "Raise Grievance"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Resolve dialog */}
      <Dialog open={!!resolveDlg} onClose={() => setResolveDlg(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 1 }}>Resolve Grievance</DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          <TextField size="small" label="Resolution notes (optional)" value={resolveNotes}
            onChange={e => setResolveNotes(e.target.value)} fullWidth multiline rows={3} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setResolveDlg(null)} sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button variant="contained" onClick={() => resolve(resolveDlg)} disabled={acting}
            sx={{ fontSize: 12, textTransform: "none", bgcolor: SUCCESS, boxShadow: "none", borderRadius: "8px",
                  "&:hover": { bgcolor: "#15803D" } }}>
            {acting ? "Resolving…" : "Mark Resolved"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
