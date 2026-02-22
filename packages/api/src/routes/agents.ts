import { Hono } from 'hono';
import { agentRegistry } from '../agents/registry';
import { logAggregator } from '../logs/aggregator';
import type { Env } from '../env';

const app = new Hono<{ Bindings: Env }>();

// GET /api/agents - List all active agents
app.get('/', async (c) => {
  try {
    const agents = await agentRegistry.getActiveAgents();
    return c.json({ agents });
  } catch (err) {
    console.error('[API] Error listing agents:', err);
    return c.json({ error: 'Failed to list agents' }, 500);
  }
});

// POST /api/agents - Register a new agent
app.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, task, model, label, sessionKey, parentSessionId, metadata } = body;
    
    if (!id || !name || !task) {
      return c.json({ error: 'Missing required fields: id, name, task' }, 400);
    }
    
    const agent = await agentRegistry.register({
      id,
      name,
      task,
      model: model || 'unknown',
      label: label || name,
      sessionKey: sessionKey || '',
      parentSessionId,
      metadata,
    });
    
    // Log the registration
    await logAggregator.info(id, `Agent registered: ${name}`, { task, model });
    
    return c.json({ agent }, 201);
  } catch (err) {
    console.error('[API] Error registering agent:', err);
    return c.json({ error: 'Failed to register agent' }, 500);
  }
});

// GET /api/agents/:id - Get specific agent
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const agent = await agentRegistry.getAgent(id);
    
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }
    
    return c.json({ agent });
  } catch (err) {
    console.error('[API] Error getting agent:', err);
    return c.json({ error: 'Failed to get agent' }, 500);
  }
});

// POST /api/agents/:id/heartbeat - Agent heartbeat
app.post('/:id/heartbeat', async (c) => {
  try {
    const id = c.req.param('id');
    await agentRegistry.heartbeat(id);
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API] Error processing heartbeat:', err);
    return c.json({ error: 'Failed to process heartbeat' }, 500);
  }
});

// POST /api/agents/:id/status - Update agent status
app.post('/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const { status, metadata } = await c.req.json();
    
    await agentRegistry.updateStatus(id, status, metadata);
    
    // Log status change
    await logAggregator.info(id, `Status changed to: ${status}`, metadata);
    
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API] Error updating status:', err);
    return c.json({ error: 'Failed to update status' }, 500);
  }
});

// POST /api/agents/:id/complete - Mark agent as completed
app.post('/:id/complete', async (c) => {
  try {
    const id = c.req.param('id');
    const { result } = await c.req.json();
    
    await agentRegistry.complete(id, result);
    await logAggregator.result(id, 'Task completed', result);
    
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API] Error completing agent:', err);
    return c.json({ error: 'Failed to complete agent' }, 500);
  }
});

// POST /api/agents/:id/error - Mark agent as error
app.post('/:id/error', async (c) => {
  try {
    const id = c.req.param('id');
    const { error } = await c.req.json();
    
    await agentRegistry.error(id, error);
    await logAggregator.error(id, error);
    
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API] Error setting agent error:', err);
    return c.json({ error: 'Failed to set agent error' }, 500);
  }
});

// DELETE /api/agents/:id - Unregister agent
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await agentRegistry.unregister(id);
    await logAggregator.clearLogs(id);
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API] Error unregistering agent:', err);
    return c.json({ error: 'Failed to unregister agent' }, 500);
  }
});

// GET /api/agents/:id/logs - Get agent logs
app.get('/:id/logs', async (c) => {
  try {
    const id = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '100', 10);
    
    const logs = await logAggregator.getLogs(id, limit);
    return c.json({ logs });
  } catch (err) {
    console.error('[API] Error getting logs:', err);
    return c.json({ error: 'Failed to get logs' }, 500);
  }
});

// POST /api/agents/:id/logs - Add log entry
app.post('/:id/logs', async (c) => {
  try {
    const id = c.req.param('id');
    const { level, message, metadata, taskId } = await c.req.json();
    
    if (!level || !message) {
      return c.json({ error: 'Missing required fields: level, message' }, 400);
    }
    
    const log = await logAggregator.log(id, level, message, metadata, taskId);
    return c.json({ log }, 201);
  } catch (err) {
    console.error('[API] Error adding log:', err);
    return c.json({ error: 'Failed to add log' }, 500);
  }
});

// GET /api/agents/stats/overview - Get registry stats
app.get('/stats/overview', async (c) => {
  try {
    const registryStats = agentRegistry.getStats();
    const logStats = logAggregator.getStats();
    
    return c.json({
      registry: registryStats,
      logs: logStats,
    });
  } catch (err) {
    console.error('[API] Error getting stats:', err);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

export default app;