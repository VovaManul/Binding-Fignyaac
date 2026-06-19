import { BOSS, ENEMY, OX, OY, TILE, COLS, ROWS } from '../../config';
import { moveEntity } from './movement';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import type { Room } from '../world/Room';
import type { Player } from '../entities/Player';
import type { Rng } from '../rng';
import type { LevelRules } from '../rules';

/**
 * Контекст, нужный ИИ врагов на одном шаге. Передаётся извне (Game), чтобы
 * сами функции ИИ оставались чистыми от глобального состояния и их было
 * удобно тестировать.
 */
export interface AIContext {
  room: Room;
  player: Player;
  rng: Rng;
  floor: number;
  floorRules: LevelRules;
  /** Сюда босс складывает свежеспавненных миньёнов — Game добавит их в room.enemies. */
  newEnemies: Enemy[];
}

/** Этаж кратный 5, начиная с 5 — на нём босс получает фазы и спавн миньёнов. */
export function isMilestoneBossFloor(floor: number): boolean {
  return floor % 5 === 0 && floor >= 5;
}

/**
 * Раздвоение splitter'а при смерти: спавнит двух мелких `fast` по бокам.
 * Возвращает свежезаспавненных врагов — Game добавит их в room.enemies.
 */
export function spawnSplitterChildren(parent: Enemy): Enemy[] {
  const offset = 14;
  return [
    new Enemy(parent.x - offset, parent.y, 'fast'),
    new Enemy(parent.x + offset, parent.y, 'fast'),
  ];
}

type AIHandler = (e: Enemy, ctx: AIContext) => void;

/**
 * Диспетчер ИИ по типу врага. Добавишь новый тип — допиши ветку здесь
 * (и в EnemyType/config). Заменяет прежний if/else-if каскад в Game.ts.
 */
export function runAI(e: Enemy, ctx: AIContext): void {
  const handler = pickHandler(e, ctx.floor);
  handler(e, ctx);
}

function pickHandler(e: Enemy, floor: number): AIHandler {
  if (e.type === 'boss' && isMilestoneBossFloor(floor)) return updateMilestoneBoss;
  if (e.type === 'shooter') return updateShooter;
  if (e.type === 'charger') return updateCharger;
  // normal, fast, tank, обычный boss — просто догоняют.
  return updateChaser;
}

/** Стандартное преследование (normal, fast, tank, обычный boss). */
function updateChaser(e: Enemy, ctx: AIContext): void {
  const { player: p, room } = ctx;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d > 0 && d < ENEMY.aggroRange) {
    moveEntity(e, (dx / d) * e.speed, (dy / d) * e.speed, room);
  }
}

/** Зарядчик: бежит прямо на игрока, время от времени делая рывок ×2.5. */
function updateCharger(e: Enemy, ctx: AIContext): void {
  const { player: p, room } = ctx;
  if (e.chargeTimer > 0) e.chargeTimer--;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d > 0 && d < ENEMY.aggroRange) {
    const speedMul = e.chargeTimer <= 0 && d < 150 ? 2.5 : 1.0;
    if (speedMul > 1) e.chargeTimer = 40; // перезарядка рывка
    moveEntity(e, (dx / d) * e.speed * speedMul, (dy / d) * e.speed * speedMul, room);
  }
}

/** Стрелок: держит дистанцию ~150–200 px, периодически стреляет в игрока. */
function updateShooter(e: Enemy, ctx: AIContext): void {
  const { player: p, room } = ctx;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy);

  if (d > 0 && d < ENEMY.aggroRange) {
    if (d < 150) {
      // Слишком близко — отступает.
      moveEntity(e, -(dx / d) * e.speed, -(dy / d) * e.speed, room);
    } else {
      moveEntity(e, (dx / d) * e.speed * 0.5, (dy / d) * e.speed * 0.5, room);
    }
  }

  // Стрельба.
  if (e.shootTimer > 0) e.shootTimer--;
  if (e.shootTimer <= 0 && d < 350 && d > 40) {
    e.shootTimer = 45;
    const nd = d || 1;
    const t = new Projectile(e.x, e.y, dx / nd, dy / nd, 'tear');
    t.hostile = true;
    t.damage = 1;
    t.speed = 3.5;
    t.life = 60;
    ctx.room.tears.push(t);
  }
}

/** Milestone-босс (этаж 5/10/15): фазы HP, стрельба с фазы 2, миньёны с фазы 3. */
function updateMilestoneBoss(e: Enemy, ctx: AIContext): void {
  const { player: p, room, rng, floor, floorRules, newEnemies } = ctx;
  const maxPhase = floor <= 5 ? 2 : 3;
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
    moveEntity(e, (dx / d) * effectiveSpeed, (dy / d) * effectiveSpeed, room);
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
      t.damage = 1 + Math.floor(floor / 5);
      t.speed = 3;
      t.life = 60;
      room.tears.push(t);
    }
  }

  // Спавн миньёнов (фаза 3), но не больше BOSS.maxMinions живых — иначе комната не зачистится.
  if (targetPhase >= 3) {
    if (e.spawnTimer > 0) e.spawnTimer--;
    const aliveMinions = room.enemies.filter((en) => en !== e && en.alive).length;
    if (e.spawnTimer <= 0 && aliveMinions < BOSS.maxMinions) {
      e.spawnTimer = BOSS.minionInterval;
      const mx = OX + 2 * TILE + rng.float(0, COLS - 4) * TILE;
      const my = OY + 2 * TILE + rng.float(0, ROWS - 4) * TILE;
      const er = floorRules.enemies;
      newEnemies.push(new Enemy(mx, my, 'fast', { hpMul: er.hpMul * 1.5, speedMul: er.speedMul * 1.2 }));
    }
  }
}
