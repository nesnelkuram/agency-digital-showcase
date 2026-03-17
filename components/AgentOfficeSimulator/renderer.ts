import type { SimulationState, AgentConfig, AgentStatus, AgentId } from './types';
import { AGENT_CONFIGS, STAGES, SECTION_ZONES } from './stages';
import { drawSprite } from './sprites';

// ─── Constants ────────────────────────────────────────────────────────────────

const W = 1200;
const MAIN_FLOOR_H = 418;
const DIVIDER_Y = 422;
const BASEMENT_Y_START = 432;
const BASEMENT_H = 268;
const TOTAL_H = 700;
const PIXEL_SIZE = 3;

// How far down agents travel for Hetzner basement
const BASEMENT_OFFSET = 290;

// ─── Color helpers ────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Font rendering (pixel-style using canvas text) ──────────────────────────

function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size = 8,
  align: CanvasTextAlign = 'center',
) {
  ctx.save();
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ─── Desk drawing ─────────────────────────────────────────────────────────────

function drawDesk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  status: AgentStatus,
  progress: number,
  tick: number,
) {
  const dw = 48;
  const dh = 12;
  const dx = x - dw / 2;
  const dy = y - 8;

  // Desk surface
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(dx, dy, dw, dh);

  // Desk border — color based on status
  const borderAlpha = status === 'working'
    ? 0.6 + 0.4 * Math.sin(tick * 0.006)
    : status === 'done'
    ? 0.8
    : 0.25;
  ctx.strokeStyle = hexToRgba(color, borderAlpha);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(dx, dy, dw, dh);

  // Monitor on desk
  const mx = x - 8;
  const mh = 14;
  const mw = 16;
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(mx, dy - mh, mw, mh);
  // Monitor screen glow
  if (status === 'working' || status === 'done') {
    ctx.fillStyle = hexToRgba(color, status === 'working' ? 0.3 + 0.2 * Math.sin(tick * 0.008) : 0.2);
    ctx.fillRect(mx + 1, dy - mh + 1, mw - 2, mh - 2);
  }

  // Progress bar on desk
  if (status === 'working' && progress > 0) {
    ctx.fillStyle = '#111';
    ctx.fillRect(dx + 2, dy + dh - 4, dw - 4, 3);
    ctx.fillStyle = color;
    ctx.fillRect(dx + 2, dy + dh - 4, Math.round((dw - 4) * progress), 3);
  }
}

// ─── Agent halo ───────────────────────────────────────────────────────────────

function drawHalo(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  color: string,
  status: AgentStatus,
  tick: number,
) {
  if (status === 'idle' || status === 'waiting' || status === 'delegated') {
    if (status === 'waiting') {
      ctx.beginPath();
      ctx.arc(x, cy - 18, 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(85,85,85,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    return;
  }

  const radius = 16;
  let alpha = 1;
  let strokeColor = color;

  if (status === 'working') {
    alpha = 0.5 + 0.5 * Math.sin(tick * 0.005);
    strokeColor = color;
  } else if (status === 'done') {
    alpha = 0.9;
    strokeColor = '#00ff41';
  } else if (status === 'error') {
    alpha = 0.7 + 0.3 * Math.sin(tick * 0.02);
    strokeColor = '#ff0000';
  }

  ctx.beginPath();
  ctx.arc(x, cy - 18, radius, 0, Math.PI * 2);
  ctx.strokeStyle = hexToRgba(strokeColor, alpha);
  ctx.lineWidth = 2;
  ctx.shadowBlur = 8;
  ctx.shadowColor = strokeColor;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner fill pulse for working
  if (status === 'working') {
    ctx.beginPath();
    ctx.arc(x, cy - 18, radius - 4, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, 0.08 * alpha);
    ctx.fill();
  }
}

// ─── Section zone drawing ─────────────────────────────────────────────────────

function drawSectionZones(ctx: CanvasRenderingContext2D) {
  for (const zone of SECTION_ZONES) {
    // Background fill
    ctx.fillStyle = zone.color;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

    // Dashed border
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = zone.color.replace(/[\d.]+\)$/, '0.5)');
    ctx.lineWidth = 1;
    ctx.strokeRect(zone.x, zone.y, zone.w, zone.h);
    ctx.setLineDash([]);

    // Label
    drawPixelText(ctx, zone.label, zone.x + zone.w / 2, zone.y + 10, zone.color.replace(/[\d.]+\)$/, '0.8)'), 6);
  }
}

// ─── Floor divider ────────────────────────────────────────────────────────────

function drawFloorDivider(ctx: CanvasRenderingContext2D, tick: number) {
  const alpha = 0.7 + 0.3 * Math.sin(tick * 0.004);
  ctx.strokeStyle = `rgba(255,0,255,${alpha})`;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#ff00ff';
  ctx.beginPath();
  ctx.moveTo(0, DIVIDER_Y);
  ctx.lineTo(W, DIVIDER_Y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Label on divider
  drawPixelText(ctx, '══ HETZNER CLUSTER ══', W / 2, DIVIDER_Y + 12, 'rgba(255,0,255,0.8)', 7);
}

// ─── Hetzner basement floor ───────────────────────────────────────────────────

function drawBasement(ctx: CanvasRenderingContext2D, progress: number, agents: AgentConfig[], agentStates: SimulationState['agentStates'], tick: number) {
  // Wipe-in effect: reveal basement columns left-to-right
  const revealWidth = W * progress;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, BASEMENT_Y_START, revealWidth, BASEMENT_H);
  ctx.clip();

  // Basement background (darker)
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, BASEMENT_Y_START, W, BASEMENT_H);

  // Basement grid lines
  ctx.strokeStyle = 'rgba(255,0,255,0.07)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 60) {
    ctx.beginPath();
    ctx.moveTo(gx, BASEMENT_Y_START);
    ctx.lineTo(gx, BASEMENT_Y_START + BASEMENT_H);
    ctx.stroke();
  }
  for (let gy = BASEMENT_Y_START; gy < BASEMENT_Y_START + BASEMENT_H; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Data packet drawing ──────────────────────────────────────────────────────

function quadBezier(t: number, p0x: number, p0y: number, p1x: number, p1y: number, p2x: number, p2y: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0x + 2 * mt * t * p1x + t * t * p2x,
    y: mt * mt * p0y + 2 * mt * t * p1y + t * t * p2y,
  };
}

