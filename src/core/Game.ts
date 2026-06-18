import {
  DIR, DOOR, OX, OY, TILE, COLS, ROWS, T_WALL,
  MODE_RANGED, MODE_MELEE, PLAYER, ENEMY, MELEE,
} from '../config';
import type { Dir } from './types';
import { Rng } from './rng';
import { dist, overlap } from './util';
import { Player } from './entities/Player';
import { Projectile } from './entities/Projectile';
import { MeleeSwing } from './entities/MeleeSwing';
import { RoomMap } from './world/RoomMap';
import type { Room } from './world/Room';
import { collidesWall } from './systems/collision';
import { spawnEnemies } from './systems/spawner';
import { DEFAULT_RULES, type LevelRules } from './rules';
import type { InputState } from '../input/InputState';
import { pressingDir } from '../input/InputState';

/**
 * Game — «мозг» игры. Полностью независим от рендера и DOM: ничего не
 * рисует и не знает про three.js/canvas. Хранит всё изменяемое состояние
 * и продвигает симуляцию ровно на один фиксированный шаг в step().
 *
 * Контракт с внешним миром:
 *   • consumeActions(input) — один раз за кадр: смена оружия, рестарт;
 *   • step(input)           — один фиксированный шаг физики/логики;
 *   • публичные геттеры/поля — читает рендер.
 */
export class Game {
  readonly rules: LevelRules;
  rng: Rng; // пересоздаётся в reset() — для воспроизводимости фикс-сида
  roomMap: RoomMap;
  player: Player;
  cc = 0; // координаты текущей комнаты на карте
  cr = 0;
  meleeSwing: MeleeSwing | null = null;
  gameOver = false;
  won = false;

  /**
   * @param rules правила уровня (см. core/rules.ts). По умолчанию — «Стандарт».
   * @param rng   опционально свой ГПСЧ; иначе берётся seed из правил (или случайный).
   */
  constructor(rules: LevelRules = DEFAULT_RULES, rng?: Rng) {
    this.rules = rules;
    this.rng = rng ?? new Rng(rules.seed);
    this.player = new Player(rules.player);
    this.roomMap = new RoomMap(this.rng, rules);
    this.enterRoom('up');
  }

  /** Текущая комната (всегда существует: карта связна и переходы — только в имеющиеся комнаты). */
  get curRoom(): Room {
    return this.roomMap.get(this.cc, this.cr)!;
  }

  // ── Публичный контракт цикла ──────────────────────────────

  /** Однократные действия (смена оружия, рестарт). Вызывать раз в кадр. */
  consumeActions(input: InputState): void {
    if (input.toggleWeapon && !this.gameOver && !this.won) {
      this.player.mode = this.player.mode === MODE_RANGED ? MODE_MELEE : MODE_RANGED;
    }
    if (input.restart && (this.gameOver || this.won)) {
      this.reset();
    }
  }

  /** Один фиксированный шаг симуляции (= 1/60 c). */
  step(input: InputState): void {
    if (this.gameOver || this.won) return;

    const room = this.curRoom;
    const p = this.player;

    // Запоминаем позиции для плавной интерполяции при рендере.
    p.prevX = p.x; p.prevY = p.y;
    for (const e of room.enemies) { e.prevX = e.x; e.prevY = e.y; }
    for (const t of room.tears) { t.prevX = t.x; t.prevY = t.y; }

    // Таймеры.
    if (p.invTimer > 0) p.invTimer--;
    if (p.atkCD > 0) p.atkCD--;
    if (p.transCD > 0) p.transCD--;

    this.movePlayer(input, room, p);
    this.handleAttack(input, room, p);
    this.updateMelee(room);
    this.updateTears(room);
    const aliveCount = this.updateEnemies(room, p);
    if (this.gameOver) return;

    // Комната зачищена: открываем двери.
    if (room.enemies.length > 0 && aliveCount === 0 && !room.cleared) {
      room.cleared = true;
      room.rebuildTiles();
    }

    this.checkTransition(input);
    this.checkWin();
  }

  /** Полный сброс — новая карта, новый игрок (рестарт после конца игры). */
  reset(): void {
    this.gameOver = false;
    this.won = false;
    // Пере-сеем ГПСЧ из правил: фикс-сид → тот же данжен, иначе → новый каждый раз.
    this.rng = new Rng(this.rules.seed);
    this.roomMap = new RoomMap(this.rng, this.rules);
    this.player = new Player(this.rules.player);
    this.cc = 0;
    this.cr = 0;
    this.meleeSwing = null;
    this.enterRoom('up');
  }

  // ── Переход между комнатами ───────────────────────────────

  /** Расставляет игрока внутри текущей комнаты у двери fromDir и (при нужде) спавнит врагов. */
  enterRoom(fromDir: Dir): void {
    const room = this.curRoom;
    room.visited = true;

    const d = DOOR[fromDir];
    const [ddc, ddr] = DIR[fromDir];
    // Ставим игрока на один тайл внутрь от центра двери.
    const px = OX + d.cx * TILE + TILE / 2 - ddc * TILE;
    const py = OY + d.cy * TILE + TILE / 2 - ddr * TILE;
    this.player.place(px, py);
    this.player.facing = fromDir;
    this.player.invTimer = 20;            // короткая неуязвимость на входе
    this.player.transCD = PLAYER.transitionLock;

    this.meleeSwing = null;
    room.tears = [];

    if (!room.cleared && room.type !== 'spawn') {
      room.enemies = spawnEnemies(room, fromDir, this.player.x, this.player.y, this.rng, this.rules);
      // Если врагов нет (напр. сокровищница) — зачищать нечего, открываем сразу,
      // иначе двери никогда не появятся и игрок застрянет.
      if (room.enemies.length === 0) room.cleared = true;
      room.rebuildTiles();
    } else {
      room.cleared = true;
      room.enemies = [];
      room.rebuildTiles();
    }
  }

