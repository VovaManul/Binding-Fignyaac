import { OPP, SPAWN } from '../../config';
import { Room } from './Room';
import type { Dir, RoomType } from '../types';
import type { Rng } from '../rng';
import { DEFAULT_RULES, type LevelRules } from '../rules';

/**
 * Карта комнат: связный набор комнат на сетке (2*MAP_RADIUS+1)².
 * Генерируется случайным блужданием СРАЗУ в конструкторе — поэтому
 * `new RoomMap(rng)` всегда даёт готовую карту (раньше тут терялся вызов
 * generate(), и игра падала на пустой карте).
 */
export class RoomMap {
  readonly rooms = new Map<string, Room>();

  constructor(rng: Rng, private readonly rules: LevelRules = DEFAULT_RULES) {
    this.generate(rng);
  }

  private key(c: number, r: number): string {
    return c + ',' + r;
  }

  get(c: number, r: number): Room | undefined {
    return this.rooms.get(this.key(c, r));
  }

  has(c: number, r: number): boolean {
    return this.rooms.has(this.key(c, r));
  }

  private add(c: number, r: number, type: RoomType): Room {
    const room = new Room(c, r, type);
    this.rooms.set(this.key(c, r), room);
    return room;
  }

  private hasBoss(): boolean {
    for (const room of this.rooms.values()) {
      if (room.type === 'boss') return true;
    }
    return false;
  }

  private generate(rng: Rng): void {
    this.add(0, 0, 'spawn');

    const { minRooms, extraRooms, mapRadius } = this.rules.map;
    const frontier: Array<[number, number]> = [[0, 0]];
    let count = 1;
    const target = minRooms + rng.int(0, extraRooms);

    const dirs: Array<[Dir, number, number]> = [
      ['up', 0, -1],
      ['down', 0, 1],
      ['left', -1, 0],
      ['right', 1, 0],
    ];

    while (frontier.length > 0 && count < target) {
      const idx = rng.int(0, frontier.length - 1);
      const [c, r] = frontier[idx];
      rng.shuffle(dirs);
      let added = false;

      for (const [dir, dc, dr] of dirs) {
        if (count >= target) break;
        const nc = c + dc;
        const nr = r + dr;

        if (Math.abs(nc) > mapRadius || Math.abs(nr) > mapRadius) continue;
        if (this.has(nc, nr)) continue;

        let type: RoomType = 'normal';
        if (!this.hasBoss() && (count === target - 1 || (rng.chance(SPAWN.bossChance) && count >= 3))) {
          type = 'boss';
        } else if (rng.chance(SPAWN.treasureChance) && count >= 2) {
          type = 'treasure';
        }

        this.add(nc, nr, type);
        // Открываем дверь у текущей комнаты и ВСТРЕЧНУЮ дверь у соседа.
        this.get(c, r)!.doors[dir] = true;
        this.get(nc, nr)!.doors[OPP[dir]] = true;

        frontier.push([nc, nr]);
        count++;
        added = true;
      }

      if (!added) frontier.splice(idx, 1);
    }

    // Страховка: если босс почему-то не появился — назначаем им любую
    // не-спавновую комнату.
    if (!this.hasBoss()) {
      const candidates = [...this.rooms.values()].filter((rm) => rm.type !== 'spawn');
      if (candidates.length > 0) {
        candidates[rng.int(0, candidates.length - 1)].type = 'boss';
      }
    }
  }
}
