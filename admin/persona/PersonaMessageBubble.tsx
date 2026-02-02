import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Bot, ExternalLink, ThumbsUp, ThumbsDown, Send, X } from 'lucide-react';

interface ArticleRef {
  id: number;
  title: string;
  relevanceScore: number;
}

type FeedbackType = 'positive' | 'negative' | null;

interface Props {
  role: 'user' | 'assistant';
  content: string;
  articlesReferenced?: ArticleRef[];
  messageIndex?: number;
  feedback?: FeedbackType;
  onFeedback?: (messageIndex: number, feedback: 'positive' | 'negative', correction?: string) => void;
}

const PersonaMessageBubble: React.FC<Props> = ({
  role, content, articlesReferenced, messageIndex, feedback, onFeedback,
}) => {
  const isUser = role === 'user';
  const [showCorrection, setShowCorrection] = useState(false);
  const [correction, setCorrection] = useState('');

  const handleFeedback = (type: 'positive' | 'negative') => {
    if (!onFeedback || messageIndex === undefined) return;
    if (type === 'negative') {
      setShowCorrection(true);
    } else {
      setShowCorrection(false);
      setCorrection('');
      onFeedback(messageIndex, type);
    }
  };

  const submitCorrection = () => {
    if (!onFeedback || messageIndex === undefined) return;
    onFeedback(messageIndex, 'negative', correction.trim() || undefined);
    setShowCorrection(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-purple-100' : 'bg-neutral-100'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-purple-600" />
        ) : (
          <Bot className="w-4 h-4 text-neutral-600" />
        )}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}>
        <div
          className={`inline-block px-4 py-3 rounded-2xl font-grotesk text-sm leading-relaxed ${
            isUser
              ? 'bg-purple-600 text-white rounded-tr-sm'
              : 'bg-neutral-50 border border-neutral-100 text-neutral-800 rounded-tl-sm'
          }`}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>

        {/* Article references */}
        {!isUser && articlesReferenced && articlesReferenced.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="font-grotesk text-xs text-neutral-400">Ilgili yazilar:</p>
            {articlesReferenced.slice(0, 3).map((ref) => (
              <div
                key={ref.id}
                className="inline-flex items-center gap-1 px-2 py-1 mr-1 bg-purple-50 rounded text-xs font-grotesk text-purple-600"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="truncate max-w-[200px]">{ref.title}</span>
                <span className="text-purple-400">({Math.round(ref.relevanceScore * 100)}%)</span>
              </div>
            ))}
          </div>
        )}

        {/* Feedback buttons */}
        {!isUser && onFeedback && messageIndex !== undefined && (
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={() => handleFeedback('positive')}
              className={`p-1.5 rounded-lg transition-colors ${
                feedback === 'positive'
                  ? 'bg-green-100 text-green-600'
                  : 'text-neutral-300 hover:text-neutral-500 hover:bg-neutral-50'
              }`}
              title="Faydali"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleFeedback('negative')}
              className={`p-1.5 rounded-lg transition-colors ${
                feedback === 'negative'
                  ? 'bg-red-100 text-red-500'
                  : 'text-neutral-300 hover:text-neutral-500 hover:bg-neutral-50'
              }`}
              title="Gelistirilebilir"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
            {feedback === 'positive' && (
              <span className="font-grotesk text-xs text-green-500 ml-1">Tesekkurler!</span>
            )}
          </div>
        )}

        {/* Correction textarea */}
        <AnimatePresence>
          {showCorrection && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 overflow-hidden"
            >
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-3">
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="Nasil daha iyi olabilirdi? (opsiyonel)"
                  rows={2}
                  className="w-full resize-none px-3 py-2 rounded-lg border border-red-200 focus:border-red-300 focus:ring-1 focus:ring-red-200 outline-none font-grotesk text-xs text-neutral-700 placeholder:text-neutral-400 bg-white"
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => { setShowCorrection(false); setCorrection(''); }}
                    className="px-3 py-1 rounded-lg text-xs font-grotesk text-neutral-500 hover:bg-neutral-100 transition-colors"
                  >
                    <X className="w-3 h-3 inline mr-1" />
                    Iptal
                  </button>
                  <button
                    onClick={submitCorrection}
                    className="px-3 py-1 rounded-lg text-xs font-grotesk text-white bg-red-400 hover:bg-red-500 transition-colors"
                  >
                    <Send className="w-3 h-3 inline mr-1" />
                    Gonder
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PersonaMessageBubble;
