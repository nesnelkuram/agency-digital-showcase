import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Bot } from 'lucide-react';
import PersonaMessageBubble from './PersonaMessageBubble';
import PersonaSuggestedQuestions from './PersonaSuggestedQuestions';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  articlesReferenced?: Array<{ id: number; title: string; relevanceScore: number }>;
}

interface Props {
  initialContext?: { businessName: string; sector: string };
  leadId?: string;
}

const PersonaChatWidget: React.FC<Props> = ({ initialContext, leadId }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-start session
  useEffect(() => {
    if (!sessionId && !starting) {
      startSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSession = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/persona/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, businessContext: initialContext }),
      });
      if (!res.ok) throw new Error('Oturum baslatilamadi');
      const data = await res.json();
      setSessionId(data.sessionId);
      setSuggestedQuestions(data.suggestedQuestions || []);
    } catch (err: any) {
      setError(err.message || 'Baglanti hatasi');
    } finally {
      setStarting(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !sessionId || loading) return;

    const userMessage: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSuggestedQuestions([]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/persona/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text.trim() }),
      });
      if (!res.ok) throw new Error('Yanit alinamadi');
      const data = await res.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply,
        articlesReferenced: data.articlesReferenced,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setError(err.message || 'Mesaj gonderilemedi');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
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

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-neutral-100 bg-gradient-to-r from-purple-50 to-white">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
          <Bot className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="font-ramillas text-lg font-bold text-neutral-800">Danisman AI</h3>
          <p className="font-grotesk text-xs text-neutral-500">
            432 blog yazisinin birikimli perspektifi
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {starting && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            <span className="ml-2 font-grotesk text-sm text-neutral-500">Oturum baslatiyor...</span>
          </div>
        )}

        {!starting && messages.length === 0 && suggestedQuestions.length > 0 && (
          <div className="py-4">
            <div className="text-center mb-6">
              <p className="font-grotesk text-sm text-neutral-500">
                Merhaba! Ben yazarin 432 blog yazisindaki bakis acisiyla dusunuyorum.
                Bana bir soru sorun veya asagidaki onerilerden birini secin.
              </p>
            </div>
            <PersonaSuggestedQuestions
              questions={suggestedQuestions}
              onSelect={(q) => sendMessage(q)}
            />
          </div>
        )}

        {messages.map((msg, i) => (
          <PersonaMessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            articlesReferenced={msg.articlesReferenced}
          />
        ))}

        {loading && (
          <div className="flex items-center gap-2 px-4 py-3">
            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            <span className="font-grotesk text-sm text-neutral-400">Dusunuyor...</span>
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
            placeholder="Sorunuzu yazin..."
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 rounded-xl border border-neutral-200 focus:border-purple-300 focus:ring-1 focus:ring-purple-200 outline-none font-grotesk text-sm text-neutral-800 placeholder:text-neutral-400 bg-white"
            disabled={loading || !sessionId}
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || !sessionId}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default PersonaChatWidget;
