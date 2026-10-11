import { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * Slot bağlam menüsü (sağ tık, üç nokta düğmesi ve klavye). role="menu"; Yukarı/Aşağı/Home/End gezinir,
 * Enter/Boşluk seçer, Escape ve Tab kapatır ve odağı tetikleyiciye döndürür. Dokunmatikte üç nokta düğmesi yeter.
 */
export function SlotMenu({ items, label, onClose }: { items: MenuItem[]; label: string; onClose: () => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const first = refs.current.findIndex((b) => b && !b.disabled);
    refs.current[first >= 0 ? first : 0]?.focus();
  }, []);
  const move = (from: number, dir: 1 | -1) => {
    for (let k = 1; k <= items.length; k++) {
      const j = (from + dir * k + items.length * 2) % items.length;
      if (!items[j].disabled) {
        refs.current[j]?.focus();
        return;
      }
    }
  };
  return (
    <div
      className="menu"
      role="menu"
      aria-label={label}
      onKeyDown={(e) => {
        const i = refs.current.findIndex((b) => b === document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
        else if (e.key === 'Tab') onClose();
        else if (e.key === 'ArrowDown') { e.preventDefault(); move(i, 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(i, -1); }
        else if (e.key === 'Home') { e.preventDefault(); move(-1, 1); }
        else if (e.key === 'End') { e.preventDefault(); move(items.length, -1); }
      }}
    >
      {items.map((it, k) => (
        <button
          key={it.label}
          role="menuitem"
          ref={(el) => { refs.current[k] = el; }}
          disabled={it.disabled}
          onClick={() => { onClose(); it.onSelect(); }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
