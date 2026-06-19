import {
  DIR, DOOR, OX, OY, TILE, COLS, ROWS,
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
import { moveEntity } from './systems/movement';
import { runAI, spawnSplitterChildren, type AIContext } from './systems/ai';
import {
  applyWeaponProjectileStats, explodeBomb, projectileHitWall,
} from './systems/projectiles';
import { spawnEnemies, spawnChest, pickChestWeapon } from './systems/spawner';
import { Pickup } from './entities/Pickup';
import { ITEMS, applyItem, ALL_ITEM_IDS, type ItemId } from './items';
import { DEFAULT_RULES, scaleRulesForFloor, type LevelRules } from './rules';
import type { InputState } from '../input/InputState';
import { pressingDir, cardinalFromVec } from '../input/InputState';

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
  private floorRules: LevelRules;
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
  elapsedSteps = 0;

  /**
   * @param rules правила уровня (см. core/rules.ts). По умолчанию — «Стандарт».
   * @param rng   опционально свой ГПСЧ; иначе берётся seed из правил (или случайный).
   */
  constructor(rules: LevelRules = DEFAULT_RULES, rng?: Rng) {
    this.rules = rules;
    this.floorRules = rules;
    this.rng = rng ?? new Rng(rules.seed);
    this.player = new Player(rules.player);
    this.player.mode = this.player.currentWeapon.type === 'ranged' ? MODE_RANGED : MODE_MELEE;
    this.roomMap = new RoomMap(this.rng, this.floorRules);
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

  /** Выбрать слот (из main.ts при открытом инвентаре). Молча игнорирует несуществующие. */
  equipSlot(slot: number): void {
    if (slot < 0 || slot >= this.player.weapons.length) return;
    this.player.equipped = slot as 0 | 1;
    this.player.mode = this.player.currentWeapon.type === 'ranged' ? MODE_RANGED : MODE_MELEE;
    this.inventoryOpen = false;
  }

  /** Закрыть инвентарь без прямой мутации поля снаружи Game. */
  closeInventory(): void {
    this.inventoryOpen = false;
  }

  /** Один фиксированный шаг симуляции (= 1/60 c). */
  step(input: InputState): void {
    if (this.gameOver || this.won || this.inventoryOpen) return;

    this.elapsedSteps++;

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

    // Комната зачищена: все враги мертвы (aliveCount === 0 после фильтра
    // означает, что ни живых, ни свежеспавненных не осталось). Проверку
    // через room.enemies.length использовать нельзя — после фильтрации длина
    // уже 0; считаем по живым из updateEnemies.
    if (aliveCount === 0 && !room.cleared && room.type !== 'spawn' && room.type !== 'treasure' && room.type !== 'secret') {
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
    this.inventoryOpen = false;
    this.elapsedSteps = 0;
    this.floorRules = this.rules;
    // Пере-сеем ГПСЧ из правил: фикс-сид → тот же данжен, иначе → новый каждый раз.
    this.rng = new Rng(this.rules.seed);
    this.roomMap = new RoomMap(this.rng, this.floorRules);
    this.player = new Player(this.rules.player);
    this.player.mode = this.player.currentWeapon.type === 'ranged' ? MODE_RANGED : MODE_MELEE;
    this.cc = 0;
    this.cr = 0;
    this.meleeSwing = null;
    this.enterRoom('up');
  }

  // ── Переход между комнатами ───────────────────────────────

  /** Расставляет игрока внутри текущей комнаты у двери fromDir и (при нужде) спавнит врагов. */
  enterRoom(fromDir: Dir): void {
    const room = this.curRoom;
    const wasVisited = room.visited; // ловим «первый вход» до установки флага
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
      room.enemies = spawnEnemies(room, fromDir, this.player.x, this.player.y, this.rng, this.floorRules);
      // Сундук в сокровищнице.
      if (room.type === 'treasure' && !room.chest) {
        room.chest = spawnChest(room, this.rng);
      }
      // Секретка: +1 max HP один раз при первом входе (лечит заодно на 1).
      if (room.type === 'secret' && !wasVisited) {
        this.player.growMaxHp(1);
      }
      // Если врагов нет (напр. сокровищница/секретка) — зачищать нечего,
      // открываем сразу, иначе двери никогда не появятся и игрок застрянет.
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

    moveEntity(p, mx * p.speed, my * p.speed, room);
  }

  private handleAttack(input: InputState, room: Room, p: Player): void {
    // Приоритет: явный прицел (вектор стрелок) → иначе направление движения.
    let nx = 0, ny = 0;
    let aim = false;
    if (input.aimVec) {
      nx = input.aimVec.x;
      ny = input.aimVec.y;
      aim = true;
    } else if (input.attackHeld) {
      [nx, ny] = DIR[p.moveDir];
      aim = true;
    }

    if (!aim || p.atkCD > 0) return;

    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    // Для рендера и door-логики сохраняем facing как одно из 4 направлений.
    p.facing = cardinalFromVec({ x: nx, y: ny });

    const w = p.currentWeapon;
    p.atkCD = p.effectiveCooldown(w);
    const damage = p.effectiveDamage(w);

    if (w.type === 'ranged') {
      if (w.projectileType === 'beam') {
        // Лазерный луч — стационарная зона поражения.
        const range = w.beamRange ?? 70;
        const t = new Projectile(p.x + nx * range, p.y + ny * range, 0, 0, 'beam');
        t.speed = 0;
        t.life = w.beamLife ?? 10;
        t.damage = (w.beamTickDmg ?? 2) * p.stats.damageMul;
        t.beamRadius = w.beamRadius ?? 44;
        room.tears.push(t);
      } else if (w.spreadCount && w.spreadCount > 1) {
        const spread = w.spread ?? 0.15;
        const perpX = -ny;
        const perpY = nx;
        const projectileType = w.projectileType ?? 'tear';
        for (let i = 0; i < w.spreadCount; i++) {
          const off = (i - (w.spreadCount - 1) / 2) * spread;
          const sx = nx + perpX * off;
          const sy = ny + perpY * off;
          const sl = Math.hypot(sx, sy) || 1;
          const t = new Projectile(p.x, p.y, sx / sl, sy / sl, projectileType);
          applyWeaponProjectileStats(t, w, p);
          room.tears.push(t);
        }
      } else {
        const t = new Projectile(p.x, p.y, nx, ny, w.projectileType ?? 'tear');
        applyWeaponProjectileStats(t, w, p);
        room.tears.push(t);
      }
    } else {
      this.meleeSwing = new MeleeSwing(p.x, p.y, cardinalFromVec({ x: nx, y: ny }), {
        damage,
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
          const radius = t.beamRadius || 44;
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

      if (t.life <= 0 || projectileHitWall(t, room)) {
        explodeBomb(room, t);
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
              e.burnTimer = t.burnDuration;
              e.burnDamage = t.burnDamage;
              e.burnInterval = t.burnInterval;
            }
            if (t.type !== 'laser') {
              t.life = 0;
              explodeBomb(room, t);
              break;
            }
          }
        }
        // Попадание в сундук.
        if (room.chest?.alive && dist(t.x, t.y, room.chest.x, room.chest.y) < room.chest.w / 2 + t.r) {
          room.chest.hp -= t.damage;
          if (t.type !== 'laser') {
            t.life = 0;
            explodeBomb(room, t);
          }
        }
      }
    }
    room.tears = room.tears.filter((t) => t.alive);
  }

  /** Сундук уничтожен — спавним предмет или оружие (50/50). */
  private updateChest(room: Room): void {
    if (!room.chest || room.pickup) return;
    if (room.chest.alive) return;
    const dropWeapon = this.rng.chance(0.5);
    if (dropWeapon) {
      room.pickup = Pickup.weapon(room.chest.x, room.chest.y, pickChestWeapon(this.rng));
    } else {
      const itemId = this.rng.pick(ALL_ITEM_IDS);
      room.pickup = Pickup.item(room.chest.x, room.chest.y, itemId);
    }
    room.chest = null;
  }

  /** Подбор пикапа игроком (оружие → слот, предмет → статы). */
  private updatePickup(room: Room, p: Player): void {
    if (!room.pickup) return;
    if (overlap(p.box, room.pickup.box)) {
      const pk = room.pickup;
      if (pk.kind === 'weapon' && pk.weaponId !== undefined) {
        p.addWeapon(pk.weaponId);
      } else if (pk.kind === 'item' && pk.itemId !== undefined) {
        const item: ItemId = pk.itemId;
        const def = ITEMS[item];
        applyItem(p.stats, def, (hpBonus) => p.growMaxHp(hpBonus));
      }
      room.pickup = null;
    }
  }

  private updateEnemies(room: Room, p: Player): number {
    let aliveCount = 0;
    const newEnemies: Enemy[] = [];
    const ctx: AIContext = {
      room, player: p, rng: this.rng, floor: this.floor, floorRules: this.floorRules, newEnemies,
    };

    // Запоминаем splitter'ов, которые умерли в этом шаге — после цикла спавним
    // их детей. (Делаем это в конце, чтобы не мутировать массив во время итерации.)
    const deadSplitters: Enemy[] = [];

    for (const e of room.enemies) {
      // Мёртвый враг: ловим splitter для распада, иначе пропускаем.
      if (!e.alive) {
        if (e.type === 'splitter') deadSplitters.push(e);
        continue;
      }

      if (e.hitTimer > 0) e.hitTimer--;

      // Горение: урон каждые fireInterval тиков.
      if (e.burnTimer > 0) {
        e.burnTimer--;
        if (e.burnTimer % e.burnInterval === 0) {
          e.hp -= e.burnDamage;
          e.hitTimer = ENEMY.hitFlash;
        }
      }
      if (!e.alive) {
        // Умер от горения/прошлого удара в этом шаге.
        if (e.type === 'splitter') deadSplitters.push(e);
        continue;
      }

      // Фаза отбрасывания: летит по инерции, ИИ не работает.
      if (Math.abs(e.knx) > 0.1 || Math.abs(e.kny) > 0.1) {
        e.x += e.knx * 3;
        if (collidesWall(e.box, room)) e.x -= e.knx * 3;
        e.y += e.kny * 3;
        if (collidesWall(e.box, room)) e.y -= e.kny * 3;
        e.knx *= ENEMY.knockbackDecay;
        e.kny *= ENEMY.knockbackDecay;
        aliveCount++;
        if (e.atkTimer > 0) e.atkTimer--;
        continue;
      }
      e.knx = 0;
      e.kny = 0;

      aliveCount++;

      runAI(e, ctx);

      // Если за этот шаг враг умер от ИИ-фазы или снаряда (маловероятно,
      // но возможно при касании уже летящего), отслеживаем.
      if (!e.alive && e.type === 'splitter') deadSplitters.push(e);
      if (!e.alive) continue;

      // Контактный урон по игроку.
      if (e.atkTimer > 0) e.atkTimer--;
      if (dist(e.x, e.y, p.x, p.y) < (e.w + p.w) / 2 && p.invTimer <= 0 && e.atkTimer <= 0) {
        p.hp -= e.damage;
        p.invTimer = PLAYER.invFrames;
        e.atkTimer = ENEMY.attackCooldown;
        if (p.hp <= 0) {
          p.hp = 0;
          this.gameOver = true;
          for (const parent of deadSplitters) newEnemies.push(...spawnSplitterChildren(parent));
          room.enemies.push(...newEnemies);
          room.enemies = room.enemies.filter((en) => en.alive);
          return aliveCount;
        }
      }
    }

    // Распад splitter'ов на двух fast.
    for (const parent of deadSplitters) {
      newEnemies.push(...spawnSplitterChildren(parent));
    }

    room.enemies.push(...newEnemies);
    // Убираем мёртвых — иначе массив растёт и зашумляет итерации/рендер.
    room.enemies = room.enemies.filter((en) => en.alive);
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

  /** Спуск на следующий этаж: новая карта, усиленные враги, HP/оружие сохраняются. */
  private descend(): void {
    this.floor++;
    this.floorRules = scaleRulesForFloor(this.rules, this.floor);

    const p = this.player;
    const savedHp = p.hp;
    const savedMode = p.mode;

    const floorSeed = this.rules.seed !== undefined ? this.rules.seed + this.floor : undefined;
    this.rng = floorSeed !== undefined ? new Rng(floorSeed) : new Rng();

    this.roomMap = new RoomMap(this.rng, this.floorRules);
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
