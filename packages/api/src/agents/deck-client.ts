// Deck API Client - For sub-agents to communicate back to the Deck
// This runs inside sub-agents spawned via sessions_spawn

interface DeckApiConfig {
  baseUrl: string;
  authToken?: string;
}

let config: DeckApiConfig = {
  baseUrl: process.env.BOTSCHAT_API_URL || "http://localhost:3004",
};

// Get agent ID from environment (set by spawnWithDeck)
const AGENT_ID = process.env.BOTSCHAT_AGENT_ID;
const AGENT_NAME = process.env.BOTSCHAT_AGENT_NAME;

if (!AGENT_ID) {
  console.log("[DeckApi] No BOTSCHAT_AGENT_ID found - running without Deck integration");
}

/**
 * Configure the Deck API client
 */
export function configureDeckApi(cfg: Partial<DeckApiConfig>) {
  config = { ...config, ...cfg };
}

/**
 * Send a log entry to the Deck
 */
export async function deckLog(
  level: "debug" | "info" | "warn" | "error" | "tool" | "result",
  message: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (!AGENT_ID) return; // Silent fail if not in agent context
  
  try {
    const response = await fetch(`${config.baseUrl}/api/agents/${AGENT_ID}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
      },
      body: JSON.stringify({ level, message, metadata }),
    });
    
    if (!response.ok) {
      console.error(`[DeckApi] Failed to send log: ${response.status}`);
    }
  } catch (err) {
    // Silently fail - don't break agent execution
    console.error("[DeckApi] Log error:", err);
  }
}

/**
 * Report tool execution to the Deck
 */
export async function deckTool(
  toolName: string,
  params: any,
  result?: any
): Promise<void> {
  if (!AGENT_ID) return;
  
  const message = `$ ${toolName}`;
  const metadata = {
    tool: toolName,
    params: sanitizeForJson(params),
    result: result ? sanitizeForJson(result).substring(0, 500) : undefined,
  };
  
  await deckLog("tool", message, metadata);
}

/**
 * Send heartbeat to keep agent alive
 */
export async function deckHeartbeat(): Promise<void> {
  if (!AGENT_ID) return;
  
  try {
    await fetch(`${config.baseUrl}/api/agents/${AGENT_ID}/heartbeat`, {
      method: "POST",
      headers: config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {},
    });
  } catch (err) {
    // Silently fail
  }
}

/**
 * Update agent status
 */
export async function deckStatus(
  status: "initializing" | "running" | "completed" | "error",
  metadata?: Record<string, any>
): Promise<void> {
  if (!AGENT_ID) return;
  
  try {
    await fetch(`${config.baseUrl}/api/agents/${AGENT_ID}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}),
      },
      body: JSON.stringify({ status, metadata }),
    });
  } catch (err) {
    console.error("[DeckApi] Status update error:", err);
  }
}

/**
 * Report task completion
 */
export async function deckComplete(result?: any): Promise<void> {
  if (!AGENT_ID) return;
  
  await deckLog("result", "Task completed", { result: sanitizeForJson(result) });
  await deckStatus("completed", { result });
}

/**
 * Report error
 */
export async function deckError(error: string | Error): Promise<void> {
  if (!AGENT_ID) return;
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  await deckLog("error", errorMessage);
  await deckStatus("error", { error: errorMessage });
}

/**
 * Auto-setup: Register this agent and start heartbeat
 * Call this at the start of your agent task
 */
export async function deckInit(): Promise<void> {
  if (!AGENT_ID) {
    console.log("[DeckApi] Not running in Deck context");
    return;
  }
  
  console.log(`[DeckApi] Agent ${AGENT_ID} (${AGENT_NAME}) initializing...`);
  
  // Send initial log
  await deckLog("info", `Agent ${AGENT_NAME} started`);
  await deckStatus("running");
  
  // Start auto-heartbeat (every 30 seconds)
  const heartbeatInterval = setInterval(() => {
    deckHeartbeat();
  }, 30000);
  
  // Cleanup on exit
  process.on("exit", () => {
    clearInterval(heartbeatInterval);
  });
  
  // Handle errors
  process.on("uncaughtException", async (err) => {
    await deckError(err);
    clearInterval(heartbeatInterval);
  });
}

// Helper to safely serialize objects
function sanitizeForJson(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForJson);
  if (typeof obj === "object") {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip functions, circular refs, etc
      if (typeof value !== "function") {
        sanitized[key] = sanitizeForJson(value);
      }
    }
    return sanitized;
  }
  return String(obj);
}

// Export convenience aliases
export const log = deckLog;
export const tool = deckTool;
export const heartbeat = deckHeartbeat;
export const status = deckStatus;
export const complete = deckComplete;
export const error = deckError;
export const init = deckInit;

// Default export
export default {
  log: deckLog,
  tool: deckTool,
  heartbeat: deckHeartbeat,
  status: deckStatus,
  complete: deckComplete,
  error: deckError,
  init: deckInit,
  configure: configureDeckApi,
};