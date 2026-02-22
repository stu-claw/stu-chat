// Agent Integration - Hooks into sessions_spawn to register and log sub-agents
// This module provides utilities for sub-agents to register themselves
// and stream logs back to the Deck view.

import { agentRegistry, type AgentRegistration } from "./registry";
import { logAggregator } from "../logs/aggregator";

// Configuration for agent integration
interface AgentIntegrationConfig {
  apiBaseUrl: string;
  authToken?: string;
}

let config: AgentIntegrationConfig = {
  apiBaseUrl: "http://localhost:3004", // Default for local dev
};

export function configureAgentIntegration(cfg: Partial<AgentIntegrationConfig>) {
  config = { ...config, ...cfg };
}

// Register this agent with the registry
export async function registerAgent(agentInfo: Omit<AgentRegistration, 'spawnedAt' | 'lastHeartbeatAt' | 'status'>): Promise<AgentRegistration> {
  return agentRegistry.register(agentInfo);
}

// Send a log entry
export async function log(agentId: string, level: Parameters<typeof logAggregator['log']>[1], message: string, metadata?: Record<string, any>) {
  return logAggregator.log(agentId, level, message, metadata);
}

// Log tool execution
export async function logTool(agentId: string, toolName: string, params: any, result?: any) {
  return logAggregator.tool(agentId, toolName, params, result);
}

// Mark agent as complete
export async function completeAgent(agentId: string, result?: any) {
  return agentRegistry.complete(agentId, result);
}

// Mark agent as error
export async function errorAgent(agentId: string, error: string) {
  return agentRegistry.error(agentId, error);
}

// Heartbeat to keep agent alive
export async function heartbeat(agentId: string) {
  return agentRegistry.heartbeat(agentId);
}

// Auto-register from environment (for sub-agents spawned via sessions_spawn)
export async function autoRegisterFromEnv(): Promise<AgentRegistration | null> {
  const agentId = process.env.BOTSCHAT_AGENT_ID;
  const agentName = process.env.BOTSCHAT_AGENT_NAME;
  const task = process.env.BOTSCHAT_TASK;
  const model = process.env.BOTSCHAT_MODEL;
  const label = process.env.BOTSCHAT_LABEL;
  const sessionKey = process.env.BOTSCHAT_SESSION_KEY;
  const parentSessionId = process.env.BOTSCHAT_PARENT_SESSION_ID;
  
  if (!agentId || !agentName || !task) {
    console.log("[AgentIntegration] No auto-registration env vars found");
    return null;
  }
  
  console.log(`[AgentIntegration] Auto-registering agent ${agentId}`);
  
  const registration = await registerAgent({
    id: agentId,
    name: agentName,
    task,
    model: model || "unknown",
    label: label || agentName,
    sessionKey: sessionKey || "",
    parentSessionId,
  });
  
  // Start heartbeat
  startHeartbeat(agentId);
  
  return registration;
}

// Start automatic heartbeat
function startHeartbeat(agentId: string, intervalMs: number = 30000) {
  const interval = setInterval(async () => {
    try {
      await heartbeat(agentId);
    } catch (err) {
      console.error(`[AgentIntegration] Heartbeat failed for ${agentId}:`, err);
      clearInterval(interval);
    }
  }, intervalMs);
  
  // Cleanup on process exit
  process.on("exit", () => {
    clearInterval(interval);
  });
}

// Wrap a function to capture logs
export function withLogging<T extends (...args: any[]) => any>(
  agentId: string,
  fn: T,
  operationName?: string
): T {
  return (async (...args: any[]) => {
    const name = operationName || fn.name || "unknown";
    
    await log(agentId, "info", `Starting: ${name}`, { args: args.map(a => typeof a === "object" ? "[object]" : a) });
    
    try {
      const result = await fn(...args);
      await log(agentId, "result", `Completed: ${name}`, { result: typeof result === "object" ? "[object]" : result });
      return result;
    } catch (error) {
      await log(agentId, "error", `Failed: ${name}`, { error: String(error) });
      throw error;
    }
  }) as T;
}

// Hook into tool executions (monkey-patch style)
export function hookToolExecution(agentId: string, tools: Record<string, Function>) {
  const hookedTools: Record<string, Function> = {};
  
  for (const [toolName, toolFn] of Object.entries(tools)) {
    hookedTools[toolName] = async (...args: any[]) => {
      const startTime = Date.now();
      
      await logTool(agentId, toolName, args[0] || {});
      
      try {
        const result = await toolFn(...args);
        const duration = Date.now() - startTime;
        
        await log(agentId, "debug", `${toolName} completed in ${duration}ms`, {
          result: typeof result === "object" ? "[object]" : result,
        });
        
        return result;
      } catch (error) {
        await log(agentId, "error", `${toolName} failed: ${String(error)}`);
        throw error;
      }
    };
  }
  
  return hookedTools;
}

// Export for convenience
export { agentRegistry, logAggregator };
export type { AgentRegistration };