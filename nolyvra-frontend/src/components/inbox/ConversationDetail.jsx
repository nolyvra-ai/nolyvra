import { useEffect, useState } from "react";
import { Box, Typography, CircularProgress, Button, IconButton, Tooltip } from "@mui/material";
import ArchiveRoundedIcon from "@mui/icons-material/ArchiveRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import MarkEmailReadRoundedIcon from "@mui/icons-material/MarkEmailReadRounded";
import MarkEmailUnreadRoundedIcon from "@mui/icons-material/MarkEmailUnreadRounded";
import { QuillEditor } from "./emailEditorUtils";
import { BODY_MODULES, injectQuillStyles } from "./emailHelpers";
import { sendReply, suggestTemplates } from "./inboxApi";

const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SURFACE = "#FAFBFD", PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatFull(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ message }) {
  return (
    <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", mb: 1.5, bgcolor: message.outbound ? "#F7F9FF" : "#fff" }}>
      <Box sx={{ px: 1.75, py: 1, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: TEXT }}>
            {message.fromName || message.fromAddress} {message.outbound && <Box component="span" sx={{ color: ACCENT, fontWeight: 600 }}>(you)</Box>}
          </Typography>
          <Typography sx={{ fontSize: 11, color: MUTED }}>{message.fromAddress}</Typography>
        </Box>
        <Typography sx={{ fontSize: 10.5, color: MUTED, flexShrink: 0 }}>{formatFull(message.occurredAt)}</Typography>
      </Box>
      <Box sx={{ px: 1.75, py: 1.5, fontSize: 13, color: TEXT, lineHeight: 1.6 }}
        dangerouslySetInnerHTML={{ __html: message.bodyHtml || `<p>${(message.bodyText || "").replace(/\n/g, "<br>")}</p>` }} />
    </Box>
  );
}

// Right pane. mode="inbox" shows a live thread with a reply composer (AI
// template suggestions surfaced above it, replacing the old flat template
// list). mode="sent" shows a single already-sent email, read-only.
export default function ConversationDetail({ mode, thread, threadLoading, sentItem, provider, onArchive, onMarkRead, onReplySent }) {
  const [replyBody, setReplyBody] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  useEffect(() => { injectQuillStyles(); }, []);

  const lastInbound = mode === "inbox" && thread
    ? [...thread.messages].reverse().find(m => !m.outbound)
    : null;

  useEffect(() => {
    setReplyBody(""); setReplyError(null); setSuggestions([]);
    if (mode !== "inbox" || !lastInbound) return;

    const text = stripHtml(lastInbound.bodyHtml) || lastInbound.bodyText || "";
    if (!text) return;
    setSuggestionsLoading(true);
    suggestTemplates(text)
      .then(res => setSuggestions(res?.suggestions || []))
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.threadId, mode]);

  function applySuggestion(s) {
    setReplyBody(prev => (prev ? prev : `<p>${s.subject}</p><p><br></p>`));
  }

  async function handleReply() {
    if (!lastInbound || !replyBody.trim()) return;
    setReplySending(true); setReplyError(null);
    try {
      const sent = await sendReply({
        provider,
        threadId: thread.threadId,
        toAddress: lastInbound.fromAddress,
        subject: thread.subject?.toLowerCase().startsWith("re:") ? thread.subject : `Re: ${thread.subject || ""}`,
        body: replyBody,
      });
      onReplySent?.(sent);
      setReplyBody("");
    } catch (e) {
      setReplyError(e.message || "Failed to send reply.");
    } finally {
      setReplySending(false);
    }
  }

  if (mode === "sent" && sentItem) {
    return (
      <Box sx={{ flex: 1, overflowY: "auto", p: 2.25 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: TEXT, mb: 0.5 }}>{sentItem.subject}</Typography>
        <Typography sx={{ fontSize: 12, color: MUTED, mb: 2 }}>
          To: {sentItem.toAddress} · {formatFull(sentItem.sentAt)}
        </Typography>
        <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", p: 2, fontSize: 13, color: TEXT, lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: sentItem.body }} />
      </Box>
    );
  }

  if (mode === "inbox") {
    if (threadLoading) {
      return <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>;
    }
    if (!thread) {
      return <EmptyState />;
    }
    return (
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Box sx={{ px: 2.25, py: 1.5, borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {thread.subject || "(no subject)"}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
            {lastInbound && (
              <Tooltip title={lastInbound.unread ? "Mark as read" : "Mark as unread"}>
                <span>
                  <IconButton size="small" onClick={() => onMarkRead?.(lastInbound.id, !lastInbound.unread)} sx={{ color: MUTED }}>
                    {lastInbound.unread
                      ? <MarkEmailReadRoundedIcon sx={{ fontSize: 17 }} />
                      : <MarkEmailUnreadRoundedIcon sx={{ fontSize: 17 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip title="Archive">
              <span>
                <IconButton size="small" onClick={() => lastInbound && onArchive?.(lastInbound.id)} disabled={!lastInbound} sx={{ color: MUTED }}>
                  <ArchiveRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 2, bgcolor: SURFACE }}>
          {thread.messages.map(m => <MessageBubble key={m.id} message={m} />)}
        </Box>

        {lastInbound && (
          <Box sx={{ borderTop: `1px solid ${BORDER}`, p: 1.75, flexShrink: 0 }}>
            {(suggestionsLoading || suggestions.length > 0) && (
              <Box sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
                <AutoAwesomeRoundedIcon sx={{ fontSize: 14, color: PURPLE }} />
                {suggestionsLoading ? (
                  <Typography sx={{ fontSize: 11, color: MUTED }}>Finding a fitting template…</Typography>
                ) : suggestions.map(s => (
                  <Tooltip key={s.templateId} title={s.reason || ""}>
                    <Box onClick={() => applySuggestion(s)} sx={{
                      fontSize: 11, fontWeight: 600, color: PURPLE, bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`,
                      borderRadius: "20px", px: 1.25, py: 0.4, cursor: "pointer", "&:hover": { bgcolor: "#EDE9FE" },
                    }}>
                      {s.name} · {s.confidence}%
                    </Box>
                  </Tooltip>
                ))}
              </Box>
            )}

            {replyError && <Typography sx={{ fontSize: 11.5, color: "#DC2626", mb: 1 }}>{replyError}</Typography>}

            <QuillEditor value={replyBody} onChange={setReplyBody} modules={BODY_MODULES}
              placeholder={`Reply to ${lastInbound.fromName || lastInbound.fromAddress}…`} className="nolyvra-quill-compact" />
            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
              <Button variant="contained" size="small" onClick={handleReply} disabled={replySending || !replyBody.trim()}
                sx={{ fontSize: 12, fontWeight: 600, bgcolor: ACCENT, borderRadius: "8px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                {replySending ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Send Reply"}
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  return <EmptyState />;
}

function EmptyState() {
  return (
    <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Typography sx={{ fontSize: 12.5, color: MUTED }}>Select a conversation to view it here.</Typography>
    </Box>
  );
}
