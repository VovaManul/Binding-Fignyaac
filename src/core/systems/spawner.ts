import { OX, OY, TILE, COLS, ROWS, DOOR, SPAWN } from '../../config';
import { Enemy } from '../entities/Enemy';
import { dist } from '../util';
import type { Room } from '../world/Room';
import type { Dir, EnemyType } from '../types';
import type { Rng } from '../rng';
import { DEFAULT_RULES, type LevelRules } from '../rules';

/**
 * Подбирает врагов для комнаты и расставляет их так, чтобы они не появились
 * вплотную к двери входа, к игроку или друг к другу. Число, тип и сила врагов
 * берутся из правил уровня (rules). Возвращает массив — вызывающий код кладёт
 * его в room.enemies.
 */
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
    room.type === 'treasure' ? 0 :
    Math.max(1, Math.round((SPAWN.normalMin + rng.int(0, SPAWN.normalExtra)) * er.densityMul));

  const door = DOOR[entryDir];
  const doorX = OX + door.cx * TILE + TILE / 2;
  const doorY = OY + door.cy * TILE + TILE / 2;

  for (let i = 0; i < count; i++) {
    const type: EnemyType =
      room.type === 'boss' ? 'boss' : rng.chance(er.fastChance) ? 'fast' : 'normal';
    const mods = {
      hpMul: er.hpMul * (type === 'boss' ? er.bossHpMul : 1),
      speedMul: er.speedMul,
    };

    let x = 0;
    let y = 0;
    let ok = false;
    for (let tries = 0; tries < 100 && !ok; tries++) {
      x = OX + 2 * TILE + rng.float(0, COLS - 4) * TILE;
      y = OY + 2 * TILE + rng.float(0, ROWS - 4) * TILE;
      ok = true;

      if (dist(x, y, doorX, doorY) < SPAWN.minDistFromDoor) ok = false;
      else if (dist(x, y, playerX, playerY) < SPAWN.minDistFromPlayer) ok = false;
      else {
        for (const e of enemies) {
          if (dist(x, y, e.x, e.y) < SPAWN.minDistBetween) { ok = false; break; }
        }
      }
    }

    enemies.push(new Enemy(x, y, type, mods));
  }

  return enemies;
}