function getAgentPos(id: AgentId, animProgress: number): { x: number; y: number } {
  const cfg = AGENT_CONFIGS.find(a => a.id === id);
  if (!cfg) return { x: 0, y: 0 };
  // During hetzner delegation, animate y downward
  const basement = id !== 'guard' && id !== 'customer' && id !== 'reza';
  const yOffset = basement ? animProgress * BASEMENT_OFFSET : 0;
  return { x: cfg.x, y: cfg.y + yOffset };
}

function drawPackets(ctx: CanvasRenderingContext2D, state: SimulationState, tick: number) {
  for (const packet of state.packets) {
    const from = getAgentPos(packet.fromId, state.hetznerAnimProgress);
    const to = getAgentPos(packet.toId, state.hetznerAnimProgress);

    // Control point: midway, elevated by 60px
    const cpx = (from.x + to.x) / 2;
    const cpy = Math.min(from.y, to.y) - 60;

    const pos = quadBezier(packet.progress, from.x, from.y - 20, cpx, cpy, to.x, to.y - 20);

    // Draw envelope glyph (6×4px scaled up)
    const pw = 12;
    const ph = 8;
    ctx.fillStyle = packet.color;
    ctx.fillRect(pos.x - pw / 2, pos.y - ph / 2, pw, ph);

    // Envelope flap
    ctx.fillStyle = hexToRgba(packet.color, 0.5);
    ctx.beginPath();
    ctx.moveTo(pos.x - pw / 2, pos.y - ph / 2);
    ctx.lineTo(pos.x, pos.y);
    ctx.lineTo(pos.x + pw / 2, pos.y - ph / 2);
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(packet.label, pos.x, pos.y + 1);

    // Trail glow
    ctx.shadowBlur = 6;
    ctx.shadowColor = packet.color;
    ctx.fillStyle = hexToRgba(packet.color, 0.4);
    ctx.fillRect(pos.x - pw / 2, pos.y - ph / 2, pw, ph);
    ctx.shadowBlur = 0;
  }
}

// ─── Main render function ─────────────────────────────────────────────────────

