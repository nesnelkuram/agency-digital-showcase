import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot, CheckCircle, ExternalLink, Network, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  collection as firestoreCollection,
  query as firestoreQuery,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import DesignMessageBubble from './DesignMessageBubble';
import DesignSuggestedOptions from './DesignSuggestedOptions';
import type { WorkflowDraft } from '@/shared/types/workflowDesign';

interface AgentAction {
  type: 'save_template' | 'publish_template' | 'update_template' | 'create_instance' | 'none';
  templateId?: string;
  projectId?: string;
}

interface ActionResult {
  type: string;
  success: boolean;
  data?: {
    templateId?: string;
    name?: string;
    status?: string;
    instanceId?: string;
    linkedParentNodeId?: string | null;
    linkedParentSessionId?: string | null;
  };
  error?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: AgentAction[];
  results?: ActionResult[];
}

interface CategoryOption {
  key: string;
  label: string;
  prompt: string;
}

export interface SubprocessSuggestion {
  nodeId: string;
  nodeLabel: string;
}

export interface LinkedParentNode {
  nodeId: string;
  childTemplateId: string;
  childTemplateName: string;
  parentSessionId: string | null;
}

export interface ParentContext {
  parentSessionId: string;
  parentWorkflowName: string;
  nodeId: string;
  nodeLabel: string;
}

interface SessionHistoryItem {
  id: string;
  title: string | null;
  updatedAt: number;
  messageCount: number;
}

interface Props {
  onDraftUpdate: (draft: WorkflowDraft) => void;
  onSessionStart?: (sessionId: string) => void;
  onSubprocessSuggestions?: (nodes: SubprocessSuggestion[]) => void;
  onLinkedParentNode?: (linked: LinkedParentNode) => void;
  parentContext?: ParentContext;
  initialSessionId?: string;
}

