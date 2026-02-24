export type AIAgentType = 'gemini_task' | 'canva_autofill' | 'gemini_vision';
export type AIAgentStatus = 'active' | 'draft';

export interface CanvaConfig {
  brandTemplateId: string;
  autofillMapping: Record<string, string>; // workflow context key → Canva field name
  exportFormat: 'PNG' | 'PDF' | 'JPG';
}

export interface AIAgent {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  agentType: AIAgentType;
  status: AIAgentStatus;
  systemPrompt?: string;
  promptTemplate?: string;
  model?: 'flash' | 'pro';
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
  requiresHumanReview: boolean;
  confidenceThreshold?: number;
  maxRetries?: number;
  timeoutMs?: number;
  canvaConfig?: CanvaConfig;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  createdByName: string;
}

export const AI_AGENT_TYPE_LABELS: Record<AIAgentType, string> = {
  gemini_task: 'Gemini Gorev',
  canva_autofill: 'Canva Otomatik Doldur',
  gemini_vision: 'Gemini Vision',
};

export const AI_AGENT_TYPE_COLORS: Record<AIAgentType, string> = {
  gemini_task: 'bg-violet-100 text-violet-700',
  canva_autofill: 'bg-purple-100 text-purple-700',
  gemini_vision: 'bg-emerald-100 text-emerald-700',
};
