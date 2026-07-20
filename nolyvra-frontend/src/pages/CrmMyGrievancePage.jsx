import { useEffect, useState, useCallback } from "react";
import {
  Box, Paper, Typography, Button, CircularProgress, Alert,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Tooltip,
} from "@mui/material";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const SURFACE   = "#FFFFFF";
const BORDER    = "#E8ECF2";
const MUTED     = "#8A94A6";
const TEXT      = "#0F1623";
const PURPLE    = "#7C3AED";
const SUCCESS   = "#16A34A";
const SUCCESS_L = "#F0FDF4";
const WARN      = "#D97706";
const WARN_L    = "#FFFBEB";
const DANGER    = "#DC2626";
const DANGER_L  = "#FEF2F2";

const CARD = {
  bgcolor: SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: "12px", boxShadow: "0 1px 4px rgba(15,22,35,0.05)",
};

const thSx = {
  fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
  letterSpacing: "0.5px", borderBottom: `1px solid ${BORDER}`,
  bgcolor: "#FAFBFD", py: 1.25, px: 2,
};

function authH() {
  return { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };
}

const STATUS_META = {
  IN_PROGRESS: { label: "In Progress", bg: WARN_L,    color: WARN,    border: "#FDE68A" },
  RESOLVED:    { label: "Resolved",    bg: SUCCESS_L, color: SUCCESS, border: "#BBF7D0" },
  REJECTED:    { label: "Rejected",    bg: DANGER_L,  color: DANGER,  border: "#FECACA" },
  CANCELLED:   { label: "Cancelled",   bg: "#F9FAFB", color: MUTED,   border: BORDER    },
};

function StatusChip({ status }) {
  const m = STATUS_META[status] || STATUS_META.IN_PROGRESS;
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: m.bg, color: m.color, border: `1px solid ${m.border}`,
      borderRadius: "20px", px: 1.5, py: "2px", fontSize: 11, fontWeight: 700,
    }}>{m.label}</Box>
  );
}

function NewGrievanceDialog({ open, onClose, loginId, employeeId, onCreated }) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [complaint,    setComplaint]  = useState(null);
  const [saving,       setSaving]     = useState(false);
  const [err,          setErr]        = useState("");

  function reset() {
    setTitle(""); setDescription(""); setComplaint(null); setErr("");
  }

  async function submit() {
    setErr("");
    if (!title.trim()) { setErr("Title is required."); return; }
    setSaving(true);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      if (description) form.append("description", description);
      if (complaint)    form.append("complaint", complaint);

      const res = await fetch(
        `${API_BASE}/api/crm/employees/${employeeId}/grievances?loginId=${loginId}`,
        { method: "POST", headers: authH(), body: form }
      );
      if (!res.ok) {
        const text = await res.text();
        try { const j = JSON.parse(text); setErr(j.message || j.error || "Failed to raise grievance."); }
        catch { setErr(text || "Failed to raise grievance."); }
        return;
      }
      onCreated(await res.json());
      reset(); onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700, pb: 1 }}>Raise Grievance</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        {err && <Alert severity="error" sx={{ fontSize: 12 }}>{err}</Alert>}
        <TextField size="small" label="Title" value={title}
          onChange={e => setTitle(e.target.value)} fullWidth
          sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
        <TextField size="small" label="Description (optional)" value={description}
          onChange={e => setDescription(e.target.value)} fullWidth multiline rows={4}
          sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
        <Button component="label" size="small" variant="outlined" sx={{
          fontSize: 11, textTransform: "none", borderRadius: "8px", alignSelf: "flex-start",
          borderColor: BORDER, color: TEXT,
        }}>
          {complaint ? complaint.name : "Attach supporting document"}
          <input type="file" hidden onChange={e => setComplaint(e.target.files?.[0] || null)} />
        </Button>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={() => { reset(); onClose(); }}
          sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", boxShadow: "none",
                bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" } }}>
          {saving ? "Submitting…" : "Submit Grievance"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CrmMyGrievancePage() {
  const loginId    = localStorage.getItem("loginId")    || "";
  const employeeId = localStorage.getItem("employeeId") || "";

  const [grievances, setGrievances] = useState([]);
  const [loading,     setLoading]   = useState(true);
  const [error,       setError]     = useState(null);
  const [showNew,     setShowNew]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/crm/employees/${employeeId}/grievances?loginId=${loginId}`, { headers: authH() });
      if (!res.ok) throw new Error(`Grievances: ${res.status}`);
      setGrievances(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [loginId, employeeId]);

  useEffect(() => { load(); }, [load]);

  function handleCreated(g) {
    setGrievances(prev => [g, ...prev]);
  }

  async function cancel(id) {
    if (!window.confirm("Cancel this grievance?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/crm/grievances/${id}?loginId=${loginId}`,
        { method: "DELETE", headers: authH() });
      if (!res.ok) { alert(await res.text()); return; }
      setGrievances(prev => prev.map(g => g.id === id ? { ...g, status: "CANCELLED" } : g));
    } catch (e) { alert(e.message); }
  }

  const pendingCount = grievances.filter(g => g.status === "IN_PROGRESS").length;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>My Grievances</Typography>
            {pendingCount > 0 && (
              <Box sx={{
                fontSize: 10, fontWeight: 700, color: WARN, bgcolor: WARN_L,
                border: `1px solid #FDE68A`, borderRadius: "20px", px: "8px", py: "2px",
              }}>{pendingCount} in progress</Box>
            )}
          </Box>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Raise a grievance and track its resolution
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setShowNew(true)} startIcon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        } sx={{
          fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px", boxShadow: "none",
          background: `linear-gradient(135deg, ${PURPLE} 0%, #4F46E5 100%)`,
          "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
        }}>
          Raise Grievance
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} sx={{ color: PURPLE }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>
      ) : grievances.length === 0 ? (
        <Paper elevation={0} sx={{ ...CARD, p: 5, textAlign: "center" }}>
          <Typography sx={{ fontSize: 13, color: MUTED }}>
            No grievances raised yet.
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ ...CARD, overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Title</TableCell>
                <TableCell sx={thSx}>Description</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {grievances.map(g => (
                <TableRow key={g.id} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: 12.5, fontWeight: 600, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    {g.title}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}`, maxWidth: 320 }}>
                    <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {g.description || "—"}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                    <StatusChip status={g.status} />
                    {g.resolutionNotes && (
                      <Tooltip title={g.resolutionNotes}>
                        <Box component="span" sx={{ ml: 0.75, fontSize: 11, color: MUTED, cursor: "help" }}>💬</Box>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>
                    {g.status === "IN_PROGRESS" && (
                      <Tooltip title="Cancel grievance">
                        <IconButton size="small" onClick={() => cancel(g.id)}
                          sx={{ color: MUTED, "&:hover": { color: DANGER } }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      <NewGrievanceDialog
        open={showNew} onClose={() => setShowNew(false)}
        loginId={loginId} employeeId={employeeId}
        onCreated={handleCreated} />
    </Box>
  );
}
