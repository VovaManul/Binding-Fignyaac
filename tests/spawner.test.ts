import { describe, it, expect } from 'bun:test';
import { spawnEnemies } from '../src/core/systems/spawner';
import { Room } from '../src/core/world/Room';
import { Rng } from '../src/core/rng';
import { OX, OY, TILE, DOOR, SPAWN } from '../src/config';
import { dist } from '../src/core/util';

describe('spawner', () => {
  it('в обычной комнате врагов в ожидаемом диапазоне', () => {
    const room = new Room(1, 0, 'normal');
    for (let s = 0; s < 30; s++) {
      const enemies = spawnEnemies(room, 'left', OX + 5 * TILE, OY + 5 * TILE, new Rng(s + 1));
      expect(enemies.length).toBeGreaterThanOrEqual(SPAWN.normalMin);
      expect(enemies.length).toBeLessThanOrEqual(SPAWN.normalMin + SPAWN.normalExtra);
    }
  });

  it('в комнате-босс ровно один враг типа boss', () => {
    const room = new Room(1, 0, 'boss');
    const enemies = spawnEnemies(room, 'left', OX + 5 * TILE, OY + 5 * TILE, new Rng(1));
    expect(enemies.length).toBe(1);
    expect(enemies[0].type).toBe('boss');
  });

  it('в сокровищнице врагов нет', () => {
    const room = new Room(1, 0, 'treasure');
    const enemies = spawnEnemies(room, 'left', OX + 5 * TILE, OY + 5 * TILE, new Rng(1));
    expect(enemies.length).toBe(0);
  });

  it('враги не спавнятся вплотную к двери входа', () => {
    const room = new Room(1, 0, 'normal');
    const door = DOOR.left;
    const doorX = OX + door.cx * TILE + TILE / 2;
    const doorY = OY + door.cy * TILE + TILE / 2;
    for (let s = 0; s < 20; s++) {
      const enemies = spawnEnemies(room, 'left', OX + 7 * TILE, OY + 5 * TILE, new Rng(s + 100));
      for (const e of enemies) {
        expect(dist(e.x, e.y, doorX, doorY)).toBeGreaterThanOrEqual(SPAWN.minDistFromDoor);
      }
    }
  });
});
