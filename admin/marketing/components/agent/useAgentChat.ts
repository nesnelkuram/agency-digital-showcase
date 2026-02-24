import { useState, useCallback, useRef } from 'react';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import type { AgentV2Message, AgentV2MessagePart, PendingPlatformAction } from '@/shared/types/marketing';

export interface UseAgentChatReturn {
  messages: AgentV2Message[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  sendApproval: (actionId: string, decision: 'approve' | 'reject') => Promise<void>;
  sessionId: string | null;
  startSession: (strategyContext?: string, initialMessage?: string) => Promise<void>;
  loadExistingSession: (sid: string, msgs: AgentV2Message[]) => void;
  starting: boolean;
}

export function useAgentChat(): UseAgentChatReturn {
  const { projectId } = useProjectScope();
  const [messages, setMessages] = useState<AgentV2Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 1. parseSSEStream — no deps, defined first
  const parseSSEStream = useCallback(async (
    response: Response,
    onTextDelta: (content: string) => void,
    onToolCall: (data: { id: string; name: string; args: Record<string, unknown> }) => void,
    onToolResult: (data: { id: string; name: string; data: unknown; component?: string }) => void,
    onApprovalRequired: (data: { actionId: string; action: PendingPlatformAction }) => void,
    onDone: (messageId: string) => void,
    onError: (message: string) => void,
  ) => {
    const reader = response.body?.getReader();
    if (!reader) {
      onError('Stream okuma hatasi');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split by double newline (SSE event separator)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              switch (data.type) {
                case 'text_delta':
                  onTextDelta(data.content || '');
                  break;
                case 'tool_call':
                  onToolCall({ id: data.id, name: data.name, args: data.args });
                  break;
                case 'tool_result':
                  onToolResult({ id: data.id, name: data.name, data: data.data, component: data.component });
                  break;
                case 'approval_required':
                  onApprovalRequired({ actionId: data.actionId, action: data.action });
                  break;
                case 'done':
                  onDone(data.messageId || '');
                  break;
                case 'error':
                  onError(data.message || 'Bilinmeyen hata');
                  break;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }, []);

  // 2. executeSend — core send logic, used by sendMessage and startSession
  const executeSend = useCallback(async (text: string, sid: string, options?: { skipTitle?: boolean }) => {
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: AgentV2Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      parts: [{ type: 'text', content: text }],
      timestamp: Date.now(),
    };

    const assistantMsgId = `msg_${Date.now()}_assistant`;
    const assistantMsg: AgentV2Message = {
      id: assistantMsgId,
      role: 'assistant',
      parts: [],
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { sessionId: sid, message: text };
      if (options?.skipTitle) body.skipTitle = true;
      const res = await authenticatedFetch('/api/marketing/agent-chat-v2', {
        method: 'POST',
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Yanit alinamadi (${res.status})`);
      }

      await parseSSEStream(
        res,
        (content) => {
          setMessages(prev => {
            const msgs = [...prev];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.id !== assistantMsgId) return prev;
            const parts = [...lastMsg.parts];
            const lastPart = parts[parts.length - 1];
            if (lastPart && lastPart.type === 'text') {
              parts[parts.length - 1] = { ...lastPart, content: lastPart.content + content };
            } else {
              parts.push({ type: 'text', content });
            }
            msgs[msgs.length - 1] = { ...lastMsg, parts };
            return msgs;
          });
        },
        (data) => {
          setMessages(prev => {
            const msgs = [...prev];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.id !== assistantMsgId) return prev;
            const parts = [...lastMsg.parts];
            parts.push({ type: 'tool_call', id: data.id, name: data.name, args: data.args });
            msgs[msgs.length - 1] = { ...lastMsg, parts };
            return msgs;
          });
        },
        (data) => {
          setMessages(prev => {
            const msgs = [...prev];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.id !== assistantMsgId) return prev;
            const parts = [...lastMsg.parts];
            parts.push({
              type: 'tool_result',
              id: data.id,
              name: data.name,
              data: data.data,
              component: data.component,
            } as AgentV2MessagePart);
            msgs[msgs.length - 1] = { ...lastMsg, parts };
            return msgs;
          });
        },
        (data) => {
          setMessages(prev => {
            const msgs = [...prev];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.id !== assistantMsgId) return prev;
            const parts = [...lastMsg.parts];
            parts.push({
              type: 'approval_required',
              actionId: data.actionId,
              action: data.action,
            } as AgentV2MessagePart);
            msgs[msgs.length - 1] = { ...lastMsg, parts };
            return msgs;
          });
        },
        () => { setIsStreaming(false); },
        (message) => {
          setError(message);
          setIsStreaming(false);
        },
      );
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Istek basarisiz');
      setIsStreaming(false);
    }
  }, [parseSSEStream]);

  // 3. startSession — creates session, optionally auto-sends initial message
  const startSession = useCallback(async (strategyContext?: string, initialMessage?: string) => {
    setStarting(true);
    setError(null);
    try {
      const res = await authenticatedFetch('/api/marketing/agent-start', {
        method: 'POST',
        body: JSON.stringify({ projectId: projectId || null, strategyContext: strategyContext || null }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Oturum baslatılamadi (${res.status})`);
      }
      const data = await res.json();
      const newSessionId = data.sessionId;
      setSessionId(newSessionId);
      setMessages([]);
      setStarting(false);

      // Auto-send initial message to trigger agent greeting + account listing
      if (initialMessage) {
        await executeSend(initialMessage, newSessionId, { skipTitle: true });
      }
    } catch (err: any) {
      setError(err.message || 'Baglanti hatasi');
      setStarting(false);
    }
  }, [projectId, executeSend]);

  // 3b. loadExistingSession — restore a previous session without creating a new one
  const loadExistingSession = useCallback((sid: string, msgs: AgentV2Message[]) => {
    setSessionId(sid);
    setMessages(msgs);
    setError(null);
    setStarting(false);
  }, []);

  // 4. sendMessage — public API, delegates to executeSend
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !sessionId || isStreaming) return;
    abortRef.current?.abort();
    await executeSend(text.trim(), sessionId);
  }, [sessionId, isStreaming, executeSend]);

  // 5. sendApproval — approval flow
  const sendApproval = useCallback(async (actionId: string, decision: 'approve' | 'reject') => {
    if (!sessionId || isStreaming) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setError(null);

    // Add assistant placeholder for approval result
    const assistantMsgId = `msg_${Date.now()}_approval`;
    const assistantMsg: AgentV2Message = {
      id: assistantMsgId,
      role: 'assistant',
      parts: [],
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, assistantMsg]);

    try {
      const res = await authenticatedFetch('/api/marketing/agent-chat-v2', {
        method: 'POST',
        body: JSON.stringify({ sessionId, approval: { actionId, decision } }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Istek basarisiz (${res.status})`);
      }

      await parseSSEStream(
        res,
        (content) => {
          setMessages(prev => {
            const msgs = [...prev];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.id !== assistantMsgId) return prev;

            const parts = [...lastMsg.parts];
            const lastPart = parts[parts.length - 1];
            if (lastPart && lastPart.type === 'text') {
              parts[parts.length - 1] = { ...lastPart, content: lastPart.content + content };
            } else {
              parts.push({ type: 'text', content });
            }

            msgs[msgs.length - 1] = { ...lastMsg, parts };
            return msgs;
          });
        },
        () => {},
        (data) => {
          setMessages(prev => {
            const msgs = [...prev];
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg.id !== assistantMsgId) return prev;

            const parts = [...lastMsg.parts];
            parts.push({
              type: 'tool_result',
              id: data.id,
              name: data.name,
              data: data.data,
              component: data.component,
            } as AgentV2MessagePart);
            msgs[msgs.length - 1] = { ...lastMsg, parts };
            return msgs;
          });
        },
        () => {},
        () => { setIsStreaming(false); },
        (message) => {
          setError(message);
          setIsStreaming(false);
        },
      );
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Istek basarisiz');
      setIsStreaming(false);
    }
  }, [sessionId, isStreaming, parseSSEStream]);

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    sendApproval,
    sessionId,
    startSession,
    loadExistingSession,
    starting,
  };
}
