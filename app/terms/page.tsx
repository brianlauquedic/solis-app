"use client";

import Footer from "@/components/Footer";

export default function TermsPage() {
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

  const warningStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--accent-mid)",
    borderLeft: "3px solid var(--accent)",
    borderRadius: 8,
    padding: "14px 18px",
    marginBottom: 16,
    fontSize: 13,
    color: "var(--text-primary)",
    lineHeight: 1.7,
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
            Terms of Service
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Last updated: 6 April 2026
          </p>
        </div>

        {/* Important Notice */}
        <div style={warningStyle}>
          <strong>Important Notice:</strong> Section 11 of these Terms contains a binding arbitration clause and class-action waiver. Please read it carefully before using the Services.
        </div>

        {/* 1. Introduction */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>1. Introduction</h2>
          <p style={pStyle}>
            These Terms of Service ("Terms") constitute a binding legal agreement between you ("User," "you," or "your") and Sakura ("Sakura," "we," "us," or "our") governing your access to and use of Sakura's AI-powered Solana DeFi safety advisor platform, including the web application, AI analysis features, security scanning tools, and all associated interfaces (collectively, the "Services").
          </p>
          <p style={pStyle}>
            Our Privacy Policy is incorporated into these Terms by reference and forms part of this agreement.
          </p>
          <p style={pStyle}>
            By accessing or using the Services, you confirm that you are at least 18 years of age, that you have read and understood these Terms, and that you agree to be bound by them. If you do not agree, you must immediately cease using the Services.
          </p>
          <p style={pStyle}>
            We may update these Terms from time to time. The "Last updated" date above reflects the most recent revision. Continued use of the Services after any update constitutes acceptance of the revised Terms.
          </p>
        </div>

        {/* 2. AI Disclaimer */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>2. Artificial Intelligence Disclaimer</h2>

          <h3 style={h3Style}>2.1 Nature of AI Outputs</h3>
          <p style={pStyle}>
            You are interacting with an AI system powered by Claude AI (Anthropic), not a licensed human financial adviser, broker, or investment professional. All AI-generated content, analysis, security assessments, and DeFi commentary are provided on an <strong>informational basis only</strong> and do not constitute investment advice, financial advice, or a solicitation to buy or sell any asset. AI output is probabilistic in nature and may contain errors, omissions, or outdated information.
          </p>

          <h3 style={h3Style}>2.2 Your Responsibilities</h3>
          <p style={pStyle}>
            You are solely responsible for independently evaluating all AI-generated content before acting upon it. All DeFi decisions and transactions are entirely at your discretion and risk. You acknowledge the inherent volatility of digital asset markets and the limitations of AI-based analysis.
          </p>

          <h3 style={h3Style}>2.3 AI Limitations</h3>
          <p style={pStyle}>
            AI output may be inaccurate, incomplete, or contextually inappropriate. Security risk scores and portfolio health assessments reflect available data at the time of analysis and may not capture real-time market conditions, new exploits, or protocol changes. Sakura does not guarantee the accuracy, reliability, or completeness of any AI-generated analysis.
          </p>

          <h3 style={h3Style}>2.4 On-Chain Verification</h3>
          <p style={pStyle}>
            Sakura records a SHA-256 hash of each AI analysis decision on the Solana blockchain for transparency and independent verification. This hash is a cryptographic fingerprint only and does not constitute financial advice or a guarantee of outcomes.
          </p>
        </div>

        {/* 3. Wallet Connection */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>3. Wallet Connection and Read-Only Access</h2>

          <h3 style={h3Style}>3.1 Non-Custodial, Read-Only</h3>
          <p style={pStyle}>
            Sakura is a <strong>read-only</strong> platform. When you connect your Phantom wallet, Sakura reads your public wallet address and publicly visible on-chain data solely for the purpose of providing analysis. Sakura does not request, access, or store your private keys or seed phrase. Sakura does not execute transactions, move funds, or interact with your wallet in any way that requires signing authority.
          </p>

          <h3 style={h3Style}>3.2 User Responsibility</h3>
          <p style={pStyle}>
            You remain fully in control of your wallet at all times. You are solely responsible for all DeFi transactions you choose to execute based on Sakura's analysis. Sakura's analysis is informational; it does not execute any action on your behalf.
          </p>

          <h3 style={h3Style}>3.3 Third-Party Wallet</h3>
          <p style={pStyle}>
            Phantom is a third-party wallet application. Sakura bears no liability for issues arising from Phantom's software, security, or availability. Your use of Phantom is governed by Phantom's own terms of service.
          </p>
        </div>

        {/* 4. AI Analysis Features */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>4. AI Analysis Features</h2>

          <h3 style={h3Style}>4.1 Portfolio Health Check</h3>
          <p style={pStyle}>
            Provides an AI-generated assessment of your Solana wallet's DeFi positions, token exposure, and risk profile based on publicly available on-chain data retrieved via Helius RPC. Results are informational only.
          </p>

          <h3 style={h3Style}>4.2 Security Analysis</h3>
          <p style={pStyle}>
            Submits token contract addresses to the GoPlus Security API for risk scoring across up to 5 security dimensions. GoPlus scores are third-party data; Sakura does not independently verify GoPlus assessments and bears no liability for their accuracy.
          </p>

          <h3 style={h3Style}>4.3 AI Advisor (DeFi Assistant)</h3>
          <p style={pStyle}>
            An AI conversational interface for DeFi strategy questions, powered by Claude AI. All responses are informational. No trading or transaction is executed through this interface.
          </p>

          <h3 style={h3Style}>4.4 AI Agent (Rebalance Agent)</h3>
          <p style={pStyle}>
            Provides AI-generated portfolio rebalancing suggestions. The Agent <strong>does not execute trades</strong>; it generates recommendations only. Any action taken based on Agent recommendations is entirely at your own discretion and risk.
          </p>
        </div>

        {/* 5. Access and Use */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>5. Access and Use</h2>

          <h3 style={h3Style}>5.1 License</h3>
          <p style={pStyle}>
            Sakura grants you a limited, non-exclusive, non-transferable, revocable license to access and use the Services solely for your personal, non-commercial purposes, in accordance with these Terms.
          </p>

          <h3 style={h3Style}>5.2 Prohibited Conduct</h3>
          <p style={pStyle}>You may not use the Services to:</p>
          <ul style={ulStyle}>
            <li style={liStyle}>engage in any unlawful, harmful, or fraudulent activity;</li>
            <li style={liStyle}>attack, probe, or attempt to gain unauthorized access to Sakura's systems or infrastructure;</li>
            <li style={liStyle}>upload, transmit, or deploy malware, viruses, or harmful code;</li>
            <li style={liStyle}>generate prohibited content, including hate speech or content that incites violence;</li>
            <li style={liStyle}>create multiple accounts to abuse subscription credits or promotions; or</li>
            <li style={liStyle}>circumvent geographic restrictions or access the Services from a Restricted Jurisdiction.</li>
          </ul>

          <h3 style={h3Style}>5.3 Usage Limits</h3>
          <p style={pStyle}>
            Sakura operates a credit-based system. Free plan users receive 3 complimentary analyses. Pro plan subscribers receive credits per billing cycle. You must not attempt to circumvent usage limits. When credits are exhausted, AI analysis features are paused until the next billing cycle or an upgrade.
          </p>
        </div>

        {/* 6. Subscription and Fees */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>6. Subscription, Billing, and Fees</h2>
          <p style={pStyle}>
            Subscriptions renew automatically unless you downgrade to the free plan before the end of the current billing cycle. Downgrades take effect at the start of the next billing cycle; you retain access to your current plan's features until the cycle expires.
          </p>
          <p style={pStyle}>
            Subscription fees are charged upfront at the beginning of each billing cycle and are <strong>non-refundable</strong> unless required by applicable law. You are solely responsible for all taxes arising from your use of the Services.
          </p>
          <p style={pStyle}>
            Payment processing is handled by Stripe. By subscribing, you agree to Stripe's terms of service.
          </p>
        </div>

        {/* 7. Risk Notice */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>7. Risk Notice</h2>
          <div style={warningStyle}>
            <strong>Cryptocurrency and DeFi risk.</strong> Cryptocurrency markets are highly volatile and speculative. The value of digital assets can decrease rapidly. AI-generated analysis does not guarantee profitable outcomes. Past security scores do not guarantee future safety. You should only commit funds you can afford to lose entirely.
          </div>
          <p style={pStyle}>
            <strong>AI analysis risk.</strong> AI-generated safety scores, portfolio assessments, and DeFi recommendations are informational tools, not investment advice, and do not guarantee any outcome. Smart contract vulnerabilities, new exploits, or protocol changes may not be reflected in real-time.
          </p>
          <p style={pStyle}>
            <strong>Third-party protocol risk.</strong> DeFi protocols, liquidity pools, and token contracts analyzed by Sakura are independent third-party systems. Sakura bears no liability for losses arising from interacting with any DeFi protocol, regardless of its security assessment.
          </p>
          <p style={pStyle}>
            <strong>General.</strong> Past performance and past security scores are not indicative of future results. Nothing in the Services constitutes a solicitation or recommendation to buy or sell any asset.
          </p>
        </div>

        {/* 8. Geographic Restrictions */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>8. Geographic Restrictions</h2>
          <p style={pStyle}>The Services are not available to persons in any of the following jurisdictions ("Restricted Jurisdictions"):</p>
          <ul style={ulStyle}>
            <li style={liStyle}>Mainland China</li>
            <li style={liStyle}>Iran</li>
            <li style={liStyle}>Cuba</li>
            <li style={liStyle}>North Korea</li>
            <li style={liStyle}>Syria</li>
            <li style={liStyle}>The Crimea, Donetsk, and Luhansk regions of Ukraine</li>
            <li style={liStyle}>Any other jurisdiction subject to comprehensive economic sanctions administered by the United Nations, OFAC, the European Union, or the United Kingdom</li>
          </ul>
          <p style={pStyle}>
            By using the Services, you represent and warrant that you are not in a Restricted Jurisdiction and that your use complies with all applicable laws.
          </p>
        </div>

        {/* 9. Intellectual Property */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>9. Intellectual Property</h2>
          <p style={pStyle}>
            Sakura and its licensors retain all rights, title, and interest in and to the platform, software, AI models, branding, content, and all other materials comprising the Services, excluding your own prompts and uploaded data. You are granted no rights in Sakura's intellectual property except the limited license set forth in Section 5.1.
          </p>
          <p style={pStyle}>
            You own the analysis outputs you generate through the Services. You grant Sakura a non-exclusive, royalty-free license to process your data for operating and improving the Services, consistent with our Privacy Policy.
          </p>
        </div>

        {/* 10. Limitation of Liability */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>10. Limitation of Liability and Disclaimers</h2>
          <p style={pStyle}>
            The Services are provided "as is" and "as available" without warranties of any kind, express or implied.
          </p>
          <p style={pStyle}>
            To the fullest extent permitted by applicable law, Sakura's total liability for any claims arising out of or relating to these Terms or the Services shall not exceed the greater of (a) the total fees paid by you to Sakura in the twelve (12) months preceding the claim, or (b) one hundred US dollars (USD 100).
          </p>
          <p style={pStyle}>Sakura bears no liability for:</p>
          <ul style={ulStyle}>
            <li style={liStyle}>losses arising from DeFi transactions you execute based on Sakura's analysis;</li>
            <li style={liStyle}>inaccuracies in AI-generated security scores or portfolio assessments;</li>
            <li style={liStyle}>losses caused by smart contract exploits, rug pulls, or protocol failures in projects analyzed by Sakura;</li>
            <li style={liStyle}>losses arising from GoPlus API inaccuracies or third-party data failures;</li>
            <li style={liStyle}>losses caused by Solana network failures, congestion, or blockchain-level events;</li>
            <li style={liStyle}>losses caused by unauthorized access to your Phantom wallet; or</li>
            <li style={liStyle}>service interruptions due to scheduled/unscheduled downtime, third-party API outages, or force majeure events.</li>
          </ul>
        </div>

        {/* 11. Arbitration */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>11. Arbitration and Dispute Resolution</h2>
          <p style={pStyle}>
            All disputes, controversies, or claims arising out of or relating to these Terms or the Services shall be finally resolved by binding confidential arbitration administered by the Singapore International Arbitration Centre ("SIAC") in accordance with its rules. The seat of arbitration shall be Singapore. The language shall be English. The arbitral award shall be final and binding.
          </p>
          <p style={pStyle}>
            <strong>Class Action Waiver.</strong> You irrevocably waive any right to participate in a class action, class arbitration, or representative proceeding. All claims must be brought in your individual capacity only.
          </p>
        </div>

        {/* 12. Termination */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>12. Termination</h2>
          <p style={pStyle}>
            You may stop using the Services at any time. Sakura may suspend or terminate your access without prior notice if you breach these Terms, pose a security or legal risk, or if required by applicable law. Provisions that by their nature should survive termination — including Sections 7, 10, 11, 9, and this Section 12 — will remain in full force and effect.
          </p>
        </div>

        {/* 13. Contact */}
        <div style={sectionStyle}>
          <h2 style={h2Style}>13. Contact</h2>
          <p style={pStyle}>
            Questions, notices, or legal correspondence should be directed to:
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
