import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, CircularProgress, Dialog, DialogContent, DialogActions,
  TextField, MenuItem, Checkbox, Button, Alert, IconButton, Tooltip,
  Tabs, Tab,
} from "@mui/material";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SyncIcon from "@mui/icons-material/Sync";
import AddClientDialog from "./AddClientDialog";

// ─── Design tokens ────────────────────────────────────────────────────────────
const SURFACE  = "#FFFFFF";
const BORDER   = "#E8ECF2";
const MUTED    = "#8A94A6";
const TEXT     = "#0F1623";
const ACCENT   = "#1D72E8";
const ACCENT_L = "rgba(29,114,232,0.08)";
const SUCCESS  = "#16A34A";
const SUCCESS_L = "rgba(22,163,74,0.08)";
const WARN     = "#D97706";
const WARN_L   = "rgba(217,119,6,0.08)";
const PURPLE   = "#7C3AED";
const PURPLE_L = "rgba(124,58,237,0.08)";
const BG       = "#F4F6FA";
const HUBSPOT  = "#FF7A59";
const HUBSPOT_L = "rgba(255,122,89,0.08)";
const HUBSPOT_BR = "rgba(255,122,89,0.25)";
const HUBSPOT_LABEL_BG = "#FFF1EC";

const CARD_BASE = {
  bgcolor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: "12px",
  boxShadow: "0 1px 4px rgba(15,22,35,0.05)",
  overflow: "hidden",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 10px",
  border: `1px solid ${BORDER}`,
  borderRadius: "8px",
  fontSize: 12,
  color: TEXT,
  outline: "none",
  fontFamily: "inherit",
  background: SURFACE,
};

const FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px", fontSize: 13,
    "& fieldset": { borderColor: BORDER },
    "&:hover fieldset": { borderColor: ACCENT },
    "&.Mui-focused fieldset": { borderColor: ACCENT },
  },
  "& .MuiInputLabel-root": { fontSize: 13 },
};

// ─── API helpers ──────────────────────────────────────────────────────────────
const API     = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const loginId = () => localStorage.getItem("loginId") || "";
const hdrs    = () => ({
  Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
  "Content-Type": "application/json",
});

async function apiError(response) {
  const text = await response.text();
  let message;
  try {
    const json = JSON.parse(text);
    message = json.message || json.error || "Request failed";
  } catch {
    message = text || "Request failed";
  }
  const error = new Error(message);
  error.status = response.status;
  return error;
}

// ── Last-search cache (restores the last Potential Clients search on page
// load, if the recruiter has already searched something before) ─────────────
function potentialSearchCacheKey() { return `nolyvra:potentialClientsCache:${loginId()}`; }

function loadPotentialSearchCache() {
  if (!loginId()) return null;
  try {
    const raw = localStorage.getItem(potentialSearchCacheKey());
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePotentialSearchCache(cache) {
  if (!loginId()) return;
  try { localStorage.setItem(potentialSearchCacheKey(), JSON.stringify(cache)); }
  catch { /* storage full/unavailable — ignore */ }
}

async function apiGet(path) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${API}${path}${sep}loginId=${encodeURIComponent(loginId())}`, { headers: hdrs() });
  if (!r.ok) throw await apiError(r);
  return r.json();
}

async function apiPost(path, body) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${API}${path}${sep}loginId=${encodeURIComponent(loginId())}`, {
    method: "POST", headers: hdrs(), body: JSON.stringify(body),
  });
  if (!r.ok) throw await apiError(r);
  return r.text();
}

async function apiPostJson(path, body) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${API}${path}${sep}loginId=${encodeURIComponent(loginId())}`, {
    method: "POST", headers: hdrs(), body: JSON.stringify(body),
  });
  if (!r.ok) throw await apiError(r);
  return r.json();
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const BuildingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const SparkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const InvoiceIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
    <path d="M14 2v6h6"/>
    <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
  </svg>
);

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color = ACCENT, bg = ACCENT_L, icon }) {
  return (
    <Box sx={{ ...CARD_BASE, p: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
      <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: bg,
        color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </Box>
      <Box>
        <Box sx={{ fontSize: 22, fontWeight: 700, color: TEXT, lineHeight: 1.1 }}>{value}</Box>
        <Box sx={{ fontSize: 12, color: MUTED, mt: "2px" }}>{label}</Box>
      </Box>
    </Box>
  );
}

// ─── Industry tag ─────────────────────────────────────────────────────────────
function Tag({ children, color = ACCENT, bg = ACCENT_L }) {
  return (
    <Box component="span" sx={{
      display: "inline-block", px: "8px", py: "2px", borderRadius: "20px",
      fontSize: 11, fontWeight: 600, color, bgcolor: bg,
    }}>
      {children}
    </Box>
  );
}

// ─── Job status pill ──────────────────────────────────────────────────────────
const STATUS_COLORS = {
  active:      { color: "#16A34A", bg: "rgba(22,163,74,0.08)" },
  fulfilling:  { color: "#1D72E8", bg: "rgba(29,114,232,0.08)" },
  filled:      { color: "#6B7280", bg: "rgba(107,114,128,0.08)" },
  closed:      { color: "#6B7280", bg: "rgba(107,114,128,0.08)" },
  "on hold":   { color: "#D97706", bg: "rgba(217,119,6,0.08)" },
  offer:       { color: "#D97706", bg: "rgba(217,119,6,0.08)" },
};
function JobStatusTag({ status }) {
  if (!status) return null;
  const key = status.toLowerCase();
  const { color, bg } = STATUS_COLORS[key] || { color: MUTED, bg: "rgba(138,148,166,0.08)" };
  return (
    <Box component="span" sx={{
      px: "6px", py: "1px", borderRadius: "4px", fontSize: 10, fontWeight: 600,
      color, bgcolor: bg, whiteSpace: "nowrap",
    }}>
      {status}
    </Box>
  );
}

// ─── Section label (used in detail modal) ─────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <Box sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase",
      letterSpacing: ".7px", mb: "8px" }}>
      {children}
    </Box>
  );
}

// ─── Detail row (used in detail modal) ───────────────────────────────────────
function DetailRow({ label, value, valueColor = TEXT }) {
  if (value === null || value === undefined || value === "" || value === 0) return null;
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: "5px" }}>
      <Box sx={{ fontSize: 12, color: MUTED, flexShrink: 0, mr: "8px" }}>{label}</Box>
      <Box sx={{ fontSize: 12, fontWeight: 500, color: valueColor, textAlign: "right" }}>{value}</Box>
    </Box>
  );
}

// ─── Format a list of { currency, amount } fee totals into a display string ──
function formatFeeTotals(totals) {
  if (!totals || totals.length === 0) return null;
  return totals
    .map(t => `${t.currency} ${Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
    .join("  +  ");
}

// ─── Client row ───────────────────────────────────────────────────────────────
function ClientRow({ client, onEdit, onSelect, onInvoice, hubSpotStatus }) {
  const feeLabel = formatFeeTotals(client.totalFee);
  const hubSpotLinked = Boolean(hubSpotStatus?.linked);
  const hubSpotFailed = hubSpotStatus?.state === "sync_failed";
  const hubSpotLabel = hubSpotFailed ? "Sync failed" : hubSpotLinked ? "In HubSpot" : null;
  return (
    <Box onClick={() => onSelect(client)} sx={{
      display: "grid",
      gridTemplateColumns: "2fr 1.5fr 1fr 1.2fr 2fr 2fr",
      alignItems: "center",
      px: "16px", py: "12px",
      borderBottom: `1px solid ${BORDER}`,
      cursor: "pointer",
      "&:hover": { bgcolor: "#FAFBFD" },
    }}>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
          <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{client.companyName}</Box>
          {hubSpotLabel && (
            <Box component="span" sx={{
              px: "6px", py: "1px", borderRadius: "4px", fontSize: 9, fontWeight: 700,
              color: hubSpotFailed ? "#DC2626" : HUBSPOT,
              bgcolor: hubSpotFailed ? "#FEF2F2" : HUBSPOT_LABEL_BG,
              border: `1px solid ${hubSpotFailed ? "rgba(220,38,38,0.18)" : HUBSPOT_BR}`,
              whiteSpace: "nowrap",
              cursor: "default",
              "&:hover": { bgcolor: hubSpotFailed ? "#FEF2F2" : HUBSPOT_LABEL_BG },
            }}
            onClick={e => e.stopPropagation()}>
              {hubSpotLabel}
            </Box>
          )}
        </Box>
        <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>
          {[client.industry, client.location].filter(Boolean).join(" • ")}
        </Box>
      </Box>
      <Box>
        {client.contactPerson
          ? <Box sx={{ fontSize: 13, color: TEXT }}>{client.contactPerson}</Box>
          : <Box sx={{ fontSize: 12, color: MUTED }}>—</Box>}
        {client.contactEmail && <Box sx={{ fontSize: 11, color: MUTED, mt: "1px" }}>{client.contactEmail}</Box>}
        {hubSpotStatus?.contactState === "success" && (
          <Box sx={{ fontSize: 10, color: HUBSPOT, fontWeight: 600, mt: "2px" }}>Contact synced</Box>
        )}
        {hubSpotStatus?.contactState === "failed" && (
          <Tooltip title={hubSpotStatus.contactSyncError || "Contact sync failed"}>
            <Box sx={{ fontSize: 10, color: "#DC2626", fontWeight: 600, mt: "2px", width: "fit-content" }}>
              Contact failed
            </Box>
          </Tooltip>
        )}
        {hubSpotStatus?.contactState === "skipped" && (
          <Box sx={{ fontSize: 10, color: MUTED, mt: "2px" }}>Contact skipped: no email</Box>
        )}
      </Box>
      <Box>
        <Box sx={{ fontSize: 13, fontWeight: 600, color: client.activeJobCount > 0 ? SUCCESS : MUTED }}>
          {client.activeJobCount} Active
        </Box>
        {client.totalJobCount > 0 && (
          <Box sx={{ fontSize: 11, color: MUTED }}>{client.totalJobCount} Total</Box>
        )}
      </Box>
      <Box>
        {feeLabel
          ? <Box sx={{ fontSize: 13, fontWeight: 700, color: SUCCESS }}>{feeLabel}</Box>
          : <Box sx={{ fontSize: 12, color: MUTED }}>—</Box>}
      </Box>
      <Box>
        {client.recentJobs?.length > 0 ? (
          client.recentJobs.map((job, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "3px" }}>
              <Box sx={{ fontSize: 12, color: TEXT, fontWeight: 500, flexShrink: 0 }}>{job.title}</Box>
              <Box sx={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>· {job.daysOld}d</Box>
              <JobStatusTag status={job.status} />
            </Box>
          ))
        ) : (
          <Box sx={{ fontSize: 12, color: MUTED }}>No active or fulfilling jobs</Box>
        )}
      </Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: "6px" }}>
        {hubSpotLinked && hubSpotStatus.externalUrl && (
          <Tooltip title="Open in HubSpot">
            <IconButton
              component="a"
              href={hubSpotStatus.externalUrl}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              size="small"
              aria-label={`Open ${client.companyName} in HubSpot`}
              sx={{ width: 28, height: 28, border: `1px solid ${BORDER}`, borderRadius: "6px",
                color: HUBSPOT, bgcolor: SURFACE, "&:hover": { borderColor: HUBSPOT, bgcolor: HUBSPOT_L } }}
            >
              <OpenInNewIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        )}
        <Box onClick={e => { e.stopPropagation(); onInvoice(client); }} sx={{
          px: "8px", py: "5px", borderRadius: "6px",
          border: `1px solid ${BORDER}`, color: MUTED, bgcolor: SURFACE,
          display: "flex", alignItems: "center", cursor: "pointer",
          "&:hover": { color: ACCENT, borderColor: ACCENT }, transition: "all .12s",
        }}>
          <InvoiceIcon />
        </Box>
        <Box onClick={e => { e.stopPropagation(); onEdit(client); }} sx={{
          px: "8px", py: "5px", borderRadius: "6px",
          border: `1px solid ${BORDER}`, color: MUTED, bgcolor: SURFACE,
          display: "flex", alignItems: "center", cursor: "pointer",
          "&:hover": { color: ACCENT, borderColor: ACCENT }, transition: "all .12s",
        }}>
          <EditIcon />
        </Box>
      </Box>
    </Box>
  );
}

