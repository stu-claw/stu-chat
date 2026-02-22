// Log Aggregator - Collects and streams logs from sub-agents
// Provides real-time log streaming via WebSocket

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'tool' | 'result';

export interface LogEntry {
  id: string;
  agentId: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  taskId?: string;
}

export interface LogStreamSubscriber {
  agentId: string;
  callback: (log: LogEntry) => void;
}

class LogAggregator {
  private logs = new Map<string, LogEntry[]>(); // agentId -> logs
  private subscribers = new Map<string, Set<(log: LogEntry) => void>>(); // agentId -> callbacks
  private globalSubscribers = new Set<(log: LogEntry) => void>();
  private readonly MAX_LOGS_PER_AGENT = 500;
  
  // Add a log entry
  async log(
    agentId: string,
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    taskId?: string
  ): Promise<LogEntry> {
    const entry: LogEntry = {
      id: `${agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      timestamp: Date.now(),
      level,
      message,
      metadata,
      taskId,
    };
    
    // Store log
    let agentLogs = this.logs.get(agentId);
    if (!agentLogs) {
      agentLogs = [];
      this.logs.set(agentId, agentLogs);
    }
    
    agentLogs.push(entry);
    
    // Trim old logs
    if (agentLogs.length > this.MAX_LOGS_PER_AGENT) {
      agentLogs.shift();
    }
    
    // Notify subscribers
    this.notifySubscribers(entry);
    
    return entry;
  }
  
  // Quick helpers for common log levels
  async debug(agentId: string, message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log(agentId, 'debug', message, metadata);
  }
  
  async info(agentId: string, message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log(agentId, 'info', message, metadata);
  }
  
  async warn(agentId: string, message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log(agentId, 'warn', message, metadata);
  }
  
  async error(agentId: string, message: string, metadata?: Record<string, any>): Promise<LogEntry> {
    return this.log(agentId, 'error', message, metadata);
  }
  
  // Log tool execution
  async tool(agentId: string, toolName: string, params: any, result?: any): Promise<LogEntry> {
    return this.log(agentId, 'tool', `$ ${toolName}`, {
      tool: toolName,
      params,
      result: result ? JSON.stringify(result).substring(0, 500) : undefined,
    });
  }
  
  // Log result/completion
  async result(agentId: string, message: string, data?: any): Promise<LogEntry> {
    return this.log(agentId, 'result', message, data);
  }
  
  // Get logs for an agent
  async getLogs(agentId: string, limit: number = 100): Promise<LogEntry[]> {
    const agentLogs = this.logs.get(agentId) || [];
    return agentLogs.slice(-limit);
  }
  
  // Get recent logs across all agents
  async getRecentLogs(limit: number = 100): Promise<LogEntry[]> {
    const allLogs: LogEntry[] = [];
    for (const logs of this.logs.values()) {
      allLogs.push(...logs);
    }
    return allLogs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  // Subscribe to logs for a specific agent
  subscribe(agentId: string, callback: (log: LogEntry) => void): () => void {
    let subs = this.subscribers.get(agentId);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(agentId, subs);
    }
    subs.add(callback);
    
    // Return unsubscribe function
    return () => {
      subs?.delete(callback);
    };
  }
  
  // Subscribe to all logs (global)
  subscribeAll(callback: (log: LogEntry) => void): () => void {
    this.globalSubscribers.add(callback);
    return () => {
      this.globalSubscribers.delete(callback);
    };
  }
  
  // Notify subscribers of new log
  private notifySubscribers(log: LogEntry): void {
    // Notify agent-specific subscribers
    const agentSubs = this.subscribers.get(log.agentId);
    if (agentSubs) {
      for (const callback of agentSubs) {
        try {
          callback(log);
        } catch (err) {
          console.error('[LogAggregator] Subscriber error:', err);
        }
      }
    }
    
    // Notify global subscribers
    for (const callback of this.globalSubscribers) {
      try {
        callback(log);
      } catch (err) {
        console.error('[LogAggregator] Global subscriber error:', err);
      }
    }
  }
  
  // Clear logs for an agent
  async clearLogs(agentId: string): Promise<void> {
    this.logs.delete(agentId);
  }
  
  // Clear all logs
  async clearAllLogs(): Promise<void> {
    this.logs.clear();
  }
  
  // Cleanup logs for agents that no longer exist
  async cleanup(agentIds: string[]): Promise<number> {
    let cleaned = 0;
    for (const id of this.logs.keys()) {
      if (!agentIds.includes(id)) {
        this.logs.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
  
  // Get stats
  getStats(): { totalAgents: number; totalLogs: number } {
    let totalLogs = 0;
    for (const logs of this.logs.values()) {
      totalLogs += logs.length;
    }
    return {
      totalAgents: this.logs.size,
      totalLogs,
    };
  }
}

// Singleton instance
export const logAggregator = new LogAggregator();

// Re-export types
export type { LogAggregator };