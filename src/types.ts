export type RoomType = 'spawn' | 'normal' | 'treasure' | 'boss';
export type Dir = 'up' | 'down' | 'left' | 'right';
export type CombatMode = 0 | 1; // MODE_RANGED | MODE_MELEE

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Doors {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}
