import React from 'react';
import { Bot, CheckCircle2 } from 'lucide-react';
import type { BuilderChatMessage as MessageType } from '@/shared/types/workflowBuilderChat';

interface Props {
  message: MessageType;
}

const BuilderChatMessage: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="w-3 h-3 text-indigo-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div
            className={`px-3 py-2 rounded-2xl font-commons text-sm leading-relaxed ${
              isUser
                ? 'bg-indigo-600 text-white rounded-tr-sm'
                : 'bg-white border border-neutral-200 text-[#171717] rounded-tl-sm'
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          {message.canvasApplied && (
            <div className="flex items-center gap-1 mt-1 px-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              <span className="text-[10px] font-commons text-green-600">Canvas guncellendi</span>
            </div>
          )}
          {message.changesSummary && (
            <p className="mt-0.5 px-1 text-[10px] font-commons text-neutral-500">
              {message.changesSummary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuilderChatMessage;
