import { useEffect, useState, useCallback, useRef } from "react";
import { Box, Typography, TextField, MenuItem, Alert, CircularProgress } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const SURFACE="#FFFFFF", BORDER="#E8ECF2", MUTED="#9AA3B4", TEXT="#0F1623";
const ACCENT="#1D72E8", SUCCESS="#16A34A", WARN="#D97706", DANGER="#DC2626", PURPLE="#7C3AED";
const ACCENT_L="#EFF6FF", SUCCESS_L="#F0FDF4", WARN_L="#FFFBEB", DANGER_L="#FEF2F2", PURPLE_L="#F5F3FF";
const ACCENT_BR="#BFDBFE", SUCCESS_BR="#BBF7D0", DANGER_BR="#FECACA";

const INTERVIEW_TYPES = ["Technical","HR Screening","Final Round","Casual Chat","System Design"];
const LOCATIONS       = ["Google Meet","Zoom","In Office","Phone","Microsoft Teams"];
const DURATIONS       = [30,45,60,90,120];

async function apiGet(path) {
  const loginId = localStorage.getItem("loginId")||"";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), { headers:{ Authorization:`Bearer ${localStorage.getItem("sessionToken")||""}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Icons ──────────────────────────────────────────────────────────────────
function IcoBack() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function IcoSearch() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
}
function IcoFilter() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
}
function IcoCalendarStat({ color }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
}
function IcoClockStat({ color }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function IcoVideoStat({ color }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="15" height="10" rx="2"/><polyline points="17 9 22 5 22 19 17 15"/></svg>;
}
function IcoPeopleStat({ color }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function IcoVideo({ color }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="15" height="10" rx="2"/><polyline points="17 9 22 5 22 19 17 15"/></svg>;
}
function IcoPeople({ color }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}
function IcoMapPin({ color }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
}
function IcoPhone({ color }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l1.07-1.07a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
}
function IcoClock({ color }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function IcoUser({ color }) {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function IcoChevLeft() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function IcoChevRight() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
function IcoX() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getEventIcon(iv) {
  const loc = (iv.location || "").toLowerCase();
  if (loc.includes("meet") || loc.includes("zoom") || loc.includes("teams"))
    return { icon: <IcoVideo color={ACCENT} />,   bg: ACCENT_L,  label: "Video Call" };
  if (loc.includes("phone"))
    return { icon: <IcoPhone color={WARN} />,     bg: WARN_L,    label: "Phone Call" };
  if (loc.includes("office") || loc.includes("person"))
    return { icon: <IcoMapPin color={SUCCESS} />, bg: SUCCESS_L, label: "In Person" };
  return   { icon: <IcoPeople color={PURPLE} />,  bg: PURPLE_L,  label: "Meeting" };
}

function fmtDuration(mins) {
  if (!mins) return "";
  if (mins < 60) return `${mins} mins`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m > 0 ? `${h} hr ${m} mins` : `${h} hour${h > 1 ? "s" : ""}`;
}

// ── Shared field style ─────────────────────────────────────────────────────
const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "10px", fontSize: 13, bgcolor: "#FAFBFD",
    "& fieldset": { borderColor: BORDER },
    "&:hover fieldset": { borderColor: "#C0C8D8" },
    "&.Mui-focused fieldset": { borderColor: ACCENT },
  },
};

// ── FormField ──────────────────────────────────────────────────────────────
function FormField({ label, required, children }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT, mb: 0.75 }}>
        {label}{required && <Box component="span" sx={{ color: DANGER }}> *</Box>}
      </Typography>
      {children}
    </Box>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, primary = false }) {
  return (
    <Box sx={{
      bgcolor: primary ? ACCENT : SURFACE,
      border: primary ? "none" : `1px solid ${BORDER}`,
      borderRadius: "16px", p: 2.5,
      boxShadow: primary ? "0 4px 20px rgba(29,114,232,0.22)" : "0 1px 4px rgba(15,22,35,0.04)",
    }}>
      <Box sx={{ mb: 1.5 }}>{icon}</Box>
      <Typography sx={{ fontSize: 12.5, fontWeight: 500, color: primary ? "rgba(255,255,255,0.75)" : MUTED, mb: 0.75 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: primary ? "#fff" : TEXT, mb: 0.5 }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 12, color: primary ? "rgba(255,255,255,0.65)" : MUTED }}>
        {sub}
      </Typography>
    </Box>
  );
}

// ── Calendly-style Date & Time picker ─────────────────────────────────────
const TIME_STEP_MINUTES  = 15;
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR   = 18; // exclusive — last slot is 17:45

function buildTimeSlots() {
  const slots = [];
  for (let h = BUSINESS_START_HOUR; h < BUSINESS_END_HOUR; h++) {
    for (let m = 0; m < 60; m += TIME_STEP_MINUTES) slots.push({ h, m });
  }
  return slots;
}
const TIME_SLOTS = buildTimeSlots();

function pad2(n) { return String(n).padStart(2, "0"); }

function formatTimeLabel(h, m) {
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(m)} ${period}`;
}

function toLocalInputValue(date, h, m) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(h)}:${pad2(m)}`;
}

function DateTimePicker({ value, onChange, error }) {
  const initial = value ? new Date(value) : null;
  const [month, setMonth]               = useState(() => initial ? new Date(initial.getFullYear(), initial.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(initial);

  // Keep in sync if the parent sets scheduledAt externally (reschedule, reset on close)
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setSelectedDate(d);
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const year = month.getFullYear(), mo = month.getMonth();
  const firstDayWeekday = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const isCurrentOrPastMonth = year < today.getFullYear() || (year === today.getFullYear() && mo <= today.getMonth());

  const cells = [];
  for (let i = 0; i < firstDayWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isPast(d) {
    const dt = new Date(year, mo, d); dt.setHours(0, 0, 0, 0);
    return dt < today;
  }
  function isSelected(d) {
    return !!selectedDate && selectedDate.getFullYear() === year && selectedDate.getMonth() === mo && selectedDate.getDate() === d;
  }

  function pickDay(d) {
    if (isPast(d)) return;
    const dt = new Date(year, mo, d);
    const hadTime = !!selectedDate;
    if (hadTime) dt.setHours(selectedDate.getHours(), selectedDate.getMinutes());
    setSelectedDate(dt);
    if (hadTime) onChange(toLocalInputValue(dt, dt.getHours(), dt.getMinutes()));
  }

  function pickTime(h, m) {
    if (!selectedDate) return;
    const dt = new Date(selectedDate);
    dt.setHours(h, m, 0, 0);
    setSelectedDate(dt);
    onChange(toLocalInputValue(dt, h, m));
  }

  const selectedHour = selectedDate ? selectedDate.getHours() : null;
  const selectedMinute = selectedDate ? selectedDate.getMinutes() : null;

  return (
    <Box sx={{ display: "flex", gap: 2, border: `1px solid ${error ? DANGER : BORDER}`, borderRadius: "10px", p: 2, bgcolor: "#fff" }}>
      {/* Calendar pane */}
      <Box sx={{ flex: 1.1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Box onClick={() => { if (!isCurrentOrPastMonth) setMonth(new Date(year, mo - 1, 1)); }}
            sx={{ cursor: isCurrentOrPastMonth ? "default" : "pointer", opacity: isCurrentOrPastMonth ? 0.3 : 1,
              width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              "&:hover": isCurrentOrPastMonth ? {} : { bgcolor: "#F1F3F7" } }}>‹</Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
            {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Typography>
          <Box onClick={() => setMonth(new Date(year, mo + 1, 1))}
            sx={{ cursor: "pointer", width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              "&:hover": { bgcolor: "#F1F3F7" } }}>›</Box>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px", mb: 0.5 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <Typography key={i} sx={{ fontSize: 10, fontWeight: 600, color: MUTED, textAlign: "center" }}>{d}</Typography>
          ))}
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px" }}>
          {cells.map((d, i) => d === null ? <Box key={i} /> : (
            <Box key={i} onClick={() => pickDay(d)}
              sx={{
                width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12.5, fontWeight: 600, mx: "auto",
                cursor: isPast(d) ? "default" : "pointer",
                color: isPast(d) ? "#C2C8D4" : isSelected(d) ? "#fff" : TEXT,
                bgcolor: isSelected(d) ? ACCENT : "transparent",
                "&:hover": isPast(d) ? {} : { bgcolor: isSelected(d) ? ACCENT : ACCENT_L },
              }}>
              {d}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Time slots pane */}
      <Box sx={{ flex: 0.9, minWidth: 0, borderLeft: `1px solid ${BORDER}`, pl: 2 }}>
        {!selectedDate ? (
          <Typography sx={{ fontSize: 12, color: MUTED, textAlign: "center", mt: 4 }}>Select a date first</Typography>
        ) : (
          <>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: TEXT, mb: 1 }}>
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, maxHeight: 220, overflowY: "auto", pr: 0.5 }}>
              {TIME_SLOTS.map(({ h, m }) => {
                const active = selectedHour === h && selectedMinute === m;
                return (
                  <Box key={`${h}:${m}`} onClick={() => pickTime(h, m)}
                    sx={{
                      textAlign: "center", py: 0.85, borderRadius: "8px", fontSize: 12.5, fontWeight: 600,
                      cursor: "pointer", border: `1px solid ${active ? ACCENT : BORDER}`,
                      color: active ? "#fff" : TEXT, bgcolor: active ? ACCENT : "#fff",
                      "&:hover": { borderColor: ACCENT, bgcolor: active ? ACCENT : ACCENT_L },
                    }}>
                    {formatTimeLabel(h, m)}
                  </Box>
                );
              })}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

// ── Schedule Modal ─────────────────────────────────────────────────────────
function ScheduleModal({ form, updateForm, handleCandidateChange, candidates, saving, error, conflictWarning, conflictChecking, onSchedule, onClose }) {
  return (
    <Box
      sx={{ position:"fixed", inset:0, zIndex:1300, display:"flex", alignItems:"center", justifyContent:"center", bgcolor:"rgba(15,22,35,0.5)", backdropFilter:"blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Box sx={{ bgcolor:SURFACE, borderRadius:"16px", width:"min(700px,95vw)", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(15,22,35,0.2)" }}>
        {/* Header */}
        <Box sx={{ px:3, py:2.25, borderBottom:`1px solid ${BORDER}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <Typography sx={{ fontSize:17, fontWeight:700, color:TEXT }}>Schedule Interview</Typography>
          <Box onClick={onClose} sx={{ width:30, height:30, borderRadius:"50%", bgcolor:"#F1F3F7", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", "&:hover":{bgcolor:BORDER} }}>
            <IcoX />
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ p:3, display:"flex", flexDirection:"column", gap:2.25 }}>
          {error && <Alert severity="error" sx={{ fontSize:12 }}>{error}</Alert>}
          {conflictWarning && !conflictChecking && (
            <Box sx={{ bgcolor:DANGER_L, border:`1px solid ${DANGER_BR}`, borderRadius:"8px", px:1.5, py:1 }}>
              <Typography sx={{ fontSize:12, fontWeight:600, color:DANGER }}>⚠ {conflictWarning}</Typography>
            </Box>
          )}

          <Box sx={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2 }}>
            <FormField label="Candidate" required>
              <TextField select fullWidth size="small" value={form.candidateId} onChange={e => handleCandidateChange(e.target.value)} sx={fieldSx}>
                <MenuItem value="" sx={{ fontSize:13 }}>Select candidate</MenuItem>
                {candidates.map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize:13 }}>{c.name}</MenuItem>)}
              </TextField>
            </FormField>
            <FormField label="Interview Type">
              <TextField select fullWidth size="small" value={form.interviewType} onChange={e => updateForm("interviewType", e.target.value)} sx={fieldSx}>
                {INTERVIEW_TYPES.map(t => <MenuItem key={t} value={t} sx={{ fontSize:13 }}>{t}</MenuItem>)}
              </TextField>
            </FormField>
          </Box>

          <FormField label="Date & Time" required>
            <DateTimePicker value={form.scheduledAt} onChange={v => updateForm("scheduledAt", v)} error={!!conflictWarning} />
            {conflictChecking && (
              <Box sx={{ display:"flex", alignItems:"center", gap:0.5, mt:0.5 }}>
                <CircularProgress size={10} sx={{ color:MUTED }} />
                <Typography sx={{ fontSize:10, color:MUTED }}>Checking availability…</Typography>
              </Box>
            )}
          </FormField>

          <Box sx={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2 }}>
            <FormField label="Duration (minutes)">
              <TextField select fullWidth size="small" value={form.durationMinutes} onChange={e => updateForm("durationMinutes", Number(e.target.value))} sx={fieldSx}>
                {DURATIONS.map(d => <MenuItem key={d} value={d} sx={{ fontSize:13 }}>{d} min</MenuItem>)}
              </TextField>
            </FormField>
            <FormField label="Location / Format">
              <TextField select fullWidth size="small" value={form.location} onChange={e => updateForm("location", e.target.value)} sx={fieldSx}>
                {LOCATIONS.map(l => <MenuItem key={l} value={l} sx={{ fontSize:13 }}>{l}</MenuItem>)}
              </TextField>
            </FormField>
          </Box>

          <FormField label="Meeting Link">
            <TextField fullWidth size="small" value={form.meetingLink} onChange={e => updateForm("meetingLink", e.target.value)} placeholder="https://meet.google.com/..." sx={fieldSx} />
          </FormField>

          <FormField label="Notes">
            <TextField multiline rows={3} fullWidth value={form.notes} onChange={e => updateForm("notes", e.target.value)} placeholder="Any prep notes for the interviewer..." sx={fieldSx} />
          </FormField>

          <Box onClick={onSchedule} sx={{
            display:"flex", alignItems:"center", justifyContent:"center",
            bgcolor: conflictWarning ? "#FEE2E2" : ACCENT,
            borderRadius:"10px", py:1.5, cursor: saving || conflictWarning ? "not-allowed" : "pointer",
            opacity: saving || conflictWarning ? 0.75 : 1,
            "&:hover": { bgcolor: conflictWarning ? "#FEE2E2" : "#1660CC" },
            transition:"background .15s",
          }}>
            {saving
              ? <CircularProgress size={16} sx={{ color:"#fff" }} />
              : <Typography sx={{ fontSize:14, fontWeight:600, color:"#fff" }}>Schedule Interview</Typography>
            }
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function SchedulerPage() {
  const nav      = useNavigate();
  const location = useLocation();
  const loginId  = localStorage.getItem("loginId") || "";

  const [candidates,       setCandidates]       = useState([]);
  const [scheduled,        setScheduled]        = useState([]);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState(null);
  const [success,          setSuccess]          = useState(false);
  const [conflictWarning,  setConflictWarning]  = useState(null);
  const [conflictChecking, setConflictChecking] = useState(false);
  const [form, setForm] = useState({
    candidateId:"", jobId:"", interviewer:"", interviewType:"Technical",
    scheduledAt:"", durationMinutes:60, location:"Google Meet", meetingLink:"", notes:"",
  });

  // New UI state
  const [view,        setView]        = useState("calendar");
  const [showModal,   setShowModal]   = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [calMonth,    setCalMonth]    = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    Promise.all([apiGet("/api/candidates/list"), apiGet("/api/interviews")])
      .then(([c, s]) => { setCandidates(c.filter(cand => cand.jobId)); setScheduled(s); })
      .catch(e => setError(e.message));
  }, [loginId]);

  function updateForm(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function handleCandidateChange(candId) {
    const cand = candidates.find(c => c.id === candId);
    setForm(p => ({ ...p, candidateId: candId, jobId: cand?.jobId || "" }));
    setConflictWarning(null);
  }

  // Arriving from a candidate's page ("Schedule Interview" button) — pre-select
  // that candidate and open the schedule form directly, once candidates are loaded.
  const prefillHandled = useRef(false);
  useEffect(() => {
    if (prefillHandled.current || candidates.length === 0) return;
    const candidateId = location.state?.candidateId;
    if (!candidateId) return;
    prefillHandled.current = true;
    handleCandidateChange(candidateId);
    setShowModal(true);
  }, [candidates, location.state]);

  const checkConflict = useCallback(async (candidateId, scheduledAt, durationMinutes) => {
    if (!candidateId || !scheduledAt) { setConflictWarning(null); return; }
    setConflictChecking(true);
    try {
      const isoTime = new Date(scheduledAt).toISOString();
      const url = new URL(`${API_BASE}/api/interviews/check-conflict`);
      url.searchParams.set("loginId", loginId);
      url.searchParams.set("candidateId", candidateId);
      url.searchParams.set("scheduledAt", isoTime);
      url.searchParams.set("durationMinutes", durationMinutes);
      const res  = await fetch(url.toString(), { headers:{ Authorization:`Bearer ${localStorage.getItem("sessionToken")||""}` } });
      const data = await res.json();
      setConflictWarning(data.conflict ? data.message : null);
    } catch { setConflictWarning(null); }
    finally  { setConflictChecking(false); }
  }, [loginId]);

  useEffect(() => {
    checkConflict(form.candidateId, form.scheduledAt, form.durationMinutes);
  }, [form.candidateId, form.scheduledAt, form.durationMinutes, checkConflict]);

  async function handleSchedule() {
    if (!form.candidateId || !form.scheduledAt) { setError("Candidate and date/time are required."); return; }
    if (conflictWarning) { setError(conflictWarning); return; }
    setSaving(true); setError(null); setSuccess(false);
    try {
      const url = new URL(`${API_BASE}/api/interviews/schedule`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("sessionToken")||""}` },
        body: JSON.stringify({ ...form, scheduledAt: new Date(form.scheduledAt).toISOString() }),
      });
      if (!res.ok) throw new Error(await res.text());
      const newInterview = await res.json();
      setScheduled(p => [newInterview, ...p]);
      setSuccess(true);
      setConflictWarning(null);
      setForm(p => ({ ...p, candidateId:"", scheduledAt:"", meetingLink:"", notes:"" }));
      setShowModal(false);
    } catch(e) { setError(e.message); }
    finally    { setSaving(false); }
  }

  async function handleCancel(interviewId) {
    try {
      const url = new URL(`${API_BASE}/api/interviews/${interviewId}/cancel`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { method:"PATCH", headers:{ Authorization:`Bearer ${localStorage.getItem("sessionToken")||""}` } });
      if (!res.ok) throw new Error(await res.text());
      setScheduled(p => p.map(iv => iv.id === interviewId ? { ...iv, status:"Cancelled" } : iv));
    } catch(e) { setError(e.message); }
  }

  function handleReschedule(iv) {
    const dt = iv.scheduledAt ? new Date(iv.scheduledAt).toISOString().slice(0,16) : "";
    setForm({
      candidateId:     iv.candidateId     || "",
      jobId:           iv.jobId           || "",
      interviewer:     iv.interviewer     || "",
      interviewType:   iv.interviewType   || "Technical",
      scheduledAt:     dt,
      durationMinutes: iv.durationMinutes || 60,
      location:        iv.location        || "Google Meet",
      meetingLink:     iv.meetingLink     || "",
      notes:           iv.notes           || "",
    });
    setConflictWarning(null);
    setShowModal(true);
  }

  function toIcsDate(dateStr) { return new Date(dateStr).toISOString().replace(/[-:.]/g,"").slice(0,15)+"Z"; }

  function buildIcs(iv) {
    const start = new Date(iv.scheduledAt);
    const end   = new Date(start.getTime() + (iv.durationMinutes||60)*60_000);
    const stamp = new Date();
    const uid   = `${stamp.getTime()}-${Math.random().toString(36).slice(2)}@nolyvra.com`;
    const descParts = [
      iv.notes       ? `Notes: ${iv.notes}`             : "",
      iv.meetingLink ? `Meeting Link: ${iv.meetingLink}` : "",
      iv.interviewer ? `Interviewer: ${iv.interviewer}`  : "",
    ].filter(Boolean);
    return [
      "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Nolyvra//Interview Scheduler//EN",
      "CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT",
      `UID:${uid}`,`DTSTAMP:${toIcsDate(stamp.toISOString())}`,
      `DTSTART:${toIcsDate(start.toISOString())}`,`DTEND:${toIcsDate(end.toISOString())}`,
      `SUMMARY:${iv.interviewType||"Interview"} — ${iv.candidateName}`,
      descParts.length ? `DESCRIPTION:${descParts.join("\\n")}` : "",
      iv.location    ? `LOCATION:${iv.location}`    : "",
      iv.meetingLink ? `URL:${iv.meetingLink}`       : "",
      "END:VEVENT","END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
  }

  function downloadIcs(iv) {
    const blob = new Blob([buildIcs(iv)], { type:"text/calendar;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "nolyvra-interview.ics"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Computed stats ────────────────────────────────────────────────────────
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate()-now.getDay()); weekStart.setHours(0,0,0,0);
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+7);

  const thisWeekCount = scheduled.filter(iv =>
    iv.scheduledAt && iv.status==="Scheduled" &&
    new Date(iv.scheduledAt)>=weekStart && new Date(iv.scheduledAt)<weekEnd
  ).length;

  const todayCount = scheduled.filter(iv =>
    iv.scheduledAt && iv.status==="Scheduled" &&
    new Date(iv.scheduledAt).toDateString()===now.toDateString()
  ).length;

  const videoCallCount = scheduled.filter(iv => {
    if (!iv.scheduledAt || iv.status==="Cancelled") return false;
    const d=new Date(iv.scheduledAt), loc=(iv.location||"").toLowerCase();
    return d>=weekStart && d<weekEnd && (loc.includes("meet")||loc.includes("zoom")||loc.includes("teams"));
  }).length;

  const interviewerCount = [...new Set(
    scheduled.filter(iv => iv.interviewer && iv.scheduledAt &&
      new Date(iv.scheduledAt).getMonth()===now.getMonth() &&
      new Date(iv.scheduledAt).getFullYear()===now.getFullYear()
    ).map(iv => iv.interviewer)
  )].length;

  // ── Calendar logic ────────────────────────────────────────────────────────
  const calYear     = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const firstDow    = new Date(calYear, calMonthIdx, 1).getDay();
  const daysInMonth = new Date(calYear, calMonthIdx+1, 0).getDate();
  const calDays     = [...Array(firstDow).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];
  while (calDays.length%7!==0) calDays.push(null);

  const daysWithEvents = new Set(
    scheduled
      .filter(iv => iv.scheduledAt && iv.status!=="Cancelled" &&
        new Date(iv.scheduledAt).getMonth()===calMonthIdx &&
        new Date(iv.scheduledAt).getFullYear()===calYear)
      .map(iv => new Date(iv.scheduledAt).getDate())
  );

  const dayEvents = scheduled
    .filter(iv => {
      if (!iv.scheduledAt) return false;
      const d = new Date(iv.scheduledAt);
      return d.getDate()===selectedDay.getDate() && d.getMonth()===selectedDay.getMonth() && d.getFullYear()===selectedDay.getFullYear();
    })
    .sort((a,b) => new Date(a.scheduledAt)-new Date(b.scheduledAt));

  const filteredScheduled = scheduled.filter(iv => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (iv.candidateName||"").toLowerCase().includes(q) ||
      (iv.jobTitle||"").toLowerCase().includes(q) ||
      (iv.interviewType||"").toLowerCase().includes(q) ||
      (iv.interviewer||"").toLowerCase().includes(q);
  });

  const monthLabel       = calMonth.toLocaleDateString("en-GB",{month:"long",year:"numeric"});
  const selectedDayLabel = selectedDay.toLocaleDateString("en-GB",{month:"long",day:"numeric",year:"numeric"});

  return (
    <>
      {showModal && (
        <ScheduleModal
          form={form} updateForm={updateForm} handleCandidateChange={handleCandidateChange}
          candidates={candidates} saving={saving} error={error}
          conflictWarning={conflictWarning} conflictChecking={conflictChecking}
          onSchedule={handleSchedule}
          onClose={() => { setShowModal(false); setError(null); }}
        />
      )}

      <Box sx={{ display:"flex", flexDirection:"column", gap:2.5 }}>
        {success && <Alert severity="success" onClose={() => setSuccess(false)}>Interview scheduled successfully!</Alert>}

        {/* ── Header row ── */}
        <Box sx={{ display:"flex", alignItems:"center", gap:2 }}>
          <Box onClick={() => nav("/dashboard")} sx={{ display:"flex", alignItems:"center", gap:0.75, cursor:"pointer", color:TEXT, fontSize:13, fontWeight:500, userSelect:"none", flexShrink:0, "&:hover":{color:ACCENT} }}>
            <IcoBack /> Back to Dashboard
          </Box>

          <Box sx={{ flex:1, maxWidth:420, display:"flex", alignItems:"center", gap:1, bgcolor:SURFACE, border:`1px solid ${BORDER}`, borderRadius:"50px", px:1.75, py:"8px" }}>
            <IcoSearch />
            <Box component="input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search interviews..."
              sx={{ flex:1, border:"none", outline:"none", fontSize:13, color:TEXT, bgcolor:"transparent", "::placeholder":{color:MUTED} }} />
          </Box>

          <Box sx={{ ml:"auto", display:"flex", gap:1.25, alignItems:"center" }}>
            <Box sx={{ display:"flex", alignItems:"center", gap:0.75, border:`1px solid ${BORDER}`, borderRadius:"10px", px:1.75, py:"8px", cursor:"pointer", color:TEXT, fontSize:13, fontWeight:500, bgcolor:SURFACE, userSelect:"none", "&:hover":{borderColor:"#C0C8D8"} }}>
              <IcoFilter /> Filter
            </Box>
            <Box onClick={() => { setForm(p=>({...p,candidateId:"",scheduledAt:"",meetingLink:"",notes:""})); setError(null); setConflictWarning(null); setShowModal(true); }} sx={{ display:"flex", alignItems:"center", gap:0.75, bgcolor:ACCENT, borderRadius:"10px", px:2, py:"8px", cursor:"pointer", color:"#fff", fontSize:13, fontWeight:600, userSelect:"none", boxShadow:"0 2px 8px rgba(29,114,232,0.25)", "&:hover":{bgcolor:"#1660CC"} }}>
              + Schedule Interview
            </Box>
          </Box>
        </Box>

        {/* ── Title ── */}
        <Box>
          <Typography sx={{ fontSize:22, fontWeight:700, color:TEXT, lineHeight:1.2 }}>Interview Scheduler</Typography>
          <Typography sx={{ fontSize:13, color:MUTED, mt:0.5 }}>Manage and schedule all your interviews in one place</Typography>
        </Box>

        {/* ── Stats ── */}
        <Box sx={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:2 }}>
          <StatCard label="This Week"    value={thisWeekCount}    sub="Scheduled interviews" primary icon={<IcoCalendarStat color="#fff" />} />
          <StatCard label="Today"        value={todayCount}       sub="Interviews scheduled"        icon={<IcoClockStat    color={ACCENT} />} />
          <StatCard label="Video Calls"  value={videoCallCount}   sub="This week"                   icon={<IcoVideoStat    color={ACCENT} />} />
          <StatCard label="Interviewers" value={interviewerCount} sub="Active this month"            icon={<IcoPeopleStat   color={ACCENT} />} />
        </Box>

        {/* ── View toggle ── */}
        <Box sx={{ display:"flex", borderBottom:`1px solid ${BORDER}` }}>
          {[["calendar","Calendar View"],["list","List View"]].map(([v,label]) => (
            <Box key={v} onClick={() => setView(v)} sx={{ px:2.5, py:1, fontSize:13, fontWeight:500, cursor:"pointer", userSelect:"none", color:view===v?ACCENT:MUTED, borderBottom:`2px solid ${view===v?ACCENT:"transparent"}`, mb:"-1px", transition:"color .15s, border-color .15s" }}>
              {label}
            </Box>
          ))}
        </Box>

        {/* ── Calendar view ── */}
        {view==="calendar" && (
          <Box sx={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2, alignItems:"start" }}>
            {/* Calendar card */}
            <Box sx={{ bgcolor:SURFACE, border:`1px solid ${BORDER}`, borderRadius:"16px", p:2.5, boxShadow:"0 1px 4px rgba(15,22,35,0.04)" }}>
              <Box sx={{ display:"flex", alignItems:"center", justifyContent:"space-between", mb:2.5 }}>
                <Typography sx={{ fontSize:18, fontWeight:700, color:TEXT }}>{monthLabel}</Typography>
                <Box sx={{ display:"flex", gap:0.75 }}>
                  {[
                    { fn:() => setCalMonth(m=>new Date(m.getFullYear(),m.getMonth()-1)), ico:<IcoChevLeft/> },
                    { fn:() => setCalMonth(m=>new Date(m.getFullYear(),m.getMonth()+1)), ico:<IcoChevRight/> },
                  ].map((b,i) => (
                    <Box key={i} onClick={b.fn} sx={{ width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", bgcolor:"#F1F3F7", cursor:"pointer", color:TEXT, "&:hover":{bgcolor:BORDER} }}>
                      {b.ico}
                    </Box>
                  ))}
                </Box>
              </Box>

              <Box sx={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", mb:1 }}>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                  <Typography key={d} sx={{ fontSize:10.5, fontWeight:600, color:MUTED, textAlign:"center", py:0.5, textTransform:"uppercase", letterSpacing:"0.5px" }}>{d}</Typography>
                ))}
              </Box>

              <Box sx={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"2px" }}>
                {calDays.map((day, idx) => {
                  if (!day) return <Box key={idx} />;
                  const dayDate   = new Date(calYear, calMonthIdx, day);
                  const isToday   = dayDate.toDateString()===now.toDateString();
                  const isSelected= dayDate.toDateString()===selectedDay.toDateString();
                  const hasEvents = daysWithEvents.has(day);
                  return (
                    <Box key={idx} onClick={() => setSelectedDay(dayDate)} sx={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", py:"7px", cursor:"pointer", borderRadius:"10px", gap:"4px", bgcolor:isSelected?ACCENT:isToday?ACCENT_L:"transparent", "&:hover":{bgcolor:isSelected?ACCENT:"#F1F3F7"} }}>
                      <Typography sx={{ fontSize:13, fontWeight:isToday||isSelected?700:400, color:isSelected?"#fff":isToday?ACCENT:TEXT, lineHeight:1 }}>{day}</Typography>
                      {hasEvents && <Box sx={{ width:4, height:4, borderRadius:"50%", bgcolor:isSelected?"rgba(255,255,255,0.7)":ACCENT }} />}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Day detail panel */}
            <Box sx={{ bgcolor:SURFACE, border:`1px solid ${BORDER}`, borderRadius:"16px", overflow:"hidden", boxShadow:"0 1px 4px rgba(15,22,35,0.04)" }}>
              <Box sx={{ px:2.5, py:2, borderBottom:`1px solid ${BORDER}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <Typography sx={{ fontSize:15, fontWeight:700, color:TEXT }}>{selectedDayLabel}</Typography>
                {dayEvents.length>0 && (
                  <Box sx={{ bgcolor:ACCENT_L, border:`1px solid ${ACCENT_BR}`, borderRadius:"20px", px:1.5, py:"3px", fontSize:12, fontWeight:600, color:ACCENT }}>
                    {dayEvents.length} event{dayEvents.length!==1?"s":""}
                  </Box>
                )}
              </Box>

              <Box sx={{ maxHeight:500, overflowY:"auto", p:dayEvents.length?2:0 }}>
                {dayEvents.length===0 ? (
                  <Box sx={{ py:6, textAlign:"center" }}>
                    <Typography sx={{ fontSize:13, color:MUTED }}>No events on this day.</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display:"flex", flexDirection:"column", gap:1.5 }}>
                    {dayEvents.map(iv => {
                      const { icon, bg, label:typeLabel } = getEventIcon(iv);
                      const timeStr = new Date(iv.scheduledAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"});
                      return (
                        <Box key={iv.id} sx={{ border:`1px solid ${BORDER}`, borderRadius:"12px", p:2, bgcolor:SURFACE }}>
                          <Box sx={{ display:"flex", gap:1.5, mb:1.25 }}>
                            <Box sx={{ width:40, height:40, borderRadius:"10px", bgcolor:bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                              {icon}
                            </Box>
                            <Box>
                              <Typography sx={{ fontSize:14, fontWeight:700, color:TEXT }}>
                                {iv.candidateName ? `Interview with ${iv.candidateName}` : iv.interviewType || "Interview"}
                              </Typography>
                              <Typography sx={{ fontSize:12, color:MUTED }}>{typeLabel}</Typography>
                            </Box>
                          </Box>

                          <Box sx={{ display:"flex", flexDirection:"column", gap:0.6, mb:1.5, pl:0.25 }}>
                            <Box sx={{ display:"flex", alignItems:"center", gap:0.75 }}>
                              <IcoClock color={MUTED} />
                              <Typography sx={{ fontSize:12, color:TEXT }}>{timeStr}{iv.durationMinutes ? ` · ${fmtDuration(iv.durationMinutes)}` : ""}</Typography>
                            </Box>
                            {iv.candidateName && (
                              <Box sx={{ display:"flex", alignItems:"center", gap:0.75 }}>
                                <IcoUser color={MUTED} />
                                <Typography sx={{ fontSize:12, color:TEXT }}>{iv.candidateName}</Typography>
                              </Box>
                            )}
                            {iv.interviewer && (
                              <Box sx={{ display:"flex", alignItems:"center", gap:0.75 }}>
                                <IcoUser color={MUTED} />
                                <Typography sx={{ fontSize:12, color:MUTED }}>Interviewer: {iv.interviewer}</Typography>
                              </Box>
                            )}
                          </Box>

                          {iv.status==="Scheduled" && (
                            <Box sx={{ display:"flex", gap:1 }}>
                              {iv.meetingLink && (
                                <Box component="a" href={iv.meetingLink} target="_blank" rel="noopener noreferrer" sx={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", bgcolor:ACCENT, color:"#fff", borderRadius:"8px", py:"9px", fontSize:13, fontWeight:600, textDecoration:"none", "&:hover":{bgcolor:"#1660CC"} }}>
                                  Join Meeting
                                </Box>
                              )}
                              <Box onClick={() => handleReschedule(iv)} sx={{ flex: iv.meetingLink?"0 0 auto":1, display:"flex", alignItems:"center", justifyContent:"center", border:`1px solid ${BORDER}`, borderRadius:"8px", py:"9px", px:iv.meetingLink?2:0, fontSize:13, fontWeight:500, color:TEXT, cursor:"pointer", "&:hover":{borderColor:"#C0C8D8", bgcolor:"#F8F9FB"} }}>
                                Reschedule
                              </Box>
                              <Box onClick={() => downloadIcs(iv)} sx={{ width:38, display:"flex", alignItems:"center", justifyContent:"center", border:`1px solid ${BORDER}`, borderRadius:"8px", py:"9px", cursor:"pointer", fontSize:15, "&:hover":{borderColor:"#C0C8D8",bgcolor:"#F8F9FB"} }} title="Add to Calendar">
                                📅
                              </Box>
                            </Box>
                          )}
                          {iv.status==="Cancelled" && (
                            <Box sx={{ bgcolor:DANGER_L, border:`1px solid ${DANGER_BR}`, borderRadius:"8px", px:1.5, py:0.75, textAlign:"center" }}>
                              <Typography sx={{ fontSize:12, color:DANGER, fontWeight:600 }}>Cancelled</Typography>
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* ── List view ── */}
        {view==="list" && (
          <Box sx={{ bgcolor:SURFACE, border:`1px solid ${BORDER}`, borderRadius:"16px", overflow:"hidden", boxShadow:"0 1px 4px rgba(15,22,35,0.04)" }}>
            <Box sx={{ px:2.5, py:1.75, borderBottom:`1px solid ${BORDER}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <Typography sx={{ fontSize:14, fontWeight:600, color:TEXT }}>All Interviews</Typography>
              <Typography sx={{ fontSize:12, color:MUTED }}>{filteredScheduled.length} result{filteredScheduled.length!==1?"s":""}</Typography>
            </Box>

            {filteredScheduled.length===0 ? (
              <Box sx={{ py:7, textAlign:"center" }}>
                <Typography sx={{ fontSize:13, color:MUTED }}>
                  {scheduled.length===0 ? "No interviews scheduled yet." : "No results matching your search."}
                </Typography>
              </Box>
            ) : filteredScheduled.map((iv, i) => {
              const { icon, bg } = getEventIcon(iv);
              const dateStr = iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"}) : "—";
              const timeStr = iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "";
              const statusColor = iv.status==="Scheduled"?ACCENT:iv.status==="Completed"?SUCCESS:MUTED;
              const statusBg    = iv.status==="Scheduled"?ACCENT_L:iv.status==="Completed"?SUCCESS_L:"#F1F3F7";
              const statusBr    = iv.status==="Scheduled"?ACCENT_BR:iv.status==="Completed"?SUCCESS_BR:BORDER;
              return (
                <Box key={iv.id} sx={{ display:"flex", alignItems:"center", gap:2, px:2.5, py:1.75, borderBottom:i<filteredScheduled.length-1?`1px solid #F4F5F8`:"none", "&:hover":{bgcolor:"#FAFBFD"} }}>
                  <Box sx={{ width:38, height:38, borderRadius:"10px", bgcolor:bg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    {icon}
                  </Box>
                  <Box sx={{ flex:1, minWidth:0 }}>
                    <Typography sx={{ fontSize:13, fontWeight:600, color:TEXT }}>{iv.candidateName}</Typography>
                    <Typography sx={{ fontSize:11.5, color:MUTED }}>{iv.jobTitle} · {iv.interviewType}{iv.interviewer?` · ${iv.interviewer}`:""}</Typography>
                  </Box>
                  <Box sx={{ textAlign:"right", flexShrink:0 }}>
                    <Typography sx={{ fontSize:12, color:TEXT, fontWeight:500 }}>{dateStr}</Typography>
                    <Typography sx={{ fontSize:11.5, color:MUTED }}>{timeStr}{iv.durationMinutes?` · ${fmtDuration(iv.durationMinutes)}`:""}</Typography>
                  </Box>
                  <Box sx={{ bgcolor:statusBg, border:`1px solid ${statusBr}`, borderRadius:"20px", px:1.25, py:"3px", fontSize:11, fontWeight:600, color:statusColor, flexShrink:0 }}>
                    {iv.status}
                  </Box>
                  {iv.status==="Scheduled" && (
                    <Box sx={{ display:"flex", gap:0.75, flexShrink:0 }}>
                      <Box onClick={() => handleReschedule(iv)} sx={{ border:`1px solid ${BORDER}`, borderRadius:"7px", px:1.25, py:"5px", fontSize:11, fontWeight:500, color:TEXT, cursor:"pointer", "&:hover":{borderColor:ACCENT,color:ACCENT} }}>Reschedule</Box>
                      <Box onClick={() => handleCancel(iv.id)} sx={{ border:`1px solid ${BORDER}`, borderRadius:"7px", px:1.25, py:"5px", fontSize:11, fontWeight:500, color:MUTED, cursor:"pointer", "&:hover":{borderColor:DANGER,color:DANGER} }}>Cancel</Box>
                      <Box onClick={() => downloadIcs(iv)} sx={{ border:`1px solid ${BORDER}`, borderRadius:"7px", px:1.25, py:"5px", fontSize:11, cursor:"pointer", "&:hover":{borderColor:"#C0C8D8"} }} title="Add to Calendar">📅</Box>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
    </>
  );
}
