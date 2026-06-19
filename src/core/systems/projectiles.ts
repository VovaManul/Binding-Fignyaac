import { BOSS, ENEMY, PROJECTILE, TILE, OX, OY, COLS, ROWS, T_WALL } from '../../config';
import { dist } from '../util';
import { Projectile } from '../entities/Projectile';
import type { Player, PlayerStats } from '../entities/Player';
import type { Room } from '../world/Room';
import type { WeaponDef } from '../weapons';

/**
 * Применяет к свежему снаряду характеристики оружия (урон, горение, радиус
 * взрыва) с учётом статов игрока (damageMul, rangeMul, shotSpeedMul).
 * Снаряд запоминает свойства на момент выстрела — поэтому смена оружия или
 * статов после не меняет урон уже летящей «слезы».
 */
export function applyWeaponProjectileStats(t: Projectile, w: WeaponDef, stats: PlayerStats | Player): void {
  const s: PlayerStats = 'stats' in stats ? stats.stats : stats;
  t.damage = w.damage * s.damageMul;
  t.burnDamage = (w.fireDmg ?? 1) * s.damageMul;
  t.burnInterval = w.fireInterval ?? 10;
  t.burnDuration = w.fireDuration ?? 0;
  t.explosionRadius = w.explosionRadius ?? 0;
  t.speed *= s.shotSpeedMul;
  t.life = Math.round(t.life * s.rangeMul);
}

/** Взрыв бомбы: AoE-урон по всем врагам в радиусе, с отбрасыванием от центра. */
export function explodeBomb(room: Room, t: Projectile): void {
  if (t.type !== 'bomb') return;
  const radius = t.explosionRadius || 60;
  for (const e of room.enemies) {
    if (!e.alive) continue;
    if (dist(t.x, t.y, e.x, e.y) < radius) {
      e.hp -= 3;
      e.hitTimer = ENEMY.hitFlash;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      const d = Math.hypot(dx, dy) || 1;
      e.knx = (dx / d) * 12;
      e.kny = (dy / d) * 12;
    }
  }
}

/** True, если снаряд вышел за пределы комнаты или уткнулся в стену. */
export function projectileHitWall(t: Projectile, room: Room): boolean {
  const col = Math.floor((t.x - OX) / TILE);
  const row = Math.floor((t.y - OY) / TILE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  if (room.tiles[row][col] === T_WALL) return true;
  return false;
}

/**
 * Параметры, общие для всех боссов: лимит миньёнов и интервал их спавна
 * вынесены в BOSS (см. config), чтобы их можно было крутить отдельно от ИИ.
 */
export const BOSS_LIMITS = {
  maxMinions: BOSS.maxMinions,
  minionInterval: BOSS.minionInterval,
} as const;

/** Текущая скорость снаряда по умолчанию (для новых снарядов, не задающих свою). */
export const PROJECTILE_DEFAULTS = {
  speed: PROJECTILE.speed,
  life: PROJECTILE.life,
} as const;
