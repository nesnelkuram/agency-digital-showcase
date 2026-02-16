import { Timestamp } from 'firebase/firestore';

export type { ServiceCategory } from '@/shared/types/pricing/services';

export type WorkflowNodeType =
  | 'start'
  | 'task'
  | 'ai_task'
  | 'review'
  | 'approval'
  | 'milestone'
  | 'condition'
  | 'parallel_split'
  | 'parallel_join'
  | 'notification'
  | 'end';

export type WorkflowEdgeType =
  | 'default'
  | 'conditional_true'
  | 'conditional_false'
  | 'rejection'
  | 'escalation';

export interface SOPResource {
  id: string;
  type: 'video' | 'document' | 'checklist' | 'link';
  title: string;
  description?: string;
  url: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  isRequired: boolean;
  sortOrder: number;
}

export interface AIAgentConfig {
  agentType: string;
  model: string;
  promptTemplate: string;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  maxRetries: number;
  timeoutMs: number;
  requiresHumanReview: boolean;
  confidenceThreshold?: number;
}

export interface WorkflowNodeTemplate {
  id: string;
  type: WorkflowNodeType;
  label: string;
  description?: string;
  position: { x: number; y: number };
  assigneeRole?: string;
  estimatedDurationHours?: number;
  sopResources: SOPResource[];
  aiAgentConfig?: AIAgentConfig;
  conditionConfig?: {
    field: string;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'exists';
    value: string | number | boolean;
  };
  reviewConfig?: {
    reviewerRole: string;
    rejectionTarget?: string;
    maxRejections?: number;
    escalationTarget?: string;
  };
  notificationConfig?: {
    recipients: ('assignee' | 'project_owner' | 'client' | 'admin')[];
    template: string;
    channel: ('email' | 'in_app')[];
  };
  formSchema?: {
    fields: Array<{
      id: string;
      label: string;
      type: 'text' | 'textarea' | 'number' | 'select' | 'file_upload' | 'date' | 'checkbox' | 'rating';
      required: boolean;
      options?: Array<{ value: string; label: string }>;
    }>;
  };
  metadata?: Record<string, any>;
}

export interface WorkflowEdgeTemplate {
  id: string;
  source: string;
  target: string;
  type: WorkflowEdgeType;
  label?: string;
  conditionValue?: string;
}

export interface WorkflowPhase {
  id: string;
  name: string;
  description?: string;
  nodeIds: string[];
  sortOrder: number;
  color?: string;
}

export interface WorkflowTemplate {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  serviceCategory: ServiceCategory;
  serviceSubType?: string;
  serviceTemplateId?: string;
  nodes: WorkflowNodeTemplate[];
  edges: WorkflowEdgeTemplate[];
  phases: WorkflowPhase[];
  defaultEstimatedDays: number;
  version: number;
  isLatest: boolean;
  previousVersionId?: string;
  status: 'draft' | 'published' | 'archived';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  createdByName: string;
}
