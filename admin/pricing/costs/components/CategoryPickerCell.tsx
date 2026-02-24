import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Tag } from 'lucide-react';
import type { ServiceCategory } from '@/shared/types/pricing';
import { SERVICE_CATEGORY_LABELS } from '@/shared/types/pricing';

interface CategoryPickerCellProps {
  value: ServiceCategory[] | null | undefined;
  onChange: (cats: ServiceCategory[] | null) => void;
}

const CategoryPickerCell: React.FC<CategoryPickerCellProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value || [];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const toggle = (cat: ServiceCategory) => {
    const next = selected.includes(cat)
      ? selected.filter((c) => c !== cat)
      : [...selected, cat];
    onChange(next.length === 0 ? null : next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-commons font-medium transition-colors ${
          selected.length === 0
            ? 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
            : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
        }`}
      >
        <Tag className="w-3 h-3 flex-shrink-0" />
        {selected.length === 0 ? (
          <span>Tümü</span>
        ) : (
          <span>{selected.length} kategori</span>
        )}
        <ChevronDown className="w-3 h-3 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-7 left-0 w-60 bg-white rounded-xl shadow-xl border border-neutral-200 p-2 max-h-72 overflow-y-auto">
          {(Object.entries(SERVICE_CATEGORY_LABELS) as [ServiceCategory, string][]).map(
            ([cat, label]) => (
              <label
                key={cat}
                className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-indigo-50 rounded-lg text-xs font-commons text-[#171717]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(cat)}
                  onChange={() => toggle(cat)}
                  className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 flex-shrink-0"
                />
                {label}
              </label>
            )
          )}
          {selected.length > 0 && (
            <button
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="w-full mt-1 px-2 py-1 text-xs font-commons text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              Tümünü Temizle
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CategoryPickerCell;
