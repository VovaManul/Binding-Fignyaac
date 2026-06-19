import type { RoomType, Doors } from '../types';
import { buildTiles } from './tiles';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import type { Chest } from '../entities/Chest';
import type { WeaponPickup } from '../entities/WeaponPickup';

/**
 * Комната дандженa. Хранит свой тип, набор дверей, состояние «зачищена/
 * посещена» и живущие в ней сущности. Двери в тайлах появляются только
 * когда комната зачищена (или это спавн) — пока враги живы, выходы закрыты.
 */
export class Room {
  readonly c: number;
  readonly r: number;
  type: RoomType;
  doors: Doors = { up: false, down: false, left: false, right: false };
  visited = false;
  cleared = false;
  enemies: Enemy[] = [];
  tears: Projectile[] = [];
  chest: Chest | null = null;
  pickup: WeaponPickup | null = null;
  tiles: number[][];

  constructor(c: number, r: number, type: RoomType) {
    this.c = c;
    this.r = r;
    this.type = type;
    this.tiles = buildTiles();
  }

  /** Перестроить тайлы; двери прорезаются, если комната зачищена или это спавн. */
  rebuildTiles(): void {
    const showDoors = this.cleared || this.type === 'spawn';
    this.tiles = buildTiles(showDoors ? this.doors : undefined);
  }
}
