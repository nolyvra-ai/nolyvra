import { useEffect, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel, Alert, CircularProgress,
  IconButton, Tooltip,
} from "@mui/material";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SyncIcon from "@mui/icons-material/Sync";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const SURFACE = "#FFFFFF";
const BORDER  = "#E8ECF2";
const MUTED   = "#8A94A6";
const TEXT    = "#0F1623";
const ACCENT  = "#1D72E8";
const PURPLE  = "#7C3AED";
const PURPLE_L = "#F5F3FF";
const PURPLE_BR = "#C4B5FD";
const SUCCESS = "#16A34A";
const SUCCESS_L = "#F0FDF4";
const WARN    = "#D97706";
const WARN_L  = "#FFFBEB";
const DANGER  = "#DC2626";
const DANGER_L = "#FEF2F2";
const HUBSPOT  = "#FF7A59";
const HUBSPOT_L = "rgba(255,122,89,0.08)";
const HUBSPOT_LABEL_BG = "#FFF1EC";

const CARD_BASE = {
  bgcolor: SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: "12px", boxShadow: "0 1px 4px rgba(15,22,35,0.05)", overflow: "hidden",
};

const thSx = {
  fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
  letterSpacing: "0.5px", borderBottom: `1px solid ${BORDER}`,
  bgcolor: "#FAFBFD", py: 1.25, px: 2, whiteSpace: "nowrap",
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
      px: 1.25, py: "2px", fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap",
    }}>{status}</Box>
  );
}

function empTypeBadge(t) {
  const map = {
    PERMANENT: { bg: PURPLE_L,  border: PURPLE_BR, color: PURPLE },
    CONTRACT:  { bg: "#EFF6FF", border: "#BFDBFE", color: ACCENT },
    PLACED:    { bg: "#F0FDF4", border: "#BBF7D0", color: SUCCESS },
  };
  const s = map[t] || { bg: "#F1F3F7", border: BORDER, color: MUTED };
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center",
      bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: "20px",
      px: 1.25, py: "2px", fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap",
    }}>{t}</Box>
  );
}

function HubSpotBadge({ status }) {
  if (!status) return null;
  const failed = status.state === "sync_failed";
  const linked = Boolean(status.linked);
  const label = failed ? "Sync failed" : linked ? "In HubSpot" : null;
  if (!label) return null;
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", bgcolor: failed ? DANGER_L : HUBSPOT_LABEL_BG,
      border: `1px solid ${failed ? "#FECACA" : "rgba(255,122,89,0.25)"}`,
      borderRadius: "4px", px: "6px", py: "1px", fontSize: 9, fontWeight: 700,
      color: failed ? DANGER : HUBSPOT, whiteSpace: "nowrap",
      cursor: "default",
      "&:hover": { bgcolor: failed ? DANGER_L : HUBSPOT_LABEL_BG },
    }}
    onClick={e => e.stopPropagation()}>{label}</Box>
  );
}

const EMPTY_FORM = {
  firstName: "", lastName: "", email: "", phone: "", jobTitle: "",
  employmentType: "PERMANENT", status: "ONBOARDING",
  managerId: "", departmentId: "", startDate: "",
};

