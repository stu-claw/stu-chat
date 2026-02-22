-- Channel unified memory: shared context across all sessions in a channel
CREATE TABLE IF NOT EXISTS channel_memory (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  -- Memory content: JSON array of memory entries (facts, preferences, decisions, etc.)
  memory_json TEXT NOT NULL DEFAULT '[]',
  -- Summary of the channel's purpose/focus (auto-generated or user-defined)
  summary TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  UNIQUE(channel_id, user_id)
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_channel_memory_channel ON channel_memory(channel_id);
