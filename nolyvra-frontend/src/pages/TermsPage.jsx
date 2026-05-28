import { useNavigate } from "react-router-dom";

const T = {
  bg:      "#ffffff",
  ink:     "#0F1623",
  muted:   "#8A94A6",
  accent:  "#1D72E8",
  border:  "#E8ECF2",
  surface: "#F7F9FC",
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
  return <li style={{ marginBottom: 6 }}>{children}</li>;
}

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p style={{ fontSize: 14, color: T.muted }}>Last updated: 28 May 2026</p>
          </div>

          {/* INTRO */}
          <p style={{ fontSize: 14.5, color: "#3D4A63", lineHeight: 1.8 }}>
            These Terms of Service (<strong>"Terms"</strong>) govern your access to and use of the Nolyvra platform, operated by <strong>Nolyvra Pty Ltd</strong> (<strong>"Nolyvra", "we", "us"</strong>). By creating an account or using any part of the service, you agree to be bound by these Terms. If you do not agree, do not access or use the platform.
          </p>

          <Section title="1. Acceptance of Terms">
            <p>These Terms constitute a legally binding agreement between you (the "User") and Nolyvra Pty Ltd. Where you are accepting on behalf of an organisation, you represent that you have authority to bind that organisation. "You" and "your" refer to the User and, where applicable, the organisation they represent.</p>
            <p>We may update these Terms from time to time. Continued use of the platform after notice of an update constitutes acceptance. Material changes will be notified by email to the registered account address.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>Nolyvra is an AI-powered recruitment intelligence platform designed for recruitment agencies and hiring professionals. The platform provides, among other features:</p>
            <ul style={{ marginTop: 8 }}>
              <Li>AI-driven CV analysis, candidate scoring, and placement probability estimation</Li>
              <Li>Fraud and risk signal detection (e.g. CV-to-LinkedIn consistency checks)</Li>
              <Li>AI Co-worker for recruiter workflow automation and bulk operations</Li>
              <Li>Interview scheduling, transcript analysis, and AI-generated question sets</Li>
              <Li>Email communication tools and candidate pipeline management</Li>
              <Li>Talent search and candidate enrichment via third-party data providers</Li>
            </ul>
            <p style={{ marginTop: 12 }}>We reserve the right to modify, suspend, or discontinue any feature at any time with reasonable notice.</p>
          </Section>

          <Section title="3. User Responsibilities">
            <p>By using Nolyvra, you agree to:</p>
            <ul style={{ marginTop: 8 }}>
              <Li>Provide accurate information when registering and keep your account details up to date</Li>
              <Li>Keep your login credentials secure and notify us immediately of any unauthorised access</Li>
              <Li>Use the platform only for lawful recruitment and hiring-related purposes</Li>
              <Li>Obtain any necessary consents before uploading a candidate's personal data (including CVs)</Li>
              <Li>Comply with all applicable privacy, employment, anti-discrimination, and data protection laws in your jurisdiction</Li>
              <Li>Not reverse-engineer, scrape, copy, or resell any part of the platform or its outputs</Li>
              <Li>Not upload malicious code, files, or content of any kind</Li>
              <Li>Not attempt to access accounts, data, or systems that you are not authorised to access</Li>
            </ul>
            <p style={{ marginTop: 12 }}>You are solely responsible for the candidate data you upload and how you act on the platform's outputs.</p>
          </Section>

          <Section title="4. AI Disclaimer">
            <div style={{ background: "rgba(29,114,232,.06)", border: `1px solid rgba(29,114,232,.18)`, borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
              <p style={{ fontWeight: 600, color: T.ink, marginBottom: 6 }}>Important — Please read carefully</p>
              <p>All AI-generated outputs on the Nolyvra platform — including candidate scores, fit assessments, risk signals, match ratings, interview questions, and Co-worker suggestions — are <strong>advisory only</strong>. They are tools to support human judgement, not replace it.</p>
            </div>
            <p>Nolyvra makes no warranty that AI outputs are accurate, complete, free from bias, or appropriate for any specific hiring decision. You acknowledge that:</p>
            <ul style={{ marginTop: 8 }}>
              <Li>AI analysis reflects patterns in training data and may contain errors or limitations</Li>
              <Li>Hiring decisions must be made by qualified human professionals exercising independent judgement</Li>
              <Li>You must not rely solely on AI-generated outputs to accept, reject, or rank candidates</Li>
              <Li>You are responsible for ensuring that your use of AI-assisted outputs complies with applicable anti-discrimination and employment laws</Li>
            </ul>
            <p style={{ marginTop: 12 }}>Nolyvra disclaims all liability arising from hiring decisions made in reliance on AI-generated outputs.</p>
          </Section>

          <Section title="5. Data Usage Rights">
            <p>You retain ownership of all candidate data and content you upload to the platform. By uploading content, you grant Nolyvra a limited, non-exclusive licence to process that content solely for the purpose of delivering the service to you.</p>
            <p>We do not use your data or candidate data to train AI models for commercial purposes, share it with third parties for marketing, or transfer it outside the scope described in our Privacy Policy.</p>
            <p>Aggregated and anonymised usage data (from which no individual can be identified) may be used by Nolyvra to improve platform performance and feature development.</p>
          </Section>

          <Section title="6. Subscription and Billing">
            <p>Access to Nolyvra's full feature set requires a paid subscription. Subscriptions are managed via <strong>Stripe</strong>, our payment processor.</p>
            <ul style={{ marginTop: 8 }}>
              <Li>Subscription fees are billed monthly or annually depending on your chosen plan</Li>
              <Li>All prices are displayed in Australian Dollars (AUD) unless otherwise stated, and are inclusive of GST where applicable</Li>
              <Li>Subscriptions renew automatically at the end of each billing period unless cancelled beforehand</Li>
              <Li>You may cancel your subscription at any time via the Settings page; access continues until the end of the current paid period</Li>
              <Li>Nolyvra does not offer refunds for partial billing periods except where required by Australian Consumer Law</Li>
              <Li>We reserve the right to change pricing with 30 days' notice to active subscribers</Li>
            </ul>
            <p style={{ marginTop: 12 }}>All payment processing is handled by Stripe. Nolyvra does not store or access your card details.</p>
          </Section>

          <Section title="7. Acceptable Use">
            <p>You must not use Nolyvra to:</p>
            <ul style={{ marginTop: 8 }}>
              <Li>Discriminate against candidates on the basis of race, gender, age, disability, religion, or any other protected characteristic</Li>
              <Li>Process personal data in violation of applicable privacy laws (including the Australian Privacy Act 1988)</Li>
              <Li>Store or transmit content that is unlawful, defamatory, harassing, or infringes intellectual property rights</Li>
              <Li>Attempt to circumvent security measures, access controls, or rate limits</Li>
              <Li>Use automated tools to scrape, harvest, or extract data from the platform</Li>
            </ul>
            <p style={{ marginTop: 12 }}>Violation of these provisions may result in immediate suspension or termination of your account.</p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>All platform software, design, trademarks, and proprietary content are owned by Nolyvra Pty Ltd or its licensors. These Terms do not grant you any ownership rights in the platform.</p>
            <p>You retain all rights in the content and data you upload. You grant us only the limited processing licence described in Section 5.</p>
          </Section>

          <Section title="9. Termination">
            <p><strong>By you:</strong> You may close your account at any time by contacting us at the address below or via the Settings page. Closure does not entitle you to a refund of prepaid subscription fees.</p>
            <p><strong>By us:</strong> We may suspend or terminate your account immediately if you breach these Terms, if your subscription payment fails and is not resolved within 7 days, or if we are required to do so by law. Where possible, we will provide notice before termination.</p>
            <p><strong>Effect of termination:</strong> Upon termination, your right to access the platform ceases. We will retain your data for up to 30 days to allow export, after which it may be deleted. Sections 4 (AI Disclaimer), 8 (Intellectual Property), 10 (Limitation of Liability), and 11 (Governing Law) survive termination.</p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>To the maximum extent permitted by law:</p>
            <ul style={{ marginTop: 8 }}>
              <Li>Nolyvra is provided on an "as is" and "as available" basis without warranties of any kind, express or implied</Li>
              <Li>We do not warrant that the platform will be uninterrupted, error-free, or fit for any particular purpose</Li>
              <Li>Nolyvra's total aggregate liability to you for any claim arising from these Terms or your use of the platform shall not exceed the total fees paid by you in the 12 months preceding the claim</Li>
              <Li>We are not liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, loss of profit, or loss of business opportunity</Li>
            </ul>
            <p style={{ marginTop: 12 }}>Nothing in these Terms excludes liability for death or personal injury caused by negligence, fraud, or any liability that cannot be excluded under the Australian Consumer Law.</p>
          </Section>

          <Section title="11. Governing Law">
            <p>These Terms are governed by and construed in accordance with the laws of the State of <strong>Victoria, Australia</strong>. You submit to the non-exclusive jurisdiction of the courts of Victoria for resolution of any dispute arising under these Terms.</p>
            <p>Where you are a consumer under Australian Consumer Law, nothing in these Terms limits rights you have under that law.</p>
          </Section>

          <Section title="12. Contact Us">
            <p>For questions about these Terms, billing disputes, or to request account closure:</p>
            <div style={{
              marginTop: 16, background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: "20px 24px"
            }}>
              <div style={{ fontWeight: 600, color: T.ink, marginBottom: 4 }}>Nolyvra Pty Ltd</div>
              <div style={{ color: "#3D4A63" }}>Victoria, Australia</div>
              <div style={{ marginTop: 8 }}>
                <a href="mailto:hello@nolyvra.com" style={{ color: T.accent, fontWeight: 500 }}>hello@nolyvra.com</a>
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
          <a href="/privacy" style={{ fontSize: 12.5, color: T.muted, textDecoration: "none" }}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize: 12.5, color: T.accent, textDecoration: "none", fontWeight: 500 }}>Terms of Service</a>
        </div>
        <div style={{ fontSize: 12, color: T.muted }}>© 2026 Nolyvra Pty Ltd · All rights reserved</div>
      </div>
    </div>
  );
}
