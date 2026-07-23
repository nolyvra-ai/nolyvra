import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField, Slider, Checkbox, FormControlLabel,
  Autocomplete, Chip, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const ATS_SEEDS = [
  "Candidate database","Job posting","Pipeline/Kanban","Interview scheduling",
  "Email/SMS outreach","Reporting/analytics","Compliance/right-to-work","Reference checks",
];
const CRM_SEEDS = [
  "Employee records","Onboarding","Leave/time-off","Performance",
  "Payroll integration","Document management",
];

const ATS_TOOLS = ["Jobadder","Bullhorn","Corecruit","Atlus","Juicebox","Other"];
const CRM_TOOLS = ["Jobadder","Bullhorn","Vincere","Zoho","Other"];

// Industry-average time estimates used in the time analysis chart (hrs/week)
const TIME_TASKS = [
  { task: "Analysing CVs",        current: 6,   ideal: 1.0 },
  { task: "Finding candidates",   current: 8,   ideal: 1.5 },
  { task: "Writing emails",       current: 4,   ideal: 0.5 },
  { task: "Booking meetings",     current: 2,   ideal: 0.3 },
  { task: "Managing targets",     current: 3,   ideal: 0.5 },
];

const INIT = {
  fullName:"", companyName:"", email:"", phone:"",
  candidateToggles:{ LinkedIn:false, Seek:false, Indeed:false, Other:false },
  candidateExpenses:{ LinkedIn:0, Seek:0, Indeed:0, Other:0 },
  otherCandidateName:"",
  atsTool:"", atsExpense:0, atsFeatures:[],
  crmTool:"", crmExpense:0, crmFeatures:[],
  aiTools:[],
  usesAiAgent:null,
  aiAgentExpense:0,
  consent:false,
};

// Used by the RESULTS page's charts/tables — kept dark since that page's
// background and text stay dark navy.
const SECTION = {
  background:"rgba(255,255,255,.03)",
  border:"1px solid rgba(255,255,255,.07)",
  borderRadius:14, padding:"28px 28px 24px", marginBottom:20,
};
const SEC_TITLE = {
  fontSize:11, fontWeight:700, color:"#4a90d9", letterSpacing:"2.5px",
  textTransform:"uppercase", fontFamily:"'Space Mono',monospace", marginBottom:20,
};

// Light section boxes used only on the FORM step (About You, Candidate
// Sourcing, ATS, CRM, AI Tools, Integration Layer, Consent) — everything
// below this point is scoped exclusively to those boxes.
const SECTION_LIGHT = {
  background:"#fff",
  border:"1px solid rgba(0,0,0,.08)",
  boxShadow:"0 0 0 1px rgba(0,0,0,.04), 0 2px 5px rgba(15,22,35,.06)",
  borderRadius:10, padding:"20px 22px", marginBottom:16,
};
const LT_TEXT="#0f1623", LT_MUTED="#6b7480", LT_MUTED2="#98a1ad", LT_ERROR="#dc2626";

const LIGHT_FIELD = {
  "& .MuiInputBase-input":{ color:LT_TEXT },
  "& .MuiInputBase-root":{ bgcolor:"#f7f8fa" },
  "& .MuiOutlinedInput-notchedOutline":{ borderColor:"#dde2ea" },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline":{ borderColor:"rgba(74,144,217,.6)" },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":{ borderColor:"#4a90d9" },
  "& .MuiInputLabel-root":{ color:LT_MUTED },
  "& .MuiInputLabel-root.Mui-focused":{ color:"#4a90d9" },
  "& .MuiSvgIcon-root":{ color:LT_MUTED },
};
const LIGHT_AC = {
  ...LIGHT_FIELD,
  "& .MuiChip-root":{ bgcolor:"rgba(74,144,217,.12)", color:"#2d6fb3", border:"1px solid rgba(74,144,217,.3)" },
  "& .MuiChip-deleteIcon":{ color:"rgba(74,144,217,.6)" },
  "& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator":{ color:LT_MUTED },
};
const LISTBOX_SX_LIGHT = {
  bgcolor:"#fff",
  border:"1px solid #e5e9f0",
  "& .MuiAutocomplete-option":{ color:LT_TEXT, "&:hover":{ bgcolor:"rgba(74,144,217,.08)" } },
};
const fmtAUD = n => `$${(n||0).toLocaleString("en-AU")}`;

