import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
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
  Network,
  Lock,
  StickyNote,
} from 'lucide-react';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';

const nodeConfig: Record<
  string,
  { icon: React.ElementType; bg: string; border: string; text: string; iconColor: string }
> = {
  start: { icon: Play, bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', iconColor: 'text-green-600' },
  task: { icon: ClipboardList, bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', iconColor: 'text-blue-600' },
  ai_task: { icon: Bot, bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-800', iconColor: 'text-violet-600' },
  review: { icon: Eye, bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', iconColor: 'text-amber-600' },
  approval: { icon: CheckCircle, bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800', iconColor: 'text-emerald-600' },
  milestone: { icon: Flag, bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-800', iconColor: 'text-indigo-600' },
  condition: { icon: GitBranch, bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', iconColor: 'text-orange-600' },
  notification: { icon: Bell, bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-800', iconColor: 'text-pink-600' },
  subprocess: { icon: Network, bg: 'bg-cyan-50', border: 'border-cyan-400 border-dashed', text: 'text-cyan-800', iconColor: 'text-cyan-600' },
  end: { icon: Square, bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', iconColor: 'text-red-600' },
};

const defaultConfig = {
  icon: Workflow,
  bg: 'bg-neutral-50',
  border: 'border-neutral-300',
  text: 'text-neutral-800',
  iconColor: 'text-neutral-600',
};

const WorkflowNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const nodeType = (data?.nodeType as string) || 'task';
  const config = nodeConfig[nodeType] || defaultConfig;
  const Icon = config.icon;
  const label = (data?.label as string) || 'Dugum';
  const childTemplateName = (data?.subprocessConfig as any)?.childTemplateName as string | undefined;
  const colorOverride = data?.colorOverride as string | undefined;
  const isLocked = data?.locked as boolean | undefined;
  const notes = data?.notes as string | undefined;

  const updateNodeData = useWorkflowBuilderStore((s) => s.updateNodeData);

  // Inline label editing
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(label);
    setEditing(true);
  }, [label]);

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      updateNodeData(id, { label: trimmed });
    }
    setEditing(false);
  }, [editValue, label, id, updateNodeData]);

  const cancelEdit = useCallback(() => {
    setEditValue(label);
    setEditing(false);
  }, [label]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') cancelEdit();
    },
    [commitEdit, cancelEdit]
  );

  // Build style — colorOverride replaces bg class
  const bgStyle = colorOverride ? { backgroundColor: colorOverride } : undefined;
  const bgClass = colorOverride ? '' : config.bg;

  return (
    <div
      className={`
        group/node
        px-3 py-2 rounded-lg border-2 min-w-[140px] max-w-[200px] relative
        ${bgClass} ${config.border}
        ${selected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}
        shadow-sm transition-shadow hover:shadow-md
        ${nodeType === 'subprocess' ? 'cursor-pointer' : ''}
      `}
      style={bgStyle}
    >
      {/* 4 handles — one centered on each edge, all source+target capable */}
      <Handle type="source" position={Position.Top} id="top"
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} id="bottom"
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Left} id="left"
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white" />
      <Handle type="source" position={Position.Right} id="right"
        className="!w-2.5 !h-2.5 !bg-neutral-400 !border-2 !border-white" />

      {/* Indicators: lock & notes */}
      {(isLocked || notes) && (
        <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 z-10">
          {notes && (
            <div className="group/note relative">
              <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
                <StickyNote className="w-2.5 h-2.5 text-amber-600" />
              </div>
              <div className="absolute bottom-full right-0 mb-1 hidden group-hover/note:block z-50 pointer-events-none">
                <div className="bg-neutral-800 text-white text-[10px] font-commons px-2 py-1 rounded shadow-lg max-w-[200px] whitespace-pre-wrap">
                  {notes}
                </div>
              </div>
            </div>
          )}
          {isLocked && (
            <div className="w-4 h-4 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center">
              <Lock className="w-2.5 h-2.5 text-neutral-500" />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className={`shrink-0 ${config.iconColor}`}>
          <Icon className="w-4 h-4" />
        </div>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="font-commons text-xs font-semibold bg-white/80 border border-neutral-300 rounded px-1 py-0.5 w-full outline-none focus:border-indigo-400"
          />
        ) : (
          <span
            className={`font-commons text-xs font-semibold truncate ${config.text} cursor-text`}
            onDoubleClick={handleLabelDoubleClick}
          >
            {label}
          </span>
        )}
      </div>

      {nodeType === 'subprocess' && (
        <div className="mt-1">
          {childTemplateName ? (
            <span className="font-commons text-[10px] text-cyan-600 truncate block">
              ↳ {childTemplateName}
            </span>
          ) : (
            <span className="font-commons text-[10px] text-neutral-400 italic">
              Cift tikla → alt surec olustur
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(WorkflowNode);
