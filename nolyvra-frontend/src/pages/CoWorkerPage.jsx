import { useCallback, useEffect, useRef, useState } from "react";
import { Box, CircularProgress, LinearProgress, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { isSupportedCvFile, validateCvContent } from "../utils/cvValidation";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:          "#F7F8FA",
  white:       "#fff",
  border:      "#E8ECF2",
  borderSoft:  "#F0F2F6",
  text:        "#0F1623",
  textSec:     "#5A6480",
  textMuted:   "#9AA3B4",
  accent:      "#1D72E8",
  accentBg:    "#EBF2FF",
  accentBr:    "#BFDBFE",
  purple:      "#7C3AED",
  purpleBg:    "#F5F3FF",
  purpleBr:    "#C4B5FD",
  success:     "#16A34A",
  successBg:   "#F0FDF4",
  successBr:   "#BBF7D0",
  danger:      "#DC2626",
  dangerBg:    "#FEF2F2",
  dangerBr:    "#FECACA",
  sidebar:     "#FBFAFE",
  historyThumb:"#D9D6F2",
};

// ── API helpers ───────────────────────────────────────────────────────────────
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

async function apiUploadCv(file, loginId) {
  const url = new URL(`${API_BASE}/api/cv/extract`);
  url.searchParams.set("loginId", loginId);
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: authHeader(),
    body,
  });
  const raw = await res.text();
  if (!res.ok) {
    let message = "Could not read the file. Please try a different document.";
    try {
      const parsed = JSON.parse(raw);
      message = parsed.error || parsed.message || message;
    } catch {
      if (raw) message = raw;
    }
    throw new Error(message);
  }
  return JSON.parse(raw);
}

