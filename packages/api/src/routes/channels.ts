import { Hono } from "hono";
import type { Env } from "../env.js";
import { generateId } from "../utils/id.js";

const channels = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

/** GET /api/channels — list all channels for the current user */
channels.get("/", async (c) => {
  const userId = c.get("userId");

  const { results } = await c.env.DB.prepare(
    "SELECT id, name, description, openclaw_agent_id, system_prompt, created_at, updated_at FROM channels WHERE user_id = ? ORDER BY created_at DESC",
  )
    .bind(userId)
    .all<{
      id: string;
      name: string;
      description: string;
      openclaw_agent_id: string;
      system_prompt: string;
      created_at: number;
      updated_at: number;
    }>();

  return c.json({
    channels: (results ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      openclawAgentId: r.openclaw_agent_id,
      systemPrompt: r.system_prompt,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
});

/** Default system prompt for new channels - establishes AI identity and channel memory */
const DEFAULT_CHANNEL_SYSTEM_PROMPT = `You are a high-agency, professional, unbiased AI assistant operating within this dedicated channel.

## Your Core Identity
- You are an elite AI assistant with deep expertise across business, technology, research, and creative domains
- You are proactive, efficient, and direct in your communication
- You maintain professional tone while being approachable and helpful
- You have high agency: you take initiative, anticipate needs, and execute tasks without excessive confirmation

## Channel Memory System
This channel maintains unified memory across all sessions. You have access to:
- Previously established facts, preferences, and decisions
- Ongoing projects and their current status
- User habits, workflows, and communication style
- Important context that persists across conversations

When you learn something significant (facts, preferences, project details, decisions), you should reference and build upon this knowledge in future sessions.

## User Awareness
You know the user is logged in and authenticated. You do not need to ask "who are you" or "who am I" - you have access to their identity and channel history. Focus immediately on being helpful.

## Operating Principles
1. **Unified Context**: Treat all sessions in this channel as one continuous conversation
2. **Proactive**: Anticipate needs and offer relevant suggestions
3. **Efficient**: Get to the point quickly; avoid unnecessary pleasantries
4. **Accurate**: If uncertain, say so clearly rather than guessing
5. **Helpful**: Prioritize actionable, practical assistance`;

/** POST /api/channels — create a new channel */
channels.post("/", async (c) => {
  const userId = c.get("userId");
  const { name, description, openclawAgentId, systemPrompt } = await c.req.json<{
    name: string;
    description?: string;
    openclawAgentId?: string;
    systemPrompt?: string;
  }>();

  if (!name?.trim()) {
    return c.json({ error: "Channel name is required" }, 400);
  }

  const id = generateId("ch_");
  // Auto-assign Kimi K2.5 agent with channel-specific name
  const baseAgentId = openclawAgentId?.trim() ||
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  
  // Ensure unique agent ID by appending channel ID suffix
  const agentId = `${baseAgentId}-${id.slice(-6)}`;
  
  // Use provided system prompt or default
  const finalSystemPrompt = systemPrompt?.trim() || DEFAULT_CHANNEL_SYSTEM_PROMPT;

  await c.env.DB.prepare(
    "INSERT INTO channels (id, user_id, name, description, openclaw_agent_id, system_prompt) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(id, userId, name.trim(), description?.trim() ?? "", agentId, finalSystemPrompt)
    .run();
  
  // Initialize channel memory
  await c.env.DB.prepare(
    "INSERT INTO channel_memory (id, channel_id, user_id, memory_json, summary) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(generateId("mem_"), id, userId, "[]", `Channel: ${name.trim()}`)
    .run();

  // Auto-create a default "Ad Hoc Chat" task
  const taskId = generateId("tsk_");
  const sessionKey = `agent:${agentId}:botschat:${userId}:adhoc`;
  await c.env.DB.prepare(
    "INSERT INTO tasks (id, channel_id, name, kind, session_key) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(taskId, id, "Ad Hoc Chat", "adhoc", sessionKey)
    .run();

  // Auto-create a default session (INSERT OR IGNORE to handle duplicate session_key
  // gracefully — can happen if user re-creates a channel with the same name)
  const sessionId = generateId("ses_");
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO sessions (id, channel_id, user_id, name, session_key) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(sessionId, id, userId, "Session 1", sessionKey)
    .run();

  return c.json(
    {
      id,
      name: name.trim(),
      description: description?.trim() ?? "",
      openclawAgentId: agentId,
      systemPrompt: systemPrompt?.trim() ?? "",
    },
    201,
  );
});

/** GET /api/channels/:id — get a single channel */
channels.get("/:id", async (c) => {
  const userId = c.get("userId");
  const channelId = c.req.param("id");

  const row = await c.env.DB.prepare(
    "SELECT id, name, description, openclaw_agent_id, system_prompt, created_at, updated_at FROM channels WHERE id = ? AND user_id = ?",
  )
    .bind(channelId, userId)
    .first<{
      id: string;
      name: string;
      description: string;
      openclaw_agent_id: string;
      system_prompt: string;
      created_at: number;
      updated_at: number;
    }>();

  if (!row) return c.json({ error: "Channel not found" }, 404);

  return c.json({
    id: row.id,
    name: row.name,
    description: row.description,
    openclawAgentId: row.openclaw_agent_id,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
});

/** PATCH /api/channels/:id — update a channel */
channels.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const channelId = c.req.param("id");
  const body = await c.req.json<{
    name?: string;
    description?: string;
    systemPrompt?: string;
  }>();

  const sets: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    sets.push("name = ?");
    values.push(body.name.trim());
  }
  if (body.description !== undefined) {
    sets.push("description = ?");
    values.push(body.description.trim());
  }
  if (body.systemPrompt !== undefined) {
    sets.push("system_prompt = ?");
    values.push(body.systemPrompt.trim());
  }

  if (sets.length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  sets.push("updated_at = unixepoch()");
  values.push(channelId, userId);

  await c.env.DB.prepare(
    `UPDATE channels SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
  )
    .bind(...values)
    .run();

  return c.json({ ok: true });
});

/** DELETE /api/channels/:id — delete a channel */
channels.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const channelId = c.req.param("id");

  await c.env.DB.prepare(
    "DELETE FROM channels WHERE id = ? AND user_id = ?",
  )
    .bind(channelId, userId)
    .run();

  return c.json({ ok: true });
});

export { channels };
