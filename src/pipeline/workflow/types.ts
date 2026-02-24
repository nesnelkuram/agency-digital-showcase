export type WorkflowAgentType =
  | 'content_brief'
  | 'content_draft'
  | 'performance_report'
  | 'qa_check'
  | 'campaign_strategy'
  | 'hashtag_researcher'
  | 'seo_optimizer'
  | 'custom';

export interface WorkflowAgentInput {
  agentType: WorkflowAgentType;
  instanceId: string;
  nodeId: string;
  context: Record<string, any>;
  promptTemplate: string;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  model: string;
  maxRetries: number;
  timeoutMs: number;
  requiresHumanReview: boolean;
  confidenceThreshold?: number;
  agentId?: string;
  systemPrompt?: string;
}

export interface WorkflowAgentOutput {
  success: boolean;
  output: Record<string, any>;
  confidenceScore: number;
  tokensUsed: { input: number; output: number };
  error?: string;
}
