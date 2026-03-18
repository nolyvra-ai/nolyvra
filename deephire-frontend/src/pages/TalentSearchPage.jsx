// ─── TalentSearchPage.jsx ────────────────────────────────────────────────────
import { useState } from "react";
import { Box, Paper, Typography, Button, TextField, CircularProgress, Alert } from "@mui/material";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const BORDER="#E8ECF2",MUTED="#9AA3B4",TEXT="#0F1623",ACCENT="#1D72E8";
const SUCCESS="#16A34A",SUCCESS_BG="#F0FDF4",SUCCESS_BR="#BBF7D0";
const WARN="#D97706",WARN_BG="#FFFBEB",WARN_BR="#FDE68A";
const DANGER="#DC2626",DANGER_BG="#FEF2F2",DANGER_BR="#FECACA";
const PURPLE="#7C3AED",PURPLE_BG="#F5F3FF",PURPLE_BR="#C4B5FD";
const ACCENT_BG="#EBF2FF",ACCENT_BR="#BFDBFE";

function Tag({ label, variant="neutral" }) {
  const s={match:{bg:SUCCESS_BG,border:SUCCESS_BR,color:SUCCESS},gap:{bg:DANGER_BG,border:DANGER_BR,color:DANGER},neutral:{bg:"#F1F3F7",border:BORDER,color:MUTED}}[variant]??{bg:"#F1F3F7",border:BORDER,color:MUTED};
  return <Box sx={{display:"inline-flex",px:1,py:0.25,bgcolor:s.bg,border:`1px solid ${s.border}`,borderRadius:"4px",fontSize:11,fontWeight:500,color:s.color,m:"2px"}}>{label}</Box>;
}

function Badge({ label, variant="neutral" }) {
  const s={accent:{bg:ACCENT_BG,border:ACCENT_BR,color:ACCENT},purple:{bg:PURPLE_BG,border:PURPLE_BR,color:PURPLE},neutral:{bg:"#F1F3F7",border:BORDER,color:MUTED}}[variant]??{bg:"#F1F3F7",border:BORDER,color:MUTED};
  return <Box sx={{display:"inline-flex",alignItems:"center",bgcolor:s.bg,border:`1px solid ${s.border}`,borderRadius:"20px",px:1.25,py:0.25,fontSize:11,fontWeight:600,color:s.color,whiteSpace:"nowrap"}}>{label}</Box>;
}

