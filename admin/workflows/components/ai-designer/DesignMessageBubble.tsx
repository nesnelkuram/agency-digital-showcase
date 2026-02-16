import React from 'react';
import { motion } from 'framer-motion';
import { User, Bot } from 'lucide-react';

interface Props {
  role: 'user' | 'assistant';
  content: string;
}

const DesignMessageBubble: React.FC<Props> = ({ role, content }) => {
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
          isUser ? 'bg-indigo-100' : 'bg-violet-100'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-indigo-600" />
        ) : (
          <Bot className="w-4 h-4 text-violet-600" />
        )}
      </div>

      {/* Content */}
      <div className={`max-w-[80%] ${isUser ? 'text-right' : 'text-left'}`}>
        <div
          className={`inline-block px-4 py-3 rounded-2xl font-grotesk text-sm leading-relaxed ${
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-neutral-50 border border-neutral-100 text-neutral-800 rounded-tl-sm'
          }`}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default DesignMessageBubble;
