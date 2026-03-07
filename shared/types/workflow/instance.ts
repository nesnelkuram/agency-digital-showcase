import { Timestamp } from 'firebase/firestore';
import { ServiceCategory, WorkflowType } from './template';

export type WorkflowInstanceStatus = 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';

export type StepInstanceStatus =
  | 'pending'
  | 'ready'
  | 'in_progress'
  | 'awaiting_review'
  | 'revision_needed'
  | 'ai_processing'
  | 'ai_review'
  | 'completed'
  | 'skipped'
  | 'blocked';

export interface AIExecutionRecord {
  executionId: string;
  agentType: string;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  status: 'running' | 'completed' | 'failed' | 'review_pending';
  input: Record<string, any>;
  output?: Record<string, any>;
  confidenceScore?: number;
  error?: string;
  reviewedBy?: string;
  reviewDecision?: 'approved' | 'rejected' | 'modified';
  tokensUsed?: { input: number; output: number };
}

export interface StepInstance {
  nodeId: string;
  label?: string;          // Human-readable label copied from template node at instantiation time
  status: StepInstanceStatus;
  // Subprocess fields (populated when step is a flattened sub-step)
  parentStepId?: string;   // e.g. "node_canva" — the subprocess node this belongs to
  isSubStep?: boolean;
  isSubProcess?: boolean;  // true if this step represents a subprocess container
  assignment?: {
    userId: string;
    userName: string;
    userRole: string;
    assignedAt: Timestamp;
  };
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  dueDate?: Timestamp;
  formData?: Record<string, any>;
  deliverables?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    uploadedAt: Timestamp;
  }>;
  sopProgress?: Record<string, {
    viewedAt?: Timestamp;
    completedAt?: Timestamp;
    timeSpentSeconds?: number;
  }>;
  revisions?: Array<{
    revisionNumber: number;
    rejectedBy: string;
    reason: string;
    rejectedAt: Timestamp;
  }>;
  currentRevision: number;
  aiExecutions?: AIExecutionRecord[];
  comments?: Array<{
    id: string;
    userId: string;
    userName: string;
    text: string;
    createdAt: Timestamp;
  }>;
  outputData?: Record<string, any>;
}

export interface WorkflowInstance {
  id: string;
  tenantId: string;
  templateId: string;
  templateVersion: number;
  templateName: string;
  projectId: string;
  projectName: string;
  clientId?: string;
  clientName: string;
  serviceCategory: ServiceCategory;
  serviceSubType?: string;
  status: WorkflowInstanceStatus;
  progress: number;
  currentPhase?: string;
  steps: Record<string, StepInstance>;
  activeNodeIds: string[];
  // Denormalized for Kanban queries: array-contains('userId') → instances with active tasks for that user
  activeAssigneeIds: string[];
  // Denormalized labels of ready/in_progress steps for quick display
  activeStepLabels: string[];
  lastActivityAt?: Timestamp;
  context: Record<string, any>;
  teamAssignments?: Record<string, string>;
  startedAt?: Timestamp;
  estimatedCompletionAt?: Timestamp;
  completedAt?: Timestamp;
  // Workflow type classification (copied from template)
  workflowType?: WorkflowType;
  // Recurring: set when spawned from a recurring template
  recurringTemplateId?: string;
  isRecurringInstance?: boolean;
  // auditLog: embedded for quick access (last ~20 entries); older entries in subcollection audit_log
  auditLog: Array<{
    id: string;
    action: string;
    description: string;
    userId: string;
    timestamp: Timestamp;
  }>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
