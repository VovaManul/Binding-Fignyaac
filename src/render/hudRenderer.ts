import { CW, CH, OY, RH } from '../constants';
import { MODE_RANGED, MODE_MELEE } from '../constants';
import type { Player } from '../entities/Player';
import type { Room } from '../room/Room';

/** Draw the HUD: HP bar, mode indicator, enemy count, room label */
export function drawHUD(ctx: CanvasRenderingContext2D, player: Player, room: Room): void {
  drawHPBar(ctx, player);
  drawModeIndicator(ctx, player);
  drawEnemyCount(ctx, room);
  drawRoomLabel(ctx, room);
}

function drawHPBar(ctx: CanvasRenderingContext2D, p: Player): void {
  const bx = 20, by = 20, bw = 140, bh = 14;
  ctx.fillStyle = '#111';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#2a0a0a';
  ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);

  const ratio = Math.max(0, p.hp / p.maxHp);
  const color = ratio > 0.5 ? '#993333' : ratio > 0.25 ? '#994422' : '#663322';
  ctx.fillStyle = color;
  ctx.fillRect(bx + 2, by + 2, (bw - 4) * ratio, bh - 4);

  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#bbb';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`HP ${p.hp}/${p.maxHp}`, bx + bw / 2, by + bh - 3);
}

function drawModeIndicator(ctx: CanvasRenderingContext2D, p: Player): void {
  const my = CH - 46;
  ctx.textAlign = 'center';

  const label = p.mode === MODE_RANGED ? 'RANGED' : 'MELEE';
  const color = p.mode === MODE_RANGED ? '#4488cc' : '#cc6644';

  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(CW / 2 - 95, my - 18, 190, 34);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(CW / 2 - 95, my - 18, 190, 34);

  ctx.fillStyle = color;
  ctx.font = 'bold 17px monospace';
  ctx.fillText(`[ ${label} ]`, CW / 2, my + 8);

  ctx.fillStyle = '#555';
  ctx.font = '11px monospace';
  ctx.fillText('[Tab/Q] switch', CW / 2, my - 26);

  // Small weapon icon
  if (p.mode === MODE_RANGED) {
    ctx.strokeStyle = '#88bbdd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CW / 2 - 82, my - 4);
    ctx.lineTo(CW / 2 - 72, my - 4);
    ctx.stroke();
    ctx.fillStyle = '#88bbdd';
    ctx.fillRect(CW / 2 - 82, my - 8, 10, 8);
  } else {
    ctx.fillStyle = '#ddbb88';
    ctx.beginPath();
    ctx.moveTo(CW / 2 - 82, my - 10);
    ctx.lineTo(CW / 2 - 74, my - 2);
    ctx.lineTo(CW / 2 - 82, my + 4);
    ctx.fill();
  }
}

function drawEnemyCount(ctx: CanvasRenderingContext2D, room: Room): void {
  const alive = room.enemies.filter(e => e.alive).length;
  ctx.textAlign = 'left';
  if (alive > 0) {
    ctx.fillStyle = '#aa4444';
    ctx.font = '13px monospace';
    ctx.fillText(`\u25B6 ${alive}`, 20, CH - 18);
  } else if (!room.cleared && room.type !== 'spawn') {
    ctx.fillStyle = '#886633';
    ctx.font = '13px monospace';
    ctx.fillText('Clear the room', 20, CH - 18);
  }
}

function drawRoomLabel(ctx: CanvasRenderingContext2D, room: Room): void {
  if (!room.visited) return;
  ctx.textAlign = 'right';
  const labels: Record<string, string> = { spawn: 'START', normal: '', treasure: 'TREASURE', boss: 'BOSS' };
  const label = labels[room.type];
  if (label) {
    ctx.fillStyle = '#555';
    ctx.font = '11px monospace';
    ctx.fillText(label, CW - 20, OY + RH + 30);
  }
}
