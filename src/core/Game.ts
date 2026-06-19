import {
  DIR, DOOR, OX, OY, TILE, COLS, ROWS, T_WALL,
  MODE_RANGED, MODE_MELEE, PLAYER, ENEMY, MELEE, PROJECTILE,
} from '../config';
import type { Dir } from './types';
import { Rng } from './rng';
import { dist, overlap } from './util';
import { Player } from './entities/Player';
import { Enemy } from './entities/Enemy';
import { Projectile } from './entities/Projectile';
import { MeleeSwing } from './entities/MeleeSwing';
import { RoomMap } from './world/RoomMap';
import type { Room } from './world/Room';
import { collidesWall } from './systems/collision';
import { spawnEnemies, spawnChest, pickChestWeapon } from './systems/spawner';
import { WeaponPickup } from './entities/WeaponPickup';
import { DEFAULT_RULES, scaleRulesForFloor, type LevelRules } from './rules';
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
  floor = 1;
  inventoryOpen = false;

  /**
   * @param rules правила уровня (см. core/rules.ts). По умолчанию — «Стандарт».
   * @param rng   опционально свой ГПСЧ; иначе берётся seed из правил (или случайный).
   */
  constructor(rules: LevelRules = DEFAULT_RULES, rng?: Rng) {
    this.rules = rules;
    this.rng = rng ?? new Rng(rules.seed);
    this.player = new Player(rules.player);
    this.player.mode = this.player.currentWeapon.type === 'ranged' ? MODE_RANGED : MODE_MELEE;
    this.roomMap = new RoomMap(this.rng, rules);
    this.enterRoom('up');
  }

  /** Текущая комната (всегда существует: карта связна и переходы — только в имеющиеся комнаты). */
  get curRoom(): Room {
    return this.roomMap.get(this.cc, this.cr)!;
  }

  // ── Публичный контракт цикла ──────────────────────────────

  /** Однократные действия (смена оружия, рестарт, инвентарь). Вызывать раз в кадр. */
  consumeActions(input: InputState): void {
    if (input.openInventory && !this.gameOver && !this.won) {
      this.inventoryOpen = !this.inventoryOpen;
    }
    if (this.inventoryOpen) return;
    if (input.toggleWeapon && !this.gameOver && !this.won) {
      const p = this.player;
      p.equipped = p.equipped === 0 ? 1 : 0;
      p.mode = p.currentWeapon.type === 'ranged' ? MODE_RANGED : MODE_MELEE;
    }
    if (input.restart && (this.gameOver || this.won)) {
      this.reset();
    }
  }

  /** Выбрать слот 0 или 1 (из main.ts при открытом инвентаре). */
  equipSlot(slot: number): void {
    if (slot !== 0 && slot !== 1) return;
    this.player.equipped = slot;
    this.player.mode = this.player.currentWeapon.type === 'ranged' ? MODE_RANGED : MODE_MELEE;
    this.inventoryOpen = false;
  }

  /** Один фиксированный шаг симуляции (= 1/60 c). */
  step(input: InputState): void {
    if (this.gameOver || this.won || this.inventoryOpen) return;

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
    this.updateChest(room);
    this.updatePickup(room, p);
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
    this.floor = 1;
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
    this.player.invTimer = PLAYER.entryInvFrames;
    this.player.transCD = PLAYER.transitionLock;

    this.meleeSwing = null;
    room.tears = [];

    if (!room.cleared && room.type !== 'spawn') {
      room.enemies = spawnEnemies(room, fromDir, this.player.x, this.player.y, this.rng, this.rules);
      // Сундук в сокровищнице.
      if (room.type === 'treasure' && !room.chest) {
        room.chest = spawnChest(room, this.rng);
      }
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
    if (input.aimDir) dir = input.aimDir;
    else if (input.attackHeld) dir = p.moveDir;

    if (!dir || p.atkCD > 0) return;

    p.facing = dir;
    const w = p.currentWeapon;
    p.atkCD = w.cooldown;
    const [nx, ny] = DIR[dir];

    if (w.type === 'ranged') {
      if (w.projectileType === 'beam') {
        // Лазерный луч — стационарная зона поражения.
        const range = 70;
        const t = new Projectile(p.x + nx * range, p.y + ny * range, 0, 0, 'beam');
        t.speed = 0;
        t.life = w.beamLife ?? 10;
        t.damage = w.beamTickDmg ?? 2;
        room.tears.push(t);
      } else if (w.spreadCount && w.spreadCount > 1) {
        const spread = 0.15;
        const perpX = -ny;
        const perpY = nx;
        for (let i = 0; i < w.spreadCount; i++) {
          const off = (i - (w.spreadCount - 1) / 2) * spread;
          const sx = nx + perpX * off;
          const sy = ny + perpY * off;
          room.tears.push(new Projectile(p.x, p.y, sx, sy, w.projectileType));
        }
      } else {
        room.tears.push(new Projectile(p.x, p.y, nx, ny, w.projectileType));
      }
    } else {
      this.meleeSwing = new MeleeSwing(p.x, p.y, dir, {
        damage: w.damage,
        knockback: w.knockback,
        life: w.swingLife,
        sizeMul: w.swingSizeMul,
      });
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
        e.hitTimer = MELEE.life;
        const [dx, dy] = DIR[this.meleeSwing.dir];
        e.knx = dx * this.meleeSwing.kb;
        e.kny = dy * this.meleeSwing.kb;
      }
    }
    // Удар по сундуку.
    if (room.chest?.alive && overlap(room.chest.box, this.meleeSwing.box)) {
      room.chest.hp -= this.meleeSwing.damage;
    }
  }

  private updateTears(room: Room): void {
    for (const t of room.tears) {
      if (!t.alive) continue;

      // Лазерный луч: стоит на месте, жжёт врагов каждые 2 тика.
      if (t.type === 'beam') {
        t.life--;
        if (t.life <= 0) continue;
        if (t.life % 2 === 0) {
          const radius = this.player.currentWeapon.beamRadius ?? 44;
          for (const e of room.enemies) {
            if (!e.alive) continue;
            if (dist(t.x, t.y, e.x, e.y) < e.w / 2 + radius) {
              e.hp -= t.damage;
              e.hitTimer = ENEMY.hitFlash;
            }
          }
        }
        continue;
      }

      // Бумеранг: один раз на половине жизни разворачивается.
      if (t.type === 'boomerang' && t.life === Math.floor(PROJECTILE.life / 2)) {
        t.dx = -t.dx;
        t.dy = -t.dy;
      }

      t.x += t.dx * t.speed;
      t.y += t.dy * t.speed;
      t.life--;

      const col = Math.floor((t.x - OX) / TILE);
      const row = Math.floor((t.y - OY) / TILE);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS || t.life <= 0) {
        this.explodeBomb(room, t);
        t.life = 0;
        continue;
      }
      if (room.tiles[row][col] === T_WALL) {
        this.explodeBomb(room, t);
        t.life = 0;
        continue;
      }

      if (t.hostile) {
        // Вражеский снаряд: бьёт игрока.
        const p = this.player;
        if (dist(t.x, t.y, p.x, p.y) < p.w / 2 + t.r && p.invTimer <= 0) {
          p.hp -= t.damage;
          p.invTimer = PLAYER.invFrames;
          t.life = 0;
          if (p.hp <= 0) { p.hp = 0; this.gameOver = true; return; }
          continue;
        }
      } else {
        // Снаряд игрока: бьёт врагов.
        for (const e of room.enemies) {
          if (!e.alive) continue;
          if (dist(t.x, t.y, e.x, e.y) < e.w / 2 + t.r) {
            e.hp -= t.damage;
            e.hitTimer = ENEMY.hitFlash;
            if (t.type === 'fireball') {
              const w = this.player.currentWeapon;
              e.burnTimer = w.fireDuration ?? 0;
            }
            if (t.type !== 'laser') {
              t.life = 0;
              this.explodeBomb(room, t);
              break;
            }
          }
        }
        // Попадание в сундук.
        if (room.chest?.alive && dist(t.x, t.y, room.chest.x, room.chest.y) < room.chest.w / 2 + t.r) {
          room.chest.hp -= t.damage;
          if (t.type !== 'laser') {
            t.life = 0;
            this.explodeBomb(room, t);
          }
        }
      }
    }
    room.tears = room.tears.filter((t) => t.alive);
  }

  /** Взрыв бомбы: AoE-урон по врагам. */
  private explodeBomb(room: Room, t: Projectile): void {
    if (t.type !== 'bomb') return;
    const w = this.player.currentWeapon;
    const radius = w.explosionRadius ?? 60;
    for (const e of room.enemies) {
      if (!e.alive) continue;
      if (dist(t.x, t.y, e.x, e.y) < radius) {
        e.hp -= 3;
        e.hitTimer = ENEMY.hitFlash;
        // Отбрасывание от центра взрыва.
        const dx = e.x - t.x;
        const dy = e.y - t.y;
        const d = Math.hypot(dx, dy) || 1;
        e.knx = (dx / d) * 12;
        e.kny = (dy / d) * 12;
      }
    }
  }

  /** Сундук уничтожен — спавним оружие. */
  private updateChest(room: Room): void {
    if (!room.chest || room.pickup) return;
    if (room.chest.alive) return;
    const weaponId = pickChestWeapon(this.rng);
    room.pickup = new WeaponPickup(room.chest.x, room.chest.y, weaponId);
    room.chest = null;
  }

  /** Подбор оружия игроком. */
  private updatePickup(room: Room, p: Player): void {
    if (!room.pickup) return;
    if (overlap(p.box, room.pickup.box)) {
      p.addWeapon(room.pickup.weaponId);
      room.pickup = null;
    }
  }

  private updateEnemies(room: Room, p: Player): number {
    let aliveCount = 0;
    const newEnemies: Enemy[] = [];

    for (const e of room.enemies) {
      if (!e.alive) continue;
      aliveCount++;

      if (e.hitTimer > 0) e.hitTimer--;

      // Горение: урон каждые fireInterval тиков.
      if (e.burnTimer > 0) {
        e.burnTimer--;
        const staff = this.player.weapons.find((w) => w.id === 'staff');
        if (staff && e.burnTimer % (staff.fireInterval ?? 10) === 0) {
          e.hp--;
          e.hitTimer = ENEMY.hitFlash;
        }
      }

      // Фаза отбрасывания: летит по инерции, ИИ не работает.
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

           if (e.type === 'boss' && this.milestoneBossFloor(this.floor)) {
        this.updateMilestoneBoss(e, room, p, newEnemies);
      } else if (e.type === 'shooter') {
        this.updateShooter(e, room, p);
      } else if (e.type === 'charger') {
        this.updateCharger(e, room, p);
      } else {
        this.updateChaser(e, room, p);
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

    room.enemies.push(...newEnemies);
    return aliveCount;
  }

  /** Этаж кратный 5, начиная с 5. */
  private milestoneBossFloor(floor: number): boolean {
    return floor % 5 === 0 && floor >= 5;
  }

  /** Босс на milestone-этаже: фазы, стрельба, миньоны. */
  private updateMilestoneBoss(e: Enemy, room: Room, p: Player, newEnemies: Enemy[]): void {
    const maxPhase = this.floor <= 5 ? 2 : 3;
    const hpRatio = e.hp / e.maxHp;

    let targetPhase = 1;
    if (maxPhase >= 2 && hpRatio < 0.66) targetPhase = 2;
    if (maxPhase >= 3 && hpRatio < 0.33) targetPhase = 3;

    if (targetPhase > e.phase) {
      e.phase = targetPhase;
      e.phaseChanged = true;
      e.hitTimer = 15; // визуальная вспышка (для рендера)
    }

    const phaseSpeedMul = targetPhase >= 3 ? 1.8 : targetPhase === 2 ? 1.35 : 1.0;
    const effectiveSpeed = e.speed * phaseSpeedMul;

    // Движение к игроку.
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < ENEMY.aggroRange) {
      const mx = (dx / d) * effectiveSpeed;
      const my = (dy / d) * effectiveSpeed;
      e.x += mx;
      if (collidesWall(e.box, room)) e.x -= mx;
      e.y += my;
      if (collidesWall(e.box, room)) e.y -= my;
    }

    // Стрельба снарядами (фаза 2+).
    if (targetPhase >= 2) {
      if (e.shootTimer > 0) e.shootTimer--;
      const shootCD = targetPhase >= 3 ? 25 : 40;
      if (e.shootTimer <= 0 && d < 400 && d > 50) {
        e.shootTimer = shootCD;
        const nd = d || 1;
        const t = new Projectile(e.x, e.y, dx / nd, dy / nd, 'tear');
        t.hostile = true;
        t.damage = 1 + Math.floor(this.floor / 5);
        t.speed = 3;
        t.life = 60;
        room.tears.push(t);
      }
    }

    // Спавн миньонов (фаза 3).
    if (targetPhase >= 3) {
      if (e.spawnTimer > 0) e.spawnTimer--;
      if (e.spawnTimer <= 0) {
        e.spawnTimer = 120;
        const rng = this.rng;
        const mx = OX + 2 * TILE + rng.float(0, COLS - 4) * TILE;
        const my = OY + 2 * TILE + rng.float(0, ROWS - 4) * TILE;
        newEnemies.push(new Enemy(mx, my, 'fast', { hpMul: 1.5, speedMul: 1.2 }));
      }
    }
  }

  /** Стандартное преследование (normal, fast, tank, boss). */
  private updateChaser(e: Enemy, room: Room, p: Player): void {
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
  }

  /** Зарядчик: бежит прямо на игрока с удвоенной скоростью. */
  private updateCharger(e: Enemy, room: Room, p: Player): void {
    if (e.chargeTimer > 0) e.chargeTimer--;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > 0 && d < ENEMY.aggroRange) {
      const speedMul = e.chargeTimer <= 0 && d < 150 ? 2.5 : 1.0;
      if (speedMul > 1) e.chargeTimer = 40; // перезарядка рывка
      const mx = (dx / d) * e.speed * speedMul;
      const my = (dy / d) * e.speed * speedMul;
      e.x += mx;
      if (collidesWall(e.box, room)) e.x -= mx;
      e.y += my;
      if (collidesWall(e.box, room)) e.y -= my;
    }
  }

  /** Стрелок: держит дистанцию, стреляет снарядами. */
  private updateShooter(e: Enemy, room: Room, p: Player): void {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);

    // Держит дистанцию ~200 px.
    if (d > 0 && d < ENEMY.aggroRange) {
      if (d < 150) {
        // Слишком близко — отступает.
        const mx = -(dx / d) * e.speed;
        const my = -(dy / d) * e.speed;
        e.x += mx;
        if (collidesWall(e.box, room)) e.x -= mx;
        e.y += my;
        if (collidesWall(e.box, room)) e.y -= my;
      } else {
        const mx = (dx / d) * e.speed * 0.5;
        const my = (dy / d) * e.speed * 0.5;
        e.x += mx;
        if (collidesWall(e.box, room)) e.x -= mx;
        e.y += my;
        if (collidesWall(e.box, room)) e.y -= my;
      }
    }

    // Стрельба.
    if (e.shootTimer > 0) e.shootTimer--;
    if (e.shootTimer <= 0 && d < 350 && d > 40) {
      e.shootTimer = 45;
      const nd = d || 1;
      const nx = dx / nd;
      const ny = dy / nd;
      const t = new Projectile(e.x, e.y, nx, ny, 'tear');
      t.hostile = true;
      t.damage = 1;
      t.speed = 3.5;
      t.life = 60;
      room.tears.push(t);
    }
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

  /** Спуск на следующий этаж: новая карта, усиленные враги, HP/оружие сохраняются. */
  private descend(): void {
    this.floor++;
    const rules = scaleRulesForFloor(this.rules, this.floor);

    const p = this.player;
    const savedHp = p.hp;
    const savedMode = p.mode;

    const floorSeed = this.rules.seed !== undefined ? this.rules.seed + this.floor : undefined;
    this.rng = floorSeed !== undefined ? new Rng(floorSeed) : new Rng();

    this.roomMap = new RoomMap(this.rng, rules);
    this.cc = 0;
    this.cr = 0;
    this.meleeSwing = null;

    p.hp = savedHp;
    p.atkCD = 0;
    p.moveDir = 'up';
    this.enterRoom('up');
    p.mode = savedMode;
  }

  private checkWin(): void {
    for (const room of this.roomMap.rooms.values()) {
      if (room.type === 'boss' && room.cleared) {
        if (this.rules.endless) {
          this.descend();
        } else {
          this.won = true;
        }
        return;
      }
    }
  }
}
