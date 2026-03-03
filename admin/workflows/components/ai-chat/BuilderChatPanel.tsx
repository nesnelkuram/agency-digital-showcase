import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Plus, Loader2, ChevronDown, X, AlertCircle } from 'lucide-react';
import { useBuilderChat } from '@/shared/hooks/useBuilderChat';
import { useAgentSessions, type SessionSummary } from '@/shared/hooks/useAgentSessions';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';
import BuilderChatMessage from './BuilderChatMessage';
import type { BuilderChatMessage as MessageType } from '@/shared/types/workflowBuilderChat';
import type { BuilderChatSession } from '@/shared/types/workflowBuilderChat';

interface Props {
  templateId?: string;
  onClose: () => void;
}

const COLLECTION = 'workflow_builder_chat_sessions';

const BuilderChatPanel: React.FC<Props> = ({ templateId, onClose }) => {
  const {
    messages,
    sessionId,
    isLoading,
    error,
    startSession,
    sendMessage,
    loadExistingSession,
  } = useBuilderChat();

  const { sessions, refresh: refreshSessions, loadSession } = useAgentSessions(COLLECTION);
  const getCanvasSnapshot = useWorkflowBuilderStore((s) => s.getCanvasSnapshot);
  const applyAICanvasState = useWorkflowBuilderStore((s) => s.applyAICanvasState);

  const [input, setInput] = useState('');
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-start session on mount if none exists
  useEffect(() => {
    if (!sessionId) {
      startSession(templateId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionId]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const text = input;
    setInput('');

    const snapshot = getCanvasSnapshot();
    const result = await sendMessage(text, snapshot);

    if (result?.canvasState) {
      applyAICanvasState(result.canvasState);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewSession = async () => {
    await startSession(templateId);
    refreshSessions();
    setShowSessionDropdown(false);
  };

  const handleLoadSession = async (session: SessionSummary) => {
    const data = await loadSession<BuilderChatSession>(session.id);
    if (data) {
      const msgs: MessageType[] = (data.messages || []).map((m: any) => ({
        id: m.id || `msg_${m.timestamp}_${m.role}`,
        role: m.role,
        content: m.content,
        canvasApplied: m.canvasApplied,
        changesSummary: m.changesSummary,
        timestamp: m.timestamp,
      }));
      loadExistingSession(data.id, msgs);
    }
    setShowSessionDropdown(false);
  };

  return (
    <div className="w-80 border-l border-neutral-200 bg-neutral-50 flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-neutral-200 bg-white flex items-center gap-2">
        <Bot className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        <span className="font-grotesk text-sm font-semibold text-[#171717] flex-1">AI Asistan</span>

        {/* Session dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSessionDropdown(!showSessionDropdown)}
            className="p-1 rounded hover:bg-neutral-100 transition-colors"
            title="Oturumlar"
          >
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
          </button>

          {showSessionDropdown && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              <button
                onClick={handleNewSession}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-commons text-indigo-600 hover:bg-indigo-50 border-b border-neutral-100"
              >
                <Plus className="w-3 h-3" />
                Yeni Sohbet
              </button>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleLoadSession(s)}
                  className={`w-full text-left px-3 py-2 text-xs font-commons hover:bg-neutral-50 ${
                    s.id === sessionId ? 'bg-indigo-50 text-indigo-700' : 'text-neutral-700'
                  }`}
                >
                  <div className="truncate">{s.title || 'Isimsiz Sohbet'}</div>
                  <div className="text-[10px] text-neutral-400 mt-0.5">
                    {s.messageCount} mesaj
                  </div>
                </button>
              ))}
              {sessions.length === 0 && (
                <div className="px-3 py-2 text-[10px] font-commons text-neutral-400">
                  Henuz oturum yok
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleNewSession}
          className="p-1 rounded hover:bg-neutral-100 transition-colors"
          title="Yeni Sohbet"
        >
          <Plus className="w-3.5 h-3.5 text-neutral-500" />
        </button>

        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-neutral-100 transition-colors"
          title="Kapat"
        >
          <X className="w-3.5 h-3.5 text-neutral-500" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <Bot className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="font-commons text-xs text-neutral-400">
              Canvas uzerinde degisiklik yapmak icin mesaj yazin.
            </p>
            <p className="font-commons text-[10px] text-neutral-300 mt-1">
              Ornek: "Bir baslangic ve bitis dugumu ekle"
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <BuilderChatMessage key={msg.id} message={msg} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-3 h-3 text-indigo-600 animate-spin" />
            </div>
            <span className="text-xs font-commons text-neutral-400">Dusunuyor...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
          <span className="text-[10px] font-commons text-red-600 truncate">{error}</span>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-neutral-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Mesaj yazin..."
            rows={1}
            className="flex-1 resize-none px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 font-commons text-sm focus:outline-none focus:border-indigo-400 transition-colors"
            style={{ maxHeight: 80 }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BuilderChatPanel;
