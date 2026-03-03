import { useState, useCallback } from 'react';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import type { BuilderChatMessage, CanvasSnapshot } from '@/shared/types/workflowBuilderChat';

export interface UseBuilderChatReturn {
  messages: BuilderChatMessage[];
  sessionId: string | null;
  isLoading: boolean;
  error: string | null;
  startSession: (templateId?: string) => Promise<void>;
  sendMessage: (text: string, canvasSnapshot: CanvasSnapshot) => Promise<{
    canvasState: CanvasSnapshot | null;
    changesSummary: string | null;
  } | null>;
  loadExistingSession: (sid: string, msgs: BuilderChatMessage[]) => void;
}

export function useBuilderChat(): UseBuilderChatReturn {
  const [messages, setMessages] = useState<BuilderChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(async (templateId?: string) => {
    setError(null);
    try {
      const res = await authenticatedFetch('/api/workflow/builder-chat-start', {
        method: 'POST',
        body: JSON.stringify({ templateId: templateId || null }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Oturum baslatılamadi (${res.status})`);
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setMessages([]);
    } catch (err: any) {
      setError(err.message || 'Baglanti hatasi');
    }
  }, []);

  const sendMessage = useCallback(async (text: string, canvasSnapshot: CanvasSnapshot) => {
    if (!text.trim() || !sessionId || isLoading) return null;

    setIsLoading(true);
    setError(null);

    // Optimistic user message
    const userMsg: BuilderChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await authenticatedFetch('/api/workflow/builder-chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          message: text.trim(),
          canvasSnapshot,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Yanit alinamadi (${res.status})`);
      }

      const data = await res.json();

      const assistantMsg: BuilderChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: data.reply,
        canvasApplied: !!data.canvasState,
        changesSummary: data.changesSummary || undefined,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);

      return {
        canvasState: data.canvasState || null,
        changesSummary: data.changesSummary || null,
      };
    } catch (err: any) {
      setError(err.message || 'Istek basarisiz');
      setIsLoading(false);
      return null;
    }
  }, [sessionId, isLoading]);

  const loadExistingSession = useCallback((sid: string, msgs: BuilderChatMessage[]) => {
    setSessionId(sid);
    setMessages(msgs || []);
    setError(null);
  }, []);

  return {
    messages,
    sessionId,
    isLoading,
    error,
    startSession,
    sendMessage,
    loadExistingSession,
  };
}