// ─── Client detail dialog — read-only client record + notes timeline + jobs ──
function formatNoteTimestamp(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` };
}

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function InfoField({ label, value, span }) {
  return (
    <Box sx={{ gridColumn: span ? "1 / -1" : "auto" }}>
      <Box sx={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".4px", mb: "3px" }}>
        {label}
      </Box>
      <Box sx={{ fontSize: 13, color: value ? TEXT : "#C7CDD6", whiteSpace: value ? "pre-wrap" : "normal" }}>
        {value || "Not available"}
      </Box>
    </Box>
  );
}

function SocialIcon({ href, title, svg }) {
  const enabled = !!href;
  const body = (
    <Box sx={{
      width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      bgcolor: enabled ? ACCENT_L : "#F1F3F7", color: enabled ? ACCENT : "#C7CDD6",
      cursor: enabled ? "pointer" : "default", flexShrink: 0,
    }}>
      {svg}
    </Box>
  );
  return (
    <Tooltip title={enabled ? title : `${title} — Not available`}>
      {enabled
        ? <Box component="a" href={href} target="_blank" rel="noopener noreferrer">{body}</Box>
        : body}
    </Tooltip>
  );
}

const LinkedInSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.03-1.85-3.03-1.85 0-2.14 1.45-2.14 2.94v5.66H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>;
const FacebookSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>;
const TwitterSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-6.9L4.4 22H1.3l8.1-9.3L1 2h7l4.9 6.4L18.9 2zm-1.2 18h1.9L7.4 4H5.4L17.7 20z"/></svg>;
const WebsiteSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const PinSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IndustrySvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18M5 21V7l6-4 6 4v14M9 9h1M9 13h1M14 9h1M14 13h1"/></svg>;
const ChevronSvg = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s" }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const UploadSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
const DownloadSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const TrashSvg = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;

// ─── Empty state (shared across tabs with no data) ────────────────────────────
function TabEmptyState({ icon, title, desc }) {
  return (
    <Box sx={{ py: "48px", textAlign: "center" }}>
      <Box sx={{ fontSize: 40, mb: "12px", color: "#C7CDD6" }}>{icon}</Box>
      <Box sx={{ fontSize: 14, fontWeight: 700, color: TEXT, mb: "4px" }}>{title}</Box>
      {desc && <Box sx={{ fontSize: 12, color: MUTED }}>{desc}</Box>}
    </Box>
  );
}

const CLIENT_TABS = [
  { key: "jobs",     label: "Jobs" },
  { key: "emails",   label: "Related Emails" },
  { key: "pitched",  label: "Candidates Pitched" },
  { key: "employed", label: "Candidates Employed" },
  { key: "files",    label: "Files" },
  { key: "invoices", label: "Invoices" },
  { key: "notes",    label: "Notes" },
  { key: "contacts", label: "Contacts" },
];

function CandidateList({ loading, candidates, emptyTitle }) {
  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>;
  }
  if (candidates.length === 0) {
    return <TabEmptyState icon="👤" title={emptyTitle} />;
  }
  return (
    <Box>
      {candidates.map((c, i) => (
        <Box key={c.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          py: "10px", borderBottom: i < candidates.length - 1 ? `1px solid ${BORDER}` : "none" }}>
          <Box>
            <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{c.name || "—"}</Box>
            <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>
              {[c.email, c.jobTitle].filter(Boolean).join(" · ") || "—"}
            </Box>
          </Box>
          <Tag color={ACCENT} bg={ACCENT_L}>{c.stage || "—"}</Tag>
        </Box>
      ))}
    </Box>
  );
}

function ClientDetailDialog({ client, onClose, onEdit }) {
  const nav = useNavigate();

  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  const [emails, setEmails]             = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(true);

  const [notes, setNotes]               = useState([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [newNote, setNewNote]           = useState("");
  const [addingNote, setAddingNote]     = useState(false);
  const [noteError, setNoteError]       = useState("");

  const [pitched, setPitched]           = useState([]);
  const [pitchedLoading, setPitchedLoading] = useState(true);
  const [employed, setEmployed]         = useState([]);
  const [employedLoading, setEmployedLoading] = useState(true);

  const [invoices, setInvoices]         = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  const [files, setFiles]               = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [uploading, setUploading]       = useState(false);
  const [fileError, setFileError]       = useState("");

  const [overviewOpen, setOverviewOpen] = useState(true);
  const [showMore, setShowMore]         = useState(false);
  const [tab, setTab]                   = useState("jobs");

  const [addingContactFor, setAddingContactFor] = useState(null); // "primary" | secondary index
  const [contactAddError, setContactAddError] = useState("");
  const [existingContacts, setExistingContacts] = useState([]);

  function isAlreadyAddedContact(name) {
    if (!name?.trim()) return false;
    return existingContacts.some(c => c.name?.trim().toLowerCase() === name.trim().toLowerCase());
  }

  async function addAsClientContact(person, key) {
    if (!person.name?.trim() || isAlreadyAddedContact(person.name)) return;
    setAddingContactFor(key);
    setContactAddError("");
    try {
      const created = await apiPostJson("/api/contacts", {
        clientId: client.id,
        name: person.name, title: person.title, email: person.email, phone: person.phone,
      });
      setExistingContacts(prev => [...prev, created]);
      nav(`/contacts/${created.id}`);
    } catch (e) {
      setContactAddError(e.message || "Failed to add contact.");
    } finally {
      setAddingContactFor(null);
    }
  }

  function loadInvoices() {
    setInvoicesLoading(true);
    apiGet(`/api/clients/${client.id}/invoices`)
      .then(data => setInvoices(data || []))
      .catch(() => {})
      .finally(() => setInvoicesLoading(false));
  }

  function loadFiles() {
    setFilesLoading(true);
    apiGet(`/api/clients/${client.id}/files`)
      .then(data => setFiles(data || []))
      .catch(() => {})
      .finally(() => setFilesLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiGet(`/api/clients/${client.id}/jobs`)
      .then(data => { if (!cancelled) setJobs(data || []); })
      .catch(e => { if (!cancelled) setErr(e.message || "Failed to load jobs."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    setNotesLoading(true);
    apiGet(`/api/clients/${client.id}/notes`)
      .then(data => { if (!cancelled) setNotes(data || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setNotesLoading(false); });

    setEmailsLoading(true);
    apiGet(`/api/clients/${client.id}/emails`)
      .then(data => { if (!cancelled) setEmails(data || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEmailsLoading(false); });

    setPitchedLoading(true);
    apiGet(`/api/clients/${client.id}/candidates-pitched`)
      .then(data => { if (!cancelled) setPitched(data || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPitchedLoading(false); });

    setEmployedLoading(true);
    apiGet(`/api/clients/${client.id}/candidates-employed`)
      .then(data => { if (!cancelled) setEmployed(data || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEmployedLoading(false); });

    apiGet(`/api/clients/${client.id}/contacts`)
      .then(data => { if (!cancelled) setExistingContacts(data || []); })
      .catch(() => {});

    loadInvoices();
    loadFiles();

    return () => { cancelled = true; };
  }, [client.id]);

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    setNoteError("");
    try {
      const updated = await apiPostJson(`/api/clients/${client.id}/notes`, { note: newNote.trim() });
      setNotes(updated || []);
      setNewNote("");
    } catch (e) {
      setNoteError(e.message || "Failed to add note.");
    } finally {
      setAddingNote(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setFileError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${API}/api/clients/${client.id}/files?loginId=${encodeURIComponent(loginId())}`, {
        method: "POST", headers: authHeader(), body: form,
      });
      if (!r.ok) throw await apiError(r);
      loadFiles();
    } catch (e) {
      setFileError(e.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  }

  async function handleFileDelete(fileId) {
    if (!window.confirm("Delete this file?")) return;
    try {
      const r = await fetch(`${API}/api/clients/${client.id}/files/${fileId}?loginId=${encodeURIComponent(loginId())}`, {
        method: "DELETE", headers: authHeader(),
      });
      if (!r.ok) throw await apiError(r);
      setFiles(prev => prev.filter(f => f.id !== fileId));
    } catch (e) {
      setFileError(e.message || "Failed to delete file.");
    }
  }

  function handleFileDownload(f) {
    const url = `${API}/api/clients/${client.id}/files/${f.id}?loginId=${encodeURIComponent(loginId())}`;
    fetch(url, { headers: authHeader() })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = f.fileName;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => setFileError("Failed to download file."));
  }

  function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  const totalLabel = formatFeeTotals(client.totalFee);
  const secondaryContacts = client.secondaryContacts || [];
  const locationLine = [client.locality, client.state, client.country].filter(Boolean).join(", ");

  return (
    <Dialog open onClose={onClose} maxWidth="xl" fullWidth
      PaperProps={{ sx: { borderRadius: "16px", overflow: "hidden", m: "24px" } }}>
      <DialogContent sx={{ p: 0 }}>

        {/* ── Header ── */}
        <Box sx={{ px: "24px", pt: "20px", pb: "16px", borderBottom: `1px solid ${BORDER}` }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <Box sx={{ width: 52, height: 52, borderRadius: "50%", bgcolor: ACCENT, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                {initials(client.companyName)}
              </Box>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Box sx={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{client.companyName}</Box>
                  <Tag color={MUTED} bg="#F1F3F7">ID-{client.id}</Tag>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: "6px", mt: "8px" }}>
                  <SocialIcon href={client.linkedinUrl} title="LinkedIn" svg={LinkedInSvg} />
                  <SocialIcon href={client.facebookUrl} title="Facebook" svg={FacebookSvg} />
                  <SocialIcon href={client.twitterUrl} title="Twitter / X" svg={TwitterSvg} />
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {onEdit && (
                <IconButton size="small" onClick={() => onEdit(client)} sx={{ color: MUTED, "&:hover": { color: ACCENT } }}>
                  <EditIcon />
                </IconButton>
              )}
              <Box onClick={onClose} sx={{ cursor: "pointer", color: MUTED, lineHeight: 0,
                "&:hover": { color: TEXT }, transition: "color .12s" }}>
                <CloseIcon />
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 32px", mt: "16px" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "8px", color: client.website ? TEXT : "#C7CDD6", fontSize: 12.5 }}>
              <Box sx={{ color: MUTED, display: "flex" }}>{WebsiteSvg}</Box>
              {client.website
                ? <Box component="a" href={client.website} target="_blank" rel="noopener noreferrer" sx={{ color: ACCENT, "&:hover": { textDecoration: "underline" } }}>{client.website}</Box>
                : "Not available"}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: "8px", color: client.industry ? TEXT : "#C7CDD6", fontSize: 12.5 }}>
              <Box sx={{ color: MUTED, display: "flex" }}>{IndustrySvg}</Box>
              {client.industry || "Not available"}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: "8px", color: client.fullAddress ? TEXT : "#C7CDD6", fontSize: 12.5 }}>
              <Box sx={{ color: MUTED, display: "flex" }}>{PinSvg}</Box>
              {client.fullAddress || "Not available"}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: "8px", color: locationLine ? TEXT : "#C7CDD6", fontSize: 12.5 }}>
              <Box sx={{ color: MUTED, display: "flex" }}>{PinSvg}</Box>
              {locationLine || "Not available"}
            </Box>
          </Box>
        </Box>

        {/* ── Contacts row ── */}
        <Box sx={{ px: "24px", py: "14px", borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Box sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Contacts</Box>
            {existingContacts.length > 0 ? (
              <Box sx={{ fontSize: 12.5, color: TEXT }}>
                {existingContacts[0].name}
                <Box component="span" sx={{ color: MUTED }}>
                  {[existingContacts[0].title, existingContacts[0].email, existingContacts[0].phone].filter(Boolean).length > 0
                    ? ` — ${[existingContacts[0].title, existingContacts[0].email, existingContacts[0].phone].filter(Boolean).join(" · ")}`
                    : ""}
                </Box>
                {existingContacts.length > 1 && (
                  <Box component="span" sx={{ color: MUTED }}> · +{existingContacts.length - 1} more</Box>
                )}
              </Box>
            ) : client.contactPerson ? (
              <Box sx={{ fontSize: 12.5, color: TEXT }}>
                {client.contactPerson}
                <Box component="span" sx={{ color: MUTED }}>
                  {[client.contactTitle, client.contactEmail, client.contactPhone].filter(Boolean).length > 0
                    ? ` — ${[client.contactTitle, client.contactEmail, client.contactPhone].filter(Boolean).join(" · ")}`
                    : ""}
                </Box>
                {secondaryContacts.length > 0 && (
                  <Box component="span" sx={{ color: MUTED }}> · +{secondaryContacts.length} more</Box>
                )}
              </Box>
            ) : (
              <Box sx={{ fontSize: 12.5, color: "#C7CDD6" }}>Not available</Box>
            )}
          </Box>
          {onEdit && (
            <Button size="small" variant="contained" onClick={() => onEdit(client)}
              sx={{ fontSize: 12, fontWeight: 600, textTransform: "none", borderRadius: "8px", boxShadow: "none",
                bgcolor: ACCENT, "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
              Edit
            </Button>
          )}
        </Box>

        <Box sx={{ px: "24px", py: "16px", maxHeight: "62vh", overflowY: "auto" }}>

          {/* ── Information Overview ── */}
          <Box sx={{ ...CARD_BASE, p: "16px 18px", mb: "18px" }}>
            <Box onClick={() => setOverviewOpen(o => !o)} sx={{
              display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", userSelect: "none",
              mb: overviewOpen ? "16px" : 0,
            }}>
              <Box sx={{ color: MUTED, display: "flex" }}><ChevronSvg open={overviewOpen} /></Box>
              <Box sx={{ fontSize: 14, fontWeight: 700, color: TEXT }}>Information Overview</Box>
              <Tag color={MUTED} bg="#F1F3F7">{showMore ? 10 : 7}</Tag>
            </Box>

            {overviewOpen && (
              <>
                <Box sx={{ mb: "18px" }}>
                  <InfoField label="About Company" value={client.aboutCompany} span />
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px 24px" }}>
                  <InfoField label="Website" value={client.website} />
                  <InfoField label="Full Address" value={client.fullAddress} />
                  <InfoField label="Industry" value={client.industry} />
                  <InfoField label="Locality" value={client.locality} />
                  <InfoField label="State" value={client.state} />
                  <InfoField label="Country" value={client.country} />
                  {showMore && (
                    <>
                      <InfoField label="Company Size" value={client.companySize} />
                      <InfoField label="LinkedIn" value={client.linkedinUrl} />
                      <InfoField label="Zip / Postcode" value={client.zip} />
                    </>
                  )}
                </Box>
                <Box sx={{ textAlign: "center", mt: "14px" }}>
                  <Box component="span" onClick={() => setShowMore(s => !s)}
                    sx={{ fontSize: 12.5, color: ACCENT, cursor: "pointer", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
                    {showMore ? "Show Less" : "Show More"}
                  </Box>
                </Box>
              </>
            )}
          </Box>

          {/* ── Tabs ── */}
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
            mb: "16px", borderBottom: `1px solid ${BORDER}`,
            "& .MuiTab-root": { fontSize: 12.5, fontWeight: 600, textTransform: "none", minHeight: 40, color: MUTED },
            "& .Mui-selected": { color: ACCENT },
            "& .MuiTabs-indicator": { bgcolor: ACCENT },
          }}>
            {CLIENT_TABS.map(t => {
              const badge =
                t.key === "jobs"     ? jobs.length :
                t.key === "emails"   ? emails.length :
                t.key === "pitched"  ? pitched.length :
                t.key === "employed" ? employed.length :
                t.key === "files"    ? files.length :
                t.key === "invoices" ? invoices.length :
                t.key === "contacts" ? existingContacts.length + secondaryContacts.length + (client.contactPerson ? 1 : 0) : null;
              return (
                <Tab key={t.key} value={t.key} label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {t.label}
                    {badge !== null && (
                      <Box sx={{ fontSize: 10, fontWeight: 700, color: MUTED, bgcolor: "#F1F3F7",
                        borderRadius: "10px", px: "6px", py: "1px" }}>{badge}</Box>
                    )}
                  </Box>
                } />
              );
            })}
          </Tabs>

          {tab === "emails" && (
            <Box>
              <Box sx={{ display: "flex", justifyContent: "flex-end", mb: "12px" }}>
                <Button size="small" variant="contained"
                  onClick={() => nav("/email", { state: { toAddress: client.contactEmail || "", clientId: client.id } })}
                  sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", boxShadow: "none",
                    bgcolor: ACCENT, "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
                  Send Email
                </Button>
                <Tooltip title="Available on paid subscriptions">
                  <span>
                    <Button size="small" variant="outlined" disabled
                      sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", ml: "8px",
                        borderColor: BORDER, color: TEXT }}>
                      Send SMS (available on paid subscriptions)
                    </Button>
                  </span>
                </Tooltip>
              </Box>
              {emailsLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>
              ) : emails.length === 0 ? (
                <TabEmptyState icon="✉️" title="No Related Emails Found"
                  desc="Emails sent to this company from the Email Centre will appear here." />
              ) : (
                emails.map((e, i) => (
                  <Box key={e.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    py: "10px", borderBottom: i < emails.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                    <Box>
                      <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{e.subject || "(no subject)"}</Box>
                      <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>
                        To: {e.toAddress} · {formatNoteTimestamp(e.sentAt)}
                      </Box>
                    </Box>
                    <Tag color={e.status === "Sent" ? SUCCESS : "#DC2626"} bg={e.status === "Sent" ? SUCCESS_L : "rgba(220,38,38,0.08)"}>
                      {e.status}
                    </Tag>
                  </Box>
                ))
              )}
            </Box>
          )}

          {tab === "pitched" && (
            <CandidateList loading={pitchedLoading} candidates={pitched} emptyTitle="No Candidates Pitched Yet" />
          )}

          {tab === "employed" && (
            <CandidateList loading={employedLoading} candidates={employed} emptyTitle="No Candidates Employed Yet" />
          )}

          {tab === "files" && (
            <Box>
              <Box sx={{ display: "flex", justifyContent: "flex-end", mb: "12px" }}>
                <Button component="label" size="small" variant="outlined" disabled={uploading}
                  startIcon={UploadSvg}
                  sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", borderColor: BORDER, color: TEXT }}>
                  {uploading ? "Uploading…" : "Upload File"}
                  <input type="file" hidden onChange={handleFileUpload} />
                </Button>
              </Box>
              {fileError && <Alert severity="error" sx={{ mb: "10px", fontSize: 12, borderRadius: "8px" }}>{fileError}</Alert>}
              {filesLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>
              ) : files.length === 0 ? (
                <TabEmptyState icon="📄" title="No Files Found" desc="Files uploaded for this company will appear here." />
              ) : (
                files.map((f, i) => (
                  <Box key={f.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    py: "10px", borderBottom: i < files.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                    <Box>
                      <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{f.fileName}</Box>
                      <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>{formatBytes(f.sizeBytes)}</Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: "4px" }}>
                      <Tooltip title="Download">
                        <IconButton size="small" onClick={() => handleFileDownload(f)} sx={{ color: MUTED, "&:hover": { color: ACCENT } }}>
                          {DownloadSvg}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleFileDelete(f.id)} sx={{ color: MUTED, "&:hover": { color: "#DC2626" } }}>
                          {TrashSvg}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          )}

          {tab === "invoices" && (
            <Box>
              <Box sx={{ display: "flex", justifyContent: "flex-end", mb: "12px" }}>
                <Button size="small" variant="contained" onClick={() => setShowInvoiceDialog(true)}
                  startIcon={<InvoiceIcon />}
                  sx={{ fontSize: 12, textTransform: "none", borderRadius: "8px", boxShadow: "none",
                    bgcolor: ACCENT, "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
                  Create Invoice
                </Button>
              </Box>
              {invoicesLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}><CircularProgress size={20} sx={{ color: ACCENT }} /></Box>
              ) : invoices.length === 0 ? (
                <TabEmptyState icon="🧾" title="No Invoices Found" desc="Invoices associated with this company will appear here." />
              ) : (
                invoices.map((inv, i) => (
                  <Box key={inv.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    py: "10px", borderBottom: i < invoices.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                    <Box>
                      <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{inv.xeroInvoiceNumber || `Invoice #${inv.id}`}</Box>
                      <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>{formatNoteTimestamp(inv.createdAt)}</Box>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <Tag color={SUCCESS} bg={SUCCESS_L}>{inv.status}</Tag>
                      <Box sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>
                        {inv.currency} {Number(inv.total).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </Box>
                    </Box>
                  </Box>
                ))
              )}
            </Box>
          )}

          {tab === "notes" && (
            <Box>
              <Box sx={{ display: "flex", gap: "8px", mb: "12px", alignItems: "flex-start" }}>
                <TextField value={newNote} onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a note…" size="small" fullWidth multiline maxRows={4} sx={FIELD_SX}
                  disabled={addingNote} />
                <Button onClick={handleAddNote} disabled={addingNote || !newNote.trim()} variant="contained"
                  sx={{ borderRadius: "8px", textTransform: "none", fontSize: 12, fontWeight: 600,
                    bgcolor: ACCENT, boxShadow: "none", flexShrink: 0,
                    "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
                  {addingNote ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Add"}
                </Button>
              </Box>
              {noteError && <Box sx={{ fontSize: 11, color: "#DC2626", mb: "8px" }}>{noteError}</Box>}
              {notesLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: "12px" }}><CircularProgress size={18} sx={{ color: ACCENT }} /></Box>
              ) : notes.length === 0 ? (
                <TabEmptyState icon="📝" title="No Notes Yet" />
              ) : (
                notes.map((n, i) => (
                  <Box key={n.id} sx={{ py: "8px", borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
                    <Box sx={{ fontSize: 13, color: TEXT, whiteSpace: "pre-wrap" }}>{n.note}</Box>
                    <Box sx={{ fontSize: 10, color: MUTED, mt: "3px" }}>{formatNoteTimestamp(n.createdAt)}</Box>
                  </Box>
                ))
              )}
            </Box>
          )}

          {tab === "jobs" && (
            <Box>
              <Box sx={{ fontSize: 12, color: MUTED, mb: "10px" }}>
                {jobs.length} job{jobs.length !== 1 ? "s" : ""}
                {totalLabel && (
                  <>
                    {" · "}Total Fee (Active/Fulfilling):{" "}
                    <Box component="span" sx={{ color: SUCCESS, fontWeight: 700 }}>{totalLabel}</Box>
                  </>
                )}
              </Box>
              {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}>
                  <CircularProgress size={20} sx={{ color: ACCENT }} />
                </Box>
              )}
              {!loading && err && (
                <Box sx={{ fontSize: 12, color: "#DC2626" }}>{err}</Box>
              )}
              {!loading && !err && jobs.length === 0 && (
                <TabEmptyState icon="💼" title="No Jobs Found" desc="Jobs for this client will appear here." />
              )}
              {!loading && !err && jobs.map((job, i) => (
                <Box key={i} sx={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  py: "10px", borderBottom: i < jobs.length - 1 ? `1px solid ${BORDER}` : "none",
                }}>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{job.title}</Box>
                      <JobStatusTag status={job.status} />
                    </Box>
                    <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>
                      {job.salary != null ? `${job.currency} ${Number(job.salary).toLocaleString()}` : "No salary set"}
                      {job.feeType === "FIXED"
                        ? " · Fixed fee"
                        : job.feePercentage != null ? ` · ${job.feePercentage}% fee` : ""}
                      {` · ${job.daysOld}d`}
                    </Box>
                  </Box>
                  <Box sx={{
                    fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                    color: job.estimatedFee != null ? SUCCESS : MUTED,
                  }}>
                    {job.estimatedFee != null
                      ? `${job.currency} ${Number(job.estimatedFee).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : "—"}
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {tab === "contacts" && (
            <Box>
              {contactAddError && <Alert severity="error" sx={{ mb: "10px", fontSize: 12, borderRadius: "8px" }}>{contactAddError}</Alert>}
              {existingContacts.length > 0 && (
                <Box sx={{ mb: "16px", pb: "12px", borderBottom: `1px solid ${BORDER}` }}>
                  {existingContacts.map((c, i) => (
                    <Box key={c.id} onClick={() => nav(`/contacts/${c.id}`)}
                      sx={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                        py: "10px", cursor: "pointer",
                        borderBottom: i < existingContacts.length - 1 ? `1px solid ${BORDER}` : "none",
                        "&:hover": { bgcolor: "#FAFBFD" } }}>
                      <Box>
                        <Box sx={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>{c.name || "—"}</Box>
                        <Box sx={{ fontSize: 12, color: MUTED, mt: "3px" }}>
                          {[c.title, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                        </Box>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
              {client.contactPerson ? (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  pb: secondaryContacts.length > 0 ? "12px" : 0, mb: secondaryContacts.length > 0 ? "12px" : 0,
                  borderBottom: secondaryContacts.length > 0 ? `1px solid ${BORDER}` : "none" }}>
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{client.contactPerson}</Box>
                      <Tag color={ACCENT} bg={ACCENT_L}>Primary</Tag>
                    </Box>
                    <Box sx={{ fontSize: 12, color: MUTED, mt: "3px" }}>
                      {[client.contactTitle, client.contactEmail, client.contactPhone].filter(Boolean).join(" · ") || "—"}
                    </Box>
                  </Box>
                  {isAlreadyAddedContact(client.contactPerson) ? (
                    <Tag color={SUCCESS} bg={SUCCESS_L}>Already Added</Tag>
                  ) : (
                    <Button size="small" variant="outlined"
                      onClick={() => addAsClientContact({
                        name: client.contactPerson, title: client.contactTitle,
                        email: client.contactEmail, phone: client.contactPhone,
                      }, "primary")}
                      disabled={addingContactFor === "primary"}
                      sx={{ fontSize: 11, textTransform: "none", borderRadius: "7px", borderColor: BORDER, color: TEXT,
                        flexShrink: 0, "&:hover": { borderColor: ACCENT, color: ACCENT } }}>
                      {addingContactFor === "primary" ? <CircularProgress size={12} /> : "Add Client Contact"}
                    </Button>
                  )}
                </Box>
              ) : secondaryContacts.length === 0 && existingContacts.length === 0 ? (
                <TabEmptyState icon="👥" title="No Contacts Found" desc="Contacts for this client will appear here." />
              ) : null}
              {secondaryContacts.map((c, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                  py: "10px", borderBottom: i < secondaryContacts.length - 1 ? `1px solid ${BORDER}` : "none" }}>
                  <Box>
                    <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{c.name || "—"}</Box>
                    <Box sx={{ fontSize: 12, color: MUTED, mt: "3px" }}>
                      {[c.title, c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                    </Box>
                  </Box>
                  {isAlreadyAddedContact(c.name) ? (
                    <Tag color={SUCCESS} bg={SUCCESS_L}>Already Added</Tag>
                  ) : (
                    <Button size="small" variant="outlined"
                      onClick={() => addAsClientContact(c, i)}
                      disabled={addingContactFor === i}
                      sx={{ fontSize: 11, textTransform: "none", borderRadius: "7px", borderColor: BORDER, color: TEXT,
                        flexShrink: 0, "&:hover": { borderColor: ACCENT, color: ACCENT } }}>
                      {addingContactFor === i ? <CircularProgress size={12} /> : "Add Client Contact"}
                    </Button>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>

      {showInvoiceDialog && (
        <InvoiceDialog
          client={client}
          onClose={() => setShowInvoiceDialog(false)}
          onInvoiced={() => { setShowInvoiceDialog(false); loadInvoices(); }}
        />
      )}
    </Dialog>
  );
}

// ─── Create Xero Invoice dialog — billable placements for a client ───────────
function defaultReference(clientId) {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `NOLYVRA-${clientId}-${ymd}`;
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function InvoiceDialog({ client, onClose, onInvoiced }) {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [placements, setPlacements] = useState([]);
  const [config, setConfig]   = useState(null);
  const [lines, setLines]     = useState({});

  const [contactPerson, setContactPerson] = useState(client.contactPerson || "");
  const [contactEmail, setContactEmail]   = useState(client.contactEmail || "");
  const [invoiceDate, setInvoiceDate]     = useState(todayIso());
  const [dueDate, setDueDate]             = useState(plusDaysIso(14));
  const [reference, setReference]         = useState(defaultReference(client.id));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult]         = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr("");
    Promise.all([
      apiGet(`/api/clients/${client.id}/billable-placements`),
      apiGet("/api/xero/invoice-config"),
    ])
      .then(([placementsData, configData]) => {
        if (cancelled) return;
        const list = placementsData || [];
        setPlacements(list);
        setConfig(configData || { configAvailable: false, accounts: [], taxRates: [] });
        const initialLines = {};
        list.forEach(p => {
          const description = p.feeType === "FIXED"
            ? `${p.title} — Fixed fee`
            : (p.feePercentage != null && p.salary != null)
              ? `${p.title} — ${p.feePercentage}% of ${p.currency} ${p.salary}`
              : p.title;
          initialLines[p.jobId] = {
            include: true,
            candidateName: "",
            description,
            amount: p.estimatedFee != null ? String(p.estimatedFee) : "",
            accountCode: configData?.defaultAccountCode || "",
            taxType: configData?.defaultTaxType || "",
          };
        });
        setLines(initialLines);
      })
      .catch(e => { if (!cancelled) setErr(e.message || "Failed to load billable placements."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [client.id]);

  const placementsById = useMemo(
    () => Object.fromEntries(placements.map(p => [p.jobId, p])),
    [placements]
  );

  function updateLine(jobId, field, value) {
    setLines(prev => ({ ...prev, [jobId]: { ...prev[jobId], [field]: value } }));
  }

  const includedJobIds = Object.keys(lines).filter(jobId => lines[jobId]?.include);
  const total = includedJobIds.reduce((sum, jobId) => {
    const amount = Number(lines[jobId]?.amount);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const invoiceCurrency = includedJobIds.length > 0
    ? placementsById[includedJobIds[0]]?.currency
    : null;

  async function submit(status, sendEmail) {
    setSubmitting(true);
    setSubmitError("");
    try {
      const lineItems = includedJobIds.map(jobId => ({
        jobId,
        candidateName: lines[jobId].candidateName,
        description: lines[jobId].description,
        amount: Number(lines[jobId].amount),
        accountCode: lines[jobId].accountCode,
        taxType: lines[jobId].taxType,
      }));
      const res = await apiPostJson("/api/xero/invoices", {
        clientId: client.id,
        contactName: contactPerson,
        contactEmail,
        lineItems,
        currency: invoiceCurrency,
        invoiceDate,
        dueDate,
        reference,
        status,
        sendEmail,
      });
      setResult(res);
    } catch (e) {
      setSubmitError(e.message || "Failed to create the invoice.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDone() {
    onInvoiced();
    onClose();
  }

  return (
    <Dialog open onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: "16px", overflow: "hidden", m: "24px" } }}>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ px: "24px", pt: "20px", pb: "14px", borderBottom: `1px solid ${BORDER}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Box sx={{ fontSize: 17, fontWeight: 700, color: TEXT }}>Create Xero Invoice</Box>
            <Box sx={{ fontSize: 12, color: MUTED, mt: "4px" }}>{client.companyName}</Box>
          </Box>
          <Box onClick={submitting ? undefined : onClose} sx={{ cursor: submitting ? "default" : "pointer",
            color: MUTED, lineHeight: 0, "&:hover": submitting ? {} : { color: TEXT }, transition: "color .12s" }}>
            <CloseIcon />
          </Box>
        </Box>

        <Box sx={{ px: "24px", py: "16px", maxHeight: "65vh", overflowY: "auto" }}>
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: "32px" }}>
              <CircularProgress size={24} sx={{ color: ACCENT }} />
            </Box>
          )}

          {!loading && err && (
            <Box sx={{ fontSize: 13, color: "#DC2626" }}>{err}</Box>
          )}

          {!loading && !err && result && (
            <Box sx={{ textAlign: "center", py: "24px" }}>
              <Box sx={{ fontSize: 32, mb: "10px" }}>✅</Box>
              <Box sx={{ fontSize: 14, fontWeight: 600, color: TEXT, mb: "4px" }}>
                Invoice {result.invoiceNumber || ""} created ({result.status})
              </Box>
              {result.deepLink && (
                <Box component="a" href={result.deepLink} target="_blank" rel="noopener noreferrer"
                  sx={{ fontSize: 12, color: ACCENT, "&:hover": { textDecoration: "underline" } }}>
                  Open in Xero
                </Box>
              )}
            </Box>
          )}

          {!loading && !err && !result && placements.length === 0 && (
            <Box sx={{ fontSize: 13, color: MUTED, textAlign: "center", py: "24px" }}>
              No billable placements for this client yet — placements must be marked Complete and not already invoiced.
            </Box>
          )}

          {!loading && !err && !result && placements.length > 0 && (
            <>
              {!config?.configAvailable && (
                <Alert severity="info" sx={{ mb: "14px", borderRadius: "8px", fontSize: 12 }}>
                  Xero isn't connected — enter account code and tax type manually, or{" "}
                  <Box component="span" onClick={() => nav("/settings")}
                    sx={{ color: ACCENT, cursor: "pointer", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
                    connect Xero in Settings
                  </Box>.
                </Alert>
              )}

              <Box sx={{ mb: "16px" }}>
                <Box sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase",
                  letterSpacing: ".5px", mb: "8px" }}>Bill To</Box>
                <Box sx={{ fontSize: 14, fontWeight: 600, color: TEXT, mb: "8px" }}>{client.companyName}</Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <TextField label="Contact Person" value={contactPerson}
                    onChange={e => setContactPerson(e.target.value)} size="small" fullWidth sx={FIELD_SX} />
                  <TextField label="Contact Email" type="email" value={contactEmail}
                    onChange={e => setContactEmail(e.target.value)} size="small" fullWidth sx={FIELD_SX} />
                </Box>
              </Box>

              <Box sx={{ mb: "16px" }}>
                <Box sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase",
                  letterSpacing: ".5px", mb: "8px" }}>Line Items</Box>
                {placements.map(p => {
                  const line = lines[p.jobId] || {};
                  return (
                    <Box key={p.jobId} sx={{
                      display: "flex", flexDirection: "column", gap: "8px",
                      p: "12px", mb: "8px", borderRadius: "8px",
                      border: `1px solid ${BORDER}`, bgcolor: line.include ? "#FAFBFD" : SURFACE,
                    }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Checkbox size="small" checked={!!line.include}
                          onChange={e => updateLine(p.jobId, "include", e.target.checked)}
                          sx={{ p: 0 }} />
                        <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{p.title}</Box>
                        <Box sx={{ fontSize: 11, color: MUTED }}>
                          {p.currency} {p.salary != null ? Number(p.salary).toLocaleString() : "—"}
                        </Box>
                      </Box>
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <TextField label="Candidate Name" value={line.candidateName || ""}
                          onChange={e => updateLine(p.jobId, "candidateName", e.target.value)}
                          size="small" fullWidth sx={FIELD_SX} />
                        <TextField label="Amount" type="number" value={line.amount || ""}
                          onChange={e => updateLine(p.jobId, "amount", e.target.value)}
                          size="small" fullWidth sx={FIELD_SX} />
                      </Box>
                      <TextField label="Description" value={line.description || ""}
                        onChange={e => updateLine(p.jobId, "description", e.target.value)}
                        size="small" fullWidth sx={FIELD_SX} />
                      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        {config?.configAvailable ? (
                          <TextField select label="Account" value={line.accountCode || ""}
                            onChange={e => updateLine(p.jobId, "accountCode", e.target.value)}
                            size="small" fullWidth sx={FIELD_SX}>
                            {(config.accounts || []).map(a => (
                              <MenuItem key={a.code} value={a.code}>{a.code} — {a.name}</MenuItem>
                            ))}
                          </TextField>
                        ) : (
                          <TextField label="Account Code" value={line.accountCode || ""}
                            onChange={e => updateLine(p.jobId, "accountCode", e.target.value)}
                            size="small" fullWidth sx={FIELD_SX} />
                        )}
                        {config?.configAvailable ? (
                          <TextField select label="Tax" value={line.taxType || ""}
                            onChange={e => updateLine(p.jobId, "taxType", e.target.value)}
                            size="small" fullWidth sx={FIELD_SX}>
                            {(config.taxRates || []).map(t => (
                              <MenuItem key={t.taxType} value={t.taxType}>{t.name}</MenuItem>
                            ))}
                          </TextField>
                        ) : (
                          <TextField label="Tax Type" value={line.taxType || ""}
                            onChange={e => updateLine(p.jobId, "taxType", e.target.value)}
                            size="small" fullWidth sx={FIELD_SX} />
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", mb: "16px" }}>
                <TextField label="Invoice Date" type="date" value={invoiceDate}
                  onChange={e => setInvoiceDate(e.target.value)}
                  size="small" fullWidth sx={FIELD_SX} InputLabelProps={{ shrink: true }} />
                <TextField label="Due Date" type="date" value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  size="small" fullWidth sx={FIELD_SX} InputLabelProps={{ shrink: true }} />
                <TextField label="Reference" value={reference}
                  onChange={e => setReference(e.target.value)}
                  size="small" fullWidth sx={FIELD_SX} />
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                p: "12px 14px", borderRadius: "8px", bgcolor: SUCCESS_L, mb: "8px" }}>
                <Box sx={{ fontSize: 12, color: TEXT, fontWeight: 600 }}>Total</Box>
                <Box sx={{ fontSize: 15, fontWeight: 700, color: SUCCESS }}>
                  {invoiceCurrency || ""} {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </Box>
              </Box>

              {submitError && (
                <Alert severity="error" sx={{ mb: "8px", borderRadius: "8px", fontSize: 12 }}>{submitError}</Alert>
              )}
            </>
          )}
        </Box>

        {!loading && !err && !result && placements.length > 0 && (
          <DialogActions sx={{ px: "24px", pb: "20px", pt: "10px", borderTop: `1px solid ${BORDER}`,
            display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            <Box sx={{ display: "flex", gap: "8px" }}>
              <Button onClick={() => submit("DRAFT", false)} disabled={submitting || includedJobIds.length === 0}
                variant="outlined" sx={{ borderRadius: "8px", textTransform: "none", fontSize: 13,
                  borderColor: BORDER, color: TEXT, "&:hover": { borderColor: ACCENT, bgcolor: ACCENT_L } }}>
                {submitting ? <CircularProgress size={14} /> : "Save as Draft"}
              </Button>
              <Button onClick={() => submit("AUTHORISED", true)}
                disabled={submitting || includedJobIds.length === 0 || !contactEmail.trim()}
                variant="contained" sx={{ borderRadius: "8px", textTransform: "none", fontSize: 13,
                  fontWeight: 600, bgcolor: ACCENT, boxShadow: "none", "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
                {submitting ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Authorise & Send"}
              </Button>
            </Box>
            {!contactEmail.trim() && (
              <Box sx={{ fontSize: 11, color: MUTED }}>Add a contact email to authorise and send</Box>
            )}
          </DialogActions>
        )}

        {result && (
          <DialogActions sx={{ px: "24px", pb: "20px", pt: "10px", borderTop: `1px solid ${BORDER}` }}>
            <Button onClick={handleDone} variant="contained" sx={{ borderRadius: "8px", textTransform: "none",
              fontSize: 13, fontWeight: 600, bgcolor: ACCENT, boxShadow: "none",
              "&:hover": { bgcolor: "#1558C0", boxShadow: "none" } }}>
              Done
            </Button>
          </DialogActions>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Potential client card ─────────────────────────────────────────────────────
function outreachSubject(companyName) {
  return `Partnering to support hiring at ${companyName}`;
}

function PotentialCard({ pc, onViewDetail, selected, onToggleSelect, searchPlace, searchKeyword }) {
  const nav = useNavigate();
  const [outreachMsg, setMsg]   = useState("");
  const [generating, setGen]    = useState(false);
  const [genError, setGenError] = useState("");

  const scoreColor = pc.matchScore >= 80 ? SUCCESS : pc.matchScore >= 60 ? WARN : MUTED;
  const scoreBg    = pc.matchScore >= 80 ? SUCCESS_L : pc.matchScore >= 60 ? WARN_L : "rgba(138,148,166,0.08)";

  async function generateOutreach() {
    setGen(true);
    setGenError("");
    try {
      const msg = await apiPost("/api/clients/outreach", {
        clientId: "",
        clientName: pc.companyName,
        contactName: pc.decisionMakers?.[0]?.name || "",
        industry: pc.industry,
        place: pc.location || searchPlace || "",
        keyword: searchKeyword || "",
        recentSignals: pc.signalReasons?.join("; ") || pc.hiringSignal,
        bulk: false,
      });
      setMsg(msg);
    } catch (e) {
      setGenError(e.message || "Generation failed.");
    } finally {
      setGen(false);
    }
  }

  function sendEmail() {
    nav("/email", { state: {
      toAddress: "",
      subject: outreachSubject(pc.companyName),
      body: outreachMsg,
    } });
  }

  return (
    <Box sx={{ ...CARD_BASE, p: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box sx={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <Checkbox size="small" checked={!!selected} onChange={onToggleSelect}
            sx={{ p: 0, mt: "1px" }} />
          <Box>
            <Box sx={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{pc.companyName}</Box>
            <Box sx={{ fontSize: 12, color: MUTED, mt: "2px" }}>{pc.size} · {pc.location}</Box>
          </Box>
        </Box>
        <Box sx={{ px: "10px", py: "4px", borderRadius: "20px", fontSize: 12, fontWeight: 700,
          color: scoreColor, bgcolor: scoreBg, flexShrink: 0 }}>
          {pc.matchScore}% match
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {pc.industry && <Tag color={PURPLE} bg={PURPLE_L}>{pc.industry}</Tag>}
        <Tag color={WARN} bg={WARN_L}>{pc.hiringSignal}</Tag>
      </Box>

      {pc.signalReasons?.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {pc.signalReasons.map((s, i) => (
            <Box key={i} sx={{ fontSize: 11, color: MUTED, bgcolor: "#F4F6FA",
              border: `1px solid ${BORDER}`, borderRadius: "5px", px: "7px", py: "2px" }}>
              {s}
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: "flex", gap: "20px" }}>
        <Box>
          <Box sx={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{pc.openRoles}</Box>
          <Box sx={{ fontSize: 11, color: MUTED }}>Open Roles</Box>
        </Box>
        <Box>
          <Box sx={{ fontSize: 18, fontWeight: 700, color: SUCCESS }}>+{pc.growthPct}%</Box>
          <Box sx={{ fontSize: 11, color: MUTED }}>Growth</Box>
        </Box>
      </Box>

      {pc.decisionMakers?.length > 0 && (
        <Box>
          <Box sx={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: ".5px", mb: "6px" }}>Key Contacts</Box>
          {pc.decisionMakers.slice(0, 3).map((dm, i) => (
            <Box key={i} sx={{ fontSize: 12, color: TEXT, mb: "2px" }}>
              <strong>{dm.name}</strong>
              <Box component="span" sx={{ color: MUTED }}> — {dm.title}</Box>
            </Box>
          ))}
        </Box>
      )}

      {genError && (
        <Box sx={{ p: "8px 10px", borderRadius: "6px", bgcolor: "rgba(220,38,38,0.06)",
          border: "1px solid rgba(220,38,38,0.15)", color: "#DC2626", fontSize: 11 }}>
          {genError}
        </Box>
      )}
      {outreachMsg && (
        <Box sx={{ p: "12px", bgcolor: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: "8px",
          fontSize: 12, color: TEXT, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto" }}>
          {outreachMsg}
        </Box>
      )}

      <Box sx={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <Box onClick={generating ? undefined : generateOutreach} sx={{
          display: "inline-flex", alignItems: "center", gap: "5px",
          px: "14px", py: "7px", borderRadius: "8px",
          bgcolor: generating ? ACCENT_L : ACCENT, color: generating ? ACCENT : "#fff",
          fontSize: 12, fontWeight: 600, cursor: generating ? "default" : "pointer",
          transition: "all .15s", "&:hover": generating ? {} : { bgcolor: "#1558C0" },
        }}>
          {generating
            ? <><CircularProgress size={12} sx={{ color: ACCENT }} /> Generating…</>
            : <><SparkIcon /> {outreachMsg ? "Regenerate" : "Generate Outreach"}</>}
        </Box>
        {outreachMsg && (
          <>
            <Box component="span"
              onClick={() => navigator.clipboard?.writeText(outreachMsg)}
              sx={{ fontSize: 11, color: ACCENT, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
              Copy
            </Box>
            <Box component="span" onClick={sendEmail}
              sx={{ fontSize: 11, color: ACCENT, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
              Send Email
            </Box>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        <Box onClick={onViewDetail} sx={{
          px: "12px", py: "6px", borderRadius: "7px", fontSize: 12, fontWeight: 500,
          border: `1px solid ${BORDER}`, color: MUTED, cursor: "pointer",
          "&:hover": { color: ACCENT, borderColor: ACCENT }, transition: "all .12s",
        }}>
          View Details
        </Box>
      </Box>
    </Box>
  );
}

// ─── Potential client detail modal ────────────────────────────────────────────
function PotentialDetailModal({ pc, onClose, onAddToClients, searchPlace, searchKeyword }) {
  const nav = useNavigate();
  const [outreachMsg, setMsg]   = useState("");
  const [generating, setGen]    = useState(false);
  const [genError, setGenError] = useState("");
  const [creatingContact, setCreatingContact] = useState(null); // index of decision maker being saved
  const [contactError, setContactError]       = useState("");

  async function addAsClientContact(dm, index) {
    setCreatingContact(index);
    setContactError("");
    try {
      const created = await apiPostJson("/api/contacts/from-lead", {
        companyName: pc.companyName,
        industry: pc.industry,
        location: [pc.hqCity, pc.hqCountry].filter(Boolean).join(", ") || pc.location || "",
        linkedinUrl: pc.linkedinUrl || "",
        name: dm.name,
        title: dm.title,
      });
      nav(`/contacts/${created.id}`);
    } catch (e) {
      setContactError(e.message || "Failed to create contact.");
      setCreatingContact(null);
    }
  }

  const scoreColor = pc.matchScore >= 80 ? SUCCESS : pc.matchScore >= 60 ? WARN : MUTED;
  const scoreBg    = pc.matchScore >= 80 ? SUCCESS_L : pc.matchScore >= 60 ? WARN_L : "rgba(138,148,166,0.08)";

  async function generateOutreach() {
    setGen(true);
    setGenError("");
    try {
      const msg = await apiPost("/api/clients/outreach", {
        clientId: "",
        clientName: pc.companyName,
        contactName: pc.decisionMakers?.[0]?.name || "",
        industry: pc.industry,
        place: pc.location || searchPlace || "",
        keyword: searchKeyword || "",
        recentSignals: pc.signalReasons?.join("; ") || pc.hiringSignal,
        bulk: false,
      });
      setMsg(msg);
    } catch (e) {
      setGenError(e.message || "Generation failed.");
    } finally {
      setGen(false);
    }
  }

  function sendEmail() {
    nav("/email", { state: {
      toAddress: "",
      subject: outreachSubject(pc.companyName),
      body: outreachMsg,
    } });
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: "16px", overflow: "hidden", m: "24px" } }}>
      <DialogContent sx={{ p: 0 }}>

        {/* Header */}
        <Box sx={{ px: "28px", pt: "24px", pb: "16px", borderBottom: `1px solid ${BORDER}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box sx={{ flex: 1, mr: "16px" }}>
            <Box sx={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{pc.companyName}</Box>
            <Box sx={{ fontSize: 13, color: MUTED, mt: "4px" }}>
              {[pc.companyType, pc.industry, pc.foundedYear ? `Est. ${pc.foundedYear}` : ""].filter(Boolean).join(" · ")}
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <Box sx={{ px: "10px", py: "4px", borderRadius: "20px", fontSize: 12, fontWeight: 700,
              color: scoreColor, bgcolor: scoreBg }}>
              {pc.matchScore}% match
            </Box>
            <Box onClick={onClose} sx={{ cursor: "pointer", color: MUTED, lineHeight: 0,
              "&:hover": { color: TEXT }, transition: "color .12s" }}>
              <CloseIcon />
            </Box>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: "28px", py: "20px", maxHeight: "60vh", overflowY: "auto" }}>

          {pc.description && (
            <Box sx={{ mb: "20px" }}>
              <SectionLabel>About</SectionLabel>
              <Box sx={{ fontSize: 13, color: TEXT, lineHeight: 1.65 }}>{pc.description}</Box>
            </Box>
          )}

          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", mb: "20px" }}>
            <Box sx={{ ...CARD_BASE, p: "14px 16px" }}>
              <SectionLabel>Company Details</SectionLabel>
              <DetailRow label="HQ" value={[pc.hqCity, pc.hqCountry].filter(Boolean).join(", ") || pc.location} />
              <DetailRow label="Size" value={pc.size} />
              {pc.totalEmployees > 0 && (
                <DetailRow label="Employees" value={pc.totalEmployees.toLocaleString()} />
              )}
              {pc.companyType && <DetailRow label="Type" value={pc.companyType} />}
              {pc.foundedYear && <DetailRow label="Founded" value={pc.foundedYear} />}
            </Box>
            <Box sx={{ ...CARD_BASE, p: "14px 16px" }}>
              <SectionLabel>Hiring Signals</SectionLabel>
              <DetailRow label="Open Roles" value={pc.openRoles || null} />
              <DetailRow
                label="Team Growth"
                value={pc.growthPct > 0 ? `+${pc.growthPct}%` : pc.growthPct < 0 ? `${pc.growthPct}%` : null}
                valueColor={pc.growthPct > 0 ? SUCCESS : MUTED}
              />
              {pc.postingsGrowthPct > 0 && (
                <DetailRow label="Job Postings" value={`+${Math.round(pc.postingsGrowthPct)}% this month`}
                  valueColor={SUCCESS} />
              )}
              <Box sx={{ mt: "8px" }}>
                <Tag color={WARN} bg={WARN_L}>{pc.hiringSignal}</Tag>
              </Box>
            </Box>
          </Box>

          {pc.signalReasons?.some(s => s.startsWith("💰")) && (
            <Box sx={{ ...CARD_BASE, p: "12px 16px", mb: "20px" }}>
              <SectionLabel>Last Funding Round</SectionLabel>
              <Box sx={{ fontSize: 13, color: TEXT }}>
                {pc.signalReasons.find(s => s.startsWith("💰"))?.replace("💰 ", "")}
              </Box>
            </Box>
          )}

          {(pc.websiteUrl || pc.linkedinUrl) && (
            <Box sx={{ display: "flex", gap: "8px", mb: "20px" }}>
              {pc.websiteUrl && (
                <Box component="a" href={pc.websiteUrl} target="_blank" rel="noopener noreferrer" sx={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  px: "12px", py: "6px", borderRadius: "7px",
                  border: `1px solid ${BORDER}`, color: ACCENT, fontSize: 12, fontWeight: 500,
                  textDecoration: "none", "&:hover": { bgcolor: ACCENT_L }, transition: "all .12s",
                }}>
                  🌐 Website
                </Box>
              )}
              {pc.linkedinUrl && (
                <Box component="a" href={pc.linkedinUrl} target="_blank" rel="noopener noreferrer" sx={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  px: "12px", py: "6px", borderRadius: "7px",
                  border: `1px solid ${BORDER}`, color: ACCENT, fontSize: 12, fontWeight: 500,
                  textDecoration: "none", "&:hover": { bgcolor: ACCENT_L }, transition: "all .12s",
                }}>
                  💼 LinkedIn
                </Box>
              )}
            </Box>
          )}

          {pc.decisionMakers?.length > 0 && (
            <Box sx={{ mb: "20px" }}>
              <SectionLabel>Key Executives</SectionLabel>
              {contactError && (
                <Box sx={{ fontSize: 11, color: "#DC2626", mb: "8px" }}>{contactError}</Box>
              )}
              <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {pc.decisionMakers.map((dm, i) => (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: "10px",
                    p: "8px 12px", borderRadius: "8px", bgcolor: "#F8FAFC", border: `1px solid ${BORDER}` }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: "50%", bgcolor: ACCENT_L,
                      color: ACCENT, fontSize: 11, fontWeight: 700, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {dm.name?.[0]?.toUpperCase() || "?"}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{dm.name}</Box>
                      <Box sx={{ fontSize: 11, color: MUTED }}>{dm.title}</Box>
                    </Box>
                    <Box onClick={creatingContact === i ? undefined : () => addAsClientContact(dm, i)} sx={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      px: "10px", py: "5px", borderRadius: "7px", fontSize: 11, fontWeight: 600,
                      border: `1px solid ${ACCENT}`, color: ACCENT, flexShrink: 0,
                      cursor: creatingContact === i ? "default" : "pointer",
                      "&:hover": creatingContact === i ? {} : { bgcolor: ACCENT_L }, transition: "all .12s",
                    }}>
                      {creatingContact === i
                        ? <CircularProgress size={11} sx={{ color: ACCENT }} />
                        : "Client Contact"}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {pc.specialties?.length > 0 && (
            <Box sx={{ mb: "20px" }}>
              <SectionLabel>Specialties</SectionLabel>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {pc.specialties.map((s, i) => (
                  <Box key={i} sx={{ fontSize: 11, color: MUTED, bgcolor: "#F4F6FA",
                    border: `1px solid ${BORDER}`, borderRadius: "5px", px: "8px", py: "3px" }}>
                    {s}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {pc.newsArticles?.length > 0 && (
            <Box sx={{ mb: "20px" }}>
              <SectionLabel>Recent News</SectionLabel>
              <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {pc.newsArticles.map((a, i) => (
                  <Box key={i} sx={{ p: "8px 12px", borderRadius: "8px",
                    bgcolor: "#F8FAFC", border: `1px solid ${BORDER}` }}>
                    <Box sx={{ fontSize: 12, color: TEXT, lineHeight: 1.4 }}>📰 {a.headline}</Box>
                    {a.date && <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>{a.date}</Box>}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {genError && (
            <Box sx={{ p: "8px 10px", borderRadius: "6px", bgcolor: "rgba(220,38,38,0.06)",
              border: "1px solid rgba(220,38,38,0.15)", color: "#DC2626", fontSize: 11, mb: "12px" }}>
              {genError}
            </Box>
          )}
          {outreachMsg && (
            <Box sx={{ p: "14px", bgcolor: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: "8px",
              fontSize: 12, color: TEXT, lineHeight: 1.7, whiteSpace: "pre-wrap",
              maxHeight: 200, overflowY: "auto" }}>
              {outreachMsg}
            </Box>
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ px: "28px", py: "16px", borderTop: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", gap: "8px" }}>
          <Box onClick={generating ? undefined : generateOutreach} sx={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            px: "14px", py: "8px", borderRadius: "8px",
            bgcolor: generating ? ACCENT_L : ACCENT, color: generating ? ACCENT : "#fff",
            fontSize: 12, fontWeight: 600, cursor: generating ? "default" : "pointer",
            transition: "all .15s", "&:hover": generating ? {} : { bgcolor: "#1558C0" },
          }}>
            {generating
              ? <><CircularProgress size={12} sx={{ color: ACCENT }} /> Generating…</>
              : <><SparkIcon /> {outreachMsg ? "Regenerate Outreach" : "Generate Outreach"}</>}
          </Box>
          {outreachMsg && (
            <>
              <Box component="span" onClick={() => navigator.clipboard?.writeText(outreachMsg)}
                sx={{ fontSize: 11, color: ACCENT, cursor: "pointer",
                  "&:hover": { textDecoration: "underline" } }}>
                Copy
              </Box>
              <Box component="span" onClick={sendEmail}
                sx={{ fontSize: 11, color: ACCENT, cursor: "pointer",
                  "&:hover": { textDecoration: "underline" } }}>
                Send Email
              </Box>
            </>
          )}
          <Box sx={{ flex: 1 }} />
          <Box onClick={() => onAddToClients(pc)} sx={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            px: "14px", py: "8px", borderRadius: "8px",
            border: `1px solid ${ACCENT}`, color: ACCENT,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            "&:hover": { bgcolor: ACCENT_L }, transition: "all .15s",
          }}>
            <PlusIcon /> Add to My Clients
          </Box>
          <Box onClick={onClose} sx={{
            px: "14px", py: "8px", borderRadius: "8px",
            border: `1px solid ${BORDER}`, color: MUTED,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            "&:hover": { bgcolor: "#F4F6FA" }, transition: "all .15s",
          }}>
            Close
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ClientTrackerPage() {
  const nav = useNavigate();

  const PAGE_SIZE = 10;
  const [clients,           setClients]           = useState([]);
  const [stats,             setStats]             = useState(null);
  const [offset,            setOffset]            = useState(0);
  const [hasMore,           setHasMore]           = useState(true);
  const [loadingMore,       setLoadingMore]       = useState(false);
  const [potential,         setPotential]         = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState("");
  const [search,            setSearch]            = useState("");
  const [serverSearchResults, setServerSearchResults] = useState(null);
  const [serverSearching,     setServerSearching]     = useState(false);
  const [showAdd,           setShowAdd]           = useState(false);
  const [editingClient,     setEditingClient]     = useState(null);
  const [potentialLoading,  setPotentialLoading]  = useState(false);
  const [potentialLoadingMore, setPotentialLoadingMore] = useState(false);
  const [potentialSearched, setPotentialSearched] = useState(false);
  const [potentialError,    setPotentialError]    = useState("");
  const [searchIndustry,    setSearchIndustry]    = useState("");
  const [searchPlace,     setSearchPlace]     = useState("");
  const [searchSize,        setSearchSize]        = useState("");
  const [searchKeyword,     setSearchKeyword]     = useState("");
  const [detailCard,        setDetailCard]        = useState(null);
  const [addFromPotential,  setAddFromPotential]  = useState(null);
  const [selectedClient,    setSelectedClient]    = useState(null);
  const [invoicingClient,   setInvoicingClient]   = useState(null);
  const [hubSpotStatuses,   setHubSpotStatuses]   = useState({});
  const [hubSpotBusy,       setHubSpotBusy]       = useState({});
  const [hubSpotError,      setHubSpotError]      = useState("");

  async function loadHubSpotStatuses(clientList) {
    const results = await Promise.allSettled(
      clientList.map(client => apiGet(`/api/clients/${client.id}/hubspot/status`))
    );
    setHubSpotStatuses(prev => {
      const next = { ...prev };
      results.forEach((result, index) => {
        if (result.status === "fulfilled") next[clientList[index].id] = result.value;
      });
      return next;
    });
  }

  // ── Bulk outreach (Potential Clients multi-select) ─────────────────────────
  const [selectedIds,       setSelectedIds]       = useState(new Set());
  const [bulkMsg,           setBulkMsg]           = useState("");
  const [bulkGenerating,    setBulkGenerating]    = useState(false);
  const [bulkGenError,      setBulkGenError]      = useState("");

  function toggleSelect(externalId) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId); else next.add(externalId);
      return next;
    });
  }

  async function generateBulkOutreach() {
    setBulkGenerating(true); setBulkGenError("");
    try {
      const msg = await apiPost("/api/clients/outreach", {
        clientId: "",
        clientName: "",
        contactName: "{}",
        industry: searchIndustry,
        place: searchPlace,
        keyword: searchKeyword,
        recentSignals: "",
        bulk: true,
      });
      setBulkMsg(msg);
    } catch (e) {
      setBulkGenError(e.message || "Generation failed.");
    } finally {
      setBulkGenerating(false);
    }
  }

  function sendBulkEmail() {
    const selectedCards = potential.filter(pc => selectedIds.has(pc.externalId));
    const recipients = selectedCards.map(pc => ({
      name: pc.decisionMakers?.[0]?.name || "there",
      email: "",
    }));
    nav("/email", { state: {
      bulkRecipients: recipients,
      bulkSubject: `Partnering to support your hiring${searchIndustry ? ` in ${searchIndustry}` : ""}${searchPlace ? ` — ${searchPlace}` : ""}`,
      bulkBodyTemplate: bulkMsg,
    } });
  }

  async function loadClients() {
    setLoading(true);
    try {
      const c = await apiGet(`/api/clients?limit=${PAGE_SIZE}&offset=0`);
      setClients(c);
      setOffset(c.length);
      setHasMore(c.length === PAGE_SIZE);
      loadHubSpotStatuses(c);
    } catch (e) {
      setError(e.message || "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreClients() {
    setLoadingMore(true);
    try {
      const c = await apiGet(`/api/clients?limit=${PAGE_SIZE}&offset=${offset}`);
      setClients(prev => [...prev, ...c]);
      setOffset(prev => prev + c.length);
      setHasMore(c.length === PAGE_SIZE);
      loadHubSpotStatuses(c);
    } catch (e) {
      setError(e.message || "Failed to load more clients.");
    } finally {
      setLoadingMore(false);
    }
  }

  function loadStats() {
    apiGet("/api/clients/stats")
      .then(setStats)
      .catch(() => {});
  }

  useEffect(() => {
    loadClients();
    loadStats();
  }, []);

  // Restore the last Potential Clients search (filters + results) on page
  // load, if the recruiter has already searched something before.
  useEffect(() => {
    const cached = loadPotentialSearchCache();
    if (cached && cached.potentialSearched) {
      setSearchIndustry(cached.searchIndustry ?? "");
      setSearchPlace(cached.searchPlace ?? "");
      setSearchSize(cached.searchSize ?? "");
      setSearchKeyword(cached.searchKeyword ?? "");
      setPotential(cached.potential ?? []);
      setPotentialSearched(true);
    }
  }, []);

  function buildPotentialParams() {
    const params = new URLSearchParams();
    if (searchIndustry.trim()) params.set("industry",    searchIndustry.trim());
    if (searchPlace.trim())   params.set("place",       searchPlace.trim());
    if (searchSize)            params.set("companySize", searchSize);
    if (searchKeyword.trim())  params.set("keyword",     searchKeyword.trim());
    return params.toString();
  }

  async function handleFindPotential() {
    setPotentialLoading(true);
    setPotentialError("");
    setPotentialSearched(true);
    setSelectedIds(new Set());
    setBulkMsg(""); setBulkGenError("");
    try {
      const qs = buildPotentialParams();
      const p = await apiGet(`/api/clients/potential${qs ? "?" + qs : ""}`);
      setPotential(p);
      savePotentialSearchCache({ searchIndustry, searchPlace, searchSize, searchKeyword, potential: p, potentialSearched: true });
    } catch (e) {
      setPotentialError(e.message || "Failed to fetch potential clients.");
    } finally {
      setPotentialLoading(false);
    }
  }

  async function handleLoadMorePotential() {
    setPotentialLoadingMore(true);
    setPotentialError("");
    try {
      const qs = buildPotentialParams();
      const fresh = await apiGet(`/api/clients/potential/load-more${qs ? "?" + qs : ""}`);
      const existingIds = new Set(potential.filter(pc => pc.externalId).map(pc => pc.externalId));
      const deduped = (fresh ?? []).filter(pc => pc.externalId && !existingIds.has(pc.externalId));
      const combined = [...potential, ...deduped];
      setPotential(combined);
      savePotentialSearchCache({ searchIndustry, searchPlace, searchSize, searchKeyword, potential: combined, potentialSearched: true });
    } catch (e) {
      setPotentialError(e.message || "Failed to load more potential clients.");
    } finally {
      setPotentialLoadingMore(false);
    }
  }

  function handleAddFromPotential(pc) {
    setDetailCard(null);
    setAddFromPotential({
      companyName:   pc.companyName   || "",
      industry:      "",
      companySize:   "",
      location:      [pc.hqCity, pc.hqCountry].filter(Boolean).join(", ") || pc.location || "",
      contactPerson: pc.decisionMakers?.[0]?.name  || "",
      contactEmail:  "",
      contactTitle:  pc.decisionMakers?.[0]?.title || "",
      linkedinUrl:   pc.linkedinUrl   || "",
      notes:         pc.signalReasons?.join("; ")  || "",
    });
  }

  // Search-as-you-type first checks what's already loaded in the browser (no
  // network call). Only when that comes up empty — meaning the match might be
  // sitting in one of the not-yet-loaded pages — do we fall back to a DB
  // query, debounced so it doesn't fire on every keystroke.
  const localMatches = clients.filter(c =>
    !search ||
    c.companyName?.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase()) ||
    c.contactPerson?.toLowerCase().includes(search.toLowerCase())
  );
  const filtered = search && localMatches.length === 0 && serverSearchResults
    ? serverSearchResults
    : localMatches;

  useEffect(() => {
    if (!search.trim() || localMatches.length > 0) {
      setServerSearchResults(null);
      setServerSearching(false);
      return;
    }
    setServerSearching(true);
    const timer = setTimeout(() => {
      apiGet(`/api/clients?limit=${PAGE_SIZE}&offset=0&search=${encodeURIComponent(search.trim())}`)
        .then(setServerSearchResults)
        .catch(() => setServerSearchResults([]))
        .finally(() => setServerSearching(false));
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, clients.length]);

  // KPI numbers come from /api/clients/stats — fast aggregate queries across
  // the whole client set, independent of how many rows are currently paged
  // into `clients`. Reducing over `clients` here would only reflect the
  // loaded page once pagination is in play.
  const totalActive = stats?.activeMandates ?? 0;
  const totalFilled = stats?.placements ?? 0;
  const totalFeeLabel = formatFeeTotals(stats?.totalFee);
  const hasFilters  = searchIndustry || searchPlace || searchSize || searchKeyword;

  function handleSaved(savedClient) {
    setClients(prev => {
      const exists = prev.some(c => c.id === savedClient.id);
      if (exists) return prev.map(c => c.id === savedClient.id ? savedClient : c);
      return [savedClient, ...prev];
    });
    setEditingClient(null);
  }

  async function handleHubSpotPush(client) {
    setHubSpotBusy(prev => ({ ...prev, [client.id]: true }));
    setHubSpotError("");
    try {
      const status = await apiPostJson(`/api/clients/${client.id}/hubspot/push`);
      setHubSpotStatuses(prev => ({ ...prev, [client.id]: status }));
    } catch (e) {
      setHubSpotError(`Could not sync ${client.companyName} to HubSpot. ${e.message || "Please try again."}`);
      try {
        const status = await apiGet(`/api/clients/${client.id}/hubspot/status`);
        setHubSpotStatuses(prev => ({ ...prev, [client.id]: status }));
      } catch {
        // Keep the last known state when the status refresh also fails.
      }
    } finally {
      setHubSpotBusy(prev => ({ ...prev, [client.id]: false }));
    }
  }

  async function handleHubSpotSync(client) {
    setHubSpotBusy(prev => ({ ...prev, [client.id]: true }));
    setHubSpotError("");
    try {
      const status = await apiPostJson(`/api/clients/${client.id}/hubspot/sync`);
      setHubSpotStatuses(prev => ({ ...prev, [client.id]: status }));
      await loadClients();
    } catch (e) {
      if (e.status === 409) {
        const useHubSpot = window.confirm(`${e.message}\n\nOK: update Nolyvra from HubSpot.\nCancel: choose another action.`);
        let direction = useHubSpot ? "pull" : null;
        if (!direction) {
          const useNolyvra = window.confirm("Overwrite HubSpot with the Nolyvra client instead?");
          if (!useNolyvra) {
            setHubSpotBusy(prev => ({ ...prev, [client.id]: false }));
            return;
          }
          direction = "push";
        }
        try {
          const status = await apiPostJson(`/api/clients/${client.id}/hubspot/sync?direction=${direction}`);
          setHubSpotStatuses(prev => ({ ...prev, [client.id]: status }));
          if (direction === "pull") await loadClients();
        } catch (forcedError) {
          setHubSpotError(`Could not resolve HubSpot sync for ${client.companyName}. ${forcedError.message || "Please try again."}`);
        }
      } else {
        setHubSpotError(`Could not sync ${client.companyName} with HubSpot. ${e.message || "Please try again."}`);
        try {
          const status = await apiGet(`/api/clients/${client.id}/hubspot/status`);
          setHubSpotStatuses(prev => ({ ...prev, [client.id]: status }));
        } catch {
          // Keep the last known state when the status refresh also fails.
        }
      }
    } finally {
      setHubSpotBusy(prev => ({ ...prev, [client.id]: false }));
    }
  }

  async function handleBulkHubSpot() {
    const targets = filtered.filter(client => {
      const status = hubSpotStatuses[client.id];
      if (!status || status.state === "disconnected" || hubSpotBusy[client.id]) return false;
      return true;
    });
    if (targets.length === 0) return;
    setHubSpotError("");
    for (const client of targets) {
      if (hubSpotStatuses[client.id]?.linked) {
        await handleHubSpotSync(client);
      } else {
        await handleHubSpotPush(client);
      }
    }
  }

  const hubSpotActionCount = filtered.filter(client => {
    const status = hubSpotStatuses[client.id];
    return status && status.state !== "disconnected" && !hubSpotBusy[client.id];
  }).length;
  const hubSpotBulkBusy = Object.values(hubSpotBusy).some(Boolean);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: BG, p: "24px 28px" }}>

      {/* Page header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: "20px" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <Box onClick={() => nav("/dashboard")} sx={{
            display: "flex", alignItems: "center", gap: "4px",
            fontSize: 12, color: MUTED, cursor: "pointer",
            "&:hover": { color: ACCENT }, transition: "color .12s",
          }}>
            <BackIcon /> Dashboard
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: "10px",
              background: "linear-gradient(135deg, #1D72E8 0%, #7C3AED 100%)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            }}>
              <BuildingIcon />
            </Box>
            <Box>
              <Box sx={{ fontSize: 20, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
                Client Tracker &amp; Outreach
              </Box>
              <Box sx={{ fontSize: 12, color: MUTED, mt: "2px" }}>
                Manage your client relationships and discover new opportunities
              </Box>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Button
            onClick={handleBulkHubSpot}
            variant="outlined"
            size="small"
            disabled={hubSpotBulkBusy || hubSpotActionCount === 0}
            startIcon={hubSpotBulkBusy
              ? <SyncIcon sx={{
                  fontSize: 14,
                  animation: "hubspotSpin 0.9s linear infinite",
                  "@keyframes hubspotSpin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }} />
              : <HubOutlinedIcon sx={{ fontSize: 14 }} />}
            sx={{
              height: 36, px: "12px", borderRadius: "8px", borderColor: BORDER,
              color: HUBSPOT, bgcolor: SURFACE, fontSize: 12, fontWeight: 700,
              textTransform: "none", whiteSpace: "nowrap",
              "&.Mui-disabled": { bgcolor: "#F7F8FA", color: MUTED, borderColor: BORDER },
              "&:hover": { borderColor: HUBSPOT, bgcolor: HUBSPOT_L },
            }}
          >
            Sync HubSpot
          </Button>
          <Box onClick={() => setShowAdd(true)} sx={{
            display: "flex", alignItems: "center", gap: "6px",
            px: "16px", py: "9px", borderRadius: "9px",
            bgcolor: ACCENT, color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer", "&:hover": { bgcolor: "#1558C0" }, transition: "background .15s",
          }}>
            <PlusIcon /> Add Client
          </Box>
        </Box>
      </Box>

      {/* KPI strip */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px", mb: "20px" }}>
        <KpiCard label="Total Clients" value={stats?.totalClients ?? "—"} color={ACCENT} bg={ACCENT_L}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>} />
        <KpiCard label="Active Mandates" value={totalActive} color={SUCCESS} bg={SUCCESS_L}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>} />
        <KpiCard label="Placements" value={totalFilled} color={PURPLE} bg={PURPLE_L}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
        <KpiCard label="Total Fee (Active/Fulfilling)" value={totalFeeLabel || "—"} color={SUCCESS} bg={SUCCESS_L}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} />
        <KpiCard label="Potential Clients" value={potentialSearched ? potential.length : "—"} color={WARN} bg={WARN_L}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
      </Box>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: "60px" }}>
          <CircularProgress size={32} sx={{ color: ACCENT }} />
        </Box>
      )}

      {error && (
        <Box sx={{ p: "14px 16px", borderRadius: "10px", bgcolor: "rgba(220,38,38,0.06)",
          border: "1px solid rgba(220,38,38,0.18)", color: "#DC2626", fontSize: 13, mb: "20px" }}>
          {error}
        </Box>
      )}

      {hubSpotError && (
        <Alert severity="error" onClose={() => setHubSpotError("")} sx={{ mb: "20px", borderRadius: "8px" }}>
          {hubSpotError}
        </Alert>
      )}

      {!loading && (
        <>
          {/* Your Clients table */}
          <Box sx={{ ...CARD_BASE, mb: "24px" }}>
            <Box sx={{ px: "20px", py: "14px", borderBottom: `1px solid ${BORDER}`,
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box sx={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
                Your Clients
                <Box component="span" sx={{ ml: "8px", fontSize: 12, color: MUTED, fontWeight: 400 }}>
                  ({filtered.length} loaded{stats?.totalClients != null ? ` of ${stats.totalClients}` : ""})
                </Box>
              </Box>
              <Box sx={{ position: "relative", width: 240 }}>
                <Box sx={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}>
                  <SearchIcon />
                </Box>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients…"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: "7px 10px 7px 32px", border: `1px solid ${BORDER}`,
                    borderRadius: "8px", fontSize: 12, color: TEXT,
                    outline: "none", fontFamily: "inherit", background: SURFACE,
                  }}
                />
              </Box>
            </Box>

            <Box sx={{
              display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 1.2fr 2fr 2fr",
              px: "16px", py: "8px", borderBottom: `1px solid ${BORDER}`, bgcolor: "#F8FAFC",
            }}>
              {["Client", "Contact", "Active Jobs", "Total Fee", "Job Details", "Actions"].map((h, i) => (
                <Box key={i} sx={{ fontSize: 11, fontWeight: 600, color: MUTED,
                  textTransform: "uppercase", letterSpacing: ".5px",
                  textAlign: i === 5 ? "right" : "left" }}>
                  {h}
                </Box>
              ))}
            </Box>

            {filtered.length === 0 ? (
              <Box sx={{ py: "48px", textAlign: "center" }}>
                {serverSearching ? (
                  <CircularProgress size={20} sx={{ color: ACCENT }} />
                ) : (
                  <Box sx={{ fontSize: 13, color: MUTED }}>
                    {search ? "No clients match your search." : "No clients yet. Add your first client to get started."}
                  </Box>
                )}
              </Box>
            ) : (
              filtered.map(c => (
                <ClientRow key={c.id} client={c} onEdit={setEditingClient}
                  onSelect={setSelectedClient} onInvoice={setInvoicingClient}
                  hubSpotStatus={hubSpotStatuses[c.id]}
                  />
              ))
            )}
            {!search && hasMore && (
              <Box sx={{ display: "flex", justifyContent: "center", py: "14px", borderTop: `1px solid ${BORDER}` }}>
                <Button variant="outlined" onClick={loadMoreClients} disabled={loadingMore}
                  sx={{ borderRadius: "8px", textTransform: "none", fontSize: 13, fontWeight: 600,
                    borderColor: BORDER, color: TEXT, "&:hover": { borderColor: ACCENT, color: ACCENT } }}>
                  {loadingMore ? <CircularProgress size={16} sx={{ color: ACCENT }} /> : "Load More"}
                </Button>
              </Box>
            )}
          </Box>

          {/* Potential Clients */}
          <Box sx={{ mb: "8px" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: "14px" }}>
              <Box sx={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Potential Clients</Box>
              <Box sx={{ px: "8px", py: "2px", borderRadius: "20px", bgcolor: WARN_L,
                color: WARN, fontSize: 11, fontWeight: 600 }}>
                AI-powered signals
              </Box>
            </Box>

            {/* Search filter card */}
            <Box sx={{ ...CARD_BASE, p: "16px 20px", mb: "14px" }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px", mb: "14px" }}>
                <Box>
                  <Box sx={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase",
                    letterSpacing: ".4px", mb: "5px" }}>Industry</Box>
                  <input value={searchIndustry} onChange={e => setSearchIndustry(e.target.value)}
                    placeholder="e.g. Technology" style={inputStyle} />
                </Box>
                <Box>
                  <Box sx={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase",
                    letterSpacing: ".4px", mb: "5px" }}>Place</Box>
                  <input value={searchPlace} onChange={e => setSearchPlace(e.target.value)}
                    placeholder="e.g. Sydney" style={inputStyle} />
                </Box>
                <Box>
                  <Box sx={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase",
                    letterSpacing: ".4px", mb: "5px" }}>Company Size</Box>
                  <select value={searchSize} onChange={e => setSearchSize(e.target.value)} style={inputStyle}>
                    <option value="">Any size</option>
                    <option value="small">Small (1–50)</option>
                    <option value="medium">Medium (51–200)</option>
                    <option value="large">Large (201–1,000)</option>
                    <option value="enterprise">Enterprise (1,000+)</option>
                  </select>
                </Box>
                <Box>
                  <Box sx={{ fontSize: 11, fontWeight: 600, color: MUTED, textTransform: "uppercase",
                    letterSpacing: ".4px", mb: "5px" }}>Company Keyword</Box>
                  <input value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
                    placeholder="e.g. Acme Corp" style={inputStyle} />
                </Box>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px" }}>
                {hasFilters && (
                  <Box onClick={() => { setSearchIndustry(""); setSearchPlace(""); setSearchSize(""); setSearchKeyword(""); }}
                    sx={{ fontSize: 12, color: MUTED, cursor: "pointer",
                      "&:hover": { color: TEXT }, transition: "color .12s" }}>
                    Clear filters
                  </Box>
                )}
                <Box onClick={potentialLoading ? undefined : handleFindPotential} sx={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  px: "14px", py: "8px", borderRadius: "8px",
                  bgcolor: potentialLoading ? WARN_L : WARN,
                  color: potentialLoading ? WARN : "#fff",
                  fontSize: 13, fontWeight: 600,
                  cursor: potentialLoading ? "default" : "pointer",
                  transition: "all .15s",
                  "&:hover": potentialLoading ? {} : { bgcolor: "#B45309" },
                }}>
                  {potentialLoading
                    ? <><CircularProgress size={13} sx={{ color: WARN }} /> Searching…</>
                    : <><SparkIcon /> {potentialSearched ? "Refresh" : "Find Potential Clients"}</>}
                </Box>
              </Box>
            </Box>

            {!potentialSearched && (
              <Box sx={{ ...CARD_BASE, p: "48px 24px", textAlign: "center" }}>
                <Box sx={{ fontSize: 32, mb: "12px" }}>🔍</Box>
                <Box sx={{ fontSize: 14, fontWeight: 600, color: TEXT, mb: "6px" }}>
                  Discover companies actively hiring
                </Box>
                <Box sx={{ fontSize: 12, color: MUTED, maxWidth: 420, mx: "auto" }}>
                  Filter by industry, place, size, or keyword — then click <strong>Find Potential Clients</strong> to surface companies showing live hiring signals.
                </Box>
              </Box>
            )}

            {potentialSearched && potentialError && (
              <Box sx={{ p: "14px 16px", borderRadius: "10px", bgcolor: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.18)", color: "#DC2626", fontSize: 13 }}>
                {potentialError}
              </Box>
            )}

            {potentialSearched && !potentialLoading && !potentialError && potential.length === 0 && (
              <Box sx={{ ...CARD_BASE, p: "48px 24px", textAlign: "center" }}>
                <Box sx={{ fontSize: 13, color: MUTED }}>
                  No potential clients found for these filters. Try broadening your search.
                </Box>
              </Box>
            )}

            {selectedIds.size > 0 && (
              <Box sx={{ ...CARD_BASE, p: "14px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <Box sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>
                    {selectedIds.size} selected
                  </Box>
                  <Box onClick={bulkGenerating ? undefined : generateBulkOutreach} sx={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    px: "14px", py: "7px", borderRadius: "8px",
                    bgcolor: bulkGenerating ? ACCENT_L : ACCENT, color: bulkGenerating ? ACCENT : "#fff",
                    fontSize: 12, fontWeight: 600, cursor: bulkGenerating ? "default" : "pointer",
                    transition: "all .15s", "&:hover": bulkGenerating ? {} : { bgcolor: "#1558C0" },
                  }}>
                    {bulkGenerating
                      ? <><CircularProgress size={12} sx={{ color: ACCENT }} /> Generating…</>
                      : <><SparkIcon /> {bulkMsg ? "Regenerate Bulk Outreach" : "Generate Bulk Outreach"}</>}
                  </Box>
                  {bulkMsg && (
                    <>
                      <Box component="span" onClick={() => navigator.clipboard?.writeText(bulkMsg)}
                        sx={{ fontSize: 11, color: ACCENT, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
                        Copy
                      </Box>
                      <Box component="span" onClick={sendBulkEmail}
                        sx={{ fontSize: 11, color: ACCENT, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
                        Send Email
                      </Box>
                    </>
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Box onClick={() => setSelectedIds(new Set())} sx={{
                    fontSize: 11, color: MUTED, cursor: "pointer", "&:hover": { color: TEXT } }}>
                    Clear selection
                  </Box>
                </Box>
                {bulkGenError && (
                  <Box sx={{ p: "8px 10px", borderRadius: "6px", bgcolor: "rgba(220,38,38,0.06)",
                    border: "1px solid rgba(220,38,38,0.15)", color: "#DC2626", fontSize: 11 }}>
                    {bulkGenError}
                  </Box>
                )}
                {bulkMsg && (
                  <Box sx={{ p: "12px", bgcolor: "#F8FAFC", border: `1px solid ${BORDER}`, borderRadius: "8px",
                    fontSize: 12, color: TEXT, lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto" }}>
                    {bulkMsg}
                  </Box>
                )}
              </Box>
            )}

            {potential.length > 0 && (
              <>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {potential.map((pc, i) => (
                    <PotentialCard key={pc.externalId ?? i} pc={pc} onViewDetail={() => setDetailCard(pc)}
                      selected={selectedIds.has(pc.externalId)}
                      onToggleSelect={() => toggleSelect(pc.externalId)}
                      searchPlace={searchPlace} searchKeyword={searchKeyword} />
                  ))}
                </Box>
                <Box sx={{ textAlign: "center", mt: "16px" }}>
                  <Box onClick={potentialLoadingMore ? undefined : handleLoadMorePotential} sx={{
                    display: "inline-flex", alignItems: "center", gap: "8px", px: "18px", py: "9px",
                    bgcolor: potentialLoadingMore ? WARN_L : "#fff", color: WARN,
                    border: `1px solid ${WARN}`, borderRadius: "8px", fontSize: 13, fontWeight: 600,
                    cursor: potentialLoadingMore ? "default" : "pointer",
                    "&:hover": potentialLoadingMore ? {} : { bgcolor: WARN_L },
                  }}>
                    {potentialLoadingMore ? "Loading…" : "Load More"}
                  </Box>
                </Box>
              </>
            )}
          </Box>
        </>
      )}

      {/* Detail modal */}
      {detailCard && (
        <PotentialDetailModal
          pc={detailCard}
          onClose={() => setDetailCard(null)}
          onAddToClients={handleAddFromPotential}
          searchPlace={searchPlace}
          searchKeyword={searchKeyword}
        />
      )}

      {/* Dialogs */}
      <AddClientDialog open={showAdd} onClose={() => setShowAdd(false)} onSaved={handleSaved} />
      <AddClientDialog
        open={editingClient !== null}
        onClose={() => setEditingClient(null)}
        onSaved={handleSaved}
        initialData={editingClient}
        clientId={editingClient?.id}
      />
      <AddClientDialog
        open={addFromPotential !== null}
        onClose={() => setAddFromPotential(null)}
        onSaved={(saved) => { handleSaved(saved); setAddFromPotential(null); }}
        initialData={addFromPotential}
        fromLead
      />
      {selectedClient && (
        <ClientDetailDialog client={selectedClient} onClose={() => setSelectedClient(null)}
          onEdit={c => { setSelectedClient(null); setEditingClient(c); }} />
      )}
      {invoicingClient && (
        <InvoiceDialog
          client={invoicingClient}
          onClose={() => setInvoicingClient(null)}
          onInvoiced={loadClients}
        />
      )}
    </Box>
  );
}
