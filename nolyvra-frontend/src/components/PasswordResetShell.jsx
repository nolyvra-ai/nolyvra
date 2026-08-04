import { useNavigate } from "react-router-dom";

export default function PasswordResetShell({ title, description, children }) {
  const nav = useNavigate();

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 24,
      boxSizing: "border-box",
      background: "radial-gradient(circle at 20% 10%, #173a73 0, #0b1730 38%, #060b16 100%)",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: "#fff",
    }}>
      <section style={{
        width: "100%",
        maxWidth: 440,
        padding: "38px 40px",
        boxSizing: "border-box",
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(12,24,50,0.82)",
        boxShadow: "0 32px 70px rgba(0,0,0,0.45)",
        backdropFilter: "blur(24px)",
      }}>
        <button
          type="button"
          onClick={() => nav("/login")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "0 0 30px",
            padding: 0,
            border: 0,
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <span style={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            borderRadius: 9,
            background: "linear-gradient(135deg, #1D72E8, #3D8EFF)",
            fontSize: 13,
            fontWeight: 800,
          }}>IQ</span>
          <span style={{ fontSize: 21, fontWeight: 700 }}>nolyvra</span>
        </button>

        <h1 style={{ margin: "0 0 8px", fontSize: 24, lineHeight: 1.2 }}>{title}</h1>
        <p style={{ margin: "0 0 26px", color: "rgba(255,255,255,0.58)", fontSize: 14, lineHeight: 1.6 }}>
          {description}
        </p>

        {children}
      </section>
    </main>
  );
}
