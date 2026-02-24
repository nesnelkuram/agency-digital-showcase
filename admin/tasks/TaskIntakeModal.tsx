import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, User, Loader2, CheckCircle, Sparkles, Save } from 'lucide-react';
import { useTaskIntake } from '@/shared/hooks/useTaskIntake';
import AIPriorityBadge from './components/AIPriorityBadge';

interface TaskIntakeModalProps {
  onClose: () => void;
  onTaskCreated: (taskId: string) => void;
}

const TaskIntakeModal: React.FC<TaskIntakeModalProps> = ({ onClose, onTaskCreated }) => {
  const { sessionId, messages, taskDraft, createdTaskId, loading, sending, error, startSession, sendMessage, saveNow } =
    useTaskIntake();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Start session on mount
  useEffect(() => {
    startSession();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when session is ready
  useEffect(() => {
    if (sessionId && !loading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [sessionId, loading]);

  // Auto-close when task is created
  useEffect(() => {
    if (createdTaskId) {
      const timer = setTimeout(() => {
        onTaskCreated(createdTaskId);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [createdTaskId]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || sending || !sessionId) return;
    setInputValue('');
    sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-center sm:justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.96 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '80vh', minHeight: '480px' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="font-commons text-sm font-semibold text-[#171717]">
                  AI Görev Direktörü
                </h2>
                <p className="font-commons text-[10px] text-neutral-400">
                  Görevinizi anlatın, önceliklendireyim
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Task draft preview (if available) */}
          <AnimatePresence>
            {taskDraft?.title && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-5 py-3 bg-indigo-50 border-b border-indigo-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-commons text-xs font-semibold text-indigo-800 truncate">
                      {taskDraft.title}
                    </p>
                    {taskDraft.projectName && (
                      <p className="font-commons text-[10px] text-indigo-500 mt-0.5">
                        {taskDraft.projectName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {taskDraft.aiPriorityScore !== undefined && (
                      <AIPriorityBadge score={taskDraft.aiPriorityScore} />
                    )}
                    {taskDraft.aiRiskLevel && taskDraft.aiRiskLevel !== 'none' && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 uppercase">
                        {taskDraft.aiRiskLevel === 'high' ? 'Yüksek Risk' : 'Orta Risk'}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Loading state */}
            {loading && !sessionId && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto mb-2" />
                  <p className="font-commons text-sm text-neutral-400">AI hazırlanıyor...</p>
                </div>
              </div>
            )}

            {/* Success state */}
            {createdTaskId && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-full gap-3 py-8"
              >
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <p className="font-commons text-base font-semibold text-[#171717]">
                  Görev oluşturuldu!
                </p>
                <p className="font-commons text-sm text-neutral-500 text-center">
                  Göreviniz Kanban'a eklendi ve delegasyon önerisi hazırlandı.
                </p>
                {taskDraft?.aiPriorityScore !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className="font-commons text-xs text-neutral-500">AI Öncelik Skoru:</span>
                    <AIPriorityBadge score={taskDraft.aiPriorityScore} size="md" />
                  </div>
                )}
              </motion.div>
            )}

            {/* Chat messages */}
            {!createdTaskId &&
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl font-commons text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#171717] text-white rounded-tr-sm'
                        : 'bg-neutral-100 text-neutral-800 rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-neutral-600" />
                    </div>
                  )}
                </div>
              ))}

            {/* Sending indicator */}
            {sending && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-neutral-100">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="px-5 py-2 bg-red-50 border-t border-red-100">
              <p className="font-commons text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Manual save button — shown when draft title is available but task not yet saved */}
          {!createdTaskId && taskDraft?.title && messages.length >= 3 && (
            <div className="px-4 pb-0 pt-3 border-t border-neutral-100">
              <button
                onClick={saveNow}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-commons text-sm font-medium transition-all disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Görevi Kaydet
              </button>
            </div>
          )}

          {/* Input */}
          {!createdTaskId && (
            <div className="p-4 border-t border-neutral-100">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={sending ? 'AI düşünüyor...' : 'Görevinizi anlatın...'}
                  disabled={sending || !sessionId || loading}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 font-commons text-sm text-[#171717] placeholder:text-neutral-400 focus:outline-none focus:border-indigo-300 focus:bg-white transition-all disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || sending || !sessionId || loading}
                  className="p-2.5 rounded-xl bg-[#171717] text-white hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TaskIntakeModal;
