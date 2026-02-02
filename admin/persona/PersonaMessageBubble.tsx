import React from 'react';
import { motion } from 'framer-motion';
import { User, Bot, ExternalLink } from 'lucide-react';

interface ArticleRef {
  id: number;
  title: string;
  relevanceScore: number;
}

interface Props {
  role: 'user' | 'assistant';
  content: string;
  articlesReferenced?: ArticleRef[];
}

const PersonaMessageBubble: React.FC<Props> = ({ role, content, articlesReferenced }) => {
  const isUser = role === 'user';

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
      </div>
    </motion.div>
  );
};

export default PersonaMessageBubble;
