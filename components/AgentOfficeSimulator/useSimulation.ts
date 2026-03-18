import { useRef, useState, useCallback, useEffect } from 'react';
import type { SimulationState, AgentId, AgentState, DataPacket, SimulationAction } from './types';
import { AGENT_CONFIGS, STAGES } from './stages';

// ─── Initial State ────────────────────────────────────────────────────────────

function buildInitialAgentStates(): Record<AgentId, AgentState> {
  const states: Partial<Record<AgentId, AgentState>> = {};
  for (const cfg of AGENT_CONFIGS) {
    states[cfg.id] = {
      status: 'idle',
      progress: 0,
      currentTask: '',
      elapsedMs: 0,
    };
  }
  return states as Record<AgentId, AgentState>;
}

const INITIAL_STATE: SimulationState = {
  phase: 'idle',
  currentStageIndex: 0,
  stageElapsedMs: 0,
  speedMultiplier: 1,
  hetznerMode: true,
  selectedAgentId: null,
  agentStates: buildInitialAgentStates(),
  packets: [],
  hetznerAnimProgress: 0,
  totalElapsedMs: 0,
  flashAlpha: 0,
  flickerAlpha: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

let packetCounter = 0;

function spawnPackets(state: SimulationState, stageIdx: number): DataPacket[] {
  const stage = STAGES[stageIdx];
  if (!stage?.outPackets?.length) return [];
  return stage.outPackets.map(def => {
    const fromCfg = AGENT_CONFIGS.find(a => a.id === def.fromId);
    return {
      id: `pkt-${++packetCounter}`,
      fromId: def.fromId,
      toId: def.toId,
      label: def.label,
      color: fromCfg?.color ?? '#ffffff',
      progress: 0,
    };
  });
}

function activateStageAgents(agentStates: Record<AgentId, AgentState>, stageIdx: number): Record<AgentId, AgentState> {
  const stage = STAGES[stageIdx];
  if (!stage) return agentStates;
  const next = { ...agentStates };
  for (const id of stage.agentIds) {
    if (next[id]) {
      next[id] = {
        ...next[id],
        status: 'working',
        progress: 0,
        currentTask: stage.label,
      };
    }
  }
  return next;
}

function markStageDone(agentStates: Record<AgentId, AgentState>, stageIdx: number): Record<AgentId, AgentState> {
  const stage = STAGES[stageIdx];
  if (!stage) return agentStates;
  const next = { ...agentStates };
  for (const id of stage.agentIds) {
    if (next[id]) {
      next[id] = { ...next[id], status: 'done', progress: 1 };
    }
  }
  return next;
}

// ─── Tick logic (pure function, no React) ────────────────────────────────────

function applyTick(state: SimulationState, rawDeltaMs: number): SimulationState {
  if (state.phase !== 'running') return state;

  const deltaMs = rawDeltaMs * state.speedMultiplier;
  const stage = STAGES[state.currentStageIndex];
  if (!stage) return { ...state, phase: 'done' };

  const newTotalElapsed = state.totalElapsedMs + deltaMs;
  const newStageElapsed = state.stageElapsedMs + deltaMs;
  const stageProgress = Math.min(newStageElapsed / stage.durationMs, 1);

  // Flicker effect
  const flickerAlpha = Math.random() < 0.001 ? 0.08 : 0;

  // Flash decay
  const flashAlpha = Math.max(0, state.flashAlpha - rawDeltaMs * 0.003);

  // Update working agent progresses
  let agentStates = { ...state.agentStates };
  for (const id of stage.agentIds) {
    if (agentStates[id]?.status === 'working') {
      agentStates[id] = {
        ...agentStates[id],
        progress: stageProgress,
        elapsedMs: agentStates[id].elapsedMs + deltaMs,
      };
    }
  }

  // Advance packet positions (1500ms travel time at 1x speed, adjusted for speedMultiplier)
  const packetSpeed = deltaMs / (1500);
  const newPackets = state.packets
    .map(p => ({ ...p, progress: Math.min(p.progress + packetSpeed, 1) }))
    .filter(p => p.progress < 1);

  // Hetzner animation: runs during the delegation stage (index 2)
  // Once complete, agents stay in basement for all subsequent stages
  let hetznerAnimProgress = state.hetznerAnimProgress;
  if (stage.isHetznerDelegation && state.hetznerMode) {
    hetznerAnimProgress = Math.min(newStageElapsed / stage.durationMs, 1);
  } else if (!stage.isHetznerDelegation && state.hetznerAnimProgress >= 1) {
    hetznerAnimProgress = 1; // Stay in basement
  }

  // Stage complete?
  if (newStageElapsed >= stage.durationMs) {
    // Mark done
    agentStates = markStageDone(agentStates, state.currentStageIndex);

    // Spawn outgoing packets
    const outPackets = spawnPackets(state, state.currentStageIndex);

    // Requires approval — pause here
    if (stage.requiresApproval) {
      return {
        ...state,
        phase: 'waiting_approval',
        stageElapsedMs: newStageElapsed,
        totalElapsedMs: newTotalElapsed,
        agentStates,
        packets: [...newPackets, ...outPackets],
        flashAlpha,
        flickerAlpha,
        hetznerAnimProgress,
      };
    }

    // Advance to next stage
    const nextIdx = state.currentStageIndex + 1;
    if (nextIdx >= STAGES.length) {
      return { ...state, phase: 'done', agentStates, packets: newPackets, totalElapsedMs: newTotalElapsed, flashAlpha, flickerAlpha };
    }

    // Activate next stage agents
    agentStates = activateStageAgents(agentStates, nextIdx);

    // Flash for Hetzner delegation
    const newFlash = STAGES[nextIdx]?.isHetznerDelegation ? 0.35 : flashAlpha;

    // Keep hetzner progress — once in basement, agents stay there
    const newHetznerProgress = hetznerAnimProgress;

    return {
      ...state,
      currentStageIndex: nextIdx,
      stageElapsedMs: 0,
      totalElapsedMs: newTotalElapsed,
      agentStates,
      packets: [...newPackets, ...outPackets],
      flashAlpha: newFlash,
      flickerAlpha,
      hetznerAnimProgress: newHetznerProgress,
    };
  }

  return {
    ...state,
    stageElapsedMs: newStageElapsed,
    totalElapsedMs: newTotalElapsed,
    agentStates,
    packets: newPackets,
    flashAlpha,
    flickerAlpha,
    hetznerAnimProgress,
  };
}

// ─── Action handlers ──────────────────────────────────────────────────────────

function applyAction(state: SimulationState, action: SimulationAction): SimulationState {
  switch (action.type) {
    case 'START': {
      if (state.phase === 'paused') return { ...state, phase: 'running' };
      if (state.phase !== 'idle') return state;
      const agentStates = activateStageAgents(buildInitialAgentStates(), 0);
      return { ...state, phase: 'running', currentStageIndex: 0, stageElapsedMs: 0, agentStates, packets: [] };
    }
    case 'PAUSE':
      return { ...state, phase: state.phase === 'running' ? 'paused' : state.phase };
    case 'RESET':
      return { ...INITIAL_STATE, speedMultiplier: state.speedMultiplier, hetznerMode: state.hetznerMode };
    case 'SET_SPEED':
      return { ...state, speedMultiplier: action.multiplier };
    case 'TOGGLE_HETZNER':
      return { ...state, hetznerMode: !state.hetznerMode };
    case 'SELECT_AGENT':
      return { ...state, selectedAgentId: action.id };
    case 'APPROVE': {
      if (state.phase !== 'waiting_approval') return state;
      const nextIdx = state.currentStageIndex + 1;
      if (nextIdx >= STAGES.length) return { ...state, phase: 'done' };
      const agentStates = activateStageAgents({ ...state.agentStates }, nextIdx);
      const newFlash = STAGES[nextIdx]?.isHetznerDelegation ? 0.35 : 0;
      return {
        ...state,
        phase: 'running',
        currentStageIndex: nextIdx,
        stageElapsedMs: 0,
        agentStates,
        flashAlpha: newFlash,
        hetznerAnimProgress: state.hetznerAnimProgress, // keep basement state
      };
    }
    default:
      return state;
  }
}

// ─── UI Snapshot (for React state — update at ~10fps) ────────────────────────

export interface UISnapshot {
  phase: SimulationState['phase'];
  currentStageIndex: number;
  speedMultiplier: number;
  hetznerMode: boolean;
  selectedAgentId: AgentId | null;
  agentStates: Record<AgentId, AgentState>;
  totalElapsedMs: number;
}

function toSnapshot(s: SimulationState): UISnapshot {
  return {
    phase: s.phase,
    currentStageIndex: s.currentStageIndex,
    speedMultiplier: s.speedMultiplier,
    hetznerMode: s.hetznerMode,
    selectedAgentId: s.selectedAgentId,
    agentStates: s.agentStates,
    totalElapsedMs: s.totalElapsedMs,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSimulation() {
  const simRef = useRef<SimulationState>(INITIAL_STATE);
  const [uiState, setUiState] = useState<UISnapshot>(toSnapshot(INITIAL_STATE));

  const syncUI = useCallback(() => {
    setUiState(toSnapshot(simRef.current));
  }, []);

  const tick = useCallback((deltaMs: number) => {
    simRef.current = applyTick(simRef.current, deltaMs);
  }, []);

  const dispatch = useCallback((action: SimulationAction) => {
    simRef.current = applyAction(simRef.current, action);
    syncUI();
  }, [syncUI]);

  // Periodic UI sync (10fps)
  useEffect(() => {
    const interval = setInterval(syncUI, 100);
    return () => clearInterval(interval);
  }, [syncUI]);

  return { simRef, uiState, tick, dispatch };
}
