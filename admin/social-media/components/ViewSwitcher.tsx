import React from 'react';
import { List, Calendar as CalendarIcon, Grid3x3 } from 'lucide-react';

export type SocialMediaViewMode = 'list' | 'calendar' | 'grid';

interface ViewSwitcherProps {
  value: SocialMediaViewMode;
  onChange: (value: SocialMediaViewMode) => void;
}

const OPTIONS: Array<{
  value: SocialMediaViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'list', label: 'Liste', icon: List },
  { value: 'calendar', label: 'Takvim', icon: CalendarIcon },
  { value: 'grid', label: 'Grid', icon: Grid3x3 },
];

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ value, onChange }) => {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-full">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-grotesk text-xs font-medium transition-colors ${
              active
                ? 'bg-white text-[#171717] shadow-sm'
                : 'text-neutral-500 hover:text-[#171717]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default ViewSwitcher;
