import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function LandingPage() {
  const nav = useNavigate();
  const [modalOpen,   setModalOpen]   = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [formError,   setFormError]   = useState("");
  const [form, setForm] = useState({
    firstName: "", lastName: "", company: "", email: "", phone: ""
  });

  function setField(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleRegister() {
    if (!form.firstName.trim() || !form.email.trim()) {
      setFormError("First name and email are required.");
      return;
    }
    setSubmitting(true); setFormError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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

  const CHECK_GREEN = (
    <svg width="8" height="8" viewBox="0 0 8 8">
      <path d="M1 4l2 2 4-3" stroke="#16A34A" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#0F1623", background: "#fff", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&display=swap');
        html { scroll-behavior: smooth; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow-x: hidden; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes modalIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .lp-nav-link { color: rgba(255,255,255,.5); font-size: 13px; font-weight: 500; text-decoration: none; transition: color .15s; }
        .lp-nav-link:hover { color: #fff; }
        .lp-feature-card { background: #F7F8FA; border: 1px solid #E2E6ED; border-radius: 12px; padding: 28px; transition: box-shadow .2s, transform .2s; }
        .lp-feature-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,.08); transform: translateY(-2px); }
        .lp-hero-stat { flex: 1; padding: 20px 24px; text-align: center; border-right: 1px solid rgba(255,255,255,.08); }
        .lp-hero-stat:last-child { border-right: none; }
        .lp-step:not(:last-child)::after { content:'→'; position:absolute; right:-8px; top:28px; font-size:18px; color:rgba(255,255,255,.15); }
        .modal-overlay { position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center; }
        .modal-box { background:#fff;border-radius:16px;padding:40px;width:100%;max-width:460px;position:relative;box-shadow:0 24px 64px rgba(0,0,0,.3);animation:modalIn .2s ease; }
        .form-input { width:100%;padding:10px 13px;border:1px solid #E2E6ED;border-radius:8px;font-size:13px;font-family:inherit;color:#0F1623;background:#F7F8FA;outline:none;transition:border-color .15s; }
        .form-input:focus { border-color:#1D72E8;box-shadow:0 0 0 3px rgba(29,114,232,.1); }
        .lp-btn-primary { padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;background:#1D72E8;color:#fff;border:none;cursor:pointer;font-family:inherit;transition:all .2s;box-shadow:0 4px 24px rgba(29,114,232,.4); }
        .lp-btn-primary:hover { background:#3B8BFF;transform:translateY(-1px); }
        .lp-btn-secondary { padding:14px 32px;border-radius:8px;font-size:15px;font-weight:500;background:transparent;color:rgba(255,255,255,.75);border:1px solid rgba(255,255,255,.2);cursor:pointer;font-family:inherit;transition:all .2s; }
        .lp-btn-secondary:hover { border-color:rgba(255,255,255,.5);color:#fff; }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position:"fixed",top:0,left:0,right:0,zIndex:100,
        background:"rgba(15,22,35,.96)",backdropFilter:"blur(12px)",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 48px",height:64,borderBottom:"1px solid rgba(255,255,255,.06)"
      }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
       {/*   <div style={{ width:36,height:36,background:"#1D72E8",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff" }}>IQ</div> */}
         <img src="/nolyvra_logo.png" alt="nolyvra"
          style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
          <div style={{ lineHeight:1 }}>
            <div style={{ color:"#fff",fontSize:17,fontWeight:700,letterSpacing:"-.4px" }}>nolyvra</div>
            <div style={{ color:"rgba(255,255,255,.3)",fontSize:9,fontWeight:500,letterSpacing:"1.5px",textTransform:"uppercase",marginTop:2 }}>TALENT RUNS DEEP</div>
          </div>
        </div>
        <div style={{ display:"flex",gap:28 }}>
          {[["Why nolyvra","#problem"],["AI in Recruitment","#data"],["Features","#features"],["How It Works","#how"]].map(([l,h]) => (
            <a key={l} href={h} className="lp-nav-link">{l}</a>
          ))}
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <button onClick={() => nav("/login")} style={{ padding:"7px 18px",borderRadius:7,fontSize:13,fontWeight:500,border:"1px solid rgba(255,255,255,.2)",color:"rgba(255,255,255,.8)",background:"transparent",cursor:"pointer",fontFamily:"inherit",transition:"all .15s" }}>Login</button>
          <button onClick={openModal} style={{ padding:"7px 18px",borderRadius:7,fontSize:13,fontWeight:600,background:"#1D72E8",color:"#fff",border:"none",cursor:"pointer",fontFamily:"inherit" }}>Register Interest</button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight:"100vh",background:"linear-gradient(160deg,#0F1623 0%,#1B2A4A 50%,#0F1623 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:"100px 48px 80px",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(29,114,232,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(29,114,232,.06) 1px,transparent 1px)",backgroundSize:"60px 60px" }} />
        <div style={{ position:"absolute",top:-200,left:"50%",transform:"translateX(-50%)",width:800,height:600,background:"radial-gradient(ellipse,rgba(29,114,232,.18) 0%,transparent 70%)",pointerEvents:"none" }} />
        <div style={{ maxWidth:960,margin:"0 auto",textAlign:"center",position:"relative",zIndex:1 }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"rgba(29,114,232,.12)",border:"1px solid rgba(29,114,232,.3)",borderRadius:20,padding:"5px 14px",marginBottom:28 }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:"#3B8BFF",animation:"pulse 2s infinite" }} />
            <span style={{ fontSize:12,fontWeight:600,color:"#3B8BFF",letterSpacing:".3px" }}>AI-Powered Recruitment Intelligence</span>
          </div>
          <h1 style={{ fontSize:58,fontWeight:700,color:"#fff",lineHeight:1.1,letterSpacing:"-1.5px",marginBottom:12 }}>
            Recruitment is human-intensive.<br />
            It's time to make it <span style={{ background:"linear-gradient(135deg,#3B8BFF,#60A5FA)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>human-centric.</span>
          </h1>
          <p style={{ fontSize:22,fontWeight:300,color:"rgba(255,255,255,.55)",letterSpacing:"-.3px",marginBottom:32,lineHeight:1.5 }}>
            nolyvra uses AI to analyse candidates, detect risk signals<br />and surface insights — so recruiters can focus on people.
          </p>
          <div style={{ display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:56 }}>
            <button className="lp-btn-primary" onClick={openModal}>✦ Register Your Interest</button>
            <button className="lp-btn-secondary" onClick={() => nav("/login")}>Login to Platform →</button>
          </div>
          <div style={{ display:"flex",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,background:"rgba(255,255,255,.03)",backdropFilter:"blur(8px)",overflow:"hidden",maxWidth:680,margin:"0 auto" }}>
            {[["73%","Recruiter time on manual review"],["4×","Faster candidate screening with AI"],["$8.5B","AI recruitment market by 2027"],["68%","Of firms plan AI hiring tools"]].map(([val,lbl]) => (
              <div key={lbl} className="lp-hero-stat">
                <div style={{ fontSize:28,fontWeight:700,color:"#fff",letterSpacing:"-.5px",lineHeight:1 }}>{val}</div>
                <div style={{ fontSize:11,color:"rgba(255,255,255,.35)",marginTop:5,fontWeight:500,textTransform:"uppercase",letterSpacing:".5px" }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM SECTION ── */}
      <section id="problem" style={{ padding:"96px 48px",background:"#fff" }}>
        <div style={{ maxWidth:1100,margin:"0 auto" }}>
          <div style={{ textAlign:"center",marginBottom:0 }}>
            <span style={{ fontSize:11,fontWeight:700,color:"#1D72E8",textTransform:"uppercase",letterSpacing:"1.2px",display:"inline-block",marginBottom:12 }}>The Problem</span>
            <h2 style={{ fontSize:36,fontWeight:700,color:"#0F1623",letterSpacing:"-.8px",lineHeight:1.2,marginBottom:14,maxWidth:700,margin:"0 auto 12px" }}>Recruitment is drowning in data. Insights are scarce.</h2>
            <p style={{ fontSize:16,color:"#9AA3B4",lineHeight:1.7,maxWidth:600,margin:"0 auto",textAlign:"center" }}>Despite digital tools, most candidate evaluation remains manual — costing agencies time, money and quality hires.</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,alignItems:"center",marginTop:56 }}>
            <div>
              {["Artificial Intelligence is redefining how organisations identify, evaluate and hire talent. It has transitioned from research innovation to operational capability.",
                "Companies across industries are integrating AI to automate workflows, analyse data and augment decision-making.",
                "Recruitment remains one of the most human-intensive business functions despite digital tools. Recruitment agencies manage large volumes of candidate data across multiple roles and clients.",
                "Despite advancements in applicant tracking systems, the majority of recruiters' time is spent reviewing resumes and coordinating interviews — rather than engaging strategically with candidates."
              ].map((p,i) => <p key={i} style={{ fontSize:15,color:"#3D4A63",lineHeight:1.9,marginBottom:16 }}>{p}</p>)}
            </div>
            <div style={{ background:"linear-gradient(135deg,#EBF2FF,#F0F4FF)",border:"1px solid #BFDBFE",borderRadius:12,padding:28 }}>
              <div style={{ fontSize:12,fontWeight:700,color:"#1D72E8",textTransform:"uppercase",letterSpacing:".8px",marginBottom:16 }}>Industry Reality Check</div>
              {[["73%","of a recruiter's working week is spent on manual resume review and coordination tasks"],
                ["250+","average applications received per corporate job opening, mostly unscreened"],
                ["$14k","average cost of a bad hire — not including productivity and team impact"],
                ["42 days","average time-to-hire for professional roles in the current market"]].map(([n,t]) => (
                <div key={n} style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(191,219,254,.5)" }}>
                  <div style={{ fontSize:26,fontWeight:700,color:"#1D72E8",minWidth:64,lineHeight:1 }}>{n}</div>
                  <div style={{ fontSize:13,color:"#3D4A63",lineHeight:1.5 }}>{t}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section id="features" style={{ padding:"96px 48px",background:"#fff" }}>
        <div style={{ maxWidth:1100,margin:"0 auto" }}>
          <span style={{ fontSize:11,fontWeight:700,color:"#1D72E8",textTransform:"uppercase",letterSpacing:"1.2px",display:"inline-block",marginBottom:12 }}>Platform Capabilities</span>
          <h2 style={{ fontSize:36,fontWeight:700,color:"#0F1623",letterSpacing:"-.8px",lineHeight:1.2,marginBottom:14 }}>Everything a modern recruiter needs.</h2>
          <p style={{ fontSize:16,color:"#9AA3B4",lineHeight:1.7,maxWidth:600,marginBottom:48 }}>nolyvra combines AI analysis, risk detection and workflow management in one unified platform built for recruitment agencies.</p>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20 }}>
            {[["🔍","#EBF2FF","AI Candidate Analysis","CV vs LinkedIn consistency scoring, capability matrix and risk flag detection — all automated in seconds."],
              ["🛡","#F5F3FF","Fraud Detection","AI-generated resume detection, timeline inconsistency flags and skill inflation signals to protect hiring quality."],
              ["📊","#F0FDF4","Placement Probability","Predict hire likelihood using AI pattern matching across historical placements and candidate profiles."],
              ["✦","#FFFBEB","AI Talent Search","Natural language search across your internal database and market data to surface the best-fit candidates instantly."],
              ["📅","#FEF2F2","Interview Scheduling","Integrated calendar scheduling with Google Calendar and Outlook sync — send invites in one click."],
              ["✉","#EBF2FF","AI Email Generator","Generate professional candidate communications instantly — interview invites, follow-ups and offer letters."]
            ].map(([icon,bg,title,desc]) => (
              <div key={title} className="lp-feature-card">
                <div style={{ width:44,height:44,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,marginBottom:16 }}>{icon}</div>
                <div style={{ fontSize:15,fontWeight:700,color:"#0F1623",marginBottom:8 }}>{title}</div>
                <div style={{ fontSize:13,color:"#9AA3B4",lineHeight:1.7 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding:"96px 48px",background:"linear-gradient(160deg,#0F1623 0%,#1B2A4A 100%)",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(29,114,232,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(29,114,232,.04) 1px,transparent 1px)",backgroundSize:"50px 50px" }} />
        <div style={{ maxWidth:1100,margin:"0 auto",position:"relative",zIndex:1 }}>
          <span style={{ fontSize:11,fontWeight:700,color:"#3B8BFF",textTransform:"uppercase",letterSpacing:"1.2px",display:"inline-block",marginBottom:12 }}>How It Works</span>
          <h2 style={{ fontSize:36,fontWeight:700,color:"#fff",letterSpacing:"-.8px",lineHeight:1.2,marginBottom:14 }}>From CV to insight in minutes.</h2>
          <p style={{ fontSize:16,color:"rgba(255,255,255,.45)",lineHeight:1.7,maxWidth:600,marginBottom:56 }}>nolyvra's agentic AI analyses candidates end-to-end so your team focuses on relationships, not repetition.</p>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0 }}>
            {[["1","Post a Job","Paste a job description. AI extracts required skills, seniority signals and capability criteria automatically."],
              ["2","Add Candidate","Paste a CV or upload a PDF. Provide the LinkedIn URL for cross-validation."],
              ["3","Run AI Analysis","AI scores consistency, capability match, fraud signals and generates interview questions in seconds."],
              ["4","Hire Smarter","Use AI-ranked insights to engage the best candidates faster and submit higher quality shortlists."]
            ].map(([num,title,desc],i,arr) => (
              <div key={num} className="lp-step" style={{ textAlign:"center",padding:"0 20px",position:"relative" }}>
                {i < arr.length-1 && <span style={{ position:"absolute",right:-8,top:28,fontSize:18,color:"rgba(255,255,255,.15)" }}>→</span>}
                <div style={{ width:56,height:56,borderRadius:"50%",border:"2px solid rgba(29,114,232,.4)",background:"rgba(29,114,232,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#3B8BFF",margin:"0 auto 16px" }}>{num}</div>
                <div style={{ fontSize:14,fontWeight:600,color:"#fff",marginBottom:8 }}>{title}</div>
                <div style={{ fontSize:12,color:"rgba(255,255,255,.4)",lineHeight:1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section style={{ background:"linear-gradient(135deg,#0F1623 0%,#1B3A6B 100%)",textAlign:"center",padding:"96px 48px" }}>
        <div style={{ maxWidth:1100,margin:"0 auto" }}>
          <span style={{ fontSize:11,fontWeight:700,color:"#3B8BFF",textTransform:"uppercase",letterSpacing:"1.2px",display:"inline-block",marginBottom:12 }}>Early Access</span>
          <h2 style={{ fontSize:42,fontWeight:700,color:"#fff",letterSpacing:"-1px",marginBottom:16 }}>Ready to hire smarter?</h2>
          <p style={{ fontSize:17,color:"rgba(255,255,255,.5)",marginBottom:40,maxWidth:560,margin:"0 auto 40px",lineHeight:1.6 }}>Join forward-thinking recruitment agencies already on the nolyvra waitlist.</p>
          <div style={{ display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap" }}>
            <button className="lp-btn-primary" onClick={openModal}>✦ Register Your Interest</button>
            <button className="lp-btn-secondary" onClick={() => nav("/login")}>Login to Platform →</button>
          </div>
          <p style={{ marginTop:20,fontSize:12,color:"rgba(255,255,255,.2)" }}>No commitment required · One of our team will be in touch</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background:"#0F1623",padding:"40px 48px",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
      {/*    <div style={{ width:30,height:30,background:"#1D72E8",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff" }}>IQ</div> */}
         <img src="/nolyvra_logo.png" alt="nolyvra"
          style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
          <div>
            <div style={{ color:"rgba(255,255,255,.6)",fontSize:14,fontWeight:600 }}>nolyvra</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,.2)",fontStyle:"italic" }}>Talent Runs Deep</div>
          </div>
        </div>
        <div style={{ fontSize:12,color:"rgba(255,255,255,.25)" }}>© 2026 Golden Wattle Ventures Pvt Ltd · All rights reserved</div>
        <div style={{ fontSize:12,color:"rgba(255,255,255,.2)" }}>This AI tool is designed to assist, not replace professional judgment.</div>
      </footer>

      {/* ── REGISTER INTEREST MODAL ── */}
      {modalOpen && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="modal-box">
            <button onClick={() => setModalOpen(false)} style={{ position:"absolute",top:16,right:16,width:32,height:32,borderRadius:"50%",background:"#F7F8FA",border:"1px solid #E2E6ED",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#9AA3B4" }}>✕</button>

            {!submitted ? (
              <>
                <div style={{ fontSize:28,marginBottom:10 }}>✦</div>
                <div style={{ fontSize:22,fontWeight:700,color:"#0F1623",letterSpacing:"-.4px",marginBottom:6 }}>Register Your Interest</div>
                <div style={{ fontSize:13,color:"#9AA3B4",marginBottom:28,lineHeight:1.5 }}>Tell us about yourself and we'll be in touch shortly with early access details.</div>

                {formError && (
                  <div style={{ background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#DC2626" }}>{formError}</div>
                )}

                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16 }}>
                  <div>
                    <label style={{ display:"block",fontSize:12,fontWeight:600,color:"#0F1623",marginBottom:5 }}>First Name *</label>
                    <input className="form-input" type="text" placeholder="Sarah" value={form.firstName} onChange={e => setField("firstName", e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display:"block",fontSize:12,fontWeight:600,color:"#0F1623",marginBottom:5 }}>Last Name</label>
                    <input className="form-input" type="text" placeholder="Reynolds" value={form.lastName} onChange={e => setField("lastName", e.target.value)} />
                  </div>
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:"#0F1623",marginBottom:5 }}>Company *</label>
                  <input className="form-input" type="text" placeholder="Your recruitment agency" value={form.company} onChange={e => setField("company", e.target.value)} />
                </div>
                <div style={{ marginBottom:16 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:"#0F1623",marginBottom:5 }}>Email Address *</label>
                  <input className="form-input" type="email" placeholder="sarah@agency.com" value={form.email} onChange={e => setField("email", e.target.value)} />
                </div>
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:"block",fontSize:12,fontWeight:600,color:"#0F1623",marginBottom:5 }}>Phone Number</label>
                  <input className="form-input" type="tel" placeholder="+44 7000 000000" value={form.phone} onChange={e => setField("phone", e.target.value)} />
                </div>
                <button onClick={handleRegister} disabled={submitting} style={{ width:"100%",padding:12,borderRadius:8,fontSize:14,fontWeight:600,background:"#1D72E8",color:"#fff",border:"none",cursor:"pointer",fontFamily:"inherit",transition:"all .15s" }}>
                  {submitting ? "Submitting…" : "Submit →"}
                </button>
              </>
            ) : (
              <div style={{ textAlign:"center",paddingTop:24 }}>
                <div style={{ fontSize:48,marginBottom:12 }}>🎉</div>
                <div style={{ fontSize:18,fontWeight:700,color:"#0F1623",marginBottom:8 }}>Thank you for your interest!</div>
                <div style={{ fontSize:14,color:"#9AA3B4",lineHeight:1.6,marginBottom:20 }}>Thanks for your interest. One of our Customer Service Representatives will get in touch shortly.</div>
                <button onClick={() => setModalOpen(false)} style={{ padding:"10px 24px",borderRadius:7,background:"#1D72E8",color:"#fff",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
