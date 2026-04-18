import { useEffect, useRef, useState } from "react";
import { Box, Paper, Typography, Button, TextField, CircularProgress, LinearProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const BORDER   = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS  = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN     = "#D97706", WARN_BG    = "#FFFBEB", WARN_BR    = "#FDE68A";
const DANGER   = "#DC2626", DANGER_BG  = "#FEF2F2", DANGER_BR  = "#FECACA";
const PURPLE   = "#7C3AED", PURPLE_BG  = "#F5F3FF", PURPLE_BR  = "#C4B5FD";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE";
const SURFACE  = "#FAFBFD";

async function apiPost(path, loginId, body) {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiGet(path, loginId, extra = {}) {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Quick action cards ────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { id: "analysis",  icon: "🔬", label: "Run Analysis — New Candidates",   desc: "Batch analyse all unanalysed candidates under a job",     border: PURPLE_BR,  bg: PURPLE_BG,  prompt: "Run analysis for all unanalysed candidates" },
  { id: "meeting",   icon: "📅", label: "Schedule a Meeting",               desc: "Phone screen, video interview, or in-person — for any candidate", border: ACCENT_BR,  bg: ACCENT_BG,  prompt: "Schedule a meeting with a candidate" },
  { id: "report",    icon: "📊", label: "Generate Monthly Report",          desc: "Client report across all jobs — or filtered by client",   border: SUCCESS_BR, bg: SUCCESS_BG, prompt: "Generate a monthly report for all clients" },
  { id: "followup",  icon: "✉️", label: "Send Follow-up Emails",            desc: "Draft & send post-interview follow-ups for all candidates", border: WARN_BR,    bg: WARN_BG,    prompt: "Send follow-up emails for all interviewed candidates" },
  { id: "pipeline",  icon: "🔄", label: "Move Candidates in Pipeline",      desc: "Bulk-update stage for all approved candidates in a job",   border: BORDER,     bg: SURFACE,    prompt: "Move candidates in the pipeline" },
  { id: "shortlist", icon: "⭐", label: "Build a Shortlist",                desc: "Auto-generate top-3 candidate shortlist for a client",    border: BORDER,     bg: SURFACE,    prompt: "Build a shortlist for a client" },
];

const SUGGEST_CHIPS = [
  { label: "🔬 Analyse all pending",   prompt: "Run analysis for all unanalysed candidates" },
  { label: "📅 Schedule interview",    prompt: "Schedule a video interview" },
  { label: "📊 Monthly report",        prompt: "Generate March monthly report for all clients" },
  { label: "✉ Follow-ups",            prompt: "Send follow-up emails for all interviewed candidates" },
];

const WHAT_CAN_DO = [
  { icon: "🔬", title: "Run Analysis",       desc: "batch or single candidate" },
  { icon: "📅", title: "Schedule Meetings",  desc: "phone screen, video, in-person, debrief" },
  { icon: "📊", title: "Generate Reports",   desc: "monthly, by client, or all jobs" },
  { icon: "✉️", title: "Send Emails",        desc: "navigates to email centre with pre-filled draft" },
  { icon: "🔄", title: "Move Pipeline",      desc: "bulk stage updates" },
  { icon: "⭐", title: "Build Shortlist",    desc: "ranked candidates for clients" },
  { icon: "🔔", title: "Set Reminders",      desc: "auto-create tasks from conversation" },
];

// ── Message bubble ────────────────────────────────────────────────────────────
function AiBubble({ message, pendingAction, onConfirm, onCancel, isLoading }) {
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
      <Box sx={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, mt: "2px",
        background: "linear-gradient(135deg,#7C3AED,#1D72E8)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
        🤖
      </Box>
      <Box sx={{ maxWidth: "75%" }}>
        <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: "0 10px 10px 10px",
          px: 1.75, py: 1.25, fontSize: 12.5, color: TEXT, lineHeight: 1.6,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          {isLoading
            ? <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={12} sx={{ color: PURPLE }} />
                <Typography sx={{ fontSize: 12, color: MUTED }}>Thinking…</Typography>
              </Box>
            : message}

          {/* Pending action confirmation card */}
          {pendingAction && pendingAction.type !== "NONE" && (
            <Box sx={{ mt: 1.25, p: 1.25, bgcolor: PURPLE_BG,
              border: `1px solid ${PURPLE_BR}`, borderRadius: "8px" }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, mb: 0.5 }}>
                Confirm action:
              </Typography>
              <Typography sx={{ fontSize: 11, color: MUTED, mb: 1, lineHeight: 1.5 }}>
                {pendingAction.description}
                {pendingAction.type === "EMAIL" && (
                  <Box component="span" sx={{ color: ACCENT }}> — will open Email Centre</Box>
                )}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button size="small" variant="contained" onClick={onConfirm}
                  sx={{ fontSize: 11, bgcolor: PURPLE, borderRadius: "6px",
                    textTransform: "none", boxShadow: "none",
                    "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" } }}>
                  ✓ Yes, do it
                </Button>
                <Button size="small" variant="outlined" onClick={onCancel}
                  sx={{ fontSize: 11, borderColor: BORDER, color: TEXT,
                    borderRadius: "6px", textTransform: "none" }}>
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </Box>
        <Typography sx={{ fontSize: 10, color: MUTED, mt: 0.5, ml: 0.5 }}>
          Co-worker AI
        </Typography>
      </Box>
    </Box>
  );
}

function UserBubble({ message }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Box sx={{ maxWidth: "75%" }}>
        <Box sx={{ bgcolor: ACCENT, borderRadius: "10px 0 10px 10px",
          px: 1.75, py: 1.25, fontSize: 12.5, color: "#fff", lineHeight: 1.6 }}>
          {message}
        </Box>
        <Typography sx={{ fontSize: 10, color: MUTED, mt: 0.5, textAlign: "right", mr: 0.5 }}>
          You
        </Typography>
      </Box>
    </Box>
  );
}

// ── Task item for right panel ─────────────────────────────────────────────────
function TaskItem({ task }) {
  const isDone    = task.status === "done";
  const isFailed  = task.status === "failed";
  const isRunning = task.status === "running";

  const iconColor = isDone ? SUCCESS : isFailed ? DANGER : ACCENT;
  const icon = isDone ? "✓" : isFailed ? "✗" : "⟳";

  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start",
      py: 1.25, borderBottom: `1px solid #F0F2F6`, "&:last-child": { borderBottom: "none" } }}>
      <Box sx={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        bgcolor: isDone ? SUCCESS_BG : isFailed ? DANGER_BG : ACCENT_BG,
        border: `1px solid ${isDone ? SUCCESS_BR : isFailed ? DANGER_BR : ACCENT_BR}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: iconColor }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 500, color: TEXT,
          lineHeight: 1.5 }}>
          {task.description}
        </Typography>
        {isRunning && (
          <>
            <Typography sx={{ fontSize: 11, color: ACCENT, mt: 0.25 }}>
              Processing… {task.progress}%
            </Typography>
            <LinearProgress variant="determinate" value={task.progress}
              sx={{ mt: 0.5, borderRadius: "3px", height: 4,
                "& .MuiLinearProgress-bar": { bgcolor: ACCENT } }} />
          </>
        )}
        {isDone && task.completedAt && (
          <Typography sx={{ fontSize: 10, color: MUTED, mt: 0.25 }}>
            {new Date(task.completedAt).toLocaleTimeString("en-GB",
              { hour: "2-digit", minute: "2-digit" })}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CoWorkerPage() {
  const nav     = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";
  const userName = localStorage.getItem("name") || "there";

  const GREETING = `Hi ${userName} 👋 I'm your Co-worker AI. I can take real actions inside nolyvra for you — just tell me what to do.\n\nFor example:\n• "Run analysis for all new candidates in Senior Backend Engineer"\n• "Schedule a phone screen with James Okafor for Tuesday 2pm"\n• "Generate March report for FinTech Co."\n\nWhat would you like me to do?`;

  const [messages,      setMessages]      = useState([{ role: "assistant", content: GREETING, id: 0 }]);
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // action waiting for confirm
  const [pendingMsgIdx, setPendingMsgIdx] = useState(null); // which message holds the action
  const [tasks,         setTasks]         = useState([]);
  const [tasksDone,     setTasksDone]     = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // Load task history on mount + poll active tasks
  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function loadTasks() {
    try {
      const all = await apiGet("/api/coworker/tasks", loginId);
      setTasks(all.filter(t => t.status === "running"));
      setTasksDone(all.filter(t => t.status === "done" || t.status === "failed"));
    } catch { /* silent */ }
  }

  async function sendMessage(text) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");
    setPendingAction(null);

    // Add user message
    const userMsg = { role: "user", content: msg, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Build history for context (exclude the greeting)
    const history = messages
      .filter(m => m.id !== 0)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await apiPost("/api/coworker/chat", loginId, {
        message: msg,
        history,
      });

      const aiMsg = {
        role: "assistant",
        content: res.message,
        pendingAction: res.pendingAction,
        id: Date.now() + 1,
      };
      setMessages(prev => [...prev, aiMsg]);

      if (res.pendingAction && res.pendingAction.type !== "NONE") {
        setPendingAction(res.pendingAction);
        setPendingMsgIdx(messages.length + 1);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I had trouble with that. Please try again.",
        id: Date.now() + 1,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function handleConfirm() {
    if (!pendingAction) return;
    setPendingAction(null);

    // Remove confirm card from the last AI message
    setMessages(prev => prev.map(m =>
      m.pendingAction ? { ...m, pendingAction: null } : m));

    setLoading(true);
    try {
      const res = await apiPost("/api/coworker/confirm", loginId, {
        actionType: pendingAction.type,
        params:     pendingAction.params,
      });

      // Handle email navigation — go to email centre with pre-populated data
      if (res.navigateTo === "/email" && res.emailParams) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: res.message,
          id: Date.now(),
        }]);
        setLoading(false);
        // Navigate to email page with state so EmailCentrePage can pre-populate
        nav("/email", { state: { prefill: res.emailParams } });
        return;
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.message || (res.success ? "Done! ✓" : "Something went wrong."),
        id: Date.now(),
      }]);

      loadTasks();
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
    setMessages(prev => prev.map(m =>
      m.pendingAction ? { ...m, pendingAction: null } : m));
    setMessages(prev => [...prev, {
      role: "assistant",
      content: "No problem, action cancelled. What else can I help you with?",
      id: Date.now(),
    }]);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>
              Co-worker AI
            </Typography>
            <Box sx={{ display: "inline-flex", alignItems: "center", px: "7px", py: "2px",
              bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`, borderRadius: "4px",
              fontSize: 10, fontWeight: 600, color: PURPLE }}>BETA</Box>
          </Box>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Your AI assistant — tell it what to do and it handles the steps
          </Typography>
        </Box>
        <Box sx={{ display: "inline-flex", alignItems: "center",
          bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`,
          borderRadius: "20px", px: 1.5, py: 0.5,
          fontSize: 11, fontWeight: 600, color: PURPLE }}>
          🟢 AI Ready
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>

        {/* LEFT: Quick actions + Chat */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>

          {/* Quick action cards */}
          <Paper elevation={0} sx={{ border: `1px solid ${PURPLE_BR}`, borderRadius: "10px",
            overflow: "hidden", bgcolor: "#fff",
            boxShadow: "0 0 0 2px rgba(124,58,237,0.06)" }}>
            <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography sx={{ fontSize: 15 }}>✦</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  Quick Actions — What should I do?
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 10, color: MUTED, fontStyle: "italic" }}>
                Click any action to start
              </Typography>
            </Box>
            <Box sx={{ p: 2, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.25 }}>
              {QUICK_ACTIONS.map(action => (
                <Box key={action.id}
                  onClick={() => sendMessage(action.prompt)}
                  sx={{ border: `1px solid ${action.border}`, borderRadius: "8px",
                    p: "13px 15px", cursor: "pointer", bgcolor: action.bg,
                    transition: "box-shadow .15s",
                    "&:hover": { boxShadow: "0 3px 12px rgba(124,58,237,0.12)" } }}>
                  <Typography sx={{ fontSize: 18, mb: 0.5 }}>{action.icon}</Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT }}>
                    {action.label}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.375 }}>
                    {action.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Chat window */}
          <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px",
            overflow: "hidden", bgcolor: "#fff" }}>

            {/* Chat header */}
            <Box sx={{ px: 2.25, py: 1.5,
              background: "linear-gradient(135deg,#1B3A6B,#0F1623)",
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: "50%",
                  background: "linear-gradient(135deg,#7C3AED,#1D72E8)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                  🤖
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    nolyvra Co-worker
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                    AI-powered recruitment assistant
                  </Typography>
                </Box>
              </Box>
              <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                Context-aware · Action-capable
              </Typography>
            </Box>

            {/* Messages */}
            <Box sx={{ bgcolor: "#F7F8FA", minHeight: 280, maxHeight: 400,
              overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
              {messages.map((msg, i) => (
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
              ))}
              {loading && (
                <AiBubble message="" isLoading onConfirm={() => {}} onCancel={() => {}} />
              )}
              <div ref={messagesEndRef} />
            </Box>

            {/* Suggested chips */}
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap",
              px: 1.75, py: 1.25, borderTop: `1px solid ${BORDER}`, bgcolor: "#fff" }}>
              <Typography sx={{ fontSize: 10, color: MUTED, fontWeight: 600,
                alignSelf: "center", mr: 0.25 }}>
                SUGGEST:
              </Typography>
              {SUGGEST_CHIPS.map(chip => (
                <Box key={chip.label}
                  onClick={() => sendMessage(chip.prompt)}
                  sx={{ bgcolor: "#F0F2F6", border: `1px solid ${BORDER}`,
                    borderRadius: "20px", px: 1.25, py: 0.375,
                    fontSize: 11, color: TEXT, cursor: "pointer",
                    "&:hover": { bgcolor: ACCENT_BG, borderColor: ACCENT, color: ACCENT } }}>
                  {chip.label}
                </Box>
              ))}
            </Box>

            {/* Input */}
            <Box sx={{ display: "flex", gap: 1, px: 1.75, py: 1.25,
              borderTop: `1px solid ${BORDER}`, bgcolor: "#fff" }}>
              <TextField
                inputRef={inputRef}
                fullWidth size="small"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder="Tell Co-worker what to do…"
                disabled={loading}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }}
              />
              <Button variant="contained" onClick={() => sendMessage()} disabled={loading || !input.trim()}
                sx={{ px: 2.5, bgcolor: PURPLE, borderRadius: "8px",
                  minWidth: 0, boxShadow: "none",
                  "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" } }}>
                ➤
              </Button>
            </Box>
          </Paper>
        </Box>

        {/* RIGHT: Tasks + Capabilities */}
        <Box sx={{ flex: "0 0 240px", display: "flex", flexDirection: "column", gap: 2 }}>

          {/* Active tasks */}
          <Paper elevation={0} sx={{ border: `1px solid ${PURPLE_BR}`, borderRadius: "10px",
            overflow: "hidden", bgcolor: "#fff",
            boxShadow: "0 0 0 2px rgba(124,58,237,0.06)" }}>
            <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                  Active Tasks
                </Typography>
                <Box sx={{ display: "inline-flex", px: "7px", py: "2px",
                  bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`,
                  borderRadius: "4px", fontSize: 10, fontWeight: 600, color: PURPLE }}>NEW</Box>
              </Box>
              <Box sx={{ display: "inline-flex", bgcolor: ACCENT_BG, border: `1px solid ${ACCENT_BR}`,
                borderRadius: "20px", px: 1.25, py: 0.25, fontSize: 11, fontWeight: 600, color: ACCENT }}>
                {tasks.length} running
              </Box>
            </Box>
            <Box sx={{ px: 2, py: 0.5 }}>
              {tasks.length === 0
                ? <Typography sx={{ fontSize: 12, color: MUTED, py: 1.5 }}>No active tasks.</Typography>
                : tasks.map(t => <TaskItem key={t.id} task={t} />)}
            </Box>
          </Paper>

          {/* Completed today */}
          <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px",
            overflow: "hidden", bgcolor: "#fff" }}>
            <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`,
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                Completed Today
              </Typography>
              <Box sx={{ display: "inline-flex", bgcolor: SUCCESS_BG, border: `1px solid ${SUCCESS_BR}`,
                borderRadius: "20px", px: 1.25, py: 0.25, fontSize: 11, fontWeight: 600, color: SUCCESS }}>
                {tasksDone.length} done
              </Box>
            </Box>
            <Box sx={{ px: 2, py: 0.5 }}>
              {tasksDone.length === 0
                ? <Typography sx={{ fontSize: 12, color: MUTED, py: 1.5 }}>No completed tasks yet.</Typography>
                : tasksDone.slice(0, 5).map(t => <TaskItem key={t.id} task={t} />)}
            </Box>
          </Paper>

          {/* What Co-worker can do */}
          <Paper elevation={0} sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px",
            overflow: "hidden", bgcolor: "#fff" }}>
            <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}` }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
                What Co-worker Can Do
              </Typography>
            </Box>
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
              {WHAT_CAN_DO.map(item => (
                <Box key={item.title} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <Typography sx={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#5A6480", lineHeight: 1.5 }}>
                    <Box component="strong">{item.title}</Box> — {item.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Annotation strip */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {[
          "copyright@ nolyvra",
          "This AI tool is designed to assist you, not replace professional judgment.",
        ].map(l => (
          <Box key={l} sx={{ display: "inline-flex", alignItems: "center",
            bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`, borderRadius: "5px",
            px: 1, py: 0.25, fontSize: 10, fontWeight: 500, color: PURPLE }}>{l}</Box>
        ))}
      </Box>
    </Box>
  );
}
