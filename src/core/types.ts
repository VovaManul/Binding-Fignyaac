/** Общие типы данных, на которые опирается вся игра. */

export type RoomType = 'spawn' | 'normal' | 'treasure' | 'boss';
export type Dir = 'up' | 'down' | 'left' | 'right';
export type CombatMode = 0 | 1; // MODE_RANGED | MODE_MELEE
export type EnemyType = 'normal' | 'fast' | 'boss' | 'charger' | 'tank' | 'shooter';
export type ProjectileType = 'tear' | 'fireball' | 'bomb' | 'boomerang' | 'laser' | 'beam';

/** Прямоугольник (axis-aligned bounding box) для коллизий. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Какие из четырёх дверей есть у комнаты. */
export interface Doors {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}
