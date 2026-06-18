import { DIR, OX, OY, TILE } from '../constants';
import type { Room } from '../room/Room';
import type { Player } from '../entities/Player';
import type { MeleeSwing } from '../entities/MeleeSwing';

/** Draw enemies, player, tears, and the melee swing arc */
export function drawEntities(
  ctx: CanvasRenderingContext2D,
  room: Room,
  player: Player,
  meleeSwing: MeleeSwing | null,
): void {
  // --- ENEMIES ---
  for (const e of room.enemies) {
    if (!e.alive) continue;
    const flash = e.hitTimer > 0 && e.hitTimer % 4 < 2;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(e.x + 2, e.y + e.h / 4, e.w / 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (e.type === 'boss') {
      drawBoss(ctx, e, flash);
    } else if (e.type === 'fast') {
      drawFastEnemy(ctx, e, flash);
    } else {
      drawNormalEnemy(ctx, e, flash);
    }

    ctx.restore();
  }

  // --- PLAYER ---
  drawPlayer(ctx, player);

  // --- TEARS ---
  for (const t of room.tears) {
    if (!t.alive) continue;
    ctx.save();
    ctx.fillStyle = '#6699cc';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#99bbee';
    ctx.beginPath();
    ctx.arc(t.x - 1.5, t.y - 1.5, t.r - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- MELEE SWING ---
  if (meleeSwing && meleeSwing.alive) {
    drawMeleeSwing(ctx, meleeSwing);
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, e: any, flash: boolean): void {
  ctx.fillStyle = flash ? '#ddd' : '#5a0a0a';
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a0808';
  ctx.beginPath();
  ctx.arc(e.x - 3, e.y - 3, e.w / 2 - 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = flash ? '#000' : '#ff3333';
  ctx.beginPath();
  ctx.arc(e.x - 8, e.y - 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(e.x + 8, e.y - 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(e.x - 8, e.y - 8, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(e.x + 8, e.y - 8, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = flash ? '#bbb' : '#3a0505';
  ctx.beginPath();
  ctx.moveTo(e.x - 16, e.y - e.w / 2 + 4);
  ctx.lineTo(e.x - 8, e.y - e.w / 2 - 16);
  ctx.lineTo(e.x, e.y - e.w / 2 + 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(e.x - 4, e.y - e.w / 2 + 4);
  ctx.lineTo(e.x + 4, e.y - e.w / 2 - 16);
  ctx.lineTo(e.x + 12, e.y - e.w / 2 + 4);
  ctx.fill();

  if (e.hp < e.maxHp) {
    ctx.fillStyle = '#222';
    ctx.fillRect(e.x - 22, e.y - e.h / 2 - 14, 44, 4);
    ctx.fillStyle = '#c33';
    ctx.fillRect(e.x - 22, e.y - e.h / 2 - 14, 44 * (e.hp / e.maxHp), 4);
  }
}

function drawFastEnemy(ctx: CanvasRenderingContext2D, e: any, flash: boolean): void {
  ctx.fillStyle = flash ? '#ddd' : '#992222';
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#771111';
  ctx.beginPath();
  ctx.arc(e.x - 1, e.y - 1, e.w / 2 - 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff4444';
  ctx.beginPath();
  ctx.arc(e.x - 5, e.y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(e.x + 5, e.y - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(e.x - 5, e.y - 5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(e.x + 5, e.y - 5, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawNormalEnemy(ctx: CanvasRenderingContext2D, e: any, flash: boolean): void {
  ctx.fillStyle = flash ? '#ccc' : '#5a4a2e';
  ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
  ctx.fillStyle = '#4a3a1e';
  ctx.fillRect(e.x - e.w / 2 + 3, e.y - e.h / 2 + 3, e.w - 6, e.h - 6);
  ctx.fillStyle = '#332816';
  ctx.fillRect(e.x - e.w / 2 + 6, e.y - e.h / 2 + 6, e.w - 12, e.h - 12);
  ctx.fillStyle = '#ffcc66';
  ctx.fillRect(e.x - 7, e.y - 5, 5, 5);
  ctx.fillRect(e.x + 2, e.y - 5, 5, 5);
  ctx.fillStyle = '#000';
  ctx.fillRect(e.x - 6, e.y - 4, 3, 3);
  ctx.fillRect(e.x + 3, e.y - 4, 3, 3);
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player): void {
  ctx.save();

  const flash = p.invTimer > 0 && p.invTimer % 6 < 3;
  const bodyColor = p.mode === 0 ? '#2a6a9a' : '#9a3a2a';

  ctx.fillStyle = flash ? '#ddd' : bodyColor;
  ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
  ctx.fillStyle = flash ? '#ccc' : 'rgba(0,0,0,0.3)';
  ctx.fillRect(p.x - p.w / 2 + 3, p.y - p.h / 2 + 3, p.w - 6, p.h - 6);

  // Weapon
  const [fx, fy] = DIR[p.facing];
  const wx = p.x + fx * (p.w / 2 + 4);
  const wy = p.y + fy * (p.h / 2 + 4);

  if (p.mode === 0) {
    drawPistol(ctx, p, wx, wy, fx, fy, flash);
  } else {
    drawKnife(ctx, wx, wy, fx, fy, flash);
  }

  // Eyes
  ctx.fillStyle = '#fff';
  const ex = p.x + fx * 5;
  const ey = p.y + fy * 5;
  ctx.fillRect(ex - 5, ey - 4, 4, 5);
  ctx.fillRect(ex + 1, ey - 4, 4, 5);
  ctx.fillStyle = '#111';
  ctx.fillRect(ex - 4 + fx, ey - 3 + fy, 2, 3);
  ctx.fillRect(ex + 2 + fx, ey - 3 + fy, 2, 3);

  ctx.restore();
}

function drawPistol(
  ctx: CanvasRenderingContext2D,
  p: Player,
  wx: number, wy: number,
  fx: number, fy: number,
  flash: boolean,
): void {
  ctx.strokeStyle = flash ? '#999' : '#555';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // Barrel
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.lineTo(wx + fx * 14 + fy * 2, wy + fy * 14 + fx * 2);
  ctx.stroke();

  // Body
  ctx.fillStyle = flash ? '#aaa' : '#444';
  ctx.save();
  const angle = fy !== 0 ? (Math.PI / 2) * (fy < 0 ? -1 : 1) : fx < 0 ? Math.PI : 0;
  ctx.translate(p.x + fx * 8, p.y + fy * 8);
  ctx.rotate(angle);
  ctx.fillRect(-7, -4, 14, 8);
  ctx.restore();

  // Muzzle flash
  if (p.atkCD > 8 && p.mode === 0) {
    ctx.fillStyle = 'rgba(255,200,50,0.6)';
    ctx.beginPath();
    ctx.arc(wx + fx * 16, wy + fy * 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,200,0.4)';
    ctx.beginPath();
    ctx.arc(wx + fx * 18, wy + fy * 18, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawKnife(
  ctx: CanvasRenderingContext2D,
  wx: number, wy: number,
  fx: number, fy: number,
  flash: boolean,
): void {
  ctx.strokeStyle = flash ? '#bbb' : '#ccc';
  ctx.lineWidth = 2;

  // Blade triangle
  const kx = wx + fx * 6;
  const ky = wy + fy * 6;
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(kx + fx * 16 - fy * 6, ky + fy * 16 + fx * 6);
  ctx.lineTo(kx + fx * 16 + fy * 6, ky + fy * 16 - fx * 6);
  ctx.closePath();
  ctx.fillStyle = flash ? '#ddd' : '#d4d4d4';
  ctx.fill();
  ctx.stroke();

  // Handle
  ctx.fillStyle = flash ? '#a99' : '#5a3a1a';
  ctx.fillRect(kx - fx * 3 - fy * 3, ky - fy * 3 - fx * 3, 8, 8);

  // Guard
  ctx.fillStyle = flash ? '#bbb' : '#888';
  ctx.fillRect(kx - fx * 2 - fy * 5, ky - fy * 2 - fx * 5, 5, 12);
}

function drawMeleeSwing(ctx: CanvasRenderingContext2D, s: MeleeSwing): void {
  const alpha = s.life / 10;
  ctx.save();
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = '#cc8844';
  ctx.fillRect(s.box.x, s.box.y, s.box.w, s.box.h);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#ddbb88';
  ctx.lineWidth = 2;
  ctx.strokeRect(s.box.x, s.box.y, s.box.w, s.box.h);
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = '#ffcc88';
  ctx.lineWidth = 3;

  const [dx, dy] = DIR[s.dir];
  ctx.beginPath();
  ctx.moveTo(s.box.x + s.box.w / 2 - dx * 18, s.box.y + s.box.h / 2 - dy * 18);
  ctx.lineTo(s.box.x + s.box.w / 2 + dx * 18, s.box.y + s.box.h / 2 + dy * 18);
  ctx.stroke();
  ctx.restore();
}
