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

const STEPS = [
  { key: "finance_reviewed", label: "Finance Review" },
  { key: "approved",         label: "Approval"       },
  { key: "payment_made",     label: "Payment Made"   },
  { key: "closed",           label: "Closed"         },
];

function StatusChip({ status }) {
  const map = {
    IN_PROGRESS: { bg: WARN_L,    border: "#FDE68A", color: WARN    },
    APPROVED:    { bg: SUCCESS_L, border: "#BBF7D0", color: SUCCESS  },
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

function CheckDots({ expense }) {
  const colors = STEPS.map(s => expense[`step${s.key.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("")}`]
    ? SUCCESS : BORDER);
  return (
    <Box sx={{ display: "flex", gap: "5px", alignItems: "center" }}>
      {STEPS.map((s, i) => (
        <Tooltip key={s.key} title={s.label} arrow>
          <Box sx={{
            width: 10, height: 10, borderRadius: "50%",
            bgcolor: colors[i], border: `1.5px solid ${colors[i] === BORDER ? "#CBD5E1" : colors[i]}`,
          }} />
        </Tooltip>
      ))}
    </Box>
  );
}

function camelStep(key) {
  return "step" + key.split("_").map(w => w[0].toUpperCase() + w.slice(1)).join("");
}

const ACCENT   = "#1D72E8";
const ACCENT_L = "#EFF6FF";

function MonthlyExpenseSection({ loginId, authH }) {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const [month,   setMonth]   = useState(defaultMonth);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_BASE}/api/crm/expenses/monthly-summary?loginId=${loginId}&month=${month}`, { headers: authH })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]); // eslint-disable-line

  const fmt = n => n != null
    ? `$${Number(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

  const maxCatAmt = Math.max(1, ...(data?.byCategory ?? []).map(c => Number(c.amount)));

  const monthDisplay = month
    ? new Date(month + "-01").toLocaleString("en-GB", { month: "long", year: "numeric" })
    : "";

  return (
    <Paper elevation={0} sx={{ ...CARD_BASE, mb: 0 }}>
      {/* Header */}
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: `1px solid ${BORDER}`,
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Monthly Expense Overview</Typography>
          <Box sx={{ fontSize: 9, fontWeight: 700, px: "6px", py: "2px", borderRadius: "4px",
            bgcolor: "#F5F3FF", color: PURPLE, border: "1px solid #C4B5FD" }}>MONTHLY</Box>
        </Box>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{
            fontSize: 12, border: `1px solid ${BORDER}`, borderRadius: 7,
            padding: "4px 10px", color: TEXT, outline: "none", fontFamily: "inherit",
            background: "#FAFBFD", cursor: "pointer",
          }}
        />
      </Box>

      {/* Three stat tiles */}
      <Box sx={{ p: 2.5, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>

        {/* Salary */}
        <Box sx={{ p: 2, borderRadius: "10px", bgcolor: "#F5F3FF", border: "1px solid #C4B5FD" }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.55px", mb: 0.5 }}>
            Monthly Salary Cost
          </Typography>
          {loading ? (
            <Box sx={{ height: 42, display: "flex", alignItems: "center" }}>
              <CircularProgress size={18} sx={{ color: PURPLE }} />
            </Box>
          ) : (
            <>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: PURPLE, lineHeight: 1.15 }}>
                {fmt(data?.salaryTotal)}
              </Typography>
              <Typography sx={{ fontSize: 11, color: PURPLE, opacity: 0.65, mt: 0.3 }}>
                {data?.employeeCount ?? 0} employees · annual ÷ 12
              </Typography>
            </>
          )}
        </Box>

        {/* Expense claims */}
        <Box sx={{ p: 2, borderRadius: "10px", bgcolor: WARN_L, border: "1px solid #FDE68A" }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: WARN, textTransform: "uppercase", letterSpacing: "0.55px", mb: 0.5 }}>
            Expense Reimbursements
          </Typography>
          {loading ? (
            <Box sx={{ height: 42, display: "flex", alignItems: "center" }}>
              <CircularProgress size={18} sx={{ color: WARN }} />
            </Box>
          ) : (
            <>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: WARN, lineHeight: 1.15 }}>
                {fmt(data?.expenseTotal)}
              </Typography>
              <Typography sx={{ fontSize: 11, color: WARN, opacity: 0.65, mt: 0.3 }}>
                {data?.expenseCount ?? 0} submitted claim{data?.expenseCount !== 1 ? "s" : ""} in {monthDisplay}
              </Typography>
            </>
          )}
        </Box>

        {/* Grand total */}
        <Box sx={{ p: 2, borderRadius: "10px",
          background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.55px", mb: 0.5 }}>
            Total Monthly Spend
          </Typography>
          {loading ? (
            <Box sx={{ height: 42, display: "flex", alignItems: "center" }}>
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            </Box>
          ) : (
            <>
              <Typography sx={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>
                {fmt(data?.grandTotal)}
              </Typography>
              <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.6)", mt: 0.3 }}>
                salary + reimbursements
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* Category breakdown */}
      {(data?.byCategory ?? []).length > 0 && (
        <Box sx={{ px: 2.5, pb: 2.5, borderTop: `1px solid ${BORDER}`, pt: 2 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 1.5 }}>
            Reimbursements by Category
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {data.byCategory.map(cat => {
              const pct = Math.round(Number(cat.amount) / maxCatAmt * 100);
              return (
                <Box key={cat.category}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.4 }}>
                    <Typography sx={{ fontSize: 11.5, color: TEXT, fontWeight: 500 }}>{cat.category}</Typography>
                    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                      <Typography sx={{ fontSize: 10.5, color: MUTED }}>
                        {cat.count} claim{cat.count !== 1 ? "s" : ""}
                      </Typography>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: WARN }}>
                        {fmt(cat.amount)}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ height: 6, bgcolor: "#F0F2F6", borderRadius: "3px", overflow: "hidden" }}>
                    <Box sx={{ width: `${pct}%`, height: "100%", bgcolor: WARN,
                      borderRadius: "3px", transition: "width .4s ease" }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
          {/* Salary vs expenses split */}
          {data?.salaryTotal != null && data?.grandTotal != null && Number(data.grandTotal) > 0 && (
            <Box sx={{ mt: 2.5, pt: 2, borderTop: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", gap: 2 }}>
              <Typography sx={{ fontSize: 11.5, color: MUTED, flexShrink: 0 }}>Spend split:</Typography>
              <Box sx={{ flex: 1, height: 8, bgcolor: "#F0F2F6", borderRadius: "4px", overflow: "hidden", display: "flex" }}>
                {(() => {
                  const salPct = Math.round(Number(data.salaryTotal) / Number(data.grandTotal) * 100);
                  const expPct = 100 - salPct;
                  return (
                    <>
                      <Box sx={{ width: `${salPct}%`, height: "100%", bgcolor: PURPLE, transition: "width .4s" }} />
                      <Box sx={{ width: `${expPct}%`, height: "100%", bgcolor: WARN, transition: "width .4s" }} />
                    </>
                  );
                })()}
              </Box>
              <Box sx={{ display: "flex", gap: 1.5, flexShrink: 0 }}>
                {[{ color: PURPLE, label: "Salary" }, { color: WARN, label: "Expenses" }].map(({ color, label }) => (
                  <Box key={label} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
                    <Typography sx={{ fontSize: 10.5, color: MUTED }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}

export default function CrmExpensePage() {
  const nav     = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";
  const authH   = { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };

  const [expenses,   setExpenses]   = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("IN_PROGRESS");
  const [newDlg,     setNewDlg]     = useState(false);
  const [resolving,  setResolving]  = useState(null);   // expense being actioned

  const [form, setForm] = useState({
    employeeId: "", title: "", amount: "", category: "",
    expenseDate: new Date().toISOString().split("T")[0], notes: "",
  });
  const [receipt,   setReceipt]   = useState(null);
  const [creating,  setCreating]  = useState(false);
  const [acting,    setActing]    = useState(false);
  const fileRef = useRef();

  async function load() {
    setLoading(true);
    try {
      const [eRes, empRes] = await Promise.all([
        fetch(`${API_BASE}/api/crm/expenses?loginId=${loginId}${filter ? `&status=${filter}` : ""}`, { headers: authH }),
        fetch(`${API_BASE}/api/crm/employees?loginId=${loginId}&status=ACTIVE`, { headers: authH }),
      ]);
      if (eRes.ok)   setExpenses(await eRes.json());
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
      fd.append("loginId", loginId);
      fd.append("title",   form.title.trim());
      if (form.amount)      fd.append("amount",      form.amount);
      if (form.category)    fd.append("category",    form.category);
      if (form.expenseDate) fd.append("expenseDate", form.expenseDate);
      if (form.notes)       fd.append("notes",       form.notes);
      if (receipt)          fd.append("receipt",     receipt);
      const res = await fetch(
        `${API_BASE}/api/crm/employees/${form.employeeId}/expenses`,
        { method: "POST", headers: { Authorization: authH.Authorization }, body: fd }
      );
      if (!res.ok) { alert(await res.text()); return; }
      setNewDlg(false);
      setForm({ employeeId: "", title: "", amount: "", category: "", expenseDate: new Date().toISOString().split("T")[0], notes: "" });
      setReceipt(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setCreating(false); }
  }

  async function toggleStep(id, step, checked) {
    try {
      await fetch(`${API_BASE}/api/crm/expenses/${id}/step?loginId=${loginId}`,
        { method: "PUT", headers: { ...authH, "Content-Type": "application/json" },
          body: JSON.stringify({ step, checked }) });
      load();
    } catch (e) { alert(e.message); }
  }

  async function action(id, endpoint) {
    setActing(true);
    try {
      const res = await fetch(`${API_BASE}/api/crm/expenses/${id}/${endpoint}?loginId=${loginId}`,
        { method: "POST", headers: authH });
      if (!res.ok) { alert(await res.text()); return; }
      setResolving(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setActing(false); }
  }

  const pending = expenses.filter(e => e.status === "IN_PROGRESS").length;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#F7F9FC", p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: TEXT }}>Expense Reimbursement</Typography>
          <Typography sx={{ fontSize: 13, color: MUTED, mt: 0.25 }}>
            {pending > 0 ? `${pending} pending review` : "No pending expenses"}
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setNewDlg(true)} sx={{
          bgcolor: PURPLE, textTransform: "none", fontWeight: 600, borderRadius: "8px",
          boxShadow: "none", "&:hover": { bgcolor: "#6D28D9" },
        }}>+ New Submission</Button>
      </Box>

      {/* Monthly overview */}
      <Box sx={{ mb: 2.5 }}>
        <MonthlyExpenseSection loginId={loginId} authH={authH} />
      </Box>

      {/* Filter */}
      <Box sx={{ display: "flex", gap: 1, mb: 2.5 }}>
        {["IN_PROGRESS", "APPROVED", "REJECTED", "CANCELLED", ""].map(s => (
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
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Submissions</Typography>
        </Box>
        {loading ? (
          <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={24} sx={{ color: PURPLE }} /></Box>
        ) : expenses.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography sx={{ fontSize: 13, color: MUTED }}>No expense submissions found.</Typography>
          </Box>
        ) : (
          <Box>
            {/* Header row */}
            <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.5fr 1fr 120px", px: 2.5, py: 1,
                        borderBottom: `1px solid ${BORDER}`, bgcolor: "#F7F9FC" }}>
              {["Employee", "Title", "Amount", "Date", "Steps", "Status", ""].map(h => (
                <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</Typography>
              ))}
            </Box>
            {expenses.map(exp => {
              const allDone = STEPS.every(s => exp[camelStep(s.key)]);
              return (
                <Box key={exp.id} sx={{
                  display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1fr 1.5fr 1fr 120px",
                  px: 2.5, py: 1.5, borderBottom: `1px solid ${BORDER}`, alignItems: "center",
                  "&:last-child": { borderBottom: "none" },
                  "&:hover": { bgcolor: "#FAFBFD" },
                }}>
                  <Box sx={{ cursor: "pointer" }} onClick={() => nav(`/crm/employees/${exp.employeeId}`)}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                      {exp.firstName} {exp.lastName}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 12.5, color: TEXT }}>{exp.title}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: TEXT, fontWeight: 600 }}>
                    {exp.amount != null ? `$${Number(exp.amount).toLocaleString()}` : "—"}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: MUTED }}>{exp.expenseDate || "—"}</Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    {STEPS.map(s => {
                      const done = exp[camelStep(s.key)];
                      return (
                        <Box key={s.key} onClick={() => exp.status === "IN_PROGRESS" && toggleStep(exp.id, s.key, !done)}
                          sx={{
                            display: "flex", alignItems: "center", gap: 0.75,
                            cursor: exp.status === "IN_PROGRESS" ? "pointer" : "default",
                          }}>
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
                  <StatusChip status={exp.status} />
                  <Box sx={{ display: "flex", gap: 0.75 }}>
                    {exp.status === "IN_PROGRESS" && (
                      <>
                        <Tooltip title={allDone ? "Approve all steps" : "Complete all steps first"} arrow>
                          <span>
                            <Button size="small" variant="contained" disabled={!allDone}
                              onClick={() => action(exp.id, "approve")}
                              sx={{ fontSize: 10, textTransform: "none", borderRadius: "6px", boxShadow: "none", minWidth: 0, px: 1,
                                    bgcolor: allDone ? SUCCESS : "#E2E8F0", color: allDone ? "#fff" : MUTED,
                                    "&:hover": allDone ? { bgcolor: "#15803D" } : {} }}>✓</Button>
                          </span>
                        </Tooltip>
                        <Button size="small" onClick={() => action(exp.id, "reject")} sx={{
                          fontSize: 10, textTransform: "none", borderRadius: "6px", px: 1, minWidth: 0,
                          color: DANGER, border: `1px solid ${DANGER}`, "&:hover": { bgcolor: DANGER_L },
                        }}>✕</Button>
                      </>
                    )}
                    {exp.receiptName && (
                      <Tooltip title={`Download: ${exp.receiptName}`} arrow>
                        <Button size="small" component="a"
                          href={`${API_BASE}/api/crm/expenses/${exp.id}/receipt?loginId=${loginId}`}
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

      {/* New submission dialog */}
      <Dialog open={newDlg} onClose={() => setNewDlg(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, color: TEXT, pb: 1 }}>New Expense Submission</DialogTitle>
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
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <TextField size="small" label="Amount" type="number" value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} fullWidth />
            <TextField size="small" label="Category" value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))} fullWidth />
          </Box>
          <TextField size="small" label="Expense date" type="date" value={form.expenseDate}
            onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))}
            fullWidth InputLabelProps={{ shrink: true }} />
          <TextField size="small" label="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} fullWidth multiline rows={2} />
          <Box>
            <input type="file" ref={fileRef} style={{ display: "none" }}
              onChange={e => setReceipt(e.target.files[0] || null)} />
            <Button size="small" variant="outlined" onClick={() => fileRef.current.click()} sx={{
              fontSize: 12, textTransform: "none", borderRadius: "7px", borderColor: BORDER, color: TEXT,
            }}>
              {receipt ? `📎 ${receipt.name}` : "Attach receipt (optional)"}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setNewDlg(false)} sx={{ fontSize: 12, textTransform: "none", color: MUTED }}>Cancel</Button>
          <Button variant="contained" onClick={create}
            disabled={creating || !form.employeeId || !form.title.trim()}
            sx={{ fontSize: 12, textTransform: "none", bgcolor: PURPLE, boxShadow: "none", borderRadius: "8px",
                  "&:hover": { bgcolor: "#6D28D9" } }}>
            {creating ? "Submitting…" : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
