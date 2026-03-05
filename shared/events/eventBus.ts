/**
 * EventBus — Unified event system for service-to-service communication
 *
 * Fire-and-forget pattern with optional async handlers.
 * Supports scoped events (tenant-level), wildcard subscriptions,
 * and middleware hooks.
 */

// ============================================
// Event Types — Extend as features grow
// ============================================

export interface EventMap {
  // Marketing Agent
  'agent:message.sent': { sessionId: string; userId: string; message: string };
  'agent:message.received': { sessionId: string; messageId: string; toolCalls: string[] };
  'agent:tool.executed': { sessionId: string; toolName: string; durationMs: number; success: boolean };
  'agent:approval.requested': { sessionId: string; actionId: string; toolName: string; userId: string };
  'agent:approval.resolved': { sessionId: string; actionId: string; decision: 'approve' | 'reject'; userId: string };
  'agent:memory.extracted': { sessionId: string; tenantId: string; facts: string[] };

  // Workflow
  'workflow:instance.created': { instanceId: string; templateId: string; tenantId: string };
  'workflow:step.completed': { instanceId: string; stepId: string; assigneeId: string };
  'workflow:instance.completed': { instanceId: string; tenantId: string };

  // Task
  'task:created': { taskId: string; tenantId: string; assigneeId?: string };
  'task:status.changed': { taskId: string; from: string; to: string };

  // Content
  'content:plan.submitted': { planId: string; tenantId: string };
  'content:plan.approved': { planId: string; tenantId: string; approvedBy: string };

  // Audit
  'audit:action.logged': { auditId: string; action: string; tenantId: string };

  // System
  'system:error': { source: string; error: string; severity: 'low' | 'medium' | 'high' | 'critical' };
}

export type EventName = keyof EventMap;
export type EventPayload<E extends EventName> = EventMap[E];

// ============================================
// Handler Types
// ============================================

type EventHandler<E extends EventName> = (
  payload: EventPayload<E>,
  meta: EventMeta
) => void | Promise<void>;

type WildcardHandler = (
  event: EventName,
  payload: any,
  meta: EventMeta
) => void | Promise<void>;

export interface EventMeta {
  eventId: string;
  timestamp: number;
  tenantId?: string;
}

// ============================================
// Middleware
// ============================================

type Middleware = (
  event: EventName,
  payload: any,
  meta: EventMeta,
  next: () => Promise<void>
) => Promise<void>;

// ============================================
// EventBus Implementation
// ============================================

class EventBusImpl {
  private handlers = new Map<EventName, Set<EventHandler<any>>>();
  private wildcardHandlers = new Set<WildcardHandler>();
  private middlewares: Middleware[] = [];
  private idCounter = 0;

  /**
   * Subscribe to a specific event
   */
  on<E extends EventName>(event: E, handler: EventHandler<E>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  /**
   * Subscribe to ALL events (for logging, audit, etc.)
   */
  onAny(handler: WildcardHandler): () => void {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  /**
   * Add middleware (e.g., tenant filtering, logging)
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Emit an event — fire and forget
   * Handlers run async; errors are caught and logged.
   */
  emit<E extends EventName>(
    event: E,
    payload: EventPayload<E>,
    tenantId?: string
  ): void {
    const meta: EventMeta = {
      eventId: `evt_${Date.now()}_${++this.idCounter}`,
      timestamp: Date.now(),
      tenantId,
    };

    // Run in background — don't block caller
    this.dispatch(event, payload, meta).catch((err) => {
      console.error(`[EventBus] Unhandled error in ${event}:`, err);
    });
  }

  /**
   * Emit and wait for all handlers to complete
   */
  async emitAsync<E extends EventName>(
    event: E,
    payload: EventPayload<E>,
    tenantId?: string
  ): Promise<void> {
    const meta: EventMeta = {
      eventId: `evt_${Date.now()}_${++this.idCounter}`,
      timestamp: Date.now(),
      tenantId,
    };
    await this.dispatch(event, payload, meta);
  }

  /**
   * Clear all handlers (for testing)
   */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
    this.middlewares = [];
    this.idCounter = 0;
  }

  // ── Internal ──

  private async dispatch(event: EventName, payload: any, meta: EventMeta): Promise<void> {
    // Build middleware chain
    const execute = async () => {
      const specific = this.handlers.get(event);
      const promises: Promise<void>[] = [];

      if (specific) {
        for (const handler of specific) {
          promises.push(this.safeCall(() => handler(payload, meta), event));
        }
      }

      for (const handler of this.wildcardHandlers) {
        promises.push(this.safeCall(() => handler(event, payload, meta), event));
      }

      await Promise.allSettled(promises);
    };

    // Apply middlewares in order
    let chain = execute;
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const mw = this.middlewares[i];
      const next = chain;
      chain = () => mw(event, payload, meta, next);
    }

    await chain();
  }

  private async safeCall(fn: () => void | Promise<void>, event: EventName): Promise<void> {
    try {
      await fn();
    } catch (err) {
      console.error(`[EventBus] Handler error for ${event}:`, err);
    }
  }
}

// ============================================
// Singleton Export
// ============================================

export const eventBus = new EventBusImpl();

// ============================================
// Built-in Middlewares
// ============================================

/** Log all events to console (dev only) */
export function loggingMiddleware(): Middleware {
  return async (event, _payload, meta, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`[EventBus] ${event} (${meta.eventId}) — ${ms}ms`);
  };
}

/** Filter events to only those matching a tenantId */
export function tenantFilterMiddleware(tenantId: string): Middleware {
  return async (event, _payload, meta, next) => {
    // System events pass through regardless
    if (event.startsWith('system:') || !meta.tenantId || meta.tenantId === tenantId) {
      await next();
    }
    // Silently skip events for other tenants
  };
}
