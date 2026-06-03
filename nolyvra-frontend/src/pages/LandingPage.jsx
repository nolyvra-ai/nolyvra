import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

/* ─── Wireframe palette ──────────────────────────────────────── */
const C = {
  ink:     "#0B0A14",
  ink2:    "#1F1E2E",
  dim:     "#5B5975",
  muted:   "#9997B0",
  indigo:  "#6366F1",
  violet:  "#8B5CF6",
  cyan:    "#06B6D4",
  bgSoft:  "#F7F6FB",
  bgTint:  "#F4F2FF",
  line:    "#E8E6F3",
  line2:   "#D7D3EB",
  grad:    "linear-gradient(135deg,#6366F1 0%,#8B5CF6 55%,#06B6D4 110%)",
  gradTxt: "linear-gradient(95deg,#6366F1 0%,#8B5CF6 45%,#06B6D4 100%)",
  shadowSm:"0 1px 3px rgba(11,10,20,.05),0 1px 2px rgba(11,10,20,.04)",
  shadowMd:"0 10px 30px rgba(99,102,241,.08),0 4px 10px rgba(11,10,20,.04)",
  shadowLg:"0 30px 80px -20px rgba(99,102,241,.25),0 18px 40px rgba(11,10,20,.08)",
};

/* ─── Animated banner data ───────────────────────────────────── */
const CHIP_POOL = [
  { av:"PS", avBg:"linear-gradient(135deg,#6366F1,#8B5CF6)", ttl:"Priya Sharma",         sub:"92% match · verified",      badge:"MATCH",  bc:"green"  },
  { av:"JO", avBg:"linear-gradient(135deg,#06B6D4,#6366F1)", ttl:"James Okafor",         sub:"CV ↔ LinkedIn diff",         badge:"REVIEW", bc:"amber"  },
  { av:"LF", avBg:"linear-gradient(135deg,#F472B6,#8B5CF6)", ttl:"Offer drafted",        sub:"Sr. Backend · $92k",        badge:"SENT",   bc:"cyan"   },
  { av:"AN", avBg:"linear-gradient(135deg,#10B981,#06B6D4)", ttl:"Ada Nwosu",            sub:"0.79 fit · PM",             badge:"MATCH",  bc:"green"  },
  { av:"◈",  avBg:"linear-gradient(135deg,#8B5CF6,#6366F1)", ttl:"Triaging 9 candidates",sub:"step 3/4 · scoring fit",   badge:"AGENT",  bc:"violet" },
  { av:"○",  avBg:"linear-gradient(135deg,#F472B6,#DB2777)", ttl:"3 interviews scheduled",sub:"Tue–Thu · confirmed",      badge:"AGENT",  bc:"violet" },
  { av:"▲",  avBg:"linear-gradient(135deg,#06B6D4,#0891B2)", ttl:"12 of 12 verified",    sub:"LinkedIn · CV · refs",      badge:"VERIFY", bc:"cyan"   },
  { av:"MA", avBg:"linear-gradient(135deg,#6366F1,#06B6D4)", ttl:"Maren Aalto",          sub:"reply drafted · ready",     badge:"DRAFT",  bc:"amber"  },
];
const BADGE_CLR = {
  green:  { bg:"rgba(16,185,129,.18)", color:"#34D399" },
  violet: { bg:"rgba(139,92,246,.22)", color:"#C4B5FD" },
  cyan:   { bg:"rgba(6,182,212,.18)",  color:"#67E8F9" },
  amber:  { bg:"rgba(245,158,11,.20)", color:"#FCD34D" },
};
const WORDS = ["Source faster.", "Match smarter.", "Verify instantly.", "Place better."];
const TESTIMONIALS = [
  { av:"ND", avBg:"linear-gradient(135deg,#6366F1,#8B5CF6)", quote:"This tool really provides valuable suggestions in AI analysis and balance with human communications.", author:"National Director", role:"Recruitment Agency · NSW" },
  { av:"RE", avBg:"linear-gradient(135deg,#06B6D4,#6366F1)", quote:"This is exactly where hiring is heading — we need something like this.", author:"Recruitment Executive", role:"Melbourne" },
  { av:"TR", avBg:"linear-gradient(135deg,#10B981,#06B6D4)", quote:"It helps me ask better questions and validate candidates more confidently.", author:"Tech Recruiter", role:"Queensland" },
  { av:"TR", avBg:"linear-gradient(135deg,#F472B6,#8B5CF6)", quote:"Promising product with exciting possibilities ahead.", author:"Tech Recruiter", role:"Startup · Melbourne" },
  { av:"TP", avBg:"linear-gradient(135deg,#8B5CF6,#6366F1)", quote:"Strong potential recognised particularly in high-volume hiring environments.", author:"Talent Partner", role:"Melbourne" },
];
function pickChip(ex) { let c; do { c = CHIP_POOL[Math.floor(Math.random()*CHIP_POOL.length)]; } while(c.ttl===ex); return c; }

/* ─── Dashboard animation hook ──────────────────────────────── */
function useDashAnim() {
  const [rows, setRows]         = useState([false,false,false,false]);
  const [bars, setBars]         = useState([0,0,0,0]);
  const [metrics, setMetrics]   = useState([false,false,false,false]);
  const [greet, setGreet]       = useState(false);
  const [toasts, setToasts]     = useState({ verify:false, match:false, agent:false, offer:false });
  const [aiVal, setAiVal]       = useState(27);
  const [candVal, setCandVal]   = useState(9);
  const barTargets = [92, 68, 84, 79];

  useEffect(() => {
    let alive = true;
    const delay = ms => new Promise(r => setTimeout(r, ms));

    async function cycle() {
      while (alive) {
        /* reset */
        setGreet(false);
        setMetrics([false,false,false,false]);
        setRows([false,false,false,false]);
        setBars([0,0,0,0]);
        setToasts({ verify:false, match:false, agent:false, offer:false });
        setAiVal(27); setCandVal(9);
        await delay(300);

        /* greeting */
        setGreet(true);
        await delay(300);

        /* metric cards stagger */
        for (let i = 0; i < 4; i++) {
          await delay(100);
          setMetrics(p => { const n=[...p]; n[i]=true; return n; });
        }
        await delay(300);

        /* rows + bars stagger */
        for (let i = 0; i < 4; i++) {
          await delay(160);
          setRows(p => { const n=[...p]; n[i]=true; return n; });
          await delay(200);
          setBars(p => { const n=[...p]; n[i]=barTargets[i]; return n; });
        }
        await delay(700);

        /* toasts */
        setToasts(p => ({ ...p, verify:true }));
        await delay(500);
        setToasts(p => ({ ...p, match:true }));
        await delay(600);
        setToasts(p => ({ ...p, agent:true }));
        await delay(500);
        setToasts(p => ({ ...p, offer:true }));
        await delay(1000);

        /* counters tick */
        for (let v = 28; v <= 31; v++) { await delay(120); setAiVal(v); }
        await delay(400);
        for (let v = 10; v <= 11; v++) { await delay(200); setCandVal(v); }

        await delay(2800);
      }
    }
    cycle();
    return () => { alive = false; };
  }, []);

  return { rows, bars, metrics, greet, toasts, aiVal, candVal };
}

/* ─── Verify animation hook ─────────────────────────────────── */
function useVerifyAnim() {
  const [rowVis,  setRowVis]  = useState([false,false,false,false]);
  const [badgeVis,setBadgeVis]= useState([false,false,false,false]);

  useEffect(() => {
    let alive = true;
    const delay = ms => new Promise(r => setTimeout(r, ms));
    async function cycle() {
      while (alive) {
        setRowVis([false,false,false,false]);
        setBadgeVis([false,false,false,false]);
        await delay(400);
        for (let i = 0; i < 4; i++) {
          await delay(i === 0 ? 0 : 380);
          setRowVis(p  => { const n=[...p]; n[i]=true;  return n; });
          await delay(300);
          setBadgeVis(p => { const n=[...p]; n[i]=true; return n; });
        }
        await delay(2400);
      }
    }
    cycle();
    return () => { alive = false; };
  }, []);

  return { rowVis, badgeVis };
}

/* ─── Co-worker animation hook ───────────────────────────────── */
function useAgentAnim() {
  const [activeStep, setActiveStep] = useState(-1);
  const [doneSteps,  setDoneSteps]  = useState([]);

  useEffect(() => {
    let alive = true;
    const delay = ms => new Promise(r => setTimeout(r, ms));
    async function cycle() {
      while (alive) {
        setActiveStep(-1); setDoneSteps([]);
        await delay(500);
        for (let i = 0; i < 4; i++) {
          setActiveStep(i);
          await delay(1100);
          setDoneSteps(p => [...p, i]);
        }
        setActiveStep(-1);
        await delay(2200);
      }
    }
    cycle();
    return () => { alive = false; };
  }, []);

  return { activeStep, doneSteps };
}

