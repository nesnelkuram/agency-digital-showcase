/**
 * useNowKeyboard — global keyboard shortcuts for the ŞİMDİ view.
 *
 *   Space  → onStart
 *   Enter  → onDone
 *   Escape → onSkip
 *   N      → onAdd (open quick add)
 *
 * Disabled when `disabled` is true (e.g. a modal is open or an input is focused).
 * Also auto-ignores key events that originate from form fields.
 */
import { useEffect } from 'react';

interface UseNowKeyboardOptions {
  onStart: () => void;
  onDone: () => void;
  onSkip: () => void;
  onAdd?: () => void;
  disabled?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useNowKeyboard({
  onStart,
  onDone,
  onSkip,
  onAdd,
  disabled = false,
}: UseNowKeyboardOptions): void {
  useEffect(() => {
    if (disabled) return;

    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.code === 'Space') {
        e.preventDefault();
        onStart();
      } else if (e.code === 'Enter') {
        e.preventDefault();
        onDone();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.code === 'KeyN' && onAdd) {
        e.preventDefault();
        onAdd();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onStart, onDone, onSkip, onAdd, disabled]);
}
