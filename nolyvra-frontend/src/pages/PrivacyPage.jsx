import { useNavigate } from "react-router-dom";

const T = {
  bg:      "#ffffff",
  ink:     "#0F1623",
  muted:   "#8A94A6",
  accent:  "#1D72E8",
  border:  "#E8ECF2",
  surface: "#F7F9FC",
  nav:     "#0F1623",
};

function Section({ title, children }) {
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 32, marginTop: 32 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 14, letterSpacing: "-.3px" }}>
        {title}
      </h2>
      <div style={{ fontSize: 14.5, color: "#3D4A63", lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}

function Li({ children }) {
  return (
    <li style={{ marginBottom: 6 }}>{children}</li>
  );
}

export default function PrivacyPage() {
  const nav = useNavigate();

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: T.bg, minHeight: "100vh", color: T.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { color: ${T.accent}; }
        ul { padding-left: 20px; }
        p + p { margin-top: 12px; }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(15,22,35,.97)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 64,
        borderBottom: "1px solid rgba(255,255,255,.06)"
      }}>
        <a onClick={() => nav("/")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textDecoration: "none" }}>
          <img src="/nolyvra_logo.png" alt="nolyvra" style={{ width: 34, height: 34, borderRadius: 8, objectFit: "cover" }} />
          <div style={{ lineHeight: 1 }}>
            <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, letterSpacing: "-.4px" }}>nolyvra</div>
            <div style={{ color: "rgba(255,255,255,.3)", fontSize: 9, fontWeight: 500, letterSpacing: "1.5px", textTransform: "uppercase", marginTop: 2 }}>Intelligence. Evolved</div>
          </div>
        </a>
        <button
          onClick={() => nav("/")}
          style={{
            padding: "7px 18px", borderRadius: 7, fontSize: 13, fontWeight: 500,
            border: "1px solid rgba(255,255,255,.2)", color: "rgba(255,255,255,.8)",
            background: "transparent", cursor: "pointer", fontFamily: "inherit"
          }}
        >
          ← Back to nolyvra
        </button>
      </nav>

      {/* PAGE BODY */}
      <div style={{ paddingTop: 100, paddingBottom: 80 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px" }}>

          {/* HEADER */}
          <div style={{ paddingBottom: 32 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(29,114,232,.08)", border: `1px solid rgba(29,114,232,.2)`, borderRadius: 20, padding: "4px 12px", marginBottom: 20 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: T.accent }}>Legal</span>
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-.8px", color: T.ink, marginBottom: 10 }}>
              Privacy Policy
            </h1>
            <p style={{ fontSize: 14, color: T.muted }}>Last updated: 28 May 2026</p>
          </div>

          {/* INTRO */}
          <p style={{ fontSize: 14.5, color: "#3D4A63", lineHeight: 1.8 }}>
            Nolyvra Pty Ltd (<strong>"Nolyvra", "we", "us"</strong>) operates the nolyvra.com recruitment intelligence platform. This Privacy Policy explains how we collect, use, store, and protect personal information in connection with our service. By accessing or using nolyvra.com, you agree to the practices described below.
          </p>

          <Section title="1. Information We Collect">
            <p>We collect information you provide directly, information generated through your use of the service, and information from third-party integrations you authorise.</p>
            <p><strong>Account and identity data:</strong></p>
            <ul style={{ marginTop: 8, marginBottom: 12 }}>
              <Li>Full name and email address (used to create and identify your account)</Li>
              <Li>Organisation name and role</Li>
              <Li>Login credentials (stored as salted hashes — we never store plaintext passwords)</Li>
            </ul>
            <p><strong>Candidate data:</strong></p>
            <ul style={{ marginTop: 8, marginBottom: 12 }}>
              <Li>CV / résumé documents uploaded by recruiters on behalf of candidates</Li>
              <Li>Extracted candidate profile data: name, contact details, work history, education, skills</Li>
              <Li>AI-generated analysis scores, fit assessments, and risk signals derived from CV content</Li>
              <Li>Interview transcripts and AI-generated question sets (where this feature is used)</Li>
            </ul>
            <p><strong>Usage data:</strong></p>
            <ul style={{ marginTop: 8, marginBottom: 12 }}>
              <Li>Pages visited, features used, and timestamps of interactions</Li>
              <Li>Browser type, operating system, and IP address</Li>
              <Li>Error logs and performance diagnostics</Li>
            </ul>
            <p><strong>Integration data:</strong></p>
            <ul style={{ marginTop: 8, marginBottom: 12 }}>
              <Li>Microsoft OAuth tokens (when calendar integration is authorised)</Li>
              <Li>Email content sent or received via the Email Centre feature</Li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the data we collect to:</p>
            <ul style={{ marginTop: 8 }}>
              <Li>Provide, operate, and maintain the Nolyvra platform and all its features</Li>
              <Li>Power AI analysis of CVs, candidate scoring, fraud signal detection, and Co-worker automations</Li>
              <Li>Facilitate interview scheduling, email communications, and workflow management</Li>
              <Li>Process payments and manage subscription plans via Stripe</Li>
              <Li>Send transactional emails (reminders, confirmations, alerts)</Li>
              <Li>Diagnose technical issues and improve platform performance</Li>
              <Li>Comply with applicable laws and enforce our Terms of Service</Li>
            </ul>
            <p style={{ marginTop: 12 }}>We do <strong>not</strong> sell personal data to third parties, use candidate data for purposes unrelated to the recruitment workflow, or use your data to train our own AI models without explicit consent.</p>
          </Section>

          <Section title="3. Third-Party Services">
            <p>Nolyvra integrates with the following third-party services. Each has its own privacy practices, which we encourage you to review.</p>
            <ul style={{ marginTop: 8 }}>
              <Li><strong>OpenAI</strong> — CV text and candidate data are transmitted to OpenAI's API to generate analysis, scoring, and Co-worker responses. Data is processed under OpenAI's API data usage policy (api.openai.com). We use the API tier, which means OpenAI does not use this data to train its models by default.</Li>
              <Li><strong>CoreSignal</strong> — We may query CoreSignal's professional data API to enrich candidate profiles. Query results are cached in our database.</Li>
              <Li><strong>Microsoft OAuth / Microsoft Graph</strong> — When you authorise the calendar integration, we obtain and store an OAuth token to read and write calendar events on your behalf. You can revoke this at any time from Settings.</Li>
              <Li><strong>Google OAuth</strong> — Where Google sign-in is offered, authentication is handled via Google Identity Services.</Li>
              <Li><strong>Stripe</strong> — Payment and subscription billing is handled entirely by Stripe. Nolyvra does not store card numbers or sensitive payment details.</Li>
              <Li><strong>SMTP (email delivery)</strong> — Outbound emails are routed via our configured SMTP provider.</Li>
            </ul>
          </Section>

          <Section title="4. Data Storage and Security">
            <p>Your data is stored in a PostgreSQL database hosted on <strong>Render</strong>, a managed cloud infrastructure provider, in data centres located in the United States.</p>
            <p>We apply the following safeguards:</p>
            <ul style={{ marginTop: 8 }}>
              <Li>All data in transit is encrypted via TLS (HTTPS)</Li>
              <Li>Passwords are hashed using industry-standard algorithms — we cannot retrieve them</Li>
              <Li>Database credentials and API keys are stored as environment variables, never in source code</Li>
              <Li>Access to production infrastructure is restricted to authorised team members</Li>
            </ul>
            <p style={{ marginTop: 12 }}>While we take reasonable precautions, no system is completely immune to breach. In the event of a data incident affecting your personal information, we will notify you as required by applicable law.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>We retain account and candidate data for as long as your subscription is active and for a reasonable period thereafter to fulfil legal and contractual obligations. Usage and diagnostic logs are retained for up to 90 days.</p>
            <p>When a subscription is cancelled and the account is closed, we will delete or anonymise personal data within 30 days of your written deletion request, subject to any legal retention obligations.</p>
          </Section>

          <Section title="6. Your Rights">
            <p>Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul style={{ marginTop: 8 }}>
              <Li><strong>Access</strong> — Request a copy of the personal data we hold about you</Li>
              <Li><strong>Correction</strong> — Request that inaccurate data be corrected</Li>
              <Li><strong>Deletion</strong> — Request that your personal data be deleted ("right to be forgotten")</Li>
              <Li><strong>Portability</strong> — Request your data in a machine-readable format</Li>
              <Li><strong>Objection / Restriction</strong> — Object to or request restriction of certain processing activities</Li>
            </ul>
            <p style={{ marginTop: 12 }}>To exercise any of these rights, contact us at the address below. We will respond within 30 days.</p>
          </Section>

          <Section title="7. Cookies and Tracking">
            <p>Nolyvra uses session storage and local storage (in the browser) to maintain your login session and user preferences. We do not currently use third-party tracking cookies or advertising networks.</p>
          </Section>

          <Section title="8. Children's Privacy">
            <p>Nolyvra is a B2B professional platform and is not directed at individuals under the age of 18. We do not knowingly collect personal information from minors.</p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date at the top of this page and, where changes are material, notify registered users by email. Continued use of the platform after notice constitutes acceptance of the revised policy.</p>
          </Section>

          <Section title="10. Contact Us">
            <p>For privacy queries, data access requests, or deletion requests, please contact:</p>
            <div style={{
              marginTop: 16, background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: "20px 24px"
            }}>
              <div style={{ fontWeight: 600, color: T.ink, marginBottom: 4 }}>Nolyvra Pty Ltd</div>
              <div style={{ color: "#3D4A63" }}>Victoria, Australia</div>
              <div style={{ marginTop: 8 }}>
                <a href="mailto:privacy@nolyvra.com" style={{ color: T.accent, fontWeight: 500 }}>privacy@nolyvra.com</a>
              </div>
            </div>
          </Section>

        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "24px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/nolyvra_logo.png" alt="nolyvra" style={{ width: 24, height: 24, borderRadius: 5, objectFit: "cover" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.muted }}>nolyvra</span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="/privacy" style={{ fontSize: 12.5, color: T.accent, textDecoration: "none", fontWeight: 500 }}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize: 12.5, color: T.muted, textDecoration: "none" }}>Terms of Service</a>
        </div>
        <div style={{ fontSize: 12, color: T.muted }}>© 2026 Nolyvra Pty Ltd · All rights reserved</div>
      </div>
    </div>
  );
}