/* ─── Sub-components ─────────────────────────────────────────── */
function FloatChip({ data, visible, style }) {
  const bc = BADGE_CLR[data.bc] || BADGE_CLR.green;
  return (
    <div style={{ position:"absolute", zIndex:8, pointerEvents:"none",
      background:"rgba(20,18,32,.80)", backdropFilter:"blur(18px)", WebkitBackdropFilter:"blur(18px)",
      border:"1px solid rgba(255,255,255,.10)", borderRadius:14, padding:"12px 14px",
      boxShadow:"0 20px 50px -10px rgba(0,0,0,.5),0 0 0 1px rgba(99,102,241,.10) inset",
      whiteSpace:"nowrap", opacity:visible?1:0,
      transform:visible?"translateY(0) scale(1)":"translateY(8px) scale(.96)",
      transition:"opacity .45s ease,transform .45s cubic-bezier(.2,.7,.2,1)", ...style }}>
      <div style={{ display:"flex", alignItems:"center", gap:10,
        animation:visible?"nlFloat 3.2s ease-in-out infinite":"none" }}>
        <div style={{ width:30, height:30, borderRadius:8, background:data.avBg,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontWeight:600, fontSize:11, color:"#fff", flexShrink:0 }}>{data.av}</div>
        <div>
          <div style={{ fontWeight:600, fontSize:12.5, color:"#fff", letterSpacing:"-.1px" }}>{data.ttl}</div>
          <div style={{ fontSize:10.5, color:"rgba(255,255,255,.55)", marginTop:1, fontFamily:"'DM Mono',monospace" }}>{data.sub}</div>
        </div>
        <span style={{ fontSize:9.5, fontWeight:700, padding:"2px 7px", borderRadius:5, letterSpacing:".3px",
          background:bc.bg, color:bc.color }}>{data.badge}</span>
      </div>
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:8, fontFamily:"'DM Mono',monospace",
      fontSize:11, letterSpacing:"1.5px", color:C.indigo, textTransform:"uppercase", marginBottom:18 }}>
      <span style={{ display:"inline-block", width:18, height:1, background:C.indigo, opacity:.6 }} />
      {children}
    </div>
  );
}

function GradItalic({ children }) {
  return (
    <em style={{ fontStyle:"italic", fontWeight:400, background:C.gradTxt,
      WebkitBackgroundClip:"text", backgroundClip:"text", WebkitTextFillColor:"transparent" }}>
      {children}
    </em>
  );
}

