const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`, ...extra };
}

function withLoginId(path, params = {}) {
  const loginId = localStorage.getItem("loginId") || "";
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("loginId", loginId);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  return url;
}

export async function apiGet(path, params) {
  const res = await fetch(withLoginId(path, params).toString(), { headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost(path, params, body) {
  const res = await fetch(withLoginId(path, params).toString(), {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function apiPatch(path, params) {
  const res = await fetch(withLoginId(path, params).toString(), { method: "PATCH", headers: authHeaders() });
  if (!res.ok) throw new Error(await res.text());
}

// ── Inbox-specific calls ────────────────────────────────────────────────────

export function listInboxMessages(provider, { unread = false, pageToken } = {}) {
  return apiGet("/api/inbox/messages", { provider, unread, pageToken });
}

export function getThread(provider, threadId) {
  return apiGet(`/api/inbox/threads/${encodeURIComponent(threadId)}`, { provider });
}

export function markRead(provider, messageId, read = true) {
  return apiPatch(`/api/inbox/messages/${encodeURIComponent(messageId)}/read`, { provider, read });
}

export function archiveMessage(provider, messageId) {
  return apiPost(`/api/inbox/messages/${encodeURIComponent(messageId)}/archive`, { provider });
}

export function sendReply({ provider, threadId, toAddress, subject, body, candidateId }) {
  return apiPost("/api/inbox/reply", {}, { provider, threadId, toAddress, subject, body, candidateId });
}

export function suggestTemplates(messageBody) {
  return apiPost("/api/inbox/templates/suggest", {}, { messageBody });
}

export function getMailboxStatus() {
  return Promise.allSettled([
    apiGet("/auth/google/status"),
    apiGet("/auth/microsoft/status"),
  ]).then(([gmailResult, outlookResult]) => ({
    google: gmailResult.status === "fulfilled" ? gmailResult.value : { connected: false },
    microsoft: outlookResult.status === "fulfilled" ? outlookResult.value : { connected: false },
  }));
}
