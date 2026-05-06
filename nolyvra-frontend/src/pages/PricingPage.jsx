import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export default function PricingPage() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  // loginId passed from SettingsPage upgrade button, or from localStorage if logged in
  const loginId = searchParams.get("loginId") || localStorage.getItem("loginId") || "";
  const [isYearly, setIsYearly] = useState(true);
  const [subscribing, setSubscribing] = useState(null); // tracks which plan is loading

  async function handleSubscribe(planId) {
    if (!loginId) { nav("/login"); return; }
    setSubscribing(planId);
    try {
      const res = await fetch(
        `${API_BASE}/api/stripe/checkout?` +
        `loginId=${encodeURIComponent(loginId)}` +
        `&planId=${encodeURIComponent(planId)}` +
        `&billing=${isYearly ? "yearly" : "monthly"}` +
        `&successUrl=${encodeURIComponent(window.location.origin + "/settings")}` +
        `&cancelUrl=${encodeURIComponent(window.location.origin + "/pricing")}`,
        { method: "POST", headers: { "Authorization": `Bearer ${localStorage.getItem("sessionToken") || ""}` } }
      );
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // redirect to Stripe hosted checkout
      } else {
        alert(data.error || "Failed to start checkout. Please try again.");
      }
    } catch (e) {
      alert("Network error. Please try again.");
    } finally {
      setSubscribing(null);
    }
  }

  const CHECK = (color = "#16A34A") => (
    <div style={{ width:16,height:16,borderRadius:"50%",background:color==="green"?"#F0FDF4":color==="blue"?"#EBF2FF":color==="gold"?"#FEF3C7":"#F5F3FF",border:`1px solid ${color==="green"?"#BBF7D0":color==="blue"?"#BFDBFE":color==="gold"?"#FDE68A":"#C4B5FD"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
      <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-3" stroke={color==="green"?"#16A34A":color==="blue"?"#1D72E8":color==="gold"?"#D97706":"#7C3AED"} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </div>
  );
  const CROSS = (
    <div style={{ width:16,height:16,borderRadius:"50%",background:"#F1F5F9",border:"1px solid #CBD5E1",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
      <svg width="8" height="8" viewBox="0 0 8 8"><path d="M2 2l4 4M6 2l-4 4" stroke="#94A3B8" strokeWidth="1.2" fill="none" strokeLinecap="round"/></svg>
    </div>
  );

  const featItem = (text, checkColor = "green", dimmed = false) => (
    <div style={{ display:"flex",alignItems:"flex-start",gap:8,fontSize:12.5,color:dimmed?"#94A3B8":"#3D4A63",lineHeight:1.4,opacity:dimmed?0.5:1 }}>
      {dimmed ? CROSS : CHECK(checkColor)}
      {text}
    </div>
  );

  const limitItem = (val, lbl) => (
    <div style={{ background:"#F7F8FA",border:"1px solid #E2E6ED",borderRadius:7,padding:"8px 10px",textAlign:"center" }}>
      <div style={{ fontSize:15,fontWeight:700,color:"#0F1623",lineHeight:1 }}>{val}</div>
      <div style={{ fontSize:10,color:"#9AA3B4",marginTop:2,fontWeight:500,textTransform:"uppercase",letterSpacing:".4px" }}>{lbl}</div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif",color:"#0F1623",background:"#fff",overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .plan-card{background:#fff;border:1px solid #E2E6ED;border-radius:14px;padding:28px 24px;display:flex;flex-direction:column;position:relative;transition:box-shadow .2s,transform .2s;box-shadow:0 2px 8px rgba(0,0,0,.05)}
        .plan-card:hover{box-shadow:0 8px 32px rgba(0,0,0,.1);transform:translateY(-3px)}
        .plan-card.featured{border-color:#1D72E8;border-width:2px;box-shadow:0 0 0 4px rgba(29,114,232,.08),0 8px 32px rgba(29,114,232,.15);transform:translateY(-6px)}
        .plan-card.featured:hover{transform:translateY(-9px)}
        .pricing-btn{width:100%;padding:11px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;border:none}
        .pricing-nav-link{color:rgba(255,255,255,.5);font-size:13px;font-weight:500;text-decoration:none;transition:color .15s}
        .pricing-nav-link:hover{color:#fff}
        .info-card{background:#F7F8FA;border:1px solid #E2E6ED;border-radius:12px;padding:24px}
        .compare-table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #E2E6ED;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.04)}
        .compare-table th{padding:12px 16px;font-size:11px;font-weight:700;color:#9AA3B4;text-transform:uppercase;letter-spacing:.5px;background:#F7F8FA;border-bottom:1px solid #E2E6ED;text-align:center}
        .compare-table th:first-child{text-align:left}
        .compare-table td{padding:12px 16px;font-size:13px;border-bottom:1px solid #F4F6FA;text-align:center;color:#3D4A63}
        .compare-table td:first-child{text-align:left;font-weight:500;color:#0F1623}
        .compare-table tr:last-child td{border-bottom:none}
        .compare-table tr:nth-child(even) td{background:#FAFBFD}
      `}</style>

      {/* NAV */}
      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:100,background:"rgba(15,22,35,.96)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 48px",height:64,borderBottom:"1px solid rgba(255,255,255,.06)" }}>
        <a onClick={() => nav("/")} style={{ display:"flex",alignItems:"center",gap:10,cursor:"pointer",textDecoration:"none" }}>
        {/*  <div style={{ width:36,height:36,background:"#1D72E8",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff" }}>IQ</div> */}
          <img src="/nolyvra_logo.png" alt="nolyvra"
          style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
          <div style={{ lineHeight:1 }}>
            <div style={{ color:"#fff",fontSize:17,fontWeight:700,letterSpacing:"-.4px" }}>nolyvra</div>
            <div style={{ color:"rgba(255,255,255,.3)",fontSize:9,fontWeight:500,letterSpacing:"1.5px",textTransform:"uppercase",marginTop:2 }}>Intelligence. Evolved</div>
          </div>
        </a>
        <div style={{ display:"flex",gap:28 }}>
          <a onClick={() => nav("/")} className="pricing-nav-link" style={{ cursor:"pointer" }}>Home</a>
          <a onClick={() => nav("/")} className="pricing-nav-link" style={{ cursor:"pointer" }}>Features</a>
          <span style={{ color:"#fff",fontSize:13,fontWeight:500 }}>Pricing</span>
          <a onClick={() => nav("/")} className="pricing-nav-link" style={{ cursor:"pointer" }}>How It Works</a>
        </div>
        <div style={{ display:"flex",gap:10 }}>
          <button onClick={() => nav("/dashboard")} style={{ padding:"7px 18px",borderRadius:7,fontSize:13,fontWeight:500,border:"1px solid rgba(255,255,255,.2)",color:"rgba(255,255,255,.8)",background:"transparent",cursor:"pointer",fontFamily:"inherit" }}>← Dashboard</button>
          <button onClick={() => nav("/login")} style={{ padding:"7px 18px",borderRadius:7,fontSize:13,fontWeight:500,border:"1px solid rgba(255,255,255,.2)",color:"rgba(255,255,255,.8)",background:"transparent",cursor:"pointer",fontFamily:"inherit" }}>Login</button>
          <button onClick={() => nav("/")} style={{ padding:"7px 18px",borderRadius:7,fontSize:13,fontWeight:600,background:"#1D72E8",color:"#fff",border:"none",cursor:"pointer",fontFamily:"inherit" }}>Register Interest</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ paddingTop:120,paddingBottom:64,paddingLeft:48,paddingRight:48,background:"linear-gradient(160deg,#0F1623 0%,#1B2A4A 60%,#0F1623 100%)",textAlign:"center",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(29,114,232,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(29,114,232,.05) 1px,transparent 1px)",backgroundSize:"60px 60px",pointerEvents:"none" }} />
        <div style={{ position:"absolute",top:-100,left:"50%",transform:"translateX(-50%)",width:700,height:400,background:"radial-gradient(ellipse,rgba(29,114,232,.15) 0%,transparent 70%)",pointerEvents:"none" }} />
        <div style={{ position:"relative",zIndex:1,maxWidth:700,margin:"0 auto" }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:8,background:"rgba(29,114,232,.12)",border:"1px solid rgba(29,114,232,.3)",borderRadius:20,padding:"5px 14px",marginBottom:24 }}>
            <div style={{ width:6,height:6,borderRadius:"50%",background:"#3B8BFF",animation:"pulse 2s infinite" }} />
            <span style={{ fontSize:12,fontWeight:600,color:"#3B8BFF" }}>Simple, Transparent Pricing</span>
          </div>
          <h1 style={{ fontSize:48,fontWeight:700,color:"#fff",letterSpacing:"-1.2px",lineHeight:1.1,marginBottom:14 }}>
            Invest in <span style={{ background:"linear-gradient(135deg,#3B8BFF,#60A5FA)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text" }}>smarter hiring.</span><br/>Not more headcount.
          </h1>
          <p style={{ fontSize:17,color:"rgba(255,255,255,.5)",lineHeight:1.6,fontWeight:300,marginBottom:40 }}>Start free. Scale as you grow. Every plan includes full AI analysis, risk detection and candidate insights.</p>

          {/* Billing toggle */}
          <div style={{ display:"inline-flex",alignItems:"center",gap:14,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:40,padding:"6px 6px 6px 18px",marginBottom:16 }}>
            <span onClick={() => setIsYearly(true)} style={{ fontSize:13,fontWeight:isYearly?600:500,color:isYearly?"#fff":"rgba(255,255,255,.5)",cursor:"pointer",userSelect:"none" }}>Yearly</span>
            <button onClick={() => setIsYearly(p => !p)} style={{ width:48,height:26,borderRadius:13,background:"#1D72E8",cursor:"pointer",position:"relative",border:"none",outline:"none",flexShrink:0 }}>
              <div style={{ position:"absolute",top:3,left:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"transform .2s",transform:isYearly?"translateX(22px)":"translateX(0)",boxShadow:"0 1px 4px rgba(0,0,0,.2)" }} />
            </button>
            <span onClick={() => setIsYearly(false)} style={{ fontSize:13,fontWeight:!isYearly?600:500,color:!isYearly?"#fff":"rgba(255,255,255,.5)",cursor:"pointer",userSelect:"none",paddingRight:12 }}>Monthly</span>
          </div>
          <div style={{ marginBottom:48 }}>
            {isYearly
              ? <span style={{ display:"inline-flex",alignItems:"center",background:"rgba(22,163,74,.15)",border:"1px solid rgba(22,163,74,.3)",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600,color:"#4ADE80" }}>🎉 Save up to 34% with yearly billing · First year launch pricing</span>
              : <span style={{ display:"inline-flex",alignItems:"center",background:"rgba(29,114,232,.12)",border:"1px solid rgba(29,114,232,.3)",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600,color:"#3B8BFF" }}>💡 Switch to Yearly and save up to 34%</span>}
          </div>
        </div>
      </div>

      {/* PRICING CARDS */}
      <div style={{ padding:"0 48px 96px",background:"#F7F8FA" }}>
        <div style={{ maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:16,alignItems:"stretch" }}>

          {/* FREE */}
          <div className="plan-card">
            <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:".4px",textTransform:"uppercase",marginBottom:14,background:"#F1F5F9",color:"#64748B",border:"1px solid #CBD5E1",alignSelf:"flex-start" }}>🆓 Free</span>
            <div style={{ fontSize:18,fontWeight:700,color:"#0F1623",marginBottom:5 }}>Free Trial</div>
            <div style={{ fontSize:12,color:"#9AA3B4",lineHeight:1.5,marginBottom:20,minHeight:36 }}>Try nolyvra free for 1 month. No credit card required.</div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:32,fontWeight:700,letterSpacing:"-.8px",lineHeight:1.2 }}>$0</div>
              <div style={{ fontSize:12,color:"#9AA3B4",marginTop:3 }}>1 month trial · No card needed</div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20 }}>
              {limitItem("3","Candidates")}{limitItem("10","Jobs")}{limitItem("100","Tokens")}{limitItem("1","User")}
            </div>
            <div style={{ height:1,background:"#E2E6ED",margin:"18px 0" }} />
            <div style={{ display:"flex",flexDirection:"column",gap:9,flex:1,marginBottom:22 }}>
              {featItem("AI Candidate Analysis")}
              {featItem("CV vs LinkedIn Scoring")}
              {featItem("Risk Flag Detection")}
              {featItem("Authenticity Detection")}
              {featItem("Placement Probability")}
              {featItem("AI Email Generator")}
              {featItem("Interview Scheduler")}
              {featItem("Advanced Analytics",null,true)}
              {featItem("Dedicated Support",null,true)}
            </div>
            <button className="pricing-btn" onClick={() => nav("/login")} style={{ background:"#F7F8FA",color:"#0F1623",border:"1px solid #E2E6ED" }}>Start Free Trial</button>
          </div>

          {/* BRONZE */}
          <div className="plan-card">
            <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:".4px",textTransform:"uppercase",marginBottom:14,background:"#FEF3C7",color:"#92400E",border:"1px solid #FDE68A",alignSelf:"flex-start" }}>🥉 Bronze</span>
            <div style={{ fontSize:18,fontWeight:700,color:"#0F1623",marginBottom:5 }}>Solopreneur</div>
            <div style={{ fontSize:12,color:"#9AA3B4",lineHeight:1.5,marginBottom:20,minHeight:36 }}>Perfect for independent recruiters managing their own desk.</div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13,color:"#9AA3B4",textDecoration:"line-through",minHeight:20 }}>{isYearly?"$149 / month":"$199 / month"}</div>
              <div style={{ display:"flex",alignItems:"baseline",gap:3,marginBottom:2 }}>
                <span style={{ fontSize:18,fontWeight:600,color:"#0F1623" }}>$</span>
                <span style={{ fontSize:36,fontWeight:700,color:"#0F1623",letterSpacing:"-1px",lineHeight:1 }}>{isYearly?"99":"149"}</span>
                <span style={{ fontSize:12,color:"#9AA3B4" }}>/ month{isYearly?" · billed yearly":""}</span>
              </div>
              <span style={{ display:"inline-flex",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:600,color:"#16A34A",marginTop:5 }}>{isYearly?"Save $600/yr · First year pricing":"Save $50/mo · Launch pricing"}</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20 }}>
              {limitItem("100","Candidates")}{limitItem("50","Jobs")}{limitItem("500","Tokens/mo")}{limitItem("1","User")}
            </div>
            <div style={{ height:1,background:"#E2E6ED",margin:"18px 0" }} />
            <div style={{ display:"flex",flexDirection:"column",gap:9,flex:1,marginBottom:22 }}>
              {featItem("Everything in Free")}
              {featItem("AI Talent Search","blue")}
              {featItem("Interview Scheduler","blue")}
              {featItem("Client Brief Analyzer","blue")}
              {featItem("Limited Email Support","blue")}
              {featItem("Advanced AI Model",null,true)}
              {featItem("Multi-user Access",null,true)}
            </div>
            <button className="pricing-btn" onClick={() => handleSubscribe("plan-bronze")} disabled={subscribing === "plan-bronze"} style={{ background:"#1D72E8",color:"#fff",opacity:subscribing==="plan-bronze"?0.7:1 }}>{subscribing === "plan-bronze" ? "Redirecting…" : "Get Started"}</button>
            <div style={{ fontSize:10,color:"#16A34A",fontWeight:600,textAlign:"center",marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:4 }}>✦ First year launch pricing</div>
          </div>

          {/* SILVER — FEATURED */}
          <div className="plan-card featured">
            <div style={{ position:"absolute",top:-13,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#1D72E8,#3B8BFF)",color:"#fff",fontSize:11,fontWeight:700,padding:"4px 14px",borderRadius:20,whiteSpace:"nowrap",letterSpacing:".3px",boxShadow:"0 2px 8px rgba(29,114,232,.4)" }}>⭐ Most Popular</div>
            <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:".4px",textTransform:"uppercase",marginBottom:14,background:"#F1F5F9",color:"#475569",border:"1px solid #CBD5E1",alignSelf:"flex-start" }}>🥈 Silver</span>
            <div style={{ fontSize:18,fontWeight:700,color:"#0F1623",marginBottom:5 }}>Small Enterprise</div>
            <div style={{ fontSize:12,color:"#9AA3B4",lineHeight:1.5,marginBottom:20,minHeight:36 }}>For growing recruitment teams managing multiple clients.</div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13,color:"#9AA3B4",textDecoration:"line-through",minHeight:20 }}>{isYearly?"$299 / month":"$349 / month"}</div>
              <div style={{ display:"flex",alignItems:"baseline",gap:3,marginBottom:2 }}>
                <span style={{ fontSize:18,fontWeight:600,color:"#0F1623" }}>$</span>
                <span style={{ fontSize:36,fontWeight:700,color:"#0F1623",letterSpacing:"-1px",lineHeight:1 }}>{isYearly?"199":"249"}</span>
                <span style={{ fontSize:12,color:"#9AA3B4" }}>/ month{isYearly?" · billed yearly":""}</span>
              </div>
              <span style={{ display:"inline-flex",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:600,color:"#16A34A",marginTop:5 }}>{isYearly?"Save $1,200/yr · First year pricing":"Save $100/mo · Launch pricing"}</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20 }}>
              {limitItem("500","Candidates")}{limitItem("250","Jobs")}{limitItem("750","Tokens/mo")}{limitItem("5","Users")}
            </div>
            <div style={{ height:1,background:"#E2E6ED",margin:"18px 0" }} />
            <div style={{ display:"flex",flexDirection:"column",gap:9,flex:1,marginBottom:22 }}>
              {featItem("Everything in Bronze")}
              {featItem("Advanced AI Model","blue")}
              {featItem("Email Integration","blue")}
              {featItem("Chat Integration","blue")}
              {featItem("LinkedIn / Indeed / Seek Search","blue")}
              {featItem("5 Team Members","blue")}
              {featItem("Priority Support","blue")}
            </div>
            <button className="pricing-btn" onClick={() => handleSubscribe("plan-silver")} disabled={subscribing === "plan-silver"} style={{ background:"#1D72E8",color:"#fff",opacity:subscribing==="plan-silver"?0.7:1 }}>{subscribing === "plan-silver" ? "Redirecting…" : "Get Started"}</button>
            <div style={{ fontSize:10,color:"#16A34A",fontWeight:600,textAlign:"center",marginTop:8 }}>✦ First year launch pricing</div>
          </div>

          {/* GOLD */}
          <div className="plan-card">
            <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:".4px",textTransform:"uppercase",marginBottom:14,background:"#FEF3C7",color:"#78350F",border:"1px solid #FCD34D",alignSelf:"flex-start" }}>🥇 Gold</span>
            <div style={{ fontSize:18,fontWeight:700,color:"#0F1623",marginBottom:5 }}>Medium Enterprise</div>
            <div style={{ fontSize:12,color:"#9AA3B4",lineHeight:1.5,marginBottom:20,minHeight:36 }}>For established agencies with high-volume hiring needs.</div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:13,color:"#9AA3B4",textDecoration:"line-through",minHeight:20 }}>{isYearly?"$449 / month":"$499 / month"}</div>
              <div style={{ display:"flex",alignItems:"baseline",gap:3,marginBottom:2 }}>
                <span style={{ fontSize:18,fontWeight:600,color:"#0F1623" }}>$</span>
                <span style={{ fontSize:36,fontWeight:700,color:"#0F1623",letterSpacing:"-1px",lineHeight:1 }}>{isYearly?"299":"399"}</span>
                <span style={{ fontSize:12,color:"#9AA3B4" }}>/ month{isYearly?" · billed yearly":""}</span>
              </div>
              <span style={{ display:"inline-flex",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:4,padding:"2px 7px",fontSize:11,fontWeight:600,color:"#16A34A",marginTop:5 }}>{isYearly?"Save $1,800/yr · First year pricing":"Save $100/mo · Launch pricing"}</span>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20 }}>
              {limitItem("1,500","Candidates")}{limitItem("750","Jobs")}{limitItem("3,000","Tokens/mo")}{limitItem("15","Users")}
            </div>
            <div style={{ height:1,background:"#E2E6ED",margin:"18px 0" }} />
            <div style={{ display:"flex",flexDirection:"column",gap:9,flex:1,marginBottom:22 }}>
              {featItem("Everything in Silver")}
              {featItem("Premium AI Engine","gold")}
              {featItem("Video Interview","gold")}
              {featItem("Advanced Analytics","gold")}
              {featItem("15 Team Members","gold")}
              {featItem("Dedicated Support","gold")}
            </div>
            <button className="pricing-btn" onClick={() => handleSubscribe("plan-gold")} disabled={subscribing === "plan-gold"} style={{ background:"#1D72E8",color:"#fff",opacity:subscribing==="plan-gold"?0.7:1 }}>{subscribing === "plan-gold" ? "Redirecting…" : "Get Started"}</button>
            <div style={{ fontSize:10,color:"#16A34A",fontWeight:600,textAlign:"center",marginTop:8 }}>✦ First year launch pricing</div>
          </div>

          {/* ENTERPRISE */}
          <div className="plan-card">
            <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,letterSpacing:".4px",textTransform:"uppercase",marginBottom:14,background:"#F5F3FF",color:"#5B21B6",border:"1px solid #C4B5FD",alignSelf:"flex-start" }}>💎 Enterprise</span>
            <div style={{ fontSize:18,fontWeight:700,color:"#0F1623",marginBottom:5 }}>Large Enterprise</div>
            <div style={{ fontSize:12,color:"#9AA3B4",lineHeight:1.5,marginBottom:20,minHeight:36 }}>Custom solutions for large-scale recruitment operations.</div>
            <div style={{ marginBottom:8 }}>
              <div style={{ minHeight:20 }}>&nbsp;</div>
              <div style={{ fontSize:24,fontWeight:700,color:"#5B21B6",letterSpacing:"-.4px",lineHeight:1.2 }}>Custom<br/>Pricing</div>
              <div style={{ fontSize:12,color:"#9AA3B4",marginTop:6 }}>Tailored to your organisation</div>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:20 }}>
              {limitItem("∞","Candidates")}{limitItem("∞","Jobs")}{limitItem("Custom","Tokens")}{limitItem("∞","Users")}
            </div>
            <div style={{ height:1,background:"#E2E6ED",margin:"18px 0" }} />
            <div style={{ display:"flex",flexDirection:"column",gap:9,flex:1,marginBottom:22 }}>
              {featItem("Everything in Gold")}
              {featItem("Dedicated Account Manager","purple")}
              {featItem("Custom Integrations","purple")}
              {featItem("SLA & Uptime Guarantee","purple")}
              {featItem("White-label Options","purple")}
            </div>
            <button className="pricing-btn" style={{ background:"#0F1623",color:"#fff" }}>Contact Sales →</button>
          </div>

        </div>
      </div>

      {/* TOKEN INFO / FAQ */}
      <div style={{ padding:"64px 48px",background:"#fff" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ fontSize:24,fontWeight:700,color:"#0F1623",letterSpacing:"-.4px",marginBottom:32,textAlign:"center" }}>Frequently Asked Questions</div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20 }}>
            {[["🪙","What is a Token?","Tokens power AI analysis. Each candidate analysis consumes tokens for CV scoring, authenticity detection, interview question generation and placement probability. 1 full analysis ≈ 10 tokens."],
              ["🔄","Do tokens roll over?","Tokens reset monthly. Unused tokens do not roll over to the next month. Additional token packs can be purchased any time from your account settings."],
              ["💳","Can I change my plan?","Yes. You can upgrade or downgrade at any time. Upgrades take effect immediately. Downgrades take effect at the start of your next billing cycle."],
              ["🔒","Is my data secure?","All candidate and job data is encrypted at rest and in transit. nolyvra does not store PII beyond what is needed for analysis and never shares data with third parties."],
              ["🎁","What is launch pricing?","Our first-year launch pricing is a special discount for early adopters. Prices shown are locked in for your first full year — no surprise increases after signup."],
              ["🏢","Need more users?","Each plan has a user limit. If you need more seats than your plan allows, contact us to discuss a custom arrangement or upgrade to the Enterprise plan."]
            ].map(([icon,title,body]) => (
              <div key={title} className="info-card">
                <div style={{ fontSize:24,marginBottom:10 }}>{icon}</div>
                <div style={{ fontSize:14,fontWeight:700,color:"#0F1623",marginBottom:6 }}>{title}</div>
                <div style={{ fontSize:13,color:"#9AA3B4",lineHeight:1.7 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COMPARE TABLE */}
      <div style={{ padding:"0 48px 80px",background:"#F7F8FA" }}>
        <div style={{ maxWidth:1200,margin:"0 auto" }}>
          <div style={{ fontSize:24,fontWeight:700,color:"#0F1623",letterSpacing:"-.4px",marginBottom:24,textAlign:"center" }}>Full Feature Comparison</div>
          <table className="compare-table">
            <thead>
              <tr>
                <th style={{ width:"28%",textAlign:"left" }}>Feature</th>
                <th>Free</th><th style={{ background:"rgba(29,114,232,.04)" }}>Bronze</th>
                <th style={{ background:"rgba(29,114,232,.08)" }}>Silver ⭐</th>
                <th>Gold</th><th>Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {[["Candidates / month","3","100","500","1,500","Unlimited"],
                ["Jobs","10","50","250","750","Unlimited"],
                ["AI Tokens / month","100","500","750","3,000","Custom"],
                ["Users","1","1","5","15","Unlimited"],
              ].map(([feat,...vals]) => (
                <tr key={feat}>
                  <td>{feat}</td>
                  {vals.map((v,i) => <td key={i} style={i===1||i===2?{background:"rgba(29,114,232,.04)"}:{}}>{v}</td>)}
                </tr>
              ))}
              {[["AI Candidate Analysis",1,1,1,1,1],
                ["CV vs LinkedIn Scoring",1,1,1,1,1],
                ["Risk Flag Detection",1,1,1,1,1],
                ["Authenticity Detection",1,1,1,1,1],
                ["Placement Probability",1,1,1,1,1],
                ["AI Email Generator",1,1,1,1,1],
                ["AI Talent Search",0,1,1,1,1],
                ["Interview Scheduler",0,1,1,1,1],
                ["Client Brief Analyzer",0,1,1,1,1],
                ["Advanced AI Model",0,0,1,1,1],
                ["Email Integration",0,0,1,1,1],
                ["Video Interview",0,0,0,1,1],
                ["Advanced Analytics",0,0,0,1,1],
                ["Custom Integrations",0,0,0,0,1],
                ["SLA Guarantee",0,0,0,0,1],
              ].map(([feat,...vals]) => (
                <tr key={feat}>
                  <td>{feat}</td>
                  {vals.map((v,i) => (
                    <td key={i} style={i===1||i===2?{background:"rgba(29,114,232,.04)"}:{}}>
                      {v ? <span style={{ color:"#16A34A",fontSize:15 }}>✓</span> : <span style={{ color:"#CBD5E1",fontSize:15 }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td>Support</td>
                <td>—</td>
                <td style={{ background:"rgba(29,114,232,.04)" }}>Limited Email</td>
                <td style={{ background:"rgba(29,114,232,.08)" }}>Priority</td>
                <td>Dedicated</td>
                <td>Account Manager</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div style={{ background:"linear-gradient(135deg,#0F1623 0%,#1B3A6B 100%)",padding:"80px 48px",textAlign:"center" }}>
        <div style={{ maxWidth:600,margin:"0 auto" }}>
          <div style={{ fontSize:11,fontWeight:700,color:"#3B8BFF",textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:12 }}>Ready to get started?</div>
          <div style={{ fontSize:36,fontWeight:700,color:"#fff",letterSpacing:"-.8px",marginBottom:12 }}>Start free. Scale with confidence.</div>
          <div style={{ fontSize:16,color:"rgba(255,255,255,.45)",marginBottom:32,lineHeight:1.6 }}>No credit card required for the free trial.</div>
          <div style={{ display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap" }}>
            <button onClick={() => nav("/login")} style={{ padding:"13px 30px",borderRadius:8,fontSize:14,fontWeight:600,background:"#1D72E8",color:"#fff",border:"none",cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 24px rgba(29,114,232,.4)" }}>Start Free Trial</button>
            <button style={{ padding:"13px 30px",borderRadius:8,fontSize:14,fontWeight:500,background:"transparent",color:"rgba(255,255,255,.7)",border:"1px solid rgba(255,255,255,.2)",cursor:"pointer",fontFamily:"inherit" }}>Contact Sales →</button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background:"#0F1623",padding:"36px 48px",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
        {/*  <div style={{ width:30,height:30,background:"#1D72E8",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff" }}>IQ</div> */}
          <img src="/nolyvra_logo.png" alt="nolyvra"
          style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
          <div>
            <div style={{ color:"rgba(255,255,255,.6)",fontSize:14,fontWeight:600 }}>nolyvra</div>
            <div style={{ fontSize:11,color:"rgba(255,255,255,.2)",fontStyle:"italic" }}>Intelligence. Evolved</div>
          </div>
        </div>
        <div style={{ fontSize:12,color:"rgba(255,255,255,.25)" }}>© 2026 nolyvra· All rights reserved</div>
        <div style={{ fontSize:12,color:"rgba(255,255,255,.2)" }}>Prices shown include applicable taxes.</div>
      </footer>
    </div>
  );
}
