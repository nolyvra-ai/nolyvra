import { useEffect, useRef, useState } from "react";
import {
  Box, Paper, Typography, Button, TextField, MenuItem,
  Select, FormControl, InputLabel, Alert, CircularProgress, Divider,
  Collapse, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const SURFACE  = "#FFFFFF";
const BORDER   = "#E8ECF2";
const MUTED    = "#8A94A6";
const TEXT     = "#0F1623";
const ACCENT   = "#1D72E8";
const PURPLE   = "#7C3AED";
const PURPLE_L  = "#F5F3FF";
const PURPLE_BR = "#C4B5FD";
const SUCCESS   = "#16A34A";
const SUCCESS_L = "#F0FDF4";
const WARN      = "#D97706";
const WARN_L    = "#FFFBEB";
const DANGER    = "#DC2626";
const DANGER_L  = "#FEF2F2";

const CARD_BASE = {
  bgcolor: SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: "12px", boxShadow: "0 1px 4px rgba(15,22,35,0.05)", overflow: "hidden",
};

function statusVariant(s) {
  if (!s) return { bg: "#F1F3F7", border: BORDER, color: MUTED };
  const v = s.toUpperCase();
  if (v === "ACTIVE")     return { bg: SUCCESS_L, border: "#BBF7D0", color: SUCCESS };
  if (v === "ONBOARDING") return { bg: WARN_L,    border: "#FDE68A", color: WARN    };
  if (v === "INACTIVE")   return { bg: DANGER_L,  border: "#FECACA", color: DANGER  };
  return { bg: "#F1F3F7", border: BORDER, color: MUTED };
}

function StatusBadge({ status }) {
  const s = statusVariant(status);
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: "20px",
      px: 1.5, py: "3px", fontSize: 12, fontWeight: 600, color: s.color,
    }}>{status}</Box>
  );
}

function Field({ label, value }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: value ? TEXT : MUTED }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}

export default function CrmEmployeeDetailPage() {
  const { id }  = useParams();
  const nav     = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  const [emp,         setEmp]         = useState(null);
  const [departments, setDepartments] = useState([]);
  const [employees,   setEmployees]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  const [editing,     setEditing]     = useState(false);
  const [form,        setForm]        = useState({});
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [empRes, deptRes, allEmpRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/employees/${id}?loginId=${loginId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        }),
        fetch(`${API_BASE}/api/crm/departments?loginId=${loginId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        }),
        fetch(`${API_BASE}/api/crm/employees?loginId=${loginId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        }),
      ]);
      if (!empRes.ok) throw new Error(`Employee: ${empRes.status}`);
      const empData = await empRes.json();
      setEmp(empData);
      setForm({
        firstName:      empData.firstName      || "",
        lastName:       empData.lastName       || "",
        email:          empData.email          || "",
        phone:          empData.phone          || "",
        jobTitle:       empData.jobTitle       || "",
        employmentType: empData.employmentType || "PERMANENT",
        status:         empData.status         || "ONBOARDING",
        managerId:      empData.managerId      || "",
        departmentId:   empData.departmentId   || "",
        startDate:      empData.startDate      || "",
        endDate:        empData.endDate        || "",
        salary:         empData.salary         != null ? String(empData.salary) : "",
      });
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (allEmpRes.ok) setEmployees((await allEmpRes.json()).filter(e => e.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function handleSave() {
    setSaving(true); setSaveError(null);
    try {
      const body = {
        firstName:      form.firstName      || null,
        lastName:       form.lastName       || null,
        email:          form.email          || null,
        phone:          form.phone          || null,
        jobTitle:       form.jobTitle       || null,
        employmentType: form.employmentType || null,
        status:         form.status         || null,
        managerId:      form.managerId      || null,
        departmentId:   form.departmentId   || null,
        startDate:      form.startDate      || null,
        endDate:        form.endDate        || null,
        salary:         form.salary !== "" ? parseFloat(form.salary) : null,
      };
      const res = await fetch(`${API_BASE}/api/crm/employees/${id}?loginId=${loginId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t || res.status); }
      setEditing(false);
      load();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return (
    <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
      <CircularProgress size={28} sx={{ color: PURPLE }} />
    </Box>
  );
  if (error) return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>
      <Button onClick={() => nav("/crm/employees")} sx={{ mt: 1.5, fontSize: 12, textTransform: "none", color: MUTED }}>
        ← Back to Employees
      </Button>
    </Box>
  );

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      {/* Breadcrumb */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2.5 }}>
        <Box onClick={() => nav("/crm/employees")} sx={{
          fontSize: 12.5, color: ACCENT, cursor: "pointer", fontWeight: 600,
          "&:hover": { textDecoration: "underline" },
        }}>← Employees</Box>
        <Typography sx={{ fontSize: 12.5, color: MUTED }}>/</Typography>
        <Typography sx={{ fontSize: 12.5, color: TEXT, fontWeight: 600 }}>
          {emp.firstName} {emp.lastName}
        </Typography>
      </Box>

      {/* Header card */}
      <Paper elevation={0} sx={{ ...CARD_BASE, p: 2.5, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
              <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>
                {emp.firstName} {emp.lastName}
              </Typography>
              <StatusBadge status={emp.status} />
            </Box>
            <Typography sx={{ fontSize: 13, color: MUTED }}>
              {emp.jobTitle || "No job title"} · {emp.email}
            </Typography>
            {emp.candidateId && (
              <Box sx={{ mt: 0.75 }}>
                <Box onClick={() => nav(`/analysis/${emp.candidateId}`)} sx={{
                  display: "inline-flex", alignItems: "center", gap: 0.75,
                  bgcolor: PURPLE_L, border: `1px solid ${PURPLE_BR}`, borderRadius: "20px",
                  px: 1.25, py: "2px", cursor: "pointer",
                  "&:hover": { bgcolor: "#EDE9FE" },
                }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: PURPLE }}>
                    From ATS candidate →
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            {editing ? (
              <>
                <Button onClick={() => { setEditing(false); setSaveError(null); }} disabled={saving}
                  sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
                <Button onClick={handleSave} disabled={saving} variant="contained" sx={{
                  fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
                  background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", boxShadow: "none",
                  "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
                }}>{saving ? "Saving…" : "Save"}</Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)} variant="outlined" size="small" sx={{
                fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
                borderColor: BORDER, color: TEXT,
                "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L },
              }}>Edit</Button>
            )}
          </Box>
        </Box>
      </Paper>

      {saveError && <Alert severity="error" sx={{ mb: 2, fontSize: 12 }}>{saveError}</Alert>}

      {/* Details card */}
      <Paper elevation={0} sx={{ ...CARD_BASE, mb: 2 }}>
        <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}` }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Employment Details</Typography>
        </Box>
        <Box sx={{ p: 2.5 }}>
          {editing ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField label="First name" value={form.firstName} onChange={e => f("firstName")(e.target.value)}
                  fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
                <TextField label="Last name" value={form.lastName} onChange={e => f("lastName")(e.target.value)}
                  fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
              </Box>
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField label="Email" value={form.email} onChange={e => f("email")(e.target.value)}
                  fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
                <TextField label="Phone" value={form.phone} onChange={e => f("phone")(e.target.value)}
                  fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
              </Box>
              <TextField label="Job title" value={form.jobTitle} onChange={e => f("jobTitle")(e.target.value)}
                fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: 13 }}>Employment type</InputLabel>
                  <Select value={form.employmentType} label="Employment type"
                    onChange={e => f("employmentType")(e.target.value)} sx={{ fontSize: 13 }}>
                    <MenuItem value="PERMANENT" sx={{ fontSize: 13 }}>Permanent</MenuItem>
                    <MenuItem value="CONTRACT"  sx={{ fontSize: 13 }}>Contract</MenuItem>
                    <MenuItem value="PLACED"    sx={{ fontSize: 13 }}>Placed</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: 13 }}>Status</InputLabel>
                  <Select value={form.status} label="Status"
                    onChange={e => f("status")(e.target.value)} sx={{ fontSize: 13 }}>
                    <MenuItem value="ONBOARDING" sx={{ fontSize: 13 }}>Onboarding</MenuItem>
                    <MenuItem value="ACTIVE"     sx={{ fontSize: 13 }}>Active</MenuItem>
                    <MenuItem value="INACTIVE"   sx={{ fontSize: 13 }}>Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: "flex", gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: 13 }}>Department</InputLabel>
                  <Select value={form.departmentId} label="Department"
                    onChange={e => f("departmentId")(e.target.value)} sx={{ fontSize: 13 }}>
                    <MenuItem value="" sx={{ fontSize: 13 }}>None</MenuItem>
                    {departments.map(d => (
                      <MenuItem key={d.id} value={d.id} sx={{ fontSize: 13 }}>{d.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel sx={{ fontSize: 13 }}>Manager</InputLabel>
                  <Select value={form.managerId} label="Manager"
                    onChange={e => f("managerId")(e.target.value)} sx={{ fontSize: 13 }}>
                    <MenuItem value="" sx={{ fontSize: 13 }}>None</MenuItem>
                    {employees.map(e => (
                      <MenuItem key={e.id} value={e.id} sx={{ fontSize: 13 }}>
                        {e.firstName} {e.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: "flex", gap: 2 }}>
                <TextField label="Start date" type="date" value={form.startDate}
                  onChange={e => f("startDate")(e.target.value)} size="small" fullWidth
                  InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }} InputProps={{ sx: { fontSize: 13 } }} />
                <TextField label="End date" type="date" value={form.endDate}
                  onChange={e => f("endDate")(e.target.value)} size="small" fullWidth
                  InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }} InputProps={{ sx: { fontSize: 13 } }} />
              </Box>
              <TextField label="Current salary" type="number" value={form.salary}
                onChange={e => f("salary")(e.target.value)} size="small" fullWidth
                helperText="Direct edit for initial setup. Use Salary Review workflow for formal changes."
                InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
            </Box>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
              <Field label="Email"          value={emp.email} />
              <Field label="Phone"          value={emp.phone} />
              <Field label="Job Title"      value={emp.jobTitle} />
              <Field label="Employment Type" value={emp.employmentType} />
              <Field label="Status"         value={emp.status} />
              <Field label="Department"     value={emp.departmentName} />
              <Field label="Manager"        value={emp.managerName} />
              <Field label="Start Date"     value={emp.startDate} />
              <Field label="End Date"       value={emp.endDate} />
              <Field label="Salary"         value={emp.salary != null ? `$${Number(emp.salary).toLocaleString()}` : null} />
              <Field label="Salary Effective" value={emp.salaryEffectiveFrom} />
              <Field label="Promotion Effective" value={emp.promotionEffective} />
            </Box>
          )}
        </Box>
      </Paper>

      {/* Onboarding card */}
      <OnboardingSection employeeId={id} loginId={loginId} employeeName={`${emp.firstName} ${emp.lastName}`} />

      {/* Leave entitlement card */}
      <Box sx={{ mt: 2 }}>
        <LeaveEntitlementSection employeeId={id} loginId={loginId} />
      </Box>

      {/* Promotion workflow card */}
      <Box sx={{ mt: 2 }}>
        <PromotionSection employeeId={id} loginId={loginId} currentRole={emp.jobTitle} />
      </Box>

      {/* Salary review workflow card */}
      <Box sx={{ mt: 2 }}>
        <SalaryReviewSection employeeId={id} loginId={loginId} currentSalary={emp.salary} />
      </Box>

      {/* Expense submissions card */}
      <Box sx={{ mt: 2 }}>
        <ExpenseSection employeeId={id} loginId={loginId} />
      </Box>

      {/* Grievance card */}
      <Box sx={{ mt: 2 }}>
        <GrievanceSection employeeId={id} loginId={loginId} />
      </Box>

      {/* Disciplinary card */}
      <Box sx={{ mt: 2 }}>
        <DisciplinarySection employeeId={id} loginId={loginId} />
      </Box>
    </Box>
  );
}

