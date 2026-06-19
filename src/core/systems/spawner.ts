import { OX, OY, TILE, COLS, ROWS, DOOR, SPAWN } from '../../config';
import { Enemy } from '../entities/Enemy';
import { Chest } from '../entities/Chest';
import { dist } from '../util';
import type { Room } from '../world/Room';
import type { Dir, EnemyType } from '../types';
import type { Rng } from '../rng';
import type { WeaponId } from '../weapons';
import { DEFAULT_RULES, type LevelRules } from '../rules';

function isSpawnSpotClear(
  x: number,
  y: number,
  doorX: number,
  doorY: number,
  playerX: number,
  playerY: number,
  enemies: readonly Enemy[],
): boolean {
  if (dist(x, y, doorX, doorY) < SPAWN.minDistFromDoor) return false;
  if (dist(x, y, playerX, playerY) < SPAWN.minDistFromPlayer) return false;
  for (const e of enemies) {
    if (dist(x, y, e.x, e.y) < SPAWN.minDistBetween) return false;
  }
  return true;
}

/**
 * Подбирает врагов для комнаты и расставляет их так, чтобы они не появились
 * вплотную к двери входа, к игроку или друг к другу. Число, тип и сила врагов
 * берутся из правил уровня (rules). Возвращает массив — вызывающий код кладёт
 * его в room.enemies.
 */
function pickEnemyType(room: Room, rng: Rng, fastChance: number): EnemyType {
  if (room.type === 'boss') return 'boss';
  const roll = rng.next();
  // normal: до 0.4, fast: 0.4-0.6, charger: 0.6-0.75, tank: 0.75-0.88, shooter: 0.88-0.95, splitter: 0.95-1.0
  if (roll < 0.4) return 'normal';
  if (roll < 0.4 + fastChance * 0.7) return 'fast';
  if (roll < 0.7) return 'charger';
  if (roll < 0.85) return 'tank';
  if (roll < 0.95) return 'shooter';
  return 'splitter';
}

export function spawnEnemies(
  room: Room,
  entryDir: Dir,
  playerX: number,
  playerY: number,
  rng: Rng,
  rules: LevelRules = DEFAULT_RULES,
): Enemy[] {
  const enemies: Enemy[] = [];
  const er = rules.enemies;

  const count =
    room.type === 'boss' ? 1 :
    room.type === 'treasure' || room.type === 'secret' ? 0 :
    Math.max(1, Math.round((SPAWN.normalMin + rng.int(0, SPAWN.normalExtra)) * er.densityMul));

  const door = DOOR[entryDir];
  const doorX = OX + door.cx * TILE + TILE / 2;
  const doorY = OY + door.cy * TILE + TILE / 2;

  for (let i = 0; i < count; i++) {
    const type: EnemyType = pickEnemyType(room, rng, er.fastChance);
    const mods = {
      hpMul: er.hpMul * (type === 'boss' ? er.bossHpMul : 1),
      speedMul: er.speedMul,
    };

    let x = 0;
    let y = 0;
    let ok = false;
    for (let tries = 0; tries < SPAWN.maxPlacementTries && !ok; tries++) {
      x = OX + 2 * TILE + rng.float(0, COLS - 4) * TILE;
      y = OY + 2 * TILE + rng.float(0, ROWS - 4) * TILE;
      ok = isSpawnSpotClear(x, y, doorX, doorY, playerX, playerY, enemies);
    }
    if (!ok) continue;

    enemies.push(new Enemy(x, y, type, mods));
  }

  return enemies;
}

const TREASURE_WEAPONS: WeaponId[] = ['shotgun', 'axe', 'staff', 'whip', 'bomb', 'boomerang', 'laser'];

export function spawnChest(room: Room, rng: Rng): Chest {
  const cx = OX + (COLS / 2) * TILE;
  const cy = OY + (ROWS / 2) * TILE;
  return new Chest(cx, cy);
}

export function pickChestWeapon(rng: Rng): WeaponId {
  return rng.pick(TREASURE_WEAPONS);
}
