import React, { useMemo } from 'react';
import { Check, Circle, Loader2, SkipForward, AlertTriangle } from 'lucide-react';
import type { WorkflowInstance, StepInstance, StepInstanceStatus } from '@/shared/types/workflow/instance';
import type { WorkflowTemplate, WorkflowNodeTemplate, WorkflowEdgeTemplate } from '@/shared/types/workflow/template';

interface WorkflowStepTimelineProps {
  instance: WorkflowInstance;
  template: WorkflowTemplate | null;
  onStepClick?: (nodeId: string) => void;
}

function topologicalSort(nodes: WorkflowNodeTemplate[], edges: WorkflowEdgeTemplate[]): WorkflowNodeTemplate[] {
  const inDegree: Record<string, number> = {};
  const adjacency: Record<string, string[]> = {};
  const nodeMap: Record<string, WorkflowNodeTemplate> = {};

  for (const node of nodes) {
    inDegree[node.id] = 0;
    adjacency[node.id] = [];
    nodeMap[node.id] = node;
  }

  for (const edge of edges) {
    if (adjacency[edge.source]) {
      adjacency[edge.source].push(edge.target);
    }
    if (inDegree[edge.target] !== undefined) {
      inDegree[edge.target]++;
    }
  }

  const queue: string[] = [];
  for (const id of Object.keys(inDegree)) {
    if (inDegree[id] === 0) queue.push(id);
  }

  const sorted: WorkflowNodeTemplate[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(nodeMap[current]);
    for (const neighbor of adjacency[current] || []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  return sorted;
}

const STATUS_CONFIG: Record<StepInstanceStatus, {
  color: string;
  bgColor: string;
  borderColor: string;
  lineColor: string;
  icon: React.ElementType;
  pulse?: boolean;
}> = {
  completed: {
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    lineColor: 'bg-green-300',
    icon: Check,
  },
  in_progress: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-300',
    lineColor: 'bg-amber-300',
    icon: Loader2,
    pulse: true,
  },
  ready: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
    lineColor: 'bg-neutral-200',
    icon: Circle,
  },
  pending: {
    color: 'text-neutral-400',
    bgColor: 'bg-neutral-100',
    borderColor: 'border-neutral-200',
    lineColor: 'bg-neutral-200',
    icon: Circle,
  },
  skipped: {
    color: 'text-neutral-400',
    bgColor: 'bg-neutral-50',
    borderColor: 'border-neutral-200',
    lineColor: 'bg-neutral-200',
    icon: SkipForward,
  },
  blocked: {
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    lineColor: 'bg-red-200',
    icon: AlertTriangle,
  },
  awaiting_review: {
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-300',
    lineColor: 'bg-purple-200',
    icon: Circle,
  },
  revision_needed: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-300',
    lineColor: 'bg-orange-200',
    icon: AlertTriangle,
  },
  ai_processing: {
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
    borderColor: 'border-cyan-300',
    lineColor: 'bg-cyan-200',
    icon: Loader2,
    pulse: true,
  },
  ai_review: {
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    lineColor: 'bg-cyan-200',
    icon: Circle,
  },
};

const WorkflowStepTimeline: React.FC<WorkflowStepTimelineProps> = ({
  instance,
  template,
  onStepClick,
}) => {
  // Sort nodes topologically and filter out start/end
  const sortedNodes = useMemo(() => {
    if (!template) return [];
    const sorted = topologicalSort(template.nodes, template.edges);
    return sorted.filter(n => n.type !== 'start' && n.type !== 'end');
  }, [template]);

  if (!template || sortedNodes.length === 0) return null;

  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2 px-1">
      {sortedNodes.map((node, index) => {
        const step = instance.steps[node.id];
        const status: StepInstanceStatus = step?.status || 'pending';
        const config = STATUS_CONFIG[status];
        const Icon = config.icon;
        const isLast = index === sortedNodes.length - 1;

        return (
          <div key={node.id} className="flex items-center flex-shrink-0">
            {/* Step node */}
            <button
              onClick={() => onStepClick?.(node.id)}
              className={`relative flex flex-col items-center group cursor-pointer`}
              title={`${node.label} - ${status}`}
            >
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${config.bgColor} ${config.borderColor} ${config.pulse ? 'animate-pulse' : ''} group-hover:scale-110 transition-transform`}
              >
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              </div>
              <span className={`mt-1 text-[10px] font-grotesk max-w-[60px] text-center truncate leading-tight ${status === 'in_progress' ? 'font-semibold text-amber-700' : status === 'completed' ? 'text-green-700' : 'text-neutral-500'}`}>
                {node.label}
              </span>
            </button>

            {/* Connecting line */}
            {!isLast && (
              <div className={`w-6 h-0.5 ${config.lineColor} flex-shrink-0 mt-[-12px]`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowStepTimeline;
