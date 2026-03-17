export type AgentId =
  | 'guard' | 'customer'
  | 'nisan' | 'tarik' | 'webfetcher'
  | 'leyla' | 'bora'
  | 'emre' | 'pinar' | 'volkan' | 'sinan' | 'cansu'
  | 'alp' | 'reza'
  | 'hasan' | 'defne' | 'gul' | 'nesrin' | 'serkan';

export type AgentStatus = 'idle' | 'working' | 'done' | 'error' | 'waiting' | 'delegated';

export type SimulationPhase = 'idle' | 'running' | 'paused' | 'waiting_approval' | 'done';

export interface AgentConfig {
  id: AgentId;
  name: string;
  role: string;
  color: string;
  x: number;
  y: number;
  description: string;
  spriteVariant: 0 | 1 | 2;
}

export interface AgentState {
  status: AgentStatus;
  progress: number; // 0→1
  currentTask: string;
  elapsedMs: number;
}

export interface DataPacket {
  id: string;
  fromId: AgentId;
  toId: AgentId;
  label: string;
  color: string;
  progress: number; // 0→1
}

export interface StagePacketDef {
  fromId: AgentId;
  toId: AgentId;
  label: string;
}

export interface StageConfig {
  id: string;
  label: string;
  agentIds: AgentId[];
  durationMs: number;
  requiresApproval?: boolean;
  isHetznerDelegation?: boolean;
  outPackets?: StagePacketDef[];
}

export interface SimulationState {
  phase: SimulationPhase;
  currentStageIndex: number;
  stageElapsedMs: number;
  speedMultiplier: number;
  hetznerMode: boolean;
  selectedAgentId: AgentId | null;
  agentStates: Record<AgentId, AgentState>;
  packets: DataPacket[];
  hetznerAnimProgress: number; // 0→1 during delegation animation
  totalElapsedMs: number;
  flashAlpha: number;
  flickerAlpha: number;
}

export type SimulationAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'TICK'; deltaMs: number }
  | { type: 'SET_SPEED'; multiplier: number }
  | { type: 'TOGGLE_HETZNER' }
  | { type: 'SELECT_AGENT'; id: AgentId | null }
  | { type: 'APPROVE' };
