// ─── TalentSearchPage.jsx ────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import ImportCandidatesDialog from "./ImportCandidatesDialog";
import {
  Box, Paper, Typography, Button, TextField, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell, Chip, Divider,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER = "#E8ECF2", MUTED = "#9AA3B4", TEXT = "#0F1623", ACCENT = "#1D72E8";
const SUCCESS = "#16A34A", SUCCESS_BG = "#F0FDF4", SUCCESS_BR = "#BBF7D0";
const WARN = "#D97706", WARN_BG = "#FFFBEB", WARN_BR = "#FDE68A";
const DANGER = "#DC2626", DANGER_BG = "#FEF2F2", DANGER_BR = "#FECACA";
const PURPLE = "#7C3AED", PURPLE_BG = "#F5F3FF", PURPLE_BR = "#C4B5FD";
const ACCENT_BG = "#EBF2FF", ACCENT_BR = "#BFDBFE";

function Tag({ label, variant = "neutral" }) {
  const s = {
    match:   { bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS },
    gap:     { bg: DANGER_BG,  border: DANGER_BR,  color: DANGER  },
    neutral: { bg: "#F1F3F7",  border: BORDER,     color: MUTED   },
  }[variant] ?? { bg: "#F1F3F7", border: BORDER, color: MUTED };
  return (
    <Box sx={{ display: "inline-flex", px: 1, py: 0.25, bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: "4px", fontSize: 11, fontWeight: 500, color: s.color, m: "2px" }}>
      {label}
    </Box>
  );
}

function Badge({ label, variant = "neutral" }) {
  const s = {
    accent:  { bg: ACCENT_BG,  border: ACCENT_BR,  color: ACCENT  },
    purple:  { bg: PURPLE_BG,  border: PURPLE_BR,  color: PURPLE  },
    neutral: { bg: "#F1F3F7",  border: BORDER,     color: MUTED   },
  }[variant] ?? { bg: "#F1F3F7", border: BORDER, color: MUTED };
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", bgcolor: s.bg, border: `1px solid ${s.border}`, borderRadius: "20px", px: 1.25, py: 0.25, fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap" }}>
      {label}
    </Box>
  );
}

