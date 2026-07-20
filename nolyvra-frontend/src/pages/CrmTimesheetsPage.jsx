import { useEffect, useState, useCallback } from "react";
import {
  Box, Paper, Typography, Button, CircularProgress, Alert,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Tooltip,
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

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function weekEnd(weekStartDate) {
  const d = new Date(weekStartDate + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return toDateStr(d);
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

function ActionDialog({ open, action, timesheetId, loginId, onClose, onDone }) {
  const [comment, setComment] = useState("");
  const [saving,  setSaving]  = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/timesheets/${timesheetId}/action?loginId=${loginId}`,
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
        {isApprove ? "Approve Timesheet" : "Reject Timesheet"}
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

function StatTile({ label, value }) {
  return (
    <Paper elevation={0} sx={{ ...CARD, p: 2.5, flex: 1, minWidth: 160 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 24, fontWeight: 800, color: TEXT, mt: 0.5 }}>
        {value}h
      </Typography>
    </Paper>
  );
}

export default function CrmTimesheetsPage() {
  const loginId = localStorage.getItem("loginId") || "";

  const [timesheets, setTimesheets] = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [analytics,  setAnalytics]  = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [empFilter,    setEmpFilter]    = useState("");
  const [actionDialog, setActionDialog] = useState({ open: false, action: "", timesheetId: "" });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [tsRes, empRes, anaRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/timesheets?loginId=${loginId}`, { headers: authH() }),
        fetch(`${API_BASE}/api/crm/employees?loginId=${loginId}`, { headers: authH() }),
        fetch(`${API_BASE}/api/crm/timesheets/analytics?loginId=${loginId}`, { headers: authH() }),
      ]);
      if (!tsRes.ok)  throw new Error(`Timesheets: ${tsRes.status}`);
      if (!empRes.ok) throw new Error(`Employees: ${empRes.status}`);
      if (!anaRes.ok) throw new Error(`Analytics: ${anaRes.status}`);
      setTimesheets(await tsRes.json());
      setEmployees(await empRes.json());
      setAnalytics(await anaRes.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [loginId]);

  useEffect(() => { load(); }, [load]);

  function handleActioned(updated) {
    setTimesheets(prev => prev.map(t => t.id === updated.id ? updated : t));
    // Approval changes analytics (approved-hours only) — refresh in the background.
    fetch(`${API_BASE}/api/crm/timesheets/analytics?loginId=${loginId}`, { headers: authH() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAnalytics(d); })
      .catch(() => {});
  }

  const filtered = timesheets.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (empFilter    && t.employeeId !== empFilter) return false;
    return true;
  });

  const pendingCount = timesheets.filter(t => t.status === "PENDING").length;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Timesheets</Typography>
            {pendingCount > 0 && (
              <Box sx={{
                fontSize: 10, fontWeight: 700, color: WARN, bgcolor: WARN_L,
                border: `1px solid #FDE68A`, borderRadius: "20px", px: "8px", py: "2px",
              }}>{pendingCount} pending</Box>
            )}
          </Box>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Review and approve employee weekly timesheets
          </Typography>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} sx={{ color: PURPLE }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>
      ) : (
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

          {/* Timesheets table */}
          {filtered.length === 0 ? (
            <Paper elevation={0} sx={{ ...CARD, p: 5, textAlign: "center" }}>
              <Typography sx={{ fontSize: 13, color: MUTED }}>
                {timesheets.length === 0 ? "No timesheets submitted yet." : "No timesheets match the current filters."}
              </Typography>
            </Paper>
          ) : (
            <Paper elevation={0} sx={{ ...CARD, overflow: "hidden" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={thSx}>Employee</TableCell>
                    <TableCell sx={thSx}>Week</TableCell>
                    <TableCell sx={thSx}>Total Hours</TableCell>
                    <TableCell sx={thSx}>Status</TableCell>
                    <TableCell sx={{ ...thSx, textAlign: "right" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filtered.map(ts => (
                    <TableRow key={ts.id} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                      <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>
                          {ts.employeeFirstName} {ts.employeeLastName}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 1.5, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}`, whiteSpace: "nowrap" }}>
                        {ts.weekStartDate} → {weekEnd(ts.weekStartDate)}
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
                          <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end" }}>
                            <Button size="small" variant="contained"
                              onClick={() => setActionDialog({ open: true, action: "APPROVED", timesheetId: ts.id })}
                              sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                                    bgcolor: SUCCESS, "&:hover": { bgcolor: "#15803D" }, minWidth: 0, px: 1.5 }}>
                              Approve
                            </Button>
                            <Button size="small" variant="outlined"
                              onClick={() => setActionDialog({ open: true, action: "REJECTED", timesheetId: ts.id })}
                              sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px",
                                    borderColor: DANGER, color: DANGER, "&:hover": { bgcolor: DANGER_L }, minWidth: 0, px: 1.5 }}>
                              Reject
                            </Button>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Analytics */}
          {analytics && (
            <Box sx={{ mt: 4 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: TEXT, mb: 0.5 }}>Analytics</Typography>
              <Typography sx={{ fontSize: 12, color: MUTED, mb: 2 }}>
                Approved hours only
              </Typography>

              <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, flexWrap: "wrap" }}>
                <StatTile label="Hours This Week"  value={analytics.totalHoursThisWeek} />
                <StatTile label="Hours This Month" value={analytics.totalHoursThisMonth} />
                <StatTile label="Hours This Year"  value={analytics.totalHoursThisYear} />
              </Box>

              <Paper elevation={0} sx={{ ...CARD, overflow: "hidden" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={thSx}>Employee</TableCell>
                      <TableCell sx={thSx}>This Week</TableCell>
                      <TableCell sx={thSx}>This Month</TableCell>
                      <TableCell sx={thSx}>This Year</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.byEmployee.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ py: 3, textAlign: "center", fontSize: 12, color: MUTED, border: "none" }}>
                          No employees yet.
                        </TableCell>
                      </TableRow>
                    ) : analytics.byEmployee.map(row => (
                      <TableRow key={row.employeeId} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                        <TableCell sx={{ py: 1.25, px: 2, fontSize: 12.5, fontWeight: 600, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                          {row.firstName} {row.lastName}
                        </TableCell>
                        <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                          {row.hoursThisWeek}h
                        </TableCell>
                        <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                          {row.hoursThisMonth}h
                        </TableCell>
                        <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                          {row.hoursThisYear}h
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          )}
        </>
      )}

      <ActionDialog
        open={actionDialog.open}
        action={actionDialog.action}
        timesheetId={actionDialog.timesheetId}
        loginId={loginId}
        onClose={() => setActionDialog({ open: false, action: "", timesheetId: "" })}
        onDone={handleActioned} />
    </Box>
  );
}
