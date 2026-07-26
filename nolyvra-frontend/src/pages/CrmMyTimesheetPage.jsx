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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function authH() {
  return { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function weekDates(mondayStr) {
  const monday = new Date(mondayStr + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return toDateStr(d);
  });
}

const STATUS_META = {
  PENDING:   { label: "Pending",   bg: WARN_L,    color: WARN,    border: "#FDE68A" },
  APPROVED:  { label: "Approved",  bg: SUCCESS_L, color: SUCCESS, border: "#BBF7D0" },
  REJECTED:  { label: "Rejected",  bg: DANGER_L,  color: DANGER,  border: "#FECACA" },
  CANCELLED: { label: "Cancelled", bg: "#F9FAFB",  color: MUTED,   border: BORDER    },
};

function StatusChip({ status }) {
  const m = STATUS_META[status] || STATUS_META.PENDING;
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: m.bg, color: m.color, border: `1px solid ${m.border}`,
      borderRadius: "20px", px: 1.5, py: "2px", fontSize: 11, fontWeight: 700,
    }}>{m.label}</Box>
  );
}

function blankRow(workDate) {
  const id = (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID() : `${workDate}-${Math.random().toString(36).slice(2)}`;
  return { id, workDate, hours: "", note: "" };
}

function NewTimesheetDialog({ open, onClose, loginId, employeeId, onCreated }) {
  const [anyDay,  setAnyDay]  = useState(toDateStr(new Date()));
  const [rows,    setRows]    = useState(() => weekDates(toDateStr(mondayOf(toDateStr(new Date())))).map(blankRow));
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState("");

  const monday = toDateStr(mondayOf(anyDay));

  useEffect(() => {
    setRows(weekDates(monday).map(blankRow));
  }, [monday]);

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function addRow(workDate) {
    setRows(prev => [...prev, blankRow(workDate)]);
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  const total = rows.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0);

  function reset() {
    setAnyDay(toDateStr(new Date())); setErr("");
  }

  async function submit() {
    setErr("");
    if (total <= 0) { setErr("Enter at least some hours for the week."); return; }
    setSaving(true);
    try {
      const days = rows
        .filter(r => r.hours !== "" || (r.note && r.note.trim()))
        .map(r => ({
          workDate: r.workDate,
          hours: parseFloat(r.hours) || 0,
          note: r.note || null,
        }));
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${employeeId}/timesheets?loginId=${loginId}`,
        {
          method: "POST", headers: { ...authH(), "Content-Type": "application/json" },
          body: JSON.stringify({ weekStartDate: monday, days }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        try { const j = JSON.parse(text); setErr(j.message || j.error || "Failed to submit timesheet."); }
        catch { setErr(text || "Failed to submit timesheet."); }
        return;
      }
      onCreated(await res.json());
      reset(); onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const days = weekDates(monday);

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700, pb: 1 }}>New Timesheet</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        {err && <Alert severity="error" sx={{ fontSize: 12 }}>{err}</Alert>}
        <TextField size="small" label="Any day in the week" type="date" value={anyDay}
          onChange={e => setAnyDay(e.target.value)} fullWidth
          InputLabelProps={{ shrink: true }} sx={{ "& .MuiInputBase-input": { fontSize: 12 } }}
          helperText={`Week: ${monday} → ${weekDates(monday)[6]}`} />

        <Box>
          {days.map((d, i) => {
            const dayRows = rows.filter(r => r.workDate === d);
            return (
              <Box key={d} sx={{ mb: 1 }}>
                {dayRows.map((r, ri) => (
                  <Box key={r.id} sx={{ display: "flex", gap: 1.5, alignItems: "center", mb: 0.5 }}>
                    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: TEXT, width: 90, flexShrink: 0 }}>
                      {ri === 0 ? `${DAY_LABELS[i]} ${d.slice(5)}` : ""}
                    </Typography>
                    <TextField size="small" type="number" placeholder="Hours" value={r.hours}
                      onChange={e => updateRow(r.id, "hours", e.target.value)}
                      sx={{ width: 90, "& .MuiInputBase-input": { fontSize: 12 } }} />
                    <TextField size="small" placeholder="Note (optional)" value={r.note}
                      onChange={e => updateRow(r.id, "note", e.target.value)} fullWidth
                      sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                    {ri === 0 ? (
                      <Tooltip title="Add another entry for this day">
                        <IconButton size="small" onClick={() => addRow(d)}
                          sx={{ color: MUTED, "&:hover": { color: PURPLE } }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title="Remove this entry">
                        <IconButton size="small" onClick={() => removeRow(r.id)}
                          sx={{ color: MUTED, "&:hover": { color: DANGER } }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>

        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: TEXT, textAlign: "right" }}>
          Total: {total.toFixed(2)}h
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={() => { reset(); onClose(); }}
          sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", boxShadow: "none",
                bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" } }}>
          {saving ? "Submitting…" : "Submit Timesheet"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CrmMyTimesheetPage() {
  const loginId = localStorage.getItem("loginId") || "";

  // Employee sessions already have their own employeeId in localStorage.
  // Tenant (Nolyvra account holder) sessions don't — resolve/create the
  // owner's own employee record via /employees/me instead.
  const [employeeId, setEmployeeId] = useState(localStorage.getItem("employeeId") || "");
  const [resolvingEmployee, setResolvingEmployee] = useState(!employeeId);

  const [timesheets, setTimesheets] = useState([]);
  const [loading,     setLoading]   = useState(true);
  const [error,       setError]     = useState(null);
  const [showNew,     setShowNew]   = useState(false);

  useEffect(() => {
    if (employeeId) return;
    setResolvingEmployee(true);
    fetch(`${API_BASE}/api/crm/employees/me?loginId=${loginId}`, { headers: authH() })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`Employees/me: ${r.status}`)))
      .then(d => setEmployeeId(d.id))
      .catch(e => setError(e.message))
      .finally(() => setResolvingEmployee(false));
  }, [loginId, employeeId]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/crm/timesheets?loginId=${loginId}`, { headers: authH() });
      if (!res.ok) throw new Error(`Timesheets: ${res.status}`);
      setTimesheets(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [loginId]);

  useEffect(() => { load(); }, [load]);

  function handleCreated(ts) {
    setTimesheets(prev => [ts, ...prev]);
  }

  async function cancel(id) {
    if (!window.confirm("Cancel this timesheet?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/crm/timesheets/${id}?loginId=${loginId}`,
        { method: "DELETE", headers: authH() });
      if (!res.ok) { alert(await res.text()); return; }
      setTimesheets(prev => prev.map(t => t.id === id ? { ...t, status: "CANCELLED" } : t));
    } catch (e) { alert(e.message); }
  }

  const pendingCount = timesheets.filter(t => t.status === "PENDING").length;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>My Timesheet</Typography>
            {pendingCount > 0 && (
              <Box sx={{
                fontSize: 10, fontWeight: 700, color: WARN, bgcolor: WARN_L,
                border: `1px solid #FDE68A`, borderRadius: "20px", px: "8px", py: "2px",
              }}>{pendingCount} pending</Box>
            )}
          </Box>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Log your weekly hours and track approval
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setShowNew(true)} disabled={resolvingEmployee} startIcon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        } sx={{
          fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px", boxShadow: "none",
          background: `linear-gradient(135deg, ${PURPLE} 0%, #4F46E5 100%)`,
          "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
        }}>
          New Timesheet
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} sx={{ color: PURPLE }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>
      ) : timesheets.length === 0 ? (
        <Paper elevation={0} sx={{ ...CARD, p: 5, textAlign: "center" }}>
          <Typography sx={{ fontSize: 13, color: MUTED }}>
            No timesheets yet. Submit one to get started.
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ ...CARD, overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Week</TableCell>
                <TableCell sx={thSx}>Total Hours</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {timesheets.map(ts => (
                <TableRow key={ts.id} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                    {ts.weekStartDate} → {weekDates(ts.weekStartDate)[6]}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, fontWeight: 600, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    {ts.totalHours}h
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                    <StatusChip status={ts.status} />
                    {ts.approverComment && (
                      <Tooltip title={ts.approverComment}>
                        <Box component="span" sx={{ ml: 0.75, fontSize: 11, color: MUTED, cursor: "help" }}>💬</Box>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>
                    {ts.status === "PENDING" && (
                      <Tooltip title="Cancel timesheet">
                        <IconButton size="small" onClick={() => cancel(ts.id)}
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

      <NewTimesheetDialog
        open={showNew} onClose={() => setShowNew(false)}
        loginId={loginId} employeeId={employeeId}
        onCreated={handleCreated} />
    </Box>
  );
}
