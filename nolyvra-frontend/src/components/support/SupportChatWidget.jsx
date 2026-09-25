import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Fuse from "fuse.js";
import {
  Box, IconButton, TextField, Typography, CircularProgress,
} from "@mui/material";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import PlayCircleRoundedIcon from "@mui/icons-material/PlayCircleRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import { helpArticles } from "../../content/help";
import HelpArticleView from "../help/HelpArticleView";
import useDraggable from "../../hooks/useDraggable";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const DEMO_BOOKING_URL = "https://cal.com/sayan-bhattacharya-v2t36a/30min";

const FUSE_OPTIONS = {
  keys: [
    { name: "title", weight: 0.5 },
    { name: "summary", weight: 0.3 },
    { name: "tags", weight: 0.15 },
    { name: "body", weight: 0.05 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
};

// ── Nolyvra brand palette — matches the AI-surface gradient already used on
// CoWorkerPage, not Gojiberry's navy/orange reference ──────────────────────
const ACCENT = "#1D72E8";
const PURPLE = "#7C3AED";
const TEXT = "#0F1623";
const TEXT_SEC = "#5A6480";
const TEXT_MUTED = "#9AA3B4";
const BORDER = "#E2E6ED";
const SURFACE = "#F7F8FA";
const HEADER_GRADIENT = "linear-gradient(145deg, #1D2A4A 0%, #1D72E8 55%, #7C3AED 100%)";
const DANGER = "#DC2626";
const SUCCESS = "#16A34A";

// ── Team profiles — real photos in /public, one is randomly assigned as the
// chat "host" per widget session so the AI reads as a person, not a bot ──────
const TEAM_PROFILES = [
  { name: "Alyssa", photo: "/Alyssa.png" },
  { name: "Simon", photo: "/Simon.png" },
  { name: "Andrew", photo: "/Andrew.png" },
];

function formatRelativeTime(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function findRelevantArticles(fuse, message, limit = 3) {
  return fuse.search(message).slice(0, limit).map((r) => ({
    title: r.item.title,
    summary: r.item.summary,
    body: r.item.body,
  }));
}

async function postSupportChat(loginId, body) {
  const url = new URL(`${API_BASE}/api/support-chat`);
  url.searchParams.set("loginId", loginId);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Tab bar ────────────────────────────────────────────────────────────────
function TabBar({ activeTab, onChange, unreadCount }) {
  const tabs = [
    { key: "home", label: "Home", icon: HomeRoundedIcon },
    { key: "messages", label: "Messages", icon: ChatBubbleOutlineRoundedIcon, badge: unreadCount },
    { key: "help", label: "Help", icon: HelpOutlineRoundedIcon },
  ];
  return (
    <Box sx={{
      display: "flex", borderTop: `1px solid ${BORDER}`, bgcolor: "#fff",
      px: 1, py: "6px", flexShrink: 0,
    }}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = activeTab === t.key;
        return (
          <Box
            key={t.key}
            onClick={() => onChange(t.key)}
            sx={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
              gap: "2px", py: "6px", cursor: "pointer", position: "relative",
              color: active ? ACCENT : TEXT_MUTED,
            }}
          >
            <Box sx={{ position: "relative" }}>
              <Icon sx={{ fontSize: 22 }} />
              {t.badge > 0 && (
                <Box sx={{
                  position: "absolute", top: -4, right: -8, minWidth: 15, height: 15,
                  borderRadius: "8px", bgcolor: DANGER, color: "#fff",
                  fontSize: 9.5, fontWeight: 700, display: "flex", alignItems: "center",
                  justifyContent: "center", px: "3px",
                }}>
                  {t.badge}
                </Box>
              )}
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: active ? 700 : 500, color: "inherit" }}>
              {t.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ── Home tab ───────────────────────────────────────────────────────────────
function HomeTab({ userName, onGoToMessages, onGoToHelp, topArticles }) {
  return (
    <Box sx={{ flex: 1, overflowY: "auto", bgcolor: SURFACE }}>
      <Box sx={{ background: HEADER_GRADIENT, color: "#fff", px: 2.5, pt: 1, pb: 4 }}>
        <Typography sx={{ fontSize: 21, fontWeight: 800, lineHeight: 1.3 }}>
          Hi {userName} 👋
        </Typography>
        <Typography sx={{ fontSize: 21, fontWeight: 800, lineHeight: 1.3 }}>
          How can we help?
        </Typography>
      </Box>

      <Box sx={{ px: 1.75, mt: -2.5, display: "flex", flexDirection: "column", gap: 1.25 }}>
        {/* Video placeholder — real demo to be added later */}
        <Box sx={{
          bgcolor: "#fff", borderRadius: "12px", border: `1px solid ${BORDER}`,
          boxShadow: "0 2px 10px rgba(15,22,35,0.06)", overflow: "hidden",
        }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT, px: 1.75, pt: 1.5, pb: 1 }}>
            Nolyvra — Quick Start
          </Typography>
          <Box sx={{
            mx: 1.75, mb: 1.75, height: 140, borderRadius: "8px",
            background: "linear-gradient(135deg, #1D2A4A 0%, #1D72E8 100%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 0.5, color: "rgba(255,255,255,0.9)",
          }}>
            <PlayCircleRoundedIcon sx={{ fontSize: 40 }} />
            <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.75)" }}>
              Demo video coming soon
            </Typography>
          </Box>
          <Box sx={{ px: 1.75, pb: 1.75 }}>
            <Box
              component="a"
              href={DEMO_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: "flex", alignItems: "center", justifyContent: "center",
                py: 1, borderRadius: "8px", textDecoration: "none",
                bgcolor: ACCENT, color: "#fff", fontSize: 12.5, fontWeight: 700,
                "&:hover": { bgcolor: "#1660CC" },
              }}
            >
              Book a demo
            </Box>
          </Box>
        </Box>

        {/* Send us a message */}
        <Box
          onClick={onGoToMessages}
          sx={{
            bgcolor: "#fff", borderRadius: "12px", border: `1px solid ${BORDER}`,
            boxShadow: "0 2px 10px rgba(15,22,35,0.06)", px: 1.75, py: 1.5,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", "&:hover": { borderColor: ACCENT },
          }}
        >
          <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: TEXT }}>Send us a message</Typography>
          <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: ACCENT }} />
        </Box>

        {/* Search for help */}
        <Box
          onClick={onGoToHelp}
          sx={{
            bgcolor: SURFACE, borderRadius: "10px", border: `1px solid ${BORDER}`,
            px: 1.5, py: 1.1, display: "flex", alignItems: "center", gap: 1,
            cursor: "pointer", color: TEXT_MUTED,
          }}
        >
          <SearchRoundedIcon sx={{ fontSize: 18 }} />
          <Typography sx={{ fontSize: 13 }}>Search for help</Typography>
        </Box>

        {topArticles.map((a) => (
          <Box
            key={a.slug}
            onClick={() => onGoToHelp(a)}
            sx={{
              bgcolor: "#fff", borderRadius: "10px", border: `1px solid ${BORDER}`,
              px: 1.75, py: 1.25, display: "flex", alignItems: "center", justifyContent: "space-between",
              cursor: "pointer", "&:hover": { borderColor: ACCENT },
            }}
          >
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>{a.title}</Typography>
            <ChevronRightRoundedIcon sx={{ fontSize: 18, color: TEXT_MUTED, flexShrink: 0 }} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Messages tab (the existing agentic chat) ────────────────────────────────
function MessagesTab({ agent, userName, messages, sending, input, setInput, onSend, listRef }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const welcomeBubble = messages.length === 0 && (
    <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1, gap: 1 }}>
      <Box component="img" src={agent.photo} alt={agent.name} sx={{
        width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0, mt: "2px",
      }} />
      <Box sx={{ maxWidth: "80%" }}>
        <Box sx={{ bgcolor: "#fff", border: `1px solid ${BORDER}`, borderRadius: 2, px: 1.5, py: 1 }}>
          <Typography variant="body2" sx={{ color: TEXT }}>
            Hi {userName} 👋 I'm {agent.name} from Nolyvra. Ask me anything about the app — where a feature
            lives, or ask me to create a job, run analysis, and more. I'll take you to the right place.
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 10.5, color: TEXT_MUTED, mt: "3px", ml: "2px" }}>
          {agent.name} · just now
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Box ref={listRef} sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5, bgcolor: SURFACE }}>
        {welcomeBubble}
        {messages.map((m, i) => (
          <Box
            key={i}
            sx={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", mb: 1, gap: 1 }}
          >
            {m.role !== "user" && (
              <Box component="img" src={agent.photo} alt={agent.name} sx={{
                width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0, mt: "2px",
              }} />
            )}
            <Box sx={{ maxWidth: "80%" }}>
              <Box sx={{
                bgcolor: m.role === "user" ? ACCENT : "#fff",
                color: m.role === "user" ? "#fff" : TEXT,
                border: m.role === "user" ? "none" : `1px solid ${BORDER}`,
                borderRadius: 2, px: 1.5, py: 1,
              }}>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: "inherit" }}>
                  {m.content}
                </Typography>
                {m.escalated && (
                  <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: PURPLE, fontWeight: 600 }}>
                    Flagged for our team — you'll hear back by email shortly.
                  </Typography>
                )}
              </Box>
              {m.role !== "user" && (
                <Typography sx={{ fontSize: 10.5, color: TEXT_MUTED, mt: "3px", ml: "2px" }}>
                  {agent.name} · {formatRelativeTime(m.ts)}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
        {sending && (
          <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1, gap: 1 }}>
            <Box component="img" src={agent.photo} alt={agent.name} sx={{
              width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0, mt: "2px",
            }} />
            <CircularProgress size={16} sx={{ mt: "6px" }} />
          </Box>
        )}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, borderTop: `1px solid ${BORDER}` }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Type your question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          sx={{
            "& .MuiInputBase-input": { color: TEXT, caretColor: TEXT },
            "& .MuiOutlinedInput-root": { bgcolor: "#fff" },
          }}
        />
        <IconButton
          onClick={onSend}
          disabled={sending || !input.trim()}
          sx={{
            bgcolor: ACCENT, color: "#fff", "&:hover": { bgcolor: "#1660CC" },
            "&.Mui-disabled": { bgcolor: BORDER, color: "#fff" },
          }}
        >
          <SendRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

