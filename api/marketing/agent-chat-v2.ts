import type { VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { getAdminDb, getFieldValue } from '../_lib/firebaseAdmin.js';
import { withAuth, AuthenticatedRequest } from '../_lib/withAuth.js';
import { applyRateLimit, LIMITS } from '../_lib/rateLimit.js';
import { toolDeclarations } from './_lib/toolDeclarations.js';
import { SYSTEM_PROMPT } from './_lib/systemPrompt.js';
import { toolHandlers, ToolContext } from './_lib/toolHandlers.js';
import { APPROVAL_REQUIRED_TOOLS, executeApprovedAction } from './_lib/approvalFlow.js';
import { loadMemoriesForPrompt, extractFactsFromConversation, saveExtractedFacts } from './_lib/agentMemory.js';
import { eventBus } from '../../shared/events/eventBus.js';

export const config = {
  maxDuration: 120,
};

// ============================================
// SSE Helpers
// ============================================

function sseWrite(res: VercelResponse, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/** Deep-strip undefined values so Firestore doesn't choke */
function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object' && obj.constructor === Object) {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) clean[k] = stripUndefined(v);
    }
    return clean;
  }
  return obj;
}

function sseError(res: VercelResponse, message: string) {
  sseWrite(res, { type: 'error', message });
  res.end();
}

// ============================================
// Main Handler
// ============================================

