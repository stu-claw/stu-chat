// Spawn Agent with Deck Integration
// Wrapper around sessions_spawn that auto-registers the agent and streams logs

import { sessions_spawn } from "@openclaw/core";
import { agentRegistry, logAggregator } from "./integration";
import crypto from "crypto";

interface SpawnWithDeckOptions {
  task: string;
  model?: string;
  label: string;
  agentId?: string;
  name?: string;
  parentSessionId?: string;
  timeoutSeconds?: number;
  logTools?: boolean;
}

interface SpawnedAgent {
  id: string;
  sessionKey: string;
  label: string;
  name: string;
  unregister: () => Promise<void>;
  log: (level: string, message: string, metadata?: any) => Promise<void>;
  complete: (result?: any) => Promise<void>;
  error: (error: string) => Promise<void>;
}

/**
 * Spawn a sub-agent with full Deck integration.
 * 
 * This function:
 * 1. Generates a unique agent ID
 * 2. Registers the agent with the registry
 * 3. Spawns the actual sub-agent via sessions_spawn
 * 4. Hooks into the agent to capture logs and tool calls
 * 5. Returns controls for the parent to update status/logs
 */
export async function spawnWithDeck(opts: SpawnWithDeckOptions): Promise<SpawnedAgent> {
  // Generate unique agent ID
  const agentId = opts.agentId || `agent-${crypto.randomUUID().slice(0, 8)}`;
  const name = opts.name || opts.label;
  const sessionKey = `agent:${agentId}:${Date.now()}`;
  
  console.log(`[SpawnWithDeck] Spawning agent ${agentId} (${name})`);
  
  // Register with agent registry
  await agentRegistry.register({
    id: agentId,
    name,
    task: opts.task,
    model: opts.model || "default",
    label: opts.label,
    sessionKey,
    parentSessionId: opts.parentSessionId,
  });
  
  // Log the spawn
  await logAggregator.info(agentId, `Agent spawned: ${name}`, {
    task: opts.task,
    model: opts.model,
  });
  
  // Build the system prompt with agent integration hooks
  const systemPrompt = buildSystemPrompt(agentId, name, opts.task);
  
  // Spawn the actual sub-agent
  // Note: We pass the agent ID via environment variables so the sub-agent can self-identify
  const spawnPromise = sessions_spawn({
    task: opts.task,
    model: opts.model,
    label: opts.label,
    timeoutSeconds: opts.timeoutSeconds,
    // Prepend our integration setup to the task
    systemPrompt: `
You are ${name} (ID: ${agentId}), a specialized sub-agent.

Your task: ${opts.task}

IMPORTANT: You have access to the Deck integration system. Use these guidelines:
1. Log your progress regularly using the provided logging tools
2. Report tool executions so they appear in the Deck terminal
3. Call the heartbeat function every 30 seconds to stay "alive"
4. Report completion or errors using the provided functions

${systemPrompt}
    `.trim(),
  });
  
  // Start heartbeat in background
  const heartbeatInterval = setInterval(async () => {
    try {
      await agentRegistry.heartbeat(agentId);
    } catch (err) {
      console.error(`[SpawnWithDeck] Heartbeat failed for ${agentId}:`, err);
    }
  }, 30000);
  
  // Handle completion
  spawnPromise.then(
    async (result) => {
      clearInterval(heartbeatInterval);
      await agentRegistry.complete(agentId, result);
      await logAggregator.result(agentId, "Task completed successfully", result);
    },
    async (error) => {
      clearInterval(heartbeatInterval);
      await agentRegistry.error(agentId, String(error));
      await logAggregator.error(agentId, `Task failed: ${String(error)}`);
    }
  );
  
  // Return controls to parent
  return {
    id: agentId,
    sessionKey,
    label: opts.label,
    name,
    unregister: async () => {
      clearInterval(heartbeatInterval);
      await agentRegistry.unregister(agentId);
    },
    log: async (level, message, metadata) => {
      await logAggregator.log(agentId, level as any, message, metadata);
    },
    complete: async (result) => {
      clearInterval(heartbeatInterval);
      await agentRegistry.complete(agentId, result);
    },
    error: async (error) => {
      clearInterval(heartbeatInterval);
      await agentRegistry.error(agentId, error);
    },
  };
}

/**
 * Spawn multiple agents as a swarm with Deck integration.
 */
export async function spawnSwarmWithDeck(
  agents: Array<{
    label: string;
    name: string;
    task: string;
    model?: string;
  }>,
  parentSessionId?: string
): Promise<SpawnedAgent[]> {
  const spawned: SpawnedAgent[] = [];
  
  // Log swarm creation
  const swarmId = `swarm-${crypto.randomUUID().slice(0, 8)}`;
  await logAggregator.info(swarmId, `Spawning swarm with ${agents.length} agents`, {
    agents: agents.map(a => a.name),
  });
  
  for (const agent of agents) {
    const spawnedAgent = await spawnWithDeck({
      ...agent,
      parentSessionId,
    });
    spawned.push(spawnedAgent);
  }
  
  return spawned;
}

function buildSystemPrompt(agentId: string, name: string, task: string): string {
  return `
INTEGRATION FUNCTIONS (available in your environment):

// Log a message
await deckLog("info", "Starting task...");
await deckLog("debug", "Processing data", { items: 5 });
await deckLog("tool", "Executing: read_file");
await deckLog("result", "Found 3 matches");
await deckLog("error", "File not found");

// Report tool execution (auto-captured for most tools)
await deckTool("tool_name", params, result);

// Update status
await deckStatus("running");  // or "completed", "error"

// Heartbeat (called automatically every 30s)
await deckHeartbeat();

// Report completion
await deckComplete({ result: "..." });

// Report error
await deckError("Something went wrong");

Your agent ID: ${agentId}
Your session key: agent:${agentId}:timestamp

All logs will appear in real-time in the Deck view's terminal panel.
  `.trim();
}

// Export convenience functions for direct use
export { agentRegistry, logAggregator };
export type { SpawnedAgent, SpawnWithDeckOptions };