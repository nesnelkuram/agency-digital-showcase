import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { PRESET_NODE_COLORS } from './nodeConstants';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';

interface Props {
  nodeId: string;
  screenPos: { x: number; y: number };
  onClose: () => void;
}

const ColorPickerPopover: React.FC<Props> = ({ nodeId, screenPos, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const updateNodeData = useWorkflowBuilderStore((s) => s.updateNodeData);
  const currentColor = useWorkflowBuilderStore(
    (s) => s.nodes.find((n) => n.id === nodeId)?.data?.colorOverride as string | undefined
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
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
  }, [onClose]);

  const handleColorSelect = (value: string | null) => {
    updateNodeData(nodeId, { colorOverride: value || undefined });
    onClose();
  };

  const left = Math.min(screenPos.x, window.innerWidth - 220);
  const top = Math.min(screenPos.y, window.innerHeight - 100);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-xl border border-neutral-200 shadow-xl p-3"
      style={{ left, top }}
    >
      <p className="font-commons text-[10px] text-neutral-400 uppercase tracking-wider mb-2">
        Renk Sec
      </p>
      <div className="flex items-center gap-2 flex-wrap" style={{ width: 200 }}>
        {PRESET_NODE_COLORS.map((c) =>
          c.value ? (
            <button
              key={c.value}
              onClick={() => handleColorSelect(c.value)}
              className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                currentColor === c.value ? 'border-neutral-800 scale-110' : 'border-neutral-200'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ) : (
            <button
              key="default"
              onClick={() => handleColorSelect(null)}
              className={`w-7 h-7 rounded-full border-2 border-neutral-200 bg-white flex items-center justify-center transition-transform hover:scale-110 ${
                !currentColor ? 'border-neutral-800 scale-110' : ''
              }`}
              title={c.label}
            >
              <X className="w-3 h-3 text-neutral-400" />
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default ColorPickerPopover;
