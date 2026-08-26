import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const COUNTRIES = [
  { flag: "🇦🇺", code: "+61" }, { flag: "🇬🇧", code: "+44" }, { flag: "🇺🇸", code: "+1" },
  { flag: "🇮🇳", code: "+91" }, { flag: "🇳🇿", code: "+64" }, { flag: "🇸🇬", code: "+65" },
];

export default function RecruitmentUnitedPage() {
  const [modalOpen, setModalOpen]   = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", company: "", email: "", phone: "" });
  const [selCountry, setSelCountry] = useState(COUNTRIES[0]);

  function fmtPhone(r) {
    const d = r.replace(/\D/g, "");
    if (d.length <= 4) return d;
    if (d.length <= 7) return `${d.slice(0,4)} ${d.slice(4)}`;
    return `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7,10)}`;
  }
  function setField(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleRegister() {
    if (!form.firstName.trim() || !form.email.trim()) { setFormError("First name and email are required."); return; }
    setSubmitting(true); setFormError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone: form.phone ? `${selCountry.code} ${form.phone}` : "" }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Registration failed."); return; }
      setSubmitted(true);
    } catch { setFormError("Network error. Please try again."); }
    finally { setSubmitting(false); }
  }

  function openModal() {
    setSubmitted(false); setFormError("");
    setForm({ firstName: "", lastName: "", company: "", email: "", phone: "" });
    setModalOpen(true);
  }

  return (
    <div className="ru-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .ru-page{
          --bg-0:#07060d; --bg-1:#120e22; --bg-2:#1c1738;
          --purple:#8b7cf6; --blue:#6fcbe8; --ru-red:#ea3b52; --ru-blue:#5fc2ee;
          --ink:#f5f4fb; --muted:#9d9ab4; --muted-2:#6f6c88;
          --card:#120f1f; --card-border:rgba(255,255,255,0.08); --card-border-hi:rgba(139,124,246,0.35);
          background:var(--bg-0); color:var(--ink); font-family:'Inter',sans-serif;
          -webkit-font-smoothing:antialiased; overflow-x:hidden; position:relative; min-height:100vh;
        }
        .ru-page *{box-sizing:border-box;}
        .ru-page a{color:inherit; text-decoration:none;}
        .ru-page button{font-family:inherit;}
        .ru-display{font-family:'Space Grotesk',sans-serif;}
        .ru-mono{font-family:'JetBrains Mono',monospace;}

        .ru-bg-wrap{
          position:fixed; inset:0; z-index:0; overflow:hidden; pointer-events:none;
          background:
            radial-gradient(120vw 70vh at 15% -10%, rgba(111,203,232,0.10), transparent 55%),
            radial-gradient(90vw 80vh at 90% 10%, rgba(139,124,246,0.16), transparent 55%),
            radial-gradient(100vw 90vh at 20% 110%, rgba(234,59,82,0.08), transparent 50%),
            linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 45%, var(--bg-0) 100%);
        }
        .ru-grain{
          position:fixed; inset:0; z-index:0; opacity:0.035; pointer-events:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        .ru-header{
          position:sticky; top:0; z-index:50;
          display:flex; align-items:center; justify-content:space-between;
          padding:18px clamp(20px,5vw,72px);
          background:rgba(7,6,13,0.72); backdrop-filter:blur(14px);
          border-bottom:1px solid rgba(255,255,255,0.06);
        }
        .ru-brandmark{display:flex; align-items:center; gap:14px;}
        .ru-logo-chip{display:flex; align-items:center; justify-content:center; height:30px;}
        .ru-logo-chip img{height:100%; display:block;}
        .ru-x-mark{color:var(--muted-2); font-size:15px; font-weight:500;}
        .ru-partner-tag{
          font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.08em;
          color:var(--muted); text-transform:uppercase;
          border:1px solid var(--card-border); padding:6px 12px; border-radius:100px;
          display:none;
        }
        @media(min-width:720px){ .ru-partner-tag{display:inline-block;} }
        .ru-cta-nav{
          display:flex; align-items:center; gap:10px;
          font-size:14px; font-weight:600;
          background:linear-gradient(135deg,var(--purple),var(--blue));
          color:#0a0714; padding:10px 20px; border-radius:100px; border:none; cursor:pointer;
          box-shadow:0 8px 24px rgba(139,124,246,0.25);
          transition:transform .2s ease, box-shadow .2s ease;
        }
        .ru-cta-nav:hover{transform:translateY(-1px); box-shadow:0 10px 28px rgba(139,124,246,0.38);}

        .ru-main{position:relative; z-index:1;}
        .ru-section{padding:clamp(56px,8vw,96px) clamp(20px,5vw,72px); max-width:1180px; margin:0 auto;}

        .ru-hero{
          position:relative; padding:clamp(64px,10vw,120px) clamp(20px,5vw,72px) clamp(80px,8vw,110px);
          max-width:1180px; margin:0 auto; text-align:center;
        }
        .ru-eyebrow{
          display:inline-flex; align-items:center; gap:10px;
          border:1px solid var(--card-border-hi); background:rgba(139,124,246,0.08);
          padding:8px 18px 8px 8px; border-radius:100px; font-size:13px; color:var(--muted); margin-bottom:36px;
        }
        .ru-eyebrow .ru-tag{
          background:linear-gradient(135deg,var(--purple),var(--blue));
          color:#0a0714; font-weight:700; font-size:11px; letter-spacing:0.03em;
          padding:4px 10px; border-radius:100px;
        }
        .ru-hero h1{
          font-size:clamp(38px,6.4vw,76px); line-height:1.04; letter-spacing:-0.02em; font-weight:700; margin-bottom:26px;
        }
        .ru-hero h1 em{
          font-style:italic; font-weight:600;
          background:linear-gradient(100deg,var(--purple) 15%, var(--blue) 85%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }
        .ru-hero .ru-lede{max-width:640px; margin:0 auto 44px; color:var(--muted); font-size:clamp(16px,2vw,19px); line-height:1.6;}
        .ru-hero-ctas{display:flex; gap:14px; justify-content:center; flex-wrap:wrap; margin-bottom:64px;}
        .ru-btn-primary, .ru-btn-ghost{
          font-size:15px; font-weight:600; padding:15px 30px; border-radius:100px;
          display:inline-flex; align-items:center; gap:8px; border:none; cursor:pointer;
          transition:transform .2s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;
        }
        .ru-btn-primary{background:#f5f4fb; color:#0a0714;}
        .ru-btn-primary:hover{transform:translateY(-2px); box-shadow:0 14px 30px rgba(245,244,251,0.15);}
        .ru-btn-ghost{border:1px solid var(--card-border); color:var(--ink); background:rgba(255,255,255,0.02);}
        .ru-btn-ghost:hover{border-color:var(--card-border-hi); background:rgba(139,124,246,0.06);}
        .ru-trust-line{color:var(--muted-2); font-size:13px; margin-bottom:56px;}
        .ru-trust-line b{color:var(--muted);}

        .ru-chip-field{position:relative; height:120px; max-width:820px; margin:0 auto;}
        .ru-chip{
          position:absolute; background:rgba(18,15,31,0.9); border:1px solid var(--card-border);
          border-radius:14px; padding:10px 16px; display:flex; align-items:center; gap:10px;
          box-shadow:0 20px 40px rgba(0,0,0,0.35); backdrop-filter:blur(10px);
          animation:ruDrift 7s ease-in-out infinite;
        }
        .ru-chip .ru-dot{width:8px; height:8px; border-radius:50%; flex-shrink:0;}
        .ru-chip .ru-label{font-size:13px; font-weight:600;}
        .ru-chip .ru-sub{font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted-2);}
        .ru-chip.c1{left:2%; top:6px; animation-delay:0s;}
        .ru-chip.c2{right:4%; top:34px; animation-delay:1.4s;}
        .ru-chip.c3{left:26%; bottom:2px; animation-delay:2.8s;}
        @keyframes ruDrift{ 0%,100%{transform:translateY(0);} 50%{transform:translateY(-9px);} }
        @media(max-width:720px){
          .ru-chip-field{height:210px;}
          .ru-chip.c1{left:4%; top:0;}
          .ru-chip.c2{right:2%; top:78px;}
          .ru-chip.c3{left:14%; bottom:0;}
        }

        .ru-section-head{max-width:640px; margin-bottom:48px;}
        .ru-kicker{
          font-family:'JetBrains Mono',monospace; font-size:12px; letter-spacing:0.1em;
          text-transform:uppercase; color:var(--purple); margin-bottom:14px; display:block;
        }
        .ru-section-head h2{font-size:clamp(28px,4vw,42px); font-weight:700; letter-spacing:-0.01em; line-height:1.15; margin-bottom:16px;}
        .ru-section-head p{color:var(--muted); font-size:16px; line-height:1.65;}

        .ru-offer-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:16px;}
        @media(max-width:900px){.ru-offer-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:600px){.ru-offer-grid{grid-template-columns:1fr;}}
        .ru-offer-card{
          background:var(--card); border:1px solid var(--card-border); border-radius:18px;
          padding:26px; display:flex; flex-direction:column; gap:14px;
          transition:border-color .25s ease, transform .25s ease;
        }
        .ru-offer-card:hover{border-color:var(--card-border-hi); transform:translateY(-3px);}
        .ru-check{
          width:32px; height:32px; border-radius:9px;
          background:rgba(139,124,246,0.12); border:1px solid rgba(139,124,246,0.3);
          display:flex; align-items:center; justify-content:center; color:var(--blue); flex-shrink:0;
        }
        .ru-offer-card h3{font-size:16px; font-weight:600; line-height:1.4;}
        .ru-offer-card p{font-size:13.5px; color:var(--muted-2); line-height:1.5;}
        .ru-offer-hero-card{
          grid-column:span 3;
          background:linear-gradient(120deg, rgba(139,124,246,0.16), rgba(111,203,232,0.10));
          border:1px solid var(--card-border-hi); border-radius:20px; padding:32px clamp(24px,4vw,44px);
          display:flex; align-items:center; justify-content:space-between; gap:24px; flex-wrap:wrap;
        }
        @media(max-width:900px){.ru-offer-hero-card{grid-column:span 2;}}
        @media(max-width:600px){.ru-offer-hero-card{grid-column:span 1;}}
        .ru-offer-hero-card .ru-num{
          font-family:'Space Grotesk',sans-serif; font-size:clamp(40px,6vw,64px); font-weight:700;
          background:linear-gradient(100deg,var(--purple),var(--blue));
          -webkit-background-clip:text; background-clip:text; color:transparent; line-height:1;
        }
        .ru-offer-hero-card .ru-txt h3{font-size:18px; font-weight:700; margin-bottom:4px;}
        .ru-offer-hero-card .ru-txt p{color:var(--muted); font-size:14px;}

        .ru-platform-panel{
          background:radial-gradient(120% 140% at 0% 0%, rgba(139,124,246,0.14), transparent 60%), var(--card);
          border:1px solid var(--card-border); border-radius:24px; padding:clamp(28px,5vw,56px);
        }
        .ru-platform-top{display:flex; justify-content:space-between; align-items:flex-start; gap:32px; flex-wrap:wrap; margin-bottom:40px;}
        .ru-platform-top h2{font-size:clamp(24px,3.2vw,34px); font-weight:700; max-width:520px; line-height:1.2;}
        .ru-stat-16{display:flex; align-items:baseline; gap:12px;}
        .ru-stat-16 .ru-n{
          font-family:'Space Grotesk',sans-serif; font-size:72px; font-weight:700; line-height:1;
          background:linear-gradient(100deg,var(--purple),var(--blue));
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }
        .ru-stat-16 .ru-l{font-size:15px; color:var(--muted); max-width:180px; line-height:1.4;}
        .ru-feature-row{display:grid; grid-template-columns:repeat(3,1fr); gap:14px;}
        @media(max-width:900px){.ru-feature-row{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:560px){.ru-feature-row{grid-template-columns:1fr;}}
        .ru-feature-item{background:rgba(255,255,255,0.02); border:1px solid var(--card-border); border-radius:14px; padding:20px;}
        .ru-feature-item .ru-tagn{font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--muted-2); margin-bottom:10px; display:block;}
        .ru-feature-item h4{font-size:15px; font-weight:600; margin-bottom:6px;}
        .ru-feature-item p{font-size:13px; color:var(--muted-2); line-height:1.5;}

        .ru-demo-panel{
          display:grid; grid-template-columns:1fr; gap:0;
          background:linear-gradient(135deg, var(--bg-2), var(--bg-1));
          border:1px solid var(--card-border-hi); border-radius:24px; overflow:hidden;
        }
        .ru-demo-left{padding:clamp(28px,5vw,52px);}
        .ru-demo-left h2{font-size:clamp(26px,3.6vw,36px); font-weight:700; margin-bottom:16px; letter-spacing:-0.01em;}
        .ru-demo-left p{color:var(--muted); font-size:15px; line-height:1.6; margin-bottom:28px; max-width:440px;}
        .ru-badge-row{display:flex; gap:10px; flex-wrap:wrap; margin-bottom:28px;}
        .ru-pill{
          font-size:12.5px; font-weight:600; padding:8px 14px; border-radius:100px;
          display:inline-flex; align-items:center; gap:8px; border:1px solid var(--card-border); color:var(--muted);
        }
        .ru-pill .ru-sq{width:7px; height:7px; border-radius:2px;}

        .ru-footer{
          position:relative; z-index:1;
          padding:40px clamp(20px,5vw,72px) 60px;
          display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap;
          border-top:1px solid rgba(255,255,255,0.06); max-width:1180px; margin:0 auto;
        }
        .ru-foot-brands{display:flex; align-items:center; gap:14px;}
        .ru-foot-logo{display:flex; align-items:center; height:24px;}
        .ru-foot-logo img{height:100%;}
        .ru-footer .ru-fine{font-size:12.5px; color:var(--muted-2); max-width:460px; line-height:1.6;}

        .ru-modal-overlay{position:fixed; inset:0; z-index:1000; background:rgba(0,0,0,.6); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center;}
        .ru-modal-box{background:#fff; border-radius:16px; padding:40px; width:100%; max-width:460px; position:relative; box-shadow:0 24px 64px rgba(0,0,0,.3); color:#0F1623; animation:ruModalIn .2s ease;}
        @keyframes ruModalIn{ from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .ru-form-input{width:100%; padding:10px 13px; border:1px solid #E2E6ED; border-radius:8px; font-size:13px; font-family:inherit; color:#0F1623; background:#F7F8FA; outline:none; transition:border-color .15s;}
        .ru-form-input:focus{border-color:#8b7cf6; box-shadow:0 0 0 3px rgba(139,124,246,.15);}

        @media(max-width:768px){
          .ru-modal-box{padding:24px 20px!important; margin:16px!important; max-width:calc(100vw - 32px)!important;}
          .ru-modal-name-row{grid-template-columns:1fr!important;}
        }
      `}</style>

      <div className="ru-bg-wrap"></div>
      <div className="ru-grain"></div>

      <header className="ru-header">
        <div className="ru-brandmark">
          <div className="ru-logo-chip"><img src="/nolyvra_logo.png" alt="Nolyvra" /></div>
          <span className="ru-x-mark">×</span>
          <div className="ru-logo-chip" style={{ height:38 }}><img src="/recruitment_united_logo.png" alt="Recruitment United" /></div>
        </div>
        <span className="ru-partner-tag">Official Technology Partner</span>
        <button className="ru-cta-nav" onClick={openModal}>Claim your offer →</button>
      </header>

      <main className="ru-main">
        <section className="ru-hero">
          <div className="ru-eyebrow"><span className="ru-tag">NEW</span> Exclusively for Recruitment United members</div>
          <h1>Your recruiting team just got<br /><em>an AI co-worker.</em></h1>
          <p className="ru-lede">Nolyvra writes your job ads, collects CVs, scores candidates and gives placement probability — so your RU membership now comes with a full AI recruiting assistant, on us.</p>

          <div className="ru-hero-ctas">
            <button className="ru-btn-primary" onClick={openModal}>Claim your member offer</button>
            <a href="#demo" className="ru-btn-ghost">Book a demo →</a>
          </div>

          <div className="ru-chip-field" aria-hidden="true">
            <div className="ru-chip c1"><span className="ru-dot" style={{ background:"var(--blue)" }}></span><span className="ru-label">Job ad</span><span className="ru-sub">drafted · 4s</span></div>
            <div className="ru-chip c2"><span className="ru-dot" style={{ background:"var(--purple)" }}></span><span className="ru-label">Placement probability</span><span className="ru-sub">82%</span></div>
            <div className="ru-chip c3"><span className="ru-dot" style={{ background:"var(--ru-red)" }}></span><span className="ru-label">CV parsed</span><span className="ru-sub">↔ LinkedIn diff</span></div>
          </div>

          <p className="ru-trust-line">Trusted by recruitment teams across <b>Australia</b> and globally · brought to you with <b>Recruitment United</b></p>
        </section>

        <section id="offer" className="ru-section">
          <div className="ru-section-head">
            <span className="ru-kicker">Recruitment United × Nolyvra</span>
            <h2>Claim your member offer today</h2>
            <p>As an official Recruitment United technology partner, Nolyvra is giving RU members everything they need to get started — on us.</p>
          </div>

          <div className="ru-offer-grid">
            {[
              { title:"2 weeks free trial", body:"Full platform access, no credit card required." },
              { title:"1 hour personalised onboarding", body:"Sit down with a Nolyvra team member to get set up right." },
              { title:"In-person workshops", body:"Available on request for your whole team." },
              { title:"Your logo on Nolyvra.com", body:"Featured with backlinks to your agency." },
              { title:"Newsletter & social promotion", body:"Get featured across Nolyvra's channels." },
            ].map(c=>(
              <div className="ru-offer-card" key={c.title}>
                <div className="ru-check">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
            ))}
            <div className="ru-offer-hero-card">
              <div className="ru-num">20%</div>
              <div className="ru-txt">
                <h3>Discount on all Nolyvra fees</h3>
                <p>Ongoing — for as long as you're a Recruitment United member.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="ru-section">
          <div className="ru-platform-panel">
            <div className="ru-platform-top">
              <div>
                <span className="ru-kicker">Your personal recruiting assistant</span>
                <h2>One platform, from first job ad to placed candidate.</h2>
              </div>
              <div className="ru-stat-16">
                <span className="ru-n">16</span>
                <span className="ru-l">modules working together on one platform</span>
              </div>
            </div>

            <div className="ru-feature-row">
              {[
                { n:"01", h:"Writes job ads", p:"Turns a role brief into a ready-to-post ad in your voice." },
                { n:"02", h:"Collects CVs", p:"Pulls applications and CVs into one place automatically." },
                { n:"03", h:"Scores candidates", p:"Ranks applicants against the role so shortlisting takes minutes." },
                { n:"04", h:"Placement probability", p:"Surfaces which candidates are most likely to land the role." },
                { n:"05", h:"Finds talent", p:"Sources candidates beyond your existing database." },
                { n:"06", h:"Prospects new clients", p:"Identifies and helps you reach your next client, too." },
              ].map(f=>(
                <div className="ru-feature-item" key={f.n}>
                  <span className="ru-tagn">{f.n}</span>
                  <h4>{f.h}</h4>
                  <p>{f.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="ru-section">
          <div className="ru-demo-panel">
            <div className="ru-demo-left">
              <span className="ru-kicker">Recruitment United members only</span>
              <h2>See it running on your own roles.</h2>
              <p>Book a live walkthrough with the Nolyvra team and we'll show you exactly how the offer applies to your agency.</p>
              <div className="ru-badge-row">
                <span className="ru-pill"><span className="ru-sq" style={{ background:"var(--purple)" }}></span>Official RU technology partner</span>
                <span className="ru-pill"><span className="ru-sq" style={{ background:"var(--ru-red)" }}></span>2026 member network</span>
              </div>
              <button className="ru-btn-primary" onClick={openModal}>Claim your offer</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="ru-footer">
        <div className="ru-foot-brands">
          <div className="ru-foot-logo"><img src="/nolyvra_logo.png" alt="Nolyvra" /></div>
          <span className="ru-x-mark">×</span>
          <div className="ru-foot-logo"><img src="/recruitment_united_logo.png" alt="Recruitment United" /></div>
        </div>
        <p className="ru-fine">Nolyvra is proud to be an official technology partner of Recruitment United. This offer is exclusive to Recruitment United members.</p>
      </footer>

      {modalOpen && (
        <div className="ru-modal-overlay" onClick={e=>{ if(e.target===e.currentTarget) setModalOpen(false); }}>
          <div className="ru-modal-box">
            <button onClick={()=>setModalOpen(false)} style={{ position:"absolute",top:16,right:16,width:32,height:32,borderRadius:"50%",background:"#F7F8FA",border:"1px solid #E2E6ED",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#9AA3B4" }}>✕</button>
            {!submitted ? (
              <>
                <div style={{ fontSize:28,marginBottom:10 }}>✦</div>
                <div style={{ fontSize:22,fontWeight:700,color:"#0F1623",letterSpacing:"-.4px",marginBottom:6 }}>Register Your Interest</div>
                <div style={{ fontSize:13,color:"#9AA3B4",marginBottom:28,lineHeight:1.5 }}>Tell us about yourself and we'll be in touch shortly with your Recruitment United member offer.</div>
                {formError && <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#DC2626" }}>{formError}</div>}
                <div className="ru-modal-name-row" style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16 }}>
                  <div>
                    <label style={{ display:"block",fontSize:12,fontWeight:600,color:"#0F1623",marginBottom:5 }}>First Name *</label>
                    <input className="ru-form-input" type="text" placeholder="Sarah" value={form.firstName} onChange={e=>setField("firstName",e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display:"block",fontSize:12,fontWeight:600,color:"#0F1623",marginBottom:5 }}>Last Name</label>
                    <input className="ru-form-input" type="text" placeholder="Reynolds" value={form.lastName} onChange={e=>setField("lastName",e.target.value)} />
                  </div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:"#0F1623",marginBottom:5 }}>Company *</label>
                  <input className="ru-form-input" type="text" placeholder="Your recruitment agency" value={form.company} onChange={e=>setField("company",e.target.value)} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:"#0F1623",marginBottom:5 }}>Email Address *</label>
                  <input className="ru-form-input" type="email" placeholder="sarah@agency.com" value={form.email} onChange={e=>setField("email",e.target.value)} />
                </div>
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:"#0F1623",marginBottom:5 }}>Phone Number</label>
                  <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                    <select value={selCountry.code} onChange={e=>setSelCountry(COUNTRIES.find(c=>c.code===e.target.value))}
                      style={{ padding:"10px 8px",border:"1px solid #E2E6ED",borderRadius:8,fontSize:13,fontFamily:"inherit",color:"#0F1623",background:"#F7F8FA",cursor:"pointer",outline:"none",flexShrink:0 }}>
                      {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                    </select>
                    <input className="ru-form-input" type="tel" placeholder="04XX XXX XXX" value={form.phone} onChange={e=>setField("phone",fmtPhone(e.target.value))} maxLength={12} style={{ flex:1 }} />
                  </div>
                  <div style={{ fontSize:11,color:"#9AA3B4",marginTop:4 }}>Country code: {selCountry.flag} {selCountry.code}</div>
                </div>
                <button onClick={handleRegister} disabled={submitting} style={{ width:"100%",padding:12,borderRadius:8,fontSize:14,fontWeight:600,background:"#8b7cf6",color:"#fff",border:"none",cursor:"pointer",fontFamily:"inherit",transition:"all .15s" }}>
                  {submitting ? "Submitting…" : "Submit →"}
                </button>
              </>
            ) : (
              <div style={{ textAlign:"center",paddingTop:24 }}>
                <div style={{ fontSize:48,marginBottom:12 }}>🎉</div>
                <div style={{ fontSize:18,fontWeight:700,color:"#0F1623",marginBottom:8 }}>Thank you for your interest!</div>
                <div style={{ fontSize:14,color:"#9AA3B4",lineHeight:1.6,marginBottom:20 }}>One of our Customer Service Representatives will get in touch shortly.</div>
                <button onClick={()=>setModalOpen(false)} style={{ padding:"10px 24px",borderRadius:7,background:"#8b7cf6",color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
