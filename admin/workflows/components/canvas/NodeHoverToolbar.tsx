import React from 'react';
import { Trash2, Copy, MoreHorizontal } from 'lucide-react';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';

interface Props {
  nodeId: string;
  screenPos: { x: number; y: number };
  onContextMenu: (nodeId: string) => void;
}

const NodeHoverToolbar: React.FC<Props> = ({ nodeId, screenPos, onContextMenu }) => {
  const removeNode = useWorkflowBuilderStore((s) => s.removeNode);
  const nodes = useWorkflowBuilderStore((s) => s.nodes);

  const node = nodes.find((n) => n.id === nodeId);
  const isLocked = node?.data?.locked;

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Select just this node, copy, paste with offset
    const store = useWorkflowBuilderStore.getState();
    const updatedNodes = store.nodes.map((n) => ({ ...n, selected: n.id === nodeId }));
    store.setNodes(updatedNodes);
    store.copySelectedNodes();
    if (node) {
      store.pasteNodes({ x: node.position.x + 40, y: node.position.y + 40 });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLocked) removeNode(nodeId);
  };

  const handleMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    onContextMenu(nodeId);
  };

  return (
    <div
      className="fixed z-40 flex items-center gap-0.5 bg-white rounded-lg border border-neutral-200 shadow-md px-1 py-0.5"
      style={{ left: screenPos.x, top: screenPos.y - 36 }}
    >
      <button
        onClick={handleDelete}
        disabled={!!isLocked}
        className="p-1.5 rounded hover:bg-red-50 text-neutral-500 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Sil"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleDuplicate}
        className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 transition-colors"
        title="Cogalt"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleMore}
        className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 transition-colors"
        title="Daha Fazla"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export default NodeHoverToolbar;
