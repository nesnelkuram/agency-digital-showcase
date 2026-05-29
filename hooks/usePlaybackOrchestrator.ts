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
 * - Each phone calls register(id, worldY, column) on mount.
 * - Header3D calls recompute() once registration loop finishes — that's the
 *   deterministic mount-time trigger. (registryVersion + effect dep is a
 *   secondary safety net for partial re-registrations.)
 * - On scroll, parallaxOffset changes → debounced recompute (150ms).
 * - Top N phones by absolute worldY (most central) become active, spread
 *   across columns when possible.
 */
export function usePlaybackOrchestrator(
  capability: DeviceCapability,
  parallaxOffset: number
) {
  const registry = useRef<Map<string, PhoneRegistration>>(new Map());
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [registryVersion, setRegistryVersion] = useState(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActiveRef = useRef<Set<string>>(new Set());

  const register = useCallback((id: string, worldY: number, column: number) => {
    registry.current.set(id, { id, worldY, column });
    setRegistryVersion(v => v + 1);
  }, []);

  const unregister = useCallback((id: string) => {
    registry.current.delete(id);
    setRegistryVersion(v => v + 1);
  }, []);

  // Core selection algorithm. Stable ref via useCallback so external callers
  // (Header3D's register effect) can fire it without effect-dep re-runs.
  const compute = useCallback(() => {
    const phones = Array.from(registry.current.values());
    if (capability.maxConcurrentVideos === 0) {
      if (lastActiveRef.current.size > 0) {
        lastActiveRef.current = new Set();
        setActiveIds(new Set());
      }
      return;
    }
    if (phones.length === 0) return;

    // Score: lower = more central = higher priority
    const scored = phones
      .map(p => ({ ...p, score: Math.abs(p.worldY) }))
      .sort((a, b) => a.score - b.score);

    const max = capability.maxConcurrentVideos;
    const selected = new Set<string>();
    const columnCounts = new Map<number, number>();
    const maxPerColumn = Math.max(2, Math.ceil(max / 3));

    // First pass: greedily pick most central, capped per column for balance
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
        if (!selected.has(phone.id)) selected.add(phone.id);
      }
    }

    const prev = lastActiveRef.current;
    const changed = selected.size !== prev.size || [...selected].some(id => !prev.has(id));
    if (!changed) return;

    console.log(`[Orchestrator] registry=${phones.length}, tier=${capability.tier}, active=${selected.size} →`, [...selected]);
    lastActiveRef.current = selected;
    setActiveIds(selected);
  }, [capability.maxConcurrentVideos, capability.tier]);

  // Scroll-driven recompute (debounced)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(compute, 150);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [parallaxOffset, compute]);

  // Registry/capability-driven recompute (immediate). Safety net in case the
  // caller forgets to call recompute() after registration loop.
  useEffect(() => {
    compute();
  }, [registryVersion, compute]);

  const isActive = useCallback((id: string) => activeIds.has(id), [activeIds]);
  const recompute = useCallback(() => { compute(); }, [compute]);

  return { register, unregister, isActive, activeIds, recompute };
}
