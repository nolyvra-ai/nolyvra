import { useEffect, useState, useCallback } from "react";
import {
  Box, Paper, Typography, Button, CircularProgress, Alert, Tabs, Tab,
  Table, TableHead, TableRow, TableCell, TableBody, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Switch, FormControlLabel, Tooltip, IconButton,
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
  PENDING:   { label: "Pending",   bg: WARN_L,    color: WARN,    border: "#FDE68A" },
  APPROVED:  { label: "Approved",  bg: SUCCESS_L,  color: SUCCESS, border: "#BBF7D0" },
  REJECTED:  { label: "Rejected",  bg: DANGER_L,   color: DANGER,  border: "#FECACA" },
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

// ─── New Request Dialog ───────────────────────────────────────────────────────

function NewRequestDialog({ open, onClose, loginId, employees, leaveTypes, onCreated }) {
  const [employeeId,    setEmployeeId]    = useState("");
  const [leaveTypeId,   setLeaveTypeId]   = useState("");
  const [startDate,     setStartDate]     = useState("");
  const [endDate,       setEndDate]       = useState("");
  const [daysRequested, setDaysRequested] = useState("");
  const [reason,        setReason]        = useState("");
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState("");

  function reset() {
    setEmployeeId(""); setLeaveTypeId(""); setStartDate("");
    setEndDate(""); setDaysRequested(""); setReason(""); setErr("");
  }

  useEffect(() => {
    if (startDate && endDate && startDate <= endDate) {
      const start = new Date(startDate);
      const end   = new Date(endDate);
      let days = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) days++;
      }
      setDaysRequested(String(days));
    }
  }, [startDate, endDate]);

  async function submit() {
    setErr("");
    if (!employeeId || !leaveTypeId || !startDate || !endDate || !daysRequested) {
      setErr("All fields except reason are required."); return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${employeeId}/leave/requests?loginId=${loginId}`,
        {
          method: "POST", headers: { ...authH(), "Content-Type": "application/json" },
          body: JSON.stringify({
            leaveTypeId, startDate, endDate,
            daysRequested: parseFloat(daysRequested), reason: reason || null,
          }),
        }
      );
      if (!res.ok) { setErr(await res.text()); return; }
      onCreated(await res.json());
      reset(); onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700, pb: 1 }}>New Leave Request</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        {err && <Alert severity="error" sx={{ fontSize: 12 }}>{err}</Alert>}
        <FormControl size="small" fullWidth>
          <InputLabel sx={{ fontSize: 12 }}>Employee</InputLabel>
          <Select label="Employee" value={employeeId} onChange={e => setEmployeeId(e.target.value)} sx={{ fontSize: 12 }}>
            {employees.map(emp => (
              <MenuItem key={emp.id} value={emp.id} sx={{ fontSize: 12 }}>
                {emp.firstName} {emp.lastName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel sx={{ fontSize: 12 }}>Leave Type</InputLabel>
          <Select label="Leave Type" value={leaveTypeId} onChange={e => setLeaveTypeId(e.target.value)} sx={{ fontSize: 12 }}>
            {leaveTypes.map(lt => (
              <MenuItem key={lt.id} value={lt.id} sx={{ fontSize: 12 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: lt.color, flexShrink: 0 }} />
                  {lt.name} ({lt.defaultDaysPerYear}d/yr)
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField size="small" label="Start date" type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)} fullWidth
            InputLabelProps={{ shrink: true }} sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
          <TextField size="small" label="End date" type="date" value={endDate}
            onChange={e => setEndDate(e.target.value)} fullWidth
            InputLabelProps={{ shrink: true }} sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
        </Box>
        <TextField size="small" label="Days requested" type="number" value={daysRequested}
          onChange={e => setDaysRequested(e.target.value)} fullWidth
          helperText="Auto-calculated (weekdays). Adjust if needed."
          sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
        <TextField size="small" label="Reason (optional)" value={reason}
          onChange={e => setReason(e.target.value)} fullWidth multiline rows={2}
          sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={() => { reset(); onClose(); }}
          sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", boxShadow: "none",
                bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" } }}>
          {saving ? "Submitting…" : "Submit Request"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Action Dialog ────────────────────────────────────────────────────────────

function ActionDialog({ open, action, requestId, loginId, onClose, onDone }) {
  const [comment, setComment] = useState("");
  const [saving,  setSaving]  = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/leave/requests/${requestId}/action?loginId=${loginId}`,
        {
          method: "POST", headers: { ...authH(), "Content-Type": "application/json" },
          body: JSON.stringify({ action, comment: comment || null }),
        }
      );
      if (!res.ok) { alert(await res.text()); return; }
      onDone(await res.json());
      setComment(""); onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  const isApprove = action === "APPROVED";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 14, fontWeight: 700, pb: 1 }}>
        {isApprove ? "Approve Leave Request" : "Reject Leave Request"}
      </DialogTitle>
      <DialogContent sx={{ pt: "8px !important" }}>
        <TextField size="small" label="Comment (optional)" value={comment}
          onChange={e => setComment(e.target.value)} fullWidth multiline rows={2}
          sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={saving}
          sx={{
            fontSize: 12, textTransform: "none", borderRadius: "8px", boxShadow: "none",
            bgcolor: isApprove ? SUCCESS : DANGER,
            "&:hover": { bgcolor: isApprove ? "#15803D" : "#B91C1C" },
          }}>
          {saving ? "…" : isApprove ? "Approve" : "Reject"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Leave Types Tab ─────────────────────────────────────────────────────────

function LeaveTypesTab({ loginId, types, onRefresh }) {
  const [showAdd,   setShowAdd]   = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState({ name: "", defaultDaysPerYear: 0, isPaid: true, color: "#1D72E8" });
  const [saving,    setSaving]    = useState(false);

  function startEdit(t) {
    setEditId(t.id);
    setForm({ name: t.name, defaultDaysPerYear: t.defaultDaysPerYear, isPaid: t.isPaid, color: t.color });
  }

  function resetForm() {
    setForm({ name: "", defaultDaysPerYear: 0, isPaid: true, color: "#1D72E8" });
    setEditId(null); setShowAdd(false);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const url    = editId
        ? `${API_BASE}/api/crm/leave/types/${editId}?loginId=${loginId}`
        : `${API_BASE}/api/crm/leave/types?loginId=${loginId}`;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { ...authH(), "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { alert(await res.text()); return; }
      onRefresh(); resetForm();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function deleteType(id, name) {
    if (!window.confirm(`Delete leave type "${name}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/crm/leave/types/${id}?loginId=${loginId}`,
        { method: "DELETE", headers: authH() });
      if (!res.ok) { alert(await res.text()); return; }
      onRefresh();
    } catch (e) { alert(e.message); }
  }

  const formRow = (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", flexWrap: "wrap",
                p: 2, bgcolor: "#F7F9FC", borderBottom: `1px solid ${BORDER}` }}>
      <TextField autoFocus size="small" label="Type name" value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
        onKeyDown={e => e.key === "Escape" && resetForm()}
        sx={{ flex: "1 1 160px", "& .MuiInputBase-input": { fontSize: 12 } }} />
      <TextField size="small" label="Days/year" type="number" value={form.defaultDaysPerYear}
        onChange={e => setForm(f => ({ ...f, defaultDaysPerYear: parseInt(e.target.value) || 0 }))}
        sx={{ width: 100, "& .MuiInputBase-input": { fontSize: 12 } }} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: MUTED }}>Color:</Typography>
        <input type="color" value={form.color}
          onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
          style={{ width: 32, height: 32, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }} />
      </Box>
      <FormControlLabel
        control={<Switch size="small" checked={form.isPaid}
          onChange={e => setForm(f => ({ ...f, isPaid: e.target.checked }))} />}
        label={<Typography sx={{ fontSize: 11 }}>Paid</Typography>}
        sx={{ mt: 0.25 }} />
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 0.25 }}>
        <Button size="small" variant="contained" onClick={save} disabled={saving || !form.name.trim()}
          sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" } }}>
          {saving ? "…" : editId ? "Save" : "Add"}
        </Button>
        <Button size="small" onClick={resetForm}
          sx={{ fontSize: 11, textTransform: "none", color: MUTED }}>Cancel</Button>
      </Box>
    </Box>
  );

  return (
    <Paper elevation={0} sx={{ ...CARD, overflow: "hidden" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}` }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Leave Types</Typography>
        {!showAdd && !editId && (
          <Button size="small" variant="outlined" onClick={() => setShowAdd(true)} sx={{
            fontSize: 11, textTransform: "none", borderRadius: "7px",
            borderColor: BORDER, color: TEXT, "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L },
          }}>+ Add Type</Button>
        )}
      </Box>
      {(showAdd && !editId) && formRow}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={thSx}>Type</TableCell>
            <TableCell sx={thSx}>Default Days / Year</TableCell>
            <TableCell sx={thSx}>Paid</TableCell>
            <TableCell sx={{ ...thSx, textAlign: "right" }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {types.map(t => (
            editId === t.id ? (
              <TableRow key={t.id}>
                <TableCell colSpan={4} sx={{ p: 0 }}>{formRow}</TableCell>
              </TableRow>
            ) : (
              <TableRow key={t.id} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: t.color, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{t.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                  {t.defaultDaysPerYear} days
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <Box sx={{
                    display: "inline-flex", fontSize: 10.5, fontWeight: 700,
                    color: t.isPaid ? SUCCESS : MUTED,
                    bgcolor: t.isPaid ? SUCCESS_L : "#F9FAFB",
                    border: `1px solid ${t.isPaid ? "#BBF7D0" : BORDER}`,
                    borderRadius: "4px", px: "6px", py: "1px",
                  }}>{t.isPaid ? "Paid" : "Unpaid"}</Box>
                </TableCell>
                <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>
                  <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => startEdit(t)} sx={{ color: MUTED, "&:hover": { color: ACCENT } }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => deleteType(t.id, t.name)} sx={{ color: MUTED, "&:hover": { color: DANGER } }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            )
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CrmLeavePage() {
  const loginId = localStorage.getItem("loginId") || "";

  const [tab,        setTab]        = useState(0);
  const [requests,   setRequests]   = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [empFilter,    setEmpFilter]    = useState("");

  const [showNewReq,   setShowNewReq]   = useState(false);
  const [actionDialog, setActionDialog] = useState({ open: false, action: "", requestId: "" });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [reqRes, typeRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/leave/requests?loginId=${loginId}`, { headers: authH() }),
        fetch(`${API_BASE}/api/crm/leave/types?loginId=${loginId}`, { headers: authH() }),
        fetch(`${API_BASE}/api/crm/employees?loginId=${loginId}`, { headers: authH() }),
      ]);
      if (!reqRes.ok)  throw new Error(`Requests: ${reqRes.status}`);
      if (!typeRes.ok) throw new Error(`Types: ${typeRes.status}`);
      if (!empRes.ok)  throw new Error(`Employees: ${empRes.status}`);
      setRequests(await reqRes.json());
      setLeaveTypes(await typeRes.json());
      setEmployees(await empRes.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [loginId]);

  useEffect(() => { load(); }, [load]);

  function handleCreated(req) {
    setRequests(prev => [req, ...prev]);
  }

  function handleActioned(updated) {
    setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
  }

  async function cancel(requestId) {
    if (!window.confirm("Cancel this leave request?")) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/leave/requests/${requestId}?loginId=${loginId}`,
        { method: "DELETE", headers: authH() }
      );
      if (!res.ok) { alert(await res.text()); return; }
      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: "CANCELLED" } : r));
    } catch (e) { alert(e.message); }
  }

  const filteredRequests = requests.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (empFilter    && r.employeeId !== empFilter) return false;
    return true;
  });

  const pendingCount = requests.filter(r => r.status === "PENDING").length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Leave Management</Typography>
            {pendingCount > 0 && (
              <Box sx={{
                fontSize: 10, fontWeight: 700, color: WARN, bgcolor: WARN_L,
                border: `1px solid #FDE68A`, borderRadius: "20px", px: "8px", py: "2px",
              }}>{pendingCount} pending</Box>
            )}
          </Box>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Manage employee leave requests and entitlements
          </Typography>
        </Box>
        {tab === 0 && (
          <Button variant="contained" onClick={() => setShowNewReq(true)} startIcon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          } sx={{
            fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px", boxShadow: "none",
            background: `linear-gradient(135deg, ${PURPLE} 0%, #4F46E5 100%)`,
            "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
          }}>
            New Request
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
        mb: 2.5, borderBottom: `1px solid ${BORDER}`,
        "& .MuiTab-root": { fontSize: 12.5, fontWeight: 600, textTransform: "none", minHeight: 40, color: MUTED },
        "& .Mui-selected": { color: PURPLE },
        "& .MuiTabs-indicator": { bgcolor: PURPLE },
      }}>
        <Tab label="Requests" />
        <Tab label="Leave Types" />
      </Tabs>

      {loading ? (
        <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} sx={{ color: PURPLE }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>
      ) : tab === 0 ? (
        <>
          {/* Filters */}
          <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel sx={{ fontSize: 12 }}>Status</InputLabel>
              <Select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} sx={{ fontSize: 12 }}>
                <MenuItem value="" sx={{ fontSize: 12 }}>All statuses</MenuItem>
                {["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(s =>
                  <MenuItem key={s} value={s} sx={{ fontSize: 12 }}>{s.charAt(0) + s.slice(1).toLowerCase()}</MenuItem>
                )}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel sx={{ fontSize: 12 }}>Employee</InputLabel>
              <Select label="Employee" value={empFilter} onChange={e => setEmpFilter(e.target.value)} sx={{ fontSize: 12 }}>
                <MenuItem value="" sx={{ fontSize: 12 }}>All employees</MenuItem>
                {employees.map(e =>
                  <MenuItem key={e.id} value={e.id} sx={{ fontSize: 12 }}>{e.firstName} {e.lastName}</MenuItem>
                )}
              </Select>
            </FormControl>
            {(statusFilter || empFilter) && (
              <Button size="small" onClick={() => { setStatusFilter(""); setEmpFilter(""); }}
                sx={{ fontSize: 11, textTransform: "none", color: MUTED }}>
                Clear filters
              </Button>
            )}
          </Box>

          {/* Requests table */}
          {filteredRequests.length === 0 ? (
            <Paper elevation={0} sx={{ ...CARD, p: 5, textAlign: "center" }}>
              <Typography sx={{ fontSize: 13, color: MUTED }}>
                {requests.length === 0 ? "No leave requests yet. Submit one to get started." : "No requests match the current filters."}
              </Typography>
            </Paper>
          ) : (
            <Paper elevation={0} sx={{ ...CARD, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={thSx}>Employee</TableCell>
                    <TableCell sx={thSx}>Leave Type</TableCell>
                    <TableCell sx={thSx}>Dates</TableCell>
                    <TableCell sx={thSx}>Days</TableCell>
                    <TableCell sx={thSx}>Reason</TableCell>
                    <TableCell sx={thSx}>Status</TableCell>
                    <TableCell sx={{ ...thSx, textAlign: "right" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRequests.map(req => (
                    <TableRow key={req.id} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                      <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>
                          {req.employeeFirstName} {req.employeeLastName}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: req.leaveTypeColor, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 12, color: TEXT }}>{req.leaveTypeName}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                        {req.startDate} → {req.endDate}
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, fontWeight: 600, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                        {req.daysRequested}d
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}`, maxWidth: 200 }}>
                        <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {req.reason || "—"}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                        <StatusChip status={req.status} />
                        {req.approverComment && (
                          <Tooltip title={req.approverComment}>
                            <Box component="span" sx={{ ml: 0.75, fontSize: 11, color: MUTED, cursor: "help" }}>💬</Box>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>
                        {req.status === "PENDING" && (
                          <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end" }}>
                            <Button size="small" variant="contained"
                              onClick={() => setActionDialog({ open: true, action: "APPROVED", requestId: req.id })}
                              sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                                    bgcolor: SUCCESS, "&:hover": { bgcolor: "#15803D" }, minWidth: 0, px: 1.5 }}>
                              Approve
                            </Button>
                            <Button size="small" variant="outlined"
                              onClick={() => setActionDialog({ open: true, action: "REJECTED", requestId: req.id })}
                              sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px",
                                    borderColor: DANGER, color: DANGER, "&:hover": { bgcolor: DANGER_L }, minWidth: 0, px: 1.5 }}>
                              Reject
                            </Button>
                            <Tooltip title="Cancel request">
                              <IconButton size="small" onClick={() => cancel(req.id)}
                                sx={{ color: MUTED, "&:hover": { color: DANGER } }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      ) : (
        <LeaveTypesTab loginId={loginId} types={leaveTypes} onRefresh={load} />
      )}

      <NewRequestDialog
        open={showNewReq} onClose={() => setShowNewReq(false)}
        loginId={loginId} employees={employees} leaveTypes={leaveTypes}
        onCreated={handleCreated} />

      <ActionDialog
        open={actionDialog.open}
        action={actionDialog.action}
        requestId={actionDialog.requestId}
        loginId={loginId}
        onClose={() => setActionDialog({ open: false, action: "", requestId: "" })}
        onDone={handleActioned} />
    </Box>
  );
}
