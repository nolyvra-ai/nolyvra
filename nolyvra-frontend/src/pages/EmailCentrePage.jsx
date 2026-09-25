import { useEffect, useMemo, useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import { useLocation } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import InboxSidebar from "../components/inbox/InboxSidebar";
import ConversationList from "../components/inbox/ConversationList";
import ConversationDetail from "../components/inbox/ConversationDetail";
import ComposeDialog from "../components/inbox/ComposeDialog";
import {
  apiGet, getMailboxStatus, listInboxMessages, getThread,
  markRead as apiMarkRead, archiveMessage,
} from "../components/inbox/inboxApi";

const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";

function NewTag() {
  return (
    <Box sx={{
      display: "inline-flex", alignItems: "center", px: "7px", py: "2px",
      bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`, borderRadius: "4px",
      fontSize: 10, fontWeight: 600, color: PURPLE, ml: 1,
    }}>NEW</Box>
  );
}

// Email Centre — a 3-pane shared inbox (sidebar / conversation list / detail
// pane). The Inbox/Unread views are a live proxy over the connected mailbox
// (Outlook/Gmail) — nothing fetched from them is ever stored. Sent stays
// backed by the existing local email_history, exactly as before; compose
// (single + bulk) is unchanged, just moved into a dialog.
export default function EmailCentrePage() {
  const location = useLocation();

  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);

  const [providers, setProviders] = useState({ google: { connected: false }, microsoft: { connected: false } });
  const [activeProvider, setActiveProvider] = useState(null);
  const [activeView, setActiveView] = useState("sent"); // "all" | "unread" | "sent"

  const [inboxRows, setInboxRows] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const [thread, setThread] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSeed, setComposeSeed] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      apiGet("/api/candidates/list"),
      apiGet("/api/jobs"),
      apiGet("/api/emails/templates"),
      apiGet("/api/emails/history"),
      getMailboxStatus(),
    ]).then(([cr, jr, tr, hr, pr]) => {
      if (cr.status === "fulfilled") setCandidates(cr.value);
      if (jr.status === "fulfilled") setJobs(jr.value);
      if (tr.status === "fulfilled") setTemplates(tr.value);
      if (hr.status === "fulfilled") setHistory(hr.value);
      if (pr.status === "fulfilled") {
        setProviders(pr.value);
        const first = pr.value.google?.connected ? "google" : pr.value.microsoft?.connected ? "microsoft" : null;
        if (first) { setActiveProvider(first); setActiveView("all"); }
      }

      const s = location.state;
      if (s && (s.bulkRecipients || s.toAddress || s.subject || s.body)) {
        setComposeSeed(s);
        setComposeOpen(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectedEmailProvider = providers.google?.connected
    ? { name: "Gmail", email: providers.google.email }
    : providers.microsoft?.connected
      ? { name: "Outlook", email: providers.microsoft.email }
      : null;

  useEffect(() => {
    setSelectedKey(null); setSelectedRow(null); setThread(null);
    if (activeView === "sent" || !activeProvider) return;

    setInboxLoading(true);
    setNextPageToken(null);
    listInboxMessages(activeProvider, { unread: activeView === "unread" })
      .then(res => { setInboxRows(res.messages || []); setNextPageToken(res.nextPageToken || null); })
      .catch(() => setInboxRows([]))
      .finally(() => setInboxLoading(false));
  }, [activeProvider, activeView]);

  function handleLoadMore() {
    if (!nextPageToken || !activeProvider) return;
    setLoadingMore(true);
    listInboxMessages(activeProvider, { unread: activeView === "unread", pageToken: nextPageToken })
      .then(res => {
        setInboxRows(prev => [...prev, ...(res.messages || [])]);
        setNextPageToken(res.nextPageToken || null);
      })
      .finally(() => setLoadingMore(false));
  }

  const rows = useMemo(() => {
    if (activeView === "sent") {
      return history.map(h => ({
        key: `sent-${h.id}`, title: h.subject, preview: null,
        personLabel: h.toAddress, timestamp: h.sentAt, unread: false, raw: h,
      }));
    }
    return inboxRows.map(m => ({
      key: `${m.provider}-${m.id}`, title: m.subject, preview: m.snippet,
      personLabel: m.fromName || m.fromAddress, timestamp: m.occurredAt, unread: m.unread, raw: m,
    }));
  }, [activeView, history, inboxRows]);

  function handleSelect(row) {
    setSelectedKey(row.key);
    setSelectedRow(row);
    if (activeView === "sent") { setThread(null); return; }

    setThreadLoading(true);
    getThread(activeProvider, row.raw.threadId)
      .then(t => {
        setThread(t);
        if (row.raw.unread) {
          setInboxRows(prev => prev.map(m => m.id === row.raw.id ? { ...m, unread: false } : m));
          apiMarkRead(activeProvider, row.raw.id, true).catch(() => {});
        }
      })
      .catch(() => setThread(null))
      .finally(() => setThreadLoading(false));
  }

  function handleArchive(messageId) {
    if (!activeProvider) return;
    archiveMessage(activeProvider, messageId).catch(() => {});
    setInboxRows(prev => prev.filter(m => m.id !== messageId));
    setThread(null); setSelectedKey(null); setSelectedRow(null);
  }

  function handleMarkRead(messageId, read) {
    if (!activeProvider) return;
    apiMarkRead(activeProvider, messageId, read).catch(() => {});
    setInboxRows(prev => prev.map(m => m.id === messageId ? { ...m, unread: !read } : m));
    setThread(prev => prev
      ? { ...prev, messages: prev.messages.map(m => m.id === messageId ? { ...m, unread: !read } : m) }
      : prev);
  }

  function appendToHistory(sent) {
    if (sent) setHistory(prev => [sent, ...prev]);
  }

  function openCompose(seed = null) {
    setComposeSeed(seed);
    setComposeOpen(true);
  }

  // Only counts what's currently loaded on the "all" page — a full-mailbox
  // unread count would need a dedicated call; this is a lightweight
  // approximation rather than an extra round trip per render.
  const unreadCount = activeView === "all" ? inboxRows.filter(r => r.unread).length : undefined;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, height: "calc(100vh - 140px)" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Email Centre</Typography>
            <NewTag />
          </Box>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>
            Your real inbox, read live — plus everything you've sent
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={() => openCompose(null)}
          sx={{
            fontSize: 12, fontWeight: 600, bgcolor: ACCENT, borderRadius: "8px",
            textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" },
          }}>
          New Email
        </Button>
      </Box>

      <Box sx={{
        flex: 1, display: "flex", border: `1px solid ${BORDER}`, borderRadius: "10px",
        overflow: "hidden", bgcolor: "#fff", minHeight: 0,
      }}>
        <InboxSidebar
          providers={providers} activeProvider={activeProvider} onProviderChange={setActiveProvider}
          activeView={activeView} onViewChange={setActiveView} unreadCount={unreadCount}
        />
        <ConversationList
          rows={rows}
          loading={activeView !== "sent" && inboxLoading}
          selectedKey={selectedKey}
          onSelect={handleSelect}
          hasMore={activeView !== "sent" && !!nextPageToken}
          onLoadMore={handleLoadMore}
          loadingMore={loadingMore}
          emptyLabel={activeView === "sent"
            ? "No emails sent yet."
            : (activeProvider ? "Nothing here." : "Connect a mailbox to see your inbox.")}
        />
        <ConversationDetail
          mode={selectedRow ? (activeView === "sent" ? "sent" : "inbox") : null}
          thread={thread}
          threadLoading={threadLoading}
          sentItem={selectedRow?.raw}
          provider={activeProvider}
          onArchive={handleArchive}
          onMarkRead={handleMarkRead}
          onReplySent={appendToHistory}
        />
      </Box>

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        candidates={candidates}
        jobs={jobs}
        templates={templates}
        connectedEmailProvider={connectedEmailProvider}
        initialSeed={composeSeed}
        onSent={appendToHistory}
      />
    </Box>
  );
}
