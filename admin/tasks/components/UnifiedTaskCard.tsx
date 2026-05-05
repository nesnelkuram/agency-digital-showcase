import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Clock,
  Bot,
  GitBranch,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Briefcase,
  Settings2,
  User,
} from 'lucide-react';
import type { UnifiedTaskItem, TaskCategory } from '@/shared/types/task';
import { TASK_CATEGORY_COLORS, TASK_CATEGORY_LABELS } from '@/shared/types/task';
import AIPriorityBadge from './AIPriorityBadge';

const CATEGORY_ICONS: Record<TaskCategory, React.ComponentType<{ className?: string }>> = {
  brand: Briefcase,
  admin: Settings2,
  personal: User,
};

interface UnifiedTaskCardProps {
  item: UnifiedTaskItem;
  onClick?: (item: UnifiedTaskItem) => void;
}

const STEP_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  ready:           { label: 'Hazır',          bg: 'bg-blue-50',   text: 'text-blue-700' },
  in_progress:     { label: 'Devam Ediyor',   bg: 'bg-amber-50',  text: 'text-amber-700' },
  ai_processing:   { label: 'AI Çalışıyor',   bg: 'bg-violet-50', text: 'text-violet-700' },
  ai_review:       { label: 'AI İnceleme',    bg: 'bg-purple-50', text: 'text-purple-700' },
  awaiting_review: { label: 'İnceleme Bkl.',  bg: 'bg-orange-50', text: 'text-orange-700' },
  revision_needed: { label: 'Revizyon',       bg: 'bg-red-50',    text: 'text-red-700' },
  blocked:         { label: 'Engellendi',     bg: 'bg-red-100',   text: 'text-red-800' },
  open:            { label: 'Açık',           bg: 'bg-blue-50',   text: 'text-blue-700' },
  completed:       { label: 'Tamamlandı',     bg: 'bg-green-50',  text: 'text-green-700' },
};

const UnifiedTaskCard: React.FC<UnifiedTaskCardProps> = ({ item, onClick }) => {
  const cfg = STEP_STATUS_CONFIG[item.status] || {
    label: item.status,
    bg: 'bg-neutral-50',
    text: 'text-neutral-700',
  };

  const isWorkflowStep = item.source === 'workflow_step';
  const hasRisk = item.aiRiskLevel === 'high' || item.aiRiskLevel === 'medium';
  const isAnalyzing = item.source === 'standalone' && item.task && item.task.aiAnalyzed === false;

  const category = item.category;
  const categoryColors = category ? TASK_CATEGORY_COLORS[category] : null;
  const CategoryIcon = category ? CATEGORY_ICONS[category] : null;
  const isAiGuess =
    item.categorySource === 'ai' &&
    item.task &&
    typeof item.task.categoryConfidence === 'number' &&
    item.task.categoryConfidence < 0.6;

  const href = isWorkflowStep && item.instanceId && item.nodeId
    ? `/admin/workflows/instance/${item.instanceId}/step/${encodeURIComponent(item.nodeId)}`
    : null;

  const handleClick = onClick && !isWorkflowStep
    ? () => onClick(item)
    : undefined;

  const cardContent = (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {isWorkflowStep && <GitBranch className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />}
            {item.isAiTask && <Bot className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />}
            <p className="font-commons text-sm font-semibold text-[#171717] truncate leading-tight">
              {item.title}
            </p>
          </div>
          {item.projectName && (
            <p className="font-commons text-xs text-neutral-500 truncate">{item.projectName}</p>
          )}
          {isWorkflowStep && item.templateName && (
            <p className="font-commons text-[10px] text-neutral-400 truncate">{item.templateName}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {isAnalyzing ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-500 animate-pulse">
              <Sparkles className="w-3 h-3" />
              AI Analiz...
            </span>
          ) : (
            <AIPriorityBadge score={item.aiPriorityScore} />
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 flex-wrap">
        {category && categoryColors && CategoryIcon && (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide ${categoryColors.bg} ${categoryColors.text}`}
          >
            <CategoryIcon className="w-2.5 h-2.5" />
            {category === 'brand' && item.projectName ? item.projectName : TASK_CATEGORY_LABELS[category]}
            {isAiGuess && (
              <Sparkles className="w-2.5 h-2.5 ml-0.5 opacity-70" />
            )}
          </span>
        )}
        {isWorkflowStep && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-neutral-100 text-neutral-500 uppercase tracking-wide">
            <GitBranch className="w-2.5 h-2.5" /> Workflow
          </span>
        )}
        {hasRisk && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-50 text-red-600 uppercase tracking-wide">
            <AlertTriangle className="w-2.5 h-2.5" />
            {item.aiRiskLevel === 'high' ? 'Kritik Risk' : 'Orta Risk'}
          </span>
        )}
        {item.dueDate && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-neutral-400" />
            <span className="font-commons text-[10px] text-neutral-400">
              {item.dueDate.toLocaleDateString('tr-TR')}
            </span>
          </div>
        )}
      </div>

      {/* Action */}
      <div className="flex items-center justify-between w-full px-3 py-1.5 bg-neutral-50 hover:bg-indigo-50 rounded-lg transition-colors group cursor-pointer">
        <span className="font-commons text-xs text-neutral-600 group-hover:text-indigo-700">
          {isWorkflowStep ? 'Adıma Git' : 'Detayları Gör'}
        </span>
        <ChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-indigo-600" />
      </div>
    </div>
  );

  const wrapperClass =
    'bg-white rounded-xl border border-neutral-100 p-4 hover:border-neutral-200 hover:shadow-sm transition-all';

  if (href) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Link to={href} className={`block ${wrapperClass}`}>
          {cardContent}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={wrapperClass}
      onClick={handleClick}
      style={{ cursor: handleClick ? 'pointer' : 'default' }}
    >
      {cardContent}
    </motion.div>
  );
};

export default UnifiedTaskCard;
