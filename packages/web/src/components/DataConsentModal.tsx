import React, { useState, useEffect } from "react";

interface DataConsentModalProps {
  onAccept: () => void;
}

export function DataConsentModal({ onAccept }: DataConsentModalProps) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimerElapsed(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const canAccept = scrolledToBottom || timerElapsed;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) {
      setScrolledToBottom(true);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "var(--bg-secondary)" }}
    >
      <div
        className="w-full max-w-lg flex flex-col rounded-md"
        style={{
          background: "var(--bg-surface)",
          boxShadow: "var(--shadow-lg)",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" fill="none" stroke="var(--bg-active)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <h1 className="text-h1 font-bold" style={{ color: "var(--text-primary)" }}>
              How Your Data Works in Stu
            </h1>
          </div>
          <p className="text-caption" style={{ color: "var(--text-muted)" }}>
            Please review before continuing
          </p>
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-6"
          onScroll={handleScroll}
        >
          <div className="space-y-5 pb-2">
            {/* Message Relay */}
            <Section
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              }
              title="Message Relay"
            >
              Stu acts as a WebSocket relay between your browser and your own
              OpenClaw AI gateway. Messages you send are transmitted through
              Stu Cloud to reach your gateway.
            </Section>

            {/* E2E Encryption */}
            <Section
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              }
              title="End-to-End Encryption"
            >
              When E2E encryption is enabled, the server only stores ciphertext
              it cannot read. Your encryption key never leaves your device.
            </Section>

            {/* AI Processing */}
            <Section
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                  <rect x="9" y="9" width="6" height="6" />
                  <line x1="9" y1="1" x2="9" y2="4" />
                  <line x1="15" y1="1" x2="15" y2="4" />
                  <line x1="9" y1="20" x2="9" y2="23" />
                  <line x1="15" y1="20" x2="15" y2="23" />
                  <line x1="20" y1="9" x2="23" y2="9" />
                  <line x1="20" y1="14" x2="23" y2="14" />
                  <line x1="1" y1="9" x2="4" y2="9" />
                  <line x1="1" y1="14" x2="4" y2="14" />
                </svg>
              }
              title="AI Processing"
            >
              AI processing happens on your OpenClaw gateway using AI services
              you configure (such as OpenAI, Anthropic, Google, Azure, etc.).
              Stu does not choose or control which AI service processes your
              data.
            </Section>

            {/* Your API Keys */}
            <Section
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              }
              title="Your API Keys"
            >
              Your API keys are stored on your OpenClaw gateway machine and never
              pass through Stu Cloud.
            </Section>

            {/* Third-Party Services */}
            <Section
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
              }
              title="Third-Party Services"
            >
              Stu Cloud uses Cloudflare for hosting, database, and media
              storage. Authentication is provided by Google and GitHub OAuth. No
              data is sold or shared with advertisers.
            </Section>

            {/* What You Agree To */}
            <div
              className="rounded-md p-4"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            >
              <h3 className="text-body font-bold mb-3" style={{ color: "var(--text-primary)" }}>
                What You Agree To
              </h3>
              <ul className="space-y-2">
                <AgreementItem>
                  Messages sent through Stu may be processed by third-party
                  AI services configured in your OpenClaw gateway
                </AgreementItem>
                <AgreementItem>
                  Your chat data is stored on Cloudflare infrastructure
                </AgreementItem>
                <AgreementItem>
                  You can enable E2E encryption for additional privacy
                </AgreementItem>
                <AgreementItem>
                  You can delete your account and all data at any time
                </AgreementItem>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={onAccept}
            disabled={!canAccept}
            className="w-full py-2.5 font-bold text-body text-white rounded-sm transition-all"
            style={{
              background: canAccept ? "var(--bg-active)" : "var(--bg-hover, #3a3d41)",
              cursor: canAccept ? "pointer" : "not-allowed",
              opacity: canAccept ? 1 : 0.5,
            }}
          >
            I Understand &amp; Accept
          </button>
          <div className="flex items-center justify-center gap-2 mt-3">
            <a
              href="https://botschat.app/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-tiny hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Privacy Policy
            </a>
            <span className="text-tiny" style={{ color: "var(--text-muted)" }}>·</span>
            <a
              href="https://botschat.app/terms.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-tiny hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div
        className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center mt-0.5"
        style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="text-body font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
        <p className="text-caption" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {children}
        </p>
      </div>
    </div>
  );
}

function AgreementItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-caption" style={{ color: "var(--text-secondary)" }}>
      <svg
        className="w-4 h-4 shrink-0 mt-0.5"
        viewBox="0 0 20 20"
        fill="var(--bg-active)"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      <span style={{ lineHeight: 1.5 }}>{children}</span>
    </li>
  );
}
