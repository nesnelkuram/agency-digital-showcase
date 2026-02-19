import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Send,
  Loader2,
  FileText,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { authenticatedFetch } from '@/lib/firebase/apiClient';
import { useProjectScope } from '@/shared/hooks/useProjectScope';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  actions?: ActionResult[];
  timestamp: number;
}

interface ActionResult {
  type: string;
  success: boolean;
  data?: any;
  error?: string;
}

const SUGGESTED_PROMPTS = [
  'TOFU kampanyası oluştur, 28K TL awareness Meta',
  'Mevcut kampanyaları listele ve performansı özetle',
  'MOFU retargeting kampanyası öner, 21K TL bütçe',
  'BOFU dönüşüm kampanyası oluştur Instagram ve Facebook',
];

const MarketingAgentPage: React.FC = () => {
  const { projectId, basePath } = useProjectScope();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [strategyText, setStrategyText] = useState('');
  const [savedStrategy, setSavedStrategy] = useState('');
  const [savingStrategy, setSavingStrategy] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-start session on mount
  useEffect(() => {
    if (!sessionId && !starting) {
      startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSession = async (strategyContext?: string) => {
    setStarting(true);
    setError(null);
    try {
      const res = await authenticatedFetch('/api/marketing/agent-start', {
        method: 'POST',
        body: JSON.stringify({ projectId: projectId || null, strategyContext: strategyContext || null }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Oturum başlatılamadı (${res.status})`);
      }
      const data = await res.json();
      setSessionId(data.sessionId);
      // Welcome message
      setMessages([{
        role: 'assistant',
        content: savedStrategy || strategyContext
          ? 'Merhaba! Strateji bağlamını aldım. Kampanya oluşturma, bütçe yönetimi veya performans analizi hakkında sormak istediğin bir şey var mı?'
          : 'Merhaba! Ben Marketing AI Ajanınım. Meta Ads kampanyaları oluşturabilir, bütçe yönetebilir ve performans analizi yapabilirim. "Strateji Yükle" butonuyla strateji bağlamı ekleyebilir veya hemen sorularınızı sorabilirsiniz.',
        timestamp: Date.now(),
      }]);
    } catch (err: any) {
      setError(err.message || 'Bağlantı hatası');
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !sessionId || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await authenticatedFetch('/api/marketing/agent-chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId, message: text.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Yanıt alınamadı (${res.status})`);
      }
      const data = await res.json();
      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply,
        actions: data.results || [],
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || 'İstek başarısız');
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSaveStrategy = async () => {
    setSavingStrategy(true);
    setSavedStrategy(strategyText);
    setShowStrategyModal(false);
    // Restart session with new strategy
    setMessages([]);
    setSessionId(null);
    await startSession(strategyText);
    setSavingStrategy(false);
  };

  const proposalResults = messages
    .flatMap((m) => m.actions || [])
    .filter((a) => a.type === 'create_proposal' && a.success && a.data?.proposalId);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-commons font-bold text-[#171717]">Marketing AI Ajan</h1>
            <p className="text-xs font-commons text-neutral-500">
              {savedStrategy ? 'Strateji yüklendi' : 'Kampanya oluştur, bütçe yönet, analiz et'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setStrategyText(savedStrategy); setShowStrategyModal(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 font-commons text-sm hover:bg-indigo-100 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Strateji Yükle
          </button>
          <Link
            to={`${basePath}/proposals`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 font-commons text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Öneriler
          </Link>
        </div>
      </div>

      {/* Action Cards (proposal results) */}
      <AnimatePresence>
        {proposalResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 flex gap-2 flex-wrap"
          >
            {proposalResults.slice(-3).map((r, i) => (
              <motion.div
                key={`${r.data.proposalId}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm"
              >
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="font-commons text-green-800 text-xs">{r.data.name}</span>
                <Link
                  to={`${basePath}/proposals`}
                  className="flex items-center gap-0.5 text-green-700 hover:text-green-900 font-commons text-xs font-medium"
                >
                  Görüntüle <ChevronRight className="w-3 h-3" />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto rounded-2xl bg-white/60 border border-white/50 p-4 space-y-3">
        {starting && (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-neutral-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="font-commons text-sm">Ajan başlatılıyor...</span>
            </div>
          </div>
        )}

        {!starting && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 mx-auto flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-indigo-500" />
              </div>
              <p className="font-commons text-sm text-neutral-500">Bir mesaj yazın veya öneri seçin</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-600" />
                </div>
              )}
              <div
                className={`px-4 py-2.5 rounded-2xl font-commons text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-sm'
                    : 'bg-white/80 border border-white/60 text-[#171717] rounded-tl-sm shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          </motion.div>
        ))}

        {loading && (
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
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm font-commons text-red-700">
          {error}
        </div>
      )}

      {/* Suggested Prompts (only when empty) */}
      {!starting && messages.length <= 1 && !loading && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
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
            disabled={!sessionId || loading || starting}
            placeholder="Mesajınızı yazın... (Enter ile gönder)"
            rows={1}
            className="w-full resize-none px-4 py-3 rounded-2xl bg-white/70 border border-white/60 font-commons text-sm focus:outline-none focus:bg-white/90 focus:border-indigo-200 placeholder:text-neutral-400 transition-all disabled:opacity-50"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
        </div>
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || !sessionId || loading || starting}
          className="flex-shrink-0 w-12 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white transition-all flex items-center justify-center"
        >
          {loading ? (
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
                  <h2 className="text-lg font-commons font-bold text-[#171717]">Strateji Bağlamı</h2>
                </div>
                <p className="text-sm font-commons text-neutral-500 mb-3">
                  Kampanya stratejinizi yapıştırın. Ajan bu bağlamı kullanarak daha isabetli öneriler sunacak.
                </p>
                <textarea
                  value={strategyText}
                  onChange={(e) => setStrategyText(e.target.value)}
                  placeholder="Örnek: TOFU 28K TL farkındalık, MOFU 21K TL retargeting, BOFU 21K TL dönüşüm hedefli..."
                  rows={8}
                  className="w-full resize-none px-4 py-3 rounded-xl border border-neutral-200 font-commons text-sm focus:outline-none focus:border-indigo-300 transition-all"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setShowStrategyModal(false)}
                    className="px-4 py-2 rounded-xl font-commons text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSaveStrategy}
                    disabled={!strategyText.trim() || savingStrategy}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-commons text-sm hover:bg-indigo-700 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
                  >
                    {savingStrategy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Kaydet ve Yeniden Başlat
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MarketingAgentPage;
