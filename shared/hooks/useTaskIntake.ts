import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface IntakeMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: string;
}

interface TaskDraft {
  title?: string;
  description?: string;
  priority?: string;
  aiPriorityScore?: number;
  aiRiskLevel?: string;
  aiRiskFlags?: string[];
  suggestedAssigneeRole?: string;
  suggestedAssigneeName?: string;
  projectName?: string;
  clientName?: string;
  dueDate?: string;
  estimatedHours?: number;
}

interface UseTaskIntakeReturn {
  sessionId: string | null;
  messages: IntakeMessage[];
  taskDraft: TaskDraft | null;
  createdTaskId: string | null;
  loading: boolean;
  sending: boolean;
  error: string | null;
  startSession: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  saveNow: () => Promise<void>;
  reset: () => void;
}

async function getAuthToken(): Promise<string> {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  return currentUser.getIdToken();
}

export function useTaskIntake(): UseTaskIntakeReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<IntakeMessage[]>([]);
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/tasks/create-intake-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Oturum başlatılamadı');
      }

      const data = await res.json();
      setSessionId(data.sessionId);

      // Auto-open with a welcome message
      setMessages([
        {
          role: 'assistant',
          content:
            'Merhaba! Yeni bir görev oluşturmana yardımcı olacağım. Görevin ne ile ilgili? Ne zaman tamamlanması gerekiyor?',
        },
      ]);
    } catch (err: any) {
      setError(err.message || 'Oturum başlatılamadı');
    } finally {
      setLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!sessionId || sending) return;
      setSending(true);
      setError(null);

      // Optimistically add user message
      setMessages((prev) => [...prev, { role: 'user', content: message }]);

      try {
        const token = await getAuthToken();
        const res = await fetch('/api/tasks/intake-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ sessionId, message }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Mesaj gönderilemedi');
        }

        const data = await res.json();

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            action: data.action,
          },
        ]);

        if (data.taskDraft) {
          setTaskDraft(data.taskDraft);
        }

        if (data.createdTaskId) {
          setCreatedTaskId(data.createdTaskId);
        }
      } catch (err: any) {
        setError(err.message || 'Bir hata oluştu');
        // Remove optimistic message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setSending(false);
      }
    },
    [sessionId, sending]
  );

  const saveNow = useCallback(async () => {
    if (!sessionId || sending) return;
    setSending(true);
    setError(null);

    const saveMsg = '__FORCE_SAVE__';
    try {
      const token = await getAuthToken();
      const res = await fetch('/api/tasks/intake-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId, message: saveMsg, forceSave: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Görev kaydedilemedi');
      }

      const data = await res.json();
      if (data.taskDraft) setTaskDraft(data.taskDraft);
      if (data.createdTaskId) setCreatedTaskId(data.createdTaskId);
    } catch (err: any) {
      setError(err.message || 'Görev kaydedilemedi');
    } finally {
      setSending(false);
    }
  }, [sessionId, sending]);

  const reset = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setTaskDraft(null);
    setCreatedTaskId(null);
    setError(null);
    setLoading(false);
    setSending(false);
  }, []);

  return {
    sessionId,
    messages,
    taskDraft,
    createdTaskId,
    loading,
    sending,
    error,
    startSession,
    sendMessage,
    saveNow,
    reset,
  };
}
