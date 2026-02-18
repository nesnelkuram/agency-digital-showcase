import React from 'react';
import { Wand2 } from 'lucide-react';
import type { PostType } from '@/shared/types/socialMedia';
import { POST_TYPE_LABELS, POST_TYPE_COLORS } from '@/shared/types/socialMedia';

interface PostTypeDropdownProps {
  value: PostType;
  onChange: (type: PostType) => void;
  availableTypes: PostType[];
  autoDetected: boolean;
}

const PostTypeDropdown: React.FC<PostTypeDropdownProps> = ({
  value,
  onChange,
  availableTypes,
  autoDetected,
}) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-grotesk font-medium ${POST_TYPE_COLORS[value]}`}
        >
          {POST_TYPE_LABELS[value]}
        </span>
        {autoDetected && (
          <span className="inline-flex items-center gap-1 text-[10px] font-grotesk text-neutral-400">
            <Wand2 className="w-3 h-3" />
            Otomatik
          </span>
        )}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PostType)}
        className="text-xs font-grotesk text-neutral-500 bg-transparent border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#171717]/20 cursor-pointer"
      >
        {availableTypes.map((type) => (
          <option key={type} value={type}>
            {POST_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PostTypeDropdown;