  // ── Системы (по одному шагу) ──────────────────────────────

  private movePlayer(input: InputState, room: Room, p: Player): void {
    let mx = input.moveX;
    let my = input.moveY;
    if (mx === 0 && my === 0) return;

    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;

    if (input.moveY < 0) p.moveDir = 'up';
    else if (input.moveY > 0) p.moveDir = 'down';
    if (input.moveX < 0) p.moveDir = 'left';
    else if (input.moveX > 0) p.moveDir = 'right';

    const dx = mx * p.speed;
    const dy = my * p.speed;
    // Раздельное разрешение коллизий по осям: позволяет «скользить» вдоль стен.
    p.x += dx;
    if (collidesWall(p.box, room)) p.x -= dx;
    p.y += dy;
    if (collidesWall(p.box, room)) p.y -= dy;
  }

  private handleAttack(input: InputState, room: Room, p: Player): void {
    let dir: Dir | null = null;
    if (input.aimDir) dir = input.aimDir;          // прицельная стрельба стрелками
    else if (input.attackHeld) dir = p.moveDir;    // пробел — по ходу движения

    if (!dir || p.atkCD > 0) return;

    p.facing = dir;
    p.atkCD = p.mode === MODE_RANGED ? PLAYER.rangedCooldown : PLAYER.meleeCooldown;
    const [nx, ny] = DIR[dir];
    if (p.mode === MODE_RANGED) {
      room.tears.push(new Projectile(p.x, p.y, nx, ny));
    } else {
      this.meleeSwing = new MeleeSwing(p.x, p.y, dir);
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
        e.hitTimer = MELEE.life; // защита от повторного удара тем же взмахом
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
        if (dist(t.x, t.y, e.x, e.y) < e.w / 2 + t.r) {
          e.hp -= t.damage;
          e.hitTimer = ENEMY.hitFlash;
          t.life = 0;
          break;
        }
      }
    }
    room.tears = room.tears.filter((t) => t.alive);
  }

  private updateEnemies(room: Room, p: Player): number {
    let aliveCount = 0;

    for (const e of room.enemies) {
      if (!e.alive) continue;
      aliveCount++;

      if (e.hitTimer > 0) e.hitTimer--;

      // Фаза отбрасывания: летит по инерции, ИИ не работает. Коллизии
      // проверяем пораздельно по осям — иначе кнокбэк (до ~4.5 тайла)
      // пробивал стену в 1 тайл, и враг застревал снаружи навсегда (софт-лок).
      if (Math.abs(e.knx) > 0.1 || Math.abs(e.kny) > 0.1) {
        e.x += e.knx * 3;
        if (collidesWall(e.box, room)) e.x -= e.knx * 3;
        e.y += e.kny * 3;
        if (collidesWall(e.box, room)) e.y -= e.kny * 3;
        e.knx *= ENEMY.knockbackDecay;
        e.kny *= ENEMY.knockbackDecay;
        continue;
      }
      e.knx = 0;
      e.kny = 0;

      // Преследование игрока.
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < ENEMY.aggroRange) {
        const mx = (dx / d) * e.speed;
        const my = (dy / d) * e.speed;
        e.x += mx;
        if (collidesWall(e.box, room)) e.x -= mx;
        e.y += my;
        if (collidesWall(e.box, room)) e.y -= my;
      }

      // Контактный урон по игроку.
      if (e.atkTimer > 0) e.atkTimer--;
      if (dist(e.x, e.y, p.x, p.y) < (e.w + p.w) / 2 && p.invTimer <= 0 && e.atkTimer <= 0) {
        p.hp -= e.damage;
        p.invTimer = PLAYER.invFrames;
        e.atkTimer = ENEMY.attackCooldown;
        if (p.hp <= 0) {
          p.hp = 0;
          this.gameOver = true;
          return aliveCount;
        }
      }
    }

    return aliveCount;
  }

  // ── Переходы и победа ─────────────────────────────────────

  private checkTransition(input: InputState): void {
    const p = this.player;
    if (p.transCD > 0) return;
    const room = this.curRoom;
    if (!room.cleared) return;

    const col = Math.floor((p.x - OX) / TILE);
    const row = Math.floor((p.y - OY) / TILE);

    if (row === 0 && room.doors.up && DOOR.up.cols.includes(col) && pressingDir(input, 'up')) {
      if (this.roomMap.has(this.cc, this.cr - 1)) { this.cr--; this.enterRoom('down'); return; }
    }
    if (row === ROWS - 1 && room.doors.down && DOOR.down.cols.includes(col) && pressingDir(input, 'down')) {
      if (this.roomMap.has(this.cc, this.cr + 1)) { this.cr++; this.enterRoom('up'); return; }
    }
    if (col === 0 && room.doors.left && DOOR.left.rows.includes(row) && pressingDir(input, 'left')) {
      if (this.roomMap.has(this.cc - 1, this.cr)) { this.cc--; this.enterRoom('right'); return; }
    }
    if (col === COLS - 1 && room.doors.right && DOOR.right.rows.includes(row) && pressingDir(input, 'right')) {
      if (this.roomMap.has(this.cc + 1, this.cr)) { this.cc++; this.enterRoom('left'); return; }
    }
  }

  private checkWin(): void {
    for (const room of this.roomMap.rooms.values()) {
      if (room.type === 'boss' && room.cleared) {
        this.won = true;
        return;
      }
    }
  }
}
