import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
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

const CARD_BASE = {
  bgcolor: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: "12px",
  boxShadow: "0 1px 4px rgba(15,22,35,0.05)",
  overflow: "hidden",
};

// ─── API helpers ──────────────────────────────────────────────────────────────
const API     = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const loginId = () => localStorage.getItem("loginId") || "";
const hdrs    = () => ({
  Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}`,
  "Content-Type": "application/json",
});

async function apiGet(path) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${API}${path}${sep}loginId=${encodeURIComponent(loginId())}`, { headers: hdrs() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function apiPost(path, body) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${API}${path}${sep}loginId=${encodeURIComponent(loginId())}`, {
    method: "POST", headers: hdrs(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.text();
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
const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const ChevronUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"/>
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

// ─── Client row ───────────────────────────────────────────────────────────────
function ClientRow({ client, onEdit }) {
  return (
    <>
      {/* Row */}
      <Box sx={{
        display: "grid",
        gridTemplateColumns: "2fr 1.5fr 1fr 2fr 1fr",
        alignItems: "center",
        px: "16px", py: "12px",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        {/* Client */}
        <Box>
          <Box sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{client.companyName}</Box>
          <Box sx={{ fontSize: 11, color: MUTED, mt: "2px" }}>
            {[client.industry, client.location].filter(Boolean).join(" • ")}
          </Box>
        </Box>
        {/* Contact */}
        <Box>
          {client.contactPerson
            ? <Box sx={{ fontSize: 13, color: TEXT }}>{client.contactPerson}</Box>
            : <Box sx={{ fontSize: 12, color: MUTED }}>—</Box>}
          {client.contactEmail && <Box sx={{ fontSize: 11, color: MUTED, mt: "1px" }}>{client.contactEmail}</Box>}
        </Box>
        {/* Active Jobs */}
        <Box>
          <Box sx={{ fontSize: 13, fontWeight: 600, color: client.activeJobCount > 0 ? SUCCESS : MUTED }}>
            {client.activeJobCount} Active
          </Box>
          {client.totalJobCount > 0 && (
            <Box sx={{ fontSize: 11, color: MUTED }}>{client.totalJobCount} Total</Box>
          )}
        </Box>
        {/* Job Details */}
        <Box>
          {client.recentJobs?.length > 0 ? (
            client.recentJobs.slice(0, 2).map((job, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: "6px", mb: "3px" }}>
                <Box sx={{ fontSize: 12, color: TEXT, fontWeight: 500, flexShrink: 0 }}>{job.title}</Box>
                <Box sx={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>· {job.daysOld}d</Box>
                <JobStatusTag status={job.status} />
              </Box>
            ))
          ) : (
            <Box sx={{ fontSize: 12, color: MUTED }}>No jobs</Box>
          )}
          {client.recentJobs?.length > 2 && (
            <Box sx={{ fontSize: 11, color: MUTED }}>+{client.recentJobs.length - 2} more</Box>
          )}
        </Box>
        {/* Actions */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          <Box onClick={e => { e.stopPropagation(); onEdit(client); }} sx={{
            px: "8px", py: "5px", borderRadius: "6px", fontSize: 12,
            border: `1px solid ${BORDER}`, color: MUTED, bgcolor: SURFACE,
            display: "flex", alignItems: "center", gap: "4px", cursor: "pointer",
            "&:hover": { color: ACCENT, borderColor: ACCENT }, transition: "all .12s",
          }}>
            <EditIcon />
          </Box>
        </Box>
      </Box>
    </>
  );
}

// ─── Potential client card ─────────────────────────────────────────────────────
function PotentialCard({ pc }) {
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
        recentSignals: pc.signalReasons?.join("; ") || pc.hiringSignal,
      });
      setMsg(msg);
    } catch (e) {
      setGenError(e.message || "Generation failed.");
    } finally {
      setGen(false);
    }
  }

  return (
    <Box sx={{ ...CARD_BASE, p: "18px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Box>
          <Box sx={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{pc.companyName}</Box>
          <Box sx={{ fontSize: 12, color: MUTED, mt: "2px" }}>{pc.size} · {pc.location}</Box>
        </Box>
        <Box sx={{ px: "10px", py: "4px", borderRadius: "20px", fontSize: 12, fontWeight: 700,
          color: scoreColor, bgcolor: scoreBg, flexShrink: 0 }}>
          {pc.matchScore}% match
        </Box>
      </Box>

      {/* Industry + hiring signal */}
      <Box sx={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {pc.industry && <Tag color={PURPLE} bg={PURPLE_L}>{pc.industry}</Tag>}
        <Tag color={WARN} bg={WARN_L}>{pc.hiringSignal}</Tag>
      </Box>

      {/* Signal reasons */}
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

      {/* Stats row */}
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

      {/* Decision makers */}
      {pc.decisionMakers?.length > 0 && (
        <Box>
          <Box sx={{ fontSize: 11, color: MUTED, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: ".5px", mb: "6px" }}>Key Contacts</Box>
          {pc.decisionMakers.map((dm, i) => (
            <Box key={i} sx={{ fontSize: 12, color: TEXT, mb: "2px" }}>
              <strong>{dm.name}</strong>
              <Box component="span" sx={{ color: MUTED }}> — {dm.title}</Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Generate outreach */}
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
          <Box component="span"
            onClick={() => navigator.clipboard?.writeText(outreachMsg)}
            sx={{ fontSize: 11, color: ACCENT, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
            Copy
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ClientTrackerPage() {
  const nav = useNavigate();

  const [clients,           setClients]           = useState([]);
  const [potential,         setPotential]         = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [error,             setError]             = useState("");
  const [search,            setSearch]            = useState("");
  const [showAdd,           setShowAdd]           = useState(false);
  const [editingClient,     setEditingClient]     = useState(null);
  const [potentialLoading,  setPotentialLoading]  = useState(false);
  const [potentialSearched, setPotentialSearched] = useState(false);
  const [potentialError,    setPotentialError]    = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const c = await apiGet("/api/clients?");
        setClients(c);
      } catch (e) {
        setError(e.message || "Failed to load clients.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleFindPotential() {
    setPotentialLoading(true);
    setPotentialError("");
    setPotentialSearched(true);
    try {
      const p = await apiGet("/api/clients/potential?");
      setPotential(p);
    } catch (e) {
      setPotentialError(e.message || "Failed to fetch potential clients.");
    } finally {
      setPotentialLoading(false);
    }
  }

  const filtered = clients.filter(c =>
    !search ||
    c.companyName?.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase()) ||
    c.contactPerson?.toLowerCase().includes(search.toLowerCase())
  );

  const totalActive  = clients.reduce((s, c) => s + c.activeJobCount, 0);
  const totalFilled  = clients.reduce((s, c) => s + c.filledJobCount, 0);

  function handleSaved(savedClient) {
    setClients(prev => {
      const exists = prev.some(c => c.id === savedClient.id);
      if (exists) return prev.map(c => c.id === savedClient.id ? savedClient : c);
      return [savedClient, ...prev];
    });
    setEditingClient(null);
  }

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

        <Box onClick={() => setShowAdd(true)} sx={{
          display: "flex", alignItems: "center", gap: "6px",
          px: "16px", py: "9px", borderRadius: "9px",
          bgcolor: ACCENT, color: "#fff", fontSize: 13, fontWeight: 600,
          cursor: "pointer", "&:hover": { bgcolor: "#1558C0" }, transition: "background .15s",
        }}>
          <PlusIcon /> Add Client
        </Box>
      </Box>

      {/* KPI strip */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", mb: "20px" }}>
        <KpiCard label="Total Clients" value={clients.length} color={ACCENT} bg={ACCENT_L}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>} />
        <KpiCard label="Active Mandates" value={totalActive} color={SUCCESS} bg={SUCCESS_L}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>} />
        <KpiCard label="Placements" value={totalFilled} color={PURPLE} bg={PURPLE_L}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
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

      {!loading && (
        <>
          {/* Your Clients table */}
          <Box sx={{ ...CARD_BASE, mb: "24px" }}>
            {/* Table header */}
            <Box sx={{ px: "20px", py: "14px", borderBottom: `1px solid ${BORDER}`,
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box sx={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
                Your Clients
                <Box component="span" sx={{ ml: "8px", fontSize: 12, color: MUTED, fontWeight: 400 }}>
                  ({filtered.length})
                </Box>
              </Box>
              {/* Search */}
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

            {/* Column headers */}
            <Box sx={{
              display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 2fr 1fr",
              px: "16px", py: "8px", borderBottom: `1px solid ${BORDER}`,
              bgcolor: "#F8FAFC",
            }}>
              {["Client", "Contact", "Active Jobs", "Job Details", ""].map((h, i) => (
                <Box key={i} sx={{ fontSize: 11, fontWeight: 600, color: MUTED,
                  textTransform: "uppercase", letterSpacing: ".5px",
                  textAlign: i === 4 ? "right" : "left" }}>
                  {h}
                </Box>
              ))}
            </Box>

            {/* Rows */}
            {filtered.length === 0 ? (
              <Box sx={{ py: "48px", textAlign: "center" }}>
                <Box sx={{ fontSize: 13, color: MUTED }}>
                  {search ? "No clients match your search." : "No clients yet. Add your first client to get started."}
                </Box>
              </Box>
            ) : (
              filtered.map(c => (
                <ClientRow
                  key={c.id}
                  client={c}
                  onEdit={setEditingClient}
                />
              ))
            )}
          </Box>

          {/* Potential Clients */}
          <Box sx={{ mb: "8px" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Box sx={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Potential Clients</Box>
                <Box sx={{ px: "8px", py: "2px", borderRadius: "20px", bgcolor: WARN_L,
                  color: WARN, fontSize: 11, fontWeight: 600 }}>
                  AI-powered signals
                </Box>
              </Box>
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

            {!potentialSearched && (
              <Box sx={{ ...CARD_BASE, p: "48px 24px", textAlign: "center" }}>
                <Box sx={{ fontSize: 32, mb: "12px" }}>🔍</Box>
                <Box sx={{ fontSize: 14, fontWeight: 600, color: TEXT, mb: "6px" }}>
                  Discover companies actively hiring
                </Box>
                <Box sx={{ fontSize: 12, color: MUTED, maxWidth: 380, mx: "auto" }}>
                  Click <strong>Find Potential Clients</strong> to search for companies showing live hiring signals — funding rounds, job posting spikes, and team growth.
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
                  No potential clients found. Try again later.
                </Box>
              </Box>
            )}

            {potential.length > 0 && (
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {potential.map((pc, i) => <PotentialCard key={i} pc={pc} />)}
              </Box>
            )}
          </Box>
        </>
      )}

      <AddClientDialog open={showAdd} onClose={() => setShowAdd(false)} onSaved={handleSaved} />
      <AddClientDialog
        open={editingClient !== null}
        onClose={() => setEditingClient(null)}
        onSaved={handleSaved}
        initialData={editingClient}
        clientId={editingClient?.id}
      />
    </Box>
  );
}
