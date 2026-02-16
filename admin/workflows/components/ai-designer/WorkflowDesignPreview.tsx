import React, { useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Layers, Clock, GitBranch } from 'lucide-react';
import WorkflowNode from '../canvas/WorkflowNode';
import type { WorkflowDraft } from '@/shared/types/workflowDesign';

const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  video_production: 'Video Produksiyon',
  photography: 'Fotograf Cekimi',
  social_media: 'Sosyal Medya',
  digital_marketing: 'Dijital Pazarlama',
  event_coverage: 'Etkinlik Cekimi',
  brand_strategy: 'Marka Stratejisi',
  graphic_design: 'Grafik Tasarim',
};

interface Props {
  draft: WorkflowDraft | null;
}

const nodeTypes = { default: WorkflowNode };

function PreviewCanvas({ draft }: Props) {
  const { fitView } = useReactFlow();

  const rfNodes = useMemo(() => {
    if (!draft?.nodes) return [];
    return draft.nodes.map((node) => ({
      id: node.id,
      type: 'default',
      position: node.position || { x: 300, y: 0 },
      data: {
        label: node.label,
        nodeType: node.type,
      },
    }));
  }, [draft?.nodes]);

  const rfEdges = useMemo(() => {
    if (!draft?.edges) return [];
    return draft.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: edge.type === 'conditional_true' || edge.type === 'conditional_false',
      label: edge.label || undefined,
      style: {
        stroke:
          edge.type === 'rejection'
            ? '#EF4444'
            : edge.type === 'escalation'
            ? '#F59E0B'
            : '#94A3B8',
        strokeWidth: 2,
      },
    }));
  }, [draft?.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => {
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [rfNodes, rfEdges, setNodes, setEdges]);

  useEffect(() => {
    if (nodes.length > 0) {
      // Small delay to let layout settle
      const timer = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  if (!draft) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-neutral-50/50 rounded-2xl border border-dashed border-neutral-200">
        <GitBranch className="w-12 h-12 text-neutral-300 mb-4" />
        <p className="font-grotesk text-sm text-neutral-400 text-center max-w-xs">
          AI ile sohbet ederek workflow sablonunuz burada gorunecek
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      {/* Header info */}
      <div className="px-5 py-3 border-b border-neutral-100 bg-gradient-to-r from-indigo-50 to-white">
        <h3 className="font-ramillas text-base font-bold text-neutral-800 truncate">
          {draft.name || 'Isimsiz Workflow'}
        </h3>
        <div className="flex items-center gap-3 mt-1 text-xs font-grotesk text-neutral-500">
          <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
            {SERVICE_CATEGORY_LABELS[draft.serviceCategory] || draft.serviceCategory}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {draft.nodes?.length || 0} adim
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ~{draft.defaultEstimatedDays} gun
          </span>
          {draft.phases?.length > 0 && (
            <span>{draft.phases.length} faz</span>
          )}
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          fitView
          minZoom={0.3}
          maxZoom={1.5}
        >
          <Background color="#E5E7EB" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

const WorkflowDesignPreview: React.FC<Props> = (props) => {
  return (
    <ReactFlowProvider>
      <PreviewCanvas {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowDesignPreview;
