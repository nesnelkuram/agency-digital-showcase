export interface BuilderChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  canvasApplied?: boolean;
  changesSummary?: string;
  timestamp: number;
}

export interface CanvasSnapshot {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    description?: string;
    position: { x: number; y: number };
    assigneeRole?: string;
    estimatedDurationHours?: number;
    colorOverride?: string;
    notes?: string;
    locked?: boolean;
    subprocessConfig?: { childTemplateId?: string; childTemplateName?: string };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type?: string;
    label?: string;
    sourceHandle?: string;
    targetHandle?: string;
  }>;
}

export interface BuilderChatSession {
  id: string;
  tenantId: string;
  userId: string;
  templateId?: string;
  title: string | null;
  messages: BuilderChatMessage[];
  lastCanvasSnapshot?: CanvasSnapshot;
  createdAt: number;
  updatedAt: number;
}
