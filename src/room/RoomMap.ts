import { MAP_RADIUS, MIN_ROOMS, EXTRA_ROOMS } from '../constants';
import { Room } from './Room';
import type { RoomType } from '../types';
import { shuffle, ri } from '../math';
import { OPP } from '../doors';

export class RoomMap {
  rooms: Map<string, Room> = new Map();

  key(c: number, r: number): string {
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

  hasBoss(): boolean {
    for (const room of this.rooms.values()) {
      if (room.type === 'boss') return true;
    }
    return false;
  }

  /** Generate a connected 7×7 grid of rooms using a random walk */
  generate(): void {
    this.add(0, 0, 'spawn');
    const frontier: [number, number][] = [[0, 0]];
    let count = 1;
    const target = MIN_ROOMS + ri(0, EXTRA_ROOMS);
    const dirs: [string, number, number][] = [
      ['up', 0, -1],
      ['down', 0, 1],
      ['left', -1, 0],
      ['right', 1, 0],
    ];

    while (frontier.length > 0 && count < target) {
      const idx = ri(0, frontier.length - 1);
      const [cr, cc] = frontier[idx];
      shuffle(dirs);
      let added = false;

      for (const [_d, dc, dr] of dirs) {
        if (count >= target) break;
        const nc = cr + dc;
        const nr = cc + dr;

        if (Math.abs(nc) > MAP_RADIUS || Math.abs(nr) > MAP_RADIUS) continue;
        if (this.has(nc, nr)) continue;

        let type: RoomType = 'normal';
        if (!this.hasBoss() && (count === target - 1 || (Math.random() < 0.2 && count >= 3))) {
          type = 'boss';
        } else if (Math.random() < 0.12 && count >= 2) {
          type = 'treasure';
        }

        this.add(nc, nr, type);
        const dir = _d as keyof typeof OPP;
        this.get(cr, cc)!.doors[dir] = true;
        this.get(nc, nr)!.doors[OPP[dir] as keyof typeof OPP] = true;
        frontier.push([nc, nr]);
        count++;
        added = true;
      }

      if (!added) frontier.splice(idx, 1);
    }

    // Ensure at least one boss room exists
    if (!this.hasBoss()) {
      const normals = [...this.rooms.values()].filter(r => r.type === 'normal');
      if (normals.length > 0) {
        normals[ri(0, normals.length - 1)].type = 'boss';
      }
    }
  }
}