export function TalentSearchPage() {
  const nav = useNavigate();
  const loginId = localStorage.getItem("loginId")||"";
  const [query,         setQuery]         = useState("");
  const [searchedQuery, setSearchedQuery] = useState(""); // ← Change 1
  const [loading,       setLoading]       = useState(false);
  const [result,        setResult]        = useState(null);
  const [error,         setError]         = useState(null);

  const QUICK = ["Senior Java Engineer","FinTech · Series B","5+ years backend","Product Manager SaaS"];

  async function handleSearch(q) {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setLoading(true); setError(null);
    setSearchedQuery(searchQuery); // ← Change 2
    try {
      const url = new URL(`${API_BASE}/api/talent-search/query`);
      url.searchParams.set("loginId", loginId);
      const res = await fetch(url.toString(), {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ query: searchQuery, pageSize: 9 }),
      });
      if (!res.ok) throw new Error(await res.text());

      // ── Change 3: sort by keyword hits first, then matchScore ─────────────
      const data = await res.json();

      const keywords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

      const scored = (data.results ?? []).map(c => {
        const haystack = [
          c.name,
          c.currentTitle,
          c.currentCompany,
          ...(c.matchedSkills ?? []),
        ].join(" ").toLowerCase();

        const keywordHits = keywords.filter(k => haystack.includes(k)).length;
        return { ...c, _keywordHits: keywordHits };
      });

      scored.sort((a, b) => {
        // Primary: keyword hit count descending
        if (b._keywordHits !== a._keywordHits) return b._keywordHits - a._keywordHits;
        // Secondary: matchScore descending
        return (b.matchScore ?? 0) - (a.matchScore ?? 0);
      });

      setResult({ ...data, results: scored });
      // ─────────────────────────────────────────────────────────────────────

    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Box sx={{display:"flex",flexDirection:"column",gap:2}}>
      <Box sx={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <Box>
          <Box sx={{display:"flex",alignItems:"center",gap:1}}>
            <Typography sx={{fontSize:15,fontWeight:600,color:TEXT}}>AI Talent Search</Typography>
            <Box sx={{display:"inline-flex",alignItems:"center",px:"7px",py:"2px",bgcolor:PURPLE_BG,border:`1px solid ${PURPLE_BR}`,borderRadius:"4px",fontSize:10,fontWeight:600,color:PURPLE}}>NEW</Box>
          </Box>
          <Typography sx={{fontSize:11,color:MUTED,mt:0.25}}>Natural language search across your database and public profile data</Typography>
        </Box>
        <Button variant="outlined" size="small" sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>⚙ Search Settings</Button>
      </Box>

      {/* Search hero */}
      <Box sx={{background:"linear-gradient(135deg,#1B3A6B 0%,#0F1623 100%)",borderRadius:"10px",p:"28px 24px"}}>
        <Typography sx={{fontSize:11,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:".8px",mb:1.25}}>✦ AI Talent Search</Typography>
        <TextField multiline rows={2} fullWidth value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key==="Enter" && !e.shiftKey && (e.preventDefault(), handleSearch())}
          placeholder="e.g. Find me a Senior Java engineer with fintech experience who worked at a Series B startup"
          sx={{mb:1.5,"& .MuiOutlinedInput-root":{bgcolor:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"8px",fontSize:14,color:"#fff","& fieldset":{border:"none"}},"& .MuiInputBase-input::placeholder":{color:"rgba(255,255,255,0.4)"}}} />
        <Box sx={{display:"flex",gap:1.25,alignItems:"center",flexWrap:"wrap"}}>
          <Button variant="contained" onClick={() => handleSearch()} disabled={loading||!query.trim()}
            sx={{fontSize:13,py:"9px",px:"20px",bgcolor:PURPLE,borderRadius:"8px",textTransform:"none",boxShadow:"none","&:hover":{bgcolor:"#6D28D9",boxShadow:"none"}}}>
            {loading ? <CircularProgress size={16} sx={{color:"#fff"}} /> : "✦ Search Talent"}
          </Button>
          {QUICK.map(q => (
            <Box key={q} onClick={() => { setQuery(q); handleSearch(q); }}
              sx={{bgcolor:"rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)",px:"10px",py:"4px",borderRadius:"20px",fontSize:11,cursor:"pointer","&:hover":{bgcolor:"rgba(255,255,255,0.15)"}}}>
              "{q}"
            </Box>
          ))}
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {result && (
        <>
          <Box sx={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>
              {result.totalFound} candidates found{" "}
              <Box component="span" sx={{fontSize:11,color:MUTED,fontWeight:400}}>
                — ranked by keyword match, then score
              </Box>
            </Typography>
            <Box sx={{display:"flex",gap:1,alignItems:"center"}}>
              <Badge label={`● Internal DB (${result.internalCount})`} variant="accent" />
              <Badge label={`● Current Active Profile (${result.coreSignalCount})`} variant="purple" />
            </Box>
          </Box>

          <Box sx={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1.5}}>
            {result.results.map((c,i) => {
              const scoreColor = c.matchScore>=80?SUCCESS:c.matchScore>=60?WARN:DANGER;
              return (
                <Paper key={i} elevation={0} onClick={() => c.candidateId && nav(`/candidates/${c.candidateId}/workflow`)}
                  sx={{border:`1px solid ${BORDER}`,borderRadius:"10px",p:2,boxShadow:"0 1px 3px rgba(0,0,0,0.05)",
                    cursor:c.candidateId?"pointer":"default","&:hover":c.candidateId?{boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}:{},transition:"box-shadow .15s",bgcolor:"#fff"}}>
                  <Box sx={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",mb:1.25}}>
                    <Box sx={{display:"flex",gap:1.25,alignItems:"center"}}>
                      <Box sx={{width:38,height:38,borderRadius:"50%",bgcolor:ACCENT,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0}}>
                        {c.name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                      </Box>
                      <Box>
                        <Typography sx={{fontSize:13,fontWeight:600,color:TEXT}}>{c.name}</Typography>
                        <Typography sx={{fontSize:11,color:MUTED}}>{c.currentTitle}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{textAlign:"right"}}>
                      <Typography sx={{fontSize:20,fontWeight:700,color:scoreColor,lineHeight:1}}>{c.matchScore}%</Typography>
                      <Typography sx={{fontSize:10,color:MUTED}}>Match</Typography>
                    </Box>
                  </Box>
                  <Box sx={{mb:1}}>
                    {c.matchedSkills?.map(s=><Tag key={s} label={s} variant="match" />)}
                    {c.gapSkills?.slice(0,2).map(s=><Tag key={s} label={`No ${s}`} variant="gap" />)}
                  </Box>
                  <Typography sx={{fontSize:11,color:MUTED,mb:1.25}}>
                    {c.currentCompany}{c.yearsExperience ? ` · ${c.yearsExperience} yrs exp` : ""}
                    {c.source==="CORESIGNAL" && " · 🔗 Active Profiles in Market"}
                  </Typography>
                  <Box sx={{display:"flex",gap:0.75}} onClick={e => e.stopPropagation()}>
                    <Button size="small" variant="contained" onClick={() => c.candidateId && nav(`/candidates/${c.candidateId}/workflow`)}
                      sx={{flex:1,fontSize:11,bgcolor:ACCENT,borderRadius:"6px",textTransform:"none",boxShadow:"none","&:hover":{bgcolor:"#1660CC",boxShadow:"none"}}}>
                      View Profile
                    </Button>
                    <Button size="small" variant="outlined"
                      sx={{flex:1,fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>
                      + Pipeline
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => nav("/candidates/new")}
                      sx={{fontSize:11,borderColor:BORDER,color:TEXT,borderRadius:"6px",textTransform:"none"}}>
                      Analyse
                    </Button>
                  </Box>
                </Paper>
              );
            })}
          </Box>

          {result.totalFound > result.results.length && (
            <Box sx={{textAlign:"center"}}>
              <Button variant="outlined" sx={{fontSize:12,borderColor:BORDER,color:TEXT,borderRadius:"8px",textTransform:"none"}}>
                Load More Results ({result.totalFound - result.results.length} remaining)
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}

export default TalentSearchPage;
