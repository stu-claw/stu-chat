import React, { useState, useRef, useEffect } from "react";
import { useAppState, useAppDispatch } from "../store";
import styles from "./DeckView.module.css";

const AGENT_ACCENTS = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f59e0b",
  "#f472b6",
  "#60a5fa",
  "#facc15",
];

interface Agent {
  id: string;
  name: string;
  icon: string;
  accent: string;
  messages: Array<{ sender: "user" | "agent"; text: string; timestamp: number }>;
}

function buildDefaultAgents(count: number): Agent[] {
  return Array.from({ length: count }, (_, i) => {
    const agentId = i === 0 ? "main" : `agent-${i + 1}`;
    const agentName = i === 0 ? "Main" : `Agent ${i + 1}`;
    return {
      id: agentId,
      name: agentName,
      icon: String(i + 1),
      accent: AGENT_ACCENTS[i % AGENT_ACCENTS.length],
      messages: [],
    };
  });
}

export function DeckView() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [agents, setAgents] = useState<Agent[]>(() => buildDefaultAgents(7));
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = (agentId: string) => {
    const text = inputs[agentId]?.trim();
    if (!text) return;

    setAgents((prev) =>
      prev.map((agent) =>
        agent.id === agentId
          ? {
              ...agent,
              messages: [
                ...agent.messages,
                { sender: "user", text, timestamp: Date.now() },
              ],
            }
          : agent
      )
    );

    setInputs((prev) => ({ ...prev, [agentId]: "" }));

    // TODO: Send to WebSocket
    setTimeout(() => {
      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                messages: [
                  ...agent.messages,
                  { sender: "agent", text: `Response to: ${text}`, timestamp: Date.now() },
                ],
              }
            : agent
        )
      );
    }, 1000);
  };

  return (
    <div className={styles.deck}>
      {/* Top Bar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            OpenClaw Deck
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {state.openclawConnected ? "Connected" : "Disconnected"}
          </span>
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: state.openclawConnected ? "#22c55e" : "#ef4444" }}
          />
        </div>
      </div>

      {/* Agent Columns */}
      <div className={styles.columns}>
        {agents.map((agent) => (
          <div key={agent.id} className={styles.column}>
            {/* Column Header */}
            <div className={styles.columnHeader}>
              <div
                className={styles.columnIcon}
                style={{ backgroundColor: agent.accent }}
              >
                {agent.icon}
              </div>
              <span className={styles.columnName}>{agent.name}</span>
            </div>

            {/* Messages */}
            <div className={styles.messages}>
              {agent.messages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Start a conversation...
                  </p>
                </div>
              ) : (
                agent.messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`${styles.message} ${msg.sender === "user" ? styles.messageUser : ""}`}
                  >
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                      {msg.text}
                    </p>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={styles.inputArea}>
              <textarea
                className={styles.input}
                placeholder={`Message ${agent.name}...`}
                value={inputs[agent.id] || ""}
                onChange={(e) => setInputs((prev) => ({ ...prev, [agent.id]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(agent.id);
                  }
                }}
                rows={3}
              />
              <button
                className={styles.sendButton}
                onClick={() => handleSend(agent.id)}
                disabled={!inputs[agent.id]?.trim()}
              >
                Send
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Status Bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-t text-xs"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <span>{agents.length} agents active</span>
        <span>Press Enter to send, Shift+Enter for new line</span>
      </div>
    </div>
  );
}