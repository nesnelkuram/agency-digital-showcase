import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Wrench } from 'lucide-react';
import AccountSelector from './AccountSelector';
import CampaignGrid from './CampaignGrid';
import CampaignDetail from './CampaignDetail';
import PerformanceWidget from './PerformanceWidget';
import ApprovalCard from './ApprovalCard';
import type { AgentV2Message, AgentV2MessagePart } from '@/shared/types/marketing';

interface ChatMessageProps {
  message: AgentV2Message;
  onSendMessage: (text: string) => void;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  isStreaming?: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  list_connected_accounts: 'Hesaplar yukleniyor...',
  get_account_campaigns: 'Kampanyalar getiriliyor...',
  get_campaign_details: 'Kampanya detayi yukleniyor...',
  get_campaign_performance: 'Performans verileri aliniyor...',
  sync_campaigns: 'Kampanyalar senkronize ediliyor...',
  create_marketing_plan: 'Pazarlama plani olusturuluyor...',
  get_marketing_stats: 'Istatistikler yukleniyor...',
};

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onSendMessage,
  onApprove,
  onReject,
  isStreaming,
}) => {
  const isUser = message.role === 'user';

  // Filter out empty messages
  const hasParts = message.parts.length > 0 && message.parts.some(p => {
    if (p.type === 'text') return p.content.length > 0;
    return true;
  });

  if (!hasParts && !isStreaming) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex gap-2 max-w-[90%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          {message.parts.map((part, idx) => renderPart(part, idx, {
            isUser,
            onSendMessage,
            onApprove,
            onReject,
          }))}
        </div>
      </div>
    </motion.div>
  );
};

function renderPart(
  part: AgentV2MessagePart,
  index: number,
  opts: {
    isUser: boolean;
    onSendMessage: (text: string) => void;
    onApprove: (actionId: string) => void;
    onReject: (actionId: string) => void;
  }
) {
  switch (part.type) {
    case 'text':
      if (!part.content) return null;
      return (
        <div
          key={index}
          className={`px-4 py-2.5 rounded-2xl font-commons text-sm leading-relaxed ${
            opts.isUser
              ? 'bg-indigo-600 text-white rounded-tr-sm'
              : 'bg-white/80 border border-white/60 text-[#171717] rounded-tl-sm shadow-sm'
          }`}
        >
          <p className="whitespace-pre-wrap">{part.content}</p>
        </div>
      );

    case 'tool_call':
      return (
        <div key={index} className="my-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-50 border border-neutral-100">
          <Wrench className="w-3 h-3 text-neutral-400 animate-spin" />
          <span className="text-xs font-commons text-neutral-500">
            {TOOL_LABELS[part.name] || `${part.name} calisiyor...`}
          </span>
        </div>
      );

    case 'tool_result': {
      const data = part.data as any;
      if (!data) return null;

      // Render component based on tool name or component hint
      const component = part.component || '';

      if (component === 'AccountSelector' || part.name === 'list_connected_accounts') {
        return (
          <AccountSelector
            key={index}
            accounts={data.accounts || []}
            onSelect={(acc) => opts.onSendMessage(`${acc.accountName || acc.accountId} hesabini sectim`)}
          />
        );
      }

      if (component === 'CampaignGrid' || part.name === 'get_account_campaigns') {
        return (
          <CampaignGrid
            key={index}
            campaigns={data.campaigns || []}
            onSelect={(c) => opts.onSendMessage(`${c.name} kampanyasi hakkinda bilgi ver`)}
          />
        );
      }

      if (component === 'CampaignDetail' || part.name === 'get_campaign_details') {
        return <CampaignDetail key={index} campaign={data} />;
      }

      if (component === 'PerformanceWidget' || part.name === 'get_campaign_performance') {
        if (data.insights) {
          return (
            <PerformanceWidget
              key={index}
              data={data.insights}
              datePreset={data.datePreset}
            />
          );
        }
      }

      // Default: show as JSON-like summary
      if (data.error) {
        return (
          <div key={index} className="my-1 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs font-commons text-red-700">
            {data.error}
          </div>
        );
      }

      if (data.message) {
        return (
          <div key={index} className="my-1 px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-150 text-xs font-commons text-neutral-600">
            {data.message}
          </div>
        );
      }

      return null;
    }

    case 'approval_required':
      return (
        <ApprovalCard
          key={index}
          action={part.action}
          onApprove={opts.onApprove}
          onReject={opts.onReject}
        />
      );

    default:
      return null;
  }
}

export default ChatMessage;
