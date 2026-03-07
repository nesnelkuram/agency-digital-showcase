import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, Circle, Clock, AlertCircle, Bot, Eye,
  ChevronRight, Loader2, Ban,
} from 'lucide-react';
import type { WorkflowInstance, StepInstance } from '@/shared/types/workflow/instance';
import type { WorkflowTemplate, WorkflowNodeTemplate } from '@/shared/types/workflow/template';

const STEP_STATUS_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  lineColor: string;
  label: string;
}> = {
  pending:          { icon: Circle,        color: 'text-neutral-300', lineColor: 'bg-neutral-200', label: 'Bekliyor' },
  ready:            { icon: Circle,        color: 'text-blue-500',    lineColor: 'bg-blue-200',    label: 'Hazir' },
  in_progress:      { icon: Loader2,       color: 'text-amber-500',   lineColor: 'bg-amber-200',   label: 'Devam Ediyor' },
  awaiting_review:  { icon: Eye,           color: 'text-purple-500',  lineColor: 'bg-purple-200',  label: 'Inceleme Bekliyor' },
  revision_needed:  { icon: AlertCircle,   color: 'text-red-500',     lineColor: 'bg-red-200',     label: 'Revizyon Gerekli' },
  ai_processing:    { icon: Bot,           color: 'text-indigo-500',  lineColor: 'bg-indigo-200',  label: 'AI Calisiyor' },
  ai_review:        { icon: Bot,           color: 'text-violet-500',  lineColor: 'bg-violet-200',  label: 'AI Inceleme' },
  completed:        { icon: CheckCircle2,  color: 'text-green-500',   lineColor: 'bg-green-300',   label: 'Tamamlandi' },
  skipped:          { icon: Ban,           color: 'text-neutral-400', lineColor: 'bg-neutral-200',  label: 'Atlandi' },
  blocked:          { icon: AlertCircle,   color: 'text-red-600',     lineColor: 'bg-red-300',     label: 'Engellendi' },
};

interface VerticalStepTimelineProps {
  instance: WorkflowInstance;
  template: WorkflowTemplate | null;
  projectId: string;
}

function getTopologicalOrder(
  nodes: WorkflowNodeTemplate[],
  edges: { source: string; target: string }[]
): string[] {
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const neighbor of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return ordered;
}

function formatDate(ts: any): string {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const VerticalStepTimeline: React.FC<VerticalStepTimelineProps> = ({
  instance,
  template,
  projectId,
}) => {
  const nodes = template?.nodes || [];
  const edges = template?.edges || [];

  // Get ordered node IDs, filter out start/end and sub-steps
  const orderedIds = getTopologicalOrder(nodes, edges);
  const visibleSteps = orderedIds.filter((id) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return false;
    if (node.type === 'start' || node.type === 'end') return false;
    const step = instance.steps[id];
    if (step?.isSubStep) return false;
    return true;
  });

  if (visibleSteps.length === 0) {
    return (
      <p className="font-grotesk text-sm text-neutral-400 py-4 text-center">
        Bu is akisinda goruntulenecek adim yok.
      </p>
    );
  }

  return (
    <div className="relative">
      {visibleSteps.map((nodeId, index) => {
        const node = nodes.find((n) => n.id === nodeId);
        const step: StepInstance | undefined = instance.steps[nodeId];
        if (!node || !step) return null;

        const config = STEP_STATUS_CONFIG[step.status] || STEP_STATUS_CONFIG.pending;
        const Icon = config.icon;
        const isLast = index === visibleSteps.length - 1;
        const isActive = step.status === 'in_progress' || step.status === 'ready';

        return (
          <div key={nodeId} className="flex gap-3 relative">
            {/* Timeline line + icon */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isActive ? 'ring-2 ring-offset-1 ring-blue-300' : ''
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${config.color} ${
                    step.status === 'in_progress' ? 'animate-spin' : ''
                  }`}
                />
              </div>
              {!isLast && (
                <div className={`w-0.5 flex-1 min-h-[24px] ${config.lineColor}`} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-5 flex-1 min-w-0 ${isLast ? '' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-grotesk text-sm font-medium text-[#171717] truncate">
                    {node.label}
                  </span>
                  <span
                    className={`text-[10px] font-grotesk font-medium px-2 py-0.5 rounded-full ${
                      step.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : step.status === 'in_progress'
                        ? 'bg-amber-100 text-amber-700'
                        : step.status === 'ready'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {config.label}
                  </span>
                </div>

                <Link
                  to={`/admin/projects/${projectId}/workflow/${instance.id}/step/${nodeId}`}
                  className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {node.description && (
                <p className="font-grotesk text-xs text-neutral-500 mt-0.5 line-clamp-1">
                  {node.description}
                </p>
              )}

              <div className="flex items-center gap-3 mt-1">
                {step.assignment && (
                  <span className="font-grotesk text-[10px] text-neutral-400">
                    {step.assignment.userName}
                  </span>
                )}
                {step.completedAt && (
                  <span className="inline-flex items-center gap-1 font-grotesk text-[10px] text-neutral-400">
                    <Clock className="w-3 h-3" />
                    {formatDate(step.completedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default VerticalStepTimeline;
