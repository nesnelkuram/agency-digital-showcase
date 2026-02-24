import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  collection as firestoreCollection,
  query as firestoreQuery,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import {
  Bot,
  Send,
  Loader2,
  FileText,
  Sparkles,
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { useTenantId } from '@/shared/hooks/useTenant';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import { useAgentChat } from './components/agent/useAgentChat';
import ChatMessage from './components/agent/ChatMessage';
import AgentSessionHistory from './components/agent/AgentSessionHistory';
import { useAgentSessions, type SessionSummary } from '@/shared/hooks/useAgentSessions';
import type { MarketingAgentSession } from '@/shared/types/marketing';

const SUGGESTED_PROMPTS = [
  'Kampanyalarimi goster',
  'Performans analizi yap',
  'Yeni bir pazarlama plani olusturmak istiyorum',
  'Kampanyalari senkronize et',
];

const COLLECTION = 'marketing_agent_sessions';

const MarketingAgentV2Page: React.FC = () => {
  const { basePath } = useProjectScope();
  const { user } = useAuth();
  const tenantId = useTenantId();
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    sendApproval,
    sessionId,
    startSession,
    loadExistingSession,
    starting,
  } = useAgentChat();

  const { sessions, loading: sessionsLoading, loadSession } = useAgentSessions(COLLECTION);

  const [input, setInput] = useState('');
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [strategyText, setStrategyText] = useState('');
  const [savedStrategy, setSavedStrategy] = useState('');
  const [autoResumeAttempted, setAutoResumeAttempted] = useState(false);
  const [resuming, setResuming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resume: try to load the most recent session, else start new
  useEffect(() => {
    if (autoResumeAttempted || sessionId || starting) return;
    if (!db || !user?.uid || !tenantId) return;
    setAutoResumeAttempted(true);

    (async () => {
      try {
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
          if (msgs.length > 0 && data.updatedAt >= sevenDaysAgo) {
            loadExistingSession(snap.docs[0].id, msgs);
            return;
          }
        }
      } catch (err) {
        console.warn('[MarketingAgent] Auto-resume failed, starting new session:', err);
      }
      startSession(undefined, 'Merhaba, bagli hesaplarimi goster');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, tenantId]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput('');
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveStrategy = async () => {
    setSavedStrategy(strategyText);
    setShowStrategyModal(false);
    await startSession(strategyText, 'Merhaba, strateji baglamini aldiktan sonra bagli hesaplarimi goster');
  };

  const handleSendPrompt = useCallback((text: string) => {
    sendMessage(text);
  }, [sendMessage]);

  const handleApprove = useCallback((actionId: string) => {
    sendApproval(actionId, 'approve');
  }, [sendApproval]);

  const handleReject = useCallback((actionId: string) => {
    sendApproval(actionId, 'reject');
  }, [sendApproval]);

  const handleResumeSession = useCallback(async (summary: SessionSummary) => {
    if (summary.id === sessionId) return;
    setResuming(true);
    try {
      const session = await loadSession<MarketingAgentSession>(summary.id);
      if (session && session.messages?.length > 0) {
        loadExistingSession(session.id, session.messages);
      }
    } catch (err) {
      console.error('[MarketingAgent] Resume session failed:', err);
    } finally {
      setResuming(false);
    }
  }, [sessionId, loadSession, loadExistingSession]);

  const handleNewSession = useCallback(() => {
    startSession(undefined, 'Merhaba, bagli hesaplarimi goster');
  }, [startSession]);

  const isLoading = starting || resuming;

  return (
    <div className="flex h-[calc(100vh-8rem)] max-h-[900px] gap-3">
      {/* Session History Sidebar */}
      <AgentSessionHistory
        currentSessionId={sessionId}
        onSelectSession={handleResumeSession}
        onNewSession={handleNewSession}
        sessions={sessions}
        loading={sessionsLoading}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-commons font-bold text-[#171717]">Marketing AI Ajan</h1>
              <p className="text-xs font-commons text-neutral-500">
                {savedStrategy ? 'Strateji yuklendi' : 'Kampanya olustur, butce yonet, analiz et'}
                {isStreaming && ' · Yaziyor...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setStrategyText(savedStrategy); setShowStrategyModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-commons text-sm hover:bg-indigo-100 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Strateji Yukle
            </button>
            <Link
              to={`${basePath}/proposals`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Oneriler
            </Link>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto rounded-2xl bg-white/60 border border-white/50 p-4 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="font-commons text-sm">
                  {resuming ? 'Oturum yukleniyor...' : 'Ajan baslatiliyor...'}
                </span>
              </div>
            </div>
          )}

          {!isLoading && messages.length === 0 && !isStreaming && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 mx-auto flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-indigo-500" />
                </div>
                <p className="font-commons text-sm text-neutral-500">Bir mesaj yazin veya oneri secin</p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onSendMessage={handleSendPrompt}
              onApprove={handleApprove}
              onReject={handleReject}
              isStreaming={isStreaming}
            />
          ))}

          {/* Streaming indicator */}
          {isStreaming && messages.length > 0 && (() => {
            const lastMsg = messages[messages.length - 1];
            const hasContent = lastMsg.parts.some(p => p.type === 'text' && p.content.length > 0);
            if (hasContent) return null;
            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="flex gap-2 items-center">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-white/80 border border-white/60 shadow-sm">
                    <div className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}

          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm font-commons text-red-700">
            {error}
          </div>
        )}

        {/* Suggested Prompts — show after initial auto-greeting completes */}
        {!isLoading && messages.length >= 2 && messages.length <= 3 && !isStreaming && (
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSendPrompt(prompt)}
                className="px-3 py-1.5 bg-white/70 border border-white/60 rounded-xl text-xs font-commons text-neutral-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="mt-3 flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!sessionId || isStreaming || isLoading}
              placeholder="Mesajinizi yazin... (Enter ile gonder)"
              rows={1}
              className="w-full resize-none px-4 py-3 rounded-2xl bg-white/70 border border-white/60 font-commons text-sm focus:outline-none focus:bg-white/90 focus:border-indigo-200 placeholder:text-neutral-400 transition-all disabled:opacity-50"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || !sessionId || isStreaming || isLoading}
            className="flex-shrink-0 w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white transition-all flex items-center justify-center"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Strategy Modal */}
        <AnimatePresence>
          {showStrategyModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-50"
                onClick={() => setShowStrategyModal(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <FileText className="w-4 h-4 text-indigo-600" />
                    </div>
                    <h2 className="text-lg font-commons font-bold text-[#171717]">Strateji Baglami</h2>
                  </div>
                  <p className="text-sm font-commons text-neutral-500 mb-3">
                    Kampanya stratejinizi yapistirin. Ajan bu baglami kullanarak daha isabetli oneriler sunacak.
                  </p>
                  <textarea
                    value={strategyText}
                    onChange={(e) => setStrategyText(e.target.value)}
                    placeholder="Ornek: TOFU 28K TL farkindalik, MOFU 21K TL retargeting, BOFU 21K TL donusum hedefli..."
                    rows={8}
                    className="w-full resize-none px-4 py-3 rounded-xl border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-300 transition-all"
                  />
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setShowStrategyModal(false)}
                      className="px-4 py-2 rounded-xl font-commons text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
                    >
                      Iptal
                    </button>
                    <button
                      onClick={handleSaveStrategy}
                      disabled={!strategyText.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-commons text-sm hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Kaydet ve Yeniden Baslat
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MarketingAgentV2Page;
