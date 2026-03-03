import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import WorkflowNode from './WorkflowNode';
import QuickNodeSelector from './QuickNodeSelector';
import CanvasContextMenu from './CanvasContextMenu';
import NodeHoverToolbar from './NodeHoverToolbar';
// WorkflowTreePanel moved to NodePalette breadcrumb
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';

const nodeTypes = {
  workflowNode: WorkflowNode,
};

const minimapNodeColor = (node: any) => {
  if (node.data?.colorOverride) return node.data.colorOverride;
  const colorMap: Record<string, string> = {
    start: '#22c55e',
    task: '#3b82f6',
    ai_task: '#8b5cf6',
    review: '#f59e0b',
    approval: '#10b981',
    milestone: '#6366f1',
    condition: '#f97316',
    notification: '#ec4899',
    subprocess: '#06b6d4',
    end: '#ef4444',
  };
  return colorMap[node.data?.nodeType] || '#a3a3a3';
};

interface WorkflowCanvasProps {
  onSubprocessNavigate?: (nodeId: string) => void;
}

function WorkflowCanvasInner({ onSubprocessNavigate }: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    addNode,
    removeSelectedElements,
    copySelectedNodes,
    pasteNodes,
    duplicateSelectedNodes,
    selectAllNodes,
    undo,
    redo,
  } = useWorkflowBuilderStore();

  // ── Quick Node Selector (double-click) ──
  const [quickSelectorPos, setQuickSelectorPos] = useState<{
    screen: { x: number; y: number };
    flow: { x: number; y: number };
  } | null>(null);

  // ── Context Menu (right-click) ──
  const [contextMenu, setContextMenu] = useState<{
    screen: { x: number; y: number };
    flow: { x: number; y: number };
    nodeId: string | null;
    edgeId?: string | null;
  } | null>(null);

  // ── Hover Toolbar ──
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoverScreenPos, setHoverScreenPos] = useState<{ x: number; y: number } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);

  // ── Double-click detection for pane ──
  const lastPaneClickRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type, position);
    },
    [screenToFlowPosition, addNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      // Subprocess: skip config panel on single click — double-click navigates, right-click → Duzenle for config
      if (node.data?.nodeType === 'subprocess') return;
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      setSelectedNodeId(null);
      setContextMenu(null);

      // Double-click detection
      const now = Date.now();
      const last = lastPaneClickRef.current;
      const dx = Math.abs(event.clientX - last.x);
      const dy = Math.abs(event.clientY - last.y);

      if (now - last.time < 300 && dx < 10 && dy < 10) {
        // Double click — open quick selector
        const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        setQuickSelectorPos({
          screen: { x: event.clientX, y: event.clientY },
          flow: flowPos,
        });
        lastPaneClickRef.current = { time: 0, x: 0, y: 0 };
      } else {
        lastPaneClickRef.current = { time: now, x: event.clientX, y: event.clientY };
        setQuickSelectorPos(null);
      }
    },
    [setSelectedNodeId, screenToFlowPosition]
  );

  // ── Double-click: node (subprocess → navigate) ──
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      if (node.data?.nodeType === 'subprocess' && onSubprocessNavigate) {
        onSubprocessNavigate(node.id);
      }
      // Other node types: label edit is handled inside WorkflowNode
    },
    [onSubprocessNavigate]
  );

  // ── Right-click: canvas ──
  const handleWrapperContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setQuickSelectorPos(null);
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setContextMenu({
        screen: { x: event.clientX, y: event.clientY },
        flow: flowPos,
        nodeId: null,
      });
    },
    [screenToFlowPosition]
  );

  // ── Right-click: node ──
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: any) => {
      event.preventDefault();
      event.stopPropagation();
      setQuickSelectorPos(null);
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setContextMenu({
        screen: { x: event.clientX, y: event.clientY },
        flow: flowPos,
        nodeId: node.id,
      });
    },
    [screenToFlowPosition]
  );

  // ── Right-click: edge ──
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: any) => {
      event.preventDefault();
      event.stopPropagation();
      setQuickSelectorPos(null);
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setContextMenu({
        screen: { x: event.clientX, y: event.clientY },
        flow: flowPos,
        nodeId: null,
        edgeId: edge.id,
      });
    },
    [screenToFlowPosition]
  );

  // Open context menu for a specific node (from hover toolbar "more" button)
  const openNodeContextMenu = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || !hoverScreenPos) return;
      setContextMenu({
        screen: hoverScreenPos,
        flow: node.position,
        nodeId,
      });
    },
    [nodes, hoverScreenPos]
  );

  // ── Hover events ──
  const onNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: any) => {
      if (isDragging.current) return;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        if (isDragging.current) return;
        setHoveredNodeId(node.id);
        // Calculate screen position of node's center-top
        const screenPos = flowToScreenPosition({
          x: node.position.x + 90, // approx half node width
          y: node.position.y,
        });
        setHoverScreenPos(screenPos);
      }, 200);
    },
    [flowToScreenPosition]
  );

  const onNodeMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    // Small delay before hiding so user can reach the toolbar
    hoverTimerRef.current = setTimeout(() => {
      setHoveredNodeId(null);
      setHoverScreenPos(null);
    }, 300);
  }, []);

  const onNodeDragStart = useCallback(() => {
    isDragging.current = true;
    setHoveredNodeId(null);
    setHoverScreenPos(null);
  }, []);

  const onNodeDragStop = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      // Skip if user is typing in an input
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) return;

      const mod = e.metaKey || e.ctrlKey;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeSelectedElements();
        return;
      }

      if (mod && e.key === 'c') {
        e.preventDefault();
        copySelectedNodes();
        return;
      }

      if (mod && e.key === 'v') {
        e.preventDefault();
        // Paste at viewport center
        const wrapper = reactFlowWrapper.current;
        if (wrapper) {
          const rect = wrapper.getBoundingClientRect();
          const center = screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
          pasteNodes(center);
        }
        return;
      }

      if (mod && e.key === 'd') {
        e.preventDefault();
        duplicateSelectedNodes();
        return;
      }

      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if ((mod && e.shiftKey && e.key === 'z') || (mod && e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }

      if (mod && e.key === 'a') {
        e.preventDefault();
        selectAllNodes();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [removeSelectedElements, copySelectedNodes, pasteNodes, duplicateSelectedNodes, undo, redo, selectAllNodes, screenToFlowPosition]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full relative" onContextMenu={handleWrapperContextMenu}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        selectionOnDrag
        multiSelectionKeyCode="Shift"
        deleteKeyCode={null}
        edgesFocusable
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{ type: 'smoothstep', animated: true }}
        proOptions={{ hideAttribution: true }}
        className="bg-neutral-50/50"
      >
        <Background gap={16} size={1} color="#e5e5e5" />
        <Controls
          showInteractive={false}
          className="!bg-white !border-neutral-200 !shadow-sm !rounded-lg"
        />
        <MiniMap
          nodeColor={minimapNodeColor}
          nodeStrokeWidth={2}
          zoomable
          pannable
          className="!bg-white !border-neutral-200 !shadow-sm !rounded-lg"
          style={{ width: 140, height: 100 }}
        />
        <Panel position="top-center">
          <div className="bg-white/80 backdrop-blur-sm border border-neutral-200 rounded-lg px-3 py-1.5 shadow-sm">
            <span className="font-commons text-[10px] text-neutral-400">
              Cift tikla: dugum ekle &middot; Sag tik: menu &middot; Ctrl+Z: geri al
            </span>
          </div>
        </Panel>
      </ReactFlow>

      {/* Overlays */}
      {quickSelectorPos && (
        <QuickNodeSelector
          screenPos={quickSelectorPos.screen}
          flowPos={quickSelectorPos.flow}
          onClose={() => setQuickSelectorPos(null)}
        />
      )}

      {contextMenu && (
        <CanvasContextMenu
          screenPos={contextMenu.screen}
          flowPos={contextMenu.flow}
          nodeId={contextMenu.nodeId}
          edgeId={contextMenu.edgeId || null}
          onClose={() => setContextMenu(null)}
          onEditNode={(id) => setSelectedNodeId(id)}
          onSubprocessNavigate={onSubprocessNavigate}
        />
      )}

      {hoveredNodeId && hoverScreenPos && !contextMenu && !quickSelectorPos && (
        <NodeHoverToolbar
          nodeId={hoveredNodeId}
          screenPos={hoverScreenPos}
          onContextMenu={openNodeContextMenu}
        />
      )}
    </div>
  );
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ onSubprocessNavigate }) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner onSubprocessNavigate={onSubprocessNavigate} />
    </ReactFlowProvider>
  );
};

export default WorkflowCanvas;