// ── Welcome screen (shown when stream is empty) ───────────────────────────────
function WelcomeScreen() {
  return (
    <Box sx={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      px: 4, textAlign: "center", gap: 2,
    }}>
      {/* Nolyvra AI icon — neural spark constellation with animations */}
      <Box sx={{
        position: "relative",
        width: 80, height: 80,
        display: "flex", alignItems: "center", justifyContent: "center",
        mb: 0.5,
      }}>

        {/* Ripple ring 1 */}
        <Box sx={{
          position: "absolute",
          width: 80, height: 80, borderRadius: "50%",
          border: "1.5px solid rgba(124,58,237,0.5)",
          animation: "ripple1 2.4s ease-out infinite",
          "@keyframes ripple1": {
            "0%":    { transform: "scale(1)",    opacity: 0.7 },
            "100%":  { transform: "scale(1.7)",  opacity: 0 },
          },
        }} />

        {/* Ripple ring 2 — offset */}
        <Box sx={{
          position: "absolute",
          width: 80, height: 80, borderRadius: "50%",
          border: "1.5px solid rgba(29,114,232,0.4)",
          animation: "ripple2 2.4s ease-out 0.9s infinite",
          "@keyframes ripple2": {
            "0%":    { transform: "scale(1)",    opacity: 0.6 },
            "100%":  { transform: "scale(1.65)", opacity: 0 },
          },
        }} />

        {/* Ripple ring 3 — offset further */}
        <Box sx={{
          position: "absolute",
          width: 80, height: 80, borderRadius: "50%",
          border: "1px solid rgba(124,58,237,0.25)",
          animation: "ripple3 2.4s ease-out 1.6s infinite",
          "@keyframes ripple3": {
            "0%":    { transform: "scale(1)",    opacity: 0.5 },
            "100%":  { transform: "scale(1.55)", opacity: 0 },
          },
        }} />

        {/* Breathing outer glow */}
        <Box sx={{
          position: "absolute", inset: -8, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, rgba(29,114,232,0.08) 50%, transparent 75%)",
          animation: "breathe 3s ease-in-out infinite",
          "@keyframes breathe": {
            "0%, 100%": { transform: "scale(0.95)", opacity: 0.7 },
            "50%":       { transform: "scale(1.08)", opacity: 1   },
          },
        }} />

        {/* Icon container — subtle scale breathe */}
        <Box sx={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(145deg, #1D72E8 0%, #7C3AED 55%, #5B21B6 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 32px rgba(124,58,237,0.4), 0 2px 8px rgba(29,114,232,0.25)",
          position: "relative", overflow: "hidden",
          animation: "iconBreathe 3s ease-in-out infinite",
          "@keyframes iconBreathe": {
            "0%":    { transform: "scale(0.82)", boxShadow: "0 4px 16px rgba(124,58,237,0.2), 0 1px 4px rgba(29,114,232,0.15)" },
            "50%":   { transform: "scale(1)",    boxShadow: "0 10px 40px rgba(124,58,237,0.55), 0 4px 16px rgba(29,114,232,0.3)" },
            "100%":  { transform: "scale(0.82)", boxShadow: "0 4px 16px rgba(124,58,237,0.2), 0 1px 4px rgba(29,114,232,0.15)" },
          },
        }}>

          {/* Rotating shimmer sweep */}
          <Box sx={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.12) 20%, transparent 40%)",
            animation: "shimmerSpin 4s linear infinite",
            "@keyframes shimmerSpin": {
              from: { transform: "rotate(0deg)"   },
              to:   { transform: "rotate(360deg)" },
            },
          }} />

          {/* Static top-left highlight */}
          <Box sx={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%)",
            pointerEvents: "none",
          }} />

          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <defs>
              <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.6)" />
              </radialGradient>
            </defs>
            {/* Connection lines — neural network spokes */}
            <line x1="22" y1="22" x2="9"  y2="10" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="35" y2="10" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="9"  y2="34" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="35" y2="34" stroke="rgba(255,255,255,0.45)" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="22" y2="5"  stroke="rgba(255,255,255,0.3)"  strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="5"  y2="22" stroke="rgba(255,255,255,0.3)"  strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="22" y1="22" x2="39" y2="22" stroke="rgba(255,255,255,0.3)"  strokeWidth="1.4" strokeLinecap="round"/>
            {/* Outer nodes */}
            <circle cx="9"  cy="10" r="2.8" fill="rgba(255,255,255,0.75)"/>
            <circle cx="35" cy="10" r="2.8" fill="rgba(255,255,255,0.75)"/>
            <circle cx="9"  cy="34" r="2.8" fill="rgba(255,255,255,0.75)"/>
            <circle cx="35" cy="34" r="2.8" fill="rgba(255,255,255,0.75)"/>
            <circle cx="22" cy="5"  r="2.2" fill="rgba(255,255,255,0.55)"/>
            <circle cx="5"  cy="22" r="2.2" fill="rgba(255,255,255,0.55)"/>
            <circle cx="39" cy="22" r="2.2" fill="rgba(255,255,255,0.55)"/>
            {/* Center core */}
            <circle cx="22" cy="22" r="6.5" fill="url(#centerGlow)"/>
            {/* Center spark — 4-pointed star */}
            <path
              d="M22 16.5 L23.4 20.6 L27.5 22 L23.4 23.4 L22 27.5 L20.6 23.4 L16.5 22 L20.6 20.6 Z"
              fill="#7C3AED"
              opacity="0.9"
            />
          </svg>
        </Box>
      </Box>

      <Typography sx={{ fontSize: 22, fontWeight: 700, color: C.purple, letterSpacing: "-0.3px", lineHeight: 1.2 }}>
        How can I help today?
      </Typography>
      <Typography sx={{ fontSize: 14, color: C.textSec, lineHeight: 1.65, maxWidth: 380 }}>
        Ask me to triage candidates, schedule interviews, draft emails, or summarise your pipeline. Check the tips on the right for examples.
      </Typography>
    </Box>
  );
}

