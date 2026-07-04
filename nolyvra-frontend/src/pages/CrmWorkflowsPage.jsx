import { useEffect, useState, useCallback } from "react";
import {
  Box, Paper, Typography, Button, CircularProgress, Alert, Tabs, Tab,
  Table, TableHead, TableRow, TableCell, TableBody, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

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
  IN_PROGRESS: { label: "In Progress", bg: WARN_L,    color: WARN,    border: "#FDE68A" },
  APPROVED:    { label: "Approved",    bg: SUCCESS_L,  color: SUCCESS, border: "#BBF7D0" },
  REJECTED:    { label: "Rejected",    bg: DANGER_L,   color: DANGER,  border: "#FECACA" },
  CANCELLED:   { label: "Cancelled",  bg: "#F9FAFB",   color: MUTED,   border: BORDER    },
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

// ─── Checklist dots ───────────────────────────────────────────────────────────

function CheckDots({ steps }) {
  return (
    <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
      {steps.map(({ label, done }) => (
        <Tooltip key={label} title={label}>
          <Box sx={{
            width: 10, height: 10, borderRadius: "50%",
            bgcolor: done ? SUCCESS : "#E2E8F0",
            border: `1.5px solid ${done ? SUCCESS : "#CBD5E1"}`,
            transition: "background .2s",
          }} />
        </Tooltip>
      ))}
    </Box>
  );
}

// ─── Inline checklist ─────────────────────────────────────────────────────────

function InlineChecklist({ steps, onToggle, disabled }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {steps.map(({ key, label, done }) => (
        <Box key={key}
          onClick={() => !disabled && onToggle(key, !done)}
          sx={{
            display: "flex", alignItems: "center", gap: 1,
            cursor: disabled ? "default" : "pointer",
            py: "3px", px: "4px", borderRadius: "5px", mx: "-4px",
            "&:hover": disabled ? {} : { bgcolor: "#F1F5F9" },
            transition: "background .12s",
          }}>
          <Box sx={{
            width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
            bgcolor: done ? SUCCESS : "transparent",
            border: `2px solid ${done ? SUCCESS : "#CBD5E1"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .15s",
          }}>
            {done && (
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff"
                strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </Box>
          <Typography sx={{
            fontSize: 11.5, color: done ? SUCCESS : MUTED, fontWeight: done ? 400 : 500,
            textDecoration: done ? "line-through" : "none", transition: "all .15s",
          }}>{label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

// ─── Promotions tab ───────────────────────────────────────────────────────────

function PromotionsTab({ loginId, data, onRefresh, onNavigate }) {
  const [acting,  setActing]  = useState({});
  const [stepping, setStepping] = useState({});

  async function act(id, endpoint) {
    setActing(a => ({ ...a, [id]: true }));
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/promotions/${id}/${endpoint}?loginId=${loginId}`,
        { method: "POST", headers: authH() }
      );
      if (!res.ok) { alert(await res.text()); return; }
      onRefresh();
    } catch (e) { alert(e.message); }
    finally { setActing(a => ({ ...a, [id]: false })); }
  }

  async function toggleStep(id, step, checked) {
    setStepping(s => ({ ...s, [`${id}-${step}`]: true }));
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/promotions/${id}/step?loginId=${loginId}`,
        { method: "PUT", headers: { ...authH(), "Content-Type": "application/json" },
          body: JSON.stringify({ step, checked }) }
      );
      if (!res.ok) { alert(await res.text()); return; }
      onRefresh();
    } catch (e) { alert(e.message); }
    finally { setStepping(s => ({ ...s, [`${id}-${step}`]: false })); }
  }

  if (data.length === 0) return (
    <Paper elevation={0} sx={{ ...CARD, p: 5, textAlign: "center" }}>
      <Typography sx={{ fontSize: 13, color: MUTED }}>
        No promotion requests yet. Click "+ New Promotion" to start one.
      </Typography>
    </Paper>
  );

  return (
    <Paper elevation={0} sx={{ ...CARD, overflow: "hidden" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={thSx}>Employee</TableCell>
            <TableCell sx={thSx}>Current Role → Proposed</TableCell>
            <TableCell sx={thSx}>Effective</TableCell>
            <TableCell sx={thSx}>Checklist</TableCell>
            <TableCell sx={thSx}>Status</TableCell>
            <TableCell sx={{ ...thSx, textAlign: "right" }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(pr => {
            const allDone = pr.stepRecommendationReviewed && pr.stepPerformanceValidated
                         && pr.stepLeadershipApproved   && pr.stepCompensationReviewed;
            const isInProgress = pr.status === "IN_PROGRESS";
            return (
              <TableRow key={pr.id} sx={{ "&:last-child td": { borderBottom: 0 }, verticalAlign: "top" }}>
                <TableCell sx={{ py: 2, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <Box onClick={() => onNavigate(`/crm/employees/${pr.employeeId}`)}
                    sx={{ fontSize: 12.5, fontWeight: 600, color: ACCENT, cursor: "pointer",
                          "&:hover": { textDecoration: "underline" } }}>
                    {pr.employeeFirstName} {pr.employeeLastName}
                  </Box>
                </TableCell>
                <TableCell sx={{ py: 2, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: 12, color: MUTED }}>{pr.currentRole || "—"}</Typography>
                    <Typography sx={{ fontSize: 11, color: MUTED }}>→</Typography>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: PURPLE }}>{pr.proposedRole}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ py: 2, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                  {pr.promotionEffective || "—"}
                </TableCell>
                <TableCell sx={{ py: 2, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <InlineChecklist
                    disabled={!isInProgress}
                    onToggle={(step, checked) => toggleStep(pr.id, step, checked)}
                    steps={[
                      { key: "recommendation_reviewed", label: "Recommendation Reviewed", done: pr.stepRecommendationReviewed },
                      { key: "performance_validated",   label: "Performance Validation",  done: pr.stepPerformanceValidated   },
                      { key: "leadership_approved",     label: "Leadership Approval",      done: pr.stepLeadershipApproved     },
                      { key: "compensation_reviewed",   label: "Compensation Review",      done: pr.stepCompensationReviewed   },
                    ]}
                  />
                </TableCell>
                <TableCell sx={{ py: 2, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <StatusChip status={pr.status} />
                </TableCell>
                <TableCell sx={{ py: 2, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>
                  {isInProgress && (
                    <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end" }}>
                      <Tooltip title={allDone ? "" : "Complete all checklist steps first"} arrow>
                        <span>
                          <Button size="small" variant="contained" disabled={!allDone || acting[pr.id]}
                            onClick={() => act(pr.id, "approve")}
                            sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                                  bgcolor: allDone ? SUCCESS : "#E2E8F0",
                                  color: allDone ? "#fff" : MUTED,
                                  "&:hover": allDone ? { bgcolor: "#15803D" } : {},
                                  minWidth: 0, px: 1.5 }}>
                            {acting[pr.id] ? "…" : "Approve"}
                          </Button>
                        </span>
                      </Tooltip>
                      <Button size="small" variant="outlined" disabled={acting[pr.id]}
                        onClick={() => act(pr.id, "reject")}
                        sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px",
                              borderColor: DANGER, color: DANGER, "&:hover": { bgcolor: DANGER_L }, minWidth: 0, px: 1.5 }}>
                        Reject
                      </Button>
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ─── Salary Reviews tab ───────────────────────────────────────────────────────

function SalaryReviewsTab({ loginId, data, onRefresh, onNavigate }) {
  const [acting,   setActing]   = useState({});
  const [stepping, setStepping] = useState({});

  async function act(id, endpoint) {
    setActing(a => ({ ...a, [id]: true }));
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/salary-reviews/${id}/${endpoint}?loginId=${loginId}`,
        { method: "POST", headers: authH() }
      );
      if (!res.ok) { alert(await res.text()); return; }
      onRefresh();
    } catch (e) { alert(e.message); }
    finally { setActing(a => ({ ...a, [id]: false })); }
  }

  async function toggleStep(id, step, checked) {
    setStepping(s => ({ ...s, [`${id}-${step}`]: true }));
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/salary-reviews/${id}/step?loginId=${loginId}`,
        { method: "PUT", headers: { ...authH(), "Content-Type": "application/json" },
          body: JSON.stringify({ step, checked }) }
      );
      if (!res.ok) { alert(await res.text()); return; }
      onRefresh();
    } catch (e) { alert(e.message); }
    finally { setStepping(s => ({ ...s, [`${id}-${step}`]: false })); }
  }

  if (data.length === 0) return (
    <Paper elevation={0} sx={{ ...CARD, p: 5, textAlign: "center" }}>
      <Typography sx={{ fontSize: 13, color: MUTED }}>
        No salary reviews yet. Click "+ New Salary Review" to start one.
      </Typography>
    </Paper>
  );

  return (
    <Paper elevation={0} sx={{ ...CARD, overflow: "hidden" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={thSx}>Employee</TableCell>
            <TableCell sx={thSx}>Current → Proposed Salary</TableCell>
            <TableCell sx={thSx}>Effective From</TableCell>
            <TableCell sx={thSx}>Checklist</TableCell>
            <TableCell sx={thSx}>Status</TableCell>
            <TableCell sx={{ ...thSx, textAlign: "right" }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(sr => {
            const allDone = sr.stepSalaryReviewed && sr.stepManagerProposed
                         && sr.stepFinanceApproved && sr.stepHrApproved;
            const isInProgress = sr.status === "IN_PROGRESS";
            const delta = sr.currentSalary != null && sr.proposedSalary != null
              ? ((Number(sr.proposedSalary) - Number(sr.currentSalary)) / Number(sr.currentSalary) * 100).toFixed(1)
              : null;
            return (
              <TableRow key={sr.id} sx={{ "&:last-child td": { borderBottom: 0 }, verticalAlign: "top" }}>
                <TableCell sx={{ py: 2, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <Box onClick={() => onNavigate(`/crm/employees/${sr.employeeId}`)}
                    sx={{ fontSize: 12.5, fontWeight: 600, color: ACCENT, cursor: "pointer",
                          "&:hover": { textDecoration: "underline" } }}>
                    {sr.employeeFirstName} {sr.employeeLastName}
                  </Box>
                </TableCell>
                <TableCell sx={{ py: 2, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: 12, color: MUTED }}>
                      {sr.currentSalary != null ? `$${Number(sr.currentSalary).toLocaleString()}` : "—"}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: MUTED }}>→</Typography>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: PURPLE }}>
                      ${Number(sr.proposedSalary).toLocaleString()}
                    </Typography>
                    {delta != null && (
                      <Box sx={{
                        fontSize: 10, fontWeight: 700, px: "5px", py: "1px", borderRadius: "4px",
                        bgcolor: delta >= 0 ? SUCCESS_L : DANGER_L,
                        color: delta >= 0 ? SUCCESS : DANGER,
                        border: `1px solid ${delta >= 0 ? "#BBF7D0" : "#FECACA"}`,
                      }}>
                        {delta >= 0 ? "+" : ""}{delta}%
                      </Box>
                    )}
                  </Box>
                </TableCell>
                <TableCell sx={{ py: 2, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                  {sr.effectiveFrom || "—"}
                </TableCell>
                <TableCell sx={{ py: 2, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <InlineChecklist
                    disabled={!isInProgress}
                    onToggle={(step, checked) => toggleStep(sr.id, step, checked)}
                    steps={[
                      { key: "salary_reviewed",  label: "Salary Review",    done: sr.stepSalaryReviewed  },
                      { key: "manager_proposed", label: "Manager Proposal", done: sr.stepManagerProposed },
                      { key: "finance_approved", label: "Finance Approval", done: sr.stepFinanceApproved },
                      { key: "hr_approved",      label: "HR Approval",      done: sr.stepHrApproved      },
                    ]}
                  />
                </TableCell>
                <TableCell sx={{ py: 2, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                  <StatusChip status={sr.status} />
                </TableCell>
                <TableCell sx={{ py: 2, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>
                  {isInProgress && (
                    <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end" }}>
                      <Tooltip title={allDone ? "" : "Complete all checklist steps first"} arrow>
                        <span>
                          <Button size="small" variant="contained" disabled={!allDone || acting[sr.id]}
                            onClick={() => act(sr.id, "approve")}
                            sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                                  bgcolor: allDone ? SUCCESS : "#E2E8F0",
                                  color: allDone ? "#fff" : MUTED,
                                  "&:hover": allDone ? { bgcolor: "#15803D" } : {},
                                  minWidth: 0, px: 1.5 }}>
                            {acting[sr.id] ? "…" : "Approve"}
                          </Button>
                        </span>
                      </Tooltip>
                      <Button size="small" variant="outlined" disabled={acting[sr.id]}
                        onClick={() => act(sr.id, "reject")}
                        sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px",
                              borderColor: DANGER, color: DANGER, "&:hover": { bgcolor: DANGER_L }, minWidth: 0, px: 1.5 }}>
                        Reject
                      </Button>
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

// ─── New Promotion Dialog ─────────────────────────────────────────────────────

function NewPromotionDialog({ open, onClose, loginId, employees, onCreated }) {
  const [form,     setForm]     = useState({ employeeId: "", proposedRole: "", promotionEffective: "", notes: "" });
  const [creating, setCreating] = useState(false);

  const selectedEmp = employees.find(e => e.id === form.employeeId);

  async function create() {
    if (!form.employeeId || !form.proposedRole.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${form.employeeId}/promotions?loginId=${loginId}`,
        { method: "POST", headers: { ...authH(), "Content-Type": "application/json" },
          body: JSON.stringify({
            proposedRole:       form.proposedRole.trim(),
            promotionEffective: form.promotionEffective || null,
            notes:              form.notes || null,
          }) }
      );
      if (!res.ok) { alert(await res.text()); return; }
      setForm({ employeeId: "", proposedRole: "", promotionEffective: "", notes: "" });
      onCreated();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 1 }}>New Promotion Review</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
        <TextField select size="small" label="Employee *" value={form.employeeId}
          onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} fullWidth>
          {employees.map(emp => (
            <MenuItem key={emp.id} value={emp.id} sx={{ fontSize: 13 }}>
              {emp.firstName} {emp.lastName}
              {emp.jobTitle ? ` — ${emp.jobTitle}` : ""}
            </MenuItem>
          ))}
        </TextField>
        {selectedEmp && (
          <TextField size="small" label="Current position" disabled
            value={selectedEmp.jobTitle || "Not set"} fullWidth />
        )}
        <TextField size="small" label="Proposed role *" value={form.proposedRole}
          onChange={e => setForm(f => ({ ...f, proposedRole: e.target.value }))} fullWidth />
        <TextField size="small" label="Promotion effective date" type="date" value={form.promotionEffective}
          onChange={e => setForm(f => ({ ...f, promotionEffective: e.target.value }))}
          fullWidth InputLabelProps={{ shrink: true }} />
        <TextField size="small" label="Notes (optional)" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
        <Button variant="contained" onClick={create}
          disabled={creating || !form.employeeId || !form.proposedRole.trim()}
          sx={{ fontSize: 12, textTransform: "none", bgcolor: PURPLE, boxShadow: "none", borderRadius: "8px",
                "&:hover": { bgcolor: "#6D28D9" } }}>
          {creating ? "Starting…" : "Start Review"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── New Salary Review Dialog ─────────────────────────────────────────────────

function NewSalaryReviewDialog({ open, onClose, loginId, employees, onCreated }) {
  const [form,     setForm]     = useState({ employeeId: "", proposedSalary: "", effectiveFrom: "", notes: "" });
  const [creating, setCreating] = useState(false);

  const selectedEmp = employees.find(e => e.id === form.employeeId);

  async function create() {
    if (!form.employeeId || !form.proposedSalary) return;
    setCreating(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${form.employeeId}/salary-reviews?loginId=${loginId}`,
        { method: "POST", headers: { ...authH(), "Content-Type": "application/json" },
          body: JSON.stringify({
            proposedSalary: parseFloat(form.proposedSalary),
            effectiveFrom:  form.effectiveFrom || null,
            notes:          form.notes || null,
          }) }
      );
      if (!res.ok) { alert(await res.text()); return; }
      setForm({ employeeId: "", proposedSalary: "", effectiveFrom: "", notes: "" });
      onCreated();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 1 }}>New Salary Review</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
        <TextField select size="small" label="Employee *" value={form.employeeId}
          onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} fullWidth>
          {employees.map(emp => (
            <MenuItem key={emp.id} value={emp.id} sx={{ fontSize: 13 }}>
              {emp.firstName} {emp.lastName}
              {emp.jobTitle ? ` — ${emp.jobTitle}` : ""}
            </MenuItem>
          ))}
        </TextField>
        {selectedEmp && (
          <TextField size="small" label="Current salary" disabled
            value={selectedEmp.salary != null ? `$${Number(selectedEmp.salary).toLocaleString()}` : "Not set"}
            fullWidth />
        )}
        <TextField size="small" label="Proposed salary *" type="number" value={form.proposedSalary}
          onChange={e => setForm(f => ({ ...f, proposedSalary: e.target.value }))} fullWidth
          helperText={
            form.proposedSalary && selectedEmp?.salary != null
              ? `${((parseFloat(form.proposedSalary) - selectedEmp.salary) / selectedEmp.salary * 100).toFixed(1)}% change`
              : ""
          } />
        <TextField size="small" label="Effective from" type="date" value={form.effectiveFrom}
          onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
          fullWidth InputLabelProps={{ shrink: true }} />
        <TextField size="small" label="Notes (optional)" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
        <Button variant="contained" onClick={create}
          disabled={creating || !form.employeeId || !form.proposedSalary}
          sx={{ fontSize: 12, textTransform: "none", bgcolor: PURPLE, boxShadow: "none", borderRadius: "8px",
                "&:hover": { bgcolor: "#6D28D9" } }}>
          {creating ? "Starting…" : "Start Review"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CrmWorkflowsPage() {
  const loginId = localStorage.getItem("loginId") || "";
  const nav = useNavigate();

  const [tab,          setTab]          = useState(0);
  const [promos,       setPromos]       = useState([]);
  const [salaries,     setSalaries]     = useState([]);
  const [employees,    setEmployees]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [newPromoDlg,  setNewPromoDlg]  = useState(false);
  const [newSalaryDlg, setNewSalaryDlg] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [pRes, sRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/promotions?loginId=${loginId}`, { headers: authH() }),
        fetch(`${API_BASE}/api/crm/salary-reviews?loginId=${loginId}`, { headers: authH() }),
        fetch(`${API_BASE}/api/crm/employees?loginId=${loginId}&status=ACTIVE`, { headers: authH() }),
      ]);
      if (!pRes.ok) throw new Error(`Promotions: ${pRes.status}`);
      if (!sRes.ok) throw new Error(`Salary Reviews: ${sRes.status}`);
      setPromos(await pRes.json());
      setSalaries(await sRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [loginId]);

  useEffect(() => { load(); }, [load]);

  const pendingPromos    = promos.filter(p => p.status === "IN_PROGRESS").length;
  const pendingSalaries  = salaries.filter(s => s.status === "IN_PROGRESS").length;
  const totalPending     = pendingPromos + pendingSalaries;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>HR Workflows</Typography>
            {totalPending > 0 && (
              <Box sx={{
                fontSize: 10, fontWeight: 700, color: WARN, bgcolor: WARN_L,
                border: `1px solid #FDE68A`, borderRadius: "20px", px: "8px", py: "2px",
              }}>{totalPending} in progress</Box>
            )}
          </Box>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Manage promotion and compensation review workflows across your team
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => tab === 0 ? setNewPromoDlg(true) : setNewSalaryDlg(true)}
          sx={{ bgcolor: PURPLE, textTransform: "none", fontWeight: 600, borderRadius: "8px",
                boxShadow: "none", "&:hover": { bgcolor: "#6D28D9" } }}>
          {tab === 0 ? "+ New Promotion" : "+ New Salary Review"}
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
        mb: 2.5, borderBottom: `1px solid ${BORDER}`,
        "& .MuiTab-root": { fontSize: 12.5, fontWeight: 600, textTransform: "none", minHeight: 40, color: MUTED },
        "& .Mui-selected": { color: PURPLE },
        "& .MuiTabs-indicator": { bgcolor: PURPLE },
      }}>
        <Tab label={`Promotions${pendingPromos > 0 ? ` (${pendingPromos})` : ""}`} />
        <Tab label={`Salary Reviews${pendingSalaries > 0 ? ` (${pendingSalaries})` : ""}`} />
      </Tabs>

      {loading ? (
        <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} sx={{ color: PURPLE }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>
      ) : tab === 0 ? (
        <PromotionsTab loginId={loginId} data={promos} onRefresh={load} onNavigate={nav} />
      ) : (
        <SalaryReviewsTab loginId={loginId} data={salaries} onRefresh={load} onNavigate={nav} />
      )}

      <NewPromotionDialog
        open={newPromoDlg}
        onClose={() => setNewPromoDlg(false)}
        loginId={loginId}
        employees={employees}
        onCreated={() => { setNewPromoDlg(false); load(); }}
      />
      <NewSalaryReviewDialog
        open={newSalaryDlg}
        onClose={() => setNewSalaryDlg(false)}
        loginId={loginId}
        employees={employees}
        onCreated={() => { setNewSalaryDlg(false); load(); }}
      />
    </Box>
  );
}
