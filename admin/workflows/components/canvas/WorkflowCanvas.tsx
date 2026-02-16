import React, { useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import WorkflowNode from './WorkflowNode';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';

const nodeTypes = {
  workflowNode: WorkflowNode,
};

const minimapNodeColor = (node: any) => {
  const colorMap: Record<string, string> = {
    start: '#22c55e',
    task: '#3b82f6',
    ai_task: '#8b5cf6',
    review: '#f59e0b',
    approval: '#10b981',
    milestone: '#6366f1',
    condition: '#f97316',
    notification: '#ec4899',
    end: '#ef4444',
  };
  return colorMap[node.data?.nodeType] || '#a3a3a3';
};

function WorkflowCanvasInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    addNode,
  } = useWorkflowBuilderStore();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, position);
    },
    [screenToFlowPosition, addNode]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
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
              Dugumleri surukle-birak ile ekleyin, baglantilari cekerek olusturun
            </span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

const WorkflowCanvas: React.FC = () => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
};

export default WorkflowCanvas;
