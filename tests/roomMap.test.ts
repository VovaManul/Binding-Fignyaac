import { describe, it, expect } from 'bun:test';
import { RoomMap } from '../src/core/world/RoomMap';
import { Rng } from '../src/core/rng';
import { OPP } from '../src/config';
import type { Dir } from '../src/core/types';

const NEIGHBOR: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

describe('RoomMap', () => {
  // Перебираем много seed: генерация случайная, баги могут прятаться в редких раскладах.
  const maps = Array.from({ length: 50 }, (_, i) => new RoomMap(new Rng(i + 1)));

  it('РЕГРЕССИЯ: карта не пустая (генерация реально вызвана)', () => {
    // Именно тут раньше всё падало: конструктор не звал generate() и карта была пустой.
    for (const m of maps) {
      expect(m.rooms.size).toBeGreaterThan(1);
    }
  });

  it('всегда есть спавн в (0,0)', () => {
    for (const m of maps) {
      expect(m.get(0, 0)?.type).toBe('spawn');
    }
  });

  it('всегда есть ровно одна (минимум одна) комната-босс', () => {
    for (const m of maps) {
      const bosses = [...m.rooms.values()].filter((r) => r.type === 'boss');
      expect(bosses.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('двери симметричны: дверь A→B всегда имеет встречную B→A', () => {
    for (const m of maps) {
      for (const room of m.rooms.values()) {
        for (const dir of Object.keys(NEIGHBOR) as Dir[]) {
          if (!room.doors[dir]) continue;
          const [dc, dr] = NEIGHBOR[dir];
          const neighbor = m.get(room.c + dc, room.r + dr);
          expect(neighbor).toBeDefined();
          expect(neighbor!.doors[OPP[dir]]).toBe(true);
        }
      }
    }
  });

  it('карта связна: все комнаты достижимы из спавна по дверям', () => {
    for (const m of maps) {
      const start = m.get(0, 0)!;
      const seen = new Set<string>([`${start.c},${start.r}`]);
      const queue = [start];
      while (queue.length) {
        const room = queue.shift()!;
        for (const dir of Object.keys(NEIGHBOR) as Dir[]) {
          if (!room.doors[dir]) continue;
          const [dc, dr] = NEIGHBOR[dir];
          const n = m.get(room.c + dc, room.r + dr);
          if (n && !seen.has(`${n.c},${n.r}`)) {
            seen.add(`${n.c},${n.r}`);
            queue.push(n);
          }
        }
      }
      expect(seen.size).toBe(m.rooms.size);
    }
  });
});
