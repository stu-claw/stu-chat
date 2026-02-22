// Enhanced Sessions Spawn with Deck Integration
// This module provides a drop-in replacement for sessions_spawn
// that automatically integrates with the Deck view

import { sessions_spawn } from "@openclaw/core";

interface SpawnConfig {
  task: string;
  model?: string;
  label?: string;
  timeoutSeconds?: number;
  agentId?: string;
  agentName?: string;
  enableDeck?: boolean; // Defaults to true
}

/**
 * Spawn a sub-agent with Deck integration.
 * 
 * This is a drop-in replacement for sessions_spawn that:
 * 1. Auto-registers the agent with the Deck
 * 2. Injects deck logging functions into the agent's environment
 * 3. Captures tool calls and streams them to the Deck
 * 4. Reports completion/errors automatically
 * 
 * Usage:
 * ```typescript
 * import { deckSpawn } from "./deck-spawn";
 * 
 * const agent = await deckSpawn({
 *   task: "Fix the auth bug",
 *   model: "openai/gpt-4o",
 *   label: "coder-agent-1",
 *   agentName: "Coder"
 * });
 * ```
 */
export async function deckSpawn(config: SpawnConfig): Promise<string> {
  const enableDeck = config.enableDeck !== false;
  
  if (!enableDeck) {
    // Fall back to standard spawn
    return sessions_spawn({
      task: config.task,
      model: config.model,
      label: config.label,
      timeoutSeconds: config.timeoutSeconds,
    });
  }
  
  // Generate agent ID
  const agentId = config.agentId || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  const agentName = config.agentName || config.label || `Agent ${agentId.slice(0, 6)}`;
  
  // Build the enhanced task with deck integration
  const enhancedTask = buildEnhancedTask(config.task, agentId, agentName);
  
  // Spawn with deck environment variables
  // Note: We prepend setup code that loads the deck client
  const setupCode = `
// ============================================
// DECK INTEGRATION - Auto-injected
// ============================================
const AGENT_ID = "${agentId}";
const AGENT_NAME = "${agentName}";

// In-memory log buffer (will be flushed to Deck API)
const __deckLogs = [];

async function __flushLogs() {
  while (__deckLogs.length > 0) {
    const log = __deckLogs.shift();
    try {
      await fetch("${process.env.BOTSCHAT_API_URL || 'http://localhost:3004'}/api/agents/${agentId}/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log)
      });
    } catch (e) {
      // Silently fail - don't break agent
    }
  }
}

// Deck API functions (available globally in this agent)
globalThis.deckLog = async (level, message, metadata) => {
  __deckLogs.push({ level, message, metadata, timestamp: Date.now() });
  await __flushLogs();
  console.log(\`[\${level.toUpperCase()}] \${message}\`);
};

globalThis.deckTool = async (toolName, params, result) => {
  const msg = \`$ \${toolName}\`;
  await globalThis.deckLog("tool", msg, { tool: toolName, params, result: result?.toString?.()?.substring(0, 200) });
};

globalThis.deckStatus = async (status, metadata) => {
  try {
    await fetch("${process.env.BOTSCHAT_API_URL || 'http://localhost:3004'}/api/agents/${agentId}/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, metadata })
    });
  } catch (e) {}
};

globalThis.deckComplete = async (result) => {
  await globalThis.deckLog("result", "Task completed", { result });
  await globalThis.deckStatus("completed", { result });
};

globalThis.deckError = async (error) => {
  const msg = error instanceof Error ? error.message : String(error);
  await globalThis.deckLog("error", msg);
  await globalThis.deckStatus("error", { error: msg });
};

// Auto-heartbeat every 30s
setInterval(async () => {
  try {
    await fetch("${process.env.BOTSCHAT_API_URL || 'http://localhost:3004'}/api/agents/${agentId}/heartbeat", {
      method: "POST"
    });
  } catch (e) {}
}, 30000);

// Log startup
await globalThis.deckLog("info", \`Agent \${AGENT_NAME} (\${AGENT_ID}) started\`);
await globalThis.deckStatus("running");

// ============================================
// ORIGINAL TASK
// ============================================

${config.task}

// ============================================
// COMPLETION HANDLER
// ============================================
await globalThis.deckComplete();
`;

  // Register agent before spawning
  try {
    await fetch(`${process.env.BOTSCHAT_API_URL || 'http://localhost:3004'}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: agentId,
        name: agentName,
        task: config.task,
        model: config.model || "default",
        label: config.label || agentName,
        sessionKey: `agent:${agentId}`,
      }),
    });
  } catch (e) {
    console.warn("[deckSpawn] Failed to pre-register agent:", e);
  }
  
  // Spawn the agent
  const result = await sessions_spawn({
    task: setupCode,
    model: config.model,
    label: config.label,
    timeoutSeconds: config.timeoutSeconds,
  });
  
  return result;
}

/**
 * Spawn multiple agents as a swarm with Deck integration
 */
export async function deckSpawnSwarm(
  configs: Array<Omit<SpawnConfig, 'enableDeck'>>,
  options?: { parallel?: boolean; timeoutSeconds?: number }
): Promise<string[]> {
  const { parallel = true } = options || {};
  
  if (parallel) {
    // Spawn all in parallel
    const promises = configs.map(cfg => deckSpawn(cfg));
    return Promise.all(promises);
  } else {
    // Spawn sequentially
    const results: string[] = [];
    for (const cfg of configs) {
      const result = await deckSpawn(cfg);
      results.push(result);
    }
    return results;
  }
}

function buildEnhancedTask(originalTask: string, agentId: string, agentName: string): string {
  return `
# Agent Task: ${agentName} (${agentId})

## Your Task
${originalTask}

## Available Functions
You have access to these functions to report your progress to the Deck:

- \`await deckLog("info", "message")\` - Log general information
- \`await deckLog("debug", "message", { data })\` - Log debug data
- \`await deckLog("tool", "message")\` - Log tool execution
- \`await deckLog("result", "message")\` - Log results
- \`await deckLog("error", "message")\` - Log errors
- \`await deckTool("toolName", params, result)\` - Report tool usage
- \`await deckStatus("running")\` - Update status
- \`await deckStatus("completed")\` - Mark as done
- \`await deckComplete(result)\` - Complete with result
- \`await deckError(error)\` - Report error

Use these liberally to keep the Deck terminal updated with your progress!
`.trim();
}

// Convenience exports
export { deckSpawn as spawn };
export { deckSpawnSwarm as spawnSwarm };
export default { spawn: deckSpawn, spawnSwarm: deckSpawnSwarm };