const COLLECTION = 'workflow_design_sessions';

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Az once';
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}s`;
  const days = Math.floor(hours / 24);
  return `${days}g`;
}

const WorkflowDesignChat: React.FC<Props> = ({
  onDraftUpdate,
  onSessionStart,
  onSubprocessSuggestions,
  onLinkedParentNode,
  parentContext,
  initialSessionId,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenantId = useTenantId();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestedCategories, setSuggestedCategories] = useState<CategoryOption[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<SessionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Restore session or auto-resume recent root session or start new
  useEffect(() => {
    if (sessionId || starting) return;

    // If subprocess — always start new
    if (parentContext) {
      startSession();
      return;
    }

    // Try auto-resume most recent root session
    (async () => {
      try {
        if (!db || !user?.uid || !tenantId) {
          startSession();
          return;
        }
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const q = firestoreQuery(
          firestoreCollection(db, COLLECTION),
          where('tenantId', '==', tenantId),
          where('userId', '==', user.uid),
          orderBy('updatedAt', 'desc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          const msgs = data.messages || [];
          // Only auto-resume root sessions (no parentContext)
          if (msgs.length > 0 && data.updatedAt >= sevenDaysAgo && !data.parentContext) {
            restoreSession(snap.docs[0].id, msgs, data.currentDraft || null);
            return;
          }
        }
      } catch (err) {
        console.warn('[WorkflowDesignChat] Auto-resume failed:', err);
      }
      startSession();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, tenantId]);

  const startSession = async () => {
    setStarting(true);
    setError(null);
    try {
      const body: Record<string, any> = {};
      if (parentContext) {
        body.parentContext = parentContext;
      }

      const res = await authenticatedFetch('/api/workflow/design-start', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Oturum baslatilamadi (${res.status})`);
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      setSuggestedCategories(data.suggestedCategories || []);
      onSessionStart?.(data.sessionId);

      // Sub-session: auto-kick with a context-aware opening message
      if (parentContext) {
        await sendMessageInternal(
          data.sessionId,
          `"${parentContext.parentWorkflowName}" workflow'undaki "${parentContext.nodeLabel}" alt süreci için bir workflow tasarla.`
        );
      }
    } catch (err: any) {
      setError(err.message || 'Baglanti hatasi');
    } finally {
      setStarting(false);
    }
  };

  const restoreSession = useCallback((sid: string, msgs: any[], draft: WorkflowDraft | null) => {
    // Convert Firestore messages to local Message format
    const restored: Message[] = msgs.map((m: any) => ({
      role: m.role,
      content: m.content || '',
      actions: m.actions,
      results: m.results,
    }));
    setSessionId(sid);
    setMessages(restored);
    setSuggestedCategories([]);
    onSessionStart?.(sid);
    if (draft) onDraftUpdate(draft);
  }, [onSessionStart, onDraftUpdate]);

  const loadHistorySessions = useCallback(async () => {
    if (!db || !user?.uid || !tenantId) return;
    setHistoryLoading(true);
    try {
      const q = firestoreQuery(
        firestoreCollection(db, COLLECTION),
        where('tenantId', '==', tenantId),
        where('userId', '==', user.uid),
        orderBy('updatedAt', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      const items: SessionHistoryItem[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const msgs = data.messages || [];
        if (msgs.length === 0 || data.parentContext) return; // skip empty + subprocess
        items.push({
          id: docSnap.id,
          title: data.title || null,
          updatedAt: data.updatedAt || data.createdAt || 0,
          messageCount: msgs.length,
        });
      });
      setHistoryItems(items);
    } catch (err) {
      console.error('[WorkflowDesignChat] Load history failed:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.uid, tenantId]);

  const handleSelectHistory = useCallback(async (item: SessionHistoryItem) => {
    if (item.id === sessionId) {
      setShowHistory(false);
      return;
    }
    try {
      if (!db) return;
      const docSnap = await getDoc(doc(db, COLLECTION, item.id));
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      restoreSession(item.id, data.messages || [], data.currentDraft || null);
      setShowHistory(false);
    } catch (err) {
      console.error('[WorkflowDesignChat] Select history failed:', err);
    }
  }, [sessionId, restoreSession]);

  const handleNewSession = useCallback(() => {
    setShowHistory(false);
    setSessionId(null);
    setMessages([]);
    startSession();
  }, []);

  const sendMessageInternal = async (sid: string, text: string) => {
    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const res = await authenticatedFetch('/api/workflow/design-chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sid, message: text }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Yanit alinamadi (${res.status})`);
      }
      const data = await res.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply,
        actions: data.actions,
        results: data.results,
      };
      setMessages(prev => [...prev, assistantMessage]);

      if (data.draft) onDraftUpdate(data.draft);
      if (data.subprocessSuggestions?.length > 0) onSubprocessSuggestions?.(data.subprocessSuggestions);
      if (data.linkedParentNode) onLinkedParentNode?.(data.linkedParentNode);
    } catch (err: any) {
      setError(err.message || 'Mesaj gonderilemedi');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !sessionId || loading) return;
    setInput('');
    setSuggestedCategories([]);
    await sendMessageInternal(sessionId, text.trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isSubSession = !!parentContext;
  const headerBg = isSubSession ? 'from-cyan-50' : 'from-violet-50';
  const avatarBg = isSubSession ? 'bg-cyan-100' : 'bg-violet-100';
  const avatarIconColor = isSubSession ? 'text-cyan-600' : 'text-violet-600';
  const sendBtnClass = isSubSession
    ? 'bg-cyan-600 hover:bg-cyan-700'
    : 'bg-violet-600 hover:bg-violet-700';
  const loadingIconColor = isSubSession ? 'text-cyan-400' : 'text-violet-400';

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-gradient-to-r ${headerBg} to-white`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center`}>
            {isSubSession
              ? <Network className={`w-5 h-5 ${avatarIconColor}`} />
              : <Bot className={`w-5 h-5 ${avatarIconColor}`} />
            }
          </div>
          <div>
            <h3 className="font-grotesk text-base font-bold text-neutral-800">
              {isSubSession ? `Alt Süreç: ${parentContext.nodeLabel}` : 'Workflow Tasarimcisi'}
            </h3>
            <p className="font-grotesk text-xs text-neutral-500">
              {isSubSession
                ? `"${parentContext.parentWorkflowName}" için alt süreç`
                : 'AI ile sohbet ederek is sureci tasarlayin'}
            </p>
          </div>
        </div>

        {/* History dropdown — only for root sessions */}
        {!isSubSession && (
          <div className="relative">
            <button
              onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistorySessions(); }}
              className="p-2 rounded-lg hover:bg-violet-100 text-violet-600 transition-colors"
              title="Gecmis oturumlar"
            >
              <History className="w-4 h-4" />
            </button>
            {showHistory && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowHistory(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-white rounded-xl border border-neutral-200 shadow-lg py-1.5 max-h-72 overflow-y-auto">
                  <button
                    onClick={handleNewSession}
                    className="w-full text-left px-3 py-2 text-xs font-grotesk font-semibold text-violet-700 hover:bg-violet-50 transition-colors flex items-center gap-2"
                  >
                    <span className="w-4 h-4 rounded bg-violet-100 flex items-center justify-center text-[10px]">+</span>
                    Yeni Oturum
                  </button>
                  <div className="border-t border-neutral-100 my-1" />
                  {historyLoading && (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                    </div>
                  )}
                  {!historyLoading && historyItems.length === 0 && (
                    <p className="text-center text-xs text-neutral-400 py-3 font-grotesk">Gecmis oturum yok</p>
                  )}
                  {historyItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectHistory(item)}
                      className={`w-full text-left px-3 py-2 text-xs font-grotesk transition-colors ${
                        item.id === sessionId
                          ? 'bg-violet-50 text-violet-700'
                          : 'hover:bg-neutral-50 text-neutral-700'
                      }`}
                    >
                      <p className="truncate font-medium">{item.title || 'Isimsiz oturum'}</p>
                      <p className="text-neutral-400 mt-0.5">{item.messageCount} mesaj · {relativeTime(item.updatedAt)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {starting && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className={`w-6 h-6 ${loadingIconColor} animate-spin`} />
            <span className="ml-2 font-grotesk text-sm text-neutral-500">
              {isSubSession ? 'Alt süreç hazırlaniyor...' : 'Oturum baslatiyor...'}
            </span>
          </div>
        )}

        {!starting && messages.length === 0 && suggestedCategories.length > 0 && (
          <div className="py-4">
            <div className="text-center mb-6">
              <p className="font-grotesk text-sm text-neutral-500">
                Merhaba! Workflow tasarlamak icin bir hizmet kategorisi secin veya istediginiz sureci tarif edin.
              </p>
            </div>
            <DesignSuggestedOptions
              categories={suggestedCategories}
              onSelect={(prompt) => sendMessage(prompt)}
            />
          </div>
        )}

        {messages.map((msg, i) => (
          <React.Fragment key={i}>
            <DesignMessageBubble role={msg.role} content={msg.content} />
            {msg.results && msg.results.map((result, j) => {
              if (!result.success || result.type === 'none') return null;
              const isSave = result.type === 'save_template';
              const isPublish = result.type === 'publish_template';
              const isInstance = result.type === 'create_instance';
              if (!isSave && !isPublish && !isInstance) return null;
              const isLinkedBack = !!result.data?.linkedParentNodeId;
              return (
                <div key={j} className="flex justify-start">
                  <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm max-w-xs ${
                    isLinkedBack
                      ? 'bg-cyan-50 border-cyan-200 text-cyan-800'
                      : isPublish
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-violet-50 border-violet-200 text-violet-800'
                  }`}>
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-grotesk font-semibold text-xs">
                        {isLinkedBack
                          ? 'Alt süreç ana workflow\'a bağlandı ✓'
                          : isPublish ? 'Workflow yayınlandı'
                          : isInstance ? 'Instance oluşturuldu'
                          : 'Workflow kaydedildi'}
                      </p>
                      <p className="font-grotesk text-xs mt-0.5 opacity-80">{result.data?.name}</p>
                      {result.data?.templateId && !isLinkedBack && (
                        <button
                          onClick={() => navigate('/admin/workflows')}
                          className="mt-1.5 flex items-center gap-1 text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Sablonlara git
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}

        {loading && (
          <div className="flex items-center gap-2 px-4 py-3">
            <Loader2 className={`w-4 h-4 animate-spin ${loadingIconColor}`} />
            <span className="font-grotesk text-sm text-neutral-400">Tasarliyor...</span>
          </div>
        )}

        {error && (
          <div className="px-4 py-2 rounded-lg bg-red-50 border border-red-100">
            <p className="font-grotesk text-sm text-red-600">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isSubSession
                ? `"${parentContext.nodeLabel}" için değişiklik isteyin...`
                : 'Örneğin: "Bir onay adımı ekle" veya "Paralel çekimler olsun"...'
            }
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-neutral-200 focus:border-violet-300 focus:ring-1 focus:ring-violet-200 outline-none font-grotesk text-sm text-neutral-800 placeholder:text-neutral-400 bg-white"
            disabled={loading || !sessionId}
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || !sessionId}
            className={`flex-shrink-0 w-10 h-10 rounded-xl text-white flex items-center justify-center disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors ${sendBtnClass}`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default WorkflowDesignChat;