export default function CrmEmployeesPage() {
  const nav     = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  const [employees,    setEmployees]    = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDept,   setFilterDept]   = useState("");

  // add dialog
  const [addOpen,    setAddOpen]    = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState(null);

  // upload
  const [uploading,  setUploading]  = useState(false);
  const [uploadMsg,  setUploadMsg]  = useState(null);
  const [hubSpotStatuses, setHubSpotStatuses] = useState({});
  const [hubSpotBusy, setHubSpotBusy] = useState({});
  const [hubSpotError, setHubSpotError] = useState("");

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` });

  async function apiGet(path) {
    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set("loginId", loginId);
    const res = await fetch(url.toString(), { headers: authHeader() });
    if (!res.ok) {
      const err = new Error(await responseMessage(res));
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function apiPost(path) {
    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set("loginId", loginId);
    const res = await fetch(url.toString(), { method: "POST", headers: authHeader() });
    if (!res.ok) {
      const err = new Error(await responseMessage(res));
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function responseMessage(res) {
    const text = await res.text().catch(() => "");
    try {
      const data = JSON.parse(text);
      return data.message || data.error || text || `Request failed (${res.status})`;
    } catch {
      return text || `Request failed (${res.status})`;
    }
  }

  async function loadHubSpotStatuses(employeeList) {
    const pairs = await Promise.all(employeeList.map(async emp => {
      try {
        return [emp.id, await apiGet(`/api/crm/employees/${emp.id}/hubspot/status`)];
      } catch {
        return [emp.id, null];
      }
    }));
    setHubSpotStatuses(Object.fromEntries(pairs));
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ loginId });
      if (filterStatus) params.set("status",       filterStatus);
      if (filterDept)   params.set("departmentId", filterDept);

      const [empRes, deptRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/employees?${params}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        }),
        fetch(`${API_BASE}/api/crm/departments?loginId=${loginId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        }),
      ]);
      if (!empRes.ok)  throw new Error(`Employees: ${empRes.status}`);
      if (!deptRes.ok) throw new Error(`Departments: ${deptRes.status}`);
      const empData = await empRes.json();
      setEmployees(empData);
      setDepartments(await deptRes.json());
      await loadHubSpotStatuses(empData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterStatus, filterDept]); // eslint-disable-line

  async function handleSave() {
    setSaving(true); setSaveError(null);
    try {
      const body = {
        firstName:      form.firstName,
        lastName:       form.lastName,
        email:          form.email,
        phone:          form.phone || null,
        jobTitle:       form.jobTitle || null,
        employmentType: form.employmentType,
        status:         form.status || "ONBOARDING",
        managerId:      form.managerId  || null,
        departmentId:   form.departmentId || null,
        startDate:      form.startDate  || null,
        endDate:        null,
      };
      const res = await fetch(`${API_BASE}/api/crm/employees?loginId=${loginId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t || res.status); }
      setAddOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true); setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/crm/employees/upload?loginId=${loginId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || res.status);
      setUploadMsg(`Uploaded: ${data.success} added, ${data.failed} failed out of ${data.total}.`
        + (data.errors?.length ? " Errors: " + data.errors.slice(0, 3).join("; ") : ""));
      load();
    } catch (e) {
      setUploadMsg("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleHubSpotPush(emp) {
    setHubSpotBusy(prev => ({ ...prev, [emp.id]: true }));
    setHubSpotError("");
    try {
      const status = await apiPost(`/api/crm/employees/${emp.id}/hubspot/push`);
      setHubSpotStatuses(prev => ({ ...prev, [emp.id]: status }));
    } catch (e) {
      setHubSpotError(`Could not sync ${emp.firstName} ${emp.lastName} to HubSpot. ${e.message || "Please try again."}`);
      try {
        const status = await apiGet(`/api/crm/employees/${emp.id}/hubspot/status`);
        setHubSpotStatuses(prev => ({ ...prev, [emp.id]: status }));
      } catch {
        // Best-effort refresh after a failed push.
      }
    } finally {
      setHubSpotBusy(prev => ({ ...prev, [emp.id]: false }));
    }
  }

  async function handleHubSpotSync(emp) {
    setHubSpotBusy(prev => ({ ...prev, [emp.id]: true }));
    setHubSpotError("");
    try {
      const status = await apiPost(`/api/crm/employees/${emp.id}/hubspot/sync`);
      setHubSpotStatuses(prev => ({ ...prev, [emp.id]: status }));
      await load();
    } catch (e) {
      if (e.status === 409) {
        const useHubSpot = window.confirm(`${e.message}\n\nOK: update Nolyvra from HubSpot.\nCancel: choose another action.`);
        let direction = useHubSpot ? "pull" : null;
        if (!direction) {
          const useNolyvra = window.confirm("Overwrite HubSpot with the Nolyvra employee instead?");
          if (!useNolyvra) {
            setHubSpotBusy(prev => ({ ...prev, [emp.id]: false }));
            return;
          }
          direction = "push";
        }
        try {
          const status = await apiPost(`/api/crm/employees/${emp.id}/hubspot/sync?direction=${direction}`);
          setHubSpotStatuses(prev => ({ ...prev, [emp.id]: status }));
          if (direction === "pull") await load();
        } catch (forcedError) {
          setHubSpotError(`Could not resolve HubSpot sync for ${emp.firstName} ${emp.lastName}. ${forcedError.message || "Please try again."}`);
        }
      } else {
        setHubSpotError(`Could not sync ${emp.firstName} ${emp.lastName} with HubSpot. ${e.message || "Please try again."}`);
      }
    } finally {
      setHubSpotBusy(prev => ({ ...prev, [emp.id]: false }));
    }
  }

  async function handleBulkHubSpot() {
    const targets = employees.filter(emp => {
      const status = hubSpotStatuses[emp.id];
      if (!status || status.state === "disconnected" || hubSpotBusy[emp.id]) return false;
      return true;
    });
    if (targets.length === 0) return;
    setHubSpotError("");
    for (const emp of targets) {
      if (hubSpotStatuses[emp.id]?.linked) {
        await handleHubSpotSync(emp);
      } else {
        await handleHubSpotPush(emp);
      }
    }
  }

  const hubSpotActionCount = employees.filter(emp => {
    const status = hubSpotStatuses[emp.id];
    return status && status.state !== "disconnected" && !hubSpotBusy[emp.id];
  }).length;
  const hubSpotBulkBusy = Object.values(hubSpotBusy).some(Boolean);

  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Employees</Typography>
            <Box sx={{
              fontSize: 9, fontWeight: 700, color: PURPLE, bgcolor: PURPLE_L,
              border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", px: "6px", py: "2px",
            }}>BETA</Box>
          </Box>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Manage your team in CRMx
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* Excel upload */}
          <Button
            component="label"
            variant="outlined"
            size="small"
            disabled={uploading}
            sx={{
              fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
              borderColor: BORDER, color: TEXT,
              "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L },
            }}
          >
            {uploading ? "Uploading…" : "Upload Excel"}
            <input type="file" accept=".xlsx,.xls" hidden onChange={handleUpload} />
          </Button>
          <Button
            onClick={handleBulkHubSpot}
            variant="outlined"
            size="small"
            disabled={hubSpotBulkBusy || hubSpotActionCount === 0}
            startIcon={hubSpotBulkBusy
              ? <SyncIcon sx={{
                  fontSize: 14,
                  animation: "hubspotSpin 0.9s linear infinite",
                  "@keyframes hubspotSpin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }} />
              : <HubOutlinedIcon sx={{ fontSize: 14 }} />}
            sx={{
              fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
              borderColor: BORDER, color: HUBSPOT, bgcolor: SURFACE,
              "&.Mui-disabled": { bgcolor: "#F7F8FA", color: MUTED, borderColor: BORDER },
              "&:hover": { borderColor: HUBSPOT, bgcolor: HUBSPOT_L },
            }}
          >
            Sync HubSpot
          </Button>
          <Button
            onClick={() => { setForm(EMPTY_FORM); setSaveError(null); setAddOpen(true); }}
            variant="contained"
            size="small"
            sx={{
              fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
              background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
              boxShadow: "none",
              "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
            }}
          >
            + Add Employee
          </Button>
        </Box>
      </Box>

      {uploadMsg && (
        <Alert severity={uploadMsg.startsWith("Upload failed") ? "error" : "success"}
          onClose={() => setUploadMsg(null)} sx={{ mb: 2, fontSize: 12 }}>
          {uploadMsg}
        </Alert>
      )}

      {hubSpotError && (
        <Alert severity="error" onClose={() => setHubSpotError("")} sx={{ mb: 2, fontSize: 12, borderRadius: "8px" }}>
          {hubSpotError}
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel sx={{ fontSize: 12 }}>Status</InputLabel>
          <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}
            sx={{ fontSize: 12, borderRadius: "8px" }}>
            <MenuItem value="" sx={{ fontSize: 12 }}>All</MenuItem>
            <MenuItem value="ONBOARDING" sx={{ fontSize: 12 }}>Onboarding</MenuItem>
            <MenuItem value="ACTIVE"     sx={{ fontSize: 12 }}>Active</MenuItem>
            <MenuItem value="INACTIVE"   sx={{ fontSize: 12 }}>Inactive</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel sx={{ fontSize: 12 }}>Department</InputLabel>
          <Select value={filterDept} label="Department" onChange={e => setFilterDept(e.target.value)}
            sx={{ fontSize: 12, borderRadius: "8px" }}>
            <MenuItem value="" sx={{ fontSize: 12 }}>All</MenuItem>
            {departments.map(d => (
              <MenuItem key={d.id} value={d.id} sx={{ fontSize: 12 }}>{d.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        {(filterStatus || filterDept) && (
          <Button size="small" onClick={() => { setFilterStatus(""); setFilterDept(""); }}
            sx={{ fontSize: 11, color: MUTED, textTransform: "none" }}>
            Clear
          </Button>
        )}
      </Box>

      {/* Table */}
      <Paper elevation={0} sx={{ ...CARD_BASE }}>
        {loading ? (
          <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} sx={{ color: PURPLE }} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2, fontSize: 12 }}>{error}</Alert>
        ) : employees.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: 13, color: MUTED }}>No employees yet.</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Name</TableCell>
                <TableCell sx={thSx}>Email</TableCell>
                <TableCell sx={thSx}>Job Title</TableCell>
                <TableCell sx={thSx}>Department</TableCell>
                <TableCell sx={thSx}>Type</TableCell>
                <TableCell sx={thSx}>Status</TableCell>
                <TableCell sx={thSx}>Manager</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map(emp => (
                <TableRow key={emp.id} hover
                  sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}
                  onClick={() => nav(`/crm/employees/${emp.id}`)}>
                  <TableCell sx={{ py: 1.25, px: 2, fontSize: 13, fontWeight: 600, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                      <Box component="span">{emp.firstName} {emp.lastName}</Box>
                      <HubSpotBadge status={hubSpotStatuses[emp.id]} />
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                    {emp.email}
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    {emp.jobTitle || <Typography component="span" sx={{ color: MUTED }}>—</Typography>}
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                    {emp.departmentName || <Typography component="span" sx={{ color: MUTED }}>—</Typography>}
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                    {empTypeBadge(emp.employmentType)}
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2, borderBottom: `1px solid ${BORDER}` }}>
                    <StatusBadge status={emp.status} />
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                    {emp.managerName || "—"}
                  </TableCell>
                  <TableCell sx={{ py: 1.25, px: 2, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}
                    onClick={e => e.stopPropagation()}>
                    <Box sx={{ display: "flex", gap: 0.75, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                      {hubSpotStatuses[emp.id]?.linked && hubSpotStatuses[emp.id]?.externalUrl && (
                        <Tooltip title="Open in HubSpot">
                          <IconButton
                            component="a"
                            href={hubSpotStatuses[emp.id].externalUrl}
                            target="_blank"
                            rel="noreferrer"
                            size="small"
                            aria-label={`Open ${emp.firstName} ${emp.lastName} in HubSpot`}
                            sx={{
                              width: 28, height: 28, border: `1px solid ${BORDER}`, borderRadius: "6px",
                              color: HUBSPOT, bgcolor: SURFACE,
                              "&:hover": { borderColor: HUBSPOT, bgcolor: HUBSPOT_L }
                            }}>
                            <OpenInNewIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Box sx={{ fontSize: 12, color: ACCENT, cursor: "pointer", fontWeight: 600 }}
                      onClick={e => { e.stopPropagation(); nav(`/crm/employees/${emp.id}`); }}>
                        View →
                      </Box>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Add Employee Dialog */}
      <Dialog open={addOpen} onClose={() => !saving && setAddOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: "14px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 0.5 }}>
          Add Employee
        </DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}>
          {saveError && <Alert severity="error" sx={{ mb: 1.5, fontSize: 12 }}>{saveError}</Alert>}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField label="First name *" value={form.firstName} onChange={e => f("firstName")(e.target.value)}
                fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
              <TextField label="Last name *" value={form.lastName} onChange={e => f("lastName")(e.target.value)}
                fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
            </Box>
            <TextField label="Email *" value={form.email} onChange={e => f("email")(e.target.value)}
              fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <TextField label="Phone" value={form.phone} onChange={e => f("phone")(e.target.value)}
                fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
              <TextField label="Job title" value={form.jobTitle} onChange={e => f("jobTitle")(e.target.value)}
                fullWidth size="small" InputProps={{ sx: { fontSize: 13 } }} InputLabelProps={{ sx: { fontSize: 13 } }} />
            </Box>
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ fontSize: 13 }}>Employment type *</InputLabel>
                <Select value={form.employmentType} label="Employment type *"
                  onChange={e => f("employmentType")(e.target.value)} sx={{ fontSize: 13 }}>
                  <MenuItem value="PERMANENT" sx={{ fontSize: 13 }}>Permanent</MenuItem>
                  <MenuItem value="CONTRACT"  sx={{ fontSize: 13 }}>Contract</MenuItem>
                  <MenuItem value="PLACED"    sx={{ fontSize: 13 }}>Placed</MenuItem>
                </Select>
              </FormControl>
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
            </Box>
            <TextField label="Start date" type="date" value={form.startDate}
              onChange={e => f("startDate")(e.target.value)} size="small"
              InputLabelProps={{ shrink: true, sx: { fontSize: 13 } }} InputProps={{ sx: { fontSize: 13 } }} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddOpen(false)} disabled={saving}
            sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.firstName || !form.lastName || !form.email}
            variant="contained" sx={{
              fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
              background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
              boxShadow: "none",
              "&:hover": { background: "linear-gradient(135deg, #6D28D9 0%, #4338CA 100%)", boxShadow: "none" },
            }}>
            {saving ? "Saving…" : "Add Employee"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