function FTag({ children }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:6, fontFamily:"'DM Mono',monospace",
      fontSize:10.5, letterSpacing:".8px", color:C.indigo, textTransform:"uppercase", marginBottom:14 }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:C.indigo,
        boxShadow:"0 0 12px rgba(99,102,241,.5)", display:"inline-block" }} />
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const nav = useNavigate();

  /* form / modal state */
  const [modalOpen,  setModalOpen]  = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState("");
  const [form, setForm] = useState({ firstName:"", lastName:"", company:"", email:"", phone:"" });
  const COUNTRIES = [
    { flag:"🇦🇺", code:"+61" }, { flag:"🇬🇧", code:"+44" }, { flag:"🇺🇸", code:"+1" },
    { flag:"🇮🇳", code:"+91" }, { flag:"🇳🇿", code:"+64" }, { flag:"🇸🇬", code:"+65" },
  ];
  const [selCountry, setSelCountry] = useState(COUNTRIES[0]);

  /* hero animation */
  const [wordIdx,  setWordIdx]  = useState(0);
  const [chipA,    setChipA]    = useState(CHIP_POOL[0]);
  const [chipB,    setChipB]    = useState(CHIP_POOL[3]);
  const [chipAVis, setChipAVis] = useState(false);
  const [chipBVis, setChipBVis] = useState(false);
  const dashRef   = useRef(null);
  const [dashPad, setDashPad] = useState(20);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  /* animated section hooks */
  const dash   = useDashAnim();
  const verify = useVerifyAnim();
  const agent  = useAgentAnim();

  function fmtPhone(r) {
    const d=r.replace(/\D/g,"");
    if(d.length<=4)return d;
    if(d.length<=7)return `${d.slice(0,4)} ${d.slice(4)}`;
    return `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7,10)}`;
  }
  function setField(k,v){ setForm(p=>({...p,[k]:v})); }

  async function handleRegister() {
    if(!form.firstName.trim()||!form.email.trim()){ setFormError("First name and email are required."); return; }
    setSubmitting(true); setFormError("");
    try {
      const res=await fetch(`${API_BASE}/api/auth/register`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form, phone:form.phone?`${selCountry.code} ${form.phone}`:""}),
      });
      const data=await res.json();
      if(!res.ok){ setFormError(data.error||"Registration failed."); return; }
      setSubmitted(true);
    } catch { setFormError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  }

  function openModal(){
    setSubmitted(false); setFormError("");
    setForm({firstName:"",lastName:"",company:"",email:"",phone:""});
    setModalOpen(true);
  }

  useEffect(()=>{
    let chipBInner=null;
    const t1=setTimeout(()=>setChipAVis(true),200);
    const t2=setTimeout(()=>setChipBVis(true),1600);
    const wt=setInterval(()=>setWordIdx(i=>(i+1)%WORDS.length),3000);
    const at=setInterval(()=>{ setChipAVis(false); setTimeout(()=>{ setChipA(p=>pickChip(p.ttl)); setChipAVis(true); },550); },2800);
    const bo=setTimeout(()=>{ chipBInner=setInterval(()=>{ setChipBVis(false); setTimeout(()=>{ setChipB(p=>pickChip(p.ttl)); setChipBVis(true); },550); },2800); },1400);
    const tTimer=setInterval(()=>setTestimonialIdx(i=>(i+1)%TESTIMONIALS.length),5000);
    const handleScroll=()=>{
      if(!dashRef.current)return;
      const rect=dashRef.current.getBoundingClientRect();
      const winH=window.innerHeight;
      const progress=Math.max(0,Math.min(1,(winH-rect.top)/(winH*0.65)));
      setDashPad(Math.max(0,20*(1-progress)));
    };
    window.addEventListener("scroll",handleScroll,{passive:true});
    handleScroll();
    return()=>{ clearTimeout(t1);clearTimeout(t2);clearInterval(wt);clearInterval(at);clearTimeout(bo);if(chipBInner)clearInterval(chipBInner);clearInterval(tTimer);window.removeEventListener("scroll",handleScroll); };
  },[]);

  /* ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", color:C.ink, background:"#fff", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&family=DM+Mono:wght@400;500&display=swap');
        html{scroll-behavior:smooth} *{box-sizing:border-box;margin:0;padding:0} body{overflow-x:hidden}

        @keyframes nlMesh  { 0%{transform:translate(0,0) scale(1)} 50%{transform:translate(-30px,15px) scale(1.06)} 100%{transform:translate(20px,-10px) scale(1.02)} }
        @keyframes nlSweep { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes nlFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes nlWord  { 0%{transform:translateY(100%);opacity:0} 12%,82%{transform:translateY(0);opacity:1} 100%{transform:translateY(-100%);opacity:0} }
        @keyframes nlUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes nlSpark { 0%,100%{transform:scale(1) rotate(0)} 50%{transform:scale(.6) rotate(45deg)} }
        @keyframes nlBlink { 50%{opacity:0} }
        @keyframes nlPulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes nlMarq  { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes modalIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes nlTestIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dashRowIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes dashMetIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastIn  { from{opacity:0;transform:translateY(-5px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes verRowIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes agentPulse { 0%,100%{opacity:.5} 50%{opacity:1} }

        .lp-nav-link{color:rgba(255,255,255,.5);font-size:13px;font-weight:500;text-decoration:none;transition:color .15s}
        .lp-nav-link:hover{color:#fff}
        .nl-spark{display:inline-block;width:12px;height:12px;position:relative;vertical-align:middle;margin-right:6px}
        .nl-spark::before,.nl-spark::after{content:'';position:absolute;background:#8B5CF6;border-radius:1px;animation:nlSpark 2.2s ease-in-out infinite}
        .nl-spark::before{width:2px;height:12px;left:50%;top:0;transform:translateX(-50%);box-shadow:0 0 10px #8B5CF6}
        .nl-spark::after{width:12px;height:2px;left:0;top:50%;transform:translateY(-50%);box-shadow:0 0 10px #8B5CF6}
        .nl-feature{background:#fff;border:1px solid #E8E6F3;border-radius:18px;padding:28px;overflow:hidden;min-height:280px;transition:transform .35s,border-color .35s,box-shadow .35s;position:relative}
        .nl-feature:hover{transform:translateY(-3px);border-color:rgba(99,102,241,.4);box-shadow:0 10px 30px rgba(99,102,241,.08),0 4px 10px rgba(11,10,20,.04)}
        .nl-sc-float{position:absolute;z-index:6;background:#fff;border:1px solid #E8E6F3;border-radius:14px;padding:13px 15px;box-shadow:0 10px 30px rgba(99,102,241,.08);min-width:180px}
        .nl-flow-step{position:relative;background:#fff;border:1px solid #E8E6F3;border-radius:16px;padding:30px 26px 26px;overflow:hidden;box-shadow:0 1px 3px rgba(11,10,20,.05)}
        .nl-flow-step::before{content:attr(data-n);position:absolute;top:12px;right:18px;font-family:'DM Mono',monospace;font-size:52px;font-weight:600;letter-spacing:-2px;color:transparent;-webkit-text-stroke:1px rgba(99,102,241,.28);opacity:.85}
        .nl-int-chip{display:flex;align-items:center;gap:10px;background:#F7F6FB;border:1px solid #E8E6F3;border-radius:40px;padding:10px 22px;margin:0 12px;white-space:nowrap;font-size:14px;font-weight:600;color:#1F1E2E;transition:border-color .2s,box-shadow .2s}
        .nl-int-chip:hover{border-color:#6366F1;box-shadow:0 0 0 3px rgba(99,102,241,.08)}
        .nl-marq{display:flex;width:max-content;animation:nlMarq 28s linear infinite}
        .nl-marq:hover{animation-play-state:paused}
        .modal-overlay{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center}
        .modal-box{background:#fff;border-radius:16px;padding:40px;width:100%;max-width:460px;position:relative;box-shadow:0 24px 64px rgba(0,0,0,.3);animation:modalIn .2s ease}
        .form-input{width:100%;padding:10px 13px;border:1px solid #E2E6ED;border-radius:8px;font-size:13px;font-family:inherit;color:#0F1623;background:#F7F8FA;outline:none;transition:border-color .15s}
        .form-input:focus{border-color:#6366F1;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
        .dash-toast{position:absolute;z-index:10;background:#fff;border:1px solid #E8E6F3;border-radius:12px;padding:12px 15px;box-shadow:0 10px 30px rgba(99,102,241,.10);min-width:175px;pointer-events:none}
        .dash-toast.vis{animation:toastIn .45s cubic-bezier(.2,.8,.2,1) both}

        @media(max-width:900px){
          .nl-chips,.nl-sc-float{display:none!important}
          .nl-hero h1{font-size:42px!important;letter-spacing:-1.5px!important}
          .nl-rotator{min-width:240px!important}
          .nl-feat-grid{grid-template-columns:1fr!important}
          .nl-feat-grid>.nl-feature{grid-column:span 1!important}
          .nl-flow-grid{grid-template-columns:1fr!important}
          .nl-stats{grid-template-columns:1fr 1fr!important}
          .nl-mock{grid-template-columns:1fr!important}
          .nl-mock-sb{display:none!important}
          .nl-section{padding:72px 22px!important}
        }
        @media(max-width:768px){
          .lp-nav-links{display:none!important}
          .lp-nav{padding:0 16px!important}
          .nl-hero{padding-left:20px!important;padding-right:20px!important}
          .lp-footer{flex-direction:column!important;gap:20px!important;text-align:center!important;padding:32px 20px!important;align-items:center!important}
          .modal-box{padding:24px 20px!important;margin:16px!important;max-width:calc(100vw - 32px)!important}
          .modal-name-row{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* ══════════════ NAV ══════════════ */}
      <nav className="lp-nav" style={{ position:"fixed",top:0,left:0,right:0,zIndex:100,
        background:"rgba(6,5,11,.92)",backdropFilter:"blur(14px)",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 48px",height:64,borderBottom:"1px solid rgba(255,255,255,.07)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <img src="/nolyvra_logo.png" alt="nolyvra" style={{ width:32,height:32,borderRadius:9,objectFit:"cover",boxShadow:"0 4px 14px rgba(99,102,241,.35)" }} />
          <div style={{ lineHeight:1 }}>
            <div style={{ color:"#fff",fontSize:16,fontWeight:600,letterSpacing:"-.4px" }}>nolyvra</div>
            <div style={{ color:"rgba(255,255,255,.28)",fontSize:9,fontWeight:500,letterSpacing:"1.5px",textTransform:"uppercase",marginTop:2 }}>TALENT RUNS DEEP</div>
          </div>
        </div>
        <div className="lp-nav-links" style={{ display:"flex",gap:30 }}>
          {[["Features","#features"],["How It Works","#how"],["Results","#stats"],["Social Proof","#social"],["Watch Demo","#video"]].map(([l,h])=>(
            <a key={l} href={h} className="lp-nav-link">{l}</a>
          ))}
          <button onClick={()=>nav("/ai-in-recruitment")} className="lp-nav-link"
            style={{ background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit",fontSize:13,fontWeight:500,lineHeight:"normal",display:"inline-flex",alignItems:"center" }}>
            AI in Recruitment
          </button>
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <button onClick={()=>nav("/login")} style={{ padding:"7px 16px",borderRadius:999,fontSize:13,fontWeight:500,border:"1px solid rgba(255,255,255,.18)",color:"rgba(255,255,255,.8)",background:"transparent",cursor:"pointer",fontFamily:"inherit",transition:"all .15s" }}>Login</button>
          <button onClick={openModal} style={{ padding:"7px 18px",borderRadius:999,fontSize:13,fontWeight:600,background:"#fff",color:C.ink,border:"none",cursor:"pointer",fontFamily:"inherit" }}>Register Interest</button>
        </div>
      </nav>

      {/* ══════════════ DARK ZONE HERO ══════════════ */}
      <div style={{ position:"relative",background:"#06050B",color:"#fff",overflow:"hidden",borderRadius:"0 0 40px 40px",paddingTop:64 }}>
        {/* bg layers */}
        <div style={{ position:"absolute",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden" }}>
          <div style={{ position:"absolute",inset:"-10%",
            background:`radial-gradient(circle at 18% 28%,rgba(99,102,241,.55) 0%,transparent 40%),
                        radial-gradient(circle at 78% 22%,rgba(6,182,212,.45) 0%,transparent 44%),
                        radial-gradient(circle at 62% 78%,rgba(139,92,246,.55) 0%,transparent 42%),
                        radial-gradient(circle at 22% 82%,rgba(244,114,182,.32) 0%,transparent 40%)`,
            filter:"blur(40px)",mixBlendMode:"screen",animation:"nlMesh 22s ease-in-out infinite alternate" }} />
          <div style={{ position:"absolute",inset:0,background:"linear-gradient(110deg,transparent 30%,rgba(255,255,255,.1) 50%,transparent 70%)",mixBlendMode:"screen",animation:"nlSweep 9s ease-in-out infinite",opacity:.7 }} />
          <div style={{ position:"absolute",inset:0,background:"repeating-linear-gradient(0deg,rgba(255,255,255,.02) 0 2px,transparent 2px 4px)",opacity:.6 }} />
          <div style={{ position:"absolute",inset:0,backgroundImage:`linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)`,backgroundSize:"60px 60px",WebkitMaskImage:"radial-gradient(ellipse 75% 65% at 50% 30%,#000 0%,transparent 75%)",maskImage:"radial-gradient(ellipse 75% 65% at 50% 30%,#000 0%,transparent 75%)" }} />
          <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 90% 70% at 50% 50%,transparent 35%,rgba(6,5,11,.85) 100%)" }} />
        </div>

        <div className="nl-hero" style={{ position:"relative",zIndex:10,maxWidth:1440,margin:"0 auto",padding:"60px 56px 100px",minHeight:720,display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",overflow:"visible" }}>
          <div className="nl-chips"><FloatChip data={chipA} visible={chipAVis} style={{ bottom:60,left:"10%" }} /></div>
          <div className="nl-chips"><FloatChip data={chipB} visible={chipBVis} style={{ bottom:60,right:"10%" }} /></div>

          <div style={{ position:"relative",zIndex:10,maxWidth:880,width:"100%" }}>
            <a href="#features" style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"6px 14px 6px 6px",borderRadius:999,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",fontSize:12.5,color:"rgba(255,255,255,.78)",textDecoration:"none",marginBottom:30,animation:"nlUp .9s ease both" }}>
              <span style={{ background:C.grad,color:"#fff",fontSize:10.5,fontWeight:700,padding:"3px 9px",borderRadius:999,letterSpacing:".3px" }}>NEW</span>
              AI-powered recruitment co-worker &nbsp;<span style={{ fontSize:11,color:"rgba(255,255,255,.5)" }}>→</span>
            </a>

            <h1 style={{ fontSize:80,fontWeight:600,letterSpacing:"-3px",lineHeight:1.02,marginBottom:26,color:"#fff",animation:"nlUp 1.1s .1s ease both" }}>
              <span style={{ display:"block" }}>The smartest way to</span>
              <span className="nl-rotator" style={{ display:"inline-block",position:"relative",height:"1em",verticalAlign:"top",overflow:"hidden",minWidth:520,textAlign:"left" }}>
                <span key={wordIdx} style={{ display:"block",animation:"nlWord 3s ease-in-out forwards",background:C.gradTxt,WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent",color:"transparent",fontStyle:"italic",fontWeight:500 }}>
                  {WORDS[wordIdx]}
                </span>
              </span>
            </h1>

            <p style={{ fontSize:18.5,lineHeight:1.55,color:"rgba(255,255,255,.68)",maxWidth:620,margin:"0 auto 36px",animation:"nlUp 1.1s .25s ease both" }}>
              Stop stitching together CV parsers, ATS plugins and inbox tools. nolyvra verifies, matches, schedules and drafts — so you can focus on people.
            </p>

            <div style={{ display:"flex",gap:12,justifyContent:"center",alignItems:"center",flexWrap:"wrap",animation:"nlUp 1.1s .4s ease both",marginBottom:52 }}>
              <button onClick={openModal} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"13px 22px",borderRadius:999,fontSize:14,fontWeight:500,fontFamily:"inherit",border:"none",cursor:"pointer",background:"#fff",color:C.ink,boxShadow:"0 8px 22px rgba(255,255,255,.15)",transition:"all .2s" }}>
                <span className="nl-spark" /> Start free · no credit card
              </button>
              <button onClick={()=>nav("/login")} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"13px 22px",borderRadius:999,fontSize:14,fontWeight:500,fontFamily:"inherit",cursor:"pointer",background:"rgba(255,255,255,.06)",color:"#fff",border:"1px solid rgba(255,255,255,.16)",transition:"all .2s" }}>
                Login to Platform →
              </button>
            </div>

            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",animation:"nlUp 1.1s .6s ease both" }}>
              <div style={{ fontSize:13.5,color:"rgba(255,255,255,.5)",lineHeight:1.6,textAlign:"center" }}>Trusted by recruitment teams across&nbsp;<span style={{ color:"rgba(255,255,255,.82)",fontWeight:600 }}>Australia</span>&nbsp;and globally.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ SHOWCASE ══════════════ */}
      <section className="nl-section" id="showcase" style={{ position:"relative",maxWidth:1280,margin:"0 auto",padding:"72px 56px 32px" }}>
        <Eyebrow>The product</Eyebrow>
        <h2 style={{ fontSize:54,fontWeight:600,letterSpacing:"-1.8px",lineHeight:1.08,marginBottom:20,maxWidth:780,color:C.ink }}>
          One workspace for <GradItalic>candidates, verification &amp; agents.</GradItalic>
        </h2>
        <p style={{ fontSize:17,lineHeight:1.6,color:C.dim,maxWidth:620 }}>
          Every CV is parsed, cross-checked and ranked against the live job. Your AI co-worker keeps the pipeline moving while you stay in the driver's seat.
        </p>
      </section>

      {/* ══════════════ DASHBOARD PREVIEW — animated, scroll-expand preserved ══════════════ */}
      <div ref={dashRef} style={{ maxWidth:1280,margin:"0 auto",padding:"20px 56px 60px" }}>
        <div style={{ padding:`0 ${dashPad}%`,transition:"padding .3s ease-out",position:"relative" }}>

          {/* Floating callout cards */}
          <div className={`nl-sc-float dash-toast${dash.toasts.verify ? " vis" : ""}`} style={{ top:-40,left:-30, ...(dash.toasts.verify ? {} : { opacity:0, pointerEvents:"none" }) }}>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".6px",color:C.indigo,textTransform:"uppercase",marginBottom:6,display:"flex",alignItems:"center",gap:5 }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:C.indigo,display:"inline-block",animation:"agentPulse 1.8s infinite" }} />
              Verify
            </div>
            <div style={{ fontSize:13,fontWeight:600,color:C.ink }}>12 of 12 claims checked</div>
            <div style={{ fontSize:11,color:C.muted,marginTop:4,fontFamily:"'DM Mono',monospace" }}>LinkedIn ↔ CV ↔ refs</div>
          </div>

          <div className={`nl-sc-float dash-toast${dash.toasts.match ? " vis" : ""}`} style={{ top:60,right:-50, ...(dash.toasts.match ? {} : { opacity:0, pointerEvents:"none" }) }}>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".6px",color:C.indigo,textTransform:"uppercase",marginBottom:6 }}>△ Match score</div>
            <div style={{ fontSize:13,fontWeight:600,color:C.ink }}>0.92 · strong fit</div>
            <div style={{ fontSize:11,color:C.muted,marginTop:4,fontFamily:"'DM Mono',monospace" }}>Sr. Backend Engineer</div>
          </div>

          <div className={`nl-sc-float dash-toast${dash.toasts.agent ? " vis" : ""}`} style={{ bottom:80,left:-60, ...(dash.toasts.agent ? {} : { opacity:0, pointerEvents:"none" }) }}>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".6px",color:"#059669",textTransform:"uppercase",marginBottom:6,display:"flex",alignItems:"center",gap:5 }}>
              <span style={{ width:6,height:6,borderRadius:"50%",background:"#059669",display:"inline-block",animation:"agentPulse 1.8s infinite" }} />
              Agent
            </div>
            <div style={{ fontSize:13,fontWeight:600,color:C.ink }}>Scheduled 3 interviews</div>
            <div style={{ fontSize:11,color:C.muted,marginTop:4,fontFamily:"'DM Mono',monospace" }}>Tue–Thu · confirmed</div>
          </div>

          <div className={`nl-sc-float dash-toast${dash.toasts.offer ? " vis" : ""}`} style={{ bottom:-30,right:-20, ...(dash.toasts.offer ? {} : { opacity:0, pointerEvents:"none" }) }}>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:".6px",color:C.indigo,textTransform:"uppercase",marginBottom:6 }}>▼ Offer</div>
            <div style={{ fontSize:13,fontWeight:600,color:C.ink }}>Draft ready for review</div>
            <div style={{ fontSize:11,color:C.muted,marginTop:4,fontFamily:"'DM Mono',monospace" }}>$92k · 16 Apr start</div>
          </div>

          {/* Main dashboard card */}
          <div style={{ borderRadius:18,background:"linear-gradient(180deg,rgba(99,102,241,.25),rgba(139,92,246,.1) 30%,rgba(11,10,20,.06))",padding:1.5,boxShadow:C.shadowLg }}>
            <div style={{ background:"#fff",borderRadius:17,overflow:"hidden",border:`1px solid ${C.line}` }}>
              {/* Browser chrome */}
              <div style={{ display:"flex",alignItems:"center",gap:7,padding:"11px 16px",borderBottom:`1px solid ${C.line}`,background:C.bgSoft }}>
                {["#FF5F57","#FEBC2E","#28C840"].map(bg=><span key={bg} style={{ width:10,height:10,borderRadius:"50%",background:bg,display:"inline-block" }} />)}
                <div style={{ marginLeft:18,flex:1,background:"#fff",border:`1px solid ${C.line}`,padding:"5px 12px",borderRadius:6,fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace" }}>
                  <b style={{ color:C.ink2,fontWeight:500 }}>app.nolyvra.com</b>/dashboard
                </div>
              </div>

              <div className="nl-mock" style={{ display:"grid",gridTemplateColumns:"200px 1fr",minHeight:520 }}>
                {/* Sidebar */}
                <aside className="nl-mock-sb" style={{ background:"#0B0A14",borderRight:`1px solid ${C.line}`,padding:"18px 12px",display:"flex",flexDirection:"column",gap:2,fontSize:12 }}>
                  {[
                    {type:"group",label:"Workspace"},
                    {type:"item", label:"Dashboard",   active:true},
                    {type:"item", label:"Co-worker",   badge:"AI"},
                    {type:"group",label:"Candidates"},
                    {type:"item", label:"All",          badge:"9"},
                    {type:"item", label:"Verify queue"},
                    {type:"item", label:"Analysis"},
                    {type:"group",label:"Hiring"},
                    {type:"item", label:"Jobs"},
                    {type:"item", label:"Offers"},
                  ].map(({type,label,active,badge},i)=> type==="group"
                    ? <div key={i} style={{ fontSize:9.5,letterSpacing:"1px",textTransform:"uppercase",color:"rgba(255,255,255,.38)",padding:"14px 10px 4px",fontWeight:600 }}>{label}</div>
                    : <div key={i} style={{ display:"flex",alignItems:"center",gap:9,padding:"7px 10px",borderRadius:6,background:active?"rgba(99,102,241,.25)":"transparent",color:active?"#fff":"rgba(255,255,255,.6)" }}>
                        <span style={{ width:14,height:14,borderRadius:3,background:"currentColor",opacity:.6,flexShrink:0 }} />
                        {label}
                        {badge&&<span style={{ marginLeft:"auto",background:"rgba(99,102,241,.35)",color:"#C4B5FD",fontSize:10,padding:"1px 6px",borderRadius:8,fontWeight:600 }}>{badge}</span>}
                      </div>
                  )}
                </aside>

                {/* Main content */}
                <main style={{ padding:"22px 26px",display:"flex",flexDirection:"column",gap:18,background:"#fff" }}>
                  {/* Header */}
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",
                    opacity:dash.greet?1:0,
                    transition:"opacity .5s ease" }}>
                    <div>
                      <div style={{ fontSize:18,fontWeight:600,color:C.ink }}>Good morning, Sarah</div>
                      <div style={{ fontSize:11.5,color:C.muted,marginTop:2,fontFamily:"'DM Mono',monospace" }}>Tuesday · 3 candidates need attention</div>
                    </div>
                    <span style={{ fontSize:10,fontFamily:"'DM Mono',monospace",background:C.bgTint,color:C.violet,padding:"4px 9px",borderRadius:6,letterSpacing:".5px" }}>◈ Co-worker active</span>
                  </div>

                  {/* Metric cards */}
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
                    {[
                      { lbl:"Active jobs",  val:"3",              trend:"↑ 1 vs last week", up:true,  acc:false },
                      { lbl:"Candidates",   val:String(dash.candVal), trend:"↑ 4 this week", up:true, acc:false },
                      { lbl:"AI analyses",  val:String(dash.aiVal),   trend:null,            up:null,  acc:true  },
                      { lbl:"Placements",   val:"2/4",            trend:"50% to target",    up:false, acc:false },
                    ].map(({lbl,val,trend,up,acc},i)=>(
                      <div key={lbl} style={{
                        background:acc?"linear-gradient(135deg,rgba(99,102,241,.10),rgba(139,92,246,.06))":C.bgSoft,
                        border:`1px solid ${acc?"rgba(139,92,246,.25)":C.line}`,
                        padding:14, borderRadius:10,
                        opacity: dash.metrics[i] ? 1 : 0,
                        transform: dash.metrics[i] ? "translateY(0)" : "translateY(6px)",
                        transition: `opacity .4s ease ${i*0.08}s, transform .4s ease ${i*0.08}s`,
                      }}>
                        <div style={{ fontSize:10.5,color:C.muted,fontFamily:"'DM Mono',monospace",letterSpacing:".4px",textTransform:"uppercase" }}>{lbl}</div>
                        <div style={{ fontSize:26,fontWeight:600,marginTop:6,letterSpacing:"-.6px",color:C.ink }}>{val}</div>
                        {acc
                          ? <div style={{ display:"flex",alignItems:"flex-end",gap:3,marginTop:8,height:24 }}>
                              {[30,50,45,70,55,80,65,95].map((h,j)=><span key={j} style={{ flex:1,height:`${h}%`,background:C.grad,borderRadius:2,opacity:.8,display:"block" }} />)}
                            </div>
                          : <div style={{ fontSize:10.5,color:up?"#059669":"#DC2626",marginTop:2 }}>{trend}</div>
                        }
                      </div>
                    ))}
                  </div>

                  {/* Candidate table */}
                  <div style={{ background:"#fff",border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden" }}>
                    <div style={{ display:"grid",gridTemplateColumns:"1.6fr 1.2fr .8fr 1fr 1fr",gap:14,padding:"11px 16px",borderBottom:`1px solid ${C.line}`,fontSize:10,letterSpacing:".6px",textTransform:"uppercase",color:C.muted,fontFamily:"'DM Mono',monospace",background:C.bgSoft }}>
                      {["Candidate","Applied for","Stage","Verify","Match"].map(h=><div key={h}>{h}</div>)}
                    </div>
                    {[
                      { av:"PS",bg:"linear-gradient(135deg,#6366F1,#8B5CF6)",nm:"Priya Sharma", em:"priya@mail.com", role:"Product Manager",  sB:"rgba(99,102,241,.13)",sC:"#4F46E5",stage:"Interview",vB:"rgba(16,185,129,.15)",vC:"#059669",vl:"● Low risk", sc:92 },
                      { av:"JO",bg:"linear-gradient(135deg,#06B6D4,#6366F1)",nm:"James Okafor", em:"james@mail.com",  role:"Sr. Backend Eng", sB:"rgba(139,92,246,.15)",sC:"#7C3AED",stage:"Screen",   vB:"rgba(245,158,11,.18)",vC:"#B45309",vl:"● 2 flags", sc:68 },
                      { av:"LF",bg:"linear-gradient(135deg,#F472B6,#8B5CF6)",nm:"Leon Fischer", em:"leon@mail.com",   role:"Sr. Backend Eng", sB:"rgba(6,182,212,.15)", sC:"#0891B2",stage:"Offer",    vB:"rgba(16,185,129,.15)",vC:"#059669",vl:"● Verified",sc:84 },
                      { av:"AN",bg:"linear-gradient(135deg,#10B981,#06B6D4)",nm:"Ada Nwosu",    em:"ada@mail.com",    role:"Product Manager",  sB:"rgba(99,102,241,.13)",sC:"#4F46E5",stage:"Interview",vB:"rgba(16,185,129,.15)",vC:"#059669",vl:"● Low risk", sc:79 },
                    ].map(({av,bg,nm,em,role,sB,sC,stage,vB,vC,vl,sc},i)=>(
                      <div key={nm} style={{
                        display:"grid",gridTemplateColumns:"1.6fr 1.2fr .8fr 1fr 1fr",gap:14,
                        padding:"11px 16px",borderBottom:`1px solid ${C.line}`,alignItems:"center",fontSize:12,
                        opacity: dash.rows[i] ? 1 : 0,
                        transform: dash.rows[i] ? "translateX(0)" : "translateX(-8px)",
                        transition: `opacity .4s ease, transform .4s ease`,
                      }}>
                        <div style={{ display:"flex",alignItems:"center",gap:9 }}>
                          <div style={{ width:26,height:26,borderRadius:7,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:"#fff" }}>{av}</div>
                          <div>
                            <div style={{ fontWeight:600,fontSize:12,color:C.ink }}>{nm}</div>
                            <div style={{ fontSize:10.5,color:C.muted,fontFamily:"'DM Mono',monospace" }}>{em}</div>
                          </div>
                        </div>
                        <div style={{ color:C.dim,fontSize:11.5 }}>{role}</div>
                        <div><span style={{ fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:5,letterSpacing:".3px",background:sB,color:sC }}>{stage}</span></div>
                        <div><span style={{ fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:5,letterSpacing:".3px",background:vB,color:vC }}>{vl}</span></div>
                        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                          <div style={{ flex:1,height:5,background:C.bgSoft,borderRadius:99,overflow:"hidden" }}>
                            <div style={{ height:"100%",width:`${dash.bars[i]}%`,background:C.grad,borderRadius:99,transition:"width 1.2s cubic-bezier(.4,0,.2,1)" }} />
                          </div>
                          <span style={{ fontFamily:"'DM Mono',monospace",fontSize:11,color:C.ink }}>{(sc/100).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </main>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════ FEATURES BENTO ══════════════ */}
      <section className="nl-section" id="features" style={{ position:"relative",maxWidth:1280,margin:"0 auto",padding:"120px 56px" }}>
        <Eyebrow>What's inside</Eyebrow>
        <h2 style={{ fontSize:54,fontWeight:600,letterSpacing:"-1.8px",lineHeight:1.08,marginBottom:20,maxWidth:780,color:C.ink }}>
          Four capabilities, <GradItalic>one continuous workflow.</GradItalic>
        </h2>
        <p style={{ fontSize:17,lineHeight:1.6,color:C.dim,maxWidth:620,marginBottom:60 }}>
          Stop stitching together CV parsers, ATS plugins and inbox tools. nolyvra runs every step end-to-end on a single canvas.
        </p>

        <div className="nl-feat-grid" style={{ display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:18 }}>

          {/* ── Verify span-8 — animated claim rows ── */}
          <article className="nl-feature" style={{ gridColumn:"span 8" }}>
            <FTag>Verify</FTag>
            <h3 style={{ fontSize:24,fontWeight:600,letterSpacing:"-.6px",marginBottom:10,color:C.ink }}>Every claim, cross-checked.</h3>
            <p style={{ fontSize:14.5,lineHeight:1.55,color:C.dim,maxWidth:480 }}>nolyvra reads the CV, LinkedIn, references and public sources, then flags inconsistencies before you ever schedule a call.</p>
            <div style={{ marginTop:22,display:"flex",flexDirection:"column",gap:8,fontFamily:"'DM Mono',monospace",fontSize:11 }}>
              {[
                ["CV",        "Sr. Backend · Northvale · 2022–2025",       "VERIFIED",  true ],
                ["LinkedIn",  "Sr. Backend · Northvale · 2022–present",    "MATCH",     true ],
                ["Reference", '"Led payments rebuild" · confirmed',         "CONFIRMED", true ],
                ["Claim",     "Stanford MBA · 2019",                        "NO RECORD", false],
              ].map(([src,val,chk,ok],i)=>(
                <div key={src} style={{
                  display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
                  background:C.bgSoft,border:`1px solid ${C.line}`,borderRadius:8,
                  opacity: verify.rowVis[i] ? 1 : 0,
                  transform: verify.rowVis[i] ? "translateX(0)" : "translateX(-8px)",
                  transition: "opacity .4s ease, transform .4s ease",
                }}>
                  <span style={{ color:C.muted,minWidth:80 }}>{src}</span>
                  <span style={{ flex:1,color:C.ink }}>{val}</span>
                  <span style={{
                    fontSize:10,padding:"2px 7px",borderRadius:5,letterSpacing:".3px",
                    background:ok?"rgba(16,185,129,.15)":"rgba(244,63,94,.15)",
                    color:ok?"#059669":"#DC2626",
                    opacity: verify.badgeVis[i] ? 1 : 0,
                    transition: "opacity .4s ease",
                  }}>{chk}</span>
                </div>
              ))}
            </div>
          </article>

          {/* ── Co-worker span-4 — animated agent steps ── */}
          <article className="nl-feature" style={{ gridColumn:"span 4" }}>
            <FTag>Co-worker</FTag>
            <h3 style={{ fontSize:24,fontWeight:600,letterSpacing:"-.6px",marginBottom:10,color:C.ink }}>An agent that does the work.</h3>
            <p style={{ fontSize:14.5,lineHeight:1.55,color:C.dim }}>Ask in plain English. Co-worker triages, schedules, drafts and reports back — with full audit trail.</p>
            <div style={{ marginTop:22,display:"flex",flexDirection:"column",gap:8,fontFamily:"'DM Mono',monospace",fontSize:11 }}>
              {[
                "Parse 9 CVs",
                "Cross-check claims",
                "Score fit · rank top 3",
                "Draft outreach emails",
              ].map((label,i)=>{
                const isDone   = agent.doneSteps.includes(i);
                const isActive = agent.activeStep === i;
                return (
                  <div key={i} style={{
                    display:"flex",alignItems:"center",gap:11,padding:"10px 13px",
                    background: isActive ? "rgba(139,92,246,.06)" : C.bgSoft,
                    border: `1px solid ${isActive ? "rgba(139,92,246,.4)" : C.line}`,
                    borderRadius:8,
                    color:C.ink,
                    opacity: agent.activeStep === -1 && !isDone ? 0.45 : isDone ? 0.6 : 1,
                    transition:"all .4s ease",
                  }}>
                    <span style={{
                      width:18,height:18,borderRadius:"50%",
                      background: isDone ? "rgba(16,185,129,.2)" : "rgba(99,102,241,.18)",
                      color: isDone ? "#059669" : C.indigo,
                      fontSize:10,fontWeight:700,
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                      transition:"all .3s ease",
                    }}>
                      {isDone ? "✓" : i+1}
                    </span>
                    {label}
                    {isActive && (
                      <span style={{ marginLeft:"auto",width:6,height:6,borderRadius:"50%",background:C.violet,boxShadow:"0 0 12px rgba(139,92,246,.5)",animation:"agentPulse 1.4s infinite",display:"inline-block" }} />
                    )}
                  </div>
                );
              })}
            </div>
          </article>

          {/* Pipeline span-4 — unchanged */}
          <article className="nl-feature" style={{ gridColumn:"span 4" }}>
            <FTag>Pipeline</FTag>
            <h3 style={{ fontSize:24,fontWeight:600,letterSpacing:"-.6px",marginBottom:10,color:C.ink }}>See the whole funnel.</h3>
            <p style={{ fontSize:14.5,lineHeight:1.55,color:C.dim }}>Stages, stalls and bottlenecks in one glance — updated as your co-worker moves people through.</p>
            <div style={{ marginTop:22 }}>
              <div style={{ display:"flex",height:42,borderRadius:10,overflow:"hidden",border:`1px solid ${C.line}` }}>
                {[
                  {label:"Applied",count:9, bg:"linear-gradient(180deg,#6366F1,#4F46E5)",flex:3},
                  {label:"Screen", count:5, bg:"linear-gradient(180deg,#8B5CF6,#7C3AED)",flex:2},
                  {label:"Interview",count:3,bg:"linear-gradient(180deg,#06B6D4,#0891B2)",flex:2},
                  {label:"Offer",  count:1, bg:"linear-gradient(180deg,#F472B6,#DB2777)",flex:1},
                ].map(({label,count,bg,flex},i,arr)=>(
                  <div key={label} style={{ flex,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:500,borderRight:i<arr.length-1?"1px solid rgba(255,255,255,.25)":"none",background:bg }}>
                    <b style={{ fontSize:14,fontWeight:600 }}>{count}</b>{label}
                  </div>
                ))}
              </div>
              <div style={{ display:"flex",justifyContent:"space-between",marginTop:12,fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace" }}>
                <span>3 active jobs</span><span>updated 2m ago</span>
              </div>
            </div>
          </article>

          {/* Drafts span-8 — unchanged */}
          <article className="nl-feature" style={{ gridColumn:"span 8" }}>
            <FTag>Drafts</FTag>
            <h3 style={{ fontSize:24,fontWeight:600,letterSpacing:"-.6px",marginBottom:10,color:C.ink }}>Offers and outreach, written for you.</h3>
            <p style={{ fontSize:14.5,lineHeight:1.55,color:C.dim,maxWidth:480 }}>From first-touch email to a formal offer letter, Co-worker drafts in your tone and your company's policy — you approve, edit, send.</p>
            <div style={{ marginTop:22,background:C.bgSoft,border:`1px solid ${C.line}`,borderRadius:10,padding:14,fontFamily:"'DM Mono',monospace",fontSize:11.5,lineHeight:1.7,color:C.ink }}>
              Dear Priya,<br />
              Thanks for the brilliant final-round conversation.{" "}
              <span style={{ color:C.violet }}>
                We're delighted to extend you an offer to join Halcyon as <strong>Senior Product Manager</strong>, starting <strong>16 April 2026</strong>, at a base salary of <strong>$92,000</strong>
                <span style={{ display:"inline-block",width:7,height:13,background:C.violet,verticalAlign:-2,marginLeft:1,animation:"nlBlink .8s steps(1) infinite" }} />
              </span>
            </div>
          </article>

        </div>
      </section>

      {/* ══════════════ INTEGRATIONS ══════════════ */}
      <div style={{ background:"#fff",padding:"52px 0",borderTop:`1px solid ${C.line}`,borderBottom:`1px solid ${C.line}`,overflow:"hidden" }}>
        <div style={{ textAlign:"center",fontSize:11,fontWeight:600,color:C.muted,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:32,fontFamily:"'DM Mono',monospace" }}>
          Works seamlessly with your existing tools
        </div>
        <div style={{ overflow:"hidden" }}>
          <div className="nl-marq">
            {(arr=>[...arr,...arr])([
              {name:"Gmail",   bg:"#fff",     el:<svg width="22" height="22" viewBox="0 0 48 48"><path fill="#EA4335" d="M6 40h6V22.5L4 16v20a4 4 0 0 0 4 4z"/><path fill="#34A853" d="M36 40h6a4 4 0 0 0 4-4V16l-10 6.5z"/><path fill="#4A90E2" d="M36 8H12L24 16.5z"/><path fill="#FBBC05" d="M12 22.5V8L4 16z"/><path fill="#EA4335" d="M4 16l8 6.5L24 14 40 22.5 48 16 24 0z"/></svg>},
              {name:"Outlook", bg:"#fff",     el:<svg width="22" height="22" viewBox="0 0 48 48"><rect width="48" height="48" rx="6" fill="#0078D4"/><path fill="#fff" d="M28 10v10h10L28 10z"/><path fill="#fff" fillOpacity=".8" d="M28 10h-6a2 2 0 0 0-2 2v6l8 6 10-6V20L28 10z"/><path fill="#fff" d="M20 18v20h18V20l-10 6-8-6v-2z"/><ellipse cx="13" cy="28" rx="7" ry="9" fill="#fff"/><ellipse cx="13" cy="28" rx="4.5" ry="6" fill="#0078D4"/></svg>},
              {name:"LinkedIn",bg:"#0A66C2",  el:<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>},
              {name:"Seek",    bg:"#E60278",  el:<svg width="22" height="22" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#E60278"/><text x="24" y="32" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="700" fontFamily="Arial">S</text></svg>},
              {name:"Indeed",  bg:"#003A9B",  el:<svg width="22" height="22" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#003A9B"/><text x="24" y="32" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700" fontFamily="Arial">i</text></svg>},
              {name:"AWS",     bg:"#fff",     el:<img src="/aws_logo.png" alt="AWS" style={{width:28,height:18,objectFit:"contain",display:"block"}} />},
              {name:"Render",  bg:"#46E3B7",  el:<svg width="22" height="22" viewBox="0 0 48 48"><rect width="48" height="48" rx="6" fill="#46E3B7"/><text x="24" y="33" textAnchor="middle" fill="#0F1623" fontSize="24" fontWeight="800" fontFamily="Arial">R</text></svg>},
            ]).map(({name,bg,el},i)=>(
              <div key={i} className="nl-int-chip">
                <div style={{ width:32,height:32,borderRadius:8,background:bg,border:`1px solid ${C.line}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>{el}</div>
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════ HOW IT WORKS ══════════════ */}
      <section className="nl-section" id="how" style={{ position:"relative",maxWidth:1280,margin:"0 auto",padding:"120px 56px" }}>
        <Eyebrow>How it works</Eyebrow>
        <h2 style={{ fontSize:54,fontWeight:600,letterSpacing:"-1.8px",lineHeight:1.08,marginBottom:60,maxWidth:780,color:C.ink }}>
          From CV to offer, <GradItalic>without leaving the page.</GradItalic>
        </h2>
        <div className="nl-flow-grid" style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18 }}>
          {[
            ["01","◇","Drop in a candidate","Forward an email, paste a LinkedIn URL or upload a CV. nolyvra parses, dedupes and links it to the right job in seconds."],
            ["02","◈","Verify & score","Every claim is cross-checked against public sources and references. You get a fit score, a risk score, and the exact evidence for each."],
            ["03","△","Co-worker moves it","Schedule interviews, send updates, draft the offer — your AI co-worker does the workflow and pings you only when judgement is needed."],
          ].map(([n,ic,title,desc])=>(
            <div key={n} className="nl-flow-step" data-n={n}>
              <div style={{ width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,rgba(99,102,241,.18),rgba(139,92,246,.12))",border:"1px solid rgba(139,92,246,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Mono',monospace",fontSize:14,color:C.violet }}>{ic}</div>
              <h4 style={{ fontSize:18,fontWeight:600,letterSpacing:"-.4px",marginBottom:10,marginTop:32,color:C.ink }}>{title}</h4>
              <p style={{ fontSize:13.5,color:C.dim,lineHeight:1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════ STATS BAND ══════════════ */}
      <section id="stats" style={{ maxWidth:1280,margin:"0 auto",padding:"0 56px 120px" }}>
        <div className="nl-stats" style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0,background:"#fff",border:`1px solid ${C.line}`,borderRadius:16,overflow:"hidden",boxShadow:C.shadowSm }}>
          {[
            ["14h", "Weekly hours returned to recruiters, on average"],
            ["3.2×","More candidates fully verified per week"],
            ["96%", "Claim-level verification accuracy on benchmark set"],
            ["11d", "Median time-to-offer for hires routed through Co-worker"],
          ].map(([val,lbl],i,arr)=>(
            <div key={val} style={{ padding:"32px 28px",borderRight:i<arr.length-1?`1px solid ${C.line}`:"none" }}>
              <div style={{ fontSize:42,fontWeight:600,letterSpacing:"-1.5px",background:C.gradTxt,WebkitBackgroundClip:"text",backgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1 }}>{val}</div>
              <div style={{ fontSize:12.5,color:C.dim,marginTop:8,lineHeight:1.5 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════ TESTIMONIALS ══════════════ */}
      <section id="social" style={{ maxWidth:1280,margin:"0 auto",padding:"0 56px 120px" }}>
        <div style={{ textAlign:"center",marginBottom:40 }}>
          <Eyebrow>What recruiters are saying</Eyebrow>
        </div>
        <div style={{ position:"relative",maxWidth:920,margin:"0 auto" }}>
          <div style={{ background:"linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.04) 60%,rgba(6,182,212,.05))",border:`1px solid ${C.line}`,borderRadius:20,padding:60,textAlign:"center",position:"relative",overflow:"hidden",minHeight:280 }}>
            <div style={{ position:"absolute",top:-30,left:"50%",transform:"translateX(-50%)",fontSize:200,fontFamily:"Georgia,serif",color:"rgba(99,102,241,.15)",lineHeight:1,pointerEvents:"none",userSelect:"none" }}>"</div>
            <div key={testimonialIdx} style={{ animation:"nlTestIn .4s ease both",position:"relative",zIndex:1 }}>
              <blockquote style={{ fontSize:24,lineHeight:1.5,fontWeight:400,letterSpacing:"-.3px",marginBottom:32,color:C.ink }}>
                {TESTIMONIALS[testimonialIdx].quote}
              </blockquote>
              <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:14 }}>
                <div style={{ width:44,height:44,borderRadius:"50%",background:TESTIMONIALS[testimonialIdx].avBg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:14,color:"#fff",flexShrink:0 }}>{TESTIMONIALS[testimonialIdx].av}</div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontWeight:600,fontSize:14,color:C.ink }}>{TESTIMONIALS[testimonialIdx].author}</div>
                  <div style={{ fontSize:12,color:C.muted,marginTop:2 }}>{TESTIMONIALS[testimonialIdx].role}</div>
                </div>
              </div>
            </div>
          </div>
          <button onClick={()=>setTestimonialIdx(i=>(i-1+TESTIMONIALS.length)%TESTIMONIALS.length)}
            style={{ position:"absolute",left:-20,top:"50%",transform:"translateY(-50%)",width:40,height:40,borderRadius:"50%",background:"#fff",border:`1px solid ${C.line2}`,boxShadow:C.shadowSm,cursor:"pointer",fontSize:16,color:C.dim,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all .15s",zIndex:2 }}>‹</button>
          <button onClick={()=>setTestimonialIdx(i=>(i+1)%TESTIMONIALS.length)}
            style={{ position:"absolute",right:-20,top:"50%",transform:"translateY(-50%)",width:40,height:40,borderRadius:"50%",background:"#fff",border:`1px solid ${C.line2}`,boxShadow:C.shadowSm,cursor:"pointer",fontSize:16,color:C.dim,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",transition:"all .15s",zIndex:2 }}>›</button>
          <div style={{ display:"flex",justifyContent:"center",gap:8,marginTop:20 }}>
            {TESTIMONIALS.map((_,i)=>(
              <button key={i} onClick={()=>setTestimonialIdx(i)}
                style={{ width:i===testimonialIdx?24:8,height:8,borderRadius:99,background:i===testimonialIdx?C.indigo:C.line2,border:"none",cursor:"pointer",padding:0,transition:"all .25s" }} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ VIDEO ══════════════ */}
      <section id="video" style={{ maxWidth:1280,margin:"0 auto",padding:"0 56px 120px" }}>
        <div style={{ textAlign:"center",marginBottom:48 }}>
          <Eyebrow>See it in action</Eyebrow>
          <h2 style={{ fontSize:54,fontWeight:600,letterSpacing:"-1.8px",lineHeight:1.08,marginBottom:20,color:C.ink }}>
            Watch how <GradItalic>nolyvra works.</GradItalic>
          </h2>
          <p style={{ fontSize:17,lineHeight:1.6,color:C.dim,maxWidth:560,margin:"0 auto" }}>A 90-second walkthrough — from dashboard to candidate analysis to pipeline management.</p>
        </div>
        <div style={{ position:"relative",paddingBottom:"56.25%",height:0,borderRadius:18,overflow:"hidden",boxShadow:C.shadowLg,border:`1px solid ${C.line}` }}>
          <iframe src="https://www.youtube.com/embed/IBskXO8TPL8?rel=0&modestbranding=1" title="Nolyvra Product Walkthrough" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position:"absolute",top:0,left:0,width:"100%",height:"100%",border:"none" }} />
        </div>
      </section>

      {/* ══════════════ FINAL CTA ══════════════ */}
      <section style={{ position:"relative",textAlign:"center",padding:"140px 56px",overflow:"hidden",background:`linear-gradient(180deg,#fff 0%,${C.bgTint} 100%)` }}>
        <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 50% 60% at 50% 50%,rgba(99,102,241,.18) 0%,transparent 65%)",pointerEvents:"none" }} />
        <h2 style={{ fontSize:72,fontWeight:600,letterSpacing:"-2.4px",lineHeight:1.05,marginBottom:22,position:"relative",zIndex:1,color:C.ink }}>
          Hire <GradItalic>like you have</GradItalic><br />a co-worker who never sleeps.
        </h2>
        <p style={{ fontSize:18,color:C.dim,maxWidth:560,margin:"0 auto 36px",position:"relative",zIndex:1,lineHeight:1.6 }}>
          Two minute setup. Bring your first job and your first 10 candidates — see the difference by tomorrow.
        </p>
        <div style={{ display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",position:"relative",zIndex:1 }}>
          <button onClick={openModal} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"13px 26px",borderRadius:999,fontSize:14,fontWeight:500,fontFamily:"inherit",border:"none",cursor:"pointer",background:C.ink,color:"#fff",boxShadow:"0 8px 22px rgba(11,10,20,.18)",transition:"all .2s" }}>
            <span className="nl-spark" /> Start free · no credit card
          </button>
          <button onClick={openModal} style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"13px 22px",borderRadius:999,fontSize:14,fontWeight:500,fontFamily:"inherit",cursor:"pointer",background:"#fff",color:C.ink,border:`1px solid ${C.line2}`,boxShadow:C.shadowSm,transition:"all .2s" }}>
            Book a 20-min call →
          </button>
        </div>
        <p style={{ marginTop:20,fontSize:12,color:C.muted }}>No commitment required · One of our team will be in touch</p>
      </section>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer style={{ background:"#06050B",borderTop:"1px solid rgba(255,255,255,.08)",padding:"48px 48px 28px",fontFamily:"'DM Sans',sans-serif" }}>
        {/* ── top row: 3 columns ── */}
        <div className="lp-footer" style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:40,marginBottom:36 }}>

          {/* Left — logo + tagline */}
          <div style={{ display:"flex",alignItems:"flex-start",gap:12,minWidth:180 }}>
            <img src="/nolyvra_logo.png" alt="nolyvra" style={{ width:38,height:38,borderRadius:8,objectFit:"cover",flexShrink:0 }} />
            <div>
              <div style={{ color:"#fff",fontSize:15,fontWeight:600,letterSpacing:"-.2px" }}>nolyvra</div>
              <div style={{ fontSize:11,color:"rgba(255,255,255,.4)",fontStyle:"italic",marginTop:2 }}>Intelligence. Evolved</div>
              <div style={{ marginTop:14,fontSize:12,color:"rgba(255,255,255,.55)",lineHeight:1.7 }}>
                QV, 3 Albert Coates Ln<br/>
                Melbourne, Victoria
              </div>
              <a href="mailto:info@nolyvra.com" style={{ display:"inline-block",marginTop:6,fontSize:12,color:"rgba(255,255,255,.7)",textDecoration:"none",transition:"color .15s" }}
                onMouseEnter={e=>e.currentTarget.style.color="#fff"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.7)"}>
                info@nolyvra.com
              </a>
            </div>
          </div>

          {/* Centre — legal + links */}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:12,color:"rgba(255,255,255,.7)",lineHeight:1.7 }}>
              © 2026 nolyvra · All rights reserved
            </div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,.45)",marginTop:2 }}>
              ABN 54 673 612 603
            </div>
            <div style={{ marginTop:12,display:"flex",gap:16,justifyContent:"center" }}>
              <a href="/privacy" style={{ fontSize:11,color:"rgba(255,255,255,.5)",textDecoration:"none",transition:"color .15s" }}
                onMouseEnter={e=>e.currentTarget.style.color="#fff"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.5)"}>Privacy Policy</a>
              <span style={{ color:"rgba(255,255,255,.2)" }}>·</span>
              <a href="/terms" style={{ fontSize:11,color:"rgba(255,255,255,.5)",textDecoration:"none",transition:"color .15s" }}
                onMouseEnter={e=>e.currentTarget.style.color="#fff"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,.5)"}>Terms of Service</a>
            </div>
          </div>

          {/* Right — LinkedIn */}
          <div style={{ display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10,minWidth:180 }}>
            <a href="https://www.linkedin.com/company/nolyvra/" target="_blank" rel="noopener noreferrer"
              style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 14px",borderRadius:8,background:"#0A66C2",color:"#fff",textDecoration:"none",fontSize:12,fontWeight:500,transition:"opacity .15s" }}
              onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              Follow on LinkedIn
            </a>
          </div>
        </div>

        {/* ── bottom row: divider + disclaimer ── */}
        <div style={{ borderTop:"1px solid rgba(255,255,255,.08)",paddingTop:20,textAlign:"center" }}>
          <p style={{ fontSize:11,color:"rgba(255,255,255,.4)",margin:0 }}>
            This AI tool is designed to assist, not replace professional judgment.
          </p>
        </div>
      </footer>

      {/* ══════════════ MODAL ══════════════ */}
      {modalOpen&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setModalOpen(false);}}>
          <div className="modal-box">
            <button onClick={()=>setModalOpen(false)} style={{ position:"absolute",top:16,right:16,width:32,height:32,borderRadius:"50%",background:"#F7F8FA",border:"1px solid #E2E6ED",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#9AA3B4" }}>✕</button>
            {!submitted?(
              <>
                <div style={{ fontSize:28,marginBottom:10 }}>✦</div>
                <div style={{ fontSize:22,fontWeight:700,color:C.ink,letterSpacing:"-.4px",marginBottom:6 }}>Register Your Interest</div>
                <div style={{ fontSize:13,color:"#9AA3B4",marginBottom:28,lineHeight:1.5 }}>Tell us about yourself and we'll be in touch shortly with early access details.</div>
                {formError&&<div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#DC2626" }}>{formError}</div>}
                <div className="modal-name-row" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16 }}>
                  <div>
                    <label style={{ display:"block",fontSize:12,fontWeight:600,color:C.ink,marginBottom:5 }}>First Name *</label>
                    <input className="form-input" type="text" placeholder="Sarah" value={form.firstName} onChange={e=>setField("firstName",e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display:"block",fontSize:12,fontWeight:600,color:C.ink,marginBottom:5 }}>Last Name</label>
                    <input className="form-input" type="text" placeholder="Reynolds" value={form.lastName} onChange={e=>setField("lastName",e.target.value)} />
                  </div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:C.ink,marginBottom:5 }}>Company *</label>
                  <input className="form-input" type="text" placeholder="Your recruitment agency" value={form.company} onChange={e=>setField("company",e.target.value)} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:C.ink,marginBottom:5 }}>Email Address *</label>
                  <input className="form-input" type="email" placeholder="sarah@agency.com" value={form.email} onChange={e=>setField("email",e.target.value)} />
                </div>
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:C.ink,marginBottom:5 }}>Phone Number</label>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <select value={selCountry.code} onChange={e=>setSelCountry(COUNTRIES.find(c=>c.code===e.target.value))}
                      style={{ padding:"10px 8px",border:"1px solid #E2E6ED",borderRadius:8,fontSize:13,fontFamily:"inherit",color:C.ink,background:"#F7F8FA",cursor:"pointer",outline:"none",flexShrink:0 }}>
                      {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                    </select>
                    <input className="form-input" type="tel" placeholder="04XX XXX XXX" value={form.phone} onChange={e=>setField("phone",fmtPhone(e.target.value))} maxLength={12} style={{ flex:1 }} />
                  </div>
                  <div style={{ fontSize:11,color:"#9AA3B4",marginTop:4 }}>Country code: {selCountry.flag} {selCountry.code}</div>
                </div>
                <button onClick={handleRegister} disabled={submitting} style={{ width:"100%",padding:12,borderRadius:8,fontSize:14,fontWeight:600,background:C.indigo,color:"#fff",border:"none",cursor:"pointer",fontFamily:"inherit",transition:"all .15s" }}>
                  {submitting?"Submitting…":"Submit →"}
                </button>
              </>
            ):(
              <div style={{ textAlign:"center",paddingTop:24 }}>
                <div style={{ fontSize:48,marginBottom:12 }}>🎉</div>
                <div style={{ fontSize:18,fontWeight:700,color:C.ink,marginBottom:8 }}>Thank you for your interest!</div>
                <div style={{ fontSize:14,color:"#9AA3B4",lineHeight:1.6,marginBottom:20 }}>One of our Customer Service Representatives will get in touch shortly.</div>
                <button onClick={()=>setModalOpen(false)} style={{ padding:"10px 24px",borderRadius:7,background:C.indigo,color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
