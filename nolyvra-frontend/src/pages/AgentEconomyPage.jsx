import { useState } from "react";
import { useNavigate } from "react-router-dom";

const SLIDES = [
  {
    id: 1,
    tag: "Agent Economy",
    heading: ["Shift to the", "Agent Economy"],
    headingHighlight: "Agent Economy",
    body: "We're entering something much bigger than automation — something that fundamentally changes how work gets done.",
    arrow: "The Agent Economy",
    type: "hero",
  },
  {
    id: 2,
    tag: "Definition",
    heading: ["What is", "an Agent?"],
    subtitle: "An AI Agent is not just a chatbot — it can:",
    items: [
      { icon: "🗺️", text: "Navigate complex systems end-to-end" },
      { icon: "📊", text: "Read & interpret structured data" },
      { icon: "⚙️", text: "Follow multi-step workflows" },
      { icon: "⚡", text: "Take actions autonomously" },
    ],
    type: "grid",
  },
  {
    id: 3,
    tag: "The Shift",
    heading: ["The", "Big Shift"],
    headingHighlight: "Big Shift",
    context: "When you launch an agent to perform a task, it should be able to:",
    flows: ["Navigate documentation", "Interpret context intelligently", "Execute workflows precisely"],
    note: ["Not just respond… but ", "act.", " That's the real difference."],
    type: "flow",
  },
  {
    id: 4,
    tag: "Use Case",
    heading: ["Future of", "Recruitment"],
    headingHighlight: "Recruitment",
    agents: [
      "Agents screen candidates",
      "Agents validate experience",
      "Agents highlight risks & gaps",
      "Agents assist decisions in real-time",
    ],
    conclusion: ["Recruiters don't lose control — ", "they gain leverage."],
    type: "list",
  },
  {
    id: 5,
    type: "outro",
  },
];

