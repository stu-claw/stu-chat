# Deck Agent Integration

This module provides seamless integration between sub-agents spawned via `sessions_spawn` and the Deck view in BotsChat Control Hub.

## Quick Start

### For Orchestrator (Main Agent)

Use `deckSpawn()` instead of `sessions_spawn()`:

```typescript
import { deckSpawn, deckSpawnSwarm } from "@botschat/agents/deck-spawn";

// Spawn a single agent with Deck integration
const agent = await deckSpawn({
  task: "Fix the authentication bug in login.ts",
  model: "openai/gpt-4o",
  label: "coder-auth-fix",
  agentName: "Auth Fixer",
  timeoutSeconds: 600,
});

// Spawn a swarm of agents
const swarm = await deckSpawnSwarm([
  { task: "Research OAuth2 best practices", model: "openai/gpt-4o", label: "researcher", agentName: "Researcher" },
  { task: "Review login.ts code", model: "openai/gpt-4o", label: "reviewer", agentName: "Reviewer" },
  { task: "Write test cases", model: "openai/gpt-4o", label: "tester", agentName: "Tester" },
]);
```

### For Sub-Agents

Inside your sub-agent task, use the auto-injected Deck functions:

```typescript
// These functions are automatically available - no import needed!

// Log progress
await deckLog("info", "Starting analysis of login.ts");
await deckLog("debug", "Found 3 authentication methods", { methods: ["oauth", "jwt", "session"] });

// Log tool usage (auto-captured for most tools)
await deckTool("read", { path: "/src/auth/login.ts" }, fileContent);

// Report completion
await deckComplete({ fixed: true, filesChanged: ["login.ts", "auth.ts"] });

// Or report errors
await deckError("Failed to parse login.ts - syntax error on line 42");
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR (You)                       │
│                                                             │
│  ┌─────────────┐    deckSpawn()     ┌─────────────────────┐ │
│  │  Deck View  │ ←───────────────── │  Agent Registry     │ │
│  │  (UI)       │                    │  (tracks agents)    │ │
│  └─────────────┘                    └─────────────────────┘ │
│         ↑                              │                    │
│         │ WebSocket                    │ HTTP               │
│         │ (log stream)                 │ (register)         │
│  ┌──────┴──────┐                       ↓                    │
│  │ Log         │              ┌─────────────────────┐        │
│  │ Aggregator  │              │  SUB-AGENT          │        │
│  │ (backend)   │              │  (spawned)          │        │
│  └─────────────┘              │                     │        │
│                               │  deckLog() ─────────┼────────┘
│                               │  deckTool() ────────┘
│                               │  deckComplete()
│                               └─────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

## API Reference

### `deckSpawn(options)`

Spawns a sub-agent with Deck integration.

**Options:**
- `task` (required): The task description for the agent
- `model`: Model to use (e.g., "openai/gpt-4o")
- `label`: Identifier label for the agent
- `agentName`: Human-readable name shown in Deck
- `agentId`: Optional custom ID (auto-generated if not provided)
- `timeoutSeconds`: Timeout in seconds
- `enableDeck`: Set to `false` to disable Deck integration

**Returns:** Promise that resolves when agent completes

### `deckSpawnSwarm(configs, options)`

Spawns multiple agents in parallel.

**Options:**
- `parallel`: Whether to spawn in parallel (default: true)
- `timeoutSeconds`: Global timeout

### Functions Available in Sub-Agents

These are automatically injected into the sub-agent's global scope:

| Function | Description | Example |
|----------|-------------|---------|
| `deckLog(level, message, metadata?)` | Log a message | `await deckLog("info", "Starting...")` |
| `deckTool(name, params, result?)` | Log tool execution | `await deckTool("read", {path: "file.ts"}, content)` |
| `deckStatus(status, metadata?)` | Update agent status | `await deckStatus("running")` |
| `deckComplete(result?)` | Mark task complete | `await deckComplete({ success: true })` |
| `deckError(error)` | Report error | `await deckError("Something broke")` |

**Log Levels:**
- `debug`: Debug information
- `info`: General information
- `warn`: Warnings
- `error`: Errors
- `tool`: Tool execution
- `result`: Task results

## Best Practices

1. **Log liberally**: The Deck terminal shows your agent's activity in real-time
2. **Use tool logging**: Always log tool calls so users can see what you're doing
3. **Update status**: Call `deckStatus()` when moving between phases
4. **Report completion**: Always call `deckComplete()` or `deckError()` at the end
5. **Include metadata**: Add useful context to logs for debugging

## Example: Complete Workflow

```typescript
// 1. Spawn agents from orchestrator
const agents = await deckSpawnSwarm([
  { 
    task: "Research current OAuth2 vulnerabilities",
    model: "openai/gpt-4o",
    label: "oauth-research",
    agentName: "OAuth Researcher"
  },
  { 
    task: "Review our auth implementation for issues",
    model: "openai/gpt-4o", 
    label: "auth-review",
    agentName: "Security Reviewer"
  },
]);

// 2. Inside the Researcher agent:
await deckLog("info", "Starting OAuth2 vulnerability research");
await deckStatus("running");

const vulnerabilities = await searchSecurityDb("oauth2 2024");
await deckTool("searchSecurityDb", { query: "oauth2 2024" }, vulnerabilities);

await deckLog("result", `Found ${vulnerabilities.length} relevant vulnerabilities`);
await deckComplete({ vulnerabilities });

// 3. Inside the Reviewer agent:
await deckLog("info", "Reviewing auth implementation");
await deckTool("read", { path: "/src/auth.ts" }, authCode);

const issues = analyzeCode(authCode);
for (const issue of issues) {
  await deckLog("warn", `Found issue: ${issue.description}`, { line: issue.line });
}

await deckComplete({ issues });
```

## Troubleshooting

**Agent not appearing in Deck:**
- Check that `BOTSCHAT_API_URL` env var is set correctly
- Ensure the orchestrator has network access to the API

**Logs not showing:**
- Verify the agent is calling `deckLog()` 
- Check browser console for WebSocket connection errors
- Ensure `deckInit()` was called (auto-called by `deckSpawn`)

**Agent shows as "disconnected":**
- Check that heartbeat is being sent (auto every 30s)
- Verify agent hasn't crashed or timed out