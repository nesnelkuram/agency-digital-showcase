import { Timestamp } from 'firebase/firestore';
import { ServiceCategory } from './template';

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
  status: StepInstanceStatus;
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
  context: Record<string, any>;
  teamAssignments?: Record<string, string>;
  startedAt?: Timestamp;
  estimatedCompletionAt?: Timestamp;
  completedAt?: Timestamp;
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
