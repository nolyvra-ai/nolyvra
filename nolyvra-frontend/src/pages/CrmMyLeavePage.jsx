import { useEffect, useState, useCallback } from "react";
import {
  Box, Paper, Typography, Button, CircularProgress, Alert,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, IconButton, Tooltip,
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
  PENDING:   { label: "Pending",   bg: WARN_L,    color: WARN,    border: "#FDE68A" },
  APPROVED:  { label: "Approved",  bg: SUCCESS_L, color: SUCCESS, border: "#BBF7D0" },
  REJECTED:  { label: "Rejected",  bg: DANGER_L,  color: DANGER,  border: "#FECACA" },
  CANCELLED: { label: "Cancelled", bg: "#F9FAFB", color: MUTED,   border: BORDER    },
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

function NewRequestDialog({ open, onClose, loginId, employeeId, leaveTypes, onCreated }) {
  const [leaveTypeId,   setLeaveTypeId]   = useState("");
  const [startDate,     setStartDate]     = useState("");
  const [endDate,       setEndDate]       = useState("");
  const [daysRequested, setDaysRequested] = useState("");
  const [reason,        setReason]        = useState("");
  const [saving,        setSaving]        = useState(false);
  const [err,           setErr]           = useState("");

  function reset() {
    setLeaveTypeId(""); setStartDate(""); setEndDate("");
    setDaysRequested(""); setReason(""); setErr("");
  }

  useEffect(() => {
    if (startDate && endDate) {
      if (endDate < startDate) { setDaysRequested(""); return; }
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
    if (!leaveTypeId || !startDate || !endDate || !daysRequested) {
      setErr("All fields except reason are required."); return;
    }
    if (endDate < startDate) {
      setErr("End date cannot be before start date."); return;
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
      if (!res.ok) {
        const text = await res.text();
        try { const j = JSON.parse(text); setErr(j.message || j.error || "Failed to submit leave request."); }
        catch { setErr(text || "Failed to submit leave request."); }
        return;
      }
      onCreated(await res.json());
      reset(); onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700, pb: 1 }}>New Leave / WFH Request</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        {err && <Alert severity="error" sx={{ fontSize: 12 }}>{err}</Alert>}
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

export default function CrmMyLeavePage() {
  const loginId    = localStorage.getItem("loginId")    || "";
  const employeeId = localStorage.getItem("employeeId") || "";

  const [requests,   setRequests]   = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [showNewReq, setShowNewReq] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [reqRes, typeRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/leave/requests?loginId=${loginId}`, { headers: authH() }),
        fetch(`${API_BASE}/api/crm/leave/types?loginId=${loginId}`, { headers: authH() }),
      ]);
      if (!reqRes.ok)  throw new Error(`Requests: ${reqRes.status}`);
      if (!typeRes.ok) throw new Error(`Types: ${typeRes.status}`);
      setRequests(await reqRes.json());
      setLeaveTypes(await typeRes.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [loginId]);

  useEffect(() => { load(); }, [load]);

  function handleCreated(req) {
    setRequests(prev => [req, ...prev]);
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

  const pendingCount = requests.filter(r => r.status === "PENDING").length;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>My Leave / WFH</Typography>
            {pendingCount > 0 && (
              <Box sx={{
                fontSize: 10, fontWeight: 700, color: WARN, bgcolor: WARN_L,
                border: `1px solid #FDE68A`, borderRadius: "20px", px: "8px", py: "2px",
              }}>{pendingCount} pending</Box>
            )}
          </Box>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Apply for leave or work from home and track your requests
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setShowNewReq(true)} startIcon={
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        } sx={{
          fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px", boxShadow: "none",
          background: `linear-gradient(135deg, ${PURPLE} 0%, #4F46E5 100%)`,
          "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
        }}>
          New Request
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} sx={{ color: PURPLE }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>
      ) : requests.length === 0 ? (
        <Paper elevation={0} sx={{ ...CARD, p: 5, textAlign: "center" }}>
          <Typography sx={{ fontSize: 13, color: MUTED }}>
            No leave requests yet. Submit one to get started.
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ ...CARD, overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Leave Type</TableCell>
                <TableCell sx={thSx}>Dates</TableCell>
                <TableCell sx={thSx}>Days</TableCell>
                <TableCell sx={thSx}>Reason</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.map(req => (
                <TableRow key={req.id} sx={{ "&:last-child td": { borderBottom: 0 } }}>
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
                      <Tooltip title="Cancel request">
                        <IconButton size="small" onClick={() => cancel(req.id)}
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

      <NewRequestDialog
        open={showNewReq} onClose={() => setShowNewReq(false)}
        loginId={loginId} employeeId={employeeId} leaveTypes={leaveTypes}
        onCreated={handleCreated} />
    </Box>
  );
}