export default function AgentEconomyPage() {
  const nav = useNavigate();
  const [current, setCurrent] = useState(0);

  const goTo = (n) => { if (n >= 0 && n < SLIDES.length) setCurrent(n); };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#06091e", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }

        .ae-slide { animation: fadeUp .35s ease; }

        .ae-nav-btn {
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.12);
          color: #fff;
          width: 42px; height: 42px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 17px;
          display: flex; align-items: center; justify-content: center;
          transition: all .2s;
          flex-shrink: 0;
        }
        .ae-nav-btn:hover:not(:disabled) { background: rgba(74,144,217,.2); border-color: rgba(74,144,217,.4); }
        .ae-nav-btn:disabled { opacity: .28; cursor: default; }

        .ae-dot {
          height: 6px; border-radius: 3px;
          background: rgba(255,255,255,.2);
          cursor: pointer; transition: all .25s;
          border: none;
        }
        .ae-dot.active { background: #4a90d9; }

        .ae-item-card {
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 12px;
          padding: 18px;
          display: flex; flex-direction: column; gap: 10px;
          transition: border-color .2s;
        }
        .ae-item-card:hover { border-color: rgba(74,144,217,.3); }

        .ae-flow-dot {
          width: 8px; height: 8px;
          background: #4a90d9; border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 10px rgba(74,144,217,.5);
        }

        .ae-back-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: transparent;
          border: 1px solid rgba(255,255,255,.15);
          color: rgba(255,255,255,.6);
          padding: 8px 16px; border-radius: 8px;
          font-size: 13px; font-family: inherit;
          cursor: pointer; transition: all .2s;
        }
        .ae-back-btn:hover { border-color: rgba(255,255,255,.35); color: #fff; }

        /* ── Responsive ── */
        @media (max-width: 600px) {
          .ae-slide-card { padding: 28px 22px !important; }
          .ae-hero-h1 { font-size: 36px !important; line-height: 1.1 !important; }
          .ae-h2 { font-size: 30px !important; }
          .ae-items-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .ae-item-card { padding: 14px !important; }
          .ae-outro-brand { font-size: 48px !important; }
          .ae-outro-msg { font-size: 17px !important; }
          .ae-ring1 { width: 300px !important; height: 300px !important; }
          .ae-ring2 { width: 220px !important; height: 220px !important; }
          .ae-ring3 { width: 140px !important; height: 140px !important; }
          .ae-slide-wrapper { height: auto !important; min-height: 480px !important; }
          .ae-controls-row { flex-wrap: wrap !important; gap: 12px !important; }
        }
      `}</style>

      {/* ── TOP BAR ── */}
      <div style={{ background: "rgba(6,9,30,.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,.06)", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/nolyvra_logo.png" alt="nolyvra" style={{ width: 32, height: 32, borderRadius: 7, objectFit: "cover" }} />
          <div style={{ lineHeight: 1 }}>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: "-.3px" }}>nolyvra</div>
            <div style={{ color: "rgba(255,255,255,.28)", fontSize: 8, fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase", marginTop: 1 }}>Intelligence. Evolved</div>
          </div>
        </div>
        <button className="ae-back-btn" onClick={() => nav("/")}>← Back to Home</button>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px 48px" }}>

        {/* Page title */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(74,144,217,.1)", border: "1px solid rgba(74,144,217,.25)", borderRadius: 20, padding: "5px 14px", marginBottom: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4a90d9", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#4a90d9", letterSpacing: "2px", textTransform: "uppercase", fontFamily: "'Space Mono', monospace" }}>AI in Recruitment</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-.5px" }}>The Agent Economy</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.35)", fontFamily: "'Space Mono', monospace", letterSpacing: "1px" }}>Intelligence. Evolved.</p>
        </div>

        {/* Slide card */}
        <div
          className="ae-slide-wrapper"
          style={{ width: "100%", maxWidth: 580, height: 520, position: "relative" }}
        >
          <SlideCard slide={SLIDES[current]} key={current} />
        </div>

        {/* Controls */}
        <div className="ae-controls-row" style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 28, justifyContent: "center" }}>
          <button className="ae-nav-btn" onClick={() => goTo(current - 1)} disabled={current === 0} aria-label="Previous">&#8592;</button>

          {/* Dots */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                className={`ae-dot${i === current ? " active" : ""}`}
                style={{ width: i === current ? 22 : 6 }}
                onClick={() => goTo(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>

          <button className="ae-nav-btn" onClick={() => goTo(current + 1)} disabled={current === SLIDES.length - 1} aria-label="Next">&#8594;</button>
        </div>

        {/* Counter */}
        <div style={{ marginTop: 12, fontFamily: "'Space Mono', monospace", fontSize: 11, color: "rgba(255,255,255,.25)", letterSpacing: "2px" }}>
          {String(current + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */
function SlideCard({ slide }) {
  const base = {
    width: "100%", height: "100%",
    background: "#06091e",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: 18,
    padding: "36px 36px 32px",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.05)",
  };

  const Logo = () => (
    <img
      src="/nolyvra_logo.png"
      alt="nolyvra"
      style={{ position: "absolute", top: 22, right: 22, width: 40, height: 40, borderRadius: 8, objectFit: "cover", zIndex: 10, opacity: .9 }}
    />
  );

  const Tag = ({ label }) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(74,144,217,.1)", border: "1px solid rgba(74,144,217,.22)", borderRadius: 20, padding: "4px 13px", width: "fit-content", marginBottom: 22 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: "#4a90d9", letterSpacing: "3px", textTransform: "uppercase", fontFamily: "'Space Mono', monospace" }}>&#9632; {label}</span>
    </div>
  );

  // ── HERO ──
  if (slide.type === "hero") {
    return (
      <div className="ae-slide ae-slide-card" style={{ ...base, justifyContent: "flex-end", background: "radial-gradient(ellipse at 70% -10%, rgba(26,58,143,.18) 0%, transparent 55%), radial-gradient(ellipse at 10% 110%, rgba(10,31,96,.18) 0%, transparent 55%), #06091e" }}>
        {/* Large ghost number */}
        <div style={{ position: "absolute", top: -20, right: -10, fontFamily: "'Space Mono', monospace", fontSize: 180, fontWeight: 700, color: "rgba(255,255,255,.025)", lineHeight: 1, userSelect: "none", pointerEvents: "none" }}>01</div>
        {/* Bottom bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent 0%, #4a90d9 40%, #a8d4ff 60%, transparent 100%)", opacity: .5 }} />
        <Logo />
        <Tag label={slide.tag} />
        <h1 className="ae-hero-h1" style={{ fontSize: 48, fontWeight: 800, color: "#fff", lineHeight: 1.08, marginBottom: 18, letterSpacing: "-.5px" }}>
          {slide.heading[0]}<br />
          <span style={{ background: "linear-gradient(135deg, #4a90d9 0%, #a8d4ff 60%, #d0eaff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{slide.heading[1]}</span>
        </h1>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,.42)", lineHeight: 1.65, marginBottom: 32, maxWidth: 380 }}>{slide.body}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 17, fontWeight: 700, color: "#4a90d9" }}>
          <div style={{ width: 34, height: 34, background: "rgba(74,144,217,.14)", border: "1px solid rgba(74,144,217,.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>→</div>
          {slide.arrow}
        </div>
      </div>
    );
  }

  // ── GRID (What is an Agent) ──
  if (slide.type === "grid") {
    return (
      <div className="ae-slide ae-slide-card" style={{ ...base }}>
        {/* Grid BG */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(74,144,217,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(74,144,217,.045) 1px,transparent 1px)", backgroundSize: "46px 46px", maskImage: "radial-gradient(ellipse at 50% 50%, black 25%, transparent 75%)", borderRadius: 18 }} />
        <Logo />
        <Tag label={slide.tag} />
        <h2 className="ae-h2" style={{ fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1.12, marginBottom: 8, letterSpacing: "-.3px" }}>
          {slide.heading[0]}<br />{slide.heading[1]}
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,.38)", marginBottom: 24, letterSpacing: ".3px" }}>{slide.subtitle}</p>
        <div className="ae-items-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1 }}>
          {slide.items.map(it => (
            <div key={it.text} className="ae-item-card">
              <div style={{ width: 34, height: 34, background: "rgba(74,144,217,.11)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{it.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.82)", lineHeight: 1.35 }}>{it.text}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── FLOW (Big Shift) ──
  if (slide.type === "flow") {
    return (
      <div className="ae-slide ae-slide-card" style={{ ...base, justifyContent: "center" }}>
        {/* Glow */}
        <div style={{ position: "absolute", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(74,144,217,.1) 0%, transparent 70%)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
        <Logo />
        <h2 className="ae-h2" style={{ fontSize: 42, fontWeight: 800, color: "#fff", marginBottom: 12, letterSpacing: "-.3px", lineHeight: 1.05 }}>
          {slide.heading[0]}{" "}
          <span style={{ background: "linear-gradient(135deg, #4a90d9, #a8d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{slide.heading[1]}</span>
        </h2>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.38)", marginBottom: 32, lineHeight: 1.6 }}>{slide.context}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {slide.flows.map((f, i) => (
            <div key={f}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
                <span style={{ color: "#4a90d9", fontSize: 16, fontWeight: 700, fontFamily: "'Space Mono', monospace", flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,.88)" }}>{f}</span>
              </div>
              {i < slide.flows.length - 1 && <div style={{ width: 1, height: 14, background: "rgba(74,144,217,.22)", marginLeft: 28 }} />}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 28, padding: "14px 18px", background: "rgba(74,144,217,.07)", border: "1px solid rgba(74,144,217,.18)", borderRadius: 10, fontSize: 13, color: "rgba(255,255,255,.48)", lineHeight: 1.55 }}>
          {slide.note[0]}<strong style={{ color: "#4a90d9", fontWeight: 700 }}>{slide.note[1]}</strong>{slide.note[2]}
        </div>
      </div>
    );
  }

  // ── LIST (Recruitment) ──
  if (slide.type === "list") {
    return (
      <div className="ae-slide ae-slide-card" style={{ ...base }}>
        {/* Corner glow */}
        <div style={{ position: "absolute", bottom: 0, right: 0, width: 250, height: 250, background: "radial-gradient(circle at bottom right, rgba(74,144,217,.09) 0%, transparent 70%)", pointerEvents: "none", borderRadius: 18 }} />
        <Logo />
        <div style={{ fontSize: 9, letterSpacing: "4px", color: "#4a90d9", textTransform: "uppercase", fontFamily: "'Space Mono', monospace", marginBottom: 16 }}>&#9632; {slide.tag}</div>
        <h2 className="ae-h2" style={{ fontSize: 38, fontWeight: 800, color: "#fff", marginBottom: 30, lineHeight: 1.1, letterSpacing: "-.3px" }}>
          {slide.heading[0]}<br />
          <span style={{ background: "linear-gradient(135deg, #4a90d9, #a8d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{slide.heading[1]}</span>
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
          {slide.agents.map(a => (
            <div key={a} style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div className="ae-flow-dot" />
              <span style={{ fontSize: 15, color: "rgba(255,255,255,.8)", fontWeight: 500 }}>{a}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: 22, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{ color: "#4a90d9", fontSize: 20, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>—</span>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,.55)", lineHeight: 1.6 }}>
            {slide.conclusion[0]}<strong style={{ color: "rgba(255,255,255,.9)", fontWeight: 700 }}>{slide.conclusion[1]}</strong>
          </p>
        </div>
      </div>
    );
  }

  // ── OUTRO ──
  if (slide.type === "outro") {
    return (
      <div className="ae-slide ae-slide-card" style={{ ...base, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {/* Concentric rings */}
        <div className="ae-ring1" style={{ position: "absolute", width: 420, height: 420, borderRadius: "50%", border: "1px solid rgba(74,144,217,.07)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
        <div className="ae-ring2" style={{ position: "absolute", width: 310, height: 310, borderRadius: "50%", border: "1px solid rgba(74,144,217,.11)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
        <div className="ae-ring3" style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", border: "1px solid rgba(74,144,217,.17)", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 200, height: 200, background: "radial-gradient(circle, rgba(74,144,217,.16) 0%, transparent 70%)", borderRadius: "50%", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
          <div style={{ fontSize: 9, letterSpacing: "5px", color: "#4a90d9", textTransform: "uppercase", fontFamily: "'Space Mono', monospace", marginBottom: 16 }}>Intelligence. Evolved.</div>
          <div className="ae-outro-brand" style={{ fontSize: 58, fontWeight: 800, background: "linear-gradient(135deg, #4a90d9 0%, #a8d4ff 55%, #d0eaff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1, marginBottom: 6 }}>Nolyvra</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.28)", letterSpacing: "2px", fontFamily: "'Space Mono', monospace", marginBottom: 36 }}>INTELLIGENCE. EVOLVED.</div>
          <div className="ae-outro-msg" style={{ fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,.82)", lineHeight: 1.45, maxWidth: 340, marginBottom: 32 }}>
            This is the{" "}
            <span style={{ color: "#a8d4ff" }}>future</span>{" "}
            we're building towards.
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, border: "1px solid rgba(74,144,217,.32)", borderRadius: 40, padding: "11px 26px", fontSize: 12, color: "#a8d4ff", letterSpacing: "1px", fontWeight: 600, fontFamily: "'Space Mono', monospace" }}>
            ⬡ Join the Agent Economy
          </div>
        </div>
      </div>
    );
  }

  return null;
}
