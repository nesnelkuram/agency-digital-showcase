import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useSimulation } from './useSimulation';
import { renderFrame } from './renderer';
import { AGENT_CONFIGS, STAGES } from './stages';
import { getSpriteBounds } from './sprites';
import type { AgentId } from './types';

// ─── Canvas dimensions ────────────────────────────────────────────────────────
const CANVAS_W = 1200;
const CANVAS_H = 700;

// ─── Google Font injection ────────────────────────────────────────────────────
function injectFont() {
  if (document.getElementById('press-start-2p-font')) return;
  const link = document.createElement('link');
  link.id = 'press-start-2p-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
  document.head.appendChild(link);
}

// ─── Tooltip component ────────────────────────────────────────────────────────
interface TooltipProps {
  agentId: AgentId;
  canvasRect: DOMRect | null;
  onClose: () => void;
  agentStates: ReturnType<typeof useSimulation>['uiState']['agentStates'];
}

const AgentTooltip: React.FC<TooltipProps> = ({ agentId, canvasRect, onClose, agentStates }) => {
  const cfg = AGENT_CONFIGS.find(a => a.id === agentId);
  const state = agentStates[agentId];
  if (!cfg || !canvasRect) return null;

  // Position tooltip near agent
  const dpr = window.devicePixelRatio || 1;
  const scaleX = canvasRect.width / CANVAS_W;
  const scaleY = canvasRect.height / CANVAS_H;
  const sx = canvasRect.left + cfg.x * scaleX;
  const sy = canvasRect.top + cfg.y * scaleY;

  const tipLeft = Math.min(sx + 20, window.innerWidth - 260);
  const tipTop = Math.max(sy - 120, 10);

  const statusLabel: Record<string, string> = {
    idle: 'Bekleniyor',
    working: 'Çalışıyor',
    done: 'Tamamlandı',
    error: 'Hata',
    waiting: 'Bekliyor',
    delegated: 'Devredildi',
  };

  return (
    <div
      className="fixed z-50 rounded border text-xs shadow-xl"
      style={{
        left: tipLeft,
        top: tipTop,
        background: '#0d0d1a',
        borderColor: cfg.color,
        color: '#fff',
        width: 240,
        fontFamily: '"Press Start 2P", monospace',
        fontSize: 9,
        lineHeight: 1.7,
        padding: '10px 12px',
        boxShadow: `0 0 20px ${cfg.color}55`,
      }}
    >
      <div className="flex justify-between items-start mb-2">
        <span style={{ color: cfg.color }}>{cfg.name}</span>
        <button onClick={onClose} style={{ color: '#555', fontSize: 10 }}>✕</button>
      </div>
      <div style={{ color: '#aaa', marginBottom: 6 }}>{cfg.role}</div>
      <div style={{ color: '#777', fontSize: 7, marginBottom: 8 }}>{cfg.description}</div>
      <div className="flex items-center gap-2">
        <span style={{ color: '#555' }}>Durum:</span>
        <span style={{ color: cfg.color }}>{statusLabel[state?.status ?? 'idle'] ?? state?.status}</span>
      </div>
      {state?.progress > 0 && state?.progress < 1 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ background: '#1a1a2e', height: 4, borderRadius: 2 }}>
            <div style={{ background: cfg.color, height: 4, width: `${state.progress * 100}%`, borderRadius: 2, transition: 'width 0.1s' }} />
          </div>
        </div>
      )}
      {state?.elapsedMs > 0 && (
        <div style={{ color: '#555', marginTop: 6, fontSize: 7 }}>
          Süre: {(state.elapsedMs / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AgentOfficeSimulator: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const fontReadyRef = useRef(false);
  const [tooltipAgent, setTooltipAgent] = useState<AgentId | null>(null);

  const { simRef, uiState, tick, dispatch } = useSimulation();

  // ── Font + RAF ───────────────────────────────────────────────────────────
  useEffect(() => {
    injectFont();

    const startLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = CANVAS_W * dpr;
      canvas.height = CANVAS_H * dpr;
      canvas.style.width = `${CANVAS_W}px`;
      canvas.style.height = `${CANVAS_H}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      const loop = (time: number) => {
        if (lastTimeRef.current > 0) {
          const deltaMs = Math.min(time - lastTimeRef.current, 100);
          tick(deltaMs);
        }
        lastTimeRef.current = time;

        renderFrame(ctx, simRef.current);
        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    };

    document.fonts.ready.then(startLoop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick, simRef]);

  // ── Canvas rect tracking ─────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (canvasRef.current) {
        canvasRectRef.current = canvasRef.current.getBoundingClientRect();
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Canvas click: agent selection ────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const lx = (e.clientX - rect.left) * scaleX;
    const ly = (e.clientY - rect.top) * scaleY;

    for (const agent of AGENT_CONFIGS) {
      const bounds = getSpriteBounds(agent.x, agent.y, 3);
      // Expand hit area
      if (
        lx >= bounds.x - 16 &&
        lx <= bounds.x + bounds.w + 16 &&
        ly >= bounds.y - 16 &&
        ly <= bounds.y + bounds.h + 24
      ) {
        const newId = uiState.selectedAgentId === agent.id ? null : agent.id;
        dispatch({ type: 'SELECT_AGENT', id: newId });
        setTooltipAgent(newId);
        canvasRectRef.current = canvasRef.current!.getBoundingClientRect();
        return;
      }
    }
    // Clicked blank area — deselect
    dispatch({ type: 'SELECT_AGENT', id: null });
    setTooltipAgent(null);
  }, [dispatch, uiState.selectedAgentId]);

  // ── Speed pills ──────────────────────────────────────────────────────────
  const speeds = [0.5, 1, 2, 5] as const;

  // ── Format time ─────────────────────────────────────────────────────────
  const elapsed = (uiState.totalElapsedMs / 1000).toFixed(1);

  // ── Stage label ──────────────────────────────────────────────────────────
  const currentStage = STAGES[uiState.currentStageIndex];

  return (
    <div
      className="flex flex-col items-center min-h-screen bg-[#05050f] p-4"
      style={{ fontFamily: '"Press Start 2P", monospace' }}
    >
      {/* Title */}
      <div className="mb-4 text-center">
        <h1 className="text-[#00ff41] text-sm mb-1" style={{ textShadow: '0 0 10px #00ff41' }}>
          AGENT OFFICE SIMULATOR
        </h1>
        <p className="text-[#333] text-[8px]">2D Retro Pipeline Visualizer · {AGENT_CONFIGS.length} Agent</p>
      </div>

      {/* Main layout: canvas + sidebar */}
      <div className="flex gap-4 w-full max-w-[1380px]">
        {/* Canvas container */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Start/Pause/Reset */}
            {(uiState.phase === 'idle' || uiState.phase === 'paused') && (
              <button
                onClick={() => dispatch({ type: 'START' })}
                className="px-3 py-1.5 rounded border text-[9px] transition-all"
                style={{ background: '#00ff4120', borderColor: '#00ff41', color: '#00ff41', boxShadow: '0 0 8px #00ff4155' }}
              >
                ▶ START
              </button>
            )}
            {uiState.phase === 'running' && (
              <button
                onClick={() => dispatch({ type: 'PAUSE' })}
                className="px-3 py-1.5 rounded border text-[9px]"
                style={{ background: '#facc1520', borderColor: '#facc15', color: '#facc15' }}
              >
                ⏸ PAUSE
              </button>
            )}
            <button
              onClick={() => { dispatch({ type: 'RESET' }); setTooltipAgent(null); }}
              className="px-3 py-1.5 rounded border text-[9px]"
              style={{ background: '#ef444420', borderColor: '#ef4444', color: '#ef4444' }}
            >
              ↺ RESET
            </button>

            {/* Speed pills */}
            <div className="flex gap-1">
              {speeds.map(s => (
                <button
                  key={s}
                  onClick={() => dispatch({ type: 'SET_SPEED', multiplier: s })}
                  className="px-2 py-1 rounded text-[8px] border transition-all"
                  style={{
                    background: uiState.speedMultiplier === s ? '#00cfff30' : 'transparent',
                    borderColor: uiState.speedMultiplier === s ? '#00cfff' : '#333',
                    color: uiState.speedMultiplier === s ? '#00cfff' : '#555',
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Hetzner toggle */}
            <button
              onClick={() => dispatch({ type: 'TOGGLE_HETZNER' })}
              className="px-3 py-1.5 rounded border text-[8px] transition-all"
              style={{
                background: uiState.hetznerMode ? '#ff00ff20' : 'transparent',
                borderColor: uiState.hetznerMode ? '#ff00ff' : '#333',
                color: uiState.hetznerMode ? '#ff00ff' : '#555',
              }}
            >
              {uiState.hetznerMode ? '⬇ HETZNER ON' : '⬇ HETZNER OFF'}
            </button>

            {/* Elapsed */}
            <span className="text-[#333] text-[8px] ml-auto">{elapsed}s</span>
          </div>

          {/* APPROVE button (only when waiting) */}
          {uiState.phase === 'waiting_approval' && (
            <div className="flex justify-center">
              <button
                onClick={() => dispatch({ type: 'APPROVE' })}
                className="px-6 py-2 rounded border text-[10px] animate-pulse"
                style={{
                  background: '#f8717130',
                  borderColor: '#f87171',
                  color: '#f87171',
                  boxShadow: '0 0 20px #f8717155',
                  animation: 'pulse 1s ease-in-out infinite',
                }}
              >
                ✓ ONAYLA — Pipeline Devam Et
              </button>
            </div>
          )}

          {/* Canvas */}
          <div className="relative" style={{ lineHeight: 0 }}>
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="rounded border cursor-crosshair block"
              style={{ borderColor: '#1a1a2e', maxWidth: '100%' }}
            />

            {/* Tooltip */}
            {tooltipAgent && (
              <AgentTooltip
                agentId={tooltipAgent}
                canvasRect={canvasRectRef.current}
                onClose={() => { setTooltipAgent(null); dispatch({ type: 'SELECT_AGENT', id: null }); }}
                agentStates={uiState.agentStates}
              />
            )}
          </div>
        </div>

        {/* Sidebar: agent status list */}
        <div
          className="flex flex-col gap-1 overflow-y-auto rounded border p-3"
          style={{
            width: 168,
            maxHeight: CANVAS_H + 80,
            background: '#08080f',
            borderColor: '#1a1a2e',
            fontSize: 7,
          }}
        >
          <div className="text-[#333] mb-2 text-[8px]">AGENT DURUMU</div>
          {AGENT_CONFIGS.map(cfg => {
            const s = uiState.agentStates[cfg.id];
            const statusDot: Record<string, string> = {
              idle: '#333',
              working: cfg.color,
              done: '#00ff41',
              error: '#ff0000',
              waiting: '#facc15',
              delegated: '#444',
            };
            const statusLabel: Record<string, string> = {
              idle: 'BOŞTA',
              working: 'ÇALIŞIYOR',
              done: 'TAMAM',
              error: 'HATA',
              waiting: 'BEKLE',
              delegated: 'DEVREDİLDİ',
            };
            const dotColor = statusDot[s?.status ?? 'idle'];
            const isWorking = s?.status === 'working';
            return (
              <button
                key={cfg.id}
                onClick={() => {
                  const newId = uiState.selectedAgentId === cfg.id ? null : cfg.id;
                  dispatch({ type: 'SELECT_AGENT', id: newId });
                  setTooltipAgent(newId);
                  canvasRectRef.current = canvasRef.current!.getBoundingClientRect();
                }}
                className="flex flex-col gap-0.5 rounded px-2 py-1.5 text-left transition-all"
                style={{
                  background: uiState.selectedAgentId === cfg.id ? `${cfg.color}15` : 'transparent',
                  border: `1px solid ${uiState.selectedAgentId === cfg.id ? cfg.color : '#1a1a2e'}`,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    style={{
                      width: 6, height: 6,
                      borderRadius: '50%',
                      background: dotColor,
                      boxShadow: isWorking ? `0 0 4px ${cfg.color}` : 'none',
                      flexShrink: 0,
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ color: cfg.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 90 }}>
                    {cfg.name}
                  </span>
                </div>
                <span style={{ color: '#444', paddingLeft: 10 }}>
                  {statusLabel[s?.status ?? 'idle']}
                </span>
                {isWorking && (
                  <div style={{ paddingLeft: 10, marginTop: 2 }}>
                    <div style={{ background: '#1a1a2e', height: 2, width: 80 }}>
                      <div
                        style={{
                          background: cfg.color,
                          height: 2,
                          width: `${(s?.progress ?? 0) * 80}px`,
                          transition: 'width 0.1s',
                        }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}

          {/* Stage list */}
          <div className="text-[#333] mt-4 mb-2 text-[8px]">PIPELINE</div>
          {STAGES.map((stage, i) => (
            <div
              key={stage.id}
              className="px-2 py-1 rounded"
              style={{
                background: uiState.currentStageIndex === i && uiState.phase !== 'idle' ? '#1a1a2e' : 'transparent',
                borderLeft: `2px solid ${
                  uiState.currentStageIndex > i ? '#00ff41'
                  : uiState.currentStageIndex === i && uiState.phase !== 'idle' ? '#00cfff'
                  : '#222'
                }`,
              }}
            >
              <div style={{
                color: uiState.currentStageIndex > i ? '#00ff4188'
                  : uiState.currentStageIndex === i && uiState.phase !== 'idle' ? '#00cfff'
                  : '#333',
                fontSize: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}>
                <span>{i + 1}. {stage.label}</span>
                {stage.required && (
                  <span style={{ color: '#ef4444', fontSize: 5, marginLeft: 'auto', fontWeight: 700 }} title="Başarısız olursa pipeline durur">●</span>
                )}
                {stage.requiresApproval && (
                  <span style={{ color: '#facc15', fontSize: 5, marginLeft: 'auto', fontWeight: 700 }} title="İnsan onayı gerektirir">◎</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-[7px]" style={{ color: '#333' }}>
        <span>● <span style={{ color: '#00ff41' }}>TAMAM</span></span>
        <span>○ <span style={{ color: '#00cfff' }}>ÇALIŞIYOR</span></span>
        <span>◌ <span style={{ color: '#555' }}>BOŞTA</span></span>
        <span>◎ <span style={{ color: '#facc15' }}>BEKLE</span></span>
        <span>◎ <span style={{ color: '#facc15' }}>ONAY GEREKLİ</span></span>
        <span>● <span style={{ color: '#ef4444' }}>ZORUNLu (dur)</span></span>
        <span style={{ marginLeft: 'auto', color: '#1a1a2e' }}>
          Canvas tıkla → agent bilgisi
        </span>
      </div>
    </div>
  );
};

export default AgentOfficeSimulator;
