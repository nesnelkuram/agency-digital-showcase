import React, { useEffect, useRef } from 'react';
import { PALETTE_ITEMS } from './nodeConstants';
import { useWorkflowBuilderStore } from '../../store/workflowBuilderStore';

interface Props {
  screenPos: { x: number; y: number };
  flowPos: { x: number; y: number };
  onClose: () => void;
}

const QuickNodeSelector: React.FC<Props> = ({ screenPos, flowPos, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const addNode = useWorkflowBuilderStore((s) => s.addNode);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose();
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
  }, [onClose]);

  const handleSelect = (type: string) => {
    addNode(type, flowPos);
    onClose();
  };

  // Clamp position so popup stays in viewport
  const left = Math.min(screenPos.x, window.innerWidth - 340);
  const top = Math.min(screenPos.y, window.innerHeight - 280);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-xl border border-neutral-200 shadow-xl p-3"
      style={{ left, top }}
    >
      <p className="font-commons text-[10px] text-neutral-400 uppercase tracking-wider mb-2">
        Dugum Tipi Sec
      </p>
      <div className="grid grid-cols-2 gap-1.5" style={{ width: 300 }}>
        {PALETTE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              onClick={() => handleSelect(item.type)}
              className={`
                flex items-center gap-2 px-2.5 py-2 rounded-lg
                ${item.bg} ${item.text}
                font-commons text-xs font-medium
                hover:opacity-80 transition-opacity text-left
              `}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickNodeSelector;
