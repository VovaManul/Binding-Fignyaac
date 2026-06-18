import type { RoomType, Doors } from '../types';
import { buildTiles } from './tiles';
import { Enemy } from '../entities/Enemy';
import { Tear } from '../entities/Tear';

export class Room {
  c: number;
  r: number;
  type: RoomType;
  doors: Doors = { up: false, down: false, left: false, right: false };
  visited = false;
  cleared = false;
  enemies: Enemy[] = [];
  tears: Tear[] = [];
  tiles: number[][];

  constructor(c: number, r: number, type: RoomType) {
    this.c = c;
    this.r = r;
    this.type = type;
    this.tiles = buildTiles();
  }

  /** Rebuild base tiles and optionally place doors if cleared */
  buildTiles(): void {
    this.tiles = buildTiles(this.cleared || this.type === 'spawn' ? this.doors : undefined);
  }
}
