import { CW, CH, OX, OY, TILE, COLS, ROWS, DIR, DOOR } from '../constants';
import { T_WALL } from '../room/tiles';
import { MODE_RANGED, MODE_MELEE } from '../constants';
import type { Dir } from '../types';
import { KEYS } from '../input';
import { overlap } from '../math';
import { RoomMap } from '../room/RoomMap';
import { Room } from '../room/Room';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Tear } from '../entities/Tear';
import { MeleeSwing } from '../entities/MeleeSwing';
import { collidesWall } from './collision';
import { checkTransition } from './transitions';
import { drawRoom } from '../render/roomRenderer';
import { drawEntities } from '../render/entityRenderer';
import { drawHUD } from '../render/hudRenderer';
import { drawMinimap } from '../render/minimapRenderer';

export class Game {
  // Canvas
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  // World
  roomMap = new RoomMap();
  player = new Player();
  cc = 0;
  cr = 0;
  meleeSwing: MeleeSwing | null = null;

  // State
  gameOver = false;
  won = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.enterRoom('up');
    this.loop();
  }

  get curRoom(): Room {
    return this.roomMap.get(this.cc, this.cr)!;
  }

  toggleMode(): void {
    this.player.mode = this.player.mode === MODE_RANGED ? MODE_MELEE : MODE_RANGED;
  }

  restart(): void {
    this.gameOver = false;
    this.won = false;
    this.roomMap = new RoomMap();
    this.player = new Player();
    this.cc = 0;
    this.cr = 0;
    this.meleeSwing = null;
    this.enterRoom('up');
  }

  /** Place the player inside the current room after entering via a door */
  enterRoom(fromDir: Dir): void {
    const room = this.curRoom;
    room.visited = true;

    const d = DOOR[fromDir];
    const [ddc, ddr] = DIR[fromDir];

    this.player.x = OX + d.cx * TILE + TILE / 2 - ddc * TILE;
    this.player.y = OY + d.cy * TILE + TILE / 2 - ddr * TILE;
    this.player.facing = fromDir;
    this.player.invTimer = 20;
    this.player.transCD = 15;

    this.meleeSwing = null;
    room.buildTiles();
    room.enemies = [];
    room.tears = [];

    if (!room.cleared && room.type !== 'spawn') {
      this.spawnEnemies(room, fromDir);
    } else {
      room.cleared = true;
      room.buildTiles();
    }
  }

  // -------- SPAWNING --------

  private spawnEnemies(room: Room, entryDir: Dir): void {
    const count = room.type === 'boss' ? 1 : room.type === 'treasure' ? 0 : 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      let tries = 0;
      let x: number, y: number, ok: boolean;
      const type = room.type === 'boss' ? 'boss' as const
        : Math.random() < 0.3 ? 'fast' as const : 'normal' as const;

      do {
        x = OX + 2 * TILE + Math.random() * (COLS - 4) * TILE;
        y = OY + 2 * TILE + Math.random() * (ROWS - 4) * TILE;
        ok = true;

        const ed = DOOR[entryDir];
        const dx = OX + ed.cx * TILE + TILE / 2;
        const dy = OY + ed.cy * TILE + TILE / 2;
        if (Math.hypot(x - dx, y - dy) < 180) ok = false;

        for (const e of room.enemies) {
          if (Math.hypot(x - e.x, y - e.y) < 60) { ok = false; break; }
        }
        if (Math.hypot(x - this.player.x, y - this.player.y) < 150) ok = false;

        tries++;
      } while (!ok && tries < 100);

      room.enemies.push(new Enemy(x, y, type));
    }
  }

  // -------- GAME LOOP --------

  private loop(): void {
    if (!this.gameOver && !this.won) this.tick();
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  private tick(): void {
    const room = this.curRoom;
    const p = this.player;

    if (p.invTimer > 0) p.invTimer--;
    if (p.atkCD > 0) p.atkCD--;
    if (p.transCD > 0) p.transCD--;

    this.processMovement(p);
    this.processAttack(room, p);
    this.updateMelee(room);
    this.updateTears(room);

    const aliveCount = this.updateEnemies(room, p);

    if (room.enemies.length > 0 && aliveCount === 0 && !room.cleared) {
      room.cleared = true;
      room.buildTiles();
    }

    checkTransition(this);

    if (!this.gameOver) {
      const bossRoom = [...this.roomMap.rooms.values()].find(r => r.type === 'boss');
      if (bossRoom?.cleared) this.won = true;
    }
  }

  private processMovement(p: Player): void {
    let mx = 0, my = 0;
    if (KEYS['w'] || KEYS['W']) my = -1;
    if (KEYS['s'] || KEYS['S']) my = 1;
    if (KEYS['a'] || KEYS['A']) mx = -1;
    if (KEYS['d'] || KEYS['D']) mx = 1;

    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;

      if (my < 0) p.moveDir = 'up';
      else if (my > 0) p.moveDir = 'down';
      if (mx < 0) p.moveDir = 'left';
      else if (mx > 0) p.moveDir = 'right';

      const dx = mx * p.speed;
      const dy = my * p.speed;
      p.x += dx;
      if (collidesWall(p.box, this.curRoom, OX, OY)) p.x -= dx;
      p.y += dy;
      if (collidesWall(p.box, this.curRoom, OX, OY)) p.y -= dy;
    }
  }

  private processAttack(room: Room, p: Player): void {
    let ax = 0, ay = 0;
    if (KEYS['ArrowUp']) { ax = 0; ay = -1; }
    else if (KEYS['ArrowDown']) { ax = 0; ay = 1; }
    else if (KEYS['ArrowLeft']) { ax = -1; ay = 0; }
    else if (KEYS['ArrowRight']) { ax = 1; ay = 0; }
    else if (KEYS[' '] || KEYS['Space']) {
      [ax, ay] = DIR[p.moveDir];
    }

    if ((ax !== 0 || ay !== 0) && p.atkCD <= 0) {
      const len = Math.hypot(ax, ay);
      ax /= len;
      ay /= len;

      const dn: Dir = ay < 0 ? 'up' : ay > 0 ? 'down' : ax < 0 ? 'left' : 'right';
      p.facing = dn;
      p.atkCD = p.mode === MODE_RANGED ? 10 : 22;

      if (p.mode === MODE_RANGED) {
        room.tears.push(new Tear(p.x, p.y, ax, ay));
      } else {
        this.meleeSwing = new MeleeSwing(p.x, p.y, dn);
      }
    }
  }

  private updateMelee(room: Room): void {
    if (this.meleeSwing && !this.meleeSwing.alive) this.meleeSwing = null;
    if (!this.meleeSwing) return;

    this.meleeSwing.life--;
    for (const e of room.enemies) {
      if (!e.alive || e.hitTimer > 0) continue;
      if (overlap(e.box, this.meleeSwing.box)) {
        e.hp -= this.meleeSwing.damage;
        e.hitTimer = 10;
        const [dx, dy] = DIR[this.meleeSwing.dir];
        e.knx = dx * this.meleeSwing.kb;
        e.kny = dy * this.meleeSwing.kb;
      }
    }
  }

  private updateTears(room: Room): void {
    for (const t of room.tears) {
      if (!t.alive) continue;
      t.x += t.dx * t.speed;
      t.y += t.dy * t.speed;
      t.life--;

      const col = Math.floor((t.x - OX) / TILE);
      const row = Math.floor((t.y - OY) / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS || t.life <= 0) {
        t.life = 0;
        continue;
      }
      if (room.tiles[row][col] === T_WALL) {
        t.life = 0;
        continue;
      }

      for (const e of room.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(t.x - e.x, t.y - e.y) < e.w / 2 + t.r) {
          e.hp -= t.damage;
          e.hitTimer = 8;
          t.life = 0;
          break;
        }
      }
    }
    room.tears = room.tears.filter(t => t.alive);
  }

  private updateEnemies(room: Room, p: Player): number {
    let aliveCount = 0;

    for (const e of room.enemies) {
      if (!e.alive) continue;
      aliveCount++;

      if (e.hitTimer > 0) e.hitTimer--;

      if (Math.abs(e.knx) > 0.1 || Math.abs(e.kny) > 0.1) {
        e.x += e.knx * 3;
        e.y += e.kny * 3;
        e.knx *= 0.85;
        e.kny *= 0.85;
        continue;
      }
      e.knx = 0;
      e.kny = 0;

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 500) {
        const s = e.speed;
        const mx = (dx / d) * s;
        const my = (dy / d) * s;
        e.x += mx;
        if (collidesWall(e.box, room, OX, OY)) e.x -= mx;
        e.y += my;
        if (collidesWall(e.box, room, OX, OY)) e.y -= my;
      }

      if (e.atkTimer > 0) e.atkTimer--;
      if (Math.hypot(e.x - p.x, e.y - p.y) < (e.w + p.w) / 2 && p.invTimer <= 0 && e.atkTimer <= 0) {
        p.hp -= e.damage;
        p.invTimer = 60;
        e.atkTimer = 30;
        if (p.hp <= 0) {
          this.gameOver = true;
          return aliveCount;
        }
      }
    }

    return aliveCount;
  }

  // -------- RENDERING --------

  private render(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, CW, CH);

    drawRoom(ctx, this.curRoom);
    drawEntities(ctx, this.curRoom, this.player, this.meleeSwing);
    drawHUD(ctx, this.player, this.curRoom);
    drawMinimap(ctx, this.roomMap, this.cc, this.cr);

    if (this.gameOver) this.drawOverlay('#c33', 'GAME OVER');
    else if (this.won) this.drawOverlay('#3c3', 'VICTORY');
  }

  private drawOverlay(color: string, text: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = color;
    ctx.font = 'bold 56px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, CW / 2, CH / 2 - 20);
    ctx.fillStyle = '#888';
    ctx.font = '18px monospace';
    ctx.fillText('[R] restart', CW / 2, CH / 2 + 40);
  }
}