export default withAuth(async (req: AuthenticatedRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(res, req.userUid, LIMITS.MARKETING_AGENT)) return;

  const { sessionId, message, approval, skipTitle } = req.body || {};

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const db = getAdminDb();

  // Load session
  const sessionDoc = await db.collection('marketing_agent_sessions').doc(sessionId).get();
  if (!sessionDoc.exists) {
    return sseError(res, 'Session not found');
  }

  const sessionData = sessionDoc.data()!;
  if (sessionData.tenantId !== req.tenantId) {
    return sseError(res, 'Access denied');
  }

  const ctx: ToolContext = {
    db,
    tenantId: req.tenantId,
    sessionId,
    userId: req.userUid,
  };

  // ========================================
  // Approval flow
  // ========================================
  if (approval) {
    const { actionId, decision } = approval;
    const pendingActions: any[] = sessionData.pendingActions || [];
    const actionIndex = pendingActions.findIndex((a: any) => a.id === actionId);

    if (actionIndex === -1) {
      return sseError(res, 'Action not found');
    }

    const action = pendingActions[actionIndex];

    if (decision === 'reject') {
      pendingActions[actionIndex] = { ...action, status: 'rejected', resolvedAt: Date.now() };
      await db.collection('marketing_agent_sessions').doc(sessionId).update({
        pendingActions,
        updatedAt: Date.now(),
      });
      sseWrite(res, { type: 'tool_result', id: actionId, name: action.toolName, data: { rejected: true } });
      sseWrite(res, { type: 'text_delta', content: 'Islem reddedildi.' });
      sseWrite(res, { type: 'done', messageId: `msg_${Date.now()}` });
      return res.end();
    }

    // Approve — execute
    pendingActions[actionIndex] = { ...action, status: 'executing' };
    await db.collection('marketing_agent_sessions').doc(sessionId).update({ pendingActions, updatedAt: Date.now() });

    try {
      const { result, message: resultMsg } = await executeApprovedAction(ctx, action.type, action.payload);
      pendingActions[actionIndex] = { ...action, status: 'completed', result, resolvedAt: Date.now() };

      await db.collection('marketing_agent_sessions').doc(sessionId).update({
        pendingActions,
        updatedAt: Date.now(),
      });

      sseWrite(res, { type: 'tool_result', id: actionId, name: action.toolName, data: result });
      sseWrite(res, { type: 'text_delta', content: resultMsg });
      sseWrite(res, { type: 'done', messageId: `msg_${Date.now()}` });
    } catch (err: any) {
      pendingActions[actionIndex] = { ...action, status: 'failed', result: { error: err.message }, resolvedAt: Date.now() };
      await db.collection('marketing_agent_sessions').doc(sessionId).update({ pendingActions, updatedAt: Date.now() });
      sseWrite(res, { type: 'error', message: err.message });
    }

    return res.end();
  }

  // ========================================
  // Normal message flow
  // ========================================
  if (!message) {
    return sseError(res, 'Missing message');
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return sseError(res, 'GEMINI_API_KEY not configured');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Build content history from session
    const contentHistory: any[] = sessionData.contentHistory || [];

    // Build system instruction with strategy context + memory
    let systemInstruction = SYSTEM_PROMPT;
    if (sessionData.strategyContext) {
      systemInstruction += `\n\n## Strateji Baglami\n${sessionData.strategyContext}`;
    }

    // Inject agent memories
    try {
      const memorySection = await loadMemoriesForPrompt(db, req.tenantId);
      if (memorySection) systemInstruction += memorySection;
    } catch (err) {
      console.warn('[agent-chat-v2] Memory load failed (non-critical):', err);
    }

    // Add user message to history
    contentHistory.push({
      role: 'user',
      parts: [{ text: message }],
    });

    // UI messages for Firestore
    const uiMessages: any[] = sessionData.messages || [];
    uiMessages.push({
      id: `msg_${Date.now()}_user`,
      role: 'user',
      parts: [{ type: 'text', content: message }],
      timestamp: Date.now(),
    });

    const assistantParts: any[] = [];
    const assistantMsgId = `msg_${Date.now()}_assistant`;
    const newPendingActions: any[] = [];

    // Tool execution loop
    let loopCount = 0;
    const MAX_LOOPS = 8;
    let currentHistory = [...contentHistory];

    while (loopCount < MAX_LOOPS) {
      loopCount++;

      const response = await ai.models.generateContentStream({
        model: 'gemini-2.0-flash',
        contents: currentHistory,
        config: {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 4096,
          tools: [{ functionDeclarations: toolDeclarations }],
        },
      });

      let textAccum = '';
      const functionCalls: Array<{ name: string; args: Record<string, any>; id: string }> = [];

      for await (const chunk of response) {
        if (!chunk.candidates?.[0]?.content?.parts) continue;

        for (const part of chunk.candidates[0].content.parts) {
          if (part.text) {
            sseWrite(res, { type: 'text_delta', content: part.text });
            textAccum += part.text;
          }
          if (part.functionCall) {
            const callId = `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            functionCalls.push({
              name: part.functionCall.name!,
              args: (part.functionCall.args || {}) as Record<string, any>,
              id: callId,
            });
            sseWrite(res, {
              type: 'tool_call',
              id: callId,
              name: part.functionCall.name,
              args: part.functionCall.args,
            });
          }
        }
      }

      // Save text to UI parts
      if (textAccum) {
        assistantParts.push({ type: 'text', content: textAccum });
      }

      // Add model response to history
      const modelParts: any[] = [];
      if (textAccum) modelParts.push({ text: textAccum });
      for (const fc of functionCalls) {
        modelParts.push({ functionCall: { name: fc.name, args: fc.args } });
      }
      if (modelParts.length > 0) {
        currentHistory.push({ role: 'model', parts: modelParts });
      }

      // No function calls — we're done
      if (functionCalls.length === 0) break;

      // Process function calls
      const functionResponseParts: any[] = [];

      for (const fc of functionCalls) {
        // Check if approval required
        if (APPROVAL_REQUIRED_TOOLS.has(fc.name)) {
          const pendingAction = {
            id: `pa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: fc.name,
            toolName: fc.name,
            status: 'pending_approval',
            platform: 'meta',
            payload: fc.args,
            description: fc.args.reason || `${fc.name} islemi`,
            impact: `${fc.name} islemi gerceklestirilecek`,
            createdAt: Date.now(),
          };

          newPendingActions.push(pendingAction);

          sseWrite(res, {
            type: 'approval_required',
            actionId: pendingAction.id,
            action: pendingAction,
          });

          assistantParts.push({
            type: 'approval_required',
            actionId: pendingAction.id,
            action: pendingAction,
          });

          functionResponseParts.push({
            functionResponse: {
              name: fc.name,
              response: { status: 'pending_approval', message: 'Kullanici onay bekleniyor. Kullaniciya onay bekledigini bildir.' },
            },
          });
        } else {
          // Auto-execute
          const handler = toolHandlers[fc.name];
          if (!handler) {
            functionResponseParts.push({
              functionResponse: {
                name: fc.name,
                response: { error: `Unknown tool: ${fc.name}` },
              },
            });
            continue;
          }

          try {
            const toolStart = Date.now();
            const toolResult = await handler(ctx, fc.args);

            eventBus.emit('agent:tool.executed', {
              sessionId,
              toolName: fc.name,
              durationMs: Date.now() - toolStart,
              success: true,
            }, req.tenantId);

            sseWrite(res, {
              type: 'tool_result',
              id: fc.id,
              name: fc.name,
              data: toolResult,
              component: toolResult.component,
            });

            assistantParts.push({
              type: 'tool_result',
              id: fc.id,
              name: fc.name,
              data: toolResult,
              component: toolResult.component,
            });

            functionResponseParts.push({
              functionResponse: {
                name: fc.name,
                response: toolResult,
              },
            });
          } catch (err: any) {
            const errorResult = { error: err.message };
            functionResponseParts.push({
              functionResponse: {
                name: fc.name,
                response: errorResult,
              },
            });
          }
        }
      }

      // Add tool responses to history
      if (functionResponseParts.length > 0) {
        currentHistory.push({ role: 'user', parts: functionResponseParts });
      }
    }

    // Save to Firestore
    uiMessages.push({
      id: assistantMsgId,
      role: 'assistant',
      parts: assistantParts,
      timestamp: Date.now(),
    });

    const FieldValue = getFieldValue();
    const updateData: Record<string, any> = {
      contentHistory: stripUndefined(currentHistory),
      messages: stripUndefined(uiMessages),
      version: 'v2',
      updatedAt: Date.now(),
    };

    // Auto-set title from first user message (skip auto-greeting)
    if (!skipTitle && message && !sessionData.title) {
      updateData.title = String(message).slice(0, 60);
    }

    if (newPendingActions.length > 0) {
      updateData.pendingActions = FieldValue.arrayUnion(...newPendingActions);
    }

    await db.collection('marketing_agent_sessions').doc(sessionId).update(updateData);

    sseWrite(res, { type: 'done', messageId: assistantMsgId });

    // Background: extract memories from this conversation turn
    const assistantText = assistantParts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.content)
      .join(' ');

    if (assistantText && message) {
      // Fire-and-forget: don't block response
      (async () => {
        try {
          const facts = await extractFactsFromConversation(
            async (prompt: string) => {
              const extractResult = await ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { temperature: 0.3, maxOutputTokens: 1024, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
              });
              return JSON.parse(extractResult.text ?? '[]');
            },
            message,
            assistantText
          );

          if (facts.length > 0) {
            const saved = await saveExtractedFacts(db, req.tenantId, sessionId, facts);
            if (saved > 0) {
              eventBus.emit('agent:memory.extracted', {
                sessionId,
                tenantId: req.tenantId,
                facts: facts.map(f => f.fact),
              }, req.tenantId);
            }
          }
        } catch (err) {
          console.warn('[agent-chat-v2] Memory extraction failed (non-critical):', err);
        }
      })();
    }

    res.end();
  } catch (error: any) {
    console.error('agent-chat-v2 error:', error);
    sseError(res, error.message || 'Agent chat failed');
  }
});