export default function StackAuditPage() {
  const nav = useNavigate();
  const [form, setForm]             = useState(INIT);
  const [errors, setErrors]         = useState({});
  const [loading, setLoading]       = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [report, setReport]               = useState(null);
  const [submissionId, setSubmissionId]   = useState(null);
  const [demoRequested, setDemoRequested] = useState(false);
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [pdfLoading, setPdfLoading]       = useState(false);
  const resultsRef = useRef(null);

  function setF(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => { const n={...e}; delete n[key]; return n; });
  }

  function validate() {
    const e = {};
    if (!form.fullName.trim())   e.fullName    = "Required";
    if (!form.companyName.trim())e.companyName = "Required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      e.email = "Valid work email required";
    if (!form.phone.trim()) e.phone = "Required";
    if (!Object.values(form.candidateToggles).some(Boolean))
      e.candidateToggles = "Select at least one sourcing tool";
    if (form.candidateToggles.Other && !form.otherCandidateName.trim())
      e.otherCandidateName = "Tool name required";
    if (!form.atsTool.trim())              e.atsTool    = "Required";
    if (form.atsFeatures.length === 0)     e.atsFeatures = "Select at least one feature";
    if (!form.crmTool.trim())              e.crmTool    = "Required";
    if (form.crmFeatures.length === 0)     e.crmFeatures = "Select at least one feature";
    form.aiTools.forEach((t, i) => { if (!t.name.trim()) e[`aiTool_${i}`] = "Tool name required"; });
    if (form.usesAiAgent === null) e.usesAiAgent = "Please answer yes or no";
    if (!form.consent)             e.consent    = "Consent is required to submit";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) {
      document.getElementById("sa-top")?.scrollIntoView({ behavior:"smooth" });
      return;
    }
    setLoading(true);
    setSubmitError(null);
    const candidateTools = Object.entries(form.candidateToggles)
      .filter(([,on]) => on)
      .map(([tool]) => ({
        name: tool === "Other" ? form.otherCandidateName : tool,
        expense: form.candidateExpenses[tool],
      }));
    const body = {
      fullName:form.fullName, companyName:form.companyName,
      email:form.email, phone:form.phone,
      candidateTools,
      atsTool:form.atsTool, atsExpense:form.atsExpense, atsFeatures:form.atsFeatures,
      crmTool:form.crmTool, crmExpense:form.crmExpense, crmFeatures:form.crmFeatures,
      aiTools:form.aiTools,
      usesAiAgent: form.usesAiAgent === true,
      aiAgentExpense: form.usesAiAgent === true ? form.aiAgentExpense : null,
      consent:form.consent,
    };
    try {
      const res = await fetch(`${API_BASE}/api/public/stack-audit`, {
        method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }
      const data = await res.json();
      setReport(data.report);
      setSubmissionId(data.id);
      setDemoRequested(data.demoRequested || false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
    } catch (err) {
      setSubmitError(err.message || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPdf() {
    if (!resultsRef.current) return;
    setPdfLoading(true);
    try {
      const canvas = await html2canvas(resultsRef.current, { scale:2, useCORS:true, backgroundColor:"#06091e" });
      const imgData = canvas.toDataURL("image/png");
      const pdf    = new jsPDF("p","mm","a4");
      const pageW  = pdf.internal.pageSize.getWidth();
      const pageH  = pdf.internal.pageSize.getHeight();
      const imgH   = (canvas.height * pageW) / canvas.width;
      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData,"PNG",0,-y,pageW,imgH);
        y += pageH;
      }
      pdf.save("nolyvra-stack-audit-report.pdf");
    } catch (err) {
      console.error("PDF error", err);
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleDemoRequest() {
    if (!submissionId || submissionId < 0) { setDemoDialogOpen(true); return; }
    try {
      await fetch(`${API_BASE}/api/public/stack-audit/${submissionId}/demo`, { method:"PATCH" });
      setDemoRequested(true);
    } catch (_) { /* non-critical — still show the thank-you */ }
    setDemoDialogOpen(true);
  }

  const r = report;
  const barLabels  = ["Sourcing","ATS","CRM / HR","AI & Agent"];
  const barCurrent = r ? [r.candidateSearch.currentMonthly, r.ats.currentMonthly, r.crm.currentMonthly, r.aiAndAgent.currentMonthly] : [];
  const barNolyvra = r ? [r.candidateSearch.nolyvraMonthly, r.ats.nolyvraMonthly, r.crm.nolyvraMonthly, r.aiAndAgent.nolyvraMonthly] : [];
  const pieData    = r ? [
    { id:0, value:r.candidateSearch.saving, label:"Sourcing",   color:"#4a90d9" },
    { id:1, value:r.ats.saving,             label:"ATS",        color:"#7b5cf6" },
    { id:2, value:r.crm.saving,             label:"CRM / HR",   color:"#06b6d4" },
    { id:3, value:r.aiAndAgent.saving,      label:"AI & Agent", color:"#f59e0b" },
  ].filter(d => d.value > 0) : [];

  return (
    <>
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:"#06050B", minHeight:"100vh", display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;}
        @keyframes saMesh  { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(-30px,15px) scale(1.06)} 100%{transform:translate(20px,-10px) scale(1.02)} }
        @keyframes saSweep { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        .sa-back{display:inline-flex;align-items:center;gap:8px;background:transparent;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.6);padding:8px 16px;border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;transition:all .2s;}
        .sa-back:hover{border-color:rgba(255,255,255,.35);color:#fff;}
        .sa-toggle{padding:8px 18px;border-radius:999px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid #dde2ea;background:#f7f8fa;color:#4b5563;transition:all .2s;}
        .sa-toggle.on{background:rgba(74,144,217,.12);border-color:#4a90d9;color:#2d6fb3;}
        .sa-yn{padding:9px 30px;border-radius:999px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid #dde2ea;background:#f7f8fa;color:#4b5563;transition:all .2s;}
        .sa-yn.on{background:rgba(74,144,217,.12);border-color:#4a90d9;color:#2d6fb3;}
        .sa-rm{padding:6px 14px;border-radius:999px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid rgba(220,38,38,.25);background:rgba(220,38,38,.05);color:#dc2626;transition:all .2s;}
        .sa-rm:hover{background:rgba(220,38,38,.12);color:#b91c1c;}
        .sa-add{display:inline-flex;align-items:center;gap:7px;padding:8px 18px;border-radius:999px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;border:1px dashed rgba(74,144,217,.4);background:transparent;color:#4a90d9;transition:all .2s;}
        .sa-add:hover{background:rgba(74,144,217,.08);border-style:solid;}
        .sa-submit{width:100%;padding:14px;border-radius:999px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;border:none;background:linear-gradient(135deg,#4a90d9,#2d6fb3);color:#fff;transition:all .2s;}
        .sa-submit:hover:not(:disabled){background:linear-gradient(135deg,#5aa0e9,#3d7fc3);transform:translateY(-1px);}
        .sa-submit:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .sa-pdf{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:999px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;border:1px solid rgba(74,144,217,.4);background:rgba(74,144,217,.1);color:#a8d4ff;transition:all .2s;}
        .sa-pdf:hover:not(:disabled){background:rgba(74,144,217,.2);}
        .sa-pdf:disabled{opacity:.45;cursor:not-allowed;}
        .sa-cta{padding:11px 28px;border-radius:999px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;border:none;background:linear-gradient(135deg,#4a90d9,#2d6fb3);color:#fff;transition:all .2s;}
        .sa-cta:hover{background:linear-gradient(135deg,#5aa0e9,#3d7fc3);}
        .sa-grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
        .sa-chart-scroll{overflow-x:auto;}
        @media(max-width:600px){.sa-grid2{grid-template-columns:1fr!important;}}
      `}</style>

      {/* ── Dynamic gradient background (same treatment as the landing page hero) ── */}
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:"-10%",
          background:`radial-gradient(circle at 18% 28%,rgba(99,102,241,.55) 0%,transparent 40%),
                      radial-gradient(circle at 78% 22%,rgba(6,182,212,.45) 0%,transparent 44%),
                      radial-gradient(circle at 62% 78%,rgba(139,92,246,.55) 0%,transparent 42%),
                      radial-gradient(circle at 22% 82%,rgba(244,114,182,.32) 0%,transparent 40%)`,
          filter:"blur(40px)", mixBlendMode:"screen", animation:"saMesh 22s ease-in-out infinite alternate" }} />
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(110deg,transparent 30%,rgba(255,255,255,.1) 50%,transparent 70%)", mixBlendMode:"screen", animation:"saSweep 9s ease-in-out infinite", opacity:.7 }} />
        <div style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(0deg,rgba(255,255,255,.02) 0 2px,transparent 2px 4px)", opacity:.6 }} />
        <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)`, backgroundSize:"60px 60px", WebkitMaskImage:"radial-gradient(ellipse 75% 65% at 50% 30%,#000 0%,transparent 75%)", maskImage:"radial-gradient(ellipse 75% 65% at 50% 30%,#000 0%,transparent 75%)" }} />
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 90% 70% at 50% 50%,transparent 35%,rgba(6,5,11,.85) 100%)" }} />
      </div>

      {/* ── Top bar ── */}
      <div style={{ background:"rgba(6,9,30,.7)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(255,255,255,.06)", padding:"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <img src="/nolyvra_logo.png" alt="nolyvra" style={{ width:32, height:32, borderRadius:7, objectFit:"cover" }} />
          <div style={{ lineHeight:1 }}>
            <div style={{ color:"#fff", fontSize:15, fontWeight:700, letterSpacing:"-.3px" }}>nolyvra</div>
            <div style={{ color:"rgba(255,255,255,.28)", fontSize:8, fontWeight:500, letterSpacing:"1.5px", textTransform:"uppercase", marginTop:1 }}>Intelligence. Evolved</div>
          </div>
        </div>
        <button className="sa-back" onClick={() => nav("/")}>← Back to Home</button>
      </div>

      {/* ── Content ── */}
      <div style={{ position:"relative", zIndex:1, flex:1, maxWidth:720, width:"100%", margin:"0 auto", padding:"48px 20px 80px" }}>

        {/* ════════ FORM ════════ */}
        {!report && (
          <>
            <div id="sa-top" style={{ textAlign:"center", marginBottom:40 }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(74,144,217,.1)", border:"1px solid rgba(74,144,217,.25)", borderRadius:20, padding:"5px 14px", marginBottom:14 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#4a90d9" }} />
                <span style={{ fontSize:11, fontWeight:700, color:"#4a90d9", letterSpacing:"2px", textTransform:"uppercase", fontFamily:"'Space Mono',monospace" }}>Free · No credit card</span>
              </div>
              <h1 style={{ fontSize:32, fontWeight:800, color:"#fff", marginBottom:10, letterSpacing:"-.5px" }}>Software Stack Audit</h1>
              <p style={{ fontSize:15, color:"rgba(255,255,255,.45)", lineHeight:1.65, maxWidth:500, margin:"0 auto" }}>
                Tell us what tools your agency uses and what you spend. We'll show you exactly where your software stack is leaking time and money.
              </p>
            </div>

            {/* § 1 — About you */}
            <div style={SECTION_LIGHT}>
              <CardHeader n={1} title="About You" subtitle="Your contact details" />
              <div className="sa-grid2">
                {[
                  ["fullName","Full name","text"],
                  ["companyName","Company name","text"],
                  ["email","Work email","email"],
                  ["phone","Phone number","tel"],
                ].map(([key,label,type]) => (
                  <TextField key={key} label={label} size="small" fullWidth type={type}
                    value={form[key]} onChange={e => setF(key, e.target.value)}
                    error={!!errors[key]} helperText={errors[key]}
                    sx={LIGHT_FIELD} FormHelperTextProps={{ sx:{ color:LT_ERROR } }}
                  />
                ))}
              </div>
            </div>

            {/* § 2 — Candidate sourcing */}
            <div style={SECTION_LIGHT}>
              <CardHeader n={2} title="Candidate Sourcing" subtitle="Where you find candidates" />
              {errors.candidateToggles && <div style={{ color:LT_ERROR, fontSize:12, marginBottom:12 }}>{errors.candidateToggles}</div>}
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:20 }}>
                {["LinkedIn","Seek","Indeed","Other"].map(tool => (
                  <button key={tool}
                    className={`sa-toggle${form.candidateToggles[tool]?" on":""}`}
                    onClick={() => setF("candidateToggles",{ ...form.candidateToggles, [tool]:!form.candidateToggles[tool] })}
                  >{tool}</button>
                ))}
              </div>
              {["LinkedIn","Seek","Indeed"].filter(t => form.candidateToggles[t]).map(tool => (
                <div key={tool} style={{ marginBottom:18 }}>
                  <SliderRow label={`${tool} — monthly spend`}
                    value={form.candidateExpenses[tool]}
                    onChange={v => setF("candidateExpenses",{ ...form.candidateExpenses, [tool]:v })} />
                </div>
              ))}
              {form.candidateToggles.Other && (
                <div style={{ marginBottom:4 }}>
                  <TextField label="Other tool name" size="small" fullWidth value={form.otherCandidateName}
                    onChange={e => setF("otherCandidateName", e.target.value)}
                    error={!!errors.otherCandidateName} helperText={errors.otherCandidateName}
                    sx={{ ...LIGHT_FIELD, mb:2 }} FormHelperTextProps={{ sx:{ color:LT_ERROR } }}
                  />
                  <div style={{ marginTop:14 }}>
                    <SliderRow label="Other tool — monthly spend"
                      value={form.candidateExpenses.Other}
                      onChange={v => setF("candidateExpenses",{ ...form.candidateExpenses, Other:v })} />
                  </div>
                </div>
              )}
            </div>

            {/* § 3 — ATS */}
            <div style={SECTION_LIGHT}>
              <CardHeader n={3} title="Applicant Tracking System (ATS)" subtitle="Your current ATS setup" />
              <Autocomplete
                options={ATS_TOOLS}
                value={form.atsTool || null}
                onChange={(_, v) => setF("atsTool", v || "")}
                renderInput={params => (
                  <TextField {...params} label="Current ATS tool" size="small"
                    error={!!errors.atsTool} helperText={errors.atsTool}
                    FormHelperTextProps={{ sx:{ color:LT_ERROR } }}
                  />
                )}
                sx={{ ...LIGHT_AC, mb:2.5 }} ListboxProps={{ sx:LISTBOX_SX_LIGHT }}
              />
              <SliderRow label="ATS — monthly spend" value={form.atsExpense} onChange={v => setF("atsExpense",v)} />
              <div style={{ marginTop:20 }}>
                <Autocomplete multiple freeSolo options={ATS_SEEDS} value={form.atsFeatures}
                  onChange={(_,v) => setF("atsFeatures",v)}
                  renderTags={(val,getTagProps) => val.map((opt,i) => (
                    <Chip key={opt} label={opt} size="small" {...getTagProps({ index:i })} />
                  ))}
                  renderInput={params => (
                    <TextField {...params} label="Which ATS features do you use?" size="small"
                      error={!!errors.atsFeatures}
                      helperText={errors.atsFeatures || "Pick from list or type + Enter"}
                      FormHelperTextProps={{ sx:{ color: errors.atsFeatures?LT_ERROR:LT_MUTED2 } }}
                    />
                  )}
                  sx={LIGHT_AC} ListboxProps={{ sx:LISTBOX_SX_LIGHT }}
                />
              </div>
            </div>

            {/* § 4 — CRM */}
            <div style={SECTION_LIGHT}>
              <CardHeader n={4} title="Internal HR / CRM" subtitle="Your CRM / HRIS setup" />
              <Autocomplete
                options={CRM_TOOLS}
                value={form.crmTool || null}
                onChange={(_, v) => setF("crmTool", v || "")}
                renderInput={params => (
                  <TextField {...params} label="CRM / HRM tool name" size="small"
                    error={!!errors.crmTool} helperText={errors.crmTool}
                    FormHelperTextProps={{ sx:{ color:LT_ERROR } }}
                  />
                )}
                sx={{ ...LIGHT_AC, mb:2.5 }} ListboxProps={{ sx:LISTBOX_SX_LIGHT }}
              />
              <SliderRow label="CRM — monthly spend" value={form.crmExpense} onChange={v => setF("crmExpense",v)} />
              <div style={{ marginTop:20 }}>
                <Autocomplete multiple freeSolo options={CRM_SEEDS} value={form.crmFeatures}
                  onChange={(_,v) => setF("crmFeatures",v)}
                  renderTags={(val,getTagProps) => val.map((opt,i) => (
                    <Chip key={opt} label={opt} size="small" {...getTagProps({ index:i })} />
                  ))}
                  renderInput={params => (
                    <TextField {...params} label="Which CRM features do you use?" size="small"
                      error={!!errors.crmFeatures}
                      helperText={errors.crmFeatures || "Pick from list or type + Enter"}
                      FormHelperTextProps={{ sx:{ color: errors.crmFeatures?LT_ERROR:LT_MUTED2 } }}
                    />
                  )}
                  sx={LIGHT_AC} ListboxProps={{ sx:LISTBOX_SX_LIGHT }}
                />
              </div>
            </div>

            {/* § 5 — AI tools */}
            <div style={SECTION_LIGHT}>
              <CardHeader n={5} title="AI Tools" subtitle="Standalone AI subscriptions" />
              <p style={{ fontSize:13, color:LT_MUTED, marginTop:-4, marginBottom:20 }}>
                Add any standalone AI tools your team pays for (e.g. ChatGPT Plus, Jasper, Otter.ai, Roi.ai, sapia.ai). Leave empty if none.
              </p>
              {form.aiTools.map((tool,i) => (
                <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:20 }}>
                  <div style={{ flex:1 }}>
                    <TextField label="AI tool name" size="small" fullWidth value={tool.name}
                      onChange={e => { const n=[...form.aiTools]; n[i]={...n[i],name:e.target.value}; setF("aiTools",n); }}
                      error={!!errors[`aiTool_${i}`]} helperText={errors[`aiTool_${i}`]}
                      sx={LIGHT_FIELD} FormHelperTextProps={{ sx:{ color:LT_ERROR } }}
                    />
                    <div style={{ marginTop:12 }}>
                      <SliderRow label="Monthly spend"
                        value={tool.expense}
                        onChange={v => { const n=[...form.aiTools]; n[i]={...n[i],expense:v}; setF("aiTools",n); }}
                      />
                    </div>
                  </div>
                  <button className="sa-rm" style={{ marginTop:6 }}
                    onClick={() => setF("aiTools", form.aiTools.filter((_,j)=>j!==i))}>Remove</button>
                </div>
              ))}
              <button className="sa-add"
                onClick={() => setF("aiTools",[...form.aiTools,{ name:"", expense:0 }])}>+ Add AI tool</button>
            </div>

            {/* § 6 — Integration layer */}
            <div style={SECTION_LIGHT}>
              <CardHeader n={6} title="Integration Layer" subtitle="Connecting your tools together" />
              <p style={{ fontSize:14, color:LT_TEXT, opacity:.85, marginBottom:8, lineHeight:1.55 }}>
                Are you using an AI agent or integration platform to connect these layers?
              </p>
              <p style={{ fontSize:12, color:LT_MUTED2, marginBottom:16 }}>
                e.g. Zapier, Make, n8n, a custom LLM workflow
              </p>
              <div style={{ display:"flex", gap:12, marginBottom:8 }}>
                <button className={`sa-yn${form.usesAiAgent===true?" on":""}`}
                  onClick={() => setF("usesAiAgent",true)}>Yes</button>
                <button className={`sa-yn${form.usesAiAgent===false?" on":""}`}
                  onClick={() => setF("usesAiAgent",false)}>No</button>
              </div>
              {errors.usesAiAgent && <div style={{ color:LT_ERROR, fontSize:12, marginBottom:12 }}>{errors.usesAiAgent}</div>}
              {form.usesAiAgent === true && (
                <div style={{ marginTop:18 }}>
                  <SliderRow label="AI agent / integration — monthly spend"
                    value={form.aiAgentExpense} onChange={v => setF("aiAgentExpense",v)} />
                </div>
              )}
            </div>

            {/* Consent + submit */}
            <div style={SECTION_LIGHT}>
              <FormControlLabel
                control={
                  <Checkbox checked={form.consent} onChange={e => setF("consent",e.target.checked)}
                    sx={{ color:"#c3c9d3", "&.Mui-checked":{ color:"#4a90d9" } }} />
                }
                label={
                  <span style={{ fontSize:13, color:LT_TEXT, opacity:.8, lineHeight:1.55 }}>
                    I'm happy for Nolyvra to contact me about my stack audit results.
                  </span>
                }
              />
              {errors.consent && <div style={{ color:LT_ERROR, fontSize:12, marginTop:4 }}>{errors.consent}</div>}
              <p style={{ fontSize:11, color:LT_MUTED2, marginTop:10, marginBottom:20, lineHeight:1.65 }}>
                Your data is used only to generate your audit report and for Nolyvra follow-up.{" "}
                <a href="/privacy" style={{ color:"#4a90d9", textDecoration:"none" }}>Privacy policy →</a>
              </p>
              {submitError && (
                <Alert severity="error" sx={{ mb:2, bgcolor:"rgba(239,68,68,.08)", color:"#b91c1c", border:"1px solid rgba(239,68,68,.25)", ".MuiAlert-icon":{ color:"#dc2626" } }}>
                  {submitError}
                </Alert>
              )}
              <button className="sa-submit" onClick={handleSubmit} disabled={loading}>
                {loading ? "Analysing your stack…" : "Generate My Stack Audit Report →"}
              </button>
            </div>
          </>
        )}

        {/* ════════ RESULTS ════════ */}
        {report && (
          <div ref={resultsRef}>
            {/* Headline */}
            <div style={{ textAlign:"center", marginBottom:40 }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(74,144,217,.1)", border:"1px solid rgba(74,144,217,.25)", borderRadius:20, padding:"5px 14px", marginBottom:14 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#4a90d9" }} />
                <span style={{ fontSize:11, fontWeight:700, color:"#4a90d9", letterSpacing:"2px", textTransform:"uppercase", fontFamily:"'Space Mono',monospace" }}>Illustrative Estimate</span>
              </div>
              <h1 style={{ fontSize:28, fontWeight:800, color:"#fff", marginBottom:20, letterSpacing:"-.4px" }}>Your Stack Audit Report</h1>
              <div style={{ display:"flex", justifyContent:"center", gap:16, flexWrap:"wrap" }}>
                <StatPill label="Est. monthly saving"  value={fmtAUD(r.totalMonthlySaving)}    accent="#4a90d9" />
                <StatPill label="Est. annual saving"   value={fmtAUD(r.totalAnnualisedSaving)} accent="#7b5cf6" />
                <StatPill label="% saving"             value={`~${r.savingPercent}%`}           accent="#06b6d4" />
              </div>
            </div>

            {/* Bar chart */}
            <div style={SECTION}>
              <div style={SEC_TITLE}>Current vs Nolyvra Estimate ($/mo)</div>
              <div className="sa-chart-scroll">
                <BarChart
                  xAxis={[{ scaleType:"band", data:barLabels, tickLabelStyle:{ fill:"rgba(255,255,255,.55)", fontSize:11 } }]}
                  yAxis={[{ tickLabelStyle:{ fill:"rgba(255,255,255,.4)", fontSize:10 } }]}
                  series={[
                    { data:barCurrent, label:"Current ($/mo)",      color:"#e05252" },
                    { data:barNolyvra, label:"Nolyvra est. ($/mo)", color:"#4a90d9" },
                  ]}
                  width={660} height={280}
                  slotProps={{ legend:{ labelStyle:{ fill:"rgba(255,255,255,.6)", fontSize:11 } } }}
                  sx={{
                    "& .MuiChartsAxis-line, & .MuiChartsAxis-tick":{ stroke:"rgba(255,255,255,.08)" },
                    "& .MuiChartsGrid-line":{ stroke:"rgba(255,255,255,.04)" },
                  }}
                />
              </div>
            </div>

            {/* Tool utilisation bars */}
            {r.inputs && r.inputs[0] && (() => {
              const inp = r.inputs[0];
              const REF = 10;
              const atsUsedPct = Math.min(100, Math.round((inp.atsFeatures.length / REF) * 100));
              const crmUsedPct = Math.min(100, Math.round((inp.crmFeatures.length / REF) * 100));
              return (
                <div style={SECTION}>
                  <div style={SEC_TITLE}>What You're Getting From Each Tool</div>
                  <p style={{ fontSize:13, color:"rgba(255,255,255,.38)", marginTop:-12, marginBottom:18, lineHeight:1.6 }}>
                    Each bar shows your monthly spend. <span style={{ color:"#22c55e" }}>Green</span> = features you actively use.{" "}
                    <span style={{ color:"#f59e0b" }}>Yellow</span> = paying for but not using / replaceable by Nolyvra.
                  </p>
                  {inp.candidateTools.map(t => (
                    <UtilBar key={t.name} label={`${t.name} (Sourcing)`} totalSpend={t.expense} greenPct={100}
                      note="You use this tool for active candidate sourcing." />
                  ))}
                  <UtilBar
                    label={`${inp.atsTool} (ATS)`} totalSpend={inp.atsExpense} greenPct={atsUsedPct}
                    note={`Using ${inp.atsFeatures.length} of ~${REF} typical ATS features — ${100 - atsUsedPct}% of your spend covers features you didn't select.`}
                  />
                  <UtilBar
                    label={`${inp.crmTool} (CRM / HR)`} totalSpend={inp.crmExpense} greenPct={crmUsedPct}
                    note={`Using ${inp.crmFeatures.length} of ~${REF} typical CRM features — ${100 - crmUsedPct}% of your spend covers features you didn't select.`}
                  />
                  {inp.aiTools.map(t => (
                    <UtilBar key={t.name} label={`${t.name} (AI tool)`} totalSpend={t.expense} greenPct={0}
                      note="This capability is bundled in Nolyvra — no separate subscription needed." />
                  ))}
                  {inp.usesAiAgent && inp.aiAgentExpense > 0 && (
                    <UtilBar label="AI Agent / Integration layer" totalSpend={inp.aiAgentExpense} greenPct={0}
                      note="Nolyvra is a connected platform — no integration middleware required." />
                  )}
                </div>
              );
            })()}

            {/* Donut chart */}
            {pieData.length > 0 && (
              <div style={SECTION}>
                <div style={SEC_TITLE}>Estimated Saving Breakdown</div>
                <div style={{ display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
                  {/* Donut — legend hidden; labels live in the table beside it */}
                  <div style={{ flexShrink:0 }} className="sa-chart-scroll">
                    <PieChart
                      series={[{
                        data:pieData,
                        innerRadius:55, outerRadius:100,
                        paddingAngle:3, cornerRadius:4,
                        highlightScope:{ fade:"global", highlight:"item" },
                      }]}
                      width={240} height={240}
                      slotProps={{ legend:{ hidden:true } }}
                    />
                  </div>
                  {/* Permanent side legend — always visible, renders in PDF */}
                  <div style={{ flex:1, minWidth:180 }}>
                    {pieData.map(d => {
                      const pct = r.totalMonthlySaving > 0
                        ? Math.round((d.value / r.totalMonthlySaving) * 100)
                        : 0;
                      return (
                        <div key={d.label} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                          <div style={{ width:10, height:10, borderRadius:2, background:d.color, flexShrink:0 }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:12, color:"rgba(255,255,255,.65)", fontWeight:500 }}>{d.label}</div>
                            <div style={{ fontSize:13, fontWeight:700, color:d.color, marginTop:1 }}>
                              {fmtAUD(d.value)}<span style={{ fontSize:11, fontWeight:400, color:"rgba(255,255,255,.35)", marginLeft:6 }}>/mo · {pct}% of saving</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ borderTop:"1px solid rgba(255,255,255,.07)", paddingTop:12, marginTop:4 }}>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,.35)" }}>Total est. monthly saving</div>
                      <div style={{ fontSize:16, fontWeight:800, color:"#34d399", marginTop:2 }}>{fmtAUD(r.totalMonthlySaving)}/mo</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,.35)", marginTop:2 }}>{fmtAUD(r.totalAnnualisedSaving)} / year</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Time analysis chart */}
            <div style={SECTION}>
              <div style={SEC_TITLE}>Where Your Time Goes Each Week</div>
              <p style={{ fontSize:13, color:"rgba(255,255,255,.38)", marginTop:-12, marginBottom:16, lineHeight:1.6 }}>
                Estimated weekly hours on admin tasks — current manual effort vs AI-assisted with Nolyvra.
                Based on typical recruitment agency patterns; your actuals may vary.
              </p>
              <div className="sa-chart-scroll">
                <BarChart
                  layout="horizontal"
                  yAxis={[{ scaleType:"band", data:TIME_TASKS.map(t => t.task), tickLabelStyle:{ fill:"rgba(255,255,255,.55)", fontSize:11 } }]}
                  xAxis={[{ label:"Hours / week (estimate)", tickLabelStyle:{ fill:"rgba(255,255,255,.4)", fontSize:10 }, labelStyle:{ fill:"rgba(255,255,255,.3)", fontSize:11 } }]}
                  series={[
                    { data:TIME_TASKS.map(t => t.current), label:"Current (hrs/wk)",      color:"#e05252" },
                    { data:TIME_TASKS.map(t => t.ideal),   label:"With Nolyvra (hrs/wk)", color:"#4a90d9" },
                  ]}
                  width={660} height={300}
                  slotProps={{ legend:{ labelStyle:{ fill:"rgba(255,255,255,.6)", fontSize:11 } } }}
                  sx={{
                    "& .MuiChartsAxis-line, & .MuiChartsAxis-tick":{ stroke:"rgba(255,255,255,.08)" },
                    "& .MuiChartsGrid-line":{ stroke:"rgba(255,255,255,.04)" },
                  }}
                />
              </div>
              <div style={{ display:"flex", justifyContent:"flex-end", marginTop:8 }}>
                <div style={{ background:"rgba(74,144,217,.08)", border:"1px solid rgba(74,144,217,.2)", borderRadius:8, padding:"10px 16px", fontSize:13 }}>
                  <span style={{ color:"rgba(255,255,255,.5)" }}>Est. time saved: </span>
                  <strong style={{ color:"#4a90d9" }}>
                    ~{TIME_TASKS.reduce((s,t) => s + t.current - t.ideal, 0).toFixed(0)} hrs/week
                  </strong>
                  <span style={{ color:"rgba(255,255,255,.35)", fontSize:12, marginLeft:8 }}>
                    (~{(TIME_TASKS.reduce((s,t) => s + t.current - t.ideal, 0) * 52 / 8).toFixed(0)} working days/year)
                  </span>
                </div>
              </div>
            </div>

            {/* Category breakdown table */}
            <div style={SECTION}>
              <div style={SEC_TITLE}>Category Breakdown</div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid rgba(255,255,255,.08)" }}>
                      <th style={{ padding:"10px 8px", color:"rgba(255,255,255,.38)", fontWeight:600, textAlign:"left",  fontSize:11, textTransform:"uppercase", letterSpacing:"1px" }}>Category</th>
                      <th style={{ padding:"10px 8px", color:"rgba(255,255,255,.38)", fontWeight:600, textAlign:"right", fontSize:11, textTransform:"uppercase", letterSpacing:"1px" }}>Current ($/mo)</th>
                      <th style={{ padding:"10px 8px", color:"rgba(255,255,255,.38)", fontWeight:600, textAlign:"right", fontSize:11, textTransform:"uppercase", letterSpacing:"1px" }}>Nolyvra est.</th>
                      <th style={{ padding:"10px 8px", color:"rgba(255,255,255,.38)", fontWeight:600, textAlign:"right", fontSize:11, textTransform:"uppercase", letterSpacing:"1px" }}>Est. saving</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[r.candidateSearch, r.ats, r.crm, r.aiAndAgent].map(cat => (
                      <tr key={cat.label} style={{ borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                        <td style={{ padding:"12px 8px", color:"rgba(255,255,255,.8)", fontWeight:500, verticalAlign:"top" }}>
                          {cat.label}
                          <div style={{ fontSize:11, color:"rgba(255,255,255,.28)", marginTop:3, lineHeight:1.5, fontStyle:"italic" }}>{cat.assumption}</div>
                        </td>
                        <td style={{ padding:"12px 8px", color:"rgba(255,255,255,.6)", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{fmtAUD(cat.currentMonthly)}</td>
                        <td style={{ padding:"12px 8px", color:"#4a90d9",            textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{fmtAUD(cat.nolyvraMonthly)}</td>
                        <td style={{ padding:"12px 8px", color:"#34d399",            textAlign:"right", fontVariantNumeric:"tabular-nums" }}>+{fmtAUD(cat.saving)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop:"2px solid rgba(255,255,255,.12)" }}>
                      <td style={{ padding:"14px 8px", color:"#fff", fontWeight:700 }}>Total</td>
                      <td style={{ padding:"14px 8px", color:"#fff",    textAlign:"right", fontWeight:700 }}>{fmtAUD(r.totalCurrentMonthly)}</td>
                      <td style={{ padding:"14px 8px", color:"#4a90d9", textAlign:"right", fontWeight:700 }}>{fmtAUD(r.totalNolyvraMonthly)}</td>
                      <td style={{ padding:"14px 8px", color:"#34d399", textAlign:"right", fontWeight:700 }}>+{fmtAUD(r.totalMonthlySaving)}/mo</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Narrative */}
            {r.narrative && (
              <div style={{ ...SECTION, border:"1px solid rgba(74,144,217,.2)", background:"rgba(74,144,217,.04)" }}>
                <div style={SEC_TITLE}>Our Read on Your Stack</div>
                <p style={{ fontSize:14, color:"rgba(255,255,255,.7)", lineHeight:1.8, margin:0 }}>{r.narrative}</p>
              </div>
            )}

            {/* Disclaimer */}
            <div style={{ background:"rgba(255,255,255,.02)", border:"1px solid rgba(255,255,255,.06)", borderRadius:10, padding:"16px 20px", marginBottom:24 }}>
              <p style={{ fontSize:11, color:"rgba(255,255,255,.3)", lineHeight:1.7, margin:0 }}>
                <strong style={{ color:"rgba(255,255,255,.44)" }}>Disclaimer:</strong>{" "}
                Illustrative estimate based on typical agency usage and publicly available pricing patterns.
                Your actual savings are confirmed in a personalised demo.
              </p>
            </div>

            {/* What Nolyvra replaces */}
            <div style={{ ...SECTION, border:"1px solid rgba(74,144,217,.18)", background:"rgba(74,144,217,.03)", paddingBottom:32 }}>
              <div style={SEC_TITLE}>How Nolyvra Replaces Your Stack</div>
              <p style={{ fontSize:14, color:"rgba(255,255,255,.55)", lineHeight:1.7, marginTop:-12, marginBottom:24, maxWidth:580 }}>
                Instead of paying separately for an ATS, a CRM, sourcing tools, and AI add-ons — Nolyvra
                brings them together in one connected platform built specifically for recruitment agencies.
              </p>
              <div className="sa-grid2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
                <CapabilityCard icon="🔍" title="AI Talent Search"
                  desc="Replaces LinkedIn Recruiter, Seek, and Indeed sourcing subscriptions. One unified candidate search layer with relevance scoring built in." />
                <CapabilityCard icon="📋" title="Smart ATS"
                  desc="Pipeline, kanban, job posting, CV upload and interview scheduling — only the features agencies actually use, with none of the bloat you're paying for today." />
                <CapabilityCard icon="✉️" title="AI Email Drafting"
                  desc="Context-aware candidate outreach, follow-ups, and client briefs drafted in seconds from inside the platform. No separate AI writing tool needed." />
                <CapabilityCard icon="📊" title="CV Analysis & Scoring"
                  desc="Instant candidate scoring, fraud signal detection, CV vs LinkedIn consistency check, and placement probability — built into every candidate profile." />
                <CapabilityCard icon="📅" title="Interview Scheduling"
                  desc="Auto-booking with Outlook and Google Calendar sync. Candidates get confirmation emails automatically. No back-and-forth coordination." />
                <CapabilityCard icon="🤖" title="AI Co-worker"
                  desc="Bulk candidate processing, target tracking, status summaries and recruiter briefings — all handled by an AI agent that works alongside you, not instead of you." />
              </div>
              <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:10, padding:"16px 20px", marginBottom:28 }}>
                <p style={{ fontSize:13, color:"rgba(255,255,255,.5)", lineHeight:1.7, margin:0 }}>
                  Everything above ships as a single Nolyvra subscription — no integration middleware, no separate AI tool bills,
                  no ATS bolt-ons. The tools talk to each other natively, which is where the real time saving comes from.
                </p>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#fff", marginBottom:4 }}>Ready to confirm your actual numbers?</div>
                  <div style={{ fontSize:13, color:"rgba(255,255,255,.38)" }}>A 30-min live demo shows your exact saving with real pricing.</div>
                </div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                  <button className="sa-pdf" onClick={handleDownloadPdf} disabled={pdfLoading}>
                    {pdfLoading ? "Generating…" : "⬇ Download PDF"}
                  </button>
                  <button className="sa-cta" onClick={handleDemoRequest} disabled={demoRequested}>
                    {demoRequested ? "✓ Demo Requested" : "Book Your Live Demo →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Demo request thank-you dialog */}
    <Dialog
      open={demoDialogOpen}
      onClose={() => setDemoDialogOpen(false)}
      PaperProps={{ sx:{ borderRadius:"14px", background:"#0d1230", border:"1px solid rgba(255,255,255,.1)", px:1 } }}
    >
      <DialogTitle sx={{ color:"#fff", fontWeight:700, fontSize:17, pt:3 }}>
        Thanks for your request!
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color:"rgba(255,255,255,.6)", fontSize:14, lineHeight:1.7 }}>
          Our team will reach out to you shortly to arrange your live demo.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ pb:2.5, px:3 }}>
        <Button
          onClick={() => setDemoDialogOpen(false)}
          variant="contained"
          sx={{ background:"#4a90d9", borderRadius:"8px", textTransform:"none", fontWeight:600, fontSize:13,
            "&:hover":{ background:"#3a7bc8" } }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function SliderRow({ label, value, onChange }) {
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:12, color:"#6b7480" }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:600, color:"#2d6fb3" }}>{fmtAUD(value)}/mo</span>
      </div>
      <Slider value={value} min={0} max={5000} step={50}
        onChange={(_,v) => onChange(v)}
        sx={{ color:"#4a90d9", "& .MuiSlider-thumb":{ width:16, height:16 }, "& .MuiSlider-rail":{ opacity:1, bgcolor:"#e5e9f0" } }}
      />
    </div>
  );
}

function CardHeader({ n, title, subtitle }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, paddingBottom:16, borderBottom:"1px solid rgba(0,0,0,.08)" }}>
      <div style={{
        width:40, height:40, borderRadius:"50%", flexShrink:0,
        background:"linear-gradient(135deg,#4a90d9,#2d6fb3)",
        display:"flex", alignItems:"center", justifyContent:"center",
        color:"#fff", fontSize:15, fontWeight:700,
      }}>{n}</div>
      <div>
        <div style={{ fontSize:15, fontWeight:700, color:LT_TEXT, lineHeight:1.3 }}>{title}</div>
        {subtitle && <div style={{ fontSize:12.5, color:LT_MUTED, marginTop:2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function UtilBar({ label, totalSpend, greenPct, note }) {
  const gW = Math.min(100, Math.max(0, greenPct));
  const yW = 100 - gW;
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
        <span style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,.78)" }}>{label}</span>
        <span style={{ fontSize:12, color:"rgba(255,255,255,.38)", fontFamily:"'Space Mono',monospace" }}>{fmtAUD(totalSpend)}/mo</span>
      </div>
      <div style={{ height:10, borderRadius:5, background:"rgba(255,255,255,.06)", overflow:"hidden", display:"flex" }}>
        {gW > 0 && <div style={{ width:`${gW}%`, background:"linear-gradient(90deg,#22c55e,#16a34a)", borderRadius: yW===0?"5px":"5px 0 0 5px" }} />}
        {yW > 0 && <div style={{ width:`${yW}%`, background:"linear-gradient(90deg,#f59e0b,#d97706)", borderRadius: gW===0?"5px":"0 5px 5px 0" }} />}
      </div>
      {note && <div style={{ fontSize:11, color:"rgba(255,255,255,.3)", marginTop:5, lineHeight:1.5 }}>{note}</div>}
    </div>
  );
}

function CapabilityCard({ icon, title, desc }) {
  return (
    <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.07)", borderRadius:10, padding:"16px", transition:"border-color .2s" }}>
      <div style={{ fontSize:20, marginBottom:8 }}>{icon}</div>
      <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:5 }}>{title}</div>
      <div style={{ fontSize:12, color:"rgba(255,255,255,.42)", lineHeight:1.6 }}>{desc}</div>
    </div>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div style={{ background:"rgba(255,255,255,.04)", border:`1px solid ${accent}55`, borderRadius:12, padding:"14px 22px", textAlign:"center", minWidth:140 }}>
      <div style={{ fontSize:22, fontWeight:800, color:accent, letterSpacing:"-.5px" }}>{value}</div>
      <div style={{ fontSize:11, color:"rgba(255,255,255,.38)", marginTop:4, letterSpacing:".5px" }}>{label}</div>
    </div>
  );
}
