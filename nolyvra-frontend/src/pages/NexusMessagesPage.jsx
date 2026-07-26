// ─── NexusMessagesPage.jsx ───────────────────────────────────────────────────
// Recruiter's Messages tab — a stateless client of Nexus's v0.6 read endpoints
// (GET /api/v1/messaging/threads, GET /api/v1/messaging/threads/{id}/messages).
// Nothing is persisted locally: every open re-fetches live from Nexus.
//
// Thread summaries carry `displayName` (added 2026-07-26, see shared-contracts.md) —
// falls back to the raw candidateId only if Nexus returns a null name.
import { useState, useEffect } from "react";
import { Box, Paper, Typography, Button, TextField, CircularProgress, Alert } from "@mui/material";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623";
const NEXUS = "#0D9488", NEXUS_BG = "#F0FDFA";

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`, ...extra };
}

export function NexusMessagesPage() {
  const loginId = localStorage.getItem("loginId") || "";

  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [error, setError] = useState(null);

  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  async function loadThreads() {
    setLoadingThreads(true); setError(null);
    try {
      const url = new URL(`${API_BASE}/api/nexus-messaging/threads`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setThreads((data ?? []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) { setError(e.message); }
    finally { setLoadingThreads(false); }
  }

  useEffect(() => { loadThreads(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function openThread(thread) {
    setSelectedThread(thread);
    setMessages([]); setSendError(""); setReplyBody("");
    setLoadingMessages(true);
    try {
      const url = new URL(`${API_BASE}/api/nexus-messaging/threads/${thread.id}/messages`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { headers: authHeaders() });
      if (!res.ok) throw new Error(await res.text());
      setMessages((await res.json()) ?? []);
    } catch (e) { setError(e.message); }
    finally { setLoadingMessages(false); }
  }

  async function handleReply() {
    if (!replyBody.trim() || !selectedThread) return;
    setSending(true); setSendError("");
    try {
      const url = new URL(`${API_BASE}/api/talent-search/nexus-blend/message`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ nexusCandidateId: selectedThread.candidateId, body: replyBody }),
      });
      if (!res.ok) throw new Error(await res.text());
      setReplyBody("");
      await openThread(selectedThread);
    } catch (e) { setSendError(e.message); }
    finally { setSending(false); }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Nexus Messages</Typography>
        <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
          Conversations with Nexus-verified candidates, started from AI Talent Search
        </Typography>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ display: "flex", gap: 2, height: "calc(100vh - 180px)" }}>
        {/* Thread list */}
        <Paper elevation={0} sx={{ width: 320, flexShrink: 0, border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <Box sx={{ flex: 1, overflowY: "auto" }}>
            {loadingThreads && (
              <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={20} sx={{ color: NEXUS }} /></Box>
            )}
            {!loadingThreads && threads.length === 0 && (
              <Box sx={{ p: 3, textAlign: "center", color: MUTED, fontSize: 12.5 }}>
                No conversations yet — message a candidate from AI Talent Search to start one.
              </Box>
            )}
            {threads.map(t => (
              <Box key={t.id} onClick={() => openThread(t)}
                sx={{
                  p: 1.75, borderBottom: "1px solid #F1F3F7", cursor: "pointer",
                  bgcolor: selectedThread?.id === t.id ? NEXUS_BG : "transparent",
                  "&:hover": { bgcolor: selectedThread?.id === t.id ? NEXUS_BG : "#FAFBFD" },
                }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: TEXT, fontFamily: t.displayName ? "inherit" : "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.displayName || t.candidateId}
                </Typography>
                <Typography sx={{ fontSize: 10.5, color: MUTED, mt: 0.25 }}>
                  Started {new Date(t.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>

        {/* Thread detail */}
        <Paper elevation={0} sx={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: "10px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!selectedThread ? (
            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>
              Select a conversation to view messages
            </Box>
          ) : (
            <>
              <Box sx={{ p: 2, borderBottom: `1px solid ${BORDER}` }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT, fontFamily: selectedThread.displayName ? "inherit" : "monospace" }}>
                  {selectedThread.displayName || selectedThread.candidateId}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1.25 }}>
                {loadingMessages && (
                  <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress size={20} sx={{ color: NEXUS }} /></Box>
                )}
                {!loadingMessages && messages.length === 0 && (
                  <Box sx={{ textAlign: "center", py: 3, color: MUTED, fontSize: 12.5 }}>No messages yet.</Box>
                )}
                {messages.map(m => (
                  <Box key={m.id} sx={{ alignSelf: m.sender === "RECRUITER" ? "flex-end" : "flex-start", maxWidth: "70%" }}>
                    <Box sx={{
                      px: 1.5, py: 1, borderRadius: "10px",
                      bgcolor: m.sender === "RECRUITER" ? NEXUS : "#F1F3F7",
                      color: m.sender === "RECRUITER" ? "#fff" : TEXT,
                    }}>
                      <Typography sx={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}>{m.body}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 10, color: MUTED, mt: 0.25, textAlign: m.sender === "RECRUITER" ? "right" : "left" }}>
                      {m.sender === "RECRUITER" ? "You" : "Candidate"} · {new Date(m.sentAt).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {sendError && <Alert severity="error" sx={{ mx: 2, mb: 1 }} onClose={() => setSendError("")}>{sendError}</Alert>}
              <Box sx={{ p: 2, borderTop: `1px solid ${BORDER}`, display: "flex", gap: 1 }}>
                <TextField fullWidth multiline maxRows={4} size="small" placeholder="Write a reply…"
                  value={replyBody} onChange={e => setReplyBody(e.target.value)} disabled={sending} />
                <Button variant="contained" disabled={sending || !replyBody.trim()} onClick={handleReply}
                  sx={{ bgcolor: NEXUS, textTransform: "none", boxShadow: "none", flexShrink: 0, "&:hover": { bgcolor: "#0F766E", boxShadow: "none" } }}>
                  {sending ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Send"}
                </Button>
              </Box>
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

export default NexusMessagesPage;
