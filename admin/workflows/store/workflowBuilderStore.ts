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
import type { WorkflowTemplate, WorkflowNodeType, WorkflowType, RecurringConfig } from '@/shared/types/workflow';
import type { CanvasSnapshot } from '@/shared/types/workflowBuilderChat';

const NODE_DEFAULTS: Record<string, { label: string; nodeType: WorkflowNodeType }> = {
  start: { label: 'Baslangic', nodeType: 'start' },
  task: { label: 'Gorev', nodeType: 'task' },
  ai_task: { label: 'AI Gorev', nodeType: 'ai_task' },
  review: { label: 'Review', nodeType: 'review' },
  approval: { label: 'Onay', nodeType: 'approval' },
  milestone: { label: 'Milestone', nodeType: 'milestone' },
  condition: { label: 'Kosul', nodeType: 'condition' },
  notification: { label: 'Bildirim', nodeType: 'notification' },
  subprocess: { label: 'Alt Surec', nodeType: 'subprocess' },
  end: { label: 'Bitis', nodeType: 'end' },
};

const MAX_HISTORY = 50;

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

interface ClipboardData {
  nodes: Node[];
  edges: Edge[];
}

interface SessionData {
  nodes: Node[];
  edges: Edge[];
  isDirty: boolean;
  templateName: string;
  templateDescription: string;
  serviceCategory: string;
  defaultEstimatedDays: number;
  parentTemplateId: string | null;
  parentNodeId: string | null;
  depth: number;
  recurringConfig: RecurringConfig | null;
  workflowType: WorkflowType;
  _history: Snapshot[];
  _historyIndex: number;
}

interface WorkflowBuilderState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  isDirty: boolean;
  templateName: string;
  templateDescription: string;
  serviceCategory: string;
  defaultEstimatedDays: number;
  parentTemplateId: string | null;
  parentNodeId: string | null;
  depth: number;
  recurringConfig: RecurringConfig | null;
  workflowType: WorkflowType;

  // Session cache — preserves state when navigating between parent/child workflows
  _sessionCache: Map<string, SessionData>;
  saveSession: (templateId: string) => void;
  restoreSession: (templateId: string) => boolean;
  clearSession: (templateId: string) => void;

  // Undo/Redo — snapshot-based model
  // history[historyIndex] always matches current nodes/edges
  _history: Snapshot[];
  _historyIndex: number;

  // Clipboard
  clipboard: ClipboardData | null;

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
    recurringConfig?: RecurringConfig | null;
    workflowType?: WorkflowType;
  }) => void;
  reset: () => void;
  loadFromTemplate: (template: WorkflowTemplate) => void;

  // Undo/Redo
  _saveSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Clipboard
  copySelectedNodes: () => void;
  pasteNodes: (position: { x: number; y: number }) => void;
  duplicateSelectedNodes: () => void;

  // Selection helpers
  selectAllNodes: () => void;
  getSelectedNodes: () => Node[];
  removeSelectedNodes: () => void;

  // Edge operations
  removeEdge: (id: string) => void;
  removeSelectedElements: () => void; // nodes + edges

  // Auto-layout
  autoLayout: () => Promise<void>;

  // AI Chat integration
  getCanvasSnapshot: () => CanvasSnapshot;
  applyAICanvasState: (snapshot: CanvasSnapshot) => void;
}

function createSeedNodesAndEdges(): { nodes: Node[]; edges: Edge[] } {
  const startId = `node-${Date.now()}-start`;
  const endId = `node-${Date.now()}-end`;
  const edgeId = `edge-${Date.now()}-seed`;

  const nodes: Node[] = [
    {
      id: startId,
      type: 'workflowNode',
      position: { x: 100, y: 80 },
      data: {
        nodeType: 'start',
        label: 'Baslangic',
        description: '',
        assigneeRole: '',
        estimatedDurationHours: 0,
        locked: false,
      },
    },
    {
      id: endId,
      type: 'workflowNode',
      position: { x: 380, y: 80 },
      data: {
        nodeType: 'end',
        label: 'Bitis',
        description: '',
        assigneeRole: '',
        estimatedDurationHours: 0,
        locked: false,
      },
    },
  ];

  const edges: Edge[] = [
    {
      id: edgeId,
      source: startId,
      target: endId,
      sourceHandle: 'right',
      targetHandle: 'left',
      type: 'smoothstep',
      animated: true,
    },
  ];

  return { nodes, edges };
}

