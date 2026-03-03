import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bot,
  Send,
  Loader2,
  LayoutDashboard,
} from 'lucide-react';
import { useProjectScope } from '@/shared/hooks/useProjectScope';
import { useAgentChat } from './components/agent/useAgentChat';
import ChatMessage from './components/agent/ChatMessage';
import AgentSessionHistory from './components/agent/AgentSessionHistory';
import WelcomeActionCards from './components/agent/WelcomeActionCards';
import { useAgentSessions, type SessionSummary } from '@/shared/hooks/useAgentSessions';
import type { MarketingAgentSession } from '@/shared/types/marketing';

const COLLECTION = 'marketing_agent_sessions';

const MarketingAgentV2Page: React.FC = () => {
  const { basePath } = useProjectScope();
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

  const { sessions, loading: sessionsLoading, error: sessionsError, refresh: refreshSessions, loadSession } = useAgentSessions(COLLECTION);

  const [input, setInput] = useState('');
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

  // Auto-resume: once sessions load from useAgentSessions, pick the most recent
  useEffect(() => {
    if (autoResumeAttempted || sessionId || starting || sessionsLoading) return;
    setAutoResumeAttempted(true);

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = sessions.find(s => s.messageCount > 0 && s.updatedAt >= sevenDaysAgo);

    if (recent) {
      (async () => {
        setResuming(true);
        try {
          const session = await loadSession<MarketingAgentSession>(recent.id);
          if (session && session.messages?.length > 0) {
            loadExistingSession(session.id, session.messages);
            return;
          }
        } catch (err) {
          console.warn('[MarketingAgent] Auto-resume failed:', err);
        } finally {
          setResuming(false);
        }
      })();
    }
    // No auto-start — user picks an action from WelcomeActionCards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsLoading]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim()).then(() => refreshSessions());
    setInput('');
  }, [input, isStreaming, sendMessage, refreshSessions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleWelcomeAction = useCallback(async (prompt: string) => {
    await startSession(undefined, prompt);
    refreshSessions();
  }, [startSession, refreshSessions]);

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

  const handleNewSession = useCallback(async () => {
    // Reset to welcome screen — don't auto-start
    loadExistingSession('', []);
  }, [loadExistingSession]);

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
        error={sessionsError}
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
                Strateji olustur, kampanya kur, analiz et
                {isStreaming && ' · Yaziyor...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
              <div className="w-full max-w-2xl space-y-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mx-auto flex items-center justify-center mb-3">
                    <Bot className="w-7 h-7 text-indigo-600" />
                  </div>
                  <h2 className="font-grotesk text-lg font-bold text-[#171717]">Marketing AI Ajan</h2>
                  <p className="font-commons text-sm text-neutral-500 mt-1">Ne yapmak istersiniz?</p>
                </div>
                <WelcomeActionCards onSelect={handleWelcomeAction} />
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
            const hasContent = (lastMsg.parts || []).some(p => p.type === 'text' && p.content?.length > 0);
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

      </div>
    </div>
  );
};

export default MarketingAgentV2Page;
