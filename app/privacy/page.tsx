"use client";

import { useLang } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
  const { isDayMode } = { isDayMode: true }; // always readable

  const sectionStyle: React.CSSProperties = {
    marginBottom: 40,
  };

  const h2Style: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: "var(--font-heading)",
    color: "var(--text-primary)",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid var(--border)",
  };

  const h3Style: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 8,
    marginTop: 20,
  };

  const pStyle: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.85,
    color: "var(--text-secondary)",
    marginBottom: 12,
  };

  const ulStyle: React.CSSProperties = {
    paddingLeft: 20,
    marginBottom: 12,
  };

  const liStyle: React.CSSProperties = {
    fontSize: 14,
    lineHeight: 1.85,
    color: "var(--text-secondary)",
    marginBottom: 4,
  };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh", color: "var(--text-primary)" }}>
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "56px 32px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: "inline-block",
            fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "var(--accent)", border: "1px solid var(--accent-mid)",
            borderRadius: 4, padding: "3px 10px", marginBottom: 16,
            fontFamily: "var(--font-mono)",
          }}>
            POLICY
          </div>
          <h1 style={{
            fontSize: 36, fontWeight: 700,
            fontFamily: "var(--font-heading)",
            color: "var(--text-primary)",
            letterSpacing: "0.04em",
            marginBottom: 12,
          }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Last updated: 6 April 2026
          </p>
        </div>

        {/* 1. Overview */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>1. Overview</h2>
          <p style={pStyle}>
            This Privacy Policy ("Policy") describes how Sakura ("Sakura," "we," "us," or "our") collects, uses, stores, and shares information when you access or use our AI-powered Solana DeFi safety advisor platform, including the web application, AI analysis features, security scanning tools, and all associated interfaces (collectively, the "Services").
          </p>
          <p style={pStyle}>
            Sakura is a <strong>read-only</strong> advisor. We do not hold custody of your assets, execute trades on your behalf, or control your wallet. Your Phantom wallet remains entirely under your control at all times.
          </p>
          <p style={pStyle}>
            By using the Services, you acknowledge that you have read and understood this Policy and consent to the collection and use of your information as described herein. This Policy should be read alongside our Terms of Service.
          </p>
        </div>

        {/* 2. Information We Collect */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>2. Information We Collect</h2>

          <h3 style={h3Style}>2.1 Wallet Information</h3>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Public wallet address</strong> – when you connect your Phantom wallet, we read your public wallet address. We never request or access your private keys, seed phrase, or signing authority.</li>
            <li style={liStyle}><strong>On-chain portfolio data</strong> – token holdings, balances, and transaction history that are publicly visible on the Solana blockchain, retrieved via Helius RPC for analysis purposes.</li>
          </ul>

          <h3 style={h3Style}>2.2 AI Interaction Data</h3>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>AI conversation logs</strong> – prompts you submit to Sakura's AI advisor (powered by Claude AI) and the AI-generated analysis responses.</li>
            <li style={liStyle}><strong>Analysis requests</strong> – security scan requests, portfolio health check queries, and DeFi strategy questions you initiate.</li>
          </ul>

          <h3 style={h3Style}>2.3 Usage and Technical Data</h3>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Device and environment data</strong> – device type, operating system, browser type and version, IP address, and time zone.</li>
            <li style={liStyle}><strong>In-app behavioral data</strong> – pages visited, features accessed, session duration, and error logs.</li>
          </ul>

          <h3 style={h3Style}>2.4 Subscription Data</h3>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Subscription tier</strong> – your current plan (Free or Pro) and credit usage.</li>
            <li style={liStyle}><strong>Payment processing</strong> – payment transactions are handled by Stripe. Sakura does not store raw payment card data.</li>
          </ul>

          <h3 style={h3Style}>2.5 Cookies and Tracking Technologies</h3>
          <p style={pStyle}>
            We use cookies and similar technologies for session management, security monitoring, and analytics. You may control non-essential cookies through your browser settings; however, certain cookies are required for the Services to function.
          </p>

          <h3 style={h3Style}>2.6 Minors</h3>
          <p style={pStyle}>
            The Services are intended solely for users who are at least 18 years of age. We do not knowingly collect personal information from anyone under 18. If you believe a minor has accessed the Services, please notify us at <strong>@sakuraaijp</strong> on X.
          </p>
        </div>

        {/* 3. How We Use Your Information */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>3. How We Use Your Information</h2>
          <p style={pStyle}>We use the information we collect for the following purposes:</p>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Deliver AI analysis</strong> – generating portfolio health reports, security scans, and DeFi advisory responses based on your wallet data.</li>
            <li style={liStyle}><strong>Security analysis</strong> – transmitting token contract addresses to GoPlus Security API for risk scoring and threat detection.</li>
            <li style={liStyle}><strong>Blockchain data retrieval</strong> – querying Helius RPC to fetch your on-chain portfolio data for analysis.</li>
            <li style={liStyle}><strong>Platform improvement</strong> – improving AI models and platform performance using anonymized, aggregated data only.</li>
            <li style={liStyle}><strong>Subscription management</strong> – managing your plan, credit balance, and billing cycle.</li>
            <li style={liStyle}><strong>Security and compliance</strong> – detecting abuse, fraud, and enforcing our Terms of Service.</li>
            <li style={liStyle}><strong>Legal obligations</strong> – complying with applicable laws and lawful authority requests.</li>
          </ul>
          <p style={pStyle}>
            We do not use your wallet data or AI conversation history to train AI models without first anonymizing or aggregating such data so that it cannot be attributed to you individually.
          </p>
        </div>

        {/* 4. Sharing of Information */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>4. Sharing of Information</h2>
          <p style={pStyle}>We do not sell your personal information. We may share your information in the following circumstances:</p>

          <h3 style={h3Style}>Infrastructure and service providers</h3>
          <p style={pStyle}>
            We share data with hosting, analytics, and security vendors under strict data processing agreements that prohibit commercial exploitation of your data. This includes Helius (Solana RPC), GoPlus Security (token risk analysis), Claude AI (Anthropic) for AI processing, and Stripe for payment handling.
          </p>

          <h3 style={h3Style}>Blockchain data</h3>
          <p style={pStyle}>
            Your public wallet address is used to query the Solana blockchain. Blockchain data is inherently public; Sakura reads but never writes to the blockchain on your behalf.
          </p>

          <h3 style={h3Style}>Legal and regulatory authorities</h3>
          <p style={pStyle}>
            We may disclose your information in response to lawful requests from government authorities, courts, or regulators, or where we reasonably believe disclosure is necessary to prevent fraud or comply with applicable law.
          </p>

          <h3 style={h3Style}>Corporate transactions</h3>
          <p style={pStyle}>
            In connection with a merger, acquisition, or similar transaction, your information may be transferred to the acquiring entity, subject to equivalent privacy protections.
          </p>

          <h3 style={h3Style}>Aggregated or anonymized statistics</h3>
          <p style={pStyle}>
            We may share aggregated, non-personally identifiable data for analytical or promotional purposes.
          </p>
        </div>

        {/* 5. Blockchain Data Notice */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>5. Blockchain Data Notice</h2>
          <p style={pStyle}>
            The Solana blockchain is a public ledger. Your wallet address and all transactions associated with it are permanently visible on-chain. Sakura reads this public data to provide analysis but cannot delete or modify any on-chain records. Connecting your wallet to Sakura does not grant us any signing authority or control over your funds.
          </p>
        </div>

        {/* 6. Security */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>6. Security</h2>
          <p style={pStyle}>
            We implement industry-standard security measures including TLS encryption for data in transit, role-based access controls, and regular security reviews. We never request your private key, seed phrase, or any wallet signing permission beyond read-only portfolio access.
          </p>
          <p style={pStyle}>
            While we take reasonable precautions, no system is perfectly secure. You are responsible for maintaining the security of your own Phantom wallet and promptly notifying us via <strong>@sakuraaijp</strong> on X if you identify any issues with our platform.
          </p>
        </div>

        {/* 7. Data Retention */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>7. Data Retention</h2>
          <p style={pStyle}>We retain personal data only for as long as necessary to:</p>
          <ul style={ulStyle}>
            <li style={liStyle}>Deliver and improve the Services;</li>
            <li style={liStyle}>Comply with applicable legal and regulatory requirements; and</li>
            <li style={liStyle}>Resolve disputes and enforce our rights.</li>
          </ul>
          <p style={pStyle}>
            When data is no longer required for these purposes, it is securely deleted or irreversibly anonymized.
          </p>
        </div>

        {/* 8. Your Rights */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>8. Your Choices and Rights</h2>
          <p style={pStyle}>Depending on your jurisdiction, you may have the right to:</p>
          <ul style={ulStyle}>
            <li style={liStyle}><strong>Access</strong> a copy of the personal information we hold about you;</li>
            <li style={liStyle}><strong>Correct</strong> inaccurate or incomplete information;</li>
            <li style={liStyle}><strong>Delete</strong> your personal data (subject to legal retention obligations);</li>
            <li style={liStyle}><strong>Restrict or object</strong> to certain processing activities;</li>
            <li style={liStyle}><strong>Portability</strong> – receive your data in a structured, machine-readable format;</li>
            <li style={liStyle}><strong>Withdraw consent</strong> for optional processing activities at any time.</li>
          </ul>
          <p style={pStyle}>
            To exercise any of these rights, contact us via <strong>@sakuraaijp</strong> on X. We will respond within the timeframe required by applicable law.
          </p>
        </div>

        {/* 9. Updates */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>9. Updates to This Policy</h2>
          <p style={pStyle}>
            We may revise this Policy from time to time to reflect changes in our Services, legal requirements, or data practices. Material changes will be communicated in-app with reasonable advance notice. Continued use of the Services after the effective date of any update constitutes your acceptance of the revised Policy.
          </p>
        </div>

        {/* 10. Contact */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>10. Contact</h2>
          <p style={pStyle}>
            If you have questions, concerns, or requests relating to this Privacy Policy, please contact us:
          </p>
          <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "20px 24px",
            display: "inline-block",
          }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
              𝕏 <a href="https://x.com/sakuraaijp" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>@sakuraaijp</a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
