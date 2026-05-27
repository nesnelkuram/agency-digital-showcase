import { useRef, useCallback, useEffect, useState } from 'react';
import { DeviceCapability } from './useDeviceCapability';

interface PhoneRegistration {
  id: string;
  /** Y position in world-space (used as centrality proxy in a column grid) */
  worldY: number;
  /** Column index — used to spread active videos across columns */
  column: number;
}

/**
 * Orchestrates which phones are allowed to play video.
 *
 * Algorithm:
 * 1. Each phone registers with its world-space Y position.
 * 2. On every scroll tick the orchestrator scores each phone by
 *    distance from the viewport's vertical center (mapped to world-space).
 * 3. The top N phones (N = capability.maxConcurrentVideos) are marked active.
 * 4. A debounce window prevents rapid toggling during fast scroll.
 */
export function usePlaybackOrchestrator(
  capability: DeviceCapability,
  parallaxOffset: number
) {
  const registry = useRef<Map<string, PhoneRegistration>>(new Map());
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActiveRef = useRef<Set<string>>(new Set());

  const register = useCallback((id: string, worldY: number, column: number) => {
    registry.current.set(id, { id, worldY, column });
  }, []);

  const unregister = useCallback((id: string) => {
    registry.current.delete(id);
  }, []);

  // Recompute active set when parallaxOffset changes
  useEffect(() => {
    if (capability.maxConcurrentVideos === 0) {
      if (lastActiveRef.current.size > 0) {
        lastActiveRef.current = new Set();
        setActiveIds(new Set());
      }
      return;
    }

    // Debounce: wait 150ms after last scroll before switching
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(() => {
      const phones = Array.from(registry.current.values());
      if (phones.length === 0) return;

      // The parallaxOffset (0..120) represents scroll progress.
      // Phones in the viewport center are "closer" to a neutral Y ≈ 0 adjusted by scroll.
      // We score each phone by how far it is from a virtual center that shifts with scroll.
      // Since columns alternate direction, we just use absolute worldY distance from 0
      // (the grid is always centered around Y=0). This is a pragmatic heuristic —
      // phones near center of the grid are most visible regardless of scroll position.

      // Score: lower = more central = higher priority
      const scored = phones.map(p => ({
        ...p,
        score: Math.abs(p.worldY),
      }));

      // Sort by score ascending (most central first)
      scored.sort((a, b) => a.score - b.score);

      // Pick top N, trying to spread across columns
      const max = capability.maxConcurrentVideos;
      const selected = new Set<string>();
      const columnCounts = new Map<number, number>();

      // First pass: greedily pick most central, max 2 per column for balance
      const maxPerColumn = Math.max(2, Math.ceil(max / 3));
      for (const phone of scored) {
        if (selected.size >= max) break;
        const colCount = columnCounts.get(phone.column) || 0;
        if (colCount < maxPerColumn) {
          selected.add(phone.id);
          columnCounts.set(phone.column, colCount + 1);
        }
      }

      // Second pass: fill remaining slots ignoring column limit
      if (selected.size < max) {
        for (const phone of scored) {
          if (selected.size >= max) break;
          if (!selected.has(phone.id)) {
            selected.add(phone.id);
          }
        }
      }

      // Only update state if the set actually changed
      const prev = lastActiveRef.current;
      const changed = selected.size !== prev.size || [...selected].some(id => !prev.has(id));

      if (changed) {
        lastActiveRef.current = selected;
        setActiveIds(selected);
      }
    }, 150);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [parallaxOffset, capability.maxConcurrentVideos]);

  // On mount: compute initial active set immediately (no debounce)
  useEffect(() => {
    const phones = Array.from(registry.current.values());
    if (phones.length === 0 || capability.maxConcurrentVideos === 0) return;

    const scored = phones
      .map(p => ({ ...p, score: Math.abs(p.worldY) }))
      .sort((a, b) => a.score - b.score);

    const selected = new Set<string>();
    for (const phone of scored) {
      if (selected.size >= capability.maxConcurrentVideos) break;
      selected.add(phone.id);
    }
    lastActiveRef.current = selected;
    setActiveIds(selected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capability.maxConcurrentVideos]);

  const isActive = useCallback((id: string) => activeIds.has(id), [activeIds]);

  return { register, unregister, isActive, activeIds };
}