export function renderFrame(ctx: CanvasRenderingContext2D, state: SimulationState) {
  const tick = state.totalElapsedMs;

  // ── Background ─────────────────────────────────────────────────────────────
  ctx.fillStyle = '#08080f';
  ctx.fillRect(0, 0, W, TOTAL_H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(0,255,65,0.04)';
  ctx.lineWidth = 0.5;
  for (let gx = 0; gx < W; gx += 40) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, MAIN_FLOOR_H); ctx.stroke();
  }
  for (let gy = 0; gy < MAIN_FLOOR_H; gy += 40) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
  }

  // ── Section zones ──────────────────────────────────────────────────────────
  drawSectionZones(ctx);

  // ── Floor divider (magenta neon line) ──────────────────────────────────────
  drawFloorDivider(ctx, tick);

  // ── Hetzner basement ───────────────────────────────────────────────────────
  if (state.hetznerAnimProgress > 0 || state.currentStageIndex >= 8) {
    drawBasement(ctx, state.hetznerAnimProgress, AGENT_CONFIGS, state.agentStates, tick);
  }

  // ── Agents ─────────────────────────────────────────────────────────────────
  for (const agent of AGENT_CONFIGS) {
    const agentState = state.agentStates[agent.id];
    if (!agentState) continue;

    // Effective position (basement offset during Hetzner delegation)
    const isBasementAgent = agent.id !== 'guard' && agent.id !== 'customer' && agent.id !== 'reza';
    const yOff = isBasementAgent ? state.hetznerAnimProgress * BASEMENT_OFFSET : 0;
    const ax = agent.x;
    const ay = agent.y + yOff;

    // Skip if off-screen
    if (ay > TOTAL_H + 50) continue;

    // "Absent" overlay for main-floor agents when they're in basement
    if (isBasementAgent && state.hetznerAnimProgress > 0.5) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(ax - 28, ay - 60, 56, 55);
      drawPixelText(ctx, 'ABSENT', ax, ay - 33, 'rgba(100,100,100,0.6)', 5);
    }

    // Halo
    drawHalo(ctx, ax, ay, agent.color, agentState.status, tick);

    // Desk
    drawDesk(ctx, ax, ay, agent.color, agentState.status, agentState.progress, tick);

    // Sprite
    drawSprite(ctx, agent.spriteVariant, ax, ay, agent.color, PIXEL_SIZE);

    // Agent name
    const nameAlpha = agentState.status === 'delegated' ? 0.3 : 0.85;
    drawPixelText(ctx, agent.name, ax, ay + 10, hexToRgba(agent.color, nameAlpha), 5);

    // Status badge
    let badge = '';
    let badgeColor = '#555';
    switch (agentState.status) {
      case 'working': badge = 'ÇALIŞIYOR'; badgeColor = agent.color; break;
      case 'done': badge = 'TAMAM'; badgeColor = '#00ff41'; break;
      case 'waiting': badge = 'BEKLE'; badgeColor = '#facc15'; break;
      case 'error': badge = 'HATA'; badgeColor = '#ff0000'; break;
      case 'delegated': badge = 'DEVREDİLDİ'; badgeColor = '#555'; break;
    }
    if (badge) {
      drawPixelText(ctx, badge, ax, ay + 22, hexToRgba(badgeColor, 0.8), 4);
    }

    // Selected highlight
    if (state.selectedAgentId === agent.id) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(ax - 28, ay - 52, 56, 60);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // ── Data packets ───────────────────────────────────────────────────────────
  drawPackets(ctx, state, tick);

  // ── Approval gate flash ────────────────────────────────────────────────────
  if (state.phase === 'waiting_approval') {
    const a = 0.5 + 0.5 * Math.sin(tick * 0.007);
    ctx.fillStyle = `rgba(248,113,113,${a * 0.12})`;
    ctx.fillRect(740, 14, 140, 408);
    drawPixelText(ctx, '⚠ ONAY BEKLE', 812, 430, `rgba(248,113,113,${a})`, 6);
  }

  // ── Hetzner magenta flash ──────────────────────────────────────────────────
  if (state.flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,0,255,${state.flashAlpha})`;
    ctx.fillRect(0, 0, W, TOTAL_H);
  }

  // ── Stage info bar ─────────────────────────────────────────────────────────
  const stage = STAGES[state.currentStageIndex];
  if (stage && state.phase !== 'idle') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, MAIN_FLOOR_H - 26, W, 22);
    const stageLabel = `[${state.currentStageIndex + 1}/${STAGES.length}] ${stage.label}`;
    drawPixelText(ctx, stageLabel, 10, MAIN_FLOOR_H - 15, '#00ff41', 6, 'left');

    if (stage.durationMs < 50000) {
      const prog = Math.min(state.stageElapsedMs / stage.durationMs, 1);
      const barW = 200;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(W - barW - 10, MAIN_FLOOR_H - 22, barW, 16);
      ctx.fillStyle = '#00ff41';
      ctx.fillRect(W - barW - 10, MAIN_FLOOR_H - 22, Math.round(barW * prog), 16);
    }
  }

  // ── "IDLE" screen ──────────────────────────────────────────────────────────
  if (state.phase === 'idle') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, MAIN_FLOOR_H);
    drawPixelText(ctx, 'AGENT OFFICE SIMULATOR', W / 2, 160, '#00ff41', 14);
    drawPixelText(ctx, '> START\'A BAS <', W / 2, 210, 'rgba(0,255,65,0.6)', 9);
    drawPixelText(ctx, '14+ AGENT • RETRO PIPELINE VISUALIZER', W / 2, 250, 'rgba(0,207,255,0.5)', 6);
  }

  // ── "DONE" screen ──────────────────────────────────────────────────────────
  if (state.phase === 'done') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, MAIN_FLOOR_H / 2 - 50, W, 100);
    drawPixelText(ctx, 'PIPELINE TAMAMLANDI!', W / 2, MAIN_FLOOR_H / 2 - 15, '#00ff41', 12);
    drawPixelText(ctx, 'RESET ile yeniden başlat', W / 2, MAIN_FLOOR_H / 2 + 20, 'rgba(0,255,65,0.5)', 7);
  }

  // ── CRT Scanlines ──────────────────────────────────────────────────────────
  for (let y = 0; y < TOTAL_H; y += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, y, W, 1);
  }

  // ── Vignette ───────────────────────────────────────────────────────────────
  const vg = ctx.createRadialGradient(W / 2, TOTAL_H / 2, W * 0.25, W / 2, TOTAL_H / 2, W * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, TOTAL_H);

  // ── Flicker ────────────────────────────────────────────────────────────────
  if (state.flickerAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flickerAlpha})`;
    ctx.fillRect(0, 0, W, TOTAL_H);
  }
}
