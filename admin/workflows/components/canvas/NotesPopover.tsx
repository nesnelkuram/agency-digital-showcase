import React, { useEffect, useRef, useState } from 'react';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';

interface Props {
  nodeId: string;
  screenPos: { x: number; y: number };
  onClose: () => void;
}

const NotesPopover: React.FC<Props> = ({ nodeId, screenPos, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const updateNodeData = useWorkflowBuilderStore((s) => s.updateNodeData);
  const currentNotes = useWorkflowBuilderStore(
    (s) => (s.nodes.find((n) => n.id === nodeId)?.data?.notes as string) || ''
  );

  const [value, setValue] = useState(currentNotes);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        handleSave();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose, value]);

  const handleSave = () => {
    const trimmed = value.trim();
    updateNodeData(nodeId, { notes: trimmed || undefined });
    onClose();
  };

  const left = Math.min(screenPos.x, window.innerWidth - 260);
  const top = Math.min(screenPos.y, window.innerHeight - 180);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-xl border border-neutral-200 shadow-xl p-3"
      style={{ left, top, width: 240 }}
    >
      <p className="font-commons text-[10px] text-neutral-400 uppercase tracking-wider mb-2">
        Not
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        autoFocus
        className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 bg-white font-commons text-xs focus:outline-none focus:border-indigo-400 transition-colors resize-none"
        placeholder="Not ekle..."
        onKeyDown={(e) => e.stopPropagation()}
      />
      <button
        onClick={handleSave}
        className="mt-2 w-full px-3 py-1.5 bg-indigo-600 text-white rounded-lg font-commons text-xs font-medium hover:bg-indigo-700 transition-colors"
      >
        Kaydet
      </button>
    </div>
  );
};

export default NotesPopover;
