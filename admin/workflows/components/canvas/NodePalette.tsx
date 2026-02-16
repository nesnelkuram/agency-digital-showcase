import React from 'react';
import {
  Play,
  ClipboardList,
  Bot,
  Eye,
  CheckCircle,
  Flag,
  GitBranch,
  Bell,
  Square,
} from 'lucide-react';

interface PaletteItem {
  type: string;
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
}

const paletteItems: PaletteItem[] = [
  { type: 'start', label: 'Baslangic', icon: Play, bg: 'bg-green-100', text: 'text-green-700' },
  { type: 'task', label: 'Gorev', icon: ClipboardList, bg: 'bg-blue-100', text: 'text-blue-700' },
  { type: 'ai_task', label: 'AI Gorev', icon: Bot, bg: 'bg-violet-100', text: 'text-violet-700' },
  { type: 'review', label: 'Review', icon: Eye, bg: 'bg-amber-100', text: 'text-amber-700' },
  { type: 'approval', label: 'Onay', icon: CheckCircle, bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { type: 'milestone', label: 'Milestone', icon: Flag, bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { type: 'condition', label: 'Kosul', icon: GitBranch, bg: 'bg-orange-100', text: 'text-orange-700' },
  { type: 'notification', label: 'Bildirim', icon: Bell, bg: 'bg-pink-100', text: 'text-pink-700' },
  { type: 'end', label: 'Bitis', icon: Square, bg: 'bg-red-100', text: 'text-red-700' },
];

const NodePalette: React.FC = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-[200px] border-r border-neutral-200 bg-neutral-50 p-3 overflow-y-auto">
      <h3 className="font-commons text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
        Dugum Tipleri
      </h3>
      <div className="space-y-1.5">
        {paletteItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type)}
              className={`
                flex items-center gap-2 px-2.5 py-2 rounded-lg
                ${item.bg} ${item.text}
                font-commons text-xs font-medium
                cursor-grab active:cursor-grabbing
                hover:opacity-80 transition-opacity
                select-none
              `}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-neutral-200">
        <p className="font-commons text-[10px] text-neutral-400 leading-relaxed">
          Dugum tiplerini surukleyerek canvas uzerine birakin.
        </p>
      </div>
    </div>
  );
};

export default NodePalette;