// ── Help tab (search + article list, reusing HelpArticleView) ──────────────
function HelpTab({ fuse, query, setQuery, selectedArticle, setSelectedArticle }) {
  const results = query.trim()
    ? fuse.search(query).map((r) => r.item)
    : helpArticles;

  if (selectedArticle) {
    return (
      <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.75, bgcolor: "#fff" }}>
        <HelpArticleView article={selectedArticle} onBack={() => setSelectedArticle(null)} />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflowY: "auto", bgcolor: SURFACE, px: 1.75, py: 1.75 }}>
      <Box sx={{
        bgcolor: "#fff", borderRadius: "10px", border: `1px solid ${BORDER}`,
        px: 1.5, py: 1, display: "flex", alignItems: "center", gap: 1, mb: 1.5,
      }}>
        <SearchRoundedIcon sx={{ fontSize: 18, color: TEXT_MUTED }} />
        <Box
          component="input"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for help"
          sx={{
            border: "none", outline: "none", bgcolor: "transparent",
            fontSize: 13, color: TEXT, width: "100%",
            "::placeholder": { color: TEXT_MUTED },
          }}
        />
      </Box>

      {results.length === 0 && (
        <Typography sx={{ fontSize: 12.5, color: TEXT_MUTED, textAlign: "center", py: 3 }}>
          No articles match "{query}".
        </Typography>
      )}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {results.map((a) => (
          <Box
            key={a.slug}
            onClick={() => setSelectedArticle(a)}
            sx={{
              bgcolor: "#fff", borderRadius: "10px", border: `1px solid ${BORDER}`,
              px: 1.75, py: 1.25, cursor: "pointer", "&:hover": { borderColor: ACCENT },
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT, mb: "2px" }}>
              {a.title}
            </Typography>
            {a.summary && (
              <Typography sx={{ fontSize: 11.5, color: TEXT_SEC, lineHeight: 1.4 }}>
                {a.summary}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Main widget ────────────────────────────────────────────────────────────
export default function SupportChatWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const listRef = useRef(null);

  const [helpQuery, setHelpQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);

  const userName = (localStorage.getItem("name") || "there").split(" ")[0];
  const fuse = useMemo(() => new Fuse(helpArticles, FUSE_OPTIONS), []);
  const topArticles = useMemo(() => helpArticles.slice(0, 3), []);
  const [agent] = useState(() => TEAM_PROFILES[Math.floor(Math.random() * TEAM_PROFILES.length)]);

  const { pos, containerRef, startDrag, consumeDragFlag, reclamp } = useDraggable({ right: 24, bottom: 24 });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending]);

  useEffect(() => { reclamp(); }, [open, reclamp]);

  function dragHandleProps(e) {
    if (e.target.closest("button")) return;
    startDrag(e);
  }

  function goToMessages() {
    setActiveTab("messages");
    setUnreadCount(0);
  }

  function goToHelp(article) {
    setSelectedArticle(article || null);
    setActiveTab("help");
  }

  function changeTab(tab) {
    setActiveTab(tab);
    if (tab === "messages") setUnreadCount(0);
  }

  const handleSend = async () => {
    const question = input.trim();
    if (!question || sending) return;

    const loginId = localStorage.getItem("loginId");
    const nextMessages = [...messages, { role: "user", content: question, ts: Date.now() }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const articles = findRelevantArticles(fuse, question);
      const history = nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const res = await postSupportChat(loginId, { message: question, articles, history });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, escalated: res.escalated, ts: Date.now() },
      ]);
      if (activeTab !== "messages" || !open) setUnreadCount((c) => c + 1);

      if (res.navigateTo) {
        setOpen(false);
        navigate(res.navigateTo);
      } else if (res.coworkerIntent) {
        setOpen(false);
        navigate("/coworker", { state: { coworkerIntent: res.coworkerIntent } });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong sending your message. Please try again.",
          escalated: false,
          ts: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Box ref={containerRef} sx={{ position: "fixed", right: pos.right, bottom: pos.bottom, zIndex: 1300 }}>
      {open && (
        <Box sx={{
          width: 380,
          height: 600,
          mb: 2,
          display: "flex",
          flexDirection: "column",
          borderRadius: "18px",
          overflow: "hidden",
          bgcolor: "#fff",
          boxShadow: "0 20px 50px rgba(15,22,35,0.25)",
        }}>
          {/* Header — branded on Home/Help, swaps to the assigned agent's identity on Messages */}
          {activeTab === "messages" ? (
            <Box onPointerDown={dragHandleProps} sx={{
              bgcolor: "#fff", borderBottom: `1px solid ${BORDER}`, color: TEXT, px: 1.5, py: 1.25,
              display: "flex", alignItems: "center", gap: 1, flexShrink: 0, cursor: "grab",
            }}>
              <IconButton size="small" onClick={() => setActiveTab("home")} sx={{ color: TEXT_SEC }}>
                <ArrowBackRoundedIcon fontSize="small" />
              </IconButton>
              <Box sx={{ position: "relative", flexShrink: 0 }}>
                <Box component="img" src={agent.photo} alt={agent.name} sx={{
                  width: 34, height: 34, borderRadius: "50%", objectFit: "cover",
                }} />
                <Box sx={{
                  position: "absolute", right: -1, bottom: -1, width: 9, height: 9, borderRadius: "50%",
                  bgcolor: SUCCESS, border: "1.5px solid #fff",
                }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: TEXT, lineHeight: 1.25 }}>
                  {agent.name}
                </Typography>
                <Typography sx={{ fontSize: 11, color: TEXT_MUTED }}>Active now</Typography>
              </Box>
              <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: TEXT_SEC }}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          ) : (
            <Box onPointerDown={dragHandleProps} sx={{
              background: HEADER_GRADIENT, color: "#fff", px: 2, pt: 2, pb: 1.5,
              display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
              cursor: "grab",
            }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{
                  width: 26, height: 26, borderRadius: "7px",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                }}>
                  ✨
                </Box>
                <Typography sx={{ fontSize: 14.5, fontWeight: 800 }}>Nolyvra Help</Typography>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ display: "flex" }}>
                  {TEAM_PROFILES.map((p, i) => (
                    <Box key={p.name} component="img" src={p.photo} alt={p.name} sx={{
                      width: 24, height: 24, borderRadius: "50%", objectFit: "cover",
                      border: "1.5px solid rgba(255,255,255,0.6)",
                      ml: i === 0 ? 0 : "-8px",
                    }} />
                  ))}
                </Box>
                <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "#fff" }}>
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          )}

          {/* Tab content */}
          {activeTab === "home" && (
            <HomeTab
              userName={userName}
              onGoToMessages={goToMessages}
              onGoToHelp={(article) => goToHelp(article)}
              topArticles={topArticles}
            />
          )}
          {activeTab === "messages" && (
            <MessagesTab
              agent={agent}
              userName={userName}
              messages={messages}
              sending={sending}
              input={input}
              setInput={setInput}
              onSend={handleSend}
              listRef={listRef}
            />
          )}
          {activeTab === "help" && (
            <HelpTab
              fuse={fuse}
              query={helpQuery}
              setQuery={setHelpQuery}
              selectedArticle={selectedArticle}
              setSelectedArticle={setSelectedArticle}
            />
          )}

          <TabBar activeTab={activeTab} onChange={changeTab} unreadCount={unreadCount} />
        </Box>
      )}

      <IconButton
        onPointerDown={startDrag}
        onClick={() => { if (consumeDragFlag()) return; setOpen((o) => !o); }}
        sx={{
          width: 56, height: 56, color: "#fff",
          background: HEADER_GRADIENT,
          boxShadow: "0 6px 20px rgba(124,58,237,0.35)",
          cursor: "grab",
          "&:hover": { background: HEADER_GRADIENT, opacity: 0.92 },
        }}
      >
        {open ? <CloseRoundedIcon /> : <ChatBubbleOutlineRoundedIcon />}
      </IconButton>
    </Box>
  );
}