// ── Message bubble — AI ───────────────────────────────────────────────────────
function AiBubble({ message, pendingAction, onConfirm, onCancel, isLoading }) {
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
      <Box sx={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0, mt: "2px",
        background: "linear-gradient(145deg, #1D72E8 0%, #7C3AED 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          {/* Mini connection lines */}
          <line x1="8" y1="8" x2="3"  y2="3.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="8" y1="8" x2="13" y2="3.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="8" y1="8" x2="3"  y2="12.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" strokeLinecap="round"/>
          <line x1="8" y1="8" x2="13" y2="12.5" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" strokeLinecap="round"/>
          {/* Outer nodes */}
          <circle cx="3"  cy="3.5"  r="1.4" fill="rgba(255,255,255,0.75)"/>
          <circle cx="13" cy="3.5"  r="1.4" fill="rgba(255,255,255,0.75)"/>
          <circle cx="3"  cy="12.5" r="1.4" fill="rgba(255,255,255,0.75)"/>
          <circle cx="13" cy="12.5" r="1.4" fill="rgba(255,255,255,0.75)"/>
          {/* Center core */}
          <circle cx="8" cy="8" r="3" fill="rgba(255,255,255,0.95)"/>
          {/* Mini spark */}
          <path d="M8 5.8 L8.7 7.3 L10.2 8 L8.7 8.7 L8 10.2 L7.3 8.7 L5.8 8 L7.3 7.3 Z"
            fill="#7C3AED" opacity="0.9"/>
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
                <CircularProgress size={12} sx={{ color: C.purple }} />
                <Typography sx={{ fontSize: 12, color: C.textMuted }}>Thinking…</Typography>
              </Box>
            : message}

          {pendingAction && pendingAction.type !== "NONE" && (
            <Box sx={{ mt: 1.25, p: 1.25, bgcolor: C.purpleBg, border: `1px solid ${C.purpleBr}`, borderRadius: "8px" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.text, mb: 0.5 }}>Confirm action:</Typography>
              <Typography sx={{ fontSize: 11, color: C.textMuted, mb: 1, lineHeight: 1.5 }}>
                {pendingAction.description}
                {pendingAction.type === "EMAIL" && (
                  <Box component="span" sx={{ color: C.accent }}> — will open Email Centre</Box>
                )}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Box component="button" onClick={onConfirm} sx={{
                  fontSize: 11, bgcolor: C.purple, color: "#fff", border: "none",
                  borderRadius: "6px", px: 1.5, py: 0.625, cursor: "pointer",
                  "&:hover": { bgcolor: "#6D28D9" },
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
        <Typography sx={{ fontSize: 10, color: C.textMuted, mt: 0.5, ml: 0.5 }}>Co-worker AI</Typography>
      </Box>
    </Box>
  );
}

// ── Message bubble — User ─────────────────────────────────────────────────────
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

// ── Thread item in history sidebar ───────────────────────────────────────────
function ThreadItem({ session, isActive, onClick }) {
  const date = session.lastMessageAt
    ? new Date(session.lastMessageAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : "";
  return (
    <Box onClick={onClick} sx={{
      px: "10px", py: "8px", borderRadius: "7px", cursor: "pointer",
      mb: "1px", transition: "background .12s",
      bgcolor: isActive ? "#EBE5FF" : "transparent",
      "&:hover": { bgcolor: isActive ? "#EBE5FF" : "#F2EEFF" },
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

// ── Active task item ──────────────────────────────────────────────────────────
function TaskItem({ task }) {
  const isDone    = task.status === "done";
  const isFailed  = task.status === "failed";
  const isRunning = task.status === "running";
  const iconColor = isDone ? C.success : isFailed ? C.danger : C.accent;
  const icon      = isDone ? "✓" : isFailed ? "✗" : "⟳";
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", py: 1.25, borderBottom: `1px solid ${C.borderSoft}`, "&:last-child": { borderBottom: "none" } }}>
      <Box sx={{
        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
        bgcolor: isDone ? C.successBg : isFailed ? C.dangerBg : C.accentBg,
        border: `1px solid ${isDone ? C.successBr : isFailed ? C.dangerBr : C.accentBr}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, color: iconColor,
      }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 500, color: C.text, lineHeight: 1.4 }}>
          {task.description}
        </Typography>
        {isRunning && (
          <>
            <Typography sx={{ fontSize: 10.5, color: C.accent, mt: 0.25 }}>Processing… {task.progress}%</Typography>
            <LinearProgress variant="determinate" value={task.progress}
              sx={{ mt: 0.5, borderRadius: "3px", height: 3, "& .MuiLinearProgress-bar": { bgcolor: C.accent } }} />
          </>
        )}
      </Box>
    </Box>
  );
}

// ── Tips panel content ────────────────────────────────────────────────────────
const TRY_ASKING = [
  { eg: "Run analysis on all new candidates for Senior Backend Engineer", tags: ["Triage", "Bulk action"] },
  { eg: "Schedule interviews with the top 3 for Product Manager next Tue–Thu", tags: ["Scheduling"] },
  { eg: "Draft a rejection email for candidates with critical verify risk", tags: ["Email"] },
  { eg: "Summarise this week's pipeline movement and flag stalled candidates", tags: ["Summary"] },
];
const PRO_TIPS = [
  { title: "Be specific about scope", body: "Mention the job role, stage, or time window so Co-worker doesn't have to ask follow-up questions." },
  { title: "Confirm before bulk actions", body: "Co-worker will preview every email, schedule, and analysis run before sending. Review carefully." },
  { title: "Reference candidates by name", body: "e.g. \"Re-check Priya Sharma's CV consistency\" — Co-worker will pull her latest analysis." },
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
const IconChevronRight = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
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

// ── Shared icon-button style ──────────────────────────────────────────────────
const iconBtnSx = {
  width: 30, height: 30, border: `1px solid ${C.border}`, borderRadius: "6px",
  bgcolor: C.white, display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: C.textSec, flexShrink: 0,
  "&:hover": { bgcolor: C.accentBg, color: C.accent, borderColor: C.accent },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CoWorkerPage() {
  const nav      = useNavigate();
  const loginId  = localStorage.getItem("loginId") || "";
  const userName = localStorage.getItem("name") || "there";
  const initials = userName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  // Pane collapse state
  const [leftOpen,  setLeftOpen]  = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  // Session / history state
  const [sessions,       setSessions]       = useState([]);
  const [activeSession,  setActiveSession]  = useState(null); // { id, title }
  const [searchQuery,    setSearchQuery]    = useState("");

  // Active tasks state
  const [tasks, setTasks] = useState([]);

  // Chat state
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [cvAttachments, setCvAttachments] = useState([]);
  const [cvAttachError, setCvAttachError] = useState(null);
  const [cvUploading,   setCvUploading]   = useState(false);

  const streamEndRef = useRef(null);
  const textareaRef  = useRef(null);
  const fileInputRef = useRef(null);

  // ── Load session list ───────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const data = await apiGet("/api/coworker/history", loginId);
      setSessions(data);
    } catch { /* silent */ }
  }, [loginId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Poll active tasks ───────────────────────────────────────────────────────
  useEffect(() => {
    async function loadTasks() {
      try {
        const all = await apiGet("/api/coworker/tasks", loginId);
        setTasks(all.filter(t => t.status === "running"));
      } catch { /* silent */ }
    }
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, [loginId]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── Auto-resize textarea ────────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") { e.preventDefault(); startNewChat(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") { e.preventDefault(); setLeftOpen(o => !o); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Switch to a session ─────────────────────────────────────────────────────
  async function switchSession(session) {
    setActiveSession(session);
    setPendingAction(null);
    try {
      const msgs = await apiGet(`/api/coworker/sessions/${session.id}`, loginId);
      setMessages(msgs.map((m, i) => ({ ...m, id: i })));
    } catch {
      setMessages([]);
    }
    textareaRef.current?.focus();
  }

  // ── New chat ────────────────────────────────────────────────────────────────
  function startNewChat() {
    setActiveSession(null);
    setPendingAction(null);
    setMessages([]);
    setInput("");
    setCvAttachments([]);
    setCvAttachError(null);
    textareaRef.current?.focus();
  }

  async function handleAttachCvs(files) {
    const selected = Array.from(files || []);
    if (!selected.length || cvUploading) return;
    setCvAttachError(null);
    setCvUploading(true);
    try {
      const parsed = [];
      for (const file of selected) {
        if (!isSupportedCvFile(file)) {
          throw new Error("Only PDF and Word (.docx / .doc) files are supported.");
        }
        const data = await apiUploadCv(file, loginId);
        const extractedText = data.text || "";
        const validationError = validateCvContent(extractedText);
        if (validationError) {
          throw new Error(`${file.name}: ${validationError}`);
        }
        parsed.push({
          id: `${file.name}-${file.size}-${Date.now()}-${parsed.length}`,
          fileName: file.name,
          name: data.name || file.name.replace(/\.[^.]+$/, ""),
          email: data.email || "",
          phone: data.phone || "",
          linkedinUrl: data.linkedinUrl || "",
          skills: Array.isArray(data.skills) ? data.skills : [],
          cvText: extractedText,
        });
      }
      setCvAttachments(prev => [...prev, ...parsed]);
      if (!input.trim()) {
        setInput("Attach the uploaded CVs to the right job and create candidates.");
      }
    } catch (e) {
      setCvAttachError(e.message || "Failed to attach CV.");
    } finally {
      setCvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      textareaRef.current?.focus();
    }
  }

  function removeAttachment(id) {
    setCvAttachments(prev => prev.filter(a => a.id !== id));
  }

  function buildMessageWithAttachments(message, attachments) {
    if (!attachments.length) return message;
    const attachmentText = attachments.map((cv, idx) => [
      `CV ${idx + 1}:`,
      `fileName: ${cv.fileName}`,
      `name: ${cv.name}`,
      `email: ${cv.email}`,
      `phone: ${cv.phone}`,
      `linkedinUrl: ${cv.linkedinUrl}`,
      `skills: ${cv.skills.join(", ")}`,
      `cvText: ${cv.cvText}`,
    ].join("\n")).join("\n\n");
    return `${message}\n\nAttached CVs:\n${attachmentText}`;
  }

  // ── Send message ────────────────────────────────────────────────────────────
  async function sendMessage(text) {
    const msg = text ?? input.trim();
    if ((!msg && !cvAttachments.length) || loading || cvUploading) return;
    const attachmentsToSend = cvAttachments;
    const messageToSend = buildMessageWithAttachments(msg || "Please review the attached CVs.", attachmentsToSend);
    setInput("");
    setPendingAction(null);

    const userMsg = { role: "user", content: msg || `Attached ${attachmentsToSend.length} CV(s).`, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const history = messages.map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await apiPost("/api/coworker/chat", loginId, {
        sessionId: activeSession?.id ?? null,
        message: messageToSend,
        history,
      });

      // First message in a session — set active session from the returned ID
      if (!activeSession && res.sessionId) {
        const newSession = { id: res.sessionId, title: (msg || "Attached CVs").slice(0, 60) };
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
      setCvAttachments([]);
      setCvAttachError(null);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I had trouble with that. Please try again.",
        id: Date.now() + 1,
      }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  // ── Confirm action ──────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setMessages(prev => prev.map(m => m.pendingAction ? { ...m, pendingAction: null } : m));
    setLoading(true);
    try {
      const res = await apiPost("/api/coworker/confirm", loginId, {
        actionType: action.type,
        params: action.params,
      });
      if (res.navigateTo === "/email" && res.emailParams) {
        setMessages(prev => [...prev, { role: "assistant", content: res.message, id: Date.now() }]);
        setLoading(false);
        nav("/email", { state: { prefill: res.emailParams } });
        return;
      }
      if (res.navigateTo) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: res.message || "Done!",
          id: Date.now(),
        }]);
        setLoading(false);
        nav(res.navigateTo);
        return;
      }
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.message || (res.success ? "Done! ✓" : "Something went wrong."),
        id: Date.now(),
      }]);
    } catch (e) {
      const msg = e.message || "";
      setMessages(prev => [...prev, {
        role: "assistant",
        content: msg.includes("402") || msg.includes("Insufficient tokens")
          ? "You have run out of tokens. Please upgrade your plan to continue."
          : "Failed to execute action. Please try again.",
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

  // ── Filtered session list ───────────────────────────────────────────────────
  const filteredSessions = sessions.filter(s =>
    !searchQuery || (s.title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Thread title for chat header ────────────────────────────────────────────
  const threadTitle = activeSession?.title || "New conversation";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box sx={{
      display: "grid",
      gridTemplateColumns: `${leftOpen ? "220px" : "0"} 1fr ${rightOpen ? "240px" : "0"}`,
      transition: "grid-template-columns .22s ease",
      height: "calc(100vh - 56px)", // fill below topnav
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
        {/* New chat + search */}
        <Box sx={{ p: "14px 12px 10px", borderBottom: `1px solid ${C.borderSoft}`, flexShrink: 0 }}>
          <Box
            component="button"
            onClick={startNewChat}
            sx={{
              width: "100%", py: "8px", borderRadius: "8px", border: "none",
              background: "linear-gradient(135deg, #7C3AED, #1D72E8)",
              color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: "pointer", mb: 1.25, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 0.5,
              "&:hover": { opacity: 0.9 },
            }}
          >
            ＋ New chat
          </Box>
          <Box sx={{
            display: "flex", alignItems: "center", gap: "7px",
            bgcolor: C.white, border: `1px solid ${C.border}`, borderRadius: "7px",
            px: "9px", py: "6px",
          }}>
            <Box sx={{ color: C.textMuted, flexShrink: 0, display: "flex" }}><IconSearch /></Box>
            <Box
              component="input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search chats…"
              sx={{
                border: "none", outline: "none", bgcolor: "transparent",
                fontSize: 12, color: C.text, width: "100%",
                "::placeholder": { color: C.textMuted },
              }}
            />
          </Box>
        </Box>

        {/* Thread list */}
        <Box sx={{ flex: 1, overflowY: "auto", p: "6px 8px 16px",
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

        {/* User footer */}
        <Box sx={{
          p: "10px 12px", borderTop: `1px solid ${C.borderSoft}`,
          display: "flex", alignItems: "center", gap: "9px", flexShrink: 0,
        }}>
          <Box sx={{
            width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg,#7C3AED,#1D72E8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "#fff",
          }}>{initials}</Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName}
          </Typography>
        </Box>
      </Box>

      {/* ── CENTRE: Main chat ──────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

        {/* Chat header */}
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
                <Typography sx={{ fontSize: 10, color: C.textMuted }}>Co-worker · online</Typography>
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
          {(cvAttachments.length > 0 || cvAttachError) && (
            <Box sx={{ px: 2, pt: "10px", display: "flex", flexDirection: "column", gap: 0.75 }}>
              {cvAttachments.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                  {cvAttachments.map(cv => (
                    <Box key={cv.id} sx={{
                      display: "flex", alignItems: "center", gap: 0.75,
                      maxWidth: 260, px: "9px", py: "5px",
                      borderRadius: "7px", border: `1px solid ${C.accentBr}`,
                      bgcolor: C.accentBg, color: C.text, fontSize: 11.5,
                    }}>
                      <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {cv.name || cv.fileName}
                      </Box>
                      <Box component="button" onClick={() => removeAttachment(cv.id)} sx={{
                        border: "none", bgcolor: "transparent", cursor: "pointer",
                        color: C.textMuted, fontSize: 14, lineHeight: 1, p: 0,
                      }} title="Remove CV">x</Box>
                    </Box>
                  ))}
                </Box>
              )}
              {cvAttachError && (
                <Typography sx={{ fontSize: 11.5, color: C.danger }}>{cvAttachError}</Typography>
              )}
            </Box>
          )}
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, px: 2, pt: "12px", pb: "10px" }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: "none" }}
              onChange={e => handleAttachCvs(e.target.files)}
            />
            <Box
              component="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || cvUploading}
              sx={{
                width: 36, height: 36, borderRadius: "8px", flexShrink: 0,
                bgcolor: cvUploading ? C.bg : C.white,
                border: `1px solid ${C.border}`, cursor: loading || cvUploading ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: C.textSec, fontSize: 17,
                "&:hover": { borderColor: loading || cvUploading ? C.border : C.accent, color: C.accent, bgcolor: C.accentBg },
              }}
              title="Attach CVs"
            >
              {cvUploading ? <CircularProgress size={16} /> : "CV"}
            </Box>
            <Box
              component="textarea"
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder="Ask Co-worker — e.g. 'Run analysis on new candidates for Backend Engineer'"
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
              disabled={loading || cvUploading || (!input.trim() && cvAttachments.length === 0)}
              sx={{
                width: 36, height: 36, borderRadius: "8px", flexShrink: 0,
                bgcolor: (input.trim() || cvAttachments.length > 0) && !loading && !cvUploading ? C.purple : C.border,
                border: "none", cursor: (input.trim() || cvAttachments.length > 0) && !loading && !cvUploading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 16, transition: "background .15s",
                "&:hover": { bgcolor: (input.trim() || cvAttachments.length > 0) && !loading && !cvUploading ? "#6D28D9" : C.border },
              }}
            >↑</Box>
          </Box>
          <Box sx={{ px: 2, pb: "10px", display: "flex", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: 10.5, color: C.textMuted }}>
              Co-worker can take real actions inside Nolyvra (analyse, schedule, email).
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: C.textMuted }}>
              <Box component="kbd" sx={{ fontSize: 10, bgcolor: C.bg, border: `1px solid ${C.border}`, borderRadius: "4px", px: "5px", py: "2px", mr: 0.5 }}>↵</Box>
              send ·
              <Box component="kbd" sx={{ fontSize: 10, bgcolor: C.bg, border: `1px solid ${C.border}`, borderRadius: "4px", px: "5px", py: "2px", mx: 0.5 }}>⇧↵</Box>
              new line
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── RIGHT: Active Tasks + Tips panel ──────────────────────────────── */}
      <Box sx={{
        borderLeft: `1px solid ${C.border}`, display: "flex",
        flexDirection: "column", overflow: "hidden", minWidth: 0, bgcolor: C.white,
      }}>

        {/* Active tasks */}
        <Box sx={{ flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
          <Box sx={{
            px: "14px", py: "11px", borderBottom: `1px solid ${C.borderSoft}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.text }}>Active Tasks</Typography>
            <Box sx={{
              display: "inline-flex", bgcolor: C.accentBg, border: `1px solid ${C.accentBr}`,
              borderRadius: "20px", px: "10px", py: "2px", fontSize: 11, fontWeight: 600, color: C.accent,
            }}>{tasks.length} running</Box>
          </Box>
          <Box sx={{ px: "14px", py: tasks.length ? "4px" : 0 }}>
            {tasks.length === 0
              ? <Typography sx={{ fontSize: 12, color: C.textMuted, py: 1.5 }}>No active tasks.</Typography>
              : tasks.map(t => <TaskItem key={t.id} task={t} />)}
          </Box>
        </Box>

        {/* Tips header */}
        <Box sx={{
          px: "14px", py: "11px", borderBottom: `1px solid ${C.borderSoft}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <IconZap />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: C.text }}>Tips</Typography>
          </Box>
          <Box component="button" onClick={() => setRightOpen(false)} sx={{ ...iconBtnSx, border: "none", bgcolor: "transparent" }} title="Close">
            <IconX />
          </Box>
        </Box>
        <TipsPanel />
      </Box>

    </Box>
  );
}
