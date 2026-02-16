import type { ServiceCategory } from '@/shared/types/pricing/services';
import type { WorkflowNodeTemplate, WorkflowEdgeTemplate, WorkflowPhase } from '@/shared/types/workflow/template';

export interface WorkflowDraft {
  name: string;
  description: string;
  serviceCategory: ServiceCategory;
  defaultEstimatedDays: number;
  nodes: WorkflowNodeTemplate[];
  edges: WorkflowEdgeTemplate[];
  phases: WorkflowPhase[];
}

export interface WorkflowDesignMessage {
  role: 'user' | 'assistant';
  content: string;
  draft?: WorkflowDraft;
  timestamp: number;
}