// Session cache lives outside the store to survive resets
const sessionCacheMap = new Map<string, SessionData>();

const initialState = {
  nodes: [] as Node[],
  edges: [] as Edge[],
  selectedNodeId: null as string | null,
  isDirty: false,
  templateName: '',
  templateDescription: '',
  serviceCategory: 'other',
  defaultEstimatedDays: 7,
  parentTemplateId: null as string | null,
  parentNodeId: null as string | null,
  depth: 0,
  recurringConfig: null as RecurringConfig | null,
  workflowType: 'on_demand' as WorkflowType,
  _history: [] as Snapshot[],
  _historyIndex: -1,
  clipboard: null as ClipboardData | null,
  _sessionCache: sessionCacheMap,
};

export const useWorkflowBuilderStore = create<WorkflowBuilderState>((set, get) => ({
  ...initialState,

  // ── Internal: save snapshot after mutation ────────────────
  _saveSnapshot: () => {
    const { nodes, edges, _history, _historyIndex } = get();
    const trimmed = _history.slice(0, _historyIndex + 1);
    const entry: Snapshot = { nodes: deepClone(nodes), edges: deepClone(edges) };
    const next = [...trimmed, entry].slice(-MAX_HISTORY);
    set({ _history: next, _historyIndex: next.length - 1 });
  },

  // ── Session cache — persist state across parent/child navigation ──
  saveSession: (templateId: string) => {
    const s = get();
    sessionCacheMap.set(templateId, {
      nodes: deepClone(s.nodes),
      edges: deepClone(s.edges),
      isDirty: s.isDirty,
      templateName: s.templateName,
      templateDescription: s.templateDescription,
      serviceCategory: s.serviceCategory,
      defaultEstimatedDays: s.defaultEstimatedDays,
      parentTemplateId: s.parentTemplateId,
      parentNodeId: s.parentNodeId,
      depth: s.depth,
      recurringConfig: s.recurringConfig ? deepClone(s.recurringConfig) : null,
      workflowType: s.workflowType,
      _history: deepClone(s._history),
      _historyIndex: s._historyIndex,
    });
  },

  restoreSession: (templateId: string) => {
    const cached = sessionCacheMap.get(templateId);
    if (!cached) return false;
    set({
      nodes: deepClone(cached.nodes),
      edges: deepClone(cached.edges),
      isDirty: cached.isDirty,
      templateName: cached.templateName,
      templateDescription: cached.templateDescription,
      serviceCategory: cached.serviceCategory,
      defaultEstimatedDays: cached.defaultEstimatedDays,
      parentTemplateId: cached.parentTemplateId,
      parentNodeId: cached.parentNodeId,
      depth: cached.depth,
      recurringConfig: cached.recurringConfig ? deepClone(cached.recurringConfig) : null,
      workflowType: cached.workflowType || 'on_demand',
      _history: deepClone(cached._history),
      _historyIndex: cached._historyIndex,
      selectedNodeId: null,
    });
    return true;
  },

  clearSession: (templateId: string) => {
    sessionCacheMap.delete(templateId);
  },

  setNodes: (nodes) => set({ nodes, isDirty: true }),

  setEdges: (edges) => set({ edges, isDirty: true }),

  onNodesChange: (changes) => {
    const state = get();
    const prevNodes = state.nodes;

    // Block position changes on locked nodes
    const filteredChanges = changes.filter((c) => {
      if (c.type === 'position') {
        const node = prevNodes.find((n) => n.id === c.id);
        if (node?.data?.locked) return false;
      }
      return true;
    });

    // Detect drag end for history snapshot
    const dragEnded = filteredChanges.some(
      (c) =>
        c.type === 'position' &&
        c.dragging === false &&
        prevNodes.find((n) => n.id === c.id && n.dragging)
    );

    const finalNodes = applyNodeChanges(filteredChanges, prevNodes);
    set({ nodes: finalNodes, isDirty: true });

    if (dragEnded) {
      get()._saveSnapshot();
    }
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
        { ...connection, type: 'smoothstep', animated: true },
        get().edges
      ),
      isDirty: true,
    });
    get()._saveSnapshot();
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
        reviewConfig: type === 'review' ? { reviewerRole: 'admin', maxRejections: 3 } : undefined,
        conditionConfig:
          type === 'condition' ? { field: '', operator: 'equals', value: '' } : undefined,
        notificationConfig:
          type === 'notification'
            ? { recipients: ['assignee'], template: '', channel: ['in_app'] }
            : undefined,
        subprocessConfig:
          type === 'subprocess' ? { childTemplateId: '', childTemplateName: '' } : undefined,
        agentId: undefined,
        agentName: undefined,
        colorOverride: undefined,
        notes: undefined,
        locked: false,
      },
    };

    set({ nodes: [...get().nodes, newNode], isDirty: true });
    get()._saveSnapshot();
  },

  removeNode: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (node?.data?.locked) return;

    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
      isDirty: true,
    });
    get()._saveSnapshot();
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
      isDirty: true,
    });
    get()._saveSnapshot();
  },

  setTemplateInfo: (info) => {
    set({
      ...(info.name !== undefined && { templateName: info.name }),
      ...(info.description !== undefined && { templateDescription: info.description }),
      ...(info.serviceCategory !== undefined && { serviceCategory: info.serviceCategory }),
      ...(info.defaultEstimatedDays !== undefined && {
        defaultEstimatedDays: info.defaultEstimatedDays,
      }),
      ...(info.recurringConfig !== undefined && { recurringConfig: info.recurringConfig }),
      ...(info.workflowType !== undefined && { workflowType: info.workflowType }),
      isDirty: true,
    });
  },

  reset: () => {
    const seed = createSeedNodesAndEdges();
    const snap: Snapshot = { nodes: deepClone(seed.nodes), edges: deepClone(seed.edges) };
    set({
      ...initialState,
      nodes: seed.nodes,
      edges: seed.edges,
      _history: [snap],
      _historyIndex: 0,
    });
  },

  loadFromTemplate: (template) => {
    let nodes: Node[];
    let edges: Edge[];

    if (!template.nodes || template.nodes.length === 0) {
      // Seed empty templates with Start + End
      const seed = createSeedNodesAndEdges();
      nodes = seed.nodes;
      edges = seed.edges;
    } else {
      nodes = template.nodes.map((n) => ({
        id: n.id,
        type: 'workflowNode',
        position: n.position || { x: 0, y: 0 },
        data: {
          nodeType: n.type || (n as any).nodeType || 'task',
          label: n.label || (n as any).name || (n as any).title || 'Adsiz Adim',
          description: n.description || '',
          assigneeRole: n.assigneeRole || '',
          estimatedDurationHours: n.estimatedDurationHours || 0,
          agentId: n.agentId || undefined,
          agentName: n.agentName || undefined,
          reviewConfig: n.reviewConfig,
          conditionConfig: n.conditionConfig,
          notificationConfig: n.notificationConfig,
          subprocessConfig: n.subprocessConfig,
          colorOverride: n.colorOverride || undefined,
          notes: n.notes || undefined,
          locked: n.locked || false,
        },
      }));

      edges = (template.edges || []).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'smoothstep',
        animated: true,
        label: e.label,
        data: { edgeType: e.type, conditionValue: e.conditionValue },
      }));
    }

    const initialSnapshot: Snapshot = { nodes: deepClone(nodes), edges: deepClone(edges) };

    set({
      nodes,
      edges,
      selectedNodeId: null,
      isDirty: false,
      templateName: template.name,
      templateDescription: template.description,
      serviceCategory: template.serviceCategory,
      defaultEstimatedDays: template.defaultEstimatedDays,
      parentTemplateId: template.parentTemplateId || null,
      parentNodeId: template.parentNodeId || null,
      depth: template.depth || 0,
      recurringConfig: template.recurringConfig || null,
      workflowType: template.workflowType || 'on_demand',
      _history: [initialSnapshot],
      _historyIndex: 0,
    });
  },

  // ── Undo / Redo ──────────────────────────────────────────
  undo: () => {
    const { _history, _historyIndex } = get();
    if (_historyIndex <= 0) return;
    const entry = _history[_historyIndex - 1];
    set({
      nodes: deepClone(entry.nodes),
      edges: deepClone(entry.edges),
      _historyIndex: _historyIndex - 1,
      isDirty: true,
    });
  },

  redo: () => {
    const { _history, _historyIndex } = get();
    if (_historyIndex >= _history.length - 1) return;
    const entry = _history[_historyIndex + 1];
    set({
      nodes: deepClone(entry.nodes),
      edges: deepClone(entry.edges),
      _historyIndex: _historyIndex + 1,
      isDirty: true,
    });
  },

  canUndo: () => get()._historyIndex > 0,
  canRedo: () => {
    const { _history, _historyIndex } = get();
    return _historyIndex < _history.length - 1;
  },

  // ── Clipboard ────────────────────────────────────────────
  copySelectedNodes: () => {
    const { nodes, edges } = get();
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;

    const selectedIds = new Set(selected.map((n) => n.id));
    const relevantEdges = edges.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
    );

    set({
      clipboard: {
        nodes: deepClone(selected),
        edges: deepClone(relevantEdges),
      },
    });
  },

  pasteNodes: (position) => {
    const { clipboard, nodes, edges } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;

    // Centroid of clipboard nodes
    const cx = clipboard.nodes.reduce((s, n) => s + n.position.x, 0) / clipboard.nodes.length;
    const cy = clipboard.nodes.reduce((s, n) => s + n.position.y, 0) / clipboard.nodes.length;

    // Old → new ID mapping
    const idMap = new Map<string, string>();
    const now = Date.now();
    clipboard.nodes.forEach((n, i) => idMap.set(n.id, `node-${now}-${i}`));

    const newNodes: Node[] = clipboard.nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      position: { x: position.x + (n.position.x - cx), y: position.y + (n.position.y - cy) },
      selected: true,
      data: { ...n.data, locked: false },
    }));

    const newEdges: Edge[] = clipboard.edges.map((e, i) => ({
      ...e,
      id: `edge-${now}-${i}`,
      source: idMap.get(e.source) || e.source,
      target: idMap.get(e.target) || e.target,
    }));

    const deselected = nodes.map((n) => ({ ...n, selected: false }));

    set({
      nodes: [...deselected, ...newNodes],
      edges: [...edges, ...newEdges],
      isDirty: true,
    });
    get()._saveSnapshot();
  },

  duplicateSelectedNodes: () => {
    const state = get();
    state.copySelectedNodes();
    const selected = state.nodes.filter((n) => n.selected);
    if (selected.length === 0) return;

    const cx = selected.reduce((s, n) => s + n.position.x, 0) / selected.length;
    const cy = selected.reduce((s, n) => s + n.position.y, 0) / selected.length;
    get().pasteNodes({ x: cx + 40, y: cy + 40 });
  },

  // ── Selection helpers ────────────────────────────────────
  selectAllNodes: () => {
    set({ nodes: get().nodes.map((n) => ({ ...n, selected: true })) });
  },

  getSelectedNodes: () => get().nodes.filter((n) => n.selected),

  removeSelectedNodes: () => {
    const { nodes, edges } = get();
    const toRemove = nodes.filter((n) => n.selected && !n.data?.locked);
    if (toRemove.length === 0) return;

    const removeIds = new Set(toRemove.map((n) => n.id));
    set({
      nodes: nodes.filter((n) => !removeIds.has(n.id)),
      edges: edges.filter((e) => !removeIds.has(e.source) && !removeIds.has(e.target)),
      selectedNodeId: null,
      isDirty: true,
    });
    get()._saveSnapshot();
  },

  // ── Edge operations ──────────────────────────────────────
  removeEdge: (id) => {
    set({
      edges: get().edges.filter((e) => e.id !== id),
      isDirty: true,
    });
    get()._saveSnapshot();
  },

  removeSelectedElements: () => {
    const { nodes, edges } = get();
    const nodesToRemove = nodes.filter((n) => n.selected && !n.data?.locked);
    const edgesToRemove = edges.filter((e) => e.selected);

    if (nodesToRemove.length === 0 && edgesToRemove.length === 0) return;

    const removeNodeIds = new Set(nodesToRemove.map((n) => n.id));
    const removeEdgeIds = new Set(edgesToRemove.map((e) => e.id));

    set({
      nodes: nodes.filter((n) => !removeNodeIds.has(n.id)),
      edges: edges.filter(
        (e) =>
          !removeEdgeIds.has(e.id) &&
          !removeNodeIds.has(e.source) &&
          !removeNodeIds.has(e.target)
      ),
      selectedNodeId: null,
      isDirty: true,
    });
    get()._saveSnapshot();
  },

  // ── Auto-layout — serpentine (yılan) düzen ──────────────
  // Soldan sağa, her 3 düğümde alt satıra, çift satırlar sağdan sola
  autoLayout: async () => {
    const { nodes, edges } = get();
    if (nodes.length === 0) return;

    const COLS = 3;
    const X_GAP = 280;
    const Y_GAP = 150;
    const X_START = 100;
    const Y_START = 80;
    const X_POSITIONS = [X_START, X_START + X_GAP, X_START + X_GAP * 2]; // 100, 380, 660

    const lockedIds = new Set(nodes.filter((n) => n.data?.locked).map((n) => n.id));

    // Topological sort using edges to determine order
    const nodeIds = nodes.map((n) => n.id);
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    nodeIds.forEach((id) => { adjacency.set(id, []); inDegree.set(id, 0); });
    edges.forEach((e) => {
      if (adjacency.has(e.source) && inDegree.has(e.target)) {
        adjacency.get(e.source)!.push(e.target);
        inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
      }
    });

    const sorted: string[] = [];
    const queue = nodeIds.filter((id) => (inDegree.get(id) || 0) === 0);
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      for (const next of adjacency.get(current) || []) {
        const deg = (inDegree.get(next) || 1) - 1;
        inDegree.set(next, deg);
        if (deg === 0) queue.push(next);
      }
    }
    // Add any remaining nodes not in sorted (disconnected)
    nodeIds.forEach((id) => { if (!sorted.includes(id)) sorted.push(id); });

    // Assign positions
    const posMap = new Map<string, { x: number; y: number }>();
    sorted.forEach((id, i) => {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const isEvenRow = row % 2 === 0;
      const x = isEvenRow ? X_POSITIONS[col] : X_POSITIONS[COLS - 1 - col];
      const y = Y_START + row * Y_GAP;
      posMap.set(id, { x, y });
    });

    // Update edge handles for serpentine flow
    const newEdges = edges.map((e) => {
      const srcIdx = sorted.indexOf(e.source);
      const tgtIdx = sorted.indexOf(e.target);
      if (srcIdx === -1 || tgtIdx === -1) return e;

      const srcRow = Math.floor(srcIdx / COLS);
      const tgtRow = Math.floor(tgtIdx / COLS);

      let sourceHandle = 'right';
      let targetHandle = 'left';

      if (srcRow !== tgtRow) {
        // Row transition — go down
        sourceHandle = 'bottom';
        targetHandle = 'top';
      } else if (srcRow % 2 === 0) {
        // Even row — left to right
        sourceHandle = 'right';
        targetHandle = 'left';
      } else {
        // Odd row — right to left
        sourceHandle = 'left';
        targetHandle = 'right';
      }

      return { ...e, sourceHandle, targetHandle };
    });

    set({
      nodes: nodes.map((n) => {
        if (lockedIds.has(n.id)) return n;
        const pos = posMap.get(n.id);
        return pos ? { ...n, position: pos } : n;
      }),
      edges: newEdges,
      isDirty: true,
    });
    get()._saveSnapshot();
  },

  // ── AI Chat integration ───────────────────────────────────
  getCanvasSnapshot: (): CanvasSnapshot => {
    const { nodes, edges } = get();
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.data?.nodeType as string) || 'task',
        label: (n.data?.label as string) || '',
        description: (n.data?.description as string) || undefined,
        position: { x: n.position.x, y: n.position.y },
        assigneeRole: (n.data?.assigneeRole as string) || undefined,
        estimatedDurationHours: (n.data?.estimatedDurationHours as number) || undefined,
        colorOverride: (n.data?.colorOverride as string) || undefined,
        notes: (n.data?.notes as string) || undefined,
        locked: (n.data?.locked as boolean) || undefined,
        subprocessConfig: (n.data?.subprocessConfig as CanvasSnapshot['nodes'][0]['subprocessConfig']) || undefined,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: (e.data?.edgeType as string) || 'default',
        label: (e.label as string) || undefined,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
      })),
    };
  },

  applyAICanvasState: (snapshot: CanvasSnapshot) => {
    const newNodes: Node[] = snapshot.nodes.map((n) => ({
      id: n.id,
      type: 'workflowNode',
      position: n.position,
      data: {
        nodeType: n.type,
        label: n.label,
        description: n.description || '',
        assigneeRole: n.assigneeRole || '',
        estimatedDurationHours: n.estimatedDurationHours || 0,
        colorOverride: n.colorOverride || undefined,
        notes: n.notes || undefined,
        locked: n.locked || false,
        subprocessConfig: n.subprocessConfig || undefined,
      },
    }));
    const newEdges: Edge[] = snapshot.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || 'bottom',
      targetHandle: e.targetHandle || 'top',
      type: 'smoothstep',
      animated: true,
      label: e.label || undefined,
      data: { edgeType: e.type || 'default' },
    }));
    set({ nodes: newNodes, edges: newEdges, isDirty: true });
    get()._saveSnapshot();
  },
}));
