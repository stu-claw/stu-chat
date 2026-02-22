import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAppState, useAppDispatch } from "../store";
import { Group, Panel } from "react-resizable-panels";
import { ResizeHandle } from "./ResizeHandle";

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

interface LogEntry {
  id: string;
  agentId: string;
  timestamp: number;
  level: "debug" | "info" | "warn" | "error" | "tool" | "result";
  message: string;
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // WebSocket connection for log streaming
  useEffect(() => {
    const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/api/agents/ws`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("[DeckWS] Connected");
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "log") {
          setLogs((prev) => [...prev.slice(-499), data.log]);
        } else if (data.type === "logs:history") {
          setLogs((prev) => [...data.logs, ...prev]);
        } else if (data.type === "agents:list") {
          // Could update agent list here
          console.log("[DeckWS] Active agents:", data.agents);
        }
      } catch (err) {
        console.error("[DeckWS] Parse error:", err);
      }
    };
    
    ws.onclose = () => {
      console.log("[DeckWS] Disconnected");
      setWsConnected(false);
    };
    
    ws.onerror = (err) => {
      console.error("[DeckWS] Error:", err);
    };
    
    wsRef.current = ws;
    
    return () => {
      ws.close();
    };
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

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

  const getLogsForAgent = (agentId: string) => {
    return logs.filter((log) => log.agentId === agentId);
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", { 
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit",
      hour12: false 
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error": return "#ef4444";
      case "warn": return "#f59e0b";
      case "tool": return "#22d3ee";
      case "result": return "#34d399";
      default: return "#6b7280";
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
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
        <div className="flex items-center gap-4">
          {/* WebSocket status */}
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {wsConnected ? "Stream" : "Offline"}
            </span>
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: wsConnected ? "#22c55e" : "#ef4444" }}
            />
          </div>
          {/* OpenClaw status */}
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
      </div>

      {/* Agent Columns */}
      <div className="flex flex-1 overflow-x-auto overflow-y-hidden gap-px" style={{ backgroundColor: "var(--border)" }}>
        {agents.map((agent) => (
          <div key={agent.id} className="flex-1 min-w-[320px] max-w-[480px] flex flex-col overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
            {/* Column Header */}
            <div className="flex items-center px-4 py-3 border-b" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-semibold text-white mr-3"
                style={{ backgroundColor: agent.accent }}
              >
                {agent.icon}
              </div>
              <span className="flex-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{agent.name}</span>
            </div>

            {/* Split Pane: Chat (top) / Terminal (bottom) */}
            <Group orientation="vertical" className="flex-1">
              {/* Top: Chat */}
              <Panel id={`${agent.id}-chat`} defaultSize={60} minSize={30}>
                <div className="flex flex-col h-full overflow-hidden">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
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
                          className="p-3 rounded-lg border"
                          style={{ 
                            backgroundColor: msg.sender === "user" ? "var(--bg-active)" : "var(--bg-surface)",
                            borderColor: msg.sender === "user" ? "var(--border-active)" : "var(--border)"
                          }}
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
                  <div className="p-4 border-t" style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)" }}>
                    <textarea
                      className="w-full p-3 rounded-lg border text-sm resize-none"
                      style={{ 
                        backgroundColor: "var(--bg-primary)", 
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                        minHeight: "60px"
                      }}
                      placeholder={`Message ${agent.name}...`}
                      value={inputs[agent.id] || ""}
                      onChange={(e) => setInputs((prev) => ({ ...prev, [agent.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(agent.id);
                        }
                      }}
                      rows={2}
                    />
                    <button
                      className="mt-2 px-3 py-1.5 rounded-md text-sm font-medium float-right"
                      style={{ 
                        backgroundColor: "var(--bg-active)", 
                        color: "var(--text-primary)"
                      }}
                      onClick={() => handleSend(agent.id)}
                      disabled={!inputs[agent.id]?.trim()}
                    >
                      Send
                    </button>
                  </div>
                </div>
              </Panel>

              {/* Resize Handle */}
              <ResizeHandle direction="horizontal" />

              {/* Bottom: Terminal/Logs */}
              <Panel id={`${agent.id}-terminal`} defaultSize={40} minSize={20}>
                <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: "var(--bg-surface)" }}>
                  {/* Terminal Header */}
                  <div className="flex items-center justify-between px-3 py-1.5 border-b text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                    <span>Terminal</span>
                    <span>{getLogsForAgent(agent.id).length} logs</span>
                  </div>
                  
                  {/* Terminal Content */}
                  <div className="flex-1 overflow-y-auto p-2 font-mono text-xs" style={{ color: "var(--text-primary)" }}>
                    {getLogsForAgent(agent.id).length === 0 ? (
                      <div className="flex h-full items-center justify-center" style={{ color: "var(--text-muted)" }}>
                        No activity...
                      </div>
                    ) : (
                      getLogsForAgent(agent.id).map((log, idx) => (
                        <div key={idx} className="py-0.5">
                          <span style={{ color: "var(--text-muted)" }}>
                            {formatTimestamp(log.timestamp)}
                          </span>
                          <span className="mx-1" style={{ color: getLevelColor(log.level) }}>
                            [{log.level.toUpperCase()}]
                          </span>
                          <span>{log.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </Panel>
            </Group>
          </div>
        ))}
      </div>

      {/* Status Bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-t text-xs"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        <span>{agents.length} agents active | {logs.length} total logs</span>
        <span>Press Enter to send, Shift+Enter for new line</span>
      </div>
    </div>
  );
}