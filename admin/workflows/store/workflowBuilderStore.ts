import { create } from 'zustand';
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
} from '@xyflow/react';
import type { WorkflowTemplate, WorkflowNodeType } from '@/shared/types/workflow';

const NODE_DEFAULTS: Record<string, { label: string; nodeType: WorkflowNodeType }> = {
  start: { label: 'Baslangic', nodeType: 'start' },
  task: { label: 'Gorev', nodeType: 'task' },
  ai_task: { label: 'AI Gorev', nodeType: 'ai_task' },
  review: { label: 'Review', nodeType: 'review' },
  approval: { label: 'Onay', nodeType: 'approval' },
  milestone: { label: 'Milestone', nodeType: 'milestone' },
  condition: { label: 'Kosul', nodeType: 'condition' },
  notification: { label: 'Bildirim', nodeType: 'notification' },
  end: { label: 'Bitis', nodeType: 'end' },
};

interface WorkflowBuilderState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  isDirty: boolean;
  templateName: string;
  templateDescription: string;
  serviceCategory: string;
  defaultEstimatedDays: number;

  // Actions
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setSelectedNodeId: (id: string | null) => void;
  addNode: (type: string, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, data: any) => void;
  setTemplateInfo: (info: {
    name?: string;
    description?: string;
    serviceCategory?: string;
    defaultEstimatedDays?: number;
  }) => void;
  reset: () => void;
  loadFromTemplate: (template: WorkflowTemplate) => void;
}

const initialState = {
  nodes: [] as Node[],
  edges: [] as Edge[],
  selectedNodeId: null as string | null,
  isDirty: false,
  templateName: '',
  templateDescription: '',
  serviceCategory: 'other',
  defaultEstimatedDays: 7,
};

export const useWorkflowBuilderStore = create<WorkflowBuilderState>((set, get) => ({
  ...initialState,

  setNodes: (nodes) => set({ nodes, isDirty: true }),

  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

  onConnect: (connection: Connection) => {
    set({
      edges: addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: true,
        },
        get().edges
      ),
      isDirty: true,
    });
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  addNode: (type, position) => {
    const defaults = NODE_DEFAULTS[type];
    if (!defaults) return;

    const id = `node-${Date.now()}`;
    const newNode: Node = {
      id,
      type: 'workflowNode',
      position,
      data: {
        nodeType: defaults.nodeType,
        label: defaults.label,
        description: '',
        assigneeRole: '',
        estimatedDurationHours: 0,
        // Review config
        reviewConfig: type === 'review' ? { reviewerRole: 'admin', maxRejections: 3 } : undefined,
        // Condition config
        conditionConfig:
          type === 'condition'
            ? { field: '', operator: 'equals', value: '' }
            : undefined,
        // Notification config
        notificationConfig:
          type === 'notification'
            ? { recipients: ['assignee'], template: '', channel: ['in_app'] }
            : undefined,
      },
    };

    set({
      nodes: [...get().nodes, newNode],
      isDirty: true,
    });
  },

  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
      isDirty: true,
    });
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
      isDirty: true,
    });
  },

  setTemplateInfo: (info) => {
    set({
      ...(info.name !== undefined && { templateName: info.name }),
      ...(info.description !== undefined && { templateDescription: info.description }),
      ...(info.serviceCategory !== undefined && { serviceCategory: info.serviceCategory }),
      ...(info.defaultEstimatedDays !== undefined && {
        defaultEstimatedDays: info.defaultEstimatedDays,
      }),
      isDirty: true,
    });
  },

  reset: () => set({ ...initialState }),

  loadFromTemplate: (template) => {
    const nodes: Node[] = (template.nodes || []).map((n) => ({
      id: n.id,
      type: 'workflowNode',
      position: n.position || { x: 0, y: 0 },
      data: {
        nodeType: n.type,
        label: n.label,
        description: n.description || '',
        assigneeRole: n.assigneeRole || '',
        estimatedDurationHours: n.estimatedDurationHours || 0,
        reviewConfig: n.reviewConfig,
        conditionConfig: n.conditionConfig,
        notificationConfig: n.notificationConfig,
      },
    }));

    const edges: Edge[] = (template.edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      animated: true,
      label: e.label,
      data: {
        edgeType: e.type,
        conditionValue: e.conditionValue,
      },
    }));

    set({
      nodes,
      edges,
      selectedNodeId: null,
      isDirty: false,
      templateName: template.name,
      templateDescription: template.description,
      serviceCategory: template.serviceCategory,
      defaultEstimatedDays: template.defaultEstimatedDays,
    });
  },
}));
