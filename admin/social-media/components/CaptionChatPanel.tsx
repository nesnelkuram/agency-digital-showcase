import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, Loader2, Check, MessageCircle } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import type {
  SocialMediaPost,
  CaptionChatMessage,
  SocialPlatform,
} from '@/shared/types/socialMedia';
import type { BrandAICharacter } from '@/shared/types/brandAICharacter';

interface CaptionChatPanelProps {
  open: boolean;
  onClose: () => void;
  post: SocialMediaPost;
  platform: SocialPlatform;
  brandCharacter: BrandAICharacter | null;
  onApplyCaption: (caption: string, hashtags?: string[]) => Promise<void> | void;
  onPersistHistory: (history: CaptionChatMessage[]) => Promise<void> | void;
}

interface AssistantTurn {
  assistantMessage: string;
  suggestedCaption?: string;
  suggestedHashtags?: string[];
}

const CaptionChatPanel: React.FC<CaptionChatPanelProps> = ({
  open,
  onClose,
  post,
  platform,
  brandCharacter,
  onApplyCaption,
  onPersistHistory,
}) => {
  const [messages, setMessages] = useState<CaptionChatMessage[]>(post.captionChatHistory || []);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(post.captionChatHistory || []);
  }, [post.id, post.captionChatHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: CaptionChatMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch('/api/social-media/iterate-caption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          postId: post.id,
          platform,
          postType: post.postType,
          mediaUrls: post.media?.map((m) => m.url) || [],
          currentCaption: post.caption,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'AI yanıt alınamadı');
      }
      const body: AssistantTurn = await res.json();
      const assistantMsg: CaptionChatMessage = {
        role: 'assistant',
        content: body.assistantMessage || '(boş yanıt)',
        timestamp: Date.now(),
        suggestedCaption: body.suggestedCaption || undefined,
        suggestedHashtags: body.suggestedHashtags || undefined,
      };
      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);
      await onPersistHistory(finalMessages);
    } catch (err: any) {
      setError(err?.message || 'Hata oluştu');
      setMessages(messages); // revert to pre-send state
    } finally {
      setSending(false);
    }
  };

  const applySuggestion = async (msgIdx: number) => {
    const msg = messages[msgIdx];
    if (!msg?.suggestedCaption) return;
    setApplyingIdx(msgIdx);
    try {
      await onApplyCaption(msg.suggestedCaption, msg.suggestedHashtags);
    } finally {
      setApplyingIdx(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex"
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative ml-auto w-full max-w-md bg-white shadow-2xl flex flex-col h-full"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="font-grotesk text-sm font-semibold text-[#171717]">
                      {brandCharacter?.brandName || 'Marka'} AI
                    </p>
                    <p
                      className="font-grotesk text-[11px] text-neutral-500"
                      title={brandCharacter?.systemPrompt || ''}
                    >
                      {brandCharacter?.voiceSummary || 'Genel ton'}
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg">
                  <X className="w-4 h-4 text-neutral-500" />
                </button>
              </div>
            </div>

            {/* Current caption */}
            {post.caption && (
              <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-100">
                <p className="font-grotesk text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                  Mevcut caption
                </p>
                <p className="font-grotesk text-xs text-neutral-700 line-clamp-3">{post.caption}</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageCircle className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="font-grotesk text-xs text-neutral-500">
                    AI'ye caption için talep yazın.
                  </p>
                  <p className="font-grotesk text-[11px] text-neutral-400 mt-1">
                    Örn: "Daha samimi yap", "3 farklı versiyon öner", "Emoji azalt"
                  </p>
                </div>
              )}
              {messages.map((m, idx) => (
                <div
                  key={`${idx}-${m.timestamp}`}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 font-grotesk text-xs ${
                      m.role === 'user'
                        ? 'bg-[#171717] text-white rounded-br-sm'
                        : 'bg-neutral-100 text-[#171717] rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    {m.suggestedCaption && m.role === 'assistant' && (
                      <div className="mt-2 p-2 bg-white rounded-lg border border-neutral-200">
                        <p className="text-[10px] font-semibold text-neutral-500 uppercase mb-1">
                          Önerilen caption
                        </p>
                        <p className="text-[#171717] whitespace-pre-wrap">{m.suggestedCaption}</p>
                        {m.suggestedHashtags && m.suggestedHashtags.length > 0 && (
                          <p className="text-neutral-500 mt-1">{m.suggestedHashtags.join(' ')}</p>
                        )}
                        <button
                          type="button"
                          disabled={applyingIdx === idx}
                          onClick={() => applySuggestion(idx)}
                          className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-[#171717] text-white rounded-md text-[10px] font-medium hover:bg-neutral-800 disabled:opacity-50"
                        >
                          {applyingIdx === idx ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Uygula
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-neutral-100 rounded-2xl rounded-bl-sm px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-50 border-t border-red-100">
                <p className="font-grotesk text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-neutral-100 bg-white">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={2}
                  placeholder="Talep veya yön verin..."
                  className="flex-1 px-3 py-2 border border-neutral-200 rounded-xl font-grotesk text-sm resize-none focus:outline-none focus:border-neutral-400"
                />
                <button
                  type="button"
                  disabled={!input.trim() || sending}
                  onClick={sendMessage}
                  className="px-3 py-2 bg-[#171717] text-white rounded-xl hover:bg-neutral-800 disabled:opacity-50 flex-shrink-0 self-end"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CaptionChatPanel;