// ─── Onboarding Section ────────────────────────────────────────────────────

function OnboardingSection({ employeeId, loginId, employeeName }) {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };

  const [instance,     setInstance]     = useState(null);
  const [templates,    setTemplates]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [collapsedGrps, setCollapsed]  = useState({});

  // start dialog
  const [startOpen,    setStartOpen]    = useState(false);
  const [selectedTmpl, setSelectedTmpl] = useState("");
  const [starting,     setStarting]     = useState(false);
  const [startErr,     setStartErr]     = useState(null);

  // task update
  const [taskLoading, setTaskLoading]  = useState({});

  async function load() {
    setLoading(true); setError(null);
    try {
      const [instRes, tmplRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/employees/${employeeId}/onboarding?loginId=${loginId}`, { headers: authHeader }),
        fetch(`${API_BASE}/api/crm/onboarding/templates?loginId=${loginId}`, { headers: authHeader }),
      ]);
      if (instRes.ok) setInstance(await instRes.json());
      if (tmplRes.ok) {
        const tmpls = await tmplRes.json();
        setTemplates(tmpls);
        if (tmpls.length > 0) setSelectedTmpl(tmpls[0].id);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [employeeId]); // eslint-disable-line

  async function handleStart() {
    if (!selectedTmpl) return;
    setStarting(true); setStartErr(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${employeeId}/onboarding?loginId=${loginId}`,
        { method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ templateId: selectedTmpl }) }
      );
      if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t || res.status); }
      setStartOpen(false);
      load();
    } catch (e) { setStartErr(e.message); }
    finally { setStarting(false); }
  }

  async function handleTaskUpdate(taskId, status) {
    setTaskLoading(p => ({ ...p, [taskId]: true }));
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/tasks/${taskId}?loginId=${loginId}`,
        { method: "PUT", headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ status }) }
      );
      if (!res.ok) throw new Error(await res.text().catch(() => res.status));
      load();
    } catch (e) { setError(e.message); }
    finally { setTaskLoading(p => ({ ...p, [taskId]: false })); }
  }

  async function handleActivate() {
    if (!instance) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/onboarding/${instance.id}/activate?loginId=${loginId}`,
        { method: "POST", headers: authHeader }
      );
      if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t); }
      load();
    } catch (e) { setError(e.message); }
  }

  const toggleGroup = (seq) => setCollapsed(p => ({ ...p, [seq]: !p[seq] }));

  const allRequiredDone = instance &&
    instance.tasks.filter(t => t.isRequired).every(t => t.status === "COMPLETE");

  // group tasks by group
  const groups = instance
    ? [...new Map(instance.tasks.map(t => [t.groupSequence, { name: t.groupName, seq: t.groupSequence }])).values()]
        .sort((a, b) => a.seq - b.seq)
    : [];

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE }}>
      <Box sx={{
        px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Onboarding</Typography>
        {instance && instance.status === "IN_PROGRESS" && (
          <Button
            onClick={handleActivate}
            disabled={!allRequiredDone}
            size="small"
            variant="contained"
            sx={{
              fontSize: 11, fontWeight: 700, textTransform: "none", borderRadius: "7px",
              background: allRequiredDone
                ? "linear-gradient(135deg, #16A34A 0%, #15803D 100%)"
                : undefined,
              boxShadow: "none",
              "&:hover": { boxShadow: "none" },
            }}
          >
            Activate Employee ✓
          </Button>
        )}
      </Box>

      {loading ? (
        <Box sx={{ p: 3, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={20} sx={{ color: PURPLE }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ m: 2, fontSize: 12 }}>{error}</Alert>
      ) : !instance ? (
        <Box sx={{ p: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: 12.5, color: MUTED }}>
            No onboarding started yet for {employeeName}.
          </Typography>
          <Button onClick={() => { setStartErr(null); setStartOpen(true); }} size="small" sx={{
            fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
            background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
            color: "#fff", boxShadow: "none",
            "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
          }}>
            Start Onboarding
          </Button>
        </Box>
      ) : (
        <Box>
          {/* Overall progress */}
          <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}` }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography sx={{ fontSize: 12, color: MUTED }}>
                Overall — {instance.tasks.filter(t => t.isRequired && t.status === "COMPLETE").length} of{" "}
                {instance.tasks.filter(t => t.isRequired).length} required tasks complete
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                {instance.overdueCount > 0 && (
                  <Box sx={{
                    bgcolor: DANGER_L, border: "1px solid #FECACA", borderRadius: "20px",
                    px: 1.25, py: "1px", fontSize: 11, fontWeight: 700, color: DANGER,
                  }}>{instance.overdueCount} overdue</Box>
                )}
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: TEXT }}>
                  {Math.round(instance.overallProgressPct)}%
                </Typography>
              </Box>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(instance.overallProgressPct, 100)}
              sx={{
                height: 7, borderRadius: "4px", bgcolor: "#F0F2F6",
                "& .MuiLinearProgress-bar": {
                  borderRadius: "4px",
                  bgcolor: instance.overallProgressPct >= 100 ? SUCCESS : PURPLE,
                },
              }}
            />
          </Box>

          {/* Task groups */}
          {groups.map(g => {
            const gTasks = instance.tasks.filter(t => t.groupSequence === g.seq);
            const gRequired = gTasks.filter(t => t.isRequired).length;
            const gDone = gTasks.filter(t => t.isRequired && t.status === "COMPLETE").length;
            const gPct = gRequired === 0 ? 100 : Math.round(gDone / gRequired * 100);
            const isOpen = !collapsedGrps[g.seq];

            return (
              <Box key={g.seq} sx={{ borderBottom: `1px solid ${BORDER}` }}>
                {/* Group header */}
                <Box onClick={() => toggleGroup(g.seq)} sx={{
                  px: 2.5, py: 1.25, display: "flex", alignItems: "center",
                  justifyContent: "space-between", cursor: "pointer",
                  bgcolor: isOpen ? "#FAFBFD" : SURFACE,
                  "&:hover": { bgcolor: "#F5F7FA" },
                }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{g.name}</Typography>
                    <Typography sx={{ fontSize: 11, color: MUTED }}>{gDone}/{gRequired}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ width: 80, height: 5, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
                      <Box sx={{
                        width: `${gPct}%`, height: "100%", borderRadius: "3px",
                        bgcolor: gPct === 100 ? SUCCESS : PURPLE,
                        transition: "width 0.3s ease",
                      }} />
                    </Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: gPct === 100 ? SUCCESS : PURPLE }}>
                      {gPct}%
                    </Typography>
                    <Box sx={{ fontSize: 12, color: MUTED, transform: isOpen ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.2s" }}>▾</Box>
                  </Box>
                </Box>

                {/* Tasks */}
                <Collapse in={isOpen}>
                  {gTasks.sort((a, b) => a.sequence - b.sequence).map(task => {
                    const done    = task.status === "COMPLETE";
                    const skipped = task.status === "SKIPPED";
                    const overdue = task.isOverdue;
                    const busy    = taskLoading[task.id];

                    return (
                      <Box key={task.id} sx={{
                        px: 2.5, py: 1, display: "flex", alignItems: "center",
                        gap: 1.5, borderTop: `1px solid ${BORDER}`,
                        bgcolor: overdue ? "#FFFBEB" : done ? "#F0FDF4" : SURFACE,
                        opacity: skipped ? 0.55 : 1,
                      }}>
                        {/* checkbox circle */}
                        <Box onClick={() => !busy && !skipped && handleTaskUpdate(task.id, done ? "PENDING" : "COMPLETE")}
                          sx={{
                            width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                            border: `2px solid ${done ? SUCCESS : overdue ? DANGER : BORDER}`,
                            bgcolor: done ? SUCCESS : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: skipped ? "default" : "pointer",
                            "&:hover": !skipped && !busy ? { borderColor: done ? SUCCESS : PURPLE } : {},
                          }}>
                          {done && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                              stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{
                            fontSize: 12.5, color: done ? MUTED : TEXT,
                            textDecoration: done || skipped ? "line-through" : "none",
                            fontWeight: done ? 400 : 500,
                          }}>{task.name}</Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
                            {task.ownerRole && (
                              <Box sx={{
                                fontSize: 10, fontWeight: 600, color: MUTED,
                                bgcolor: "#F1F3F7", borderRadius: "4px", px: "5px", py: "1px",
                              }}>{task.ownerRole.replace("_", " ")}</Box>
                            )}
                            {task.dueDate && (
                              <Typography sx={{ fontSize: 11, color: overdue ? DANGER : MUTED }}>
                                {overdue ? "⚠ " : ""}Due {task.dueDate}
                              </Typography>
                            )}
                            {!task.isRequired && (
                              <Typography sx={{ fontSize: 10, color: MUTED }}>optional</Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Skip button (optional tasks only) */}
                        {!task.isRequired && !done && !skipped && (
                          <Box onClick={() => !busy && handleTaskUpdate(task.id, "SKIPPED")}
                            sx={{
                              fontSize: 11, color: MUTED, cursor: "pointer",
                              "&:hover": { color: TEXT },
                            }}>Skip</Box>
                        )}
                        {skipped && (
                          <Box onClick={() => !busy && handleTaskUpdate(task.id, "PENDING")}
                            sx={{ fontSize: 11, color: MUTED, cursor: "pointer", "&:hover": { color: TEXT } }}>
                            Undo
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Collapse>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Start Onboarding Dialog */}
      <Dialog open={startOpen} onClose={() => !starting && setStartOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: "14px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 0.5 }}>
          Start Onboarding
        </DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          {startErr && <Alert severity="error" sx={{ mb: 1.5, fontSize: 12 }}>{startErr}</Alert>}
          <Typography sx={{ fontSize: 12.5, color: MUTED, mb: 2 }}>
            Choose a template for <strong style={{ color: TEXT }}>{employeeName}</strong>.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: 13 }}>Template</InputLabel>
            <Select value={selectedTmpl} label="Template"
              onChange={e => setSelectedTmpl(e.target.value)} sx={{ fontSize: 13 }}>
              {templates.map(t => (
                <MenuItem key={t.id} value={t.id} sx={{ fontSize: 13 }}>
                  {t.name}{t.isDefault ? " (default)" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setStartOpen(false)} disabled={starting}
            sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button onClick={handleStart} disabled={starting || !selectedTmpl} variant="contained" sx={{
            fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
            background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", boxShadow: "none",
            "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
          }}>
            {starting ? "Starting…" : "Start Onboarding"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

// ─── Leave Entitlement Section ────────────────────────────────────────────────

function LeaveEntitlementSection({ employeeId, loginId }) {
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };
  const currentYear = new Date().getFullYear();

  const [balances,  setBalances]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editVal,   setEditVal]   = useState("");
  const [saving,    setSaving]    = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${employeeId}/leave-balance?loginId=${loginId}&year=${currentYear}`,
        { headers: authHeader }
      );
      if (!res.ok) throw new Error(`${res.status}`);
      setBalances(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [employeeId]); // eslint-disable-line

  async function saveBalance(leaveTypeId) {
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${employeeId}/leave-balance/${leaveTypeId}?loginId=${loginId}`,
        {
          method: "PUT",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ allocatedDays: parseFloat(editVal) || 0, year: currentYear }),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      load();
      setEditingId(null);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE }}>
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}` }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
          Leave Entitlement — {currentYear}
        </Typography>
      </Box>
      <Box sx={{ p: 2.5 }}>
        {loading ? (
          <CircularProgress size={18} sx={{ color: PURPLE }} />
        ) : error ? (
          <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {balances.map(b => {
              const pct = b.allocatedDays > 0
                ? Math.min((Number(b.usedDays) / Number(b.allocatedDays)) * 100, 100)
                : 0;
              const isOver = Number(b.usedDays) > Number(b.allocatedDays);
              const barColor = isOver ? DANGER : pct >= 80 ? WARN : b.leaveTypeColor || ACCENT;

              return (
                <Box key={b.leaveTypeId}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: b.leaveTypeColor, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>{b.leaveTypeName}</Typography>
                      {!b.isPaid && (
                        <Box sx={{ fontSize: 9.5, fontWeight: 600, color: MUTED, bgcolor: "#F1F3F7",
                                    borderRadius: "4px", px: "5px", py: "1px" }}>Unpaid</Box>
                      )}
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {editingId === b.leaveTypeId ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <TextField size="small" type="number" value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveBalance(b.leaveTypeId); if (e.key === "Escape") setEditingId(null); }}
                            sx={{ width: 70, "& .MuiInputBase-input": { fontSize: 12, py: "4px", textAlign: "center" } }} />
                          <Button size="small" onClick={() => saveBalance(b.leaveTypeId)} disabled={saving}
                            sx={{ fontSize: 11, textTransform: "none", borderRadius: "5px", minWidth: 0, px: 1,
                                  bgcolor: PURPLE, color: "#fff", "&:hover": { bgcolor: "#6D28D9" } }}>
                            {saving ? "…" : "Save"}
                          </Button>
                          <Button size="small" onClick={() => setEditingId(null)}
                            sx={{ fontSize: 11, textTransform: "none", color: MUTED, minWidth: 0 }}>×</Button>
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Typography sx={{ fontSize: 12, color: MUTED }}>
                            {Number(b.usedDays)}d used /
                          </Typography>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT }}>
                            {Number(b.allocatedDays)}d allocated
                          </Typography>
                          <Box onClick={() => { setEditingId(b.leaveTypeId); setEditVal(String(b.allocatedDays)); }}
                            sx={{ ml: 0.5, cursor: "pointer", color: MUTED, display: "flex", alignItems: "center",
                                  "&:hover": { color: ACCENT } }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ flex: 1, height: 6, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
                      <Box sx={{
                        width: `${pct}%`, height: "100%", bgcolor: barColor,
                        borderRadius: "3px", transition: "width 0.4s ease",
                      }} />
                    </Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: isOver ? DANGER : SUCCESS, minWidth: 60, textAlign: "right" }}>
                      {isOver ? `${Number(b.usedDays) - Number(b.allocatedDays)}d over` : `${Number(b.remainingDays)}d left`}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
            {balances.length === 0 && (
              <Typography sx={{ fontSize: 12.5, color: MUTED }}>
                No leave types configured. Add leave types from the Leave Management page.
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
}

// ─── Shared checklist step component ─────────────────────────────────────────

function ChecklistStep({ label, done, onToggle, disabled }) {
  return (
    <Box onClick={() => !disabled && onToggle(!done)} sx={{
      display: "flex", alignItems: "center", gap: 1.5, py: 1,
      cursor: disabled ? "default" : "pointer",
      "&:hover": disabled ? {} : { bgcolor: "#FAFBFD" },
      borderRadius: "6px", px: 1, mx: -1, transition: "background .15s",
    }}>
      <Box sx={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
        bgcolor: done ? SUCCESS : "transparent",
        border: `2px solid ${done ? SUCCESS : BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all .2s",
      }}>
        {done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </Box>
      <Typography sx={{
        fontSize: 12.5, color: done ? MUTED : TEXT, fontWeight: done ? 400 : 500,
        textDecoration: done ? "line-through" : "none", transition: "all .2s",
      }}>
        {label}
      </Typography>
    </Box>
  );
}

// ─── Promotion Section ────────────────────────────────────────────────────────

function PromotionSection({ employeeId, loginId, currentRole }) {
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };

  const [promotions, setPromotions] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showNew,    setShowNew]    = useState(false);
  const [form,       setForm]       = useState({ proposedRole: "", promotionEffective: "", notes: "" });
  const [creating,   setCreating]   = useState(false);
  const [stepping,   setStepping]   = useState({});
  const [acting,     setActing]     = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${employeeId}/promotions?loginId=${loginId}`,
        { headers: authHeader }
      );
      if (res.ok) setPromotions(await res.json());
    } catch (_) {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [employeeId]); // eslint-disable-line

  const active = promotions.find(p => p.status === "IN_PROGRESS");

  async function create() {
    if (!form.proposedRole.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${employeeId}/promotions?loginId=${loginId}`,
        { method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ proposedRole: form.proposedRole.trim(),
            promotionEffective: form.promotionEffective || null, notes: form.notes || null }) }
      );
      if (!res.ok) { alert(await res.text()); return; }
      setShowNew(false);
      setForm({ proposedRole: "", promotionEffective: "", notes: "" });
      load();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function toggleStep(id, step, checked) {
    setStepping(s => ({ ...s, [step]: true }));
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/promotions/${id}/step?loginId=${loginId}`,
        { method: "PUT", headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ step, checked }) }
      );
      if (!res.ok) { alert(await res.text()); return; }
      load();
    } catch (e) { alert(e.message); }
    finally { setStepping(s => ({ ...s, [step]: false })); }
  }

  async function approve(id) {
    setActing(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/promotions/${id}/approve?loginId=${loginId}`,
        { method: "POST", headers: authHeader }
      );
      if (!res.ok) { alert(await res.text()); return; }
      load();
    } catch (e) { alert(e.message); }
    finally { setActing(false); }
  }

  async function reject(id) {
    if (!window.confirm("Reject this promotion request?")) return;
    setActing(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/promotions/${id}/reject?loginId=${loginId}`,
        { method: "POST", headers: authHeader }
      );
      if (!res.ok) { alert(await res.text()); return; }
      load();
    } catch (e) { alert(e.message); }
    finally { setActing(false); }
  }

  const allDone = active && active.stepRecommendationReviewed && active.stepPerformanceValidated
               && active.stepLeadershipApproved && active.stepCompensationReviewed;

  const PROMO_STEPS = active ? [
    { key: "recommendation_reviewed", label: "Recommendation Reviewed", done: active.stepRecommendationReviewed },
    { key: "performance_validated",   label: "Performance Validation",   done: active.stepPerformanceValidated   },
    { key: "leadership_approved",     label: "Leadership Approval",       done: active.stepLeadershipApproved     },
    { key: "compensation_reviewed",   label: "Compensation Review",       done: active.stepCompensationReviewed   },
  ] : [];

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE }}>
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Promotion Workflow</Typography>
        {!active && !showNew && (
          <Button size="small" variant="outlined" onClick={() => setShowNew(true)} sx={{
            fontSize: 11, fontWeight: 600, textTransform: "none", borderRadius: "7px",
            borderColor: BORDER, color: TEXT,
            "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L },
          }}>+ Start Promotion Review</Button>
        )}
        {active && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" variant="contained" disabled={!allDone || acting}
              onClick={() => approve(active.id)}
              sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                    bgcolor: allDone ? SUCCESS : "#E2E8F0", color: allDone ? "#fff" : MUTED,
                    "&:hover": allDone ? { bgcolor: "#15803D" } : {} }}>
              {acting ? "…" : "Approve Promotion ✓"}
            </Button>
            <Button size="small" variant="outlined" disabled={acting} onClick={() => reject(active.id)}
              sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px",
                    borderColor: DANGER, color: DANGER, "&:hover": { bgcolor: DANGER_L } }}>
              Reject
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ p: 2.5 }}>
        {loading ? <CircularProgress size={16} sx={{ color: PURPLE }} /> : (
          <>
            {showNew && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#F7F9FC", borderRadius: "8px", border: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, mb: 1.5 }}>New Promotion Review</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <TextField size="small" label="Proposed role" value={form.proposedRole}
                    onChange={e => setForm(f => ({ ...f, proposedRole: e.target.value }))}
                    fullWidth sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <TextField size="small" label="Promotion effective date" type="date"
                    value={form.promotionEffective} onChange={e => setForm(f => ({ ...f, promotionEffective: e.target.value }))}
                    fullWidth InputLabelProps={{ shrink: true }} sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <TextField size="small" label="Notes (optional)" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    fullWidth multiline rows={2} sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button size="small" variant="contained" onClick={create} disabled={creating || !form.proposedRole.trim()}
                      sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                            bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" } }}>
                      {creating ? "Starting…" : "Start Review"}
                    </Button>
                    <Button size="small" onClick={() => setShowNew(false)}
                      sx={{ fontSize: 11, textTransform: "none", color: MUTED }}>Cancel</Button>
                  </Box>
                </Box>
              </Box>
            )}
            {active ? (
              <Box>
                <Box sx={{ display: "flex", gap: 3, mb: 1.5, flexWrap: "wrap" }}>
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.25 }}>Current Role</Typography>
                    <Typography sx={{ fontSize: 13, color: MUTED }}>{active.currentRole || currentRole || "—"}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.25 }}>→ Proposed Role</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, color: PURPLE }}>{active.proposedRole}</Typography>
                  </Box>
                  {active.promotionEffective && (
                    <Box>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.25 }}>Effective</Typography>
                      <Typography sx={{ fontSize: 13, color: TEXT }}>{active.promotionEffective}</Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ borderTop: `1px solid ${BORDER}`, pt: 1.5 }}>
                  {PROMO_STEPS.map(s => (
                    <ChecklistStep key={s.key} label={s.label} done={s.done}
                      disabled={!!stepping[s.key]}
                      onToggle={checked => toggleStep(active.id, s.key, checked)} />
                  ))}
                </Box>
              </Box>
            ) : !showNew ? (
              <Typography sx={{ fontSize: 12.5, color: MUTED }}>
                No active promotion review. Click "Start Promotion Review" to begin.
              </Typography>
            ) : null}
            {promotions.filter(p => p.status !== "IN_PROGRESS").length > 0 && (
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 1 }}>History</Typography>
                {promotions.filter(p => p.status !== "IN_PROGRESS").map(p => (
                  <Box key={p.id} sx={{ display: "flex", alignItems: "center", gap: 2, py: 0.75 }}>
                    <Box sx={{
                      fontSize: 9.5, fontWeight: 700, px: "6px", py: "1px", borderRadius: "4px",
                      bgcolor: p.status === "APPROVED" ? SUCCESS_L : DANGER_L,
                      color: p.status === "APPROVED" ? SUCCESS : DANGER,
                      border: `1px solid ${p.status === "APPROVED" ? "#BBF7D0" : "#FECACA"}`,
                    }}>{p.status}</Box>
                    <Typography sx={{ fontSize: 12, color: MUTED }}>
                      {p.currentRole || "—"} → <strong style={{ color: TEXT }}>{p.proposedRole}</strong>
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}

// ─── Salary Review Section ────────────────────────────────────────────────────

function SalaryReviewSection({ employeeId, loginId, currentSalary }) {
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };

  const [reviews,  setReviews]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showNew,  setShowNew]  = useState(false);
  const [form,     setForm]     = useState({ proposedSalary: "", effectiveFrom: "", notes: "" });
  const [creating, setCreating] = useState(false);
  const [stepping, setStepping] = useState({});
  const [acting,   setActing]   = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${employeeId}/salary-reviews?loginId=${loginId}`,
        { headers: authHeader }
      );
      if (res.ok) setReviews(await res.json());
    } catch (_) {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [employeeId]); // eslint-disable-line

  const active = reviews.find(r => r.status === "IN_PROGRESS");

  async function create() {
    if (!form.proposedSalary) return;
    setCreating(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${employeeId}/salary-reviews?loginId=${loginId}`,
        { method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ proposedSalary: parseFloat(form.proposedSalary),
            effectiveFrom: form.effectiveFrom || null, notes: form.notes || null }) }
      );
      if (!res.ok) { alert(await res.text()); return; }
      setShowNew(false);
      setForm({ proposedSalary: "", effectiveFrom: "", notes: "" });
      load();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function toggleStep(id, step, checked) {
    setStepping(s => ({ ...s, [step]: true }));
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/salary-reviews/${id}/step?loginId=${loginId}`,
        { method: "PUT", headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ step, checked }) }
      );
      if (!res.ok) { alert(await res.text()); return; }
      load();
    } catch (e) { alert(e.message); }
    finally { setStepping(s => ({ ...s, [step]: false })); }
  }

  async function approve(id) {
    setActing(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/salary-reviews/${id}/approve?loginId=${loginId}`,
        { method: "POST", headers: authHeader }
      );
      if (!res.ok) { alert(await res.text()); return; }
      load();
    } catch (e) { alert(e.message); }
    finally { setActing(false); }
  }

  async function reject(id) {
    if (!window.confirm("Reject this salary review?")) return;
    setActing(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/salary-reviews/${id}/reject?loginId=${loginId}`,
        { method: "POST", headers: authHeader }
      );
      if (!res.ok) { alert(await res.text()); return; }
      load();
    } catch (e) { alert(e.message); }
    finally { setActing(false); }
  }

  const allDone = active && active.stepSalaryReviewed && active.stepManagerProposed
               && active.stepFinanceApproved && active.stepHrApproved;

  const delta = active && active.currentSalary != null
    ? ((active.proposedSalary - active.currentSalary) / active.currentSalary * 100).toFixed(1)
    : null;

  const SAL_STEPS = active ? [
    { key: "salary_reviewed",  label: "Salary Review",    done: active.stepSalaryReviewed  },
    { key: "manager_proposed", label: "Manager Proposal", done: active.stepManagerProposed },
    { key: "finance_approved", label: "Finance Approval", done: active.stepFinanceApproved },
    { key: "hr_approved",      label: "HR Approval",      done: active.stepHrApproved      },
  ] : [];

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE }}>
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Salary Review</Typography>
        {!active && !showNew && (
          <Button size="small" variant="outlined" onClick={() => setShowNew(true)} sx={{
            fontSize: 11, fontWeight: 600, textTransform: "none", borderRadius: "7px",
            borderColor: BORDER, color: TEXT,
            "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L },
          }}>+ Start Salary Review</Button>
        )}
        {active && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" variant="contained" disabled={!allDone || acting}
              onClick={() => approve(active.id)}
              sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                    bgcolor: allDone ? SUCCESS : "#E2E8F0", color: allDone ? "#fff" : MUTED,
                    "&:hover": allDone ? { bgcolor: "#15803D" } : {} }}>
              {acting ? "…" : "Approve & Update Salary ✓"}
            </Button>
            <Button size="small" variant="outlined" disabled={acting} onClick={() => reject(active.id)}
              sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px",
                    borderColor: DANGER, color: DANGER, "&:hover": { bgcolor: DANGER_L } }}>
              Reject
            </Button>
          </Box>
        )}
      </Box>

      <Box sx={{ p: 2.5 }}>
        {loading ? <CircularProgress size={16} sx={{ color: PURPLE }} /> : (
          <>
            {showNew && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#F7F9FC", borderRadius: "8px", border: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, mb: 1.5 }}>New Salary Review</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    <TextField size="small" label="Current salary" disabled fullWidth
                      value={currentSalary != null ? `$${Number(currentSalary).toLocaleString()}` : "Not set"}
                      sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                    <TextField size="small" label="Proposed salary" type="number" value={form.proposedSalary}
                      onChange={e => setForm(f => ({ ...f, proposedSalary: e.target.value }))}
                      fullWidth sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  </Box>
                  <TextField size="small" label="Effective from" type="date" value={form.effectiveFrom}
                    onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                    fullWidth InputLabelProps={{ shrink: true }} sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <TextField size="small" label="Notes (optional)" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    fullWidth multiline rows={2} sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button size="small" variant="contained" onClick={create} disabled={creating || !form.proposedSalary}
                      sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                            bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" } }}>
                      {creating ? "Starting…" : "Start Review"}
                    </Button>
                    <Button size="small" onClick={() => setShowNew(false)}
                      sx={{ fontSize: 11, textTransform: "none", color: MUTED }}>Cancel</Button>
                  </Box>
                </Box>
              </Box>
            )}
            {active ? (
              <Box>
                <Box sx={{ display: "flex", gap: 3, mb: 1.5, flexWrap: "wrap" }}>
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.25 }}>Current Salary</Typography>
                    <Typography sx={{ fontSize: 13, color: MUTED }}>
                      {active.currentSalary != null ? `$${Number(active.currentSalary).toLocaleString()}` : "Not set"}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.25 }}>→ Proposed Salary</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: PURPLE }}>
                        ${Number(active.proposedSalary).toLocaleString()}
                      </Typography>
                      {delta != null && (
                        <Box sx={{
                          fontSize: 10, fontWeight: 700, px: "5px", py: "1px", borderRadius: "4px",
                          bgcolor: delta >= 0 ? SUCCESS_L : DANGER_L,
                          color: delta >= 0 ? SUCCESS : DANGER,
                          border: `1px solid ${delta >= 0 ? "#BBF7D0" : "#FECACA"}`,
                        }}>{delta >= 0 ? "+" : ""}{delta}%</Box>
                      )}
                    </Box>
                  </Box>
                  {active.effectiveFrom && (
                    <Box>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.25 }}>Effective From</Typography>
                      <Typography sx={{ fontSize: 13, color: TEXT }}>{active.effectiveFrom}</Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ borderTop: `1px solid ${BORDER}`, pt: 1.5 }}>
                  {SAL_STEPS.map(s => (
                    <ChecklistStep key={s.key} label={s.label} done={s.done}
                      disabled={!!stepping[s.key]}
                      onToggle={checked => toggleStep(active.id, s.key, checked)} />
                  ))}
                </Box>
              </Box>
            ) : !showNew ? (
              <Typography sx={{ fontSize: 12.5, color: MUTED }}>
                No active salary review. Click "Start Salary Review" to begin.
              </Typography>
            ) : null}
            {reviews.filter(r => r.status !== "IN_PROGRESS").length > 0 && (
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 1 }}>History</Typography>
                {reviews.filter(r => r.status !== "IN_PROGRESS").map(r => (
                  <Box key={r.id} sx={{ display: "flex", alignItems: "center", gap: 2, py: 0.75 }}>
                    <Box sx={{
                      fontSize: 9.5, fontWeight: 700, px: "6px", py: "1px", borderRadius: "4px",
                      bgcolor: r.status === "APPROVED" ? SUCCESS_L : DANGER_L,
                      color: r.status === "APPROVED" ? SUCCESS : DANGER,
                      border: `1px solid ${r.status === "APPROVED" ? "#BBF7D0" : "#FECACA"}`,
                    }}>{r.status}</Box>
                    <Typography sx={{ fontSize: 12, color: MUTED }}>
                      {r.currentSalary != null ? `$${Number(r.currentSalary).toLocaleString()}` : "—"} →{" "}
                      <strong style={{ color: TEXT }}>${Number(r.proposedSalary).toLocaleString()}</strong>
                      {r.effectiveFrom && <span style={{ color: MUTED }}> (from {r.effectiveFrom})</span>}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}

// ─── Expense Section ──────────────────────────────────────────────────────────

function ExpenseSection({ employeeId, loginId }) {
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };
  const [expenses,  setExpenses]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showNew,   setShowNew]   = useState(false);
  const [form,      setForm]      = useState({ title: "", amount: "", category: "", expenseDate: "", notes: "" });
  const [receipt,   setReceipt]   = useState(null);
  const [creating,  setCreating]  = useState(false);
  const [stepping,  setStepping]  = useState({});
  const fileRef = useRef(null);

  const EXP_STEPS = [
    { key: "finance_reviewed", label: "Finance Review" },
    { key: "approved",         label: "Approval"       },
    { key: "payment_made",     label: "Payment Made"   },
    { key: "closed",           label: "Closed"         },
  ];

  function camelStep(key) {
    return "step" + key.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("");
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm/employees/${employeeId}/expenses?loginId=${loginId}`, { headers: authHeader });
      if (res.ok) setExpenses(await res.json());
    } catch (_) {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [employeeId]); // eslint-disable-line

  const active = expenses.find(e => e.status === "IN_PROGRESS");

  async function create() {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append("loginId", loginId);
      fd.append("title",   form.title.trim());
      if (form.amount)      fd.append("amount",      form.amount);
      if (form.category)    fd.append("category",    form.category);
      if (form.expenseDate) fd.append("expenseDate", form.expenseDate);
      if (form.notes)       fd.append("notes",       form.notes);
      if (receipt)          fd.append("receipt",     receipt);
      const res = await fetch(`${API_BASE}/api/crm/employees/${employeeId}/expenses`,
        { method: "POST", headers: { Authorization: authHeader.Authorization }, body: fd });
      if (!res.ok) { alert(await res.text()); return; }
      setShowNew(false);
      setForm({ title: "", amount: "", category: "", expenseDate: "", notes: "" });
      setReceipt(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function toggleStep(id, step, checked) {
    setStepping(s => ({ ...s, [step]: true }));
    try {
      await fetch(`${API_BASE}/api/crm/expenses/${id}/step?loginId=${loginId}`,
        { method: "PUT", headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ step, checked }) });
      load();
    } catch (e) { alert(e.message); }
    finally { setStepping(s => ({ ...s, [step]: false })); }
  }

  async function approve(id) {
    try {
      const res = await fetch(`${API_BASE}/api/crm/expenses/${id}/approve?loginId=${loginId}`,
        { method: "POST", headers: authHeader });
      if (!res.ok) { alert(await res.text()); return; }
      load();
    } catch (e) { alert(e.message); }
  }

  const allDone = active && EXP_STEPS.every(s => active[camelStep(s.key)]);

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE }}>
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Expense Submissions</Typography>
        {!showNew && (
          <Button size="small" variant="outlined" onClick={() => setShowNew(true)} sx={{
            fontSize: 11, fontWeight: 600, textTransform: "none", borderRadius: "7px",
            borderColor: BORDER, color: TEXT, "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L },
          }}>+ Submit Expense</Button>
        )}
      </Box>
      <Box sx={{ p: 2.5 }}>
        {loading ? <CircularProgress size={16} sx={{ color: PURPLE }} /> : (
          <>
            {showNew && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#F7F9FC", borderRadius: "8px", border: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, mb: 1.5 }}>New Expense</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <TextField size="small" label="Title *" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} fullWidth
                    sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <Box sx={{ display: "flex", gap: 1.5 }}>
                    <TextField size="small" label="Amount" type="number" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} fullWidth
                      sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                    <TextField size="small" label="Category" value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))} fullWidth
                      sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  </Box>
                  <TextField size="small" label="Expense date" type="date" value={form.expenseDate}
                    onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
                    fullWidth InputLabelProps={{ shrink: true }} sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <TextField size="small" label="Notes" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2}
                    sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <Box>
                    <input type="file" ref={fileRef} style={{ display: "none" }}
                      onChange={e => setReceipt(e.target.files[0] || null)} />
                    <Button size="small" variant="outlined" onClick={() => fileRef.current?.click()} sx={{
                      fontSize: 11, textTransform: "none", borderRadius: "7px", borderColor: BORDER, color: TEXT,
                    }}>{receipt ? `📎 ${receipt.name}` : "Attach receipt"}</Button>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button size="small" variant="contained" onClick={create}
                      disabled={creating || !form.title.trim()}
                      sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                            bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" } }}>
                      {creating ? "Submitting…" : "Submit"}
                    </Button>
                    <Button size="small" onClick={() => setShowNew(false)}
                      sx={{ fontSize: 11, textTransform: "none", color: MUTED }}>Cancel</Button>
                  </Box>
                </Box>
              </Box>
            )}
            {active ? (
              <Box>
                <Box sx={{ display: "flex", gap: 3, mb: 1.5, flexWrap: "wrap" }}>
                  <Box>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.25 }}>Title</Typography>
                    <Typography sx={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{active.title}</Typography>
                  </Box>
                  {active.amount != null && (
                    <Box>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.25 }}>Amount</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: PURPLE }}>${Number(active.amount).toLocaleString()}</Typography>
                    </Box>
                  )}
                  {active.category && (
                    <Box>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 0.25 }}>Category</Typography>
                      <Typography sx={{ fontSize: 13, color: TEXT }}>{active.category}</Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ borderTop: `1px solid ${BORDER}`, pt: 1.5, mb: 1.5 }}>
                  {EXP_STEPS.map(s => (
                    <ChecklistStep key={s.key} label={s.label} done={active[camelStep(s.key)]}
                      disabled={!!stepping[s.key]}
                      onToggle={checked => toggleStep(active.id, s.key, checked)} />
                  ))}
                </Box>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Button size="small" variant="contained" disabled={!allDone} onClick={() => approve(active.id)}
                    sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                          bgcolor: allDone ? SUCCESS : "#E2E8F0", color: allDone ? "#fff" : MUTED,
                          "&:hover": allDone ? { bgcolor: "#15803D" } : {} }}>
                    Approve & Close ✓
                  </Button>
                  {active.receiptName && (
                    <Button size="small" component="a"
                      href={`${API_BASE}/api/crm/expenses/${active.id}/receipt?loginId=${loginId}`}
                      sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", px: 1,
                            color: PURPLE, border: `1px solid ${PURPLE}`, "&:hover": { bgcolor: PURPLE_L } }}>
                      ⬇ {active.receiptName}
                    </Button>
                  )}
                </Box>
              </Box>
            ) : !showNew ? (
              <Typography sx={{ fontSize: 12.5, color: MUTED }}>No active expense submission.</Typography>
            ) : null}
            {expenses.filter(e => e.status !== "IN_PROGRESS").length > 0 && (
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 1 }}>History</Typography>
                {expenses.filter(e => e.status !== "IN_PROGRESS").map(e => (
                  <Box key={e.id} sx={{ display: "flex", alignItems: "center", gap: 2, py: 0.75 }}>
                    <Box sx={{
                      fontSize: 9.5, fontWeight: 700, px: "6px", py: "1px", borderRadius: "4px",
                      bgcolor: e.status === "APPROVED" ? SUCCESS_L : DANGER_L,
                      color: e.status === "APPROVED" ? SUCCESS : DANGER,
                      border: `1px solid ${e.status === "APPROVED" ? "#BBF7D0" : "#FECACA"}`,
                    }}>{e.status}</Box>
                    <Typography sx={{ fontSize: 12, color: MUTED }}>
                      <strong style={{ color: TEXT }}>{e.title}</strong>
                      {e.amount != null && ` — $${Number(e.amount).toLocaleString()}`}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}

// ─── Grievance Section ────────────────────────────────────────────────────────

function GrievanceSection({ employeeId, loginId }) {
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };
  const [grievances, setGrievances] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showNew,    setShowNew]    = useState(false);
  const [form,       setForm]       = useState({ title: "", description: "" });
  const [complaint,  setComplaint]  = useState(null);
  const [creating,   setCreating]   = useState(false);
  const [stepping,   setStepping]   = useState({});
  const [resolving,  setResolving]  = useState(false);
  const [resNotes,   setResNotes]   = useState("");
  const fileRef = useRef(null);

  const GRV_STAGES = [
    { key: "investigated", label: "Investigation" },
    { key: "hr_reviewed",  label: "HR Review"     },
    { key: "resolved",     label: "Resolution"    },
    { key: "closed",       label: "Closure"       },
  ];

  function camelStep(key) {
    return "step" + key.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("");
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm/employees/${employeeId}/grievances?loginId=${loginId}`, { headers: authHeader });
      if (res.ok) setGrievances(await res.json());
    } catch (_) {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [employeeId]); // eslint-disable-line

  const active = grievances.find(g => g.status === "IN_PROGRESS");
  const allDone = active && GRV_STAGES.every(s => active[camelStep(s.key)]);

  async function create() {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append("loginId", loginId);
      fd.append("title",   form.title.trim());
      if (form.description) fd.append("description", form.description);
      if (complaint)        fd.append("complaint",   complaint);
      const res = await fetch(`${API_BASE}/api/crm/employees/${employeeId}/grievances`,
        { method: "POST", headers: { Authorization: authHeader.Authorization }, body: fd });
      if (!res.ok) { alert(await res.text()); return; }
      setShowNew(false);
      setForm({ title: "", description: "" });
      setComplaint(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function toggleStep(id, step, checked) {
    setStepping(s => ({ ...s, [step]: true }));
    try {
      await fetch(`${API_BASE}/api/crm/grievances/${id}/step?loginId=${loginId}`,
        { method: "PUT", headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ step, checked }) });
      load();
    } catch (e) { alert(e.message); }
    finally { setStepping(s => ({ ...s, [step]: false })); }
  }

  async function resolve(id) {
    setResolving(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/crm/grievances/${id}/resolve?loginId=${loginId}&resolutionNotes=${encodeURIComponent(resNotes)}`,
        { method: "POST", headers: authHeader });
      if (!res.ok) { alert(await res.text()); return; }
      setResNotes("");
      load();
    } catch (e) { alert(e.message); }
    finally { setResolving(false); }
  }

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE }}>
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Grievances</Typography>
        {!active && !showNew && (
          <Button size="small" variant="outlined" onClick={() => setShowNew(true)} sx={{
            fontSize: 11, fontWeight: 600, textTransform: "none", borderRadius: "7px",
            borderColor: BORDER, color: TEXT, "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L },
          }}>+ Raise Grievance</Button>
        )}
      </Box>
      <Box sx={{ p: 2.5 }}>
        {loading ? <CircularProgress size={16} sx={{ color: PURPLE }} /> : (
          <>
            {showNew && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#F7F9FC", borderRadius: "8px", border: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, mb: 1.5 }}>New Grievance</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <TextField size="small" label="Title *" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} fullWidth
                    sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <TextField size="small" label="Description" value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))} fullWidth multiline rows={2}
                    sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <Box>
                    <input type="file" ref={fileRef} style={{ display: "none" }}
                      onChange={e => setComplaint(e.target.files[0] || null)} />
                    <Button size="small" variant="outlined" onClick={() => fileRef.current?.click()} sx={{
                      fontSize: 11, textTransform: "none", borderRadius: "7px", borderColor: BORDER, color: TEXT,
                    }}>{complaint ? `📎 ${complaint.name}` : "Attach complaint doc"}</Button>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button size="small" variant="contained" onClick={create}
                      disabled={creating || !form.title.trim()}
                      sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                            bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" } }}>
                      {creating ? "Raising…" : "Raise"}
                    </Button>
                    <Button size="small" onClick={() => setShowNew(false)}
                      sx={{ fontSize: 11, textTransform: "none", color: MUTED }}>Cancel</Button>
                  </Box>
                </Box>
              </Box>
            )}
            {active ? (
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 500, color: TEXT, mb: 0.5 }}>{active.title}</Typography>
                {active.description && <Typography sx={{ fontSize: 12, color: MUTED, mb: 1.5 }}>{active.description}</Typography>}
                <Box sx={{ borderTop: `1px solid ${BORDER}`, pt: 1.5, mb: 1.5 }}>
                  {GRV_STAGES.map(s => (
                    <ChecklistStep key={s.key} label={s.label} done={active[camelStep(s.key)]}
                      disabled={!!stepping[s.key]}
                      onToggle={checked => toggleStep(active.id, s.key, checked)} />
                  ))}
                </Box>
                {allDone && (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <TextField size="small" label="Resolution notes (optional)" value={resNotes}
                      onChange={e => setResNotes(e.target.value)} fullWidth multiline rows={2}
                      sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button size="small" variant="contained" onClick={() => resolve(active.id)}
                        disabled={resolving}
                        sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                              bgcolor: SUCCESS, "&:hover": { bgcolor: "#15803D" } }}>
                        {resolving ? "Resolving…" : "Mark Resolved ✓"}
                      </Button>
                      {active.complaintName && (
                        <Button size="small" component="a"
                          href={`${API_BASE}/api/crm/grievances/${active.id}/complaint?loginId=${loginId}`}
                          sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", px: 1,
                                color: PURPLE, border: `1px solid ${PURPLE}`, "&:hover": { bgcolor: PURPLE_L } }}>
                          ⬇ {active.complaintName}
                        </Button>
                      )}
                    </Box>
                  </Box>
                )}
              </Box>
            ) : !showNew ? (
              <Typography sx={{ fontSize: 12.5, color: MUTED }}>No active grievance.</Typography>
            ) : null}
            {grievances.filter(g => g.status !== "IN_PROGRESS").length > 0 && (
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 1 }}>History</Typography>
                {grievances.filter(g => g.status !== "IN_PROGRESS").map(g => (
                  <Box key={g.id} sx={{ display: "flex", alignItems: "center", gap: 2, py: 0.75 }}>
                    <Box sx={{
                      fontSize: 9.5, fontWeight: 700, px: "6px", py: "1px", borderRadius: "4px",
                      bgcolor: g.status === "RESOLVED" ? SUCCESS_L : DANGER_L,
                      color: g.status === "RESOLVED" ? SUCCESS : DANGER,
                      border: `1px solid ${g.status === "RESOLVED" ? "#BBF7D0" : "#FECACA"}`,
                    }}>{g.status}</Box>
                    <Typography sx={{ fontSize: 12, color: MUTED }}><strong style={{ color: TEXT }}>{g.title}</strong></Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}

// ─── Disciplinary Section ─────────────────────────────────────────────────────

function DisciplinarySection({ employeeId, loginId }) {
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };
  const [actions,   setActions]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showNew,   setShowNew]   = useState(false);
  const [form,      setForm]      = useState({ title: "", incidentDescription: "", notes: "" });
  const [incident,  setIncident]  = useState(null);
  const [creating,  setCreating]  = useState(false);
  const [stepping,  setStepping]  = useState({});
  const [newItem,   setNewItem]   = useState("");
  const [addingCA,  setAddingCA]  = useState(false);
  const [closing,   setClosing]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef   = useRef(null);
  const hrFileRef = useRef(null);

  const DISC_STEPS = [
    { key: "investigated",     label: "Investigation"  },
    { key: "manager_reviewed", label: "Manager Review" },
    { key: "hr_decided",       label: "HR Decision"    },
  ];

  function camelStep(key) {
    return "step" + key.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("");
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm/employees/${employeeId}/disciplinary-actions?loginId=${loginId}`, { headers: authHeader });
      if (res.ok) setActions(await res.json());
    } catch (_) {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [employeeId]); // eslint-disable-line

  const active = actions.find(a => a.status === "IN_PROGRESS");
  const allStepsDone = active && DISC_STEPS.every(s => active[camelStep(s.key)]);

  async function create() {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const fd = new FormData();
      fd.append("loginId", loginId);
      fd.append("title",   form.title.trim());
      if (form.incidentDescription) fd.append("incidentDescription", form.incidentDescription);
      if (form.notes)               fd.append("notes",               form.notes);
      if (incident)                 fd.append("incidentReport",      incident);
      const res = await fetch(`${API_BASE}/api/crm/employees/${employeeId}/disciplinary-actions`,
        { method: "POST", headers: { Authorization: authHeader.Authorization }, body: fd });
      if (!res.ok) { alert(await res.text()); return; }
      setShowNew(false);
      setForm({ title: "", incidentDescription: "", notes: "" });
      setIncident(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function toggleStep(id, step, checked) {
    setStepping(s => ({ ...s, [step]: true }));
    try {
      await fetch(`${API_BASE}/api/crm/disciplinary-actions/${id}/step?loginId=${loginId}`,
        { method: "PUT", headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ step, checked }) });
      load();
    } catch (e) { alert(e.message); }
    finally { setStepping(s => ({ ...s, [step]: false })); }
  }

  async function uploadHrDecision(file) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("hrDecision", file);
      const res = await fetch(`${API_BASE}/api/crm/disciplinary-actions/${active.id}/hr-decision?loginId=${loginId}`,
        { method: "POST", headers: { Authorization: authHeader.Authorization }, body: fd });
      if (!res.ok) { alert(await res.text()); return; }
      load();
    } catch (e) { alert(e.message); }
    finally { setUploading(false); }
  }

  async function addCorrectiveAction() {
    if (!newItem.trim() || !active) return;
    setAddingCA(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm/disciplinary-actions/${active.id}/corrective-actions?loginId=${loginId}`,
        { method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ itemText: newItem.trim() }) });
      if (!res.ok) { alert(await res.text()); return; }
      setNewItem("");
      load();
    } catch (e) { alert(e.message); }
    finally { setAddingCA(false); }
  }

  async function toggleCA(itemId, done) {
    try {
      await fetch(`${API_BASE}/api/crm/disciplinary-actions/${active.id}/corrective-actions/${itemId}/toggle?loginId=${loginId}&done=${done}`,
        { method: "PUT", headers: authHeader });
      load();
    } catch (e) { alert(e.message); }
  }

  async function deleteCA(itemId) {
    try {
      await fetch(`${API_BASE}/api/crm/disciplinary-actions/${active.id}/corrective-actions/${itemId}?loginId=${loginId}`,
        { method: "DELETE", headers: authHeader });
      load();
    } catch (e) { alert(e.message); }
  }

  async function close(id) {
    setClosing(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm/disciplinary-actions/${id}/close?loginId=${loginId}`,
        { method: "POST", headers: authHeader });
      if (!res.ok) { alert(await res.text()); return; }
      load();
    } catch (e) { alert(e.message); }
    finally { setClosing(false); }
  }

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE }}>
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Disciplinary Actions</Typography>
        {!active && !showNew && (
          <Button size="small" variant="outlined" onClick={() => setShowNew(true)} sx={{
            fontSize: 11, fontWeight: 600, textTransform: "none", borderRadius: "7px",
            borderColor: BORDER, color: TEXT, "&:hover": { borderColor: DANGER, color: DANGER, bgcolor: DANGER_L },
          }}>+ Open Case</Button>
        )}
        {active && (
          <Button size="small" variant="contained" disabled={!allStepsDone || closing} onClick={() => close(active.id)}
            sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                  bgcolor: allStepsDone ? SUCCESS : "#E2E8F0", color: allStepsDone ? "#fff" : MUTED,
                  "&:hover": allStepsDone ? { bgcolor: "#15803D" } : {} }}>
            {closing ? "…" : "Close Case ✓"}
          </Button>
        )}
      </Box>
      <Box sx={{ p: 2.5 }}>
        {loading ? <CircularProgress size={16} sx={{ color: PURPLE }} /> : (
          <>
            {showNew && (
              <Box sx={{ mb: 2, p: 2, bgcolor: "#F7F9FC", borderRadius: "8px", border: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, mb: 1.5 }}>New Disciplinary Case</Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <TextField size="small" label="Title *" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} fullWidth
                    sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <TextField size="small" label="Incident description" value={form.incidentDescription}
                    onChange={e => setForm(f => ({ ...f, incidentDescription: e.target.value }))} fullWidth multiline rows={2}
                    sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                  <Box>
                    <input type="file" ref={fileRef} style={{ display: "none" }}
                      onChange={e => setIncident(e.target.files[0] || null)} />
                    <Button size="small" variant="outlined" onClick={() => fileRef.current?.click()} sx={{
                      fontSize: 11, textTransform: "none", borderRadius: "7px", borderColor: BORDER, color: TEXT,
                    }}>{incident ? `📎 ${incident.name}` : "Attach incident report"}</Button>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button size="small" variant="contained" onClick={create}
                      disabled={creating || !form.title.trim()}
                      sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", boxShadow: "none",
                            bgcolor: PURPLE, "&:hover": { bgcolor: "#6D28D9" } }}>
                      {creating ? "Opening…" : "Open Case"}
                    </Button>
                    <Button size="small" onClick={() => setShowNew(false)}
                      sx={{ fontSize: 11, textTransform: "none", color: MUTED }}>Cancel</Button>
                  </Box>
                </Box>
              </Box>
            )}
            {active ? (
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 500, color: TEXT, mb: 0.5 }}>{active.title}</Typography>
                {active.incidentDescription && <Typography sx={{ fontSize: 12, color: MUTED, mb: 1.5 }}>{active.incidentDescription}</Typography>}

                {/* Checklist */}
                <Box sx={{ mb: 1.5 }}>
                  {DISC_STEPS.map(s => (
                    <Box key={s.key}>
                      <ChecklistStep label={s.label} done={active[camelStep(s.key)]}
                        disabled={!!stepping[s.key]}
                        onToggle={checked => toggleStep(active.id, s.key, checked)} />
                      {s.key === "hr_decided" && (
                        <Box sx={{ ml: 3.5, mb: 0.5, display: "flex", gap: 1 }}>
                          {active.hrDecisionName && (
                            <Button size="small" component="a"
                              href={`${API_BASE}/api/crm/disciplinary-actions/${active.id}/hr-decision?loginId=${loginId}`}
                              sx={{ fontSize: 10, textTransform: "none", borderRadius: "6px", px: 1,
                                    color: PURPLE, border: `1px solid ${PURPLE}`, "&:hover": { bgcolor: PURPLE_L } }}>
                              ⬇ {active.hrDecisionName}
                            </Button>
                          )}
                          <input type="file" ref={hrFileRef} style={{ display: "none" }}
                            onChange={e => uploadHrDecision(e.target.files[0])} />
                          <Button size="small" onClick={() => hrFileRef.current?.click()} disabled={uploading}
                            sx={{ fontSize: 10, textTransform: "none", borderRadius: "6px", px: 1,
                                  color: MUTED, border: `1px solid ${BORDER}`, "&:hover": { bgcolor: "#F7F9FC" } }}>
                            {uploading ? "…" : active.hrDecisionName ? "Replace" : "Upload HR Decision"}
                          </Button>
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>

                {/* Corrective action plan */}
                <Box sx={{ borderTop: `1px solid ${BORDER}`, pt: 1.5 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 1 }}>Corrective Action Plan</Typography>
                  {active.correctiveActions?.length === 0 && (
                    <Typography sx={{ fontSize: 12, color: MUTED, mb: 1 }}>No items. Add corrective actions below.</Typography>
                  )}
                  {active.correctiveActions?.map(item => (
                    <Box key={item.id} sx={{
                      display: "flex", alignItems: "center", gap: 1, py: 0.5,
                      borderBottom: `1px solid ${BORDER}`, "&:last-child": { borderBottom: "none" },
                    }}>
                      <Box onClick={() => toggleCA(item.id, !item.isDone)} sx={{
                        width: 14, height: 14, borderRadius: "3px", flexShrink: 0,
                        bgcolor: item.isDone ? PURPLE : "transparent",
                        border: `2px solid ${item.isDone ? PURPLE : "#CBD5E1"}`,
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {item.isDone && <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </Box>
                      <Typography sx={{ fontSize: 12, flex: 1, color: TEXT,
                        textDecoration: item.isDone ? "line-through" : "none", opacity: item.isDone ? 0.6 : 1 }}>
                        {item.itemText}
                      </Typography>
                      <Button size="small" onClick={() => deleteCA(item.id)} sx={{
                        minWidth: 0, p: "1px 5px", fontSize: 11, color: MUTED,
                        "&:hover": { color: DANGER, bgcolor: DANGER_L },
                      }}>✕</Button>
                    </Box>
                  ))}
                  <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                    <TextField size="small" value={newItem} onChange={e => setNewItem(e.target.value)}
                      placeholder="Add corrective action…" fullWidth
                      onKeyDown={e => e.key === "Enter" && addCorrectiveAction()}
                      sx={{ "& .MuiInputBase-input": { fontSize: 12 } }} />
                    <Button size="small" variant="outlined" onClick={addCorrectiveAction}
                      disabled={addingCA || !newItem.trim()} sx={{
                        textTransform: "none", fontSize: 11, borderRadius: "7px",
                        borderColor: PURPLE, color: PURPLE, whiteSpace: "nowrap",
                        "&:hover": { bgcolor: PURPLE_L },
                      }}>{addingCA ? "…" : "Add"}</Button>
                  </Box>
                </Box>

                {active.incidentReportName && (
                  <Box sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${BORDER}` }}>
                    <Button size="small" component="a"
                      href={`${API_BASE}/api/crm/disciplinary-actions/${active.id}/incident-report?loginId=${loginId}`}
                      sx={{ fontSize: 11, textTransform: "none", borderRadius: "6px", px: 1,
                            color: MUTED, border: `1px solid ${BORDER}`, "&:hover": { bgcolor: "#F7F9FC" } }}>
                      ⬇ Incident Report: {active.incidentReportName}
                    </Button>
                  </Box>
                )}
              </Box>
            ) : !showNew ? (
              <Typography sx={{ fontSize: 12.5, color: MUTED }}>No active disciplinary case.</Typography>
            ) : null}
            {actions.filter(a => a.status !== "IN_PROGRESS").length > 0 && (
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px", mb: 1 }}>History</Typography>
                {actions.filter(a => a.status !== "IN_PROGRESS").map(a => (
                  <Box key={a.id} sx={{ display: "flex", alignItems: "center", gap: 2, py: 0.75 }}>
                    <Box sx={{
                      fontSize: 9.5, fontWeight: 700, px: "6px", py: "1px", borderRadius: "4px",
                      bgcolor: a.status === "CLOSED" ? SUCCESS_L : "#F1F3F7",
                      color: a.status === "CLOSED" ? SUCCESS : MUTED,
                      border: `1px solid ${a.status === "CLOSED" ? "#BBF7D0" : BORDER}`,
                    }}>{a.status}</Box>
                    <Typography sx={{ fontSize: 12, color: MUTED }}><strong style={{ color: TEXT }}>{a.title}</strong></Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}
