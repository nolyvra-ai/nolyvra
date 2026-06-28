import { useCallback, useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// ── Palette (CRMx green-teal accent to distinguish from ATS blue-purple) ──────
const C = {
  bg:          "#F7F8FA",
  white:       "#fff",
  border:      "#E8ECF2",
  borderSoft:  "#F0F2F6",
  text:        "#0F1623",
  textSec:     "#5A6480",
  textMuted:   "#9AA3B4",
  accent:      "#059669",
  accentBg:    "#ECFDF5",
  accentBr:    "#A7F3D0",
  purple:      "#0F766E",
  purpleBg:    "#F0FDFA",
  purpleBr:    "#99F6E4",
  success:     "#16A34A",
  successBg:   "#F0FDF4",
  successBr:   "#BBF7D0",
  danger:      "#DC2626",
  dangerBg:    "#FEF2F2",
  dangerBr:    "#FECACA",
  sidebar:     "#F8FFFE",
  historyThumb:"#A7F3D0",
};

const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` });

async function apiPost(path, loginId, body) {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiGet(path, loginId, extra = {}) {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: authHeader() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Welcome screen ────────────────────────────────────────────────────────────
function WelcomeScreen() {
  return (
    <Box sx={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      px: 4, textAlign: "center", gap: 2,
    }}>
      <Box sx={{
        position: "relative", width: 80, height: 80,
        display: "flex", alignItems: "center", justifyContent: "center", mb: 0.5,
      }}>
        <Box sx={{
          position: "absolute", width: 80, height: 80, borderRadius: "50%",
          border: "1.5px solid rgba(5,150,105,0.5)",
          animation: "crmRipple1 2.4s ease-out infinite",
          "@keyframes crmRipple1": { "0%": { transform: "scale(1)", opacity: 0.7 }, "100%": { transform: "scale(1.7)", opacity: 0 } },
        }} />
        <Box sx={{
          position: "absolute", width: 80, height: 80, borderRadius: "50%",
          border: "1.5px solid rgba(15,118,110,0.4)",
          animation: "crmRipple2 2.4s ease-out 0.9s infinite",
          "@keyframes crmRipple2": { "0%": { transform: "scale(1)", opacity: 0.6 }, "100%": { transform: "scale(1.65)", opacity: 0 } },
        }} />
        <Box sx={{
          position: "absolute", inset: -8, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(5,150,105,0.22) 0%, rgba(15,118,110,0.08) 50%, transparent 75%)",
          animation: "crmBreathe 3s ease-in-out infinite",
          "@keyframes crmBreathe": { "0%, 100%": { transform: "scale(0.95)", opacity: 0.7 }, "50%": { transform: "scale(1.08)", opacity: 1 } },
        }} />
        <Box sx={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(145deg, #059669 0%, #0F766E 55%, #065F46 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 32px rgba(5,150,105,0.4), 0 2px 8px rgba(15,118,110,0.25)",
          position: "relative", overflow: "hidden",
          animation: "crmIconBreathe 3s ease-in-out infinite",
          "@keyframes crmIconBreathe": {
            "0%":   { transform: "scale(0.82)", boxShadow: "0 4px 16px rgba(5,150,105,0.2)" },
            "50%":  { transform: "scale(1)",    boxShadow: "0 10px 40px rgba(5,150,105,0.55)" },
            "100%": { transform: "scale(0.82)", boxShadow: "0 4px 16px rgba(5,150,105,0.2)" },
          },
        }}>
          <Box sx={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.12) 20%, transparent 40%)",
            animation: "crmShimmer 4s linear infinite",
            "@keyframes crmShimmer": { from: { transform: "rotate(0deg)" }, to: { transform: "rotate(360deg)" } },
          }} />
          <Box sx={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%)",
            pointerEvents: "none",
          }} />
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <line x1="22" y1="22" x2="9"  y2="10" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="35" y2="10" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="9"  y2="34" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="35" y2="34" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="22" y2="5"  stroke="rgba(255,255,255,0.3)"  strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="5"  y2="22" stroke="rgba(255,255,255,0.3)"  strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="39" y2="22" stroke="rgba(255,255,255,0.3)"  strokeWidth="1.4" strokeLinecap="round"/>
            <circle cx="9"  cy="10" r="2.8" fill="rgba(255,255,255,0.75)"/>
            <circle cx="35" cy="10" r="2.8" fill="rgba(255,255,255,0.75)"/>
            <circle cx="9"  cy="34" r="2.8" fill="rgba(255,255,255,0.75)"/>
            <circle cx="35" cy="34" r="2.8" fill="rgba(255,255,255,0.75)"/>
            <circle cx="22" cy="5"  r="2.2" fill="rgba(255,255,255,0.55)"/>
            <circle cx="5"  cy="22" r="2.2" fill="rgba(255,255,255,0.55)"/>
            <circle cx="39" cy="22" r="2.2" fill="rgba(255,255,255,0.55)"/>
            <circle cx="22" cy="22" r="6.5" fill="rgba(255,255,255,0.95)"/>
            <path d="M22 16.5 L23.4 20.6 L27.5 22 L23.4 23.4 L22 27.5 L20.6 23.4 L16.5 22 L20.6 20.6 Z"
              fill="#059669" opacity="0.9"/>
          </svg>
        </Box>
      </Box>

      <Typography sx={{ fontSize: 22, fontWeight: 700, color: C.purple, letterSpacing: "-0.3px", lineHeight: 1.2 }}>
        How can I help with HR today?
      </Typography>
      <Typography sx={{ fontSize: 14, color: C.textSec, lineHeight: 1.65, maxWidth: 380 }}>
        Ask me to start a promotion, review a salary, approve leave requests, or navigate to any HR section.
      </Typography>
    </Box>
  );
}

// ── Message bubbles ───────────────────────────────────────────────────────────
function AiBubble({ message, pendingAction, onConfirm, onCancel, isLoading }) {
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
      <Box sx={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0, mt: "2px",
        background: "linear-gradient(145deg, #059669 0%, #0F766E 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 8px rgba(5,150,105,0.3)",
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="8" y1="8" x2="3"  y2="3.5"  stroke="rgba(255,255,255,0.5)"  strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="8" y1="8" x2="13" y2="3.5"  stroke="rgba(255,255,255,0.5)"  strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="8" y1="8" x2="3"  y2="12.5" stroke="rgba(255,255,255,0.5)"  strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="8" y1="8" x2="13" y2="12.5" stroke="rgba(255,255,255,0.5)"  strokeWidth="1.1" strokeLinecap="round"/>
          <circle cx="3"  cy="3.5"  r="1.4" fill="rgba(255,255,255,0.75)"/>
          <circle cx="13" cy="3.5"  r="1.4" fill="rgba(255,255,255,0.75)"/>
          <circle cx="3"  cy="12.5" r="1.4" fill="rgba(255,255,255,0.75)"/>
          <circle cx="13" cy="12.5" r="1.4" fill="rgba(255,255,255,0.75)"/>
          <circle cx="8" cy="8" r="3" fill="rgba(255,255,255,0.95)"/>
          <path d="M8 5.8 L8.7 7.3 L10.2 8 L8.7 8.7 L8 10.2 L7.3 8.7 L5.8 8 L7.3 7.3 Z"
            fill="#059669" opacity="0.9"/>
        </svg>
      </Box>
      <Box sx={{ maxWidth: "80%" }}>
        <Box sx={{
          bgcolor: C.white, border: `1px solid ${C.border}`,
          borderRadius: "0 10px 10px 10px", px: 1.75, py: 1.25,
          fontSize: 12.5, color: C.text, lineHeight: 1.6,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)", whiteSpace: "pre-wrap",
        }}>
          {isLoading
            ? <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={12} sx={{ color: C.accent }} />
                <Typography sx={{ fontSize: 12, color: C.textMuted }}>Thinking…</Typography>
              </Box>
            : message}

          {pendingAction && pendingAction.type !== "NONE" && (
            <Box sx={{ mt: 1.25, p: 1.25, bgcolor: C.purpleBg, border: `1px solid ${C.purpleBr}`, borderRadius: "8px" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.text, mb: 0.5 }}>Confirm action:</Typography>
              <Typography sx={{ fontSize: 11, color: C.textMuted, mb: 1, lineHeight: 1.5 }}>
                {pendingAction.description}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Box component="button" onClick={onConfirm} sx={{
                  fontSize: 11, bgcolor: C.accent, color: "#fff", border: "none",
                  borderRadius: "6px", px: 1.5, py: 0.625, cursor: "pointer",
                  "&:hover": { bgcolor: "#047857" },
                }}>✓ Yes, do it</Box>
                <Box component="button" onClick={onCancel} sx={{
                  fontSize: 11, bgcolor: "transparent", color: C.text,
                  border: `1px solid ${C.border}`, borderRadius: "6px",
                  px: 1.5, py: 0.625, cursor: "pointer",
                }}>Cancel</Box>
              </Box>
            </Box>
          )}
        </Box>
        <Typography sx={{ fontSize: 10, color: C.textMuted, mt: 0.5, ml: 0.5 }}>CRMx Co-worker</Typography>
      </Box>
    </Box>
  );
}

function UserBubble({ message }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Box sx={{ maxWidth: "80%" }}>
        <Box sx={{
          bgcolor: C.accent, borderRadius: "10px 0 10px 10px",
          px: 1.75, py: 1.25, fontSize: 12.5, color: "#fff",
          lineHeight: 1.6, whiteSpace: "pre-wrap",
        }}>{message}</Box>
        <Typography sx={{ fontSize: 10, color: C.textMuted, mt: 0.5, textAlign: "right", mr: 0.5 }}>You</Typography>
      </Box>
    </Box>
  );
}

// ── Thread item ───────────────────────────────────────────────────────────────
function ThreadItem({ session, isActive, onClick }) {
  const date = session.lastMessageAt
    ? new Date(session.lastMessageAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : "";
  return (
    <Box onClick={onClick} sx={{
      px: "10px", py: "8px", borderRadius: "7px", cursor: "pointer", mb: "1px",
      transition: "background .12s",
      bgcolor: isActive ? "#CCFBF1" : "transparent",
      "&:hover": { bgcolor: isActive ? "#CCFBF1" : "#ECFDF5" },
    }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 0.5 }}>
        <Typography sx={{
          fontSize: 12.5, fontWeight: isActive ? 600 : 500,
          color: isActive ? C.text : C.textSec,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
        }}>
          {session.title || "Untitled conversation"}
        </Typography>
        <Typography sx={{ fontSize: 10, color: C.textMuted, flexShrink: 0 }}>{date}</Typography>
      </Box>
      {session.preview && (
        <Typography sx={{
          fontSize: 11, color: C.textMuted, mt: "1px",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {session.preview}
        </Typography>
      )}
    </Box>
  );
}

// ── Tips panel ────────────────────────────────────────────────────────────────
const TRY_ASKING = [
  { eg: "Start a promotion for Sarah Johnson to Senior Marketing Manager", tags: ["Promotion", "HR Workflow"] },
  { eg: "Initiate a salary review for James Lee with a proposed salary of £65,000", tags: ["Salary Review"] },
  { eg: "Approve the pending leave requests for this week", tags: ["Leave", "Approve"] },
  { eg: "How many employees are on leave this month?", tags: ["Insight", "Leave"] },
  { eg: "Go to the onboarding page", tags: ["Navigate"] },
  { eg: "What promotions are currently in progress?", tags: ["Insight", "Promotion"] },
];
const PRO_TIPS = [
  { title: "Use full employee names", body: "Say 'Sarah Johnson' rather than just 'Sarah' — Co-worker will match against your employee records." },
  { title: "Review before confirming", body: "Co-worker will ask for confirmation before creating any workflow or approving leave. Take a moment to verify the details." },
  { title: "Navigate quickly", body: "Ask 'Go to grievances' or 'Open the disciplinary actions page' to jump to any CRM section instantly." },
];
const SHORTCUTS = [
  { label: "New chat",       key: "⌘ N" },
  { label: "Send message",   key: "↵" },
  { label: "New line",       key: "⇧ ↵" },
  { label: "Toggle history", key: "⌘ /" },
];

function TipsPanel() {
  return (
    <Box sx={{ flex: 1, overflowY: "auto", p: "16px 14px" }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", mb: 1 }}>
        TRY ASKING
      </Typography>
      {TRY_ASKING.map((t, i) => (
        <Box key={i} sx={{ mb: 1, p: "10px 12px", bgcolor: C.white, border: `1px solid ${C.border}`, borderRadius: "8px" }}>
          <Typography sx={{ fontSize: 12, color: C.text, lineHeight: 1.5, mb: 0.75 }}>{t.eg}</Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {t.tags.map(tag => (
              <Box key={tag} sx={{
                fontSize: 10, px: "7px", py: "2px", borderRadius: "4px",
                bgcolor: C.purpleBg, border: `1px solid ${C.purpleBr}`, color: C.purple, fontWeight: 600,
              }}>{tag}</Box>
            ))}
          </Box>
        </Box>
      ))}

      <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", mt: 2, mb: 1 }}>
        PRO TIPS
      </Typography>
      {PRO_TIPS.map((t, i) => (
        <Box key={i} sx={{ mb: 1, p: "10px 12px", bgcolor: C.white, border: `1px solid ${C.border}`, borderRadius: "8px" }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.text, mb: 0.5 }}>{t.title}</Typography>
          <Typography sx={{ fontSize: 11.5, color: C.textSec, lineHeight: 1.5 }}>{t.body}</Typography>
        </Box>
      ))}

      <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", mt: 2, mb: 1 }}>
        SHORTCUTS
      </Typography>
      {SHORTCUTS.map(s => (
        <Box key={s.label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: "6px", borderBottom: `1px solid ${C.borderSoft}` }}>
          <Typography sx={{ fontSize: 12, color: C.textSec }}>{s.label}</Typography>
          <Box component="kbd" sx={{
            fontSize: 10.5, px: "7px", py: "3px", borderRadius: "5px",
            bgcolor: C.bg, border: `1px solid ${C.border}`, color: C.text, fontFamily: "monospace",
          }}>{s.key}</Box>
        </Box>
      ))}
    </Box>
  );
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
const IconMenu = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const IconZap = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const iconBtnSx = {
  width: 30, height: 30, border: `1px solid ${C.border}`, borderRadius: "6px",
  bgcolor: C.white, display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: C.textSec, flexShrink: 0,
  "&:hover": { bgcolor: C.accentBg, color: C.accent, borderColor: C.accent },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CrmCoWorkerPage() {
  const nav      = useNavigate();
  const loginId  = localStorage.getItem("loginId") || "";
  const userName = localStorage.getItem("name") || "there";
  const initials = userName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  const [leftOpen,  setLeftOpen]  = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [sessions,       setSessions]       = useState([]);
  const [activeSession,  setActiveSession]  = useState(null);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const streamEndRef = useRef(null);
  const textareaRef  = useRef(null);

  const loadSessions = useCallback(async () => {
    try {
      const data = await apiGet("/api/crm/coworker/history", loginId);
      setSessions(data);
    } catch { /* silent */ }
  }, [loginId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") { e.preventDefault(); startNewChat(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") { e.preventDefault(); setLeftOpen(o => !o); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function switchSession(session) {
    setActiveSession(session);
    setPendingAction(null);
    try {
      const msgs = await apiGet(`/api/crm/coworker/sessions/${session.id}`, loginId);
      setMessages(msgs.map((m, i) => ({ ...m, id: i })));
    } catch {
      setMessages([]);
    }
    textareaRef.current?.focus();
  }

  function startNewChat() {
    setActiveSession(null);
    setPendingAction(null);
    setMessages([]);
    setInput("");
    textareaRef.current?.focus();
  }

  async function sendMessage(text) {
    const msg = text ?? input.trim();
    if (!msg || loading) return;
    setInput("");
    setPendingAction(null);

    const userMsg = { role: "user", content: msg, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await apiPost("/api/crm/coworker/chat", loginId, {
        sessionId: activeSession?.id ?? null,
        message: msg,
        history,
      });

      if (!activeSession && res.sessionId) {
        const newSession = { id: res.sessionId, title: msg.slice(0, 60) };
        setActiveSession(newSession);
        loadSessions();
      } else if (activeSession) {
        loadSessions();
      }

      const aiMsg = { role: "assistant", content: res.message, pendingAction: res.pendingAction, id: Date.now() + 1 };
      setMessages(prev => [...prev, aiMsg]);

      if (res.pendingAction && res.pendingAction.type !== "NONE") {
        setPendingAction(res.pendingAction);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
        id: Date.now() + 1,
      }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  async function handleConfirm() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setMessages(prev => prev.map(m => m.pendingAction ? { ...m, pendingAction: null } : m));
    setLoading(true);
    try {
      const res = await apiPost("/api/crm/coworker/confirm", loginId, {
        actionType: action.type,
        params: action.params,
      });
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.message || (res.success ? "Done! ✓" : "Something went wrong."),
        id: Date.now(),
      }]);
      if (res.navigateTo) {
        setTimeout(() => nav(res.navigateTo), 1200);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Failed to execute action. Please try again.",
        id: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setPendingAction(null);
    setMessages(prev => prev.map(m => m.pendingAction ? { ...m, pendingAction: null } : m));
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "No problem, action cancelled. What else can I help you with?",
      id: Date.now(),
    }]);
  }

  const filteredSessions = sessions.filter(s =>
    !searchQuery || (s.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const threadTitle = activeSession?.title || "New conversation";

  return (
    <Box sx={{
      display: "grid",
      gridTemplateColumns: `${leftOpen ? "220px" : "0"} 1fr ${rightOpen ? "240px" : "0"}`,
      transition: "grid-template-columns .22s ease",
      height: "calc(100vh - 56px)",
      overflow: "hidden",
      borderRadius: "10px",
      border: `1px solid ${C.border}`,
      bgcolor: C.white,
    }}>

      {/* ── LEFT: History sidebar ──────────────────────────────────────────── */}
      <Box sx={{
        bgcolor: C.sidebar, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0,
      }}>
        <Box sx={{ p: "14px 12px 10px", borderBottom: `1px solid ${C.borderSoft}`, flexShrink: 0 }}>
          <Box component="button" onClick={startNewChat} sx={{
            width: "100%", py: "8px", borderRadius: "8px", border: "none",
            background: "linear-gradient(135deg, #059669, #0F766E)",
            color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer", mb: 1.25, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 0.5,
            "&:hover": { opacity: 0.9 },
          }}>
            ＋ New chat
          </Box>
          <Box sx={{
            display: "flex", alignItems: "center", gap: "7px",
            bgcolor: C.white, border: `1px solid ${C.border}`, borderRadius: "7px",
            px: "9px", py: "6px",
          }}>
            <Box sx={{ color: C.textMuted, flexShrink: 0, display: "flex" }}><IconSearch /></Box>
            <Box component="input" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats…"
              sx={{
                border: "none", outline: "none", bgcolor: "transparent",
                fontSize: 12, color: C.text, width: "100%",
                "::placeholder": { color: C.textMuted },
              }}
            />
          </Box>
        </Box>

        <Box sx={{
          flex: 1, overflowY: "auto", p: "6px 8px 16px",
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-thumb": { bgcolor: C.historyThumb, borderRadius: "2px" },
        }}>
          {filteredSessions.length === 0 && (
            <Typography sx={{ fontSize: 12, color: C.textMuted, px: 1, pt: 2 }}>
              {searchQuery ? "No matching chats." : "No conversations yet."}
            </Typography>
          )}
          {filteredSessions.map(s => (
            <ThreadItem
              key={s.id}
              session={s}
              isActive={activeSession?.id === s.id}
              onClick={() => switchSession(s)}
            />
          ))}
        </Box>

        <Box sx={{
          p: "10px 12px", borderTop: `1px solid ${C.borderSoft}`,
          display: "flex", alignItems: "center", gap: "9px", flexShrink: 0,
        }}>
          <Box sx={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #059669, #0F766E)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#fff",
          }}>{initials}</Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName}
          </Typography>
        </Box>
      </Box>

      {/* ── CENTRE: Chat ──────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {/* Header */}
        <Box sx={{
          px: 2, py: "10px", borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          bgcolor: C.white, flexShrink: 0,
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
            <Box component="button" onClick={() => setLeftOpen(o => !o)} sx={iconBtnSx} title="Toggle history">
              <IconMenu />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{
                fontSize: 13, fontWeight: 600, color: C.text,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 280,
              }}>{threadTitle}</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: C.success }} />
                <Typography sx={{ fontSize: 10, color: C.textMuted }}>CRMx Co-worker · online</Typography>
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 0.75 }}>
            <Box component="button" onClick={() => setRightOpen(o => !o)} sx={iconBtnSx} title="Toggle tips">
              <IconZap />
            </Box>
          </Box>
        </Box>

        {/* Message stream */}
        <Box sx={{
          flex: 1, overflowY: "auto", bgcolor: C.bg,
          display: "flex", flexDirection: "column",
          "&::-webkit-scrollbar": { width: "5px" },
          "&::-webkit-scrollbar-thumb": { bgcolor: C.border, borderRadius: "3px" },
        }}>
          {messages.length === 0 && !loading
            ? <WelcomeScreen />
            : <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                {messages.map((msg, i) =>
                  msg.role === "user"
                    ? <UserBubble key={msg.id ?? i} message={msg.content} />
                    : <AiBubble
                        key={msg.id ?? i}
                        message={msg.content}
                        pendingAction={msg.pendingAction}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                        isLoading={false}
                      />
                )}
                {loading && <AiBubble message="" isLoading onConfirm={() => {}} onCancel={() => {}} />}
                <div ref={streamEndRef} />
              </Box>
          }
        </Box>

        {/* Composer */}
        <Box sx={{ borderTop: `1px solid ${C.border}`, bgcolor: C.white, flexShrink: 0 }}>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, px: 2, pt: "12px", pb: "10px" }}>
            <Box
              component="textarea"
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="Ask CRMx Co-worker — e.g. 'Start a promotion for Sarah Johnson'"
              disabled={loading}
              rows={1}
              sx={{
                flex: 1, resize: "none", border: `1px solid ${C.border}`, borderRadius: "8px",
                fontSize: 13, color: C.text, px: "12px", py: "8px", outline: "none",
                fontFamily: "inherit", lineHeight: 1.5, bgcolor: C.white,
                "&:focus": { borderColor: C.accent },
                "&::placeholder": { color: C.textMuted },
                "&:disabled": { bgcolor: C.bg, color: C.textMuted },
                overflowY: "hidden",
              }}
            />
            <Box
              component="button"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              sx={{
                width: 36, height: 36, borderRadius: "8px", flexShrink: 0,
                bgcolor: loading || !input.trim() ? C.border : C.accent,
                color: loading || !input.trim() ? C.textMuted : "#fff",
                border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background .15s",
                "&:hover:not(:disabled)": { bgcolor: "#047857" },
              }}
            >
              <IconSend />
            </Box>
          </Box>
          <Typography sx={{ fontSize: 10.5, color: C.textMuted, px: 2.5, pb: 1, textAlign: "center" }}>
            CRMx Co-worker can initiate promotions, salary reviews, and approve leave. Always review before confirming.
          </Typography>
        </Box>
      </Box>

      {/* ── RIGHT: Tips panel ──────────────────────────────────────────────── */}
      <Box sx={{
        borderLeft: `1px solid ${C.border}`, display: "flex",
        flexDirection: "column", overflow: "hidden", minWidth: 0,
      }}>
        <Box sx={{
          px: "14px", py: "10px", borderBottom: `1px solid ${C.borderSoft}`, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 1,
        }}>
          <Box sx={{ color: C.accent, display: "flex" }}><IconZap /></Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.text }}>Tips &amp; Examples</Typography>
        </Box>
        <TipsPanel />
      </Box>
    </Box>
  );
}
