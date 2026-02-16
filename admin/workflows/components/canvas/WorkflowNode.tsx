import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Play,
  ClipboardList,
  Bot,
  Eye,
  CheckCircle,
  Flag,
  GitBranch,
  Bell,
  Square,
  Workflow,
} from 'lucide-react';

const nodeConfig: Record<
  string,
  { icon: React.ElementType; bg: string; border: string; text: string; iconColor: string }
> = {
  start: {
    icon: Play,
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-800',
    iconColor: 'text-green-600',
  },
  task: {
    icon: ClipboardList,
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-800',
    iconColor: 'text-blue-600',
  },
  ai_task: {
    icon: Bot,
    bg: 'bg-violet-50',
    border: 'border-violet-300',
    text: 'text-violet-800',
    iconColor: 'text-violet-600',
  },
  review: {
    icon: Eye,
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-800',
    iconColor: 'text-amber-600',
  },
  approval: {
    icon: CheckCircle,
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-800',
    iconColor: 'text-emerald-600',
  },
  milestone: {
    icon: Flag,
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    text: 'text-indigo-800',
    iconColor: 'text-indigo-600',
  },
  condition: {
    icon: GitBranch,
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    text: 'text-orange-800',
    iconColor: 'text-orange-600',
  },
  notification: {
    icon: Bell,
    bg: 'bg-pink-50',
    border: 'border-pink-300',
    text: 'text-pink-800',
    iconColor: 'text-pink-600',
  },
  end: {
    icon: Square,
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-800',
    iconColor: 'text-red-600',
  },
};

const defaultConfig = {
  icon: Workflow,
  bg: 'bg-neutral-50',
  border: 'border-neutral-300',
  text: 'text-neutral-800',
  iconColor: 'text-neutral-600',
};

const WorkflowNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeType = (data?.nodeType as string) || 'task';
  const config = nodeConfig[nodeType] || defaultConfig;
  const Icon = config.icon;
  const label = (data?.label as string) || 'Dugum';

  return (
    <div
      className={`
        px-3 py-2 rounded-lg border-2 min-w-[140px] max-w-[180px]
        ${config.bg} ${config.border}
        ${selected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
        shadow-sm transition-shadow hover:shadow-md
      `}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white"
      />
      <div className="flex items-center gap-2">
        <div className={`shrink-0 ${config.iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className={`font-commons text-xs font-semibold truncate ${config.text}`}>
          {label}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white"
      />
    </div>
  );
};

export default memo(WorkflowNode);