function ContactBlock({ email, phone, linkedin }) {
  const rows = [
    { label: "EMAIL",    value: email    || "—", isLink: false },
    { label: "PHONE",    value: phone    || "—", isLink: false },
    { label: "LINKEDIN", value: linkedin || "—", isLink: !!linkedin },
  ];
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "5px", p: "11px 12px", bgcolor: "#FAFBFD", border: `1px solid #EEF1F6`, borderRadius: "8px", mb: 1.5 }}>
      {rows.map(r => (
        <Box key={r.label} sx={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
          <Typography sx={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.5px", color: "#B4BCC9", width: 58, flexShrink: 0, textTransform: "uppercase" }}>
            {r.label}
          </Typography>
          <Typography sx={{ fontSize: 11.5, fontWeight: r.value === "—" ? 400 : 500, color: r.isLink ? ACCENT : r.value === "—" ? "#C2C8D4" : TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
            {r.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function CandidateAvatar({ name, avatarUrl, defaultAvatar, size = 38, fontSize = 14, bg = ACCENT }) {
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const hasPhoto = !!avatarUrl && defaultAvatar !== true;
  return (
    <Box sx={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      bgcolor: hasPhoto ? "transparent" : bg, color: "#fff", display: "flex",
      alignItems: "center", justifyContent: "center", fontSize, fontWeight: 700,
    }}>
      {hasPhoto
        ? <Box component="img" src={avatarUrl} alt={name || ""} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initials}
    </Box>
  );
}

function SourceBadge({ source }) {
  if (source !== "CORESIGNAL") return null;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: "6px", px: "9px", py: "3px", bgcolor: ACCENT_BG, border: `1px solid ${ACCENT_BR}`, borderRadius: "20px", fontSize: 10.5, fontWeight: 600, color: ACCENT, mb: 1 }}>
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: ACCENT, flexShrink: 0 }} />
      Source · LinkedIn
    </Box>
  );
}

function statusFromStage(stage) {
  const s = (stage || "").toLowerCase();
  if (s.includes("offer") || s.includes("hired") || s.includes("placed"))
    return { label: "Analysed", bg: SUCCESS_BG, border: SUCCESS_BR, color: SUCCESS };
  if (s.includes("interview") || s.includes("shortlist") || s.includes("review") || s.includes("assessment"))
    return { label: "Review", bg: ACCENT_BG, border: ACCENT_BR, color: ACCENT };
  return { label: "Pending", bg: "#F1F3F7", border: BORDER, color: MUTED };
}

export function TalentSearchPage() {
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId") || "";

  // ── AI search state (unchanged) ──────────────────────────────────────────
  const [query, setQuery]               = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState(null);
  const [page, setPage]                 = useState(0);
  const [allResults, setAllResults]     = useState([]);
  const [noCvError, setNoCvError]       = useState(false);
  const [externalLoadingMore, setExternalLoadingMore] = useState(false);

  // ── Pipeline dialog state (unchanged) ────────────────────────────────────
  const [pipelineDialog,    setPipelineDialog]    = useState(false);
  const [pipelineCandidate, setPipelineCandidate] = useState(null);
  const [pipelineJobId,     setPipelineJobId]     = useState("");
  const [pipelineJobs,      setPipelineJobs]      = useState([]);
  const [pipelineSaving,    setPipelineSaving]    = useState(false);
  const [pipelineError,     setPipelineError]     = useState("");

  // ── New: DB mode ──────────────────────────────────────────────────────────
  const [dbMode,    setDbMode]    = useState(false);
  const [dbResults, setDbResults] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);

  // ── New: view toggle ──────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState("cards");

  // ── Import dialog ────────────────────────────────────────────────────────
  const [importOpen,        setImportOpen]        = useState(false);
  const [bgJobId,           setBgJobId]           = useState(null);
  const [completionOpen,    setCompletionOpen]    = useState(false);
  const [completionResult,  setCompletionResult]  = useState(null);
  const bgPollRef = useRef(null);

  // Poll background import job when user closed dialog mid-import
  useEffect(() => {
    if (!bgJobId) return;
    async function pollBg() {
      try {
        const url = new URL(`${API_BASE}/api/candidates/import/status/${bgJobId}`);
        url.searchParams.set("loginId", loginId);
        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "DONE" || data.status === "ERROR") {
          clearInterval(bgPollRef.current);
          setBgJobId(null);
          if (data.status === "DONE") {
            setCompletionResult({
              importedCount:  data.importedCount  ?? 0,
              updatedCount:   data.updatedCount   ?? 0,
              duplicateCount: data.duplicateCount ?? 0,
              invalidCount:   data.invalidCount   ?? 0,
            });
            setCompletionOpen(true);
            handleCandidatesSearch();
          }
        }
      } catch (_) { /* keep polling on transient errors */ }
    }
    pollBg();
    bgPollRef.current = setInterval(pollBg, 2000);
    return () => clearInterval(bgPollRef.current);
  }, [bgJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CoreSignal profile popup ──────────────────────────────────────────────
  const [csProfileOpen,    setCsProfileOpen]    = useState(false);
  const [csProfile,        setCsProfile]        = useState(null);
  const [csProfileLoading, setCsProfileLoading] = useState(false);

  // ── Selected candidate (right-side detail panel) ─────────────────────────
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!loginId) return;
    const url = new URL(`${API_BASE}/api/jobs`);
    url.searchParams.set("loginId", loginId);
    fetch(url.toString(), { headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` } })
      .then(r => r.json()).then(setPipelineJobs).catch(() => {});
  }, [loginId]);

  const QUICK = ["Senior Java Engineer", "FinTech · Series B", "5+ years backend", "Product Manager SaaS"];

  function sortResults(results, searchQuery) {
    const keywords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
    return results
      .map(c => ({ ...c, _hits: keywords.filter(k => [c.name, c.currentTitle, c.currentCompany, ...(c.matchedSkills ?? [])].join(" ").toLowerCase().includes(k)).length }))
      .sort((a, b) => b._hits !== a._hits ? b._hits - a._hits : (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }

  async function fetchResults(searchQuery, page) {
    const url = new URL(`${API_BASE}/api/talent-search/query`);
    url.searchParams.set("loginId", loginId);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
      body: JSON.stringify({ query: searchQuery, pageSize: 9, page }),
    });
    if (res.status === 402) throw new Error("You have run out of tokens. Please upgrade your plan to continue searching.");
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function handleSearch(q) {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setDbMode(false);
    setSelected(null);
    setLoading(true); setError(null);
    setSearchedQuery(searchQuery); setPage(0);
    try {
      const data = await fetchResults(searchQuery, 0);
      const sorted = sortResults(data.results ?? [], searchQuery);
      setAllResults(sorted);
      setResult({ ...data, results: sorted });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage); setLoading(true);
    try {
      const data = await fetchResults(searchedQuery, nextPage);
      const newSorted = sortResults(data.results ?? [], searchedQuery);
      const combined = [...allResults, ...newSorted];
      setAllResults(combined);
      setResult(prev => ({ ...prev, results: combined }));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleLoadMoreExternal() {
    setExternalLoadingMore(true); setError(null);
    try {
      const url = new URL(`${API_BASE}/api/talent-search/external/load-more`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: JSON.stringify({ query: searchedQuery }),
      });
      if (res.status === 402) throw new Error("You have run out of tokens. Please upgrade your plan to continue searching.");
      if (!res.ok) throw new Error(await res.text());
      const fresh = await res.json();
      const existingIds = new Set(allResults.filter(c => c.coresignalId).map(c => c.coresignalId));
      const deduped = (fresh ?? []).filter(c => c.coresignalId && !existingIds.has(c.coresignalId));
      const combined = [...allResults, ...deduped];
      setAllResults(combined);
      setResult(prev => prev && ({
        ...prev,
        results: combined,
        coreSignalCount: (prev.coreSignalCount ?? 0) + deduped.length,
        totalFound: (prev.totalFound ?? 0) + deduped.length,
      }));
    } catch (e) { setError(e.message); }
    finally { setExternalLoadingMore(false); }
  }

  async function handleCandidatesSearch() {
    setDbMode(true); setSelected(null);
    setDbLoading(true); setError(null);
    try {
      const url = new URL(`${API_BASE}/api/candidates`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` } });
      if (!res.ok) throw new Error(await res.text());
      setDbResults(await res.json());
    } catch (e) { setError(e.message); }
    finally { setDbLoading(false); }
  }

  async function handlePipelineSave() {
    setPipelineSaving(true); setPipelineError("");
    try {
      const path = pipelineJobId ? `/api/jobs/${pipelineJobId}/candidates` : `/api/candidates`;
      const url = new URL(`${API_BASE}${path}`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
        body: JSON.stringify({ name: pipelineCandidate?.name ?? "", linkedinUrl: pipelineCandidate?.linkedinUrl ?? "", email: pipelineCandidate?.email ?? "", cvText: "" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 409 || text.toLowerCase().includes("already in the pipeline"))
          setPipelineError("This candidate is already in the pipeline.");
        else
          setPipelineError("Failed to add candidate: " + text);
        return;
      }
      const candidate = await res.json();
      setPipelineDialog(false);
      nav(`/candidates/${candidate.id}/workflow`);
    } catch (e) { setPipelineError("Failed to add candidate: " + e.message); }
    finally { setPipelineSaving(false); }
  }

  async function openCoreSignalProfile(coresignalId) {
    setCsProfile(null); setCsProfileLoading(true); setCsProfileOpen(true);
    try {
      const url = new URL(`${API_BASE}/api/talent-search/coresignal/${coresignalId}`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${localStorage.getItem("sessionToken") || ""}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setCsProfile(await res.json());
    } catch (e) {
      setError(e.message);
      setCsProfileOpen(false);
    } finally {
      setCsProfileLoading(false);
    }
  }

  function handleViewFullProfile(c) {
    if ((c.isDB || c.source === "INTERNAL") && c.candidateId) {
      nav(`/candidates/${c.candidateId}/workflow`);
    } else if (c.source === "CORESIGNAL" && c.coresignalId) {
      openCoreSignalProfile(c.coresignalId);
    }
  }

  function handleAssignToJob(c) {
    setPipelineCandidate(c); setPipelineJobId(""); setPipelineError(""); setPipelineDialog(true);
  }

  // ── Derived display data ──────────────────────────────────────────────────
  const isLoading   = dbMode ? dbLoading : loading;
  const showSection = dbMode ? true : !!(result || loading);

  // Normalise DB candidates into the same shape the card/table renders expect
  const displayResults = dbMode
    ? dbResults.map(c => {
        const st = statusFromStage(c.stage);
        return {
          id: c.id, name: c.name, currentTitle: c.stage, currentCompany: "",
          email: c.email, phone: c.phone, linkedinUrl: c.linkedinUrl,
          source: "INTERNAL", isDB: true, isAI: false,
          statusLabel: st.label, statusBg: st.bg, statusBorder: st.border, statusColor: st.color,
          matchedSkills: [], gapSkills: [], matchScore: 0, yearsExperience: 0,
          candidateId: c.id, alreadyInPipeline: true,
        };
      })
    : (result?.results ?? []).map(c => ({
        ...c,
        isAI: true, isDB: false,
        statusLabel: "", statusBg: "", statusBorder: "", statusColor: "",
      }));

  // ── Toggle button style helper ────────────────────────────────────────────
  const toggleBtn = active => ({
    display: "inline-flex", alignItems: "center", gap: "5px",
    fontSize: 11, fontWeight: active ? 600 : 500,
    px: "10px", py: "5px", border: "none", borderRadius: "6px", cursor: "pointer",
    bgcolor: active ? "#fff" : "transparent",
    color: active ? ACCENT : MUTED,
    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
    fontFamily: "inherit",
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

      {/* ── Header row ────────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: TEXT }}>AI Talent Search</Typography>
            <Box sx={{ display: "inline-flex", px: "7px", py: "2px", bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`, borderRadius: "4px", fontSize: 10, fontWeight: 600, color: PURPLE }}>NEW</Box>
          </Box>
          <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.25 }}>Natural language search across your database and public profile data</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* Candidates Search */}
          <Button
            onClick={handleCandidatesSearch}
            variant={dbMode ? "contained" : "outlined"}
            size="small"
            startIcon={
              <Box component="span" sx={{ display: "inline-block", width: 13, height: 13, border: `1.6px solid currentColor`, borderRadius: "3px", position: "relative", flexShrink: 0 }}>
                <Box component="span" sx={{ position: "absolute", left: "1.5px", right: "1.5px", top: "3px", height: "1.4px", bgcolor: "currentColor" }} />
                <Box component="span" sx={{ position: "absolute", left: "1.5px", right: "1.5px", top: "6px", height: "1.4px", bgcolor: "currentColor" }} />
              </Box>
            }
            sx={{
              fontSize: 11, fontWeight: 600, borderRadius: "7px", textTransform: "none",
              ...(dbMode
                ? { bgcolor: ACCENT, color: "#fff", border: "none", "&:hover": { bgcolor: "#1660CC" }, boxShadow: "none" }
                : { borderColor: BORDER, color: TEXT, "&:hover": { borderColor: ACCENT, color: ACCENT } }),
            }}
          >
            Candidates Search
          </Button>
          {/* Upload Candidates — AI-assisted column mapping */}
          <Button
            onClick={() => setImportOpen(true)}
            size="small"
            sx={{ fontSize: 11, fontWeight: 600, px: "14px", bgcolor: "#F5F3FF", color: "#7C3AED", border: "1px solid #C4B5FD", borderRadius: "7px", textTransform: "none", "&:hover": { bgcolor: "#EDE9FE", borderColor: "#7C3AED" }, boxShadow: "none" }}
          >
            Upload Candidates
          </Button>
        </Box>
      </Box>

      {/* ── Search hero ───────────────────────────────────────────────────── */}
      <Box sx={{ background: "linear-gradient(135deg,#1B3A6B 0%,#0F1623 100%)", borderRadius: "10px", p: "28px 24px" }}>
        <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: ".8px", mb: 1.25 }}>✦ AI Talent Search</Typography>
        <TextField multiline rows={2} fullWidth value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSearch())}
          placeholder="e.g. Find me a Senior Java engineer with fintech experience who worked at a Series B startup"
          sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { bgcolor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", fontSize: 14, color: "#fff", "& fieldset": { border: "none" } }, "& .MuiInputBase-input::placeholder": { color: "rgba(255,255,255,0.4)" } }} />
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
          <Button variant="contained" onClick={() => handleSearch()} disabled={loading || !query.trim()}
            sx={{ fontSize: 13, py: "9px", px: "20px", bgcolor: PURPLE, borderRadius: "8px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" } }}>
            {loading && !dbMode ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "✦ Search Talent"}
          </Button>
          {QUICK.map(q => (
            <Box key={q} onClick={() => setQuery(q)}
              sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", px: "10px", py: "4px", borderRadius: "20px", fontSize: 11, cursor: "pointer", "&:hover": { bgcolor: "rgba(255,255,255,0.15)" } }}>
              "{q}"
            </Box>
          ))}
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {noCvError && (
        <Alert severity="warning" onClose={() => setNoCvError(false)}>
          Please upload a CV first before running analysis. Click "⬆ Upload CV" on the candidate card.
        </Alert>
      )}

      {/* ── Results section ───────────────────────────────────────────────── */}
      {showSection && (
        <>
          {/* Results header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>
              {dbMode
                ? <>All Candidates · Your Database <Box component="span" sx={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>— pulled live from your database</Box></>
                : <>{result?.totalFound ?? 0} candidates found <Box component="span" sx={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>— ranked by keyword match, then score</Box></>}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              {dbMode
                ? <Badge label={`● ${dbResults.length} total records`} variant="accent" />
                : <>
                    <Badge label={`● Internal DB (${result?.internalCount ?? 0})`} variant="accent" />
                    <Badge label={`● Active Profiles in Market (${result?.coreSignalCount ?? 0})`} variant="purple" />
                  </>}
              {/* Cards / Table toggle */}
              <Box sx={{ display: "inline-flex", p: "2px", bgcolor: "#F1F3F7", border: `1px solid ${BORDER}`, borderRadius: "8px", ml: 0.5 }}>
                <Box component="button" onClick={() => setViewMode("cards")} sx={toggleBtn(viewMode === "cards")}>
                  <Box component="span" sx={{ display: "inline-block", width: 11, height: 11, border: `1.6px solid currentColor`, borderRadius: "2px", flexShrink: 0 }} /> Cards
                </Box>
                <Box component="button" onClick={() => setViewMode("table")} sx={toggleBtn(viewMode === "table")}>
                  <Box component="span" sx={{ display: "inline-flex", flexDirection: "column", gap: "1.5px", width: 11, flexShrink: 0 }}>
                    {[0, 1, 2].map(i => <Box key={i} sx={{ height: "1.6px", bgcolor: "currentColor" }} />)}
                  </Box> Table
                </Box>
              </Box>
            </Box>
          </Box>

          {/* ── Results + detail panel ───────────────────────────────────── */}
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>

          {/* Loading spinner */}
          {isLoading && (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, justifyContent: "center", py: 6 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, color: MUTED, fontSize: 13 }}>
                <CircularProgress size={18} sx={{ color: ACCENT }} /> {dbMode ? "Loading candidates…" : "Searching talent…"}
              </Box>
              {!dbMode && (
                <Typography sx={{ fontSize: 11.5, color: "#B4BCC9" }}>
                  Live LinkedIn lookups can take up to 1 minute — hang tight.
                </Typography>
              )}
            </Box>
          )}

          {/* Empty state */}
          {!isLoading && displayResults.length === 0 && (
            <Box sx={{ textAlign: "center", py: 6, color: MUTED, fontSize: 13 }}>
              No record found.
            </Box>
          )}

          {/* ── Card grid ─────────────────────────────────────────────────── */}
          {!isLoading && viewMode === "cards" && (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1.5 }}>
              {displayResults.map((c, i) => {
                const scoreColor = c.matchScore >= 80 ? SUCCESS : c.matchScore >= 60 ? WARN : DANGER;
                const isCS = c.source === "CORESIGNAL";
                return (
                  <Paper key={i} elevation={0}
                    onClick={() => setSelected(c)}
                    sx={{
                      minWidth: 0,
                      border: `1px solid ${isCS ? PURPLE_BR : ACCENT_BR}`,
                      borderLeft: `3px solid ${isCS ? PURPLE : ACCENT}`,
                      borderRadius: "10px", p: 2, bgcolor: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      cursor: "pointer",
                      "&:hover": { boxShadow: "0 4px 12px rgba(0,0,0,0.10)" },
                      transition: "box-shadow .15s",
                    }}>

                    {/* Top row */}
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.25, gap: 1 }}>
                      <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", minWidth: 0 }}>
                        <CandidateAvatar name={c.name} avatarUrl={c.avatarUrl} defaultAvatar={c.defaultAvatar}
                          size={38} fontSize={14} bg={isCS ? PURPLE : ACCENT} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</Typography>
                          <Typography sx={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.currentTitle}</Typography>
                        </Box>
                      </Box>
                      {c.isAI && (
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Typography sx={{ fontSize: 20, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{c.matchScore}%</Typography>
                          <Typography sx={{ fontSize: 10, color: MUTED }}>Match</Typography>
                        </Box>
                      )}
                      {c.isDB && (
                        <Box sx={{ display: "inline-flex", px: "10px", py: "3px", bgcolor: c.statusBg, border: `1px solid ${c.statusBorder}`, borderRadius: "20px", fontSize: 10.5, fontWeight: 600, color: c.statusColor, whiteSpace: "nowrap", flexShrink: 0 }}>
                          {c.statusLabel}
                        </Box>
                      )}
                    </Box>

                    {/* Source badge (AI / CoreSignal only) */}
                    {c.isAI && <SourceBadge source={c.source} />}

                    {/* Skill tags */}
                    {c.isAI && (
                      <Box sx={{ mb: 1 }}>
                        {c.matchedSkills?.map(s => <Tag key={s} label={s} variant="match" />)}
                        {c.gapSkills?.slice(0, 2).map(s => <Tag key={s} label={`No ${s}`} variant="gap" />)}
                      </Box>
                    )}

                    {/* Company line */}
                    <Typography sx={{ fontSize: 11, color: MUTED, mb: 1.25 }}>
                      {c.currentCompany}{c.yearsExperience ? ` · ${c.yearsExperience} yrs exp` : ""}
                    </Typography>

                    {/* Contact block */}
                    <ContactBlock email={c.email} phone={c.phone} linkedin={c.linkedinUrl} />

                    {/* Action buttons */}
                    <Box sx={{ display: "flex", gap: 0.75 }} onClick={e => e.stopPropagation()}>
                      {c.isDB ? (
                        <Button size="small" variant="contained"
                          onClick={() => nav(`/candidates/${c.candidateId}/workflow`)}
                          sx={{ flex: 1, fontSize: 11, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                          View Profile
                        </Button>
                      ) : c.source === "INTERNAL" ? (
                        <Button size="small" variant="contained"
                          onClick={() => c.candidateId && nav(`/candidates/${c.candidateId}/workflow`)}
                          sx={{ flex: 1, fontSize: 11, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
                          View Profile
                        </Button>
                      ) : (
                        <Button size="small" variant="contained"
                          onClick={() => {
                            if (!c.cvText?.trim()) { setNoCvError(true); setTimeout(() => setNoCvError(false), 3000); }
                            else nav("/candidates/new", { state: { prefill: { name: c.name ?? "", email: c.email ?? "", linkedinUrl: c.linkedinUrl ?? "", cvText: c.cvText ?? "" } } });
                          }}
                          sx={{ flex: 1, fontSize: 11, bgcolor: PURPLE, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#6D28D9", boxShadow: "none" } }}>
                          Run Analysis
                        </Button>
                      )}

                      <Button size="small" variant="outlined"
                        onClick={e => { e.stopPropagation(); setPipelineCandidate(c); setPipelineJobId(""); setPipelineError(""); setPipelineDialog(true); }}
                        sx={{ flex: 1, fontSize: 11, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none", "&:hover": { borderColor: ACCENT, color: ACCENT } }}>
                        + Pipeline
                      </Button>

                      {c.source === "CORESIGNAL" && (
                        <Button size="small" variant="outlined"
                          onClick={e => { e.stopPropagation(); nav("/candidates/new", { state: { prefill: { name: c.name ?? "", email: c.email ?? "", linkedinUrl: c.linkedinUrl ?? "", cvText: "" } } }); }}
                          sx={{ fontSize: 11, borderColor: PURPLE_BR, color: PURPLE, borderRadius: "6px", textTransform: "none", "&:hover": { borderColor: PURPLE, bgcolor: PURPLE_BG } }}>
                          ⬆ Upload CV
                        </Button>
                      )}
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          )}

          {/* ── Table view ────────────────────────────────────────────────── */}
          {!isLoading && viewMode === "table" && (
            <Box sx={{ border: `1px solid ${BORDER}`, borderRadius: "10px", overflow: "hidden", bgcolor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#FAFBFD" }}>
                    {["Candidate", "Company", "Email", "Phone", "LinkedIn", dbMode ? "Status" : "Source", dbMode ? "Action" : "Score / Action"].map(h => (
                      <TableCell key={h} sx={{ fontSize: 11, fontWeight: 600, color: MUTED, borderBottom: `1px solid ${BORDER}`, py: 1.25, whiteSpace: "nowrap" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayResults.map((c, i) => {
                    const scoreColor = c.matchScore >= 80 ? SUCCESS : c.matchScore >= 60 ? WARN : DANGER;
                    const isCS = c.source === "CORESIGNAL";
                    const emptyStyle = { color: "#C2C8D4", fontWeight: 400 };
                    const val = v => v || "—";
                    const valSx = v => v ? { fontSize: 12, fontWeight: 500, color: TEXT } : { fontSize: 12, ...emptyStyle };
                    return (
                      <TableRow key={i}
                        onClick={() => setSelected(c)}
                        sx={{ "&:hover": { bgcolor: "#FAFBFD" }, borderTop: `1px solid #EEF1F6`, cursor: "pointer" }}>
                        <TableCell sx={{ py: 1.25 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                            <CandidateAvatar name={c.name} avatarUrl={c.avatarUrl} defaultAvatar={c.defaultAvatar}
                              size={30} fontSize={12} bg={isCS ? PURPLE : ACCENT} />
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT, whiteSpace: "nowrap" }}>{c.name}</Typography>
                              <Typography sx={{ fontSize: 10.5, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{c.currentTitle}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap", py: 1.25 }}>{c.currentCompany || "—"}</TableCell>
                        <TableCell sx={{ py: 1.25 }}><Typography sx={valSx(c.email)}>{val(c.email)}</Typography></TableCell>
                        <TableCell sx={{ py: 1.25 }}><Typography sx={valSx(c.phone)}>{val(c.phone)}</Typography></TableCell>
                        <TableCell sx={{ py: 1.25, maxWidth: 180 }}>
                          <Typography sx={{ ...valSx(c.linkedinUrl), color: c.linkedinUrl ? ACCENT : "#C2C8D4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {val(c.linkedinUrl)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ py: 1.25 }}>
                          {c.isDB ? (
                            <Box sx={{ display: "inline-flex", px: "9px", py: "3px", bgcolor: c.statusBg, border: `1px solid ${c.statusBorder}`, borderRadius: "20px", fontSize: 10.5, fontWeight: 600, color: c.statusColor, whiteSpace: "nowrap" }}>
                              {c.statusLabel}
                            </Box>
                          ) : (
                            <SourceBadge source={c.source} />
                          )}
                        </TableCell>
                        <TableCell sx={{ py: 1.25, textAlign: "right", whiteSpace: "nowrap" }}>
                          {c.isAI && <Typography component="span" sx={{ fontSize: 13, fontWeight: 700, color: scoreColor, mr: 1 }}>{c.matchScore}%</Typography>}
                          <Button size="small" variant="contained"
                            onClick={e => {
                              e.stopPropagation();
                              if (isCS && c.coresignalId) openCoreSignalProfile(c.coresignalId);
                              else if (c.candidateId) nav(`/candidates/${c.candidateId}/workflow`);
                            }}
                            sx={{ fontSize: 11, bgcolor: isCS ? PURPLE : ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: isCS ? "#6D28D9" : "#1660CC", boxShadow: "none" } }}>
                            {isCS ? "View Details" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Load More (AI mode only) */}
          {!dbMode && result && (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ display: "flex", gap: 1, justifyContent: "center", flexWrap: "wrap" }}>
                {result.totalFound > result.results.length && (
                  <Button variant="outlined" onClick={handleLoadMore} disabled={loading}
                    sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "8px", textTransform: "none" }}>
                    {loading ? "Loading…" : `Load More Results (${result.totalFound - result.results.length} remaining)`}
                  </Button>
                )}
                <Button variant="outlined" onClick={handleLoadMoreExternal} disabled={externalLoadingMore}
                  startIcon={externalLoadingMore ? <CircularProgress size={14} sx={{ color: PURPLE }} /> : null}
                  sx={{ fontSize: 12, borderColor: PURPLE_BR, color: PURPLE, borderRadius: "8px", textTransform: "none", "&:hover": { borderColor: PURPLE, bgcolor: PURPLE_BG } }}>
                  {externalLoadingMore ? "Fetching from LinkedIn…" : "Load More External Candidates"}
                </Button>
              </Box>
              {externalLoadingMore && (
                <Typography sx={{ fontSize: 11.5, color: "#B4BCC9" }}>
                  This can take up to 1 minute while we pull fresh LinkedIn profiles.
                </Typography>
              )}
            </Box>
          )}

          </Box>

          {/* ── Right-side detail panel ──────────────────────────────────── */}
          {selected && (
            <Paper elevation={0} sx={{ width: 340, flexShrink: 0, border: `1px solid ${BORDER}`, borderRadius: "10px", p: 2.5, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", position: "sticky", top: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Candidate Details</Typography>
                <Box component="button" onClick={() => setSelected(null)} sx={{ border: "none", bgcolor: "transparent", cursor: "pointer", color: MUTED, display: "inline-flex", alignItems: "center", fontSize: 16 }}>
                  ✕
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", mb: 1.5 }}>
                <CandidateAvatar name={selected.name} avatarUrl={selected.avatarUrl} defaultAvatar={selected.defaultAvatar}
                  size={44} fontSize={16} bg={selected.source === "CORESIGNAL" ? PURPLE : ACCENT} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: TEXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.name}</Typography>
                  <Typography sx={{ fontSize: 12, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.currentTitle}</Typography>
                </Box>
              </Box>

              {selected.isAI && <SourceBadge source={selected.source} />}

              {(selected.currentCompany || selected.yearsExperience) && (
                <Typography sx={{ fontSize: 12, color: MUTED, mb: 1.5 }}>
                  {selected.currentCompany}{selected.yearsExperience ? ` · ${selected.yearsExperience} yrs exp` : ""}
                </Typography>
              )}

              {selected.isAI && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5, pb: 1.5, borderBottom: `1px solid ${BORDER}` }}>
                  <Typography sx={{ fontSize: 12, color: MUTED }}>Match Score</Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: selected.matchScore >= 80 ? SUCCESS : selected.matchScore >= 60 ? WARN : DANGER }}>
                    {selected.matchScore}%
                  </Typography>
                </Box>
              )}

              <ContactBlock email={selected.email} phone={selected.phone} linkedin={selected.linkedinUrl} />

              {(selected.matchedSkills?.length > 0 || selected.gapSkills?.length > 0) && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, mb: 0.75 }}>Skills</Typography>
                  <Box>
                    {selected.matchedSkills?.map(s => <Tag key={s} label={s} variant="match" />)}
                    {selected.gapSkills?.map(s => <Tag key={`gap-${s}`} label={`No ${s}`} variant="gap" />)}
                  </Box>
                </Box>
              )}

              {selected.alreadyInPipeline && (
                <Box sx={{ mb: 2 }}>
                  <Badge label="Already in Pipeline" variant="accent" />
                </Box>
              )}

              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Button variant="contained" fullWidth onClick={() => handleViewFullProfile(selected)}
                  sx={{
                    fontSize: 12, borderRadius: "7px", textTransform: "none", boxShadow: "none",
                    bgcolor: selected.source === "CORESIGNAL" ? PURPLE : ACCENT,
                    "&:hover": { bgcolor: selected.source === "CORESIGNAL" ? "#6D28D9" : "#1660CC", boxShadow: "none" },
                  }}>
                  View Full Profile
                </Button>
                <Button variant="outlined" fullWidth onClick={() => handleAssignToJob(selected)}
                  sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "7px", textTransform: "none", "&:hover": { borderColor: ACCENT, color: ACCENT } }}>
                  Assign to Job
                </Button>
              </Box>
            </Paper>
          )}
          </Box>
        </>
      )}

      {/* ── Pipeline dialog (unchanged) ───────────────────────────────────── */}
      <Dialog open={pipelineDialog} onClose={() => !pipelineSaving && setPipelineDialog(false)}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "12px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 600, color: TEXT, pb: 1 }}>Add to Pipeline</DialogTitle>
        <DialogContent>
          {pipelineCandidate && (
            <Typography sx={{ fontSize: 13, color: MUTED, mb: 2 }}>
              Adding <strong style={{ color: TEXT }}>{pipelineCandidate.name}</strong> to your candidate pipeline.
            </Typography>
          )}
          <TextField select fullWidth size="small" label="Assign to Job" value={pipelineJobId}
            onChange={e => { setPipelineJobId(e.target.value); setPipelineError(""); }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: 13 } }}>
            <MenuItem value="" sx={{ fontSize: 13, color: MUTED }}>— Not Assigned —</MenuItem>
            {pipelineJobs.map(job => (
              <MenuItem key={job.id} value={job.id} sx={{ fontSize: 13 }}>
                {job.title}{job.company ? ` — ${job.company}` : ""}
              </MenuItem>
            ))}
          </TextField>
          {pipelineError && <Typography sx={{ fontSize: 12, color: DANGER, mt: 1.25, fontWeight: 500 }}>⚠ {pipelineError}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" size="small" onClick={() => setPipelineDialog(false)} disabled={pipelineSaving}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" size="small" onClick={handlePipelineSave} disabled={pipelineSaving}
            sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            {pipelineSaving ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Add to Pipeline"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Import Candidates dialog ──────────────────────────────────────── */}
      <ImportCandidatesDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleCandidatesSearch}
        onJobStarted={(jobId) => { setBgJobId(jobId); }}
      />

      {/* ── Import completion popup (shown when bg job finishes after dialog close) ── */}
      <Dialog open={completionOpen} onClose={() => setCompletionOpen(false)}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "14px" } }}>
        <DialogTitle sx={{ fontSize: 14, fontWeight: 700, color: TEXT, pb: 0.5, pt: 2.5, px: 3 }}>
          Import Complete
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 2, gap: 1.5 }}>
            <Box sx={{ fontSize: 36 }}>✅</Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: TEXT, textAlign: "center" }}>
              {completionResult?.importedCount ?? 0} candidate{(completionResult?.importedCount ?? 0) !== 1 ? "s" : ""} imported successfully
            </Typography>
            {((completionResult?.updatedCount ?? 0) > 0 || (completionResult?.duplicateCount ?? 0) > 0 || (completionResult?.invalidCount ?? 0) > 0) && (
              <Typography sx={{ fontSize: 12.5, color: MUTED, textAlign: "center", lineHeight: 1.7 }}>
                {(completionResult.updatedCount > 0) && `${completionResult.updatedCount} existing candidate${completionResult.updatedCount !== 1 ? "s" : ""} updated`}
                {(completionResult.updatedCount > 0 && (completionResult.duplicateCount > 0 || completionResult.invalidCount > 0)) && " · "}
                {(completionResult.duplicateCount > 0) && `${completionResult.duplicateCount} duplicate${completionResult.duplicateCount !== 1 ? "s" : ""} skipped`}
                {(completionResult.duplicateCount > 0 && completionResult.invalidCount > 0) && " · "}
                {(completionResult.invalidCount > 0) && `${completionResult.invalidCount} row${completionResult.invalidCount !== 1 ? "s" : ""} skipped`}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" size="small" onClick={() => setCompletionOpen(false)}
            sx={{ fontSize: 12, bgcolor: ACCENT, borderRadius: "6px", textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#1660CC", boxShadow: "none" } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── CoreSignal profile dialog ─────────────────────────────────────── */}
      <Dialog open={csProfileOpen} onClose={() => !csProfileLoading && setCsProfileOpen(false)}
        maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: "14px", maxHeight: "90vh" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 2, px: 3, borderBottom: `1px solid ${BORDER}`, pb: 2 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Candidate Profile</Typography>
          <IconButton size="small" onClick={() => setCsProfileOpen(false)} disabled={csProfileLoading}
            sx={{ color: MUTED, "&:hover": { bgcolor: "#F1F3F7" } }}>
            ✕
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: "auto" }}>
          {csProfileLoading && (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
              <CircularProgress size={32} sx={{ color: PURPLE }} />
            </Box>
          )}
          {!csProfileLoading && csProfile && (() => {
            let raw = {};
            try { raw = JSON.parse(csProfile.rawJson || "{}"); } catch (_) {}
            const exp   = Array.isArray(raw.experience)      ? raw.experience      : [];
            const edu   = Array.isArray(raw.education)       ? raw.education       : [];
            const certs = Array.isArray(raw.certifications)  ? raw.certifications  : [];
            const langs = Array.isArray(raw.languages)       ? raw.languages       : [];
            return (
              <Box>
                {/* ── Header ──────────────────────────────────────────────── */}
                <Box sx={{ p: 3, display: "flex", gap: 2.5, alignItems: "flex-start", borderBottom: `1px solid ${BORDER}` }}>
                  <CandidateAvatar name={csProfile.fullName} avatarUrl={csProfile.avatarUrl} defaultAvatar={csProfile.defaultAvatar}
                    size={64} fontSize={22} bg={PURPLE} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{csProfile.fullName}</Typography>
                    {(csProfile.jobTitle || csProfile.currentCompany) && (
                      <Typography sx={{ fontSize: 13.5, color: MUTED, mt: 0.25 }}>
                        {[csProfile.jobTitle, csProfile.currentCompany].filter(Boolean).join(" @ ")}
                      </Typography>
                    )}
                    {(csProfile.locationCity || csProfile.locationCountry) && (
                      <Typography sx={{ fontSize: 12.5, color: MUTED, mt: 0.4 }}>
                        📍 {[csProfile.locationCity, csProfile.locationCountry].filter(Boolean).join(", ")}
                      </Typography>
                    )}
                    <Box sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
                      {csProfile.yearsExperience != null && (
                        <Box sx={{ fontSize: 11.5, fontWeight: 600, color: PURPLE, bgcolor: PURPLE_BG, border: `1px solid ${PURPLE_BR}`, px: 1.25, py: 0.4, borderRadius: "6px" }}>
                          {csProfile.yearsExperience}y experience
                        </Box>
                      )}
                      {csProfile.managementLevel && (
                        <Box sx={{ fontSize: 11.5, fontWeight: 600, color: ACCENT, bgcolor: ACCENT_BG, border: `1px solid ${ACCENT_BR}`, px: 1.25, py: 0.4, borderRadius: "6px" }}>
                          {csProfile.managementLevel}
                        </Box>
                      )}
                      {(raw.followers ?? raw.follower_count) > 0 && (
                        <Typography sx={{ fontSize: 11.5, color: MUTED }}>{Number(raw.followers ?? raw.follower_count).toLocaleString()} followers</Typography>
                      )}
                      {(raw.connections ?? raw.connections_count) > 0 && (
                        <Typography sx={{ fontSize: 11.5, color: MUTED }}>{Number(raw.connections ?? raw.connections_count).toLocaleString()} connections</Typography>
                      )}
                      {csProfile.linkedinUrl && (
                        <Typography component="a" href={csProfile.linkedinUrl} target="_blank" rel="noreferrer"
                          sx={{ fontSize: 11.5, color: ACCENT, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                          LinkedIn ↗
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>

                {/* ── Body ────────────────────────────────────────────────── */}
                <Box sx={{ p: 3, display: "grid", gap: 3.5 }}>

                  {/* About */}
                  {csProfile.description && (
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, mb: 1 }}>About</Typography>
                      <Typography sx={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}>{csProfile.description}</Typography>
                    </Box>
                  )}

                  {/* Skills */}
                  {csProfile.skills?.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, mb: 1.25 }}>Skills</Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                        {csProfile.skills.map((s, si) => (
                          <Chip key={si} label={s} size="small"
                            sx={{ fontSize: 11.5, fontWeight: 500, bgcolor: PURPLE_BG, color: PURPLE, border: `1px solid ${PURPLE_BR}`, borderRadius: "6px", height: 26 }} />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Experience */}
                  {exp.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, mb: 1.5 }}>Experience</Typography>
                      <Box sx={{ display: "grid", gap: 0 }}>
                        {exp.map((ex, ei) => (
                          <Box key={ei}>
                            <Box sx={{ display: "flex", gap: 1.5 }}>
                              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 0.5 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: ACCENT, flexShrink: 0 }} />
                                {ei < exp.length - 1 && <Box sx={{ width: 1, flex: 1, bgcolor: BORDER, mt: 0.5, mb: 0 }} />}
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0, pb: ei < exp.length - 1 ? 2 : 0 }}>
                                <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{ex.title}</Typography>
                                <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.2 }}>
                                  {ex.company ?? ex.company_name}{ex.location ? ` · ${ex.location}` : ""}
                                </Typography>
                                {(ex.start_date || ex.end_date || ex.date_from_year || ex.date_to_year) && (
                                  <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.15 }}>
                                    {ex.start_date ?? ex.date_from_year ?? "?"} – {ex.end_date ?? ex.date_to_year ?? "Present"}
                                  </Typography>
                                )}
                                {(ex.description ?? ex.description_html) && (
                                  <Typography sx={{ fontSize: 12, color: TEXT, mt: 0.6, lineHeight: 1.6, opacity: 0.78 }}>{ex.description ?? ex.description_html}</Typography>
                                )}
                              </Box>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Education */}
                  {edu.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, mb: 1.5 }}>Education</Typography>
                      <Box sx={{ display: "grid", gap: 1.5 }}>
                        {edu.map((ed, edi) => (
                          <Box key={edi} sx={{ display: "flex", gap: 1.5 }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: PURPLE, mt: 0.5, flexShrink: 0 }} />
                            <Box>
                              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{ed.institution ?? ed.major ?? ed.title}</Typography>
                              {ed.title && (ed.institution ?? ed.major) && <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.15 }}>{ed.title}</Typography>}
                              {(ed.start_year || ed.end_year || ed.date_from || ed.date_to) && (
                                <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.15 }}>
                                  {ed.start_year ?? ed.date_from ?? "?"} – {ed.end_year ?? ed.date_to ?? "Present"}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Certifications */}
                  {certs.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, mb: 1.5 }}>Certifications</Typography>
                      <Box sx={{ display: "grid", gap: 1.25 }}>
                        {certs.map((ct, cti) => (
                          <Box key={cti} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#F59E0B", mt: 0.5, flexShrink: 0 }} />
                            <Box>
                              <Typography sx={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{ct.title}</Typography>
                              {ct.issuer && <Typography sx={{ fontSize: 12, color: MUTED, mt: 0.1 }}>{ct.issuer}</Typography>}
                              {ct.date_from_year && <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.1 }}>{ct.date_from_year}</Typography>}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Languages */}
                  {langs.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, mb: 1.25 }}>Languages</Typography>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                        {langs.map((lg, lgi) => (
                          <Box key={lgi} sx={{ px: 1.75, py: 0.85, bgcolor: "#F8FAFB", border: `1px solid ${BORDER}`, borderRadius: "8px" }}>
                            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: TEXT }}>{lg.title ?? lg.language}</Typography>
                            {(lg.subtitle ?? lg.proficiency) && <Typography sx={{ fontSize: 11, color: MUTED, mt: 0.1 }}>{lg.subtitle ?? lg.proficiency}</Typography>}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}

                </Box>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, borderTop: `1px solid ${BORDER}` }}>
          <Button variant="outlined" size="small" onClick={() => setCsProfileOpen(false)}
            sx={{ fontSize: 12, borderColor: BORDER, color: TEXT, borderRadius: "6px", textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TalentSearchPage;
