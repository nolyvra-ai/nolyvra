import { useMemo, useRef, useState, useEffect } from "react";
import Fuse from "fuse.js";
import {
  Box, Paper, IconButton, TextField, Typography, CircularProgress,
} from "@mui/material";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { helpArticles } from "../../content/help";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

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

const ACCENT = "#1D72E8";
const PURPLE = "#7C3AED";

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

export default function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const fuse = useMemo(() => new Fuse(helpArticles, FUSE_OPTIONS), []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || sending) return;

    const loginId = localStorage.getItem("loginId");
    const nextMessages = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const articles = findRelevantArticles(fuse, question);
      const history = nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const res = await postSupportChat(loginId, { message: question, articles, history });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, escalated: res.escalated },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong sending your message. Please try again.",
          escalated: false,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ position: "fixed", right: 24, bottom: 24, zIndex: 1300 }}>
      {open && (
        <Paper
          elevation={8}
          sx={{
            width: 360,
            height: 480,
            mb: 2,
            display: "flex",
            flexDirection: "column",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <Box sx={{
            bgcolor: ACCENT, color: "#fff", px: 2, py: 1.5,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
          >
            <Typography variant="subtitle1" fontWeight={700}>Nolyvra Help</Typography>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "#fff" }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box ref={listRef} sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5, bgcolor: "#F7F8FA" }}>
            {messages.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Ask a question about using Nolyvra — I'll search the Help Center for you.
              </Typography>
            )}
            {messages.map((m, i) => (
              <Box
                key={i}
                sx={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                  mb: 1,
                }}
              >
                <Box sx={{
                  maxWidth: "80%",
                  bgcolor: m.role === "user" ? ACCENT : "#fff",
                  color: m.role === "user" ? "#fff" : "#0F1623",
                  border: m.role === "user" ? "none" : "1px solid #E8ECF2",
                  borderRadius: 2,
                  px: 1.5, py: 1,
                }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{m.content}</Typography>
                  {m.escalated && (
                    <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: PURPLE, fontWeight: 600 }}>
                      Flagged for our team — you'll hear back by email shortly.
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
            {sending && (
              <Box sx={{ display: "flex", justifyContent: "flex-start", mb: 1 }}>
                <CircularProgress size={16} />
              </Box>
            )}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, borderTop: "1px solid #E8ECF2" }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Type your question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              sx={{
                "& .MuiInputBase-input": { color: "#0F1623", caretColor: "#0F1623" },
                "& .MuiOutlinedInput-root": { bgcolor: "#fff" },
              }}
            />
            <IconButton color="primary" onClick={handleSend} disabled={sending || !input.trim()}>
              <SendRoundedIcon />
            </IconButton>
          </Box>
        </Paper>
      )}

      <IconButton
        onClick={() => setOpen((o) => !o)}
        sx={{
          width: 56, height: 56, bgcolor: ACCENT, color: "#fff",
          boxShadow: 4, "&:hover": { bgcolor: ACCENT },
        }}
      >
        {open ? <CloseRoundedIcon /> : <ChatBubbleOutlineRoundedIcon />}
      </IconButton>
    </Box>
  );
}
