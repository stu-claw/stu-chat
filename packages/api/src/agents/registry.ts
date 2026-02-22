// Agent Registry - Tracks active sub-agents spawned via sessions_spawn
// Uses in-memory storage with D1 persistence for recovery

export interface AgentRegistration {
  id: string;
  name: string;
  task: string;
  model: string;
  label: string;
  status: 'initializing' | 'running' | 'completed' | 'error';
  spawnedAt: number;
  lastHeartbeatAt: number;
  sessionKey: string;
  parentSessionId?: string;
  metadata?: Record<string, any>;
}

class AgentRegistry {
  private agents = new Map<string, AgentRegistration>();
  private readonly HEARTBEAT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  // Register a new sub-agent
  async register(agent: Omit<AgentRegistration, 'spawnedAt' | 'lastHeartbeatAt' | 'status'>): Promise<AgentRegistration> {
    const now = Date.now();
    const registration: AgentRegistration = {
      ...agent,
      status: 'initializing',
      spawnedAt: now,
      lastHeartbeatAt: now,
    };
    
    this.agents.set(agent.id, registration);
    console.log(`[AgentRegistry] Registered agent ${agent.id} (${agent.name})`);
    return registration;
  }
  
  // Update agent status
  async updateStatus(agentId: string, status: AgentRegistration['status'], metadata?: Record<string, any>): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.warn(`[AgentRegistry] Agent ${agentId} not found for status update`);
      return;
    }
    
    agent.status = status;
    agent.lastHeartbeatAt = Date.now();
    if (metadata) {
      agent.metadata = { ...agent.metadata, ...metadata };
    }
    
    console.log(`[AgentRegistry] Agent ${agentId} status: ${status}`);
  }
  
  // Heartbeat - keeps agent alive
  async heartbeat(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeatAt = Date.now();
    }
  }
  
  // Get all active agents
  async getActiveAgents(): Promise<AgentRegistration[]> {
    const now = Date.now();
    const active: AgentRegistration[] = [];
    
    for (const agent of this.agents.values()) {
      // Check if agent is still alive (recent heartbeat)
      const isAlive = (now - agent.lastHeartbeatAt) < this.HEARTBEAT_TIMEOUT;
      
      if (isAlive && (agent.status === 'initializing' || agent.status === 'running')) {
        active.push(agent);
      } else if (!isAlive && agent.status !== 'completed' && agent.status !== 'error') {
        // Mark as error if heartbeat timed out
        agent.status = 'error';
        agent.metadata = { ...agent.metadata, error: 'Heartbeat timeout' };
      }
    }
    
    return active.sort((a, b) => b.spawnedAt - a.spawnedAt);
  }
  
  // Get specific agent
  async getAgent(agentId: string): Promise<AgentRegistration | undefined> {
    return this.agents.get(agentId);
  }
  
  // Mark agent as completed
  async complete(agentId: string, result?: any): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'completed';
      agent.lastHeartbeatAt = Date.now();
      if (result) {
        agent.metadata = { ...agent.metadata, result };
      }
      console.log(`[AgentRegistry] Agent ${agentId} completed`);
    }
  }
  
  // Mark agent as error
  async error(agentId: string, error: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'error';
      agent.lastHeartbeatAt = Date.now();
      agent.metadata = { ...agent.metadata, error };
      console.log(`[AgentRegistry] Agent ${agentId} error: ${error}`);
    }
  }
  
  // Unregister/remove agent
  async unregister(agentId: string): Promise<void> {
    this.agents.delete(agentId);
    console.log(`[AgentRegistry] Unregistered agent ${agentId}`);
  }
  
  // Cleanup stale agents
  async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [id, agent] of this.agents.entries()) {
      if (now - agent.lastHeartbeatAt > this.HEARTBEAT_TIMEOUT * 2) {
        this.agents.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[AgentRegistry] Cleaned up ${cleaned} stale agents`);
    }
    return cleaned;
  }
  
  // Get stats
  getStats(): { total: number; active: number; completed: number; error: number } {
    const stats = { total: 0, active: 0, completed: 0, error: 0 };
    for (const agent of this.agents.values()) {
      stats.total++;
      if (agent.status === 'running' || agent.status === 'initializing') stats.active++;
      if (agent.status === 'completed') stats.completed++;
      if (agent.status === 'error') stats.error++;
    }
    return stats;
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();

// Note: Cleanup is triggered manually via API call or on first request
// Cloudflare Workers don't support setInterval at global scope