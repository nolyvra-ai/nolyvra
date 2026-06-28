import { useEffect, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, Button, Alert, CircularProgress, LinearProgress,
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

const CARD_BASE = {
  bgcolor: SURFACE, border: `1px solid ${BORDER}`,
  borderRadius: "12px", boxShadow: "0 1px 4px rgba(15,22,35,0.05)", overflow: "hidden",
};

const thSx = {
  fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
  letterSpacing: "0.5px", borderBottom: `1px solid ${BORDER}`,
  bgcolor: "#FAFBFD", py: 1.25, px: 2.5, whiteSpace: "nowrap",
};

function ProgressBar({ pct, overdue }) {
  const color = overdue > 0 ? DANGER : pct >= 100 ? SUCCESS : pct >= 50 ? ACCENT : WARN;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 160 }}>
      <Box sx={{ flex: 1, height: 6, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
        <Box sx={{
          width: `${Math.min(pct, 100)}%`, height: "100%",
          bgcolor: color, borderRadius: "3px", transition: "width 0.4s ease",
        }} />
      </Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color, minWidth: 36 }}>
        {Math.round(pct)}%
      </Typography>
    </Box>
  );
}

export default function CrmOnboardingPage() {
  const nav     = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  const [employees, setEmployees] = useState([]);
  const [instances, setInstances] = useState({});  // employeeId → instance
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      // get all employees across all statuses so we can show IN_PROGRESS onboardings too
      const empRes = await fetch(`${API_BASE}/api/crm/employees?loginId=${loginId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
      });
      if (!empRes.ok) throw new Error(`Employees: ${empRes.status}`);
      const allEmps = await empRes.json();

      // only care about employees that have an onboarding status OR might have an active instance
      const onboardingEmps = allEmps.filter(e => e.status === "ONBOARDING");
      setEmployees(onboardingEmps);

      // load onboarding instances in parallel
      const instanceMap = {};
      await Promise.all(onboardingEmps.map(async emp => {
        try {
          const res = await fetch(
            `${API_BASE}/api/crm/employees/${emp.id}/onboarding?loginId=${loginId}`,
            { headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` } }
          );
          if (res.ok) instanceMap[emp.id] = await res.json();
        } catch (_) { /* no instance yet — that's fine */ }
      }));
      setInstances(instanceMap);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  const hasAny = employees.length > 0;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: TEXT }}>Onboarding</Typography>
            <Box sx={{
              fontSize: 9, fontWeight: 700, color: PURPLE, bgcolor: PURPLE_L,
              border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", px: "6px", py: "2px",
            }}>BETA</Box>
          </Box>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.25 }}>
            Track new hire progress across all onboarding tasks
          </Typography>
        </Box>
        <Button onClick={() => nav("/crm/employees")} variant="outlined" size="small" sx={{
          fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
          borderColor: BORDER, color: TEXT,
          "&:hover": { borderColor: PURPLE, color: PURPLE, bgcolor: PURPLE_L },
        }}>
          All Employees
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} sx={{ color: PURPLE }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ fontSize: 12 }}>{error}</Alert>
      ) : !hasAny ? (
        <Paper elevation={0} sx={{ ...CARD_BASE, p: 5, textAlign: "center" }}>
          <Box sx={{ mb: 1.5 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke={PURPLE_BR} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          </Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: TEXT, mb: 0.5 }}>
            No active onboardings
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: MUTED, mb: 2 }}>
            Convert a selected candidate or add an employee, then start their onboarding from their profile.
          </Typography>
          <Button onClick={() => nav("/crm/employees")} variant="contained" size="small" sx={{
            fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px",
            background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)", boxShadow: "none",
          }}>
            Go to Employees
          </Button>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ ...CARD_BASE }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Employee</TableCell>
                <TableCell sx={thSx}>Job Title</TableCell>
                <TableCell sx={thSx}>Start Date</TableCell>
                <TableCell sx={thSx}>Progress</TableCell>
                <TableCell sx={thSx}>Overdue</TableCell>
                <TableCell sx={{ ...thSx, textAlign: "right" }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map(emp => {
                const inst    = instances[emp.id];
                const pct     = inst ? inst.overallProgressPct : 0;
                const overdue = inst ? inst.overdueCount : 0;
                const hasInst = !!inst;

                return (
                  <TableRow key={emp.id} hover sx={{
                    cursor: "pointer", "&:last-child td": { borderBottom: 0 },
                  }} onClick={() => nav(`/crm/employees/${emp.id}`)}>
                    <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                        {emp.firstName} {emp.lastName}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: MUTED }}>{emp.email}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2.5, fontSize: 12, color: TEXT, borderBottom: `1px solid ${BORDER}` }}>
                      {emp.jobTitle || <span style={{ color: MUTED }}>—</span>}
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2.5, fontSize: 12, color: MUTED, borderBottom: `1px solid ${BORDER}` }}>
                      {emp.startDate || "—"}
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                      {hasInst ? (
                        <ProgressBar pct={pct} overdue={overdue} />
                      ) : (
                        <Box sx={{
                          display: "inline-flex", alignItems: "center",
                          bgcolor: WARN_L, border: "1px solid #FDE68A",
                          borderRadius: "20px", px: 1.25, py: "2px",
                          fontSize: 11, fontWeight: 600, color: WARN,
                        }}>Not started</Box>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}` }}>
                      {overdue > 0 ? (
                        <Box sx={{
                          display: "inline-flex", alignItems: "center",
                          bgcolor: DANGER_L, border: "1px solid #FECACA",
                          borderRadius: "20px", px: 1.25, py: "2px",
                          fontSize: 11, fontWeight: 700, color: DANGER,
                        }}>{overdue} overdue</Box>
                      ) : (
                        <Typography sx={{ fontSize: 12, color: MUTED }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ py: 1.5, px: 2.5, borderBottom: `1px solid ${BORDER}`, textAlign: "right" }}>
                      <Box sx={{
                        fontSize: 12, color: ACCENT, fontWeight: 600, cursor: "pointer",
                        "&:hover": { textDecoration: "underline" },
                      }}>
                        {hasInst ? "View checklist →" : "Start →"}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
